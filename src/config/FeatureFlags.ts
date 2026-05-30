/**
 * 全局功能开关（便于临时下线某玩法而保留源码）。
 *
 * 挑战关卡：`ChallengeManager`、`ChallengePanel`、主界面左侧活动列盾牌入口。
 * 恢复时将此常量改为 `true` 即可重新接入初始化、每帧更新与 UI。
 */
export const ENABLE_CHALLENGE_LEVEL_FEATURE = false;

/** 花店左下折叠条（邀友 / 设置 / 游戏圈）；关闭后不创建 UI 与微信游戏圈原生按钮。 */
export const ENABLE_SHOP_MISC_DRAWER = false;
