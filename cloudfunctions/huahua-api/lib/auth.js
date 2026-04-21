/**
 * 登录 / Token 认证
 *
 * - wx: 调 api.weixin.qq.com/sns/jscode2session
 * - dy: 调 developer.toutiao.com/api/apps/v2/jscode2session
 * - tap: 当前占位，仅校验 taptapUserId 非空
 * - anon: 直接把客户端传的 anonId 作为 userId 后缀
 */

const jwt = require('jsonwebtoken');
const { httpError } = require('./http');
const {
  getGameKey,
  getJwtSecret: _readJwtSecret,
  getTtlSec,
} = require('./config');

const SUPPORTED_PLATFORMS = new Set(['wx', 'dy', 'tap', 'anon']);

function getJwtSecret() {
  const s = _readJwtSecret();
  if (!s) {
    const gk = getGameKey().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    throw httpError(500, 'NO_JWT_SECRET', `${gk}_JWT_SECRET (或 HUAHUA_JWT_SECRET) 未配置`);
  }
  return s;
}

async function handleLogin(req) {
  const body = req.body || {};
  const platform = String(body.platform || '').toLowerCase();
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw httpError(400, 'BAD_PLATFORM', `unsupported platform: ${platform}`);
  }

  let platformUid = '';

  if (platform === 'wx') {
    platformUid = await wxCode2Openid(body.code);
  } else if (platform === 'dy') {
    platformUid = await ttCode2Openid(body.code);
  } else if (platform === 'tap') {
    const id = String(body.taptapUserId || '').trim();
    if (!id) throw httpError(400, 'NO_TAP_ID', 'taptapUserId 缺失');
    platformUid = id;
  } else if (platform === 'anon') {
    const id = String(body.anonId || '').trim();
    if (!id) throw httpError(400, 'NO_ANON_ID', 'anonId 缺失');
    if (!/^[A-Za-z0-9_\-:.]{8,128}$/.test(id)) {
      throw httpError(400, 'BAD_ANON_ID', 'anonId 非法');
    }
    platformUid = id;
  }

  const userId = `${platform}:${platformUid}`;
  const ttlSec = getTtlSec();
  const secret = getJwtSecret();
  const gameKey = getGameKey();
  const now = Math.floor(Date.now() / 1000);

  // gk = gameKey，验证时若 token gk 与当前函数 GAME_KEY 不一致则拒绝
  const token = jwt.sign(
    { sub: userId, plt: platform, gk: gameKey, iat: now },
    secret,
    { expiresIn: ttlSec },
  );

  return {
    token,
    userId,
    platform,
    gameKey,
    expiresAt: (now + ttlSec) * 1000,
    ttlSec,
  };
}

/** 供 save 层复用：从 Authorization 头解析 userId；失败抛 401 */
function requireUser(req) {
  const authHeader = (req.headers && req.headers.authorization) || '';
  const m = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!m) throw httpError(401, 'NO_TOKEN', '缺少 Authorization: Bearer <token>');
  const token = m[1].trim();

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch (e) {
    throw httpError(401, 'BAD_TOKEN', e && e.message ? e.message : 'token 无效');
  }

  const userId = payload && payload.sub;
  if (!userId || typeof userId !== 'string' || !userId.includes(':')) {
    throw httpError(401, 'BAD_TOKEN', 'token sub 非法');
  }

  // 若 token 带 gk 字段，必须与当前函数 GAME_KEY 一致，防止跨游戏拿 token 打本游戏函数
  const currentGk = getGameKey();
  if (payload.gk && payload.gk !== currentGk) {
    throw httpError(401, 'BAD_TOKEN', `token gameKey=${payload.gk} 与当前 GAME_KEY=${currentGk} 不匹配`);
  }

  return { userId, platform: payload.plt || userId.split(':')[0] };
}

async function wxCode2Openid(code) {
  // CloudBase/SCF 在某些环境会把 Key 为 `WX_APPID` / `WX_SECRET` 的值强制清空
  // （怀疑被当成小程序 AppID 保留字脱敏处理），所以这里优先读带游戏前缀的
  // `HUAHUA_WX_APPID` / `HUAHUA_WX_SECRET`，老的 `WX_APPID` / `WX_SECRET` 仅作兜底。
  const appid = process.env.HUAHUA_WX_APPID || process.env.WX_APPID;
  const secret = process.env.HUAHUA_WX_SECRET || process.env.WX_SECRET;
  if (!appid || !secret) throw httpError(500, 'NO_WX_CFG', 'HUAHUA_WX_APPID/HUAHUA_WX_SECRET 未配置');
  if (!code) throw httpError(400, 'NO_CODE', 'wx code 缺失');

  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  const data = await httpGetJson(url);
  if (!data || !data.openid) {
    throw httpError(401, 'WX_LOGIN_FAIL', `wx code2session 失败: ${JSON.stringify(data || {})}`);
  }
  return data.openid;
}

async function ttCode2Openid(code) {
  // 同 wxCode2Openid，抖音这组 env 也统一加游戏前缀，避免平台保留字冲突。
  const appid = process.env.HUAHUA_TT_APPID || process.env.TT_APPID;
  const secret = process.env.HUAHUA_TT_SECRET || process.env.TT_SECRET;
  if (!appid || !secret) throw httpError(500, 'NO_TT_CFG', 'HUAHUA_TT_APPID/HUAHUA_TT_SECRET 未配置');
  if (!code) throw httpError(400, 'NO_CODE', 'dy code 缺失');

  const url = 'https://developer.toutiao.com/api/apps/v2/jscode2session';
  const data = await httpPostJson(url, { appid, secret, code });
  // 抖音返回结构：{ err_no, err_tips, data: { openid, session_key, ... } }
  if (!data || data.err_no !== 0 || !data.data || !data.data.openid) {
    throw httpError(401, 'TT_LOGIN_FAIL', `dy code2session 失败: ${JSON.stringify(data || {})}`);
  }
  return data.data.openid;
}

function httpGetJson(url) {
  return httpRequestJson(url, 'GET');
}

function httpPostJson(url, body) {
  return httpRequestJson(url, 'POST', body);
}

function httpRequestJson(url, method, body) {
  // Node 18+ 内置 fetch；CloudBase 函数默认 Node 16/18+，若低版本将抛错提示升级
  if (typeof fetch !== 'function') {
    return Promise.reject(httpError(500, 'NO_FETCH', '当前 Node 运行时不支持 fetch，请使用 Node 18+'));
  }
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (_) {
      return { _raw: text };
    }
  });
}

module.exports = {
  handleLogin,
  requireUser,
};
