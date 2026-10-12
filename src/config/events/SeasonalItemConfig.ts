/**
 * 限时活动附带的棋盘物品线。
 * 活动进行中只开放 `surfaces` 里列出的入口；到期后全部关闭，持有的按订单花愿换成花愿。
 * 兑换主题在 `seasonalItems` 里声明；转盘等非兑换活动在 SeasonalItemRegistry 里登记。
 */

/** 活动进行中允许出现的入口。没写上的入口，活动期内也不出现。 */
export type SeasonalItemSurface =
  | 'produce'
  | 'orders'
  | 'shop'
  | 'gacha'
  | 'collection'
  | 'bubbles';

export interface SeasonalItemLineDef {
  seasonId: string;
  eventName: string;
  category: string;
  line: string;
  startAt: number;
  endAt: number;
  surfaces: readonly SeasonalItemSurface[];
}

/** 兑换主题里声明的活动物品线；时间用主题自己的 startAt / endAt。 */
export interface ExchangeSeasonalItem {
  category: string;
  line: string;
  surfaces: readonly SeasonalItemSurface[];
}
