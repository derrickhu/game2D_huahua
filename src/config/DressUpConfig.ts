/**
 * 换装配置
 *
 * 整套形象定义：id / 名称 / 图标 / 花露价格 / 解锁条件
 * 新增形象只需在 ALL_OUTFITS 数组末尾加一行
 */
import type { UnlockRequirement } from '@/utils/UnlockChecker';

export interface Outfit {
  id: string;
  name: string;
  desc: string;
  /** 代表整套形象的 emoji，显示在店主头像上 */
  icon: string;
  /** 花露购买价格（0 = 免费/赠送） */
  hualuCost: number;
  /** 解锁前置条件（满足后才可购买） */
  unlockRequirement?: UnlockRequirement;
}

export const ALL_OUTFITS: Outfit[] = [
  { id: 'outfit_default',  name: '自然少女',    desc: '清新自然，田园花店的日常装扮',              icon: '👗', hualuCost: 0 },
  { id: 'outfit_florist',  name: '花店小姐姐',  desc: '专业花艺师的精致工装，满满花香',            icon: '💐', hualuCost: 15, unlockRequirement: { level: 2 } },
  { id: 'outfit_spring',   name: '春日樱花',    desc: '樱花盛开的季节，粉嫩少女感满分',           icon: '🌸', hualuCost: 30, unlockRequirement: { level: 4 } },
  { id: 'outfit_summer',   name: '夏日向日葵',  desc: '明媚阳光下，活力四射的夏日装扮',           icon: '🌻', hualuCost: 30, unlockRequirement: { level: 4 } },
  { id: 'outfit_vintage',  name: '复古花坊',    desc: '优雅复古的欧式风情，精致迷人',             icon: '🎀', hualuCost: 50, unlockRequirement: { level: 8 } },
  { id: 'outfit_queen',    name: '花之女王',    desc: '传说中的花神降临，集齐全部花语卡片解锁',    icon: '👑', hualuCost: 0, unlockRequirement: { questId: 'collect_all_flower_cards', conditionText: '集齐全部花语卡片' } },
];

/** 按 ID 查找形象 */
export const OUTFIT_MAP = new Map<string, Outfit>(ALL_OUTFITS.map(o => [o.id, o]));
