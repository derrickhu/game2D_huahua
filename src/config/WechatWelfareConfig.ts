/**
 * 微信「道具领取界面 / 游戏福利」半屏固定 openlink。
 *
 * 该链接不是单个礼包 ID；微信会根据当前 AppID 和后台礼包配置展示可领礼包。
 * 参考 xiaoChu 已验证链路与微信小游戏分享礼包文档。
 */
export const WECHAT_GIFT_OPENLINK =
  'OAlx0CJihzz1pDQQNr9_GZ7fE43wOxBJTreaTcShoIbkZFfBl3K8bsXgnRJY3PAP0Ij3gLOVWYaSeMHP4OSg7qreYJDpNwq_fqfq3KT5erP5wJzRcuhWWSnD7rGATiN6';

export const WECHAT_WELFARE_SYNC_RETRY_DELAYS_MS = [800, 2000] as const;

/** 当天已确认无礼包后，不再自动弹微信福利半屏。 */
export const WECHAT_WELFARE_NO_GIFT_DATE_KEY = 'huahua_wechat_welfare_no_gift_date';

/** 有礼包但用户直接关闭且未领取时，短时不再自动弹。 */
export const WECHAT_WELFARE_DISMISSED_UNTIL_KEY = 'huahua_wechat_welfare_dismissed_until';
export const WECHAT_WELFARE_DISMISS_COOLDOWN_MS = 6 * 60 * 60 * 1000;
