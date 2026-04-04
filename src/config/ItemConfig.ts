/**
 * 物品配置
 *
 * 产品线：花系（鲜花/绿植各13级、花束10级 + 包装中间品4级）+ 饮品 3线x8级
 * 工具线：园艺6级、包装5级、茶饮/冷饮/烘焙各5级；工具1–2级仅合成，其后可产出
 * 宝箱：5级；红包：4级（散落花愿利是，双击入账花愿）；钻石袋 / 体力箱工具：各 3 级（散落货币块）
 */

import {
  computeSellHuayuan,
  drinkDeliverHuayuanForLevel,
  flowerDeliverHuayuanForLevel,
} from './OrderHuayuanConfig';

export enum Category {
  FLOWER = 'flower',
  DRINK = 'drink',
  BUILDING = 'building',
  CHEST = 'chest',
  CURRENCY = 'currency',
}

/** 物品的交互机制——决定点击行为、是否走 CD / 宝箱散落等 */
export enum InteractType {
  /** 普通可合成物品，不可点击产出 */
  NONE = 'none',
  /** 工具类：点击消耗体力产出物品，可能有 CD / exhaustAfterProduces */
  TOOL = 'tool',
  /** 宝箱类：点击一次性掷出多件物品并批量散落到棋盘 */
  CHEST = 'chest',
}

export enum FlowerLine {
  FRESH = 'fresh',       // 鲜花线
  BOUQUET = 'bouquet',   // 花束线
  GREEN = 'green',       // 绿植线
  /** 包装中间品（不进订单）：丝带→花束包装纸 */
  WRAP = 'wrap',
}

export enum DrinkLine {
  TEA = 'tea',         // 茶饮线
  COLD = 'cold',       // 冷饮线
  DESSERT = 'dessert', // 甜品线
}

export enum CurrencyLine {
  STAMINA = 'stamina',
  /** 棋盘花愿利是（红包等产出；双击入账花愿） */
  HUAYUAN_PICKUP = 'huayuan_pickup',
  DIAMOND = 'diamond',
}

export enum ToolLine {
  /** 园艺种植工具 → 同等级随机产出 鲜花线 或 绿植线 */
  PLANT = 'plant',
  ARRANGE = 'arrange',   // 包装线工具 → 包装中间品
  TEA_SET = 'tea_set',   // 茶具     → 茶饮线
  MIXER = 'mixer',       // 饮品器具 → 冷饮线
  BAKE = 'bake',         // 烘焙工具 → 甜品线
}

/** 工具线 → 对应产品线的映射 */
export const TOOL_TO_PRODUCT_LINE: Record<ToolLine, { category: Category; line: string }> = {
  /** 展示用主标签；实际产出见 BuildingConfig produceLinesRandom */
  [ToolLine.PLANT]:   { category: Category.FLOWER, line: FlowerLine.FRESH },
  /** 包装线工具产出包装中间品；花束由「花束包装纸」产出 */
  [ToolLine.ARRANGE]: { category: Category.FLOWER, line: FlowerLine.WRAP },
  [ToolLine.TEA_SET]: { category: Category.DRINK,  line: DrinkLine.TEA },
  [ToolLine.MIXER]:   { category: Category.DRINK,  line: DrinkLine.COLD },
  [ToolLine.BAKE]:    { category: Category.DRINK,  line: DrinkLine.DESSERT },
};

export interface ItemDef {
  id: string;
  name: string;
  category: Category;
  line: string;      // FlowerLine | DrinkLine | ToolLine
  level: number;
  maxLevel: number;
  icon: string;
  /** 交互机制：NONE / TOOL / CHEST */
  interactType: InteractType;
  /** 是否可卖出 */
  sellable: boolean;
  /** 是否可存入仓库 */
  storable: boolean;
  /** 货币物品双击使用时获得的奖励 */
  currencyReward?: { type: 'stamina' | 'huayuan' | 'diamond'; amount: number };
  /** 订单需求交付时该物品贡献的花愿（固定单价；多槽订单另有加成） */
  orderHuayuan?: number;
  /** 棋盘出售花愿（固定，远低于 orderHuayuan）；无则出售仅腾格 */
  sellHuayuan?: number;
}

// ═══════════════ 产品数据 ═══════════════

const FLOWER_DATA: [FlowerLine, string[]][] = [
  [FlowerLine.FRESH, [
    '花种子', '花苞', '小雏菊', '向日葵', '康乃馨',
    '玫瑰', '百合', '郁金香', '绣球花', '蝴蝶兰',
    '荷花', '芍药', '金色牡丹',
  ]],
  [FlowerLine.BOUQUET, [
    '一小捧散花', '迷你花束', '郁金香花束', '玫瑰满天星', '田园混搭花束',
    '精美花盒', '红玫瑰大束', '花艺礼篮', '鎏金花束', '传说花束',
  ]],
  [FlowerLine.GREEN, [
    '小芽苗', '铜钱草', '多肉盆栽', '绿萝', '波士顿蕨',
    '虎皮兰', '龟背竹', '琴叶榕', '仙人掌', '发财树',
    '红掌', '三角梅', '松树盆景',
  ]],
  [FlowerLine.WRAP, [
    '丝带卷', '丝带条', '包装纸', '花艺材料篮',
  ]],
];

const DRINK_DATA: [DrinkLine, string[]][] = [
  [DrinkLine.TEA, [
    '热水', '茉莉花茶', '玫瑰红茶', '调味花茶',
    '手冲花茶', '四季花茶壶', '大师手作茶', '御品花茶典藏',
  ]],
  [DrinkLine.COLD, [
    '柠檬花水', '花果冰饮', '花漾气泡水', '玫瑰冰沙',
    '花园特调', '花漾奶昔', '星空花饮', '极光花漾特饮',
  ]],
  [DrinkLine.DESSERT, [
    '花瓣饼干', '花形马卡龙', '花朵杯子蛋糕', '花茶慕斯',
    '花瓣蛋糕块', '花饰蛋糕拼盘', '鲜花圆蛋糕', '双层花艺蛋糕',
  ]],
];

// ═══════════════ 工具数据 ═══════════════

const TOOL_DATA: [ToolLine, string[]][] = [
  [ToolLine.PLANT, [
    '铲子', '水壶', '育苗盘', '育苗仓', '简易温室', '温室', '高级温室',
  ]],
  [ToolLine.ARRANGE, [
    '铁丝', '铁丝剪刀', '简易包装台', '包装台', '高级包装台',
  ]],
  [ToolLine.TEA_SET, [
    '茶包', '茶叶罐', '茶壶', '茶台', '高级茶台',
  ]],
  [ToolLine.MIXER, [
    '量杯', '雪克杯', '制冰机', '冰箱', '冰柜',
  ]],
  [ToolLine.BAKE, [
    '擀面杖', '打蛋器', '烤箱', '装裱台', '高级装裱台',
  ]],
];

/** 棋盘幸运金币 itemId（单级，不可两枚合成） */
export const LUCKY_COIN_ITEM_ID = 'lucky_coin_1';
/** 棋盘水晶球：确认后目标升一级（同线） */
export const CRYSTAL_BALL_ITEM_ID = 'crystal_ball_1';
/** 棋盘金剪刀：确认后目标变为同线「低一级」×2（目标格一件 + 另一空位一件） */
export const GOLDEN_SCISSORS_ITEM_ID = 'golden_scissors_1';

// ═══════════════ 生成物品定义 ═══════════════

function buildItemDefs(): Map<string, ItemDef> {
  const map = new Map<string, ItemDef>();

  // 花系
  for (const [line, names] of FLOWER_DATA) {
    const maxLv = names.length;
    for (let i = 0; i < names.length; i++) {
      const id = `flower_${line}_${i + 1}`;
      const lv = i + 1;
      const orderHy = line !== FlowerLine.WRAP ? flowerDeliverHuayuanForLevel(lv) : 0;
      map.set(id, {
        id,
        name: names[i],
        category: Category.FLOWER,
        line,
        level: lv,
        maxLevel: maxLv,
        icon: `flower_${line}_${i + 1}`,
        interactType: InteractType.NONE,
        sellable: true,
        storable: true,
        ...(line !== FlowerLine.WRAP
          ? { orderHuayuan: orderHy, sellHuayuan: computeSellHuayuan(orderHy) }
          : {}),
      });
    }
  }

  // 饮品
  for (const [line, names] of DRINK_DATA) {
    for (let i = 0; i < names.length; i++) {
      const id = `drink_${line}_${i + 1}`;
      const lv = i + 1;
      const orderHy = drinkDeliverHuayuanForLevel(lv);
      map.set(id, {
        id,
        name: names[i],
        category: Category.DRINK,
        line,
        level: lv,
        maxLevel: 8,
        icon: `drink_${line}_${i + 1}`,
        interactType: InteractType.NONE,
        sellable: true,
        storable: true,
        orderHuayuan: orderHy,
        sellHuayuan: computeSellHuayuan(orderHy),
      });
    }
  }

  // 工具（BUILDING 品类，可合成升级）
  for (const [line, names] of TOOL_DATA) {
    const maxLv = names.length;
    for (let i = 0; i < names.length; i++) {
      const id = `tool_${line}_${i + 1}`;
      map.set(id, {
        id,
        name: names[i],
        category: Category.BUILDING,
        line,
        level: i + 1,
        maxLevel: maxLv,
        icon: `tool_${line}_${i + 1}`,
        interactType: InteractType.TOOL,
        sellable: true,
        storable: true,
      });
    }
  }

  // 花艺材料篮：虽然品类是 FLOWER，但行为是工具（点击产出花束，用完消失）
  const wrapTool = map.get('flower_wrap_4');
  if (wrapTool) {
    wrapTool.interactType = InteractType.TOOL;
    wrapTool.storable = true;
  }

  // 货币物品：体力 / 钻石 各 4 级；花愿利是为独立块（见下）
  // 棋盘货币双击入账：无单独「合成奖励」，故每级 amount 须严格 > 2×上一级，合成到顶才不亏于全点低级（体力曾违反此条已修正）
  const CURRENCY_DATA: [CurrencyLine, string[], 'stamina' | 'huayuan' | 'diamond', string, number[]][] = [
    [CurrencyLine.STAMINA, ['体力瓶', '体力罐', '体力桶', '精粹体力壶'], 'stamina', 'icon_energy', [8, 18, 38, 80]],
    [CurrencyLine.DIAMOND, ['碎钻', '钻石', '大钻石', '璨钻'], 'diamond', 'icon_gem', [1, 3, 8, 18]],
  ];
  for (const [line, names, rewardType, icon, amounts] of CURRENCY_DATA) {
    for (let i = 0; i < names.length; i++) {
      const id = `currency_${line}_${i + 1}`;
      map.set(id, {
        id,
        name: names[i],
        category: Category.CURRENCY,
        line,
        level: i + 1,
        maxLevel: names.length,
        icon,
        interactType: InteractType.NONE,
        sellable: false,
        storable: true,
        currencyReward: { type: rewardType, amount: amounts[i] },
      });
    }
  }

  // 花愿利是（4级，仅红包线等产出；入账花愿）
  const huayuanPickupNames = ['碎愿利是', '花愿小利是', '花愿大利是', '花愿豪利是'];
  const huayuanPickupAmounts = [6, 16, 42, 110];
  for (let i = 0; i < huayuanPickupNames.length; i++) {
    const line = CurrencyLine.HUAYUAN_PICKUP;
    const id = `currency_${line}_${i + 1}`;
    map.set(id, {
      id,
      name: huayuanPickupNames[i],
      category: Category.CURRENCY,
      line,
      level: i + 1,
      maxLevel: huayuanPickupNames.length,
      icon: 'icon_huayuan',
      interactType: InteractType.NONE,
      sellable: false,
      storable: true,
      currencyReward: { type: 'huayuan', amount: huayuanPickupAmounts[i] },
    });
  }

  // 宝箱（5级）
  const chestNames = ['铜宝箱', '银宝箱', '金宝箱', '钻石宝箱', '传说宝箱'];
  for (let i = 0; i < chestNames.length; i++) {
    const id = `chest_${i + 1}`;
    map.set(id, {
      id,
      name: chestNames[i],
      category: Category.CHEST,
      line: 'chest',
      level: i + 1,
      maxLevel: 5,
      icon: id,
      interactType: InteractType.CHEST,
      sellable: false,
      storable: true,
    });
  }

  // 红包（4级，交互同宝箱，散落 huayuan_pickup 线花愿利是）
  const hongbaoNames = ['迎春红包', '吉祥红包', '鸿运红包', '福满红包'];
  for (let i = 0; i < hongbaoNames.length; i++) {
    const id = `hongbao_${i + 1}`;
    map.set(id, {
      id,
      name: hongbaoNames[i],
      category: Category.CHEST,
      line: 'hongbao',
      level: i + 1,
      maxLevel: 4,
      icon: id,
      interactType: InteractType.CHEST,
      sellable: false,
      storable: true,
    });
  }

  // 钻石袋（3级，散落 currency_diamond_*）
  const diamondBagNames = ['碎钻小袋', '晶钻布袋', '璨钻锦袋'];
  for (let i = 0; i < diamondBagNames.length; i++) {
    const id = `diamond_bag_${i + 1}`;
    map.set(id, {
      id,
      name: diamondBagNames[i],
      category: Category.CHEST,
      line: 'diamond_bag',
      level: i + 1,
      maxLevel: 3,
      icon: id,
      interactType: InteractType.CHEST,
      sellable: false,
      storable: true,
    });
  }

  // 体力箱工具 stamina_chest_*（3 级，散落 currency_stamina_*）
  const staminaChestNames = ['元气小箱', '能量补给箱', '澎湃体力宝箱'];
  for (let i = 0; i < staminaChestNames.length; i++) {
    const id = `stamina_chest_${i + 1}`;
    map.set(id, {
      id,
      name: staminaChestNames[i],
      category: Category.CHEST,
      line: 'stamina_chest',
      level: i + 1,
      maxLevel: 3,
      icon: id,
      interactType: InteractType.CHEST,
      sellable: false,
      storable: true,
    });
  }

  // 幸运金币（棋盘消耗品：拖到合成链物品上随机升/降一级）
  map.set(LUCKY_COIN_ITEM_ID, {
    id: LUCKY_COIN_ITEM_ID,
    name: '幸运金币',
    category: Category.BUILDING,
    line: 'lucky_coin',
    level: 1,
    maxLevel: 1,
    icon: 'icon_coin',
    interactType: InteractType.NONE,
    sellable: false,
    storable: true,
  });

  map.set(CRYSTAL_BALL_ITEM_ID, {
    id: CRYSTAL_BALL_ITEM_ID,
    name: '水晶球',
    category: Category.BUILDING,
    line: 'special_crystal',
    level: 1,
    maxLevel: 1,
    icon: 'icon_crystal_ball',
    interactType: InteractType.NONE,
    sellable: false,
    storable: true,
  });

  map.set(GOLDEN_SCISSORS_ITEM_ID, {
    id: GOLDEN_SCISSORS_ITEM_ID,
    name: '金剪刀',
    category: Category.BUILDING,
    line: 'special_scissors',
    level: 1,
    maxLevel: 1,
    icon: 'icon_golden_scissors',
    interactType: InteractType.NONE,
    sellable: false,
    storable: true,
  });

  return map;
}

export const ITEM_DEFS = buildItemDefs();

/** 根据品类+线+等级查找物品ID */
export function findItemId(category: Category, line: string, level: number): string | null {
  for (const [id, def] of ITEM_DEFS) {
    if (def.category === category && def.line === line && def.level === level) return id;
  }
  return null;
}

/**
 * 该品类+产品线下物品的 maxLevel 上限（扫 ITEM_DEFS；扩行/加等级后订单与工具封顶自动跟上）
 */
export function getMaxLevelForLine(category: Category, line: string): number {
  let max = 0;
  for (const def of ITEM_DEFS.values()) {
    if (def.category === category && def.line === line) {
      max = Math.max(max, def.maxLevel);
    }
  }
  return max;
}

/** 获取合成后的物品ID（同品类同线，等级+1） */
export function getMergeResultId(itemId: string): string | null {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return null;
  if (def.level >= def.maxLevel) return null;
  return findItemId(def.category, def.line, def.level + 1);
}

/** 幸运金币：降一级（同品类同线，等级-1） */
export function getDowngradeResultId(itemId: string): string | null {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return null;
  if (def.level <= 1) return null;
  return findItemId(def.category, def.line, def.level - 1);
}

export function isLuckyCoinItem(itemId: string): boolean {
  return itemId === LUCKY_COIN_ITEM_ID;
}

export function isCrystalBallItem(itemId: string): boolean {
  return itemId === CRYSTAL_BALL_ITEM_ID;
}

export function isGoldenScissorsItem(itemId: string): boolean {
  return itemId === GOLDEN_SCISSORS_ITEM_ID;
}

/** 棋盘消耗品（金币 / 水晶球 / 金剪刀） */
export function isSpecialConsumableItem(itemId: string): boolean {
  return isLuckyCoinItem(itemId) || isCrystalBallItem(itemId) || isGoldenScissorsItem(itemId);
}

/**
 * 水晶球与金剪刀允许作用的物品：仅 FLOWER / DRINK 且非 TOOL；排除宝箱、货币、消耗品自身。
 */
export function isCrystalScissorsValidTargetDef(def: ItemDef): boolean {
  if (isSpecialConsumableItem(def.id)) return false;
  if (def.category === Category.CHEST || def.category === Category.CURRENCY) return false;
  if (def.category !== Category.FLOWER && def.category !== Category.DRINK) return false;
  if (def.interactType === InteractType.TOOL) return false;
  return true;
}

/** 幸运金币可作用的棋盘物品：鲜花/饮品可合成链 + 工具；排除宝箱、货币、金币自身 */
export function isLuckyCoinValidTarget(def: ItemDef): boolean {
  if (isLuckyCoinItem(def.id)) return false;
  if (def.category === Category.CHEST || def.category === Category.CURRENCY) return false;
  if (def.category === Category.FLOWER || def.category === Category.DRINK) return true;
  if (def.category === Category.BUILDING && def.interactType === InteractType.TOOL) return true;
  return false;
}

/**
 * 随机升一级或降一级；仅一侧合法则用该侧；皆不合法返回 null（不消耗金币）。
 */
export function pickLuckyCoinNewItemId(targetItemId: string): string | null {
  const upId = getMergeResultId(targetItemId);
  const downId = getDowngradeResultId(targetItemId);
  if (upId && downId) return Math.random() < 0.5 ? upId : downId;
  if (upId) return upId;
  if (downId) return downId;
  return null;
}

/** 用于结算展示：已知 newId 时判断相对原物品是升还是降 */
export function getLuckyCoinDirection(oldItemId: string, newItemId: string): 'up' | 'down' {
  const oldDef = ITEM_DEFS.get(oldItemId);
  const newDef = ITEM_DEFS.get(newItemId);
  if (!oldDef || !newDef) return 'up';
  return newDef.level > oldDef.level ? 'up' : 'down';
}

/** 获取物品所在的完整合成链（从1级到满级的所有物品ID） */
export function getMergeChain(itemId: string): string[] {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return [];
  const chain: string[] = [];
  for (let lv = 1; lv <= def.maxLevel; lv++) {
    const id = findItemId(def.category, def.line, lv);
    if (id) chain.push(id);
  }
  return chain;
}

/** 获取合成链的显示名称 */
export function getMergeChainName(itemId: string): string {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return '';
  const lineNames: Record<string, string> = {
    [FlowerLine.FRESH]: '鲜花',
    [FlowerLine.BOUQUET]: '花束',
    [FlowerLine.GREEN]: '绿植',
    [FlowerLine.WRAP]: '包装',
    [DrinkLine.TEA]: '茶饮',
    [DrinkLine.COLD]: '冷饮',
    [DrinkLine.DESSERT]: '甜品',
    [ToolLine.PLANT]: '园艺工具',
    [ToolLine.ARRANGE]: '包装工具',
    [ToolLine.TEA_SET]: '茶具',
    [ToolLine.MIXER]: '饮品器具',
    [ToolLine.BAKE]: '烘焙工具',
    chest: '宝箱',
    hongbao: '红包',
    diamond_bag: '钻石袋',
    stamina_chest: '体力宝箱',
    [CurrencyLine.STAMINA]: '体力',
    [CurrencyLine.HUAYUAN_PICKUP]: '花愿利是',
    [CurrencyLine.DIAMOND]: '钻石',
    lucky_coin: '幸运金币',
    special_crystal: '水晶球',
    special_scissors: '金剪刀',
  };
  return (lineNames[def.line] || def.line) + '合成线';
}

/** 判断物品是否是工具类交互（含 flower_wrap_4 等非 BUILDING 品类的工具） */
export function isToolItem(itemId: string): boolean {
  const def = ITEM_DEFS.get(itemId);
  if (!def) return false;
  return def.interactType === InteractType.TOOL;
}

/** 获取工具对应的产品线信息 */
export function getToolProductLine(itemId: string): { category: Category; line: string } | null {
  const def = ITEM_DEFS.get(itemId);
  if (!def || def.interactType !== InteractType.TOOL) return null;
  return TOOL_TO_PRODUCT_LINE[def.line as ToolLine] ?? null;
}
