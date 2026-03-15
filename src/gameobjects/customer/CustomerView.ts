/**
 * 单个客人视图 - 卡片式半身像设计（参考四季物语柜台排队）
 *
 * 布局（竖向卡片 130 x 130）:
 * ┌──────────────────┐
 * │  需求气泡（顶部） │
 * │  [槽1] [槽2]     │
 * ├──────────────────┤
 * │     👧 emoji     │
 * │    客人名字       │
 * │  [💰奖励] [完成]  │
 * └──────────────────┘
 */
import * as PIXI from 'pixi.js';
import { COLORS, FONT_FAMILY, ACTIVE_CUSTOMER_SLOTS } from '@/config/Constants';
import { ITEM_DEFS, Category, FlowerLine, DrinkLine } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import { TweenManager, Ease } from '@/core/TweenManager';
import { CustomerInstance, CustomerManager } from '@/managers/CustomerManager';

/** 需求槽位尺寸 */
const SLOT_SIZE = 34;
const SLOT_GAP = 4;

/** 卡片尺寸 */
const CARD_W = 120;
const CARD_H = 130;

export class CustomerView extends PIXI.Container {
  private _customer: CustomerInstance | null = null;

  private _cardBg: PIXI.Graphics;
  private _avatar: PIXI.Text;
  private _nameText: PIXI.Text;
  private _bubble: PIXI.Container;
  private _rewardText: PIXI.Text;
  private _completeBtn: PIXI.Container | null = null;
  private _bounceTween: { config: any; startValues: any; elapsed: number; delayRemaining: number } | null = null;
  /** 排队标签 */
  private _queueLabel: PIXI.Text;
  /** 在队列中的索引 */
  private _queueIndex = 0;

  constructor() {
    super();

    // 卡片背景
    this._cardBg = new PIXI.Graphics();
    this.addChild(this._cardBg);

    // 需求气泡（卡片上方）
    this._bubble = new PIXI.Container();
    this._bubble.position.set(0, -CARD_H / 2 + 8);
    this.addChild(this._bubble);

    // 头像 emoji（大号，半身像效果）
    this._avatar = new PIXI.Text('', { fontSize: 32 });
    this._avatar.anchor.set(0.5, 0.5);
    this._avatar.position.set(0, 6);
    this.addChild(this._avatar);

    // 名字
    this._nameText = new PIXI.Text('', {
      fontSize: 11,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._nameText.anchor.set(0.5, 0);
    this._nameText.position.set(0, 26);
    this.addChild(this._nameText);

    // 奖励预览
    this._rewardText = new PIXI.Text('', {
      fontSize: 10,
      fill: COLORS.GOLD,
      fontFamily: FONT_FAMILY,
    });
    this._rewardText.anchor.set(0.5, 0);
    this._rewardText.position.set(0, 42);
    this.addChild(this._rewardText);

    // 排队标签
    this._queueLabel = new PIXI.Text('排队中', {
      fontSize: 10,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    this._queueLabel.anchor.set(0.5, 0);
    this._queueLabel.position.set(0, -CARD_H / 2 - 14);
    this._queueLabel.visible = false;
    this.addChild(this._queueLabel);

    this.visible = false;
  }

  get customerUid(): number {
    return this._customer?.uid ?? -1;
  }

  /** 设置队列索引（0开始，前 ACTIVE_CUSTOMER_SLOTS 个为服务中） */
  setQueueIndex(index: number): void {
    this._queueIndex = index;
    const isQueuing = index >= ACTIVE_CUSTOMER_SLOTS;
    this._queueLabel.visible = isQueuing;
    this._queueLabel.text = isQueuing ? `排队 #${index - ACTIVE_CUSTOMER_SLOTS + 1}` : '';

    // 排队中的客人半透明
    if (isQueuing) {
      this.alpha = 0.7;
    }
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
    this._rewardText.text = `💰${customer.goldReward}`;
    this._drawCardBg();
    this._rebuildBubble();

    // 入场动画
    this.alpha = 0;
    this.scale.set(0.6);
    TweenManager.to({
      target: this,
      props: { alpha: this._queueIndex >= ACTIVE_CUSTOMER_SLOTS ? 0.7 : 1 },
      duration: 0.3,
    });
    TweenManager.to({
      target: this.scale,
      props: { x: 1, y: 1 },
      duration: 0.4,
      ease: Ease.easeOutBack,
    });
  }

  refreshSlots(): void {
    if (!this._customer) return;
    this._rebuildBubble();
  }

  // ========== 卡片背景 ==========

  private _drawCardBg(): void {
    this._cardBg.clear();
    const isActive = this._queueIndex < ACTIVE_CUSTOMER_SLOTS;
    const bgColor = isActive ? 0xFFFBF5 : 0xF5F0EA;
    const borderColor = isActive ? 0xFFD4A8 : 0xD4C4B0;

    // 卡片圆角矩形
    this._cardBg.beginFill(bgColor, 0.9);
    this._cardBg.drawRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12);
    this._cardBg.endFill();

    // 边框
    this._cardBg.lineStyle(1.5, borderColor, 0.6);
    this._cardBg.drawRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12);

    // 服务中的高亮顶部装饰条
    if (isActive) {
      this._cardBg.lineStyle(0);
      this._cardBg.beginFill(0xFF8C69, 0.15);
      this._cardBg.drawRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 4, 2);
      this._cardBg.endFill();
    }
  }

  // ========== 需求气泡 ==========

  private _rebuildBubble(): void {
    this._bubble.removeChildren();
    this._clearCompleteBtn();
    if (!this._customer) return;

    const slots = this._customer.slots;
    const totalW = slots.length * SLOT_SIZE + (slots.length - 1) * SLOT_GAP;
    const startX = -totalW / 2;

    // 气泡背景
    const bgPad = 4;
    const bubbleBg = new PIXI.Graphics();
    bubbleBg.beginFill(0xFFFFFF, 0.92);
    bubbleBg.drawRoundedRect(
      startX - bgPad, -SLOT_SIZE / 2 - bgPad,
      totalW + bgPad * 2, SLOT_SIZE + bgPad * 2,
      8,
    );
    bubbleBg.endFill();
    bubbleBg.lineStyle(1, COLORS.CELL_BORDER, 0.4);
    bubbleBg.drawRoundedRect(
      startX - bgPad, -SLOT_SIZE / 2 - bgPad,
      totalW + bgPad * 2, SLOT_SIZE + bgPad * 2,
      8,
    );
    this._bubble.addChild(bubbleBg);

    // 各需求槽位
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const sx = startX + i * (SLOT_SIZE + SLOT_GAP);
      const sy = -SLOT_SIZE / 2;
      const filled = slot.lockedCellIndex >= 0;

      this._drawSlotItem(sx, sy, slot.itemId, filled);
    }

    if (this._customer.allSatisfied && this._queueIndex < ACTIVE_CUSTOMER_SLOTS) {
      this._showCompleteBtn();
    }
  }

  /** 绘制单个需求槽位 */
  private _drawSlotItem(x: number, y: number, itemId: string, filled: boolean): void {
    const cs = SLOT_SIZE;
    const def = ITEM_DEFS.get(itemId);
    if (!def) return;

    // 槽位底色 + 边框
    const slotBg = new PIXI.Graphics();
    const borderColor = filled ? 0x4CAF50 : 0xFFB74D;
    slotBg.beginFill(filled ? 0xE8F5E9 : 0xFFFBF5, 0.9);
    slotBg.drawRoundedRect(x, y, cs, cs, 5);
    slotBg.endFill();
    slotBg.lineStyle(1, borderColor, 0.8);
    slotBg.drawRoundedRect(x, y, cs, cs, 5);
    this._bubble.addChild(slotBg);

    // 尝试使用真实纹理
    const texture = TextureCache.get(def.icon);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      const pad = 3;
      const maxS = cs - pad * 2;
      const s = Math.min(maxS / texture.width, maxS / texture.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(x + cs / 2, y + cs / 2);
      if (!filled) sprite.alpha = 0.5;
      this._bubble.addChild(sprite);
    } else {
      // Fallback：彩色圆形 + emoji + 短名
      const iconColor = this._getLineColor(def.line);
      const fg = new PIXI.Graphics();
      fg.beginFill(iconColor, 0.15);
      fg.drawRoundedRect(x + 2, y + 2, cs - 4, cs - 4, 4);
      fg.endFill();
      fg.beginFill(iconColor, 0.3);
      fg.drawCircle(x + cs / 2, y + cs / 2 - 2, cs * 0.24);
      fg.endFill();
      if (!filled) fg.alpha = 0.5;
      this._bubble.addChild(fg);

      const emoji = this._getCategoryEmoji(def.category);
      const nameTxt = new PIXI.Text(
        emoji + (def.name.length > 3 ? def.name.substring(0, 3) : def.name),
        { fontSize: 7, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, align: 'center' },
      );
      nameTxt.anchor.set(0.5, 1);
      nameTxt.position.set(x + cs / 2, y + cs - 1);
      if (!filled) nameTxt.alpha = 0.5;
      this._bubble.addChild(nameTxt);
    }

    // 等级徽章
    const lineColor = this._getLineColor(def.line);
    const badgeR = 5;
    const bx = x + cs - badgeR - 1;
    const by = y + badgeR + 1;
    const badge = new PIXI.Graphics();
    badge.beginFill(lineColor, 0.85);
    badge.drawCircle(bx, by, badgeR);
    badge.endFill();
    this._bubble.addChild(badge);

    const lvlTxt = new PIXI.Text(`${def.level}`, {
      fontSize: 7,
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
        fontSize: 11,
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
    bg.drawRoundedRect(-30, -12, 60, 24, 12);
    bg.endFill();

    const txt = new PIXI.Text('✓ 完成', {
      fontSize: 12,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    txt.anchor.set(0.5, 0.5);

    btn.addChild(bg);
    btn.addChild(txt);
    btn.position.set(0, CARD_H / 2 - 16);
    btn.on('pointertap', () => {
      if (this._customer) {
        CustomerManager.deliver(this._customer.uid);
      }
    });

    this.addChild(btn);
    this._completeBtn = btn;

    // 弹跳动画
    const proxy = { t: 0 };
    this._bounceTween = TweenManager.to({
      target: proxy,
      props: { t: 600 },
      duration: 600,
      onUpdate: () => {
        if (this._completeBtn && !this._completeBtn.destroyed) {
          this._completeBtn.y = CARD_H / 2 - 16 + Math.sin(proxy.t * 0.5) * 2;
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

  // ========== 颜色工具 ==========

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
