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
  /**
   * 花店/装修场景店主全身像：在 ShopScene 统一 targetH（当前 165 = 原 150×1.1）基础上的额外倍率（默认 1）。
   * 生成图里人物占画布比例、上下留白与默认套不一致时，可单独微调（如 0.92 / 1.05），无需改 PNG 尺寸。
   */
  ownerShopDisplayScale?: number;
  /**
   * 合成棋盘页半身像：在 MainScene 统一目标高度/栏宽（BOARD_OWNER_TARGET_H / BOARD_OWNER_MAX_W）基础上的额外倍率（默认 1）。
   */
  ownerBoardDisplayScale?: number;
}

/** 花店店主缩放乘数 */
export function getOwnerShopDisplayScale(outfitId: string): number {
  return OUTFIT_MAP.get(outfitId)?.ownerShopDisplayScale ?? 1;
}

/** 棋盘页店主半身缩放乘数 */
export function getOwnerBoardDisplayScale(outfitId: string): number {
  return OUTFIT_MAP.get(outfitId)?.ownerBoardDisplayScale ?? 1;
}

/** 换装卡预览：睁眼半身 `TextureCache` key（与 MainScene 半身一致） */
export function getOwnerChibiTextureKey(outfitId: string): string {
  return outfitId === 'outfit_default' ? 'owner_chibi_default' : `owner_chibi_${outfitId}`;
}

/** 换装卡预览兜底：睁眼全身（半身资源未接入时） */
export function getOwnerFullOpenTextureKey(outfitId: string): string {
  return outfitId === 'outfit_default' ? 'owner_full_default' : `owner_full_${outfitId}`;
}

export const ALL_OUTFITS: Outfit[] = [
  { id: 'outfit_default',  name: '自然少女',    desc: '清新自然，田园花店的日常装扮',              icon: '👗', hualuCost: 0 },
  { id: 'outfit_florist',  name: '花店小姐姐',  desc: '专业花艺师的精致工装，满满花香',            icon: '💐', hualuCost: 80,  unlockRequirement: { level: 2 } },
  { id: 'outfit_spring',   name: '春日樱花',    desc: '樱花盛开的季节，粉嫩少女感满分',           icon: '🌸', hualuCost: 150, unlockRequirement: { level: 4 } },
  { id: 'outfit_summer',   name: '夏日向日葵',  desc: '明媚阳光下，活力四射的夏日装扮',           icon: '🌻', hualuCost: 150, unlockRequirement: { level: 4 } },
  { id: 'outfit_vintage',  name: '复古花坊',    desc: '优雅复古的欧式风情，精致迷人',             icon: '🎀', hualuCost: 300, unlockRequirement: { level: 8 } },
  { id: 'outfit_queen',    name: '花之女王',    desc: '传说中的花神降临，集齐全部花语卡片解锁',    icon: '👑', hualuCost: 0, unlockRequirement: { questId: 'collect_all_flower_cards', conditionText: '集齐全部花语卡片' } },
];

/** 按 ID 查找形象 */
export const OUTFIT_MAP = new Map<string, Outfit>(ALL_OUTFITS.map(o => [o.id, o]));
