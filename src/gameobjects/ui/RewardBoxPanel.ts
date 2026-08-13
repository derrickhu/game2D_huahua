/**
 * 奖励收纳框 — 展开面板
 *
 * 紧贴触发图标下方：顶角小三角指向收纳按钮（气泡对话框式），
 * 内为物品网格；相同物品堆叠角标，双击格取物到棋盘；可滚动。
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { Game } from '@/core/Game';
import { CELL_GAP, DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, usesLargeBoardIconFill } from '@/config/ItemConfig';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { BoardManager } from '@/managers/BoardManager';
import { AdManager, AdScene } from '@/managers/AdManager';
import { TextureCache } from '@/utils/TextureCache';
import { ToastMessage } from './ToastMessage';
import { ConfirmDialog } from './ConfirmDialog';

const GRID_COLS = 6;
const PANEL_W = 540;
const PANEL_PAD = 16;
const HEADER_H = 48;
const GRID_GAP = CELL_GAP;
const ITEM_FILL = 0.72;
const BOUQUET_FILL = 0.9;
const MAX_VISIBLE_ROWS = 5;
/** 滑动超过该设计像素后视为滚动，不再当作点击 */
const DRAG_THRESHOLD = 4;

/** 气泡尖角高度 */
const TAIL_H = 12;
/** 尖角底边半宽 */
const TAIL_HALF_W = 15;
/** 图标底边与尖角顶端的间距 */
const ANCHOR_GAP = 5;
const SCREEN_MARGIN = 12;

function nativeClientToDesignY(clientY: number): number {
  return Game.clientToDesign(0, clientY).y;
}

function federatedPointerToDesignY(e: PIXI.FederatedPointerEvent): number {
  const native = e.nativeEvent as PointerEvent | MouseEvent | undefined;
  if (native != null && typeof (native as PointerEvent).clientY === 'number') {
    return nativeClientToDesignY((native as PointerEvent).clientY);
  }
  return Game.globalToDesign(e.global.x, e.global.y).y;
}

function rawEventToDesignY(ev: PointerEvent | MouseEvent | TouchEvent | any): number {
  if (ev && typeof ev.clientY === 'number') {
    return nativeClientToDesignY(ev.clientY);
  }
  if (ev?.touches?.[0] && typeof ev.touches[0].clientY === 'number') {
    return nativeClientToDesignY(ev.touches[0].clientY);
  }
  if (ev?.changedTouches?.[0] && typeof ev.changedTouches[0].clientY === 'number') {
    return nativeClientToDesignY(ev.changedTouches[0].clientY);
  }
  return 0;
}

export class RewardBoxPanel extends PIXI.Container {
  private _overlay!: PIXI.Graphics;
  private _card!: PIXI.Container;
  private _headerText!: PIXI.Text;
  private _gridContainer!: PIXI.Container;
  private _gridMask!: PIXI.Graphics;
  private _selectedItemId: string | null = null;
  private _isOpen = false;
  private _textureUnsub: (() => void) | null = null;

  /** 触发按钮底中心在覆盖层本地坐标 */
  private _anchorLocal: { x: number; y: number } | null = null;

  private _scrollY = 0;
  private _maxScrollY = 0;
  private _gridTop = 0;
  private _isDragging = false;
  private _dragStartDesignY = 0;
  private _scrollStartY = 0;
  private _velocity = 0;
  private _lastDragDesignY = 0;
  private _lastDragTime = 0;
  private _hasMoved = false;
  /** 滚动松手后短暂忽略 slot 点击，避免拖曳误触 */
  private _ignoreNextSlotTap = false;
  private _pendingTapItemId: string | null = null;
  private _scrollEnabled = false;

  private readonly _onCanvasMove = (ev: PointerEvent): void => {
    this._onDragMove(rawEventToDesignY(ev));
  };

  private readonly _onCanvasUp = (): void => {
    this._finishDrag();
  };

  private _cellSize = 0;
  private _gridInnerW = 0;
  private _gridVisibleH = 0;

  constructor() {
    super();
    this.visible = false;
    this._build();
  }

  private _build(): void {
    this._overlay = new PIXI.Graphics();
    this._overlay.beginFill(0x000000, 0.45);
    this._overlay.drawRect(0, 0, DESIGN_WIDTH, 3000);
    this._overlay.endFill();
    this._overlay.eventMode = 'static';
    this._overlay.on('pointerdown', () => this.close());
    this.addChild(this._overlay);

    this._card = new PIXI.Container();
    this._card.eventMode = 'static';
    this._card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._card);

    EventBus.on('rewardBox:changed', () => {
      if (this._isOpen) this._refreshGrid();
    });
  }

  /**
   * @param anchorX 触发按钮底中心在「本面板父节点」本地坐标中的 x
   * @param anchorY 同上 y（按钮底边）
   */
  openNear(anchorX: number, anchorY: number): void {
    if (RewardBoxManager.isEmpty) {
      ToastMessage.show('收纳框为空');
      return;
    }
    this._anchorLocal = { x: anchorX, y: anchorY };
    this._isOpen = true;
    this._textureUnsub?.();
    this._textureUnsub = TextureCache.observeTextureDependencies({ groups: ['items'] }, () => {
      if (this._isOpen) this._refreshGrid();
    });
    this._selectedItemId = null;
    this._scrollY = 0;
    this._ignoreNextSlotTap = false;
    this.visible = true;
    this._refreshGrid();

    this._overlay.alpha = 0;
    TweenManager.to({ target: this._overlay, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });

    this._card.alpha = 0;
    this._card.scale.set(0.96);
    TweenManager.to({ target: this._card, props: { alpha: 1 }, duration: 0.22, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._card.scale, props: { x: 1, y: 1 }, duration: 0.26, ease: Ease.easeOutBack });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._textureUnsub?.();
    this._textureUnsub = null;
    this._selectedItemId = null;
    this._cleanupDrag();

    TweenManager.to({
      target: this._overlay,
      props: { alpha: 0 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._card,
      props: { alpha: 0 },
      duration: 0.2,
      ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  get isOpen(): boolean { return this._isOpen; }

  private _refreshGrid(): void {
    // 重建前先卸掉 canvas 监听，避免旧闭包改已销毁的 grid
    this._cleanupDrag();

    while (this._card.children.length > 0) {
      const c = this._card.children[0];
      this._card.removeChild(c);
      c.destroy({ children: true });
    }

    const entries = RewardBoxManager.entries();
    if (entries.length === 0) {
      this.close();
      return;
    }

    const rows = Math.ceil(entries.length / GRID_COLS);
    const visibleRows = Math.min(rows, MAX_VISIBLE_ROWS);

    const innerW = PANEL_W - PANEL_PAD * 2;
    const cellSize = Math.floor((innerW - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);
    this._cellSize = cellSize;
    this._gridInnerW = innerW;

    const gridTotalH = rows * cellSize + (rows - 1) * GRID_GAP;
    const gridVisibleH = visibleRows * cellSize + (visibleRows - 1) * GRID_GAP;
    this._gridVisibleH = gridVisibleH;
    this._maxScrollY = Math.max(0, gridTotalH - gridVisibleH);
    this._scrollEnabled = rows > MAX_VISIBLE_ROWS;

    const panelInnerH = HEADER_H + gridVisibleH + PANEL_PAD;
    const totalH = TAIL_H + panelInnerH;

    // 气泡紧贴锚点：面板水平尽量居中于按钮，贴边 clamp 后尖角 x = 锚点 x - cardX，对准图标底中心
    const anchor = this._anchorLocal;
    let tailCx = PANEL_W / 2;
    let cardX = (DESIGN_WIDTH - PANEL_W) / 2;
    let cardY = (Game.logicHeight - totalH) / 2;

    if (anchor) {
      cardX = anchor.x - PANEL_W / 2;
      cardX = Math.max(
        SCREEN_MARGIN,
        Math.min(cardX, DESIGN_WIDTH - SCREEN_MARGIN - PANEL_W),
      );
      tailCx = anchor.x - cardX;

      cardY = anchor.y + ANCHOR_GAP;
      const maxY = Game.logicHeight - SCREEN_MARGIN - totalH;
      if (cardY > maxY) cardY = Math.max(SCREEN_MARGIN, maxY);
    }

    // 气泡底图：尖角 + 圆角矩形一体（与改用礼盒图之前一致）
    const bg = new PIXI.Graphics();
    const fill = 0xfffdf5;
    const border = 0xe8c8a0;

    bg.beginFill(fill, 0.98);
    bg.lineStyle(2, border, 0.65);
    bg.moveTo(tailCx - TAIL_HALF_W, TAIL_H);
    bg.lineTo(tailCx + TAIL_HALF_W, TAIL_H);
    bg.lineTo(tailCx, 0);
    bg.closePath();
    bg.endFill();

    bg.lineStyle(2, border, 0.65);
    bg.beginFill(fill, 0.98);
    bg.drawRoundedRect(0, TAIL_H, PANEL_W, panelInnerH, 16);
    bg.endFill();

    bg.eventMode = 'static';
    bg.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._card.addChild(bg);

    this._headerText = new PIXI.Text(`奖励收纳 (${RewardBoxManager.totalCount})`, {
      fontSize: 19,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._headerText.anchor.set(0, 0.5);

    const organizeBtn = new PIXI.Container();
    organizeBtn.eventMode = 'static';
    organizeBtn.cursor = 'pointer';
    const organizeBg = new PIXI.Graphics();
    organizeBg.beginFill(0xff8c5a, 1);
    organizeBg.lineStyle(2.5, 0xd84315, 0.95);
    organizeBg.drawRoundedRect(-34, -17, 68, 34, 17);
    organizeBg.endFill();
    organizeBtn.addChild(organizeBg);
    const organizeText = new PIXI.Text('整理', {
      fontSize: 16,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: '900',
      stroke: 0xb8320a,
      strokeThickness: 3,
    } as any);
    organizeText.anchor.set(0.5);
    organizeBtn.addChild(organizeText);
    organizeBtn.hitArea = new PIXI.Rectangle(-40, -22, 80, 44);
    organizeBtn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      void this._onOrganizeTap();
    });

    const headerCy = TAIL_H + HEADER_H / 2;
    const titleW = this._headerText.width;
    const btnHalfW = 34;
    const gap = 12;
    const rowW = titleW + gap + btnHalfW * 2;
    const rowLeft = (PANEL_W - rowW) / 2;
    this._headerText.position.set(rowLeft, headerCy);
    organizeBtn.position.set(rowLeft + titleW + gap + btnHalfW, headerCy);
    this._card.addChild(this._headerText);
    this._card.addChild(organizeBtn);

    const gridTop = TAIL_H + HEADER_H;
    this._gridTop = gridTop;

    this._gridMask = new PIXI.Graphics();
    this._gridMask.beginFill(0xffffff);
    this._gridMask.drawRect(PANEL_PAD, gridTop, innerW, gridVisibleH);
    this._gridMask.endFill();
    this._card.addChild(this._gridMask);

    // 视口：固定在可见格区域，承接滚动手势；格内容放在其子节点中平移
    const viewport = new PIXI.Container();
    viewport.position.set(PANEL_PAD, gridTop);
    viewport.eventMode = 'static';
    viewport.hitArea = new PIXI.Rectangle(0, 0, innerW, gridVisibleH);
    viewport.mask = this._gridMask;
    this._card.addChild(viewport);

    this._gridContainer = new PIXI.Container();
    viewport.addChild(this._gridContainer);

    // 底层拖拽板：保证空白处也能开滚（在 slot 之下，不挡点击）
    if (this._scrollEnabled) {
      const dragPlate = new PIXI.Graphics();
      dragPlate.beginFill(0xffffff, 0.001);
      dragPlate.drawRect(0, 0, innerW, Math.max(gridVisibleH, gridTotalH));
      dragPlate.endFill();
      dragPlate.eventMode = 'static';
      this._gridContainer.addChild(dragPlate);
      dragPlate.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._beginDrag(e, null);
      });
    }

    for (let i = 0; i < entries.length; i++) {
      const [itemId, count] = entries[i];
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const slot = this._createSlot(itemId, count, cellSize);
      slot.position.set(col * (cellSize + GRID_GAP), row * (cellSize + GRID_GAP));
      this._gridContainer.addChild(slot);
    }

    this._scrollY = Math.max(0, Math.min(this._scrollY, this._maxScrollY));
    this._applyScroll();

    this._card.position.set(cardX, cardY);
    this._card.hitArea = new PIXI.Rectangle(0, 0, PANEL_W, totalH);

    if (this._scrollEnabled) {
      viewport.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._beginDrag(e, null);
      });
    }
  }

  private _applyScroll(): void {
    if (this._gridContainer && !this._gridContainer.destroyed) {
      this._gridContainer.y = -this._scrollY;
    }
  }

  private _createSlot(itemId: string, count: number, s: number): PIXI.Container {
    const slot = new PIXI.Container();
    const rad = Math.min(8, Math.max(4, s * 0.11));
    const isSelected = this._selectedItemId === itemId;

    const slotBg = new PIXI.Graphics();
    if (isSelected) {
      slotBg.lineStyle(2.5, 0xff8c69, 1);
      slotBg.beginFill(0xffe8d6, 0.85);
    } else {
      slotBg.lineStyle(1.5, COLORS.CELL_BORDER, 0.85);
      slotBg.beginFill(0xfffbf5, 0.55);
    }
    slotBg.drawRoundedRect(0, 0, s, s, rad);
    slotBg.endFill();
    slot.addChild(slotBg);

    const def = ITEM_DEFS.get(itemId);
    if (def) {
      const fill = usesLargeBoardIconFill(def) ? BOUQUET_FILL : ITEM_FILL;
      const maxIcon = s * fill;
      const tex = TextureCache.get(def.icon);
      if (tex && tex.width > 0) {
        const sprite = new PIXI.Sprite(tex);
        const sc = Math.min(maxIcon / tex.width, maxIcon / tex.height);
        sprite.scale.set(sc);
        sprite.anchor.set(0.5, 0.5);
        sprite.position.set(s / 2, s / 2);
        slot.addChild(sprite);
      }
    }

    if (count > 1) {
      const badgeText = new PIXI.Text(`x${count}`, {
        fontSize: Math.max(10, Math.min(13, s * 0.16)),
        fill: 0xffffff,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      badgeText.anchor.set(1, 1);

      const bw = badgeText.width + 8;
      const bh = badgeText.height + 2;
      const badge = new PIXI.Graphics();
      badge.beginFill(0x5a3e2b, 0.78);
      badge.drawRoundedRect(s - bw - 2, s - bh - 2, bw, bh, 4);
      badge.endFill();
      slot.addChild(badge);

      badgeText.position.set(s - 4, s - 3);
      slot.addChild(badgeText);
    }

    slot.eventMode = 'static';
    slot.cursor = 'pointer';
    slot.hitArea = new PIXI.Rectangle(0, 0, s, s);
    slot.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      if (this._scrollEnabled) {
        this._beginDrag(e, itemId);
      } else {
        this._onSlotTap(itemId);
      }
    });

    return slot;
  }

  private async _onOrganizeTap(): Promise<void> {
    if (RewardBoxManager.isEmpty) {
      ToastMessage.show('收纳框为空');
      return;
    }
    const confirmed = await ConfirmDialog.show(
      '整理收纳箱',
      '观看一段广告，将收纳箱按品类和等级重新排列。',
      '免费整理',
      '取消',
    );
    if (!confirmed) return;

    AdManager.showRewardedAd(AdScene.REWARD_BOX_ORGANIZE, (success) => {
      console.log('[RewardBoxPanel] 整理广告回调:', success);
      if (!success) {
        ToastMessage.show('广告未看完，未整理');
        return;
      }
      const changed = RewardBoxManager.organize();
      this._refreshGrid();
      ToastMessage.show(changed ? '收纳箱已整理' : '收纳箱已经很整齐');
      this.close();
    });
  }

  private _onSlotTap(itemId: string): void {
    if (this._ignoreNextSlotTap) {
      this._ignoreNextSlotTap = false;
      return;
    }
    if (this._selectedItemId === itemId) {
      const emptyCell = BoardManager.findEmptyOpenCell();
      if (emptyCell < 0) {
        ToastMessage.show('棋盘已满，请先合成或出售物品腾出空间');
        return;
      }
      if (RewardBoxManager.takeItem(itemId)) {
        BoardManager.placeItem(emptyCell, itemId);
        ToastMessage.show('已放入棋盘');
        this._selectedItemId = null;
        if (RewardBoxManager.isEmpty) {
          this.close();
        }
      }
    } else {
      this._selectedItemId = itemId;
      this._refreshGrid();
    }
  }

  private _beginDrag(e: PIXI.FederatedPointerEvent, pendingItemId: string | null): void {
    if (!this._scrollEnabled) return;
    this._cleanupListeners();
    this._isDragging = true;
    this._hasMoved = false;
    this._ignoreNextSlotTap = false;
    this._pendingTapItemId = pendingItemId;
    this._dragStartDesignY = federatedPointerToDesignY(e);
    this._scrollStartY = this._scrollY;
    this._lastDragDesignY = this._dragStartDesignY;
    this._lastDragTime = Date.now();
    this._velocity = 0;

    const canvas = Game.app?.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.addEventListener) {
      canvas.addEventListener('pointermove', this._onCanvasMove);
      canvas.addEventListener('pointerup', this._onCanvasUp);
      canvas.addEventListener('pointercancel', this._onCanvasUp);
    }
  }

  private _onDragMove(designY: number): void {
    if (!this._isDragging) return;
    const deltaY = this._dragStartDesignY - designY;
    if (Math.abs(deltaY) > DRAG_THRESHOLD) this._hasMoved = true;

    let newScrollY = this._scrollStartY + deltaY;
    if (newScrollY < 0) newScrollY *= 0.3;
    if (newScrollY > this._maxScrollY) {
      newScrollY = this._maxScrollY + (newScrollY - this._maxScrollY) * 0.3;
    }
    this._scrollY = newScrollY;
    this._applyScroll();

    const now = Date.now();
    const dt = Math.max(1, now - this._lastDragTime);
    this._velocity = (this._lastDragDesignY - designY) / dt * 16;
    this._lastDragDesignY = designY;
    this._lastDragTime = now;
  }

  private _finishDrag(): void {
    if (!this._isDragging) return;
    const pending = this._pendingTapItemId;
    const moved = this._hasMoved;
    this._isDragging = false;
    this._pendingTapItemId = null;
    this._cleanupListeners();

    if (moved) {
      this._ignoreNextSlotTap = true;
      this._hasMoved = false;
      return;
    }

    this._hasMoved = false;
    if (pending) {
      this._onSlotTap(pending);
    }
  }

  private _cleanupListeners(): void {
    const canvas = Game.app?.view as unknown as HTMLCanvasElement | undefined;
    if (!canvas?.removeEventListener) return;
    canvas.removeEventListener('pointermove', this._onCanvasMove);
    canvas.removeEventListener('pointerup', this._onCanvasUp);
    canvas.removeEventListener('pointercancel', this._onCanvasUp);
  }

  private _cleanupDrag(): void {
    this._isDragging = false;
    this._velocity = 0;
    this._hasMoved = false;
    this._pendingTapItemId = null;
    this._cleanupListeners();
  }

  update(_dt: number): void {
    if (!this._isOpen) return;
    if (this._isDragging) return;

    const FRICTION = 0.92;
    const MIN_VEL = 0.5;
    const BOUNCE = 0.15;

    if (Math.abs(this._velocity) > MIN_VEL) {
      this._scrollY += this._velocity;
      this._velocity *= FRICTION;
    } else {
      this._velocity = 0;
    }

    if (this._scrollY < 0) {
      this._scrollY += (0 - this._scrollY) * BOUNCE;
      this._velocity = 0;
    } else if (this._scrollY > this._maxScrollY) {
      this._scrollY += (this._maxScrollY - this._scrollY) * BOUNCE;
      this._velocity = 0;
    }

    this._applyScroll();
  }
}
