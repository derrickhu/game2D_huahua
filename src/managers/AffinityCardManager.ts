/**
 * 熟客友谊卡 + 图鉴系统 — 管理器
 *
 * 职责：
 *  - 维护每张卡的「拥有数」与「首次获得时间」
 *  - 维护每位熟客的「友谊点（碎片）」与抽卡保底计数
 *  - 提供 rollCardDrop(typeId, isExclusive) 给 AffinityManager 调用，决定本次交付掉几张卡 + 转换成多少 Bond 点
 *  - 提供 listCards / progress / isComplete 给 CodexPanel / CustomerProfilePanel
 *  - 提供 redeemPack / redeemBondPush 给 ShardShopPanel
 *  - 老存档迁移：检测到 huahua_affinity_cards 不存在但 huahua_affinity 存在时，按 LEGACY_BOND_TO_CARDS 回填
 *  - 存档 Key: huahua_affinity_cards；CloudSync allowlist 同步注册（CloudConfig.ts 同步追加）
 *
 * 事件：
 *  - 'affinityCard:dropped' (typeId, results: AffinityCardDropResult[])
 *  - 'affinityCard:obtained' (cardId, def, isFirstTime)
 *  - 'affinityCard:complete' (typeId)        — 该熟客全卡收齐
 *  - 'affinityCard:shardChanged' (typeId, oldVal, newVal)
 *
 * 与 AffinityManager 的桥接（P1 接入完成后）：
 *  - AffinityManager.onCustomerDelivered → 若 isAffinityCardSystemEnabled() → 调 rollCardDrop
 *    → 用返回的 addedBondPoints 累加到 AffinityEntryState.points
 */

import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { isAffinityCardSystemEnabled } from '@/config/AffinityFeatureFlags';
import {
  AFFINITY_CARDS,
  AFFINITY_CARD_MAP,
  CARD_DROP_BASE_CHANCE,
  CARD_DROP_EXCLUSIVE_CHANCE,
  CARD_DROP_EXCLUSIVE_RARITY_BUMP,
  CARD_DROP_EXCLUSIVE_SECOND_CHANCE,
  CARD_RARITIES,
  CARD_RARITY_POINTS,
  LEGACY_BOND_TO_CARDS,
  PITY_TO_SR_THRESHOLD,
  PITY_TO_SSR_THRESHOLD,
  SHARD_BOND_PUSH_COST,
  SHARD_PACK_COSTS,
  SHARD_PER_DUP,
  bumpRarity,
  getCardsByOwner,
  getCardsByOwnerAndRarity,
  hasCardsForOwner,
  rollRarityByWeights,
  type AffinityCardDef,
  type CardRarity,
} from '@/config/AffinityCardConfig';
import { BOND_THRESHOLDS, type BondLevel } from '@/config/AffinityConfig';

const STORAGE_KEY = 'huahua_affinity_cards';
const LEGACY_AFFINITY_KEY = 'huahua_affinity';

/** 单卡持有状态 */
export interface CardOwnedState {
  /** 拥有数（≥1 表示已得；首张算非重复，>1 视后续为重复 → 转碎片） */
  count: number;
  /** 首次获得时间戳（ms） */
  firstObtainedAt: number;
}

/** 单熟客的卡片状态 */
export interface OwnerCardState {
  typeId: string;
  /** cardId → ownedState；只记录已得卡 */
  owned: Record<string, CardOwnedState>;
  /** 友谊点（重复卡转化） */
  shards: number;
  /** 自上次出 SR/SSR 起累计抽卡次数（保底用） */
  pityToSr: number;
  /** 自上次出 SSR 起累计抽卡次数（保底用） */
  pityToSsr: number;
}

interface PersistState {
  v: 1;
  owners: OwnerCardState[];
  /** 老存档迁移已完成的标记（避免反复回填） */
  legacyMigrated: boolean;
}

/** 单次掉卡结果 */
export interface AffinityCardDropResult {
  card: AffinityCardDef;
  /** 是否本次为重复（已拥有过） */
  isDuplicate: boolean;
  /** 重复时给的碎片数 */
  shardGain: number;
  /** 非重复时计入 Bond 的积分；重复时为 0 */
  bondPoints: number;
}

class AffinityCardManagerClass {
  private _owners = new Map<string, OwnerCardState>();
  private _initialized = false;
  private _legacyMigrated = false;

  // ============================================================
  // 生命周期
  // ============================================================

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._loadState();
    this._ensureOwnersForAllAffinityTypes();
    this._maybeMigrateFromLegacyAffinity();
  }

  /** 给所有有卡定义的熟客建空 OwnerCardState（首次进入时） */
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
      shards: 0,
      pityToSr: 0,
      pityToSsr: 0,
    };
  }

  // ============================================================
  // 抽卡（AffinityManager.onCustomerDelivered → 这里）
  // ============================================================

  /**
   * 一次该熟客订单交付的"掉卡 + Bond 积分计算"
   *  - FF 关闭时返回空结果（不影响兼容路径）
   *  - 没有该客人卡定义时返回空结果
   *  - 否则按规则掉 0~2 张卡，每张要么"非重复→bondPoints>0"，要么"重复→shardGain>0"
   */
  rollCardDrop(typeId: string, isExclusive: boolean): {
    droppedCards: AffinityCardDropResult[];
    addedBondPoints: number;
  } {
    if (!isAffinityCardSystemEnabled()) {
      return { droppedCards: [], addedBondPoints: 0 };
    }
    if (!hasCardsForOwner(typeId)) {
      return { droppedCards: [], addedBondPoints: 0 };
    }

    const owner = this._owners.get(typeId) ?? this._defaultOwner(typeId);
    this._owners.set(typeId, owner);

    const baseChance = isExclusive ? CARD_DROP_EXCLUSIVE_CHANCE : CARD_DROP_BASE_CHANCE;
    if (Math.random() >= baseChance) {
      // 不掉卡：仍推进保底（保持节奏感，否则极脸黑）
      owner.pityToSr += 1;
      owner.pityToSsr += 1;
      this._saveState();
      return { droppedCards: [], addedBondPoints: 0 };
    }

    const results: AffinityCardDropResult[] = [];
    const first = this._rollOneCard(owner, isExclusive);
    if (first) results.push(first);

    // 专属订单二张卡触发
    if (isExclusive && first && Math.random() < CARD_DROP_EXCLUSIVE_SECOND_CHANCE) {
      const second = this._rollOneCard(owner, isExclusive);
      if (second) results.push(second);
    }

    let addedBondPoints = 0;
    for (const r of results) addedBondPoints += r.bondPoints;

    if (results.length > 0) {
      EventBus.emit('affinityCard:dropped', typeId, results);
      // 单卡事件：用于触发图鉴小红点 / 复用其他订阅
      for (const r of results) {
        if (!r.isDuplicate) {
          EventBus.emit('affinityCard:obtained', r.card.id, r.card, true);
        }
      }
      // 如果该客人因这次抽卡而集齐
      if (this.isComplete(typeId)) {
        EventBus.emit('affinityCard:complete', typeId);
      }
    }

    this._saveState();
    return { droppedCards: results, addedBondPoints };
  }

  /** 抽一张卡（更新 owner 的 pity 与 owned 状态；返回结果或 null） */
  private _rollOneCard(owner: OwnerCardState, isExclusive: boolean): AffinityCardDropResult | null {
    let rarity = rollRarityByWeights();
    if (isExclusive) rarity = bumpRarity(rarity, CARD_DROP_EXCLUSIVE_RARITY_BUMP);

    // 保底覆盖
    if (rarity === 'N' || rarity === 'R') {
      if (owner.pityToSsr + 1 >= PITY_TO_SSR_THRESHOLD) rarity = 'SSR';
      else if (owner.pityToSr + 1 >= PITY_TO_SR_THRESHOLD) rarity = 'SR';
    }

    // 在该客人 + 该稀有度的卡池里挑
    const pool = getCardsByOwnerAndRarity(owner.typeId, rarity);
    if (pool.length === 0) {
      // 该稀有度暂无配置（如 SSR 全空）→ 降一档
      const fallback = bumpRarity(rarity, -1);
      const fbPool = getCardsByOwnerAndRarity(owner.typeId, fallback);
      if (fbPool.length === 0) return null;
      return this._pickAndCommitFromPool(owner, fbPool, fallback);
    }
    return this._pickAndCommitFromPool(owner, pool, rarity);
  }

  /** 优先未得卡：随机；全得：随机重复 */
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
      const shardGain = SHARD_PER_DUP[rarity];
      const oldShards = owner.shards;
      owner.shards += shardGain;
      EventBus.emit('affinityCard:shardChanged', owner.typeId, oldShards, owner.shards);
      // 重复卡不冲保底（保底算的是"翻不到"的次数）
      return { card: target, isDuplicate: true, shardGain, bondPoints: 0 };
    }

    owner.owned[target.id] = { count: 1, firstObtainedAt: Date.now() };
    // 重置保底
    if (rarity === 'SR' || rarity === 'SSR') owner.pityToSr = 0;
    if (rarity === 'SSR') owner.pityToSsr = 0;
    if (rarity !== 'SR' && rarity !== 'SSR') owner.pityToSr += 1;
    if (rarity !== 'SSR') owner.pityToSsr += 1;
    return {
      card: target,
      isDuplicate: false,
      shardGain: 0,
      bondPoints: CARD_RARITY_POINTS[rarity],
    };
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

  /** 单张卡的拥有数（含重复） */
  countOf(cardId: string): number {
    const def = AFFINITY_CARD_MAP.get(cardId);
    if (!def) return 0;
    const owner = this._owners.get(def.ownerTypeId);
    return owner?.owned[cardId]?.count ?? 0;
  }

  /** 该熟客的全部卡（按稀有度 N→SSR 再按 id 排） */
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

  /** 该熟客收集进度概览 */
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

  /** 友谊点 */
  getShards(typeId: string): number {
    return this._owners.get(typeId)?.shards ?? 0;
  }

  spendShards(typeId: string, amount: number): boolean {
    const o = this._owners.get(typeId);
    if (!o || o.shards < amount) return false;
    const oldShards = o.shards;
    o.shards -= amount;
    EventBus.emit('affinityCard:shardChanged', typeId, oldShards, o.shards);
    this._saveState();
    return true;
  }

  // ============================================================
  // 友谊点商店
  // ============================================================

  /**
   * 用碎片买"必出指定稀有度"卡包：从该客人未得卡里抽；全得则降级为重复（按 SHARD_PER_DUP 双倍补偿）
   * 返回掉卡结果或 null（碎片不够 / 该熟客无卡）
   */
  redeemPack(typeId: string, rarity: CardRarity): AffinityCardDropResult | null {
    if (!hasCardsForOwner(typeId)) return null;
    const cost = SHARD_PACK_COSTS[rarity];
    const o = this._owners.get(typeId) ?? this._defaultOwner(typeId);
    this._owners.set(typeId, o);
    if (o.shards < cost) return null;

    const pool = getCardsByOwnerAndRarity(typeId, rarity);
    if (pool.length === 0) return null;

    const oldShards = o.shards;
    o.shards -= cost;
    EventBus.emit('affinityCard:shardChanged', typeId, oldShards, o.shards);

    const result = this._pickAndCommitFromPool(o, pool, rarity);
    // 重复时双倍碎片补偿（让花高额碎片买重复卡的玩家不至于太亏）
    if (result.isDuplicate) {
      const oldS2 = o.shards;
      const bonus = SHARD_PER_DUP[rarity];
      o.shards += bonus;
      result.shardGain += bonus;
      EventBus.emit('affinityCard:shardChanged', typeId, oldS2, o.shards);
    }

    EventBus.emit('affinityCard:dropped', typeId, [result]);
    if (!result.isDuplicate) {
      EventBus.emit('affinityCard:obtained', result.card.id, result.card, true);
      if (this.isComplete(typeId)) EventBus.emit('affinityCard:complete', typeId);
    }
    this._saveState();
    return result;
  }

  /**
   * 用碎片买 Bond 直升 1 等（仅 Lv1~4 可买）。
   * 返回是否成功。Bond 推进通过 EventBus 通知 AffinityManager 处理（弱耦合）。
   */
  redeemBondPush(typeId: string): boolean {
    const o = this._owners.get(typeId);
    if (!o || o.shards < SHARD_BOND_PUSH_COST) return false;
    const oldShards = o.shards;
    o.shards -= SHARD_BOND_PUSH_COST;
    EventBus.emit('affinityCard:shardChanged', typeId, oldShards, o.shards);
    EventBus.emit('affinityCard:requestBondPush', typeId);
    this._saveState();
    return true;
  }

  // ============================================================
  // 老存档迁移
  // ============================================================

  /**
   * 检测到本系统首次启用且老 Affinity 存档已存在时，按当前 Bond 等级回填若干 N/R/SR 卡。
   * 不补发任何奖励，仅让图鉴看起来不空。
   */
  private _maybeMigrateFromLegacyAffinity(): void {
    if (this._legacyMigrated) return;
    const legacyRaw = PersistService.readRaw(LEGACY_AFFINITY_KEY);
    if (!legacyRaw) {
      this._legacyMigrated = true;
      this._saveState();
      return;
    }
    let legacy: { entries?: Array<{ typeId: string; unlocked: boolean; bond: number }> };
    try {
      legacy = JSON.parse(legacyRaw);
    } catch {
      this._legacyMigrated = true;
      this._saveState();
      return;
    }
    const entries = legacy.entries ?? [];
    let touched = 0;
    for (const e of entries) {
      if (!e?.typeId || !e.unlocked) continue;
      const bond = Math.max(1, Math.min(5, Math.floor(e.bond))) as BondLevel;
      const quota = LEGACY_BOND_TO_CARDS[bond];
      if (!quota) continue;
      if (!hasCardsForOwner(e.typeId)) continue;
      const owner = this._owners.get(e.typeId) ?? this._defaultOwner(e.typeId);
      this._owners.set(e.typeId, owner);

      const grantInRarity = (rarity: CardRarity, n: number): void => {
        if (n <= 0) return;
        const pool = getCardsByOwnerAndRarity(e.typeId, rarity).filter(c => !owner.owned[c.id]);
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(n, shuffled.length); i++) {
          const c = shuffled[i]!;
          owner.owned[c.id] = { count: 1, firstObtainedAt: Date.now() };
          touched += 1;
        }
      };
      grantInRarity('N', quota.N);
      grantInRarity('R', quota.R);
      grantInRarity('SR', quota.SR);

      console.log(`[AffinityCardMigration] ${e.typeId} Bond${bond} → 已回填 N/R/SR=${quota.N}/${quota.R}/${quota.SR}`);
    }
    this._legacyMigrated = true;
    this._saveState();
    if (touched > 0) {
      console.log(`[AffinityCardMigration] 共回填 ${touched} 张卡（图鉴展示用，不补发奖励）`);
    }
  }

  // ============================================================
  // GM
  // ============================================================

  /** GM：直发指定卡（无视稀有度池逻辑，主要用于演示 SSR 翻牌动画） */
  gmGrantCard(cardId: string): void {
    const def = AFFINITY_CARD_MAP.get(cardId);
    if (!def) return;
    const o = this._owners.get(def.ownerTypeId) ?? this._defaultOwner(def.ownerTypeId);
    this._owners.set(def.ownerTypeId, o);
    const isDup = !!o.owned[cardId];
    if (isDup) {
      o.owned[cardId]!.count += 1;
      const shardGain = SHARD_PER_DUP[def.rarity];
      const oldShards = o.shards;
      o.shards += shardGain;
      EventBus.emit('affinityCard:shardChanged', def.ownerTypeId, oldShards, o.shards);
      const result: AffinityCardDropResult = { card: def, isDuplicate: true, shardGain, bondPoints: 0 };
      EventBus.emit('affinityCard:dropped', def.ownerTypeId, [result]);
    } else {
      o.owned[cardId] = { count: 1, firstObtainedAt: Date.now() };
      const result: AffinityCardDropResult = { card: def, isDuplicate: false, shardGain: 0, bondPoints: CARD_RARITY_POINTS[def.rarity] };
      EventBus.emit('affinityCard:dropped', def.ownerTypeId, [result]);
      EventBus.emit('affinityCard:obtained', cardId, def, true);
      if (this.isComplete(def.ownerTypeId)) EventBus.emit('affinityCard:complete', def.ownerTypeId);
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
    if (this.isComplete(typeId)) EventBus.emit('affinityCard:complete', typeId);
    this._saveState();
  }

  /** GM：模拟一次掉卡（不消耗订单） */
  gmSimulateDrop(typeId: string, isExclusive = false): void {
    if (!isAffinityCardSystemEnabled()) {
      console.warn('[AffinityCardManager] cardSystem flag 关闭中，gm 模拟掉卡不会发事件');
      return;
    }
    this.rollCardDrop(typeId, isExclusive);
  }

  /** GM：清空所有进度 */
  gmReset(): void {
    for (const id of this._owners.keys()) {
      this._owners.set(id, this._defaultOwner(id));
    }
    this._legacyMigrated = false;
    this._saveState();
  }

  // 便利：所有客人的总进度（首页徽章/小红点）
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

  /** 调试快照 */
  dump(): { owners: OwnerCardState[]; rarities: typeof CARD_RARITIES } {
    return {
      owners: Array.from(this._owners.values()).map(o => ({ ...o, owned: { ...o.owned } })),
      rarities: CARD_RARITIES,
    };
  }

  // 引用避免 unused
  static _BOND_THRESHOLDS_REF = BOND_THRESHOLDS;

  // ============================================================
  // 存档
  // ============================================================

  private _saveState(): void {
    try {
      const data: PersistState = {
        v: 1,
        owners: Array.from(this._owners.values()).map(o => ({
          typeId: o.typeId,
          owned: { ...o.owned },
          shards: o.shards,
          pityToSr: o.pityToSr,
          pityToSsr: o.pityToSsr,
        })),
        legacyMigrated: this._legacyMigrated,
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
      this._legacyMigrated = !!data?.legacyMigrated;
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
          this._owners.set(o.typeId, {
            typeId: o.typeId,
            owned,
            shards: Math.max(0, Math.floor(o.shards ?? 0)),
            pityToSr: Math.max(0, Math.floor(o.pityToSr ?? 0)),
            pityToSsr: Math.max(0, Math.floor(o.pityToSsr ?? 0)),
          });
        }
      }
    } catch (e) {
      console.warn('[AffinityCardManager] 读档失败:', e);
    }
  }
}

export const AffinityCardManager = new AffinityCardManagerClass();
