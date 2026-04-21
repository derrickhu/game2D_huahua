/**
 * 花花妙屋统一后端（CloudBase 云函数 + HTTP 访问服务）
 *
 * 路由（全部 POST JSON）：
 *   /login        登录：wx/dy code2session / anon，签发 JWT
 *   /save/pull    拉取当前用户存档
 *   /save/push    上传当前用户存档（Upsert，updatedAt 防回写）
 *   /health       健康检查（无鉴权）
 *
 * 客户端可用两种方式命中：
 *   1) HTTP 访问服务：POST {envDomain}/huahua-api/login  等
 *      event 形如 { path, httpMethod, headers, body, isBase64Encoded }
 *   2) SDK callFunction：data: { action: 'login'|'save/pull'|'save/push', body: {...} }
 *
 * 环境变量（CloudBase 控制台 → 云函数 → 环境变量）：
 *   HUAHUA_JWT_SECRET               必填；签发/校验 JWT
 *   HUAHUA_WX_APPID / HUAHUA_WX_SECRET   微信 code2session（带 HUAHUA_ 前缀是为了
 *     避开 CloudBase 对 `WX_APPID`/`WX_SECRET` 这两个裸 Key 的系统脱敏，否则值会被清空）
 *   HUAHUA_TT_APPID / HUAHUA_TT_SECRET   抖音 code2session（同理加前缀）
 *   HUAHUA_SAVE_MAX_BYTES           可选，默认 262144（256KB）
 *   HUAHUA_TOKEN_TTL_SEC            可选，默认 604800（7d）
 */

const { handleLogin } = require('./lib/auth');
const { handlePull, handlePush } = require('./lib/save');
const { respond, parseEvent, preflight } = require('./lib/http');

const ROUTES = {
  'POST /health': async () => ({ ok: true, ts: Date.now() }),
  'POST /login': handleLogin,
  'POST /save/pull': handlePull,
  'POST /save/push': handlePush,
};

exports.main = async (event, context) => {
  try {
    // HTTP 访问服务的 OPTIONS 预检
    if (event && event.httpMethod === 'OPTIONS') {
      return preflight();
    }

    const req = parseEvent(event);
    const key = `${req.method} ${req.path}`;
    const handler = ROUTES[key];

    if (!handler) {
      return respond(404, { ok: false, code: 'NOT_FOUND', error: `no route: ${key}` });
    }

    const result = await handler(req, context);
    // handler 允许直接返回 HTTP 响应对象（含 statusCode）
    if (result && typeof result === 'object' && 'statusCode' in result) {
      return result;
    }
    return respond(200, { ok: true, data: result });
  } catch (e) {
    const code = e && e.code ? e.code : 'INTERNAL';
    const status = e && e.status ? e.status : 500;
    const message = (e && e.message) || String(e);
    console.error('[huahua-api] error:', code, message, e && e.stack);
    const out = { ok: false, code, error: message };
    if (e && e.data !== undefined) out.data = e.data;
    return respond(status, out);
  }
};
