/**
 * 游戏级配置（多游戏复用模板的唯一可变点）
 *
 * 其它游戏复用本后端模板时，**只改这里读取到的环境变量**：
 *   GAME_KEY              游戏代号，如 'huahua' / 'snake' / 'monaco'
 *                         决定：集合前缀 ${GAME_KEY}_xxx、JWT payload 里的 gk
 *   {GAMEKEY_UPPER}_JWT_SECRET   当前游戏的 JWT 签名密钥
 *                         例如 GAME_KEY=huahua → HUAHUA_JWT_SECRET
 *                         （向后兼容：找不到时回退 HUAHUA_JWT_SECRET）
 *   {GAMEKEY_UPPER}_TOKEN_TTL_SEC  token 有效期（秒）
 *                         （向后兼容：回退 HUAHUA_TOKEN_TTL_SEC，再回退 7d）
 *   {GAMEKEY_UPPER}_SAVE_MAX_BYTES payload 上限（字节）
 *                         （向后兼容：回退 HUAHUA_SAVE_MAX_BYTES，再回退 256KB）
 *   WX_APPID / WX_SECRET        微信 code2session 凭证
 *   TT_APPID / TT_SECRET        抖音 code2session 凭证
 *   TCB_ENV                     CloudBase 环境 ID（默认取 SYMBOL_CURRENT_ENV）
 *
 * 集合命名约定：
 *   ${GAME_KEY}_playerData  存档主表
 *   ${GAME_KEY}_xxx         未来扩展表（orders / rewards / inventory …）
 *
 * 云存储 key 前缀约定：
 *   ${GAME_KEY}/xxx.png     按游戏目录隔离
 */

const DEFAULT_GAME_KEY = 'huahua';
const DEFAULT_TTL_SEC = 7 * 24 * 3600;
const DEFAULT_MAX_BYTES = 256 * 1024;

function getGameKey() {
  const v = String(process.env.GAME_KEY || '').trim().toLowerCase();
  if (!v) return DEFAULT_GAME_KEY;
  if (!/^[a-z][a-z0-9_\-]{0,31}$/.test(v)) {
    throw new Error(`GAME_KEY 非法: "${v}"（要求小写字母开头，字母数字/下划线/连字符，长度 1~32）`);
  }
  return v;
}

function gameKeyUpper() {
  return getGameKey().toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function readEnvPrefer(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined && v !== null && String(v).length > 0) return String(v);
  }
  return '';
}

function getCollectionName(suffix) {
  // 整体覆盖（向后兼容 / 临时切换）：HUAHUA_COLLECTION='xxx' 时直接用
  if (suffix === 'playerData' && process.env.HUAHUA_COLLECTION) {
    return String(process.env.HUAHUA_COLLECTION);
  }
  return `${getGameKey()}_${suffix}`;
}

function getJwtSecret() {
  const gk = gameKeyUpper();
  const v = readEnvPrefer(`${gk}_JWT_SECRET`, 'HUAHUA_JWT_SECRET');
  return v;
}

function getTtlSec() {
  const gk = gameKeyUpper();
  const raw = readEnvPrefer(`${gk}_TOKEN_TTL_SEC`, 'HUAHUA_TOKEN_TTL_SEC');
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : DEFAULT_TTL_SEC;
}

function getMaxBytes() {
  const gk = gameKeyUpper();
  const raw = readEnvPrefer(`${gk}_SAVE_MAX_BYTES`, 'HUAHUA_SAVE_MAX_BYTES');
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : DEFAULT_MAX_BYTES;
}

module.exports = {
  getGameKey,
  getCollectionName,
  getJwtSecret,
  getTtlSec,
  getMaxBytes,
};
