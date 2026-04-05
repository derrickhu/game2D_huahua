/**
 * 许愿喷泉抽奖逻辑：扣券、加权随机、发奖到奖励收纳盒。
 */
import { ITEM_DEFS } from '@/config/ItemConfig';
import {
  FLOWER_SIGN_DRAW_COST_MULTI,
  FLOWER_SIGN_DRAW_COST_SINGLE,
  FLOWER_SIGN_GACHA_POOL,
  type FlowerSignPoolEntry,
} from '@/config/FlowerSignGachaConfig';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { FlowerSignTicketManager } from '@/managers/FlowerSignTicketManager';

export interface FlowerSignReward {
  itemId: string;
  count: number;
}

function buildValidPool(): FlowerSignPoolEntry[] {
  return FLOWER_SIGN_GACHA_POOL.filter((e) => ITEM_DEFS.has(e.itemId));
}

function pickOne(rng: () => number): FlowerSignReward {
  const pool = buildValidPool();
  if (pool.length === 0) {
    return { itemId: 'flower_fresh_1', count: 1 };
  }
  let sum = 0;
  for (const e of pool) sum += e.weight;
  let r = rng() * sum;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) {
      return { itemId: e.itemId, count: Math.max(1, Math.floor(e.count ?? 1)) };
    }
  }
  const last = pool[pool.length - 1]!;
  return { itemId: last.itemId, count: Math.max(1, Math.floor(last.count ?? 1)) };
}

function grantRewards(rewards: FlowerSignReward[]): void {
  for (const { itemId, count } of rewards) {
    if (!ITEM_DEFS.has(itemId) || count <= 0) continue;
    RewardBoxManager.addItem(itemId, count);
  }
}

export type FlowerSignDrawResult =
  | { ok: true; rewards: FlowerSignReward[] }
  | { ok: false; reason: 'no_ticket' | 'empty_pool' };

export const FlowerSignGachaManager = {
  drawSingle(rng: () => number = Math.random): FlowerSignDrawResult {
    const pool = buildValidPool();
    if (pool.length === 0) return { ok: false, reason: 'empty_pool' };
    if (!FlowerSignTicketManager.trySpend(FLOWER_SIGN_DRAW_COST_SINGLE)) {
      return { ok: false, reason: 'no_ticket' };
    }
    const r = pickOne(rng);
    grantRewards([r]);
    return { ok: true, rewards: [r] };
  },

  drawMulti(rng: () => number = Math.random): FlowerSignDrawResult {
    const pool = buildValidPool();
    if (pool.length === 0) return { ok: false, reason: 'empty_pool' };
    if (!FlowerSignTicketManager.trySpend(FLOWER_SIGN_DRAW_COST_MULTI)) {
      return { ok: false, reason: 'no_ticket' };
    }
    const rewards: FlowerSignReward[] = [];
    for (let i = 0; i < FLOWER_SIGN_DRAW_COST_MULTI; i++) {
      rewards.push(pickOne(rng));
    }
    grantRewards(rewards);
    return { ok: true, rewards };
  },
};
