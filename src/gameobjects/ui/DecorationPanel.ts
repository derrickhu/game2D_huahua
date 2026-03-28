/**
 * 花店装修面板
 *
 * 布局：
 * - 底图复用 merge_chain_panel（金边奶油底）
 * - 顶部 merge_chain_ribbon 彩带 + 描边白字标题
 * - 左侧：分类 Tab 栏（药丸式纯文字）
 * - 右侧：家具/房间风格卡网格（2 列，可纵向滑动）
 * - 卡片为程序绘制双层金边圆角 + 贴图按钮 + 稀有度标签
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { DecorationManager } from '@/managers/DecorationManager';
import { TextureCache } from '@/utils/TextureCache';
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

const RIBBON_MAX_W = Math.round(PANEL_W * 0.72);
const RIBBON_MAX_H = 68;
/** 彩带整体下移，避免贴顶过挤 */
const RIBBON_Y = 8;

/** 家具网格与 Tab 区顶边（与横幅下移联动） */
const CONTENT_TOP = 102;
const CONTENT_BOTTOM = 10;

/** 左侧分类栏宽度（加大、避免贴边显得「偏」） */
const TAB_W = 108;
const TAB_GAP = 10;
/** Tab 列略右移，贴近内框左侧中线 */
const TAB_COLUMN_LEFT = 22;
const GRID_MARGIN_RIGHT = 14;

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
  private _gridContainer!: PIXI.Container;
  private _gridMask!: PIXI.Graphics;
  private _titleText!: PIXI.Text;
  private _progressText!: PIXI.Text;
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

    // --- ribbon（略压入面板，与 CONTENT_TOP 留出空隙） ---
    const ribbonTex = TextureCache.get('merge_chain_ribbon');
    let titleCenterY = 36;
    if (ribbonTex?.width) {
      const rib = new PIXI.Sprite(ribbonTex);
      const s = Math.min(RIBBON_MAX_W / ribbonTex.width, RIBBON_MAX_H / ribbonTex.height);
      rib.scale.set(s);
      rib.anchor.set(0.5, 0);
      rib.position.set(PANEL_W / 2, RIBBON_Y);
      rib.eventMode = 'static';
      this._content.addChild(rib);
      titleCenterY = RIBBON_Y + (ribbonTex.height * s) * 0.45;
    }

    // --- title (outlined white text like MergeChainPanel) ---
    this._titleText = new PIXI.Text('花店装修', {
      fontSize: 24,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x7a4530,
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: 0x5a2d10,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    } as any);
    this._titleText.anchor.set(0.5, 0.5);
    this._titleText.position.set(PANEL_W / 2, titleCenterY);
    this._content.addChild(this._titleText);

    // --- progress text ---
    this._progressText = new PIXI.Text('', {
      fontSize: 13, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    this._progressText.anchor.set(1, 0.5);
    this._progressText.position.set(PANEL_W - 20, titleCenterY);
    this._content.addChild(this._progressText);

    // --- close button (warehouse_close_btn sprite or text fallback) ---
    const closeTex = TextureCache.get('warehouse_close_btn');
    if (closeTex?.width) {
      const closeBtn = new PIXI.Sprite(closeTex);
      const cs = Math.min(36 / closeTex.width, 36 / closeTex.height);
      closeBtn.scale.set(cs);
      closeBtn.anchor.set(0.5, 0.5);
      closeBtn.position.set(PANEL_W - 24, titleCenterY);
      closeBtn.eventMode = 'static';
      closeBtn.cursor = 'pointer';
      closeBtn.on('pointertap', () => this.close());
      this._content.addChild(closeBtn);
    } else {
      const closeBtn = new PIXI.Text('✕', {
        fontSize: 22, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        stroke: 0x7a4530, strokeThickness: 3,
      } as any);
      closeBtn.anchor.set(0.5, 0.5);
      closeBtn.position.set(PANEL_W - 24, titleCenterY);
      closeBtn.eventMode = 'static';
      closeBtn.cursor = 'pointer';
      closeBtn.on('pointertap', () => this.close());
      this._content.addChild(closeBtn);
    }

    // --- layout zones（Tab 列与网格之间留白对称） ---
    const gridX = TAB_COLUMN_LEFT + TAB_W + TAB_GAP;
    const gridW = PANEL_W - gridX - GRID_MARGIN_RIGHT;
    const gridH = panelH - CONTENT_TOP - CONTENT_BOTTOM;

    // tab container：y 在 _buildTabs 内写入 _tabVerticalPad 后对齐
    this._tabContainer = new PIXI.Container();
    this._content.addChild(this._tabContainer);

    this._buildTabs(gridH);
    this._tabContainer.position.set(TAB_COLUMN_LEFT, CONTENT_TOP + this._tabVerticalPad);

    // grid container (right side)
    this._gridContainer = new PIXI.Container();
    this._gridContainer.position.set(gridX, CONTENT_TOP);
    this._content.addChild(this._gridContainer);

    // mask in _content coords covering exactly the grid area
    this._gridMask = new PIXI.Graphics();
    this._gridMask.beginFill(0xFFFFFF);
    this._gridMask.drawRect(gridX, CONTENT_TOP, gridW, gridH);
    this._gridMask.endFill();
    this._content.addChild(this._gridMask);
    this._gridContainer.mask = this._gridMask;

    // wheel scroll
    this._gridContainer.eventMode = 'static';
    this._gridContainer.on('wheel', (e: any) => {
      this._scrollY = Math.max(-this._maxScrollY, Math.min(0, this._scrollY - (e.deltaY || 0)));
      this._applyScroll();
    });
  }

  // ─── tabs (left column, pill-shaped text buttons) ─────────

  private _buildTabs(availH: number): void {
    this._tabContainer.removeChildren();

    const slots = Object.values(DecoSlot);
    const tabCount = 1 + slots.length;
    const tabH = Math.min(Math.floor(availH / tabCount), 66);
    this._tabVerticalPad = Math.max(0, Math.floor((availH - tabCount * tabH) / 2));
    const pad = 4;
    const bw = TAB_W - pad * 2;

    const makeTab = (row: number, isCurrent: boolean, title: string, onTap: () => void, footer?: string): void => {
      const tab = new PIXI.Container();
      tab.position.set(0, row * tabH);
      const bh = tabH - pad * 2;
      const bg = new PIXI.Graphics();
      if (isCurrent) {
        bg.beginFill(0xFFF0E0);
        bg.drawRoundedRect(pad, pad, bw, bh, bh / 2);
        bg.endFill();
        bg.lineStyle(2.5, COLORS.BUTTON_PRIMARY);
        bg.drawRoundedRect(pad, pad, bw, bh, bh / 2);
      } else {
        bg.beginFill(0xFFF8F0, 0.92);
        bg.drawRoundedRect(pad, pad, bw, bh, bh / 2);
        bg.endFill();
        bg.lineStyle(1, 0xE8D8C8, 0.85);
        bg.drawRoundedRect(pad, pad, bw, bh, bh / 2);
      }
      tab.addChild(bg);

      const label = new PIXI.Text(title, {
        fontSize: isCurrent ? 17 : 15,
        fill: isCurrent ? COLORS.TEXT_DARK : COLORS.TEXT_LIGHT,
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
    const gridH = panelH - CONTENT_TOP - CONTENT_BOTTOM;
    this._buildTabs(gridH);
    this._tabContainer.position.set(TAB_COLUMN_LEFT, CONTENT_TOP + this._tabVerticalPad);
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

    decos.forEach((deco, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      inner.addChild(this._buildCard(deco, startX + col * (cw + CARD_GAP), CARD_GAP + row * (ch + CARD_GAP), cw, ch));
    });

    const totalRows = Math.ceil(decos.length / cols);
    const contentH = CARD_GAP + totalRows * (ch + CARD_GAP);
    this._addScrollPlate(inner, gridW, contentH);
    this._maxScrollY = Math.max(0, contentH - availH);
    this._scrollY = 0;
  }

  private _buildRoomStyleGrid(availH: number): void {
    const gridW = PANEL_W - TAB_COLUMN_LEFT - TAB_W - TAB_GAP - GRID_MARGIN_RIGHT;
    const { cw, ch, cols, startX } = measureCardGrid(gridW);

    const inner = new PIXI.Container();
    this._gridContainer.addChild(inner);

    ROOM_STYLES.forEach((style, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      inner.addChild(this._buildRoomStyleCard(style, startX + col * (cw + CARD_GAP), CARD_GAP + row * (ch + CARD_GAP), cw, ch));
    });

    const totalRows = Math.ceil(ROOM_STYLES.length / cols);
    const contentH = CARD_GAP + totalRows * (ch + CARD_GAP);
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
    if (tex?.width) {
      const maxW = Math.min(72, Math.round(cw * 0.38));
      const maxH = 18;
      const s = Math.min(maxW / tex.width, maxH / tex.height);
      const sp = new PIXI.Sprite(tex);
      sp.scale.set(s);
      sp.position.set(4, 4);
      card.addChild(sp);
      const label = new PIXI.Text(info.name, {
        fontSize: 9, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        stroke: 0x333333, strokeThickness: 2,
      } as any);
      label.anchor.set(0.5, 0.5);
      label.position.set(4 + (tex.width * s) / 2, 4 + (tex.height * s) / 2);
      card.addChild(label);
      return;
    }
    const bg = new PIXI.Graphics();
    bg.beginFill(info.color, 0.85);
    bg.drawRoundedRect(4, 4, 38, 16, 4);
    bg.endFill();
    card.addChild(bg);
    const t = new PIXI.Text(info.name, {
      fontSize: 9, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    t.anchor.set(0.5, 0.5);
    t.position.set(23, 12);
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
    mode: 'equipped' | 'ready' | 'purchase',
    cost: number | undefined,
    actionLabel: string,
  ): void {
    const key = mode === 'equipped' ? 'deco_card_btn_1' : mode === 'ready' ? 'deco_card_btn_2' : 'deco_card_btn_3';
    const tex = TextureCache.get(key);
    const bottomPad = 10;
    const maxBtnW = cw - 16;
    const targetH = Math.min(32, Math.round((24 * ch) / CARD_BASE_H));

    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const s = Math.min(maxBtnW / tex.width, targetH / tex.height);
      sp.scale.set(s);
      sp.anchor.set(0.5, 1);
      sp.position.set(cw / 2, ch - bottomPad);
      card.addChild(sp);

      const labelText = mode === 'equipped' ? '使用中'
        : mode === 'purchase' && cost ? `🌸 ${cost}`
        : actionLabel;
      const label = new PIXI.Text(labelText, {
        fontSize: 12, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        stroke: 0x333333, strokeThickness: 2,
      } as any);
      label.anchor.set(0.5, 0.5);
      label.position.set(cw / 2, ch - bottomPad - (tex.height * s) / 2);
      card.addChild(label);
    } else {
      const btnW = Math.min(maxBtnW, 80);
      const btnH = targetH;
      const btnY = ch - bottomPad - btnH;
      const color = mode === 'equipped' ? 0xBB88DD : mode === 'ready' ? COLORS.BUTTON_PRIMARY : 0x4CAF50;
      const g = new PIXI.Graphics();
      g.beginFill(color);
      g.drawRoundedRect(cw / 2 - btnW / 2, btnY, btnW, btnH, btnH / 2);
      g.endFill();
      card.addChild(g);
      const labelText = mode === 'equipped' ? '使用中' : mode === 'purchase' && cost ? `🌸 ${cost}` : actionLabel;
      const t = new PIXI.Text(labelText, { fontSize: 11, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold' });
      t.anchor.set(0.5, 0.5);
      t.position.set(cw / 2, btnY + btnH / 2);
      card.addChild(t);
    }
  }

  // ─── build furniture card ─────────────────────────────────

  private _buildCard(deco: DecoDef, x: number, y: number, cw: number, ch: number): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const isUnlocked = DecorationManager.isUnlocked(deco.id);
    const isEquipped = DecorationManager.getEquipped(deco.slot) === deco.id;

    this._drawCardBg(card, cw, ch, isUnlocked, isEquipped);

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
      if (!isUnlocked) sprite.alpha = 0.4;
      iconArea.addChild(sprite);
    } else {
      const emoji = new PIXI.Text(DECO_SLOT_INFO[deco.slot].emoji, {
        fontSize: Math.round((40 * cw) / CARD_BASE_W), fontFamily: FONT_FAMILY,
      });
      emoji.anchor.set(0.5, 0.5);
      if (!isUnlocked) emoji.alpha = 0.4;
      iconArea.addChild(emoji);
    }

    if (!isUnlocked) {
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
    else if (deco.cost > 0) this._addFooter(card, cw, ch, 'purchase', deco.cost, '装备');

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

    this._drawCardBg(card, cw, ch, unlocked, equipped);

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
      if (!unlocked) sp.alpha = 0.45;
      preview.addChild(sp);
    } else {
      const ph = new PIXI.Text('🏠', { fontSize: Math.round((40 * cw) / CARD_BASE_W), fontFamily: FONT_FAMILY });
      ph.anchor.set(0.5, 0.5);
      if (!unlocked) ph.alpha = 0.45;
      preview.addChild(ph);
      previewHalfH = Math.ceil(ph.height / 2) || 20;
    }

    const nameY = Math.max(
      Math.round((ch * 90) / CARD_BASE_H),
      previewCy + (previewHalfH || 28) + 8,
    );

    if (!unlocked) {
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
    else if (style.cost > 0) this._addFooter(card, cw, ch, 'purchase', style.cost, '使用');

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
      if (DecorationManager.unlock(deco.id)) {
        DecorationManager.equip(deco.id);
        EventBus.emit('toast:show', `✨ 解锁了「${deco.name}」！`);
        this._refreshAll();
      } else {
        EventBus.emit('toast:show', `🌸 花愿不足，需要 ${deco.cost} 花愿`);
      }
    }
  }

  private _onRoomStyleTap(style: RoomStyleDef): void {
    const unlocked = DecorationManager.isRoomStyleUnlocked(style.id);
    const equipped = DecorationManager.roomStyleId === style.id;
    if (equipped) return;
    if (unlocked) {
      if (DecorationManager.equipRoomStyle(style.id)) {
        EventBus.emit('toast:show', `已切换为「${style.name}」`);
        this._refreshAll();
      }
    } else {
      if (DecorationManager.unlockRoomStyle(style.id)) {
        DecorationManager.equipRoomStyle(style.id);
        EventBus.emit('toast:show', `✨ 解锁「${style.name}」！`);
        this._refreshAll();
      } else {
        EventBus.emit('toast:show', `🌸 花愿不足，需要 ${style.cost} 花愿`);
      }
    }
  }

  // ─── utils ────────────────────────────────────────────────

  private _updateProgress(): void {
    this._progressText.text = `${DecorationManager.unlockedCount}/${DecorationManager.totalCount}`;
  }

  private _applyScroll(): void {
    const inner = this._gridContainer.children[0];
    if (inner) inner.y = this._scrollY;
  }
}
