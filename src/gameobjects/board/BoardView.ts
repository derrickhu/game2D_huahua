/**
 * 棋盘视图 - 管理所有格子和物品的渲染与交互
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { BOARD_COLS, BOARD_ROWS, CELL_GAP, BoardMetrics, COLORS, DESIGN_WIDTH } from '@/config/Constants';
import { CellState } from '@/config/BoardLayout';
import { findBoardProducerDef } from '@/config/BuildingConfig';
import { ITEM_DEFS, Category, getMergeChain, isLuckyCoinItem } from '@/config/ItemConfig';
import { BoardManager } from '@/managers/BoardManager';
import { MergeManager } from '@/managers/MergeManager';
import { BuildingManager } from '@/managers/BuildingManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { Platform } from '@/core/PlatformService';
import { TextureCache } from '@/utils/TextureCache';
import { createToolEnergySprite } from '@/utils/ToolEnergyBadge';
import { ToolSparkleLayer } from '@/utils/ToolSparkleLayer';
import { CellView } from './CellView';
import { ItemView } from './ItemView';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ToastMessage } from '../ui/ToastMessage';
import { WarehouseManager } from '@/managers/WarehouseManager';
import { MergeGuideLineSystem } from '@/systems/MergeGuideLineSystem';
import { MergeHintSystem } from '@/systems/MergeHintSystem';

export class BoardView extends PIXI.Container {
  /** 仅格子底与雾等，必须在物品下层，避免交错 addChild 导致右侧/下方格子盖住左侧物品 */
  private _cellsLayer!: PIXI.Container;
  private _itemsLayer!: PIXI.Container;
  private _cellViews: CellView[] = [];
  private _itemViews: ItemView[] = [];
  private _dragGhost: PIXI.Container | null = null;
  /** 若设置，拖拽幽灵挂在此容器（通常为 MainScene.container）并置于最上层，避免被底栏等挡住 */
  private _dragGhostParent: PIXI.Container | null = null;
  private _dragSrcIndex = -1;
  private _dragHoverIndex = -1;
  private _mergeTargets: Set<number> = new Set();
  private _gridOffsetY = 0;
  /** 当前选中的格子索引（用于底部信息栏） */
  private _selectedIndex = -1;
  /** 双击检测 */
  private _lastTapIndex = -1;
  private _lastTapTime = 0;
  private _tapTimer: ReturnType<typeof setTimeout> | null = null;
  /** 长按检测（长按0.8秒打开合成线面板） */
  private _longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private _longPressTriggered = false;
  /** 合成引导线系统 */
  private _guideLineSystem: MergeGuideLineSystem;
  /** 空闲合成提示系统 */
  private _mergeHintSystem!: MergeHintSystem;

  /** 将拖拽幽灵挂到场景根容器，保证拖向仓库等区域时仍盖在所有 UI 之上 */
  setDragGhostParent(parent: PIXI.Container | null): void {
    this._dragGhostParent = parent;
  }

  constructor() {
    super();
    this.position.set(0, BoardMetrics.topY);
    this._drawBoardArea();
    this._cellsLayer = new PIXI.Container();
    this._itemsLayer = new PIXI.Container();
    this.addChild(this._cellsLayer);
    this.addChild(this._itemsLayer);
    this._buildGrid();
    this._bindEvents();
    this._setupInteraction();
    this._guideLineSystem = new MergeGuideLineSystem(this);
    this._mergeHintSystem = new MergeHintSystem(this._itemViews);
  }

  private _drawBoardArea(): void {
    const w = DESIGN_WIDTH;
    const h = BoardMetrics.areaHeight;
    const BAR_H = 18;

    const tex = TextureCache.get('board_bg');
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.width = w;
      sp.height = h;
      sp.tint = 0xD8EDCE;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xFFFFFF);
      mask.drawRoundedRect(0, 0, w, h, 8);
      mask.endFill();
      this.addChild(mask);
      sp.mask = mask;
      this.addChild(sp);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(COLORS.CELL_OPEN, 0.85);
      bg.drawRoundedRect(0, 0, w, h, 8);
      bg.endFill();
      this.addChild(bg);
    }

    const barTex = TextureCache.get('board_bar');
    if (barTex) {
      const topBar = new PIXI.Sprite(barTex);
      topBar.width = w;
      topBar.height = BAR_H;
      topBar.anchor.set(0, 1);
      topBar.position.set(0, 0);
      this.addChild(topBar);

      const botBar = new PIXI.Sprite(barTex);
      botBar.width = w;
      botBar.height = BAR_H;
      botBar.anchor.set(0, 0);
      botBar.position.set(0, h);
      this.addChild(botBar);
    } else {
      const fallbackBar = new PIXI.Graphics();
      fallbackBar.beginFill(0xC8B090, 0.7);
      fallbackBar.drawRoundedRect(0, -BAR_H, w, BAR_H, 4);
      fallbackBar.drawRoundedRect(0, h, w, BAR_H, 4);
      fallbackBar.endFill();
      this.addChild(fallbackBar);
    }
  }

  private _buildGrid(): void {
    const cs = BoardMetrics.cellSize;
    this._gridOffsetY = 0;

    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const idx = r * BOARD_COLS + c;
        const p = this._cellPositionForIndex(idx);

        const cellView = new CellView(idx);
        cellView.position.set(p.x, p.y);
        this._cellsLayer.addChild(cellView);
        this._cellViews.push(cellView);

        const itemView = new ItemView();
        itemView.position.set(p.x, p.y);
        this._itemsLayer.addChild(itemView);
        this._itemViews.push(itemView);
      }
    }
  }

  /** 第 i 格左上角在 BoardView 内的坐标（与 _buildGrid 一致，供 refresh 纠正位移） */
  private _cellPositionForIndex(i: number): { x: number; y: number } {
    const cs = BoardMetrics.cellSize;
    const c = i % BOARD_COLS;
    const r = Math.floor(i / BOARD_COLS);
    return {
      x: BoardMetrics.paddingX + c * (cs + CELL_GAP),
      y: this._gridOffsetY + r * (cs + CELL_GAP),
    };
  }

  /** 根据 BoardManager 数据刷新所有视图 */
  refresh(): void {
    for (let i = 0; i < BoardManager.cells.length; i++) {
      const cell = BoardManager.cells[i];
      const cellView = this._cellViews[i];
      const itemView = this._itemViews[i];

      cellView.setState(cell.state);
      cellView.setOrderReserved(
        !!cell.reserved &&
          !!cell.itemId &&
          (cell.state === CellState.OPEN || cell.state === CellState.PEEK),
      );

      if (cell.state === CellState.PEEK && cell.itemId) {
        itemView.setItem(cell.itemId);
        itemView.alpha = 1;
      } else if (cell.state === CellState.OPEN) {
        itemView.setItem(cell.itemId);
        itemView.alpha = 1;
      } else {
        itemView.setItem(null);
      }

      // CD 遮罩 + Lv2/Lv3 周期内剩余次数
      const cdInfo = BuildingManager.getCdInfo(i);
      if (cdInfo && cdInfo.remaining > 0) {
        itemView.setCooldown(cdInfo.remaining, cdInfo.total);
        itemView.setProduceCharges(0, 0);
      } else {
        itemView.setCooldown(0, 0);
        if (
          cdInfo &&
          cdInfo.chargesMax !== undefined &&
          cdInfo.chargesMax > 0 &&
          (cdInfo.chargesLeft ?? 0) > 0
        ) {
          itemView.setProduceCharges(cdInfo.chargesLeft ?? 0, cdInfo.chargesMax);
        } else {
          itemView.setProduceCharges(0, 0);
        }
      }

      // 消耗型建筑剩余次数（宝箱/红包待散落不在格子上显示角标）
      const usesLeft = BuildingManager.getUsesLeft(i);
      itemView.setUsesLeft(usesLeft > 0 ? usesLeft : 0);
      itemView.setChestDispatch(0, 0);

      // 客人锁定标记
      itemView.setLocked(cell.reserved);

      // 半解锁丝带：挂在 ItemView 内并强制盖在体力角标之上
      itemView.setPeekRibbon(cell.state === CellState.PEEK);

      // 每帧数据刷新时强制对齐格位，避免合成弹出 pivot 被打断等导致物品漂在格缝间
      const pos = this._cellPositionForIndex(i);
      itemView.snapToCellLayout();
      itemView.position.set(pos.x, pos.y);
    }
  }

  /** 定时刷新建筑 CD 显示（由外部 ticker 调用） */
  updateCdDisplay(): void {
    for (let i = 0; i < BoardManager.cells.length; i++) {
      const cdInfo = BuildingManager.getCdInfo(i);
      if (cdInfo && cdInfo.remaining > 0) {
        this._itemViews[i].setCooldown(cdInfo.remaining, cdInfo.total);
        this._itemViews[i].setProduceCharges(0, 0);
      } else if (
        cdInfo &&
        cdInfo.chargesMax !== undefined &&
        cdInfo.chargesMax > 0 &&
        (cdInfo.chargesLeft ?? 0) > 0
      ) {
        this._itemViews[i].setCooldown(0, 0);
        this._itemViews[i].setProduceCharges(cdInfo.chargesLeft ?? 0, cdInfo.chargesMax);
      }
    }
    const dt = Game.ticker.deltaMS / 1000;
    this._guideLineSystem.update(dt);
    this._mergeHintSystem.update(dt);
  }

  // ========== 事件绑定 ==========

  private _bindEvents(): void {
    EventBus.on('board:merged', (_src: number, _dst: number, resultId: string, resultCell: number) => {
      this._mergeHintSystem.resetIdle();
      this.refresh();
      this._playMergeFlash(resultCell);
      const scheduleSelect = (): void => {
        Promise.resolve().then(() => {
          if (resultCell < 0 || resultCell >= this._cellViews.length || !resultId) return;
          const cell = BoardManager.getCellByIndex(resultCell);
          if (cell?.itemId) {
            this._selectItem(resultCell, cell.itemId);
          } else {
            this._selectItem(resultCell, resultId);
          }
        });
      };
      if (resultCell >= 0 && resultCell < this._itemViews.length) {
        this._itemViews[resultCell].playMergeSpawnIn(scheduleSelect);
      } else {
        scheduleSelect();
      }
    });
    EventBus.on('board:moved', () => this.refresh());
    EventBus.on('board:swapped', () => this.refresh());
    EventBus.on('board:cellUnlocked', () => this.refresh());
    EventBus.on('board:cellsPeeked', (indices: number[]) => {
      this._playFogToPeekAnim(indices);
    });
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
    EventBus.on('building:chestNeedsSpace', (_idx: number, n: number) => {
      ToastMessage.show(`棋盘空格不足，还剩 ${n} 件待发，腾出格子后再试`);
    });
    EventBus.on('building:chestPartial', (_idx: number, n: number) => {
      ToastMessage.show(`已散落部分奖励，还剩 ${n} 件待发`);
    });
    EventBus.on('customer:lockChanged', () => this.refresh());
    EventBus.on('customer:delivered', () => this.refresh());

    // 出售物品
    EventBus.on('board:requestSell', (cellIndex: number, _itemId: string) => {
      this._handleSellItem(cellIndex);
    });
  }

  /** 出售物品 */
  private _handleSellItem(cellIndex: number): void {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell || !cell.itemId) return;

    // 未解锁区域不可出售
    if (cell.state !== CellState.OPEN) return;

    const def = ITEM_DEFS.get(cell.itemId);
    if (!def) return;

    BoardManager.removeItem(cellIndex);
    ToastMessage.show(`已出售 ${def.name}（腾出棋盘一格）`);
    EventBus.emit('board:itemSold', cellIndex);
  }

  // ========== 拖拽 + 点击交互 ==========
  //
  // 核心策略：pointerdown 用 PixiJS 容器事件（可靠：PixiJS 注册在 canvas 上）；
  // pointermove / pointerup 直接注册在 canvas 元素上，**完全绕过 PixiJS 事件系统**。
  //
  // 原因：PixiJS 7 将 pointermove/pointerup 注册在 globalThis（window）上，
  // 而微信小游戏的 adapter 通过 canvas.addEventListener 分发触摸事件，
  // 两个系统天然隔离，导致拖拽事件丢失。
  // 直接在 canvas 上监听是小游戏环境中拖拽的标准做法。

  private _setupInteraction(): void {
    this.eventMode = 'static';
    this.hitArea = new PIXI.Rectangle(0, 0, DESIGN_WIDTH, BoardMetrics.areaHeight);

    // ---- pointerdown：通过 PixiJS 容器事件做命中测试 ----
    this.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._mergeHintSystem.resetIdle();

      const localPos = this.toLocal(e.global);
      const cellIdx = this._hitTestCell(localPos.x, localPos.y);
      if (cellIdx < 0) return;

      this._dragSrcIndex = cellIdx;
      this._longPressTriggered = false;
      const cell = BoardManager.getCellByIndex(cellIdx);
      if (!cell) return;

      if (cell.state === CellState.KEY) return;
      // 工具/宝箱也可拖拽合成与移动；松手仍在原格时由 handleRawUp → _handleTap 触发点击产出

      // 长按检测：0.8秒后弹出合成线面板（含工具链）
      if (cell.itemId && cell.state === CellState.OPEN) {
        const def = ITEM_DEFS.get(cell.itemId);
        const chain = getMergeChain(cell.itemId);
        if (def && chain.length > 1) {
          this._clearLongPress();
          const pressItemId = cell.itemId;
          this._longPressTimer = setTimeout(() => {
            this._longPressTriggered = true;
            // 取消拖拽
            if (this._dragGhost) {
              MergeManager.cancelDrag();
              this._endDrag();
            }
            this._dragSrcIndex = -1;
            // 弹出合成线面板
            EventBus.emit('mergeChain:open', pressItemId);
          }, 800);
        }
      }

      if (cell.itemId && cell.state === CellState.OPEN) {
        if (MergeManager.startDrag(cellIdx)) {
          this._startDragGhost(cellIdx, localPos);
          this._cacheAndHighlightTargets(cellIdx);
          this._guideLineSystem.startGuide(cellIdx);
        }
      }
    });

    // ---- pointermove / pointerup：直接注册在 canvas 上 ----
    const canvas = Game.app.view as any;

    canvas.addEventListener('pointermove', (e: any) => {
      if (this._dragSrcIndex < 0 || !this._dragGhost) return;
      // 开始拖动后取消长按检测
      this._clearLongPress();
      const localPos = this._rawToLocal(e);
      this._moveDragGhost(localPos);
    });

    const handleRawUp = (e: any) => {
      this._clearLongPress();
      if (this._dragSrcIndex < 0) return;
      // 长按已触发合成线面板，忽略抬手操作
      if (this._longPressTriggered) {
        this._longPressTriggered = false;
        return;
      }
      const srcIdx = this._dragSrcIndex;

      if (this._dragGhost) {
        const localPos = this._rawToLocal(e);
        const targetIdx = this._dragHoverIndex >= 0
          ? this._dragHoverIndex
          : this._hitTestCell(localPos.x, localPos.y);

        // 拖到棋盘外下方区域 → 尝试存入仓库
        if (targetIdx < 0 && localPos.y > BoardMetrics.areaHeight) {
          const cell = BoardManager.getCellByIndex(srcIdx);
          if (cell?.itemId) {
            const def = ITEM_DEFS.get(cell.itemId);
            if (def && def.storable) {
              const toolState = BuildingManager.snapshotToolStateAt(srcIdx);
              if (WarehouseManager.storeItem(cell.itemId, toolState ?? undefined)) {
                BoardManager.removeItem(srcIdx);
                MergeManager.cancelDrag();
                this._endDrag();
                this._dragSrcIndex = -1;
                ToastMessage.show('已存入仓库');
                return;
              } else {
                ToastMessage.show('仓库已满');
              }
            }
          }
        }

        if (targetIdx >= 0 && targetIdx !== srcIdx) {
          const result = MergeManager.endDrag(targetIdx);
          if (
            result.kind === 'merged'
            || result.kind === 'moved'
            || result.kind === 'swapped'
            || result.kind === 'lucky_coin'
          ) {
            this._playDropBounce(targetIdx);
          }
          if (result.kind === 'lucky_coin') {
            ToastMessage.show(result.direction === 'up' ? '幸运升级！' : '降级了…');
          }
          if (result.kind === 'lucky_coin_fail') {
            ToastMessage.show(result.toast);
          }
          // 移入空格 / 互换：选中框跟到目标格上的物品
          if (result.kind === 'moved' || result.kind === 'swapped') {
            const cellAfter = BoardManager.getCellByIndex(targetIdx);
            if (cellAfter?.itemId) {
              this._selectItem(targetIdx, cellAfter.itemId);
            }
          }
        } else {
          // 原地释放（没有实际拖拽到其他格子）→ 当作点击，触发选中
          MergeManager.cancelDrag();
          this._endDrag();
          this._handleTap(srcIdx);
          this._dragSrcIndex = -1;
          return;
        }
        this._endDrag();
      } else {
        this._handleTap(srcIdx);
      }

      this._dragSrcIndex = -1;
    };

    canvas.addEventListener('pointerup', handleRawUp);
    canvas.addEventListener('pointercancel', () => {
      this._clearLongPress();
      if (this._dragGhost) {
        MergeManager.cancelDrag();
        this._endDrag();
      }
      this._dragSrcIndex = -1;
    });
  }

  /**
   * 将原始 pointer 事件的 clientX/Y 转换为 BoardView 本地坐标。
   * PixiJS 全局坐标 = clientX * dpr（因为 resolution=1, canvas.width=screenWidth*dpr）。
   * 然后手动除以 stageScale 并减去 BoardView 偏移，不依赖 toLocal / worldTransform。
   */
  private _rawToLocal(e: any): PIXI.IPointData {
    const cx = e.clientX ?? e.x ?? 0;
    const cy = e.clientY ?? e.y ?? 0;
    // clientX (逻辑像素) → 设计坐标：乘以 designWidth / screenWidth
    const designX = cx * Game.designWidth / Game.screenWidth;
    const designY = cy * Game.designWidth / Game.screenWidth;
    return {
      x: designX,
      y: designY - BoardMetrics.topY,
    };
  }

  /** 棋盘局部坐标 → 拖拽幽灵父容器坐标（未挂载外层父时仍为棋盘局部） */
  private _ghostPosInParent(boardLocalX: number, boardLocalY: number): PIXI.Point {
    if (!this._dragGhostParent) {
      return new PIXI.Point(boardLocalX, boardLocalY);
    }
    const g = this.toGlobal(new PIXI.Point(boardLocalX, boardLocalY));
    return this._dragGhostParent.toLocal(g);
  }

  /** 移动幽灵：跟手 + 靠近有效目标时吸附 */
  private _moveDragGhost(localPos: PIXI.IPointData): void {
    if (!this._dragGhost) return;
    const cs = BoardMetrics.cellSize;
    // 手指上方偏移，避免遮挡
    const gx = localPos.x;
    const gy = localPos.y - cs * 0.4;

    const hoverIdx = this._hitTestCell(localPos.x, localPos.y);

    // 靠近可合成或可放置的目标时吸附到格子中心
    if (hoverIdx >= 0 && hoverIdx !== this._dragSrcIndex) {
      const isValidTarget = this._mergeTargets.has(hoverIdx)
        || this._isEmptyOpenCell(hoverIdx)
        || this._canSwapWithHover(hoverIdx);
      if (isValidTarget) {
        const center = this._getCellCenter(hoverIdx);
        const p = this._ghostPosInParent(center.x, center.y);
        this._dragGhost.position.set(p.x, p.y);
        if (this._dragHoverIndex !== hoverIdx) {
          this._setHoverHighlight(hoverIdx);
        }
        return;
      }
    }

    // 未吸附：跟手
    const p = this._ghostPosInParent(gx, gy);
    this._dragGhost.position.set(p.x, p.y);
    if (this._dragHoverIndex >= 0) {
      this._setHoverHighlight(-1);
    }
  }

  /** 设置/清除悬停格缩放反馈 */
  private _setHoverHighlight(idx: number): void {
    if (this._dragHoverIndex >= 0 && this._dragHoverIndex < this._cellViews.length) {
      this._cellViews[this._dragHoverIndex].scale.set(1);
    }
    this._dragHoverIndex = idx;
    if (idx >= 0 && idx < this._cellViews.length) {
      this._cellViews[idx].scale.set(1.06);
    }
  }

  /** 结束拖拽：清理所有拖拽状态 */
  private _endDrag(): void {
    this._setHoverHighlight(-1);
    this._clearDragGhost();
    this._clearMergePartnerHints();
    this._clearHighlights();
    this._mergeTargets.clear();
    this._guideLineSystem.endGuide();
  }

  /** 放下后目标格弹跳 */
  private _playDropBounce(cellIdx: number): void {
    const iv = this._itemViews[cellIdx];
    if (!iv) return;
    iv.scale.set(1.15, 1.15);
    TweenManager.to({
      target: iv.scale,
      props: { x: 1, y: 1 },
      duration: 0.2,
      ease: Ease.easeOutBack,
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

    // 点击空格 → 取消选中
    if (!cell.itemId) {
      this._deselectItem();
      return;
    }

    // 建筑 / 宝箱 → 产出（同时选中显示信息）
    if (BuildingManager.isInteractable(cell.itemId)) {
      this._selectItem(cellIndex, cell.itemId);

      if (BuildingManager.canProduce(cellIndex)) {
        const result = BuildingManager.produce(cellIndex);
        if (result) {
          this._playProduceAnim(cellIndex);
        }
      } else {
        this._shakeCell(cellIndex);
      }
      return;
    }

    // 双击检测：同一格子在 300ms 内连续点击 → 仅货币类快速使用；合成只能拖拽
    const now = Date.now();
    if (cellIndex === this._lastTapIndex && now - this._lastTapTime < 300) {
      if (this._tapTimer) {
        clearTimeout(this._tapTimer);
        this._tapTimer = null;
      }
      this._lastTapIndex = -1;
      this._lastTapTime = 0;
      const defTap = ITEM_DEFS.get(cell.itemId!);
      if (defTap?.category === Category.CURRENCY && defTap.currencyReward) {
        this._useCurrencyItem(cellIndex, defTap);
      } else {
        this._selectItem(cellIndex, cell.itemId!);
      }
      return;
    }

    // 记录本次点击，延迟 300ms 执行单击逻辑
    this._lastTapIndex = cellIndex;
    this._lastTapTime = now;
    if (this._tapTimer) clearTimeout(this._tapTimer);
    this._tapTimer = setTimeout(() => {
      this._tapTimer = null;
      this._selectItem(cellIndex, cell.itemId!);
    }, 300);
  }

  /**
   * 使用货币物品：先隐藏格内图标，由 MainScene 播放与客人交付一致的弧线飞入 TopBar，
   * 动画结束后再入账并移除格子（见 `board:currencyUseFly`）。
   */
  private _useCurrencyItem(
    cellIndex: number,
    def: import('@/config/ItemConfig').ItemDef,
  ): void {
    const reward = def.currencyReward!;
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId || cell.itemId !== def.id) return;

    this.setItemHiddenForDelivery(cellIndex, true);
    EventBus.emit('board:currencyUseFly', {
      cellIndex,
      itemId: def.id,
      currencyType: reward.type,
      iconKey: def.icon,
      amount: reward.amount,
    });
  }

  /** 选中物品 */
  private _selectItem(cellIndex: number, itemId: string): void {
    // 取消旧选中高亮
    if (this._selectedIndex >= 0 && this._selectedIndex < this._cellViews.length) {
      this._cellViews[this._selectedIndex].setHighlight(false);
    }
    this._selectedIndex = cellIndex;
    this._cellViews[cellIndex].setHighlight(true);
    // 仅完全开放格可拖动，与拖拽规则一致；半锁定(PEEK)等只做选中高亮，无缩放反馈
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (cell?.state === CellState.OPEN) {
      this._itemViews[cellIndex].playTapFeedback();
    }
    EventBus.emit('board:itemSelected', cellIndex, itemId);
  }

  /** 取消选中 */
  private _deselectItem(): void {
    if (this._selectedIndex >= 0 && this._selectedIndex < this._cellViews.length) {
      this._cellViews[this._selectedIndex].setHighlight(false);
    }
    this._selectedIndex = -1;
    EventBus.emit('board:selectionCleared');
  }

  /** 转发解锁格点击 → 确认弹窗 → 分享好友 → 分享完成后解锁 */
  private async _handleKeyCellTap(cellIndex: number): Promise<void> {
    const confirmed = await ConfirmDialog.show(
      '解锁格子',
      '转发给好友即可解锁该格子',
      '转发解锁',
      '取消',
    );
    if (!confirmed) return;

    const shared = await Platform.shareAndWait({
      title: '花语小筑 — 来帮我解锁新格子吧！',
      query: `unlock_cell=${cellIndex}`,
    });

    if (shared) {
      BoardManager.unlockKeyCell(cellIndex);
      ToastMessage.show('解锁成功！');
    } else {
      ToastMessage.show('分享取消，未解锁');
    }
  }

  // ========== 特效 ==========

  /** 合成闪光 + 扩散环 + 粒子（与 ItemView.playMergeSpawnIn 同步） */
  private _playMergeFlash(cellIndex: number): void {
    if (cellIndex < 0 || cellIndex >= this._cellViews.length) return;
    const cs = BoardMetrics.cellSize;
    const cellView = this._cellViews[cellIndex];
    const itemView = this._itemViews[cellIndex];
    const cx = cellView.x + cs / 2;
    const cy = cellView.y + cs / 2;

    /** 插在对应 ItemView 之下（物品层内），避免光效盖住新物品 */
    const insertBelowItem = (node: PIXI.DisplayObject): void => {
      const parent = itemView.parent;
      if (!parent) return;
      parent.addChildAt(node, parent.getChildIndex(itemView));
    };

    const flash = new PIXI.Graphics();
    flash.position.set(cellView.x, cellView.y);
    // 中心强光核
    flash.beginFill(0xFFFFFF, 0.95);
    flash.drawCircle(cs / 2, cs / 2, cs * 0.22);
    flash.endFill();
    flash.beginFill(0xFFF8E1, 0.75);
    flash.drawCircle(cs / 2, cs / 2, cs * 0.32);
    flash.endFill();
    // 星点环
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const len = cs * 0.38;
      flash.beginFill(0xFFE082, 0.85);
      flash.drawCircle(cs / 2 + Math.cos(angle) * len, cs / 2 + Math.sin(angle) * len, 4);
      flash.endFill();
    }

    flash.scale.set(0.45);
    insertBelowItem(flash);

    TweenManager.to({
      target: flash,
      props: { alpha: 0 },
      duration: 0.48,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: flash.scale,
      props: { x: 1.85, y: 1.85 },
      duration: 0.48,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        this.removeChild(flash);
        flash.destroy();
      },
    });

    // 双层扩散环（描边）
    for (let r = 0; r < 2; r++) {
      const ring = new PIXI.Graphics();
      ring.lineStyle(3 - r, r === 0 ? 0xFFD54F : 0xFFFFFF, 0.9);
      ring.drawCircle(0, 0, cs * 0.28);
      ring.position.set(cx, cy);
      ring.scale.set(0.35 + r * 0.08);
      insertBelowItem(ring);

      TweenManager.to({
        target: ring,
        props: { alpha: 0 },
        duration: 0.5,
        delay: r * 0.05,
        ease: Ease.easeOutQuad,
      });
      TweenManager.to({
        target: ring.scale,
        props: { x: 1.55 + r * 0.15, y: 1.55 + r * 0.15 },
        duration: 0.5,
        delay: r * 0.05,
        ease: Ease.easeOutQuad,
        onComplete: () => {
          if (ring.parent) {
            ring.parent.removeChild(ring);
            ring.destroy();
          }
        },
      });
    }

    // 径向飞散粒子
    const n = 12;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + Math.random() * 0.25;
      const g = new PIXI.Graphics();
      const warm = i % 3 === 0 ? 0xFFFFFF : (i % 3 === 1 ? 0xFFE082 : 0xFFCA28);
      g.beginFill(warm, 0.95);
      g.drawCircle(0, 0, 2.5 + Math.random() * 2);
      g.endFill();
      g.position.set(cx, cy);
      this.addChild(g);

      const dist = cs * (0.42 + Math.random() * 0.12);
      const endX = cx + Math.cos(angle) * dist;
      const endY = cy + Math.sin(angle) * dist;

      TweenManager.to({
        target: g,
        props: { alpha: 0 },
        duration: 0.42,
        ease: Ease.easeOutQuad,
      });
      TweenManager.to({
        target: g.position,
        props: { x: endX, y: endY },
        duration: 0.42,
        ease: Ease.easeOutQuad,
        onComplete: () => {
          if (g.parent) {
            g.parent.removeChild(g);
            g.destroy();
          }
        },
      });
    }
  }

  /** FOG→PEEK 过渡动画：礼盒缩小消失 + 丝带+物品淡入 */
  private _playFogToPeekAnim(indices: number[]): void {
    const cs = BoardMetrics.cellSize;

    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const cellView = this._cellViews[idx];
      if (!cellView) continue;

      const delay = i * 0.12;

      // 在旧 cellView 位置上创建一个临时礼盒精灵做消失动画
      const lockTex = TextureCache.get('cell_locked');
      if (lockTex) {
        const oldGift = new PIXI.Sprite(lockTex);
        const fitSize = cs * 1.0;
        const scale = Math.min(fitSize / lockTex.width, fitSize / lockTex.height);
        oldGift.scale.set(scale);
        oldGift.anchor.set(0.5, 0.5);
        oldGift.position.set(cellView.x + cs / 2, cellView.y + cs / 2);
        this.addChild(oldGift);

        // 绸缎旋转缩小消失
        TweenManager.to({
          target: oldGift,
          props: { alpha: 0, rotation: 0.5 },
          duration: 0.4,
          delay,
          ease: Ease.easeInBack,
        });
        TweenManager.to({
          target: oldGift.scale,
          props: { x: 0, y: 0 },
          duration: 0.4,
          delay,
          ease: Ease.easeInBack,
          onComplete: () => {
            this.removeChild(oldGift);
            oldGift.destroy();
          },
        });
      }

      // 延迟后刷新格子状态 + 显示新的丝带和物品（带弹出效果）
      const refreshDelay = delay + 0.35;
      const proxy = { t: 0 };
      TweenManager.to({
        target: proxy,
        props: { t: 1 },
        duration: 0.01,
        delay: refreshDelay,
        onComplete: () => {
          // 刷新该格子的 CellView 和 ItemView
          const cell = BoardManager.cells[idx];
          if (cell) {
            cellView.setState(cell.state);
            const itemView = this._itemViews[idx];
            if (cell.itemId && itemView) {
              itemView.setItem(cell.itemId);
              itemView.alpha = 1;
            }

            // PEEK 丝带（在物品层内；若 merge 已 refresh 则不再重复 intro）
            if (cell.state === CellState.PEEK && itemView) {
              itemView.setPeekRibbon(true, { intro: true });
            }
          }
        },
      });
    }
  }

  /** 建筑产出动画 */
  private _playProduceAnim(srcIndex: number): void {
    this._shakeCell(srcIndex);
  }

  /** 格子抖动反馈（基于 TweenManager，不依赖原生定时器） */
  private _shakeCell(cellIndex: number): void {
    const cellView = this._cellViews[cellIndex];
    if (!cellView) return;
    const itemView = this._itemViews[cellIndex];
    const origCellX = cellView.x;
    const origItemX = itemView ? itemView.x : origCellX;
    const steps = [4, -4, 3, -3, 1, -1, 0];
    const stepDuration = 0.035;
    const proxy = { t: 0 };
    TweenManager.to({
      target: proxy,
      props: { t: 1 },
      duration: steps.length * stepDuration,
      onUpdate: () => {
        const idx = Math.min(Math.floor(proxy.t * steps.length), steps.length - 1);
        const dx = steps[idx];
        cellView.x = origCellX + dx;
        if (itemView) itemView.x = origItemX + dx;
      },
      onComplete: () => {
        cellView.x = origCellX;
        if (itemView) itemView.x = origItemX;
      },
    });
  }

  // ========== 工具方法 ==========

  /** 清除长按检测计时器 */
  private _clearLongPress(): void {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
  }

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

  /** 创建轻量拖拽幽灵（仅 Sprite + 阴影，不创建 Text/Graphics） */
  private _startDragGhost(cellIdx: number, _pos?: PIXI.IPointData): void {
    this._clearDragGhost();
    const cell = BoardManager.getCellByIndex(cellIdx);
    if (!cell?.itemId) return;

    const cs = BoardMetrics.cellSize;
    const def = ITEM_DEFS.get(cell.itemId);
    const ghost = new PIXI.Container();

    // 底部椭圆阴影（模拟悬浮）
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.12);
    shadow.drawEllipse(0, cs * 0.38, cs * 0.32, cs * 0.08);
    shadow.endFill();
    ghost.addChild(shadow);

    // 物品图标
    const tex = def ? TextureCache.get(def.icon) : null;
    if (tex) {
      const sprite = new PIXI.Sprite(tex);
      const maxS = cs - 8;
      const s = Math.min(maxS / tex.width, maxS / tex.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      ghost.addChild(sprite);
      // 与 ItemView 一致：仅可产出工具叠闪光与体力角标
      const producerDef = def ? findBoardProducerDef(def.id) : undefined;
      if (producerDef?.canProduce) {
        const spark = new ToolSparkleLayer(cs, cs);
        spark.position.set(-cs / 2, -cs / 2);
        ghost.addChild(spark);
        const hw = (tex.width * s) / 2;
        const hh = (tex.height * s) / 2;
        const shell = new PIXI.Container();
        shell.position.set(-hw, -hh);
        const energy = createToolEnergySprite(hw * 2, hh * 2, { maxSideFrac: 0.34, pad: 5 });
        if (energy) shell.addChild(energy);
        ghost.addChild(shell);
      }
    } else {
      const fallback = new PIXI.Graphics();
      fallback.beginFill(0xFFB74D, 0.5);
      fallback.drawCircle(0, 0, cs * 0.28);
      fallback.endFill();
      ghost.addChild(fallback);
    }

    // 从格子中心弹出，确保位置精确；挂到场景根容器以便拖过底栏/仓库区时不被遮挡
    const center = this._getCellCenter(cellIdx);
    const p0 = this._ghostPosInParent(center.x, center.y);
    ghost.position.set(p0.x, p0.y);
    ghost.scale.set(0.6);
    ghost.alpha = 0.9;
    if (this._dragGhostParent) {
      this._dragGhostParent.addChild(ghost);
    } else {
      this.addChild(ghost);
    }
    this._dragGhost = ghost;

    // "拿起"弹跳放大
    TweenManager.to({
      target: ghost.scale,
      props: { x: 1.12, y: 1.12 },
      duration: 0.12,
      ease: Ease.easeOutBack,
    });

    // 源物品半透明
    this._itemViews[cellIdx].alpha = 0.25;

    this._applyMergePartnerHints(cellIdx, cell.itemId);
  }

  /** 拿起物品时：已解锁格中同 itemId 的格子底变色（不含源格） */
  private _applyMergePartnerHints(srcIdx: number, itemId: string): void {
    this._clearMergePartnerHints();
    for (let i = 0; i < BoardManager.cells.length; i++) {
      if (i === srcIdx) continue;
      const c = BoardManager.getCellByIndex(i);
      if (!c?.itemId || c.itemId !== itemId) continue;
      if (c.state !== CellState.OPEN && c.state !== CellState.PEEK) continue;
      this._cellViews[i].setMergePartnerHint(true);
    }
  }

  private _clearMergePartnerHints(): void {
    for (let i = 0; i < this._cellViews.length; i++) {
      this._cellViews[i].setMergePartnerHint(false);
    }
  }

  private _clearDragGhost(): void {
    if (this._dragGhost) {
      const g = this._dragGhost;
      TweenManager.cancelTarget(g.scale);
      TweenManager.cancelTarget(g);
      if (g.parent) {
        g.parent.removeChild(g);
      }
      g.destroy({ children: true });
      this._dragGhost = null;
    }
    if (this._dragSrcIndex >= 0) {
      const cell = BoardManager.getCellByIndex(this._dragSrcIndex);
      if (cell?.state === CellState.OPEN) {
        this._itemViews[this._dragSrcIndex].alpha = 1;
      }
    }
  }

  /** 缓存可合成目标（仅计算一次）；幸运金币额外包含可升降一级的合法目标格 */
  private _cacheAndHighlightTargets(srcIndex: number): void {
    this._mergeTargets.clear();
    const src = BoardManager.getCellByIndex(srcIndex);
    const dragLuckyCoin = !!(src?.itemId && isLuckyCoinItem(src.itemId));
    for (let i = 0; i < BoardManager.cells.length; i++) {
      if (i === srcIndex) continue;
      if (BoardManager.canMerge(srcIndex, i)) {
        this._mergeTargets.add(i);
      }
      if (dragLuckyCoin && BoardManager.isLuckyCoinHighlightTarget(srcIndex, i)) {
        this._mergeTargets.add(i);
      }
    }
  }

  private _clearHighlights(): void {
    // no-op: merge targets no longer use cell highlight
  }

  /** 格子中心（BoardView 局部坐标），供交付飞入动画等使用 */
  getCellCenterLocal(cellIdx: number): { x: number; y: number } | null {
    if (cellIdx < 0 || cellIdx >= this._cellViews.length) return null;
    return this._getCellCenter(cellIdx);
  }

  /** 格子中心在任意祖先容器内的局部坐标（签到奖励等飞入棋盘） */
  getCellCenterInAncestor(ancestor: PIXI.Container, cellIdx: number): PIXI.Point | null {
    const local = this.getCellCenterLocal(cellIdx);
    if (!local) return null;
    const g = this.toGlobal(new PIXI.Point(local.x, local.y));
    return ancestor.toLocal(g);
  }

  /** 交付飞行动画期间暂时隐藏格内物品，避免与飞行图标重叠 */
  setItemHiddenForDelivery(cellIndex: number, hidden: boolean): void {
    if (cellIndex < 0 || cellIndex >= this._itemViews.length) return;
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId) return;
    this._itemViews[cellIndex].visible = !hidden;
  }

  /** 获取格子中心坐标 */
  private _getCellCenter(cellIdx: number): { x: number; y: number } {
    const cs = BoardMetrics.cellSize;
    const col = cellIdx % BOARD_COLS;
    const row = Math.floor(cellIdx / BOARD_COLS);
    return {
      x: BoardMetrics.paddingX + col * (cs + CELL_GAP) + cs / 2,
      y: this._gridOffsetY + row * (cs + CELL_GAP) + cs / 2,
    };
  }

  private _isEmptyOpenCell(cellIdx: number): boolean {
    const cell = BoardManager.getCellByIndex(cellIdx);
    return !!cell && cell.state === CellState.OPEN && !cell.itemId;
  }

  /** 拖拽目标格有物品且将触发互换（非可合成格已在 mergeTargets 中） */
  private _canSwapWithHover(hoverIdx: number): boolean {
    const srcIdx = this._dragSrcIndex;
    if (srcIdx < 0) return false;
    const src = BoardManager.getCellByIndex(srcIdx);
    const dst = BoardManager.getCellByIndex(hoverIdx);
    if (!src || !dst) return false;
    if (src.state !== CellState.OPEN || dst.state !== CellState.OPEN) return false;
    if (!src.itemId || !dst.itemId) return false;
    if (BoardManager.canMerge(srcIdx, hoverIdx)) return false;
    return true;
  }
}
