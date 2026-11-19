import type { WheelEventArt } from './WheelEventTheme';
import { MID_AUTUMN_2026_ART } from './themes/midAutumn2026.art';
import { WINTER_GALA_2026_ART } from './themes/winterGala2026.art';

/**
 * 开新一期只改 ACTIVE_WHEEL_SEASON_ID。
 * 素材进包后再把 WHEEL_ASSETS_IN_PACKAGE 改成 true。
 * 本文件不能依赖物品配置：TextureCache 会 import 它。
 */
export const ACTIVE_WHEEL_SEASON_ID = 'winter_gala_2026';

/**
 * 当期转盘素材放进 minigame 后改成 true，TextureCache 才会加载。
 */
export const WHEEL_ASSETS_IN_PACKAGE = true;

export const WHEEL_ART_BY_SEASON: Readonly<Record<string, WheelEventArt>> = {
  mid_autumn_2026: MID_AUTUMN_2026_ART,
  winter_gala_2026: WINTER_GALA_2026_ART,
};

export const ACTIVE_WHEEL_ART: WheelEventArt = WHEEL_ART_BY_SEASON[ACTIVE_WHEEL_SEASON_ID]!;
