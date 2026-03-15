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

export interface DecoDef {
  id: string;
  name: string;
  slot: DecoSlot;
  rarity: DecoRarity;
  /** 解锁所需花愿 */
  cost: number;
  /** 纹理 key（对应 TextureCache 中的 key） */
  icon: string;
  /** 简短描述 */
  desc: string;
  /** 季节限定（可选）：spring / summer / autumn / winter */
  season?: string;
}

/** 房间整体风格定义 */
export interface RoomStyleDef {
  id: string;
  name: string;
  /** 解锁所需花愿（0 = 默认免费） */
  cost: number;
  rarity: DecoRarity;
  /** 背景纹理 key */
  bgTexture: string;
  desc: string;
  season?: string;
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
  { id: 'style_default', name: '温馨原木风', cost: 0,   rarity: DecoRarity.COMMON, bgTexture: 'bg_room_default', desc: '暖色原木 + 浅绿墙面，花店标配' },
  { id: 'style_white',   name: '清新白调',   cost: 300, rarity: DecoRarity.FINE,   bgTexture: 'bg_room_white',   desc: '白墙白柜，北欧简约感' },
  { id: 'style_vintage', name: '复古花坊',   cost: 500, rarity: DecoRarity.RARE,   bgTexture: 'bg_room_vintage', desc: '深木色 + 怀旧砖墙，欧式老花店' },
  { id: 'style_spring',  name: '🌸 春日粉', cost: 600, rarity: DecoRarity.LIMITED, bgTexture: 'bg_room_spring',  desc: '粉色系墙面 + 樱花元素', season: 'spring' },
];

export const ROOM_STYLE_MAP = new Map<string, RoomStyleDef>(
  ROOM_STYLES.map(s => [s.id, s])
);

// ======== 可摆放家具定义 ========
// icon 字段已切换为新素材 key（对应 images/furniture/ 目录下的扣底图）

export const DECO_DEFS: DecoDef[] = [

  // ═══════ ① 花架 / 展示架 (shelf) ═══════
  { id: 'shelf_wood',    name: '简约木花架',  slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 0,   icon: 'shelf_wood',   desc: '三层原木架，朴素实用' },
  { id: 'shelf_step',    name: '阶梯花架',    slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 50,  icon: 'shelf_step',   desc: '层层叠叠，像小山丘' },
  { id: 'shelf_long',    name: '长条花台',    slot: DecoSlot.SHELF, rarity: DecoRarity.FINE,   cost: 120, icon: 'shelf_long',   desc: '靠墙摆放的温馨花台' },
  { id: 'shelf_iron',    name: '铁艺旋转架',  slot: DecoSlot.SHELF, rarity: DecoRarity.FINE,   cost: 200, icon: 'shelf_iron',   desc: '优雅的法式铁艺风格' },
  { id: 'shelf_glass',   name: '玻璃展示柜',  slot: DecoSlot.SHELF, rarity: DecoRarity.RARE,   cost: 400, icon: 'shelf_glass',  desc: '高端玻璃门展示柜' },

  // ═══════ ② 桌台 / 工作台 (table) ═══════
  { id: 'table_counter',  name: '木质收银台',  slot: DecoSlot.TABLE, rarity: DecoRarity.COMMON, cost: 0,   icon: 'table_counter', desc: '温暖的原木收银台' },
  { id: 'table_drawer',   name: '抽屉式柜台',  slot: DecoSlot.TABLE, rarity: DecoRarity.COMMON, cost: 80,  icon: 'table_drawer',  desc: '带抽屉的实用柜台' },
  { id: 'table_work',     name: '花艺工作台',  slot: DecoSlot.TABLE, rarity: DecoRarity.FINE,   cost: 180, icon: 'table_work',    desc: '专业的花艺操作台' },
  { id: 'table_marble',   name: '大理石桌',    slot: DecoSlot.TABLE, rarity: DecoRarity.RARE,   cost: 350, icon: 'table_marble',  desc: '冷峻优雅的大理石面' },

  // ═══════ ③ 灯具 (light) ═══════
  { id: 'light_desk',     name: '台灯',        slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 0,   icon: 'light_desk',    desc: '简约台灯，温暖光芒' },
  { id: 'light_floor',    name: '落地灯',      slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 60,  icon: 'light_floor',   desc: '角落里的柔和光源' },
  { id: 'light_pendant',  name: '花式吊灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE,   cost: 160, icon: 'light_pendant', desc: '花朵造型的精美吊灯' },
  { id: 'light_crystal',  name: '水晶吊灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE,   cost: 380, icon: 'light_crystal', desc: '华丽的水晶折射光芒' },

  // ═══════ ④ 摆件 / 装饰品 (ornament) ═══════
  { id: 'orn_pot',        name: '小花盆',      slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 0,   icon: 'orn_pot',       desc: '窗台上的小盆栽' },
  { id: 'orn_vase',       name: '花瓶',        slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 50,  icon: 'orn_vase',      desc: '插一枝花就很美' },
  { id: 'orn_fountain',   name: '迷你喷泉',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 180, icon: 'orn_fountain',  desc: '叮咚的流水声' },
  { id: 'orn_candle',     name: '香薰蜡烛',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 200, icon: 'orn_candle',    desc: '淡淡的花香弥漫' },
  { id: 'orn_clock',      name: '复古挂钟',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 220, icon: 'orn_clock',     desc: '滴答滴答的复古时光' },
  { id: 'orn_fireplace',  name: '壁炉',        slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE,   cost: 500, icon: 'orn_fireplace', desc: '温暖整个花店的壁炉' },

  // ═══════ ⑤ 墙饰 / 挂件 (wallart) ═══════
  { id: 'wallart_plant',  name: '植物壁挂',    slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 0,   icon: 'wallart_plant',  desc: '墙上的一抹绿意' },
  { id: 'wallart_frame',  name: '装饰画框',    slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 70,  icon: 'wallart_frame',  desc: '花语主题装饰画' },
  { id: 'wallart_wreath', name: '花环壁饰',    slot: DecoSlot.WALLART, rarity: DecoRarity.FINE,   cost: 150, icon: 'wallart_wreath', desc: '干花与绿叶编织的花环' },
  { id: 'wallart_relief', name: '艺术浮雕',    slot: DecoSlot.WALLART, rarity: DecoRarity.RARE,   cost: 450, icon: 'wallart_relief', desc: '精致的花卉浮雕壁饰' },

  // ═══════ ⑥ 庭院 / 户外 (garden) ═══════
  { id: 'garden_flowerbed', name: '小花圃',    slot: DecoSlot.GARDEN, rarity: DecoRarity.COMMON, cost: 0,   icon: 'garden_flowerbed', desc: '门前的一小片花圃' },
  { id: 'garden_arbor',    name: '藤蔓凉亭',   slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE,   cost: 250, icon: 'garden_arbor',    desc: '绿意盎然的休憩角' },
  { id: 'garden_arch',     name: '玫瑰花廊',   slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE,   cost: 500, icon: 'garden_arch',     desc: '浪漫的玫瑰拱廊' },
  { id: 'garden_zen',      name: '日式枯山水', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 800, icon: 'garden_zen',      desc: '禅意满满的庭院' },

  // ═══════ 🌸 季节限定装饰 ═══════

  // 春 · 樱花季
  { id: 'season_spring_shelf', name: '樱花花架',  slot: DecoSlot.SHELF,    rarity: DecoRarity.LIMITED, cost: 600, icon: 'shelf_spring',   desc: '春日限定，花架上落满樱花', season: 'spring' },
  { id: 'season_spring_wall',  name: '樱花挂画',  slot: DecoSlot.WALLART,  rarity: DecoRarity.LIMITED, cost: 500, icon: 'wallart_spring', desc: '一幅漫天樱花的油画', season: 'spring' },
  // 夏 · 盛夏花园
  { id: 'season_summer_light',  name: '向日葵灯',  slot: DecoSlot.LIGHT,   rarity: DecoRarity.LIMITED, cost: 550, icon: 'light_summer',   desc: '阳光灿烂的夏日灯具', season: 'summer' },
  { id: 'season_summer_garden', name: '夏日喷泉',  slot: DecoSlot.GARDEN,  rarity: DecoRarity.LIMITED, cost: 700, icon: 'garden_summer',  desc: '清凉的花园喷泉', season: 'summer' },
  // 秋 · 金色丰收
  { id: 'season_autumn_orn',     name: '南瓜灯笼', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 500, icon: 'orn_pumpkin',   desc: '秋收季节的温暖灯笼', season: 'autumn' },
  { id: 'season_autumn_table',   name: '枫叶柜台', slot: DecoSlot.TABLE,    rarity: DecoRarity.LIMITED, cost: 650, icon: 'table_autumn',  desc: '铺满红叶的柜台', season: 'autumn' },
  // 冬 · 雪之物语
  { id: 'season_winter_wallart', name: '雪景挂画', slot: DecoSlot.WALLART,  rarity: DecoRarity.LIMITED, cost: 500, icon: 'wallart_winter', desc: '窗外是漫天飞雪', season: 'winter' },
  { id: 'season_winter_orn',     name: '圣诞壁炉', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 750, icon: 'orn_christmas', desc: '壁炉上挂满了圣诞袜', season: 'winter' },
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
