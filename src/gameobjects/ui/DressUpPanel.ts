/**
 * 换装面板 — 简洁版整体形象解锁
 *
 * 3 列大图标网格，点击解锁或切换穿戴
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DressUpManager, Outfit } from '@/managers/DressUpManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { ToastMessage } from './ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

export class DressUpPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _isOpen = false;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
    EventBus.on('panel:openDressUp', () => this.open());
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
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

    const outfits = DressUpManager.getAllOutfits();
    const cols = 3;
    const pad = 24;
    const gap = 16;
    const panelW = Math.min(640, DESIGN_WIDTH - 40);
    const cardW = Math.floor((panelW - pad * 2 - (cols - 1) * gap) / cols);
    const cardH = cardW + 40;
    const rows = Math.ceil(outfits.length / cols);
    const gridH = rows * cardH + (rows - 1) * gap;
    const headerH = 80;
    const panelH = headerH + gridH + pad * 2;
    const cx = DESIGN_WIDTH / 2;
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
    const title = new PIXI.Text(`👗 形象换装`, {
      fontSize: 22, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(cx, panelY + 18);
    this._content.addChild(title);

    // 花露余额
    const hualuText = new PIXI.Text(`💧 ${CurrencyManager.state.hualu}`, {
      fontSize: 14, fill: 0x4FC3F7, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    hualuText.position.set(panelX + pad, panelY + 22);
    this._content.addChild(hualuText);

    // 关闭按钮
    const closeBtn = new PIXI.Text('✕', {
      fontSize: 22, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    closeBtn.anchor.set(0.5, 0.5);
    closeBtn.position.set(panelX + panelW - 28, panelY + 28);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.close());
    this._content.addChild(closeBtn);

    // 解锁进度
    const progress = new PIXI.Text(`${DressUpManager.unlockedCount}/${DressUpManager.totalCount}`, {
      fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    progress.anchor.set(0.5, 0);
    progress.position.set(cx, panelY + 46);
    this._content.addChild(progress);

    // 形象网格
    const gridStartY = panelY + headerH;
    outfits.forEach((outfit, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = panelX + pad + col * (cardW + gap);
      const y = gridStartY + row * (cardH + gap);
      this._drawCard(x, y, cardW, cardH, outfit);
    });
  }

  private _drawCard(
    x: number, y: number, w: number, h: number,
    outfit: Outfit & { unlocked: boolean; equipped: boolean },
  ): void {
    const isEquipped = outfit.equipped;
    const isUnlocked = outfit.unlocked;
    const hasCondition = !!outfit.unlockCondition;

    // 卡片背景
    const card = new PIXI.Graphics();
    if (isEquipped) {
      card.beginFill(0xFFF3E0);
      card.lineStyle(3, COLORS.BUTTON_PRIMARY, 1);
    } else if (isUnlocked) {
      card.beginFill(0xFFFFFF);
      card.lineStyle(1.5, 0xE0D5C5, 0.6);
    } else {
      card.beginFill(0xF0F0F0);
      card.lineStyle(1, 0xDDDDDD, 0.5);
    }
    card.drawRoundedRect(x, y, w, h, 16);
    card.endFill();
    this._content.addChild(card);

    // 大图标
    const icon = new PIXI.Text(outfit.icon, { fontSize: 48, fontFamily: FONT_FAMILY });
    icon.anchor.set(0.5, 0.5);
    icon.position.set(x + w / 2, y + w / 2 - 10);
    if (!isUnlocked) icon.alpha = 0.3;
    this._content.addChild(icon);

    // 锁定遮罩
    if (!isUnlocked) {
      const lock = new PIXI.Text('🔒', { fontSize: 20, fontFamily: FONT_FAMILY });
      lock.anchor.set(0.5, 0.5);
      lock.position.set(x + w - 16, y + 16);
      this._content.addChild(lock);
    }

    // 名称
    const name = new PIXI.Text(outfit.name, {
      fontSize: 13, fill: isUnlocked ? COLORS.TEXT_DARK : 0xAAAAAA,
      fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    name.anchor.set(0.5, 0);
    name.position.set(x + w / 2, y + w - 6);
    this._content.addChild(name);

    // 状态标签
    let statusText = '';
    let statusColor = COLORS.TEXT_LIGHT;
    if (isEquipped) {
      statusText = '✅ 穿戴中';
      statusColor = COLORS.BUTTON_PRIMARY;
    } else if (isUnlocked) {
      statusText = '点击换装';
      statusColor = 0x4FC3F7;
    } else if (hasCondition) {
      statusText = outfit.unlockCondition!;
      statusColor = 0xAAAAAA;
    } else {
      statusText = `💧 ${outfit.hualuCost}`;
      statusColor = CurrencyManager.state.hualu >= outfit.hualuCost ? 0x4FC3F7 : 0xBDBDBD;
    }

    const status = new PIXI.Text(statusText, {
      fontSize: 11, fill: statusColor, fontFamily: FONT_FAMILY,
    });
    status.anchor.set(0.5, 0);
    status.position.set(x + w / 2, y + w + 12);
    this._content.addChild(status);

    // 点击交互
    if (!isEquipped) {
      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Rectangle(x, y, w, h);
      hit.eventMode = 'static';
      hit.cursor = (isUnlocked || (!hasCondition && CurrencyManager.state.hualu >= outfit.hualuCost))
        ? 'pointer' : 'default';
      hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (isUnlocked) {
          if (DressUpManager.equip(outfit.id)) {
            ToastMessage.show(`✨ 已切换为「${outfit.name}」`);
            this._refresh();
          }
        } else if (!hasCondition) {
          if (CurrencyManager.state.hualu < outfit.hualuCost) {
            ToastMessage.show('💧 花露不足');
            return;
          }
          if (DressUpManager.unlock(outfit.id)) {
            ToastMessage.show(`🎉 解锁「${outfit.name}」！`);
            this._refresh();
          }
        }
      });
      this._content.addChild(hit);
    }
  }
}
