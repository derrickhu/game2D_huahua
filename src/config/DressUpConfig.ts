/**
 * 换装配置
 *
 * 整套形象定义：id / 名称 / 图标 / 花愿价格 / 解锁条件
 * 换装面板展示套：在 DRESSUP_PANEL_OUTFITS 末尾追加。
 * 活动隐藏套（如花之女王）放 DRESSUP_HIDDEN_OUTFITS，仍可通过 grantOutfit 解锁穿戴。
 */
import type { UnlockRequirement } from '@/utils/UnlockChecker';

export interface Outfit {
  id: string;
  name: string;
  desc: string;
  /** 代表整套形象的 emoji，显示在店主头像上 */
  icon: string;
  /** 花愿购买价格（0 = 免费/赠送） */
  huayuanCost: number;
  /** 购买后获得的星星值 */
  starValue: number;
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

/** 看广告解锁购买资格的形象（与 `DecorationManager` 广告 gate 同流程：先看广告，再花愿购买） */
export const AD_UNLOCK_OUTFIT_IDS = new Set<string>(['outfit_qinglian']);

/** 花之女王等活动赠送套装：活动结算处请调用 `DressUpManager.grantOutfitFromActivity('outfit_queen')`（会同步 grantQuest，条件与存档一致） */
export const OUTFIT_QUEEN_ACTIVITY_QUEST_ID = 'dressup_activity_outfit_queen';
export const OUTFIT_JEWEL_BLOOM_ACTIVITY_QUEST_ID = 'dressup_activity_outfit_jewel_bloom';

/**
 * 活动解锁的套装：完成对应活动时应调用 `grantOutfitFromActivity`，勿仅改存档。
 * key = outfitId，value = UnlockChecker 的 questId（与配置里 unlockRequirement.questId 一致）
 */
export const OUTFIT_ACTIVITY_QUEST_BY_ID: Readonly<Record<string, string>> = {
  outfit_queen: OUTFIT_QUEEN_ACTIVITY_QUEST_ID,
  outfit_jewel_bloom: OUTFIT_JEWEL_BLOOM_ACTIVITY_QUEST_ID,
};

/** 形象换装面板展示的套装（2 列网格，活动套可用 quest 条件显示「活动解锁」；有花愿售价套相对初版 ×2） */
export const DRESSUP_PANEL_OUTFITS: Outfit[] = [
  { id: 'outfit_default',  name: '自然少女',    desc: '清新自然，田园花店的日常装扮',              icon: '', huayuanCost: 0, starValue: 0 },
  { id: 'outfit_florist',  name: '花店小姐姐',  desc: '专业花艺师的精致工装，满满花香',            icon: '', huayuanCost: 1200, starValue: 3, unlockRequirement: { level: 2 } },
  { id: 'outfit_spring',   name: '春日樱花',    desc: '樱花盛开的季节，粉嫩少女感满分',           icon: '', huayuanCost: 10600, starValue: 6, unlockRequirement: { level: 8 } },
  { id: 'outfit_summer',   name: '夏日向日葵',  desc: '明媚阳光下，活力四射的夏日装扮',           icon: '', huayuanCost: 2160, starValue: 6, unlockRequirement: { level: 6 } },
  { id: 'outfit_vintage',  name: '丝绒蔷薇',    desc: '酒红丝绒与蕾丝的复古礼装，优雅迷人',       icon: '', huayuanCost: 5600, starValue: 9, unlockRequirement: { level: 9 } },
  {
    id: 'outfit_qinglian',
    name: '清涟荷影',
    desc: '薄荷青瓷与粉荷纹的古风襦裙，莲影摇曳',
    icon: '',
    huayuanCost: 6998,
    starValue: 5,
  },
  {
    id: 'outfit_jewel_bloom',
    name: '珠光花影',
    desc: '旗袍、满天星与红宝石点缀的花间珠匣限定装扮',
    icon: '',
    huayuanCost: 0,
    starValue: 10,
    unlockRequirement: {
      questId: OUTFIT_JEWEL_BLOOM_ACTIVITY_QUEST_ID,
      conditionText: '活动解锁',
      questDetailText: '完成花间珠匣活动进度后自动获得该套装',
    },
  },
];

/** 活动赠送等隐藏套：可 grantOutfit / 穿戴，不进换装面板 */
export const DRESSUP_HIDDEN_OUTFITS: Outfit[] = [
  {
    id: 'outfit_queen',
    name: '花之女王',
    desc: '传说中的花神降临，参与指定活动即可获得',
    icon: '',
    huayuanCost: 0,
    starValue: 10,
    unlockRequirement: {
      questId: OUTFIT_QUEEN_ACTIVITY_QUEST_ID,
      conditionText: '活动解锁',
      questDetailText: '完成指定活动后将自动获得该套装',
    },
  },
];

/** @deprecated 请用 DRESSUP_PANEL_OUTFITS；保留别名避免旧引用断裂 */
export const ALL_OUTFITS = DRESSUP_PANEL_OUTFITS;

const _ALL_OUTFIT_DEFS = [...DRESSUP_PANEL_OUTFITS, ...DRESSUP_HIDDEN_OUTFITS];

/** 按 ID 查找形象（含隐藏套） */
export const OUTFIT_MAP = new Map<string, Outfit>(_ALL_OUTFIT_DEFS.map(o => [o.id, o]));
