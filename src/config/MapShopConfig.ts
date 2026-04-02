/**
 * 地图弹框商店配置
 *
 * 定义大地图上「弹框购买」节点所售商品。
 * 每个 shopId 对应一家店，有自己的商品列表。
 */

export type MapShopItemType = 'stamina' | 'diamond' | 'chest' | 'item';

export interface MapShopItemDef {
  id: string;
  label: string;
  /** 商品图标 TextureCache key */
  iconKey: string;
  /** 商品类型 */
  type: MapShopItemType;
  /** 购买后给的数量 / itemId */
  amount?: number;
  itemId?: string;
  /** 价格：花愿消耗 */
  costHuayuan?: number;
  /** 价格：钻石消耗 */
  costDiamond?: number;
}

export interface MapShopDef {
  shopId: string;
  title: string;
  items: MapShopItemDef[];
}

export const MAP_SHOPS: MapShopDef[] = [
  {
    shopId: 'flower_market',
    title: '花市',
    items: [
      { id: 'fm_stamina_30', label: '体力×30', iconKey: 'icon_energy', type: 'stamina', amount: 30, costHuayuan: 200 },
      { id: 'fm_stamina_60', label: '体力×60', iconKey: 'icon_energy', type: 'stamina', amount: 60, costHuayuan: 380 },
      { id: 'fm_diamond_10', label: '钻石×10', iconKey: 'icon_gem', type: 'diamond', amount: 10, costHuayuan: 500 },
      { id: 'fm_chest_1', label: '宝箱', iconKey: 'chest_1', type: 'chest', itemId: 'chest_1', costDiamond: 5 },
    ],
  },
  {
    shopId: 'tool_shop',
    title: '工具铺',
    items: [
      { id: 'ts_stamina_50', label: '体力×50', iconKey: 'icon_energy', type: 'stamina', amount: 50, costDiamond: 8 },
      { id: 'ts_chest_2', label: '高级宝箱', iconKey: 'chest_2', type: 'chest', itemId: 'chest_2', costDiamond: 10 },
      { id: 'ts_diamond_20', label: '钻石×20', iconKey: 'icon_gem', type: 'diamond', amount: 20, costHuayuan: 900 },
    ],
  },
];

export function getMapShop(shopId: string): MapShopDef | undefined {
  return MAP_SHOPS.find(s => s.shopId === shopId);
}
