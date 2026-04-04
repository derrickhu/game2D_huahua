/**
 * 合成伴生物：概率 roll、漂浮气泡状态、钻石解锁 / 移除 / 到期、存档、活动规则注册
 */
import { EventBus } from '@/core/EventBus';
import { ITEM_DEFS, InteractType } from '@/config/ItemConfig';
import {
  MERGE_COMPANION_ENABLED,
  MERGE_COMPANION_MAX_ACTIVE_FLOAT,
  MERGE_COMPANION_MIN_GLOBAL_LEVEL,
  MERGE_COMPANION_MAX_SPAWN_PER_MERGE,
  MERGE_COMPANION_DEFAULT_CHANCE_MULT,
  MERGE_BUBBLE_EXPIRE_STAMINA,
  MERGE_BUBBLE_FREE_DIAMOND_MAX_ITEM_LEVEL,
  MERGE_BUBBLE_TOOL_DIAMOND_BASE,
  MERGE_BUBBLE_TOOL_DIAMOND_PER_LEVEL,
  MERGE_BUBBLE_TOOL_DIAMOND_MIN,
  MERGE_COMPANION_RULES,
  MERGE_COMPANION_SAMPLE_ACTIVITY_RULES,
  type MergeCompanionRuleDef,
} from '@/config/MergeCompanionConfig';
import { BOARD_COLS, CELL_GAP, BoardMetrics, DESIGN_WIDTH } from '@/config/Constants';
import { BoardManager } from './BoardManager';
import { RewardBoxManager } from './RewardBoxManager';
import { CurrencyManager } from './CurrencyManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';

/** 合成当次上下文（供规则匹配与扩展） */
export interface MergeCompanionContext {
  resultId: string;
  srcIndex: number;
  dstIndex: number;
  resultCellIndex: number;
  isPeekMerge: boolean;
  timestamp: number;
  activityTags: string[];
}

export interface MergeCompanionFloatBubble {
  id: string;
  ruleId: string;
  /** 生成时合成结果格，仅作参考 */
  anchorCellIndex: number;
  /** 气泡中心在棋盘视图内的坐标（可拖动，悬浮遮挡下方格子） */
  boardX: number;
  boardY: number;
  payloadItemId: string;
  /** 剩余存在时间（秒），仅在局内 `update(dt)` 递减，离线暂停 */
  expireRemainingSec: number;
  diamondPrice: number;
  dismissEnabled: boolean;
  dismissHuayuanAmount: number;
}

export interface MergeCompanionPersistState {
  bubbles: Array<{
    id: string;
    ruleId: string;
    anchorCellIndex: number;
    boardX?: number;
    boardY?: number;
    payloadItemId: string;
    /** 新存档：局内剩余秒 */
    expireRemainingSec?: number;
    /** 旧存档：绝对到期时间 ms（读档时一次性折算为剩余秒） */
    expireAt?: number;
    offlineTimerBehavior?: 'run' | 'pause';
    diamondPrice: number;
    dismissEnabled?: boolean;
    dismissHuayuanAmount?: number;
  }>;
}

function _newId(): string {
  return `mc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function _matchRule(rule: MergeCompanionRuleDef, ctx: MergeCompanionContext): boolean {
  const def = ITEM_DEFS.get(ctx.resultId);
  if (!def) return false;

  const m = rule.match;
  if (m.allowPeekMerge === false && ctx.isPeekMerge) return false;

  if (m.categories && m.categories.length > 0 && !m.categories.includes(def.category)) {
    return false;
  }
  if (m.lines && m.lines.length > 0 && !m.lines.includes(def.line)) {
    return false;
  }
  if (m.interactTypes && m.interactTypes.length > 0 && !m.interactTypes.includes(def.interactType)) {
    return false;
  }
  if (m.resultLevelMin !== undefined && def.level < m.resultLevelMin) return false;
  if (m.resultLevelMax !== undefined && def.level > m.resultLevelMax) return false;

  if (rule.requiredActivityTags && rule.requiredActivityTags.length > 0) {
    for (const t of rule.requiredActivityTags) {
      if (!ctx.activityTags.includes(t)) return false;
    }
  }
  return true;
}

function _defaultBoardPos(anchorCellIndex: number): { boardX: number; boardY: number } {
  const cs = BoardMetrics.cellSize;
  const col = anchorCellIndex % BOARD_COLS;
  const row = Math.floor(anchorCellIndex / BOARD_COLS);
  const boardX = BoardMetrics.paddingX + col * (cs + CELL_GAP) + cs / 2;
  const boardY = row * (cs + CELL_GAP) + cs * 0.22;
  return { boardX, boardY };
}

function _clampBoardPos(x: number, y: number): { boardX: number; boardY: number } {
  const H = BoardMetrics.areaHeight;
  const pad = 28;
  return {
    boardX: Math.max(pad, Math.min(DESIGN_WIDTH - pad, x)),
    boardY: Math.max(pad, Math.min(H - pad, y)),
  };
}

function _resolvePayloadItemId(rule: MergeCompanionRuleDef, ctx: MergeCompanionContext): string | null {
  if (rule.payload.kind === 'clone_result') return ctx.resultId;
  if (rule.payload.kind === 'fixed_item') return rule.payload.itemId;
  console.warn('[MergeCompanion] pool 类型尚未实现:', rule.payload.poolId);
  return null;
}

/**
 * 钻石解锁价：工具单独高价（不吃 ≤7 免费）；鲜花/饮品等低等级免费，否则用规则表 base。
 */
function _effectiveBubbleDiamond(payloadItemId: string, ruleDiamond: number): number {
  const def = ITEM_DEFS.get(payloadItemId);
  if (!def) return Math.max(0, ruleDiamond);
  if (def.interactType === InteractType.TOOL) {
    const tier = Math.max(1, def.level);
    const raw = MERGE_BUBBLE_TOOL_DIAMOND_BASE + tier * MERGE_BUBBLE_TOOL_DIAMOND_PER_LEVEL;
    return Math.max(MERGE_BUBBLE_TOOL_DIAMOND_MIN, raw);
  }
  if (def.level <= MERGE_BUBBLE_FREE_DIAMOND_MAX_ITEM_LEVEL) return 0;
  return Math.max(0, ruleDiamond);
}

class MergeCompanionManagerClass {
  private _inited = false;
  private _blocked = false;
  private _chanceMult = MERGE_COMPANION_DEFAULT_CHANCE_MULT;
  private _activityTags: string[] = [];
  private _activityRules = new Map<string, MergeCompanionRuleDef[]>();
  private _bubbles: MergeCompanionFloatBubble[] = [];
  /** 当前选中的气泡（底栏说明 / 高亮） */
  private _selectedBubbleId: string | null = null;
  private _onMergedBound!: (
    src: number,
    dst: number,
    resultId: string,
    resultCell: number,
    isPeekMerge?: boolean,
  ) => void;

  init(): void {
    if (this._inited) return;
    this._inited = true;
    this._onMergedBound = this._onBoardMerged.bind(this);
    EventBus.on('board:merged', this._onMergedBound);
  }

  /** 新手引导等可临时禁止出伴生物 */
  setMergeCompanionBlocked(blocked: boolean): void {
    this._blocked = blocked;
  }

  get mergeCompanionBlocked(): boolean {
    return this._blocked;
  }

  setChanceMultiplier(mult: number): void {
    this._chanceMult = Math.max(0, mult);
  }

  setActivityTags(tags: string[]): void {
    this._activityTags = [...tags];
  }

  getActivityTags(): string[] {
    return [...this._activityTags];
  }

  /** 活动开始时注册；tag 用于整组卸载 */
  registerActivityRules(tag: string, rules: MergeCompanionRuleDef[]): void {
    this._activityRules.set(tag, rules);
  }

  unregisterActivityRules(tag: string): void {
    this._activityRules.delete(tag);
  }

  /**
   * 活动接入样例：注册 `MERGE_COMPANION_SAMPLE_ACTIVITY_RULES`。
   * 需在合成前 `setActivityTags` 包含 `sample_merge_event` 才会匹配其中条目。
   */
  attachSampleActivityRules(): void {
    this.registerActivityRules('_sample', MERGE_COMPANION_SAMPLE_ACTIVITY_RULES);
  }

  detachSampleActivityRules(): void {
    this.unregisterActivityRules('_sample');
  }

  getFloatBubbles(): readonly MergeCompanionFloatBubble[] {
    return this._bubbles;
  }

  getFloatBubble(id: string): MergeCompanionFloatBubble | undefined {
    return this._bubbles.find(b => b.id === id);
  }

  getSelectedBubbleId(): string | null {
    return this._selectedBubbleId;
  }

  /** 点选气泡后底栏展示解锁说明 */
  selectBubble(id: string): void {
    if (!this._bubbles.some(b => b.id === id)) return;
    this._selectedBubbleId = id;
    EventBus.emit('mergeCompanion:bubbleSelected', id);
  }

  /** 点棋盘格子 / 空白时取消气泡选中（不清空底栏物品态） */
  clearBubbleSelectionForBoardInteraction(): void {
    if (this._selectedBubbleId === null) return;
    this._selectedBubbleId = null;
    EventBus.emit('mergeCompanion:bubbleDeselect');
  }

  /** 拖动结束更新气泡在棋盘上的悬浮位置 */
  setBubbleBoardPosition(id: string, boardLocalX: number, boardLocalY: number): void {
    const b = this._bubbles.find(x => x.id === id);
    if (!b) return;
    const c = _clampBoardPos(boardLocalX, boardLocalY);
    b.boardX = c.boardX;
    b.boardY = c.boardY;
    EventBus.emit('mergeCompanion:changed');
  }

  exportState(): MergeCompanionPersistState {
    return {
      bubbles: this._bubbles.map(b => ({
        id: b.id,
        ruleId: b.ruleId,
        anchorCellIndex: b.anchorCellIndex,
        boardX: b.boardX,
        boardY: b.boardY,
        payloadItemId: b.payloadItemId,
        expireRemainingSec: Math.max(0, b.expireRemainingSec),
        diamondPrice: b.diamondPrice,
        dismissEnabled: b.dismissEnabled,
        dismissHuayuanAmount: b.dismissHuayuanAmount,
      })),
    };
  }

  loadState(state: MergeCompanionPersistState | undefined): void {
    this._bubbles = [];
    if (!state?.bubbles?.length) {
      EventBus.emit('mergeCompanion:changed');
      return;
    }
    const now = Date.now();
    for (const raw of state.bubbles) {
      if (!raw.payloadItemId || !ITEM_DEFS.has(raw.payloadItemId)) continue;
      let remain = Number(raw.expireRemainingSec);
      if (!Number.isFinite(remain) || remain < 0) {
        const exp = Number(raw.expireAt);
        remain = Number.isFinite(exp) ? Math.max(0, (exp - now) / 1000) : 0;
      }
      if (remain <= 0) continue;
      const defPos = _defaultBoardPos(raw.anchorCellIndex);
      const boardX = raw.boardX ?? defPos.boardX;
      const boardY = raw.boardY ?? defPos.boardY;
      const clamped = _clampBoardPos(boardX, boardY);
      this._bubbles.push({
        id: raw.id,
        ruleId: raw.ruleId,
        anchorCellIndex: raw.anchorCellIndex,
        boardX: clamped.boardX,
        boardY: clamped.boardY,
        payloadItemId: raw.payloadItemId,
        expireRemainingSec: remain,
        diamondPrice: _effectiveBubbleDiamond(raw.payloadItemId, raw.diamondPrice),
        dismissEnabled: false,
        dismissHuayuanAmount: 0,
      });
    }
    EventBus.emit('mergeCompanion:changed');
  }

  reset(): void {
    this._bubbles = [];
    if (this._selectedBubbleId !== null) {
      this._selectedBubbleId = null;
      EventBus.emit('board:selectionCleared');
    }
    EventBus.emit('mergeCompanion:changed');
  }

  update(dt: number): void {
    if (dt <= 0) return;
    for (const b of this._bubbles) {
      b.expireRemainingSec -= dt;
    }
    const expired = this._bubbles.filter(b => b.expireRemainingSec <= 0).map(b => b.id);
    for (const id of expired) {
      this._expireBubble(id);
    }
  }

  /** 钻石解锁：物品进空格或收纳箱 */
  unlockBubbleWithDiamond(id: string): boolean {
    const b = this._bubbles.find(x => x.id === id);
    if (!b) return false;
    if (CurrencyManager.state.diamond < b.diamondPrice) return false;

    CurrencyManager.addDiamond(-b.diamondPrice);
    const dest = this._grantItemToBoardOrBox(b.payloadItemId);
    this._removeBubble(id);
    EventBus.emit(
      'mergeCompanion:unlockDiamond',
      id,
      b.ruleId,
      b.diamondPrice,
      b.payloadItemId,
      dest,
    );
    console.log(
      `[MergeCompanion] 埋点 unlockDiamond id=${id} rule=${b.ruleId} price=${b.diamondPrice} item=${b.payloadItemId} dest=${dest}`,
    );
    return true;
  }

  /** 移除换花愿 */
  dismissBubbleForHuayuan(id: string): boolean {
    const b = this._bubbles.find(x => x.id === id);
    if (!b || !b.dismissEnabled || b.dismissHuayuanAmount <= 0) return false;
    CurrencyManager.addHuayuan(b.dismissHuayuanAmount);
    this._removeBubble(id);
    EventBus.emit('mergeCompanion:dismiss', id, b.ruleId, b.dismissHuayuanAmount);
    console.log(`[MergeCompanion] 埋点 dismiss id=${id} rule=${b.ruleId} huayuan=${b.dismissHuayuanAmount}`);
    return true;
  }

  private _grantItemToBoardOrBox(itemId: string): 'board' | 'box' {
    const idx = BoardManager.findEmptyOpenCell();
    if (idx >= 0 && BoardManager.placeItem(idx, itemId)) return 'board';
    RewardBoxManager.addItem(itemId, 1);
    return 'box';
  }

  private _removeBubble(id: string): void {
    const wasSelected = this._selectedBubbleId === id;
    this._bubbles = this._bubbles.filter(b => b.id !== id);
    if (wasSelected) {
      this._selectedBubbleId = null;
      EventBus.emit('board:selectionCleared');
    }
    EventBus.emit('mergeCompanion:changed');
  }

  private _expireBubble(id: string): void {
    const b = this._bubbles.find(x => x.id === id);
    if (!b) return;
    const bx = b.boardX;
    const by = b.boardY;
    EventBus.emit('mergeCompanion:expireStaminaFly', {
      boardLocalX: bx,
      boardLocalY: by,
      amount: MERGE_BUBBLE_EXPIRE_STAMINA,
    });
    this._removeBubble(id);
    EventBus.emit('mergeCompanion:expire', id, b.ruleId, 'stamina');
    console.log(`[MergeCompanion] 埋点 expire id=${id} rule=${b.ruleId} outcome=stamina`);
  }

  private _collectAllRules(): MergeCompanionRuleDef[] {
    const list: MergeCompanionRuleDef[] = [...MERGE_COMPANION_RULES];
    for (const rules of this._activityRules.values()) {
      list.push(...rules);
    }
    return list;
  }

  private _onBoardMerged(
    srcIndex: number,
    dstIndex: number,
    resultId: string,
    resultCellIndex: number,
    isPeekMerge?: boolean,
  ): void {
    if (!MERGE_COMPANION_ENABLED || this._blocked) return;

    const ctx: MergeCompanionContext = {
      resultId,
      srcIndex,
      dstIndex,
      resultCellIndex,
      isPeekMerge: isPeekMerge === true,
      timestamp: Date.now(),
      activityTags: this._activityTags,
    };

    const all = this._collectAllRules().filter(r => _matchRule(r, ctx));
    if (all.length === 0) return;

    const byGroup = new Map<string, MergeCompanionRuleDef>();
    for (const r of all.sort((a, b) => b.priority - a.priority)) {
      const g = r.groupId ?? r.id;
      if (!byGroup.has(g)) byGroup.set(g, r);
    }
    const candidates = [...byGroup.values()].sort((a, b) => b.priority - a.priority);

    let spawned = 0;
    for (const rule of candidates) {
      if (spawned >= MERGE_COMPANION_MAX_SPAWN_PER_MERGE) break;
      const p = Math.min(1, Math.max(0, rule.baseChance * this._chanceMult));
      if (Math.random() >= p) continue;

      if (rule.carrier === 'bubble') {
        if (CurrencyManager.globalLevel < MERGE_COMPANION_MIN_GLOBAL_LEVEL) continue;
        if (this._bubbles.length >= MERGE_COMPANION_MAX_ACTIVE_FLOAT) break;
        if (rule.spatialMode !== 'float') {
          console.warn('[MergeCompanion] grid 气泡尚未实现:', rule.id);
          continue;
        }
        const bubbleOpt = rule.bubble;
        if (!bubbleOpt) continue;
        const payloadItemId = _resolvePayloadItemId(rule, ctx);
        if (!payloadItemId || !ITEM_DEFS.has(payloadItemId)) continue;

        const id = _newId();
        const durationSec = Math.max(5, bubbleOpt.durationSec);
        const pos = _defaultBoardPos(resultCellIndex);
        const bubble: MergeCompanionFloatBubble = {
          id,
          ruleId: rule.id,
          anchorCellIndex: resultCellIndex,
          boardX: pos.boardX,
          boardY: pos.boardY,
          payloadItemId,
          expireRemainingSec: durationSec,
          diamondPrice: _effectiveBubbleDiamond(payloadItemId, bubbleOpt.diamondPrice),
          dismissEnabled: bubbleOpt.dismissEnabled === true,
          dismissHuayuanAmount: bubbleOpt.dismissHuayuanAmount ?? 0,
        };
        this._bubbles.push(bubble);
        spawned++;
        EventBus.emit('mergeCompanion:spawn', id, rule.id, payloadItemId, 'bubble');
        console.log(`[MergeCompanion] 埋点 spawn id=${id} rule=${rule.id} item=${payloadItemId}`);
        EventBus.emit('mergeCompanion:changed');
      } else {
        this._applyNonBubbleCarrier(rule, ctx);
        spawned++;
      }
    }
  }

  private _applyNonBubbleCarrier(rule: MergeCompanionRuleDef, ctx: MergeCompanionContext): void {
    if (rule.carrier === 'currency_only') {
      const c = rule.currency;
      if (c?.huayuan) CurrencyManager.addHuayuan(c.huayuan);
      if (c?.diamond) CurrencyManager.addDiamond(c.diamond);
      if (c?.stamina) CurrencyManager.addStamina(c.stamina);
      EventBus.emit('mergeCompanion:directGrant', rule.id, 'currency_only');
      console.log(`[MergeCompanion] 埋点 directGrant currency rule=${rule.id}`);
      return;
    }

    const itemId = _resolvePayloadItemId(rule, ctx);
    if (!itemId || !ITEM_DEFS.has(itemId)) return;

    if (rule.carrier === 'direct_reward_box') {
      const n = rule.payload.kind === 'fixed_item' ? Math.max(1, rule.payload.count ?? 1) : 1;
      RewardBoxManager.addItem(itemId, n);
      EventBus.emit('mergeCompanion:directGrant', rule.id, 'direct_reward_box', itemId, n);
      console.log(`[MergeCompanion] 埋点 directGrant box rule=${rule.id} item=${itemId} x${n}`);
      return;
    }

    if (rule.carrier === 'direct_board') {
      const n = rule.payload.kind === 'fixed_item' ? Math.max(1, rule.payload.count ?? 1) : 1;
      for (let i = 0; i < n; i++) {
        this._grantItemToBoardOrBox(itemId);
      }
      EventBus.emit('mergeCompanion:directGrant', rule.id, 'direct_board', itemId, n);
      console.log(`[MergeCompanion] 埋点 directGrant board rule=${rule.id} item=${itemId} x${n}`);
    }
  }
}

export const MergeCompanionManager = new MergeCompanionManagerClass();
