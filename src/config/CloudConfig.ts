/**
 * 统一 HTTP 后端配置（CloudBase HTTP 访问服务）
 *
 * 后端仓库：cloudfunctions/huahua-api
 * 环境 ID：rosa-env-d7grf78r5dbd37323（腾讯云 CloudBase）
 *
 * 微信云开发（wx.cloud）已弃用，迁移记录：
 *   - 原 env:  cloudbase-6g78qhi9985d3dfc（硬切，不迁移旧存档）
 *   - 原函数：getOpenid、initCollections → 合并到 /login、/save/* 统一入口
 */

/**
 * 本游戏代号（多游戏复用的唯一改动点之一）
 *
 * 其它游戏复用本套模板时，改这里 + 后端函数目录名 + CloudBase GAME_KEY 环境变量即可。
 * 客户端所有与后端/本地存储相关的 key 都由它派生。
 */
export const GAME_KEY = 'huahua';

/** CloudBase HTTP 访问服务根域名（不含路径） */
export const BACKEND_BASE_URL = 'https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com';

/** HTTP 访问服务挂载路径前缀（与 CloudBase 云函数名一致：cloudfunctions/${GAME_KEY}-api） */
export const BACKEND_PATH_PREFIX = `/${GAME_KEY}-api`;

export const BACKEND_LOGIN_PATH = `${BACKEND_PATH_PREFIX}/login`;
export const BACKEND_PULL_PATH = `${BACKEND_PATH_PREFIX}/save/pull`;
export const BACKEND_PUSH_PATH = `${BACKEND_PATH_PREFIX}/save/push`;
export const BACKEND_HEALTH_PATH = `${BACKEND_PATH_PREFIX}/health`;

/** 请求超时（毫秒） */
export const BACKEND_REQUEST_TIMEOUT_MS = 10000;

/** 本地 Token 缓存 key（仅本地，不纳入云同步） */
export const BACKEND_TOKEN_KEY = `${GAME_KEY}_token`;
/** 匿名（H5 / 无平台 code）场景的稳定设备 ID key */
export const BACKEND_ANON_ID_KEY = `${GAME_KEY}_anon_id`;

export const CLOUD_SYNC_SCHEMA_VERSION = 1;
export const CLOUD_SYNC_META_KEY = `${GAME_KEY}_cloud_meta`;

/** 云同步白名单：只有列表里的 key 会被打包上云，其余仅本地 */
export const CLOUD_SYNC_ALLOWLIST = [
  'huahua_save',
  'huahua_checkin',
  'huahua_quests',
  'huahua_idle',
  'huahua_tutorial',
  'huahua_merge_stats',
  'huahua_flower_quotes',
  'huahua_decoration',
  'huahua_room_layout',
  'huahua_dressup',
  'huahua_social',
  'huahua_events',
  'huahua_challenge',
  'huahua_collection',
  'huahua_flower_cards',
] as const;

export const CLOUD_SYNC_EXCLUDE_KEYS = [
  'huahua_gm',
  'huahua_gm_export_scales',
  BACKEND_TOKEN_KEY,
  BACKEND_ANON_ID_KEY,
] as const;

export const CLOUD_SYNC_STARTUP_TIMEOUT_MS = 2500;
export const CLOUD_SYNC_DEBOUNCE_MS = 1500;
export const CLOUD_SYNC_BASE_DELAY_MS = 1500;
export const CLOUD_SYNC_MAX_BACKOFF_MS = 30000;
export const CLOUD_SYNC_MAX_FAIL_COUNT = 5;
export const CLOUD_SYNC_RETRY_INTERVAL_MS = 60000;
export const CLOUD_SYNC_LOG_THRESHOLD = 3;

export type CloudSyncKey = typeof CLOUD_SYNC_ALLOWLIST[number];
