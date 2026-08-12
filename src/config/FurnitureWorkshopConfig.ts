import type { UnlockRequirement } from '@/utils/UnlockChecker';
import { DECO_MAP, DecoSlot } from '@/config/DecorationConfig';
import { FURNITURE_RENDER_MAP } from '@/config/FurnitureRenderConfig';
import { WORKSHOP_ORDER_MIN_PLAYER_LEVEL } from '@/config/OrderSpawnConfig';

/** 家具工坊入口开放等级（与家具工匠订单一致，6 级） */
export const FURNITURE_WORKSHOP_UNLOCK_LEVEL = WORKSHOP_ORDER_MIN_PLAYER_LEVEL;

export type WorkshopBlueprintRarity = 'common' | 'rare' | 'epic' | 'limited';

/** 工坊制作页分类 Tab（不含「全部」） */
export type WorkshopCraftCategory = 'furniture' | 'appliance' | 'ornament' | 'wallart';
export type WorkshopCraftCategoryFilter = 'all' | WorkshopCraftCategory;

export const WORKSHOP_CRAFT_CATEGORY_TABS: ReadonlyArray<{ id: WorkshopCraftCategoryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'furniture', label: '家具' },
  { id: 'appliance', label: '家电' },
  { id: 'ornament', label: '摆件' },
  { id: 'wallart', label: '墙饰' },
];

/** 工坊页面专有货币（锤子/建造材料） */
export const WORKSHOP_MATERIAL_ID = 'workshop_material';
/** @deprecated 旧统一染料，迁移至粉/黄 */
export const WORKSHOP_DYE_MATERIAL_ID = 'workshop_dye';
export const WORKSHOP_DYE_PINK_ID = 'workshop_dye_pink';
export const WORKSHOP_DYE_YELLOW_ID = 'workshop_dye_yellow';
export const WORKSHOP_DYE_BLUE_ID = 'workshop_dye_blue';
export const WORKSHOP_DYE_GREEN_ID = 'workshop_dye_green';

export const WORKSHOP_MATERIAL_ICON = 'icon_workshop_material';
export const WORKSHOP_DYE_PINK_ICON = 'icon_workshop_dye_pink';
export const WORKSHOP_DYE_YELLOW_ICON = 'icon_workshop_dye_yellow';
export const WORKSHOP_DYE_BLUE_ICON = 'icon_workshop_dye_blue';
export const WORKSHOP_DYE_GREEN_ICON = 'icon_workshop_dye_green';
/** @deprecated 使用分色染料图标 */
export const WORKSHOP_DYE_ICON = WORKSHOP_DYE_PINK_ICON;
export const WORKSHOP_HUAYUAN_ICON = 'icon_huayuan';

export interface WorkshopResourceDef {
  id: string;
  icon: string;
  tint?: number;
}

/** 材料栏点击说明（用途 + 获取途径） */
export interface WorkshopResourceHelp {
  purpose: string;
  acquire: string;
}

const WORKSHOP_RESOURCE_HELP: Record<string, WorkshopResourceHelp> = {
  [WORKSHOP_MATERIAL_ID]: {
    purpose: '制作图纸中家具的必须材料。',
    acquire: '家具工匠的订单，其他活动。',
  },
  [WORKSHOP_DYE_PINK_ID]: {
    purpose: '可以制作出樱粉色的物品。',
    acquire: '许愿池，神秘商店，签到，其他活动。',
  },
  [WORKSHOP_DYE_YELLOW_ID]: {
    purpose: '可以制作出蜜黄色的物品。',
    acquire: '许愿池，神秘商店，签到，其他活动。',
  },
  [WORKSHOP_DYE_BLUE_ID]: {
    purpose: '可以制作出天蓝色的物品。',
    acquire: '许愿池，神秘商店，签到，其他活动。',
  },
  [WORKSHOP_DYE_GREEN_ID]: {
    purpose: '可以制作出薄荷绿色的物品。',
    acquire: '许愿池，神秘商店，签到，其他活动。',
  },
};

export function getWorkshopResourceHelp(materialId: string): WorkshopResourceHelp | undefined {
  return WORKSHOP_RESOURCE_HELP[materialId];
}

export function formatWorkshopResourceHelpText(materialId: string): string {
  const help = WORKSHOP_RESOURCE_HELP[materialId];
  if (!help) return '';
  return `${help.purpose}\n获取途径：${help.acquire}`;
}

/** 工坊面板顶部材料栏（锤子 + 分色染料） */
export const WORKSHOP_RESOURCE_BAR: WorkshopResourceDef[] = [
  { id: WORKSHOP_MATERIAL_ID, icon: WORKSHOP_MATERIAL_ICON },
  { id: WORKSHOP_DYE_PINK_ID, icon: WORKSHOP_DYE_PINK_ICON },
  { id: WORKSHOP_DYE_YELLOW_ID, icon: WORKSHOP_DYE_YELLOW_ICON },
  { id: WORKSHOP_DYE_BLUE_ID, icon: WORKSHOP_DYE_BLUE_ICON },
  { id: WORKSHOP_DYE_GREEN_ID, icon: WORKSHOP_DYE_GREEN_ICON },
];

export const WORKSHOP_RESOURCE_MAP = new Map(WORKSHOP_RESOURCE_BAR.map(r => [r.id, r]));

/** 许愿池可产出的分色染料（不含 deprecated 统一染料） */
export const WORKSHOP_GACHA_DYE_IDS = [
  WORKSHOP_DYE_PINK_ID,
  WORKSHOP_DYE_YELLOW_ID,
  WORKSHOP_DYE_BLUE_ID,
  WORKSHOP_DYE_GREEN_ID,
] as const;

const WORKSHOP_MATERIAL_DISPLAY_NAMES: Record<string, string> = {
  [WORKSHOP_MATERIAL_ID]: '工坊材料',
  [WORKSHOP_DYE_PINK_ID]: '粉色染料',
  [WORKSHOP_DYE_YELLOW_ID]: '黄色染料',
  [WORKSHOP_DYE_BLUE_ID]: '蓝色染料',
  [WORKSHOP_DYE_GREEN_ID]: '绿色染料',
};

export function getWorkshopMaterialDisplayName(materialId: string): string {
  return WORKSHOP_MATERIAL_DISPLAY_NAMES[materialId] ?? '工坊材料';
}

/** 图纸获取途径（钻石购买 / 活动发放 / 成长之路赠送） */
export type WorkshopBlueprintAcquire =
  | { kind: 'diamond'; cost: number }
  | { kind: 'event'; label: string }
  | { kind: 'growth'; label: string };

/**
 * 「新手入门图纸」= 花边流苏地毯（可染色）。
 *
 * 选它的原因：扁平贴地、一眼能认出是毯子；三色（樱粉 / 天蓝 / 蜜黄）
 * 教会染料玩法；比垂幔帘更适合新手「做出第一件就想摆上」。
 *
 * 由成长之路 `g3_level_6`（达成 6 星解锁工坊）免费赠送，并配 8 锤子 + 2 天蓝染料，
 * 保证玩家「领完立刻能做出默认色 + 天蓝色两件」（各 4 锤；染色款另耗 1 染料）。
 * 因此本图纸各色成本远低于其它图纸（其它为 8～20 锤 + 约 0.9 万～3.8 万花愿）。
 *
 * 平衡校验：三色共 15 星、约 4200 花愿 + 12 锤子，不存在刷星套利。
 *
 * 资源 key 仍为 `workshop_petal_oval_rug*`（历史 id，避免已领图纸失效）；美术为扁平花边流苏毯。
 */
export const WORKSHOP_NOVICE_BLUEPRINT_ID = 'blueprint_workshop_petal_oval_rug';
/** 新手图纸单色锤子消耗 */
export const NOVICE_CRAFT_MATERIAL_COST = 4;
/** 新手图纸默认色加工费 */
export const NOVICE_CRAFT_HUAYUAN_COST = 1200;
/** 新手图纸染色款加工费（额外消耗 1 个对应染料） */
export const NOVICE_CRAFT_DYED_HUAYUAN_COST = 1500;

export interface WorkshopMaterialReward {
  materialId: string;
  count: number;
}

/** 同款家具的一种配色；普通家具每色一次，DecoDef.stackable 可重复制作至 maxOwned */
export interface WorkshopColorOption {
  id: string;
  name: string;
  outputDecoId: string;
  /** 工坊材料消耗 */
  materialCost: number;
  /** 非默认色额外染料；0 表示不需要 */
  dyeCost: number;
  /** 消耗的分色染料 id（如 workshop_dye_pink） */
  dyeMaterialId?: string;
  huayuanCost: number;
  unlockRequirement?: UnlockRequirement;
}

export interface WorkshopBlueprintDef {
  id: string;
  name: string;
  /** 默认配色对应的家具（图纸剪影预览用） */
  outputDecoId: string;
  rarity: WorkshopBlueprintRarity;
  sourceText: string;
  icon?: string;
  acquire?: WorkshopBlueprintAcquire[];
  /** 制作页分类；缺省则按 outputDecoId 对应家具的 slot / decorationPanelTab 推断 */
  category?: WorkshopCraftCategory;
  /** 可制作配色列表；首项通常为默认色 */
  colorOptions: WorkshopColorOption[];
}

export const WORKSHOP_BLUEPRINT_DEFS: WorkshopBlueprintDef[] = [
  {
    id: 'blueprint_workshop_plush_green_sofa',
    name: '弧翼大沙发图纸',
    outputDecoId: 'workshop_plush_green_sofa',
    rarity: 'rare',
    sourceText: '80 钻石购买',
    icon: 'workshop_blueprint_generic',
    acquire: [{ kind: 'diamond', cost: 80 }],
    colorOptions: [
      {
        id: 'default',
        name: '默认',
        outputDecoId: 'workshop_plush_green_sofa',
        materialCost: 15,
        dyeCost: 0,
        huayuanCost: 14000,
      },
      {
        id: 'sakura',
        name: '樱粉',
        outputDecoId: 'workshop_plush_sofa_sakura',
        materialCost: 10,
        dyeCost: 5,
        dyeMaterialId: WORKSHOP_DYE_PINK_ID,
        huayuanCost: 10000,
      },
      {
        id: 'blue',
        name: '海蓝',
        outputDecoId: 'workshop_plush_sofa_blue',
        materialCost: 10,
        dyeCost: 5,
        dyeMaterialId: WORKSHOP_DYE_BLUE_ID,
        huayuanCost: 10000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_puffy_petal_sofa',
    name: '泡芙拼块沙发图纸',
    outputDecoId: 'workshop_puffy_petal_sofa',
    rarity: 'rare',
    sourceText: '100 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'furniture',
    acquire: [{ kind: 'diamond', cost: 100 }],
    colorOptions: [
      {
        id: 'default',
        name: '默认',
        outputDecoId: 'workshop_puffy_petal_sofa',
        materialCost: 20,
        dyeCost: 0,
        huayuanCost: 22000,
      },
    ],
  },
  {
    id: WORKSHOP_NOVICE_BLUEPRINT_ID,
    name: '花边流苏地毯图纸',
    outputDecoId: 'workshop_petal_oval_rug',
    rarity: 'rare',
    sourceText: '成长之路赠送 / 66 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'furniture',
    acquire: [{ kind: 'growth', label: '成长之路赠送' }, { kind: 'diamond', cost: 66 }],
    colorOptions: [
      {
        id: 'default',
        name: '樱粉',
        outputDecoId: 'workshop_petal_oval_rug',
        materialCost: NOVICE_CRAFT_MATERIAL_COST,
        dyeCost: 0,
        huayuanCost: NOVICE_CRAFT_HUAYUAN_COST,
      },
      {
        id: 'moon',
        name: '天蓝',
        outputDecoId: 'workshop_petal_oval_rug_moon',
        materialCost: NOVICE_CRAFT_MATERIAL_COST,
        dyeCost: 1,
        dyeMaterialId: WORKSHOP_DYE_BLUE_ID,
        huayuanCost: NOVICE_CRAFT_DYED_HUAYUAN_COST,
      },
      {
        id: 'honey',
        name: '蜜黄',
        outputDecoId: 'workshop_petal_oval_rug_honey',
        materialCost: NOVICE_CRAFT_MATERIAL_COST,
        dyeCost: 1,
        dyeMaterialId: WORKSHOP_DYE_YELLOW_ID,
        huayuanCost: NOVICE_CRAFT_DYED_HUAYUAN_COST,
      },
    ],
  },
  {
    id: 'blueprint_workshop_rose_cascade_drape',
    name: '玫瑰垂幔帘图纸',
    outputDecoId: 'workshop_rose_cascade_drape',
    rarity: 'rare',
    sourceText: '66 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'wallart',
    acquire: [{ kind: 'diamond', cost: 66 }],
    colorOptions: [
      {
        id: 'default',
        name: '默认',
        outputDecoId: 'workshop_rose_cascade_drape',
        materialCost: 11,
        dyeCost: 0,
        huayuanCost: 16000,
      },
      {
        id: 'moon',
        name: '天蓝',
        outputDecoId: 'workshop_rose_cascade_drape_moon',
        materialCost: 10,
        dyeCost: 1,
        dyeMaterialId: WORKSHOP_DYE_BLUE_ID,
        huayuanCost: 12000,
      },
      {
        id: 'honey',
        name: '蜜黄',
        outputDecoId: 'workshop_rose_cascade_drape_honey',
        materialCost: 10,
        dyeCost: 1,
        dyeMaterialId: WORKSHOP_DYE_YELLOW_ID,
        huayuanCost: 12000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_lace_ribbon_bed',
    name: '蕾丝铁艺床图纸',
    outputDecoId: 'workshop_lace_ribbon_bed',
    rarity: 'epic',
    sourceText: '40 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'furniture',
    acquire: [{ kind: 'diamond', cost: 40 }],
    colorOptions: [
      {
        id: 'default',
        name: '樱粉',
        outputDecoId: 'workshop_lace_ribbon_bed',
        materialCost: 5,
        dyeCost: 0,
        huayuanCost: 9000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_giant_rose_bouquet',
    name: '大捧玫瑰图纸',
    outputDecoId: 'workshop_giant_rose_bouquet',
    rarity: 'rare',
    sourceText: '99 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'ornament',
    acquire: [{ kind: 'diamond', cost: 99 }],
    colorOptions: [
      {
        id: 'default',
        name: '默认',
        outputDecoId: 'workshop_giant_rose_bouquet',
        materialCost: 12,
        dyeCost: 0,
        huayuanCost: 35000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_bougainvillea_bonsai',
    name: '三角梅古桩图纸',
    outputDecoId: 'workshop_bougainvillea_bonsai',
    rarity: 'rare',
    sourceText: '99 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'ornament',
    acquire: [{ kind: 'diamond', cost: 99 }],
    colorOptions: [
      {
        id: 'default',
        name: '默认',
        outputDecoId: 'workshop_bougainvillea_bonsai',
        materialCost: 14,
        dyeCost: 0,
        huayuanCost: 38000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_pastel_tv_cabinet',
    name: '黑色超薄电视柜图纸',
    outputDecoId: 'workshop_pastel_tv_cabinet',
    rarity: 'rare',
    sourceText: '70 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'appliance',
    acquire: [{ kind: 'diamond', cost: 70 }],
    colorOptions: [
      {
        id: 'default',
        name: '默认',
        outputDecoId: 'workshop_pastel_tv_cabinet',
        materialCost: 15,
        dyeCost: 0,
        huayuanCost: 24000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_summer_lotus_arch_window',
    name: '夏日荷塘拱窗图纸',
    outputDecoId: 'workshop_summer_lotus_arch_window',
    rarity: 'rare',
    sourceText: '活动获得',
    icon: 'workshop_blueprint_generic',
    category: 'wallart',
    acquire: [{ kind: 'event', label: '清凉一夏' }],
    colorOptions: [
      {
        id: 'default',
        name: '默认',
        outputDecoId: 'workshop_summer_lotus_arch_window',
        materialCost: 12,
        dyeCost: 0,
        huayuanCost: 25000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_mint_bougainvillea_bay_window',
    name: '暖阳飘窗图纸',
    outputDecoId: 'workshop_willow_wood_bay_window',
    rarity: 'rare',
    sourceText: '活动获得',
    icon: 'workshop_blueprint_generic',
    category: 'wallart',
    acquire: [{ kind: 'event', label: '清凉一夏' }],
    colorOptions: [
      {
        id: 'default',
        name: '默认',
        outputDecoId: 'workshop_willow_wood_bay_window',
        materialCost: 14,
        dyeCost: 0,
        huayuanCost: 29000,
      },
      {
        id: 'mint',
        name: '薄荷',
        outputDecoId: 'workshop_mint_bougainvillea_bay_window',
        materialCost: 12,
        dyeCost: 1,
        dyeMaterialId: WORKSHOP_DYE_GREEN_ID,
        huayuanCost: 30000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_summer_dining_chair',
    name: '夏日餐椅图纸',
    outputDecoId: 'workshop_summer_dining_chair',
    rarity: 'rare',
    sourceText: '活动获得',
    icon: 'workshop_blueprint_generic',
    category: 'furniture',
    acquire: [{ kind: 'event', label: '清凉一夏' }],
    colorOptions: [
      {
        id: 'default',
        name: '默认',
        outputDecoId: 'workshop_summer_dining_chair',
        materialCost: 8,
        dyeCost: 0,
        huayuanCost: 14000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_cottage_wing_chair',
    name: '奶油木框沙发椅图纸',
    outputDecoId: 'workshop_cottage_wing_chair',
    rarity: 'rare',
    sourceText: '108 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'furniture',
    acquire: [{ kind: 'diamond', cost: 108 }],
    colorOptions: [
      {
        id: 'default',
        name: '默认',
        outputDecoId: 'workshop_cottage_wing_chair',
        materialCost: 12,
        dyeCost: 0,
        huayuanCost: 24000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_round_nest_bed',
    name: '圆窝软床图纸',
    outputDecoId: 'workshop_round_nest_bed',
    rarity: 'rare',
    sourceText: '120 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'furniture',
    acquire: [{ kind: 'diamond', cost: 120 }],
    colorOptions: [
      {
        id: 'default',
        name: '白红',
        outputDecoId: 'workshop_round_nest_bed',
        materialCost: 18,
        dyeCost: 0,
        huayuanCost: 25000,
      },
      {
        id: 'honey',
        name: '蜜黄',
        outputDecoId: 'workshop_round_nest_bed_honey',
        materialCost: 12,
        dyeCost: 4,
        dyeMaterialId: WORKSHOP_DYE_YELLOW_ID,
        huayuanCost: 19000,
      },
      {
        id: 'sakura',
        name: '樱粉',
        outputDecoId: 'workshop_round_nest_bed_sakura',
        materialCost: 12,
        dyeCost: 4,
        dyeMaterialId: WORKSHOP_DYE_PINK_ID,
        huayuanCost: 19000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_arc_floor_lamp',
    name: '弧光落地灯图纸',
    outputDecoId: 'workshop_arc_floor_lamp',
    rarity: 'rare',
    sourceText: '66 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'appliance',
    acquire: [{ kind: 'diamond', cost: 66 }],
    colorOptions: [
      {
        id: 'default',
        name: '红黑',
        outputDecoId: 'workshop_arc_floor_lamp',
        materialCost: 10,
        dyeCost: 0,
        huayuanCost: 13000,
      },
      {
        id: 'mint',
        name: '薄荷绿',
        outputDecoId: 'workshop_arc_floor_lamp_mint',
        materialCost: 8,
        dyeCost: 2,
        dyeMaterialId: WORKSHOP_DYE_GREEN_ID,
        huayuanCost: 10000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_blossom_tub',
    name: '花漾圆浴盆图纸',
    outputDecoId: 'workshop_blossom_tub',
    rarity: 'rare',
    sourceText: '96 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'furniture',
    acquire: [{ kind: 'diamond', cost: 96 }],
    colorOptions: [
      {
        id: 'default',
        name: '默认',
        outputDecoId: 'workshop_blossom_tub',
        materialCost: 14,
        dyeCost: 0,
        huayuanCost: 28000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_buttercup_daybed',
    name: '蜜语软床图纸',
    outputDecoId: 'workshop_buttercup_daybed',
    rarity: 'rare',
    sourceText: '118 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'furniture',
    acquire: [{ kind: 'diamond', cost: 118 }],
    colorOptions: [
      {
        id: 'default',
        name: '蜜黄',
        outputDecoId: 'workshop_buttercup_daybed',
        materialCost: 16,
        dyeCost: 0,
        huayuanCost: 18000,
      },
      {
        id: 'sky',
        name: '天蓝',
        outputDecoId: 'workshop_buttercup_daybed_sky',
        materialCost: 12,
        dyeCost: 3,
        dyeMaterialId: WORKSHOP_DYE_BLUE_ID,
        huayuanCost: 14000,
      },
    ],
  },
  {
    id: 'blueprint_workshop_parfait_lounge',
    name: '霜糖软座图纸',
    outputDecoId: 'workshop_parfait_lounge',
    rarity: 'rare',
    sourceText: '108 钻石购买',
    icon: 'workshop_blueprint_generic',
    category: 'furniture',
    acquire: [{ kind: 'diamond', cost: 108 }],
    colorOptions: [
      {
        id: 'default',
        name: '默认',
        outputDecoId: 'workshop_parfait_lounge',
        materialCost: 15,
        dyeCost: 0,
        huayuanCost: 24000,
      },
    ],
  },
];

export const WORKSHOP_BLUEPRINT_MAP = new Map(WORKSHOP_BLUEPRINT_DEFS.map(b => [b.id, b]));

export function getBlueprintColorOption(blueprintId: string, colorId: string): WorkshopColorOption | undefined {
  return WORKSHOP_BLUEPRINT_MAP.get(blueprintId)?.colorOptions.find(c => c.id === colorId);
}

/** 工坊 UI 展示名：与图纸一致，去掉「图纸」后缀，不含配色前缀 */
export function getBlueprintDisplayName(blueprint: WorkshopBlueprintDef): string {
  return blueprint.name.replace(/图纸$/, '');
}

/** 默认配色（首版 / id=default / 无需染料的首项） */
export function isDefaultWorkshopColorOption(
  blueprint: WorkshopBlueprintDef,
  option: WorkshopColorOption,
): boolean {
  if (option.id === 'default') return true;
  const first = blueprint.colorOptions[0];
  return first?.id === option.id && (option.dyeCost ?? 0) <= 0;
}

export function getDefaultWorkshopColorOption(blueprint: WorkshopBlueprintDef): WorkshopColorOption | undefined {
  return blueprint.colorOptions.find(c => c.id === 'default') ?? blueprint.colorOptions[0];
}

const WORKSHOP_DYE_CHIP_LABELS: Record<string, string> = {
  [WORKSHOP_DYE_PINK_ID]: '粉色',
  [WORKSHOP_DYE_YELLOW_ID]: '黄色',
  [WORKSHOP_DYE_BLUE_ID]: '蓝色',
  [WORKSHOP_DYE_GREEN_ID]: '绿色',
};

/** 配色圆点色：优先按染料，其次按 colorOption.id（含 sky/moon 等别名） */
const WORKSHOP_DYE_CHIP_COLORS: Record<string, number> = {
  [WORKSHOP_DYE_PINK_ID]: 0xf5b4d4,
  [WORKSHOP_DYE_YELLOW_ID]: 0xf5d76e,
  [WORKSHOP_DYE_BLUE_ID]: 0x64b5f6,
  [WORKSHOP_DYE_GREEN_ID]: 0x8fd86b,
};

const WORKSHOP_COLOR_ID_SWATCH: Record<string, number> = {
  sakura: 0xf5b4d4,
  blue: 0x64b5f6,
  moon: 0x64b5f6,
  sky: 0x64b5f6,
  honey: 0xf5d76e,
  mint: 0x8fd86b,
};

export function getWorkshopColorChipLabel(
  blueprint: WorkshopBlueprintDef,
  option: WorkshopColorOption,
): string {
  if (isDefaultWorkshopColorOption(blueprint, option)) return '默认';
  if (option.dyeMaterialId) {
    return WORKSHOP_DYE_CHIP_LABELS[option.dyeMaterialId]
      ?? getWorkshopMaterialDisplayName(option.dyeMaterialId).replace(/染料$/, '');
  }
  return option.name;
}

/** 制作/预览弹窗配色圆点填充色 */
export function getWorkshopColorChipSwatch(option: WorkshopColorOption): number {
  if (option.dyeMaterialId && WORKSHOP_DYE_CHIP_COLORS[option.dyeMaterialId] != null) {
    return WORKSHOP_DYE_CHIP_COLORS[option.dyeMaterialId];
  }
  return WORKSHOP_COLOR_ID_SWATCH[option.id] ?? 0xb0bec5;
}

const WORKSHOP_DECO_BLUEPRINT_LOOKUP = new Map<
  string,
  { blueprint: WorkshopBlueprintDef; option: WorkshopColorOption }
>();
for (const blueprint of WORKSHOP_BLUEPRINT_DEFS) {
  for (const option of blueprint.colorOptions) {
    WORKSHOP_DECO_BLUEPRINT_LOOKUP.set(option.outputDecoId, { blueprint, option });
  }
}

/**
 * 全游戏展示名：工坊默认形态不带颜色前缀（与图纸名一致），分色形态带 option.name 前缀。
 * 非工坊家具仍用 DecorationConfig.name。
 */
export function getDecoDisplayName(decoId: string): string {
  const hit = WORKSHOP_DECO_BLUEPRINT_LOOKUP.get(decoId);
  if (hit) {
    if (isDefaultWorkshopColorOption(hit.blueprint, hit.option)) {
      return getBlueprintDisplayName(hit.blueprint);
    }
    return `${hit.option.name}${getBlueprintDisplayName(hit.blueprint)}`;
  }
  return DECO_MAP.get(decoId)?.name ?? decoId;
}

/** 制作弹窗名称（与 getDecoDisplayName 一致） */
export function getWorkshopCraftDisplayName(
  _blueprint: WorkshopBlueprintDef,
  option: WorkshopColorOption,
): string {
  return getDecoDisplayName(option.outputDecoId);
}

export function getBlueprintDiamondCost(blueprintId: string): number | undefined {
  const def = WORKSHOP_BLUEPRINT_MAP.get(blueprintId);
  const diamond = def?.acquire?.find(a => a.kind === 'diamond');
  return diamond?.kind === 'diamond' ? diamond.cost : undefined;
}

export function isBlueprintDiamondPurchasable(blueprintId: string): boolean {
  const cost = getBlueprintDiamondCost(blueprintId);
  return typeof cost === 'number' && cost > 0;
}

/** 活动发放图纸（图纸商店展示「活动获得」，不可钻石购买） */
export function isBlueprintEventAcquire(blueprintId: string): boolean {
  const def = WORKSHOP_BLUEPRINT_MAP.get(blueprintId);
  return !!def?.acquire?.some(a => a.kind === 'event');
}

/** 图纸商店列表：钻石可购 / 活动展示 / 已拥有 */
export function isBlueprintListedInShop(blueprintId: string): boolean {
  return isBlueprintDiamondPurchasable(blueprintId) || isBlueprintEventAcquire(blueprintId);
}

/** 图纸商店当前「钻石在售」图纸 id（用于上新提醒） */
export function listDiamondShopBlueprintIds(): string[] {
  return WORKSHOP_BLUEPRINT_DEFS
    .filter(b => isBlueprintDiamondPurchasable(b.id))
    .map(b => b.id);
}

/**
 * 商店「上新」冻结基线：功能上线前已在钻石货架的图纸。
 * 首次灌基线只把这些记为已看，避免老玩家整店飘「上新」；
 * **此后新增的钻石图纸不要写入此列表**，才会触发商店入口「上新」。
 */
export const WORKSHOP_SHOP_CATALOG_SEEN_BASELINE_IDS: readonly string[] = [
  'blueprint_workshop_plush_green_sofa',
  'blueprint_workshop_puffy_petal_sofa',
  WORKSHOP_NOVICE_BLUEPRINT_ID,
  'blueprint_workshop_rose_cascade_drape',
  'blueprint_workshop_lace_ribbon_bed',
  'blueprint_workshop_giant_rose_bouquet',
  'blueprint_workshop_bougainvillea_bonsai',
  'blueprint_workshop_pastel_tv_cabinet',
  'blueprint_workshop_cottage_wing_chair',
  'blueprint_workshop_round_nest_bed',
  'blueprint_workshop_arc_floor_lamp',
];

/** 商店目录基线迁移版本：存档低于此值时，会把「基线外」图纸从已看里清掉以补发上新 */
export const WORKSHOP_SHOP_CATALOG_SEEN_MIGRATION = 1;

/** 工坊制作页 Tab 分类：优先 blueprint.category，否则按家具 slot / 装修 Tab 推断 */
export function getBlueprintCraftCategory(blueprint: WorkshopBlueprintDef): WorkshopCraftCategory {
  if (blueprint.category) return blueprint.category;
  const deco = DECO_MAP.get(blueprint.outputDecoId);
  if (!deco) return 'ornament';
  if (deco.decorationPanelTab === 'furniture') return 'furniture';
  switch (deco.slot) {
    case DecoSlot.SHELF:
    case DecoSlot.TABLE:
      return 'furniture';
    case DecoSlot.LIGHT:
      return 'appliance';
    case DecoSlot.WALLART:
      return 'wallart';
    default:
      return 'ornament';
  }
}

export function makeWorkshopVariantKey(blueprintId: string, colorId: string): string {
  return `${blueprintId}:${colorId}`;
}

export function parseWorkshopVariantKey(key: string): { blueprintId: string; colorId: string } | null {
  const i = key.indexOf(':');
  if (i <= 0) return null;
  return { blueprintId: key.slice(0, i), colorId: key.slice(i + 1) };
}

export function resolveWorkshopMaterialIconKey(materialId?: string): string {
  if (materialId && WORKSHOP_RESOURCE_MAP.get(materialId)?.icon) {
    return WORKSHOP_RESOURCE_MAP.get(materialId)!.icon;
  }
  return WORKSHOP_MATERIAL_ICON;
}

export function getWorkshopResourceDef(materialId: string): WorkshopResourceDef | undefined {
  return WORKSHOP_RESOURCE_MAP.get(materialId);
}

function collectBlueprintOutputDecoIds(blueprint: WorkshopBlueprintDef): string[] {
  const ids = new Set<string>();
  if (blueprint.outputDecoId) ids.add(blueprint.outputDecoId);
  for (const opt of blueprint.colorOptions) ids.add(opt.outputDecoId);
  return [...ids];
}

/** 是否存在需染料的非默认配色 */
export function isWorkshopBlueprintDyeable(blueprint: WorkshopBlueprintDef): boolean {
  return blueprint.colorOptions.some(
    opt => !isDefaultWorkshopColorOption(blueprint, opt)
      && ((opt.dyeCost ?? 0) > 0 || !!opt.dyeMaterialId),
  );
}

/** 任一配色支持四角度朝向（FurnitureRenderConfig.renderMode=fourFacing） */
export function isWorkshopBlueprintFourFacing(blueprint: WorkshopBlueprintDef): boolean {
  return collectBlueprintOutputDecoIds(blueprint).some(
    decoId => FURNITURE_RENDER_MAP.get(decoId)?.renderMode === 'fourFacing',
  );
}

/** 任一配色支持点击切换交互态 */
export function isWorkshopBlueprintInteractive(blueprint: WorkshopBlueprintDef): boolean {
  return collectBlueprintOutputDecoIds(blueprint).some(
    decoId => !!FURNITURE_RENDER_MAP.get(decoId)?.interaction,
  );
}

/** 工坊图纸能力标签（仅在有对应能力时返回文案） */
export function getWorkshopBlueprintFeatureLabels(blueprint: WorkshopBlueprintDef): string[] {
  const labels: string[] = [];
  if (isWorkshopBlueprintDyeable(blueprint)) labels.push('可染色');
  if (isWorkshopBlueprintFourFacing(blueprint)) labels.push('四面旋转');
  const stackableMax = Math.max(
    0,
    ...collectBlueprintOutputDecoIds(blueprint).map(id => {
      const deco = DECO_MAP.get(id);
      return deco?.stackable ? Math.max(1, deco.maxOwned ?? 1) : 0;
    }),
  );
  if (stackableMax > 1) labels.push(`可制作${stackableMax}件`);
  if (isWorkshopBlueprintInteractive(blueprint)) labels.push('可交互');
  return labels;
}

/** 图纸预览弹窗：可交互家具的玩法说明 */
export function getWorkshopBlueprintInteractionHint(blueprint: WorkshopBlueprintDef): string | null {
  for (const decoId of collectBlueprintOutputDecoIds(blueprint)) {
    const interaction = FURNITURE_RENDER_MAP.get(decoId)?.interaction;
    if (!interaction) continue;
    if (interaction.hint) return interaction.hint;
    const stateCount = Object.keys(interaction.states).length;
    if (interaction.type === 'toggle' && stateCount === 2) {
      return '放入房间后单击切换两种形态';
    }
    if (interaction.type === 'cycle' && stateCount > 1) {
      return `放入房间后单击循环切换 ${stateCount} 种形态`;
    }
    return '放入房间后单击可交互';
  }
  return null;
}

/** 图纸预览：是否展示配色行（含默认 + 分色） */
export function shouldShowWorkshopBlueprintColorPreview(blueprint: WorkshopBlueprintDef): boolean {
  return isWorkshopBlueprintDyeable(blueprint) && blueprint.colorOptions.length > 1;
}

/** @deprecated 兼容旧引用 */
export const WORKSHOP_MATERIAL_DEFS = [
  { id: WORKSHOP_MATERIAL_ID, name: '工坊材料', icon: WORKSHOP_MATERIAL_ICON, category: 'base' as const, rarity: 'common' as const, desc: '制作工坊家具的专用材料。' },
];
export const WORKSHOP_MATERIAL_MAP = new Map(WORKSHOP_MATERIAL_DEFS.map(m => [m.id, m]));
/** @deprecated 旧配方表已并入 blueprint.colorOptions */
export const WORKSHOP_RECIPES: never[] = [];
export const WORKSHOP_RECIPE_MAP = new Map<string, never>();
