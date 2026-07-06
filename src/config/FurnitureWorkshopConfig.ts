import type { UnlockRequirement } from '@/utils/UnlockChecker';
import { DECO_MAP, DecoSlot } from '@/config/DecorationConfig';
import { FURNITURE_RENDER_MAP } from '@/config/FurnitureRenderConfig';
import { WORKSHOP_ORDER_MIN_PLAYER_LEVEL } from '@/config/OrderSpawnConfig';

/** 家具工坊入口开放等级（与家具工匠订单一致，10 级） */
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
  [WORKSHOP_DYE_PINK_ID]: '樱粉染料',
  [WORKSHOP_DYE_YELLOW_ID]: '蜜黄染料',
  [WORKSHOP_DYE_BLUE_ID]: '天蓝染料',
  [WORKSHOP_DYE_GREEN_ID]: '薄荷绿染料',
};

export function getWorkshopMaterialDisplayName(materialId: string): string {
  return WORKSHOP_MATERIAL_DISPLAY_NAMES[materialId] ?? '工坊材料';
}

/** 图纸获取途径（当前仅钻石购买；`event` 预留活动发放） */
export type WorkshopBlueprintAcquire =
  | { kind: 'diamond'; cost: number }
  | { kind: 'event'; label: string };

export interface WorkshopMaterialReward {
  materialId: string;
  count: number;
}

/** 同款家具的一种配色（每色仅可制作一次） */
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
        huayuanCost: 18000,
      },
      {
        id: 'sakura',
        name: '樱粉',
        outputDecoId: 'workshop_plush_sofa_sakura',
        materialCost: 10,
        dyeCost: 5,
        dyeMaterialId: WORKSHOP_DYE_PINK_ID,
        huayuanCost: 13000,
      },
      {
        id: 'blue',
        name: '海蓝',
        outputDecoId: 'workshop_plush_sofa_blue',
        materialCost: 10,
        dyeCost: 5,
        dyeMaterialId: WORKSHOP_DYE_BLUE_ID,
        huayuanCost: 13000,
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
        huayuanCost: 28000,
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
        huayuanCost: 30000,
      },
      {
        id: 'moon',
        name: '天蓝',
        outputDecoId: 'workshop_rose_cascade_drape_moon',
        materialCost: 10,
        dyeCost: 1,
        dyeMaterialId: WORKSHOP_DYE_BLUE_ID,
        huayuanCost: 35000,
      },
      {
        id: 'honey',
        name: '蜜黄',
        outputDecoId: 'workshop_rose_cascade_drape_honey',
        materialCost: 10,
        dyeCost: 1,
        dyeMaterialId: WORKSHOP_DYE_YELLOW_ID,
        huayuanCost: 30000,
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
        huayuanCost: 11000,
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
        huayuanCost: 52000,
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
        huayuanCost: 30000,
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

export function getWorkshopColorChipLabel(
  blueprint: WorkshopBlueprintDef,
  option: WorkshopColorOption,
): string {
  return isDefaultWorkshopColorOption(blueprint, option) ? '默认' : option.name;
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
