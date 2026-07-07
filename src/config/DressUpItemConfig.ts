/**
 * 分部件换装配置（叠层纸娃娃）
 *
 * 坐标系：标准画布 432×768（精确 9:16，与 Gemini 生图比例一致，方便部件直接对位），
 * 基础身体铺满画布，各部件为紧凑裁切 PNG，
 * 通过 x/y（部件中心在画布上的位置）+ scale 定位，GM「部件对齐」工具可视化校准。
 *
 * 层序（zIndex 小 → 大 = 后 → 前）：
 *   身体(10) < 鞋子(20) < 下装(30) < 上衣(40) < 妆容(50) < 发型(70) < 饰品(80)
 *
 * 部件坐标由 scripts/process_dressup_parts.py 处理原图后打印，再回填本文件。
 */
import type { UnlockRequirement } from '@/utils/UnlockChecker';

/** 标准画布尺寸（部件坐标全部相对该画布） */
export const DRESSUP_CANVAS_W = 432;
export const DRESSUP_CANVAS_H = 768;

/** 半身像裁切区（标准画布坐标，头顶到腰部；MainScene 半身像用） */
export const DRESSUP_BUST_CROP = { x: 16, y: 16, w: 400, h: 452 };

export type DressUpSlot = 'hair' | 'top' | 'bottom' | 'shoes' | 'makeup' | 'accessory';

export const DRESSUP_SLOT_ORDER: readonly DressUpSlot[] = [
  'hair', 'top', 'bottom', 'shoes', 'makeup', 'accessory',
];

export const DRESSUP_SLOT_NAMES: Readonly<Record<DressUpSlot, string>> = {
  hair: '发型',
  top: '上衣',
  bottom: '下装',
  shoes: '鞋子',
  makeup: '妆容',
  accessory: '饰品',
};

/** 各槽位渲染层级 */
export const DRESSUP_SLOT_Z: Readonly<Record<DressUpSlot, number>> = {
  shoes: 20,
  bottom: 30,
  top: 40,
  makeup: 50,
  hair: 70,
  accessory: 80,
};

export const DRESSUP_BODY_Z = 10;

/** 基础身体（光头 + 素色打底裙）纹理 key */
export const DRESSUP_BODY_TEXTURE_KEY = 'owner_body_base';
/** 闭眼版基础身体（眨眼时整层替换身体贴图） */
export const DRESSUP_BODY_BLINK_TEXTURE_KEY = 'owner_body_base_blink';

export interface DressUpItem {
  id: string;
  slot: DressUpSlot;
  name: string;
  desc?: string;
  /** TextureCache key（`owner_part_*`，位于 chars 分包 parts 目录） */
  textureKey: string;
  /** 花愿购买价格（0 = 免费/默认拥有） */
  huayuanCost: number;
  /** 购买后获得的星星值 */
  starValue?: number;
  unlockRequirement?: UnlockRequirement;
  /** 部件中心在标准画布上的 X（GM 对齐工具校准后回填） */
  x: number;
  /** 部件中心在标准画布上的 Y */
  y: number;
  /** 部件相对原始 PNG 的缩放 */
  scale: number;
}

/**
 * 部件列表。
 * x/y 由 scripts/process_dressup_parts.py 校准输出（合成预览验收通过后回填）；
 * 后续微调可用 GM「部件对齐」工具。
 */
export const DRESSUP_ITEMS: DressUpItem[] = [
  // ─── 发型 ───
  {
    id: 'hair_bob_brown', slot: 'hair', name: '栗色波波头', desc: '自然乖巧的日常发型',
    textureKey: 'owner_part_hair_bob_brown', huayuanCost: 0,
    x: 219, y: 186, scale: 1,
  },
  {
    id: 'hair_twintail_pink', slot: 'hair', name: '粉色双马尾', desc: '活泼可爱的粉色双马尾',
    textureKey: 'owner_part_hair_twintail_pink', huayuanCost: 800, starValue: 2,
    x: 217, y: 196, scale: 1,
  },
  // ─── 上衣 ───
  {
    id: 'top_pink_puff', slot: 'top', name: '粉泡泡袖衫', desc: '软糯的粉色泡泡袖围裙衫',
    textureKey: 'owner_part_top_pink_puff', huayuanCost: 0,
    x: 216, y: 430, scale: 1,
  },
  {
    id: 'top_sailor_blue', slot: 'top', name: '水手服上衣', desc: '清爽的蓝白水手领上衣',
    textureKey: 'owner_part_top_sailor_blue', huayuanCost: 600, starValue: 2,
    x: 216, y: 430, scale: 1,
  },
  // ─── 下装 ───
  {
    id: 'bottom_denim_skirt', slot: 'bottom', name: '蓝布半裙', desc: '耐脏又百搭的蓝布裙',
    textureKey: 'owner_part_bottom_denim_skirt', huayuanCost: 0,
    x: 216, y: 560, scale: 1,
  },
  {
    id: 'bottom_flower_skirt', slot: 'bottom', name: '碎花长裙', desc: '缀满小花的浪漫长裙',
    textureKey: 'owner_part_bottom_flower_skirt', huayuanCost: 600, starValue: 2,
    x: 216, y: 590, scale: 1,
  },
  // ─── 鞋子 ───
  {
    id: 'shoes_white_flats', slot: 'shoes', name: '白色小皮鞋', desc: '圆头小白鞋',
    textureKey: 'owner_part_shoes_white_flats', huayuanCost: 0,
    x: 220, y: 728, scale: 1,
  },
  {
    id: 'shoes_red_boots', slot: 'shoes', name: '红色小短靴', desc: '亮眼的红色短靴',
    textureKey: 'owner_part_shoes_red_boots', huayuanCost: 400, starValue: 1,
    x: 220, y: 720, scale: 1,
  },
  // ─── 妆容 ───
  {
    id: 'makeup_blush_pink', slot: 'makeup', name: '粉腮红', desc: '元气满满的粉扑扑腮红',
    textureKey: 'owner_part_makeup_blush_pink', huayuanCost: 300, starValue: 1,
    x: 228, y: 250, scale: 1,
  },
  // ─── 饰品 ───
  {
    id: 'acc_pearl_necklace', slot: 'accessory', name: '珍珠项链', desc: '温润的小珍珠项链',
    textureKey: 'owner_part_acc_pearl_necklace', huayuanCost: 900, starValue: 3,
    x: 220, y: 368, scale: 1,
  },
  {
    id: 'acc_star_earrings', slot: 'accessory', name: '星星耳环', desc: '一对亮晶晶的小星星',
    textureKey: 'owner_part_acc_star_earrings', huayuanCost: 700, starValue: 2,
    x: 224, y: 268, scale: 1,
  },
];

export const DRESSUP_ITEM_MAP = new Map<string, DressUpItem>(DRESSUP_ITEMS.map(i => [i.id, i]));

/** 免费部件（进入自定义模式时默认解锁并穿上基本套） */
export const DRESSUP_FREE_ITEM_IDS: readonly string[] =
  DRESSUP_ITEMS.filter(i => i.huayuanCost === 0 && !i.unlockRequirement).map(i => i.id);

/** 首次切到自定义模式时的默认穿搭（免费基本套） */
export const DRESSUP_DEFAULT_EQUIPPED: Readonly<Partial<Record<DressUpSlot, string>>> = {
  hair: 'hair_bob_brown',
  top: 'top_pink_puff',
  bottom: 'bottom_denim_skirt',
  shoes: 'shoes_white_flats',
};

export function getItemsBySlot(slot: DressUpSlot): DressUpItem[] {
  return DRESSUP_ITEMS.filter(i => i.slot === slot);
}

/**
 * GM 对齐工具的运行时偏移覆盖（不落存档；导出 JSON 后人工回填本文件）。
 * key = itemId（或 '__bustCrop' 调半身裁切）
 */
export const DRESSUP_ALIGN_OVERRIDES = new Map<string, { x: number; y: number; scale: number }>();

/** 取部件生效位置（GM 运行时覆盖优先） */
export function getItemPlacement(item: DressUpItem): { x: number; y: number; scale: number } {
  return DRESSUP_ALIGN_OVERRIDES.get(item.id) ?? { x: item.x, y: item.y, scale: item.scale };
}
