/**
 * 花店装修面板
 *
 * 布局：
 * - 顶部标题 + 收集进度
 * - 左侧10个槽位 Tab
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
} from '@/config/DecorationConfig';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

const PANEL_W = DESIGN_WIDTH - 40;  // 710
const PANEL_H_RATIO = 0.78;         // 面板高度占屏幕比例
const TAB_W = 90;
const CARD_W = 140;
const CARD_H = 170;
const CARD_GAP = 10;

export class DecorationPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _tabContainer!: PIXI.Container;
  private _gridContainer!: PIXI.Container;
  private _gridMask!: PIXI.Graphics;
  private _titleText!: PIXI.Text;
  private _progressText!: PIXI.Text;
  private _isOpen = false;
  private _currentSlot: DecoSlot = DecoSlot.SHELF;
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
    this._currentSlot = DecoSlot.SHELF;
    this._refreshAll();

    this.alpha = 0;
    this._content.scale.set(0.8);
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.scale, props: { x: 1, y: 1 }, duration: 0.25, ease: Ease.easeOutBack });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.2, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    // 半透明遮罩
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    // 面板内容
    const panelH = Math.round(h * PANEL_H_RATIO);
    const panelX = 20;
    const panelY = Math.round((h - panelH) / 2);

    this._content = new PIXI.Container();
    this._content.position.set(panelX, panelY);
    this.addChild(this._content);

    // 面板背景
    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0xFFF8F0);
    panelBg.drawRoundedRect(0, 0, PANEL_W, panelH, 16);
    panelBg.endFill();
    panelBg.lineStyle(2, 0xD4C4B0);
    panelBg.drawRoundedRect(0, 0, PANEL_W, panelH, 16);
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
    const tabH = Math.min(availH / slots.length, 60);

    slots.forEach((slot, i) => {
      const info = DECO_SLOT_INFO[slot];
      const isCurrent = slot === this._currentSlot;

      const tab = new PIXI.Container();
      tab.position.set(0, i * tabH);

      // Tab 背景
      const bg = new PIXI.Graphics();
      bg.beginFill(isCurrent ? 0xFFE8D0 : 0xFFF8F0);
      bg.drawRoundedRect(2, 2, TAB_W - 4, tabH - 4, 8);
      bg.endFill();
      if (isCurrent) {
        bg.lineStyle(2, COLORS.BUTTON_PRIMARY);
        bg.drawRoundedRect(2, 2, TAB_W - 4, tabH - 4, 8);
      }
      tab.addChild(bg);

      // 图标+名称
      const label = new PIXI.Text(`${info.emoji}\n${info.name}`, {
        fontSize: 12, fill: isCurrent ? COLORS.TEXT_DARK : COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY, align: 'center', lineHeight: 16,
      });
      label.anchor.set(0.5, 0.5);
      label.position.set(TAB_W / 2, tabH / 2);
      tab.addChild(label);

      // 进度小点
      const prog = DecorationManager.getSlotProgress(slot);
      if (prog.unlocked > 1) {  // >1 因为免费的不算
        const dot = new PIXI.Text(`${prog.unlocked}/${prog.total}`, {
          fontSize: 8, fill: 0x999999, fontFamily: FONT_FAMILY,
        });
        dot.anchor.set(0.5, 1);
        dot.position.set(TAB_W / 2, tabH - 4);
        tab.addChild(dot);
      }

      tab.eventMode = 'static';
      tab.cursor = 'pointer';
      tab.on('pointertap', () => {
        this._currentSlot = slot;
        this._scrollY = 0;
        this._refreshAll();
      });

      this._tabContainer.addChild(tab);
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

    const decos = getSlotDecos(this._currentSlot);
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
