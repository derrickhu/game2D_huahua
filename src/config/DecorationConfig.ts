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
  SHELF     = 'shelf',      // 花架 / 展示架（面板归「花房」）
  TABLE     = 'table',      // 桌台 / 工作台（面板归「花房」）
  LIGHT     = 'light',      // 家电位（灯/冰箱/电视等；面板显示「家电」）
  ORNAMENT  = 'ornament',   // 摆件 / 装饰品
  WALLART   = 'wallart',    // 墙饰 / 挂件
  GARDEN    = 'garden',     // 庭院 / 户外
}

/**
 * 花店房间内家具贴图归一化参考边长（设计坐标下「目标盒」最长边）。
 * 最终 scale = min(base/宽, base/高) * placement.scale；调大则同存档倍率下整体更大。
 */
export const SHOP_FURNITURE_TEX_BASE_PX = 130;

// ======== 稀有度 ========

export enum DecoRarity {
  COMMON  = 'common',   // 普通（白）
  FINE    = 'fine',     // 精良（绿）
  RARE    = 'rare',     // 稀有（蓝）
  LIMITED = 'limited',  // 限定（橙）
}

// ======== 数据结构 ========

import type { UnlockRequirement } from '@/utils/UnlockChecker';
import { SCENE_MAP, DEFAULT_SCENE_ID } from '@/config/StarLevelConfig';

/** 家具默认可用场景（与星级场景 id 一致，当前主玩法为花店） */
export const DECO_DEFAULT_SCENE_ID = DEFAULT_SCENE_ID;

export interface DecoDef {
  id: string;
  name: string;
  slot: DecoSlot;
  rarity: DecoRarity;
  /** 购买所需花愿（0 = 不扣花愿；基础款亦应标价，见各条目） */
  cost: number;
  /** 购买后获得的星星值（与花愿售价独立设定） */
  starValue: number;
  /** 纹理 key（对应 TextureCache 中的 key） */
  icon: string;
  /** 简短描述 */
  desc: string;
  /** 季节限定（可选）：spring / summer / autumn / winter */
  season?: string;
  /** 解锁前置条件（满足后才可购买） */
  unlockRequirement?: UnlockRequirement;
  /** 归属场景（用于多场景扩展，默认 flower_shop） */
  sceneId?: string;
  /** 首次放入房间的初始缩放（覆盖槽位默认值），由 GM 校准流程导出 */
  defaultScale?: number;
  /**
   * 装修面板独占 Tab：'furniture' 仅「家具」；'flower_room' 仅「花房」；'garden' 仅「庭院」（摆放槽位 slot 不变，且不再出现在其它按槽位分的 Tab）。
   */
  decorationPanelTab?: 'furniture' | 'flower_room' | 'garden';
  /**
   * 深度排序 Y 辅助（仅影响遮挡，不改坐标）：用于覆盖槽位默认的「台面小物」抬升。
   * 0 = 按地板大件处理；未设置时由 getDepthSortTypeLift() 按 slot/tab 推断。
   */
  depthSortYLift?: number;
  /**
   * 深度排序用脚点 Y 补偿（设计坐标 px，仅排序用）：台面小物脚点 y 常小于桌子，
   * floor(y) 会差一整档，aux 无法跨过 ROOM_DEPTH_Y_MULT；正数表示「排序时视为更靠近镜头」。
   */
  depthSortFeetYFudge?: number;
  /**
   * 装修面板分组：special 曾用于「特殊」Tab（已移除）；保留字段供数据兼容，新配置勿用。
   */
  uiCategory?: 'default' | 'special';
  /**
   * 允许购买与摆放的场景 id（与 CurrencyManager.state.sceneId 一致）。
   * 未设置且非 special：视为仅 DECO_DEFAULT_SCENE_ID（花店）。
   * special 必填，否则不可在任何场景使用。
   */
  allowedSceneIds?: string[];
}

/** 房间整体风格定义 */
export interface RoomStyleDef {
  id: string;
  name: string;
  /** 购买所需花愿（0 = 默认免费） */
  cost: number;
  /** 购买后获得的星星值 */
  starValue: number;
  rarity: DecoRarity;
  /** 背景纹理 key */
  bgTexture: string;
  desc: string;
  season?: string;
  /** 解锁前置条件（满足后才可购买） */
  unlockRequirement?: UnlockRequirement;
}

// ======== 槽位信息 ========

/** 槽位展示名（存档/逻辑仍用 DecoSlot；LIGHT 在面板中归「家电」Tab） */
export const DECO_SLOT_INFO: Record<DecoSlot, { name: string; emoji: string }> = {
  [DecoSlot.SHELF]:    { name: '花架',   emoji: '🌿' },
  [DecoSlot.TABLE]:    { name: '桌台',   emoji: '🪵' },
  [DecoSlot.LIGHT]:    { name: '家电',   emoji: '🔌' },
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
  { id: 'style_default', name: '温馨明亮花坊', cost: 0, starValue: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_default', desc: '左上柔光、粉瓦白墙与细密人字拼，贴近合成页明亮感（v2）' },
  { id: 'style_candy_nb2', name: '🍬 糖果花坊', cost: 850, starValue: 5, rarity: DecoRarity.FINE, bgTexture: 'bg_room_candy_nb2', desc: '多色糖果 pastel 硬装，壁纸感墙面与人字拼地板', unlockRequirement: { level: 3 } },
  { id: 'style_bloom_nb2', name: '🌷 花境小筑', cost: 1000, starValue: 6, rarity: DecoRarity.FINE, bgTexture: 'bg_room_bloom_nb2', desc: '窗台花箱与檐口垂花，多色 pastel 硬装', unlockRequirement: { level: 4 } },
  { id: 'style_pinkblue_nb2', name: '💗 粉蓝花坊', cost: 1200, starValue: 7, rarity: DecoRarity.FINE, bgTexture: 'bg_room_pinkblue_nb2', desc: '粉白蓝温馨风：短绒地毯、樱花形窗、新瓦型屋顶', unlockRequirement: { level: 5 } },
  { id: 'style_lagoon_nb2', name: '🍹 海岛汽水', cost: 1350, starValue: 8, rarity: DecoRarity.RARE, bgTexture: 'bg_room_lagoon_nb2', desc: '青绿天蓝木瓜橙撞色，清新热带感', unlockRequirement: { level: 6 } },
  { id: 'style_confetti_nb2', name: '🎉 彩屑木屋', cost: 1650, starValue: 10, rarity: DecoRarity.LIMITED, bgTexture: 'bg_room_confetti_nb2', desc: '拼色屋顶与几何墙饰，节日感不荧光', unlockRequirement: { level: 7 } },
];

export const ROOM_STYLE_MAP = new Map<string, RoomStyleDef>(
  ROOM_STYLES.map(s => [s.id, s])
);

// ======== 可摆放家具定义 ========
// icon 字段已切换为新素材 key（对应 images/furniture/ 目录下的扣底图）

export const DECO_DEFS: DecoDef[] = [

  // ═══════ ① 花架 / 展示架 (shelf) ═══════
  // 新手引导用：极低花愿 + 较高星星，便于首日升星
  { id: 'shelf_wood',    name: '简约木花架',  slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 1, starValue: 2, icon: 'shelf_wood',   desc: '三层原木架，朴素实用', defaultScale: 1.5 },
  { id: 'shelf_step',    name: '阶梯花架',    slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 150, starValue: 2, icon: 'shelf_step',   desc: '层层叠叠，像小山丘', unlockRequirement: { level: 2 }, defaultScale: 1.35 },
  { id: 'shelf_long',    name: '长条花台',    slot: DecoSlot.SHELF, rarity: DecoRarity.FINE,   cost: 360, starValue: 3, icon: 'shelf_long',   desc: '靠墙摆放的温馨花台', unlockRequirement: { level: 5 }, defaultScale: 1.25, decorationPanelTab: 'garden' },
  { id: 'shelf_iron',    name: '铁艺旋转架',  slot: DecoSlot.SHELF, rarity: DecoRarity.FINE,   cost: 600, starValue: 4, icon: 'shelf_iron',   desc: '优雅的法式铁艺风格', unlockRequirement: { level: 9 }, defaultScale: 1.5 },
  { id: 'shelf_glass',   name: '玻璃展示柜',  slot: DecoSlot.SHELF, rarity: DecoRarity.RARE,   cost: 1200, starValue: 8, icon: 'shelf_glass',  desc: '高端玻璃门展示柜', unlockRequirement: { level: 10 }, defaultScale: 1.45 },

  // ═══════ ② 桌台 / 工作台 (table) ═══════
  { id: 'table_counter',  name: '木质收银台',  slot: DecoSlot.TABLE, rarity: DecoRarity.COMMON, cost: 110, starValue: 1, icon: 'table_counter', desc: '温暖的原木收银台', defaultScale: 1.13 },
  { id: 'table_drawer',   name: '抽屉式柜台',  slot: DecoSlot.TABLE, rarity: DecoRarity.COMMON, cost: 240, starValue: 2, icon: 'table_drawer',  desc: '带抽屉的实用柜台', unlockRequirement: { level: 3 }, defaultScale: 1.23 },
  { id: 'table_work',     name: '花艺工作台',  slot: DecoSlot.TABLE, rarity: DecoRarity.FINE,   cost: 540, starValue: 4, icon: 'table_work',    desc: '专业的花艺操作台', unlockRequirement: { level: 6 }, defaultScale: 1.38 },
  { id: 'table_marble',   name: '大理石桌',    slot: DecoSlot.TABLE, rarity: DecoRarity.RARE,   cost: 1050, starValue: 7, icon: 'table_marble',  desc: '冷峻优雅的大理石面', unlockRequirement: { level: 9 }, defaultScale: 1.38, decorationPanelTab: 'furniture' },

  // ═══════ ③ 灯具 (light) ═══════
  { id: 'light_desk',     name: '台灯',        slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 85, starValue: 1,  icon: 'light_desk',    desc: '简约台灯，温暖光芒', unlockRequirement: { level: 2 }, defaultScale: 0.43 },
  { id: 'light_floor',    name: '落地灯',      slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 180, starValue: 2, icon: 'light_floor',   desc: '角落里的柔和光源', unlockRequirement: { level: 3 }, defaultScale: 1.25 },
  { id: 'light_pendant',  name: '花式吊灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE,   cost: 480, starValue: 3, icon: 'light_pendant', desc: '花朵造型的精美吊灯', unlockRequirement: { level: 6 }, defaultScale: 1.05 },
  { id: 'light_crystal',  name: '水晶吊灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE,   cost: 1150, starValue: 7, icon: 'light_crystal', desc: '华丽的水晶折射光芒', unlockRequirement: { level: 10 }, defaultScale: 1.1 },

  // ═══════ ④ 摆件 / 装饰品 (ornament) ═══════
  { id: 'orn_pot',        name: '小花盆',      slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 70, starValue: 1,  icon: 'orn_pot',       desc: '窗台上的小盆栽', unlockRequirement: { level: 2 }, defaultScale: 0.43 },
  { id: 'orn_vase',       name: '花瓶',        slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 150, starValue: 2, icon: 'orn_vase',      desc: '插一枝花就很美', unlockRequirement: { level: 4 }, defaultScale: 0.53 },
  { id: 'orn_fountain',   name: '迷你喷泉',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 540, starValue: 4, icon: 'orn_fountain',  desc: '叮咚的流水声', unlockRequirement: { level: 6 }, defaultScale: 1.2, decorationPanelTab: 'garden' },
  { id: 'orn_candle',     name: '香薰蜡烛',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 600, starValue: 4, icon: 'orn_candle',    desc: '淡淡的花香弥漫', unlockRequirement: { level: 7 }, defaultScale: 0.26 },
  { id: 'orn_clock',      name: '复古挂钟',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 660, starValue: 5, icon: 'orn_clock',     desc: '滴答滴答的复古时光', unlockRequirement: { level: 8 }, defaultScale: 0.55 },
  { id: 'orn_fireplace',  name: '壁炉',        slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE,   cost: 1500, starValue: 9, icon: 'orn_fireplace', desc: '温暖整个花店的壁炉', unlockRequirement: { level: 9 }, defaultScale: 1.35, decorationPanelTab: 'furniture' },

  // ═══════ ⑤ 墙饰 / 挂件 (wallart) ═══════
  { id: 'wallart_plant',  name: '植物壁挂',    slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 70, starValue: 1,  icon: 'wallart_plant',  desc: '墙上的一抹绿意', unlockRequirement: { level: 2 }, defaultScale: 0.93 },
  { id: 'wallart_frame',  name: '装饰画框',    slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 210, starValue: 2, icon: 'wallart_frame',  desc: '花语主题装饰画', unlockRequirement: { level: 3 }, defaultScale: 0.73 },
  { id: 'wallart_wreath', name: '花环壁饰',    slot: DecoSlot.WALLART, rarity: DecoRarity.FINE,   cost: 450, starValue: 3, icon: 'wallart_wreath', desc: '干花与绿叶编织的花环', unlockRequirement: { level: 6 }, defaultScale: 0.71 },
  { id: 'wallart_relief', name: '艺术浮雕',    slot: DecoSlot.WALLART, rarity: DecoRarity.RARE,   cost: 1350, starValue: 8, icon: 'wallart_relief', desc: '精致的花卉浮雕壁饰', unlockRequirement: { level: 10 }, defaultScale: 0.67 },

  // ═══════ ⑥ 庭院 / 户外 (garden) ═══════
  { id: 'garden_flowerbed', name: '小花圃',    slot: DecoSlot.GARDEN, rarity: DecoRarity.COMMON, cost: 95, starValue: 1,  icon: 'garden_flowerbed', desc: '门前的一小片花圃', defaultScale: 1.28 },
  { id: 'garden_arbor',    name: '藤蔓凉亭',   slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE,   cost: 750, starValue: 5, icon: 'garden_arbor',    desc: '绿意盎然的休憩角', unlockRequirement: { level: 5 }, defaultScale: 2 },
  { id: 'garden_arch',     name: '玫瑰花廊',   slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE,   cost: 1500, starValue: 9, icon: 'garden_arch',     desc: '浪漫的玫瑰拱廊', unlockRequirement: { level: 7 }, defaultScale: 1.83 },
  { id: 'garden_zen',      name: '日式枯山水', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 2400, starValue: 12, icon: 'garden_zen',      desc: '禅意满满的庭院', unlockRequirement: { level: 9 }, defaultScale: 1.63 },

  // ═══════ ⑦ 花店扩展家具（NB2 批次，画风与房间壳一致；缩放可后续 GM 校准）═══════
  { id: 'shelf_terracotta',   name: '陶盆阶梯花架', slot: DecoSlot.SHELF,    rarity: DecoRarity.FINE,   cost: 420,  starValue: 3, icon: 'shelf_terracotta',   desc: '粉陶盆叠成阶梯，小清新绿植', unlockRequirement: { level: 3 },  defaultScale: 0.68 },
  { id: 'table_wrap_station', name: '花艺包装台',   slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,   cost: 520,  starValue: 4, icon: 'table_wrap_station', desc: '牛皮纸与丝带，礼物包起来', unlockRequirement: { level: 7 },  defaultScale: 1.2 },
  { id: 'table_rattan_twoset', name: '藤编边桌凳组', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE,   cost: 990,  starValue: 6, icon: 'table_rattan_twoset', desc: '圆几配双凳，度假风下午茶', unlockRequirement: { level: 10 }, defaultScale: 0.83, decorationPanelTab: 'furniture' },
  { id: 'light_plant_strip',  name: '植物补光灯',   slot: DecoSlot.LIGHT,   rarity: DecoRarity.FINE,   cost: 450,  starValue: 3, icon: 'light_plant_strip',  desc: '阴天也给小花一点阳光', unlockRequirement: { level: 7 },  defaultScale: 0.57 },
  { id: 'orn_window_garden',  name: '窗台花园组',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 95,  starValue: 1, icon: 'orn_window_garden',  desc: '三盆小花排排站', unlockRequirement: { level: 2 }, defaultScale: 0.87 },
  { id: 'orn_awaken_bucket',  name: '金属醒花桶',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 115, starValue: 1, icon: 'orn_awaken_bucket',  desc: '深水养花，把花叫醒', unlockRequirement: { level: 4 }, defaultScale: 0.57, decorationPanelTab: 'flower_room' },
  { id: 'orn_floral_chest',   name: '花艺工具箱',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 130, starValue: 2, icon: 'orn_floral_chest',   desc: '剪刀麻绳小喷壶', unlockRequirement: { level: 5 }, defaultScale: 0.87, decorationPanelTab: 'flower_room' },
  { id: 'orn_pastel_bench',   name: '马卡龙长凳',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 490, starValue: 4, icon: 'orn_pastel_bench',   desc: '薄荷木色配珊瑚软垫', unlockRequirement: { level: 8 }, defaultScale: 1.1, decorationPanelTab: 'furniture' },
  { id: 'wallart_lace_curtain', name: '柔纱短帘', slot: DecoSlot.WALLART,  rarity: DecoRarity.FINE,   cost: 390, starValue: 3, icon: 'wallart_lace_curtain', desc: '蕾丝咖啡馆风情', unlockRequirement: { level: 7 }, defaultScale: 1.5 },
  { id: 'garden_wood_trough', name: '木质长花箱',   slot: DecoSlot.GARDEN,   rarity: DecoRarity.COMMON, cost: 125, starValue: 1, icon: 'garden_wood_trough', desc: '一长条春天开在门口', unlockRequirement: { level: 4 }, defaultScale: 0.97 },

  // ═══════ ⑧ 家具 / 家电扩展（NB2 批次：躺椅、桌凳、收音机风扇等）═══════
  { id: 'orn_lounge_chaise',    name: '布艺躺椅',     slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 560,  starValue: 4, icon: 'orn_lounge_chaise',    desc: '花店里偷个懒的贵妃榻', unlockRequirement: { level: 8 },  defaultScale: 0.93, decorationPanelTab: 'furniture' },
  { id: 'table_round_cafe',     name: '小圆桌',       slot: DecoSlot.TABLE,    rarity: DecoRarity.COMMON, cost: 195,  starValue: 2, icon: 'table_round_cafe',     desc: '一杯花茶刚好', unlockRequirement: { level: 5 },  defaultScale: 1.05,  decorationPanelTab: 'furniture' },
  { id: 'table_square_bistro',  name: '方桌',         slot: DecoSlot.TABLE,    rarity: DecoRarity.COMMON, cost: 265,  starValue: 2, icon: 'table_square_bistro',  desc: '方正好用的边角桌', unlockRequirement: { level: 3 },  defaultScale: 1,  decorationPanelTab: 'furniture' },
  { id: 'orn_wood_stools_pair', name: '原木双凳',     slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 175,  starValue: 1, icon: 'orn_wood_stools_pair', desc: '两把圆凳排排坐', unlockRequirement: { level: 4 },  defaultScale: 0.73, decorationPanelTab: 'furniture' },
  { id: 'orn_rocking_chair',    name: '摇椅',         slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 630,  starValue: 5, icon: 'orn_rocking_chair',    desc: '慢慢摇，闻花香', unlockRequirement: { level: 9 },  defaultScale: 0.98, decorationPanelTab: 'furniture' },
  { id: 'table_side_round',     name: '大理石小边几', slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,   cost: 395,  starValue: 3, icon: 'table_side_round',     desc: '放一盆小绿植刚好', unlockRequirement: { level: 8 },  defaultScale: 0.97, decorationPanelTab: 'furniture' },
  { id: 'light_radio_vintage',  name: '复古收音机',   slot: DecoSlot.LIGHT,   rarity: DecoRarity.FINE,   cost: 410,  starValue: 3, icon: 'light_radio_vintage',  desc: '店里轻声放老歌', unlockRequirement: { level: 8 },  defaultScale: 0.36 },
  { id: 'light_fan_desk',       name: '台式电风扇',   slot: DecoSlot.LIGHT,   rarity: DecoRarity.COMMON, cost: 155,  starValue: 2, icon: 'light_fan_desk',       desc: '夏天也清凉', unlockRequirement: { level: 4 },  defaultScale: 0.63 },
  { id: 'light_kettle_pastel',  name: '电热水壶',     slot: DecoSlot.LIGHT,   rarity: DecoRarity.COMMON, cost: 138,  starValue: 1, icon: 'light_kettle_pastel',  desc: '泡茶泡咖啡都靠它', unlockRequirement: { level: 5 },  defaultScale: 0.36 },
  { id: 'light_humidifier_cute', name: '桌面加湿器',  slot: DecoSlot.LIGHT,   rarity: DecoRarity.FINE,   cost: 355,  starValue: 3, icon: 'light_humidifier_cute', desc: '给小花加一点湿润', unlockRequirement: { level: 6 },  defaultScale: 0.36 },

  // ═══════ ⑨ 花房主题（贴图批次：软木板 / 园艺工具 / 地毯 / 衣帽架 / 花车 / 小黑板 / 小盆栽等；面板固定「花房」Tab）═══════
  { id: 'wallart_greenhouse_chalkboard', name: '花房落地小黑板', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 320, starValue: 3, icon: 'wallart_greenhouse_chalkboard', desc: '落地 A 字板，粉笔写着「花花」', unlockRequirement: { level: 5 }, defaultScale: 0.92, decorationPanelTab: 'flower_room' },
  { id: 'orn_greenhouse_cart', name: '花房软木留言板', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 398, starValue: 3, icon: 'orn_greenhouse_cart', desc: '浅木框软木板，钉着备忘与便签', unlockRequirement: { level: 1 }, defaultScale: 0.78, decorationPanelTab: 'flower_room' },
  { id: 'garden_flower_stall', name: '浇水壶与花铲', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 548, starValue: 4, icon: 'garden_flower_stall', desc: '浅蓝浇水壶配木柄小铲，打理花材用', unlockRequirement: { level: 6 }, defaultScale: 1.05, decorationPanelTab: 'flower_room' },
  { id: 'orn_greenhouse_rug', name: '粉色碎花地毯', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 92, starValue: 1, icon: 'orn_greenhouse_rug', desc: '粉地白花图案的小地垫', unlockRequirement: { level: 1 }, defaultScale: 0.42, decorationPanelTab: 'furniture' },
  { id: 'orn_greenhouse_coat_rack', name: '木轨衣帽挂钩', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 118, starValue: 1, icon: 'orn_greenhouse_coat_rack', desc: '墙上木轨挂钩，挂着风衣、小包与草帽', unlockRequirement: { level: 3 }, defaultScale: 0.4, decorationPanelTab: 'furniture' },
  { id: 'orn_greenhouse_flower_cart', name: '木轮鲜花推车', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 138, starValue: 2, icon: 'orn_greenhouse_flower_cart', desc: '装满蔷薇与郁金香的双轮木推车', unlockRequirement: { level: 3 }, defaultScale: 0.55, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_sprout', name: '芽苗小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 92, starValue: 1, icon: 'greenhouse_pot_sprout', desc: '陶盆里刚冒头的双叶小芽', unlockRequirement: { level: 1 }, defaultScale: 0.38, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_bud', name: '花苞小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 118, starValue: 1, icon: 'greenhouse_pot_bud', desc: '粉尖花苞快要开了', unlockRequirement: { level: 3 }, defaultScale: 0.38, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_daisy', name: '雏菊小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 138, starValue: 2, icon: 'greenhouse_pot_daisy', desc: '白瓣小黄心', unlockRequirement: { level: 3 }, defaultScale: 0.4, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_sunflower', name: '向日葵小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 135, starValue: 2, icon: 'greenhouse_pot_sunflower', desc: '一小束阳光', unlockRequirement: { level: 4 }, defaultScale: 0.42, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_carnation', name: '康乃馨小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 148, starValue: 2, icon: 'greenhouse_pot_carnation', desc: '温柔粉瓣', unlockRequirement: { level: 4 }, defaultScale: 0.4, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_rose', name: '玫瑰小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 220, starValue: 2, icon: 'greenhouse_pot_rose', desc: '一枝就够浪漫', unlockRequirement: { level: 5 }, defaultScale: 0.4, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_lily', name: '百合小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 245, starValue: 2, icon: 'greenhouse_pot_lily', desc: '清香白瓣', unlockRequirement: { level: 6 }, defaultScale: 0.42, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_hydrangea', name: '绣球小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 268, starValue: 3, icon: 'greenhouse_pot_hydrangea', desc: '团团蓝紫', unlockRequirement: { level: 6 }, defaultScale: 0.42, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_orchid', name: '蝴蝶兰小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 420, starValue: 4, icon: 'greenhouse_pot_orchid', desc: '兰科小公主', unlockRequirement: { level: 8 }, defaultScale: 0.44, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_peony_gold', name: '金牡丹小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 520, starValue: 5, icon: 'greenhouse_pot_peony_gold', desc: '富贵金灿灿', unlockRequirement: { level: 9 }, defaultScale: 0.44, decorationPanelTab: 'flower_room' },

  // ═══════ 🌸 季节限定装饰 ═══════

  // 春 · 樱花季
  { id: 'season_spring_shelf', name: '樱花花架',  slot: DecoSlot.SHELF,    rarity: DecoRarity.LIMITED, cost: 1800, starValue: 10, icon: 'shelf_spring',   desc: '春日限定，花架上落满樱花', season: 'spring', unlockRequirement: { level: 8 }, defaultScale: 1.85, decorationPanelTab: 'garden' },
  { id: 'season_spring_wall',  name: '樱花挂画',  slot: DecoSlot.WALLART,  rarity: DecoRarity.LIMITED, cost: 1500, starValue: 8, icon: 'wallart_spring', desc: '一幅漫天樱花的油画', season: 'spring', unlockRequirement: { level: 8 }, defaultScale: 0.71 },
  // 夏 · 盛夏花园
  { id: 'season_summer_light',  name: '向日葵灯',  slot: DecoSlot.LIGHT,   rarity: DecoRarity.LIMITED, cost: 1650, starValue: 9, icon: 'light_summer',   desc: '阳光灿烂的夏日灯具', season: 'summer', unlockRequirement: { level: 9 }, defaultScale: 0.53 },
  { id: 'season_summer_garden', name: '夏日喷泉',  slot: DecoSlot.GARDEN,  rarity: DecoRarity.LIMITED, cost: 2100, starValue: 11, icon: 'garden_summer',  desc: '清凉的花园喷泉', season: 'summer', unlockRequirement: { level: 9 }, defaultScale: 1.68 },
  // 秋 · 金色丰收
  { id: 'season_autumn_orn',     name: '南瓜灯笼', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 1500, starValue: 8, icon: 'orn_pumpkin',   desc: '秋收季节的温暖灯笼', season: 'autumn', unlockRequirement: { level: 9 }, defaultScale: 0.65 },
  { id: 'season_autumn_table',   name: '枫叶柜台', slot: DecoSlot.TABLE,    rarity: DecoRarity.LIMITED, cost: 1950, starValue: 10, icon: 'table_autumn',  desc: '铺满红叶的柜台', season: 'autumn', unlockRequirement: { level: 10 }, defaultScale: 1.48 },
  // 冬 · 雪之物语
  { id: 'season_winter_wallart', name: '雪景挂画', slot: DecoSlot.WALLART,  rarity: DecoRarity.LIMITED, cost: 1500, starValue: 8, icon: 'wallart_winter', desc: '窗外是漫天飞雪', season: 'winter', unlockRequirement: { level: 10 }, defaultScale: 0.84 },
  { id: 'season_winter_orn',     name: '圣诞壁炉', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 2250, starValue: 12, icon: 'orn_christmas', desc: '壁炉上挂满了圣诞袜', season: 'winter', unlockRequirement: { level: 10 }, defaultScale: 1.3, decorationPanelTab: 'furniture' },
];

// ======== 索引 & 工具函数 ========

/** 按 ID 查找装饰 */
export const DECO_MAP = new Map<string, DecoDef>(DECO_DEFS.map(d => [d.id, d]));

/**
 * 深度排序「台面小物」辅助量上限须与 RoomDepthSort 中 zLayer、stackTie 之和一起 &lt; ROOM_DEPTH_Y_MULT。
 * 具体 clamp 在 roomDepthZForPlacement 内完成。
 */
export const DEPTH_SORT_TYPE_LIFT_MAX = 520;

/**
 * 同 floor(y) 下让家电、小摆件略靠前，避免脚点 y 略小于桌子时被整张桌面挡住。
 * 大件（家具 Tab 的 ORNAMENT、桌架墙庭）为 0，仍按脚点 Y 排序。
 */
export function getDepthSortTypeLift(deco: DecoDef): number {
  if (typeof deco.depthSortYLift === 'number') {
    return Math.max(0, Math.min(DEPTH_SORT_TYPE_LIFT_MAX, deco.depthSortYLift));
  }
  /** 与 feetY fudge 叠加：略降一档，避免同 y 时过量压过其它物件 */
  if (deco.slot === DecoSlot.LIGHT) return 300;
  if (deco.slot === DecoSlot.ORNAMENT && deco.decorationPanelTab !== 'furniture' && deco.decorationPanelTab !== 'garden') {
    return 140;
  }
  return 0;
}

const FEET_FUDGE_MAX = 160;

/**
 * 台面电器、小摆件脚点 y 往往比桌子「更靠上」（数值更小），floor(y) 低一整档后
 * 整张桌面会盖住小物；aux 上限 &lt; 一条 y 台阶，置前也拉不回来。此处仅改排序用 y。
 */
export function getDepthSortFeetYFudge(deco: DecoDef): number {
  if (typeof deco.depthSortFeetYFudge === 'number') {
    return Math.max(0, Math.min(FEET_FUDGE_MAX, deco.depthSortFeetYFudge));
  }
  if (deco.slot === DecoSlot.WALLART || deco.slot === DecoSlot.GARDEN) return 0;
  if (deco.slot === DecoSlot.TABLE || deco.slot === DecoSlot.SHELF) return 0;

  if (deco.slot === DecoSlot.LIGHT) {
    const ds = deco.defaultScale ?? 1;
    if (ds < 0.72) return 110;
    if (ds < 0.98) return 28;
    return 0;
  }

  if (deco.slot === DecoSlot.ORNAMENT) {
    /** 长凳、双凳组等大件仍按脚点 y；略小的「家具 Tab」件仍可摆台面 */
    if (deco.decorationPanelTab === 'furniture' && (deco.defaultScale ?? 1) > 0.92) return 0;
    /** 地毯、矮地垫等小件贴地：勿抬高 sortFeetY，否则会整档压过同区域站立的店主 */
    if (deco.decorationPanelTab === 'furniture' && (deco.defaultScale ?? 1) < 0.58) return 0;
    return 95;
  }

  return 0;
}

// ═══════ 装修面板 / 托盘 Tab ═══════
// 花房：花架+桌台槽，或 decorationPanelTab==='flower_room'；仍受 isDecoAllowedInScene 过滤。
// 家具：decorationPanelTab==='furniture'。
// 庭院：庭院槽，或 decorationPanelTab==='garden'（如长条花台、樱花花架、迷你喷泉等）。

export type DecoPanelTabId =
  | 'room_styles'
  | 'flower_room'
  | 'furniture'
  | 'appliance'
  | DecoSlot.ORNAMENT
  | DecoSlot.WALLART
  | DecoSlot.GARDEN;

/** 左栏顺序 */
export const DECO_PANEL_TABS: DecoPanelTabId[] = [
  'room_styles',
  'flower_room',
  'furniture',
  'appliance',
  DecoSlot.ORNAMENT,
  DecoSlot.WALLART,
  DecoSlot.GARDEN,
];

export type FurnitureTrayTabId = Exclude<DecoPanelTabId, 'room_styles'>;

export const FURNITURE_TRAY_TABS: FurnitureTrayTabId[] = [
  'flower_room',
  'furniture',
  'appliance',
  DecoSlot.ORNAMENT,
  DecoSlot.WALLART,
  DecoSlot.GARDEN,
];

export function isDecoSpecialUiCategory(deco: DecoDef): boolean {
  return deco.uiCategory === 'special';
}

export function isDecoAllowedInScene(deco: DecoDef, sceneId: string): boolean {
  if (isDecoSpecialUiCategory(deco)) {
    const ids = deco.allowedSceneIds;
    if (!ids?.length) return false;
    return ids.includes(sceneId);
  }
  if (!deco.allowedSceneIds?.length) {
    return sceneId === DECO_DEFAULT_SCENE_ID;
  }
  return deco.allowedSceneIds.includes(sceneId);
}

/** 卡片/Toast 短文案 */
export function formatAllowedScenesShort(deco: DecoDef): string {
  const ids = deco.allowedSceneIds;
  if (!ids?.length) return '限定场景';
  const names = ids.map(id => SCENE_MAP.get(id)?.name ?? id);
  return `仅${names.join('、')}`;
}

export function getDecorationTabLabel(tab: DecoPanelTabId): { name: string; emoji: string } {
  if (tab === 'room_styles') return { name: '房间风格', emoji: '🏠' };
  if (tab === 'flower_room') return { name: '花房', emoji: '🌷' };
  if (tab === 'furniture') return { name: '家具', emoji: '🪑' };
  if (tab === 'appliance') return { name: '家电', emoji: '🔌' };
  return DECO_SLOT_INFO[tab];
}

/** 编辑托盘：由槽位推断 Tab（不含 decorationPanelTab 分流） */
export function furnitureTrayTabFromSlot(slot: DecoSlot): FurnitureTrayTabId {
  if (slot === DecoSlot.SHELF || slot === DecoSlot.TABLE) return 'flower_room';
  if (slot === DecoSlot.LIGHT) return 'appliance';
  if (slot === DecoSlot.ORNAMENT) return DecoSlot.ORNAMENT;
  if (slot === DecoSlot.WALLART) return DecoSlot.WALLART;
  return DecoSlot.GARDEN;
}

/** 编辑托盘：优先 decorationPanelTab（家具 / 花房 / 庭院），否则按槽位 */
export function furnitureTrayTabForDeco(deco: DecoDef): FurnitureTrayTabId {
  if (deco.decorationPanelTab === 'furniture') return 'furniture';
  if (deco.decorationPanelTab === 'flower_room') return 'flower_room';
  if (deco.decorationPanelTab === 'garden') return DecoSlot.GARDEN;
  return furnitureTrayTabFromSlot(deco.slot);
}

export function getDecosForDecorationPanelTab(tab: DecoPanelTabId, sceneId: string): DecoDef[] {
  if (tab === 'room_styles') return [];

  const inScene = (d: DecoDef) => !isDecoSpecialUiCategory(d) && isDecoAllowedInScene(d, sceneId);

  if (tab === 'furniture') {
    return DECO_DEFS.filter(d => d.decorationPanelTab === 'furniture' && inScene(d));
  }

  const slotMatch = (d: DecoDef): boolean => {
    if (tab === 'flower_room') {
      if (d.decorationPanelTab === 'flower_room') return true;
      if (d.decorationPanelTab === 'furniture' || d.decorationPanelTab === 'garden') return false;
      return d.slot === DecoSlot.SHELF || d.slot === DecoSlot.TABLE;
    }
    if (tab === 'appliance') {
      return d.slot === DecoSlot.LIGHT && d.decorationPanelTab !== 'furniture' && d.decorationPanelTab !== 'garden';
    }
    if (tab === DecoSlot.GARDEN) {
      if (d.decorationPanelTab === 'garden') return true;
      return d.slot === DecoSlot.GARDEN && d.decorationPanelTab !== 'furniture' && d.decorationPanelTab !== 'flower_room';
    }
    if (tab === DecoSlot.ORNAMENT || tab === DecoSlot.WALLART) {
      return (
        d.slot === tab &&
        d.decorationPanelTab !== 'furniture' &&
        d.decorationPanelTab !== 'flower_room' &&
        d.decorationPanelTab !== 'garden'
      );
    }
    return d.slot === tab;
  };

  return DECO_DEFS.filter(d => inScene(d) && slotMatch(d));
}

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
