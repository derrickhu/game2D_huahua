/**
 * 花店装修面板
 *
 * 布局：
 * - 底图复用 merge_chain_panel（金边奶油底）
 * - 顶部彩带 + 标题；其下居中「已收集」进度 + 分割线；右上角关闭
 * - 左侧：分类 Tab 栏（药丸式纯文字）
 * - 右侧：家具/房间风格卡网格（2 列，可纵向滑动）
 * - 卡片为程序绘制双层金边圆角 + 贴图按钮 + 稀有度标签
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { DecorationManager } from '@/managers/DecorationManager';
import { TextureCache } from '@/utils/TextureCache';
import { checkRequirement } from '@/utils/UnlockChecker';
import {
  DecoSlot, DecoRarity, DECO_SLOT_INFO, DECO_RARITY_INFO,
  getSlotDecos, DecoDef,
  ROOM_STYLES, RoomStyleDef,
} from '@/config/DecorationConfig';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

const PANEL_W = DESIGN_WIDTH - 40;
const PANEL_MARGIN_LEFT = 36;
const PANEL_H_RATIO = 0.74;
const PANEL_TOP_R = 20;

const RIBBON_MAX_W = Math.min(PANEL_W - 8, Math.round(PANEL_W * 0.98));
const RIBBON_MAX_H = 124;
/** 彩带相对面板顶的位置（与 _contentTopY 联动） */
const RIBBON_Y = 34;

/** 关闭钮：面板右上角，距右边缘（锚点为中心；数值越大越靠左） */
const CLOSE_BTN_INSET_RIGHT = 56;
/** 彩带底到收集进度文字 */
const PROGRESS_BELOW_RIBBON = 8;
/** 进度文字基线与分割线间距 */
const PROGRESS_TO_DIVIDER = 14;
/** 分割线与家具区顶边（小一点让网格更贴上分割线） */
const DIVIDER_TO_CONTENT = 6;
/** 顶部分割线长度占面板内宽比例（居中，避免顶到金边） */
const HEADER_DIVIDER_WIDTH_RATIO = 0.56;
const CONTENT_BOTTOM = 10;

/** 左侧分类栏宽度（加大、避免贴边显得「偏」） */
const TAB_W = 108;
const TAB_GAP = 10;
/** Tab 列左边距（再往右，完全落在奶油区内） */
const TAB_COLUMN_LEFT = 60;
/** Tab 列整体上移（像素） */
const TAB_COLUMN_NUDGE_Y = 12;
const GRID_MARGIN_RIGHT = 14;

/** 侧边 Tab：选中态暖色底 / 未选中灰奶油 */
const TAB_BG_SELECTED = 0xffc9a8;
const TAB_BG_SELECTED_INNER = 0xffe8d8;
const TAB_BG_IDLE = 0xefebe5;
const TAB_BORDER_IDLE = 0xc4b8ae;

const GRID_COLS = 2;
const CARD_GAP = 10;
const CARD_BASE_W = 140;
const CARD_BASE_H = 160;
const CARD_MAX_W = 200;
const CARD_R = 10;

const GOLD_LINE = 0xe8c078;
const GOLD_INNER = 0xd4a84b;
const CREAM_FILL = 0xfff9ec;
const SHADOW_COLOR = 0x8b7355;

const DECO_RARITY_TAG_KEYS: Record<DecoRarity, string> = {
  [DecoRarity.COMMON]: 'deco_rarity_tag_common',
  [DecoRarity.FINE]: 'deco_rarity_tag_fine',
  [DecoRarity.RARE]: 'deco_rarity_tag_rare',
  [DecoRarity.LIMITED]: 'deco_rarity_tag_limited',
};

function measureCardGrid(gridW: number): { cw: number; ch: number; cols: number; startX: number } {
  const cwRaw = Math.floor((gridW - CARD_GAP * (GRID_COLS + 1)) / GRID_COLS);
  const cw = Math.max(110, Math.min(CARD_MAX_W, cwRaw));
  const ch = Math.round((cw * CARD_BASE_H) / CARD_BASE_W);
  const blockW = GRID_COLS * cw + (GRID_COLS - 1) * CARD_GAP;
  const startX = Math.floor((gridW - blockW) / 2);
  return { cw, ch, cols: GRID_COLS, startX };
}

/** 列表顶留白：可一屏放下时少留空，整体上移贴近分割线；需滚动时略收紧 */
function decoGridListTopPad(availH: number, totalRows: number, ch: number): number {
  const baseH = CARD_GAP + totalRows * (ch + CARD_GAP);
  if (baseH >= availH) return 10;
  const spare = availH - baseH;
  return Math.min(10, Math.max(0, Math.floor(spare * 0.28)));
}

/** global pixel -> design coordinate */
function globalToDesignY(globalY: number): number {
  return globalY / Game.scale;
}

type DecoPanelTab = 'room_styles' | DecoSlot;
type DecoGridPendingTap =
  | { type: 'deco'; deco: DecoDef }
  | { type: 'room'; style: RoomStyleDef };

export class DecorationPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _tabContainer!: PIXI.Container;
  /** 网格裁剪视口：与遮罩同父，避免兄弟遮罩在部分环境下不生效 */
  private _gridViewport!: PIXI.Container;
  private _gridContainer!: PIXI.Container;
  private _gridMask!: PIXI.Graphics;
  private _headerDivider!: PIXI.Graphics;
  private _titleText!: PIXI.Text;
  private _progressText!: PIXI.Text;
  private _closeBtn: PIXI.Sprite | PIXI.Text | null = null;
  /** 标题/彩带行中心 y，供关闭钮对齐 */
  private _titleCenterY = 58;
  /** Tab / 网格顶边（分割线以下，_build 内按彩带高度计算） */
  private _contentTopY = 168;
  private _isOpen = false;
  private _activeTab: DecoPanelTab = DecoSlot.SHELF;
  private _scrollY = 0;
  private _maxScrollY = 0;
  private _gridScrollListening = false;
  private _gridScrollStartDesignY = 0;
  private _gridScrollStartScrollY = 0;
  private _pendingGridTap: DecoGridPendingTap | null = null;
  /** Tab 列在网格可视高度内垂直居中的上边距 */
  private _tabVerticalPad = 0;
  /** 与 DressUp 一致：logicHeight 变化时拉伸手绘底图并重画裁剪区 */
  private _panelHBuilt = 0;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
  }

  // ─── touch scroll (stage-level, design coords) ────────────

  private readonly _onStageMove = (e: PIXI.FederatedPointerEvent): void => {
    if (!this._isOpen || !this._gridScrollListening) return;
    const dy = globalToDesignY(e.global.y) - this._gridScrollStartDesignY;
    this._scrollY = Math.max(-this._maxScrollY, Math.min(0, this._gridScrollStartScrollY + dy));
    this._applyScroll();
  };

  private readonly _onStageUp = (e?: PIXI.FederatedPointerEvent): void => {
    if (!this._gridScrollListening) return;
    const st = Game.app.stage;
    st.off('pointermove', this._onStageMove);
    st.off('pointerup', this._onStageUp);
    st.off('pointerupoutside', this._onStageUp);
    st.off('pointercancel', this._onStageUp);
    this._gridScrollListening = false;

    const endDesignY = e ? globalToDesignY(e.global.y) : this._gridScrollStartDesignY;
    const movedPx = Math.abs(endDesignY - this._gridScrollStartDesignY);
    const pending = this._pendingGridTap;
    this._pendingGridTap = null;
    if (movedPx < 12 && pending) {
      if (pending.type === 'deco') this._onCardTap(pending.deco);
      else this._onRoomStyleTap(pending.style);
    }
  };

  private _beginScroll(e: PIXI.FederatedPointerEvent): void {
    if (this._gridScrollListening || !this._isOpen) return;
    this._gridScrollListening = true;
    this._gridScrollStartDesignY = globalToDesignY(e.global.y);
    this._gridScrollStartScrollY = this._scrollY;
    const st = Game.app.stage;
    st.on('pointermove', this._onStageMove);
    st.on('pointerup', this._onStageUp);
    st.on('pointerupoutside', this._onStageUp);
    st.on('pointercancel', this._onStageUp);
  }

  private _teardownScroll(): void {
    if (!this._gridScrollListening) return;
    const st = Game.app.stage;
    st.off('pointermove', this._onStageMove);
    st.off('pointerup', this._onStageUp);
    st.off('pointerupoutside', this._onStageUp);
    st.off('pointercancel', this._onStageUp);
    this._gridScrollListening = false;
    this._pendingGridTap = null;
  }

  private _layoutCloseButton(): void {
    if (!this._closeBtn) return;
    this._closeBtn.position.set(PANEL_W - CLOSE_BTN_INSET_RIGHT, this._titleCenterY);
  }

  private _addScrollPlate(inner: PIXI.Container, w: number, h: number): void {
    const plate = new PIXI.Container();
    plate.eventMode = 'static';
    plate.hitArea = new PIXI.Rectangle(0, 0, w, h);
    plate.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginScroll(e);
      this._pendingGridTap = null;
    });
    inner.addChildAt(plate, 0);
  }

  // ─── open / close ─────────────────────────────────────────

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._activeTab = DecoSlot.SHELF;
    this._resizePanelIfNeeded();
    this._refreshAll();

    const h = Game.logicHeight;
    const panelH = Math.round(h * PANEL_H_RATIO);
    const panelY = h - panelH;
    const panelX = this._content.position.x;

    TweenManager.cancelTarget(this._content.position);
    this._content.position.set(panelX, h);
    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.18, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.position, props: { y: panelY }, duration: 0.28, ease: Ease.easeOutQuad });
  }

  close(): void {
    if (!this._isOpen) return;
    this._teardownScroll();
    this._isOpen = false;
    const h = Game.logicHeight;
    TweenManager.cancelTarget(this._content.position);
    TweenManager.to({ target: this._content.position, props: { y: h }, duration: 0.22, ease: Ease.easeInQuad });
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.2, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  // ─── build ────────────────────────────────────────────────

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    // dim overlay
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    const panelH = Math.round(h * PANEL_H_RATIO);
    const panelX = PANEL_MARGIN_LEFT;
    const panelY = h - panelH;

    this._content = new PIXI.Container();
    this._content.sortableChildren = true;
    this._content.position.set(panelX, panelY);
    this.addChild(this._content);

    // --- panel background: merge_chain_panel or fallback ---
    const panelTex = TextureCache.get('merge_chain_panel');
    if (panelTex?.width) {
      const panelBg = new PIXI.Sprite(panelTex);
      panelBg.width = PANEL_W;
      panelBg.height = panelH;
      panelBg.eventMode = 'static';
      this._content.addChild(panelBg);
    } else {
      const g = new PIXI.Graphics();
      g.lineStyle(3, 0xd97b00);
      g.beginFill(0xfff9e6);
      g.drawRoundedRect(0, 0, PANEL_W, panelH, PANEL_TOP_R);
      g.endFill();
      g.lineStyle(2, 0xffd700);
      g.drawRoundedRect(3, 3, PANEL_W - 6, panelH - 6, PANEL_TOP_R - 2);
      g.eventMode = 'static';
      this._content.addChild(g);
    }

    // --- ribbon（加大、下移） ---
    const ribbonTex = TextureCache.get('merge_chain_ribbon');
    let titleCenterY = 58;
    let ribbonBottom = titleCenterY + 36;
    if (ribbonTex?.width) {
      const rib = new PIXI.Sprite(ribbonTex);
      const s = Math.min(RIBBON_MAX_W / ribbonTex.width, RIBBON_MAX_H / ribbonTex.height);
      rib.scale.set(s);
      rib.anchor.set(0.5, 0);
      rib.position.set(PANEL_W / 2, RIBBON_Y);
      rib.eventMode = 'static';
      rib.zIndex = 5;
      this._content.addChild(rib);
      titleCenterY = RIBBON_Y + (ribbonTex.height * s) * 0.45;
      ribbonBottom = RIBBON_Y + ribbonTex.height * s;
    }
    this._titleCenterY = titleCenterY;

    // --- title (outlined white text like MergeChainPanel) ---
    this._titleText = new PIXI.Text('花店装修', {
      fontSize: 30,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x7a4530,
      strokeThickness: 5,
      dropShadow: true,
      dropShadowColor: 0x5a2d10,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    } as any);
    this._titleText.anchor.set(0.5, 0.5);
    this._titleText.position.set(PANEL_W / 2, titleCenterY);
    this._titleText.zIndex = 6;
    this._content.addChild(this._titleText);

    // --- 收集进度：彩带正下方居中（红框区域） ---
    const progressY = Math.round(ribbonBottom + PROGRESS_BELOW_RIBBON);
    this._progressText = new PIXI.Text('', {
      fontSize: 20,
      fill: 0xfff5e8,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xb86b4a,
      strokeThickness: 3,
      dropShadow: true,
      dropShadowColor: 0x4a3020,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    } as any);
    this._progressText.anchor.set(0.5, 0.5);
    this._progressText.position.set(PANEL_W / 2, progressY);
    this._progressText.zIndex = 6;
    this._content.addChild(this._progressText);

    // --- 顶部分割线：居中短横，不顶到两侧金边 ---
    const dividerY = Math.round(progressY + PROGRESS_TO_DIVIDER);
    const divHalfW = Math.round((PANEL_W * HEADER_DIVIDER_WIDTH_RATIO) / 2);
    this._headerDivider = new PIXI.Graphics();
    this._headerDivider.zIndex = 5;
    this._headerDivider.lineStyle(2, GOLD_LINE, 0.75);
    this._headerDivider.moveTo(Math.round(PANEL_W / 2) - divHalfW, dividerY);
    this._headerDivider.lineTo(Math.round(PANEL_W / 2) + divHalfW, dividerY);
    this._content.addChild(this._headerDivider);

    this._contentTopY = Math.round(dividerY + DIVIDER_TO_CONTENT);

    // --- layout zones（Tab 列与网格之间留白对称） ---
    const gridX = TAB_COLUMN_LEFT + TAB_W + TAB_GAP;
    const gridW = PANEL_W - gridX - GRID_MARGIN_RIGHT;
    const gridH = panelH - this._contentTopY - CONTENT_BOTTOM;

    // tab container：y 在 _buildTabs 内写入 _tabVerticalPad 后对齐
    this._tabContainer = new PIXI.Container();
    this._content.addChild(this._tabContainer);

    this._buildTabs(gridH);
    this._tabContainer.position.set(
      TAB_COLUMN_LEFT,
      this._contentTopY + this._tabVerticalPad - TAB_COLUMN_NUDGE_Y,
    );

    this._gridViewport = new PIXI.Container();
    this._gridViewport.position.set(gridX, this._contentTopY);
    this._gridViewport.eventMode = 'static';
    this._gridViewport.hitArea = new PIXI.Rectangle(0, 0, gridW, gridH);
    this._content.addChild(this._gridViewport);

    this._gridMask = new PIXI.Graphics();
    this._gridMask.beginFill(0xffffff);
    this._gridMask.drawRect(0, 0, gridW, gridH);
    this._gridMask.endFill();
    this._gridMask.eventMode = 'none';
    this._gridViewport.addChild(this._gridMask);

    this._gridContainer = new PIXI.Container();
    this._gridViewport.addChild(this._gridContainer);
    this._gridContainer.mask = this._gridMask;

    // wheel scroll
    this._gridContainer.eventMode = 'static';
    this._gridContainer.on('wheel', (e: any) => {
      this._scrollY = Math.max(-this._maxScrollY, Math.min(0, this._scrollY - (e.deltaY || 0)));
      this._applyScroll();
    });

    // 关闭钮：右上角，最后加入保证盖在 Tab/网格之上
    const closeTex = TextureCache.get('warehouse_close_btn');
    if (closeTex?.width) {
      const closeBtn = new PIXI.Sprite(closeTex);
      const cs = Math.min(54 / closeTex.width, 54 / closeTex.height);
      closeBtn.scale.set(cs);
      closeBtn.anchor.set(0.5, 0.5);
      closeBtn.eventMode = 'static';
      closeBtn.cursor = 'pointer';
      closeBtn.zIndex = 2000;
      closeBtn.on('pointertap', () => this.close());
      this._content.addChild(closeBtn);
      this._closeBtn = closeBtn;
    } else {
      const closeBtn = new PIXI.Text('✕', {
        fontSize: 34, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        stroke: 0x7a4530, strokeThickness: 4,
      } as any);
      closeBtn.anchor.set(0.5, 0.5);
      closeBtn.eventMode = 'static';
      closeBtn.cursor = 'pointer';
      closeBtn.zIndex = 2000;
      closeBtn.on('pointertap', () => this.close());
      this._content.addChild(closeBtn);
      this._closeBtn = closeBtn;
    }
    this._layoutCloseButton();
    this._panelHBuilt = panelH;
  }

  private _gridLayoutMetrics(): { gridX: number; gridW: number; gridH: number } {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    const gridX = TAB_COLUMN_LEFT + TAB_W + TAB_GAP;
    const gridW = PANEL_W - gridX - GRID_MARGIN_RIGHT;
    const gridH = panelH - this._contentTopY - CONTENT_BOTTOM;
    return { gridX, gridW, gridH };
  }

  private _syncGridViewportClip(): void {
    const { gridX, gridW, gridH } = this._gridLayoutMetrics();
    this._gridViewport.position.set(gridX, this._contentTopY);
    this._gridViewport.hitArea = new PIXI.Rectangle(0, 0, gridW, gridH);
    this._gridMask.clear();
    this._gridMask.beginFill(0xffffff);
    this._gridMask.drawRect(0, 0, gridW, gridH);
    this._gridMask.endFill();
  }

  private _resizePanelIfNeeded(): void {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    if (panelH === this._panelHBuilt) return;
    const bg = this._content.children[0];
    if (bg instanceof PIXI.Sprite) bg.height = panelH;
    this._panelHBuilt = panelH;
    this._syncGridViewportClip();
  }

  // ─── tabs (left column, pill-shaped text buttons) ─────────

  private _buildTabs(availH: number): void {
    this._tabContainer.removeChildren();

    const slots = Object.values(DecoSlot);
    const tabCount = 1 + slots.length;
    const tabH = Math.min(Math.floor(availH / tabCount), 66);
    const spare = Math.max(0, availH - tabCount * tabH);
    this._tabVerticalPad = Math.floor(spare * 0.2);
    const pad = 4;
    const bw = TAB_W - pad * 2;

    const makeTab = (row: number, isCurrent: boolean, title: string, onTap: () => void, footer?: string): void => {
      const tab = new PIXI.Container();
      tab.position.set(0, row * tabH);
      const bh = tabH - pad * 2;
      const r = bh / 2;

      const drop = new PIXI.Graphics();
      drop.beginFill(0x4a3020, 0.08);
      drop.drawRoundedRect(pad + 1, pad + 2, bw, bh, r);
      drop.endFill();
      tab.addChild(drop);

      const bg = new PIXI.Graphics();
      if (isCurrent) {
        bg.beginFill(TAB_BG_SELECTED);
        bg.drawRoundedRect(pad, pad, bw, bh, r);
        bg.endFill();
        bg.lineStyle(2.5, COLORS.BUTTON_PRIMARY);
        bg.drawRoundedRect(pad, pad, bw, bh, r);
        const ir = Math.max(5, r - 3);
        bg.lineStyle(1.2, TAB_BG_SELECTED_INNER, 0.85);
        bg.drawRoundedRect(pad + 2, pad + 2, bw - 4, bh - 4, ir);
      } else {
        bg.beginFill(TAB_BG_IDLE);
        bg.drawRoundedRect(pad, pad, bw, bh, r);
        bg.endFill();
        bg.lineStyle(1.25, TAB_BORDER_IDLE, 0.95);
        bg.drawRoundedRect(pad, pad, bw, bh, r);
      }
      tab.addChild(bg);

      const label = new PIXI.Text(title, {
        fontSize: isCurrent ? 17 : 15,
        fill: isCurrent ? 0x5a3528 : COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
        fontWeight: isCurrent ? 'bold' : 'normal',
      });
      label.anchor.set(0.5, 0.5);
      label.position.set(TAB_W / 2, tabH / 2 - (footer ? 7 : 0));
      tab.addChild(label);

      if (footer) {
        const ft = new PIXI.Text(footer, { fontSize: 11, fill: 0x888888, fontFamily: FONT_FAMILY });
        ft.anchor.set(0.5, 1);
        ft.position.set(TAB_W / 2, tabH - 3);
        tab.addChild(ft);
      }

      tab.eventMode = 'static';
      tab.cursor = 'pointer';
      tab.on('pointertap', () => { onTap(); this._scrollY = 0; this._refreshAll(); });
      this._tabContainer.addChild(tab);
    };

    makeTab(0, this._activeTab === 'room_styles', '房间风格', () => { this._activeTab = 'room_styles'; });

    slots.forEach((slot, i) => {
      const info = DECO_SLOT_INFO[slot];
      const isCurrent = this._activeTab === slot;
      const prog = DecorationManager.getSlotProgress(slot);
      const footer = prog.unlocked > 1 ? `${prog.unlocked}/${prog.total}` : undefined;
      makeTab(i + 1, isCurrent, info.name, () => { this._activeTab = slot; }, footer);
    });
  }

  // ─── refresh ──────────────────────────────────────────────

  private _refreshAll(): void {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    this._layoutCloseButton();
    const gridH = panelH - this._contentTopY - CONTENT_BOTTOM;
    this._buildTabs(gridH);
    this._tabContainer.position.set(
      TAB_COLUMN_LEFT,
      this._contentTopY + this._tabVerticalPad - TAB_COLUMN_NUDGE_Y,
    );
    this._syncGridViewportClip();
    this._buildGrid(gridH);
    this._updateProgress();
  }

  // ─── grid ─────────────────────────────────────────────────

  private _buildGrid(availH: number): void {
    this._gridContainer.removeChildren();
    if (this._activeTab === 'room_styles') { this._buildRoomStyleGrid(availH); return; }

    const decos = getSlotDecos(this._activeTab);
    const gridW = PANEL_W - TAB_COLUMN_LEFT - TAB_W - TAB_GAP - GRID_MARGIN_RIGHT;
    const { cw, ch, cols, startX } = measureCardGrid(gridW);

    const inner = new PIXI.Container();
    this._gridContainer.addChild(inner);

    const totalRows = Math.ceil(decos.length / cols);
    const listTopPad = decoGridListTopPad(availH, totalRows, ch);

    decos.forEach((deco, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const y = listTopPad + CARD_GAP + row * (ch + CARD_GAP);
      inner.addChild(this._buildCard(deco, startX + col * (cw + CARD_GAP), y, cw, ch));
    });

    const contentH = listTopPad + CARD_GAP + totalRows * (ch + CARD_GAP);
    this._addScrollPlate(inner, gridW, contentH);
    this._maxScrollY = Math.max(0, contentH - availH);
    this._scrollY = 0;
  }

  private _buildRoomStyleGrid(availH: number): void {
    const gridW = PANEL_W - TAB_COLUMN_LEFT - TAB_W - TAB_GAP - GRID_MARGIN_RIGHT;
    const { cw, ch, cols, startX } = measureCardGrid(gridW);

    const inner = new PIXI.Container();
    this._gridContainer.addChild(inner);

    const totalRows = Math.ceil(ROOM_STYLES.length / cols);
    const listTopPad = decoGridListTopPad(availH, totalRows, ch);

    ROOM_STYLES.forEach((style, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const y = listTopPad + CARD_GAP + row * (ch + CARD_GAP);
      inner.addChild(this._buildRoomStyleCard(style, startX + col * (cw + CARD_GAP), y, cw, ch));
    });

    const contentH = listTopPad + CARD_GAP + totalRows * (ch + CARD_GAP);
    this._addScrollPlate(inner, gridW, contentH);
    this._maxScrollY = Math.max(0, contentH - availH);
    this._scrollY = 0;
  }

  // ─── card chrome (programmatic gold-edge card) ────────────

  private _drawCardBg(card: PIXI.Container, cw: number, ch: number, unlocked: boolean, equipped: boolean): void {
    const shadow = new PIXI.Graphics();
    shadow.beginFill(SHADOW_COLOR, 0.15);
    shadow.drawRoundedRect(2, 3, cw, ch, CARD_R);
    shadow.endFill();
    card.addChild(shadow);

    const bg = new PIXI.Graphics();
    if (equipped) {
      bg.lineStyle(2.5, COLORS.BUTTON_PRIMARY, 0.95);
    } else {
      bg.lineStyle(2, GOLD_LINE, unlocked ? 0.85 : 0.45);
    }
    bg.beginFill(unlocked ? CREAM_FILL : 0xF0ECEA, unlocked ? 0.98 : 0.75);
    bg.drawRoundedRect(0, 0, cw, ch, CARD_R);
    bg.endFill();

    if (unlocked) {
      bg.lineStyle(1, GOLD_INNER, equipped ? 0.35 : 0.45);
      bg.drawRoundedRect(3, 3, cw - 6, ch - 6, Math.max(6, CARD_R - 2));
    }
    card.addChild(bg);
  }

  // ─── rarity tag ───────────────────────────────────────────

  private _addRarityTag(card: PIXI.Container, cw: number, rarity: DecoRarity): void {
    const info = DECO_RARITY_INFO[rarity];
    const key = DECO_RARITY_TAG_KEYS[rarity];
    const tex = TextureCache.get(key);
    const tagPad = 4;
    const labelFont = 12;
    if (tex?.width) {
      const maxW = Math.min(102, Math.round(cw * 0.52));
      const maxH = 28;
      const s = Math.min(maxW / tex.width, maxH / tex.height);
      const sp = new PIXI.Sprite(tex);
      sp.scale.set(s);
      sp.position.set(tagPad, tagPad);
      card.addChild(sp);
      const label = new PIXI.Text(info.name, {
        fontSize: labelFont, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        stroke: 0x333333, strokeThickness: 2,
      } as any);
      label.anchor.set(0.5, 0.5);
      label.position.set(tagPad + (tex.width * s) / 2, tagPad + (tex.height * s) / 2);
      card.addChild(label);
      return;
    }
    const rw = 56;
    const rh = 24;
    const bg = new PIXI.Graphics();
    bg.beginFill(info.color, 0.85);
    bg.drawRoundedRect(tagPad, tagPad, rw, rh, 6);
    bg.endFill();
    card.addChild(bg);
    const t = new PIXI.Text(info.name, {
      fontSize: labelFont, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      stroke: 0x333333, strokeThickness: 2,
    } as any);
    t.anchor.set(0.5, 0.5);
    t.position.set(tagPad + rw / 2, tagPad + rh / 2);
    card.addChild(t);
  }

  // ─── equipped badge ───────────────────────────────────────

  private _addEquipBadge(card: PIXI.Container, cw: number): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(COLORS.BUTTON_PRIMARY);
    bg.drawCircle(cw - 14, 14, 11);
    bg.endFill();
    card.addChild(bg);
    const t = new PIXI.Text('✓', { fontSize: 13, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold' });
    t.anchor.set(0.5, 0.5);
    t.position.set(cw - 14, 14);
    card.addChild(t);
  }

  // ─── card footer (btn sprites + text overlay) ─────────────

  private _addFooter(
    card: PIXI.Container, cw: number, ch: number,
    mode: 'equipped' | 'ready' | 'purchase' | 'locked',
    cost: number | undefined,
    actionLabel: string,
  ): void {
    const key = mode === 'equipped' ? 'deco_card_btn_1' : mode === 'locked' ? 'deco_card_btn_2' : 'deco_card_btn_3';
    const tex = TextureCache.get(key);
    const bottomPad = 10;
    const maxBtnW = cw - 12;
    const targetH = Math.min(44, Math.round((34 * ch) / CARD_BASE_H));
    const labelFont = 16;
    const labelStyle = {
      fontSize: labelFont,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold' as const,
      stroke: 0x333333,
      strokeThickness: 2,
    };
    const lineText = mode === 'equipped' ? '使用中' : actionLabel;
    const pillCenterY = (btnHScaled: number) => ch - bottomPad - btnHScaled / 2;

    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const s = Math.min(maxBtnW / tex.width, targetH / tex.height);
      sp.scale.set(s);
      sp.anchor.set(0.5, 1);
      sp.position.set(cw / 2, ch - bottomPad);
      card.addChild(sp);
      const scaledH = tex.height * s;
      const cy = pillCenterY(scaledH);

      if (mode === 'purchase' && cost !== undefined && cost > 0) {
        const iconTex = TextureCache.get('icon_huayuan');
        const gap = 5;
        const iconH = Math.max(16, Math.min(28, Math.round(scaledH * 0.62)));
        let iconW = 0;
        const row = new PIXI.Container();
        row.position.set(cw / 2, cy);
        if (iconTex?.width) {
          const iconSp = new PIXI.Sprite(iconTex);
          iconSp.anchor.set(0.5, 0.5);
          iconSp.height = iconH;
          iconSp.width = (iconTex.width / iconTex.height) * iconH;
          iconW = iconSp.width;
          row.addChild(iconSp);
        }
        const price = new PIXI.Text(String(cost), labelStyle as any);
        price.anchor.set(0.5, 0.5);
        row.addChild(price);
        const rowW = iconW > 0 ? iconW + gap + price.width : price.width;
        let xLeft = -rowW / 2;
        if (iconW > 0) {
          (row.children[0] as PIXI.Sprite).position.set(xLeft + iconW / 2, 0);
          xLeft += iconW + gap;
        }
        price.position.set(xLeft + price.width / 2, 0);
        card.addChild(row);
      } else {
        const lockStyle = mode === 'locked' ? { ...labelStyle, fontSize: 13 } : labelStyle;
        const label = new PIXI.Text(lineText, lockStyle as any);
        label.anchor.set(0.5, 0.5);
        label.position.set(cw / 2, cy);
        card.addChild(label);
      }
    } else {
      const btnW = Math.min(maxBtnW, 100);
      const btnH = targetH;
      const btnY = ch - bottomPad - btnH;
      const color = mode === 'equipped' ? 0xbb88dd : mode === 'locked' ? 0xf0a030 : mode === 'ready' ? COLORS.BUTTON_PRIMARY : 0x4caf50;
      const g = new PIXI.Graphics();
      g.beginFill(color);
      g.drawRoundedRect(cw / 2 - btnW / 2, btnY, btnW, btnH, btnH / 2);
      g.endFill();
      card.addChild(g);
      const cy = btnY + btnH / 2;
      if (mode === 'purchase' && cost !== undefined && cost > 0) {
        const row = new PIXI.Container();
        row.position.set(cw / 2, cy);
        const gap = 5;
        const iconH = Math.max(16, Math.min(26, Math.round(btnH * 0.58)));
        const iconTex = TextureCache.get('icon_huayuan');
        let iconW = 0;
        if (iconTex?.width) {
          const iconSp = new PIXI.Sprite(iconTex);
          iconSp.anchor.set(0.5, 0.5);
          iconSp.height = iconH;
          iconSp.width = (iconTex.width / iconTex.height) * iconH;
          iconW = iconSp.width;
          row.addChild(iconSp);
        }
        const price = new PIXI.Text(String(cost), labelStyle as any);
        price.anchor.set(0.5, 0.5);
        row.addChild(price);
        const rowW = iconW > 0 ? iconW + gap + price.width : price.width;
        let xLeft = -rowW / 2;
        if (iconW > 0 && row.children[0]) {
          (row.children[0] as PIXI.Sprite).position.set(xLeft + iconW / 2, 0);
          xLeft += iconW + gap;
        }
        price.position.set(xLeft + price.width / 2, 0);
        card.addChild(row);
      } else {
        const fs = mode === 'locked' ? 12 : 14;
        const t = new PIXI.Text(lineText, { fontSize: fs, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold' });
        t.anchor.set(0.5, 0.5);
        t.position.set(cw / 2, cy);
        card.addChild(t);
      }
    }
  }

  // ─── build furniture card ─────────────────────────────────

  private _buildCard(deco: DecoDef, x: number, y: number, cw: number, ch: number): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const isUnlocked = DecorationManager.isUnlocked(deco.id);
    const isEquipped = DecorationManager.getEquipped(deco.slot) === deco.id;
    const reqResult = checkRequirement(deco.unlockRequirement);
    const reqMet = reqResult.met;

    this._drawCardBg(card, cw, ch, isUnlocked || reqMet, isEquipped);

    const maxIcon = Math.round((82 * cw) / CARD_BASE_W);
    const iconCy = Math.round((ch * 54) / CARD_BASE_H);
    const nameY = Math.max(
      Math.round((ch * 90) / CARD_BASE_H),
      iconCy + Math.ceil(maxIcon * 0.52) + 8,
    );

    const iconArea = new PIXI.Container();
    iconArea.position.set(cw / 2, iconCy);
    card.addChild(iconArea);

    const texture = TextureCache.get(deco.icon);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      const s = Math.min(maxIcon / texture.width, maxIcon / texture.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      if (!reqMet) sprite.alpha = 0.4;
      iconArea.addChild(sprite);
    } else {
      const emoji = new PIXI.Text(DECO_SLOT_INFO[deco.slot].emoji, {
        fontSize: Math.round((40 * cw) / CARD_BASE_W), fontFamily: FONT_FAMILY,
      });
      emoji.anchor.set(0.5, 0.5);
      if (!reqMet) emoji.alpha = 0.4;
      iconArea.addChild(emoji);
    }

    if (!reqMet) {
      const lock = new PIXI.Text('🔒', { fontSize: 22, fontFamily: FONT_FAMILY });
      lock.anchor.set(0.5, 0.5);
      lock.position.set(cw / 2, iconCy);
      card.addChild(lock);
    }

    this._addRarityTag(card, cw, deco.rarity);
    if (isEquipped) this._addEquipBadge(card, cw);

    const nameText = new PIXI.Text(deco.name, {
      fontSize: 15, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      wordWrap: true, wordWrapWidth: cw - 12, align: 'center',
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(cw / 2, nameY);
    card.addChild(nameText);

    if (isEquipped) this._addFooter(card, cw, ch, 'equipped', undefined, '装备');
    else if (isUnlocked) this._addFooter(card, cw, ch, 'ready', undefined, '装备');
    else if (!reqResult.met) this._addFooter(card, cw, ch, 'locked', undefined, reqResult.text);
    else if (deco.cost > 0) this._addFooter(card, cw, ch, 'purchase', deco.cost, '装备');
    else this._addFooter(card, cw, ch, 'ready', undefined, '领取');

    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginScroll(e);
      this._pendingGridTap = { type: 'deco', deco };
    });
    return card;
  }

  // ─── build room style card ────────────────────────────────

  private _buildRoomStyleCard(style: RoomStyleDef, x: number, y: number, cw: number, ch: number): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const unlocked = DecorationManager.isRoomStyleUnlocked(style.id);
    const equipped = DecorationManager.roomStyleId === style.id;
    const styleReq = checkRequirement(style.unlockRequirement);
    const styleReqMet = styleReq.met;

    this._drawCardBg(card, cw, ch, unlocked || styleReqMet, equipped);

    const previewCy = Math.round((ch * 54) / CARD_BASE_H);

    const preview = new PIXI.Container();
    preview.position.set(cw / 2, previewCy);
    card.addChild(preview);

    const tex = TextureCache.get(style.bgTexture);
    let previewHalfH = 0;
    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const maxW = cw - 12;
      const maxH = Math.round((76 * ch) / CARD_BASE_H);
      const s = Math.min(maxW / tex.width, maxH / tex.height);
      previewHalfH = Math.ceil((tex.height * s) / 2);
      sp.scale.set(s);
      sp.anchor.set(0.5, 0.5);
      if (!styleReqMet) sp.alpha = 0.45;
      preview.addChild(sp);
    } else {
      const ph = new PIXI.Text('🏠', { fontSize: Math.round((40 * cw) / CARD_BASE_W), fontFamily: FONT_FAMILY });
      ph.anchor.set(0.5, 0.5);
      if (!styleReqMet) ph.alpha = 0.45;
      preview.addChild(ph);
      previewHalfH = Math.ceil(ph.height / 2) || 20;
    }

    const nameY = Math.max(
      Math.round((ch * 90) / CARD_BASE_H),
      previewCy + (previewHalfH || 28) + 8,
    );

    if (!styleReqMet) {
      const lock = new PIXI.Text('🔒', { fontSize: 22, fontFamily: FONT_FAMILY });
      lock.anchor.set(0.5, 0.5);
      lock.position.set(cw / 2, previewCy);
      card.addChild(lock);
    }

    this._addRarityTag(card, cw, style.rarity);
    if (equipped) this._addEquipBadge(card, cw);

    const nameText = new PIXI.Text(style.name, {
      fontSize: 15, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      wordWrap: true, wordWrapWidth: cw - 12, align: 'center',
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(cw / 2, nameY);
    card.addChild(nameText);

    if (equipped) this._addFooter(card, cw, ch, 'equipped', undefined, '使用');
    else if (unlocked) this._addFooter(card, cw, ch, 'ready', undefined, '使用');
    else if (!styleReqMet) this._addFooter(card, cw, ch, 'locked', undefined, styleReq.text);
    else if (style.cost > 0) this._addFooter(card, cw, ch, 'purchase', style.cost, '使用');
    else this._addFooter(card, cw, ch, 'ready', undefined, '领取');

    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginScroll(e);
      this._pendingGridTap = { type: 'room', style };
    });
    return card;
  }

  // ─── tap handlers ─────────────────────────────────────────

  private _onCardTap(deco: DecoDef): void {
    const isUnlocked = DecorationManager.isUnlocked(deco.id);
    const isEquipped = DecorationManager.getEquipped(deco.slot) === deco.id;
    if (isEquipped) return;
    if (isUnlocked) {
      DecorationManager.equip(deco.id);
      this._refreshAll();
    } else {
      const req = checkRequirement(deco.unlockRequirement);
      if (!req.met) {
        ToastMessage.show( `🔒 ${req.text}`);
        return;
      }
      if (DecorationManager.unlock(deco.id)) {
        DecorationManager.equip(deco.id);
        ToastMessage.show( `✨ 解锁了「${deco.name}」！`);
        this._refreshAll();
      } else {
        ToastMessage.show( `🌸 花愿不足，需要 ${deco.cost} 花愿`);
      }
    }
  }

  private _onRoomStyleTap(style: RoomStyleDef): void {
    const unlocked = DecorationManager.isRoomStyleUnlocked(style.id);
    const equipped = DecorationManager.roomStyleId === style.id;
    if (equipped) return;
    if (unlocked) {
      if (DecorationManager.equipRoomStyle(style.id)) {
        ToastMessage.show( `已切换为「${style.name}」`);
        this._refreshAll();
      }
    } else {
      const req = checkRequirement(style.unlockRequirement);
      if (!req.met) {
        ToastMessage.show( `🔒 ${req.text}`);
        return;
      }
      if (DecorationManager.unlockRoomStyle(style.id)) {
        DecorationManager.equipRoomStyle(style.id);
        ToastMessage.show( `✨ 解锁「${style.name}」！`);
        this._refreshAll();
      } else {
        ToastMessage.show( `🌸 花愿不足，需要 ${style.cost} 花愿`);
      }
    }
  }

  // ─── utils ────────────────────────────────────────────────

  private _updateProgress(): void {
    this._progressText.text = `已收集 ${DecorationManager.unlockedCount}/${DecorationManager.totalCount}`;
  }

  private _applyScroll(): void {
    const inner = this._gridContainer.children[0];
    if (inner) inner.y = this._scrollY;
  }
}
