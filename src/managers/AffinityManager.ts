/**
 * 熟客系统管理器
 *
 * 职责：
 *  - 维护每位熟客的 unlocked 状态、Bond 累计点数 / 等级、近期留言/触发去重队列
 *  - 接收 LevelManager 的 level:up 事件 → 解锁该等级新熟客
 *  - 提供 onCustomerDelivered(typeId, isExclusive) 给 CustomerManager 调用，结算 Bond
 *  - 提供 rollExclusiveCustomer / preferLinesFor 给 CustomerManager._spawnCustomer 用
 *  - 提供 pickRandomAffinityNote() 给 IdleManager / DailyCandyManager 用
 *  - 存档 Key: huahua_affinity；CloudSync allowlist 同步注册
 *
 * 事件：
 *  - 'affinity:unlocked' (typeId, def)
 *  - 'affinity:gained'   (typeId, oldPoints, newPoints, def)
 *  - 'affinity:bondUp'   (typeId, oldBond, newBond, milestoneReward, def)
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { CurrencyManager } from './CurrencyManager';
import { DecorationManager } from './DecorationManager';
import { FlowerSignTicketManager } from './FlowerSignTicketManager';
import { grantQuest } from '@/utils/UnlockChecker';
import {
  AFFINITY_DEFS,
  AFFINITY_EXCLUSIVE_AVOID_RECENT,
  AFFINITY_EXCLUSIVE_PER_TYPE_COOLDOWN,
  AFFINITY_MAP,
  AFFINITY_NOTE_AVOID_RECENT_N,
  AFFINITY_UNLOCK_LEVELS,
  BOND_GAIN_EXCLUSIVE,
  BOND_GAIN_NORMAL,
  BOND_L5_SOFT_BUFF_MULT,
  BOND_THRESHOLDS,
  EXCLUSIVE_ORDER_BONUS,
  EXCLUSIVE_ORDER_HUAYUAN_MULTIPLIER,
  exclusiveOrderChanceByLevel,
  getBondLevelLabel,
  type AffinityCustomerDef,
  type AffinityFavoriteLine,
  type AffinityMilestoneReward,
  type BondLevel,
} from '@/config/AffinityConfig';
import { isAffinityCardSystemEnabled } from '@/config/AffinityFeatureFlags';
import { AffinityCardManager } from './AffinityCardManager';

const AFFINITY_STORAGE_KEY = 'huahua_affinity';

export interface AffinityEntryState {
  typeId: string;
  unlocked: boolean;
  /** 自解锁起累计 Bond 点 */
  points: number;
  /** 当前 Bond 等级（1~5） */
  bond: BondLevel;
  /** 已发放过的 Bond 升级里程碑（避免重复发奖） */
  claimedMilestones: BondLevel[];
}

interface AffinityPersistState {
  v: 1;
  entries: AffinityEntryState[];
  /** 最近 N 次留言抽签的 typeId，按时间倒序 */
  recentNoteTypeIds: string[];
  /** 最近若干次客人刷新中触发过专属订单的 typeId 队列（cooldown 用） */
  recentExclusiveTypeIds: string[];
}

class AffinityManagerClass {
  private _entries = new Map<string, AffinityEntryState>();
  private _recentNoteTypeIds: string[] = [];
  private _recentExclusiveTypeIds: string[] = [];
  private _initialized = false;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._loadState();
    this._ensureEntriesForCurrentLevel();
    this._bindEvents();
  }

  /** 当前累计点 → 落在哪个 bond 等级（按 BOND_THRESHOLDS） */
  private _bondLevelFromPoints(points: number): BondLevel {
    let lv: BondLevel = 1;
    if (points >= BOND_THRESHOLDS[5]) lv = 5;
    else if (points >= BOND_THRESHOLDS[4]) lv = 4;
    else if (points >= BOND_THRESHOLDS[3]) lv = 3;
    else if (points >= BOND_THRESHOLDS[2]) lv = 2;
    return lv;
  }

  /** 列出全部熟客（含未解锁）按解锁等级排序 */
  listAll(): { def: AffinityCustomerDef; state: AffinityEntryState }[] {
    const all = AFFINITY_DEFS.map(def => {
      const state = this._entries.get(def.typeId) ?? this._defaultEntry(def.typeId);
      return { def, state };
    });
    all.sort((a, b) => {
      const la = AFFINITY_UNLOCK_LEVELS[a.def.typeId] ?? 99;
      const lb = AFFINITY_UNLOCK_LEVELS[b.def.typeId] ?? 99;
      return la - lb;
    });
    return all;
  }

  /** 单个熟客：未注册或未解锁均返回默认（unlocked=false） */
  getState(typeId: string): AffinityEntryState {
    return this._entries.get(typeId) ?? this._defaultEntry(typeId);
  }

  /** 是否已解锁（用于 CustomerView heart badge / Profile 入口） */
  isUnlocked(typeId: string): boolean {
    return this.getState(typeId).unlocked;
  }

  /** 该 typeId 是否登记为熟客（即 AffinityConfig 里有定义） */
  isAffinityType(typeId: string): boolean {
    return AFFINITY_MAP.has(typeId);
  }

  /** 该 typeId 当前 Bond 等级（未解锁返回 1） */
  bondLevel(typeId: string): BondLevel {
    return this.getState(typeId).bond;
  }

  /** 全局 buff：Bond Lv5 时该熟客订单花愿 +10%（仅普通单使用） */
  huayuanMultFor(typeId: string): number {
    const s = this.getState(typeId);
    if (!s.unlocked) return 1;
    if (s.bond >= 5) return BOND_L5_SOFT_BUFF_MULT;
    return 1;
  }

  // ============================================================
  // 解锁
  // ============================================================

  /** LevelManager 在 level:up 后调用；首次解锁的熟客会 emit 'affinity:unlocked' */
  unlockForLevel(level: number): AffinityCustomerDef[] {
    const newly: AffinityCustomerDef[] = [];
    for (const def of AFFINITY_DEFS) {
      const target = AFFINITY_UNLOCK_LEVELS[def.typeId] ?? 999;
      if (target > level) continue;
      const cur = this._entries.get(def.typeId) ?? this._defaultEntry(def.typeId);
      if (cur.unlocked) continue;
      cur.unlocked = true;
      cur.bond = 1;
      cur.points = Math.max(cur.points, BOND_THRESHOLDS[1]);
      this._entries.set(def.typeId, cur);
      newly.push(def);
      EventBus.emit('affinity:unlocked', def.typeId, def);
      console.log(`[Affinity] 熟客解锁: ${def.typeId} (${def.bondName})`);
    }
    if (newly.length > 0) this._saveState();
    return newly;
  }

  // ============================================================
  // 交付：累计 Bond 点 + 升级里程碑触发
  // ============================================================

  onCustomerDelivered(typeId: string, opts: { isExclusive: boolean }): void {
    if (!this.isAffinityType(typeId)) return;
    const def = AFFINITY_MAP.get(typeId)!;
    const cur = this._entries.get(typeId) ?? this._defaultEntry(typeId);
    if (!cur.unlocked) return;

    const oldPoints = cur.points;
    const oldBond = cur.bond;

    // 卡片系统启用时：本次 Bond 点完全由 AffinityCardManager 决定
    //   - 正常订单：base 35% 概率掉一张卡 → 该卡稀有度对应 1/3/8/25 点
    //   - 专属订单：85% 必出，且稀有度 +1 档；30% 概率第二张
    //   - 重复卡 → 友谊点（碎片），不直接给 Bond
    // 卡片系统未启用：沿用 +1/+2 兼容路径
    let gain: number;
    if (isAffinityCardSystemEnabled()) {
      const drop = AffinityCardManager.rollCardDrop(typeId, opts.isExclusive);
      gain = drop.addedBondPoints;
    } else {
      gain = opts.isExclusive ? BOND_GAIN_EXCLUSIVE : BOND_GAIN_NORMAL;
    }
    cur.points = oldPoints + gain;
    cur.bond = this._bondLevelFromPoints(cur.points);
    this._entries.set(typeId, cur);

    EventBus.emit('affinity:gained', typeId, oldPoints, cur.points, def);

    if (cur.bond > oldBond) {
      // 可能跨多级（GM 一次性加点）；按从低到高发奖
      for (let lv = (oldBond + 1) as BondLevel; lv <= cur.bond; lv = (lv + 1) as BondLevel) {
        if (cur.claimedMilestones.includes(lv as BondLevel)) continue;
        const reward = def.milestones[lv as BondLevel];
        cur.claimedMilestones.push(lv as BondLevel);
        this._grantMilestoneReward(reward, typeId);
        EventBus.emit('affinity:bondUp', typeId, oldBond, lv, reward, def);
        console.log(
          `[Affinity] ${def.bondName} Bond ${oldBond}→${lv}（${getBondLevelLabel(lv as BondLevel)}）`,
        );
      }
    }

    // 专属单 cooldown 队列推进
    if (opts.isExclusive) {
      this._recentExclusiveTypeIds.unshift(typeId);
      if (this._recentExclusiveTypeIds.length > AFFINITY_EXCLUSIVE_PER_TYPE_COOLDOWN) {
        this._recentExclusiveTypeIds.length = AFFINITY_EXCLUSIVE_PER_TYPE_COOLDOWN;
      }
    }

    this._saveState();
  }

  private _grantMilestoneReward(r: AffinityMilestoneReward, typeId: string): void {
    if (r.huayuan) CurrencyManager.addHuayuan(r.huayuan);
    if (r.diamond) CurrencyManager.addDiamond(r.diamond);
    if (r.stamina) CurrencyManager.addStamina(r.stamina);
    if (r.flowerSignTickets) FlowerSignTicketManager.add(r.flowerSignTickets);
    // 熟客主题家具（Bond Lv4）：放行对应 questId 让 DecorationPanel 把锁态换掉，
    // 并直接调 gmUnlockDeco 落库；后续玩家在装修面板摆上即可。
    if (r.decoUnlockId) {
      grantQuest(`affinity_${typeId}_bond4`);
      DecorationManager.gmUnlockDeco(r.decoUnlockId);
    }
  }

  // ============================================================
  // 专属订单：spawn 阶段调用
  // ============================================================

  /**
   * 在 _spawnCustomer 开头掷骰；返回当前要刷出的「熟客 typeId + 软偏好 lines」。
   * 没有命中或没有可用熟客返回 null（继续走默认随机刷客）。
   *
   * 规则：
   *  - 概率按 exclusiveOrderChanceByLevel(playerLevel)
   *  - 仅从「已解锁 + 不在 cooldown 队列」中挑
   *  - 若 lastSpawnTypeId 与候选只剩 1 个相同，避免连人
   */
  rollExclusiveCustomer(opts: {
    playerLevel: number;
    lastSpawnTypeId: string | null;
    rng?: () => number;
  }): { typeId: string; preferLines: AffinityFavoriteLine[] } | null {
    const rng = opts.rng ?? Math.random;
    const baseChance = exclusiveOrderChanceByLevel(opts.playerLevel);
    if (rng() >= baseChance) return null;

    const unlocked = AFFINITY_DEFS
      .map(d => this._entries.get(d.typeId))
      .filter((s): s is AffinityEntryState => !!s && s.unlocked);
    if (unlocked.length === 0) return null;

    let candidates = unlocked.filter(
      s => !this._recentExclusiveTypeIds.includes(s.typeId),
    );
    if (candidates.length === 0) candidates = unlocked;

    if (
      AFFINITY_EXCLUSIVE_AVOID_RECENT &&
      opts.lastSpawnTypeId &&
      candidates.length > 1
    ) {
      const filtered = candidates.filter(s => s.typeId !== opts.lastSpawnTypeId);
      if (filtered.length > 0) candidates = filtered;
    }

    const pick = candidates[Math.floor(rng() * candidates.length)]!;
    const def = AFFINITY_MAP.get(pick.typeId)!;
    return { typeId: pick.typeId, preferLines: def.favoriteLines };
  }

  // ============================================================
  // 离线 / 关店糖果：随机留言
  // ============================================================

  /**
   * 抽一条已解锁熟客的离线留言；规则：
   *  - 优先从「不在最近 N 次留言队列」的熟客里抽
   *  - 其余按 Bond 等级加权随机（Bond 越高权重越大）
   *  - 没有任何已解锁熟客时返回 null
   */
  pickRandomAffinityNote(rng: () => number = Math.random): {
    typeId: string;
    bondName: string;
    bondLevel: BondLevel;
    bondLabel: string;
    text: string;
  } | null {
    const unlocked = this.listAll().filter(x => x.state.unlocked);
    if (unlocked.length === 0) return null;

    const fresh = unlocked.filter(x => !this._recentNoteTypeIds.includes(x.def.typeId));
    const pool = fresh.length > 0 ? fresh : unlocked;

    const totalW = pool.reduce((s, x) => s + Math.max(1, x.state.bond), 0);
    let r = rng() * totalW;
    let chosen = pool[0]!;
    for (const x of pool) {
      r -= Math.max(1, x.state.bond);
      if (r <= 0) {
        chosen = x;
        break;
      }
    }

    const note = chosen.def.notes[Math.floor(rng() * chosen.def.notes.length)] ?? '';
    const bondLabel = getBondLevelLabel(chosen.state.bond);
    const text = note.replace('{name}', chosen.def.bondName).replace('{bondLabel}', bondLabel);

    // 推进近期留言队列
    this._recentNoteTypeIds.unshift(chosen.def.typeId);
    if (this._recentNoteTypeIds.length > AFFINITY_NOTE_AVOID_RECENT_N) {
      this._recentNoteTypeIds.length = AFFINITY_NOTE_AVOID_RECENT_N;
    }
    this._saveState();

    return {
      typeId: chosen.def.typeId,
      bondName: chosen.def.bondName,
      bondLevel: chosen.state.bond,
      bondLabel,
      text,
    };
  }

  /** GM 用：直接加 Bond 点（自动跑升级 + 发奖） */
  gmAddBondPoints(typeId: string, points: number): void {
    if (!this.isAffinityType(typeId)) return;
    const cur = this._entries.get(typeId) ?? this._defaultEntry(typeId);
    if (!cur.unlocked) {
      cur.unlocked = true;
    }
    this._entries.set(typeId, cur);
    // 复用 onCustomerDelivered 的升级路径：拆成 normal 单 +1 多次
    let remaining = points;
    while (remaining > 0) {
      this.onCustomerDelivered(typeId, { isExclusive: false });
      remaining--;
    }
  }

  /** GM 用：清空所有进度（保留解锁信息） */
  gmReset(): void {
    for (const e of this._entries.values()) {
      e.points = e.unlocked ? BOND_THRESHOLDS[1] : 0;
      e.bond = e.unlocked ? 1 : 1;
      e.claimedMilestones = [];
    }
    this._recentNoteTypeIds = [];
    this._recentExclusiveTypeIds = [];
    this._saveState();
  }

  // ============================================================
  // 私有：默认条目 / 当前等级补齐 / 事件 / 持久化
  // ============================================================

  private _defaultEntry(typeId: string): AffinityEntryState {
    return {
      typeId,
      unlocked: false,
      points: 0,
      bond: 1,
      claimedMilestones: [],
    };
  }

  private _ensureEntriesForCurrentLevel(): void {
    const lv = CurrencyManager.globalLevel;
    for (const def of AFFINITY_DEFS) {
      if (!this._entries.has(def.typeId)) {
        this._entries.set(def.typeId, this._defaultEntry(def.typeId));
      }
      const target = AFFINITY_UNLOCK_LEVELS[def.typeId] ?? 999;
      if (target <= lv) {
        const e = this._entries.get(def.typeId)!;
        if (!e.unlocked) {
          e.unlocked = true;
          e.bond = 1;
          e.points = Math.max(e.points, BOND_THRESHOLDS[1]);
          // 仅静默补齐，不弹「解锁」事件（避免读档时叠弹窗）
        }
      }
    }
  }

  private _bindEvents(): void {
    EventBus.on('star:levelUp', (newLevel: number) => {
      this.unlockForLevel(newLevel);
    });
  }

  // ====== 存档 ======

  private _saveState(): void {
    try {
      const data: AffinityPersistState = {
        v: 1,
        entries: Array.from(this._entries.values()).map(e => ({
          typeId: e.typeId,
          unlocked: e.unlocked,
          points: e.points,
          bond: e.bond,
          claimedMilestones: [...e.claimedMilestones],
        })),
        recentNoteTypeIds: [...this._recentNoteTypeIds],
        recentExclusiveTypeIds: [...this._recentExclusiveTypeIds],
      };
      PersistService.writeRaw(AFFINITY_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[Affinity] 存档失败:', e);
    }
  }

  private _loadState(): void {
    try {
      const raw = PersistService.readRaw(AFFINITY_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<AffinityPersistState>;
      if (Array.isArray(data?.entries)) {
        for (const e of data.entries) {
          if (!e || typeof e.typeId !== 'string') continue;
          const def = AFFINITY_MAP.get(e.typeId);
          if (!def) continue;
          const points = typeof e.points === 'number' && Number.isFinite(e.points) ? Math.max(0, Math.floor(e.points)) : 0;
          const bond = (typeof e.bond === 'number' ? Math.max(1, Math.min(5, Math.floor(e.bond))) : 1) as BondLevel;
          const claimed = Array.isArray(e.claimedMilestones)
            ? e.claimedMilestones.filter(
                (n): n is BondLevel =>
                  typeof n === 'number' && n >= 1 && n <= 5,
              )
            : [];
          this._entries.set(e.typeId, {
            typeId: e.typeId,
            unlocked: !!e.unlocked,
            points,
            bond,
            claimedMilestones: claimed,
          });
        }
      }
      if (Array.isArray(data?.recentNoteTypeIds)) {
        this._recentNoteTypeIds = data.recentNoteTypeIds.filter(
          (s): s is string => typeof s === 'string',
        );
      }
      if (Array.isArray(data?.recentExclusiveTypeIds)) {
        this._recentExclusiveTypeIds = data.recentExclusiveTypeIds.filter(
          (s): s is string => typeof s === 'string',
        );
      }
    } catch (e) {
      console.warn('[Affinity] 读档失败:', e);
    }
  }
}

export const AffinityManager = new AffinityManagerClass();
