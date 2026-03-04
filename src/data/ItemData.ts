import { ItemCategory, FlowerFamily, DrinkLine, MAX_FLOWER_LEVEL, MAX_DRINK_LEVEL } from '../config/Constants';
import { FlowerDataMap, getFlowerConfig, getNextLevelId as getFlowerNextId } from './FlowerData';
import { DrinkDataMap, getDrinkConfig, getDrinkNextLevelId } from './DrinkData';

/**
 * 统一物品接口：同时描述花束和花饮
 */
export interface ItemInfo {
  id: string;
  category: ItemCategory;
  line: string;        // FlowerFamily 或 DrinkLine
  level: number;
  name: string;
  sellPrice: number;
  color: number;
  maxLevel: number;
}

/** 根据物品ID判断品类 */
export function getItemCategory(itemId: string): ItemCategory | null {
  if (FlowerDataMap.has(itemId)) return ItemCategory.FLOWER;
  if (DrinkDataMap.has(itemId)) return ItemCategory.DRINK;
  return null;
}

/** 获取统一的物品信息 */
export function getItemInfo(itemId: string): ItemInfo | null {
  const flower = getFlowerConfig(itemId);
  if (flower) {
    return {
      id: flower.id,
      category: ItemCategory.FLOWER,
      line: flower.family,
      level: flower.level,
      name: flower.name,
      sellPrice: flower.sellPrice,
      color: flower.color,
      maxLevel: MAX_FLOWER_LEVEL,
    };
  }
  const drink = getDrinkConfig(itemId);
  if (drink) {
    return {
      id: drink.id,
      category: ItemCategory.DRINK,
      line: drink.line,
      level: drink.level,
      name: drink.name,
      sellPrice: drink.sellPrice,
      color: drink.color,
      maxLevel: MAX_DRINK_LEVEL,
    };
  }
  return null;
}

/** 获取合成后的下一级物品ID */
export function getNextLevelId(itemId: string): string | null {
  if (FlowerDataMap.has(itemId)) return getFlowerNextId(itemId);
  if (DrinkDataMap.has(itemId)) return getDrinkNextLevelId(itemId);
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
