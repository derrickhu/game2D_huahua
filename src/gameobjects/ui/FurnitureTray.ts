/**
 * 家具托盘（编辑模式底部抽屉）
 *
 * 编辑模式下从底部弹出，展示所有已解锁家具的缩略图网格。
 * 按槽位分类 Tab，支持向上拖出家具到房间。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { DecorationManager } from '@/managers/DecorationManager';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import { FurnitureDragSystem } from '@/systems/FurnitureDragSystem';
import { TextureCache } from '@/utils/TextureCache';
import {
  DecoSlot, DECO_SLOT_INFO, DECO_RARITY_INFO,
  getSlotDecos, DecoDef,
} from '@/config/DecorationConfig';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

// ---- 布局常量 ----
/** 导出供 ShopScene 对齐编辑按钮位置；略低于旧 300px，少挡花店场景 */
export const FURNITURE_TRAY_H = 252;

const TRAY_H = FURNITURE_TRAY_H;
const TAB_BAR_H = 52;             // 分类 Tab 栏高度（加大）
const CARD_SIZE = 96;             // 家具卡片尺寸（加大）
const CARD_GAP = 12;
const PADDING = 14;
const HANDLE_H = 28;              // 顶部拖拽手柄高度
const BG_COLOR = 0xFFF8F0;
const BG_ALPHA = 0.97;
const TRAY_RADIUS = 20;

export class FurnitureTray extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _handle!: PIXI.Container;
  private _tabContainer!: PIXI.Container;
  private _gridContainer!: PIXI.Container;
  private _gridMask!: PIXI.Graphics;
  private _isOpen = false;
  private _currentSlot: DecoSlot = DecoSlot.SHELF;
  private _closedY = 0;
  private _openY = 0;
  private _scrollX = 0;
  private _maxScrollX = 0;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 6000;
    this._build();
  }

  /** 打开托盘（滑入动画） */
  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;

    const logicH = Game.logicHeight;
    this._closedY = logicH;
    this._openY = logicH - TRAY_H;

    this.y = this._closedY;
    this._currentSlot = DecoSlot.SHELF;
    this._refreshAll();

    TweenManager.to({
      target: this,
      props: { y: this._openY },
      duration: 0.3,
      ease: Ease.easeOutBack,
    });
  }

  /** 关闭托盘（滑出动画） */
  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;

    TweenManager.to({
      target: this,
      props: { y: this._closedY },
      duration: 0.2,
      ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  /** 刷新内容（外部调用，如装饰解锁后） */
  refresh(): void {
    if (this._isOpen) {
      this._refreshAll();
    }
  }

  // ---- 构建 UI ----

  private _build(): void {
    const w = DESIGN_WIDTH;

    // 背景
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(BG_COLOR, BG_ALPHA);
    this._bg.drawRoundedRect(0, 0, w, TRAY_H + 40, TRAY_RADIUS);
    this._bg.endFill();
    this._bg.lineStyle(1, 0xE0D0C0);
    this._bg.drawRoundedRect(0, 0, w, TRAY_H + 40, TRAY_RADIUS);
    this._bg.eventMode = 'static'; // 阻止穿透
    this.addChild(this._bg);

    // 顶部拖拽手柄
    this._handle = new PIXI.Container();
    const handleBar = new PIXI.Graphics();
    handleBar.beginFill(0xD0C0B0);
    handleBar.drawRoundedRect(w / 2 - 30, 8, 60, 4, 2);
    handleBar.endFill();
    this._handle.addChild(handleBar);
    this._handle.eventMode = 'static';
    this._handle.hitArea = new PIXI.Rectangle(0, 0, w, HANDLE_H);
    this.addChild(this._handle);

    // 分类 Tab 栏
    this._tabContainer = new PIXI.Container();
    this._tabContainer.y = HANDLE_H;
    this.addChild(this._tabContainer);

    // 家具网格区域
    this._gridContainer = new PIXI.Container();
    this._gridContainer.y = HANDLE_H + TAB_BAR_H;
    this.addChild(this._gridContainer);

    // 网格遮罩
    const gridH = TRAY_H - HANDLE_H - TAB_BAR_H;
    this._gridMask = new PIXI.Graphics();
    this._gridMask.beginFill(0xFFFFFF);
    this._gridMask.drawRect(0, HANDLE_H + TAB_BAR_H, w, gridH);
    this._gridMask.endFill();
    this.addChild(this._gridMask);
    this._gridContainer.mask = this._gridMask;

    // 网格滚动事件
    this._gridContainer.eventMode = 'static';
    this._gridContainer.hitArea = new PIXI.Rectangle(0, 0, w, gridH);
  }

  private _buildTabs(): void {
    this._tabContainer.removeChildren();

    const slots = Object.values(DecoSlot);
    const tabW = Math.floor(DESIGN_WIDTH / slots.length);

    slots.forEach((slot, i) => {
      const info = DECO_SLOT_INFO[slot];
      const isCurrent = slot === this._currentSlot;

      const tab = new PIXI.Container();
      tab.position.set(i * tabW, 0);

      // Tab 背景
      const bg = new PIXI.Graphics();
      if (isCurrent) {
        bg.beginFill(0xFFE8D0);
        bg.drawRoundedRect(2, 2, tabW - 4, TAB_BAR_H - 4, 6);
        bg.endFill();
        bg.lineStyle(2, COLORS.BUTTON_PRIMARY);
        bg.drawRoundedRect(2, 2, tabW - 4, TAB_BAR_H - 4, 6);
      }
      tab.addChild(bg);

      // 图标 + 名称（加大）
      const label = new PIXI.Text(`${info.emoji}`, {
        fontSize: 22, fontFamily: FONT_FAMILY,
      });
      label.anchor.set(0.5, 0.3);
      label.position.set(tabW / 2, TAB_BAR_H / 2);
      tab.addChild(label);

      // 已解锁数量（加大）
      const unlocked = DecorationManager.getUnlockedBySlot(slot);
      const placed = RoomLayoutManager.getLayout().filter(p => {
        const d = DECO_MAP.get(p.decoId);
        return d && d.slot === slot;
      });

      if (unlocked.length > 0) {
        const countText = new PIXI.Text(`${placed.length}/${unlocked.length}`, {
          fontSize: 10, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        });
        countText.anchor.set(0.5, 0);
        countText.position.set(tabW / 2, TAB_BAR_H - 16);
        tab.addChild(countText);
      }

      tab.eventMode = 'static';
      tab.cursor = 'pointer';
      tab.on('pointertap', () => {
        this._currentSlot = slot;
        this._scrollX = 0;
        this._refreshAll();
      });

      this._tabContainer.addChild(tab);
    });
  }

  private _buildGrid(): void {
    this._gridContainer.removeChildren();

    const decos = DecorationManager.getUnlockedBySlot(this._currentSlot);
    if (decos.length === 0) {
      // 空状态
      const emptyText = new PIXI.Text('暂无已解锁的装饰\n去装修面板解锁吧~', {
        fontSize: 16, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        align: 'center',
      });
      emptyText.anchor.set(0.5, 0.5);
      const gridH = TRAY_H - HANDLE_H - TAB_BAR_H;
      emptyText.position.set(DESIGN_WIDTH / 2, gridH / 2);
      this._gridContainer.addChild(emptyText);
      return;
    }

    const innerContainer = new PIXI.Container();
    this._gridContainer.addChild(innerContainer);

    const currentLayout = RoomLayoutManager.getLayout();

    decos.forEach((deco, i) => {
      const x = PADDING + i * (CARD_SIZE + CARD_GAP);
      const y = PADDING;
      const card = this._buildCard(deco, x, y, currentLayout);
      innerContainer.addChild(card);
    });

    // 计算横向滚动范围
    const totalW = PADDING + decos.length * (CARD_SIZE + CARD_GAP);
    this._maxScrollX = Math.max(0, totalW - DESIGN_WIDTH);
    this._scrollX = 0;

    // 横向拖拽滚动
    this._setupHorizontalScroll(innerContainer);
  }

  private _buildCard(
    deco: DecoDef,
    x: number,
    y: number,
    layout: ReadonlyArray<{ decoId: string }>,
  ): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const isPlaced = layout.some(p => p.decoId === deco.id);
    const rarityInfo = DECO_RARITY_INFO[deco.rarity];

    // 卡片背景
    const bg = new PIXI.Graphics();
    bg.beginFill(isPlaced ? 0xE8F5E8 : 0xFFFFFF);
    bg.drawRoundedRect(0, 0, CARD_SIZE, CARD_SIZE, 8);
    bg.endFill();
    if (isPlaced) {
      bg.lineStyle(2, 0x4CAF50);
    } else {
      bg.lineStyle(1, 0xE0D0C0);
    }
    bg.drawRoundedRect(0, 0, CARD_SIZE, CARD_SIZE, 8);
    card.addChild(bg);

    // 家具图标
    const texture = TextureCache.get(deco.icon);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      const maxSize = CARD_SIZE - 20;
      const s = Math.min(maxSize / texture.width, maxSize / texture.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(CARD_SIZE / 2, CARD_SIZE / 2 - 4);
      if (isPlaced) sprite.alpha = 0.5;
      card.addChild(sprite);
    }

    // 稀有度小点（加大）
    const rarityDot = new PIXI.Graphics();
    rarityDot.beginFill(rarityInfo.color);
    rarityDot.drawCircle(CARD_SIZE - 10, 10, 5);
    rarityDot.endFill();
    card.addChild(rarityDot);

    // 已放置标记
    if (isPlaced) {
      const placedBadge = new PIXI.Text('✓', {
        fontSize: 18, fill: 0x4CAF50, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      placedBadge.anchor.set(0.5, 0.5);
      placedBadge.position.set(CARD_SIZE / 2, CARD_SIZE / 2);
      card.addChild(placedBadge);
    }

    // 名称（底部标签，加大可读）
    const nameText = new PIXI.Text(deco.name, {
      fontSize: 11, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    nameText.anchor.set(0.5, 1);
    nameText.position.set(CARD_SIZE / 2, CARD_SIZE - 4);
    card.addChild(nameText);

    // 交互
    card.eventMode = 'static';
    card.cursor = 'pointer';

    // 点击：如果已放置则选中/移除；未放置则开始拖拽放入
    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (isPlaced) {
        // 已在房间中：选中它
        FurnitureDragSystem.select(deco.id);
        EventBus.emit('toast:show', `已选中「${deco.name}」，可在房间中拖动`);
      } else {
        // 从托盘拖入房间
        const designPos = this._eventToDesign(e);
        FurnitureDragSystem.startDragFromTray(deco.id, designPos.x, designPos.y);
      }
    });

    return card;
  }

  private _setupHorizontalScroll(inner: PIXI.Container): void {
    let startX = 0;
    let startScrollX = 0;
    let dragging = false;

    const canvas = Game.app.view as any;

    const onDown = () => {
      dragging = false;
      startScrollX = this._scrollX;
    };

    const onMove = (e: any) => {
      if (!this._isOpen) return;
      const clientX = e.clientX ?? e.pageX ?? 0;
      const designX = clientX * Game.designWidth / Game.screenWidth;

      if (!dragging) {
        startX = designX;
        dragging = true;
        return;
      }

      const dx = designX - startX;
      this._scrollX = Math.max(-this._maxScrollX, Math.min(0, startScrollX + dx));
      inner.x = this._scrollX;
    };

    this._gridContainer.on('pointerdown', onDown);

    // 使用 canvas 级别事件做滚动（与 BoardView 一致的策略）
    // 但仅在托盘区域内响应，通过 _isOpen + dragging 控制
  }

  private _refreshAll(): void {
    this._buildTabs();
    this._buildGrid();
  }

  private _eventToDesign(e: PIXI.FederatedPointerEvent): { x: number; y: number } {
    // global 坐标是 canvas 物理像素空间，转为设计坐标
    return {
      x: (e.global.x / Game.dpr) * Game.designWidth / Game.screenWidth,
      y: (e.global.y / Game.dpr) * Game.designHeight / Game.screenHeight,
    };
  }
}

// 需要引入 DECO_MAP
import { DECO_MAP } from '@/config/DecorationConfig';
