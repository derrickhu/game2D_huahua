/**
 * 建筑配置 - 永久型 7 + 消耗型 6
 */

import { FlowerLine, DrinkLine } from './ItemConfig';

export enum BuildingType {
  PERMANENT = 'permanent', // 永久型
  CONSUMABLE = 'consumable', // 消耗型
}

export interface BuildingDef {
  id: string;
  name: string;
  type: BuildingType;
  /** 产出的品类（flower/drink） */
  produceCategory: 'flower' | 'drink';
  /** 可产出的花系/饮品线列表 */
  produceLines: string[];
  /** 产出等级范围 [min, max] */
  produceLevelRange: [number, number];
  /** CD时间（秒），仅永久型有效 */
  cooldown: number;
  /** 消耗型总次数，仅消耗型有效 */
  totalUses: number;
  /** 消耗体力 */
  staminaCost: number;
  /** 合成所需材料ID（顶级建筑材料） */
  requireMatId: string;
}

export const BUILDING_DEFS: Map<string, BuildingDef> = new Map();

// 花束永久型建筑（4种）
const flowerPermanent: Omit<BuildingDef, 'id'>[] = [
  { name: '花艺操作台', type: BuildingType.PERMANENT, produceCategory: 'flower', produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY], produceLevelRange: [1, 2], cooldown: 30, totalUses: 0, staminaCost: 2, requireMatId: 'bmat_flower_build_1' },
  { name: '包装台', type: BuildingType.PERMANENT, produceCategory: 'flower', produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY], produceLevelRange: [1, 3], cooldown: 60, totalUses: 0, staminaCost: 3, requireMatId: 'bmat_flower_build_2' },
  { name: '小型温室', type: BuildingType.PERMANENT, produceCategory: 'flower', produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY], produceLevelRange: [2, 4], cooldown: 120, totalUses: 0, staminaCost: 5, requireMatId: 'bmat_flower_build_3' },
  { name: '星光花房', type: BuildingType.PERMANENT, produceCategory: 'flower', produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY], produceLevelRange: [3, 5], cooldown: 300, totalUses: 0, staminaCost: 8, requireMatId: 'bmat_flower_build_4' },
];

// 饮品永久型建筑（3种）
const drinkPermanent: Omit<BuildingDef, 'id'>[] = [
  { name: '简易茶台', type: BuildingType.PERMANENT, produceCategory: 'drink', produceLines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT], produceLevelRange: [1, 1], cooldown: 30, totalUses: 0, staminaCost: 2, requireMatId: 'bmat_drink_build_1' },
  { name: '调饮吧台', type: BuildingType.PERMANENT, produceCategory: 'drink', produceLines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT], produceLevelRange: [1, 2], cooldown: 60, totalUses: 0, staminaCost: 3, requireMatId: 'bmat_drink_build_2' },
  { name: '花饮工坊', type: BuildingType.PERMANENT, produceCategory: 'drink', produceLines: [DrinkLine.TEA, DrinkLine.COLD, DrinkLine.DESSERT], produceLevelRange: [2, 3], cooldown: 120, totalUses: 0, staminaCost: 5, requireMatId: 'bmat_drink_build_3' },
];

// 消耗型建筑（6种）
const consumable: Omit<BuildingDef, 'id'>[] = [
  { name: '花材礼盒', type: BuildingType.CONSUMABLE, produceCategory: 'flower', produceLines: [FlowerLine.DAILY], produceLevelRange: [1, 2], cooldown: 0, totalUses: 5, staminaCost: 1, requireMatId: '' },
  { name: '精选花篮', type: BuildingType.CONSUMABLE, produceCategory: 'flower', produceLines: [FlowerLine.DAILY, FlowerLine.ROMANTIC], produceLevelRange: [2, 3], cooldown: 0, totalUses: 4, staminaCost: 2, requireMatId: '' },
  { name: '花艺大师箱', type: BuildingType.CONSUMABLE, produceCategory: 'flower', produceLines: [FlowerLine.ROMANTIC, FlowerLine.LUXURY], produceLevelRange: [3, 4], cooldown: 0, totalUses: 3, staminaCost: 3, requireMatId: '' },
  { name: '茶包盒', type: BuildingType.CONSUMABLE, produceCategory: 'drink', produceLines: [DrinkLine.TEA], produceLevelRange: [1, 1], cooldown: 0, totalUses: 5, staminaCost: 1, requireMatId: '' },
  { name: '调饮套装', type: BuildingType.CONSUMABLE, produceCategory: 'drink', produceLines: [DrinkLine.TEA, DrinkLine.COLD], produceLevelRange: [1, 2], cooldown: 0, totalUses: 4, staminaCost: 2, requireMatId: '' },
  { name: '花饮臻选箱', type: BuildingType.CONSUMABLE, produceCategory: 'drink', produceLines: [DrinkLine.COLD, DrinkLine.DESSERT], produceLevelRange: [2, 3], cooldown: 0, totalUses: 3, staminaCost: 3, requireMatId: '' },
];

// 注册
let idx = 0;
for (const def of [...flowerPermanent, ...drinkPermanent]) {
  const id = `building_perm_${++idx}`;
  BUILDING_DEFS.set(id, { id, ...def });
}
idx = 0;
for (const def of consumable) {
  const id = `building_cons_${++idx}`;
  BUILDING_DEFS.set(id, { id, ...def });
}
