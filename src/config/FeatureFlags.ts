/**
 * 全局功能开关（便于临时下线某玩法而保留源码）。
 */

/** 花店左下折叠条（邀友 / 设置 / 游戏圈）；关闭后不创建 UI 与微信游戏圈原生按钮。 */
export const ENABLE_SHOP_MISC_DRAWER = false;

/** 合成页店铺行左侧「展开」活动列（限时活动等）；关闭后隐藏展开钮与屏外活动区。 */
export const ENABLE_SHOP_ACTIVITY_EXPAND = false;

/**
 * 跨设备响应式布局。保留单一回退点，真机出现异常时可临时关闭，
 * 关闭后 Game 会回退到旧版 screenWidth/screenHeight 数据源。
 */
export const ENABLE_RESPONSIVE_LAYOUT_V2 = true;

/**
 * Pad 核心内容安全框。关闭时仅回退为 V2 的全宽缩放，不影响窗口/安全区读取。
 * 便于真机灰度时独立止损。
 */
export const ENABLE_PAD_SAFE_FRAME = true;

/**
 * 抖音推荐流直玩复访（体力回满召回）。微信构建不会走到该能力；
 * 关闭后抖音也不再订阅 / 上报就绪 / 拦截预启动弹窗。
 */
export const ENABLE_DOUYIN_FEED_PUSH = true;
