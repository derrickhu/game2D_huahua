/**
 * 本地联调 mock：不依赖 CloudBase，把 save 集合读写替换为内存。
 * 运行：node scripts/mock.js
 *
 * 依赖：node 18+（内置 fetch）；不需要真实的 WX/TT AppSecret（会走 anon 登录路径）。
 */

process.env.HUAHUA_JWT_SECRET = process.env.HUAHUA_JWT_SECRET || 'dev-secret-do-not-use-in-prod';
process.env.HUAHUA_TOKEN_TTL_SEC = process.env.HUAHUA_TOKEN_TTL_SEC || '3600';

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

async function call(path, body, headers = {}) {
  const event = {
    httpMethod: 'POST',
    path,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body || {}),
    isBase64Encoded: false,
  };
  const res = await main(event, {});
  const parsed = res && res.body ? (() => { try { return JSON.parse(res.body); } catch { return res.body; } })() : res;
  console.log(`[${path}]`, res && res.statusCode, JSON.stringify(parsed));
  return { statusCode: res && res.statusCode, body: parsed };
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
    clientFingerprint: 'mock|dev',
    payload: { huahua_save: JSON.stringify({ ver: 1, coin: 100 }) },
  }, auth);

  // 4) pull 再次（期望 exists: true，数据一致）
  await call('/save/pull', {}, auth);

  // 5) push 旧 updatedAt（期望 409 STALE_UPDATE）
  await call('/save/push', {
    schemaVersion: 1,
    updatedAt: now - 1000,
    clientFingerprint: 'mock|dev',
    payload: { huahua_save: JSON.stringify({ ver: 1, coin: 50 }) },
  }, auth);

  // 6) push 新 updatedAt（期望 ok）
  await call('/save/push', {
    schemaVersion: 1,
    updatedAt: now + 1000,
    clientFingerprint: 'mock|dev',
    payload: {
      huahua_save: JSON.stringify({ ver: 1, coin: 200 }),
      huahua_checkin: JSON.stringify({ day: 3 }),
    },
  }, auth);

  // 7) pull final
  await call('/save/pull', {}, auth);

  // 8) 无 token → 401
  await call('/save/pull', {});

  // 9) 超大 payload → 413
  const big = 'x'.repeat(300 * 1024);
  await call('/save/push', {
    schemaVersion: 1,
    updatedAt: now + 2000,
    clientFingerprint: 'mock|dev',
    payload: { huahua_save: big },
  }, auth);

  // 10) 健康检查
  await call('/health', {});

  console.log('\n[mock] 全部用例运行完毕');
})().catch((e) => {
  console.error('[mock] 失败:', e);
  process.exit(1);
});
