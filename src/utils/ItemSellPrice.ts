import type { ItemDef } from '@/config/ItemConfig';

/**
 * 棋盘出售：不再给花愿（花愿仅订单+离线）；返回 0 供 UI 显示「仅腾格」。
 */
export function getItemSellPrice(_def: ItemDef): number {
  return 0;
}
