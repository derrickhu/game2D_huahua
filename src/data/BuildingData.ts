import { FlowerFamily } from '../config/Constants';

export interface BuildingConfig {
  id: string;
  name: string;
  unlockPrice: number;                // 金币解锁价格
  unlockOrder: number;                // 解锁顺序
  selectableFamilies: FlowerFamily[]; // 可选花系
  outputLevels: { min: number; max: number }; // 产出等级范围
}

export const BuildingConfigs: BuildingConfig[] = [
  {
    id: 'workbench',
    name: '花艺操作台',
    unlockPrice: 50,
    unlockOrder: 1,
    selectableFamilies: [FlowerFamily.DAILY],
    outputLevels: { min: 1, max: 2 },
  },
  {
    id: 'seedbox',
    name: '花苗培育箱',
    unlockPrice: 200,
    unlockOrder: 2,
    selectableFamilies: [FlowerFamily.DAILY],
    outputLevels: { min: 1, max: 2 },
  },
  {
    id: 'wrapper',
    name: '包装台',
    unlockPrice: 500,
    unlockOrder: 3,
    selectableFamilies: [FlowerFamily.DAILY, FlowerFamily.ROMANTIC],
    outputLevels: { min: 1, max: 3 },
  },
  {
    id: 'greenhouse',
    name: '温室',
    unlockPrice: 1000,
    unlockOrder: 4,
    selectableFamilies: [FlowerFamily.DAILY, FlowerFamily.ROMANTIC, FlowerFamily.LUXURY],
    outputLevels: { min: 1, max: 3 },
  },
];

export function getBuildingConfig(buildingId: string): BuildingConfig | undefined {
  return BuildingConfigs.find(b => b.id === buildingId);
}

export function getNextUnlockableBuilding(unlockedIds: string[]): BuildingConfig | undefined {
  return BuildingConfigs
    .filter(b => !unlockedIds.includes(b.id))
    .sort((a, b) => a.unlockOrder - b.unlockOrder)[0];
}
