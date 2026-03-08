/**
 * 棋盘视图 - 管理所有格子和物品的渲染与交互
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { BOARD_COLS, BOARD_ROWS, CELL_GAP, BoardMetrics, COLORS, DESIGN_WIDTH } from '@/config/Constants';
import { CellState } from '@/config/BoardLayout';
import { BoardManager } from '@/managers/BoardManager';
import { MergeManager } from '@/managers/MergeManager';
import { BuildingManager } from '@/managers/BuildingManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { CellView } from './CellView';
import { ItemView } from './ItemView';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ToastMessage } from '../ui/ToastMessage';

export class BoardView extends PIXI.Container {
  private _cellViews: CellView[] = [];
  private _itemViews: ItemView[] = [];
  private _dragGhost: ItemView | null = null;
  private _dragSrcIndex = -1;
  private _gridOffsetY = 0;

  constructor() {
    super();
    this.position.set(0, BoardMetrics.topY);
    this._drawBoardArea();
    this._buildGrid();
    this._bindEvents();
    this._setupInteraction();
  }

  private _drawBoardArea(): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.CELL_OPEN, 0.35);
    bg.drawRoundedRect(0, 0, DESIGN_WIDTH, BoardMetrics.areaHeight, 16);
    bg.endFill();
    this.addChild(bg);
  }

  private _buildGrid(): void {
    const cs = BoardMetrics.cellSize;
    this._gridOffsetY = 0;

    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const idx = r * BOARD_COLS + c;
        const x = BoardMetrics.paddingX + c * (cs + CELL_GAP);
        const y = this._gridOffsetY + r * (cs + CELL_GAP);

        const cellView = new CellView(idx);
        cellView.position.set(x, y);
        this.addChild(cellView);
        this._cellViews.push(cellView);

        const itemView = new ItemView();
        itemView.position.set(x, y);
        this.addChild(itemView);
        this._itemViews.push(itemView);
      }
    }
  }

  /** 根据 BoardManager 数据刷新所有视图 */
  refresh(): void {
    for (let i = 0; i < BoardManager.cells.length; i++) {
      const cell = BoardManager.cells[i];
      const cellView = this._cellViews[i];
      const itemView = this._itemViews[i];

      cellView.setState(cell.state);

      if (cell.state === CellState.PEEK && cell.itemId) {
        itemView.setItem(cell.itemId);
        itemView.alpha = 0.5;
      } else if (cell.state === CellState.OPEN) {
        itemView.setItem(cell.itemId);
        itemView.alpha = 1;
      } else {
        itemView.setItem(null);
      }

      // CD 遮罩
      const cdInfo = BuildingManager.getCdInfo(i);
      if (cdInfo && cdInfo.remaining > 0) {
        itemView.setCooldown(cdInfo.remaining, cdInfo.total);
      } else {
        itemView.setCooldown(0, 0);
      }

      // 消耗型建筑/宝箱剩余次数
      const usesLeft = BuildingManager.getUsesLeft(i);
      itemView.setUsesLeft(usesLeft > 0 ? usesLeft : 0);

      // 客人锁定标记
      itemView.setLocked(cell.reserved);
    }
  }

  /** 定时刷新建筑 CD 显示（由外部 ticker 调用） */
  updateCdDisplay(): void {
    for (let i = 0; i < BoardManager.cells.length; i++) {
      const cdInfo = BuildingManager.getCdInfo(i);
      if (cdInfo && cdInfo.remaining > 0) {
        this._itemViews[i].setCooldown(cdInfo.remaining, cdInfo.total);
      }
    }
  }

  // ========== 事件绑定 ==========

  private _bindEvents(): void {
    EventBus.on('board:merged', (_src: number, _dst: number, _resultId: string, resultCell: number) => {
      this.refresh();
      this._playMergeFlash(resultCell);
    });
    EventBus.on('board:moved', () => this.refresh());
    EventBus.on('board:cellUnlocked', () => this.refresh());
    EventBus.on('board:itemPlaced', () => this.refresh());
    EventBus.on('board:itemRemoved', () => this.refresh());
    EventBus.on('board:initialized', () => this.refresh());
    EventBus.on('board:loaded', () => this.refresh());
    EventBus.on('board:buildingConverted', (_idx: number, _matId: string, buildingId: string) => {
      this.refresh();
      ToastMessage.show(`建筑材料升级为建筑！`);
    });
    EventBus.on('building:produced', () => this.refresh());
    EventBus.on('building:exhausted', () => this.refresh());
    EventBus.on('building:cdReady', (idx: number) => {
      this._itemViews[idx]?.setCooldown(0, 0);
    });
    EventBus.on('building:noStamina', (_idx: number, cost: number) => {
      ToastMessage.show(`体力不足！需要 ${cost} 点`);
    });
    EventBus.on('building:noSpace', () => {
      ToastMessage.show('周围没有空格！');
    });
    EventBus.on('customer:lockChanged', () => this.refresh());
    EventBus.on('customer:delivered', () => this.refresh());
  }

  // ========== 拖拽 + 点击交互 ==========

  private _setupInteraction(): void {
    this.eventMode = 'static';
    this.hitArea = new PIXI.Rectangle(0, 0, DESIGN_WIDTH, BoardMetrics.areaHeight);

    let _boardTouchLog = 0;

    this.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const localPos = this.toLocal(e.global);
      _boardTouchLog++;
      if (_boardTouchLog <= 5) {
        console.log('[BoardView] pointerdown #' + _boardTouchLog,
          'global:', e.global.x.toFixed(0), e.global.y.toFixed(0),
          'local:', localPos.x.toFixed(0), localPos.y.toFixed(0));
      }
      const cellIdx = this._hitTestCell(localPos.x, localPos.y);
      if (cellIdx < 0) return;

      this._dragSrcIndex = cellIdx;
      const cell = BoardManager.getCellByIndex(cellIdx);
      if (!cell) return;

      // 钥匙格 / 建筑 / 宝箱：仅点击，不拖拽
      if (cell.state === CellState.KEY) return;
      if (cell.itemId && BuildingManager.isInteractable(cell.itemId)) return;

      // 普通 OPEN 物品：立即拖拽
      if (cell.itemId && cell.state === CellState.OPEN) {
        if (MergeManager.startDrag(cellIdx)) {
          this._startDragGhost(cellIdx, localPos);
          this._highlightMergeTargets(cellIdx);
        }
      }
    });

    this.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (this._dragSrcIndex < 0) return;
      if (!this._dragGhost) return;
      const localPos = this.toLocal(e.global);
      const half = BoardMetrics.cellSize / 2;
      this._dragGhost.position.set(localPos.x - half, localPos.y - half);
    });

    this.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
      if (this._dragSrcIndex < 0) return;
      const srcIdx = this._dragSrcIndex;
      const localPos = this.toLocal(e.global);

      if (this._dragGhost) {
        const targetIdx = this._hitTestCell(localPos.x, localPos.y);
        if (targetIdx >= 0) {
          MergeManager.endDrag(targetIdx);
        } else {
          MergeManager.cancelDrag();
        }
        this._clearDragGhost();
        this._clearHighlights();
      } else {
        this._handleTap(srcIdx);
      }

      this._dragSrcIndex = -1;
    });

    this.on('pointerupoutside', () => {
      if (this._dragGhost) {
        MergeManager.cancelDrag();
        this._clearDragGhost();
        this._clearHighlights();
      }
      this._dragSrcIndex = -1;
    });
  }

  // ========== 点击处理 ==========

  private _handleTap(cellIndex: number): void {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell) return;

    // 钥匙格 → 解锁流程
    if (cell.state === CellState.KEY) {
      this._handleKeyCellTap(cellIndex);
      return;
    }

    if (!cell.itemId) return;

    // 建筑 / 宝箱 → 产出
    if (BuildingManager.isInteractable(cell.itemId)) {
      if (BuildingManager.canProduce(cellIndex)) {
        const result = BuildingManager.produce(cellIndex);
        if (result) {
          this._playProduceAnim(cellIndex, result.targetIndex);
        }
      } else {
        this._shakeCell(cellIndex);
      }
    }
  }

  /** 钥匙格点击 → 确认弹窗 → 扣金币 → 解锁 */
  private async _handleKeyCellTap(cellIndex: number): Promise<void> {
    const price = BoardManager.getKeyCellPrice(cellIndex);
    if (price <= 0) return;

    const gold = CurrencyManager.state.gold;
    if (gold < price) {
      ToastMessage.show(`金币不足（需要 ${price}💰）`);
      this._shakeCell(cellIndex);
      return;
    }

    const confirmed = await ConfirmDialog.show(
      '解锁格子',
      `花费 ${price} 金币解锁？\n当前金币：${gold}`,
      `解锁（${price}💰）`,
      '取消',
    );
    if (!confirmed) return;

    // 二次检查（弹窗期间金币可能变化）
    if (CurrencyManager.state.gold < price) {
      ToastMessage.show('金币不足');
      return;
    }

    CurrencyManager.addGold(-price);
    BoardManager.unlockKeyCell(cellIndex);
  }

  // ========== 特效 ==========

  /** 合成闪光特效 */
  private _playMergeFlash(cellIndex: number): void {
    if (cellIndex < 0 || cellIndex >= this._cellViews.length) return;
    const cs = BoardMetrics.cellSize;
    const cellView = this._cellViews[cellIndex];

    const flash = new PIXI.Graphics();
    // 中心白光
    flash.beginFill(0xFFFFFF, 0.85);
    flash.drawCircle(cs / 2, cs / 2, cs * 0.25);
    flash.endFill();
    // 外环光斑
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const len = cs * 0.35;
      flash.beginFill(0xFFE4B5, 0.7);
      flash.drawCircle(cs / 2 + Math.cos(angle) * len, cs / 2 + Math.sin(angle) * len, 3);
      flash.endFill();
    }

    flash.position.set(cellView.x, cellView.y);
    flash.scale.set(0.5);
    this.addChild(flash);

    TweenManager.to({
      target: flash,
      props: { alpha: 0 },
      duration: 0.4,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: flash.scale,
      props: { x: 1.5, y: 1.5 },
      duration: 0.4,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        this.removeChild(flash);
        flash.destroy();
      },
    });
  }

  /** 建筑产出动画 */
  private _playProduceAnim(srcIndex: number, _targetIndex: number): void {
    this._shakeCell(srcIndex);
  }

  /** 格子抖动反馈（基于 TweenManager，不依赖原生定时器） */
  private _shakeCell(cellIndex: number): void {
    const view = this._cellViews[cellIndex];
    if (!view) return;
    const origX = view.x;
    const steps = [4, -4, 3, -3, 1, -1, 0];
    const stepDuration = 0.035;
    const proxy = { t: 0 };
    TweenManager.to({
      target: proxy,
      props: { t: 1 },
      duration: steps.length * stepDuration,
      onUpdate: () => {
        const idx = Math.min(Math.floor(proxy.t * steps.length), steps.length - 1);
        view.x = origX + steps[idx];
      },
      onComplete: () => { view.x = origX; },
    });
  }

  // ========== 工具方法 ==========

  private _hitTestCell(x: number, y: number): number {
    const cs = BoardMetrics.cellSize;
    const localX = x - BoardMetrics.paddingX;
    const localY = y - this._gridOffsetY;
    if (localX < 0 || localY < 0) return -1;

    const col = Math.floor(localX / (cs + CELL_GAP));
    const row = Math.floor(localY / (cs + CELL_GAP));
    if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) return -1;

    const cellX = localX - col * (cs + CELL_GAP);
    const cellY = localY - row * (cs + CELL_GAP);
    if (cellX > cs || cellY > cs) return -1;

    return row * BOARD_COLS + col;
  }

  private _startDragGhost(cellIdx: number, pos: PIXI.IPointData): void {
    this._clearDragGhost();
    const cell = BoardManager.getCellByIndex(cellIdx);
    if (!cell?.itemId) return;

    const half = BoardMetrics.cellSize / 2;
    this._dragGhost = new ItemView();
    this._dragGhost.setItem(cell.itemId);
    this._dragGhost.alpha = 0.7;
    this._dragGhost.position.set(pos.x - half, pos.y - half);
    this.addChild(this._dragGhost);

    this._itemViews[cellIdx].alpha = 0.3;
  }

  private _clearDragGhost(): void {
    if (this._dragGhost) {
      this.removeChild(this._dragGhost);
      this._dragGhost.destroy();
      this._dragGhost = null;
    }
    if (this._dragSrcIndex >= 0) {
      const cell = BoardManager.getCellByIndex(this._dragSrcIndex);
      if (cell?.state === CellState.OPEN) {
        this._itemViews[this._dragSrcIndex].alpha = 1;
      }
    }
  }

  /** 高亮可合成目标（含 PEEK 跨格） */
  private _highlightMergeTargets(srcIndex: number): void {
    for (let i = 0; i < BoardManager.cells.length; i++) {
      if (i === srcIndex) continue;
      if (BoardManager.canMerge(srcIndex, i)) {
        this._cellViews[i].setHighlight(true);
      }
    }
  }

  private _clearHighlights(): void {
    for (const cv of this._cellViews) {
      cv.setHighlight(false);
    }
  }
}
