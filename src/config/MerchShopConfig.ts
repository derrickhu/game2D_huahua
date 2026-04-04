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
  /** 加权随机池 */
  pool: MerchPoolEntry[];
  /** 池条目够用时是否不放回抽样（尽量不重复） */
  pickWithoutReplacement: boolean;
}

export const MERCH_SHOP_SLOT_COUNT = 3;

/** 各行统一自动刷新周期（秒）：6 小时 */
export const MERCH_SHOP_REFRESH_INTERVAL_SEC = 6 * 60 * 60;

export const MERCH_SHELVES: MerchShelfDef[] = [
  {
    id: 'shelf_flowers',
    refreshIntervalSec: MERCH_SHOP_REFRESH_INTERVAL_SEC,
    slotCount: MERCH_SHOP_SLOT_COUNT,
    pickWithoutReplacement: true,
    pool: [
      { itemId: 'flower_fresh_1', weight: 25, priceType: 'free', purchaseStock: 5 },
      { itemId: 'flower_fresh_2', weight: 18, priceType: 'huayuan', priceAmount: 12 },
      { itemId: 'flower_green_1', weight: 20, priceType: 'huayuan', priceAmount: 15 },
      { itemId: 'drink_tea_1', weight: 15, priceType: 'diamond', priceAmount: 2 },
      { itemId: 'tool_plant_1', weight: 12, priceType: 'ad' },
    ],
  },
  {
    id: 'shelf_drinks_tools',
    refreshIntervalSec: MERCH_SHOP_REFRESH_INTERVAL_SEC,
    slotCount: MERCH_SHOP_SLOT_COUNT,
    pickWithoutReplacement: true,
    pool: [
      { itemId: 'drink_cold_1', weight: 20, priceType: 'huayuan', priceAmount: 18, purchaseStock: 3 },
      { itemId: 'drink_dessert_1', weight: 18, priceType: 'huayuan', priceAmount: 20 },
      { itemId: 'tool_tea_set_1', weight: 14, priceType: 'diamond', priceAmount: 3 },
      { itemId: 'tool_mixer_1', weight: 14, priceType: 'diamond', priceAmount: 4 },
      { itemId: 'flower_bouquet_1', weight: 10, priceType: 'ad' },
      { itemId: 'flower_fresh_3', weight: 14, priceType: 'free' },
    ],
  },
  {
    id: 'shelf_mixed',
    refreshIntervalSec: MERCH_SHOP_REFRESH_INTERVAL_SEC,
    slotCount: MERCH_SHOP_SLOT_COUNT,
    pickWithoutReplacement: true,
    pool: [
      { itemId: 'flower_fresh_4', weight: 16, priceType: 'huayuan', priceAmount: 35 },
      { itemId: 'drink_tea_2', weight: 14, priceType: 'huayuan', priceAmount: 40 },
      { itemId: 'tool_plant_2', weight: 12, priceType: 'diamond', priceAmount: 5 },
      { itemId: 'flower_green_2', weight: 14, priceType: 'ad' },
      { itemId: 'drink_cold_2', weight: 12, priceType: 'diamond', priceAmount: 6 },
      { itemId: 'tool_bake_1', weight: 12, priceType: 'free' },
      { itemId: 'flower_bouquet_2', weight: 10, priceType: 'huayuan', priceAmount: 55 },
    ],
  },
];

export function getMerchShelfCount(): number {
  return MERCH_SHELVES.length;
}
