/**
 * 花店装修面板
 *
 * 布局：
 * - 顶部标题 + 收集进度
 * - 左侧：房间风格 Tab + 6 类家具槽位 Tab
 * - 右侧对应槽位的装饰方案网格
 * - 每个装饰卡片显示图片/名称/稀有度/花愿价格
 * - 点击已解锁的装饰可装备，点击未解锁的可购买
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

const PANEL_W = DESIGN_WIDTH - 40;  // 710
/** 面板相对设计宽的左边距（增大则整块面板右移） */
const PANEL_MARGIN_LEFT = 36;
/** 底部半高抽屉，少挡花店场景（原 0.78 居中全高） */
const PANEL_H_RATIO = 0.58;
const PANEL_TOP_R = 18;
/** 标题彩带最大尺寸（相对面板顶，略放大） */
const DECO_RIBBON_MAX_W = PANEL_W - 32;
const DECO_RIBBON_MAX_H = 72;
/** 分割线 y、左侧 Tab / 右侧网格顶边（在彩带行之下，随彩带增高） */
const DECO_DIVIDER_Y = 86;
const DECO_TAB_TOP = 90;
/** 家具卡网格相对原算法的缩放（<1 略缩小卡片区） */
const DECO_CARD_SCALE = 0.88;
/** 右侧家具网格内容相对区域再右移（像素） */
const DECO_GRID_SHIFT_X = 22;

const DECO_RARITY_TAG_KEYS: Record<DecoRarity, string> = {
  [DecoRarity.COMMON]: 'deco_rarity_tag_common',
  [DecoRarity.FINE]: 'deco_rarity_tag_fine',
  [DecoRarity.RARE]: 'deco_rarity_tag_rare',
  [DecoRarity.LIMITED]: 'deco_rarity_tag_limited',
};

/** 仅顶部圆角矩形（贴合屏幕底边的抽屉） */
function drawTopRoundedPanelFill(g: PIXI.Graphics, pw: number, ph: number, r: number, fill: number): void {
  g.beginFill(fill);
  g.moveTo(0, ph);
  g.lineTo(0, r);
  g.quadraticCurveTo(0, 0, r, 0);
  g.lineTo(pw - r, 0);
  g.quadraticCurveTo(pw, 0, pw, r);
  g.lineTo(pw, ph);
  g.lineTo(0, ph);
  g.closePath();
  g.endFill();
}

function strokeTopRoundedPanel(g: PIXI.Graphics, pw: number, ph: number, r: number, color: number, width: number): void {
  g.lineStyle(width, color);
  g.moveTo(0, ph);
  g.lineTo(0, r);
  g.quadraticCurveTo(0, 0, r, 0);
  g.lineTo(pw - r, 0);
  g.quadraticCurveTo(pw, 0, pw, r);
  g.lineTo(pw, ph);
  g.lineTo(0, ph);
  g.closePath();
}
const TAB_W = 90;

/** 右侧网格固定 3 列，卡片随面板宽度放大 */
const GRID_COLS = 3;
const CARD_GAP = 10;

/** 基准 140×170，用于按比例缩放卡片内排版 */
const CARD_BASE_W = 140;
const CARD_BASE_H = 170;

function measureCardGrid(gridW: number): { cw: number; ch: number; cols: number; startX: number } {
  const cwRaw = Math.max(
    168,
    Math.floor((gridW - CARD_GAP * (GRID_COLS + 1)) / GRID_COLS),
  );
  const cw = Math.max(132, Math.round(cwRaw * DECO_CARD_SCALE));
  const ch = Math.round((cw * CARD_BASE_H) / CARD_BASE_W);
  const cols = GRID_COLS;
  const blockW = cols * cw + (cols - 1) * CARD_GAP;
  const startX = Math.floor((gridW - blockW) / 2) + DECO_GRID_SHIFT_X;
  return { cw, ch, cols, startX };
}

/** 左侧「房间风格」与家具槽位切换 */
type DecoPanelTab = 'room_styles' | DecoSlot;

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

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
  }

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
    TweenManager.to({
      target: this._content.position,
      props: { y: panelY },
      duration: 0.28,
      ease: Ease.easeOutQuad,
    });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    const h = Game.logicHeight;
    TweenManager.cancelTarget(this._content.position);
    TweenManager.to({
      target: this._content.position,
      props: { y: h },
      duration: 0.22,
      ease: Ease.easeInQuad,
    });
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.2, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.38);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    // 面板内容
    const panelH = Math.round(h * PANEL_H_RATIO);
    const panelX = PANEL_MARGIN_LEFT;
    const panelY = h - panelH;

    this._content = new PIXI.Container();
    this._content.position.set(panelX, panelY);
    this.addChild(this._content);

    const panelTex = TextureCache.get('deco_panel_popup_frame');
    if (panelTex?.width) {
      const panelBg = new PIXI.Sprite(panelTex);
      panelBg.width = PANEL_W;
      panelBg.height = panelH;
      panelBg.eventMode = 'static';
      this._content.addChild(panelBg);
    } else {
      const panelBg = new PIXI.Graphics();
      drawTopRoundedPanelFill(panelBg, PANEL_W, panelH, PANEL_TOP_R, 0xFFF8F0);
      strokeTopRoundedPanel(panelBg, PANEL_W, panelH, PANEL_TOP_R, 0xD4C4B0, 2);
      panelBg.eventMode = 'static';
      this._content.addChild(panelBg);
    }

    const ribbonTex = TextureCache.get('deco_panel_title_ribbon');
    let titleCenterY = 30;
    if (ribbonTex?.width) {
      const rib = new PIXI.Sprite(ribbonTex);
      const s = Math.min(DECO_RIBBON_MAX_W / ribbonTex.width, DECO_RIBBON_MAX_H / ribbonTex.height);
      rib.scale.set(s);
      rib.anchor.set(0.5, 0);
      rib.position.set(PANEL_W / 2, 6);
      rib.eventMode = 'static';
      this._content.addChild(rib);
      titleCenterY = 6 + (ribbonTex.height * s) / 2;
    }

    this._titleText = new PIXI.Text('花店装修', {
      fontSize: 22, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    this._titleText.anchor.set(0.5, 0.5);
    this._titleText.position.set(PANEL_W / 2, titleCenterY);
    this._content.addChild(this._titleText);

    this._progressText = new PIXI.Text('', {
      fontSize: 14, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    this._progressText.anchor.set(1, 0);
    this._progressText.position.set(PANEL_W - 16, Math.max(8, titleCenterY - 14));
    this._content.addChild(this._progressText);

    const closeBtn = new PIXI.Text('✕', {
      fontSize: 24, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    closeBtn.anchor.set(1, 0);
    closeBtn.position.set(PANEL_W - 12, Math.max(6, titleCenterY - 16));
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointertap', () => this.close());
    this._content.addChild(closeBtn);

    const divider = new PIXI.Graphics();
    divider.lineStyle(1, 0xE0D0C0);
    divider.moveTo(0, DECO_DIVIDER_Y);
    divider.lineTo(PANEL_W, DECO_DIVIDER_Y);
    this._content.addChild(divider);

    this._tabContainer = new PIXI.Container();
    this._tabContainer.position.set(0, DECO_TAB_TOP);
    this._content.addChild(this._tabContainer);

    this._buildTabs(panelH - DECO_TAB_TOP);

    this._gridContainer = new PIXI.Container();
    this._gridContainer.position.set(TAB_W + 4, DECO_TAB_TOP);
    this._content.addChild(this._gridContainer);

    const gridW = PANEL_W - TAB_W - 4;
    const gridH = panelH - DECO_TAB_TOP;
    this._gridMask = new PIXI.Graphics();
    this._gridMask.beginFill(0xFFFFFF);
    this._gridMask.drawRect(TAB_W + 4, DECO_TAB_TOP, gridW, gridH);
    this._gridMask.endFill();
    this._content.addChild(this._gridMask);
    this._gridContainer.mask = this._gridMask;

    // 滚动事件
    this._gridContainer.eventMode = 'static';
    this._gridContainer.on('wheel', (e: any) => {
      this._scrollY = Math.max(-this._maxScrollY, Math.min(0, this._scrollY - (e.deltaY || 0)));
      this._applyScroll();
    });
  }

  private _buildTabs(availH: number): void {
    this._tabContainer.removeChildren();

    const slots = Object.values(DecoSlot);
    const tabCount = 1 + slots.length;
    const tabH = Math.min(availH / tabCount, 58);

    const makeTab = (
      rowIndex: number,
      isCurrent: boolean,
      title: string,
      onTap: () => void,
      footer?: string,
    ): void => {
      const tab = new PIXI.Container();
      tab.position.set(0, rowIndex * tabH);
      const bg = new PIXI.Graphics();
      bg.beginFill(isCurrent ? 0xFFE8D0 : 0xFFF8F0);
      bg.drawRoundedRect(2, 2, TAB_W - 4, tabH - 4, 8);
      bg.endFill();
      if (isCurrent) {
        bg.lineStyle(2, COLORS.BUTTON_PRIMARY);
        bg.drawRoundedRect(2, 2, TAB_W - 4, tabH - 4, 8);
      }
      tab.addChild(bg);

      const label = new PIXI.Text(title, {
        fontSize: 11,
        fill: isCurrent ? COLORS.TEXT_DARK : COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
        align: 'center',
        lineHeight: 15,
      });
      label.anchor.set(0.5, 0.5);
      label.position.set(TAB_W / 2, tabH / 2 - (footer ? 5 : 0));
      tab.addChild(label);
      if (footer) {
        const dot = new PIXI.Text(footer, {
          fontSize: 8, fill: 0x999999, fontFamily: FONT_FAMILY,
        });
        dot.anchor.set(0.5, 1);
        dot.position.set(TAB_W / 2, tabH - 4);
        tab.addChild(dot);
      }
      tab.eventMode = 'static';
      tab.cursor = 'pointer';
      tab.on('pointertap', () => {
        onTap();
        this._scrollY = 0;
        this._refreshAll();
      });
      this._tabContainer.addChild(tab);
    };

    makeTab(
      0,
      this._activeTab === 'room_styles',
      '🖼️\n房间风格',
      () => { this._activeTab = 'room_styles'; },
    );

    slots.forEach((slot, i) => {
      const info = DECO_SLOT_INFO[slot];
      const isCurrent = this._activeTab === slot;
      const prog = DecorationManager.getSlotProgress(slot);
      const footer = prog.unlocked > 1 ? `${prog.unlocked}/${prog.total}` : undefined;
      const row = i + 1;
      makeTab(
        row,
        isCurrent,
        `${info.emoji}\n${info.name}`,
        () => { this._activeTab = slot; },
        footer,
      );
    });
  }

  private _refreshAll(): void {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    this._buildTabs(panelH - DECO_TAB_TOP);
    this._buildGrid(panelH - DECO_TAB_TOP);
    this._updateProgress();
  }

  private _buildGrid(availH: number): void {
    this._gridContainer.removeChildren();

    if (this._activeTab === 'room_styles') {
      this._buildRoomStyleGrid(availH);
      return;
    }

    const decos = getSlotDecos(this._activeTab);
    const gridW = PANEL_W - TAB_W - 4;
    const { cw, ch, cols, startX } = measureCardGrid(gridW);

    const innerContainer = new PIXI.Container();
    this._gridContainer.addChild(innerContainer);

    decos.forEach((deco, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cw + CARD_GAP);
      const y = CARD_GAP + row * (ch + CARD_GAP);

      const card = this._buildCard(deco, x, y, cw, ch);
      innerContainer.addChild(card);
    });

    // 计算滚动范围
    const totalRows = Math.ceil(decos.length / cols);
    const contentH = CARD_GAP + totalRows * (ch + CARD_GAP);
    this._maxScrollY = Math.max(0, contentH - availH);
    this._scrollY = 0;
  }

  private _buildRoomStyleGrid(availH: number): void {
    const gridW = PANEL_W - TAB_W - 4;
    const { cw, ch, cols, startX } = measureCardGrid(gridW);

    const innerContainer = new PIXI.Container();
    this._gridContainer.addChild(innerContainer);

    ROOM_STYLES.forEach((style, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cw + CARD_GAP);
      const y = CARD_GAP + row * (ch + CARD_GAP);
      innerContainer.addChild(this._buildRoomStyleCard(style, x, y, cw, ch));
    });

    const totalRows = Math.ceil(ROOM_STYLES.length / cols);
    const contentH = CARD_GAP + totalRows * (ch + CARD_GAP);
    this._maxScrollY = Math.max(0, contentH - availH);
    this._scrollY = 0;
  }

  /** 左上角稀有度角标（tag.png 2×2 切图；无贴图时回退矢量+字） */
  private _addRarityTag(card: PIXI.Container, cw: number, rarity: DecoRarity): void {
    const key = DECO_RARITY_TAG_KEYS[rarity];
    const tex = TextureCache.get(key);
    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const maxW = Math.min(100, Math.round(cw * 0.42));
      const maxH = 24;
      const s = Math.min(maxW / tex.width, maxH / tex.height);
      sp.scale.set(s);
      sp.anchor.set(0, 0);
      sp.position.set(4, 4);
      card.addChild(sp);
      return;
    }
    const rarityInfo = DECO_RARITY_INFO[rarity];
    const rarityBg = new PIXI.Graphics();
    rarityBg.beginFill(rarityInfo.color, 0.15);
    rarityBg.drawRoundedRect(4, 4, 36, 16, 4);
    rarityBg.endFill();
    card.addChild(rarityBg);
    const rarityLabel = new PIXI.Text(rarityInfo.name, {
      fontSize: 10, fill: rarityInfo.color, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    rarityLabel.anchor.set(0.5, 0.5);
    rarityLabel.position.set(22, 12);
    card.addChild(rarityLabel);
  }

  private _buildRoomStyleCard(style: RoomStyleDef, x: number, y: number, cw: number, ch: number): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const unlocked = DecorationManager.isRoomStyleUnlocked(style.id);
    const equipped = DecorationManager.roomStyleId === style.id;

    const r = Math.min(12, Math.max(8, Math.round(cw * 0.07)));
    const previewCy = Math.round((ch * 52) / CARD_BASE_H);
    const nameY = Math.round((ch * 92) / CARD_BASE_H);
    const descY = Math.round((ch * 108) / CARD_BASE_H);

    const bg = new PIXI.Graphics();
    bg.beginFill(equipped ? 0xFFF0E0 : unlocked ? 0xFFFFFF : 0xF0ECEA);
    bg.drawRoundedRect(0, 0, cw, ch, r);
    bg.endFill();
    if (equipped) {
      bg.lineStyle(2, COLORS.BUTTON_PRIMARY);
      bg.drawRoundedRect(0, 0, cw, ch, r);
    } else {
      bg.lineStyle(1, 0xE0D0C0);
      bg.drawRoundedRect(0, 0, cw, ch, r);
    }
    card.addChild(bg);

    const preview = new PIXI.Container();
    preview.position.set(cw / 2, previewCy);
    card.addChild(preview);

    const tex = TextureCache.get(style.bgTexture);
    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const maxW = cw - 14;
      const maxH = Math.round((72 * ch) / CARD_BASE_H);
      const s = Math.min(maxW / tex.width, maxH / tex.height);
      sp.scale.set(s);
      sp.anchor.set(0.5, 0.5);
      if (!unlocked) sp.alpha = 0.45;
      preview.addChild(sp);
    } else {
      const ph = new PIXI.Text('🏠', { fontSize: Math.round((40 * cw) / CARD_BASE_W), fontFamily: FONT_FAMILY });
      ph.anchor.set(0.5, 0.5);
      if (!unlocked) ph.alpha = 0.45;
      preview.addChild(ph);
    }

    if (!unlocked) {
      const lock = new PIXI.Text('🔒', { fontSize: 20, fontFamily: FONT_FAMILY });
      lock.anchor.set(0.5, 0.5);
      lock.position.set(cw / 2, previewCy);
      card.addChild(lock);
    }

    this._addRarityTag(card, cw, style.rarity);

    if (equipped) {
      const badgeBg = new PIXI.Graphics();
      badgeBg.beginFill(COLORS.BUTTON_PRIMARY);
      badgeBg.drawCircle(cw - 14, 14, 10);
      badgeBg.endFill();
      card.addChild(badgeBg);
      const equipBadge = new PIXI.Text('✓', {
        fontSize: 12, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      equipBadge.anchor.set(0.5, 0.5);
      equipBadge.position.set(cw - 14, 14);
      card.addChild(equipBadge);
    }

    const nameText = new PIXI.Text(style.name, {
      fontSize: 12, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(cw / 2, nameY);
    card.addChild(nameText);

    const descText = new PIXI.Text(style.desc, {
      fontSize: 10, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      wordWrap: true, wordWrapWidth: cw - 16, align: 'center',
    });
    descText.anchor.set(0.5, 0);
    descText.position.set(cw / 2, descY);
    card.addChild(descText);

    if (equipped) {
      this._addDecoCardFooter(card, cw, ch, 'equipped', undefined, '使用');
    } else if (unlocked) {
      this._addDecoCardFooter(card, cw, ch, 'ready', undefined, '使用');
    } else if (style.cost > 0) {
      this._addDecoCardFooter(card, cw, ch, 'purchase', style.cost, '使用');
    }

    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.on('pointertap', () => this._onRoomStyleTap(style));
    return card;
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

  private _buildCard(deco: DecoDef, x: number, y: number, cw: number, ch: number): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const isUnlocked = DecorationManager.isUnlocked(deco.id);
    const isEquipped = DecorationManager.getEquipped(deco.slot) === deco.id;

    const r = Math.min(12, Math.max(8, Math.round(cw * 0.07)));
    const iconCy = Math.round((ch * 50) / CARD_BASE_H);
    const nameY = Math.round((ch * 90) / CARD_BASE_H);
    const descY = Math.round((ch * 106) / CARD_BASE_H);
    const maxIcon = Math.round((70 * cw) / CARD_BASE_W);

    // 卡片背景
    const bg = new PIXI.Graphics();
    bg.beginFill(isEquipped ? 0xFFF0E0 : isUnlocked ? 0xFFFFFF : 0xF0ECEA);
    bg.drawRoundedRect(0, 0, cw, ch, r);
    bg.endFill();
    if (isEquipped) {
      bg.lineStyle(2, COLORS.BUTTON_PRIMARY);
      bg.drawRoundedRect(0, 0, cw, ch, r);
    } else {
      bg.lineStyle(1, 0xE0D0C0);
      bg.drawRoundedRect(0, 0, cw, ch, r);
    }
    card.addChild(bg);

    // 图标区域
    const iconArea = new PIXI.Container();
    iconArea.position.set(cw / 2, iconCy);
    card.addChild(iconArea);

    const texture = TextureCache.get(deco.icon);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      const maxSize = maxIcon;
      const s = Math.min(maxSize / texture.width, maxSize / texture.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      if (!isUnlocked) sprite.alpha = 0.4;
      iconArea.addChild(sprite);
    } else {
      // fallback emoji
      const emoji = new PIXI.Text(DECO_SLOT_INFO[deco.slot].emoji, {
        fontSize: Math.round((36 * cw) / CARD_BASE_W),
        fontFamily: FONT_FAMILY,
      });
      emoji.anchor.set(0.5, 0.5);
      if (!isUnlocked) emoji.alpha = 0.4;
      iconArea.addChild(emoji);
    }

    // 锁定图标
    if (!isUnlocked) {
      const lock = new PIXI.Text('🔒', { fontSize: 20, fontFamily: FONT_FAMILY });
      lock.anchor.set(0.5, 0.5);
      lock.position.set(cw / 2, iconCy);
      card.addChild(lock);
    }

    this._addRarityTag(card, cw, deco.rarity);

    // 装备中标记
    if (isEquipped) {
      const equipBadge = new PIXI.Text('✓', {
        fontSize: 12, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      equipBadge.anchor.set(0.5, 0.5);
      const badgeBg = new PIXI.Graphics();
      badgeBg.beginFill(COLORS.BUTTON_PRIMARY);
      badgeBg.drawCircle(cw - 14, 14, 10);
      badgeBg.endFill();
      card.addChild(badgeBg);
      equipBadge.position.set(cw - 14, 14);
      card.addChild(equipBadge);
    }

    // 名称
    const nameText = new PIXI.Text(deco.name, {
      fontSize: 12, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(cw / 2, nameY);
    card.addChild(nameText);

    // 描述
    const descText = new PIXI.Text(deco.desc, {
      fontSize: 10, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      wordWrap: true, wordWrapWidth: cw - 16, align: 'center',
    });
    descText.anchor.set(0.5, 0);
    descText.position.set(cw / 2, descY);
    card.addChild(descText);

    if (isEquipped) {
      this._addDecoCardFooter(card, cw, ch, 'equipped', undefined, '装备');
    } else if (isUnlocked) {
      this._addDecoCardFooter(card, cw, ch, 'ready', undefined, '装备');
    } else if (deco.cost > 0) {
      this._addDecoCardFooter(card, cw, ch, 'purchase', deco.cost, '装备');
    }

    // 点击事件
    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.on('pointertap', () => this._onCardTap(deco));

    return card;
  }

  /**
   * 家具卡 / 房间风格卡底部条：`assets/button` 1=使用中 2=可点 3=花愿购买。
   * 无贴图时回退为矢量按钮 + 文案（ready 文案因房间/家具而异）。
   */
  private _addDecoCardFooter(
    card: PIXI.Container,
    cw: number,
    ch: number,
    mode: 'equipped' | 'ready' | 'purchase',
    cost: number | undefined,
    readyFallbackLabel: '使用' | '装备',
  ): void {
    const key =
      mode === 'equipped' ? 'deco_card_btn_1' :
      mode === 'ready' ? 'deco_card_btn_2' :
      'deco_card_btn_3';
    const tex = TextureCache.get(key);
    const bottomPad = 4;
    const btnW = Math.min(78, Math.round((70 * cw) / CARD_BASE_W));
    const btnH = Math.round((22 * ch) / CARD_BASE_H);

    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const maxW = cw - 12;
      const targetH = Math.min(44, Math.round((30 * ch) / CARD_BASE_H));
      const s = Math.min(maxW / tex.width, targetH / tex.height);
      sp.scale.set(s);
      sp.anchor.set(0.5, 1);
      sp.position.set(cw / 2, ch - bottomPad);
      card.addChild(sp);
      if (mode === 'purchase' && cost !== undefined && cost > 0) {
        const costLabel = new PIXI.Text(`🌸 ${cost}`, {
          fontSize: 11, fill: 0xFF69B4, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        });
        costLabel.anchor.set(0.5, 0.5);
        costLabel.position.set(cw / 2, ch - bottomPad - (tex.height * s) / 2);
        card.addChild(costLabel);
      }
    } else if (mode === 'equipped') {
      const label = new PIXI.Text('使用中', {
        fontSize: 11, fill: COLORS.BUTTON_PRIMARY, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      label.anchor.set(0.5, 1);
      label.position.set(cw / 2, ch - 6);
      card.addChild(label);
    } else if (mode === 'ready') {
      const btn = new PIXI.Graphics();
      btn.beginFill(COLORS.BUTTON_PRIMARY);
      btn.drawRoundedRect(cw / 2 - btnW / 2, ch - 28, btnW, btnH, 6);
      btn.endFill();
      card.addChild(btn);
      const label = new PIXI.Text(readyFallbackLabel, {
        fontSize: 11, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      label.anchor.set(0.5, 0.5);
      label.position.set(cw / 2, ch - 17);
      card.addChild(label);
    } else if (cost !== undefined && cost > 0) {
      const costLabel = new PIXI.Text(`🌸 ${cost}`, {
        fontSize: 11, fill: 0xFF69B4, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      costLabel.anchor.set(0.5, 1);
      costLabel.position.set(cw / 2, ch - 6);
      card.addChild(costLabel);
    }
  }

  private _onCardTap(deco: DecoDef): void {
    const isUnlocked = DecorationManager.isUnlocked(deco.id);
    const isEquipped = DecorationManager.getEquipped(deco.slot) === deco.id;

    if (isEquipped) return; // 已装备，无操作

    if (isUnlocked) {
      // 装备
      DecorationManager.equip(deco.id);
      this._refreshAll();
    } else {
      // 尝试购买
      if (DecorationManager.unlock(deco.id)) {
        // 购买成功，自动装备
        DecorationManager.equip(deco.id);
        EventBus.emit('toast:show', `✨ 解锁了「${deco.name}」！`);
        this._refreshAll();
      } else {
        EventBus.emit('toast:show', `🌸 花愿不足，需要 ${deco.cost} 花愿`);
      }
    }
  }

  private _updateProgress(): void {
    this._progressText.text = `已收集 ${DecorationManager.unlockedCount}/${DecorationManager.totalCount}`;
  }

  private _applyScroll(): void {
    const inner = this._gridContainer.children[0];
    if (inner) {
      inner.y = this._scrollY;
    }
  }
}
