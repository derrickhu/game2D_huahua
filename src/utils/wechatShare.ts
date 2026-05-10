/**
 * 带经分埋点的分享工具：把 wx.shareAppMessage / onShareAppMessage / onShareTimeline / Platform.shareAndWait
 * 统一过一道埋点上报，业务不再直接调 Platform.shareAppMessage / Platform.shareAndWait。
 *
 * 为什么要这一层：
 * - 经分 SOP 要求所有 share_app_message 事件都带 entry_point（业务化命名），分散调用容易漏埋点
 * - 朋友圈分享（wx.onShareTimeline）走独立事件 share_timeline，与转发好友区分
 * - 抖音 tt 不支持朋友圈，share_timeline 仅微信打
 * - 上报口径与团队约定一致（详见 packages/analytics-sdk/README.md「分享传播」一节）
 *
 * entry_point 命名规范（与 dashboard 字典对齐）：
 * - 微信被动分享回调：wx_button / wx_menu / wx_other / wx_timeline
 * - 抖音被动分享：dy_button / dy_menu / dy_other
 * - 业务主动分享：与业务模块对应的 snake_case，如 `shop_invite` / `flower_card` / `gift_stamina`
 *   / `unlock_cell` / `warehouse_slot` / `affinity_card` / `wish_lucky` / `default_share`
 */

import { analytics, EVENT_NAMES } from '@/analytics';
import { Platform } from '@/core/PlatformService';

export interface SharePayload {
  title: string;
  imageUrl: string;
  query?: string;
}

/** 业务模块化的分享入口名，便于按场景拆开看分享渗透。 */
export type ShareEntryPoint =
  | 'default_share'
  | 'shop_invite'
  | 'flower_card'
  | 'gift_stamina'
  | 'unlock_cell'
  | 'warehouse_slot'
  | 'affinity_card'
  | 'wish_lucky'
  | 'wx_button'
  | 'wx_menu'
  | 'wx_other'
  | 'wx_timeline'
  | 'dy_button'
  | 'dy_menu'
  | 'dy_other';

function trackShareAppMessage(
  payload: SharePayload,
  entryPoint: ShareEntryPoint,
  extra?: Record<string, string | number | boolean>,
): void {
  analytics.track(EVENT_NAMES.SHARE_APP_MESSAGE, {
    entry_point: entryPoint,
    title: payload.title,
    image_url: payload.imageUrl || '',
    query: payload.query || '',
    ...(extra ?? {}),
  });
}

function trackShareTimeline(
  payload: SharePayload,
  entryPoint: ShareEntryPoint = 'wx_timeline',
): void {
  analytics.track(EVENT_NAMES.SHARE_TIMELINE, {
    entry_point: entryPoint,
    title: payload.title,
    image_url: payload.imageUrl || '',
    query: payload.query || '',
  });
}

/**
 * 在游戏入口调一次：注册被动分享回调（右上角菜单 / 页面分享按钮 / 朋友圈），
 * 让分享能力可见的同时把埋点接好。覆盖了 SocialManager._setupShareMenu 之前手写的版本。
 */
export function setupWechatShare(getDefaultShare: () => SharePayload): void {
  Platform.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline'],
  });

  Platform.onShareAppMessage((res?: { from?: string }) => {
    const from = res?.from;
    const isWx = Platform.isWechat;
    // 微信 onShareAppMessage 的 res.from 仅微信端有值；抖音没有 from，统一兜底成 dy_other。
    const entryPoint: ShareEntryPoint = isWx
      ? from === 'button' ? 'wx_button'
        : from === 'menu' ? 'wx_menu'
        : 'wx_other'
      : 'dy_other';
    const payload = getDefaultShare();
    trackShareAppMessage(payload, entryPoint);
    return payload;
  });

  // 朋友圈仅微信支持；Platform.onShareTimeline 内部已做平台守卫。
  Platform.onShareTimeline(() => {
    const payload = getDefaultShare();
    trackShareTimeline(payload, 'wx_timeline');
    return { title: payload.title, imageUrl: payload.imageUrl };
  });
}

/** 主动分享 fire-and-forget，对应业务调用 Platform.shareAppMessage 的所有场景。 */
export function shareAppMessageWithAnalytics(
  payload: SharePayload,
  entryPoint: ShareEntryPoint,
  extra?: Record<string, string | number | boolean>,
): void {
  trackShareAppMessage(payload, entryPoint, extra);
  Platform.shareAppMessage(payload);
}

/**
 * 主动分享并通过 onHide/onShow 时间差判断是否完成（用于解锁格、仓库扩容等"分享送奖励"场景）。
 * 复用 Platform.shareAndWait 的启发式判定，但在调用前先打埋点，避免业务侧漏报。
 */
export async function shareAndWaitWithAnalytics(
  payload: SharePayload,
  entryPoint: ShareEntryPoint,
  extra?: Record<string, string | number | boolean>,
): Promise<boolean> {
  trackShareAppMessage(payload, entryPoint, extra);
  return Platform.shareAndWait(payload);
}
