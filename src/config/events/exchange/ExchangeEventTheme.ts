/**
 * 限时兑换活动主题包。
 *
 * 一期活动 = 一个主题文件（themes/*.ts）+ 一套素材；Manager / Panel / 入口都只读这里。
 * 开新一期：复制上一期主题文件，换 seasonId、日期、文案、配色、素材 key，再在 Registry 里设为 ACTIVE。
 */

/** 活动发奖描述；Manager 直接执行，UI 与 SaveManager 共享。 */
export type ExchangeGrant =
  | { kind: 'stamina'; amount: number }
  | { kind: 'huayuan'; amount: number }
  | { kind: 'diamond'; amount: number }
  | { kind: 'workshopMaterial'; materialId: string; amount: number }
  | { kind: 'blueprint'; blueprintId: string }
  | { kind: 'deco'; decoId: string };

export interface ExchangeShopProduct {
  id: string;
  categoryId: string;
  name: string;
  cost: number;
  stock: number;
  grant: ExchangeGrant;
}

export interface ExchangeShopCategory {
  id: string;
  name: string;
  completionRewards: readonly ExchangeGrant[];
}

/**
 * 订单物品 → 活动货币规则。
 * - `byLevel`：按物品自身等级取 rewards[level-1]
 * - `fruitCutGlobal`：按果切全局档位（fruitCutGlobalTier，1..15）取 rewards[tier-1]；只匹配果切 L1-L3
 */
export interface ExchangeEarnRule {
  id: string;
  category: string;
  /** 精确产线；与 `fruitCutLines` 二选一 */
  line?: string;
  /** 匹配所有果切产线 */
  fruitCutLines?: boolean;
  tier: 'byLevel' | 'fruitCutGlobal';
  rewards: readonly number[];
}

export interface ExchangeEventArt {
  /** 顶栏 / 全景列 / 花店右侧按钮的入口图（主包） */
  entryIconKey: string;
  /** 货币图标（主包；订单徽章、飞币、面板价格都用它） */
  currencyIconKey: string;
  /** 面板壳（events 分包） */
  panelShellKey: string;
  /** 主包贴图 key → minigame 相对路径 */
  mainImages: Record<string, string>;
  /** events 分包贴图 key → minigame 相对路径 */
  eventImages: Record<string, string>;
  /** 顶栏入口目标边长（入口图留白不同，按图调） */
  topBarIconSize: number;
  /** 全景活动列入口目标边长 */
  panoramaIconSize: number;
}

export interface ExchangeEventCopy {
  /** 花店右侧活动钮下方两字标签 */
  shopBtnLabel: string;
  /** 货币说明弹层：获取来源 */
  currencySource: string;
  /** 货币说明弹层：用途 */
  currencyUsage: string;
  /** 货币说明弹层：结束后结算说明 */
  currencySettleNote: string;
}

export interface ExchangeEventColors {
  /** 订单徽章底色 */
  badgeFill: number;
  /** 花店右侧活动钮底色 / 标签色 */
  shopBtnBg: number;
  shopBtnLabel: number;
  /** 面板标题 */
  titleFill: number;
  titleStroke: number;
  /** 货币胶囊描边 / 说明弹层描边 */
  accent: number;
  currencyText: number;
  /** 分类标题条 */
  headerFill: number;
  headerStroke: number;
  headerText: number;
  /** 贴图缺失时的占位圆点 */
  iconFallback: number;
}

/** 壳体图上的相对坐标（0..1），换壳后按新图实测。 */
export interface ExchangeEventLayout {
  closeNX: number;
  closeNY: number;
  contentNX: number;
  contentNY: number;
  contentNW: number;
  contentNH: number;
}

export interface ExchangeEventTheme {
  seasonId: string;
  name: string;
  currencyName: string;
  /** 设备本地时区毫秒时间戳 */
  startAt: number;
  endAt: number;
  /** 结束后 1 货币 = N 花愿 */
  settleToHuayuanRate: number;
  earnRules: readonly ExchangeEarnRule[];
  /** 同一单同时命中这些规则时乘 mixedMultiplier */
  mixedRuleIds: readonly string[];
  mixedMultiplier: number;
  categories: readonly ExchangeShopCategory[];
  products: readonly ExchangeShopProduct[];
  art: ExchangeEventArt;
  copy: ExchangeEventCopy;
  colors: ExchangeEventColors;
  layout: ExchangeEventLayout;
}

/** 已下线主题的最小信息：只用于把旧存档里没花完的货币换成花愿。 */
export interface PastExchangeTheme {
  seasonId: string;
  name: string;
  currencyName: string;
  settleToHuayuanRate: number;
}

export function toPastTheme(theme: ExchangeEventTheme): PastExchangeTheme {
  return {
    seasonId: theme.seasonId,
    name: theme.name,
    currencyName: theme.currencyName,
    settleToHuayuanRate: theme.settleToHuayuanRate,
  };
}
