/**
 * 微信游戏圈数据解密接口（POST /game-club/decrypt）
 *
 * 客户端流程：
 *   1) wx.login() 拿最新 code
 *   2) wx.getGameClubData({ dataTypeList: [{ type: 1 }, { type: 4 }, { type: 5 }, { type: 6 }] })
 *   3) POST /game-club/decrypt { code, encryptedData, iv }
 *
 * 服务端用最新 session_key 做 AES-128-CBC 解密，避免缓存 session_key 过期问题。
 */

const crypto = require('crypto');
const { requireUser, wxCode2Session } = require('./auth');
const { httpError } = require('./http');

function decryptAes128Cbc(sessionKeyB64, encryptedDataB64, ivB64) {
  const key = Buffer.from(sessionKeyB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const cipherBuf = Buffer.from(encryptedDataB64, 'base64');
  if (key.length !== 16 || iv.length !== 16) {
    throw httpError(400, 'BAD_CRYPTO_PARAM', 'session_key 或 iv 长度异常');
  }
  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(true);
    let out = decipher.update(cipherBuf, undefined, 'utf8');
    out += decipher.final('utf8');
    return JSON.parse(out);
  } catch (err) {
    throw httpError(400, 'DECRYPT_FAIL', `游戏圈数据解密失败: ${(err && err.message) || err}`);
  }
}

function extractMetrics(parsed) {
  const list = Array.isArray(parsed && parsed.dataList) ? parsed.dataList : [];
  let joinTime = 0;
  let todayLikes = 0;
  let todayComments = 0;
  let todayPosts = 0;

  for (const item of list) {
    const t = Number(item && item.dataType && item.dataType.type);
    const val = Math.max(0, Math.floor(Number(item && item.value) || 0));
    if (t === 1) joinTime = val;
    else if (t === 4) todayLikes = val;
    else if (t === 5) todayComments = val;
    else if (t === 6) todayPosts = val;
  }

  return {
    joined: joinTime > 0,
    joinTime,
    todayLikes,
    todayComments,
    todayPosts,
  };
}

async function handleDecryptGameClubData(req) {
  const user = requireUser(req);
  if (user.platform !== 'wx') {
    throw httpError(400, 'WX_ONLY', '游戏圈数据仅支持微信小游戏');
  }

  const body = req.body || {};
  const code = String(body.code || '').trim();
  const encryptedData = String(body.encryptedData || '').trim();
  const iv = String(body.iv || '').trim();

  if (!code || !encryptedData || !iv) {
    throw httpError(400, 'MISSING_PARAM', 'code / encryptedData / iv 不能为空');
  }

  const session = await wxCode2Session(code);
  if (`wx:${session.openid}` !== user.userId) {
    throw httpError(403, 'USER_MISMATCH', '登录态 openid 与当前帐号不一致');
  }
  if (!session.session_key) {
    throw httpError(500, 'NO_SESSION_KEY', '微信未返回 session_key');
  }

  const parsed = decryptAes128Cbc(session.session_key, encryptedData, iv);
  return {
    metrics: extractMetrics(parsed),
    syncedAt: Date.now(),
  };
}

module.exports = {
  handleDecryptGameClubData,
  decryptAes128Cbc,
  extractMetrics,
};
