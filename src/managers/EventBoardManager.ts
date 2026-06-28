import { EventBus } from '@/core/EventBus';
import { CellState } from '@/config/BoardLayout';
import {
  Category,
  EventLine,
  ITEM_DEFS,
  getMergeResultId,
  isEventProducerItem,
  LUCKY_COIN_ITEM_ID,
} from '@/config/ItemConfig';
import {
  EVENT_BOARD_COLS,
  EVENT_BOARD_STAGES,
  EVENT_CODEX_ITEM_IDS,
  getStageRows,
  getStageTotal,
  EVENT_DISCOVERY_REWARDS,
  EVENT_PROGRESS_ECHO_MILESTONES,
  EVENT_MERGE_BYPRODUCT_BASE_CHANCE,
  EVENT_MERGE_BYPRODUCT_MAX_CHANCE,
  EVENT_MERGE_BYPRODUCT_PER_LEVEL,
  EVENT_MERGE_BYPRODUCT_TABLE,
  EVENT_MERGE_DROP_BASE_CHANCE,
  EVENT_MERGE_DROP_MAX_CHANCE,
  EVENT_MERGE_DROP_PER_LEVEL,
  EVENT_MERGE_DROP_TABLE,
  EVENT_PRODUCER_DROP_TABLE,
  EVENT_PRODUCER_TOTAL_DROPS,
  EVENT_ORDER_BOX_CHANCE,
  EVENT_ORDER_BOX_DAILY_GUARANTEE,
  EVENT_ORDER_BOX_DAILY_LIMIT,
  EVENT_STARTER_STONE_LEVEL2_CHANCE,
  EVENT_STARTER_STONE_LEVEL3_CHANCE,
  JEWELRY_EVENT_NAME,
  DIAN_CUI_ITEM_PREFIX,
  JEWELRY_ITEM_PREFIX,
  isJewelryEventUnlocked,
  type EventDropEntry,
  type EventProgressEchoMilestoneDef,
  type EventRewardDef,
} from '@/config/EventBoardConfig';
import { CurrencyManager } from './CurrencyManager';
import { FlowerSignTicketManager } from './FlowerSignTicketManager';
import { LevelManager } from './LevelManager';
import { RewardBoxManager } from './RewardBoxManager';
import { isChestItem, rollChestBoardDrops } from './BuildingManager';
import { DECO_DEFS } from '@/config/DecorationConfig';
import { DecorationManager } from './DecorationManager';
import { DressUpManager } from './DressUpManager';
import { grantQuest } from '@/utils/UnlockChecker';

export interface EventBoardCellData {
  index: number;
  state: CellState.OPEN | CellState.PEEK | CellState.FOG;
  itemId: string | null;
  /** 容器（宝箱/红包/钻石袋/体力箱）待散落到棋盘的物品队列；未开箱为 undefined */
  chestQueue?: string[];
  /** 容器开箱时掷出的总件数（进度用） */
  chestTotal?: number;
  /** 「时空门」棋子：独占该格，不参与合成/放石/掉落；集齐钥匙后点击进入下一层 */
  isPortal?: boolean;
}

export interface EventBoardPersistState {
  cells: EventBoardCellData[];
  stageIndex: number;
  keys: number;
  /** 活动底部库存：订单获得的原石数量。 */
  pendingStarterStones: number;
  discoveredItemIds: string[];
  claimedDiscoveryRewardItemIds?: string[];
  completedStageIds: string[];
  dailyKey: string;
  dailyOrderDeliveries: number;
  dailyStarterStones: number;
  dailyDropCounts: Record<string, number>;
  claimedCodexRewardIds?: string[];
  progressEchoMergeCount?: number;
  claimedProgressEchoPrimaryIds?: string[];
  claimedProgressEchoAdIds?: string[];
}

export interface EventMergeDropPlacement {
  itemId: string;
  cellIndex: number;
}

export interface EventCurrencyCollectResult {
  collected: boolean;
  type?: 'stamina' | 'diamond' | 'huayuan';
  amount?: number;
}

export interface EventProducerResult {
  result: 'produced' | 'noSpace' | 'invalid';
  itemId?: string;
  cellIndex?: number;
  remaining: number;
}

interface EventBoardCarryItem {
  itemId: string;
  chestQueue?: string[];
  chestTotal?: number;
}

function localDateKey(ts = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyPersistState(): EventBoardPersistState {
  return {
    cells: [],
    stageIndex: 0,
    keys: 0,
    pendingStarterStones: 0,
    discoveredItemIds: [],
    claimedDiscoveryRewardItemIds: [],
    completedStageIds: [],
    dailyKey: localDateKey(),
    dailyOrderDeliveries: 0,
    dailyStarterStones: 0,
    dailyDropCounts: {},
    claimedCodexRewardIds: [],
    progressEchoMergeCount: 0,
    claimedProgressEchoPrimaryIds: [],
    claimedProgressEchoAdIds: [],
  };
}

class EventBoardManagerClass {
  private _cells: EventBoardCellData[] = [];
  private _stageIndex = 0;
  private _keys = 0;
  private _pendingStarterStones = 0;
  private _discoveredItemIds: Set<string> = new Set();
  private _claimedDiscoveryRewardItemIds: Set<string> = new Set();
  private _completedStageIds: Set<string> = new Set();
  private _claimedCodexRewardIds: Set<string> = new Set();
  private _progressEchoMergeCount = 0;
  private _claimedProgressEchoPrimaryIds: Set<string> = new Set();
  private _claimedProgressEchoAdIds: Set<string> = new Set();
  private _dailyKey = localDateKey();
  private _dailyOrderDeliveries = 0;
  private _dailyStarterStones = 0;
  private _dailyDropCounts: Record<string, number> = {};
  private _initialized = false;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    if (this._cells.length !== getStageTotal(this.currentStage)) {
      this._resetStage(this._stageIndex, false);
    }
    this._bindEvents();
    console.log(`[EventBoard] 初始化完成: ${JEWELRY_EVENT_NAME}, stage=${this.currentStage.name}`);
  }

  private _bindEvents(): void {
    // 订单是否带原石在生成时已决定并展示在订单上，交单按该标记发放，所见即所得
    EventBus.on('customer:delivered', (_uid: number, customer?: { eventStoneReward?: number }) => {
      if (!this.isUnlocked) return;
      const n = Math.max(0, Math.floor(customer?.eventStoneReward ?? 0));
      if (n > 0) this.addStarterStones(n);
    });
  }

  /** 玩家综合等级达到 {@link JEWELRY_EVENT_UNLOCK_LEVEL} 后开放花间珠匣 */
  get isUnlocked(): boolean {
    return isJewelryEventUnlocked(LevelManager.level);
  }

  get cells(): readonly EventBoardCellData[] { return this._cells; }
  get stageIndex(): number { return this._stageIndex; }
  get currentStage() { return EVENT_BOARD_STAGES[this._stageIndex] ?? EVENT_BOARD_STAGES[0]; }
  get stageCount(): number { return EVENT_BOARD_STAGES.length; }
  /** 当前层棋盘行数（后期层更大） */
  get currentRows(): number { return getStageRows(this.currentStage); }
  /** 当前层棋盘格总数（cols × currentRows） */
  get currentTotal(): number { return getStageTotal(this.currentStage); }
  get keys(): number { return this._keys; }
  get pendingStarterStones(): number { return this._pendingStarterStones; }
  get discoveredCount(): number { return this._discoveredItemIds.size; }
  get codexTotalCount(): number { return EVENT_CODEX_ITEM_IDS.length; }
  get codexDiscoveredCount(): number {
    return EVENT_CODEX_ITEM_IDS.filter(id => this._discoveredItemIds.has(id)).length;
  }
  isDiscovered(itemId: string): boolean { return this._discoveredItemIds.has(itemId); }
  get hasClaimableDiscoveryReward(): boolean {
    return false;
  }
  isCodexSectionRewardClaimed(section: 'jewelry' | 'dian_cui'): boolean {
    return this._claimedCodexRewardIds.has(section);
  }
  isCodexSectionRewardClaimable(section: 'jewelry' | 'dian_cui'): boolean {
    if (this.isCodexSectionRewardClaimed(section)) return false;
    const ids = section === 'jewelry' ? EVENT_CODEX_ITEM_IDS.slice(0, 13) : EVENT_CODEX_ITEM_IDS.slice(13);
    return ids.length > 0 && ids.every(id => this._discoveredItemIds.has(id));
  }
  get progressEchoMergeCount(): number { return this._progressEchoMergeCount; }
  get progressEchoMilestones(): readonly EventProgressEchoMilestoneDef[] {
    return EVENT_PROGRESS_ECHO_MILESTONES;
  }
  progressEchoCurrentValue(milestone: EventProgressEchoMilestoneDef): number {
    switch (milestone.objective.kind) {
      case 'codex_discovered':
        return this.codexDiscoveredCount;
      case 'merge_count':
        return this._progressEchoMergeCount;
      case 'item_discovered':
        return this.isDiscovered(milestone.objective.itemId) ? 1 : 0;
    }
  }
  progressEchoTargetValue(milestone: EventProgressEchoMilestoneDef): number {
    return milestone.objective.kind === 'item_discovered' ? 1 : milestone.objective.target;
  }
  isProgressEchoCompleted(milestone: EventProgressEchoMilestoneDef): boolean {
    return this.progressEchoCurrentValue(milestone) >= this.progressEchoTargetValue(milestone);
  }
  isProgressEchoPrimaryClaimed(id: string): boolean {
    return this._claimedProgressEchoPrimaryIds.has(id);
  }
  isProgressEchoAdClaimed(id: string): boolean {
    return this._claimedProgressEchoAdIds.has(id);
  }
  isProgressEchoPrimaryClaimable(milestone: EventProgressEchoMilestoneDef): boolean {
    return this.isProgressEchoCompleted(milestone) && !this.isProgressEchoPrimaryClaimed(milestone.id);
  }
  isProgressEchoAdClaimable(milestone: EventProgressEchoMilestoneDef): boolean {
    return this.isProgressEchoCompleted(milestone) && !this.isProgressEchoAdClaimed(milestone.id);
  }
  get hasClaimableProgressEchoReward(): boolean {
    return this.progressEchoMilestones.some(m => (
      this.isProgressEchoPrimaryClaimable(m) || this.isProgressEchoAdClaimable(m)
    ));
  }
  get hasClaimable(): boolean {
    if (!this.isUnlocked) return false;
    return (
      this.hasClaimableDiscoveryReward ||
      this.hasClaimableProgressEchoReward ||
      this._pendingStarterStones > 0 ||
      (this._keys > 0 && this._stageIndex < EVENT_BOARD_STAGES.length - 1)
    );
  }

  exportState(): EventBoardPersistState {
    return {
      cells: this._cells.map(c => ({ ...c })),
      stageIndex: this._stageIndex,
      keys: this._keys,
      pendingStarterStones: this._pendingStarterStones,
      discoveredItemIds: Array.from(this._discoveredItemIds),
      claimedDiscoveryRewardItemIds: Array.from(this._claimedDiscoveryRewardItemIds),
      completedStageIds: Array.from(this._completedStageIds),
      dailyKey: this._dailyKey,
      dailyOrderDeliveries: this._dailyOrderDeliveries,
      dailyStarterStones: this._dailyStarterStones,
      dailyDropCounts: { ...this._dailyDropCounts },
      claimedCodexRewardIds: Array.from(this._claimedCodexRewardIds),
      progressEchoMergeCount: this._progressEchoMergeCount,
      claimedProgressEchoPrimaryIds: Array.from(this._claimedProgressEchoPrimaryIds),
      claimedProgressEchoAdIds: Array.from(this._claimedProgressEchoAdIds),
    };
  }

  loadState(raw?: EventBoardPersistState | null): void {
    const state = raw ?? emptyPersistState();
    this._stageIndex = Math.max(0, Math.min(EVENT_BOARD_STAGES.length - 1, Math.floor(state.stageIndex ?? 0)));
    this._keys = Math.max(0, Math.floor(state.keys ?? 0));
    this._pendingStarterStones = Math.max(0, Math.floor(state.pendingStarterStones ?? 0));
    this._discoveredItemIds = new Set((state.discoveredItemIds ?? []).filter(id => ITEM_DEFS.has(id)));
    this._claimedDiscoveryRewardItemIds = new Set(
      (state.claimedDiscoveryRewardItemIds ?? []).filter(id => ITEM_DEFS.has(id)),
    );
    this._completedStageIds = new Set(state.completedStageIds ?? []);
    this._dailyKey = typeof state.dailyKey === 'string' ? state.dailyKey : localDateKey();
    this._dailyOrderDeliveries = Math.max(0, Math.floor(state.dailyOrderDeliveries ?? 0));
    this._dailyStarterStones = Math.max(0, Math.floor(state.dailyStarterStones ?? 0));
    this._dailyDropCounts = { ...(state.dailyDropCounts ?? {}) };
    this._progressEchoMergeCount = Math.max(0, Math.floor(state.progressEchoMergeCount ?? 0));
    this._claimedCodexRewardIds = new Set(
      (state.claimedCodexRewardIds ?? []).filter(id => id === 'jewelry' || id === 'dian_cui'),
    );
    const milestoneIds = new Set(EVENT_PROGRESS_ECHO_MILESTONES.map(m => m.id));
    this._claimedProgressEchoPrimaryIds = new Set(
      (state.claimedProgressEchoPrimaryIds ?? []).filter(id => milestoneIds.has(id)),
    );
    this._claimedProgressEchoAdIds = new Set(
      (state.claimedProgressEchoAdIds ?? []).filter(id => milestoneIds.has(id)),
    );

    const cells = Array.isArray(state.cells) ? state.cells : [];
    const stageDef = EVENT_BOARD_STAGES[this._stageIndex] ?? EVENT_BOARD_STAGES[0];
    if (cells.length === getStageTotal(stageDef)) {
      const peekItemId = stageDef.peekItemId;
      this._cells = cells.map((c, index) => {
        const state2 =
          c.state === CellState.FOG
            ? CellState.FOG
            : c.state === CellState.PEEK
              ? CellState.PEEK
              : CellState.OPEN;
        let itemId = c.itemId && ITEM_DEFS.has(c.itemId) ? c.itemId : null;
        const lockedCellItemId = this._lockedCellItemId(stageDef, index);
        // 锁格必须压着配置物品，保证可合成解锁。
        if (state2 === CellState.PEEK && (!itemId || itemId === peekItemId)) itemId = lockedCellItemId;
        if (state2 === CellState.FOG && (!itemId || itemId === peekItemId)) itemId = lockedCellItemId;
        const chestQueue = Array.isArray(c.chestQueue)
          ? c.chestQueue.filter(id => ITEM_DEFS.has(id))
          : undefined;
        return {
          index,
          state: state2,
          itemId,
          chestQueue,
          chestTotal: typeof c.chestTotal === 'number' ? c.chestTotal : undefined,
          isPortal: !!c.isPortal,
        };
      });
      this._applyPortalCell();
    } else {
      this._resetStage(this._stageIndex, false);
    }
    this._syncVisibleBoardDiscoveries();
    this._checkDailyReset();
    EventBus.emit('eventBoard:changed');
  }

  private _resetStage(
    stageIndex: number,
    emit = true,
    grantStarterDiscoveryRewards = emit,
    placeStarterItems = true,
  ): void {
    const stage = EVENT_BOARD_STAGES[stageIndex] ?? EVENT_BOARD_STAGES[0];
    const peek = new Set(stage.peekCells);
    const fog = new Set(stage.fogCells);
    this._stageIndex = Math.max(0, Math.min(EVENT_BOARD_STAGES.length - 1, stageIndex));
    this._cells = Array.from({ length: getStageTotal(stage) }, (_, index) => {
      const isFog = fog.has(index);
      const isPeek = !isFog && peek.has(index);
      return {
        index,
        state: isFog ? CellState.FOG : isPeek ? CellState.PEEK : CellState.OPEN,
        // 半锁格压着一件物品，拖相同物品过去合成才解锁；全锁格内物品揭开后显示。
        itemId: isPeek || isFog ? this._lockedCellItemId(stage, index) : null,
      };
    });

    // 「时空门」棋子：独占一格（非最终层）。须先于起始物品放置，并强制该格为 OPEN、无物品
    const isLastStage = this._stageIndex >= EVENT_BOARD_STAGES.length - 1;
    if (!isLastStage && typeof stage.portalCell === 'number') {
      const pc = this._cells[stage.portalCell];
      if (pc) {
        pc.state = CellState.OPEN;
        pc.itemId = null;
        pc.isPortal = true;
      }
    }

    if (placeStarterItems) this._placeStageStarterItems(stage, grantStarterDiscoveryRewards);

    if (emit) {
      EventBus.emit('eventBoard:stageChanged', this.currentStage);
      EventBus.emit('eventBoard:changed');
    }
  }

  private _lockedCellItemId(
    stage: { peekItemId: string; lockedCellItems?: Record<number, string> },
    index: number,
  ): string {
    const itemId = stage.lockedCellItems?.[index] ?? stage.peekItemId;
    return ITEM_DEFS.has(itemId) ? itemId : stage.peekItemId;
  }

  private _placeStageStarterItems(stage: { starterItems: string[] }, grantStarterDiscoveryRewards: boolean): void {
    for (const itemId of stage.starterItems) {
      const idx = this._placeItemInFirstEmpty(itemId);
      if (idx >= 0) this._markDiscovered(itemId, grantStarterDiscoveryRewards);
    }
  }

  /** 依当前层配置校正「时空门」格，防止门格被占用。 */
  private _applyPortalCell(): void {
    const stage = this.currentStage;
    const isLast = this._stageIndex >= EVENT_BOARD_STAGES.length - 1;
    for (const c of this._cells) if (c.isPortal) c.isPortal = false;
    if (isLast || typeof stage.portalCell !== 'number') return;
    const pc = this._cells[stage.portalCell];
    if (!pc) return;
    // 门格若被占用，把物品挪到首个空格，挪不动则丢弃。
    if (pc.itemId) {
      const relocate = this._cells.find(
        c => c.index !== pc.index && c.state === CellState.OPEN && !c.itemId && !c.isPortal,
      );
      if (relocate) {
        relocate.itemId = pc.itemId;
        relocate.chestQueue = pc.chestQueue;
        relocate.chestTotal = pc.chestTotal;
      }
    }
    pc.state = CellState.OPEN;
    pc.itemId = null;
    pc.chestQueue = undefined;
    pc.chestTotal = undefined;
    pc.isPortal = true;
  }

  /** 开放格上的活动物品一旦出现在棋盘，即应计入图鉴；锁格压物不提前解锁。 */
  private _syncVisibleBoardDiscoveries(): void {
    for (const cell of this._cells) {
      if (cell.state !== CellState.OPEN || cell.isPortal || !cell.itemId) continue;
      this._markDiscovered(cell.itemId, true);
    }
  }

  /** 该格是否为「时空门」棋子 */
  isPortalCell(index: number): boolean {
    return !!this._cells[index]?.isPortal;
  }

  private _checkDailyReset(): void {
    const today = localDateKey();
    if (this._dailyKey === today) return;
    this._dailyKey = today;
    this._dailyOrderDeliveries = 0;
    this._dailyStarterStones = 0;
    this._dailyDropCounts = {};
  }

  tryGrantStarterStoneFromOrder(): boolean {
    this._checkDailyReset();
    this._dailyOrderDeliveries++;
    if (this._dailyStarterStones >= EVENT_ORDER_BOX_DAILY_LIMIT) return false;
    const guaranteed = this._dailyOrderDeliveries <= EVENT_ORDER_BOX_DAILY_GUARANTEE;
    if (!guaranteed && Math.random() >= EVENT_ORDER_BOX_CHANCE) return false;
    this._dailyStarterStones++;
    this._pendingStarterStones++;
    EventBus.emit('eventBoard:starterStoneGranted', this._pendingStarterStones, 1);
    EventBus.emit('eventBoard:changed');
    return true;
  }

  /** 直接向底部库存发放原石（订单命中 / GM 调试用）。返回发放后的总量。 */
  addStarterStones(n: number): number {
    const add = Math.max(0, Math.floor(n));
    if (add <= 0) return this._pendingStarterStones;
    this._pendingStarterStones += add;
    EventBus.emit('eventBoard:starterStoneGranted', this._pendingStarterStones, add);
    EventBus.emit('eventBoard:changed');
    return this._pendingStarterStones;
  }

  /** 从底部库存取 1 个原石放入活动棋盘首个空格；成功返回落点格 index，失败 -1。 */
  placeStarterStone(): number {
    if (this._pendingStarterStones <= 0) return -1;
    if (this.emptyOpenCellCount < 1) return -1;
    this._pendingStarterStones--;
    const roll = Math.random();
    const itemId = roll < EVENT_STARTER_STONE_LEVEL3_CHANCE
      ? `${JEWELRY_ITEM_PREFIX}3`
      : roll < EVENT_STARTER_STONE_LEVEL3_CHANCE + EVENT_STARTER_STONE_LEVEL2_CHANCE
        ? `${JEWELRY_ITEM_PREFIX}2`
        : `${JEWELRY_ITEM_PREFIX}1`;
    const idx = this._placeItemInFirstEmpty(itemId);
    if (idx < 0) {
      this._pendingStarterStones++;
      return -1;
    }
    this._markDiscovered(itemId, true);
    EventBus.emit('eventBoard:starterStonePlaced', itemId, idx);
    EventBus.emit('eventBoard:changed');
    return idx;
  }

  get emptyOpenCellCount(): number {
    return this._cells.filter(c => c.state === CellState.OPEN && !c.itemId && !c.isPortal).length;
  }

  get carryableEventItemCount(): number {
    return this._collectCarryItemsForNextStage().length;
  }

  get rewardBoxItemCountOnStageChange(): number {
    return this._collectRewardBoxItemsForStageChange().length;
  }

  get mergeableCarryEventItemName(): string | null {
    return this._findMergeableCarryEventItemName();
  }

  /** GM：清空活动棋盘开放格上的物品（不含时空门格、半锁/全锁格） */
  gmClearOpenItems(): number {
    let count = 0;
    for (const cell of this._cells) {
      if (cell.state !== CellState.OPEN || cell.isPortal || !cell.itemId) continue;
      cell.itemId = null;
      cell.chestQueue = undefined;
      cell.chestTotal = undefined;
      count++;
    }
    if (count > 0) EventBus.emit('eventBoard:changed');
    return count;
  }

  /**
   * GM：向活动棋盘空开放格放置首饰（1–13 级）。
   * 仅更新图鉴发现状态，不发放首次发现奖励。
   */
  gmPlaceJewelry(level: number, count = 1): { placed: number; cellIndexes: number[] } {
    const lv = Math.max(1, Math.min(13, Math.floor(level)));
    const itemId = `${JEWELRY_ITEM_PREFIX}${lv}`;
    return this._gmPlaceEventItem(itemId, count);
  }

  /** GM：向活动棋盘空开放格放置点翠副产物（1–8 级）。 */
  gmPlaceDianCui(level: number, count = 1): { placed: number; cellIndexes: number[] } {
    const lv = Math.max(1, Math.min(8, Math.floor(level)));
    const itemId = `${DIAN_CUI_ITEM_PREFIX}${lv}`;
    return this._gmPlaceEventItem(itemId, count);
  }

  private _gmPlaceEventItem(itemId: string, count = 1): { placed: number; cellIndexes: number[] } {
    if (!ITEM_DEFS.has(itemId)) return { placed: 0, cellIndexes: [] };

    const n = Math.max(1, Math.floor(count));
    const cellIndexes: number[] = [];
    for (let i = 0; i < n; i++) {
      const idx = this._placeItemInFirstEmpty(itemId);
      if (idx < 0) break;
      cellIndexes.push(idx);
      this._markDiscovered(itemId, false);
    }
    if (cellIndexes.length > 0) EventBus.emit('eventBoard:changed');
    return { placed: cellIndexes.length, cellIndexes };
  }

  private _placeItemInFirstEmpty(itemId: string): number {
    const idx = this._cells.findIndex(c => c.state === CellState.OPEN && !c.itemId && !c.isPortal);
    if (idx < 0) return -1;
    this._cells[idx].itemId = itemId;
    return idx;
  }

  private _placeItemInPreferredEmpty(itemId: string, preferredIndex: number): number {
    const preferred = this._cells[preferredIndex];
    if (preferred?.state === CellState.OPEN && !preferred.itemId && !preferred.isPortal) {
      preferred.itemId = itemId;
      return preferredIndex;
    }
    return this._placeItemInFirstEmpty(itemId);
  }

  private _isCarryableBoardItem(itemId: string | null | undefined): itemId is string {
    if (!itemId) return false;
    const def = ITEM_DEFS.get(itemId);
    return Boolean(
      def &&
      def.category === Category.EVENT &&
      (def.line === EventLine.JEWELRY || def.line === EventLine.DIAN_CUI),
    );
  }

  private _collectCarryItemsForNextStage(): EventBoardCarryItem[] {
    return this._cells
      .filter(c => c.state === CellState.OPEN && !c.isPortal && this._isCarryableBoardItem(c.itemId))
      .map(c => ({
        itemId: c.itemId!,
        chestQueue: c.chestQueue ? [...c.chestQueue] : undefined,
        chestTotal: c.chestTotal,
      }));
  }

  private _findMergeableCarryEventItemName(): string | null {
    const counts = new Map<string, number>();
    for (const cell of this._cells) {
      if (cell.state !== CellState.OPEN || cell.isPortal || !this._isCarryableBoardItem(cell.itemId)) continue;
      if (!getMergeResultId(cell.itemId)) continue;
      const nextCount = (counts.get(cell.itemId) ?? 0) + 1;
      if (nextCount >= 2) return ITEM_DEFS.get(cell.itemId)?.name ?? cell.itemId;
      counts.set(cell.itemId, nextCount);
    }
    return null;
  }

  private _collectRewardBoxItemsForStageChange(): EventBoardCarryItem[] {
    return this._cells
      .filter(c => c.state === CellState.OPEN && !c.isPortal && !!c.itemId && !this._isCarryableBoardItem(c.itemId))
      .map(c => ({
        itemId: c.itemId!,
        chestQueue: c.chestQueue ? [...c.chestQueue] : undefined,
        chestTotal: c.chestTotal,
      }));
  }

  private _moveNonCarryItemsToRewardBoxBeforeNextStage(): number {
    let moved = 0;
    for (const cell of this._cells) {
      if (cell.state !== CellState.OPEN || cell.isPortal || !cell.itemId) continue;
      if (this._isCarryableBoardItem(cell.itemId)) continue;
      RewardBoxManager.addItem(cell.itemId, 1);
      cell.itemId = null;
      cell.chestQueue = undefined;
      cell.chestTotal = undefined;
      moved++;
    }
    return moved;
  }

  private _placeCarryItemsIntoNewStage(items: EventBoardCarryItem[]): number {
    let placed = 0;
    const placeInto = (indexes: number[]): void => {
      for (const idx of indexes) {
        if (placed >= items.length) return;
        const cell = this._cells[idx];
        if (!cell || cell.isPortal) continue;
        const item = items[placed];
        cell.itemId = item.itemId;
        cell.chestQueue = item.chestQueue ? [...item.chestQueue] : undefined;
        cell.chestTotal = item.chestTotal;
        this._markDiscovered(item.itemId, false);
        placed++;
      }
    };

    // 继承物只放入下一阶段的普通空格，不压入半锁/全锁格，避免干扰新阶段解锁节奏。
    placeInto(this._cells.filter(c => c.state === CellState.OPEN && !c.itemId && !c.isPortal).map(c => c.index));
    return placed;
  }

  /**
   * 可否合成：源必须是开放格上的物品；目标可以是开放格，也可以是
   * 压着相同物品的半锁格（拖相同物品过去合成即可解锁该半锁格）。
   */
  canMerge(srcIndex: number, dstIndex: number): boolean {
    const src = this._cells[srcIndex];
    const dst = this._cells[dstIndex];
    if (!src || !dst || srcIndex === dstIndex) return false;
    if (src.state !== CellState.OPEN || !src.itemId) return false;
    if (this._isRewardBoxCollectibleItem(src.itemId) && !this._isRewardBoxMergeableItem(src.itemId)) return false;
    if (dst.state !== CellState.OPEN && dst.state !== CellState.PEEK) return false;
    if (src.itemId !== dst.itemId) return false;
    return !!getMergeResultId(src.itemId);
  }

  moveOrMerge(srcIndex: number, dstIndex: number): 'merged' | 'moved' | 'unlocked' | 'blocked' {
    const src = this._cells[srcIndex];
    const dst = this._cells[dstIndex];
    if (!src || !dst || srcIndex === dstIndex) return 'blocked';
    if (src.state !== CellState.OPEN || !src.itemId) return 'blocked';

    if (this.canMerge(srcIndex, dstIndex)) {
      const dstWasPeek = dst.state === CellState.PEEK;
      const resultId = getMergeResultId(src.itemId)!;
      src.itemId = null;
      src.chestQueue = undefined;
      src.chestTotal = undefined;
      dst.itemId = resultId;
      dst.chestQueue = undefined;
      dst.chestTotal = undefined;
      // 合成到半锁格：解锁该格并级联揭开相邻全锁格
      if (dstWasPeek) {
        dst.state = CellState.OPEN;
        this._revealAdjacentFog(dstIndex);
        EventBus.emit('eventBoard:unlocked', dstIndex);
      }
      this._markDiscovered(resultId, true);
      this._progressEchoMergeCount++;
      this._tryCompleteStage(resultId);
      this._tryGrantMergeDrop(resultId, srcIndex);
      EventBus.emit('eventBoard:merged', resultId, dstIndex);
      EventBus.emit('eventBoard:changed');
      return dstWasPeek ? 'unlocked' : 'merged';
    }

    if (this._isRewardBoxCollectibleItem(src.itemId)) return 'blocked';

    // 拖入空的开放格：普通移动（半锁格不接受单纯移动；时空门格不可占用）
    if (dst.state === CellState.OPEN && !dst.itemId && !dst.isPortal) {
      dst.itemId = src.itemId;
      // 半开的容器随之带走待散落队列，避免重复扣体力
      dst.chestQueue = src.chestQueue;
      dst.chestTotal = src.chestTotal;
      src.itemId = null;
      src.chestQueue = undefined;
      src.chestTotal = undefined;
      EventBus.emit('eventBoard:changed');
      return 'moved';
    }

    return 'blocked';
  }

  /** 半锁格被解锁后，按主棋盘规则把周围 3×3 的全锁格揭开为半锁（并压上配置物品）。 */
  private _revealAdjacentFog(index: number): void {
    this._revealFogAround3x3(index);
  }

  private _revealFogAround3x3(centerIndex: number): void {
    const rows = getStageRows(this.currentStage);
    const centerRow = Math.floor(centerIndex / EVENT_BOARD_COLS);
    const centerCol = centerIndex % EVENT_BOARD_COLS;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const row = centerRow + dr;
        const col = centerCol + dc;
        if (row < 0 || row >= rows || col < 0 || col >= EVENT_BOARD_COLS) continue;
        const index = row * EVENT_BOARD_COLS + col;
        const cell = this._cells[index];
        if (cell && cell.state === CellState.FOG) {
          cell.state = CellState.PEEK;
          cell.itemId = cell.itemId ?? this._lockedCellItemId(this.currentStage, index);
        }
      }
    }
  }

  /** 当前是否可作为拖放落点（空开放格 / 同物品可合成，含压物的半锁格） */
  isDropTarget(srcIndex: number, dstIndex: number): boolean {
    const src = this._cells[srcIndex];
    const dst = this._cells[dstIndex];
    if (!src || !dst || srcIndex === dstIndex) return false;
    if (src.state !== CellState.OPEN || !src.itemId) return false;
    if (this.canMerge(srcIndex, dstIndex)) return true;
    if (this._isRewardBoxCollectibleItem(src.itemId)) return false;
    if (dst.state === CellState.OPEN && !dst.itemId && !dst.isPortal) return true;
    return false;
  }

  private _isRewardBoxCollectibleItem(itemId: string): boolean {
    return itemId === LUCKY_COIN_ITEM_ID || isChestItem(itemId);
  }

  /** 活动棋盘上仍允许合并、但不允许点击打开的奖励箱。 */
  private _isRewardBoxMergeableItem(itemId: string): boolean {
    return itemId.startsWith('stamina_chest_') && !!getMergeResultId(itemId);
  }

  isRewardBoxCollectibleCell(index: number): boolean {
    const cell = this._cells[index];
    return Boolean(cell?.itemId && this._isRewardBoxCollectibleItem(cell.itemId));
  }

  isRewardBoxMergeableCell(index: number): boolean {
    const cell = this._cells[index];
    return Boolean(cell?.itemId && this._isRewardBoxMergeableItem(cell.itemId));
  }

  collectRewardBoxItemCell(index: number): { collected: boolean; itemId?: string; name?: string } {
    const cell = this._cells[index];
    if (!cell?.itemId || !this._isRewardBoxCollectibleItem(cell.itemId)) return { collected: false };
    const itemId = cell.itemId;
    const name = ITEM_DEFS.get(itemId)?.name ?? itemId;
    RewardBoxManager.addItem(itemId, 1);
    cell.itemId = null;
    EventBus.emit('rewardBox:collectedFromBoard', itemId);
    EventBus.emit('eventBoard:rewardGranted', [{ kind: 'boxReward', itemId, count: 1 }]);
    EventBus.emit('eventBoard:changed');
    return { collected: true, itemId, name };
  }

  collectCurrencyCell(index: number): EventCurrencyCollectResult {
    const cell = this._cells[index];
    if (!cell?.itemId) return { collected: false };
    const def = ITEM_DEFS.get(cell.itemId);
    if (!def || def.category !== Category.CURRENCY || !def.currencyReward) return { collected: false };
    const { type, amount } = def.currencyReward;
    if (type === 'stamina') CurrencyManager.addStamina(amount);
    if (type === 'diamond') CurrencyManager.addDiamond(amount);
    if (type === 'huayuan') CurrencyManager.addHuayuan(amount);
    cell.itemId = null;
    EventBus.emit('eventBoard:rewardGranted', [{ kind: type, amount }]);
    EventBus.emit('eventBoard:changed');
    return { collected: true, type, amount };
  }

  claimCodexSectionReward(section: 'jewelry' | 'dian_cui'): boolean {
    if (!this.isCodexSectionRewardClaimable(section)) return false;
    this._claimCodexSectionReward(section, 'manual');
    return true;
  }

  claimProgressEchoPrimaryReward(id: string): boolean {
    const milestone = EVENT_PROGRESS_ECHO_MILESTONES.find(m => m.id === id);
    if (!milestone || !this.isProgressEchoPrimaryClaimable(milestone)) return false;
    this._claimedProgressEchoPrimaryIds.add(id);
    this._grantRewards([milestone.primaryReward]);
    EventBus.emit('eventBoard:rewardClaimed', id, 'primary');
    EventBus.emit('eventBoard:changed');
    return true;
  }

  claimProgressEchoAdReward(id: string): boolean {
    const milestone = EVENT_PROGRESS_ECHO_MILESTONES.find(m => m.id === id);
    if (!milestone || !this.isProgressEchoAdClaimable(milestone)) return false;
    this._claimedProgressEchoAdIds.add(id);
    this._grantRewards([milestone.adReward]);
    EventBus.emit('eventBoard:rewardClaimed', id, 'ad');
    EventBus.emit('eventBoard:changed');
    return true;
  }

  /** 该格是否是可开启的容器（宝箱/红包/钻石袋/体力箱） */
  isContainerCell(index: number): boolean {
    const cell = this._cells[index];
    return !!cell
      && cell.state === CellState.OPEN
      && !!cell.itemId
      && isChestItem(cell.itemId)
      && !this._isRewardBoxCollectibleItem(cell.itemId);
  }

  /** 该格是否是活动满级产出工具（主线 L13 / 点翠 L8）。 */
  isEventProducerCell(index: number): boolean {
    const cell = this._cells[index];
    return !!cell && cell.state === CellState.OPEN && !!cell.itemId && isEventProducerItem(cell.itemId);
  }

  private _emptyOpenCellsExcept(index: number): number[] {
    const out: number[] = [];
    for (const c of this._cells) {
      if (c.index !== index && c.state === CellState.OPEN && !c.itemId && !c.isPortal) out.push(c.index);
    }
    return out;
  }

  private _findEventProduceTarget(index: number): number {
    const col = index % EVENT_BOARD_COLS;
    const row = Math.floor(index / EVENT_BOARD_COLS);
    const rows = this.currentRows;
    const candidates: number[] = [];
    if (col > 0) candidates.push(index - 1);
    if (col < EVENT_BOARD_COLS - 1) candidates.push(index + 1);
    if (row > 0) candidates.push(index - EVENT_BOARD_COLS);
    if (row < rows - 1) candidates.push(index + EVENT_BOARD_COLS);
    for (const idx of candidates) {
      const c = this._cells[idx];
      if (c?.state === CellState.OPEN && !c.itemId && !c.isPortal) return idx;
    }
    return this._emptyOpenCellsExcept(index)[0] ?? -1;
  }

  private _pickEventProducerItem(): string | null {
    const table = EVENT_PRODUCER_DROP_TABLE.filter(e => ITEM_DEFS.has(e.itemId) && e.weight > 0);
    const total = table.reduce((sum, e) => sum + e.weight, 0);
    if (total <= 0) return null;
    let roll = Math.random() * total;
    for (const entry of table) {
      roll -= entry.weight;
      if (roll <= 0) return entry.itemId;
    }
    return table[table.length - 1]?.itemId ?? null;
  }

  private _rollEventProducerQueue(): string[] {
    const queue: string[] = [];
    for (let i = 0; i < EVENT_PRODUCER_TOTAL_DROPS; i++) {
      const itemId = this._pickEventProducerItem();
      if (itemId) queue.push(itemId);
    }
    return queue;
  }

  /**
   * 开启活动棋盘上的容器：首次点击即掷出整队掉落（活动棋盘开箱不耗体力），
   * 每次点击向空格散落，散不完则保留容器与剩余队列（与主棋盘一致）。
   * 散落的货币块双击领取（与主棋盘一致）。
   */
  openContainerCell(index: number): {
    result: 'opened' | 'partial' | 'noSpace' | 'invalid';
    placed: number;
    remaining: number;
  } {
    const cell = this._cells[index];
    if (
      !cell ||
      cell.state !== CellState.OPEN ||
      !cell.itemId ||
      !isChestItem(cell.itemId) ||
      this._isRewardBoxCollectibleItem(cell.itemId)
    ) {
      return { result: 'invalid', placed: 0, remaining: 0 };
    }

    // 首次开箱：确认有落点即掷出队列（活动棋盘开箱不耗体力）
    if (cell.chestQueue === undefined) {
      if (this._emptyOpenCellsExcept(index).length < 1) {
        return { result: 'noSpace', placed: 0, remaining: 0 };
      }
      const queue = rollChestBoardDrops(cell.itemId) ?? [];
      cell.chestQueue = queue;
      cell.chestTotal = queue.length;
      if (queue.length === 0) {
        cell.itemId = null;
        cell.chestQueue = undefined;
        cell.chestTotal = undefined;
        EventBus.emit('eventBoard:changed');
        return { result: 'opened', placed: 0, remaining: 0 };
      }
    }

    const queue = cell.chestQueue!;
    const targets = this._emptyOpenCellsExcept(index);
    let placed = 0;
    while (queue.length > 0 && targets.length > 0) {
      const itemId = queue[0];
      const ti = targets.shift()!;
      this._cells[ti].itemId = itemId;
      this._markDiscovered(itemId, true);
      EventBus.emit('eventBoard:produced', index, ti, itemId);
      queue.shift();
      placed++;
    }

    const remaining = queue.length;
    if (remaining === 0) {
      cell.itemId = null;
      cell.chestQueue = undefined;
      cell.chestTotal = undefined;
    }
    EventBus.emit('eventBoard:changed');
    return { result: remaining === 0 ? 'opened' : 'partial', placed, remaining };
  }

  /** 活动满级产出工具：每次点击产出 1 个随机奖励块，不耗体力，累计 10 次后消失。 */
  produceEventToolCell(index: number): EventProducerResult {
    const cell = this._cells[index];
    if (!cell || cell.state !== CellState.OPEN || !cell.itemId || !isEventProducerItem(cell.itemId)) {
      return { result: 'invalid', remaining: 0 };
    }

    if (this._emptyOpenCellsExcept(index).length < 1) {
      return {
        result: 'noSpace',
        remaining: cell.chestQueue?.length ?? EVENT_PRODUCER_TOTAL_DROPS,
      };
    }

    if (cell.chestQueue === undefined) {
      cell.chestQueue = this._rollEventProducerQueue();
      cell.chestTotal = cell.chestQueue.length;
    }

    const itemId = cell.chestQueue.shift();
    if (!itemId) {
      cell.itemId = null;
      cell.chestQueue = undefined;
      cell.chestTotal = undefined;
      EventBus.emit('eventBoard:changed');
      return { result: 'invalid', remaining: 0 };
    }

    const targetIndex = this._findEventProduceTarget(index);
    if (targetIndex < 0) {
      cell.chestQueue.unshift(itemId);
      return { result: 'noSpace', remaining: cell.chestQueue.length };
    }

    this._cells[targetIndex].itemId = itemId;
    this._markDiscovered(itemId, true);
    EventBus.emit('eventBoard:produced', index, targetIndex, itemId);
    const remaining = cell.chestQueue.length;
    if (remaining <= 0) {
      cell.itemId = null;
      cell.chestQueue = undefined;
      cell.chestTotal = undefined;
    }
    EventBus.emit('eventBoard:changed');
    return { result: 'produced', itemId, cellIndex: targetIndex, remaining };
  }

  nextStage(): boolean {
    if (this._keys <= 0 || this._stageIndex >= EVENT_BOARD_STAGES.length - 1) return false;
    if (this._findMergeableCarryEventItemName()) return false;
    const carryItems = this._collectCarryItemsForNextStage();
    this._moveNonCarryItemsToRewardBoxBeforeNextStage();
    this._keys--;
    this._resetStage(this._stageIndex + 1, false, true, false);
    this._placeCarryItemsIntoNewStage(carryItems);
    this._placeStageStarterItems(this.currentStage, true);
    EventBus.emit('eventBoard:stageChanged', this.currentStage);
    EventBus.emit('eventBoard:changed');
    return true;
  }

  private _markDiscovered(itemId: string, grantReward: boolean): void {
    const itemDef = ITEM_DEFS.get(itemId);
    if (itemDef?.category !== Category.EVENT) return;
    if (itemDef.line !== EventLine.JEWELRY && itemDef.line !== EventLine.DIAN_CUI) return;
    if (this._discoveredItemIds.has(itemId)) return;
    this._discoveredItemIds.add(itemId);
    EventBus.emit('eventBoard:discovered', itemId);
    if (grantReward) this._autoClaimCompletedCodexRewards();
    // 图鉴分组奖励在集齐时自动发放；GM 放置时仍只记录发现，不发奖。
    if (!grantReward || !EVENT_DISCOVERY_REWARDS.some(r => r.itemId === itemId)) {
      this._claimedDiscoveryRewardItemIds.add(itemId);
    }
  }

  private _autoClaimCompletedCodexRewards(): void {
    this._claimCodexSectionReward('jewelry', 'auto');
    this._claimCodexSectionReward('dian_cui', 'auto');
  }

  private _claimCodexSectionReward(section: 'jewelry' | 'dian_cui', source: 'auto' | 'manual'): boolean {
    if (!this.isCodexSectionRewardClaimable(section)) return false;
    const reward: EventRewardDef = section === 'jewelry'
      ? { kind: 'outfit', outfitId: 'outfit_jewel_bloom' }
      : { kind: 'deco', decoId: 'event_jewelry_jade_curtain' };
    this._claimedCodexRewardIds.add(section);
    this._grantRewards([reward]);
    EventBus.emit('eventBoard:rewardClaimed', section);
    if (source === 'auto') EventBus.emit('eventBoard:codexSectionRewardAutoClaimed', section, reward);
    EventBus.emit('eventBoard:changed');
    return true;
  }

  private _tryCompleteStage(resultId: string): void {
    const stage = this.currentStage;
    if (this._completedStageIds.has(stage.id)) return;
    const resultDef = ITEM_DEFS.get(resultId);
    const goalDef = ITEM_DEFS.get(stage.goalItemId);
    if (!resultDef || !goalDef) return;
    const completed =
      resultDef.category === Category.EVENT &&
      resultDef.line === EventLine.JEWELRY &&
      resultDef.level >= goalDef.level;
    if (!completed) return;
    this._completedStageIds.add(stage.id);
    this._keys++;
    this._grantRewards([{ kind: 'diamond', amount: 2 + this._stageIndex * 2 }]);
    EventBus.emit('eventBoard:stageCompleted', stage, this._keys);
  }

  private _pickWeighted(table: EventDropEntry[]): EventRewardDef | null {
    const total = table.reduce((s, e) => s + Math.max(0, e.weight), 0);
    if (total <= 0) return null;
    let roll = Math.random() * total;
    for (const e of table) {
      roll -= Math.max(0, e.weight);
      if (roll < 0) return e.reward;
    }
    return table[table.length - 1]?.reward ?? null;
  }

  /** 活动棋子合成奖励：主首饰线可爆普通奖励或点翠副产物（二选一）；点翠线只爆普通奖励。 */
  private _tryGrantMergeDrop(resultId: string, preferredCellIndex: number): void {
    const def = ITEM_DEFS.get(resultId);
    if (!def) return;
    if (def.category !== Category.EVENT) return;
    if (def.line !== EventLine.JEWELRY && def.line !== EventLine.DIAN_CUI) return;
    const level = def.level;

    if (def.line === EventLine.JEWELRY) {
      const byproductChance = Math.min(
        EVENT_MERGE_BYPRODUCT_MAX_CHANCE,
        EVENT_MERGE_BYPRODUCT_BASE_CHANCE + level * EVENT_MERGE_BYPRODUCT_PER_LEVEL,
      );
      if (Math.random() < byproductChance) {
        const picked = this._pickWeighted(EVENT_MERGE_BYPRODUCT_TABLE);
        if (picked) this._grantRewards([picked], true, preferredCellIndex);
        return;
      }
    }

    const dropChance = Math.min(
      EVENT_MERGE_DROP_MAX_CHANCE,
      EVENT_MERGE_DROP_BASE_CHANCE + level * EVENT_MERGE_DROP_PER_LEVEL,
    );
    if (Math.random() >= dropChance) return;
    const picked = this._pickWeighted(EVENT_MERGE_DROP_TABLE);
    if (!picked) return;
    this._grantRewards([picked], true, preferredCellIndex);
  }

  private _grantRewards(rewards: EventRewardDef[], isDrop = false, preferredCellIndex = -1): void {
    const placements: EventMergeDropPlacement[] = [];
    for (const reward of rewards) {
      switch (reward.kind) {
        case 'stamina':
          CurrencyManager.addStamina(reward.amount);
          break;
        case 'diamond':
          CurrencyManager.addDiamond(reward.amount);
          break;
        case 'huayuan':
          CurrencyManager.addHuayuan(reward.amount);
          break;
        case 'flowerSignTickets':
          FlowerSignTicketManager.add(reward.amount);
          break;
        case 'boxItem':
          for (let i = 0; i < reward.count; i++) {
            const idx = this._placeItemInPreferredEmpty(reward.itemId, i === 0 ? preferredCellIndex : -1);
            if (idx >= 0) {
              this._markDiscovered(reward.itemId, true);
              placements.push({ itemId: reward.itemId, cellIndex: idx });
            } else {
              RewardBoxManager.addItem(reward.itemId, 1);
            }
          }
          break;
        case 'boxReward':
          // 宝箱/钻石袋/红包：直接落到活动棋盘空格（点击开箱散落货币块）；棋盘满了才退收纳盒
          for (let i = 0; i < reward.count; i++) {
            const idx = this._placeItemInPreferredEmpty(reward.itemId, i === 0 ? preferredCellIndex : -1);
            if (idx >= 0) {
              this._markDiscovered(reward.itemId, true);
              placements.push({ itemId: reward.itemId, cellIndex: idx });
            } else {
              RewardBoxManager.addItem(reward.itemId, 1);
            }
          }
          break;
        case 'deco': {
          const questId = DECO_DEFS.find(d => d.id === reward.decoId)?.unlockRequirement?.questId;
          if (questId) grantQuest(questId);
          DecorationManager.gmUnlockDeco(reward.decoId);
          break;
        }
        case 'outfit':
          DressUpManager.grantOutfitFromActivity(reward.outfitId);
          break;
      }
    }
    EventBus.emit('eventBoard:rewardGranted', rewards);
    // 合成爆奖：额外发一个用于"掉落飘字"的事件
    if (isDrop) EventBus.emit('eventBoard:mergeDrop', rewards, placements);
  }
}

export const EventBoardManager = new EventBoardManagerClass();
