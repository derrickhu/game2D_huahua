/**
 * 抖音平台专属福利配置（侧边栏复访 / 添加到桌面）
 *
 * 两项都是抖音小游戏的平台必接能力，微信端不展示任何入口。
 * 奖励量级对齐每日挑战（2~20 钻石）与签到体力，避免破坏既有经济。
 */

export const DOUYIN_WELFARE = {
  /** 侧边栏复访：每日可领一次 */
  sidebar: {
    diamond: 10,
    stamina: 20,
  },
  /** 添加到桌面：整个账号仅一次 */
  desktop: {
    diamond: 20,
  },
} as const;

/** 抖音福利状态的本地存储 key（会随平台命名空间落到 huahua_tt_ 下） */
export const DOUYIN_WELFARE_STORAGE_KEY = 'huahua_douyin_welfare';
