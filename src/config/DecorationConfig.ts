import { AD_UNLOCK_DECO_IDS } from '@/config/AdConfig';

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
  /** 内部槽位：落地柜架、展示架、工作台等；装修面板归「家具」Tab（与 TABLE 相同，勿单独展示「花架」） */
  SHELF     = 'shelf',
  /** 内部槽位：桌台、柜台等；装修面板归「家具」Tab（勿单独展示「桌台」） */
  TABLE     = 'table',
  LIGHT     = 'light',      // 家电位（灯/冰箱/电视等；面板「家电」）
  ORNAMENT  = 'ornament',   // 摆件
  WALLART   = 'wallart',    // 墙饰
  GARDEN    = 'garden',     // 庭院
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
   * - 'qinglian' = 跨场景主题「清涟荷影」Tab
   */
  decorationPanelTab?: 'furniture' | 'flower_room' | 'garden' | 'qinglian';
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
   * 贴地地毯 / 地垫：恒排在房壳之上、其它家具之下（重叠时不遮挡桌椅屏几等）。
   */
  depthSortFloorMat?: boolean;
  /**
   * 高大家电/立柜顶面可摆小物：为 true 时，脚点落在其顶面附近的台面小物
   * 会在深度排序中抬到该件前面（否则小物脚点 y 远小于立柜，会被整机挡住）。
   */
  depthSortTopSurfaceHost?: boolean;
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
  /** 仅家具工坊制作获得；未拥有前不在装修商店展示 */
  workshopExclusive?: boolean;
  /** 可重复制作/拥有并在同一场景摆放多件；未设置时仍为单件家具 */
  stackable?: boolean;
  /** stackable 家具的最大拥有数；至少 1 */
  maxOwned?: number;
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

/**
 * 槽位 → 装修面板左侧 Tab 文案（与 DECO_PANEL_TABS 一致）。
 * SHELF / TABLE 在面板中均显示「家具」，不单独出现「花架」「桌台」分类。
 */
export const DECO_SLOT_INFO: Record<DecoSlot, { name: string; emoji: string }> = {
  [DecoSlot.SHELF]:    { name: '家具',   emoji: '' },
  [DecoSlot.TABLE]:    { name: '家具',   emoji: '' },
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
  { id: 'style_candy_nb2', name: '糖果花坊', cost: 600, starValue: 3, rarity: DecoRarity.FINE, bgTexture: 'bg_room_candy_nb2', desc: '糖果 pastel 硬装；室内宽条/大色块地坪，区别于细碎人字拼', unlockRequirement: { level: 3 }, allowedSceneIds: ['flower_shop'] },
  { id: 'style_bloom_nb2', name: '花境小筑', cost: 4799, starValue: 6, rarity: DecoRarity.FINE, bgTexture: 'bg_room_bloom_nb2', desc: '满开鲜花硬装与窗景，室内纯色大块地坪，温馨不撞糖果系', unlockRequirement: { level: 4 }, allowedSceneIds: ['flower_shop'] },
  { id: 'style_pinkblue_nb2', name: '粉蓝花坊', cost: 6240, starValue: 7, rarity: DecoRarity.FINE, bgTexture: 'bg_room_pinkblue_nb2', desc: '粉白蓝温馨风：短绒地毯、樱花形窗、新瓦型屋顶', unlockRequirement: { level: 5 }, allowedSceneIds: ['flower_shop'] },
  { id: 'style_lagoon_nb2', name: '海岛汽水', cost: 8280, starValue: 8, rarity: DecoRarity.RARE, bgTexture: 'bg_room_lagoon_nb2', desc: '青绿天蓝木瓜橙撞色，清新热带感', unlockRequirement: { level: 6 }, allowedSceneIds: ['flower_shop'] },
  { id: 'style_qinglian_lotus_shop_nb2', name: '清涟荷影花坊', cost: 0, starValue: 0, rarity: DecoRarity.LIMITED, bgTexture: 'bg_room_qinglian_lotus_shop_nb2', desc: '薄荷青瓦与祥云纹地坪的 L 形花坊壳，新手礼包限定', unlockRequirement: { questId: 'qinglian_newbie_gift_claimed', conditionText: '新手礼包', questDetailText: '完成新手礼包（观看 2 次广告）后解锁' }, allowedSceneIds: ['flower_shop'] },
  { id: 'style_confetti_nb2', name: '复古花坊', cost: 7500, starValue: 14, rarity: DecoRarity.LIMITED, bgTexture: 'bg_room_confetti_nb2', desc: '明亮复古花店：奶黄墙、豆沙绿与浅橡木，大格地面不暗沉', unlockRequirement: { level: 7 }, allowedSceneIds: ['flower_shop'] },
  { id: 'style_butterfly_house_nb2', name: '蝴蝶小屋原木壳', cost: 0, starValue: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_butterfly_house_nb2', desc: '蝴蝶小屋默认房壳：浅木结构、干净墙面与观蝶空间', allowedSceneIds: ['butterfly_house'] },
  { id: 'style_butterfly_house_bamboo_nb2', name: '竹影蝶屋', cost: 4200, starValue: 8, rarity: DecoRarity.FINE, bgTexture: 'bg_room_butterfly_house_bamboo_nb2', desc: '竹艺暖色房壳：蜂蜜竹柱、鼠尾草屋檐与蝶翼木拼地面', unlockRequirement: { level: 11 }, allowedSceneIds: ['butterfly_house'] },
  { id: 'style_butterfly_house_moon_nb2', name: '月辉蝶馆', cost: 7800, starValue: 12, rarity: DecoRarity.RARE, bgTexture: 'bg_room_butterfly_house_moon_nb2', desc: '月光玻璃感房壳：冷紫屋檐、月石地面与更清透的观蝶氛围', unlockRequirement: { level: 13 }, allowedSceneIds: ['butterfly_house'] },
  { id: 'style_butterfly_house_xianqi_nb2', name: '云檐蝶舍', cost: 5400, starValue: 9, rarity: DecoRarity.FINE, bgTexture: 'bg_room_butterfly_house_xianqi_nb2', desc: '仙气 pastel 茶寮风替换壳：浅木竹柱、青瓷挑檐与竹席云纹地坪', unlockRequirement: { level: 12 }, allowedSceneIds: ['butterfly_house'] },
  { id: 'style_cake_shop_modern_nb2', name: '奶油甜品屋', cost: 0, starValue: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_cake_shop_modern_nb2', desc: '蛋糕房默认壳：现代 pastel 甜品店，奶油白墙、草莓粉圆角边与玻璃天窗', allowedSceneIds: ['cake_shop'] },
  { id: 'style_cake_shop_blueberry_mint_nb2', name: '蓝莓薄荷屋', cost: 8200, starValue: 10, rarity: DecoRarity.FINE, bgTexture: 'bg_room_cake_shop_blueberry_mint_nb2', desc: '蛋糕房换色壳：蓝莓薰衣草边框、薄荷玻璃天窗与奶油马卡龙地砖', unlockRequirement: { level: 18 }, allowedSceneIds: ['cake_shop'] },
  { id: 'style_tea_house_two_story_nb2', name: '仙茶小楼', cost: 0, starValue: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_tea_house_xianqi_two_story_nb2', desc: '茶香小院默认壳：轻盈 pastel 仙气双层茶寮，青玉屋瓦、回廊与明亮茶院空间', allowedSceneIds: ['tea_house'] },
  { id: 'style_tea_house_darkwood_two_story_nb2', name: '乌木茶寮', cost: 43000, starValue: 14, rarity: DecoRarity.FINE, bgTexture: 'bg_room_tea_house_darkwood_two_story_nb2', desc: '深色红木双层茶寮：乌木柱栏、黛青屋瓦与暖 cream 地砖，配古风家具更显沉稳', unlockRequirement: { level: 26 }, allowedSceneIds: ['tea_house'] },
  { id: 'style_forest_treehouse_oak_nb2', name: '橡树心舍', cost: 0, starValue: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_forest_treehouse_oak_nb2', desc: '橡树小屋默认壳：巨橡树干贯穿双层、苔藓木瓦与年轮地坪，童话森林树屋 cutaway', allowedSceneIds: ['forest_treehouse'] },
  { id: 'style_forest_treehouse_spring_bloom_nb2', name: '春花藤巢', cost: 64500, starValue: 18, rarity: DecoRarity.FINE, bgTexture: 'bg_room_forest_treehouse_spring_bloom_nb2', desc: '春日换色壳：巨橡抽新芽，粉黄紫爬藤绕干，薄荷春花瓦檐与屋顶鸟巢', unlockRequirement: { level: 33 }, allowedSceneIds: ['forest_treehouse'] },
  { id: 'style_garden_villa_manor_nb2', name: '花园阁楼', cost: 0, starValue: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_garden_villa_loft_nb2', desc: '花园别墅默认壳：现代洋房错层空壳，正面敞开无窗，仅后墙右墙+前左一层后右二层错开', allowedSceneIds: ['garden_villa'] },
  { id: 'style_dream_cloud_two_story_nb2', name: '梦云蓝居', cost: 0, starValue: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_dream_cloud_two_story_nb2', desc: '梦云小屋默认壳：浅蓝云上卧室空壳，圆拱云墙、开阔双层平台与右侧云梯', allowedSceneIds: ['dream_cloud_house'] },
  {
    id: 'style_dream_cloud_purple_mooncradle_nb2', name: '紫月云台', cost: 86666, starValue: 12, rarity: DecoRarity.FINE, bgTexture: 'bg_room_dream_cloud_purple_mooncradle_nb2', desc: '梦云小屋换色壳：粉紫月云双层空壳，月石地面、星月吊饰与云梯围栏更梦幻', unlockRequirement: { level: 22 }, allowedSceneIds: ['dream_cloud_house'] },
  { id: 'style_flower_farm_cottage_nb2', name: '日光小院', cost: 0, starValue: 0, rarity: DecoRarity.COMMON, bgTexture: 'bg_room_flower_farm_courtyard_sunny_nb2', desc: '花田农舍默认壳：等距日光户外小院，轻描边、贴地院落，木平台与土院地面', allowedSceneIds: ['flower_farm_house'] },
  { id: 'style_flower_farm_spring_vine_nb2', name: '青藤春棚', cost: 72000, starValue: 15, rarity: DecoRarity.FINE, bgTexture: 'bg_room_flower_farm_spring_vine_nb2', desc: '春日换色壳：常春藤爬墙、浅绿木瓦与 mint spring 氛围', unlockRequirement: { level: 31 }, allowedSceneIds: ['flower_farm_house'] },
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
// 花愿 cost：无玩家等级门槛 ×1.32；unlock level 2–4 再 ×1.15；level ≥5 再 ×1.06；取整到 5。付费房间风格见 ROOM_STYLES 另 ×1.06。starValue 1/2 档家具在基准上再约 ×1.1 取整到 5（与 StarLevelConfig 早期升星门槛微调配套）。Lv10–20 有售价家具另整体 ×1.05 取整到 5；Lv20–30 有售价家具另整体 ×0.9 取整到 5；Lv30–40 有售价家具另整体 ×0.9 取整到 5 且 starValue +1。

export const DECO_DEFS: DecoDef[] = [

  // ═══════ ① 花架 / 展示架 (shelf) ═══════
  // 入门花架：低价带仍便于首周入手，但整体高于旧版（约多攒数单）
  { id: 'shelf_wood',    name: '简约木花架',  slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 5, starValue: 2, icon: 'shelf_wood',   desc: '三层原木架，朴素实用', defaultScale: 1.5, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'shelf_step',    name: '阶梯花架',    slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 655, starValue: 2, icon: 'shelf_step',   desc: '层层叠叠，像小山丘', unlockRequirement: { level: 2 }, defaultScale: 1.35 },
  { id: 'shelf_long',    name: '长条花台',    slot: DecoSlot.SHELF, rarity: DecoRarity.FINE,   cost: 835, starValue: 2, icon: 'shelf_long',   desc: '靠墙摆放的温馨花台', unlockRequirement: { level: 5 }, defaultScale: 1.25, decorationPanelTab: 'garden' },
  { id: 'shelf_iron',    name: '铁艺旋转架',  slot: DecoSlot.SHELF, rarity: DecoRarity.COMMON, cost: 1305, starValue: 3, icon: 'shelf_iron',   desc: '优雅的法式铁艺风格', unlockRequirement: { level: 7 }, defaultScale: 1.5 },
  { id: 'shelf_glass',   name: '玻璃展示柜',  slot: DecoSlot.SHELF, rarity: DecoRarity.RARE,   cost: 3525, starValue: 6, icon: 'shelf_glass',  desc: '高端玻璃门展示柜', unlockRequirement: { level: 10 }, defaultScale: 1.45 },

  // ═══════ ② 桌台 / 工作台 (table) ═══════
  { id: 'table_counter',  name: '木质收银台',  slot: DecoSlot.TABLE, rarity: DecoRarity.COMMON, cost: 260, starValue: 3, icon: 'table_counter', desc: '温暖的原木收银台', defaultScale: 1.13 },
  { id: 'table_drawer',   name: '抽屉式柜台',  slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 2015, starValue: 4, icon: 'table_drawer',  desc: '带抽屉的实用柜台', unlockRequirement: { level: 9 }, defaultScale: 1.23 },
  { id: 'table_work',     name: '花艺工作台',  slot: DecoSlot.TABLE, rarity: DecoRarity.FINE,   cost: 1565, starValue: 2, icon: 'table_work',    desc: '蜜木双层台，瓶瓶罐罐都是好看的花', unlockRequirement: { level: 6 }, defaultScale: 1.38 },
  { id: 'table_marble',   name: '大理石桌',    slot: DecoSlot.TABLE, rarity: DecoRarity.RARE,   cost: 2840, starValue: 7, icon: 'table_marble',  desc: '冷峻优雅的大理石面', unlockRequirement: { level: 9 }, defaultScale: 1.38, decorationPanelTab: 'furniture' },

  // ═══════ ③ 灯具 (light) ═══════
  { id: 'light_desk',     name: '台灯',        slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 195, starValue: 2,  icon: 'light_desk',    desc: '简约台灯，温暖光芒', unlockRequirement: { level: 2 }, defaultScale: 0.43 },
  { id: 'light_floor',    name: '晶石立灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 360, starValue: 1, icon: 'light_floor',   desc: '淡蓝晶石立灯，实心乳白质感易抠图', unlockRequirement: { level: 3 }, defaultScale: 1.25 },
  { id: 'light_pendant',  name: '花式吊灯',    slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE,   cost: 1190, starValue: 2, icon: 'light_pendant', desc: '花朵造型的精美吊灯', unlockRequirement: { level: 6 }, defaultScale: 1.05 },
  { id: 'light_crystal',  name: '水晶灯',      slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE,   cost: 3375, starValue: 4, icon: 'light_crystal', desc: '华丽的水晶折射光芒', unlockRequirement: { level: 10 }, defaultScale: 1.1 },

  // ═══════ ④ 摆件 / 装饰品 (ornament) ═══════
  { id: 'orn_pot',        name: '藤编收纳篮',  slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 165, starValue: 2,  icon: 'orn_pot',       desc: '手编篮配干花丝带，非盆栽', unlockRequirement: { level: 2 }, defaultScale: 0.63 },
  { id: 'orn_vase',       name: '花瓶',        slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 306, starValue: 1, icon: 'orn_vase',      desc: '插一枝花就很美', unlockRequirement: { level: 4 }, defaultScale: 0.53 },
  { id: 'orn_fountain',   name: '迷你喷泉',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 1565, starValue: 2, icon: 'orn_fountain',  desc: '轻线稿小喷泉，卵石底无方格地台', unlockRequirement: { level: 6 }, defaultScale: 1.2, decorationPanelTab: 'garden' },
  { id: 'orn_candle',     name: '香薰蜡烛',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 215, starValue: 1, icon: 'orn_candle',    desc: '圆肚玻璃罐里的樱粉蜡，金边与白玫瑰贴花', defaultScale: 0.26 },
  { id: 'orn_clock',      name: '复古挂钟',    slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 1715, starValue: 5, icon: 'orn_clock',     desc: '滴答滴答的复古时光', unlockRequirement: { level: 8 }, defaultScale: 0.55 },
  { id: 'orn_fireplace',  name: '壁炉',        slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 1295, starValue: 2, icon: 'orn_fireplace', desc: '砖木壁炉柔线稿，台面双瓶花', unlockRequirement: { level: 5 }, defaultScale: 1.35, decorationPanelTab: 'furniture' },

  // ═══════ ⑤ 墙饰 / 挂件 (wallart) ═══════
  { id: 'wallart_plant',  name: '植物壁挂',    slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 265, starValue: 2,  icon: 'wallart_plant',  desc: '墙上的一抹绿意', unlockRequirement: { level: 2 }, defaultScale: 0.93 },
  { id: 'wallart_frame',  name: '装饰画框',    slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 420, starValue: 1, icon: 'wallart_frame',  desc: '小花野趣装饰画，等距墙面透视', unlockRequirement: { level: 3 }, defaultScale: 0.73 },
  { id: 'wallart_wreath', name: '花环壁饰',    slot: DecoSlot.WALLART, rarity: DecoRarity.FINE,   cost: 560, starValue: 2, icon: 'wallart_wreath', desc: '鲜粉玫瑰与绿叶编织的花环，粉缎蝴蝶结', defaultScale: 0.81 },
  { id: 'wallart_relief', name: '艺术浮雕',    slot: DecoSlot.WALLART, rarity: DecoRarity.RARE,   cost: 3970, starValue: 3, icon: 'wallart_relief', desc: '精致的花卉浮雕壁饰', unlockRequirement: { level: 10 }, defaultScale: 0.67 },
  { id: 'wallart_window_meadow_arch', name: '拱窗花野景', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 3585, starValue: 4, icon: 'wallart_window_meadow_arch', desc: '奶油木拱窗里收进一片花野与蝶影', unlockRequirement: { level: 10 }, defaultScale: 1.32 },
  { id: 'wallart_window_lake_round',  name: '圆窗湖雾景', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 6000, starValue: 6, icon: 'wallart_window_lake_round',  desc: '复古圆窗映着薄雾湖景，像温室外的安静清晨', unlockRequirement: { level: 12 }, defaultScale: 1.28 },

  // ═══════ ⑥ 庭院 / 户外 (garden) ═══════
  { id: 'garden_flowerbed', name: '小花圃',    slot: DecoSlot.GARDEN, rarity: DecoRarity.COMMON, cost: 200, starValue: 1,  icon: 'garden_flowerbed', desc: '门前的一小片花圃', defaultScale: 1.28 },
  { id: 'garden_arbor',    name: '藤蔓凉亭',   slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE,   cost: 1735, starValue: 2, icon: 'garden_arbor',    desc: '紫藤木亭轻线稿，自然草边', unlockRequirement: { level: 5 }, defaultScale: 2 },
  { id: 'garden_arch',     name: '玫瑰花廊',   slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE,   cost: 3770, starValue: 9, icon: 'garden_arch',     desc: '双拱玫瑰廊轻线稿，无菱形草皮', unlockRequirement: { level: 7 }, defaultScale: 2.13 },
  { id: 'garden_zen',      name: '日式枯山水', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 2140, starValue: 6, icon: 'garden_zen',      desc: '柔线枯山水浅皿，无硬方框', unlockRequirement: { level: 8 }, defaultScale: 1.63 },

  // ═══════ ⑦ 花店扩展家具（NB2 批次，画风与房间壳一致；缩放可后续 GM 校准）═══════
  { id: 'shelf_terracotta',   name: '陶盆阶梯花架', slot: DecoSlot.SHELF,    rarity: DecoRarity.FINE,   cost: 768,  starValue: 2, icon: 'shelf_terracotta',   desc: '粉陶盆叠成阶梯，小清新绿植', unlockRequirement: { level: 3 },  defaultScale: 0.68 },
  { id: 'table_wrap_station', name: '花艺包装台',   slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,   cost: 480,  starValue: 1, icon: 'table_wrap_station', desc: '粉点彩纸卷、花束与丝带，包装角一眼能认', unlockRequirement: { level: 3 },  defaultScale: 1.3 },
  { id: 'table_rattan_twoset', name: '藤编边桌凳组', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE,   cost: 799,  starValue: 3, icon: 'table_rattan_twoset', desc: '圆几配双凳，度假风下午茶', unlockRequirement: { level: 3 }, defaultScale: 1.13, decorationPanelTab: 'furniture' },
  { id: 'light_plant_strip',  name: '植物补光灯',   slot: DecoSlot.LIGHT,   rarity: DecoRarity.FINE,   cost: 1130,  starValue: 2, icon: 'light_plant_strip',  desc: '阴天也给小花一点阳光', unlockRequirement: { level: 7 },  defaultScale: 0.57 },
  { id: 'orn_window_garden',  name: '窗台花园组',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 1740,  starValue: 2, icon: 'orn_window_garden',  desc: '三盆小花排排站', unlockRequirement: { level: 6 }, defaultScale: 0.87 },
  { id: 'orn_awaken_bucket',  name: '金属醒花桶',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 726, starValue: 2, icon: 'orn_awaken_bucket',  desc: '深水养花，把花叫醒', unlockRequirement: { level: 3 }, defaultScale: 0.57, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'orn_floral_chest',   name: '花艺工具箱',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 276, starValue: 1, icon: 'orn_floral_chest',   desc: '剪刀麻绳小喷壶', unlockRequirement: { level: 4 }, defaultScale: 0.87, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'orn_pastel_bench',   name: '马卡龙长凳',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 555, starValue: 4, icon: 'orn_pastel_bench',   desc: '薄荷木色配珊瑚软垫', unlockRequirement: { level: 2 }, defaultScale: 1.1, decorationPanelTab: 'furniture' },

  // ═══════ ④.5 鲜花摆件批次 11（全场景「摆件」Tab，7 级起每级解锁一件）═══════
  { id: 'orn_flora_blooming_cactus', name: '开花仙人球', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 7800, starValue: 1, icon: 'orn_flora_blooming_cactus', desc: '陶盆里的圆滚滚仙人掌，顶着一朵艳粉花', unlockRequirement: { level: 7 }, defaultScale: 0.52 },
  { id: 'orn_flora_fern_terrarium', name: '蕨类生态瓶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 9720, starValue: 1, icon: 'orn_flora_fern_terrarium', desc: '软木塞玻璃罐里迷你苔藓与蕨叶', unlockRequirement: { level: 8 }, defaultScale: 0.48 },
  { id: 'orn_flora_hyacinth_glass_vase', name: '风信子水培瓶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 11760, starValue: 2, icon: 'orn_flora_hyacinth_glass_vase', desc: '球形玻璃瓶里紫粉风信子簇', unlockRequirement: { level: 9 }, defaultScale: 0.72 },
  { id: 'orn_flora_wildflower_mason_jar', name: '野花花束罐', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 13920, starValue: 1, icon: 'orn_flora_wildflower_mason_jar', desc: '蓝色梅森罐扎着虞美人与矢车菊', unlockRequirement: { level: 10 }, defaultScale: 0.76 },
  { id: 'orn_flora_lavender_window_box', name: '薰衣草长条盆', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 9000, starValue: 2, icon: 'orn_flora_lavender_window_box', desc: '白漆木窗盒里一排紫色薰衣草', unlockRequirement: { level: 11 }, defaultScale: 1.18, depthSortFeetYFudge: 0, depthSortYLift: 0 },
  { id: 'orn_flora_hanging_spider_plant', name: '吊兰挂盆', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 10000, starValue: 1, icon: 'orn_flora_hanging_spider_plant', desc: '白绳编织吊盆，斑纹吊兰垂下来', unlockRequirement: { level: 12 }, defaultScale: 1.12 },
  { id: 'orn_flora_cherry_branch_vase', name: '樱花折枝瓶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 11000, starValue: 2, icon: 'orn_flora_cherry_branch_vase', desc: '青瓷高瓶插一枝盛放的樱花', unlockRequirement: { level: 13 }, defaultScale: 0.98 },
  { id: 'orn_flora_hanging_petunia', name: '矮牵牛吊篮', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 12000, starValue: 1, icon: 'orn_flora_hanging_petunia', desc: '藤编吊篮里粉紫矮牵牛瀑布般垂落', unlockRequirement: { level: 14 }, defaultScale: 0.95 },
  { id: 'orn_flora_wall_ivy_trellis', name: '爬墙常春藤架', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 13000, starValue: 2, icon: 'orn_flora_wall_ivy_trellis', desc: '木格栅上攀着翠藤与小紫花', unlockRequirement: { level: 15 }, defaultScale: 1.15 },
  { id: 'orn_flora_fiddle_leaf_pot', name: '琴叶榕大绿植', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 14000, starValue: 1, icon: 'orn_flora_fiddle_leaf_pot', desc: '高筒奶油陶盆里的琴叶榕，一角立刻变森系', unlockRequirement: { level: 16 }, defaultScale: 1.18 },
  { id: 'orn_flora_pink_phalaenopsis_pot', name: '粉蝶兰丛盆', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 15000, starValue: 2, icon: 'orn_flora_pink_phalaenopsis_pot', desc: '小紫盆上多梗盛放的粉色蝴蝶兰，唇瓣形态准确', unlockRequirement: { level: 17 }, defaultScale: 0.88 },
  // 宣传款：仅广告解锁购买资格 + 花愿购买，不设花店等级门槛（见 AdConfig.AD_UNLOCK_DECO_IDS）
  { id: 'promo_floral_sofa',  name: '花漾木扶手沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 299, starValue: 6, icon: 'promo_floral_sofa', desc: '宣传图同款浅木扶手双人沙发，碎花抱枕很适合休息角', defaultScale: 1.18, decorationPanelTab: 'furniture' },

  // ═══════ 家具工坊专属（workshopExclusive：仅制作获得，不进直购）═══════
  { id: 'workshop_plush_green_sofa', name: '弧翼大沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 9, icon: 'workshop_plush_green_sofa', desc: '工坊匠心：明亮春绿三人沙发，双侧胡桃木扶手，橙白撞色抱枕', workshopExclusive: true, defaultScale: 2.08, decorationPanelTab: 'furniture' },
  { id: 'workshop_plush_sofa_sakura', name: '樱粉弧翼大沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 9, icon: 'workshop_plush_sofa_sakura', desc: '工坊染色：樱粉软绒沙发，浅黄与粉紫抱枕，同款弧翼造型', workshopExclusive: true, defaultScale: 1.88, decorationPanelTab: 'furniture' },
  { id: 'workshop_plush_sofa_blue', name: '海蓝弧翼大沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 9, icon: 'workshop_plush_sofa_blue', desc: '工坊染色：海蓝软绒沙发，橙陶与紫白条纹抱枕，同款弧翼造型', workshopExclusive: true, defaultScale: 2.08, decorationPanelTab: 'furniture' },
  { id: 'workshop_puffy_petal_sofa', name: '泡芙拼块沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 10, icon: 'workshop_puffy_petal_sofa', desc: '工坊匠心：泡芙感拼块沙发，樱粉与奶白软垫叠层，低趴治愈风', workshopExclusive: true, defaultScale: 1.95, decorationPanelTab: 'furniture' },
  { id: 'workshop_rose_cascade_drape', name: '玫瑰垂幔帘', slot: DecoSlot.WALLART, rarity: DecoRarity.LIMITED, cost: 0, starValue: 8, icon: 'workshop_rose_cascade_drape', desc: '工坊匠心：高挑玫瑰隔断帘，樱粉布面与玫瑰点缀，中间与底部留空', workshopExclusive: true, defaultScale: 2.05, decorationPanelTab: 'furniture' },
  { id: 'workshop_rose_cascade_drape_moon', name: '天蓝玫瑰垂幔帘', slot: DecoSlot.WALLART, rarity: DecoRarity.LIMITED, cost: 0, starValue: 8, icon: 'workshop_rose_cascade_drape_moon', desc: '工坊染色：天蓝垂幔帘，薰衣草紫玫瑰点缀，同款飘逸隔断造型', workshopExclusive: true, defaultScale: 2.05, decorationPanelTab: 'furniture' },
  { id: 'workshop_rose_cascade_drape_honey', name: '蜜黄玫瑰垂幔帘', slot: DecoSlot.WALLART, rarity: DecoRarity.LIMITED, cost: 0, starValue: 8, icon: 'workshop_rose_cascade_drape_honey', desc: '工坊染色：蜜黄垂幔帘，绯红玫瑰点缀，同款飘逸隔断造型', workshopExclusive: true, defaultScale: 2.05, decorationPanelTab: 'furniture' },
  { id: 'workshop_lace_ribbon_bed', name: '蕾丝铁艺床', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 7, icon: 'workshop_lace_ribbon_bed', desc: '工坊匠心：白色卷曲铁艺床架，樱粉荷叶边床品与心形抱枕', workshopExclusive: true, defaultScale: 2.05, decorationPanelTab: 'furniture' },
  { id: 'workshop_giant_rose_bouquet', name: '大捧玫瑰', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 8, icon: 'workshop_giant_rose_bouquet', desc: '工坊匠心：瓷瓶超大捧红玫瑰，满天星与飞燕草点缀，单击含苞与盛放切换', workshopExclusive: true, defaultScale: 0.95, decorationPanelTab: 'furniture', depthSortFeetYFudge: 110, depthSortYLift: 140 },
  { id: 'workshop_pastel_tv_cabinet', name: '黑色超薄电视柜', slot: DecoSlot.LIGHT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 15, icon: 'workshop_pastel_tv_cabinet', desc: '工坊匠心：大屏超薄黑框电视 + 暖木三格电视柜，落地摆放可四面旋转', workshopExclusive: true, defaultScale: 1.68 },
  { id: 'workshop_summer_lotus_arch_window', name: '夏日荷塘拱窗', slot: DecoSlot.WALLART, rarity: DecoRarity.LIMITED, cost: 0, starValue: 9, icon: 'workshop_summer_lotus_arch_window', desc: '工坊匠心：香槟金拱门垂薄荷纱帘，门内一池粉荷与柳影，鸟笼花饰点缀', workshopExclusive: true, defaultScale: 1.98, decorationPanelTab: 'furniture' },
  { id: 'workshop_mint_bougainvillea_bay_window', name: '薄荷暖阳飘窗', slot: DecoSlot.WALLART, rarity: DecoRarity.LIMITED, cost: 0, starValue: 10, icon: 'workshop_mint_bougainvillea_bay_window', desc: '工坊染色：薄荷蓝飘窗座，凹进窗台显空间感，窗外粉紫三角梅', workshopExclusive: true, defaultScale: 2.52, decorationPanelTab: 'furniture' },
  { id: 'workshop_willow_wood_bay_window', name: '暖阳飘窗', slot: DecoSlot.WALLART, rarity: DecoRarity.LIMITED, cost: 0, starValue: 10, icon: 'workshop_willow_wood_bay_window', desc: '工坊匠心：暖木细框飘窗座，黄油黄抱枕，窗外垂柳疏影', workshopExclusive: true, defaultScale: 2.52, decorationPanelTab: 'furniture' },
  { id: 'workshop_summer_dining_chair', name: '夏日餐椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 7, icon: 'workshop_summer_dining_chair', desc: '工坊匠心：蜜色木框配薄荷绿坐垫，落地可四面旋转，适合围着夏日餐桌摆', workshopExclusive: true, stackable: true, maxOwned: 4, defaultScale: 0.85, decorationPanelTab: 'furniture' },

  { id: 'promo_wood_tea_table', name: '原木花茶几', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 359, starValue: 2, icon: 'promo_wood_tea_table', desc: '厚木板小茶几，摆一杯花茶就有午后感', defaultScale: 0.98, decorationPanelTab: 'furniture' },
  { id: 'promo_petal_chaise', name: '花瓣奶油躺椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 920, starValue: 5, icon: 'promo_petal_chaise', desc: '奶油躺椅配花瓣靠背，午后小憩像躺进花心里', defaultScale: 1.15, decorationPanelTab: 'furniture' },
  { id: 'promo_mint_fridge', name: '薄荷小冰箱', slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE, cost: 780, starValue: 4, icon: 'promo_mint_fridge', desc: '圆角复古冰箱，冰饮和鲜花都能清清爽爽', defaultScale: 1.08 },
  // ═══════ 前期精致厨居线（Lv2–7：吸引新手，售价略高于同级）═══════
  { id: 'early_blush_vine_sofa', name: '藤蔓粉沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 1580, starValue: 5, icon: 'early_blush_vine_sofa', desc: '樱粉软绒双人沙发，奶油坐垫与绿藤点缀，休息角立刻变精致', unlockRequirement: { level: 2 }, defaultScale: 1.58, decorationPanelTab: 'furniture' },
  { id: 'early_oak_island', name: '蜜木岛台', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 2080, starValue: 4, icon: 'early_oak_island', desc: '空台面蜜色原木岛台，干净好摆，和初级木作很搭', unlockRequirement: { level: 3 }, defaultScale: 1.28, decorationPanelTab: 'furniture' },
  { id: 'early_sky_vine_tea_table', name: '晴空茶几', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 1280, starValue: 3, icon: 'early_sky_vine_tea_table', desc: '天蓝双层圆角茶几，奶油台面留白，适合配藤蔓粉沙发', unlockRequirement: { level: 4 }, defaultScale: 0.85, decorationPanelTab: 'furniture' },
  { id: 'early_sage_sink_cabinet', name: '青木水池柜', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 2680, starValue: 5, icon: 'early_sage_sink_cabinet', desc: '豆沙绿柜身配暖木台面与白瓷水槽，台面干净无杂物', unlockRequirement: { level: 5 }, defaultScale: 1.22, decorationPanelTab: 'furniture' },
  { id: 'early_ruby_tall_fridge', name: '红宝石冰箱', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 3280, starValue: 6, icon: 'early_ruby_tall_fridge', desc: '高挑酒红双门冰箱，金把手与小花磁贴，比迷你冰箱气派得多', unlockRequirement: { level: 6 }, defaultScale: 1.55, depthSortTopSurfaceHost: true },
  { id: 'early_glass_bead_partition', name: '琉璃珠隔断', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 3080, starValue: 5, icon: 'early_glass_bead_partition', desc: '高挑挂墙隔断，薄荷玻璃砖与珠帘把墙面轻轻分开', unlockRequirement: { level: 7 }, defaultScale: 2.25 },
  { id: 'promo_doll_hug_pillow', name: '兔兔抱枕玩偶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 560, starValue: 3, icon: 'promo_doll_hug_pillow', desc: '抱着粉心枕的软萌兔兔，角落立刻变可爱', defaultScale: 0.62 },
  { id: 'promo_pearl_bead_curtain', name: '珍珠花珠帘', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 680, starValue: 3, icon: 'promo_pearl_bead_curtain', desc: '珍珠、花珠和薄荷小叶串成的温柔墙饰', defaultScale: 1.95 },
  // 花间珠匣活动奖励：通过活动进度发放，花愿售价与星值均为 0。
  { id: 'event_jewelry_jade_curtain', name: '翠玉珠帘', slot: DecoSlot.WALLART, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'event_jewelry_jade_curtain', desc: '翠玉珠与珍珠垂成的活动限定墙饰', unlockRequirement: { questId: 'event_jewelry_reward_jade_curtain', conditionText: '活动解锁', questDetailText: '参与花间珠匣活动进度奖励后解锁' }, defaultScale: 1.7, allowedSceneIds: ['flower_shop'] },
  { id: 'event_jewelry_back_sofa', name: '珠绣背向沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'event_jewelry_back_sofa', desc: '面向墙摆放的限定沙发，背面有柔和珠绣花纹', unlockRequirement: { questId: 'event_jewelry_reward_back_sofa', conditionText: '活动解锁', questDetailText: '参与花间珠匣活动进度奖励后解锁' }, defaultScale: 1.28, decorationPanelTab: 'furniture', allowedSceneIds: ['flower_shop'] },
  { id: 'event_jewelry_empty_tea_table', name: '珠缘空茶几', slot: DecoSlot.TABLE, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'event_jewelry_empty_tea_table', desc: '留出干净台面的活动限定茶几，适合后续摆放小物', unlockRequirement: { questId: 'event_jewelry_reward_empty_tea_table', conditionText: '活动解锁', questDetailText: '参与花间珠匣活动进度奖励后解锁' }, defaultScale: 1.05, decorationPanelTab: 'furniture', allowedSceneIds: ['flower_shop'] },
  { id: 'wallart_lace_curtain', name: '柔纱短帘', slot: DecoSlot.WALLART,  rarity: DecoRarity.FINE,   cost: 300, starValue: 3, icon: 'wallart_lace_curtain', desc: '蕾丝咖啡馆风情', unlockRequirement: { level: 2 }, defaultScale: 1.8 },
  { id: 'wallart_rose_swag_drape', name: '玫瑰垂幔墙帘', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 1000, starValue: 4, icon: 'wallart_rose_swag_drape', desc: '暖木帘杆配樱粉垂幔与玫瑰扎饰，等距墙面透视', unlockRequirement: { level: 3 }, defaultScale: 1.85 },
  { id: 'garden_wood_trough', name: '木质长花箱',   slot: DecoSlot.GARDEN,   rarity: DecoRarity.COMMON, cost: 252, starValue: 1, icon: 'garden_wood_trough', desc: '一长条春天开在门口', unlockRequirement: { level: 4 }, defaultScale: 0.97 },

  // ═══════ ⑧ 家具 / 家电扩展（NB2 批次：躺椅、桌凳、收音机风扇等）═══════
  { id: 'orn_lounge_chaise',    name: '布艺躺椅',     slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE,   cost: 4055,  starValue: 9, icon: 'orn_lounge_chaise',    desc: '花店里偷个懒的贵妃榻', unlockRequirement: { level: 9 },  defaultScale: 0.93, decorationPanelTab: 'furniture' },
  { id: 'table_round_cafe',     name: '小圆桌',       slot: DecoSlot.TABLE,    rarity: DecoRarity.COMMON, cost: 534,  starValue: 1, icon: 'table_round_cafe',     desc: '一杯花茶刚好', unlockRequirement: { level: 4 },  defaultScale: 1.05,  decorationPanelTab: 'furniture' },
  { id: 'table_square_bistro',  name: '方桌',         slot: DecoSlot.TABLE,    rarity: DecoRarity.COMMON, cost: 648,  starValue: 1, icon: 'table_square_bistro',  desc: '方正好用的边角桌', unlockRequirement: { level: 3 },  defaultScale: 1,  decorationPanelTab: 'furniture' },
  { id: 'orn_wood_stools_pair', name: '原木双凳',     slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 348,  starValue: 1, icon: 'orn_wood_stools_pair', desc: '两把圆凳排排坐', unlockRequirement: { level: 4 },  defaultScale: 0.73, decorationPanelTab: 'furniture' },
  { id: 'orn_rocking_chair',    name: '摇椅',         slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE,   cost: 3645,  starValue: 8, icon: 'orn_rocking_chair',    desc: '慢慢摇，闻花香', unlockRequirement: { level: 9 },  defaultScale: 0.98, decorationPanelTab: 'furniture' },
  { id: 'table_side_round',     name: '大理石小边几', slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,   cost: 1945,  starValue: 3, icon: 'table_side_round',     desc: '放一盆小绿植刚好', unlockRequirement: { level: 8 },  defaultScale: 0.97, decorationPanelTab: 'furniture' },
  { id: 'light_radio_vintage',  name: '复古收音机',   slot: DecoSlot.LIGHT,   rarity: DecoRarity.FINE,   cost: 1945,  starValue: 3, icon: 'light_radio_vintage',  desc: '店里轻声放老歌', unlockRequirement: { level: 8 },  defaultScale: 0.36 },
  { id: 'light_fan_desk',       name: '台式电风扇',   slot: DecoSlot.LIGHT,   rarity: DecoRarity.RARE, cost: 500,  starValue: 3, icon: 'light_fan_desk',       desc: '夏天也清凉', defaultScale: 0.63 },
  { id: 'light_kettle_pastel',  name: '电热水壶',     slot: DecoSlot.LIGHT,   rarity: DecoRarity.COMMON, cost: 430,  starValue: 1, icon: 'light_kettle_pastel',  desc: '泡茶泡咖啡都靠它', unlockRequirement: { level: 5 },  defaultScale: 0.36 },
  { id: 'light_humidifier_cute', name: '桌面加湿器',  slot: DecoSlot.LIGHT,   rarity: DecoRarity.FINE,   cost: 1285,  starValue: 2, icon: 'light_humidifier_cute', desc: '给小花加一点湿润', unlockRequirement: { level: 6 },  defaultScale: 0.36 },

  // ═══════ ⑨ 花房主题（贴图批次：软木板 / 园艺工具 / 地毯 / 衣帽架 / 花车 / 小黑板 / 小盆栽等；面板固定「花房」Tab）═══════
  { id: 'wallart_greenhouse_chalkboard', name: '花房小黑板', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 930, starValue: 2, icon: 'wallart_greenhouse_chalkboard', desc: '户外落地 A 字招牌架，黑白板粉笔「花花」，小花饰点缀', unlockRequirement: { level: 5 }, defaultScale: 1.02, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'orn_greenhouse_cart', name: '软木留言板', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 295, starValue: 1, icon: 'orn_greenhouse_cart', desc: '浅木框软木板，钉着备忘与便签', unlockRequirement: { level: 4 }, defaultScale: 0.78, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'garden_flower_stall', name: '浇水壶与花铲', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 345, starValue: 1, icon: 'garden_flower_stall', desc: '浅蓝壶与木柄铲，精致柔线稿', unlockRequirement: { level: 3 }, defaultScale: 0.65, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
  { id: 'orn_greenhouse_rug', name: '粉色碎花地毯', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 200, starValue: 2, icon: 'orn_greenhouse_rug', desc: '粉地白花图案的小地垫', unlockRequirement: { level: 2 }, defaultScale: 0.92, depthSortFloorMat: true, decorationPanelTab: 'furniture' },
  { id: 'orn_greenhouse_coat_rack', name: '木轨衣帽挂钩', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 300, starValue: 1, icon: 'orn_greenhouse_coat_rack', desc: '蜜木轨挂着樱粉风衣、薄荷小包与草帽', unlockRequirement: { level: 3 }, defaultScale: 1, decorationPanelTab: 'furniture' },
  { id: 'orn_greenhouse_flower_cart', name: '木轮鲜花推车', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 1980, starValue: 2, icon: 'orn_greenhouse_flower_cart', desc: '装满蔷薇与郁金香的双轮木推车', unlockRequirement: { level: 6 }, defaultScale: 1.05, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_shop'] },
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

  // ═══════ ⑩.5 蝴蝶小屋专属家具（decorationPanelTab=flower_room → 左侧「蝴蝶小屋」Tab，与花坊/蛋糕房同模式）═══════
  { id: 'butterfly_house_display_case',  name: '观蝶玻璃柜', slot: DecoSlot.SHELF,    rarity: DecoRarity.RARE,   cost: 5000, starValue: 5, icon: 'butterfly_house_display_case',  desc: '木框玻璃柜里陈列蝶影与枝叶', unlockRequirement: { level: 13 }, defaultScale: 1.78, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_writing_desk',  name: '观蝶书写桌', slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,   cost: 4000,  starValue: 4, icon: 'butterfly_house_writing_desk',  desc: '记录观察笔记的小书桌，静静贴着墙角', unlockRequirement: { level: 12 }, defaultScale: 1.12, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_sofa',          name: '蝶翼双人沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 6000, starValue: 6, icon: 'butterfly_house_sofa',          desc: '柔软靠背像展开的蝶翼，适合小憩', unlockRequirement: { level: 12 }, defaultScale: 1.38, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_wicker_chair',  name: '藤编休闲椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,   cost: 3000,  starValue: 3, icon: 'butterfly_house_wicker_chair',  desc: '轻盈藤编椅，把温室角落变成阅读位', unlockRequirement: { level: 11 }, defaultScale: 0.98, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_tea_table',     name: '圆茶几', slot: DecoSlot.TABLE,        rarity: DecoRarity.COMMON, cost: 1945,  starValue: 2, icon: 'butterfly_house_tea_table',     desc: '圆润小茶几，摆上点心就很有氛围', unlockRequirement: { level: 8 }, defaultScale: 0.96, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_wall_frame',    name: '蝶影挂画', slot: DecoSlot.WALLART,    rarity: DecoRarity.FINE,   cost: 1945,  starValue: 2, icon: 'butterfly_house_wall_frame',    desc: '把蝴蝶标本感做成柔和挂画，适合干净墙面', unlockRequirement: { level: 8 }, defaultScale: 0.88, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  // 蝴蝶小屋扩展（Lv10-14，观蝶/月辉/野趣套）
  { id: 'butterfly_house_study_field_stool', name: '野趣折叠凳', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 3200, starValue: 2, icon: 'butterfly_house_study_field_stool', desc: '木架帆布折叠凳，侧挂小布包，适合温室野趣角', unlockRequirement: { level: 10 }, defaultScale: 0.88, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_study_pin_board', name: '蝶翅观察板', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 2310, starValue: 2, icon: 'butterfly_house_study_pin_board', desc: '软木板钉着蝶翅速写便签与彩钉，记录每日观察', unlockRequirement: { level: 11 }, defaultScale: 0.95, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_bamboo_screen', name: '蝶影竹屏风', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 2470, starValue: 2, icon: 'butterfly_house_bamboo_screen', desc: '三扇竹编屏风上印着青绿大蝶影，轻隔断观蝶区', unlockRequirement: { level: 11 }, defaultScale: 1.82, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_study_microscope_desk', name: '显微镜观察台', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 3255, starValue: 3, icon: 'butterfly_house_study_microscope_desk', desc: '浅木桌上摆着黄铜显微镜、蝶类图鉴与彩铅', unlockRequirement: { level: 12 }, defaultScale: 1.62, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_moon_specimen_shelf', name: '蝶标标本柜', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 4725, starValue: 4, icon: 'butterfly_house_moon_specimen_shelf', desc: '浅木陈列柜分层展示框装蝶标，下层玻璃门收纳册', unlockRequirement: { level: 13 }, defaultScale: 1.65, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_aurora_terrarium', name: '幻彩蝴蝶温室', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 5355, starValue: 4, icon: 'butterfly_house_aurora_terrarium', desc: '幻彩玻璃罩温室里长着发光小花，一只蝶影停驻', unlockRequirement: { level: 13 }, defaultScale: 1.68, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_moon_crescent_rug', name: '新月针织毯', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 5510, starValue: 3, icon: 'butterfly_house_moon_crescent_rug', desc: '奶油针织毯卷着淡紫新月边，铺出柔软阅读角', unlockRequirement: { level: 14 }, defaultScale: 1.25, depthSortYLift: 0, depthSortFloorMat: true, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },
  { id: 'butterfly_house_moon_star_chair', name: '星纹观蝶椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 6140, starValue: 4, icon: 'butterfly_house_moon_star_chair', desc: '浅木扶手椅配雾蓝软垫与星形抱枕，月辉小憩位', unlockRequirement: { level: 14 }, defaultScale: 1.38, decorationPanelTab: 'flower_room', allowedSceneIds: ['butterfly_house'] },

  // 花店/庭院通用 — 奶油别墅风（Lv10-14，花坊家具 Tab）
  { id: 'villa_planter_urn', name: '玫瑰花卉瓮', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 6575, starValue: 4, icon: 'villa_planter_urn', desc: '陶瓮盛满浅粉玫瑰，摆在庭院或门廊都很体面', unlockRequirement: { level: 10 }, defaultScale: 1.32, decorationPanelTab: 'garden' },
  { id: 'villa_wrought_bench', name: '铁艺粉垫长椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 3000, starValue: 3, icon: 'villa_wrought_bench', desc: '深灰铁艺雕花靠背配粉色软垫，庭园休憩经典款', unlockRequirement: { level: 11 }, defaultScale: 1.65, decorationPanelTab: 'furniture' },
  { id: 'villa_gilded_mirror', name: '鎏金玫瑰镜', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 3150, starValue: 3, icon: 'villa_gilded_mirror', desc: '椭圆鎏金框镜顶缀三朵玫瑰，墙面立刻贵气起来', unlockRequirement: { level: 12 }, defaultScale: 1.22 },
  { id: 'villa_rose_armoire', name: '玫瑰顶衣柜', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 4620, starValue: 4, icon: 'villa_rose_armoire', desc: '奶油白立柜顶饰粉玫瑰，单门单屉收纳花艺杂物', unlockRequirement: { level: 13 }, defaultScale: 1.78, decorationPanelTab: 'furniture' },

  // ═══════ ⑩ 高星主题珍藏（常驻；id 沿用旧季节套以兼容存档）═══════

  { id: 'season_spring_shelf', name: '樱花花架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 4690, starValue: 10, icon: 'shelf_spring', desc: '樱花藤架纸灯笼，轻线稿卵石底', unlockRequirement: { level: 8 }, defaultScale: 1.85, decorationPanelTab: 'garden' },
  { id: 'season_spring_wall', name: '樱花挂画', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 3910, starValue: 8, icon: 'wallart_spring', desc: '鎏金框油画风樱花径，等距墙面透视', unlockRequirement: { level: 8 }, defaultScale: 0.81 },
  { id: 'season_summer_light', name: '向日葵灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.COMMON, cost: 390, starValue: 1, icon: 'light_summer', desc: '阳光感的向日葵造型灯具', unlockRequirement: { level: 4 }, defaultScale: 0.53 },
  { id: 'season_summer_garden', name: '花园喷泉', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 5680, starValue: 11, icon: 'garden_summer', desc: '三层石喷泉，自然草边无菱形草皮', unlockRequirement: { level: 9 }, defaultScale: 1.68 },
  {
    id: 'season_summer_floor_fan',
    name: '清凉立式电扇',
    slot: DecoSlot.LIGHT,
    rarity: DecoRarity.LIMITED,
    cost: 0,
    starValue: 0,
    icon: 'season_summer_floor_fan',
    desc: '薄荷绿落地立式电扇，夏日花店的清凉一角',
    unlockRequirement: {
      questId: 'cool_summer_reward_floor_fan',
      conditionText: '活动解锁',
      questDetailText: '清凉一夏活动获取',
    },
    defaultScale: 1.35,
  },
  {
    id: 'season_summer_dining_table',
    name: '夏日西瓜餐桌',
    slot: DecoSlot.TABLE,
    rarity: DecoRarity.LIMITED,
    cost: 0,
    starValue: 0,
    icon: 'season_summer_dining_table',
    desc: '方桌铺薄荷绿桌布，西瓜与冰饮摆出夏日午后感',
    unlockRequirement: {
      questId: 'cool_summer_reward_dining_table',
      conditionText: '活动解锁',
      questDetailText: '清凉一夏活动获取',
    },
    defaultScale: 1.28,
    decorationPanelTab: 'furniture',
  },
  { id: 'season_autumn_orn', name: '南瓜灯笼', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 4055, starValue: 6, icon: 'orn_pumpkin', desc: '暖色调丰收风灯笼', unlockRequirement: { level: 9 }, defaultScale: 0.65 },
  { id: 'season_autumn_table', name: '枫叶柜台', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 5735, starValue: 5, icon: 'table_autumn', desc: '铺满红叶的木质柜台', unlockRequirement: { level: 10 }, defaultScale: 1.48 },
  { id: 'season_winter_wallart', name: '复古落地钟', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 3025, starValue: 7, icon: 'wallart_winter', desc: '胡桃木落地钟，柔线稿无数字', unlockRequirement: { level: 9 }, defaultScale: 1.34, decorationPanelTab: 'furniture' },
  { id: 'season_winter_orn', name: '节庆壁炉', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 6610, starValue: 6, icon: 'orn_christmas', desc: '圣诞袜花环灯串，精致柔线稿', unlockRequirement: { level: 10 }, defaultScale: 1.3, decorationPanelTab: 'furniture' },

  // ═══════ ⑪ 后期家具（NB2 + rembg + 规范压缩；提示词 docs/prompt/furniture_deco_late_*_nb2_prompt.txt）═══════
  // L7 主搭 style_confetti_nb2；L9 主搭 style_lagoon_nb2；绿植 L11 发财树搭粉蓝/复古大空间
  { id: 'deco_late_lv7_table_01', name: '豆沙绿圆桌', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 1200, starValue: 2, icon: 'deco_late_lv7_table_01', desc: '细白搪瓷桌面、豆沙绿弯腿，配一杯花茶与小卡片', unlockRequirement: { level: 7 }, defaultScale: 0.95, decorationPanelTab: 'furniture' },
  { id: 'deco_late_lv7_wall_01', name: '干花三联框', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 1055, starValue: 2, icon: 'deco_late_lv7_wall_01', desc: '浅橡木三联标本格，等距墙面透视', unlockRequirement: { level: 7 }, defaultScale: 0.92 },
  { id: 'deco_late_lv8_garden_01', name: '染井吉野樱', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 6485, starValue: 12, icon: 'deco_late_lv8_garden_01', desc: '透明底仅树干与树根，无地砖；冠幅浅粉樱花', unlockRequirement: { level: 9 }, defaultScale: 2.8, decorationPanelTab: 'garden' },
  { id: 'deco_late_lv8_shelf_01', name: '迷你冷藏柜', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 1040, starValue: 2, icon: 'deco_late_lv8_shelf_01', desc: '樱粉圆角双门小冷柜，里面是冰饮和小花瓶', unlockRequirement: { level: 5 }, defaultScale: 1.22 },
  { id: 'deco_late_lv8_light_01', name: '爱迪生壁灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 1775, starValue: 5, icon: 'deco_late_lv8_light_01', desc: '浅橡木支架+古铜小灯罩，单颗暖黄爱迪生灯泡', unlockRequirement: { level: 8 }, defaultScale: 0.55 },
  { id: 'deco_late_lv9_orn_furn_01', name: '海岛沙发椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 3190, starValue: 7, icon: 'deco_late_lv9_orn_furn_01', desc: '青绿条纹布艺单椅，白木细腿，清爽客座一角', unlockRequirement: { level: 9 }, defaultScale: 0.95, decorationPanelTab: 'furniture' },
  { id: 'deco_late_lv9_wall_01', name: '青柠水彩画', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 4055, starValue: 8, icon: 'deco_late_lv9_wall_01', desc: '黄绿青柠切片与水彩晕染长幅，无文字', unlockRequirement: { level: 9 }, defaultScale: 1.6 },
  { id: 'deco_late_lv9_table_01', name: '礼品中岛台', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 1830, starValue: 2, icon: 'deco_late_lv9_table_01', desc: '背板彩纸卷与丝带，台面花束和礼盒摆得清爽好看', unlockRequirement: { level: 5 }, defaultScale: 1.12, decorationPanelTab: 'furniture' },
  { id: 'deco_late_lv9_garden_01', name: '香水柠檬树', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 4485, starValue: 9, icon: 'deco_late_lv9_garden_01', desc: '透明底仅树干与树根，无地砖；冠上青柠与花', unlockRequirement: { level: 8 }, defaultScale: 2.8, decorationPanelTab: 'garden' },
  { id: 'deco_late_lv10_shelf_01', name: '自行车花架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 4000, starValue: 8, icon: 'deco_late_lv10_shelf_01', desc: '立式铁艺自行车轮廓作花架，圆环与横梁挂小花盆与藤', unlockRequirement: { level: 9 }, defaultScale: 1.48, decorationPanelTab: 'garden' },
  { id: 'deco_late_lv10_orn_01', name: '迷你洗手台', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 5435, starValue: 5, icon: 'deco_late_lv10_orn_01', desc: '半高柜+小椭圆镜+陶瓷盆与古铜龙头，角落实用', unlockRequirement: { level: 10 }, defaultScale: 1.2, decorationPanelTab: 'furniture' },
  { id: 'deco_late_lv10_pachira_01', name: '落地发财树', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 2220, starValue: 9, icon: 'deco_late_lv10_pachira_01', desc: '高腰深釉陶盆，掌状大叶层叠向上，落地体量撑场面', unlockRequirement: { flowerCollectionItemId: 'flower_green_11' }, defaultScale: 1.22, decorationPanelTab: 'furniture' },

  // ═══════ ⑪.2 Lv14-20 高星常驻家具：海滨花园套 + 月光蝶园套（补足 10-20 级购买目标）═══════
  { id: 'deco_lv14_wall_butterfly_clock', name: '月蝶壁钟', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 4200, starValue: 5, icon: 'deco_lv14_wall_butterfly_clock', desc: '淡紫蝶翼外框的小壁钟，没有数字，像月光停在墙上', unlockRequirement: { level: 14 }, defaultScale: 0.7 },
  { id: 'deco_lv14_light_blossom_sconce', name: '花露壁灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE, cost: 4200, starValue: 6, icon: 'deco_lv14_light_blossom_sconce', desc: '玫瑰金花枝托起露珠灯罩，给蝶园套做温柔过渡', unlockRequirement: { level: 14 }, defaultScale: 0.62 },
  { id: 'deco_lv15_garden_pool', name: '海盐小泳池', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 8610, starValue: 15, icon: 'deco_lv15_garden_pool', desc: '奶油白浅池配海盐蓝水面，像把夏天摆进庭院', unlockRequirement: { level: 15 }, defaultScale: 2.22, decorationPanelTab: 'garden' },
  { id: 'deco_lv15_garden_parasol', name: '海风遮阳伞', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 8000, starValue: 8, icon: 'deco_lv15_garden_parasol', desc: '海盐蓝条纹大伞，浅柚木伞柄与小花盆底座', unlockRequirement: { level: 12 }, defaultScale: 1.65, decorationPanelTab: 'garden' },
  { id: 'deco_lv15_light_drink_cooler', name: '海盐饮品冰柜', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 7000, starValue: 7, icon: 'deco_lv15_light_drink_cooler', desc: '薄荷蓝小冰柜，玻璃门里排着清爽瓶饮与花冰块', unlockRequirement: { level: 11 }, defaultScale: 0.85 },
  { id: 'deco_lv16_orn_hanging_chair', name: '藤编吊篮秋千', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 10395, starValue: 6, icon: 'deco_lv16_orn_hanging_chair', desc: '柚木支架吊起藤编篮椅，珊瑚抱枕带来度假感', unlockRequirement: { level: 16 }, defaultScale: 1.58, decorationPanelTab: 'furniture' },
  { id: 'deco_lv16_wall_shell_mirror', name: '贝壳壁挂镜', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 7875, starValue: 6, icon: 'deco_lv16_wall_shell_mirror', desc: '贝壳弧形镜框点缀小珍珠，墙面多了一点海风', unlockRequirement: { level: 16 }, defaultScale: 0.85 },
  { id: 'deco_lv16_garden_coral_planter', name: '珊瑚花箱', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 8505, starValue: 8, icon: 'deco_lv16_garden_coral_planter', desc: '珊瑚色长花箱盛着海风小花，和泳池伞组自然成套', unlockRequirement: { level: 16 }, defaultScale: 1.22, decorationPanelTab: 'garden' },
  { id: 'deco_lv17_shelf_surfboard', name: '冲浪板花架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 9765, starValue: 10, icon: 'deco_lv17_shelf_surfboard', desc: '旧冲浪板改成竖向花架，薄荷蓝与珊瑚花盆呼应海滨套', unlockRequirement: { level: 17 }, defaultScale: 1.55, decorationPanelTab: 'garden' },
  { id: 'deco_lv17_table_terrace_bar', name: '露台折叠吧台', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 11340, starValue: 7, icon: 'deco_lv17_table_terrace_bar', desc: '浅柚木折叠吧台配冰饮托盘，适合海边露台角落', unlockRequirement: { level: 17 }, defaultScale: 1.22, decorationPanelTab: 'furniture' },
  { id: 'deco_lv17_orn_seabreeze_rug', name: '海风圆地毯', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 7875, starValue: 5, icon: 'deco_lv17_orn_seabreeze_rug', desc: '厚织物圆地毯，抬高软包边与流苏让休闲区更像坐垫', unlockRequirement: { level: 17 }, defaultScale: 1.22, depthSortFloorMat: true, decorationPanelTab: 'furniture' },
  { id: 'deco_lv18_shelf_moon_glasshouse', name: '月光玻璃温室柜', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 11340, starValue: 7, icon: 'deco_lv18_shelf_moon_glasshouse', desc: '香槟金玻璃小温室，月光蓝蝶影与水晶花盆陈列其中', unlockRequirement: { level: 18 }, defaultScale: 1.3, decorationPanelTab: 'furniture' },
  { id: 'deco_lv18_light_firefly_lamp', name: '星萤庭院灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 9135, starValue: 9, icon: 'deco_lv18_light_firefly_lamp', desc: '月蓝玻璃灯罩里闪着星萤光点，适合蝶屋夜色', unlockRequirement: { level: 18 }, defaultScale: 1.35 },
  { id: 'deco_lv18_garden_butterfly_arch', name: '蝶翼月光拱门', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 13545, starValue: 8, icon: 'deco_lv18_garden_butterfly_arch', desc: '香槟金拱门展开半透明蝶翼，月光蓝水晶点亮庭院入口', unlockRequirement: { level: 18 }, defaultScale: 2.02, decorationPanelTab: 'garden' },
  { id: 'deco_lv19_wall_crystal_specimen', name: '水晶标本墙', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 10395, starValue: 12, icon: 'deco_lv19_wall_crystal_specimen', desc: '香槟金展示框里封存蝶翼水晶与干花标本，精致但无文字', unlockRequirement: { level: 19 }, defaultScale: 0.78 },
  { id: 'deco_lv19_orn_crescent_chaise', name: '月牙贵妃榻', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 12285, starValue: 8, icon: 'deco_lv19_orn_crescent_chaise', desc: '月牙形软榻配淡紫丝绒靠垫，适合高级休息角', unlockRequirement: { level: 19 }, defaultScale: 1.18, decorationPanelTab: 'furniture' },
  { id: 'deco_lv19_table_stardust_aroma', name: '星砂香氛台', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 9450, starValue: 10, icon: 'deco_lv19_table_stardust_aroma', desc: '圆角香氛小台摆着星砂玻璃瓶、月白托盘与迷你花束', unlockRequirement: { level: 19 }, defaultScale: 0.98, decorationPanelTab: 'furniture' },
  { id: 'deco_lv20_garden_moon_fountain', name: '月辉喷泉雕塑', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 13265, starValue: 11, icon: 'deco_lv20_garden_moon_fountain', desc: '月牙水晶喷泉与蝶翼雕塑组成庭院压轴大件', unlockRequirement: { level: 20 }, defaultScale: 1.4, decorationPanelTab: 'garden' },
  { id: 'deco_lv20_shelf_star_observatory', name: '星月观景陈列柜', slot: DecoSlot.SHELF, rarity: DecoRarity.LIMITED, cost: 16950, starValue: 10, icon: 'deco_lv20_shelf_star_observatory', desc: '小型观景台式陈列柜，玻璃穹顶里摆着星月花器', unlockRequirement: { level: 20 }, defaultScale: 1.32, decorationPanelTab: 'furniture' },
  { id: 'deco_lv20_wall_moon_sheer_curtain', name: '月纱蝶影帘', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 13450, starValue: 14, icon: 'deco_lv20_wall_moon_sheer_curtain', desc: '挂墙半透明月光纱帘，香槟金帘杆与蝶影坠饰让墙面更轻盈', unlockRequirement: { level: 20 }, defaultScale: 1.8 },

  // ═══════ ⑪.3 Lv10-20 30件扩展家具：6 大主题套 + 9 件单品（NB2 批次，单件单提示词出图）
  // 主题：① 茶室禅意（Lv10-11，3 件） ② 蘑菇精灵（Lv12-15，4 件） ③ 法式咖啡烘焙（Lv13-16，4 件）
  //       ④ 古董图书（Lv15-18，4 件） ⑤ 极光晶莹（Lv17-19，3 件） ⑥ 云端漫游（Lv18-20，3 件）
  //       ⑦ 单件（Lv10-20，9 件，宠物/音乐/邮政/童趣/玻璃灯/墙窗/艺术大件）

  // —— 茶室禅意套（茶台 + 蒲团 + 水墨挂轴；适配复古/竹影屋）——
  { id: 'deco_lv10_table_zen_tea_low', name: '禅意茶台', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 2190, starValue: 4, icon: 'deco_lv10_table_zen_tea_low', desc: '矮樱桃木茶台，青瓷茶具与一枝粉梅，安静茶席角落', unlockRequirement: { level: 10 }, defaultScale: 1.18, decorationPanelTab: 'furniture' },
  { id: 'deco_lv10_orn_zen_cushion_pair', name: '蒲团坐垫组', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 1825, starValue: 2, icon: 'deco_lv10_orn_zen_cushion_pair', desc: '玫粉与抹茶绿圆蒲团，配茶台正合适', unlockRequirement: { level: 10 }, defaultScale: 0.95, decorationPanelTab: 'furniture' },
  { id: 'deco_lv11_wallart_zen_ink_scroll', name: '水墨竹影挂轴', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 4000, starValue: 4, icon: 'deco_lv11_wallart_zen_ink_scroll', desc: '宣纸卷轴绘水墨竹与一点粉梅，配暖木轴头', unlockRequirement: { level: 11 }, defaultScale: 1.40 },

  // —— 蘑菇精灵套（坐墩+圆桌+陈列屋+精灵丛；童话森林感，适配蝶屋竹影房）——
  { id: 'deco_lv12_orn_mushroom_stool_pair', name: '蘑菇坐墩组', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 4000, starValue: 4, icon: 'deco_lv12_orn_mushroom_stool_pair', desc: '一红一米双蘑菇坐墩，森系小客座', unlockRequirement: { level: 12 }, defaultScale: 0.85, decorationPanelTab: 'furniture' },
  { id: 'deco_lv13_table_mushroom_round', name: '蘑菇圆茶桌', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 5000, starValue: 5, icon: 'deco_lv13_table_mushroom_round', desc: '粉色蘑菇伞盖做桌面，奶白菌柄做底座', unlockRequirement: { level: 13 }, defaultScale: 0.9, decorationPanelTab: 'furniture' },
  { id: 'deco_lv14_shelf_mushroom_cottage', name: '蘑菇小屋陈列架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 4620, starValue: 8, icon: 'deco_lv14_shelf_mushroom_cottage', desc: '蘑菇屋造型陈列架，三层拱形格放小花盆', unlockRequirement: { level: 14 }, defaultScale: 1.35 },
  { id: 'deco_lv15_garden_mushroom_grove', name: '蘑菇精灵丛', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 9000, starValue: 9, icon: 'deco_lv15_garden_mushroom_grove', desc: '三色蘑菇与苔藓丛，配萤火虫提灯', unlockRequirement: { level: 12 }, defaultScale: 1.60, decorationPanelTab: 'garden' },

  // —— 法式咖啡烘焙套（甜品柜+手冲架+复古烤箱+马卡龙塔；适配复古花坊 confetti）——
  { id: 'deco_lv13_table_french_pastry_counter', name: '法式甜品玻璃柜', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 6000, starValue: 6, icon: 'deco_lv13_table_french_pastry_counter', desc: '奶薄荷柜身配玻璃罩，里面摆着马卡龙与小塔', unlockRequirement: { level: 13 }, defaultScale: 1.30, decorationPanelTab: 'furniture' },
  { id: 'deco_lv14_shelf_handbrew_coffee_bar', name: '手冲咖啡架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 4410, starValue: 7, icon: 'deco_lv14_shelf_handbrew_coffee_bar', desc: '蜜木双层架配手冲套与豆罐，店里多一个咖啡角', unlockRequirement: { level: 14 }, defaultScale: 1.30 },
  { id: 'deco_lv15_light_vintage_oven', name: '奶黄复古烤箱', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 8000, starValue: 8, icon: 'deco_lv15_light_vintage_oven', desc: '圆胖奶黄烤箱，玻璃门里看见可颂在烤', unlockRequirement: { level: 12 }, defaultScale: 0.65 },
  { id: 'deco_lv16_orn_macaron_tower', name: '马卡龙塔', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 7875, starValue: 5, icon: 'deco_lv16_orn_macaron_tower', desc: '三层瓷盘配粉黄紫蓝马卡龙，下午茶担当', unlockRequirement: { level: 16 }, defaultScale: 0.78 },

  // —— 古董图书套（书架+地球仪桌+切斯特皮椅+植物标本；dark academia，适配复古/月辉）——
  { id: 'deco_lv15_shelf_antique_library', name: '复古胡桃书架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 9000, starValue: 9, icon: 'deco_lv15_shelf_antique_library', desc: '维多利亚胡桃木书架，皮革精装书与黄铜地球仪', unlockRequirement: { level: 12 }, defaultScale: 1.45 },
  { id: 'deco_lv16_table_globe_writing_desk', name: '地球仪写字桌', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 9450, starValue: 9, icon: 'deco_lv16_table_globe_writing_desk', desc: '小巧胡桃木书桌，黄铜浑天仪、羽毛笔与压花玻璃罩', unlockRequirement: { level: 16 }, defaultScale: 1.08, decorationPanelTab: 'furniture' },
  { id: 'deco_lv17_orn_chesterfield_armchair', name: '切斯特皮扶手椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 10240, starValue: 6, icon: 'deco_lv17_orn_chesterfield_armchair', desc: '酒红绗缝皮扶手椅，配胡桃短腿与亚麻盖毯', unlockRequirement: { level: 17 }, defaultScale: 0.98, decorationPanelTab: 'furniture' },
  { id: 'deco_lv18_wallart_botanical_taxonomy', name: '植物标本框', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 7875, starValue: 6, icon: 'deco_lv18_wallart_botanical_taxonomy', desc: '胡桃画框配米色羊皮纸，六格压花标本无文字', unlockRequirement: { level: 18 }, defaultScale: 1.10 },

  // —— 极光晶莹套（镜面池+水晶球+落地灯；月光蝶园色系延伸）——
  { id: 'deco_lv17_garden_aurora_mirror_pond', name: '极光镜面池', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 12915, starValue: 8, icon: 'deco_lv17_garden_aurora_mirror_pond', desc: '奶白卵石围出极光水镜，浮叶莲与水晶星簇', unlockRequirement: { level: 17 }, defaultScale: 1.95, decorationPanelTab: 'garden' },
  { id: 'deco_lv18_orn_aurora_crystal_orb', name: '极光水晶球', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 8505, starValue: 7, icon: 'deco_lv18_orn_aurora_crystal_orb', desc: '玻璃球里漾着极光雾与小弦月，香槟金三脚架托起', unlockRequirement: { level: 18 }, defaultScale: 0.45 },
  { id: 'deco_lv19_light_aurora_floor_lantern', name: '极光落地灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 9765, starValue: 11, icon: 'deco_lv19_light_aurora_floor_lantern', desc: '香槟金细杆托起雾面玻璃灯罩，灯罩里流动极光蓝紫', unlockRequirement: { level: 19 }, defaultScale: 1.30 },

  // —— 云端漫游套（云朵软墩+棉花云中岛+云秋千；棉花糖粉蓝，适配粉蓝/月辉）——
  { id: 'deco_lv18_orn_cloud_pouf_set', name: '云朵软墩组', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 8190, starValue: 6, icon: 'deco_lv18_orn_cloud_pouf_set', desc: '一大一小云朵造型软墩，奶白与浅粉刺绣小星', unlockRequirement: { level: 18 }, defaultScale: 1.05, decorationPanelTab: 'furniture' },
  { id: 'deco_lv19_table_cloud_dessert_island', name: '棉花云中岛', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 10710, starValue: 7, icon: 'deco_lv19_table_cloud_dessert_island', desc: '云朵造型桌面带粉色糖霜流挂，香槟金弯腿与小甜点', unlockRequirement: { level: 19 }, defaultScale: 1, decorationPanelTab: 'furniture' },
  { id: 'deco_lv20_garden_cloud_swing', name: '云端长秋千', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 17505, starValue: 10, icon: 'deco_lv20_garden_cloud_swing', desc: '云朵长椅吊在香槟金 A 形架上，弦月坠与星形抱枕', unlockRequirement: { level: 20 }, defaultScale: 1.9, decorationPanelTab: 'garden' },

  // —— 单件家具：宠物/音乐/邮政/童趣/玻璃灯/墙窗/艺术大件 ——
  { id: 'deco_lv10_orn_kitten_bed', name: '奶油猫窝', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 2520, starValue: 2, icon: 'deco_lv10_orn_kitten_bed', desc: '奶白绒毛甜甜圈猫窝，里面有针织球与粉毯', unlockRequirement: { level: 10 }, defaultScale: 0.72, decorationPanelTab: 'furniture' },
  { id: 'deco_lv11_orn_cat_tower', name: '樱桃猫爬架', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 4000, starValue: 4, icon: 'deco_lv11_orn_cat_tower', desc: '蜜木立柱+缠绳+樱桃形顶台与粉色软垫', unlockRequirement: { level: 11 }, defaultScale: 0.9, decorationPanelTab: 'furniture' },
  { id: 'deco_lv11_light_phonograph_vintage', name: '古董留声机', slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE, cost: 4000, starValue: 4, icon: 'deco_lv11_light_phonograph_vintage', desc: '胡桃木底座配黄铜花喇叭，唱针架在黑胶上', unlockRequirement: { level: 11 }, defaultScale: 0.65 },
  { id: 'deco_lv12_orn_pastel_postbox', name: '草莓邮筒', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 3000, starValue: 3, icon: 'deco_lv12_orn_pastel_postbox', desc: '草莓粉立式邮筒，圆胖身段与小信件露出', unlockRequirement: { level: 12 }, defaultScale: 1 },
  { id: 'deco_lv13_orn_teddy_armchair', name: '泰迪熊扶手椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 5000, starValue: 5, icon: 'deco_lv13_orn_teddy_armchair', desc: '小熊造型椅背，焦糖蜜色绒面，配奶色小毯', unlockRequirement: { level: 13 }, defaultScale: 0.85, decorationPanelTab: 'furniture' },
  { id: 'deco_lv14_orn_carousel_music_box', name: '旋转木马音乐盒', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 4305, starValue: 7, icon: 'deco_lv14_orn_carousel_music_box', desc: '奶粉色基座配香槟金螺旋柱与三匹粉绿玫瑰木马', unlockRequirement: { level: 14 }, defaultScale: 0.65 },
  { id: 'deco_lv15_light_terrarium_lamp', name: '玻璃花房灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 7000, starValue: 7, icon: 'deco_lv15_light_terrarium_lamp', desc: '尖顶玻璃罩做小温室，里面有暖黄灯泡与小花苔藓', unlockRequirement: { level: 11 }, defaultScale: 0.65 },
  { id: 'deco_lv16_wallart_harbor_arch_window', name: '海港拱窗景', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 8660, starValue: 8, icon: 'deco_lv16_wallart_harbor_arch_window', desc: '奶白拱窗框里收着金色海港落日，有小帆船与玫瑰窗台', unlockRequirement: { level: 16 }, defaultScale: 1.30 },
  { id: 'deco_lv20_orn_white_grand_piano', name: '白色三角钢琴', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 62370, starValue: 13, icon: 'deco_lv20_orn_white_grand_piano', desc: '奶白漆三角钢琴，香槟金腿与玫瑰花束、水晶烛台', unlockRequirement: { level: 20 }, defaultScale: 1.5, decorationPanelTab: 'furniture' },
  { id: 'jiangnan_wash_bench', name: '临河浣衣凳', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 6635, starValue: 2, icon: 'jiangnan_wash_bench', desc: '旧木矮凳叠着白布，底下藤篮装着浣衣日常', unlockRequirement: { level: 20 }, defaultScale: 0.95, decorationPanelTab: 'furniture' },

  // ═══════ ⑭ 仙气古风扩展 Lv21–30（batch53 · 全场景通用 · 家具/摆件/墙饰/庭院 Tab）
  { id: 'xianqi_maple_tier_shelf', name: '果篮层架', slot: DecoSlot.SHELF, rarity: DecoRarity.FINE, cost: 11840, starValue: 5, icon: 'xianqi_maple_tier_shelf', desc: '三层原木架配藤篮与柿子梨，顶栏枫叶花饰', unlockRequirement: { level: 21 }, defaultScale: 1.75 },
  { id: 'xianqi_maple_round_table', name: '枫影圆几', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 12615, starValue: 6, icon: 'xianqi_maple_round_table', desc: '桦木圆几嵌珊瑚枫叶纹，两只琥珀小茶杯', unlockRequirement: { level: 21 }, defaultScale: 0.88 },
  { id: 'xianqi_maple_incense_stand', name: '香云几', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 11325, starValue: 5, icon: 'xianqi_maple_incense_stand', desc: '双层浅木香案，青瓷香炉与轻烟', unlockRequirement: { level: 22 }, defaultScale: 1.27 },
  { id: 'xianqi_maple_folding_chair', name: '折扇游椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 13125, starValue: 6, icon: 'xianqi_maple_folding_chair', desc: '扇形靠背游椅，桃色坐垫与金扇骨', unlockRequirement: { level: 22 }, defaultScale: 0.98, decorationPanelTab: 'furniture' },
  { id: 'xianqi_plum_padded_stool', name: '暖绒绣墩', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 11070, starValue: 5, icon: 'xianqi_plum_padded_stool', desc: '梅粉绒面圆墩，白木底座配银流苏', unlockRequirement: { level: 23 }, defaultScale: 0.45, decorationPanelTab: 'furniture' },
  { id: 'xianqi_maple_landscape_screen', name: '秋山屏风', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 14415, starValue: 7, icon: 'xianqi_maple_landscape_screen', desc: '四扇绢屏绘珊瑚枫山，奶油木框无文字', unlockRequirement: { level: 23 }, defaultScale: 1.82 },
  { id: 'xianqi_plum_snow_window', name: '梅枝雪窗', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 12225, starValue: 6, icon: 'xianqi_plum_snow_window', desc: '圆月窗框，磨砂玻璃上梅枝与细雪', unlockRequirement: { level: 24 }, defaultScale: 1.28 },
  { id: 'xianqi_plum_snow_basin', name: '雪梅水钵', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 13900, starValue: 7, icon: 'xianqi_plum_snow_basin', desc: '白石水钵浮着淡蓝水面与梅瓣', unlockRequirement: { level: 24 }, defaultScale: 0.92 },
  { id: 'xianqi_plum_wardrobe', name: '雪白轻柜', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 15185, starValue: 7, icon: 'xianqi_plum_wardrobe', desc: '白漆衣柜嵌银梅枝，淡蓝云形拉手', unlockRequirement: { level: 25 }, defaultScale: 1.45 },
  { id: 'xianqi_plum_canopy_bed', name: '寒梅纱床', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 23165, starValue: 9, icon: 'xianqi_plum_canopy_bed', desc: '白木四柱床垂冰蓝梅粉纱幔，雪花刺绣', unlockRequirement: { level: 25 }, defaultScale: 2.2, decorationPanelTab: 'furniture' },
  { id: 'xianqi_koi_twin_stone_seat', name: '双鲤石凳', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 13660, starValue: 6, icon: 'xianqi_koi_twin_stone_seat', desc: '一对石凳刻鲤纹，青绿软垫', unlockRequirement: { level: 26 }, defaultScale: 0.78, decorationPanelTab: 'furniture' },
  { id: 'xianqi_koi_scale_cabinet', name: '鱼鳞圆柜', slot: DecoSlot.SHELF, rarity: DecoRarity.FINE, cost: 25630, starValue: 7, icon: 'xianqi_koi_scale_cabinet', desc: '鼓形圆柜门绘青金鱼鳞纹', unlockRequirement: { level: 26 }, defaultScale: 0.92 },
  { id: 'xianqi_koi_wall_fountain', name: '壁泉游鳞', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 18000, starValue: 6, icon: 'xianqi_koi_wall_fountain', desc: '挂墙玉色泉板，金鲤浮雕与细流', unlockRequirement: { level: 27 }, defaultScale: 1.25 },
  { id: 'xianqi_koi_pond_tea_table', name: '临池茶台', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 27115, starValue: 8, icon: 'xianqi_koi_pond_tea_table', desc: '矮茶台侧嵌小池，青瓷茶具与游鳞', unlockRequirement: { level: 27 }, defaultScale: 1.82 },
  { id: 'xianqi_orchid_pavilion_mirror', name: '兰月妆镜台', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 26080, starValue: 7, icon: 'xianqi_orchid_pavilion_mirror', desc: '淡紫木妆台，圆银镜与兰紫绢屏', unlockRequirement: { level: 28 }, defaultScale: 1.4 },
  { id: 'xianqi_koi_stream_bridge', name: '游鳞小桥', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 30085, starValue: 9, icon: 'xianqi_koi_stream_bridge', desc: '青玉短桥金栏，拱下可见锦鲤', unlockRequirement: { level: 28 }, defaultScale: 1.6 },
  { id: 'xianqi_bamboo_mist_fence', name: '翠竹篱段', slot: DecoSlot.GARDEN, rarity: DecoRarity.COMMON, cost: 8710, starValue: 5, icon: 'xianqi_bamboo_mist_fence', desc: '短竹篱系雾灰丝带，清新庭院边栏', unlockRequirement: { level: 29 }, defaultScale: 1 },
  { id: 'xianqi_bamboo_joint_desk', name: '竹节书案', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 19100, starValue: 6, icon: 'xianqi_bamboo_joint_desk', desc: '竹节腿书案，淡绿纸卷与玉镇纸', unlockRequirement: { level: 29 }, defaultScale: 1.18 },
  { id: 'xianqi_bamboo_book_tower', name: '竹筒书塔', slot: DecoSlot.SHELF, rarity: DecoRarity.FINE, cost: 28890, starValue: 7, icon: 'xianqi_bamboo_book_tower', desc: '竹筒螺旋书塔，素卷与兰芽点缀', unlockRequirement: { level: 29 }, defaultScale: 1.55 },
  { id: 'xianqi_bamboo_mist_daybed', name: '竹影卧榻', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 49500, starValue: 8, icon: 'xianqi_bamboo_mist_daybed', desc: '竹框卧榻配鼠尾草垫，一端垂雾灰纱', unlockRequirement: { level: 29 }, defaultScale: 1.55, decorationPanelTab: 'furniture' },

  // ═══════ ⑭.4 现代生活扩展 Lv25–35（高价常驻 · 电器 / 露营 / 软装 / 店铺小设备）
  { id: 'modern_folding_laundry_rack', name: '阳台折叠晾衣架', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 21430, starValue: 5, icon: 'modern_folding_laundry_rack', desc: '白管折叠架挂满柔色衣物，带来阳台生活气', unlockRequirement: { level: 25 }, defaultScale: 1.15, decorationPanelTab: 'furniture' },
  { id: 'modern_kitchen_base_counter', name: '奶油蓝长厨柜', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 31045, starValue: 6, icon: 'modern_kitchen_base_counter', desc: '淡蓝拱形柜门连成一排，奶油台面空无一物，方便摆小家电与摆件', unlockRequirement: { level: 25 }, defaultScale: 1.98, decorationPanelTab: 'furniture' },
  { id: 'modern_hotdog_roller', name: '迷你烤肠机', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 23745, starValue: 6, icon: 'modern_hotdog_roller', desc: '透明罩小烤肠机，银色滚轴与面包托盘，可摆在厨柜台面', unlockRequirement: { level: 21 }, defaultScale: 0.92, depthSortFeetYFudge: 130 },
  { id: 'modern_glass_drink_dispenser', name: '玻璃饮料机', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 24905, starValue: 6, icon: 'modern_glass_drink_dispenser', desc: '双缸水果饮料机，柠檬茶与莓果茶清爽并排，适合厨柜台面', unlockRequirement: { level: 21 }, defaultScale: 0.72, depthSortFeetYFudge: 130 },
  { id: 'modern_camping_tent', name: '奶油露营帐篷', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 41745, starValue: 8, icon: 'modern_camping_tent', desc: '奶油帆布小帐篷配串灯与花盆，庭院立刻有露营感', unlockRequirement: { level: 27 }, defaultScale: 1.65, decorationPanelTab: 'garden' },
  { id: 'modern_picnic_cooler_cart', name: '野餐冰桶推车', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 25485, starValue: 6, icon: 'modern_picnic_cooler_cart', desc: '薄荷冰桶小推车，饮料水果与格纹毯准备好出发', unlockRequirement: { level: 22 }, defaultScale: 1.05, decorationPanelTab: 'furniture' },
  { id: 'modern_plush_cloud_pile', name: '毛绒云朵玩具堆', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 39070, starValue: 7, icon: 'modern_plush_cloud_pile', desc: '云朵、兔兔、小熊与柠檬抱枕叠成软乎乎角落', unlockRequirement: { level: 28 }, defaultScale: 0.9 },
  { id: 'modern_wall_fairy_lights', name: '节日星星串灯', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 37065, starValue: 6, icon: 'modern_wall_fairy_lights', desc: '星星月亮小挂灯串，墙面多一点节日暖光', unlockRequirement: { level: 28 }, defaultScale: 1.25 },
  { id: 'modern_tall_flower_vase', name: '高身鲜花陶瓶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 35240, starValue: 7, icon: 'modern_tall_flower_vase', desc: '高身奶油陶瓶插满郁金香与小雏菊，清新但有体量', unlockRequirement: { level: 28 }, defaultScale: 0.85 },
  { id: 'modern_capsule_drink_fridge', name: '胶囊饮料冰柜', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 11350, starValue: 5, icon: 'modern_capsule_drink_fridge', desc: '圆角胶囊冰柜排满彩色饮品，可摆在厨柜或台面上', unlockRequirement: { level: 22 }, defaultScale: 0.85, depthSortFeetYFudge: 130 },
  { id: 'modern_waffle_snack_cart', name: '华夫点心小车', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 28725, starValue: 7, icon: 'modern_waffle_snack_cart', desc: '暖橙棚顶小车摆着华夫饼、浆果与糖浆瓶', unlockRequirement: { level: 21 }, defaultScale: 1.05, decorationPanelTab: 'furniture' },
  { id: 'modern_robot_vacuum_dock', name: '圆圆扫地机座', slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE, cost: 20940, starValue: 6, icon: 'modern_robot_vacuum_dock', desc: '猫耳扫地机停在充电座旁，店里也要轻松保持整洁', unlockRequirement: { level: 29 }, defaultScale: 0.85 },
  { id: 'modern_balcony_drying_cabinet', name: '暖风烘衣柜', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 30150, starValue: 7, icon: 'modern_balcony_drying_cabinet', desc: '透明小烘衣柜挂着柔色衣物，顶部一盆薰衣草压住生活感', unlockRequirement: { level: 30 }, defaultScale: 1.35 },
  { id: 'modern_plant_grow_light_shelf', name: '植物补光培育架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 22855, starValue: 7, icon: 'modern_plant_grow_light_shelf', desc: '双层植物培育架配粉色补光灯，水培瓶与苗盘井井有条', unlockRequirement: { level: 30 }, defaultScale: 1.65, decorationPanelTab: 'furniture' },
  { id: 'modern_citrus_soda_machine', name: '柑橘气泡饮料机', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 32430, starValue: 7, icon: 'modern_citrus_soda_machine', desc: '橙黄色气泡饮料机，玻璃缸里冒着柑橘泡泡，适合厨柜台面', unlockRequirement: { level: 22 }, defaultScale: 0.72, depthSortFeetYFudge: 130 },
  { id: 'modern_pegboard_hobby_wall', name: '软木洞洞板', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 12150, starValue: 8, icon: 'modern_pegboard_hobby_wall', desc: '粉色洞洞板收纳丝带、剪刀、小花瓶与便签色块', unlockRequirement: { level: 31 }, defaultScale: 0.9 },
  { id: 'modern_countertop_icecream_machine', name: '软冰淇淋机', slot: DecoSlot.LIGHT, rarity: DecoRarity.RARE, cost: 36485, starValue: 8, icon: 'modern_countertop_icecream_machine', desc: '薄荷奶油色冰淇淋机，两个小甜筒刚好接住软雪糕，适合厨柜台面', unlockRequirement: { level: 24 }, defaultScale: 0.72, depthSortFeetYFudge: 130 },
  { id: 'modern_aquarium_side_table', name: '水族小边桌', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 36135, starValue: 10, icon: 'modern_aquarium_side_table', desc: '圆鼓水族箱托起小边桌，鱼儿与水草在桌下发光', unlockRequirement: { level: 33 }, defaultScale: 0.9, decorationPanelTab: 'furniture' },
  { id: 'modern_plush_display_ladder', name: '毛绒梯形陈列架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 27270, starValue: 9, icon: 'modern_plush_display_ladder', desc: '梯形木架陈列云朵、小熊与花朵毛绒，边上还绕着细灯', unlockRequirement: { level: 33 }, defaultScale: 1.2, decorationPanelTab: 'furniture' },
  { id: 'modern_patio_swing_sofa', name: '露台吊椅沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 48780, starValue: 11, icon: 'modern_patio_swing_sofa', desc: '奶油金属架吊起珊瑚软垫双人椅，花藤把露台变成小假日', unlockRequirement: { level: 35 }, defaultScale: 1.65, decorationPanelTab: 'furniture' },
  { id: 'modern_plush_capybara', name: '卡皮玩偶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 32400, starValue: 7, icon: 'modern_plush_capybara', desc: '圆滚滚卡皮巴拉毛绒，头顶还平衡着一片小橙片，懒萌到犯规', unlockRequirement: { level: 35 }, defaultScale: 0.75 },
  { id: 'modern_plush_clownfish', name: '小丑鱼玩偶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 36000, starValue: 7, icon: 'modern_plush_clownfish', desc: '橙白条纹小丑鱼毛绒，圆眼睛与短鳍摇摇晃晃，像从水族箱跳出来的', unlockRequirement: { level: 32 }, defaultScale: 0.7 },
  { id: 'modern_plush_tree_spirit', name: '树人玩偶', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 27000, starValue: 8, icon: 'modern_plush_tree_spirit', desc: '苔藓绿小树人毛绒，叶子头发与胸前花苞，森林精灵也软乎乎', unlockRequirement: { level: 34 }, defaultScale: 0.75 },

  // ═══════ ⑭.4b 海蓝慵懒夏日 Lv33–36（花园别墅软装线 · 参考地中海阳台蓝系）
  { id: 'azure_lazy_wicker_loveseat', name: '海蓝藤编双人沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 44565, starValue: 7, icon: 'azure_lazy_wicker_loveseat', desc: '浅藤编低沙发配天蓝坐垫，星图毯与柠檬片抱枕，慵懒午后标配', unlockRequirement: { level: 33 }, defaultScale: 1.35, decorationPanelTab: 'furniture' },
  { id: 'azure_lazy_wicker_armchair', name: '海蓝藤编单椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 36465, starValue: 7, icon: 'azure_lazy_wicker_armchair', desc: '圆角藤编单椅搭粉蓝猫脸抱枕，一个人也能窝着发呆', unlockRequirement: { level: 33 }, defaultScale: 1.05, decorationPanelTab: 'furniture' },
  { id: 'azure_lazy_ladder_towel_rack', name: '海蓝梯式毛巾架', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 28695, starValue: 6, icon: 'azure_lazy_ladder_towel_rack', desc: '天蓝木梯挂着柔色毛巾与海星小挂饰，像迷你阳台角落', unlockRequirement: { level: 34 }, defaultScale: 1.3, decorationPanelTab: 'furniture' },
  { id: 'azure_lazy_glass_shell_table', name: '玻璃海星小边桌', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 42140, starValue: 7, icon: 'azure_lazy_glass_shell_table', desc: '透明玻璃圆缸边桌，水底贝壳与海星轻轻晃，清凉又有趣', unlockRequirement: { level: 34 }, defaultScale: 0.85, decorationPanelTab: 'furniture' },
  { id: 'azure_lazy_star_border_rug', name: '星纹蓝海地毯', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 30620, starValue: 6, icon: 'azure_lazy_star_border_rug', desc: '牛仔蓝长毯配奶油星纹边与流苏，光脚踩上去就慢下来', unlockRequirement: { level: 35 }, defaultScale: 2.05, depthSortYLift: 0, depthSortFloorMat: true, decorationPanelTab: 'furniture' },
  { id: 'azure_lazy_barrel_stool', name: '木纹海蓝圆凳', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 29450, starValue: 6, icon: 'azure_lazy_barrel_stool', desc: '短木桶造型圆凳，浅木条与蔚蓝环带，随手一放就是座位', unlockRequirement: { level: 35 }, defaultScale: 0.55, decorationPanelTab: 'furniture' },
  { id: 'azure_lazy_star_lantern_string', name: '星月蓝串灯', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 33140, starValue: 7, icon: 'azure_lazy_star_lantern_string', desc: '星形与圆球串灯暖黄点亮，把夏夜阳台挂成小小银河', unlockRequirement: { level: 36 }, defaultScale: 1.5 },
  { id: 'azure_lazy_lemon_tree_pot', name: '柠檬蓝海花盆', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 36650, starValue: 7, icon: 'azure_lazy_lemon_tree_pot', desc: '蔚蓝陶盆种着小柠檬树，黄果实与绿叶把夏天留在店里', unlockRequirement: { level: 36 }, defaultScale: 1.15, decorationPanelTab: 'furniture' },

  // ═══════ ⑭.4c 慵懒客厅 Lv36（花园别墅软装线 · 豆袋沙发 · 大提琴）
  { id: 'modern_lazy_bean_bag_coral', name: '珊瑚懒人豆袋', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 49520, starValue: 7, icon: 'modern_lazy_bean_bag_coral', desc: '南瓜分段珊瑚粉豆袋，顶上有小提环，一屁股陷进去就不想起来', unlockRequirement: { level: 36 }, defaultScale: 1.08, decorationPanelTab: 'furniture' },
  { id: 'azure_lazy_bean_bag', name: '海蓝懒人豆袋', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 50420, starValue: 7, icon: 'azure_lazy_bean_bag', desc: '同款豆袋换成天蓝面料，软乎乎像一朵云，适合窝着看投影', unlockRequirement: { level: 36 }, defaultScale: 1.08, decorationPanelTab: 'furniture' },
  { id: 'modern_floor_cello', name: '立式大提琴', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 51320, starValue: 7, icon: 'modern_floor_cello', desc: '蜂蜜色木身大提琴斜靠而立，四弦与琴头卷纹把客厅变成小音乐厅', unlockRequirement: { level: 36 }, defaultScale: 1.25, decorationPanelTab: 'furniture' },

  // ═══════ ⑭.5 茶香小院专属家具（tea_house Lv25 解锁；decorationPanelTab=flower_room → 左侧「茶香小院」Tab）
  { id: 'gucha_tea_bench', name: '茶寮长凳', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 4375, starValue: 2, icon: 'gucha_tea_bench', desc: '素木长凳磨得发亮，台面留着一圈茶渍印', unlockRequirement: { level: 25 }, defaultScale: 1.1, decorationPanelTab: 'flower_room', allowedSceneIds: ['tea_house'] },
  { id: 'jiangnan_lattice_window', name: '花窗栏', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 12615, starValue: 6, icon: 'jiangnan_lattice_window', desc: '冰裂纹花窗格，淡蓝天空映在磨砂玻璃上', unlockRequirement: { level: 25 }, defaultScale: 1.28, decorationPanelTab: 'flower_room', allowedSceneIds: ['tea_house'] },
  { id: 'gucha_water_jar', name: '陶瓮水缸', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 11840, starValue: 5, icon: 'gucha_water_jar', desc: '粗陶大水瓮配竹勺，茶寮取水必备', unlockRequirement: { level: 25 }, defaultScale: 0.82, decorationPanelTab: 'flower_room', allowedSceneIds: ['tea_house'] },
  { id: 'gucha_charcoal_brazier', name: '竹风炉', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 24145, starValue: 6, icon: 'gucha_charcoal_brazier', desc: '竹编风炉炭火微红，陶壶上袅袅茶烟', unlockRequirement: { level: 26 }, defaultScale: 0.88, decorationPanelTab: 'flower_room', allowedSceneIds: ['tea_house'] },
  { id: 'jiangnan_rattan_daybed', name: '藤枕榻', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 28010, starValue: 8, icon: 'jiangnan_rattan_daybed', desc: '竹框卧榻配靛蓝垫与青花枕，午后小憩位', unlockRequirement: { level: 26 }, defaultScale: 1.55, decorationPanelTab: 'flower_room', allowedSceneIds: ['tea_house'] },
  { id: 'gucha_tea_boat', name: '茶则舟', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 25040, starValue: 6, icon: 'gucha_tea_boat', desc: '竹茶船托盘上摆着盖碗与公道杯', unlockRequirement: { level: 27 }, defaultScale: 1.05, decorationPanelTab: 'flower_room', allowedSceneIds: ['tea_house'] },
  { id: 'jiangnan_willow_cart', name: '柳编花车', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 27900, starValue: 7, icon: 'jiangnan_willow_cart', desc: '柳编小车木轮，桶里盛着牡丹与荷花', unlockRequirement: { level: 27 }, defaultScale: 1.22, decorationPanelTab: 'flower_room', allowedSceneIds: ['tea_house'] },
  { id: 'gucha_tea_chest', name: '封箱茶仓', slot: DecoSlot.SHELF, rarity: DecoRarity.FINE, cost: 17525, starValue: 7, icon: 'gucha_tea_chest', desc: '双层木架堆着蜡封茶砖与纸包', unlockRequirement: { level: 28 }, defaultScale: 1.35, decorationPanelTab: 'flower_room', allowedSceneIds: ['tea_house'] },
  { id: 'xianxia_herb_rack', name: '悬索晒药架', slot: DecoSlot.SHELF, rarity: DecoRarity.FINE, cost: 26080, starValue: 7, icon: 'xianxia_herb_rack', desc: '竹架悬着干花束与草药纸包，茶香伴药香', unlockRequirement: { level: 28 }, defaultScale: 1.68, decorationPanelTab: 'flower_room', allowedSceneIds: ['tea_house'] },
  { id: 'jiangnan_blue_cabinet', name: '青花博古柜', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 31070, starValue: 8, icon: 'jiangnan_blue_cabinet', desc: '红木博古架陈列青花瓶盏与折扇', unlockRequirement: { level: 29 }, defaultScale: 1.65, decorationPanelTab: 'flower_room', allowedSceneIds: ['tea_house'] },
  { id: 'xianxia_meditation_platform', name: '蒲团云台', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 17720, starValue: 6, icon: 'xianxia_meditation_platform', desc: '云纹矮台配草编蒲团，抹茶粉与小花点缀', unlockRequirement: { level: 30 }, defaultScale: 1.12, decorationPanelTab: 'flower_room', allowedSceneIds: ['tea_house'] },

  // ═══════ ⑭.6 橡树小屋专属家具（forest_treehouse Lv32–35 · 航海奇遇套）
  { id: 'sea_wheel_wall', name: '舵轮墙挂', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 12600, starValue: 7, icon: 'sea_wheel_wall', desc: '旧木舵轮悬在麻绳上，黄铜毂心闪着冒险光泽', unlockRequirement: { level: 32 }, defaultScale: 0.92, decorationPanelTab: 'flower_room', allowedSceneIds: ['forest_treehouse'] },
  { id: 'sea_anchor_bench', name: '船锚绳凳', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 30780, starValue: 7, icon: 'sea_anchor_bench', desc: '锈色船锚作靠背，麻绳缠腿托着木纹坐板', unlockRequirement: { level: 33 }, defaultScale: 1.28, decorationPanelTab: 'flower_room', allowedSceneIds: ['forest_treehouse'] },
  { id: 'sea_treasure_chest', name: '珍珠藏箱', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 31320, starValue: 8, icon: 'sea_treasure_chest', desc: '橡木宝箱半开，珍珠珊瑚与黄铜罗盘满溢而出', unlockRequirement: { level: 34 }, defaultScale: 1.02, decorationPanelTab: 'flower_room', allowedSceneIds: ['forest_treehouse'] },
  { id: 'sea_coral_cabinet', name: '珊瑚展柜', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 31950, starValue: 8, icon: 'sea_coral_cabinet', desc: '拱顶玻璃木柜，粉珊瑚与贝壳分层陈列', unlockRequirement: { level: 35 }, defaultScale: 1.58, decorationPanelTab: 'flower_room', allowedSceneIds: ['forest_treehouse'] },

  // ═══════ ⑭.7 梦云小屋专属家具（dream_cloud_house Lv20–24 · 梦幻卧室休闲套）
  { id: 'dream_cloud_bed', name: '月云大软床', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 61425, starValue: 9, icon: 'dream_cloud_bed', desc: '云朵床框托起浅紫绗缝被，月亮与星星抱枕软乎乎地窝在床头', unlockRequirement: { level: 20 }, defaultScale: 1.95, decorationPanelTab: 'flower_room', allowedSceneIds: ['dream_cloud_house'] },
  { id: 'dream_cloud_sofa', name: '星月转角沙发', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 51595, starValue: 9, icon: 'dream_cloud_sofa', desc: '奶油白大转角沙发配粉紫蓝抱枕，像睡前云朵客厅一样柔软', unlockRequirement: { level: 20 }, defaultScale: 2.18, decorationPanelTab: 'flower_room', allowedSceneIds: ['dream_cloud_house'] },
  { id: 'dream_cloud_star_rug', name: '星云软绒地毯', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 21995, starValue: 7, icon: 'dream_cloud_star_rug', desc: '浅蓝星云绒毯铺在月石地面上，轻柔星光像云雾一样散开', unlockRequirement: { level: 21 }, defaultScale: 1.65, decorationPanelTab: 'flower_room', allowedSceneIds: ['dream_cloud_house'], depthSortYLift: 0, depthSortFloorMat: true },
  { id: 'dream_cloud_moon_nightstand', name: '月灯床头柜', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 22930, starValue: 7, icon: 'dream_cloud_moon_nightstand', desc: '小云柜托着暖黄色月牙夜灯，星星抽屉把手带来睡前微光', unlockRequirement: { level: 21 }, defaultScale: 1.15, decorationPanelTab: 'flower_room', allowedSceneIds: ['dream_cloud_house'] },
  { id: 'dream_cloud_star_vanity', name: '星镜梳妆台', slot: DecoSlot.TABLE, rarity: DecoRarity.RARE, cost: 37205, starValue: 8, icon: 'dream_cloud_star_vanity', desc: '粉紫梳妆台配星形镜框和月金描边，适合摆在梦云卧室一角', unlockRequirement: { level: 22 }, defaultScale: 1.48, decorationPanelTab: 'flower_room', allowedSceneIds: ['dream_cloud_house'] },
  { id: 'dream_cloud_tea_table', name: '薄荷云茶几', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 24335, starValue: 7, icon: 'dream_cloud_tea_table', desc: '薄荷蓝圆茶几踩着云朵小脚，月金边框和小茶具让休闲角更温柔', unlockRequirement: { level: 22 }, defaultScale: 1.24, decorationPanelTab: 'flower_room', allowedSceneIds: ['dream_cloud_house'] },
  { id: 'dream_cloud_bookshelf', name: '浮云星书架', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 25505, starValue: 7, icon: 'dream_cloud_bookshelf', desc: '漂浮云朵书架摆着彩色睡前书和水晶月球，下方垂着小星星', unlockRequirement: { level: 23 }, defaultScale: 1.32, decorationPanelTab: 'flower_room', allowedSceneIds: ['dream_cloud_house'] },
  { id: 'dream_cloud_crescent_cushion', name: '月牙懒人坐垫', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 26675, starValue: 7, icon: 'dream_cloud_crescent_cushion', desc: '金黄月牙抱着软垫和星星靠枕，是二楼休闲角的梦境座位', unlockRequirement: { level: 23 }, defaultScale: 1.18, decorationPanelTab: 'flower_room', allowedSceneIds: ['dream_cloud_house'] },
  { id: 'dream_cloud_floor_lamp', name: '星梦落地灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.FINE, cost: 20475, starValue: 7, icon: 'dream_cloud_floor_lamp', desc: '云朵底座托起细高灯杆，月星灯罩洒下温暖睡前光', unlockRequirement: { level: 24 }, defaultScale: 1.28, decorationPanelTab: 'flower_room', allowedSceneIds: ['dream_cloud_house'] },
  { id: 'dream_cloud_storage_chest', name: '梦境收纳箱', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 23165, starValue: 7, icon: 'dream_cloud_storage_chest', desc: '奶油云朵箱身配浅紫箱盖，月牙锁扣收藏睡前小秘密', unlockRequirement: { level: 24 }, defaultScale: 0.98, decorationPanelTab: 'flower_room', allowedSceneIds: ['dream_cloud_house'] },

  // ═══════ ⑭.8 花田农舍专属家具（flower_farm_house Lv30–33 · 拾光田园套 v2）
  { id: 'farm_vegetable_patch_rug', name: '青畦菜毯', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 22845, starValue: 7, icon: 'farm_vegetable_patch_rug', desc: '四格小菜畦：卷心菜、小葱、辣椒与胡萝卜，整齐又鲜活', unlockRequirement: { level: 30 }, defaultScale: 2.8, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_farm_house'], depthSortYLift: 0, depthSortFloorMat: true },
  { id: 'farm_garden_tool_stand', name: '农具木架', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 16275, starValue: 5, icon: 'farm_garden_tool_stand', desc: '一字木架插着铁铲、手镰与锄头，收工好帮手', unlockRequirement: { level: 30 }, defaultScale: 1.45, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_farm_house'] },
  { id: 'farm_fruit_crate_stack', name: '丰收果筐堆', slot: DecoSlot.SHELF, rarity: DecoRarity.FINE, cost: 28260, starValue: 7, icon: 'farm_fruit_crate_stack', desc: '三层木筐堆叠，果蔬收成从箱缝满溢出来', unlockRequirement: { level: 31 }, defaultScale: 1.22, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_farm_house'] },
  { id: 'farm_scarecrow', name: '稻草守卫', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 27980, starValue: 7, icon: 'farm_scarecrow', desc: '草帽碎花围巾的软萌稻草人，默默守住院落', unlockRequirement: { level: 31 }, defaultScale: 1.35, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_farm_house'] },
  { id: 'farm_hen_coop', name: '暖巢鸡舍', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 26820, starValue: 8, icon: 'farm_hen_coop', desc: '小木鸡舍里窝着两只圆滚滚的白鸡，静态观景点', unlockRequirement: { level: 32 }, defaultScale: 1.78, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_farm_house'] },
  { id: 'farm_melon_trellis', name: '蜜瓜藤架', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 27540, starValue: 7, icon: 'farm_melon_trellis', desc: '木架垂挂圆滚滚蜜瓜，架下连着一小片土畦', unlockRequirement: { level: 32 }, defaultScale: 2.72, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_farm_house'] },
  { id: 'farm_hay_bench', name: '干草长凳', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 11160, starValue: 4, icon: 'farm_hay_bench', desc: '木框长凳配干草垫，午后歇脚看菜畦', unlockRequirement: { level: 33 }, defaultScale: 1.12, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_farm_house'] },
  { id: 'farm_beehive_stand', name: '蜜意蜂箱', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 24480, starValue: 7, icon: 'farm_beehive_stand', desc: '木架托着草编蜂箱，两三只小蜜蜂停在巢口', unlockRequirement: { level: 33 }, defaultScale: 1.38, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_farm_house'] },
  { id: 'farm_fu_sticker_wall', name: '福字贴纸', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 18255, starValue: 8, icon: 'farm_fu_sticker_wall', desc: '菱形大红福字贴纸，贴在院墙添年味', unlockRequirement: { level: 30 }, defaultScale: 0.92, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_farm_house'] },
  { id: 'farm_ivy_wall', name: '满墙爬山虎', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 35010, starValue: 8, icon: 'farm_ivy_wall', desc: '鲜绿爬山虎从墙脚爬满大半墙面，春意盎然', unlockRequirement: { level: 31 }, defaultScale: 2.08, decorationPanelTab: 'flower_room', allowedSceneIds: ['flower_farm_house'] },

  // ═══════ ⑭.9 拾光田园通用件（全场景 · Lv30–31）
  { id: 'farm_rocking_chair', name: '竹木摇椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 23815, starValue: 7, icon: 'farm_rocking_chair', desc: '蜂蜜色木条摇椅，摇啊摇晒太阳', unlockRequirement: { level: 30 }, defaultScale: 1.15, decorationPanelTab: 'furniture' },
  { id: 'farm_picket_fence_wall', name: '木栅栏', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 28620, starValue: 7, icon: 'farm_picket_fence_wall', desc: '栅格木栏缠绿藤紫葡萄，院边小花架', unlockRequirement: { level: 31 }, defaultScale: 1.68, decorationPanelTab: 'garden' },

  // ═══════ ⑮ 古风/民俗/奇匠扩展 Lv30–35（batch51 · 全场景通用 · 售价高于 Lv21–30 档）
  { id: 'ancient_brush_mountain', name: '笔架山', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON, cost: 29385, starValue: 6, icon: 'ancient_brush_mountain', desc: '青玉笔山插着数支毛笔，案头文房小景', unlockRequirement: { level: 30 }, defaultScale: 0.55 },
  { id: 'ancient_inkstone_desk', name: '砚台书案', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 37535, starValue: 7, icon: 'ancient_inkstone_desk', desc: '红木矮案嵌砚台，青瓷水盂与笔搁一字排开', unlockRequirement: { level: 29 }, defaultScale: 1.2 },
  { id: 'ancient_scroll_rack', name: '经卷竹架', slot: DecoSlot.SHELF, rarity: DecoRarity.FINE, cost: 29745, starValue: 7, icon: 'ancient_scroll_rack', desc: '竹架三层悬着红绳束口的素卷', unlockRequirement: { level: 30 }, defaultScale: 1.5 },
  { id: 'ancient_dressing_case', name: '梳妆奁台', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 33120, starValue: 8, icon: 'ancient_dressing_case', desc: '黑漆妆台配三折铜镜，玉簪盒与珠串小碟', unlockRequirement: { level: 31 }, defaultScale: 1.35 },
  { id: 'folk_kite_wall', name: '沙燕风筝墙', slot: DecoSlot.WALLART, rarity: DecoRarity.COMMON, cost: 32220, starValue: 7, icon: 'folk_kite_wall', desc: '竹框上挂着红青三只沙燕风筝，民俗墙饰', unlockRequirement: { level: 31 }, defaultScale: 0.95 },
  { id: 'folk_lion_head_stand', name: '醒狮头架', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 54000, starValue: 8, icon: 'folk_lion_head_stand', desc: '金红醒狮头立在木架上，绒边大眼喜气洋洋', unlockRequirement: { level: 31 }, defaultScale: 0.85 },
  { id: 'ancient_landscape_screen', name: '山水屏风', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 33750, starValue: 8, icon: 'ancient_landscape_screen', desc: '四扇乌木框绢屏，水墨山水层峦叠瀑', unlockRequirement: { level: 32 }, defaultScale: 1.82 },
  { id: 'folk_dragon_bench', name: '龙纹长凳', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 90000, starValue: 12, icon: 'folk_dragon_bench', desc: '朱漆长凳龙脊靠背，金黄坐垫缀红穗', unlockRequirement: { level: 32 }, defaultScale: 1.75, decorationPanelTab: 'furniture' },
  { id: 'ancient_master_chair', name: '太师椅', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 34380, starValue: 9, icon: 'ancient_master_chair', desc: '深木官帽椅，靠背雕龙纹，正襟危坐位', unlockRequirement: { level: 33 }, defaultScale: 1.1, decorationPanelTab: 'furniture' },
  { id: 'ancient_bronze_ding', name: '三足鼎案', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 35280, starValue: 10, icon: 'ancient_bronze_ding', desc: '青铜三足鼎立于红木案，云纹绿锈古意盎然', unlockRequirement: { level: 33 }, defaultScale: 0.78 },
  { id: 'ancient_phoenix_rug', name: '凤纹地毯', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 81000, starValue: 10, icon: 'ancient_phoenix_rug', desc: '绛红织毯金线凤纹，青绿镶边铺地显贵', unlockRequirement: { level: 33 }, defaultScale: 1.65, depthSortYLift: 0, depthSortFloorMat: true },
  { id: 'ancient_jade_bi_stand', name: '礼璧展架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 37350, starValue: 11, icon: 'ancient_jade_bi_stand', desc: '乌木小案托着青玉礼璧，红绸垫承古器', unlockRequirement: { level: 34 }, defaultScale: 0.9 },
  { id: 'whimsy_geode_table', name: '晶洞茶几', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 36450, starValue: 10, icon: 'whimsy_geode_table', desc: '紫晶洞切片台面闪微光，铁架承住矿物奇观', unlockRequirement: { level: 34 }, defaultScale: 0.95 },
  { id: 'folk_pole_lantern', name: '灯杆宫灯', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 38520, starValue: 11, icon: 'folk_pole_lantern', desc: '木杆挑着朱红宫灯，石座稳立庭院夜宴', unlockRequirement: { level: 35 }, defaultScale: 1.8 },
  { id: 'ancient_stone_lantern', name: '石灯笼', slot: DecoSlot.GARDEN, rarity: DecoRarity.FINE, cost: 37620, starValue: 10, icon: 'ancient_stone_lantern', desc: '花岗石灯笼四层塔身，灯室暖黄静立庭径', unlockRequirement: { level: 35 }, defaultScale: 1.0 },

  // ═══════ ⑫ 蛋糕房专属家具（cake_shop 第三场景，参照蝴蝶小屋专属 Tab；首批 20 件可摆满一屋）
  // 风格锚点：奶油白 + 草莓粉 + 蜜木 + 薄荷绿 + 马卡龙糖果点缀；与世界地图 worldmap_thumb_cake_shop 粉瓦顶外观呼应。
  // 全部 decorationPanelTab='flower_room' + allowedSceneIds=['cake_shop']：仅在蛋糕房场景出现。
  { id: 'cake_shelf_layered_display',     name: '分层蛋糕展示柜', slot: DecoSlot.SHELF,    rarity: DecoRarity.LIMITED, cost: 9765, starValue: 11, icon: 'cake_shelf_layered_display',     desc: '蜜木+黄铜玻璃三层柜，奶油蛋糕与马卡龙的招牌门面', unlockRequirement: { level: 16 }, defaultScale: 1.5,  decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_shelf_baking_pantry',       name: '烘焙原料架',     slot: DecoSlot.SHELF,    rarity: DecoRarity.FINE,    cost: 5250, starValue: 5,  icon: 'cake_shelf_baking_pantry',       desc: '蜜木双层架配奶油盖玻璃罐：面粉、糖、可可与彩糖', unlockRequirement: { level: 15 }, defaultScale: 1.25, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_shelf_chilled_cabinet',     name: '草莓冷藏甜品柜', slot: DecoSlot.SHELF,    rarity: DecoRarity.RARE,    cost: 8505, starValue: 8,  icon: 'cake_shelf_chilled_cabinet',     desc: '粉色立柜玻璃门内排着马卡龙慕斯与小蛋糕', unlockRequirement: { level: 17 }, defaultScale: 1.18, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_shelf_fondant_flowers',     name: '翻糖花展示架',   slot: DecoSlot.SHELF,    rarity: DecoRarity.FINE,    cost: 7875, starValue: 6,  icon: 'cake_shelf_fondant_flowers',     desc: '奶白杆配三层圆台，摆着多彩翻糖花与糖珠', unlockRequirement: { level: 16 }, defaultScale: 1.05, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_table_workstation',         name: '甜品制作工作台', slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,    cost: 5460, starValue: 6,  icon: 'cake_table_workstation',         desc: '蜜木大理石台，搅拌钵、挤花袋与翻糖小球一字排开', unlockRequirement: { level: 15 }, defaultScale: 1.30, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_table_register_counter',    name: '蛋糕收银台',     slot: DecoSlot.TABLE,    rarity: DecoRarity.RARE,    cost: 8350, starValue: 8,  icon: 'cake_table_register_counter',    desc: '草莓粉柜身配大理石面，复古收银机与玻璃钟罩马卡龙', unlockRequirement: { level: 16 }, defaultScale: 1.30, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_table_round_dessert',       name: '甜品分享小圆桌', slot: DecoSlot.TABLE,    rarity: DecoRarity.COMMON,  cost: 5250,  starValue: 3,  icon: 'cake_table_round_dessert',       desc: '奶白扇贝边圆桌，两份小蛋糕与单枝粉玫瑰', unlockRequirement: { level: 15 }, defaultScale: 1.05, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_table_gift_wrap',           name: '礼盒打包台',     slot: DecoSlot.TABLE,    rarity: DecoRarity.FINE,    cost: 7875, starValue: 6,  icon: 'cake_table_gift_wrap',           desc: '蜜木台面背靠多色缎带卷，奶油礼盒与黄铜剪刀', unlockRequirement: { level: 17 }, defaultScale: 1.18, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_table_dessert_island',      name: '甜点中岛长桌',   slot: DecoSlot.TABLE,    rarity: DecoRarity.RARE,    cost: 8980, starValue: 9,  icon: 'cake_table_dessert_island',      desc: '奶白长桌带粉色糖霜流挂，香槟金腿与一排小甜点', unlockRequirement: { level: 18 }, defaultScale: 1.40, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_light_pink_double_oven',    name: '草莓双门烤箱',   slot: DecoSlot.LIGHT,    rarity: DecoRarity.RARE,    cost: 9290, starValue: 10, icon: 'cake_light_pink_double_oven',    desc: '草莓粉立式双门烤箱，门内可见烤盘里的小蛋糕', unlockRequirement: { level: 16 }, defaultScale: 1.30, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_light_stand_mixer',         name: '粉色立式搅拌机', slot: DecoSlot.LIGHT,    rarity: DecoRarity.FINE,    cost: 5880, starValue: 5,  icon: 'cake_light_stand_mixer',         desc: '复古粉立式搅拌机，搅拌缸里堆着奶油尖', unlockRequirement: { level: 15 }, defaultScale: 0.65, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_light_pendant_macaron',     name: '马卡龙塔灯',     slot: DecoSlot.LIGHT,    rarity: DecoRarity.FINE,    cost: 7875, starValue: 6,  icon: 'cake_light_pendant_macaron',     desc: '奶白圆底盘配黄铜立柱，三层粉绿黄马卡龙灯罩柔光发亮', unlockRequirement: { level: 17 }, defaultScale: 1.25, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_light_chocolate_fountain',  name: '巧克力喷泉机',   slot: DecoSlot.LIGHT,    rarity: DecoRarity.RARE,    cost: 8505, starValue: 8,  icon: 'cake_light_chocolate_fountain',  desc: '黄铜螺旋柱与双层流挂巧克力，旁配草莓串与棉花糖', unlockRequirement: { level: 18 }, defaultScale: 0.95, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_orn_strawberry_stool_pair', name: '草莓坐墩组',     slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,    cost: 5460, starValue: 4,  icon: 'cake_orn_strawberry_stool_pair', desc: '一红一粉两只草莓造型小坐墩，绿叶萼配奶白细腿', unlockRequirement: { level: 15 }, defaultScale: 0.85, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_orn_wedding_cake_centerpiece', name: '婚礼蛋糕台',  slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 16215, starValue: 19, icon: 'cake_orn_wedding_cake_centerpiece', desc: '三层奶白翻糖蛋糕配粉玫瑰与糖珠，瓷台金边', unlockRequirement: { level: 20 }, defaultScale: 1.10, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_orn_donut_cushion_pair',    name: '甜甜圈坐垫组',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.COMMON,  cost: 7875,  starValue: 3,  icon: 'cake_orn_donut_cushion_pair',    desc: '一大一小甜甜圈造型软垫，粉糖霜与巧克力两味', unlockRequirement: { level: 16 }, defaultScale: 1.00, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_orn_teddy_baker',           name: '烘焙小熊摆件',   slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE,    cost: 7875, starValue: 5,  icon: 'cake_orn_teddy_baker',           desc: '焦糖蜜熊戴厨师帽抱奶油碗，店铺萌系吉祥物', unlockRequirement: { level: 17 }, defaultScale: 0.85, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_wallart_menu_chalkboard',   name: '蛋糕菜单黑板',   slot: DecoSlot.WALLART,  rarity: DecoRarity.FINE,    cost: 5460, starValue: 4,  icon: 'cake_wallart_menu_chalkboard',   desc: '奶粉扇贝木框配森林绿黑板，粉笔画蛋糕剪影与缎带', unlockRequirement: { level: 15 }, defaultScale: 1.20, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_wallart_lollipop_clock',    name: '棒棒糖挂钟',     slot: DecoSlot.WALLART,  rarity: DecoRarity.FINE,    cost: 7875, starValue: 5,  icon: 'cake_wallart_lollipop_clock',    desc: '粉绿白糖纹圆盘配奶白糖棒，黄铜指针无数字', unlockRequirement: { level: 16 }, defaultScale: 0.95, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },
  { id: 'cake_garden_strawberry_arch',    name: '草莓藤拱门',     slot: DecoSlot.GARDEN,   rarity: DecoRarity.LIMITED, cost: 12285, starValue: 14, icon: 'cake_garden_strawberry_arch',    desc: '奶白拱门缠满草莓藤与白花，门下两盆小草莓', unlockRequirement: { level: 17 }, defaultScale: 2.00, decorationPanelTab: 'flower_room', allowedSceneIds: ['cake_shop'] },

  // ═══════ ⑪.5 首月签到活动专属家具（7/14/21/28 日签到 + 28 日累计礼包；免费赠予，starValue 必须为 0）
  { id: 'checkin_m1_bunny_ac', name: '兔兔云风空调', slot: DecoSlot.LIGHT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'checkin_m1_bunny_ac', desc: '兔耳立式空调，奶白机身配薄荷风口与小云朵冷气灯', unlockRequirement: { questId: 'checkin_m1_week1_bunny_ac', conditionText: '活动解锁', questDetailText: '签到奖励' }, defaultScale: 1.32 },
  { id: 'checkin_m1_crystal_partition', name: '水晶花影隔断', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'checkin_m1_crystal_partition', desc: '半透明水晶隔断屏，金色枝蔓与粉紫棱镜把花影分成彩光', unlockRequirement: { questId: 'checkin_m1_week2_crystal_partition', conditionText: '活动解锁', questDetailText: '签到奖励' }, defaultScale: 1.38 },
  { id: 'checkin_m1_moon_display_arch', name: '星月陈列拱架', slot: DecoSlot.SHELF, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'checkin_m1_moon_display_arch', desc: '月牙形金属拱架，星砂玻璃格里摆着迷你花瓶与香氛小盒', unlockRequirement: { questId: 'checkin_m1_week3_moon_display_arch', conditionText: '活动解锁', questDetailText: '签到奖励' }, defaultScale: 1.22 },
  { id: 'checkin_m1_butterfly_wall_lamp', name: '蝶影流光壁饰', slot: DecoSlot.WALLART, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'checkin_m1_butterfly_wall_lamp', desc: '玫瑰金墙饰托起半透明蝴蝶灯片，像暮光停在墙上', unlockRequirement: { questId: 'checkin_m1_week4_butterfly_wall_lamp', conditionText: '活动解锁', questDetailText: '签到奖励' }, defaultScale: 0.6 },
  { id: 'checkin_m1_dew_wish_fountain', name: '晨露许愿花池', slot: DecoSlot.GARDEN, rarity: DecoRarity.RARE, cost: 2256, starValue: 7, icon: 'checkin_m1_dew_wish_fountain', desc: '贝壳形浅水花池，水晶露珠、睡莲与小星灯围出庭院清晨感', unlockRequirement: { level: 8 }, defaultScale: 1.48 },
  { id: 'checkin_m1_rocking_horse', name: '花园摇摇马', slot: DecoSlot.GARDEN, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'checkin_m1_rocking_horse', desc: '户外花园里的木质摇摇马玩具，彩绘马鞍、藤花与小风车一起摇出童话感', unlockRequirement: { questId: 'checkin_m1_28_rocking_horse', conditionText: '活动解锁', questDetailText: '签到奖励' }, defaultScale: 1.15 },


  // ═══════ 清涟荷影主题（新手礼包 + 后续同主题扩展；全场景可摆，starValue 礼包件为 0）
  { id: 'qinglian_flower_cart', name: '帷帘花车', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'qinglian_flower_cart', desc: '薄荷帷帘花车，棚顶祥云饰与满盆 pastel 花束', unlockRequirement: { questId: 'qinglian_newbie_gift_claimed', conditionText: '新手礼包', questDetailText: '完成新手礼包（观看 2 次广告）后解锁' }, defaultScale: 1.65, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_cloud_rug', name: '祥云地毯', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'qinglian_cloud_rug', desc: '奶油底祥云纹椭圆地毯，粉绿 pastel 祥云绕边', unlockRequirement: { questId: 'qinglian_newbie_gift_claimed', conditionText: '新手礼包', questDetailText: '完成新手礼包（观看 2 次广告）后解锁' }, defaultScale: 1.65, depthSortYLift: 0, depthSortFloorMat: true, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_koi_bench', name: '锦鲤曲榻', slot: DecoSlot.TABLE, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'qinglian_koi_bench', desc: '桃木曲榻配薄荷垫与锦鲤纹座面，流苏轻晃', unlockRequirement: { questId: 'qinglian_newbie_gift_claimed', conditionText: '新手礼包', questDetailText: '完成新手礼包（观看 2 次广告）后解锁' }, defaultScale: 1.28, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_lotus_screen', name: '荷梦屏风', slot: DecoSlot.WALLART, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'qinglian_lotus_screen', desc: '四扇荷塘屏风，粉荷与青绸带连续成景', unlockRequirement: { questId: 'qinglian_newbie_gift_claimed', conditionText: '新手礼包', questDetailText: '完成新手礼包（观看 2 次广告）后解锁' }, defaultScale: 1.42, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_lotus_lamp', name: '莲光立灯', slot: DecoSlot.LIGHT, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'qinglian_lotus_lamp', desc: '莲瓣灯盏暖光，荷叶底座金边', unlockRequirement: { questId: 'qinglian_newbie_gift_claimed', conditionText: '新手礼包', questDetailText: '完成新手礼包（观看 2 次广告）后解锁' }, defaultScale: 1.12, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_lotus_pond_table', name: '清池茶案', slot: DecoSlot.TABLE, rarity: DecoRarity.LIMITED, cost: 0, starValue: 0, icon: 'qinglian_lotus_pond_table', desc: '嵌莲池方案，薄荷紫纱垂帘与点点萤光', unlockRequirement: { questId: 'qinglian_newbie_gift_claimed', conditionText: '新手礼包', questDetailText: '完成新手礼包（观看 2 次广告）后解锁' }, defaultScale: 1.25, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_tea_shelf', name: '清涟茶架', slot: DecoSlot.SHELF, rarity: DecoRarity.FINE, cost: 6710, starValue: 3, icon: 'qinglian_tea_shelf', desc: '三层 mint 茶具架，紫纱垂帘与盖碗套组', unlockRequirement: { level: 4 }, defaultScale: 1.55, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_lantern_frame', name: '宫灯花架', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 13000, starValue: 3, icon: 'qinglian_lantern_frame', desc: '木架悬挂 pastel 宫灯，夜宴花坊氛围', unlockRequirement: { level: 5 }, defaultScale: 2.58, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_scholar_rock', name: '粉晶山石', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.FINE, cost: 13044, starValue: 4, icon: 'qinglian_scholar_rock', desc: '粉晶玲珑石与祥云木座，案头清供', unlockRequirement: { level: 6 }, defaultScale: 1.25, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_guqin_stand', name: '古琴雅案', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 18036, starValue: 4, icon: 'qinglian_guqin_stand', desc: '古琴案几配云纹屏风，紫绿渐变琴身', unlockRequirement: { level: 7 }, defaultScale: 1.4, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_bamboo_window', name: '冰纹花窗', slot: DecoSlot.WALLART, rarity: DecoRarity.FINE, cost: 12480, starValue: 4, icon: 'qinglian_bamboo_window', desc: '八角冰裂纹花窗，框外淡竹与飞燕剪影', unlockRequirement: { level: 8 }, defaultScale: 1.30, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_wisteria_vanity', name: '紫藤绢屏梳妆台', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 15600, starValue: 5, icon: 'qinglian_wisteria_vanity', desc: '浅木梳妆台配三扇紫藤绢屏，仙闺氛围', unlockRequirement: { level: 9 }, defaultScale: 1.55, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_cloud_book_desk', name: '祥云书案', slot: DecoSlot.TABLE, rarity: DecoRarity.FINE, cost: 14742, starValue: 4, icon: 'qinglian_cloud_book_desk', desc: '浅木书案配祥云腿雕，青瓷笔架与素卷', unlockRequirement: { level: 10 }, defaultScale: 1.30, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_moon_shelf', name: '月洞博古架', slot: DecoSlot.SHELF, rarity: DecoRarity.RARE, cost: 15015, starValue: 6, icon: 'qinglian_moon_shelf', desc: '月洞门博古架，格内青瓷与粉牡丹小品', unlockRequirement: { level: 11 }, defaultScale: 1.85, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_peony_screen', name: '牡丹圆光屏风', slot: DecoSlot.WALLART, rarity: DecoRarity.RARE, cost: 16380, starValue: 6, icon: 'qinglian_peony_screen', desc: '三扇绢屏绘牡丹百合，圆光淡粉边', unlockRequirement: { level: 12 }, defaultScale: 2.02, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_cherry_wardrobe', name: '樱霞轻衣柜', slot: DecoSlot.SHELF, rarity: DecoRarity.FINE, cost: 27300, starValue: 5, icon: 'qinglian_cherry_wardrobe', desc: '奶油木衣柜配樱花板面，祥云形淡金拉手', unlockRequirement: { level: 13 }, defaultScale: 1.75, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_silk_daybed', name: '流纱罗汉榻', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 43680, starValue: 7, icon: 'qinglian_silk_daybed', desc: '浅木罗汉榻配薄荷珊瑚丝垫，流纱轻垂', unlockRequirement: { level: 14 }, defaultScale: 1.75, decorationPanelTab: 'qinglian' },
  { id: 'qinglian_lotus_canopy_bed', name: '莲纱架子床', slot: DecoSlot.ORNAMENT, rarity: DecoRarity.RARE, cost: 60060, starValue: 8, icon: 'qinglian_lotus_canopy_bed', desc: '四柱架子床垂桃荷纱幔，莲纹床帏如梦', unlockRequirement: { level: 15 }, defaultScale: 2.5, decorationPanelTab: 'qinglian' },

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

/** 获取某等级范围 (fromLevel, toLevel] 内按等级解锁的家具（用于升级弹窗展示；不含广告宣传款） */
export function getDecosUnlockedInLevelRange(fromLevel: number, toLevel: number): DecoDef[] {
  return DECO_DEFS.filter(d => {
    if (AD_UNLOCK_DECO_IDS.has(d.id)) return false;
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
    (deco.decorationPanelTab === 'flower_room' || deco.decorationPanelTab === 'qinglian') &&
    (deco.defaultScale ?? 1) > 0.92
  ) {
    return 0;
  }
  if (deco.slot === DecoSlot.ORNAMENT && deco.decorationPanelTab !== 'furniture' && deco.decorationPanelTab !== 'garden' && deco.decorationPanelTab !== 'qinglian') {
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
    /** 台面小家电：脚点 y 常比桌/柜小一整档，须接近 ORNAMENT 小件的 95～110 补偿 */
    if (ds < 0.98) return 110;
    return 0;
  }

  if (deco.slot === DecoSlot.ORNAMENT) {
    /** 长凳、双凳组等大件仍按脚点 y；略小的「家具 Tab」件仍可摆台面 */
    if (deco.decorationPanelTab === 'furniture' && (deco.defaultScale ?? 1) > 0.92) return 0;
    /** 房屋专属 Tab 的大件（如蝴蝶小屋沙发/藤椅）同样按地面大件处理 */
    if ((deco.decorationPanelTab === 'flower_room' || deco.decorationPanelTab === 'qinglian') && (deco.defaultScale ?? 1) > 0.92) return 0;
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
  | DecoSlot.GARDEN
  | 'qinglian';

/** 左栏顺序 */
export const DECO_PANEL_TABS: DecoPanelTabId[] = [
  'room_styles',
  'flower_room',
  'furniture',
  'appliance',
  DecoSlot.ORNAMENT,
  DecoSlot.WALLART,
  DecoSlot.GARDEN,
  'qinglian',
];

/** 编辑托盘 Tab（含房壳 room_styles，与图标表 7 列一致） */
export type FurnitureTrayTabId = DecoPanelTabId;

export const FURNITURE_TRAY_REGULAR_TABS: FurnitureTrayTabId[] = [
  'flower_room',
  'furniture',
  'appliance',
  DecoSlot.ORNAMENT,
  DecoSlot.WALLART,
  DecoSlot.GARDEN,
  'room_styles',
];

/** 主题线 Tab（与常规分类分列，由托盘顶栏「主题」切换） */
export const FURNITURE_TRAY_THEME_TABS: FurnitureTrayTabId[] = [
  'qinglian',
];

/** 工坊线 Tab（仅 workshopExclusive 家具；无房壳 / 房屋专属 / 主题套） */
export const FURNITURE_TRAY_WORKSHOP_TABS: FurnitureTrayTabId[] = [
  'furniture',
  'appliance',
  DecoSlot.ORNAMENT,
  DecoSlot.WALLART,
  DecoSlot.GARDEN,
];

export const FURNITURE_TRAY_TABS: FurnitureTrayTabId[] = [
  ...FURNITURE_TRAY_REGULAR_TABS,
  ...FURNITURE_TRAY_THEME_TABS,
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
  if (tab === 'qinglian') return { name: '清涟荷影', emoji: '' };
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
    case 'qinglian':
      return 'furniture_tray_tab_qinglian_idle';
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
  if (deco.decorationPanelTab === 'qinglian') return 'qinglian';
  return furnitureTrayTabFromSlot(deco.slot);
}

/** 工坊托盘：按槽位 / 面板 Tab 归入子分类（不含房壳与场景专属） */
export function getWorkshopTrayTabForDeco(deco: DecoDef): FurnitureTrayTabId {
  if (deco.slot === DecoSlot.LIGHT) return 'appliance';
  if (deco.slot === DecoSlot.WALLART) return DecoSlot.WALLART;
  if (deco.slot === DecoSlot.GARDEN) return DecoSlot.GARDEN;
  if (deco.slot === DecoSlot.ORNAMENT && deco.decorationPanelTab !== 'furniture') {
    return DecoSlot.ORNAMENT;
  }
  return 'furniture';
}

/** 编辑托盘「工坊」顶栏：仅已配置为 workshopExclusive 的家具 */
export function getWorkshopDecosForTrayTab(tab: FurnitureTrayTabId, sceneId: string): DecoDef[] {
  return DECO_DEFS.filter(d => {
    if (!d.workshopExclusive) return false;
    if (isDecoSpecialUiCategory(d)) return false;
    if (!isDecoAllowedInScene(d, sceneId)) return false;
    return getWorkshopTrayTabForDeco(d) === tab;
  });
}

export function getDecosForDecorationPanelTab(tab: DecoPanelTabId, sceneId: string): DecoDef[] {
  if (tab === 'room_styles') return [];

  const inScene = (d: DecoDef) => !isDecoSpecialUiCategory(d) && isDecoAllowedInScene(d, sceneId);

  if (tab === 'furniture') {
    return DECO_DEFS.filter((d) => {
      if (!inScene(d)) return false;
      if (d.decorationPanelTab === 'furniture') return true;
      if (d.decorationPanelTab === 'flower_room' || d.decorationPanelTab === 'garden' || d.decorationPanelTab === 'qinglian') return false;
      return d.slot === DecoSlot.SHELF || d.slot === DecoSlot.TABLE;
    });
  }

  const slotMatch = (d: DecoDef): boolean => {
    if (tab === 'flower_room') {
      return d.decorationPanelTab === 'flower_room';
    }
    if (tab === 'qinglian') {
      return d.decorationPanelTab === 'qinglian';
    }
    if (tab === 'appliance') {
      return (
        d.slot === DecoSlot.LIGHT &&
        d.decorationPanelTab !== 'furniture' &&
        d.decorationPanelTab !== 'flower_room' &&
        d.decorationPanelTab !== 'garden' &&
        d.decorationPanelTab !== 'qinglian'
      );
    }
    if (tab === DecoSlot.GARDEN) {
      if (d.decorationPanelTab === 'garden') return true;
      return (
        d.slot === DecoSlot.GARDEN &&
        d.decorationPanelTab !== 'furniture' &&
        d.decorationPanelTab !== 'flower_room' &&
        d.decorationPanelTab !== 'qinglian'
      );
    }
    if (tab === DecoSlot.ORNAMENT || tab === DecoSlot.WALLART) {
      return (
        d.slot === tab &&
        d.decorationPanelTab !== 'furniture' &&
        d.decorationPanelTab !== 'flower_room' &&
        d.decorationPanelTab !== 'garden' &&
        d.decorationPanelTab !== 'qinglian'
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
