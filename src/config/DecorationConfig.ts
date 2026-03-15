/**
 * 花店装修配置
 * 10 个装修槽位 × 多种装饰方案 = 丰富的个性化空间
 *
 * 装饰来源：
 * - room_01~36:  基础家具（花架/柜台/灯具等）
 * - room2_01~36: 高级家具（梳妆台/壁炉/高级柜台等）
 */

export enum DecoSlot {
  SIGNBOARD = 'signboard',   // 招牌
  DOOR = 'door',             // 门面
  COUNTER = 'counter',       // 柜台
  WALL = 'wall',             // 墙面装饰
  FLOOR = 'floor',           // 地板
  LIGHT = 'light',           // 灯具
  SHELF = 'shelf',           // 花架
  WINDOW = 'window',         // 窗户
  ORNAMENT = 'ornament',     // 摆件
  GARDEN = 'garden',         // 庭院
}

export enum DecoRarity {
  COMMON = 'common',       // 普通
  FINE = 'fine',           // 精良
  RARE = 'rare',           // 稀有
  LIMITED = 'limited',     // 限定
}

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
}

/** 槽位信息 */
export const DECO_SLOT_INFO: Record<DecoSlot, { name: string; emoji: string }> = {
  [DecoSlot.SIGNBOARD]: { name: '招牌', emoji: '🪧' },
  [DecoSlot.DOOR]: { name: '门面', emoji: '🚪' },
  [DecoSlot.COUNTER]: { name: '柜台', emoji: '🪵' },
  [DecoSlot.WALL]: { name: '墙面', emoji: '🖼️' },
  [DecoSlot.FLOOR]: { name: '地板', emoji: '🟫' },
  [DecoSlot.LIGHT]: { name: '灯具', emoji: '💡' },
  [DecoSlot.SHELF]: { name: '花架', emoji: '🌿' },
  [DecoSlot.WINDOW]: { name: '窗户', emoji: '🪟' },
  [DecoSlot.ORNAMENT]: { name: '摆件', emoji: '🏺' },
  [DecoSlot.GARDEN]: { name: '庭院', emoji: '🌳' },
};

/** 稀有度信息 */
export const DECO_RARITY_INFO: Record<DecoRarity, { name: string; color: number }> = {
  [DecoRarity.COMMON]: { name: '普通', color: 0x999999 },
  [DecoRarity.FINE]: { name: '精良', color: 0x4CAF50 },
  [DecoRarity.RARE]: { name: '稀有', color: 0x2196F3 },
  [DecoRarity.LIMITED]: { name: '限定', color: 0xFF9800 },
};

/**
 * 所有装饰定义
 * 使用 room_01~36 和 room2_01~36 的实际家具素材
 */
export const DECO_DEFS: DecoDef[] = [
  // ======== 花架 (shelf) — 展示花朵的核心家具 ========
  { id: 'shelf_01', name: '简约木花架', slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 0, icon: 'room_01', desc: '朴素但实用的三层木架' },
  { id: 'shelf_02', name: '阶梯花架', slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 50, icon: 'room_05', desc: '层层叠叠，像小山丘' },
  { id: 'shelf_03', name: '长条花台', slot: DecoSlot.SHELF, rarity: DecoRarity.FINE, cost: 120, icon: 'room_10', desc: '摆满多肉的温馨花台' },
  { id: 'shelf_04', name: '铁艺旋转架', slot: DecoSlot.SHELF, rarity: DecoRarity.FINE, cost: 200, icon: 'room_17', desc: '优雅的法式铁艺风格' },
  { id: 'shelf_05', name: '豪华展示柜', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 400, icon: 'room2_05', desc: '玻璃门展示柜，高端大气' },

  // ======== 柜台 (counter) ========
  { id: 'counter_01', name: '木质小柜台', slot: DecoSlot.COUNTER, rarity: DecoRarity.COMMON, cost: 0, icon: 'room_03', desc: '温暖的木质收银台' },
  { id: 'counter_02', name: '抽屉式柜台', slot: DecoSlot.COUNTER, rarity: DecoRarity.COMMON, cost: 80, icon: 'room_04', desc: '带抽屉的实用柜台' },
  { id: 'counter_03', name: '精致花艺台', slot: DecoSlot.COUNTER, rarity: DecoRarity.FINE, cost: 180, icon: 'room_08', desc: '专业的花艺工作台' },
  { id: 'counter_04', name: '大理石柜台', slot: DecoSlot.COUNTER, rarity: DecoRarity.RARE, cost: 350, icon: 'room2_03', desc: '冷峻优雅的大理石面' },
  { id: 'counter_05', name: '古典梳妆台', slot: DecoSlot.COUNTER, rarity: DecoRarity.RARE, cost: 500, icon: 'room2_01', desc: '带镜子的精美梳妆台' },

  // ======== 灯具 (light) ========
  { id: 'light_01', name: '台灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 0, icon: 'room_20', desc: '简约台灯，温暖光芒' },
  { id: 'light_02', name: '落地灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 60, icon: 'room_21', desc: '角落里的柔和光源' },
  { id: 'light_03', name: '花式吊灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE, cost: 160, icon: 'room_22', desc: '花朵造型的精美吊灯' },
  { id: 'light_04', name: '水晶吊灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 380, icon: 'room2_22', desc: '华丽的水晶折射光芒' },

  // ======== 墙面 (wall) ========
  { id: 'wall_01', name: '植物壁挂', slot: DecoSlot.WALL, rarity: DecoRarity.COMMON, cost: 0, icon: 'room_15', desc: '墙上的一抹绿意' },
  { id: 'wall_02', name: '装饰画框', slot: DecoSlot.WALL, rarity: DecoRarity.COMMON, cost: 70, icon: 'room_16', desc: '花语主题装饰画' },
  { id: 'wall_03', name: '花环壁饰', slot: DecoSlot.WALL, rarity: DecoRarity.FINE, cost: 150, icon: 'room_26', desc: '干花与绿叶编织的花环' },
  { id: 'wall_04', name: '复古挂钟', slot: DecoSlot.WALL, rarity: DecoRarity.FINE, cost: 220, icon: 'room2_16', desc: '滴答滴答的复古时光' },
  { id: 'wall_05', name: '艺术浮雕', slot: DecoSlot.WALL, rarity: DecoRarity.RARE, cost: 450, icon: 'room2_26', desc: '精致的花卉浮雕壁饰' },

  // ======== 摆件 (ornament) ========
  { id: 'orn_01', name: '小花盆', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 0, icon: 'room_07', desc: '窗台上的小盆栽' },
  { id: 'orn_02', name: '花瓶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 50, icon: 'room_09', desc: '插一枝花就很美' },
  { id: 'orn_03', name: '迷你喷泉', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 180, icon: 'room_28', desc: '叮咚的流水声' },
  { id: 'orn_04', name: '香薰蜡烛', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 200, icon: 'room_30', desc: '淡淡的花香弥漫' },
  { id: 'orn_05', name: '壁炉', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 500, icon: 'room2_10', desc: '温暖整个花店的壁炉' },

  // ======== 招牌 (signboard) ========
  { id: 'sign_01', name: '手写木牌', slot: DecoSlot.SIGNBOARD, rarity: DecoRarity.COMMON, cost: 0, icon: 'room_11', desc: '亲手写下花店名字' },
  { id: 'sign_02', name: '铁艺招牌', slot: DecoSlot.SIGNBOARD, rarity: DecoRarity.FINE, cost: 150, icon: 'room_12', desc: '优雅的铁艺书写' },
  { id: 'sign_03', name: '霓虹灯牌', slot: DecoSlot.SIGNBOARD, rarity: DecoRarity.RARE, cost: 350, icon: 'room2_11', desc: '夜晚最亮的那盏灯' },

  // ======== 门面 (door) ========
  { id: 'door_01', name: '木质门框', slot: DecoSlot.DOOR, rarity: DecoRarity.COMMON, cost: 0, icon: 'room_13', desc: '质朴的原木门框' },
  { id: 'door_02', name: '拱形花门', slot: DecoSlot.DOOR, rarity: DecoRarity.FINE, cost: 200, icon: 'room_14', desc: '藤蔓缠绕的拱门' },
  { id: 'door_03', name: '彩绘玻璃门', slot: DecoSlot.DOOR, rarity: DecoRarity.RARE, cost: 400, icon: 'room2_13', desc: '阳光透过彩绘玻璃' },

  // ======== 窗户 (window) ========
  { id: 'window_01', name: '百叶窗', slot: DecoSlot.WINDOW, rarity: DecoRarity.COMMON, cost: 0, icon: 'room_23', desc: '调节光线的好帮手' },
  { id: 'window_02', name: '花窗帘', slot: DecoSlot.WINDOW, rarity: DecoRarity.FINE, cost: 120, icon: 'room_24', desc: '印着碎花的窗帘' },
  { id: 'window_03', name: '落地飘窗', slot: DecoSlot.WINDOW, rarity: DecoRarity.RARE, cost: 380, icon: 'room2_23', desc: '坐在飘窗上看花开' },

  // ======== 地板 (floor) ========
  { id: 'floor_01', name: '原木地板', slot: DecoSlot.FLOOR, rarity: DecoRarity.COMMON, cost: 0, icon: 'room_33', desc: '温暖的原木纹理' },
  { id: 'floor_02', name: '花砖地板', slot: DecoSlot.FLOOR, rarity: DecoRarity.FINE, cost: 150, icon: 'room_34', desc: '复古的花砖拼接' },
  { id: 'floor_03', name: '大理石地板', slot: DecoSlot.FLOOR, rarity: DecoRarity.RARE, cost: 400, icon: 'room2_33', desc: '冷峻中带着高贵' },

  // ======== 庭院 (garden) ========
  { id: 'garden_01', name: '小花圃', slot: DecoSlot.GARDEN, rarity: DecoRarity.COMMON, cost: 0, icon: 'room_35', desc: '门前的一小片花圃' },
  { id: 'garden_02', name: '藤蔓凉亭', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 250, icon: 'room_36', desc: '绿意盎然的休憩角' },
  { id: 'garden_03', name: '玫瑰花廊', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 500, icon: 'room2_35', desc: '浪漫的玫瑰拱廊' },
  { id: 'garden_04', name: '日式枯山水', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 800, icon: 'room2_36', desc: '禅意满满的庭院' },
];

/** 按 ID 查找装饰 */
export const DECO_MAP = new Map<string, DecoDef>(DECO_DEFS.map(d => [d.id, d]));

/** 获取某个槽位的所有装饰方案 */
export function getSlotDecos(slot: DecoSlot): DecoDef[] {
  return DECO_DEFS.filter(d => d.slot === slot);
}
