/**
 * 棋盘视图 - 管理所有格子和物品的渲染与交互
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { BOARD_COLS, BOARD_ROWS, CELL_GAP, BoardMetrics, COLORS, DESIGN_WIDTH } from '@/config/Constants';
import { CellState } from '@/config/BoardLayout';
import { ITEM_DEFS, Category } from '@/config/ItemConfig';
import { BoardManager } from '@/managers/BoardManager';
import { MergeManager } from '@/managers/MergeManager';
import { BuildingManager } from '@/managers/BuildingManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { Platform } from '@/core/PlatformService';
import { TextureCache } from '@/utils/TextureCache';
import { createToolEnergySprite, isBoardToolCategory } from '@/utils/ToolEnergyBadge';
import { CellView } from './CellView';
import { ItemView } from './ItemView';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ToastMessage } from '../ui/ToastMessage';
import { WarehouseManager } from '@/managers/WarehouseManager';
import { MergeGuideLineSystem } from '@/systems/MergeGuideLineSystem';
import { MergeHintSystem } from '@/systems/MergeHintSystem';
import { SeasonSystem } from '@/systems/SeasonSystem';

export class BoardView extends PIXI.Container {
  private _cellViews: CellView[] = [];
  private _itemViews: ItemView[] = [];
  private _peekOverlays: PIXI.Sprite[] = [];
  private _dragGhost: PIXI.Container | null = null;
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

  constructor() {
    super();
    this.position.set(0, BoardMetrics.topY);
    this._drawBoardArea();
    this._buildGrid();
    this._bindEvents();
    this._setupInteraction();
    this._guideLineSystem = new MergeGuideLineSystem(this);
    this._mergeHintSystem = new MergeHintSystem(this._itemViews);
  }

  private _drawBoardArea(): void {
    const w = DESIGN_WIDTH;
    const h = BoardMetrics.areaHeight;
    const BAR_H = 14;

    // 木纹底图或纯色填充
    const tex = TextureCache.get('board_bg');
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.width = w;
      sp.height = h;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xFFFFFF);
      mask.drawRoundedRect(0, 0, w, h, 8);
      mask.endFill();
      this.addChild(mask);
      sp.mask = mask;
      this.addChild(sp);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(COLORS.CELL_OPEN, 0.35);
      bg.drawRoundedRect(0, 0, w, h, 8);
      bg.endFill();
      this.addChild(bg);
    }

    // 装饰横条（上方紧贴棋盘顶部外侧，下方紧贴棋盘底部外侧）
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
    }
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
    // 清理旧的 PEEK 丝带 overlay
    for (const ov of this._peekOverlays) {
      this.removeChild(ov);
      ov.destroy();
    }
    this._peekOverlays.length = 0;

    const cs = BoardMetrics.cellSize;

    for (let i = 0; i < BoardManager.cells.length; i++) {
      const cell = BoardManager.cells[i];
      const cellView = this._cellViews[i];
      const itemView = this._itemViews[i];

      cellView.setState(cell.state);

      if (cell.state === CellState.PEEK && cell.itemId) {
        itemView.setItem(cell.itemId);
        itemView.alpha = 1;
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

      // PEEK 丝带 overlay（叠在 ItemView 之上）
      if (cell.state === CellState.PEEK) {
        const peekTex = TextureCache.get('cell_peek');
        if (peekTex) {
          const sp = new PIXI.Sprite(peekTex);
          const fitSize = cs * 1.0;
          const scale = Math.min(fitSize / peekTex.width, fitSize / peekTex.height);
          sp.scale.set(scale);
          sp.anchor.set(0.5, 0.5);
          sp.position.set(cellView.x + cs / 2, cellView.y + cs / 2);
          this.addChild(sp);
          this._peekOverlays.push(sp);
        }
      }
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
    const dt = Game.ticker.deltaMS / 1000;
    this._guideLineSystem.update(dt);
    this._mergeHintSystem.update(dt);
  }

  // ========== 事件绑定 ==========

  private _bindEvents(): void {
    EventBus.on('board:merged', (_src: number, _dst: number, _resultId: string, resultCell: number) => {
      this._mergeHintSystem.resetIdle();
      this.refresh();
      this._playMergeFlash(resultCell);
    });
    EventBus.on('board:moved', () => this.refresh());
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

    // 计算售价：基于等级（冬天甜品线季节加成）
    let sellPrice = def.level * 5 + (def.category === 'flower' ? 5 : 3);
    sellPrice = Math.floor(sellPrice * SeasonSystem.getSellPriceMultiplier(def.line));
    CurrencyManager.addGold(sellPrice);
    BoardManager.removeItem(cellIndex);
    ToastMessage.show(`出售 ${def.name}，获得 ${sellPrice}💰`);
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

      // 长按检测：0.8秒后弹出合成线面板
      if (cell.itemId && cell.state === CellState.OPEN) {
        const def = ITEM_DEFS.get(cell.itemId);
        if (def && def.maxLevel > 1 && def.category !== Category.BUILDING) {
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
            if (def && def.category !== Category.BUILDING) {
              if (WarehouseManager.storeItem(cell.itemId)) {
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
          if (result === 'merged' || result === 'moved') {
            this._playDropBounce(targetIdx);
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
        || this._isEmptyOpenCell(hoverIdx);
      if (isValidTarget) {
        const center = this._getCellCenter(hoverIdx);
        this._dragGhost.position.set(center.x, center.y);
        if (this._dragHoverIndex !== hoverIdx) {
          this._setHoverHighlight(hoverIdx);
        }
        return;
      }
    }

    // 未吸附：跟手
    this._dragGhost.position.set(gx, gy);
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
          this._playProduceAnim(cellIndex, result.targetIndex);
        }
      } else {
        this._shakeCell(cellIndex);
      }
      return;
    }

    // 双击检测：同一格子在 300ms 内连续点击 → 快速合成
    const now = Date.now();
    if (cellIndex === this._lastTapIndex && now - this._lastTapTime < 300) {
      // 清除单击延迟
      if (this._tapTimer) {
        clearTimeout(this._tapTimer);
        this._tapTimer = null;
      }
      this._lastTapIndex = -1;
      this._lastTapTime = 0;
      this._handleDoubleTap(cellIndex);
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

  /** 双击快速合成：自动搜索棋盘上最近的同类物品进行合成 */
  private _handleDoubleTap(cellIndex: number): void {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell?.itemId) return;

    const def = ITEM_DEFS.get(cell.itemId);
    if (!def || def.level >= def.maxLevel) {
      this._selectItem(cellIndex, cell.itemId);
      return;
    }

    // 寻找最近的同类物品
    // 注意：双击合成是用户主动操作，不应受客人锁定(reserved)限制
    // 合成完成后客人系统会自动重新扫描锁定(_rescanAll)
    const srcCol = cellIndex % BOARD_COLS;
    const srcRow = Math.floor(cellIndex / BOARD_COLS);
    let bestIdx = -1;
    let bestDist = Infinity;

    for (let i = 0; i < BoardManager.cells.length; i++) {
      if (i === cellIndex) continue;
      const other = BoardManager.cells[i];
      if (other.state !== CellState.OPEN || other.itemId !== cell.itemId) continue;
      // 不再跳过 reserved 物品：双击合成优先级高于客人锁定

      const col = i % BOARD_COLS;
      const row = Math.floor(i / BOARD_COLS);
      const dist = Math.abs(col - srcCol) + Math.abs(row - srcRow);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      // 执行合成
      if (MergeManager.startDrag(cellIndex)) {
        const result = MergeManager.endDrag(bestIdx);
        if (result === 'merged') {
          this._playDropBounce(bestIdx);
          ToastMessage.show('快速合成！');
        }
      }
    } else {
      // 没有可合成目标，回退到选中
      this._selectItem(cellIndex, cell.itemId);
      ToastMessage.show('没有可合成的同类物品');
    }
  }

  /** 选中物品 */
  private _selectItem(cellIndex: number, itemId: string): void {
    // 取消旧选中高亮
    if (this._selectedIndex >= 0 && this._selectedIndex < this._cellViews.length) {
      this._cellViews[this._selectedIndex].setHighlight(false);
    }
    this._selectedIndex = cellIndex;
    this._cellViews[cellIndex].setHighlight(true);
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

            // PEEK 丝带 overlay
            const peekTex = TextureCache.get('cell_peek');
            if (cell.state === CellState.PEEK && peekTex) {
              const ribbon = new PIXI.Sprite(peekTex);
              const fitRibbon = cs * 1.0;
              const rScale = Math.min(fitRibbon / peekTex.width, fitRibbon / peekTex.height);
              ribbon.scale.set(0);
              ribbon.anchor.set(0.5, 0.5);
              ribbon.position.set(cellView.x + cs / 2, cellView.y + cs / 2);
              ribbon.alpha = 0;
              this.addChild(ribbon);
              this._peekOverlays.push(ribbon);

              TweenManager.to({
                target: ribbon,
                props: { alpha: 1 },
                duration: 0.3,
              });
              TweenManager.to({
                target: ribbon.scale,
                props: { x: rScale, y: rScale },
                duration: 0.4,
                ease: Ease.easeOutBack,
              });
            }
          }
        },
      });
    }
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
      if (def && isBoardToolCategory(def.category)) {
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

    // 从格子中心弹出，确保位置精确
    const center = this._getCellCenter(cellIdx);
    ghost.position.set(center.x, center.y);
    ghost.scale.set(0.6);
    ghost.alpha = 0.9;
    this.addChild(ghost);
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
  }

  private _clearDragGhost(): void {
    if (this._dragGhost) {
      this.removeChild(this._dragGhost);
      this._dragGhost.destroy({ children: true });
      this._dragGhost = null;
    }
    if (this._dragSrcIndex >= 0) {
      const cell = BoardManager.getCellByIndex(this._dragSrcIndex);
      if (cell?.state === CellState.OPEN) {
        this._itemViews[this._dragSrcIndex].alpha = 1;
      }
    }
  }

  /** 缓存可合成目标（仅计算一次） */
  private _cacheAndHighlightTargets(srcIndex: number): void {
    this._mergeTargets.clear();
    for (let i = 0; i < BoardManager.cells.length; i++) {
      if (i === srcIndex) continue;
      if (BoardManager.canMerge(srcIndex, i)) {
        this._mergeTargets.add(i);
      }
    }
  }

  private _clearHighlights(): void {
    // no-op: merge targets no longer use cell highlight
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
}
