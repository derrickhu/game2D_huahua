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
// 付费风格花愿：在旧价基础上 ×1.06，取整到 5（与家具分档调价分开，避免过猛）。

export const ROOM_STYLES: RoomStyleDef[] = [
  { id: 'style_default', name: '温馨明亮花坊', cost: 0, starValue: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_default', desc: '左上柔光、粉瓦白墙与细密人字拼，贴近合成页明亮感（v2）' },
  { id: 'style_candy_nb2', name: '🍬 糖果花坊', cost: 500, starValue: 5, rarity: DecoRarity.FINE, bgTexture: 'bg_room_candy_nb2', desc: '糖果 pastel 硬装；室内宽条/大色块地坪，区别于细碎人字拼', unlockRequirement: { level: 3 } },
  { id: 'style_bloom_nb2', name: '🌷 花境小筑', cost: 1060, starValue: 6, rarity: DecoRarity.FINE, bgTexture: 'bg_room_bloom_nb2', desc: '满开鲜花硬装与窗景，室内纯色大块地坪，温馨不撞糖果系', unlockRequirement: { level: 4 } },
  { id: 'style_pinkblue_nb2', name: '💗 粉蓝花坊', cost: 1270, starValue: 7, rarity: DecoRarity.FINE, bgTexture: 'bg_room_pinkblue_nb2', desc: '粉白蓝温馨风：短绒地毯、樱花形窗、新瓦型屋顶', unlockRequirement: { level: 5 } },
  { id: 'style_lagoon_nb2', name: '🍹 海岛汽水', cost: 1430, starValue: 8, rarity: DecoRarity.RARE, bgTexture: 'bg_room_lagoon_nb2', desc: '青绿天蓝木瓜橙撞色，清新热带感', unlockRequirement: { level: 6 } },
  { id: 'style_confetti_nb2', name: '🕰️ 复古花坊', cost: 1750, starValue: 10, rarity: DecoRarity.LIMITED, bgTexture: 'bg_room_confetti_nb2', desc: '明亮复古花店：奶黄墙、豆沙绿与浅橡木，大格地面不暗沉', unlockRequirement: { level: 7 } },
];

export const ROOM_STYLE_MAP = new Map<string, RoomStyleDef>(
  ROOM_STYLES.map(s => [s.id, s])
);

// ======== 可摆放家具定义 ========
// icon 字段已切换为新素材 key（对应 images/furniture/ 目录下的扣底图）
// 花愿 cost：无玩家等级门槛 ×1.32；unlock level 2–4 再 ×1.15；level ≥5 再 ×1.06；取整到 5。付费房间风格见 ROOM_STYLES 另 ×1.06。starValue 1/2 档家具在基准上再约 ×1.1 取整到 5（与 StarLevelConfig 早期升星门槛微调配套）。

export const DECO_DEFS: DecoDef[] = [

  // ═══════ ① 花架 / 展示架 (shelf) ═══════
  // 入门花架：低价带仍便于首周入手，但整体高于旧版（约多攒数单）
  { id: 'shelf_wood',    name: '简约木花架',  slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 5, starValue: 2, icon: 'shelf_wood',   desc: '三层原木架，朴素实用', defaultScale: 1.5 },
  { id: 'shelf_step',    name: '阶梯花架',    slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 255, starValue: 2, icon: 'shelf_step',   desc: '层层叠叠，像小山丘', unlockRequirement: { level: 2 }, defaultScale: 1.35 },
  { id: 'shelf_long',    name: '长条花台',    slot: DecoSlot.SHELF, rarity: DecoRarity.FINE,   cost: 580, starValue: 3, icon: 'shelf_long',   desc: '靠墙摆放的温馨花台', unlockRequirement: { level: 5 }, defaultScale: 1.25, decorationPanelTab: 'garden' },
  { id: 'shelf_iron',    name: '铁艺旋转架',  slot: DecoSlot.SHELF, rarity: DecoRarity.FINE,   cost: 965, starValue: 4, icon: 'shelf_iron',   desc: '优雅的法式铁艺风格', unlockRequirement: { level: 9 }, defaultScale: 1.5 },
  { id: 'shelf_glass',   name: '玻璃展示柜',  slot: DecoSlot.SHELF, rarity: DecoRarity.RARE,   cost: 1930, starValue: 8, icon: 'shelf_glass',  desc: '高端玻璃门展示柜', unlockRequirement: { level: 10 }, defaultScale: 1.45 },

  // ═══════ ② 桌台 / 工作台 (table) ═══════
  { id: 'table_counter',  name: '木质收银台',  slot: DecoSlot.TABLE, rarity: DecoRarity.COMMON, cost: 240, starValue: 1, icon: 'table_counter', desc: '温暖的原木收银台', defaultScale: 1.13 },
  { id: 'table_drawer',   name: '抽屉式柜台',  slot: DecoSlot.TABLE, rarity: DecoRarity.COMMON, cost: 400, starValue: 2, icon: 'table_drawer',  desc: '带抽屉的实用柜台', unlockRequirement: { level: 3 }, defaultScale: 1.23 },
  { id: 'table_work',     name: '花艺工作台',  slot: DecoSlot.TABLE, rarity: DecoRarity.FINE,   cost: 870, starValue: 4, icon: 'table_work',    desc: '专业的花艺操作台', unlockRequirement: { level: 6 }, defaultScale: 1.38 },
  { id: 'table_marble',   name: '大理石桌',    slot: DecoSlot.TABLE, rarity: DecoRarity.RARE,   cost: 1690, starValue: 7, icon: 'table_marble',  desc: '冷峻优雅的大理石面', unlockRequirement: { level: 9 }, defaultScale: 1.38, decorationPanelTab: 'furniture' },

  // ═══════ ③ 灯具 (light) ═══════
  { id: 'light_desk',     name: '台灯',        slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 195, starValue: 1,  icon: 'light_desk',    desc: '简约台灯，温暖光芒', unlockRequirement: { level: 2 }, defaultScale: 0.43 },
  { id: 'light_floor',    name: '落地灯',      slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 300, starValue: 2, icon: 'light_floor',   desc: '角落里的柔和光源', unlockRequirement: { level: 3 }, defaultScale: 1.25 },
  { id: 'light_pendant',  name: '花式吊灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE,   cost: 770, starValue: 3, icon: 'light_pendant', desc: '花朵造型的精美吊灯', unlockRequirement: { level: 6 }, defaultScale: 1.05 },
  { id: 'light_crystal',  name: '水晶吊灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE,   cost: 1850, starValue: 7, icon: 'light_crystal', desc: '华丽的水晶折射光芒', unlockRequirement: { level: 10 }, defaultScale: 1.1 },

  // ═══════ ④ 摆件 / 装饰品 (ornament) ═══════
  { id: 'orn_pot',        name: '小花盆',      slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 165, starValue: 1,  icon: 'orn_pot',       desc: '窗台上的小盆栽', unlockRequirement: { level: 2 }, defaultScale: 0.43 },
  { id: 'orn_vase',       name: '花瓶',        slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 255, starValue: 2, icon: 'orn_vase',      desc: '插一枝花就很美', unlockRequirement: { level: 4 }, defaultScale: 0.53 },
  { id: 'orn_fountain',   name: '迷你喷泉',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 870, starValue: 4, icon: 'orn_fountain',  desc: '叮咚的流水声', unlockRequirement: { level: 6 }, defaultScale: 1.2, decorationPanelTab: 'garden' },
  { id: 'orn_candle',     name: '香薰蜡烛',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 965, starValue: 4, icon: 'orn_candle',    desc: '淡淡的花香弥漫', unlockRequirement: { level: 7 }, defaultScale: 0.26 },
  { id: 'orn_clock',      name: '复古挂钟',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 1060, starValue: 5, icon: 'orn_clock',     desc: '滴答滴答的复古时光', unlockRequirement: { level: 8 }, defaultScale: 0.55 },
  { id: 'orn_fireplace',  name: '壁炉',        slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE,   cost: 2415, starValue: 9, icon: 'orn_fireplace', desc: '温暖整个花店的壁炉', unlockRequirement: { level: 9 }, defaultScale: 1.35, decorationPanelTab: 'furniture' },

  // ═══════ ⑤ 墙饰 / 挂件 (wallart) ═══════
  { id: 'wallart_plant',  name: '植物壁挂',    slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 165, starValue: 1,  icon: 'wallart_plant',  desc: '墙上的一抹绿意', unlockRequirement: { level: 2 }, defaultScale: 0.93 },
  { id: 'wallart_frame',  name: '装饰画框',    slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 350, starValue: 2, icon: 'wallart_frame',  desc: '花语主题装饰画', unlockRequirement: { level: 3 }, defaultScale: 0.73 },
  { id: 'wallart_wreath', name: '花环壁饰',    slot: DecoSlot.WALLART, rarity: DecoRarity.FINE,   cost: 725, starValue: 3, icon: 'wallart_wreath', desc: '干花与绿叶编织的花环', unlockRequirement: { level: 6 }, defaultScale: 0.71 },
  { id: 'wallart_relief', name: '艺术浮雕',    slot: DecoSlot.WALLART, rarity: DecoRarity.RARE,   cost: 2170, starValue: 8, icon: 'wallart_relief', desc: '精致的花卉浮雕壁饰', unlockRequirement: { level: 10 }, defaultScale: 0.67 },

  // ═══════ ⑥ 庭院 / 户外 (garden) ═══════
  { id: 'garden_flowerbed', name: '小花圃',    slot: DecoSlot.GARDEN, rarity: DecoRarity.COMMON, cost: 200, starValue: 1,  icon: 'garden_flowerbed', desc: '门前的一小片花圃', defaultScale: 1.28 },
  { id: 'garden_arbor',    name: '藤蔓凉亭',   slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE,   cost: 1205, starValue: 5, icon: 'garden_arbor',    desc: '绿意盎然的休憩角', unlockRequirement: { level: 5 }, defaultScale: 2 },
  { id: 'garden_arch',     name: '玫瑰花廊',   slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE,   cost: 2415, starValue: 9, icon: 'garden_arch',     desc: '浪漫的玫瑰拱廊', unlockRequirement: { level: 7 }, defaultScale: 1.83 },
  { id: 'garden_zen',      name: '日式枯山水', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 3860, starValue: 12, icon: 'garden_zen',      desc: '禅意满满的庭院', unlockRequirement: { level: 9 }, defaultScale: 1.63 },

  // ═══════ ⑦ 花店扩展家具（NB2 批次，画风与房间壳一致；缩放可后续 GM 校准）═══════
  { id: 'shelf_terracotta',   name: '陶盆阶梯花架', slot: DecoSlot.SHELF,    rarity: DecoRarity.FINE,   cost: 640,  starValue: 3, icon: 'shelf_terracotta',   desc: '粉陶盆叠成阶梯，小清新绿植', unlockRequirement: { level: 3 },  defaultScale: 0.68 },
  { id: 'table_wrap_station', name: '花艺包装台',   slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,   cost: 835,  starValue: 4, icon: 'table_wrap_station', desc: '牛皮纸与丝带，礼物包起来', unlockRequirement: { level: 7 },  defaultScale: 1.2 },
  { id: 'table_rattan_twoset', name: '藤编边桌凳组', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE,   cost: 1595,  starValue: 6, icon: 'table_rattan_twoset', desc: '圆几配双凳，度假风下午茶', unlockRequirement: { level: 10 }, defaultScale: 0.83, decorationPanelTab: 'furniture' },
  { id: 'light_plant_strip',  name: '植物补光灯',   slot: DecoSlot.LIGHT,   rarity: DecoRarity.FINE,   cost: 725,  starValue: 3, icon: 'light_plant_strip',  desc: '阴天也给小花一点阳光', unlockRequirement: { level: 7 },  defaultScale: 0.57 },
  { id: 'orn_window_garden',  name: '窗台花园组',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 215,  starValue: 1, icon: 'orn_window_garden',  desc: '三盆小花排排站', unlockRequirement: { level: 2 }, defaultScale: 0.87 },
  { id: 'orn_awaken_bucket',  name: '金属醒花桶',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 195, starValue: 1, icon: 'orn_awaken_bucket',  desc: '深水养花，把花叫醒', unlockRequirement: { level: 4 }, defaultScale: 0.57, decorationPanelTab: 'flower_room' },
  { id: 'orn_floral_chest',   name: '花艺工具箱',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 230, starValue: 2, icon: 'orn_floral_chest',   desc: '剪刀麻绳小喷壶', unlockRequirement: { level: 5 }, defaultScale: 0.87, decorationPanelTab: 'flower_room' },
  { id: 'orn_pastel_bench',   name: '马卡龙长凳',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 790, starValue: 4, icon: 'orn_pastel_bench',   desc: '薄荷木色配珊瑚软垫', unlockRequirement: { level: 8 }, defaultScale: 1.1, decorationPanelTab: 'furniture' },
  { id: 'wallart_lace_curtain', name: '柔纱短帘', slot: DecoSlot.WALLART,  rarity: DecoRarity.FINE,   cost: 630, starValue: 3, icon: 'wallart_lace_curtain', desc: '蕾丝咖啡馆风情', unlockRequirement: { level: 7 }, defaultScale: 1.5 },
  { id: 'garden_wood_trough', name: '木质长花箱',   slot: DecoSlot.GARDEN,   rarity: DecoRarity.COMMON, cost: 210, starValue: 1, icon: 'garden_wood_trough', desc: '一长条春天开在门口', unlockRequirement: { level: 4 }, defaultScale: 0.97 },

  // ═══════ ⑧ 家具 / 家电扩展（NB2 批次：躺椅、桌凳、收音机风扇等）═══════
  { id: 'orn_lounge_chaise',    name: '布艺躺椅',     slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 900,  starValue: 4, icon: 'orn_lounge_chaise',    desc: '花店里偷个懒的贵妃榻', unlockRequirement: { level: 8 },  defaultScale: 0.93, decorationPanelTab: 'furniture' },
  { id: 'table_round_cafe',     name: '小圆桌',       slot: DecoSlot.TABLE,    rarity: DecoRarity.COMMON, cost: 345,  starValue: 2, icon: 'table_round_cafe',     desc: '一杯花茶刚好', unlockRequirement: { level: 5 },  defaultScale: 1.05,  decorationPanelTab: 'furniture' },
  { id: 'table_square_bistro',  name: '方桌',         slot: DecoSlot.TABLE,    rarity: DecoRarity.COMMON, cost: 440,  starValue: 2, icon: 'table_square_bistro',  desc: '方正好用的边角桌', unlockRequirement: { level: 3 },  defaultScale: 1,  decorationPanelTab: 'furniture' },
  { id: 'orn_wood_stools_pair', name: '原木双凳',     slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 290,  starValue: 1, icon: 'orn_wood_stools_pair', desc: '两把圆凳排排坐', unlockRequirement: { level: 4 },  defaultScale: 0.73, decorationPanelTab: 'furniture' },
  { id: 'orn_rocking_chair',    name: '摇椅',         slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 1015,  starValue: 5, icon: 'orn_rocking_chair',    desc: '慢慢摇，闻花香', unlockRequirement: { level: 9 },  defaultScale: 0.98, decorationPanelTab: 'furniture' },
  { id: 'table_side_round',     name: '大理石小边几', slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,   cost: 635,  starValue: 3, icon: 'table_side_round',     desc: '放一盆小绿植刚好', unlockRequirement: { level: 8 },  defaultScale: 0.97, decorationPanelTab: 'furniture' },
  { id: 'light_radio_vintage',  name: '复古收音机',   slot: DecoSlot.LIGHT,   rarity: DecoRarity.FINE,   cost: 660,  starValue: 3, icon: 'light_radio_vintage',  desc: '店里轻声放老歌', unlockRequirement: { level: 8 },  defaultScale: 0.36 },
  { id: 'light_fan_desk',       name: '台式电风扇',   slot: DecoSlot.LIGHT,   rarity: DecoRarity.COMMON, cost: 260,  starValue: 2, icon: 'light_fan_desk',       desc: '夏天也清凉', unlockRequirement: { level: 4 },  defaultScale: 0.63 },
  { id: 'light_kettle_pastel',  name: '电热水壶',     slot: DecoSlot.LIGHT,   rarity: DecoRarity.COMMON, cost: 240,  starValue: 1, icon: 'light_kettle_pastel',  desc: '泡茶泡咖啡都靠它', unlockRequirement: { level: 5 },  defaultScale: 0.36 },
  { id: 'light_humidifier_cute', name: '桌面加湿器',  slot: DecoSlot.LIGHT,   rarity: DecoRarity.FINE,   cost: 570,  starValue: 3, icon: 'light_humidifier_cute', desc: '给小花加一点湿润', unlockRequirement: { level: 6 },  defaultScale: 0.36 },

  // ═══════ ⑨ 花房主题（贴图批次：软木板 / 园艺工具 / 地毯 / 衣帽架 / 花车 / 小黑板 / 小盆栽等；面板固定「花房」Tab）═══════
  { id: 'wallart_greenhouse_chalkboard', name: '花房落地小黑板', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 515, starValue: 3, icon: 'wallart_greenhouse_chalkboard', desc: '户外落地 A 字招牌架，黑白板粉笔「花花」，小花饰点缀', unlockRequirement: { level: 5 }, defaultScale: 1.02, decorationPanelTab: 'flower_room' },
  { id: 'orn_greenhouse_cart', name: '花房软木留言板', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 605, starValue: 3, icon: 'orn_greenhouse_cart', desc: '浅木框软木板，钉着备忘与便签', unlockRequirement: { level: 3 }, defaultScale: 0.78, decorationPanelTab: 'flower_room' },
  { id: 'garden_flower_stall', name: '浇水壶与花铲', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 880, starValue: 4, icon: 'garden_flower_stall', desc: '浅蓝浇水壶配木柄小铲，打理花材用', unlockRequirement: { level: 6 }, defaultScale: 0.65, decorationPanelTab: 'flower_room' },
  { id: 'orn_greenhouse_rug', name: '粉色碎花地毯', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 200, starValue: 1, icon: 'orn_greenhouse_rug', desc: '粉地白花图案的小地垫', unlockRequirement: { level: 2 }, defaultScale: 0.92, decorationPanelTab: 'furniture' },
  { id: 'orn_greenhouse_coat_rack', name: '木轨衣帽挂钩', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 200, starValue: 1, icon: 'orn_greenhouse_coat_rack', desc: '墙上木轨挂钩，挂着风衣、小包与草帽', unlockRequirement: { level: 3 }, defaultScale: 0.9, decorationPanelTab: 'furniture' },
  { id: 'orn_greenhouse_flower_cart', name: '木轮鲜花推车', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 230, starValue: 2, icon: 'orn_greenhouse_flower_cart', desc: '装满蔷薇与郁金香的双轮木推车', unlockRequirement: { level: 3 }, defaultScale: 1.05, decorationPanelTab: 'flower_room' },
  /** 花房小盆栽：与棋盘鲜花线同级对应，图鉴解锁该花后方可花愿购买 */
  { id: 'greenhouse_pot_sprout', name: '芽苗小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 170, starValue: 1, icon: 'greenhouse_pot_sprout', desc: '陶盆里刚冒头的双叶小芽', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_1' }, defaultScale: 0.28, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_bud', name: '花苞小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 170, starValue: 1, icon: 'greenhouse_pot_bud', desc: '粉尖花苞快要开了', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_2' }, defaultScale: 0.48, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_daisy', name: '雏菊小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 200, starValue: 2, icon: 'greenhouse_pot_daisy', desc: '白瓣小黄心', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_3' }, defaultScale: 0.5, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_sunflower', name: '向日葵小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 200, starValue: 2, icon: 'greenhouse_pot_sunflower', desc: '一小束阳光', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_4' }, defaultScale: 0.52, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_carnation', name: '康乃馨小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 215, starValue: 2, icon: 'greenhouse_pot_carnation', desc: '温柔粉瓣', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_5' }, defaultScale: 0.4, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_rose', name: '玫瑰小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 320, starValue: 2, icon: 'greenhouse_pot_rose', desc: '一枝就够浪漫', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_6' }, defaultScale: 0.4, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_lily', name: '百合小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 355, starValue: 2, icon: 'greenhouse_pot_lily', desc: '清香白瓣', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_7' }, defaultScale: 0.62, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_hydrangea', name: '绣球小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 355, starValue: 3, icon: 'greenhouse_pot_hydrangea', desc: '团团蓝紫', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_9' }, defaultScale: 0.52, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_orchid', name: '蝴蝶兰小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 555, starValue: 4, icon: 'greenhouse_pot_orchid', desc: '兰科小公主', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_10' }, defaultScale: 0.54, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_pot_peony_gold', name: '金牡丹小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 685, starValue: 5, icon: 'greenhouse_pot_peony_gold', desc: '富贵金灿灿', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_13' }, defaultScale: 0.44, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_vase_tulip', name: '郁金香花瓶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 280, starValue: 2, icon: 'greenhouse_vase_tulip', desc: '玻璃杯里一束热烈郁金香', unlockRequirement: { level: 4 }, defaultScale: 0.56, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_vase_peony', name: '芍药花瓶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 465, starValue: 3, icon: 'greenhouse_vase_peony', desc: '奶釉罐盛满粉白芍药', unlockRequirement: { level: 6 }, defaultScale: 0.54, decorationPanelTab: 'flower_room' },
  { id: 'greenhouse_vase_lotus', name: '户外荷花小池', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 575, starValue: 3, icon: 'greenhouse_vase_lotus', desc: '石砌浅塘，浮叶开满粉荷', unlockRequirement: { level: 7 }, defaultScale: 1.3, decorationPanelTab: 'flower_room' },

  // ═══════ ⑩ 高星主题珍藏（常驻；id 沿用旧季节套以兼容存档）═══════

  { id: 'season_spring_shelf', name: '樱花花架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 2895, starValue: 10, icon: 'shelf_spring', desc: '落满樱花的展示花架', unlockRequirement: { level: 8 }, defaultScale: 1.85, decorationPanelTab: 'garden' },
  { id: 'season_spring_wall', name: '樱花挂画', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 2415, starValue: 8, icon: 'wallart_spring', desc: '漫天樱花的油画风挂画', unlockRequirement: { level: 8 }, defaultScale: 0.71 },
  { id: 'season_summer_light', name: '向日葵灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 2655, starValue: 9, icon: 'light_summer', desc: '阳光感的向日葵造型灯具', unlockRequirement: { level: 9 }, defaultScale: 0.53 },
  { id: 'season_summer_garden', name: '花园喷泉', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 3380, starValue: 11, icon: 'garden_summer', desc: '庭院里的清凉喷泉', unlockRequirement: { level: 9 }, defaultScale: 1.68 },
  { id: 'season_autumn_orn', name: '南瓜灯笼', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 2415, starValue: 8, icon: 'orn_pumpkin', desc: '暖色调丰收风灯笼', unlockRequirement: { level: 9 }, defaultScale: 0.65 },
  { id: 'season_autumn_table', name: '枫叶柜台', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 3140, starValue: 10, icon: 'table_autumn', desc: '铺满红叶的木质柜台', unlockRequirement: { level: 10 }, defaultScale: 1.48 },
  { id: 'season_winter_wallart', name: '雪景挂画', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 2415, starValue: 8, icon: 'wallart_winter', desc: '窗外飞雪意境挂画', unlockRequirement: { level: 10 }, defaultScale: 0.84 },
  { id: 'season_winter_orn', name: '节庆壁炉', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 3620, starValue: 12, icon: 'orn_christmas', desc: '袜饰与暖光的温馨壁炉', unlockRequirement: { level: 10 }, defaultScale: 1.3, decorationPanelTab: 'furniture' },

  // ═══════ ⑪ 后期家具（NB2 + rembg + 规范压缩；提示词 docs/prompt/furniture_deco_late_*_nb2_prompt.txt）═══════
  // L7 主搭 style_confetti_nb2；L9 主搭 style_lagoon_nb2；L10 发财树搭粉蓝/复古大空间
  { id: 'deco_late_lv7_table_01', name: '豆沙绿搪瓷小圆桌', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 770, starValue: 3, icon: 'deco_late_lv7_table_01', desc: '细白搪瓷桌面、豆沙绿弯腿，配一杯花茶与小卡片', unlockRequirement: { level: 7 }, defaultScale: 0.95, decorationPanelTab: 'furniture' },
  { id: 'deco_late_lv7_wall_01', name: '干花标本三联框', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 675, starValue: 3, icon: 'deco_late_lv7_wall_01', desc: '浅橡木三格相框，押花与蕨叶标本，复古花坊墙面', unlockRequirement: { level: 7 }, defaultScale: 0.72 },
  { id: 'deco_late_lv8_garden_01', name: '庭院染井吉野樱树', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 1320, starValue: 6, icon: 'deco_late_lv8_garden_01', desc: '透明底仅树干与树根，无地砖；冠幅浅粉樱花', unlockRequirement: { level: 8 }, defaultScale: 2.8, decorationPanelTab: 'garden' },
  { id: 'deco_late_lv8_shelf_01', name: '迷你花艺冷藏柜', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 1255, starValue: 5, icon: 'deco_late_lv8_shelf_01', desc: '银灰双门小冷柜，玻璃门后瓶花剪影，无字牌', unlockRequirement: { level: 8 }, defaultScale: 1.12 },
  { id: 'deco_late_lv8_light_01', name: '橡木摇臂爱迪生壁灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 1095, starValue: 5, icon: 'deco_late_lv8_light_01', desc: '浅橡木支架+古铜小灯罩，单颗暖黄爱迪生灯泡', unlockRequirement: { level: 8 }, defaultScale: 0.55 },
  { id: 'deco_late_lv9_orn_furn_01', name: '海岛风单人沙发椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 1900, starValue: 7, icon: 'deco_late_lv9_orn_furn_01', desc: '青绿条纹布艺单椅，白木细腿，清爽客座一角', unlockRequirement: { level: 9 }, defaultScale: 0.95, decorationPanelTab: 'furniture' },
  { id: 'deco_late_lv9_wall_01', name: '青柠水彩长幅画', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 1800, starValue: 7, icon: 'deco_late_lv9_wall_01', desc: '黄绿青柠切片与水彩晕染长幅，无文字', unlockRequirement: { level: 9 }, defaultScale: 1.6 },
  { id: 'deco_late_lv9_table_01', name: '礼品包装中岛台', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 2170, starValue: 8, icon: 'deco_late_lv9_table_01', desc: '浅木台面上缎带架、吊式牛皮纸卷、剪刀挂钩与小堆礼盒', unlockRequirement: { level: 9 }, defaultScale: 1.12, decorationPanelTab: 'furniture' },
  { id: 'deco_late_lv9_garden_01', name: '庭院香水柠檬树', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 2380, starValue: 8, icon: 'deco_late_lv9_garden_01', desc: '透明底仅树干与树根，无地砖；冠上青柠与花', unlockRequirement: { level: 9 }, defaultScale: 2.8, decorationPanelTab: 'garden' },
  { id: 'deco_late_lv10_shelf_01', name: '铁艺自行车花架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 2770, starValue: 9, icon: 'deco_late_lv10_shelf_01', desc: '立式铁艺自行车轮廓作花架，圆环与横梁挂小花盆与藤', unlockRequirement: { level: 10 }, defaultScale: 1.48, decorationPanelTab: 'garden' },
  { id: 'deco_late_lv10_orn_01', name: '奶黄砖迷你洗手台', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 2975, starValue: 10, icon: 'deco_late_lv10_orn_01', desc: '半高柜+小椭圆镜+陶瓷盆与古铜龙头，角落实用', unlockRequirement: { level: 10 }, defaultScale: 1.2, decorationPanelTab: 'furniture' },
  { id: 'deco_late_lv10_pachira_01', name: '落地发财树', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 2220, starValue: 9, icon: 'deco_late_lv10_pachira_01', desc: '高腰深釉陶盆，掌状大叶层叠向上，落地体量撑场面', unlockRequirement: { flowerCollectionItemId: 'flower_green_10' }, defaultScale: 1.22, decorationPanelTab: 'furniture' },
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
  if (tab === 'flower_room') return { name: '花坊', emoji: '🌷' };
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
