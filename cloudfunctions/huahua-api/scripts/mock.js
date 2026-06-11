/**
 * 本地联调 mock：不依赖 CloudBase，把 save 集合读写替换为内存。
 * 运行：node scripts/mock.js
 *
 * 依赖：node 18+（内置 fetch）；不需要真实的 WX/TT AppSecret（会走 anon 登录路径）。
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

process.env.HUAHUA_JWT_SECRET = process.env.HUAHUA_JWT_SECRET || 'dev-secret-do-not-use-in-prod';
process.env.HUAHUA_TOKEN_TTL_SEC = process.env.HUAHUA_TOKEN_TTL_SEC || '3600';
process.env.HUAHUA_WECHAT_PUSH_TOKEN = process.env.HUAHUA_WECHAT_PUSH_TOKEN || 'huahua_gift_2026';

// 劫持 @cloudbase/node-sdk，伪造内存集合
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === '@cloudbase/node-sdk') {
    return require.resolve('./fake-tcb.js');
  }
  return origResolve.call(this, request, parent, ...rest);
};

const { main } = require('../index');

async function httpCall(method, path, body, headers = {}, query = {}) {
  const event = {
    httpMethod: method,
    path,
    headers: { 'content-type': 'application/json', ...headers },
    queryStringParameters: query,
    body: body === undefined ? '' : (typeof body === 'string' ? body : JSON.stringify(body || {})),
    isBase64Encoded: false,
  };
  const res = await main(event, {});
  const parsed = res && res.body ? (() => { try { return JSON.parse(res.body); } catch { return res.body; } })() : res;
  console.log(`[${method} ${path}]`, res && res.statusCode, JSON.stringify(parsed));
  return { statusCode: res && res.statusCode, body: parsed };
}

async function call(path, body, headers = {}) {
  return httpCall('POST', path, body, headers);
}

function signWechatPush(timestamp, nonce) {
  return crypto
    .createHash('sha1')
    .update(['huahua_gift_2026', timestamp, nonce].sort().join(''))
    .digest('hex');
}

(async () => {
  // 1) anon 登录
  const login = await call('/login', { platform: 'anon', anonId: 'testuser-0001' });
  const token = login.body && login.body.data && login.body.data.token;
  if (!token) throw new Error('login failed');
  const auth = { authorization: `Bearer ${token}` };

  // 2) pull（期望 exists: false）
  await call('/save/pull', {}, auth);

  // 3) push v1
  const now = Date.now();
  await call('/save/push', {
    schemaVersion: 1,
    updatedAt: now,
    baseRemoteUpdatedAt: 0,
    clientFingerprint: 'mock|dev',
    payload: { huahua_save: JSON.stringify({ ver: 1, coin: 100 }) },
  }, auth);

  // 4) pull 再次（期望 exists: true，数据一致）
  await call('/save/pull', {}, auth);

  // 5) push 旧 updatedAt（期望 409 STALE_UPDATE）
  await call('/save/push', {
    schemaVersion: 1,
    updatedAt: now - 1000,
    baseRemoteUpdatedAt: now,
    clientFingerprint: 'mock|dev',
    payload: { huahua_save: JSON.stringify({ ver: 1, coin: 50 }) },
  }, auth);

  // 6) push 新 updatedAt 但旧云端基线（期望 409 STALE_UPDATE，防本地旧缓存回写）
  await call('/save/push', {
    schemaVersion: 1,
    updatedAt: now + 1000,
    baseRemoteUpdatedAt: 0,
    clientFingerprint: 'mock|dev',
    payload: { huahua_save: JSON.stringify({ ver: 1, coin: 20 }) },
  }, auth);

  // 7) push 新 updatedAt 且基于当前云端版本（期望 ok）
  await call('/save/push', {
    schemaVersion: 1,
    updatedAt: now + 1000,
    baseRemoteUpdatedAt: now,
    clientFingerprint: 'mock|dev',
    payload: {
      huahua_save: JSON.stringify({ ver: 1, coin: 200 }),
      huahua_checkin: JSON.stringify({ day: 3 }),
    },
  }, auth);

  // 8) pull final
  await call('/save/pull', {}, auth);

  // 9) 无 token → 401
  await call('/save/pull', {});

  // 10) 超大 payload → 413
  const big = 'x'.repeat(300 * 1024);
  await call('/save/push', {
    schemaVersion: 1,
    updatedAt: now + 2000,
    baseRemoteUpdatedAt: now + 1000,
    clientFingerprint: 'mock|dev',
    payload: { huahua_save: big },
  }, auth);

  // 11) 健康检查
  await call('/health', {});

  // 12) 微信消息推送 URL 校验
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = 'mock-nonce';
  const signature = signWechatPush(timestamp, nonce);
  await httpCall('GET', '/giftDeliver', undefined, {}, {
    signature,
    timestamp,
    nonce,
    echostr: 'mock-ok',
  });

  // 13) 微信消息推送 POST(JSON 明文)
  await httpCall('POST', '/giftDeliver', {
    MsgType: 'event',
    Event: 'minigame_notify_msg',
    Title: 'mock-title',
    Content: 'mock-content',
  }, {}, { signature, timestamp, nonce });

  // 14) 微信礼包发货回调 → queryPending → markGranted
  const wxOpenId = 'mock-openid';
  await httpCall('POST', '/giftDeliver', {
    MsgType: 'event',
    Event: 'minigame_deliver_goods',
    MiniGame: {
      OrderId: 'mock-order-0001',
      IsPreview: 1,
      ToUserOpenid: wxOpenId,
      Zone: 1001,
      GiftId: 'mock-gift',
      SendTime: Math.floor(Date.now() / 1000),
      GoodsList: [{ Id: 'crystal_ball_1', Num: 1 }],
    },
  }, {}, { signature, timestamp, nonce });
  const wxToken = jwt.sign(
    { sub: `wx:${wxOpenId}`, plt: 'wx', gk: 'huahua', iat: Math.floor(Date.now() / 1000) },
    process.env.HUAHUA_JWT_SECRET,
    { expiresIn: 3600 },
  );
  const wxAuth = { authorization: `Bearer ${wxToken}` };
  const pending = await call('/wechat-gift/queryPending', {}, wxAuth);
  const pendingIds = (((pending.body || {}).data || {}).gifts || []).map((g) => g.id);
  await call('/wechat-gift/markGranted', { ids: pendingIds }, wxAuth);

  console.log('\n[mock] 全部用例运行完毕');
})().catch((e) => {
  console.error('[mock] 失败:', e);
  process.exit(1);
});
