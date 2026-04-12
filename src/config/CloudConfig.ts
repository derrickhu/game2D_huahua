export const CLOUD_ENV_ID = 'cloudbase-6g78qhi9985d3dfc';

export const CLOUD_SYNC_SCHEMA_VERSION = 1;
export const CLOUD_SYNC_META_KEY = 'huahua_cloud_meta';
export const CLOUD_PLAYER_DATA_COLLECTION = 'playerData';

export const CLOUD_SYNC_FUNCTIONS = {
  getOpenid: 'getOpenid',
  initCollections: 'initCollections',
} as const;

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
] as const;

export const CLOUD_SYNC_STARTUP_TIMEOUT_MS = 2500;
export const CLOUD_SYNC_DEBOUNCE_MS = 1500;
export const CLOUD_SYNC_BASE_DELAY_MS = 1500;
export const CLOUD_SYNC_MAX_BACKOFF_MS = 30000;
export const CLOUD_SYNC_MAX_FAIL_COUNT = 5;
export const CLOUD_SYNC_RETRY_INTERVAL_MS = 60000;
export const CLOUD_SYNC_LOG_THRESHOLD = 3;

export type CloudSyncKey = typeof CLOUD_SYNC_ALLOWLIST[number];
