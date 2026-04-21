/**
 * HTTP 层工具：响应封装 / CORS / event 解析。
 * 同时兼容两种触发方式：
 *   A) HTTP 访问服务：event 含 httpMethod/path/body
 *   B) SDK callFunction：event 为 { action, body }，无 httpMethod
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400',
};

function respond(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
  };
}

function preflight() {
  return {
    statusCode: 204,
    headers: { ...CORS_HEADERS },
    body: '',
    isBase64Encoded: false,
  };
}

function parseEvent(event) {
  event = event || {};

  // A) HTTP 访问服务
  if (event.httpMethod) {
    const method = String(event.httpMethod).toUpperCase();
    // CloudBase HTTP 访问服务默认把挂载路径前缀一起给 path，需要兼容性剥离
    // 例如挂载在 /huahua-api，客户端请求 /huahua-api/login，event.path 可能是 /huahua-api/login 或 /login
    let path = event.path || '/';
    path = normalizePath(path);

    let rawBody = event.body || '';
    if (event.isBase64Encoded && rawBody) {
      try {
        rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
      } catch (_) {}
    }

    let body = {};
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch (_) {
        body = {};
      }
    }

    const headers = lowercaseHeaders(event.headers || {});
    return {
      method,
      path,
      body,
      headers,
      query: event.queryStringParameters || {},
      raw: event,
    };
  }

  // B) SDK callFunction 兼容入口：event = { action, body }
  const action = (event.action || '').replace(/^\/+/, '');
  const path = action ? `/${action}` : '/';
  return {
    method: 'POST',
    path,
    body: event.body || {},
    headers: lowercaseHeaders(event.headers || {}),
    query: {},
    raw: event,
  };
}

function normalizePath(path) {
  if (!path) return '/';
  let p = String(path);
  if (!p.startsWith('/')) p = '/' + p;
  // 剥离常见挂载前缀
  p = p.replace(/^\/(?:huahua-api)(?=\/|$)/, '');
  if (p === '') p = '/';
  // 去尾 /
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

function lowercaseHeaders(h) {
  const out = {};
  for (const k of Object.keys(h || {})) {
    out[k.toLowerCase()] = h[k];
  }
  return out;
}

function httpError(status, code, message) {
  const err = new Error(message || code);
  err.status = status;
  err.code = code;
  return err;
}

module.exports = {
  respond,
  preflight,
  parseEvent,
  httpError,
};
