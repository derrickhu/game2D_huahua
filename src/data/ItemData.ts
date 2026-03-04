import { ItemCategory } from '../config/Constants';

/**
 * 统一物品接口：描述任意品类的物品
 */
export interface ItemInfo {
  id: string;
  category: ItemCategory;
  line: string;        // FlowerFamily / DrinkLine / 未来新品类的线
  level: number;
  name: string;
  sellPrice: number;
  color: number;
  maxLevel: number;    // 该合成线的最大等级
}

/**
 * 品类适配器 — 每个品类实现此接口后注册即可
 */
export interface CategoryAdapter {
  category: ItemCategory;
  hasItem(itemId: string): boolean;
  getItemInfo(itemId: string): ItemInfo | null;
  getNextLevelId(itemId: string): string | null;
}

// =============================================
// 注册表：所有品类适配器集中在此
// =============================================
const adapters: CategoryAdapter[] = [];

/** 注册一个品类适配器（FlowerData / DrinkData 各自在模块末尾调用） */
export function registerCategory(adapter: CategoryAdapter): void {
  adapters.push(adapter);
}

// =============================================
// 公共 API — 遍历注册表，自动路由到对应品类
// =============================================

/** 根据物品ID判断品类 */
export function getItemCategory(itemId: string): ItemCategory | null {
  for (const adapter of adapters) {
    if (adapter.hasItem(itemId)) return adapter.category;
  }
  return null;
}

/** 获取统一的物品信息 */
export function getItemInfo(itemId: string): ItemInfo | null {
  for (const adapter of adapters) {
    const info = adapter.getItemInfo(itemId);
    if (info) return info;
  }
  return null;
}

/** 获取合成后的下一级物品ID */
export function getNextLevelId(itemId: string): string | null {
  for (const adapter of adapters) {
    if (adapter.hasItem(itemId)) return adapter.getNextLevelId(itemId);
  }
  return null;
}

/** 判断两个物品能否合成 */
export function canItemsMerge(idA: string, idB: string): boolean {
  const a = getItemInfo(idA);
  const b = getItemInfo(idB);
  if (!a || !b) return false;
  return a.category === b.category
    && a.line === b.line
    && a.level === b.level
    && a.level < a.maxLevel;
}

/** 获取物品显示名 */
export function getItemDisplayName(itemId: string): string {
  const info = getItemInfo(itemId);
  if (!info) return itemId;
  return info.name;
}

// =============================================
// 品类视觉配置注册表 — 供 BoardItem / Building 查表用
// =============================================

/** 物品形状绘制函数签名 */
export type ItemShapeDrawer = (
  gfx: import('phaser').GameObjects.Graphics,
  color: number,
  radius: number,
) => void;

/** 建筑样式配置 */
export interface BuildingStyle {
  bgColor: number;
  bgAlpha: number;
  drawDecoration: (gfx: import('phaser').GameObjects.Graphics, s: number) => void;
}

const itemShapeDrawers = new Map<ItemCategory, ItemShapeDrawer>();
const categoryIcons = new Map<ItemCategory, string>();
const buildingStyles = new Map<ItemCategory, BuildingStyle>();

/** 注册物品形状绘制器 */
export function registerItemShape(category: ItemCategory, drawer: ItemShapeDrawer): void {
  itemShapeDrawers.set(category, drawer);
}

/** 注册品类图标 */
export function registerCategoryIcon(category: ItemCategory, icon: string): void {
  categoryIcons.set(category, icon);
}

/** 注册建筑样式 */
export function registerBuildingStyle(category: ItemCategory, style: BuildingStyle): void {
  buildingStyles.set(category, style);
}

/** 获取物品形状绘制器 */
export function getItemShapeDrawer(category: ItemCategory): ItemShapeDrawer | undefined {
  return itemShapeDrawers.get(category);
}

/** 获取品类图标 */
export function getCategoryIcon(category: ItemCategory): string {
  return categoryIcons.get(category) || '📦';
}

/** 获取建筑样式 */
export function getBuildingStyle(category: ItemCategory): BuildingStyle | undefined {
  return buildingStyles.get(category);
}
