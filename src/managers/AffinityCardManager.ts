/**
 * 友谊卡 + 图鉴 + 赛季 — 管理器（V2）
 *
 * 职责：
 *  - 维护每张卡的「拥有数」与「首次获得时间」
 *  - 维护单客人保底计数
 *  - 提供 rollCardDrop(typeId)：决定本次掉几张卡 + 重复卡直接派发奖励
 *  - 维护「单客人里程碑」与「赛季全集」的领取状态，集齐瞬时结算
 *  - 提供 listCards / progress / isComplete 给 CodexPanel / CustomerProfilePanel
 *
 * 存档 Key: huahua_affinity_cards；CloudSync allowlist 已注册。
 *
 * 事件：
 *  - 'affinityCard:dropped' (typeId, results: AffinityCardDropResult[])
 *  - 'affinityCard:obtained' (cardId, def, isFirstTime)
 *  - 'affinityCard:milestone' (typeId, milestone, reward)  — 单客人里程碑达成
 *  - 'affinityCard:complete' (typeId)                       — 该客人 12 张全收齐
 *  - 'affinityCard:seasonComplete' (seasonId, reward)       — 整赛季全集
 */

import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { CurrencyManager } from './CurrencyManager';
import { DecorationManager } from './DecorationManager';
import { FlowerSignTicketManager } from './FlowerSignTicketManager';
import { CheckInManager } from './CheckInManager';
import { grantQuest } from '@/utils/UnlockChecker';
import {
  AFFINITY_CARDS,
  AFFINITY_CARD_MAP,
  CARD_DROP_BASE_CHANCE,
  CARD_DROP_DAILY_LIMIT,
  CARD_RARITIES,
  CURRENT_SEASON,
  CUSTOMER_MILESTONE_REWARDS,
  DUPLICATE_REWARDS,
  PITY_TO_SR_THRESHOLD,
  PITY_TO_SSR_THRESHOLD,
  bumpRarity,
  getCardsByOwner,
  getCardsByOwnerAndRarity,
  getCustomerMilestones,
  hasCardsForOwner,
  rollRarityByWeights,
  type AffinityCardDef,
  type CardRarity,
  type CardReward,
  type CustomerMilestone,
} from '@/config/AffinityCardConfig';

const STORAGE_KEY = 'huahua_affinity_cards';

/** 单卡持有状态 */
export interface CardOwnedState {
  count: number;
  firstObtainedAt: number;
}

export interface OwnerCardState {
  typeId: string;
  /** cardId → ownedState；只记录已得卡 */
  owned: Record<string, CardOwnedState>;
  /** 已结算过的里程碑 threshold（避免重复发奖） */
  claimedMilestones: number[];
  /** 自上次出 SR/SSR 起累计抽卡次数（保底） */
  pityToSr: number;
  /** 自上次出 SSR 起累计抽卡次数（保底） */
  pityToSsr: number;
}

interface PersistState {
  v: 3;
  owners: OwnerCardState[];
  /** 已领取的赛季全集大奖（seasonId 列表） */
  claimedSeasonGrand: string[];
  /** 当日掉卡计数所属日期（YYYY-MM-DD），与签到/每日糖一致 */
  dailyDropDate: string;
  /** 当日已掉落的卡张数（用于 CARD_DROP_DAILY_LIMIT 判断） */
  dailyDropCount: number;
}

/** 单次掉卡结果 */
export interface AffinityCardDropResult {
  card: AffinityCardDef;
  isDuplicate: boolean;
  /** 重复卡时直接派发的奖励（已结算到玩家账户） */
  duplicateReward?: CardReward;
}

class AffinityCardManagerClass {
  private _owners = new Map<string, OwnerCardState>();
  private _claimedSeasonGrand = new Set<string>();
  private _initialized = false;
  /** 当日掉卡计数所属日期（YYYY-MM-DD） */
  private _dailyDropDate = '';
  /** 当日已掉落的卡张数 */
  private _dailyDropCount = 0;

  // ============================================================
  // 生命周期
  // ============================================================

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._loadState();
    this._ensureOwnersForAllAffinityTypes();
  }

  private _ensureOwnersForAllAffinityTypes(): void {
    for (const card of AFFINITY_CARDS) {
      if (!this._owners.has(card.ownerTypeId)) {
        this._owners.set(card.ownerTypeId, this._defaultOwner(card.ownerTypeId));
      }
    }
  }

  private _defaultOwner(typeId: string): OwnerCardState {
    return {
      typeId,
      owned: {},
      claimedMilestones: [],
      pityToSr: 0,
      pityToSsr: 0,
    };
  }

  // ============================================================
  // 抽卡（AffinityManager.onCustomerDelivered → 这里）
  // ============================================================

  /**
   * 一次该熟客普通订单交付的"掉卡 + 即时奖励派发"
   *  - 玩家等级未达 / 该客人无卡定义：返回空结果
   *  - 否则按规则掉 0~1 张卡：新卡入图鉴；重复卡直接发花愿/钻石/体力
   *  - 同时检查「单客人里程碑」与「赛季全集」
   */
  rollCardDrop(typeId: string): {
    droppedCards: AffinityCardDropResult[];
  } {
    if (!hasCardsForOwner(typeId)) {
      return { droppedCards: [] };
    }

    this._rolloverDailyIfNeeded();

    const owner = this._owners.get(typeId) ?? this._defaultOwner(typeId);
    this._owners.set(typeId, owner);

    // 当日已达上限：不掉卡、不动保底，给玩家一个明确的"惊喜节奏"上限
    if (this._dailyDropCount >= CARD_DROP_DAILY_LIMIT) {
      return { droppedCards: [] };
    }

    if (Math.random() >= CARD_DROP_BASE_CHANCE) {
      // 不掉卡：仍推进保底（保持节奏感，避免极脸黑）
      owner.pityToSr += 1;
      owner.pityToSsr += 1;
      this._saveState();
      return { droppedCards: [] };
    }

    const remaining = CARD_DROP_DAILY_LIMIT - this._dailyDropCount;
    const results: AffinityCardDropResult[] = [];
    const first = this._rollOneCard(owner);
    if (first) results.push(first);

    // 截断到当日剩余额度（理论上 remaining ≥ 1，第二张会被 if 卡掉）
    if (results.length > remaining) results.length = remaining;
    this._dailyDropCount += results.length;

    if (results.length > 0) {
      EventBus.emit('affinityCard:dropped', typeId, results);
      for (const r of results) {
        if (!r.isDuplicate) {
          EventBus.emit('affinityCard:obtained', r.card.id, r.card, true);
        }
      }
      // 里程碑（按从低到高发奖，可一次跨多档）
      this._maybeGrantMilestones(typeId);
      // 单客人 12/12 完成
      if (this.isComplete(typeId)) {
        EventBus.emit('affinityCard:complete', typeId);
        this._maybeGrantSeasonGrand();
      }
    }

    this._saveState();
    return { droppedCards: results };
  }

  /** 抽一张卡（更新 owner 的 pity 与 owned 状态；返回结果或 null） */
  private _rollOneCard(owner: OwnerCardState): AffinityCardDropResult | null {
    let rarity = rollRarityByWeights();

    if (rarity === 'N' || rarity === 'R') {
      if (owner.pityToSsr + 1 >= PITY_TO_SSR_THRESHOLD) rarity = 'SSR';
      else if (owner.pityToSr + 1 >= PITY_TO_SR_THRESHOLD) rarity = 'SR';
    }

    const pool = getCardsByOwnerAndRarity(owner.typeId, rarity);
    if (pool.length === 0) {
      const fallback = bumpRarity(rarity, -1);
      const fbPool = getCardsByOwnerAndRarity(owner.typeId, fallback);
      if (fbPool.length === 0) return null;
      return this._pickAndCommitFromPool(owner, fbPool, fallback);
    }
    return this._pickAndCommitFromPool(owner, pool, rarity);
  }

  /** 优先未得卡：随机；全得：随机重复（重复立即派发奖励） */
  private _pickAndCommitFromPool(
    owner: OwnerCardState,
    pool: AffinityCardDef[],
    rarity: CardRarity,
  ): AffinityCardDropResult {
    const unowned = pool.filter(c => !owner.owned[c.id]);
    const target = unowned.length > 0
      ? unowned[Math.floor(Math.random() * unowned.length)]!
      : pool[Math.floor(Math.random() * pool.length)]!;
    const isDup = !!owner.owned[target.id];

    if (isDup) {
      owner.owned[target.id]!.count += 1;
      const reward = DUPLICATE_REWARDS[rarity];
      this._grantReward(reward);
      // 重复卡不冲保底（保底算"翻不到"次数）
      return { card: target, isDuplicate: true, duplicateReward: { ...reward } };
    }

    owner.owned[target.id] = { count: 1, firstObtainedAt: Date.now() };
    if (rarity === 'SR' || rarity === 'SSR') owner.pityToSr = 0;
    if (rarity === 'SSR') owner.pityToSsr = 0;
    if (rarity !== 'SR' && rarity !== 'SSR') owner.pityToSr += 1;
    if (rarity !== 'SSR') owner.pityToSsr += 1;
    return { card: target, isDuplicate: false };
  }

  // ============================================================
  // 里程碑
  // ============================================================

  /** 检查并发放该客人当前可领的所有里程碑 */
  private _maybeGrantMilestones(typeId: string): void {
    const owner = this._owners.get(typeId);
    if (!owner) return;
    const milestones = getCustomerMilestones(typeId);
    if (milestones.length === 0) return;
    const obtained = Object.keys(owner.owned).length;
    const sorted = [...milestones].sort((a, b) => a.threshold - b.threshold);
    for (const m of sorted) {
      if (owner.claimedMilestones.includes(m.threshold)) continue;
      if (obtained < m.threshold) continue;
      this._grantMilestone(typeId, m);
      owner.claimedMilestones.push(m.threshold);
    }
  }

  private _grantMilestone(typeId: string, m: CustomerMilestone): void {
    this._grantReward(m.reward);
    if (m.decoUnlockId) {
      // 复用旧 questId 命名让 grantQuest 链路无缝；UnlockRequirement 文案已改图鉴口径。
      grantQuest(`affinity_${typeId}_codex_full`);
      DecorationManager.gmUnlockDeco(m.decoUnlockId);
    }
    EventBus.emit('affinityCard:milestone', typeId, m, m.reward);
    console.log(`[AffinityCard] ${typeId} 里程碑 ${m.threshold}/12 达成: ${m.title}`);
  }

  private _grantReward(r: CardReward): void {
    if (r.huayuan) CurrencyManager.addHuayuan(r.huayuan);
    if (r.diamond) CurrencyManager.addDiamond(r.diamond);
    if (r.stamina) CurrencyManager.addStamina(r.stamina);
    if (r.flowerSignTickets) FlowerSignTicketManager.add(r.flowerSignTickets);
  }

  /** 检查赛季全集大奖（CURRENT_SEASON.ownerTypeIds 全员 100%） */
  private _maybeGrantSeasonGrand(): void {
    const season = CURRENT_SEASON;
    if (this._claimedSeasonGrand.has(season.id)) return;
    for (const tid of season.ownerTypeIds) {
      if (!this.isComplete(tid)) return;
    }
    this._claimedSeasonGrand.add(season.id);
    this._grantReward(season.grandReward);
    if (season.grandReward.decoUnlockId) {
      grantQuest(`affinity_season_${season.id}_complete`);
      DecorationManager.gmUnlockDeco(season.grandReward.decoUnlockId);
    }
    EventBus.emit('affinityCard:seasonComplete', season.id, season.grandReward);
    console.log(`[AffinityCard] 赛季 ${season.id} 100% 全集达成！`);
  }

  /** 单客人「该订单永久花愿倍率」（来自 100% 集齐里程碑） */
  huayuanMultFor(typeId: string): number {
    const owner = this._owners.get(typeId);
    if (!owner) return 1;
    const milestones = getCustomerMilestones(typeId);
    let mult = 1;
    for (const m of milestones) {
      if (m.permanentHuayuanMult && owner.claimedMilestones.includes(m.threshold)) {
        mult = Math.max(mult, m.permanentHuayuanMult);
      }
    }
    return mult;
  }

  // ============================================================
  // 查询
  // ============================================================

  has(cardId: string): boolean {
    const def = AFFINITY_CARD_MAP.get(cardId);
    if (!def) return false;
    const owner = this._owners.get(def.ownerTypeId);
    return !!owner && !!owner.owned[cardId];
  }

  countOf(cardId: string): number {
    const def = AFFINITY_CARD_MAP.get(cardId);
    if (!def) return 0;
    const owner = this._owners.get(def.ownerTypeId);
    return owner?.owned[cardId]?.count ?? 0;
  }

  listCards(typeId: string): Array<AffinityCardDef & {
    obtained: boolean;
    obtainedAt?: number;
    dupCount: number;
  }> {
    const owner = this._owners.get(typeId);
    const cards = getCardsByOwner(typeId);
    const order: Record<CardRarity, number> = { N: 0, R: 1, SR: 2, SSR: 3 };
    const sorted = [...cards].sort((a, b) =>
      (order[a.rarity] - order[b.rarity]) || a.id.localeCompare(b.id),
    );
    return sorted.map(c => {
      const o = owner?.owned[c.id];
      return {
        ...c,
        obtained: !!o,
        obtainedAt: o?.firstObtainedAt,
        dupCount: o ? Math.max(0, o.count - 1) : 0,
      };
    });
  }

  progress(typeId: string): {
    obtained: number;
    total: number;
    byRarity: Record<CardRarity, [number, number]>;
  } {
    const cards = getCardsByOwner(typeId);
    const owner = this._owners.get(typeId);
    const byRarity: Record<CardRarity, [number, number]> = {
      N: [0, 0], R: [0, 0], SR: [0, 0], SSR: [0, 0],
    };
    let obtained = 0;
    for (const c of cards) {
      byRarity[c.rarity]![1] += 1;
      if (owner?.owned[c.id]) {
        byRarity[c.rarity]![0] += 1;
        obtained += 1;
      }
    }
    return { obtained, total: cards.length, byRarity };
  }

  isComplete(typeId: string): boolean {
    const cards = getCardsByOwner(typeId);
    if (cards.length === 0) return false;
    const owner = this._owners.get(typeId);
    if (!owner) return false;
    for (const c of cards) {
      if (!owner.owned[c.id]) return false;
    }
    return true;
  }

  /** 单客人里程碑列表 + 是否已领 */
  milestonesOf(typeId: string): Array<CustomerMilestone & { claimed: boolean }> {
    const owner = this._owners.get(typeId);
    return getCustomerMilestones(typeId).map(m => ({
      ...m,
      claimed: !!owner && owner.claimedMilestones.includes(m.threshold),
    }));
  }

  /** 当前赛季是否已 100% 全集 */
  isSeasonComplete(seasonId: string = CURRENT_SEASON.id): boolean {
    return this._claimedSeasonGrand.has(seasonId);
  }

  /** 当日已掉张数 / 上限（UI / Codex 角标可显示"今日已 X/N"） */
  todayDropQuota(): { used: number; limit: number; remaining: number } {
    this._rolloverDailyIfNeeded();
    const limit = CARD_DROP_DAILY_LIMIT;
    const used = Math.min(this._dailyDropCount, limit);
    return { used, limit, remaining: Math.max(0, limit - used) };
  }

  /** 全部熟客的总进度（首页徽章 / 小红点） */
  totalProgress(): { obtained: number; total: number } {
    let obtained = 0, total = 0;
    for (const o of this._owners.values()) {
      const cards = getCardsByOwner(o.typeId);
      total += cards.length;
      for (const c of cards) {
        if (o.owned[c.id]) obtained += 1;
      }
    }
    return { obtained, total };
  }

  // ============================================================
  // GM
  // ============================================================

  /** GM：直发指定卡 */
  gmGrantCard(cardId: string): void {
    const def = AFFINITY_CARD_MAP.get(cardId);
    if (!def) return;
    const o = this._owners.get(def.ownerTypeId) ?? this._defaultOwner(def.ownerTypeId);
    this._owners.set(def.ownerTypeId, o);
    const isDup = !!o.owned[cardId];
    if (isDup) {
      o.owned[cardId]!.count += 1;
      const reward = DUPLICATE_REWARDS[def.rarity];
      this._grantReward(reward);
      const result: AffinityCardDropResult = { card: def, isDuplicate: true, duplicateReward: { ...reward } };
      EventBus.emit('affinityCard:dropped', def.ownerTypeId, [result]);
    } else {
      o.owned[cardId] = { count: 1, firstObtainedAt: Date.now() };
      const result: AffinityCardDropResult = { card: def, isDuplicate: false };
      EventBus.emit('affinityCard:dropped', def.ownerTypeId, [result]);
      EventBus.emit('affinityCard:obtained', cardId, def, true);
      this._maybeGrantMilestones(def.ownerTypeId);
      if (this.isComplete(def.ownerTypeId)) {
        EventBus.emit('affinityCard:complete', def.ownerTypeId);
        this._maybeGrantSeasonGrand();
      }
    }
    this._saveState();
  }

  /** GM：一键全收某熟客 */
  gmGrantAllForType(typeId: string): void {
    const cards = getCardsByOwner(typeId);
    if (cards.length === 0) return;
    const o = this._owners.get(typeId) ?? this._defaultOwner(typeId);
    this._owners.set(typeId, o);
    for (const c of cards) {
      if (!o.owned[c.id]) {
        o.owned[c.id] = { count: 1, firstObtainedAt: Date.now() };
        EventBus.emit('affinityCard:obtained', c.id, c, true);
      }
    }
    this._maybeGrantMilestones(typeId);
    if (this.isComplete(typeId)) {
      EventBus.emit('affinityCard:complete', typeId);
      this._maybeGrantSeasonGrand();
    }
    this._saveState();
  }

  /** GM：模拟一次掉卡（不消耗订单） */
  gmSimulateDrop(typeId: string): void {
    this.rollCardDrop(typeId);
  }

  /** GM：清空所有进度 */
  gmReset(): void {
    for (const id of this._owners.keys()) {
      this._owners.set(id, this._defaultOwner(id));
    }
    this._claimedSeasonGrand.clear();
    this._dailyDropDate = '';
    this._dailyDropCount = 0;
    this._saveState();
  }

  /** GM：把今日掉卡额度刷回 0（用于本地测试，不动卡册进度） */
  gmResetDailyQuota(): void {
    this._dailyDropDate = this._todayKey();
    this._dailyDropCount = 0;
    this._saveState();
  }

  dump(): {
    owners: OwnerCardState[];
    rarities: typeof CARD_RARITIES;
    claimedSeasons: string[];
    dailyQuota: { date: string; used: number; limit: number };
  } {
    return {
      owners: Array.from(this._owners.values()).map(o => ({ ...o, owned: { ...o.owned } })),
      rarities: CARD_RARITIES,
      claimedSeasons: Array.from(this._claimedSeasonGrand),
      dailyQuota: {
        date: this._dailyDropDate,
        used: this._dailyDropCount,
        limit: CARD_DROP_DAILY_LIMIT,
      },
    };
  }

  // ============================================================
  // 每日额度
  // ============================================================

  private _todayKey(): string {
    // 与 CheckInManager._getTodayStr / DailyCandyManager._todayKey 一致
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + (CheckInManager.gmDateOffsetDays ?? 0));
    return d.toISOString().slice(0, 10);
  }

  private _rolloverDailyIfNeeded(): void {
    const today = this._todayKey();
    if (this._dailyDropDate !== today) {
      this._dailyDropDate = today;
      this._dailyDropCount = 0;
    }
  }

  // ============================================================
  // 存档
  // ============================================================

  private _saveState(): void {
    try {
      const data: PersistState = {
        v: 3,
        owners: Array.from(this._owners.values()).map(o => ({
          typeId: o.typeId,
          owned: { ...o.owned },
          claimedMilestones: [...o.claimedMilestones],
          pityToSr: o.pityToSr,
          pityToSsr: o.pityToSsr,
        })),
        claimedSeasonGrand: Array.from(this._claimedSeasonGrand),
        dailyDropDate: this._dailyDropDate,
        dailyDropCount: this._dailyDropCount,
      };
      PersistService.writeRaw(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[AffinityCardManager] 存档失败:', e);
    }
  }

  private _loadState(): void {
    try {
      const raw = PersistService.readRaw(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<PersistState>;
      if (Array.isArray(data?.owners)) {
        for (const o of data.owners) {
          if (!o || typeof o.typeId !== 'string') continue;
          const owned: Record<string, CardOwnedState> = {};
          if (o.owned && typeof o.owned === 'object') {
            for (const [cid, st] of Object.entries(o.owned)) {
              if (!st || typeof st !== 'object') continue;
              const cnt = Math.max(1, Math.floor((st as CardOwnedState).count ?? 1));
              const ts = Math.max(0, Math.floor((st as CardOwnedState).firstObtainedAt ?? 0));
              owned[cid] = { count: cnt, firstObtainedAt: ts };
            }
          }
          const claimedMs = Array.isArray(o.claimedMilestones)
            ? o.claimedMilestones.filter((n): n is number => typeof n === 'number' && n > 0)
            : [];
          this._owners.set(o.typeId, {
            typeId: o.typeId,
            owned,
            claimedMilestones: claimedMs,
            pityToSr: Math.max(0, Math.floor(o.pityToSr ?? 0)),
            pityToSsr: Math.max(0, Math.floor(o.pityToSsr ?? 0)),
          });
        }
      }
      if (Array.isArray(data?.claimedSeasonGrand)) {
        for (const sid of data.claimedSeasonGrand) {
          if (typeof sid === 'string') this._claimedSeasonGrand.add(sid);
        }
      }
      // v3 起：每日掉卡额度。旧档无该字段→今天从 0 开始。
      if (typeof data?.dailyDropDate === 'string') {
        this._dailyDropDate = data.dailyDropDate;
      }
      if (typeof data?.dailyDropCount === 'number' && data.dailyDropCount >= 0) {
        this._dailyDropCount = Math.floor(data.dailyDropCount);
      }
      // 跨日加载兜底（一启动就是新一天）
      this._rolloverDailyIfNeeded();
    } catch (e) {
      console.warn('[AffinityCardManager] 读档失败:', e);
    }
  }
}

export const AffinityCardManager = new AffinityCardManagerClass();
