/**
 * 合成主场景顶栏「内购商店」配置。
 *
 * 规则摘要（策划改表入口）：
 * - 每行 `MERCH_SHELVES[i]` 对应 UI 一层 `shop_section_panel_bg`（内购面板内可纵向滑动）；**刷新周期统一为 `MERCH_SHOP_REFRESH_INTERVAL_SEC`（6 小时）**。
 * - 到点整行重 roll，与是否买完无关；存档存 **`nextRefreshAt`（Unix 毫秒）** + 当前槽位 → **下线后仍按真实时间推进**，读档 / 回前台 `ensureUpToDate` 会补齐过期刷新。
 * - `pool` 为加权池；`pickWithoutReplacement` 为 true 时在池条目足够时尽量不重复。
 * - `priceType`: free | diamond | huayuan | ad；后两者填 `priceAmount`，ad 可填 0。
 * - `purchaseStock`：本波该槽位可购买次数（默认 1，范围 1～99）；每次购买 `remaining--`，到 0 售罄至下次刷新。
 * - 所有 `itemId` 须存在于 `ITEM_DEFS`，否则 roll 时跳过。
 * - `dynamicFreeShopPool`：为 true 时忽略 `pool`，由 `MerchShopManager` 按图鉴动态生成（已解锁、等级小于 6、非 `tool_*`、全部免费；另低权重含 1 级红包/体力宝箱/宝石袋）；**每格可购次数固定为 1**。
 * - `dynamicMysteryShopPool`：为 true 时忽略 `pool`，由 `MerchShopManager` 生成神秘商店（已解锁线全等级高权；未解锁线低权少货贵价；`tool_*` 仅 1 级极低权高价；钻石售价带波动；低等级可概率花愿；**不含钻石袋线 `diamond_bag_*`**）。**第三栏 `shelf_mixed` 当前与第二栏相同规则占位**，后续可单独改配置。
 * - `MERCH_DIAMOND_REFRESH_SHELF_COST`：面板内每层板旁「钻石刷新」仅重 roll 该路货架并重置该路 CD。
 */
export type MerchPriceType = 'free' | 'diamond' | 'huayuan' | 'ad';

/** 花费钻石立刻刷新单行货架（与定时刷新独立，策划可调） */
export const MERCH_DIAMOND_REFRESH_SHELF_COST = 20;

export interface MerchPoolEntry {
  itemId: string;
  weight: number;
  priceType: MerchPriceType;
  /** 钻石或花愿数额；free/ad 可省略或 0 */
  priceAmount?: number;
  /**
   * 每波刷新后该格可买次数（默认 1）；与 `MerchShopManager` 存档 `remaining` 一致。
   */
  purchaseStock?: number;
}

export interface MerchShelfDef {
  id: string;
  /** 本行刷新周期（秒） */
  refreshIntervalSec: number;
  /** 槽位数，须与 MerchShopPanel 每行槽数一致 */
  slotCount: number;
  /** 加权随机池（`dynamicFreeShopPool` 为 true 时可置空） */
  pool: MerchPoolEntry[];
  /** 池条目够用时是否不放回抽样（尽量不重复） */
  pickWithoutReplacement: boolean;
  /** 免费商店专用：按图鉴动态池，忽略 `pool` */
  dynamicFreeShopPool?: boolean;
  /** 神秘商店专用：按图鉴与合成线动态池，忽略 `pool` */
  dynamicMysteryShopPool?: boolean;
}

/** 免费商店：图鉴内普通条目的相对权重（相对下方稀有条目的权重） */
export const MERCH_FREE_SHOP_BASE_WEIGHT = 28;
/** 免费商店：1 级红包 / 体力宝箱 / 宝石袋 的相对权重（低概率） */
export const MERCH_FREE_SHOP_RARE_WEIGHT = 3;

// ─── 神秘商店（`dynamicMysteryShopPool`）───
/** 已解锁线：权重分子 `≈ num / level²`，等级越高越难出 */
export const MERCH_MYSTERY_UNLOCKED_LEVEL_NUM = 200;
/** 未解锁整条合成线时，相对已解锁线的权重倍率（更低） */
export const MERCH_MYSTERY_LOCKED_LINE_WEIGHT_FACTOR = 0.11;
/** 工具线仅 1 级入池时的基础权重（相对饮品 L1 很低） */
export const MERCH_MYSTERY_TOOL_L1_WEIGHT = 6;
/** 单格库存上限 */
export const MERCH_MYSTERY_STOCK_CAP = 6;
/** 已解锁线：`ceil(divisor / level)` 再封顶；等级越高数量越少 */
export const MERCH_MYSTERY_STOCK_DIVISOR = 6;
/** 未解锁线相对已解锁线的库存倍率（更少） */
export const MERCH_MYSTERY_LOCKED_STOCK_FACTOR = 0.38;
/** 钻石基础价：`base + level*perLv + floor(level²/curveDiv)` */
export const MERCH_MYSTERY_DIAMOND_BASE = 2;
export const MERCH_MYSTERY_DIAMOND_PER_LEVEL = 2;
export const MERCH_MYSTERY_DIAMOND_CURVE_DIV = 2;
/** 宝箱类额外钻石/级 */
export const MERCH_MYSTERY_DIAMOND_EXTRA_PER_CHEST_LEVEL = 2;
/** 未解锁线钻石价倍率与加值（更贵） */
export const MERCH_MYSTERY_LOCKED_DIAMOND_MULT = 2.28;
export const MERCH_MYSTERY_LOCKED_DIAMOND_ADD = 6;
/** 工具 1 级：钻石底价 + 随机 [0, spread) */
export const MERCH_MYSTERY_TOOL_L1_DIAMOND_BASE = 56;
export const MERCH_MYSTERY_TOOL_L1_DIAMOND_SPREAD = 38;
/** 售价随机波动：最终价 × U(min, max) */
export const MERCH_MYSTERY_PRICE_MULT_MIN = 0.82;
export const MERCH_MYSTERY_PRICE_MULT_MAX = 1.18;
/** 低等级可花愿：等级上限（含） */
export const MERCH_MYSTERY_HUAYUAN_MAX_LEVEL = 3;
/** 已解锁线：花愿支付概率 */
export const MERCH_MYSTERY_HUAYUAN_CHANCE_UNLOCKED = 0.38;
/** 未解锁线：花愿支付概率（更低） */
export const MERCH_MYSTERY_HUAYUAN_CHANCE_LOCKED = 0.12;
/** 花愿标价下限 */
export const MERCH_MYSTERY_HUAYUAN_MIN = 6;
/** 无 `orderHuayuan` 时的花愿底价参考：`base + level*step` */
export const MERCH_MYSTERY_HUAYUAN_FALLBACK_BASE = 12;
export const MERCH_MYSTERY_HUAYUAN_FALLBACK_PER_LEVEL = 10;
/** 未解锁线花愿在参考值上的额外倍率 */
export const MERCH_MYSTERY_HUAYUAN_LOCKED_MULT = 1.32;

export const MERCH_SHOP_SLOT_COUNT = 3;

/** 各行统一自动刷新周期（秒）：6 小时 */
export const MERCH_SHOP_REFRESH_INTERVAL_SEC = 6 * 60 * 60;

export const MERCH_SHELVES: MerchShelfDef[] = [
  {
    id: 'shelf_flowers',
    refreshIntervalSec: MERCH_SHOP_REFRESH_INTERVAL_SEC,
    slotCount: MERCH_SHOP_SLOT_COUNT,
    pickWithoutReplacement: true,
    dynamicFreeShopPool: true,
    pool: [],
  },
  {
    id: 'shelf_drinks_tools',
    refreshIntervalSec: MERCH_SHOP_REFRESH_INTERVAL_SEC,
    slotCount: MERCH_SHOP_SLOT_COUNT,
    pickWithoutReplacement: true,
    dynamicMysteryShopPool: true,
    pool: [],
  },
  {
    id: 'shelf_mixed',
    refreshIntervalSec: MERCH_SHOP_REFRESH_INTERVAL_SEC,
    slotCount: MERCH_SHOP_SLOT_COUNT,
    pickWithoutReplacement: true,
    dynamicMysteryShopPool: true,
    pool: [],
  },
];

export function getMerchShelfCount(): number {
  return MERCH_SHELVES.length;
}
