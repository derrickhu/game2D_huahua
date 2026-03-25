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
  DecoSlot, DECO_SLOT_INFO, DECO_RARITY_INFO,
  getSlotDecos, DecoDef,
  ROOM_STYLES, RoomStyleDef,
} from '@/config/DecorationConfig';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

const PANEL_W = DESIGN_WIDTH - 40;  // 710
/** 底部半高抽屉，少挡花店场景（原 0.78 居中全高） */
const PANEL_H_RATIO = 0.58;
const PANEL_TOP_R = 18;

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
const CARD_W = 140;
const CARD_H = 170;
const CARD_GAP = 10;

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
    const panelX = 20;
    const panelY = h - panelH;

    this._content = new PIXI.Container();
    this._content.position.set(panelX, panelY);
    this.addChild(this._content);

    const panelBg = new PIXI.Graphics();
    drawTopRoundedPanelFill(panelBg, PANEL_W, panelH, PANEL_TOP_R, 0xFFF8F0);
    strokeTopRoundedPanel(panelBg, PANEL_W, panelH, PANEL_TOP_R, 0xD4C4B0, 2);
    panelBg.eventMode = 'static';
    this._content.addChild(panelBg);

    // 标题
    this._titleText = new PIXI.Text('🏠 花店装修', {
      fontSize: 22, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    this._titleText.position.set(20, 16);
    this._content.addChild(this._titleText);

    // 收集进度
    this._progressText = new PIXI.Text('', {
      fontSize: 14, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    this._progressText.anchor.set(1, 0);
    this._progressText.position.set(PANEL_W - 20, 20);
    this._content.addChild(this._progressText);

    // 关闭按钮
    const closeBtn = new PIXI.Text('✕', {
      fontSize: 24, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    closeBtn.anchor.set(1, 0);
    closeBtn.position.set(PANEL_W - 50, 14);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointertap', () => this.close());
    this._content.addChild(closeBtn);

    // 分割线
    const divider = new PIXI.Graphics();
    divider.lineStyle(1, 0xE0D0C0);
    divider.moveTo(0, 52);
    divider.lineTo(PANEL_W, 52);
    this._content.addChild(divider);

    // 左侧 Tab 列表
    this._tabContainer = new PIXI.Container();
    this._tabContainer.position.set(0, 56);
    this._content.addChild(this._tabContainer);

    this._buildTabs(panelH - 56);

    // 右侧装饰网格
    this._gridContainer = new PIXI.Container();
    this._gridContainer.position.set(TAB_W + 4, 56);
    this._content.addChild(this._gridContainer);

    // 网格遮罩
    const gridW = PANEL_W - TAB_W - 4;
    const gridH = panelH - 56;
    this._gridMask = new PIXI.Graphics();
    this._gridMask.beginFill(0xFFFFFF);
    this._gridMask.drawRect(TAB_W + 4, 56, gridW, gridH);
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
      makeTab(
        i + 1,
        isCurrent,
        `${info.emoji}\n${info.name}`,
        () => { this._activeTab = slot; },
        footer,
      );
    });
  }

  private _refreshAll(): void {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    this._buildTabs(panelH - 56);
    this._buildGrid(panelH - 56);
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
    const cols = Math.floor((gridW - CARD_GAP) / (CARD_W + CARD_GAP));
    const startX = Math.floor((gridW - cols * (CARD_W + CARD_GAP) + CARD_GAP) / 2);

    const innerContainer = new PIXI.Container();
    this._gridContainer.addChild(innerContainer);

    decos.forEach((deco, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (CARD_W + CARD_GAP);
      const y = CARD_GAP + row * (CARD_H + CARD_GAP);

      const card = this._buildCard(deco, x, y);
      innerContainer.addChild(card);
    });

    // 计算滚动范围
    const totalRows = Math.ceil(decos.length / cols);
    const contentH = CARD_GAP + totalRows * (CARD_H + CARD_GAP);
    this._maxScrollY = Math.max(0, contentH - availH);
    this._scrollY = 0;
  }

  private _buildRoomStyleGrid(availH: number): void {
    const gridW = PANEL_W - TAB_W - 4;
    const cols = Math.floor((gridW - CARD_GAP) / (CARD_W + CARD_GAP));
    const startX = Math.floor((gridW - cols * (CARD_W + CARD_GAP) + CARD_GAP) / 2);

    const innerContainer = new PIXI.Container();
    this._gridContainer.addChild(innerContainer);

    ROOM_STYLES.forEach((style, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (CARD_W + CARD_GAP);
      const y = CARD_GAP + row * (CARD_H + CARD_GAP);
      innerContainer.addChild(this._buildRoomStyleCard(style, x, y));
    });

    const totalRows = Math.ceil(ROOM_STYLES.length / cols);
    const contentH = CARD_GAP + totalRows * (CARD_H + CARD_GAP);
    this._maxScrollY = Math.max(0, contentH - availH);
    this._scrollY = 0;
  }

  private _buildRoomStyleCard(style: RoomStyleDef, x: number, y: number): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const unlocked = DecorationManager.isRoomStyleUnlocked(style.id);
    const equipped = DecorationManager.roomStyleId === style.id;
    const rarityInfo = DECO_RARITY_INFO[style.rarity];

    const bg = new PIXI.Graphics();
    bg.beginFill(equipped ? 0xFFF0E0 : unlocked ? 0xFFFFFF : 0xF0ECEA);
    bg.drawRoundedRect(0, 0, CARD_W, CARD_H, 10);
    bg.endFill();
    if (equipped) {
      bg.lineStyle(2, COLORS.BUTTON_PRIMARY);
      bg.drawRoundedRect(0, 0, CARD_W, CARD_H, 10);
    } else {
      bg.lineStyle(1, 0xE0D0C0);
      bg.drawRoundedRect(0, 0, CARD_W, CARD_H, 10);
    }
    card.addChild(bg);

    const preview = new PIXI.Container();
    preview.position.set(CARD_W / 2, 52);
    card.addChild(preview);

    const tex = TextureCache.get(style.bgTexture);
    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const maxW = CARD_W - 14;
      const maxH = 72;
      const s = Math.min(maxW / tex.width, maxH / tex.height);
      sp.scale.set(s);
      sp.anchor.set(0.5, 0.5);
      if (!unlocked) sp.alpha = 0.45;
      preview.addChild(sp);
    } else {
      const ph = new PIXI.Text('🏠', { fontSize: 40, fontFamily: FONT_FAMILY });
      ph.anchor.set(0.5, 0.5);
      if (!unlocked) ph.alpha = 0.45;
      preview.addChild(ph);
    }

    if (!unlocked) {
      const lock = new PIXI.Text('🔒', { fontSize: 20, fontFamily: FONT_FAMILY });
      lock.anchor.set(0.5, 0.5);
      lock.position.set(CARD_W / 2, 52);
      card.addChild(lock);
    }

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

    if (equipped) {
      const badgeBg = new PIXI.Graphics();
      badgeBg.beginFill(COLORS.BUTTON_PRIMARY);
      badgeBg.drawCircle(CARD_W - 14, 14, 10);
      badgeBg.endFill();
      card.addChild(badgeBg);
      const equipBadge = new PIXI.Text('✓', {
        fontSize: 12, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      equipBadge.anchor.set(0.5, 0.5);
      equipBadge.position.set(CARD_W - 14, 14);
      card.addChild(equipBadge);
    }

    const nameText = new PIXI.Text(style.name, {
      fontSize: 12, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(CARD_W / 2, 92);
    card.addChild(nameText);

    const descText = new PIXI.Text(style.desc, {
      fontSize: 10, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      wordWrap: true, wordWrapWidth: CARD_W - 16, align: 'center',
    });
    descText.anchor.set(0.5, 0);
    descText.position.set(CARD_W / 2, 108);
    card.addChild(descText);

    if (equipped) {
      const label = new PIXI.Text('使用中', {
        fontSize: 11, fill: COLORS.BUTTON_PRIMARY, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      label.anchor.set(0.5, 1);
      label.position.set(CARD_W / 2, CARD_H - 6);
      card.addChild(label);
    } else if (unlocked) {
      const btn = new PIXI.Graphics();
      btn.beginFill(COLORS.BUTTON_PRIMARY);
      btn.drawRoundedRect(CARD_W / 2 - 35, CARD_H - 28, 70, 22, 6);
      btn.endFill();
      card.addChild(btn);
      const label = new PIXI.Text('使用', {
        fontSize: 11, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      label.anchor.set(0.5, 0.5);
      label.position.set(CARD_W / 2, CARD_H - 17);
      card.addChild(label);
    } else if (style.cost > 0) {
      const costLabel = new PIXI.Text(`🌸 ${style.cost}`, {
        fontSize: 11, fill: 0xff69b4, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      costLabel.anchor.set(0.5, 1);
      costLabel.position.set(CARD_W / 2, CARD_H - 6);
      card.addChild(costLabel);
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

  private _buildCard(deco: DecoDef, x: number, y: number): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const isUnlocked = DecorationManager.isUnlocked(deco.id);
    const isEquipped = DecorationManager.getEquipped(deco.slot) === deco.id;
    const rarityInfo = DECO_RARITY_INFO[deco.rarity];

    // 卡片背景
    const bg = new PIXI.Graphics();
    bg.beginFill(isEquipped ? 0xFFF0E0 : isUnlocked ? 0xFFFFFF : 0xF0ECEA);
    bg.drawRoundedRect(0, 0, CARD_W, CARD_H, 10);
    bg.endFill();
    if (isEquipped) {
      bg.lineStyle(2, COLORS.BUTTON_PRIMARY);
      bg.drawRoundedRect(0, 0, CARD_W, CARD_H, 10);
    } else {
      bg.lineStyle(1, 0xE0D0C0);
      bg.drawRoundedRect(0, 0, CARD_W, CARD_H, 10);
    }
    card.addChild(bg);

    // 图标区域
    const iconArea = new PIXI.Container();
    iconArea.position.set(CARD_W / 2, 50);
    card.addChild(iconArea);

    const texture = TextureCache.get(deco.icon);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      const maxSize = 70;
      const s = Math.min(maxSize / texture.width, maxSize / texture.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      if (!isUnlocked) sprite.alpha = 0.4;
      iconArea.addChild(sprite);
    } else {
      // fallback emoji
      const emoji = new PIXI.Text(DECO_SLOT_INFO[deco.slot].emoji, {
        fontSize: 36, fontFamily: FONT_FAMILY,
      });
      emoji.anchor.set(0.5, 0.5);
      if (!isUnlocked) emoji.alpha = 0.4;
      iconArea.addChild(emoji);
    }

    // 锁定图标
    if (!isUnlocked) {
      const lock = new PIXI.Text('🔒', { fontSize: 20, fontFamily: FONT_FAMILY });
      lock.anchor.set(0.5, 0.5);
      lock.position.set(CARD_W / 2, 50);
      card.addChild(lock);
    }

    // 稀有度标签
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

    // 装备中标记
    if (isEquipped) {
      const equipBadge = new PIXI.Text('✓', {
        fontSize: 12, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      equipBadge.anchor.set(0.5, 0.5);
      const badgeBg = new PIXI.Graphics();
      badgeBg.beginFill(COLORS.BUTTON_PRIMARY);
      badgeBg.drawCircle(CARD_W - 14, 14, 10);
      badgeBg.endFill();
      card.addChild(badgeBg);
      equipBadge.position.set(CARD_W - 14, 14);
      card.addChild(equipBadge);
    }

    // 名称
    const nameText = new PIXI.Text(deco.name, {
      fontSize: 12, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(CARD_W / 2, 90);
    card.addChild(nameText);

    // 描述
    const descText = new PIXI.Text(deco.desc, {
      fontSize: 10, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      wordWrap: true, wordWrapWidth: CARD_W - 16, align: 'center',
    });
    descText.anchor.set(0.5, 0);
    descText.position.set(CARD_W / 2, 106);
    card.addChild(descText);

    // 底部按钮/价格
    if (isEquipped) {
      const label = new PIXI.Text('使用中', {
        fontSize: 11, fill: COLORS.BUTTON_PRIMARY, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      label.anchor.set(0.5, 1);
      label.position.set(CARD_W / 2, CARD_H - 6);
      card.addChild(label);
    } else if (isUnlocked) {
      const btn = new PIXI.Graphics();
      btn.beginFill(COLORS.BUTTON_PRIMARY);
      btn.drawRoundedRect(CARD_W / 2 - 35, CARD_H - 28, 70, 22, 6);
      btn.endFill();
      card.addChild(btn);

      const label = new PIXI.Text('装备', {
        fontSize: 11, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      label.anchor.set(0.5, 0.5);
      label.position.set(CARD_W / 2, CARD_H - 17);
      card.addChild(label);
    } else if (deco.cost > 0) {
      const costLabel = new PIXI.Text(`🌸 ${deco.cost}`, {
        fontSize: 11, fill: 0xFF69B4, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      costLabel.anchor.set(0.5, 1);
      costLabel.position.set(CARD_W / 2, CARD_H - 6);
      card.addChild(costLabel);
    }

    // 点击事件
    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.on('pointertap', () => this._onCardTap(deco));

    return card;
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
