/**
 * 单个客人视图 - 客人形象 + 需求气泡 + 完成按钮
 */
import * as PIXI from 'pixi.js';
import { COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, Category, FlowerLine, DrinkLine } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import { TweenManager } from '@/core/TweenManager';
import { CustomerInstance, CustomerManager } from '@/managers/CustomerManager';

/** 需求槽位尺寸 */
const SLOT_SIZE = 42;
const SLOT_GAP = 5;

export class CustomerView extends PIXI.Container {
  private _customer: CustomerInstance | null = null;

  private _avatar: PIXI.Text;
  private _nameText: PIXI.Text;
  private _bubble: PIXI.Container;
  private _completeBtn: PIXI.Container | null = null;
  private _bounceTween: { config: any; startValues: any; elapsed: number; delayRemaining: number } | null = null;

  constructor() {
    super();

    this._avatar = new PIXI.Text('', { fontSize: 36 });
    this._avatar.anchor.set(0.5, 0.5);
    this._avatar.position.set(0, 0);
    this.addChild(this._avatar);

    this._nameText = new PIXI.Text('', {
      fontSize: 11,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    this._nameText.anchor.set(0.5, 0);
    this._nameText.position.set(0, 22);
    this.addChild(this._nameText);

    this._bubble = new PIXI.Container();
    this._bubble.position.set(0, -44);
    this.addChild(this._bubble);

    this.visible = false;
  }

  get customerUid(): number {
    return this._customer?.uid ?? -1;
  }

  setCustomer(customer: CustomerInstance | null): void {
    this._customer = customer;
    this._clearCompleteBtn();

    if (!customer) {
      this.visible = false;
      return;
    }

    this.visible = true;
    this._avatar.text = customer.emoji;
    this._nameText.text = customer.name;
    this._rebuildBubble();
  }

  refreshSlots(): void {
    if (!this._customer) return;
    this._rebuildBubble();
  }

  // ========== 内部 ==========

  private _rebuildBubble(): void {
    this._bubble.removeChildren();
    this._clearCompleteBtn();
    if (!this._customer) return;

    const slots = this._customer.slots;
    const totalW = slots.length * SLOT_SIZE + (slots.length - 1) * SLOT_GAP;
    const startX = -totalW / 2;

    // 气泡背景
    const bgPad = 6;
    const bubbleBg = new PIXI.Graphics();
    bubbleBg.beginFill(0xFFFFFF, 0.92);
    bubbleBg.drawRoundedRect(
      startX - bgPad, -SLOT_SIZE / 2 - bgPad,
      totalW + bgPad * 2, SLOT_SIZE + bgPad * 2,
      10,
    );
    bubbleBg.endFill();
    bubbleBg.lineStyle(1.5, COLORS.CELL_BORDER, 0.5);
    bubbleBg.drawRoundedRect(
      startX - bgPad, -SLOT_SIZE / 2 - bgPad,
      totalW + bgPad * 2, SLOT_SIZE + bgPad * 2,
      10,
    );
    // 气泡尖角
    bubbleBg.beginFill(0xFFFFFF, 0.92);
    bubbleBg.moveTo(-6, SLOT_SIZE / 2 + bgPad);
    bubbleBg.lineTo(0, SLOT_SIZE / 2 + bgPad + 8);
    bubbleBg.lineTo(6, SLOT_SIZE / 2 + bgPad);
    bubbleBg.closePath();
    bubbleBg.endFill();
    this._bubble.addChild(bubbleBg);

    // 各需求槽位 —— 和棋盘 ItemView 保持一致的渲染风格
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const sx = startX + i * (SLOT_SIZE + SLOT_GAP);
      const sy = -SLOT_SIZE / 2;
      const filled = slot.lockedCellIndex >= 0;

      this._drawSlotItem(sx, sy, slot.itemId, filled);
    }

    // 奖励预览
    const rewardTxt = new PIXI.Text(`💰${this._customer.goldReward}`, {
      fontSize: 9,
      fill: COLORS.GOLD,
      fontFamily: FONT_FAMILY,
    });
    rewardTxt.anchor.set(0.5, 0);
    rewardTxt.position.set(0, SLOT_SIZE / 2 + bgPad + 8);
    this._bubble.addChild(rewardTxt);

    if (this._customer.allSatisfied) {
      this._showCompleteBtn();
    }
  }

  /** 绘制单个需求槽位（复用 ItemView 的视觉风格） */
  private _drawSlotItem(x: number, y: number, itemId: string, filled: boolean): void {
    const cs = SLOT_SIZE;
    const def = ITEM_DEFS.get(itemId);
    if (!def) return;

    // 槽位底色 + 边框
    const slotBg = new PIXI.Graphics();
    const borderColor = filled ? 0x4CAF50 : 0xFFB74D;
    slotBg.beginFill(filled ? 0xE8F5E9 : 0xFFFBF5, 0.9);
    slotBg.drawRoundedRect(x, y, cs, cs, 6);
    slotBg.endFill();
    slotBg.lineStyle(1.5, borderColor, 0.8);
    slotBg.drawRoundedRect(x, y, cs, cs, 6);
    this._bubble.addChild(slotBg);

    // 尝试使用真实纹理
    const texture = TextureCache.get(def.icon);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      const pad = 4;
      const maxS = cs - pad * 2;
      const s = Math.min(maxS / texture.width, maxS / texture.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(x + cs / 2, y + cs / 2);
      if (!filled) sprite.alpha = 0.5;
      this._bubble.addChild(sprite);
    } else {
      // Fallback：和 ItemView 一致的彩色圆形 + emoji + 短名
      const iconColor = this._getLineColor(def.line);
      const fg = new PIXI.Graphics();
      fg.beginFill(iconColor, 0.15);
      fg.drawRoundedRect(x + 3, y + 3, cs - 6, cs - 6, 5);
      fg.endFill();
      fg.beginFill(iconColor, 0.3);
      fg.drawCircle(x + cs / 2, y + cs / 2 - 2, cs * 0.26);
      fg.endFill();
      if (!filled) fg.alpha = 0.5;
      this._bubble.addChild(fg);

      const emoji = this._getCategoryEmoji(def.category);
      const nameTxt = new PIXI.Text(
        emoji + (def.name.length > 3 ? def.name.substring(0, 3) : def.name),
        { fontSize: 8, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, align: 'center' },
      );
      nameTxt.anchor.set(0.5, 1);
      nameTxt.position.set(x + cs / 2, y + cs - 1);
      if (!filled) nameTxt.alpha = 0.5;
      this._bubble.addChild(nameTxt);
    }

    // 等级徽章（右上角小圆点，和 ItemView 一致）
    const lineColor = this._getLineColor(def.line);
    const badgeR = 6;
    const bx = x + cs - badgeR - 1;
    const by = y + badgeR + 1;
    const badge = new PIXI.Graphics();
    badge.beginFill(lineColor, 0.85);
    badge.drawCircle(bx, by, badgeR);
    badge.endFill();
    this._bubble.addChild(badge);

    const lvlTxt = new PIXI.Text(`${def.level}`, {
      fontSize: 8,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    lvlTxt.anchor.set(0.5, 0.5);
    lvlTxt.position.set(bx, by);
    this._bubble.addChild(lvlTxt);

    // 已满足 ✓
    if (filled) {
      const check = new PIXI.Text('✓', {
        fontSize: 13,
        fill: 0x4CAF50,
        fontWeight: 'bold',
      });
      check.anchor.set(0, 0);
      check.position.set(x + 1, y);
      this._bubble.addChild(check);
    }
  }

  // ========== 完成按钮 ==========

  private _showCompleteBtn(): void {
    if (this._completeBtn) return;

    const btn = new PIXI.Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new PIXI.Graphics();
    bg.beginFill(0x4CAF50);
    bg.drawRoundedRect(-36, -14, 72, 28, 14);
    bg.endFill();

    const txt = new PIXI.Text('完成', {
      fontSize: 14,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    txt.anchor.set(0.5, 0.5);

    btn.addChild(bg);
    btn.addChild(txt);
    btn.position.set(0, 46);
    btn.on('pointertap', () => {
      if (this._customer) {
        CustomerManager.deliver(this._customer.uid);
      }
    });

    this.addChild(btn);
    this._completeBtn = btn;

    const proxy = { t: 0 };
    this._bounceTween = TweenManager.to({
      target: proxy,
      props: { t: 600 },
      duration: 600,
      onUpdate: () => {
        if (this._completeBtn && !this._completeBtn.destroyed) {
          this._completeBtn.y = 46 + Math.sin(proxy.t * 0.5) * 3;
        }
      },
    });
  }

  private _stopBounce(): void {
    if (this._bounceTween) {
      TweenManager.cancel(this._bounceTween);
      this._bounceTween = null;
    }
  }

  private _clearCompleteBtn(): void {
    this._stopBounce();
    if (this._completeBtn) {
      this.removeChild(this._completeBtn);
      this._completeBtn.destroy({ children: true });
      this._completeBtn = null;
    }
  }

  // ========== 颜色工具（和 ItemView 保持一致） ==========

  private _getCategoryEmoji(category: Category): string {
    switch (category) {
      case Category.FLOWER: return '🌸';
      case Category.DRINK: return '🍵';
      default: return '❓';
    }
  }

  private _getLineColor(line: string): number {
    switch (line) {
      case FlowerLine.DAILY: return COLORS.FLOWER_DAILY;
      case FlowerLine.ROMANTIC: return COLORS.FLOWER_ROMANTIC;
      case FlowerLine.LUXURY: return COLORS.FLOWER_LUXURY;
      case DrinkLine.TEA: return COLORS.DRINK_TEA;
      case DrinkLine.COLD: return COLORS.DRINK_COLD;
      case DrinkLine.DESSERT: return COLORS.DRINK_DESSERT;
      default: return 0x999999;
    }
  }
}
