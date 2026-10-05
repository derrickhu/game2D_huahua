/**
 * 宿主识别（单一真源）
 *
 * 独立成模块，是为了让 config/gameKeyScope 与 core/PlatformService 都能引用而不形成循环依赖；
 * minigame/runtime.js 里有一份等价的 JS 实现供启动期（bundle 之前）使用，两边逻辑必须保持一致。
 *
 * 识别顺序：
 * 1. 编译锁 VITE_PLATFORM=taptap / huawei（运行时即使误注入 wx 也不当成微信）
 * 2. 抖音 tt（同时存在的 wx 只是兼容层）
 * 3. Tap tap
 * 4. 华为 qg / qa（也可能再塞 wx 壳）
 * 5. 微信 wx
 */

declare const wx: any;
declare const tt: any;
declare const tap: any;
declare const qa: any;
declare const qg: any;
declare const __wxConfig: any;
declare const GameGlobal: any;

export type PlatformName = 'wechat' | 'douyin' | 'taptap' | 'huawei' | 'unknown';

/** 后端 /login 的 platform 字段 */
export type BackendPlatformCode = 'wx' | 'dy' | 'tap' | 'hw' | 'anon';

/** 华为快游戏原生是 qg；快应用才是 qa；转换层可能只剩 wx 壳 */
export function isHuaweiQuickGameHost(): boolean {
  if (typeof qg !== 'undefined') return true;
  if (typeof qa !== 'undefined') return true;
  try {
    if (typeof GameGlobal !== 'undefined' && (GameGlobal.__wx2huawei || GameGlobal.qa || GameGlobal.qg)) return true;
  } catch { /* */ }
  if (typeof wx === 'undefined') return false;
  if (typeof __wxConfig !== 'undefined') return false;
  if (typeof wx.getAccountInfoSync === 'function') return false;
  return true;
}

function resolveHuaweiApi(): any {
  if (typeof qg !== 'undefined') return qg;
  if (typeof qa !== 'undefined') return qa;
  return typeof wx !== 'undefined' ? wx : null;
}

export function detectMinigamePlatform(): PlatformName {
  // 不要写 typeof import.meta。Vite 会把整段 import.meta 编成
  // new URL("game-bundle.js", document.baseURI)，红米上 baseURI 不是字符串，
  // 包一加载就抛 URL constructor requires string arguments，画面停在黑屏。
  if (import.meta.env.VITE_PLATFORM === 'taptap') return 'taptap';
  if (import.meta.env.VITE_PLATFORM === 'huawei') return 'huawei';
  if (typeof tt !== 'undefined') return 'douyin';
  if (typeof tap !== 'undefined') return 'taptap';
  if (isHuaweiQuickGameHost()) return 'huawei';
  if (typeof wx !== 'undefined') return 'wechat';
  return 'unknown';
}

/** 指定宿主的原生 API：抖音只取 tt，Tap 只取 tap，华为 qg/qa，微信只取 wx */
export function getNativePlatformApi(platform: PlatformName = detectMinigamePlatform()): any {
  if (platform === 'douyin') return typeof tt !== 'undefined' ? tt : null;
  if (platform === 'taptap') return typeof tap !== 'undefined' ? tap : null;
  if (platform === 'huawei') return resolveHuaweiApi();
  if (platform === 'wechat') return typeof wx !== 'undefined' ? wx : null;
  return null;
}

export function toBackendPlatformCode(
  platform: PlatformName = detectMinigamePlatform(),
): BackendPlatformCode {
  if (platform === 'wechat') return 'wx';
  if (platform === 'douyin') return 'dy';
  if (platform === 'taptap') return 'tap';
  if (platform === 'huawei') return 'hw';
  return 'anon';
}
