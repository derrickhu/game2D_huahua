/**
 * 许愿喷泉抽奖：消耗许愿硬币；奖池由全量 ITEM_DEFS 按大类占比 + 等级衰减生成。
 * 硬币来源：活动/礼包等 FlowerSignTicketManager.add（非棋盘棋子）。
 */

import {
  Category,
  InteractType,
  GOLDEN_SCISSORS_ITEM_ID,
  CRYSTAL_BALL_ITEM_ID,
  LUCKY_COIN_ITEM_ID,
  LEGACY_FLOWER_SIGN_COIN_ITEM_ID,
  ITEM_DEFS,
  type ItemDef,
} from './ItemConfig';

export const FLOWER_SIGN_DRAW_COST_SINGLE = 1;
export const FLOWER_SIGN_DRAW_COST_MULTI = 10;

/** 总权重刻度（整数，便于核对占比） */
export const FLOWER_SIGN_WEIGHT_SCALE = 100_000;

/** 棋盘/收纳盒物品：弹窗 ×N（count 恒为 1，除策划显式写 count）；直加顶栏：仅数字 */
export type FlowerSignPoolEntry =
  | {
      kind: 'reward_box_item';
      itemId: string;
      weight: number;
      count?: number;
    }
  | {
      kind: 'direct_stamina';
      weight: number;
      amount: number;
    }
  | {
      kind: 'direct_huayuan';
      weight: number;
      amount: number;
    }
  | {
      kind: 'direct_diamond';
      weight: number;
      amount: number;
    };

/** 大类占比（相对 FLOWER_SIGN_WEIGHT_SCALE）；许愿硬币不进奖池 */
const BUCKET_PREMIUM = 1_000; // 1% 金剪刀+万能水晶+幸运金币
const BUCKET_TOOLS = 1_000; // 1% 工具类
/** 1%：普通宝箱 + 体力宝箱 + 钻石袋 + 红包（同一大类内按等级衰减分权） */
const BUCKET_CHEST_GROUP = 1_000;
const BUCKET_DIRECT = 5_000; // 5% 直加体力+钻石

const BUCKET_MAIN =
  FLOWER_SIGN_WEIGHT_SCALE -
  BUCKET_PREMIUM -
  BUCKET_TOOLS -
  BUCKET_CHEST_GROUP -
  BUCKET_DIRECT;

const PREMIUM_IDS = [GOLDEN_SCISSORS_ITEM_ID, CRYSTAL_BALL_ITEM_ID, LUCKY_COIN_ITEM_ID] as const;
/** 旧 id 若仍出现在配置中则排除；许愿硬币不进奖池 */
const EXCLUDED_FROM_GACHA_IDS = new Set<string>([LEGACY_FLOWER_SIGN_COIN_ITEM_ID]);

/** 等级越高权重越低：(maxLevel - level + 1)^2，同级线内衰减 */
function levelScore(def: ItemDef): number {
  const span = Math.max(1, def.maxLevel - def.level + 1);
  return span * span;
}

function distributeRewardBoxItems(defs: ItemDef[], totalWeight: number): FlowerSignPoolEntry[] {
  if (defs.length === 0 || totalWeight <= 0) return [];
  const scored = defs.map((def) => ({ def, score: levelScore(def) }));
  const sumScore = scored.reduce((a, b) => a + b.score, 0);
  const out: FlowerSignPoolEntry[] = [];
  let allocated = 0;
  for (let i = 0; i < scored.length; i++) {
    const last = i === scored.length - 1;
    const w = last
      ? Math.max(1, totalWeight - allocated)
      : Math.max(1, Math.floor((totalWeight * scored[i]!.score) / sumScore));
    out.push({ kind: 'reward_box_item', itemId: scored[i]!.def.id, weight: w, count: 1 });
    allocated += w;
  }
  const diff = totalWeight - allocated;
  if (diff !== 0 && out.length > 0) {
    const last = out[out.length - 1]!;
    last.weight = Math.max(1, last.weight + diff);
  }
  return out;
}

function distributeEqualIds(ids: string[], totalWeight: number): FlowerSignPoolEntry[] {
  if (ids.length === 0 || totalWeight <= 0) return [];
  const base = Math.floor(totalWeight / ids.length);
  let rem = totalWeight - base * ids.length;
  return ids.map((itemId) => {
    const extra = rem > 0 ? 1 : 0;
    if (rem > 0) rem -= 1;
    return { kind: 'reward_box_item' as const, itemId, weight: Math.max(1, base + extra), count: 1 };
  });
}

/** 直加体力/钻石：条内再分档，高档略稀；总和严格 = totalWeight */
function buildDirectEntries(totalWeight: number): FlowerSignPoolEntry[] {
  if (totalWeight <= 0) return [];
  // 相对权重：体力约 55%，钻石约 45%；档内递减
  const staminaShare = Math.floor((totalWeight * 55) / 100);
  const diamondShare = totalWeight - staminaShare;
  const staminaRows: { amount: number; w: number }[] = [
    { amount: 8, w: 4 },
    { amount: 15, w: 3 },
    { amount: 25, w: 2 },
    { amount: 40, w: 2 },
  ];
  const diamondRows: { amount: number; w: number }[] = [
    { amount: 1, w: 4 },
    { amount: 2, w: 3 },
    { amount: 4, w: 2 },
    { amount: 6, w: 1 },
  ];
  const alloc = (
    budget: number,
    rows: { amount: number; w: number }[],
    kind: 'direct_stamina' | 'direct_diamond',
  ): FlowerSignPoolEntry[] => {
    const sumW = rows.reduce((a, r) => a + r.w, 0);
    const out: FlowerSignPoolEntry[] = [];
    let used = 0;
    for (let i = 0; i < rows.length; i++) {
      const last = i === rows.length - 1;
      const part = last ? budget - used : Math.max(1, Math.floor((budget * rows[i]!.w) / sumW));
      if (kind === 'direct_stamina') {
        out.push({ kind: 'direct_stamina', weight: part, amount: rows[i]!.amount });
      } else {
        out.push({ kind: 'direct_diamond', weight: part, amount: rows[i]!.amount });
      }
      used += part;
    }
    const d = budget - used;
    if (d !== 0 && out.length > 0) {
      const le = out[out.length - 1]!;
      le.weight = Math.max(1, le.weight + d);
    }
    return out;
  };
  return [...alloc(staminaShare, staminaRows, 'direct_stamina'), ...alloc(diamondShare, diamondRows, 'direct_diamond')];
}

function classify(def: ItemDef): 'main' | 'chest_group' | 'tool' | 'premium' | 'none' {
  if (EXCLUDED_FROM_GACHA_IDS.has(def.id)) return 'none';
  if (PREMIUM_IDS.includes(def.id as (typeof PREMIUM_IDS)[number])) return 'premium';
  /** 铜～传说宝箱、体力箱、钻石袋、红包 共用 1% 桶 */
  if (def.category === Category.CHEST) return 'chest_group';
  if (def.category === Category.BUILDING && def.interactType === InteractType.TOOL) return 'tool';
  if (def.category === Category.FLOWER && def.interactType === InteractType.TOOL) return 'tool';
  if (def.category === Category.FLOWER && def.interactType === InteractType.NONE) return 'main';
  if (def.category === Category.DRINK && def.interactType === InteractType.NONE) return 'main';
  if (def.category === Category.CURRENCY) return 'main';
  return 'none';
}

function buildFlowerSignGachaPool(): FlowerSignPoolEntry[] {
  const main: ItemDef[] = [];
  const chestGroup: ItemDef[] = [];
  const tools: ItemDef[] = [];

  for (const def of ITEM_DEFS.values()) {
    const b = classify(def);
    switch (b) {
      case 'main':
        main.push(def);
        break;
      case 'chest_group':
        chestGroup.push(def);
        break;
      case 'tool':
        tools.push(def);
        break;
      case 'premium':
        break;
      default:
        break;
    }
  }

  const pool: FlowerSignPoolEntry[] = [];

  pool.push(...distributeRewardBoxItems(main, BUCKET_MAIN));
  pool.push(...distributeRewardBoxItems(chestGroup, BUCKET_CHEST_GROUP));
  pool.push(...distributeRewardBoxItems(tools, BUCKET_TOOLS));

  const premiumIds = PREMIUM_IDS.filter((id) => ITEM_DEFS.has(id));
  pool.push(...distributeEqualIds([...premiumIds], BUCKET_PREMIUM));

  pool.push(...buildDirectEntries(BUCKET_DIRECT));

  return pool;
}

/**
 * 全物品加权随机（仅 `ITEM_DEFS` 内有效 id）。
 * - 约 93%：鲜花/饮品/棋盘货币块（不含许愿硬币）等，等级越高权重越低。
 * - 5%：直加体力 + 直加钻石（多档 amount）。
 * - 各 1%：宝箱+体力箱+钻石袋+红包；全部工具；金剪刀+万能水晶+幸运金币。
 * - 许愿硬币不参与抽奖。
 */
export const FLOWER_SIGN_GACHA_POOL: FlowerSignPoolEntry[] = buildFlowerSignGachaPool();
