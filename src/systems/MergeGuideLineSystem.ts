/**
 * 智能合成引导线系统
 *
 * - 拖拽物品时，在合成目标方向显示引导线
 * - 推荐最优合成路径（距离最近的同类物品）
 * - 半透明虚线 + 箭头末端闪烁
 */
import * as PIXI from 'pixi.js';
import { BoardManager } from '@/managers/BoardManager';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { CellState } from '@/config/BoardLayout';
import { BoardMetrics, BOARD_COLS, CELL_GAP } from '@/config/Constants';

interface GuideTarget {
  index: number;
  cx: number;
  cy: number;
  distance: number;
}

export class MergeGuideLineSystem {
  private _boardContainer: PIXI.Container;
  private _guideLayer: PIXI.Container;
  private _lines: PIXI.Graphics[] = [];
  private _arrowDots: PIXI.Graphics[] = [];
  private _phase = 0;
  private _active = false;
  private _srcIndex = -1;

  constructor(boardContainer: PIXI.Container) {
    this._boardContainer = boardContainer;
    this._guideLayer = new PIXI.Container();
    this._guideLayer.name = 'mergeGuideLayer';
    this._boardContainer.addChild(this._guideLayer);
  }

  /** 开始拖拽时调用 */
  startGuide(srcIndex: number): void {
    this._srcIndex = srcIndex;
    this._active = true;
    this._drawGuideLines();
  }

  /** 结束拖拽时调用 */
  endGuide(): void {
    this._active = false;
    this._srcIndex = -1;
    this._clearLines();
  }

  /** 每帧更新（箭头闪烁效果） */
  update(dt: number): void {
    if (!this._active) return;
    this._phase += dt;

    // 箭头末端闪烁
    const alpha = 0.4 + 0.3 * Math.sin(this._phase * Math.PI * 3);
    for (const dot of this._arrowDots) {
      dot.alpha = alpha;
    }
  }

  private _drawGuideLines(): void {
    this._clearLines();

    const cell = BoardManager.getCellByIndex(this._srcIndex);
    if (!cell?.itemId) return;

    const def = ITEM_DEFS.get(cell.itemId);
    if (!def || def.level >= def.maxLevel) return;

    // 查找所有同类物品的位置
    const targets: GuideTarget[] = [];
    const cs = BoardMetrics.cellSize;
    const srcCol = this._srcIndex % BOARD_COLS;
    const srcRow = Math.floor(this._srcIndex / BOARD_COLS);

    for (let i = 0; i < BoardManager.cells.length; i++) {
      if (i === this._srcIndex) continue;
      const other = BoardManager.cells[i];
      if (other.state !== CellState.OPEN || other.itemId !== cell.itemId) continue;
      if (other.reserved) continue;

      const col = i % BOARD_COLS;
      const row = Math.floor(i / BOARD_COLS);
      const cx = BoardMetrics.paddingX + col * (cs + CELL_GAP) + cs / 2;
      const cy = row * (cs + CELL_GAP) + cs / 2;
      const dist = Math.abs(col - srcCol) + Math.abs(row - srcRow);

      targets.push({ index: i, cx, cy, distance: dist });
    }

    if (targets.length === 0) return;

    // 按距离排序，最多显示 3 条引导线
    targets.sort((a, b) => a.distance - b.distance);
    const showTargets = targets.slice(0, 3);

    const srcCx = BoardMetrics.paddingX + srcCol * (cs + CELL_GAP) + cs / 2;
    const srcCy = srcRow * (cs + CELL_GAP) + cs / 2;

    for (let ti = 0; ti < showTargets.length; ti++) {
      const t = showTargets[ti];
      // 最近目标线条更亮
      const isNearest = ti === 0;
      const lineAlpha = isNearest ? 0.5 : 0.25;
      const lineWidth = isNearest ? 2.5 : 1.5;
      const color = isNearest ? 0xFFD700 : 0xBDBDBD;

      // 绘制虚线
      const line = new PIXI.Graphics();
      line.lineStyle(lineWidth, color, lineAlpha);

      const dx = t.cx - srcCx;
      const dy = t.cy - srcCy;
      const len = Math.sqrt(dx * dx + dy * dy);
      const dashLen = 6;
      const gapLen = 4;
      const steps = Math.floor(len / (dashLen + gapLen));

      for (let s = 0; s < steps; s++) {
        const startFrac = (s * (dashLen + gapLen)) / len;
        const endFrac = (s * (dashLen + gapLen) + dashLen) / len;
        const sx = srcCx + dx * startFrac;
        const sy = srcCy + dy * startFrac;
        const ex = srcCx + dx * Math.min(endFrac, 1);
        const ey = srcCy + dy * Math.min(endFrac, 1);
        line.moveTo(sx, sy);
        line.lineTo(ex, ey);
      }

      this._guideLayer.addChild(line);
      this._lines.push(line);

      // 箭头末端圆点
      const dot = new PIXI.Graphics();
      const dotColor = isNearest ? 0xFFD700 : 0xBDBDBD;
      dot.beginFill(dotColor, 0.8);
      dot.drawCircle(t.cx, t.cy, isNearest ? 5 : 3.5);
      dot.endFill();

      this._guideLayer.addChild(dot);
      this._arrowDots.push(dot);
    }
  }

  private _clearLines(): void {
    for (const line of this._lines) {
      this._guideLayer.removeChild(line);
      line.destroy();
    }
    this._lines = [];

    for (const dot of this._arrowDots) {
      this._guideLayer.removeChild(dot);
      dot.destroy();
    }
    this._arrowDots = [];

    this._phase = 0;
  }
}
