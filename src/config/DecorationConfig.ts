/**
 * 花店装修配置 v2
 *
 * 分为两大系统：
 * 1. 房间风格（room_style）— 整张房间背景图一键切换
 * 2. 可摆放家具（6 大类）— 自由拖拽到房间中
 *
 * 素材规划：
 * - 每类家具在一张 spritesheet 中（6×1 或自定义网格），统一画风
 * - 房间风格对应完整背景图
 */

// ======== 家具槽位（只保留可摆放的 6 类） ========

export enum DecoSlot {
  SHELF     = 'shelf',      // 花架 / 展示架
  TABLE     = 'table',      // 桌台 / 工作台
  LIGHT     = 'light',      // 灯具
  ORNAMENT  = 'ornament',   // 摆件 / 装饰品
  WALLART   = 'wallart',    // 墙饰 / 挂件
  GARDEN    = 'garden',     // 庭院 / 户外
}

// ======== 稀有度 ========

export enum DecoRarity {
  COMMON  = 'common',   // 普通（白）
  FINE    = 'fine',     // 精良（绿）
  RARE    = 'rare',     // 稀有（蓝）
  LIMITED = 'limited',  // 限定（橙）
}

// ======== 数据结构 ========

import type { UnlockRequirement } from '@/utils/UnlockChecker';

export interface DecoDef {
  id: string;
  name: string;
  slot: DecoSlot;
  rarity: DecoRarity;
  /** 购买所需花愿（0 = 不扣花愿；基础款亦应标价，见各条目） */
  cost: number;
  /** 纹理 key（对应 TextureCache 中的 key） */
  icon: string;
  /** 简短描述 */
  desc: string;
  /** 季节限定（可选）：spring / summer / autumn / winter */
  season?: string;
  /** 解锁前置条件（满足后才可购买） */
  unlockRequirement?: UnlockRequirement;
}

/** 房间整体风格定义 */
export interface RoomStyleDef {
  id: string;
  name: string;
  /** 购买所需花愿（0 = 默认免费） */
  cost: number;
  rarity: DecoRarity;
  /** 背景纹理 key */
  bgTexture: string;
  desc: string;
  season?: string;
  /** 解锁前置条件（满足后才可购买） */
  unlockRequirement?: UnlockRequirement;
}

// ======== 槽位信息 ========

export const DECO_SLOT_INFO: Record<DecoSlot, { name: string; emoji: string }> = {
  [DecoSlot.SHELF]:    { name: '花架',   emoji: '🌿' },
  [DecoSlot.TABLE]:    { name: '桌台',   emoji: '🪵' },
  [DecoSlot.LIGHT]:    { name: '灯具',   emoji: '💡' },
  [DecoSlot.ORNAMENT]: { name: '摆件',   emoji: '🏺' },
  [DecoSlot.WALLART]:  { name: '墙饰',   emoji: '🖼️' },
  [DecoSlot.GARDEN]:   { name: '庭院',   emoji: '🌳' },
};

/** 稀有度信息 */
export const DECO_RARITY_INFO: Record<DecoRarity, { name: string; color: number }> = {
  [DecoRarity.COMMON]:  { name: '普通', color: 0x999999 },
  [DecoRarity.FINE]:    { name: '精良', color: 0x4CAF50 },
  [DecoRarity.RARE]:    { name: '稀有', color: 0x2196F3 },
  [DecoRarity.LIMITED]: { name: '限定', color: 0xFF9800 },
};

// ======== 房间风格列表 ========

export const ROOM_STYLES: RoomStyleDef[] = [
  { id: 'style_default', name: '温馨明亮花坊', cost: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_default', desc: '左上柔光、粉瓦白墙与细密人字拼，贴近合成页明亮感（v2）' },
  { id: 'style_candy_nb2', name: '🍬 糖果花坊', cost: 850, rarity: DecoRarity.FINE, bgTexture: 'bg_room_candy_nb2', desc: '多色糖果 pastel 硬装，壁纸感墙面与人字拼地板', unlockRequirement: { level: 4 } },
  { id: 'style_white',   name: '清新白调',   cost: 900, rarity: DecoRarity.FINE,   bgTexture: 'bg_room_white',   desc: '白墙白柜，北欧简约感', unlockRequirement: { level: 5 } },
  { id: 'style_bloom_nb2', name: '🌷 花境小筑', cost: 1000, rarity: DecoRarity.FINE, bgTexture: 'bg_room_bloom_nb2', desc: '窗台花箱与檐口垂花，多色 pastel 硬装', unlockRequirement: { level: 6 } },
  { id: 'style_pinkblue_nb2', name: '💗 粉蓝花坊', cost: 1200, rarity: DecoRarity.FINE, bgTexture: 'bg_room_pinkblue_nb2', desc: '粉白蓝温馨风：短绒地毯、樱花形窗、新瓦型屋顶', unlockRequirement: { level: 8 } },
  { id: 'style_lagoon_nb2', name: '🍹 海岛汽水', cost: 1350, rarity: DecoRarity.RARE, bgTexture: 'bg_room_lagoon_nb2', desc: '青绿天蓝木瓜橙撞色，清新热带感', unlockRequirement: { level: 9 } },
  { id: 'style_vintage', name: '复古花坊',   cost: 1500, rarity: DecoRarity.RARE,   bgTexture: 'bg_room_vintage', desc: '深木色 + 怀旧砖墙，欧式老花店', unlockRequirement: { level: 11 } },
  { id: 'style_confetti_nb2', name: '🎉 彩屑木屋', cost: 1650, rarity: DecoRarity.LIMITED, bgTexture: 'bg_room_confetti_nb2', desc: '拼色屋顶与几何墙饰，节日感不荧光', unlockRequirement: { level: 13 } },
  { id: 'style_spring',  name: '🌸 春日粉', cost: 1800, rarity: DecoRarity.LIMITED, bgTexture: 'bg_room_spring',  desc: '粉色系墙面 + 樱花元素', season: 'spring', unlockRequirement: { level: 15 } },
];

export const ROOM_STYLE_MAP = new Map<string, RoomStyleDef>(
  ROOM_STYLES.map(s => [s.id, s])
);

// ======== 可摆放家具定义 ========
// icon 字段已切换为新素材 key（对应 images/furniture/ 目录下的扣底图）

export const DECO_DEFS: DecoDef[] = [

  // ═══════ ① 花架 / 展示架 (shelf) ═══════
  { id: 'shelf_wood',    name: '简约木花架',  slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 100, icon: 'shelf_wood',   desc: '三层原木架，朴素实用' },
  { id: 'shelf_step',    name: '阶梯花架',    slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 150, icon: 'shelf_step',   desc: '层层叠叠，像小山丘', unlockRequirement: { level: 2 } },
  { id: 'shelf_long',    name: '长条花台',    slot: DecoSlot.SHELF, rarity: DecoRarity.FINE,   cost: 360, icon: 'shelf_long',   desc: '靠墙摆放的温馨花台', unlockRequirement: { level: 5 } },
  { id: 'shelf_iron',    name: '铁艺旋转架',  slot: DecoSlot.SHELF, rarity: DecoRarity.FINE,   cost: 600, icon: 'shelf_iron',   desc: '优雅的法式铁艺风格', unlockRequirement: { level: 7 } },
  { id: 'shelf_glass',   name: '玻璃展示柜',  slot: DecoSlot.SHELF, rarity: DecoRarity.RARE,   cost: 1200, icon: 'shelf_glass',  desc: '高端玻璃门展示柜', unlockRequirement: { level: 12 } },

  // ═══════ ② 桌台 / 工作台 (table) ═══════
  { id: 'table_counter',  name: '木质收银台',  slot: DecoSlot.TABLE, rarity: DecoRarity.COMMON, cost: 110, icon: 'table_counter', desc: '温暖的原木收银台' },
  { id: 'table_drawer',   name: '抽屉式柜台',  slot: DecoSlot.TABLE, rarity: DecoRarity.COMMON, cost: 240, icon: 'table_drawer',  desc: '带抽屉的实用柜台', unlockRequirement: { level: 3 } },
  { id: 'table_work',     name: '花艺工作台',  slot: DecoSlot.TABLE, rarity: DecoRarity.FINE,   cost: 540, icon: 'table_work',    desc: '专业的花艺操作台', unlockRequirement: { level: 6 } },
  { id: 'table_marble',   name: '大理石桌',    slot: DecoSlot.TABLE, rarity: DecoRarity.RARE,   cost: 1050, icon: 'table_marble',  desc: '冷峻优雅的大理石面', unlockRequirement: { level: 10 } },

  // ═══════ ③ 灯具 (light) ═══════
  { id: 'light_desk',     name: '台灯',        slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 85,  icon: 'light_desk',    desc: '简约台灯，温暖光芒' },
  { id: 'light_floor',    name: '落地灯',      slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 180, icon: 'light_floor',   desc: '角落里的柔和光源', unlockRequirement: { level: 2 } },
  { id: 'light_pendant',  name: '花式吊灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE,   cost: 480, icon: 'light_pendant', desc: '花朵造型的精美吊灯', unlockRequirement: { level: 5 } },
  { id: 'light_crystal',  name: '水晶吊灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE,   cost: 1150, icon: 'light_crystal', desc: '华丽的水晶折射光芒', unlockRequirement: { level: 11 } },

  // ═══════ ④ 摆件 / 装饰品 (ornament) ═══════
  { id: 'orn_pot',        name: '小花盆',      slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 70,  icon: 'orn_pot',       desc: '窗台上的小盆栽' },
  { id: 'orn_vase',       name: '花瓶',        slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 150, icon: 'orn_vase',      desc: '插一枝花就很美', unlockRequirement: { level: 2 } },
  { id: 'orn_fountain',   name: '迷你喷泉',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 540, icon: 'orn_fountain',  desc: '叮咚的流水声', unlockRequirement: { level: 6 } },
  { id: 'orn_candle',     name: '香薰蜡烛',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 600, icon: 'orn_candle',    desc: '淡淡的花香弥漫', unlockRequirement: { level: 7 } },
  { id: 'orn_clock',      name: '复古挂钟',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 660, icon: 'orn_clock',     desc: '滴答滴答的复古时光', unlockRequirement: { level: 8 } },
  { id: 'orn_fireplace',  name: '壁炉',        slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE,   cost: 1500, icon: 'orn_fireplace', desc: '温暖整个花店的壁炉', unlockRequirement: { level: 13 } },

  // ═══════ ⑤ 墙饰 / 挂件 (wallart) ═══════
  { id: 'wallart_plant',  name: '植物壁挂',    slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 70,  icon: 'wallart_plant',  desc: '墙上的一抹绿意' },
  { id: 'wallart_frame',  name: '装饰画框',    slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 210, icon: 'wallart_frame',  desc: '花语主题装饰画', unlockRequirement: { level: 3 } },
  { id: 'wallart_wreath', name: '花环壁饰',    slot: DecoSlot.WALLART, rarity: DecoRarity.FINE,   cost: 450, icon: 'wallart_wreath', desc: '干花与绿叶编织的花环', unlockRequirement: { level: 5 } },
  { id: 'wallart_relief', name: '艺术浮雕',    slot: DecoSlot.WALLART, rarity: DecoRarity.RARE,   cost: 1350, icon: 'wallart_relief', desc: '精致的花卉浮雕壁饰', unlockRequirement: { level: 12 } },

  // ═══════ ⑥ 庭院 / 户外 (garden) ═══════
  { id: 'garden_flowerbed', name: '小花圃',    slot: DecoSlot.GARDEN, rarity: DecoRarity.COMMON, cost: 95,  icon: 'garden_flowerbed', desc: '门前的一小片花圃' },
  { id: 'garden_arbor',    name: '藤蔓凉亭',   slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE,   cost: 750, icon: 'garden_arbor',    desc: '绿意盎然的休憩角', unlockRequirement: { level: 8 } },
  { id: 'garden_arch',     name: '玫瑰花廊',   slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE,   cost: 1500, icon: 'garden_arch',     desc: '浪漫的玫瑰拱廊', unlockRequirement: { level: 13 } },
  { id: 'garden_zen',      name: '日式枯山水', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 2400, icon: 'garden_zen',      desc: '禅意满满的庭院', unlockRequirement: { level: 18 } },

  // ═══════ 🌸 季节限定装饰 ═══════

  // 春 · 樱花季
  { id: 'season_spring_shelf', name: '樱花花架',  slot: DecoSlot.SHELF,    rarity: DecoRarity.LIMITED, cost: 1800, icon: 'shelf_spring',   desc: '春日限定，花架上落满樱花', season: 'spring', unlockRequirement: { level: 15 } },
  { id: 'season_spring_wall',  name: '樱花挂画',  slot: DecoSlot.WALLART,  rarity: DecoRarity.LIMITED, cost: 1500, icon: 'wallart_spring', desc: '一幅漫天樱花的油画', season: 'spring', unlockRequirement: { level: 14 } },
  // 夏 · 盛夏花园
  { id: 'season_summer_light',  name: '向日葵灯',  slot: DecoSlot.LIGHT,   rarity: DecoRarity.LIMITED, cost: 1650, icon: 'light_summer',   desc: '阳光灿烂的夏日灯具', season: 'summer', unlockRequirement: { level: 14 } },
  { id: 'season_summer_garden', name: '夏日喷泉',  slot: DecoSlot.GARDEN,  rarity: DecoRarity.LIMITED, cost: 2100, icon: 'garden_summer',  desc: '清凉的花园喷泉', season: 'summer', unlockRequirement: { level: 16 } },
  // 秋 · 金色丰收
  { id: 'season_autumn_orn',     name: '南瓜灯笼', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 1500, icon: 'orn_pumpkin',   desc: '秋收季节的温暖灯笼', season: 'autumn', unlockRequirement: { level: 14 } },
  { id: 'season_autumn_table',   name: '枫叶柜台', slot: DecoSlot.TABLE,    rarity: DecoRarity.LIMITED, cost: 1950, icon: 'table_autumn',  desc: '铺满红叶的柜台', season: 'autumn', unlockRequirement: { level: 15 } },
  // 冬 · 雪之物语
  { id: 'season_winter_wallart', name: '雪景挂画', slot: DecoSlot.WALLART,  rarity: DecoRarity.LIMITED, cost: 1500, icon: 'wallart_winter', desc: '窗外是漫天飞雪', season: 'winter', unlockRequirement: { level: 14 } },
  { id: 'season_winter_orn',     name: '圣诞壁炉', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 2250, icon: 'orn_christmas', desc: '壁炉上挂满了圣诞袜', season: 'winter', unlockRequirement: { level: 18 } },
];

// ======== 索引 & 工具函数 ========

/** 按 ID 查找装饰 */
export const DECO_MAP = new Map<string, DecoDef>(DECO_DEFS.map(d => [d.id, d]));

/** 获取某个槽位的所有装饰方案 */
export function getSlotDecos(slot: DecoSlot): DecoDef[] {
  return DECO_DEFS.filter(d => d.slot === slot);
}

/** 获取指定季节的限定装饰 */
export function getSeasonalDecos(season: string): DecoDef[] {
  return DECO_DEFS.filter(d => d.season === season);
}

/** 获取所有非季节限定的装饰 */
export function getNonSeasonalDecos(): DecoDef[] {
  return DECO_DEFS.filter(d => !d.season);
}
