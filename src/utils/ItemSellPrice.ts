import type { ItemDef } from '@/config/ItemConfig';
import { Category } from '@/config/ItemConfig';
import { SeasonSystem } from '@/systems/SeasonSystem';

/** 棋盘出售价格（与 BoardView 出售逻辑一致，含季节倍率） */
export function getItemSellPrice(def: ItemDef): number {
  const base = def.level * 5 + (def.category === Category.FLOWER ? 5 : 3);
  return Math.floor(base * SeasonSystem.getSellPriceMultiplier(def.line));
}
