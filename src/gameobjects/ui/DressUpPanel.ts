/**
 * 换装面板 - 店主换装系统 UI
 *
 * 5个槽位：发型 / 上装 / 下装 / 配饰 / 特效
 * 使用花露解锁，装备后即时生效
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DressUpManager, DressUpSlot, CostumeItem } from '@/managers/DressUpManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { ToastMessage } from './ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

/** 槽位显示配置 */
const SLOT_DISPLAY: { slot: DressUpSlot; icon: string; name: string }[] = [
  { slot: 'hair', icon: '💇', name: '发型' },
  { slot: 'top', icon: '👕', name: '上装' },
  { slot: 'bottom', icon: '👗', name: '下装' },
  { slot: 'accessory', icon: '💍', name: '配饰' },
  { slot: 'effect', icon: '✨', name: '特效' },
];

/** 稀有度颜色 */
const RARITY_COLORS: Record<string, number> = {
  common: 0x9E9E9E,
  rare: 0x2196F3,
  epic: 0x9C27B0,
  legendary: 0xFFD700,
};

const RARITY_NAMES: Record<string, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
};

export class DressUpPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _scrollContainer!: PIXI.Container;
  private _isOpen = false;
  private _activeSlot: DressUpSlot = 'hair';
  private _scrollY = 0;
  private _maxScrollY = 0;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
    this._bindEvents();
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._activeSlot = 'hair';
    this._scrollY = 0;
    this._refresh();

    this._bg.alpha = 0;
    this._content.alpha = 0;
    this._content.scale.set(0.85);
    TweenManager.to({ target: this._bg, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.scale, props: { x: 1, y: 1 }, duration: 0.3, ease: Ease.easeOutBack });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({ target: this._bg, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad });
    TweenManager.to({
      target: this._content, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; this.alpha = 1; },
    });
    TweenManager.to({ target: this._content.scale, props: { x: 0.9, y: 0.9 }, duration: 0.15, ease: Ease.easeInQuad });
  }

  private _bindEvents(): void {
    EventBus.on('panel:openDressUp', () => this.open());
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointerdown', () => this.close());
    this.addChild(this._bg);

    this._content = new PIXI.Container();
    this.addChild(this._content);
  }

  private _refresh(): void {
    while (this._content.children.length > 0) {
      const child = this._content.children[0];
      this._content.removeChild(child);
      child.destroy({ children: true });
    }

    this._content.pivot.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._content.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);

    const cx = DESIGN_WIDTH / 2;
    const panelW = Math.min(680, DESIGN_WIDTH - 32);
    const panelH = Math.min(Game.logicHeight - 60, 820);
    const panelX = cx - panelW / 2;
    const panelY = (Game.logicHeight - panelH) / 2;

    // 面板背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFF8F0);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.endFill();
    bg.eventMode = 'static';
    this._content.addChild(bg);

    // 标题
    const title = new PIXI.Text(`👗 店主换装  (${DressUpManager.unlockedCount}/${DressUpManager.totalCount})`, {
      fontSize: 20, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(cx, panelY + 14);
    this._content.addChild(title);

    // 花露余额
    const hualuText = new PIXI.Text(`💧 花露: ${CurrencyManager.state.hualu}`, {
      fontSize: 13, fill: 0x4FC3F7, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    hualuText.position.set(panelX + 16, panelY + 18);
    this._content.addChild(hualuText);

    // 关闭按钮
    const closeBtn = new PIXI.Text('✕', {
      fontSize: 22, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    closeBtn.anchor.set(0.5, 0.5);
    closeBtn.position.set(panelX + panelW - 24, panelY + 24);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.close());
    this._content.addChild(closeBtn);

    // 当前装扮预览区域
    const previewY = panelY + 44;
    this._drawPreview(panelX, previewY, panelW);

    // 槽位 Tab 按钮
    const tabY = previewY + 90;
    const tabW = (panelW - 32) / SLOT_DISPLAY.length;
    for (let i = 0; i < SLOT_DISPLAY.length; i++) {
      const def = SLOT_DISPLAY[i];
      this._drawSlotTab(panelX + 16 + i * tabW, tabY, tabW - 4, def);
    }

    // 服装列表区域
    const listY = tabY + 44;
    const listH = panelH - (listY - panelY) - 12;

    const mask = new PIXI.Graphics();
    mask.beginFill(0xFFFFFF);
    mask.drawRect(panelX, listY, panelW, listH);
    mask.endFill();
    this._content.addChild(mask);

    this._scrollContainer = new PIXI.Container();
    this._scrollContainer.mask = mask;
    this._content.addChild(this._scrollContainer);

    const contentH = this._drawCostumeList(panelX, listY, panelW);
    this._maxScrollY = Math.max(0, contentH - listH);
    this._scrollY = 0;

    // 滚动交互
    let lastTouchY = 0;
    let isDragging = false;
    bg.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const localY = e.globalY / Game.scale;
      if (localY >= listY && localY <= listY + listH) {
        lastTouchY = localY;
        isDragging = true;
      }
    });
    bg.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!isDragging) return;
      const curTouchY = e.globalY / Game.scale;
      const delta = lastTouchY - curTouchY;
      lastTouchY = curTouchY;
      this._scrollY = Math.max(0, Math.min(this._maxScrollY, this._scrollY + delta));
      this._scrollContainer.y = -this._scrollY;
    });
    bg.on('pointerup', () => { isDragging = false; });
    bg.on('pointerupoutside', () => { isDragging = false; });
  }

  /** 当前装扮预览 */
  private _drawPreview(panelX: number, y: number, panelW: number): void {
    const equipped = DressUpManager.getAllEquipped();
    const cx = panelX + panelW / 2;

    // 预览背景
    const previewBg = new PIXI.Graphics();
    previewBg.beginFill(0xFFECD0, 0.5);
    previewBg.drawRoundedRect(panelX + 16, y, panelW - 32, 80, 12);
    previewBg.endFill();
    this._content.addChild(previewBg);

    // 当前装备图标展示（横排5个槽位）
    const slotW = (panelW - 64) / 5;
    for (let i = 0; i < SLOT_DISPLAY.length; i++) {
      const def = SLOT_DISPLAY[i];
      const slotX = panelX + 32 + i * slotW;
      const costume = equipped[def.slot];

      const iconText = new PIXI.Text(costume?.icon || '⬜', {
        fontSize: 26, fontFamily: FONT_FAMILY,
      });
      iconText.anchor.set(0.5, 0.5);
      iconText.position.set(slotX + slotW / 2, y + 30);
      this._content.addChild(iconText);

      const label = new PIXI.Text(costume?.name || '无', {
        fontSize: 10, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        wordWrap: true, wordWrapWidth: slotW - 4,
        align: 'center',
      });
      label.anchor.set(0.5, 0);
      label.position.set(slotX + slotW / 2, y + 50);
      this._content.addChild(label);

      const slotLabel = new PIXI.Text(def.name, {
        fontSize: 9, fill: 0xBBBBBB, fontFamily: FONT_FAMILY,
      });
      slotLabel.anchor.set(0.5, 0);
      slotLabel.position.set(slotX + slotW / 2, y + 66);
      this._content.addChild(slotLabel);
    }
  }

  /** 槽位 Tab */
  private _drawSlotTab(x: number, y: number, w: number, def: { slot: DressUpSlot; icon: string; name: string }): void {
    const isActive = this._activeSlot === def.slot;

    const tabBg = new PIXI.Graphics();
    tabBg.beginFill(isActive ? COLORS.BUTTON_PRIMARY : 0xEEEEEE);
    tabBg.drawRoundedRect(x, y, w, 36, 10);
    tabBg.endFill();
    this._content.addChild(tabBg);

    const text = new PIXI.Text(`${def.icon}`, {
      fontSize: 16, fontFamily: FONT_FAMILY,
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(x + w / 2, y + 12);
    this._content.addChild(text);

    const label = new PIXI.Text(def.name, {
      fontSize: 10, fill: isActive ? 0xFFFFFF : COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      fontWeight: isActive ? 'bold' : 'normal',
    });
    label.anchor.set(0.5, 0);
    label.position.set(x + w / 2, y + 22);
    this._content.addChild(label);

    const hit = new PIXI.Container();
    hit.hitArea = new PIXI.Rectangle(x, y, w, 36);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointerdown', () => {
      this._activeSlot = def.slot;
      this._refresh();
    });
    this._content.addChild(hit);
  }

  /** 当前槽位的服装列表 */
  private _drawCostumeList(panelX: number, startY: number, panelW: number): number {
    const pad = 16;
    let y = startY + 8;
    const costumes = DressUpManager.getCostumesForSlot(this._activeSlot);

    for (const costume of costumes) {
      const cardX = panelX + pad;
      const cardW = panelW - pad * 2;
      const cardH = 80;

      this._drawCostumeRow(cardX, y, cardW, cardH, costume);
      y += cardH + 8;
    }

    return y - startY;
  }

  /** 绘制单件服装行 */
  private _drawCostumeRow(
    x: number, y: number, w: number, h: number,
    costume: CostumeItem & { unlocked: boolean; equipped: boolean },
  ): void {
    const rarityColor = RARITY_COLORS[costume.rarity] || 0x999999;

    // 行背景
    const rowBg = new PIXI.Graphics();
    rowBg.beginFill(costume.equipped ? 0xFFF3E0 : costume.unlocked ? 0xFFFFFF : 0xF5F5F5);
    rowBg.drawRoundedRect(x, y, w, h, 12);
    rowBg.endFill();
    rowBg.lineStyle(1.5, costume.equipped ? COLORS.BUTTON_PRIMARY : rarityColor, costume.equipped ? 0.6 : 0.3);
    rowBg.drawRoundedRect(x, y, w, h, 12);
    this._scrollContainer.addChild(rowBg);

    // 图标
    const icon = new PIXI.Text(costume.icon, {
      fontSize: 28, fontFamily: FONT_FAMILY,
    });
    icon.anchor.set(0.5, 0.5);
    icon.position.set(x + 32, y + h / 2);
    if (!costume.unlocked) icon.alpha = 0.3;
    this._scrollContainer.addChild(icon);

    // 名称
    const name = new PIXI.Text(costume.name, {
      fontSize: 15, fill: costume.unlocked ? COLORS.TEXT_DARK : 0xBBBBBB,
      fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    name.position.set(x + 60, y + 10);
    this._scrollContainer.addChild(name);

    // 稀有度标签
    const rarityText = new PIXI.Text(RARITY_NAMES[costume.rarity], {
      fontSize: 10, fill: rarityColor, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    rarityText.position.set(x + 60 + name.width + 8, y + 14);
    this._scrollContainer.addChild(rarityText);

    // 描述
    const desc = new PIXI.Text(costume.unlocked ? costume.desc : (costume.unlockCondition || `💧 ${costume.hualuCost} 花露解锁`), {
      fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    desc.position.set(x + 60, y + 34);
    this._scrollContainer.addChild(desc);

    // 右侧按钮
    const btnX = x + w - 100;
    const btnY = y + h / 2 - 16;

    if (costume.equipped) {
      const equippedText = new PIXI.Text('✅ 穿戴中', {
        fontSize: 13, fill: COLORS.BUTTON_PRIMARY, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      equippedText.position.set(btnX, btnY + 4);
      this._scrollContainer.addChild(equippedText);
    } else if (costume.unlocked) {
      // 装备按钮
      const btn = new PIXI.Graphics();
      btn.beginFill(COLORS.BUTTON_PRIMARY);
      btn.drawRoundedRect(btnX, btnY, 88, 32, 16);
      btn.endFill();
      this._scrollContainer.addChild(btn);

      const btnText = new PIXI.Text('装备', {
        fontSize: 14, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      btnText.anchor.set(0.5, 0.5);
      btnText.position.set(btnX + 44, btnY + 16);
      this._scrollContainer.addChild(btnText);

      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Rectangle(btnX, btnY, 88, 32);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (DressUpManager.equip(costume.id)) {
          ToastMessage.show(`👗 已装备「${costume.name}」`);
          this._refresh();
        }
      });
      this._scrollContainer.addChild(hit);
    } else {
      // 解锁按钮
      const canAfford = CurrencyManager.state.hualu >= costume.hualuCost;
      const btn = new PIXI.Graphics();
      btn.beginFill(canAfford ? 0x4FC3F7 : 0xBDBDBD);
      btn.drawRoundedRect(btnX, btnY, 88, 32, 16);
      btn.endFill();
      this._scrollContainer.addChild(btn);

      const btnText = new PIXI.Text(costume.hualuCost > 0 ? `💧${costume.hualuCost}` : '🎁 免费', {
        fontSize: 13, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      btnText.anchor.set(0.5, 0.5);
      btnText.position.set(btnX + 44, btnY + 16);
      this._scrollContainer.addChild(btnText);

      if (canAfford || costume.hualuCost === 0) {
        const hit = new PIXI.Container();
        hit.hitArea = new PIXI.Rectangle(btnX, btnY, 88, 32);
        hit.eventMode = 'static';
        hit.cursor = 'pointer';
        hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
          e.stopPropagation();
          if (DressUpManager.unlock(costume.id)) {
            ToastMessage.show(`🎉 解锁新服装：「${costume.name}」！`);
            this._refresh();
          } else {
            ToastMessage.show('💧 花露不足，无法解锁');
          }
        });
        this._scrollContainer.addChild(hit);
      }
    }
  }
}
