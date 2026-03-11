/**
 * 空闲可合成提示系统
 *
 * - 常驻微弱提示：可合成物品呼吸光效（opacity 0.3，0.5s 周期）
 * - 空闲引导：10秒无操作后增强光效+虚线连接
 * - 同时最多高亮 2 对，优先低级
 */
import * as PIXI from 'pixi.js';
import { BoardManager } from '@/managers/BoardManager';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { CellState } from '@/config/BoardLayout';
import { BoardMetrics, BOARD_COLS, CELL_GAP } from '@/config/Constants';

/** 可合成对 */
interface MergePair {
  indexA: number;
  indexB: number;
  level: number;
}

export class MergeHintSystem {
  private _boardContainer: PIXI.Container;
  private _hintLayer: PIXI.Container;
  private _glowGraphics: Map<number, PIXI.Graphics> = new Map();
  private _connectLine: PIXI.Graphics | null = null;

  private _idleTimer = 0;
  private _scanTimer = 0;
  private _pairs: MergePair[] = [];
  private _lastInteractTime = 0;
  private _enabled = true;
  private _phase = 0; // 呼吸光效相位

  /** 空闲触发时间 */
  private _idleThreshold = 10;
  /** 引导重复间隔 */
  private _idleRepeat = 15;
  private _idleGuideShown = false;
  private _idleGuideTimer = 0;

  constructor(boardContainer: PIXI.Container) {
    this._boardContainer = boardContainer;
    this._hintLayer = new PIXI.Container();
    this._hintLayer.name = 'mergeHintLayer';
    this._boardContainer.addChild(this._hintLayer);
  }

  /** 通知有操作，重置空闲计时 */
  notifyInteraction(): void {
    this._idleTimer = 0;
    this._idleGuideShown = false;
    this._idleGuideTimer = 0;
    this._clearGuide();
  }

  /** 每帧更新 */
  update(dt: number): void {
    if (!this._enabled) return;

    this._phase += dt;
    this._idleTimer += dt;
    this._scanTimer += dt;

    // 每秒扫描一次
    if (this._scanTimer >= 1) {
      this._scanTimer = 0;
      this._scanPairs();
    }

    // 更新呼吸光效
    this._updateGlow();

    // 空闲引导
    if (this._idleTimer >= this._idleThreshold && !this._idleGuideShown && this._pairs.length > 0) {
      this._showGuide();
      this._idleGuideShown = true;
      this._idleGuideTimer = 0;
    }

    // 引导重复
    if (this._idleGuideShown) {
      this._idleGuideTimer += dt;
      if (this._idleGuideTimer >= this._idleRepeat && this._pairs.length > 0) {
        this._showGuide();
        this._idleGuideTimer = 0;
      }
    }
  }

  /** 扫描当前棋盘上所有可合成对 */
  private _scanPairs(): void {
    const countMap = new Map<string, number[]>();

    for (const cell of BoardManager.cells) {
      if (cell.state !== CellState.OPEN || !cell.itemId) continue;
      const def = ITEM_DEFS.get(cell.itemId);
      if (!def || def.level >= def.maxLevel) continue;
      const key = cell.itemId;
      if (!countMap.has(key)) countMap.set(key, []);
      countMap.get(key)!.push(cell.index);
    }

    const newPairs: MergePair[] = [];
    for (const [itemId, indices] of countMap) {
      if (indices.length >= 2) {
        const def = ITEM_DEFS.get(itemId);
        newPairs.push({
          indexA: indices[0],
          indexB: indices[1],
          level: def?.level || 1,
        });
      }
    }

    // 按等级升序，只保留前 2 对
    newPairs.sort((a, b) => a.level - b.level);
    this._pairs = newPairs.slice(0, 2);

    // 清理不再需要的光效
    const activeIndices = new Set<number>();
    for (const p of this._pairs) {
      activeIndices.add(p.indexA);
      activeIndices.add(p.indexB);
    }
    for (const [idx, gfx] of this._glowGraphics) {
      if (!activeIndices.has(idx)) {
        this._hintLayer.removeChild(gfx);
        gfx.destroy();
        this._glowGraphics.delete(idx);
      }
    }
  }

  /** 更新呼吸光效 */
  private _updateGlow(): void {
    const cs = BoardMetrics.cellSize;
    // 呼吸光效：0.3 * sin + 基础
    const alpha = 0.15 + 0.15 * Math.sin(this._phase * Math.PI * 2 / 1);

    for (const pair of this._pairs) {
      for (const idx of [pair.indexA, pair.indexB]) {
        let gfx = this._glowGraphics.get(idx);
        if (!gfx) {
          gfx = new PIXI.Graphics();
          this._hintLayer.addChild(gfx);
          this._glowGraphics.set(idx, gfx);
        }

        const col = idx % BOARD_COLS;
        const row = Math.floor(idx / BOARD_COLS);
        const x = BoardMetrics.paddingX + col * (cs + CELL_GAP);
        const y = row * (cs + CELL_GAP);

        gfx.clear();
        gfx.beginFill(0xFFD700, alpha);
        gfx.drawRoundedRect(x - 2, y - 2, cs + 4, cs + 4, 10);
        gfx.endFill();
      }
    }
  }

  /** 空闲引导：增强光效+虚线连接 */
  private _showGuide(): void {
    this._clearGuide();
    if (this._pairs.length === 0) return;

    const pair = this._pairs[0];
    const cs = BoardMetrics.cellSize;

    const colA = pair.indexA % BOARD_COLS;
    const rowA = Math.floor(pair.indexA / BOARD_COLS);
    const colB = pair.indexB % BOARD_COLS;
    const rowB = Math.floor(pair.indexB / BOARD_COLS);

    const ax = BoardMetrics.paddingX + colA * (cs + CELL_GAP) + cs / 2;
    const ay = rowA * (cs + CELL_GAP) + cs / 2;
    const bx = BoardMetrics.paddingX + colB * (cs + CELL_GAP) + cs / 2;
    const by = rowB * (cs + CELL_GAP) + cs / 2;

    this._connectLine = new PIXI.Graphics();
    // 虚线弧线
    const midX = (ax + bx) / 2;
    const midY = (ay + by) / 2 - 20;

    this._connectLine.lineStyle(2, 0xFFD700, 0.6);
    // 简单贝塞尔用折线近似
    const steps = 20;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * midX + t * t * bx;
      const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * midY + t * t * by;
      if (i % 2 === 0) {
        if (i === 0) this._connectLine.moveTo(x, y);
        else this._connectLine.lineTo(x, y);
      } else {
        const nx = (1 - (i + 1) / steps) * (1 - (i + 1) / steps) * ax + 2 * (1 - (i + 1) / steps) * ((i + 1) / steps) * midX + ((i + 1) / steps) * ((i + 1) / steps) * bx;
        const ny = (1 - (i + 1) / steps) * (1 - (i + 1) / steps) * ay + 2 * (1 - (i + 1) / steps) * ((i + 1) / steps) * midY + ((i + 1) / steps) * ((i + 1) / steps) * by;
        this._connectLine.moveTo(nx, ny);
      }
    }

    this._connectLine.alpha = 0.8;
    this._hintLayer.addChild(this._connectLine);

    // 2 秒后自动消失
    setTimeout(() => {
      this._clearGuide();
    }, 2000);
  }

  private _clearGuide(): void {
    if (this._connectLine) {
      this._hintLayer.removeChild(this._connectLine);
      this._connectLine.destroy();
      this._connectLine = null;
    }
  }

  set enabled(v: boolean) {
    this._enabled = v;
    if (!v) {
      this._clearGuide();
      for (const [, gfx] of this._glowGraphics) {
        this._hintLayer.removeChild(gfx);
        gfx.destroy();
      }
      this._glowGraphics.clear();
    }
  }
}
