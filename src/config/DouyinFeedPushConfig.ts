/**
 * 抖音推荐流直玩 · 复访（体力恢复）
 *
 * 仅抖音端使用。Content_id 来自开放平台方案提报后平台下发，接入 API 必须带上。
 * 场景值 2 = 体力恢复（1=离线收益，3=重要事件掉落）。
 */
export const DOUYIN_FEED_PUSH = {
  contentId: 'CONTENT14676496898',
  /** 体力恢复场景 */
  scene: 2,
  /** 游戏可交互后必须上报，否则推荐流不出直玩卡 */
  reportSceneId: 7001,
  /** 启动 scene 后四位，判定推荐流直玩 */
  launchSceneSuffix: '3041',
} as const;
