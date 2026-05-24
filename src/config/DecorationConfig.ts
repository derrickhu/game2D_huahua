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
/** 房间内家具显示试调倍率：不改存档 scale，仅统一缩放当前房间中的视觉尺寸。 */
export const SHOP_FURNITURE_DISPLAY_SCALE_MULTIPLIER = 0.9;

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
   * 装修面板独占 Tab：
   * - 'furniture' = 通用「家具」Tab（含通用 shelf/table 与指定放入家具大类的条目）
   * - 'flower_room' = 当前房屋专属 Tab（名称随 sceneId 变化；花店显示「花坊」，蝴蝶小屋显示「蝴蝶小屋」）
   * - 'garden' = 通用「庭院」Tab
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
  /** 临时从装修面板隐藏，但仍允许通过 GM / 任务等路径发放 */
  hideInDecorationPanel?: boolean;
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
  /** 允许出现在哪些装修场景；房间风格默认按房屋独占，不填时仅 flower_shop 兼容旧配置 */
  allowedSceneIds?: string[];
}

// ======== 槽位信息 ========

/** 槽位展示名（存档/逻辑仍用 DecoSlot；LIGHT 在面板中归「家电」Tab） */
export const DECO_SLOT_INFO: Record<DecoSlot, { name: string; emoji: string }> = {
  [DecoSlot.SHELF]:    { name: '花架',   emoji: '' },
  [DecoSlot.TABLE]:    { name: '桌台',   emoji: '' },
  [DecoSlot.LIGHT]:    { name: '家电',   emoji: '' },
  [DecoSlot.ORNAMENT]: { name: '摆件',   emoji: '' },
  [DecoSlot.WALLART]:  { name: '墙饰',   emoji: '' },
  [DecoSlot.GARDEN]:   { name: '庭院',   emoji: '' },
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
  { id: 'style_default', name: '温馨明亮花坊', cost: 0, starValue: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_default', desc: '左上柔光、粉瓦白墙与细密人字拼，贴近合成页明亮感（v2）', allowedSceneIds: ['flower_shop'] },
  { id: 'style_candy_nb2', name: '糖果花坊', cost: 500, starValue: 5, rarity: DecoRarity.FINE, bgTexture: 'bg_room_candy_nb2', desc: '糖果 pastel 硬装；室内宽条/大色块地坪，区别于细碎人字拼', unlockRequirement: { level: 3 }, allowedSceneIds: ['flower_shop'] },
  { id: 'style_bloom_nb2', name: '花境小筑', cost: 3999, starValue: 9, rarity: DecoRarity.FINE, bgTexture: 'bg_room_bloom_nb2', desc: '满开鲜花硬装与窗景，室内纯色大块地坪，温馨不撞糖果系', unlockRequirement: { level: 4 }, allowedSceneIds: ['flower_shop'] },
  { id: 'style_pinkblue_nb2', name: '粉蓝花坊', cost: 5200, starValue: 10, rarity: DecoRarity.FINE, bgTexture: 'bg_room_pinkblue_nb2', desc: '粉白蓝温馨风：短绒地毯、樱花形窗、新瓦型屋顶', unlockRequirement: { level: 5 }, allowedSceneIds: ['flower_shop'] },
  { id: 'style_lagoon_nb2', name: '海岛汽水', cost: 6900, starValue: 12, rarity: DecoRarity.RARE, bgTexture: 'bg_room_lagoon_nb2', desc: '青绿天蓝木瓜橙撞色，清新热带感', unlockRequirement: { level: 6 }, allowedSceneIds: ['flower_shop'] },
  { id: 'style_confetti_nb2', name: '复古花坊', cost: 7500, starValue: 14, rarity: DecoRarity.LIMITED, bgTexture: 'bg_room_confetti_nb2', desc: '明亮复古花店：奶黄墙、豆沙绿与浅橡木，大格地面不暗沉', unlockRequirement: { level: 7 }, allowedSceneIds: ['flower_shop'] },
  { id: 'style_butterfly_house_nb2', name: '蝴蝶小屋原木壳', cost: 0, starValue: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_butterfly_house_nb2', desc: '蝴蝶小屋默认房壳：浅木结构、干净墙面与观蝶空间', allowedSceneIds: ['butterfly_house'] },
  { id: 'style_butterfly_house_bamboo_nb2', name: '竹影蝶屋', cost: 4200, starValue: 8, rarity: DecoRarity.FINE, bgTexture: 'bg_room_butterfly_house_bamboo_nb2', desc: '竹艺暖色房壳：蜂蜜竹柱、鼠尾草屋檐与蝶翼木拼地面', unlockRequirement: { level: 11 }, allowedSceneIds: ['butterfly_house'] },
  { id: 'style_butterfly_house_moon_nb2', name: '月辉蝶馆', cost: 6800, starValue: 12, rarity: DecoRarity.RARE, bgTexture: 'bg_room_butterfly_house_moon_nb2', desc: '月光玻璃感房壳：冷紫屋檐、月石地面与更清透的观蝶氛围', unlockRequirement: { level: 13 }, allowedSceneIds: ['butterfly_house'] },
  { id: 'style_butterfly_house_xianqi_nb2', name: '云檐蝶舍', cost: 5400, starValue: 9, rarity: DecoRarity.FINE, bgTexture: 'bg_room_butterfly_house_xianqi_nb2', desc: '仙气 pastel 茶寮风替换壳：浅木竹柱、青瓷挑檐与竹席云纹地坪', unlockRequirement: { level: 12 }, allowedSceneIds: ['butterfly_house'] },
  { id: 'style_tea_house_two_story_nb2', name: '双层茶楼', cost: 0, starValue: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_tea_house_two_story_nb2', desc: '茶香小院默认壳：传统二层 cutaway 茶楼，石砖一层、木台二层与回廊栏板', allowedSceneIds: ['tea_house'] },
];

export const ROOM_STYLE_MAP = new Map<string, RoomStyleDef>(
  ROOM_STYLES.map(s => [s.id, s])
);

/** 房间风格列表排序（与装修面板一致）：先解锁等级门槛，再花愿价 */
export function sortRoomStylesByUnlockLevelThenCost(styles: RoomStyleDef[]): RoomStyleDef[] {
  return [...styles].sort((a, b) => {
    const la = a.unlockRequirement?.level ?? 0;
    const lb = b.unlockRequirement?.level ?? 0;
    if (la !== lb) return la - lb;
    return a.cost - b.cost;
  });
}

// ======== 可摆放家具定义 ========
// icon 字段已切换为新素材 key（对应 images/furniture/ 目录下的扣底图）
// 花愿 cost：无玩家等级门槛 ×1.32；unlock level 2–4 再 ×1.15；level ≥5 再 ×1.06；取整到 5。付费房间风格见 ROOM_STYLES 另 ×1.06。starValue 1/2 档家具在基准上再约 ×1.1 取整到 5（与 StarLevelConfig 早期升星门槛微调配套）。

export const DECO_DEFS: DecoDef[] = [

  // ═══════ ① 花架 / 展示架 (shelf) ═══════
  // 入门花架：低价带仍便于首周入手，但整体高于旧版（约多攒数单）
  { id: 'shelf_wood',    name: '简约木花架',  slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 5, starValue: 2, icon: 'shelf_wood',   desc: '三层原木架，朴素实用', defaultScale: 1.5, decorationPanelTab: 'flower_room' },
  { id: 'shelf_step',    name: '阶梯花架',    slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 655, starValue: 2, icon: 'shelf_step',   desc: '层层叠叠，像小山丘', unlockRequirement: { level: 2 }, defaultScale: 1.35 },
  { id: 'shelf_long',    name: '长条花台',    slot: DecoSlot.SHELF, rarity: DecoRarity.FINE,   cost: 580, starValue: 3, icon: 'shelf_long',   desc: '靠墙摆放的温馨花台', unlockRequirement: { level: 5 }, defaultScale: 1.25, decorationPanelTab: 'garden' },
  { id: 'shelf_iron',    name: '铁艺旋转架',  slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 835, starValue: 4, icon: 'shelf_iron',   desc: '优雅的法式铁艺风格', unlockRequirement: { level: 7 }, defaultScale: 1.5 },
  { id: 'shelf_glass',   name: '玻璃展示柜',  slot: DecoSlot.SHELF, rarity: DecoRarity.RARE,   cost: 1930, starValue: 8, icon: 'shelf_glass',  desc: '高端玻璃门展示柜', unlockRequirement: { level: 10 }, defaultScale: 1.45 },

  // ═══════ ② 桌台 / 工作台 (table) ═══════
  { id: 'table_counter',  name: '木质收银台',  slot: DecoSlot.TABLE, rarity: DecoRarity.COMMON, cost: 540, starValue: 2, icon: 'table_counter', desc: '温暖的原木收银台', defaultScale: 1.13 },
  { id: 'table_drawer',   name: '抽屉式柜台',  slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 965, starValue: 4, icon: 'table_drawer',  desc: '带抽屉的实用柜台', unlockRequirement: { level: 9 }, defaultScale: 1.23 },
  { id: 'table_work',     name: '花艺工作台',  slot: DecoSlot.TABLE, rarity: DecoRarity.FINE,   cost: 870, starValue: 4, icon: 'table_work',    desc: '专业的花艺操作台', unlockRequirement: { level: 6 }, defaultScale: 1.38 },
  { id: 'table_marble',   name: '大理石桌',    slot: DecoSlot.TABLE, rarity: DecoRarity.RARE,   cost: 1690, starValue: 7, icon: 'table_marble',  desc: '冷峻优雅的大理石面', unlockRequirement: { level: 9 }, defaultScale: 1.38, decorationPanelTab: 'furniture' },

  // ═══════ ③ 灯具 (light) ═══════
  { id: 'light_desk',     name: '台灯',        slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 195, starValue: 2,  icon: 'light_desk',    desc: '简约台灯，温暖光芒', unlockRequirement: { level: 2 }, defaultScale: 0.43 },
  { id: 'light_floor',    name: '晶石立灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 300, starValue: 2, icon: 'light_floor',   desc: '淡蓝晶石立灯，实心乳白质感易抠图', unlockRequirement: { level: 3 }, defaultScale: 1.25 },
  { id: 'light_pendant',  name: '花式吊灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE,   cost: 660, starValue: 3, icon: 'light_pendant', desc: '花朵造型的精美吊灯', unlockRequirement: { level: 6 }, defaultScale: 1.05 },
  { id: 'light_crystal',  name: '水晶吊灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE,   cost: 1850, starValue: 7, icon: 'light_crystal', desc: '华丽的水晶折射光芒', unlockRequirement: { level: 10 }, defaultScale: 1.1 },

  // ═══════ ④ 摆件 / 装饰品 (ornament) ═══════
  { id: 'orn_pot',        name: '藤编收纳篮',  slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 165, starValue: 2,  icon: 'orn_pot',       desc: '手编篮配干花丝带，非盆栽', unlockRequirement: { level: 2 }, defaultScale: 0.63 },
  { id: 'orn_vase',       name: '花瓶',        slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 255, starValue: 2, icon: 'orn_vase',      desc: '插一枝花就很美', unlockRequirement: { level: 4 }, defaultScale: 0.53 },
  { id: 'orn_fountain',   name: '迷你喷泉',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 870, starValue: 4, icon: 'orn_fountain',  desc: '轻线稿小喷泉，卵石底无方格地台', unlockRequirement: { level: 6 }, defaultScale: 1.2, decorationPanelTab: 'garden' },
  { id: 'orn_candle',     name: '香薰蜡烛',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 215, starValue: 1, icon: 'orn_candle',    desc: '玻璃罐浮雕花香款，精致柔线稿', defaultScale: 0.36 },
  { id: 'orn_clock',      name: '复古挂钟',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 1060, starValue: 5, icon: 'orn_clock',     desc: '滴答滴答的复古时光', unlockRequirement: { level: 8 }, defaultScale: 0.55 },
  { id: 'orn_fireplace',  name: '壁炉',        slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 900, starValue: 4, icon: 'orn_fireplace', desc: '砖木壁炉柔线稿，台面双瓶花', unlockRequirement: { level: 5 }, defaultScale: 1.35, decorationPanelTab: 'furniture' },

  // ═══════ ⑤ 墙饰 / 挂件 (wallart) ═══════
  { id: 'wallart_plant',  name: '植物壁挂',    slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 265, starValue: 2,  icon: 'wallart_plant',  desc: '墙上的一抹绿意', unlockRequirement: { level: 2 }, defaultScale: 0.93 },
  { id: 'wallart_frame',  name: '装饰画框',    slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 350, starValue: 2, icon: 'wallart_frame',  desc: '小花野趣装饰画，等距墙面透视', unlockRequirement: { level: 3 }, defaultScale: 0.73 },
  { id: 'wallart_wreath', name: '花环壁饰',    slot: DecoSlot.WALLART, rarity: DecoRarity.FINE,   cost: 725, starValue: 3, icon: 'wallart_wreath', desc: '干花与绿叶编织的花环', unlockRequirement: { level: 5 }, defaultScale: 0.71 },
  { id: 'wallart_relief', name: '艺术浮雕',    slot: DecoSlot.WALLART, rarity: DecoRarity.RARE,   cost: 2170, starValue: 8, icon: 'wallart_relief', desc: '精致的花卉浮雕壁饰', unlockRequirement: { level: 10 }, defaultScale: 0.67 },
  { id: 'wallart_window_meadow_arch', name: '拱窗花野景', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 980, starValue: 4, icon: 'wallart_window_meadow_arch', desc: '奶油木拱窗里收进一片花野与蝶影', unlockRequirement: { level: 10 }, defaultScale: 1.32 },
  { id: 'wallart_window_lake_round',  name: '圆窗湖雾景', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 1480, starValue: 6, icon: 'wallart_window_lake_round',  desc: '复古圆窗映着薄雾湖景，像温室外的安静清晨', unlockRequirement: { level: 12 }, defaultScale: 1.28 },

  // ═══════ ⑥ 庭院 / 户外 (garden) ═══════
  { id: 'garden_flowerbed', name: '小花圃',    slot: DecoSlot.GARDEN, rarity: DecoRarity.COMMON, cost: 200, starValue: 1,  icon: 'garden_flowerbed', desc: '门前的一小片花圃', defaultScale: 1.28 },
  { id: 'garden_arbor',    name: '藤蔓凉亭',   slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE,   cost: 1205, starValue: 5, icon: 'garden_arbor',    desc: '紫藤木亭轻线稿，自然草边', unlockRequirement: { level: 5 }, defaultScale: 2 },
  { id: 'garden_arch',     name: '玫瑰花廊',   slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE,   cost: 2415, starValue: 9, icon: 'garden_arch',     desc: '双拱玫瑰廊轻线稿，无菱形草皮', unlockRequirement: { level: 7 }, defaultScale: 2.13 },
  { id: 'garden_zen',      name: '日式枯山水', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 1320, starValue: 6, icon: 'garden_zen',      desc: '柔线枯山水浅皿，无硬方框', unlockRequirement: { level: 8 }, defaultScale: 1.63 },

  // ═══════ ⑦ 花店扩展家具（NB2 批次，画风与房间壳一致；缩放可后续 GM 校准）═══════
  { id: 'shelf_terracotta',   name: '陶盆阶梯花架', slot: DecoSlot.SHELF,    rarity: DecoRarity.FINE,   cost: 640,  starValue: 3, icon: 'shelf_terracotta',   desc: '粉陶盆叠成阶梯，小清新绿植', unlockRequirement: { level: 3 },  defaultScale: 0.68 },
  { id: 'table_wrap_station', name: '花艺包装台',   slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,   cost: 400,  starValue: 2, icon: 'table_wrap_station', desc: '牛皮纸与丝带，礼物包起来', unlockRequirement: { level: 3 },  defaultScale: 1.2 },
  { id: 'table_rattan_twoset', name: '藤编边桌凳组', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE,   cost: 666,  starValue: 6, icon: 'table_rattan_twoset', desc: '圆几配双凳，度假风下午茶', unlockRequirement: { level: 3 }, defaultScale: 0.83, decorationPanelTab: 'furniture' },
  { id: 'light_plant_strip',  name: '植物补光灯',   slot: DecoSlot.LIGHT,   rarity: DecoRarity.FINE,   cost: 725,  starValue: 3, icon: 'light_plant_strip',  desc: '阴天也给小花一点阳光', unlockRequirement: { level: 7 },  defaultScale: 0.57 },
  { id: 'orn_window_garden',  name: '窗台花园组',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 965,  starValue: 4, icon: 'orn_window_garden',  desc: '三盆小花排排站', unlockRequirement: { level: 6 }, defaultScale: 0.87 },
  { id: 'orn_awaken_bucket',  name: '金属醒花桶',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 605, starValue: 3, icon: 'orn_awaken_bucket',  desc: '深水养花，把花叫醒', unlockRequirement: { level: 3 }, defaultScale: 0.57, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'orn_floral_chest',   name: '花艺工具箱',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 230, starValue: 2, icon: 'orn_floral_chest',   desc: '剪刀麻绳小喷壶', unlockRequirement: { level: 4 }, defaultScale: 0.87, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'orn_pastel_bench',   name: '马卡龙长凳',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 555, starValue: 4, icon: 'orn_pastel_bench',   desc: '薄荷木色配珊瑚软垫', unlockRequirement: { level: 2 }, defaultScale: 1.1, decorationPanelTab: 'furniture' },
  { id: 'promo_floral_sofa',  name: '花漾木扶手沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 299, starValue: 6, icon: 'promo_floral_sofa', desc: '宣传图同款浅木扶手双人沙发，碎花抱枕很适合休息角', unlockRequirement: { level: 7 }, defaultScale: 1.18, decorationPanelTab: 'furniture' },
  { id: 'promo_wood_tea_table', name: '原木花茶几', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 299, starValue: 3, icon: 'promo_wood_tea_table', desc: '厚木板小茶几，摆一杯花茶就有午后感', unlockRequirement: { level: 6 }, defaultScale: 0.98, decorationPanelTab: 'furniture' },
  { id: 'promo_petal_chaise', name: '花瓣奶油躺椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 920, starValue: 5, icon: 'promo_petal_chaise', desc: '奶油躺椅配花瓣靠背，午后小憩像躺进花心里', unlockRequirement: { level: 1 }, defaultScale: 1.15, decorationPanelTab: 'furniture' },
  { id: 'promo_mint_fridge', name: '薄荷小冰箱', slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE, cost: 780, starValue: 4, icon: 'promo_mint_fridge', desc: '圆角复古冰箱，冰饮和鲜花都能清清爽爽', unlockRequirement: { level: 1 }, defaultScale: 1.08 },
  { id: 'promo_doll_hug_pillow', name: '兔兔抱枕玩偶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 560, starValue: 3, icon: 'promo_doll_hug_pillow', desc: '抱着粉心枕的软萌兔兔，角落立刻变可爱', unlockRequirement: { level: 1 }, defaultScale: 0.62 },
  { id: 'promo_pearl_bead_curtain', name: '珍珠花珠帘', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 680, starValue: 3, icon: 'promo_pearl_bead_curtain', desc: '珍珠、花珠和薄荷小叶串成的温柔墙饰', unlockRequirement: { level: 1 }, defaultScale: 1.75 },
  { id: 'wallart_lace_curtain', name: '柔纱短帘', slot: DecoSlot.WALLART,  rarity: DecoRarity.FINE,   cost: 300, starValue: 3, icon: 'wallart_lace_curtain', desc: '蕾丝咖啡馆风情', unlockRequirement: { level: 2 }, defaultScale: 1.8 },
  { id: 'garden_wood_trough', name: '木质长花箱',   slot: DecoSlot.GARDEN,   rarity: DecoRarity.COMMON, cost: 210, starValue: 2, icon: 'garden_wood_trough', desc: '一长条春天开在门口', unlockRequirement: { level: 4 }, defaultScale: 0.97 },

  // ═══════ ⑧ 家具 / 家电扩展（NB2 批次：躺椅、桌凳、收音机风扇等）═══════
  { id: 'orn_lounge_chaise',    name: '布艺躺椅',     slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE,   cost: 2415,  starValue: 9, icon: 'orn_lounge_chaise',    desc: '花店里偷个懒的贵妃榻', unlockRequirement: { level: 9 },  defaultScale: 0.93, decorationPanelTab: 'furniture' },
  { id: 'table_round_cafe',     name: '小圆桌',       slot: DecoSlot.TABLE,    rarity: DecoRarity.COMMON, cost: 445,  starValue: 2, icon: 'table_round_cafe',     desc: '一杯花茶刚好', unlockRequirement: { level: 4 },  defaultScale: 1.05,  decorationPanelTab: 'furniture' },
  { id: 'table_square_bistro',  name: '方桌',         slot: DecoSlot.TABLE,    rarity: DecoRarity.COMMON, cost: 540,  starValue: 2, icon: 'table_square_bistro',  desc: '方正好用的边角桌', unlockRequirement: { level: 3 },  defaultScale: 1,  decorationPanelTab: 'furniture' },
  { id: 'orn_wood_stools_pair', name: '原木双凳',     slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 290,  starValue: 2, icon: 'orn_wood_stools_pair', desc: '两把圆凳排排坐', unlockRequirement: { level: 4 },  defaultScale: 0.73, decorationPanelTab: 'furniture' },
  { id: 'orn_rocking_chair',    name: '摇椅',         slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE,   cost: 2170,  starValue: 8, icon: 'orn_rocking_chair',    desc: '慢慢摇，闻花香', unlockRequirement: { level: 9 },  defaultScale: 0.98, decorationPanelTab: 'furniture' },
  { id: 'table_side_round',     name: '大理石小边几', slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,   cost: 635,  starValue: 3, icon: 'table_side_round',     desc: '放一盆小绿植刚好', unlockRequirement: { level: 8 },  defaultScale: 0.97, decorationPanelTab: 'furniture' },
  { id: 'light_radio_vintage',  name: '复古收音机',   slot: DecoSlot.LIGHT,   rarity: DecoRarity.FINE,   cost: 770,  starValue: 3, icon: 'light_radio_vintage',  desc: '店里轻声放老歌', unlockRequirement: { level: 8 },  defaultScale: 0.36 },
  { id: 'light_fan_desk',       name: '台式电风扇',   slot: DecoSlot.LIGHT,   rarity: DecoRarity.RARE, cost: 500,  starValue: 3, icon: 'light_fan_desk',       desc: '夏天也清凉', defaultScale: 0.63 },
  { id: 'light_kettle_pastel',  name: '电热水壶',     slot: DecoSlot.LIGHT,   rarity: DecoRarity.COMMON, cost: 240,  starValue: 1, icon: 'light_kettle_pastel',  desc: '泡茶泡咖啡都靠它', unlockRequirement: { level: 5 },  defaultScale: 0.36 },
  { id: 'light_humidifier_cute', name: '桌面加湿器',  slot: DecoSlot.LIGHT,   rarity: DecoRarity.FINE,   cost: 570,  starValue: 3, icon: 'light_humidifier_cute', desc: '给小花加一点湿润', unlockRequirement: { level: 6 },  defaultScale: 0.36 },

  // ═══════ ⑨ 花房主题（贴图批次：软木板 / 园艺工具 / 地毯 / 衣帽架 / 花车 / 小黑板 / 小盆栽等；面板固定「花房」Tab）═══════
  { id: 'wallart_greenhouse_chalkboard', name: '花房小黑板', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 515, starValue: 3, icon: 'wallart_greenhouse_chalkboard', desc: '户外落地 A 字招牌架，黑白板粉笔「花花」，小花饰点缀', unlockRequirement: { level: 5 }, defaultScale: 1.02, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'orn_greenhouse_cart', name: '软木留言板', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 195, starValue: 2, icon: 'orn_greenhouse_cart', desc: '浅木框软木板，钉着备忘与便签', unlockRequirement: { level: 4 }, defaultScale: 0.78, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'garden_flower_stall', name: '浇水壶与花铲', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 230, starValue: 2, icon: 'garden_flower_stall', desc: '浅蓝壶与木柄铲，精致柔线稿', unlockRequirement: { level: 3 }, defaultScale: 0.65, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'orn_greenhouse_rug', name: '粉色碎花地毯', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 200, starValue: 2, icon: 'orn_greenhouse_rug', desc: '粉地白花图案的小地垫', unlockRequirement: { level: 2 }, defaultScale: 0.92, decorationPanelTab: 'furniture' },
  { id: 'orn_greenhouse_coat_rack', name: '木轨衣帽挂钩', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 200, starValue: 2, icon: 'orn_greenhouse_coat_rack', desc: '墙上木轨挂钩，挂着风衣、小包与草帽', unlockRequirement: { level: 3 }, defaultScale: 0.9, decorationPanelTab: 'furniture' },
  { id: 'orn_greenhouse_flower_cart', name: '木轮鲜花推车', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 880, starValue: 4, icon: 'orn_greenhouse_flower_cart', desc: '装满蔷薇与郁金香的双轮木推车', unlockRequirement: { level: 6 }, defaultScale: 1.05, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  /** 花房小盆栽与同名花瓶：与棋盘鲜花线 item 一一对应；仅 flowerCollectionItemId（纯图鉴），勿再写 level（UnlockChecker 亦会忽略 level） */
  /** 小盆栽花愿：fresh_2 花苞=180，对应鲜花每高一级 +100（公式 180+(N-2)*100；fresh_1=80）；无盆栽的阶（如 8）在价差中跳过 */
  { id: 'greenhouse_pot_sprout', name: '芽苗小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 80, starValue: 1, icon: 'greenhouse_pot_sprout', desc: '陶盆里刚冒头的双叶小芽', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_1' }, defaultScale: 0.28, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'greenhouse_pot_bud', name: '花苞小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 180, starValue: 1, icon: 'greenhouse_pot_bud', desc: '粉尖花苞快要开了', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_2' }, defaultScale: 0.48, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'greenhouse_pot_daisy', name: '雏菊小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 280, starValue: 2, icon: 'greenhouse_pot_daisy', desc: '白瓣小黄心', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_3' }, defaultScale: 0.5, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'greenhouse_pot_sunflower', name: '向日葵小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 380, starValue: 2, icon: 'greenhouse_pot_sunflower', desc: '一小束阳光', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_4' }, defaultScale: 0.52, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'greenhouse_pot_carnation', name: '康乃馨小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 480, starValue: 2, icon: 'greenhouse_pot_carnation', desc: '温柔粉瓣', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_5' }, defaultScale: 0.4, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'greenhouse_pot_rose', name: '玫瑰小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 580, starValue: 2, icon: 'greenhouse_pot_rose', desc: '一枝就够浪漫', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_6' }, defaultScale: 0.4, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'greenhouse_pot_lily', name: '百合小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 680, starValue: 2, icon: 'greenhouse_pot_lily', desc: '清香白瓣', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_7' }, defaultScale: 0.62, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'greenhouse_pot_hydrangea', name: '绣球小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 880, starValue: 3, icon: 'greenhouse_pot_hydrangea', desc: '团团蓝紫', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_9' }, defaultScale: 0.52, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'greenhouse_pot_orchid', name: '蝴蝶兰小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 980, starValue: 4, icon: 'greenhouse_pot_orchid', desc: '兰科小公主', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_10' }, defaultScale: 0.54, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'greenhouse_pot_peony_gold', name: '金牡丹小盆栽', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 1280, starValue: 5, icon: 'greenhouse_pot_peony_gold', desc: '富贵金灿灿', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_13' }, defaultScale: 0.44, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'greenhouse_vase_tulip', name: '郁金香花瓶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 600, starValue: 2, icon: 'greenhouse_vase_tulip', desc: '玻璃杯里一束热烈郁金香', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_8' }, defaultScale: 0.56, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'greenhouse_vase_peony', name: '芍药花瓶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 800, starValue: 3, icon: 'greenhouse_vase_peony', desc: '奶釉罐盛满粉白芍药', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_12' }, defaultScale: 0.54, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'greenhouse_vase_lotus', name: '户外荷花小池', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 1500, starValue: 5, icon: 'greenhouse_vase_lotus', desc: '石砌浅塘，浮叶开满粉荷', unlockRequirement: { flowerCollectionItemId: 'flower_fresh_11' }, defaultScale: 1.3, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },

  // ═══════ ⑩.5 蝴蝶小屋专属家具（源自误生成房壳中的家具概念，统一重绘为单件合图拆分）═══════
  { id: 'butterfly_house_display_case',  name: '观蝶玻璃柜', slot: DecoSlot.SHELF,    rarity: DecoRarity.RARE,   cost: 1180, starValue: 5, icon: 'butterfly_house_display_case',  desc: '木框玻璃柜里陈列蝶影与枝叶', unlockRequirement: { level: 13 }, defaultScale: 1.78, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_writing_desk',  name: '观蝶书写桌', slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,   cost: 980,  starValue: 4, icon: 'butterfly_house_writing_desk',  desc: '记录观察笔记的小书桌，静静贴着墙角', unlockRequirement: { level: 12 }, defaultScale: 1.12, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_sofa',          name: '蝶翼双人沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 1320, starValue: 6, icon: 'butterfly_house_sofa',          desc: '柔软靠背像展开的蝶翼，适合小憩', unlockRequirement: { level: 15 }, defaultScale: 1.38, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_wicker_chair',  name: '藤编休闲椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 860,  starValue: 3, icon: 'butterfly_house_wicker_chair',  desc: '轻盈藤编椅，把温室角落变成阅读位', unlockRequirement: { level: 11 }, defaultScale: 0.98, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_tea_table',     name: '圆茶几', slot: DecoSlot.TABLE,        rarity: DecoRarity.COMMON, cost: 520,  starValue: 2, icon: 'butterfly_house_tea_table',     desc: '圆润小茶几，摆上点心就很有氛围', unlockRequirement: { level: 8 }, defaultScale: 0.96, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_wall_frame',    name: '蝶影挂画', slot: DecoSlot.WALLART,    rarity: DecoRarity.FINE,   cost: 760,  starValue: 2, icon: 'butterfly_house_wall_frame',    desc: '把蝴蝶标本感做成柔和挂画，适合干净墙面', unlockRequirement: { level: 8 }, defaultScale: 0.88, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },

  // ═══════ ⑩ 高星主题珍藏（常驻；id 沿用旧季节套以兼容存档）═══════

  { id: 'season_spring_shelf', name: '樱花花架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 2895, starValue: 10, icon: 'shelf_spring', desc: '樱花藤架纸灯笼，轻线稿卵石底', unlockRequirement: { level: 8 }, defaultScale: 1.85, decorationPanelTab: 'garden' },
  { id: 'season_spring_wall', name: '樱花挂画', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 2415, starValue: 8, icon: 'wallart_spring', desc: '鎏金框油画风樱花径，等距墙面透视', unlockRequirement: { level: 8 }, defaultScale: 0.81 },
  { id: 'season_summer_light', name: '向日葵灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 260, starValue: 2, icon: 'light_summer', desc: '阳光感的向日葵造型灯具', unlockRequirement: { level: 4 }, defaultScale: 0.53 },
  { id: 'season_summer_garden', name: '花园喷泉', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 3380, starValue: 11, icon: 'garden_summer', desc: '三层石喷泉，自然草边无菱形草皮', unlockRequirement: { level: 9 }, defaultScale: 1.68 },
  { id: 'season_autumn_orn', name: '南瓜灯笼', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 2415, starValue: 8, icon: 'orn_pumpkin', desc: '暖色调丰收风灯笼', unlockRequirement: { level: 9 }, defaultScale: 0.65 },
  { id: 'season_autumn_table', name: '枫叶柜台', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 3140, starValue: 10, icon: 'table_autumn', desc: '铺满红叶的木质柜台', unlockRequirement: { level: 10 }, defaultScale: 1.48 },
  { id: 'season_winter_wallart', name: '复古落地钟', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 1800, starValue: 7, icon: 'wallart_winter', desc: '胡桃木落地钟，柔线稿无数字', unlockRequirement: { level: 9 }, defaultScale: 1.34, decorationPanelTab: 'furniture' },
  { id: 'season_winter_orn', name: '节庆壁炉', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 3620, starValue: 12, icon: 'orn_christmas', desc: '圣诞袜花环灯串，精致柔线稿', unlockRequirement: { level: 10 }, defaultScale: 1.3, decorationPanelTab: 'furniture' },

  // ═══════ ⑪ 后期家具（NB2 + rembg + 规范压缩；提示词 docs/prompt/furniture_deco_late_*_nb2_prompt.txt）═══════
  // L7 主搭 style_confetti_nb2；L9 主搭 style_lagoon_nb2；绿植 L11 发财树搭粉蓝/复古大空间
  { id: 'deco_late_lv7_table_01', name: '豆沙绿圆桌', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 770, starValue: 3, icon: 'deco_late_lv7_table_01', desc: '细白搪瓷桌面、豆沙绿弯腿，配一杯花茶与小卡片', unlockRequirement: { level: 7 }, defaultScale: 0.95, decorationPanelTab: 'furniture' },
  { id: 'deco_late_lv7_wall_01', name: '干花三联框', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 675, starValue: 3, icon: 'deco_late_lv7_wall_01', desc: '浅橡木三联标本格，等距墙面透视', unlockRequirement: { level: 7 }, defaultScale: 0.92 },
  { id: 'deco_late_lv8_garden_01', name: '染井吉野樱', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 3860, starValue: 12, icon: 'deco_late_lv8_garden_01', desc: '透明底仅树干与树根，无地砖；冠幅浅粉樱花', unlockRequirement: { level: 9 }, defaultScale: 2.8, decorationPanelTab: 'garden' },
  { id: 'deco_late_lv8_shelf_01', name: '迷你冷藏柜', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 575, starValue: 3, icon: 'deco_late_lv8_shelf_01', desc: '银灰双门小冷柜，玻璃门后瓶花剪影，无字牌', unlockRequirement: { level: 5 }, defaultScale: 1.12 },
  { id: 'deco_late_lv8_light_01', name: '爱迪生壁灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 1095, starValue: 5, icon: 'deco_late_lv8_light_01', desc: '浅橡木支架+古铜小灯罩，单颗暖黄爱迪生灯泡', unlockRequirement: { level: 8 }, defaultScale: 0.55 },
  { id: 'deco_late_lv9_orn_furn_01', name: '海岛沙发椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 1900, starValue: 7, icon: 'deco_late_lv9_orn_furn_01', desc: '青绿条纹布艺单椅，白木细腿，清爽客座一角', unlockRequirement: { level: 9 }, defaultScale: 0.95, decorationPanelTab: 'furniture' },
  { id: 'deco_late_lv9_wall_01', name: '青柠水彩画', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 2415, starValue: 8, icon: 'deco_late_lv9_wall_01', desc: '黄绿青柠切片与水彩晕染长幅，无文字', unlockRequirement: { level: 9 }, defaultScale: 1.6 },
  { id: 'deco_late_lv9_table_01', name: '礼品中岛台', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 1015, starValue: 5, icon: 'deco_late_lv9_table_01', desc: '浅木台面上缎带架、吊式牛皮纸卷、剪刀挂钩与小堆礼盒', unlockRequirement: { level: 5 }, defaultScale: 1.12, decorationPanelTab: 'furniture' },
  { id: 'deco_late_lv9_garden_01', name: '香水柠檬树', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 2770, starValue: 9, icon: 'deco_late_lv9_garden_01', desc: '透明底仅树干与树根，无地砖；冠上青柠与花', unlockRequirement: { level: 8 }, defaultScale: 2.8, decorationPanelTab: 'garden' },
  { id: 'deco_late_lv10_shelf_01', name: '自行车花架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 2380, starValue: 8, icon: 'deco_late_lv10_shelf_01', desc: '立式铁艺自行车轮廓作花架，圆环与横梁挂小花盆与藤', unlockRequirement: { level: 9 }, defaultScale: 1.48, decorationPanelTab: 'garden' },
  { id: 'deco_late_lv10_orn_01', name: '迷你洗手台', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 2975, starValue: 10, icon: 'deco_late_lv10_orn_01', desc: '半高柜+小椭圆镜+陶瓷盆与古铜龙头，角落实用', unlockRequirement: { level: 10 }, defaultScale: 1.2, decorationPanelTab: 'furniture' },
  { id: 'deco_late_lv10_pachira_01', name: '落地发财树', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 2220, starValue: 9, icon: 'deco_late_lv10_pachira_01', desc: '高腰深釉陶盆，掌状大叶层叠向上，落地体量撑场面', unlockRequirement: { flowerCollectionItemId: 'flower_green_11' }, defaultScale: 1.22, decorationPanelTab: 'furniture' },

  // ═══════ ⑪.2 Lv14-20 高星常驻家具：海滨花园套 + 月光蝶园套（补足 10-20 级购买目标）═══════
  { id: 'deco_lv14_wall_butterfly_clock', name: '月蝶壁钟', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 1500, starValue: 5, icon: 'deco_lv14_wall_butterfly_clock', desc: '淡紫蝶翼外框的小壁钟，没有数字，像月光停在墙上', unlockRequirement: { level: 14 }, defaultScale: 0.7 },
  { id: 'deco_lv14_light_blossom_sconce', name: '花露壁灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE, cost: 1750, starValue: 6, icon: 'deco_lv14_light_blossom_sconce', desc: '玫瑰金花枝托起露珠灯罩，给蝶园套做温柔过渡', unlockRequirement: { level: 14 }, defaultScale: 0.62 },
  { id: 'deco_lv15_garden_pool', name: '海盐小泳池', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 5200, starValue: 15, icon: 'deco_lv15_garden_pool', desc: '奶油白浅池配海盐蓝水面，像把夏天摆进庭院', unlockRequirement: { level: 15 }, defaultScale: 2.22, decorationPanelTab: 'garden' },
  { id: 'deco_lv15_garden_parasol', name: '海风遮阳伞', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 2600, starValue: 8, icon: 'deco_lv15_garden_parasol', desc: '海盐蓝条纹大伞，浅柚木伞柄与小花盆底座', unlockRequirement: { level: 15 }, defaultScale: 1.65, decorationPanelTab: 'garden' },
  { id: 'deco_lv15_light_drink_cooler', name: '海盐饮品冰柜', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 2300, starValue: 7, icon: 'deco_lv15_light_drink_cooler', desc: '薄荷蓝小冰柜，玻璃门里排着清爽瓶饮与花冰块', unlockRequirement: { level: 15 }, defaultScale: 0.85 },
  { id: 'deco_lv16_orn_hanging_chair', name: '藤编吊篮秋千', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 3600, starValue: 11, icon: 'deco_lv16_orn_hanging_chair', desc: '柚木支架吊起藤编篮椅，珊瑚抱枕带来度假感', unlockRequirement: { level: 16 }, defaultScale: 1.58, decorationPanelTab: 'furniture' },
  { id: 'deco_lv16_wall_shell_mirror', name: '贝壳壁挂镜', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 1800, starValue: 6, icon: 'deco_lv16_wall_shell_mirror', desc: '贝壳弧形镜框点缀小珍珠，墙面多了一点海风', unlockRequirement: { level: 16 }, defaultScale: 0.85 },
  { id: 'deco_lv16_garden_coral_planter', name: '珊瑚花箱', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 2400, starValue: 8, icon: 'deco_lv16_garden_coral_planter', desc: '珊瑚色长花箱盛着海风小花，和泳池伞组自然成套', unlockRequirement: { level: 16 }, defaultScale: 1.22, decorationPanelTab: 'garden' },
  { id: 'deco_lv17_shelf_surfboard', name: '冲浪板花架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 3200, starValue: 10, icon: 'deco_lv17_shelf_surfboard', desc: '旧冲浪板改成竖向花架，薄荷蓝与珊瑚花盆呼应海滨套', unlockRequirement: { level: 17 }, defaultScale: 1.55, decorationPanelTab: 'garden' },
  { id: 'deco_lv17_table_terrace_bar', name: '露台折叠吧台', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 4200, starValue: 13, icon: 'deco_lv17_table_terrace_bar', desc: '浅柚木折叠吧台配冰饮托盘，适合海边露台角落', unlockRequirement: { level: 17 }, defaultScale: 1.22, decorationPanelTab: 'furniture' },
  { id: 'deco_lv17_orn_seabreeze_rug', name: '海风圆地毯', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 1600, starValue: 5, icon: 'deco_lv17_orn_seabreeze_rug', desc: '厚织物圆地毯，抬高软包边与流苏让休闲区更像坐垫', unlockRequirement: { level: 17 }, defaultScale: 1.22, decorationPanelTab: 'furniture' },
  { id: 'deco_lv18_shelf_moon_glasshouse', name: '月光玻璃温室柜', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 4200, starValue: 13, icon: 'deco_lv18_shelf_moon_glasshouse', desc: '香槟金玻璃小温室，月光蓝蝶影与水晶花盆陈列其中', unlockRequirement: { level: 18 }, defaultScale: 1.3, decorationPanelTab: 'furniture' },
  { id: 'deco_lv18_light_firefly_lamp', name: '星萤庭院灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 2800, starValue: 9, icon: 'deco_lv18_light_firefly_lamp', desc: '月蓝玻璃灯罩里闪着星萤光点，适合蝶屋夜色', unlockRequirement: { level: 18 }, defaultScale: 1.35 },
  { id: 'deco_lv18_garden_butterfly_arch', name: '蝶翼月光拱门', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 5600, starValue: 16, icon: 'deco_lv18_garden_butterfly_arch', desc: '香槟金拱门展开半透明蝶翼，月光蓝水晶点亮庭院入口', unlockRequirement: { level: 18 }, defaultScale: 2.02, decorationPanelTab: 'garden' },
  { id: 'deco_lv19_wall_crystal_specimen', name: '水晶标本墙', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 3600, starValue: 11, icon: 'deco_lv19_wall_crystal_specimen', desc: '香槟金展示框里封存蝶翼水晶与干花标本，精致但无文字', unlockRequirement: { level: 19 }, defaultScale: 0.78 },
  { id: 'deco_lv19_orn_crescent_chaise', name: '月牙贵妃榻', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 4800, starValue: 14, icon: 'deco_lv19_orn_crescent_chaise', desc: '月牙形软榻配淡紫丝绒靠垫，适合高级休息角', unlockRequirement: { level: 19 }, defaultScale: 1.18, decorationPanelTab: 'furniture' },
  { id: 'deco_lv19_table_stardust_aroma', name: '星砂香氛台', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 3000, starValue: 9, icon: 'deco_lv19_table_stardust_aroma', desc: '圆角香氛小台摆着星砂玻璃瓶、月白托盘与迷你花束', unlockRequirement: { level: 19 }, defaultScale: 0.98, decorationPanelTab: 'furniture' },
  { id: 'deco_lv20_garden_moon_fountain', name: '月辉喷泉雕塑', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 7800, starValue: 20, icon: 'deco_lv20_garden_moon_fountain', desc: '月牙水晶喷泉与蝶翼雕塑组成庭院压轴大件', unlockRequirement: { level: 20 }, defaultScale: 1.4, decorationPanelTab: 'garden' },
  { id: 'deco_lv20_shelf_star_observatory', name: '星月观景陈列柜', slot: DecoSlot.SHELF, rarity: DecoRarity.LIMITED, cost: 6200, starValue: 17, icon: 'deco_lv20_shelf_star_observatory', desc: '小型观景台式陈列柜，玻璃穹顶里摆着星月花器', unlockRequirement: { level: 20 }, defaultScale: 1.32, decorationPanelTab: 'furniture' },
  { id: 'deco_lv20_wall_moon_sheer_curtain', name: '月纱蝶影帘', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 4300, starValue: 13, icon: 'deco_lv20_wall_moon_sheer_curtain', desc: '挂墙半透明月光纱帘，香槟金帘杆与蝶影坠饰让墙面更轻盈', unlockRequirement: { level: 20 }, defaultScale: 1.8 },

  // ═══════ ⑪.3 Lv10-20 30件扩展家具：6 大主题套 + 9 件单品（NB2 批次，单件单提示词出图）
  // 主题：① 茶室禅意（Lv10-11，3 件） ② 蘑菇精灵（Lv12-15，4 件） ③ 法式咖啡烘焙（Lv13-16，4 件）
  //       ④ 古董图书（Lv15-18，4 件） ⑤ 极光晶莹（Lv17-19，3 件） ⑥ 云端漫游（Lv18-20，3 件）
  //       ⑦ 单件（Lv10-20，9 件，宠物/音乐/邮政/童趣/玻璃灯/墙窗/艺术大件）

  // —— 茶室禅意套（茶台 + 蒲团 + 水墨挂轴；适配复古/竹影屋）——
  { id: 'deco_lv10_table_zen_tea_low', name: '禅意茶台', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 950, starValue: 4, icon: 'deco_lv10_table_zen_tea_low', desc: '矮樱桃木茶台，青瓷茶具与一枝粉梅，安静茶席角落', unlockRequirement: { level: 10 }, defaultScale: 1.18, decorationPanelTab: 'furniture' },
  { id: 'deco_lv10_orn_zen_cushion_pair', name: '蒲团坐垫组', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 480, starValue: 2, icon: 'deco_lv10_orn_zen_cushion_pair', desc: '玫粉与抹茶绿圆蒲团，配茶台正合适', unlockRequirement: { level: 10 }, defaultScale: 0.95, decorationPanelTab: 'furniture' },
  { id: 'deco_lv11_wallart_zen_ink_scroll', name: '水墨竹影挂轴', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 1280, starValue: 4, icon: 'deco_lv11_wallart_zen_ink_scroll', desc: '宣纸卷轴绘水墨竹与一点粉梅，配暖木轴头', unlockRequirement: { level: 11 }, defaultScale: 1.40 },

  // —— 蘑菇精灵套（坐墩+圆桌+陈列屋+精灵丛；童话森林感，适配蝶屋竹影房）——
  { id: 'deco_lv12_orn_mushroom_stool_pair', name: '蘑菇坐墩组', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 1100, starValue: 4, icon: 'deco_lv12_orn_mushroom_stool_pair', desc: '一红一米双蘑菇坐墩，森系小客座', unlockRequirement: { level: 12 }, defaultScale: 0.85, decorationPanelTab: 'furniture' },
  { id: 'deco_lv13_table_mushroom_round', name: '蘑菇圆茶桌', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 1380, starValue: 5, icon: 'deco_lv13_table_mushroom_round', desc: '粉色蘑菇伞盖做桌面，奶白菌柄做底座', unlockRequirement: { level: 13 }, defaultScale: 0.9, decorationPanelTab: 'furniture' },
  { id: 'deco_lv14_shelf_mushroom_cottage', name: '蘑菇小屋陈列架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 2400, starValue: 8, icon: 'deco_lv14_shelf_mushroom_cottage', desc: '蘑菇屋造型陈列架，三层拱形格放小花盆', unlockRequirement: { level: 14 }, defaultScale: 1.35 },
  { id: 'deco_lv15_garden_mushroom_grove', name: '蘑菇精灵丛', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 2800, starValue: 9, icon: 'deco_lv15_garden_mushroom_grove', desc: '三色蘑菇与苔藓丛，配萤火虫提灯', unlockRequirement: { level: 15 }, defaultScale: 1.60, decorationPanelTab: 'garden' },

  // —— 法式咖啡烘焙套（甜品柜+手冲架+复古烤箱+马卡龙塔；适配复古花坊 confetti）——
  { id: 'deco_lv13_table_french_pastry_counter', name: '法式甜品玻璃柜', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 1850, starValue: 6, icon: 'deco_lv13_table_french_pastry_counter', desc: '奶薄荷柜身配玻璃罩，里面摆着马卡龙与小塔', unlockRequirement: { level: 13 }, defaultScale: 1.30, decorationPanelTab: 'furniture' },
  { id: 'deco_lv14_shelf_handbrew_coffee_bar', name: '手冲咖啡架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 2200, starValue: 7, icon: 'deco_lv14_shelf_handbrew_coffee_bar', desc: '蜜木双层架配手冲套与豆罐，店里多一个咖啡角', unlockRequirement: { level: 14 }, defaultScale: 1.30 },
  { id: 'deco_lv15_light_vintage_oven', name: '奶黄复古烤箱', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 2400, starValue: 8, icon: 'deco_lv15_light_vintage_oven', desc: '圆胖奶黄烤箱，玻璃门里看见可颂在烤', unlockRequirement: { level: 15 }, defaultScale: 0.65 },
  { id: 'deco_lv16_orn_macaron_tower', name: '马卡龙塔', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 1700, starValue: 5, icon: 'deco_lv16_orn_macaron_tower', desc: '三层瓷盘配粉黄紫蓝马卡龙，下午茶担当', unlockRequirement: { level: 16 }, defaultScale: 0.78 },

  // —— 古董图书套（书架+地球仪桌+切斯特皮椅+植物标本；dark academia，适配复古/月辉）——
  { id: 'deco_lv15_shelf_antique_library', name: '复古胡桃书架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 2900, starValue: 9, icon: 'deco_lv15_shelf_antique_library', desc: '维多利亚胡桃木书架，皮革精装书与黄铜地球仪', unlockRequirement: { level: 15 }, defaultScale: 1.45 },
  { id: 'deco_lv16_table_globe_writing_desk', name: '地球仪写字桌', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 3000, starValue: 9, icon: 'deco_lv16_table_globe_writing_desk', desc: '小巧胡桃木书桌，黄铜浑天仪、羽毛笔与压花玻璃罩', unlockRequirement: { level: 16 }, defaultScale: 1.08, decorationPanelTab: 'furniture' },
  { id: 'deco_lv17_orn_chesterfield_armchair', name: '切斯特皮扶手椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 3500, starValue: 11, icon: 'deco_lv17_orn_chesterfield_armchair', desc: '酒红绗缝皮扶手椅，配胡桃短腿与亚麻盖毯', unlockRequirement: { level: 17 }, defaultScale: 0.98, decorationPanelTab: 'furniture' },
  { id: 'deco_lv18_wallart_botanical_taxonomy', name: '植物标本框', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 1900, starValue: 6, icon: 'deco_lv18_wallart_botanical_taxonomy', desc: '胡桃画框配米色羊皮纸，六格压花标本无文字', unlockRequirement: { level: 18 }, defaultScale: 1.10 },

  // —— 极光晶莹套（镜面池+水晶球+落地灯；月光蝶园色系延伸）——
  { id: 'deco_lv17_garden_aurora_mirror_pond', name: '极光镜面池', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 5200, starValue: 15, icon: 'deco_lv17_garden_aurora_mirror_pond', desc: '奶白卵石围出极光水镜，浮叶莲与水晶星簇', unlockRequirement: { level: 17 }, defaultScale: 1.95, decorationPanelTab: 'garden' },
  { id: 'deco_lv18_orn_aurora_crystal_orb', name: '极光水晶球', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 2400, starValue: 7, icon: 'deco_lv18_orn_aurora_crystal_orb', desc: '玻璃球里漾着极光雾与小弦月，香槟金三脚架托起', unlockRequirement: { level: 18 }, defaultScale: 0.45 },
  { id: 'deco_lv19_light_aurora_floor_lantern', name: '极光落地灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 3200, starValue: 10, icon: 'deco_lv19_light_aurora_floor_lantern', desc: '香槟金细杆托起雾面玻璃灯罩，灯罩里流动极光蓝紫', unlockRequirement: { level: 19 }, defaultScale: 1.30 },

  // —— 云端漫游套（云朵软墩+棉花云中岛+云秋千；棉花糖粉蓝，适配粉蓝/月辉）——
  { id: 'deco_lv18_orn_cloud_pouf_set', name: '云朵软墩组', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 2200, starValue: 6, icon: 'deco_lv18_orn_cloud_pouf_set', desc: '一大一小云朵造型软墩，奶白与浅粉刺绣小星', unlockRequirement: { level: 18 }, defaultScale: 1.05, decorationPanelTab: 'furniture' },
  { id: 'deco_lv19_table_cloud_dessert_island', name: '棉花云中岛', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 3800, starValue: 12, icon: 'deco_lv19_table_cloud_dessert_island', desc: '云朵造型桌面带粉色糖霜流挂，香槟金弯腿与小甜点', unlockRequirement: { level: 19 }, defaultScale: 1, decorationPanelTab: 'furniture' },
  { id: 'deco_lv20_garden_cloud_swing', name: '云端长秋千', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 6500, starValue: 18, icon: 'deco_lv20_garden_cloud_swing', desc: '云朵长椅吊在香槟金 A 形架上，弦月坠与星形抱枕', unlockRequirement: { level: 20 }, defaultScale: 1.9, decorationPanelTab: 'garden' },

  // —— 单件家具：宠物/音乐/邮政/童趣/玻璃灯/墙窗/艺术大件 ——
  { id: 'deco_lv10_orn_kitten_bed', name: '奶油猫窝', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 420, starValue: 2, icon: 'deco_lv10_orn_kitten_bed', desc: '奶白绒毛甜甜圈猫窝，里面有针织球与粉毯', unlockRequirement: { level: 10 }, defaultScale: 0.72, decorationPanelTab: 'furniture' },
  { id: 'deco_lv11_orn_cat_tower', name: '樱桃猫爬架', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 1300, starValue: 4, icon: 'deco_lv11_orn_cat_tower', desc: '蜜木立柱+缠绳+樱桃形顶台与粉色软垫', unlockRequirement: { level: 11 }, defaultScale: 0.9, decorationPanelTab: 'furniture' },
  { id: 'deco_lv11_light_phonograph_vintage', name: '古董留声机', slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE, cost: 1100, starValue: 4, icon: 'deco_lv11_light_phonograph_vintage', desc: '胡桃木底座配黄铜花喇叭，唱针架在黑胶上', unlockRequirement: { level: 11 }, defaultScale: 0.65 },
  { id: 'deco_lv12_orn_pastel_postbox', name: '草莓邮筒', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 950, starValue: 3, icon: 'deco_lv12_orn_pastel_postbox', desc: '草莓粉立式邮筒，圆胖身段与小信件露出', unlockRequirement: { level: 12 }, defaultScale: 1 },
  { id: 'deco_lv13_orn_teddy_armchair', name: '泰迪熊扶手椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 1450, starValue: 5, icon: 'deco_lv13_orn_teddy_armchair', desc: '小熊造型椅背，焦糖蜜色绒面，配奶色小毯', unlockRequirement: { level: 13 }, defaultScale: 0.85, decorationPanelTab: 'furniture' },
  { id: 'deco_lv14_orn_carousel_music_box', name: '旋转木马音乐盒', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 2100, starValue: 7, icon: 'deco_lv14_orn_carousel_music_box', desc: '奶粉色基座配香槟金螺旋柱与三匹粉绿玫瑰木马', unlockRequirement: { level: 14 }, defaultScale: 0.65 },
  { id: 'deco_lv15_light_terrarium_lamp', name: '玻璃花房灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 2300, starValue: 7, icon: 'deco_lv15_light_terrarium_lamp', desc: '尖顶玻璃罩做小温室，里面有暖黄灯泡与小花苔藓', unlockRequirement: { level: 15 }, defaultScale: 0.65 },
  { id: 'deco_lv16_wallart_harbor_arch_window', name: '海港拱窗景', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 2500, starValue: 8, icon: 'deco_lv16_wallart_harbor_arch_window', desc: '奶白拱窗框里收着金色海港落日，有小帆船与玫瑰窗台', unlockRequirement: { level: 16 }, defaultScale: 1.30 },
  { id: 'deco_lv20_orn_white_grand_piano', name: '白色三角钢琴', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 7500, starValue: 20, icon: 'deco_lv20_orn_white_grand_piano', desc: '奶白漆三角钢琴，香槟金腿与玫瑰花束、水晶烛台', unlockRequirement: { level: 20 }, defaultScale: 1.5, decorationPanelTab: 'furniture' },

  // ═══════ ⑫ 蛋糕房专属家具（cake_shop 第三场景，参照蝴蝶小屋专属 Tab；首批 20 件可摆满一屋）
  // 风格锚点：奶油白 + 草莓粉 + 蜜木 + 薄荷绿 + 马卡龙糖果点缀；与世界地图 worldmap_thumb_cake_shop 粉瓦顶外观呼应。
  // 全部 decorationPanelTab='flower_room' + allowedSceneIds=['cake_shop']：仅在蛋糕房场景出现。
  { id: 'cake_shelf_layered_display',     name: '分层蛋糕展示柜', slot: DecoSlot.SHELF,    rarity: DecoRarity.LIMITED, cost: 3200, starValue: 11, icon: 'cake_shelf_layered_display',     desc: '蜜木+黄铜玻璃三层柜，奶油蛋糕与马卡龙的招牌门面', unlockRequirement: { level: 16 }, defaultScale: 1.5,  decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_shelf_baking_pantry',       name: '烘焙原料架',     slot: DecoSlot.SHELF,    rarity: DecoRarity.FINE,    cost: 1500, starValue: 5,  icon: 'cake_shelf_baking_pantry',       desc: '蜜木双层架配奶油盖玻璃罐：面粉、糖、可可与彩糖', unlockRequirement: { level: 15 }, defaultScale: 1.25, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_shelf_chilled_cabinet',     name: '草莓冷藏甜品柜', slot: DecoSlot.SHELF,    rarity: DecoRarity.RARE,    cost: 2400, starValue: 8,  icon: 'cake_shelf_chilled_cabinet',     desc: '粉色立柜玻璃门内排着马卡龙慕斯与小蛋糕', unlockRequirement: { level: 17 }, defaultScale: 1.18, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_shelf_fondant_flowers',     name: '翻糖花展示架',   slot: DecoSlot.SHELF,    rarity: DecoRarity.FINE,    cost: 1700, starValue: 6,  icon: 'cake_shelf_fondant_flowers',     desc: '奶白杆配三层圆台，摆着多彩翻糖花与糖珠', unlockRequirement: { level: 16 }, defaultScale: 1.05, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_table_workstation',         name: '甜品制作工作台', slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,    cost: 1600, starValue: 6,  icon: 'cake_table_workstation',         desc: '蜜木大理石台，搅拌钵、挤花袋与翻糖小球一字排开', unlockRequirement: { level: 15 }, defaultScale: 1.30, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_table_register_counter',    name: '蛋糕收银台',     slot: DecoSlot.TABLE,    rarity: DecoRarity.RARE,    cost: 2300, starValue: 8,  icon: 'cake_table_register_counter',    desc: '草莓粉柜身配大理石面，复古收银机与玻璃钟罩马卡龙', unlockRequirement: { level: 16 }, defaultScale: 1.30, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_table_round_dessert',       name: '甜品分享小圆桌', slot: DecoSlot.TABLE,    rarity: DecoRarity.COMMON,  cost: 850,  starValue: 3,  icon: 'cake_table_round_dessert',       desc: '奶白扇贝边圆桌，两份小蛋糕与单枝粉玫瑰', unlockRequirement: { level: 15 }, defaultScale: 1.05, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_table_gift_wrap',           name: '礼盒打包台',     slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,    cost: 1700, starValue: 6,  icon: 'cake_table_gift_wrap',           desc: '蜜木台面背靠多色缎带卷，奶油礼盒与黄铜剪刀', unlockRequirement: { level: 17 }, defaultScale: 1.18, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_table_dessert_island',      name: '甜点中岛长桌',   slot: DecoSlot.TABLE,    rarity: DecoRarity.RARE,    cost: 2700, starValue: 9,  icon: 'cake_table_dessert_island',      desc: '奶白长桌带粉色糖霜流挂，香槟金腿与一排小甜点', unlockRequirement: { level: 18 }, defaultScale: 1.40, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_light_pink_double_oven',    name: '草莓双门烤箱',   slot: DecoSlot.LIGHT,    rarity: DecoRarity.RARE,    cost: 2900, starValue: 10, icon: 'cake_light_pink_double_oven',    desc: '草莓粉立式双门烤箱，门内可见烤盘里的小蛋糕', unlockRequirement: { level: 16 }, defaultScale: 1.30, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_light_stand_mixer',         name: '粉色立式搅拌机', slot: DecoSlot.LIGHT,    rarity: DecoRarity.FINE,    cost: 1300, starValue: 5,  icon: 'cake_light_stand_mixer',         desc: '复古粉立式搅拌机，搅拌缸里堆着奶油尖', unlockRequirement: { level: 15 }, defaultScale: 0.65, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_light_pendant_macaron',     name: '马卡龙塔灯',     slot: DecoSlot.LIGHT,    rarity: DecoRarity.FINE,    cost: 1700, starValue: 6,  icon: 'cake_light_pendant_macaron',     desc: '奶白圆底盘配黄铜立柱，三层粉绿黄马卡龙灯罩柔光发亮', unlockRequirement: { level: 17 }, defaultScale: 1.25, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_light_chocolate_fountain',  name: '巧克力喷泉机',   slot: DecoSlot.LIGHT,    rarity: DecoRarity.RARE,    cost: 2400, starValue: 8,  icon: 'cake_light_chocolate_fountain',  desc: '黄铜螺旋柱与双层流挂巧克力，旁配草莓串与棉花糖', unlockRequirement: { level: 18 }, defaultScale: 0.95, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_orn_strawberry_stool_pair', name: '草莓坐墩组',     slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,    cost: 1100, starValue: 4,  icon: 'cake_orn_strawberry_stool_pair', desc: '一红一粉两只草莓造型小坐墩，绿叶萼配奶白细腿', unlockRequirement: { level: 15 }, defaultScale: 0.85, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_orn_wedding_cake_centerpiece', name: '婚礼蛋糕台',  slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 5800, starValue: 18, icon: 'cake_orn_wedding_cake_centerpiece', desc: '三层奶白翻糖蛋糕配粉玫瑰与糖珠，瓷台金边', unlockRequirement: { level: 20 }, defaultScale: 1.10, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_orn_donut_cushion_pair',    name: '甜甜圈坐垫组',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON,  cost: 700,  starValue: 3,  icon: 'cake_orn_donut_cushion_pair',    desc: '一大一小甜甜圈造型软垫，粉糖霜与巧克力两味', unlockRequirement: { level: 16 }, defaultScale: 1.00, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_orn_teddy_baker',           name: '烘焙小熊摆件',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,    cost: 1500, starValue: 5,  icon: 'cake_orn_teddy_baker',           desc: '焦糖蜜熊戴厨师帽抱奶油碗，店铺萌系吉祥物', unlockRequirement: { level: 17 }, defaultScale: 0.85, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_wallart_menu_chalkboard',   name: '蛋糕菜单黑板',   slot: DecoSlot.WALLART,  rarity: DecoRarity.FINE,    cost: 1100, starValue: 4,  icon: 'cake_wallart_menu_chalkboard',   desc: '奶粉扇贝木框配森林绿黑板，粉笔画蛋糕剪影与缎带', unlockRequirement: { level: 15 }, defaultScale: 1.20, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_wallart_lollipop_clock',    name: '棒棒糖挂钟',     slot: DecoSlot.WALLART,  rarity: DecoRarity.FINE,    cost: 1500, starValue: 5,  icon: 'cake_wallart_lollipop_clock',    desc: '粉绿白糖纹圆盘配奶白糖棒，黄铜指针无数字', unlockRequirement: { level: 16 }, defaultScale: 0.95, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_garden_strawberry_arch',    name: '草莓藤拱门',     slot: DecoSlot.GARDEN,   rarity: DecoRarity.LIMITED, cost: 4800, starValue: 14, icon: 'cake_garden_strawberry_arch',    desc: '奶白拱门缠满草莓藤与白花，门下两盆小草莓', unlockRequirement: { level: 17 }, defaultScale: 2.00, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },

  // ═══════ ⑪.5 首月签到活动专属家具（7/14/21/28 日签到 + 28 日累计礼包；免费赠予，starValue 必须为 0）
  { id: 'checkin_m1_bunny_ac', name: '兔兔云风空调', slot: DecoSlot.LIGHT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'checkin_m1_bunny_ac', desc: '兔耳立式空调，奶白机身配薄荷风口与小云朵冷气灯', unlockRequirement: { questId: 'checkin_m1_week1_bunny_ac', conditionText: '活动解锁', questDetailText: '签到奖励' }, defaultScale: 1.32 },
  { id: 'checkin_m1_crystal_partition', name: '水晶花影隔断', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'checkin_m1_crystal_partition', desc: '半透明水晶隔断屏，金色枝蔓与粉紫棱镜把花影分成彩光', unlockRequirement: { questId: 'checkin_m1_week2_crystal_partition', conditionText: '活动解锁', questDetailText: '签到奖励' }, defaultScale: 1.38 },
  { id: 'checkin_m1_moon_display_arch', name: '星月陈列拱架', slot: DecoSlot.SHELF, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'checkin_m1_moon_display_arch', desc: '月牙形金属拱架，星砂玻璃格里摆着迷你花瓶与香氛小盒', unlockRequirement: { questId: 'checkin_m1_week3_moon_display_arch', conditionText: '活动解锁', questDetailText: '签到奖励' }, defaultScale: 1.22 },
  { id: 'checkin_m1_butterfly_wall_lamp', name: '蝶影流光壁饰', slot: DecoSlot.WALLART, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'checkin_m1_butterfly_wall_lamp', desc: '玫瑰金墙饰托起半透明蝴蝶灯片，像暮光停在墙上', unlockRequirement: { questId: 'checkin_m1_week4_butterfly_wall_lamp', conditionText: '活动解锁', questDetailText: '签到奖励' }, defaultScale: 0.6 },
  { id: 'checkin_m1_dew_wish_fountain', name: '晨露许愿花池', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 1880, starValue: 7, icon: 'checkin_m1_dew_wish_fountain', desc: '贝壳形浅水花池，水晶露珠、睡莲与小星灯围出庭院清晨感', unlockRequirement: { level: 8 }, defaultScale: 1.48 },
  { id: 'checkin_m1_rocking_horse', name: '花园摇摇马', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'checkin_m1_rocking_horse', desc: '户外花园里的木质摇摇马玩具，彩绘马鞍、藤花与小风车一起摇出童话感', unlockRequirement: { questId: 'checkin_m1_28_rocking_horse', conditionText: '活动解锁', questDetailText: '签到奖励' }, defaultScale: 1.15 },

  // ═══════ ⑫ 熟客主题家具（V2：AffinityCardConfig.CUSTOMER_MILESTONE_REWARDS[12] decoUnlockId 解锁；100% 集齐图鉴时 grantQuest('affinity_<type>_codex_full') + gmUnlockDeco）
  // 注：starValue 必须为 0 — 这些是免费赠予的稀有家具，若计星会被「摆放→拆除→重摆」刷分；星星统一来自购买行为。
  { id: 'affinity_student_desk',         name: '校园书桌',     slot: DecoSlot.TABLE,    rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'affinity_student_desk',         desc: '小诗赠：法式田园奶白漆木 + 薰衣草荷叶边，黄铜鹅颈灯与薄荷玻璃罩，诗稿与压花静静摆开', defaultScale: 1.25, decorationPanelTab: 'furniture',   unlockRequirement: { questId: 'affinity_student_codex_full', conditionText: '集齐小诗图鉴', questDetailText: '集齐与小诗的 12 张友谊图鉴即可解锁' } },
  { id: 'affinity_worker_coffee_corner', name: '通勤咖啡角',   slot: DecoSlot.LIGHT,    rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'affinity_worker_coffee_corner', desc: '阿凯赠：深胡桃木台 + 紫铜意式机与磨豆机，悬一盏爱迪生灯泡，深夜加班的工业咖啡角',     defaultScale: 0.85, decorationPanelTab: 'furniture', hideInDecorationPanel: true,  unlockRequirement: { questId: 'affinity_worker_codex_full',  conditionText: '集齐阿凯图鉴', questDetailText: '集齐与阿凯的 12 张友谊图鉴即可解锁' } },
  { id: 'affinity_mom_balcony_rack',     name: '阳台花架',     slot: DecoSlot.SHELF,    rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'affinity_mom_balcony_rack',     desc: '林姐赠：维多利亚白色雕花铁艺三层架，玻璃斜顶小温室，兰、薰衣草与玫瑰随蝶起舞',         defaultScale: 1.20, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'], hideInDecorationPanel: true, unlockRequirement: { questId: 'affinity_mom_codex_full',     conditionText: '集齐林姐图鉴', questDetailText: '集齐与林姐的 12 张友谊图鉴即可解锁' } },
  { id: 'affinity_youth_book_rack',      name: '诗意书架',     slot: DecoSlot.SHELF,    rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'affinity_youth_book_rack',      desc: '小景赠：Dark academia 老胡桃书架，烫金牛血红诗集、古董相机、绿罩黄铜台灯与玻璃罩干花', defaultScale: 1.10, decorationPanelTab: 'furniture', hideInDecorationPanel: true,  unlockRequirement: { questId: 'affinity_youth_codex_full',   conditionText: '集齐小景图鉴', questDetailText: '集齐与小景的 12 张友谊图鉴即可解锁（赛季 2 上线）' } },
  { id: 'affinity_athlete_trophy_case',  name: '冠军奖杯柜',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'affinity_athlete_trophy_case',  desc: '小翼赠：学院 Varsity 浅枫木弧面玻璃柜，海军蓝呢绒衬底，铬银奖杯、奖牌与三角校旗',     defaultScale: 1.4, decorationPanelTab: 'furniture',   unlockRequirement: { questId: 'affinity_athlete_codex_full', conditionText: '集齐小翼图鉴', questDetailText: '集齐与小翼的 12 张友谊图鉴即可解锁' } },
  { id: 'affinity_celebrity_dressing_mirror', name: '星幕穿衣镜', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'affinity_celebrity_dressing_mirror', desc: '曜辰赠：香槟金落地穿衣镜，暖光灯泡环绕镜框，粉缎花结与香氛托盘把后台星光留在店里', defaultScale: 1.28, decorationPanelTab: 'furniture', unlockRequirement: { questId: 'affinity_celebrity_codex_full', conditionText: '集齐曜辰图鉴', questDetailText: '集齐与曜辰的 12 张友谊图鉴即可解锁' } },

  // ═══════ ⑬ 赛季限定大件家具（图鉴 100% 全集大奖；占位先用通用大件作 fallback，正式美术见 step4）
  { id: 'affinity_season_s1_signlight', name: '初春营业中招牌灯箱', slot: DecoSlot.LIGHT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'affinity_season_s1_signlight', desc: '初春繁花季 S1 全集大奖：浅金灯箱 + 粉樱字「营业中」，温暖灵动的店铺新灵魂', defaultScale: 1.3, decorationPanelTab: 'furniture', unlockRequirement: { questId: 'affinity_season_S1_complete', conditionText: '集齐 S1 全图鉴', questDetailText: '集齐初春繁花季所有客人 12×3=36 张友谊图鉴即可解锁' } },
];

// ======== 索引 & 工具函数 ========

/** 按 ID 查找装饰 */
export const DECO_MAP = new Map<string, DecoDef>(DECO_DEFS.map(d => [d.id, d]));

/** 获取某等级范围 (fromLevel, toLevel] 内按等级解锁的家具（用于升级弹窗展示） */
export function getDecosUnlockedInLevelRange(fromLevel: number, toLevel: number): DecoDef[] {
  return DECO_DEFS.filter(d => {
    const lv = d.unlockRequirement?.level;
    return lv !== undefined && lv > fromLevel && lv <= toLevel;
  });
}

/** 获取某等级范围 (fromLevel, toLevel] 内按等级解锁的房间风格 */
export function getRoomStylesUnlockedInLevelRange(fromLevel: number, toLevel: number): RoomStyleDef[] {
  return ROOM_STYLES.filter(s => {
    const lv = s.unlockRequirement?.level;
    return lv !== undefined && lv > fromLevel && lv <= toLevel;
  });
}

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
  /**
   * 房屋专属 Tab 中也会有沙发、躺椅、展示柜等大件；
   * 这些应按正常地面家具排序，不能套用「花房小摆件」前移逻辑。
   */
  if (
    deco.slot === DecoSlot.ORNAMENT &&
    deco.decorationPanelTab === 'flower_room' &&
    (deco.defaultScale ?? 1) > 0.92
  ) {
    return 0;
  }
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
    /** 房屋专属 Tab 的大件（如蝴蝶小屋沙发/藤椅）同样按地面大件处理 */
    if (deco.decorationPanelTab === 'flower_room' && (deco.defaultScale ?? 1) > 0.92) return 0;
    /** 地毯、矮地垫等小件贴地：勿抬高 sortFeetY，否则会整档压过同区域站立的店主 */
    if (deco.decorationPanelTab === 'furniture' && (deco.defaultScale ?? 1) < 0.58) return 0;
    return 95;
  }

  return 0;
}

// ═══════ 装修面板 / 托盘 Tab ═══════
// 房屋专属：仅 decorationPanelTab==='flower_room' 且通过 isDecoAllowedInScene。
// 家具：decorationPanelTab==='furniture' + 未显式分流的通用 shelf/table。
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

/** 编辑托盘 Tab（含房壳 room_styles，与图标表 7 列一致） */
export type FurnitureTrayTabId = DecoPanelTabId;

export const FURNITURE_TRAY_TABS: FurnitureTrayTabId[] = [
  'flower_room',
  'furniture',
  'appliance',
  DecoSlot.ORNAMENT,
  DecoSlot.WALLART,
  DecoSlot.GARDEN,
  'room_styles',
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
    return true;
  }
  return deco.allowedSceneIds.includes(sceneId);
}

export function isRoomStyleAllowedInScene(style: RoomStyleDef, sceneId: string): boolean {
  if (!style.allowedSceneIds?.length) {
    return sceneId === DECO_DEFAULT_SCENE_ID;
  }
  return style.allowedSceneIds.includes(sceneId);
}

export function getRoomStylesForScene(sceneId: string): RoomStyleDef[] {
  return ROOM_STYLES.filter((style) => isRoomStyleAllowedInScene(style, sceneId));
}

export function getDefaultRoomStyleIdForScene(sceneId: string): string {
  const scoped = getRoomStylesForScene(sceneId);
  const free = scoped.find((style) => style.cost === 0 && !style.unlockRequirement);
  if (free) return free.id;
  return scoped[0]?.id ?? 'style_default';
}

/** 卡片/Toast 短文案 */
export function formatAllowedScenesShort(deco: DecoDef): string {
  const ids = deco.allowedSceneIds;
  if (!ids?.length) return '限定场景';
  const names = ids.map(id => SCENE_MAP.get(id)?.name ?? id);
  return `仅${names.join('、')}`;
}

export function getDecorationTabLabel(tab: DecoPanelTabId, sceneId: string = DECO_DEFAULT_SCENE_ID): { name: string; emoji: string } {
  if (tab === 'room_styles') return { name: '房间风格', emoji: '' };
  if (tab === 'flower_room') return { name: SCENE_MAP.get(sceneId)?.name ?? '房屋专属', emoji: '' };
  if (tab === 'furniture') return { name: '家具', emoji: '' };
  if (tab === 'appliance') return { name: '家电', emoji: '' };
  return DECO_SLOT_INFO[tab];
}

/** 家具托盘 Tab → TextureCache 键（仅 idle 单图，与 `furniture_tray_tab_*_idle.png` 一致） */
export function furnitureTrayTabTextureKey(tab: FurnitureTrayTabId): string {
  switch (tab) {
    case 'flower_room':
      return 'furniture_tray_tab_flower_room_idle';
    case 'furniture':
      return 'furniture_tray_tab_furniture_idle';
    case 'appliance':
      return 'furniture_tray_tab_appliance_idle';
    case 'room_styles':
      return 'furniture_tray_tab_room_styles_idle';
    case DecoSlot.ORNAMENT:
      return 'furniture_tray_tab_ornament_idle';
    case DecoSlot.WALLART:
      return 'furniture_tray_tab_wallart_idle';
    case DecoSlot.GARDEN:
      return 'furniture_tray_tab_garden_idle';
    default:
      return 'furniture_tray_tab_flower_room_idle';
  }
}

/** 编辑托盘：由槽位推断 Tab（不含 decorationPanelTab 分流） */
export function furnitureTrayTabFromSlot(slot: DecoSlot): FurnitureTrayTabId {
  if (slot === DecoSlot.SHELF || slot === DecoSlot.TABLE) return 'furniture';
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
    return DECO_DEFS.filter((d) => {
      if (!inScene(d)) return false;
      if (d.decorationPanelTab === 'furniture') return true;
      if (d.decorationPanelTab === 'flower_room' || d.decorationPanelTab === 'garden') return false;
      return d.slot === DecoSlot.SHELF || d.slot === DecoSlot.TABLE;
    });
  }

  const slotMatch = (d: DecoDef): boolean => {
    if (tab === 'flower_room') {
      return d.decorationPanelTab === 'flower_room';
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
