/**
 * 成长之路（新手成长任务）运行时。
 *
 * 章节串行、章内并行：只有「当前章」的任务可推进与领奖；领完当前章大奖后才开启下一章。
 * 进度求值分两种（见 `GrowthQuestConfig.GROWTH_METRIC_MODE`）：
 * - 快照型直接读各 Manager 当前状态，天然可追溯，老存档装上即显示已完成；
 * - 累计型靠 EventBus 累加，另在首次初始化时从 `huahua_merge_stats` 补种历史值（见 `_seedLegacyCounters`）。
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import {
  GROWTH_CHAPTERS,
  GrowthMetric,
  getGrowthChapter,
  getGrowthChapterOfTask,
  getGrowthTask,
  growthChapterIndex,
  isCounterMetric,
  type GrowthChapterDef,
  type GrowthReward,
  type GrowthTaskDef,
} from '@/config/GrowthQuestConfig';
import { AFFINITY_CARDS } from '@/config/AffinityCardConfig';
import { Category, FlowerLine, ITEM_DEFS } from '@/config/ItemConfig';
import { MAP_NODES } from '@/config/WorldMapConfig';
import { AffinityCardManager } from './AffinityCardManager';
import { CollectionCategory, CollectionManager } from './CollectionManager';
import { CurrencyManager } from './CurrencyManager';
import { DecorationManager } from './DecorationManager';
import { DressUpManager } from './DressUpManager';
import { FlowerSignTicketManager } from './FlowerSignTicketManager';
import { FurnitureWorkshopManager } from './FurnitureWorkshopManager';
import { RewardBoxManager } from './RewardBoxManager';
import { RoomLayoutManager } from './RoomLayoutManager';
import { SaveManager } from './SaveManager';

const GROWTH_STORAGE_KEY = 'huahua_growth';
const SAVE_VERSION = 1;

/** 历史累计数据来源：`MergeStatsSystem` 的存档 key（只读，用于给累计型指标补种） */
const MERGE_STATS_STORAGE_KEY = 'huahua_merge_stats';

interface GrowthSaveData {
  version: number;
  counters: Record<string, number>;
  claimedTasks: string[];
  claimedChapters: string[];
  announcedChapters: string[];
  legacySeeded: boolean;
}

/** 面板与挂件渲染用的一条任务视图 */
export interface GrowthTaskView {
  def: GrowthTaskDef;
  current: number;
  target: number;
  claimed: boolean;
  /** 进度已达标（不代表已领取） */
  completed: boolean;
  /** 可领取：达标且未领 */
  claimable: boolean;
  /** 被 requireLevel 锁住：不计进度，显示「N 星后开启」 */
  lockedByLevel: boolean;
}

export interface GrowthChapterView {
  def: GrowthChapterDef;
  index: number;
  tasks: GrowthTaskView[];
  /** 本章已领取任务数（章节大奖以此判定，避免「达标但没领」就跳章） */
  claimedCount: number;
  /**
   * 本章已达标任务数（含已领取的），**进度条与 N/M 文案用这个**。
   *
   * 不能用 `claimedCount` 显示：快照型指标可追溯，老玩家装上本系统时 6 条任务往往已全部达标，
   * 若按「已领取」渲染会显示 0/6 空进度条，看起来像一点没做。
   */
  completedCount: number;
  totalCount: number;
  chapterRewardClaimed: boolean;
  chapterRewardClaimable: boolean;
}

class GrowthQuestManagerClass {
  private _counters = new Map<GrowthMetric, number>();
  private _claimedTasks = new Set<string>();
  private _claimedChapters = new Set<string>();
  private _announcedChapters = new Set<string>();
  private _legacySeeded = false;
  private _initialized = false;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._loadState();
    if (!this._legacySeeded) {
      this._seedLegacyCounters();
      this._legacySeeded = true;
      this._save();
    }
    this._bindEvents();
    // 图纸等幂等奖励可能因云档覆盖 / 发放失败而丢；启动时按「已领取」补齐
    this.reconcileClaimedRewards('init');
  }

  /** 云端下行覆盖本地成长档后，重载内存态并补齐幂等奖励 */
  reloadFromStorage(reason = 'manual'): void {
    this._counters.clear();
    this._claimedTasks.clear();
    this._claimedChapters.clear();
    this._announcedChapters.clear();
    this._legacySeeded = false;
    this._loadState();
    this.reconcileClaimedRewards(`reload:${reason}`);
    EventBus.emit('growth:updated');
  }

  /**
   * 按已领取任务/章节补发**幂等**奖励（目前仅工坊图纸）。
   *
   * 锤子/染料/货币不可补（会叠发）；图纸 `grantBlueprint` 已拥有则跳过。
   * 典型场景：领奖时图纸写进内存并在工坊可见，随后云端旧工坊档覆盖本地，重启后图纸消失。
   */
  reconcileClaimedRewards(reason = 'manual'): boolean {
    // 云端下行可能早于 MainScene 里的 init；未初始化时先读档，init 再跑一次也安全（图纸发放幂等）
    if (!this._initialized) this._loadState();

    let granted = 0;
    const tryGrant = (blueprintId: string | undefined, where: string): void => {
      if (!blueprintId) return;
      if (FurnitureWorkshopManager.hasBlueprint(blueprintId)) return;
      if (FurnitureWorkshopManager.grantBlueprint(blueprintId)) {
        granted++;
        console.log(`[Growth] 补发图纸 ${blueprintId}（${where}） reason=${reason}`);
      } else {
        console.warn(`[Growth] 补发图纸失败 ${blueprintId}（${where}） reason=${reason}`);
      }
    };

    for (const taskId of this._claimedTasks) {
      const def = getGrowthTask(taskId);
      tryGrant(def?.reward.blueprintId, `任务 ${taskId}`);
    }
    for (const chapterId of this._claimedChapters) {
      const def = getGrowthChapter(chapterId);
      tryGrant(def?.chapterReward.blueprintId, `章节大奖 ${chapterId}`);
    }
    return granted > 0;
  }

  // ═══════════════ 累计型指标 ═══════════════

  private _bindEvents(): void {
    EventBus.on('board:merged', () => this._bump(GrowthMetric.MergeCount, 1));
    EventBus.on('customer:delivered', () => this._bump(GrowthMetric.DeliverCount, 1));
    EventBus.on('flowerSign:drawn', (count: number) => {
      this._bump(GrowthMetric.FountainDrawCount, Math.max(1, count | 0));
    });
    EventBus.on('quest:dailyAllCompleteBonusClaimed', () => {
      this._bump(GrowthMetric.DailyAllCompleteCount, 1);
    });

    /**
     * 快照型指标没有自己的计数器，但面板/挂件需要在状态变化时刷新，
     * 所以这些事件只用来广播一次 `growth:updated`，不写存档。
     */
    const snapshotTriggers = [
      'star:levelUp',
      'decoration:unlocked',
      'decoration:reloaded',
      'roomlayout:changed',
      'roomlayout:added',
      'roomlayout:removed',
      'collection:discovered',
      'affinityCard:dropped',
      'furnitureWorkshop:crafted',
      'dressup:unlocked',
      'house:purchased',
    ];
    for (const evt of snapshotTriggers) {
      EventBus.on(evt, () => EventBus.emit('growth:updated'));
    }
  }

  private _bump(metric: GrowthMetric, delta: number): void {
    if (delta <= 0) return;
    this._counters.set(metric, (this._counters.get(metric) ?? 0) + delta);
    this._save();
    EventBus.emit('growth:updated');
  }

  /**
   * 老存档补偿：`MergeStatsSystem` 早就在记「累计合成 / 累计订单」，
   * 直接把它的终身值搬过来，老玩家装上本系统后第 1、2、4 章的合成/订单任务能立刻显示完成，
   * 而不是从 0 重新刷。只在首次初始化执行一次（`legacySeeded`）。
   *
   * 这里直连存档 key 而不是引用 `MergeStatsSystem`：后者是挂在 PIXI 容器上的 UI 系统、
   * 需要 parent 才能构造，管理器层拿不到实例。
   */
  private _seedLegacyCounters(): void {
    try {
      const raw = PersistService.readRaw(MERGE_STATS_STORAGE_KEY);
      if (!raw) return;
      const stats = JSON.parse(raw) as { totalMerges?: number; totalOrders?: number };
      const merges = Math.max(0, (stats.totalMerges ?? 0) | 0);
      const orders = Math.max(0, (stats.totalOrders ?? 0) | 0);
      if (merges > 0) this._counters.set(GrowthMetric.MergeCount, merges);
      if (orders > 0) this._counters.set(GrowthMetric.DeliverCount, orders);
      console.log(`[Growth] 老存档补偿: 合成 ${merges} 次, 订单 ${orders} 单`);
    } catch (_) {}
  }

  // ═══════════════ 快照型指标 ═══════════════

  /** 图鉴已发现的「鲜花线」种类数；花束/绿植/包装线不计入 */
  private _freshFlowerKinds(): number {
    let n = 0;
    for (const id of CollectionManager.getDiscoveredIds(CollectionCategory.FLOWER)) {
      const def = ITEM_DEFS.get(id);
      if (def?.category === Category.FLOWER && def.line === FlowerLine.FRESH) n++;
    }
    return n;
  }

  /** 友谊卡持有总张数（含重复张） */
  private _affinityCardTotal(): number {
    let n = 0;
    for (const card of AFFINITY_CARDS) n += AffinityCardManager.countOf(card.id);
    return n;
  }

  /**
   * 已解锁房屋数：达到 unlockLevel 且（若是支线购买房）已购买。
   * 判定与 `WorldMapPanel` 的节点可进入逻辑保持一致。
   */
  private _unlockedHouseCount(): number {
    const level = CurrencyManager.globalLevel;
    let n = 0;
    for (const node of MAP_NODES) {
      if (node.type !== 'house' && node.type !== 'current_house') continue;
      if (level < node.unlockLevel) continue;
      if (node.purchaseCost && node.targetSceneId && !CurrencyManager.isHousePurchased(node.targetSceneId)) {
        continue;
      }
      n++;
    }
    return n;
  }

  private _progressOf(def: GrowthTaskDef): number {
    switch (def.metric) {
      case GrowthMetric.Level:
        return CurrencyManager.globalLevel;
      case GrowthMetric.DecoOwned:
        return DecorationManager.unlockedCount;
      case GrowthMetric.DecoPlaced:
        return RoomLayoutManager.totalPlacedCountAllScenes;
      case GrowthMetric.FlowerKinds:
        return this._freshFlowerKinds();
      case GrowthMetric.AffinityCards:
        return this._affinityCardTotal();
      case GrowthMetric.WorkshopCrafted:
        return FurnitureWorkshopManager.craftedVariantCount;
      case GrowthMetric.OutfitOwned:
        return DressUpManager.unlockedCount;
      case GrowthMetric.HouseUnlocked:
        return this._unlockedHouseCount();
      case GrowthMetric.ItemDiscovered:
        return def.targetItemId
          && CollectionManager.isDiscovered(CollectionCategory.FLOWER, def.targetItemId) ? 1 : 0;
      default:
        return this._counters.get(def.metric) ?? 0;
    }
  }

  // ═══════════════ 视图 ═══════════════

  /**
   * 当前章 = 第一个「章节大奖未领」的章节；全部领完返回 null（面板显示全通关）。
   */
  get currentChapter(): GrowthChapterDef | null {
    for (const c of GROWTH_CHAPTERS) {
      if (!this._claimedChapters.has(c.id)) return c;
    }
    return null;
  }

  get allChaptersComplete(): boolean {
    return this.currentChapter === null;
  }

  /** 章节是否已开启（前面所有章节大奖都已领） */
  isChapterUnlocked(chapterId: string): boolean {
    const idx = growthChapterIndex(chapterId);
    if (idx < 0) return false;
    for (let i = 0; i < idx; i++) {
      if (!this._claimedChapters.has(GROWTH_CHAPTERS[i].id)) return false;
    }
    return true;
  }

  private _taskView(def: GrowthTaskDef): GrowthTaskView {
    const lockedByLevel = def.requireLevel !== undefined
      && CurrencyManager.globalLevel < def.requireLevel;
    const claimed = this._claimedTasks.has(def.id);
    const current = Math.min(this._progressOf(def), def.target);
    const completed = !lockedByLevel && current >= def.target;
    return {
      def,
      current,
      target: def.target,
      claimed,
      completed,
      claimable: completed && !claimed,
      lockedByLevel,
    };
  }

  getChapterView(chapterId: string): GrowthChapterView | null {
    const def = getGrowthChapter(chapterId);
    if (!def) return null;
    const tasks = def.tasks.map(t => this._taskView(t));
    const claimedCount = tasks.filter(t => t.claimed).length;
    /**
     * 已领取的一律计入，否则进度条会倒退：快照型指标可回落（比如领完「摆放 8 件家具」
     * 又把家具收走），此时 completed 会变回 false，但奖励已经拿了。
     */
    const completedCount = tasks.filter(t => t.completed || t.claimed).length;
    const chapterRewardClaimed = this._claimedChapters.has(def.id);
    return {
      def,
      index: growthChapterIndex(def.id),
      tasks,
      claimedCount,
      completedCount,
      totalCount: tasks.length,
      chapterRewardClaimed,
      chapterRewardClaimable:
        !chapterRewardClaimed && claimedCount >= tasks.length && this.isChapterUnlocked(def.id),
    };
  }

  /** 当前章视图；已全通关返回最后一章（面板据此显示全通关态） */
  getCurrentChapterView(): GrowthChapterView | null {
    const chapter = this.currentChapter ?? GROWTH_CHAPTERS[GROWTH_CHAPTERS.length - 1];
    return chapter ? this.getChapterView(chapter.id) : null;
  }

  /**
   * 挂件显示的「当前目标」：优先可领奖的，其次未锁且进度最靠前的。
   * 都没有则返回 null（挂件隐藏）。
   */
  getFeaturedTask(): GrowthTaskView | null {
    const view = this.currentChapter ? this.getChapterView(this.currentChapter.id) : null;
    if (!view) return null;

    const claimable = view.tasks.find(t => t.claimable);
    if (claimable) return claimable;

    const pending = view.tasks.filter(t => !t.claimed && !t.lockedByLevel);
    if (pending.length === 0) return null;

    // 进度百分比最高的那条最容易先完成，引导性最好
    return pending.reduce((best, t) =>
      t.current / t.target > best.current / best.target ? t : best,
    );
  }

  /** 顶栏 / 挂件红点 */
  hasClaimable(): boolean {
    const chapter = this.currentChapter;
    if (!chapter) return false;
    const view = this.getChapterView(chapter.id);
    if (!view) return false;
    return view.chapterRewardClaimable || view.tasks.some(t => t.claimable);
  }

  /** 「新章节开启」提示只弹一次；返回本次是否需要弹 */
  consumeChapterAnnouncement(): GrowthChapterDef | null {
    const chapter = this.currentChapter;
    if (!chapter || this._announcedChapters.has(chapter.id)) return null;
    if (!this.isChapterUnlocked(chapter.id)) return null;
    this._announcedChapters.add(chapter.id);
    this._save();
    return chapter;
  }

  // ═══════════════ 发奖 ═══════════════

  private _applyReward(r: GrowthReward): void {
    if (r.huayuan) CurrencyManager.addHuayuan(r.huayuan);
    if (r.stamina) CurrencyManager.addStamina(r.stamina);
    if (r.diamond) CurrencyManager.addDiamond(r.diamond);
    if (r.flowerSignTickets && r.flowerSignTickets > 0) {
      FlowerSignTicketManager.add(r.flowerSignTickets);
    }
    for (const { itemId, count } of r.items ?? []) {
      if (ITEM_DEFS.has(itemId)) RewardBoxManager.addItem(itemId, count);
    }
    for (const { materialId, count } of r.workshopMaterials ?? []) {
      FurnitureWorkshopManager.addMaterial(materialId, count);
    }
    if (r.blueprintId) {
      const ok = FurnitureWorkshopManager.grantBlueprint(r.blueprintId);
      if (!ok && !FurnitureWorkshopManager.hasBlueprint(r.blueprintId)) {
        // 已拥有会返回 false，那是正常；配置缺 id / 发放失败才告警，便于排查「领了却没图纸」
        console.warn(`[Growth] 发放图纸失败: ${r.blueprintId}`);
      }
    }
  }

  /** 领取单条任务奖励；返回实际发放的奖励（用于飞入动效），未达标/已领返回 null */
  claimTask(taskId: string): GrowthReward | null {
    const def = getGrowthTask(taskId);
    const chapter = getGrowthChapterOfTask(taskId);
    if (!def || !chapter) return null;
    if (!this.isChapterUnlocked(chapter.id)) return null;
    if (this._claimedTasks.has(taskId)) return null;

    const view = this._taskView(def);
    if (!view.completed) return null;

    this._claimedTasks.add(taskId);
    this._applyReward(def.reward);
    this._save();
    SaveManager.save();
    EventBus.emit('growth:taskClaimed', taskId);
    EventBus.emit('growth:updated');
    return def.reward;
  }

  /** 领取章节大奖（需本章全部任务已领）；成功返回奖励 */
  claimChapterReward(chapterId: string): GrowthReward | null {
    const view = this.getChapterView(chapterId);
    if (!view || !view.chapterRewardClaimable) return null;

    this._claimedChapters.add(chapterId);
    this._applyReward(view.def.chapterReward);
    this._save();
    SaveManager.save();
    EventBus.emit('growth:chapterClaimed', chapterId);
    EventBus.emit('growth:updated');
    return view.def.chapterReward;
  }

  /**
   * 一键领取当前章所有可领任务，若因此凑满 6/6 则连章节大奖一起领。
   * 单次存档，返回本次发放的奖励列表用于合并飞入动效。
   */
  claimAllPending(): GrowthReward[] {
    const chapter = this.currentChapter;
    if (!chapter) return [];

    const granted: GrowthReward[] = [];
    const view = this.getChapterView(chapter.id);
    if (!view) return [];

    for (const t of view.tasks) {
      if (!t.claimable) continue;
      this._claimedTasks.add(t.def.id);
      this._applyReward(t.def.reward);
      granted.push(t.def.reward);
      EventBus.emit('growth:taskClaimed', t.def.id);
    }

    const after = this.getChapterView(chapter.id);
    if (after?.chapterRewardClaimable) {
      this._claimedChapters.add(chapter.id);
      this._applyReward(after.def.chapterReward);
      granted.push(after.def.chapterReward);
      EventBus.emit('growth:chapterClaimed', chapter.id);
    }

    if (granted.length === 0) return [];
    this._save();
    SaveManager.save();
    EventBus.emit('growth:updated');
    return granted;
  }

  // ═══════════════ 存档 ═══════════════

  private _save(): void {
    const counters: Record<string, number> = {};
    for (const [metric, n] of this._counters) counters[metric] = n;
    const data: GrowthSaveData = {
      version: SAVE_VERSION,
      counters,
      claimedTasks: [...this._claimedTasks],
      claimedChapters: [...this._claimedChapters],
      announcedChapters: [...this._announcedChapters],
      legacySeeded: this._legacySeeded,
    };
    try {
      PersistService.writeRaw(GROWTH_STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  private _loadState(): void {
    try {
      const raw = PersistService.readRaw(GROWTH_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<GrowthSaveData>;
      if ((data.version ?? 0) !== SAVE_VERSION) return;

      for (const [key, value] of Object.entries(data.counters ?? {})) {
        if (isCounterMetric(key as GrowthMetric)) {
          this._counters.set(key as GrowthMetric, Math.max(0, value | 0));
        }
      }
      // 过滤掉配置里已删掉的 id，避免改表后残留脏数据顶住章节完成判定
      this._claimedTasks = new Set((data.claimedTasks ?? []).filter(id => !!getGrowthTask(id)));
      this._claimedChapters = new Set((data.claimedChapters ?? []).filter(id => !!getGrowthChapter(id)));
      this._announcedChapters = new Set((data.announcedChapters ?? []).filter(id => !!getGrowthChapter(id)));
      this._legacySeeded = !!data.legacySeeded;
    } catch (e) {
      console.warn('[Growth] 读档失败，按新号处理', e);
    }
  }

  /** GM / 清档：重置全部成长进度 */
  reset(): void {
    this._counters.clear();
    this._claimedTasks.clear();
    this._claimedChapters.clear();
    this._announcedChapters.clear();
    this._legacySeeded = false;
    try {
      PersistService.remove(GROWTH_STORAGE_KEY);
    } catch (_) {}
    EventBus.emit('growth:updated');
  }

  /** GM 调试：直接把某条任务的累计型进度推到达标 */
  debugFillTask(taskId: string): boolean {
    const def = getGrowthTask(taskId);
    if (!def || !isCounterMetric(def.metric)) return false;
    this._counters.set(def.metric, def.target);
    this._save();
    EventBus.emit('growth:updated');
    return true;
  }

  /** GM 调试：跳到指定章（把前面所有章节标记为已领） */
  debugJumpToChapter(chapterId: string): boolean {
    const idx = growthChapterIndex(chapterId);
    if (idx < 0) return false;
    for (let i = 0; i < idx; i++) {
      const c = GROWTH_CHAPTERS[i];
      for (const t of c.tasks) this._claimedTasks.add(t.id);
      this._claimedChapters.add(c.id);
    }
    this._save();
    EventBus.emit('growth:updated');
    return true;
  }

  dump(): GrowthSaveData {
    const counters: Record<string, number> = {};
    for (const [metric, n] of this._counters) counters[metric] = n;
    return {
      version: SAVE_VERSION,
      counters,
      claimedTasks: [...this._claimedTasks],
      claimedChapters: [...this._claimedChapters],
      announcedChapters: [...this._announcedChapters],
      legacySeeded: this._legacySeeded,
    };
  }
}

export const GrowthQuestManager = new GrowthQuestManagerClass();
