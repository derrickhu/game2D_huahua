/**
 * 许愿喷泉抽奖逻辑：扣券、加权随机；结果进奖励收纳盒或直加顶栏货币。
 */
import { analytics, EVENT_NAMES } from '@/analytics';
import { ITEM_DEFS } from '@/config/ItemConfig';
import {
  FLOWER_SIGN_DRAW_COST_MULTI,
  FLOWER_SIGN_DRAW_COST_SINGLE,
  FLOWER_SIGN_GACHA_POOL,
  type FlowerSignPoolEntry,
} from '@/config/FlowerSignGachaConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { FlowerSignTicketManager } from '@/managers/FlowerSignTicketManager';

export type FlowerSignReward =
  | { kind: 'reward_box_item'; itemId: string; count: number }
  | { kind: 'direct_stamina'; amount: number }
  | { kind: 'direct_huayuan'; amount: number }
  | { kind: 'direct_diamond'; amount: number };

function buildValidPool(): FlowerSignPoolEntry[] {
  return FLOWER_SIGN_GACHA_POOL.filter((e) => {
    if (e.kind === 'reward_box_item') return ITEM_DEFS.has(e.itemId);
    return e.amount > 0;
  });
}

function poolEntryToReward(e: FlowerSignPoolEntry): FlowerSignReward {
  switch (e.kind) {
    case 'reward_box_item':
      return {
        kind: 'reward_box_item',
        itemId: e.itemId,
        count: Math.max(1, Math.floor(e.count ?? 1)),
      };
    case 'direct_stamina':
      return { kind: 'direct_stamina', amount: Math.max(1, Math.floor(e.amount)) };
    case 'direct_huayuan':
      return { kind: 'direct_huayuan', amount: Math.max(1, Math.floor(e.amount)) };
    case 'direct_diamond':
      return { kind: 'direct_diamond', amount: Math.max(1, Math.floor(e.amount)) };
  }
}

function pickOne(rng: () => number): FlowerSignReward {
  const pool = buildValidPool();
  if (pool.length === 0) {
    return { kind: 'reward_box_item', itemId: 'flower_fresh_1', count: 1 };
  }
  let sum = 0;
  for (const e of pool) sum += e.weight;
  let r = rng() * sum;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) return poolEntryToReward(e);
  }
  return poolEntryToReward(pool[pool.length - 1]!);
}

/** 许愿结果入账；收纳盒物品与直加货币分支不同 */
export function grantFlowerSignRewards(rewards: FlowerSignReward[]): void {
  for (const rw of rewards) {
    switch (rw.kind) {
      case 'reward_box_item':
        if (ITEM_DEFS.has(rw.itemId) && rw.count > 0) {
          RewardBoxManager.addItem(rw.itemId, rw.count);
        }
        break;
      case 'direct_stamina':
        CurrencyManager.addStamina(rw.amount);
        break;
      case 'direct_huayuan':
        CurrencyManager.addHuayuan(rw.amount);
        break;
      case 'direct_diamond':
        CurrencyManager.addDiamond(rw.amount);
        break;
    }
  }
}

export type FlowerSignDrawResult =
  | { ok: true; rewards: FlowerSignReward[] }
  | { ok: false; reason: 'no_ticket' | 'empty_pool' };

/**
 * 抽奖经分埋点：在 Manager 内部统一打 fountain_draw 事件。
 * 设计原因：抽奖逻辑没有 EventBus emit（reward 直接 return 给调用方），
 * 在调用方（FlowerSignGachaPanel）多处 track 容易漏；内部统一 track 是单源真相。
 *
 * draw_kind 区分 single / multi / multi_free，rarity_summary 统计本次产出的 4 类奖励数量。
 */
function trackDraw(
  drawKind: 'single' | 'multi' | 'multi_free',
  rewards: FlowerSignReward[],
  ticketCost: number,
): void {
  let rewardBoxItems = 0;
  let directHuayuan = 0;
  let directDiamond = 0;
  let directStamina = 0;
  for (const r of rewards) {
    switch (r.kind) {
      case 'reward_box_item':
        rewardBoxItems += r.count;
        break;
      case 'direct_huayuan':
        directHuayuan += r.amount;
        break;
      case 'direct_diamond':
        directDiamond += r.amount;
        break;
      case 'direct_stamina':
        directStamina += r.amount;
        break;
    }
  }
  analytics.track(EVENT_NAMES.FOUNTAIN_DRAW, {
    draw_kind: drawKind,
    ticket_cost: ticketCost,
    reward_count: rewards.length,
    reward_box_items: rewardBoxItems,
    direct_huayuan: directHuayuan,
    direct_diamond: directDiamond,
    direct_stamina: directStamina,
  });
}

export const FlowerSignGachaManager = {
  drawSingle(rng: () => number = Math.random): FlowerSignDrawResult {
    const pool = buildValidPool();
    if (pool.length === 0) return { ok: false, reason: 'empty_pool' };
    if (!FlowerSignTicketManager.trySpend(FLOWER_SIGN_DRAW_COST_SINGLE)) {
      return { ok: false, reason: 'no_ticket' };
    }
    const r = pickOne(rng);
    const rewards = [r];
    trackDraw('single', rewards, FLOWER_SIGN_DRAW_COST_SINGLE);
    return { ok: true, rewards };
  },

  drawMultiFree(rng: () => number = Math.random): FlowerSignDrawResult {
    const pool = buildValidPool();
    if (pool.length === 0) return { ok: false, reason: 'empty_pool' };
    const rewards: FlowerSignReward[] = [];
    for (let i = 0; i < FLOWER_SIGN_DRAW_COST_MULTI; i++) {
      rewards.push(pickOne(rng));
    }
    trackDraw('multi_free', rewards, 0);
    return { ok: true, rewards };
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
    trackDraw('multi', rewards, FLOWER_SIGN_DRAW_COST_MULTI);
    return { ok: true, rewards };
  },
};
