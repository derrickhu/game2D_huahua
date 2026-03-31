import type { ItemDef } from '@/config/ItemConfig';

/**
 * 棋盘出售花愿：读 `ItemDef.sellHuayuan`（build 时由 orderHuayuan×低比例算出，固定且 ≤ 订单单价）。
 * 无字段则 0，UI 显示「腾格」。
 */
export function getItemSellPrice(def: ItemDef): number {
  const n = def.sellHuayuan;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 1) return 0;
  return Math.floor(n);
}
