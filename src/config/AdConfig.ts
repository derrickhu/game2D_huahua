import { BOARD_COLS } from '@/config/Constants';

export type ExternalUnlockMode = 'share' | 'ad';

export interface PlatformAdUnitConfig {
  rewardedVideo: string;
  rewardedVideoByScene?: Record<string, string>;
  interstitial: string;
  banner: string;
}

/** 广告位 ID 配置：拿到真实 ID 后只改这里。 */
export const AD_UNIT_CONFIG: Record<'wechat' | 'douyin', PlatformAdUnitConfig> = {
  wechat: {
    rewardedVideo: 'adunit-6ca54692fdb75515',
    rewardedVideoByScene: {
      stamina_recover: 'adunit-e6e6362dc0a129f8',
      board_cell_unlock: 'adunit-73ce0cce0986d5b3',
      warehouse_slot_unlock: 'adunit-73ce0cce0986d5b3',
      special_deco_unlock: 'adunit-73ce0cce0986d5b3',
      /** 花漾沙发 / 原木茶几等宣传款家具（与通用解锁位分开） */
      promo_furniture_unlock: 'adunit-8cc5e94aff5578eb',
      merch_daily_refresh: 'adunit-6ca54692fdb75515',
      flower_sign_daily_draw: 'adunit-6ca54692fdb75515',
      warehouse_organize: 'adunit-05c339f10f72ed43',
      reward_box_organize: 'adunit-05c339f10f72ed43',
      cd_speedup: 'adunit-cea25a4d7c9202ae',
      merge_bubble_unlock: 'adunit-4091dd36e39990e6',
    },
    interstitial: 'adunit-yyyyyyyyyyyyyyyyyy',
    banner: 'adunit-zzzzzzzzzzzzzzzzzz',
  },
  douyin: {
    rewardedVideo: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
    interstitial: 'yyyyyyyyyyyyyyyyyyyyyyyyyy',
    banner: 'zzzzzzzzzzzzzzzzzzzzzzzzzz',
  },
};

/** 棋盘钥匙格逐格配置：未列出的钥匙格默认走分享。 */
export const BOARD_KEY_UNLOCK_MODES: Record<number, ExternalUnlockMode> = {
  [0 * BOARD_COLS + 1]: 'share',
  [0 * BOARD_COLS + 5]: 'ad',
  [4 * BOARD_COLS + 6]: 'share',
  [6 * BOARD_COLS + 3]: 'ad',
  [8 * BOARD_COLS + 0]: 'share',
  [8 * BOARD_COLS + 6]: 'ad',
};

/** 仓库前几个锁格逐格配置：index 为 0 基槽位下标。 */
export const WAREHOUSE_SLOT_UNLOCK_MODES: Record<number, ExternalUnlockMode> = {
  4: 'share',
  5: 'share',
  6: 'ad',
  7: 'share',
  8: 'ad',
  9: 'ad',
};

/** 广告可解锁购买资格的家具白名单；只有这里列出的家具走广告条件。 */
export const AD_UNLOCK_DECO_IDS = new Set<string>(['promo_floral_sofa', 'promo_wood_tea_table']);

/** 使用 `promo_furniture_unlock` 广告位的家具 id（其余走 `special_deco_unlock`） */
export const PROMO_FURNITURE_AD_DECO_IDS = new Set<string>(['promo_floral_sofa', 'promo_wood_tea_table']);
