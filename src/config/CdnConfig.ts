/**
 * CDN 资源配置（微信云存储版）
 *
 * 设计目标：
 * - 同一份 TS 配置同时服务运行时与 scripts/upload_cdn.js。
 * - 游戏代码继续使用 minigame 根目录下的逻辑路径，如 `subpkg_deco/images/...`。
 * - 本地包资源是缓存/兜底，云端 manifest 才是 CDN 缓存失效依据。
 */

export interface CdnConfig {
  enabled: boolean;
  appId: string;
  cloudEnv: string;
  /**
   * 云存储 bucket 标识，用于拼 cloud:// fileID。
   * 形如 `xxxx-env-id-1250000000`；也可在 scripts/.cdn_secret 中用 CDN_CLOUD_BUCKET 覆盖。
   */
  cloudBucket: string;
  baseUrl: string;
  filePrefix: string;
  cacheRootName: string;
  downloadRetry: number;
  downloadTimeoutMs: number;
  cdnDirs: readonly string[];
  bundledDirs: readonly string[];
  ignoreFiles: readonly string[];
}

export const CDN_CONFIG: CdnConfig = {
  enabled: true,
  appId: 'wx67b4d58810df8bba',
  cloudEnv: 'rosa-env-d7grf78r5dbd37323',
  cloudBucket: '726f-rosa-env-d7grf78r5dbd37323-1414200063',
  baseUrl: 'https://726f-rosa-env-d7grf78r5dbd37323-1414200063.tcb.qcloud.la',
  filePrefix: 'assets_cdn',
  cacheRootName: 'cdn_cache',
  downloadRetry: 2,
  downloadTimeoutMs: 30000,
  cdnDirs: [
    'subpkg_chars/images',
    'subpkg_panels/images',
    'subpkg_deco/images',
    'subpkg_audio',
  ],
  bundledDirs: [
    'images',
    'subpkg_items/images',
  ],
  ignoreFiles: ['game.js', '.DS_Store', 'Thumbs.db'],
};

