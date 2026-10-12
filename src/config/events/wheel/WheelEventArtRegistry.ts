import type { WheelEventArt } from './WheelEventTheme';
import { MID_AUTUMN_2026_ART } from './themes/midAutumn2026.art';

/**
 * 开新一期只改 ACTIVE_WHEEL_SEASON_ID。
 * 素材进包后再把 WHEEL_ASSETS_IN_PACKAGE 改成 true。
 * 本文件不能依赖物品配置：TextureCache 会 import 它。
 */
export const ACTIVE_WHEEL_SEASON_ID = 'mid_autumn_2026';

/**
 * 月满中秋的入口和转盘图已经归档，不在游戏包里。
 * 新一期素材放进 minigame 后改成 true，TextureCache 才会加载。
 */
export const WHEEL_ASSETS_IN_PACKAGE = false;

export const WHEEL_ART_BY_SEASON: Readonly<Record<string, WheelEventArt>> = {
  mid_autumn_2026: MID_AUTUMN_2026_ART,
};

export const ACTIVE_WHEEL_ART: WheelEventArt = WHEEL_ART_BY_SEASON[ACTIVE_WHEEL_SEASON_ID]!;
