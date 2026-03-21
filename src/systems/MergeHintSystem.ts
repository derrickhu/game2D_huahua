/**
 * 空闲合成提示系统
 *
 * - 长时间无操作后，自动高亮一组可合成物品
 * - 两个物品同步放大缩小脉冲闪动
 * - 每次只提示一组，闪动几次后间隔几秒再轮换下一组
 * - 任何操作/合成后重置计时器
 */
import * as PIXI from 'pixi.js';
import { BoardManager } from '@/managers/BoardManager';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { CellState } from '@/config/BoardLayout';
import { BOARD_COLS, BoardMetrics, CELL_GAP } from '@/config/Constants';

/** 无操作多久后开始提示（秒） */
const IDLE_THRESHOLD = 5;
/** 每组脉冲次数 */
const PULSE_COUNT = 3;
/** 单次脉冲周期（秒） */
const PULSE_PERIOD = 0.5;
/** 两组之间的间隔（秒） */
const GROUP_INTERVAL = 3;
/** 脉冲缩放幅度 */
const PULSE_SCALE_MAX = 1.18;

interface MergeablePair {
  a: number;
  b: number;
}

export class MergeHintSystem {
  private _itemViews: PIXI.Container[];
  private _idleTimer = 0;
  private _active = false;

  private _pairs: MergeablePair[] = [];
  private _currentPairIdx = 0;
  private _phaseTimer = 0;
  /** 'pulsing' | 'waiting' | 'idle' */
  private _stage: 'idle' | 'pulsing' | 'waiting' = 'idle';
  private _pulsesDone = 0;

  constructor(itemViews: PIXI.Container[]) {
    this._itemViews = itemViews;
  }

  /** 任何用户操作时调用，重置空闲计时 */
  resetIdle(): void {
    this._idleTimer = 0;
    if (this._active) {
      this._stopHint();
    }
  }

  /** 每帧更新 */
  update(dt: number): void {
    if (!this._active) {
      this._idleTimer += dt;
      if (this._idleTimer >= IDLE_THRESHOLD) {
        this._startHint();
      }
      return;
    }

    this._phaseTimer += dt;

    if (this._stage === 'pulsing') {
      this._updatePulse();
    } else if (this._stage === 'waiting') {
      if (this._phaseTimer >= GROUP_INTERVAL) {
        this._nextGroup();
      }
    }
  }

  private _startHint(): void {
    this._pairs = this._findMergeablePairs();
    if (this._pairs.length === 0) return;

    this._active = true;
    this._currentPairIdx = 0;
    this._beginPulse();
  }

  private _stopHint(): void {
    this._resetCurrentPairScale();
    this._active = false;
    this._stage = 'idle';
    this._phaseTimer = 0;
    this._pulsesDone = 0;
  }

  private _beginPulse(): void {
    this._stage = 'pulsing';
    this._phaseTimer = 0;
    this._pulsesDone = 0;
  }

  private _updatePulse(): void {
    const pair = this._pairs[this._currentPairIdx];
    if (!pair) {
      this._stopHint();
      return;
    }

    const t = this._phaseTimer;
    const cycleDuration = PULSE_PERIOD;
    const currentCycle = Math.floor(t / cycleDuration);

    if (currentCycle >= PULSE_COUNT) {
      this._resetCurrentPairScale();
      this._stage = 'waiting';
      this._phaseTimer = 0;
      return;
    }

    const phase = (t % cycleDuration) / cycleDuration;
    const s = 1 + (PULSE_SCALE_MAX - 1) * Math.sin(phase * Math.PI);

    const viewA = this._itemViews[pair.a];
    const viewB = this._itemViews[pair.b];
    if (viewA && !viewA.destroyed) viewA.scale.set(s);
    if (viewB && !viewB.destroyed) viewB.scale.set(s);
  }

  private _nextGroup(): void {
    this._currentPairIdx = (this._currentPairIdx + 1) % this._pairs.length;

    // Re-scan in case board state changed
    this._pairs = this._findMergeablePairs();
    if (this._pairs.length === 0) {
      this._stopHint();
      return;
    }
    this._currentPairIdx = this._currentPairIdx % this._pairs.length;
    this._beginPulse();
  }

  private _resetCurrentPairScale(): void {
    if (this._pairs.length === 0) return;
    const pair = this._pairs[this._currentPairIdx];
    if (!pair) return;
    const viewA = this._itemViews[pair.a];
    const viewB = this._itemViews[pair.b];
    if (viewA && !viewA.destroyed) viewA.scale.set(1);
    if (viewB && !viewB.destroyed) viewB.scale.set(1);
  }

  private _findMergeablePairs(): MergeablePair[] {
    const itemMap = new Map<string, number[]>();

    for (const cell of BoardManager.cells) {
      if (cell.state !== CellState.OPEN || !cell.itemId || cell.reserved) continue;
      const def = ITEM_DEFS.get(cell.itemId);
      if (!def || def.level >= def.maxLevel) continue;

      const arr = itemMap.get(cell.itemId) || [];
      arr.push(cell.index);
      itemMap.set(cell.itemId, arr);
    }

    const pairs: MergeablePair[] = [];
    for (const [, indices] of itemMap) {
      if (indices.length >= 2) {
        pairs.push({ a: indices[0], b: indices[1] });
      }
    }
    return pairs;
  }
}
