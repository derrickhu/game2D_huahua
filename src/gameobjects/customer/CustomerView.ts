/**
 * 单个客人视图 - 四季物语风格（无边框大半身像 + 底部信息面板）
 *
 * 布局（以 center(0,0) 为原点）:
 *
 *       大半身像 (120px)        <- 无框，直接浮在底色上
 *
 *   ┌── 信息面板 ──────┐
 *   │ ⭐💰120  [🌸][🍵] │     <- 奖励 + 需求槽位
 *   └──────────────────┘
 *      或 ✓ 完成 按钮         <- 需求全满足后
 */
import * as PIXI from 'pixi.js';
import { COLORS, FONT_FAMILY, ACTIVE_CUSTOMER_SLOTS } from '@/config/Constants';
import { ITEM_DEFS, Category, FlowerLine, DrinkLine } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import { createToolEnergySprite, isBoardToolCategory } from '@/utils/ToolEnergyBadge';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { CustomerInstance } from '@/managers/CustomerManager';

const SLOT_SIZE = 52;
const SLOT_GAP = 8;

export const CARD_W = 160;
export const CARD_H = 240;

const PANEL_W = CARD_W - 8;
const PANEL_H = 64;
const PANEL_Y = 6;
const REWARD_BADGE_Y = -12;

export class CustomerView extends PIXI.Container {
  private _customer: CustomerInstance | null = null;

  private _avatar: PIXI.Text;
  private _avatarSprite: PIXI.Sprite;
  private _infoPanel: PIXI.Container;
  private _completeBtn: PIXI.Container | null = null;
  private _bounceTween: { config: any; startValues: any; elapsed: number; delayRemaining: number } | null = null;
  private _queueIndex = 0;

  constructor() {
    super();

    this._avatarSprite = new PIXI.Sprite();
    this._avatarSprite.anchor.set(0.5, 1.0);
    this._avatarSprite.position.set(0, 0);
    this._avatarSprite.visible = false;
    this.addChild(this._avatarSprite);

    this._avatar = new PIXI.Text('', { fontSize: 52 });
    this._avatar.anchor.set(0.5, 1.0);
    this._avatar.position.set(0, 0);
    this.addChild(this._avatar);

    this._infoPanel = new PIXI.Container();
    this._infoPanel.position.set(0, PANEL_Y);
    this.addChild(this._infoPanel);

    this.visible = false;
  }

  get customerUid(): number {
    return this._customer?.uid ?? -1;
  }

  setQueueIndex(index: number): void {
    this._queueIndex = index;
  }

  setCustomer(customer: CustomerInstance | null): void {
    this._customer = customer;
    this._clearCompleteBtn();

    if (!customer) {
      this.visible = false;
      return;
    }

    this.visible = true;

    const tex = TextureCache.get(`customer_${customer.typeId}`);
    if (tex) {
      this._avatarSprite.texture = tex;
      const targetH = 160;
      const s = targetH / tex.height;
      this._avatarSprite.scale.set(s);
      this._avatarSprite.visible = true;
      this._avatar.visible = false;
    } else {
      this._avatarSprite.visible = false;
      this._avatar.visible = true;
      this._avatar.text = customer.emoji;
    }

    this._rebuildInfoPanel();

    const isQueuing = this._queueIndex >= ACTIVE_CUSTOMER_SLOTS;
    this.alpha = 0;
    this.scale.set(0.6);
    TweenManager.to({
      target: this,
      props: { alpha: isQueuing ? 0.6 : 1 },
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
    this._rebuildInfoPanel();
  }

  // ========== 底部信息面板 ==========

  private _rebuildInfoPanel(): void {
    this._infoPanel.removeChildren();
    this._clearCompleteBtn();
    this._clearRewardBadge();
    if (!this._customer) return;

    const allDone = this._customer.allSatisfied && this._queueIndex < ACTIVE_CUSTOMER_SLOTS;

    // 奖励徽章（头像底部，半透明深色遮罩）
    this._buildRewardBadge();

    // 面板背景（优先使用图片纹理）
    const panelTex = TextureCache.get('order_panel');
    if (panelTex) {
      const panelBg = new PIXI.Sprite(panelTex);
      panelBg.anchor.set(0.5, 0);
      panelBg.width = PANEL_W;
      panelBg.height = PANEL_H;
      panelBg.position.set(0, 0);
      this._infoPanel.addChild(panelBg);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(0xFFFFFF, 0.92);
      bg.drawRoundedRect(-PANEL_W / 2, 0, PANEL_W, PANEL_H, 12);
      bg.endFill();
      bg.lineStyle(1, 0xFFD4A8, 0.4);
      bg.drawRoundedRect(-PANEL_W / 2, 0, PANEL_W, PANEL_H, 12);
      this._infoPanel.addChild(bg);
    }

    // 需求槽位（面板内居中，始终显示花朵图标 + 绿勾）
    const slots = this._customer.slots;
    const totalSlotW = slots.length * SLOT_SIZE + (slots.length - 1) * SLOT_GAP;
    const slotStartX = -totalSlotW / 2;
    const slotY = (PANEL_H - SLOT_SIZE) / 2;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const sx = slotStartX + i * (SLOT_SIZE + SLOT_GAP);
      const filled = slot.lockedCellIndex >= 0;
      this._drawSlotItem(sx, slotY, slot.itemId, filled);
    }

    // 全部满足 → 面板下方显示完成按钮
    if (allDone) {
      this._showCompleteBtn();
    }
  }

  private _rewardBadge: PIXI.Container | null = null;

  private _buildRewardBadge(): void {
    if (!this._customer) return;
    const badge = new PIXI.Container();
    badge.position.set(0, REWARD_BADGE_Y);

    const iconSize = 22;
    const gap = 4;
    let offsetX = 0;
    const items: { icon: string; value: number }[] = [];

    items.push({ icon: 'icon_huayuan', value: this._customer.huayuanReward });
    if (this._customer.hualuReward > 0) {
      items.push({ icon: 'icon_hualu', value: this._customer.hualuReward });
    }

    const content = new PIXI.Container();
    for (const item of items) {
      const tex = TextureCache.get(item.icon);
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0, 0.5);
        sp.width = iconSize;
        sp.height = iconSize;
        sp.position.set(offsetX, 0);
        content.addChild(sp);
        offsetX += iconSize + gap;
      }
      const val = new PIXI.Text(`${item.value}`, {
        fontSize: 16,
        fill: 0xFFFFFF,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0x000000,
        strokeThickness: 3,
      });
      val.anchor.set(0, 0.5);
      val.position.set(offsetX, 0);
      content.addChild(val);
      offsetX += val.width + 8;
    }

    const padX = 8;
    const padY = 5;
    const bw = offsetX - 8 + padX * 2;
    const bh = iconSize + padY * 2;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.45);
    bg.drawRoundedRect(0, 0, bw, bh, bh / 2);
    bg.endFill();

    content.position.set(padX, bh / 2);
    badge.addChild(bg);
    badge.addChild(content);
    badge.pivot.set(bw / 2, bh / 2);
    this.addChild(badge);
    this._rewardBadge = badge;
  }

  private _clearRewardBadge(): void {
    if (this._rewardBadge) {
      if (this._rewardBadge.parent) {
        this._rewardBadge.parent.removeChild(this._rewardBadge);
      }
      this._rewardBadge.destroy({ children: true });
      this._rewardBadge = null;
    }
  }

  private _drawSlotItem(x: number, y: number, itemId: string, filled: boolean): void {
    const cs = SLOT_SIZE;
    const def = ITEM_DEFS.get(itemId);
    if (!def) return;

    const texture = TextureCache.get(def.icon);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      const s = Math.min(cs / texture.width, cs / texture.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(x + cs / 2, y + cs / 2);

      this._infoPanel.addChild(sprite);

      if (isBoardToolCategory(def.category)) {
        const shell = new PIXI.Container();
        shell.position.set(x, y);
        const energy = createToolEnergySprite(cs, cs, { maxSideFrac: 0.28, pad: 5 });
        if (energy) {
          if (filled) energy.position.y -= 14;
          shell.addChild(energy);
          this._infoPanel.addChild(shell);
        }
      }
    } else {
      const iconColor = this._getLineColor(def.line);
      const fg = new PIXI.Graphics();
      fg.beginFill(iconColor, 0.15);
      fg.drawRoundedRect(x + 2, y + 2, cs - 4, cs - 4, 4);
      fg.endFill();
      fg.beginFill(iconColor, 0.3);
      fg.drawCircle(x + cs / 2, y + cs / 2 - 2, cs * 0.22);
      fg.endFill();
      
      this._infoPanel.addChild(fg);

      const emoji = this._getCategoryEmoji(def.category);
      const nameTxt = new PIXI.Text(
        emoji + (def.name.length > 3 ? def.name.substring(0, 3) : def.name),
        { fontSize: 7, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, align: 'center' },
      );
      nameTxt.anchor.set(0.5, 1);
      nameTxt.position.set(x + cs / 2, y + cs - 1);
      
      this._infoPanel.addChild(nameTxt);
    }

    if (filled) {
      const check = new PIXI.Graphics();
      check.beginFill(0x4CAF50);
      check.drawCircle(x + cs - 6, y + cs - 6, 9);
      check.endFill();
      this._infoPanel.addChild(check);

      const checkMark = new PIXI.Text('✓', {
        fontSize: 11, fill: 0xFFFFFF, fontWeight: 'bold',
      });
      checkMark.anchor.set(0.5, 0.5);
      checkMark.position.set(x + cs - 6, y + cs - 6);
      this._infoPanel.addChild(checkMark);
    }
  }

  // ========== 完成按钮 ==========

  private _showCompleteBtn(): void {
    if (this._completeBtn) return;

    const BTN_W = 100;
    const BTN_H = 32;
    const btn = new PIXI.Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new PIXI.Graphics();
    bg.beginFill(0x4CAF50);
    bg.drawRoundedRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, BTN_H / 2);
    bg.endFill();
    bg.lineStyle(2, 0x388E3C, 0.5);
    bg.drawRoundedRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, BTN_H / 2);

    const txt = new PIXI.Text('✓ 完成', {
      fontSize: 14,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    txt.anchor.set(0.5, 0.5);

    btn.addChild(bg);
    btn.addChild(txt);
    btn.position.set(0, PANEL_Y + PANEL_H + BTN_H / 2 + 6);
    btn.zIndex = 999;
    btn.on('pointertap', () => {
      if (this._customer) {
        const globalPos = this.toGlobal(new PIXI.Point(0, 0));
        EventBus.emit('customer:requestDeliver', this._customer.uid, this._customer, globalPos);
        btn.eventMode = 'none';
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
          this._completeBtn.y = PANEL_Y + PANEL_H + BTN_H / 2 + 6 + Math.sin(proxy.t * 0.5) * 2;
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
      if (this._completeBtn.parent) {
        this._completeBtn.parent.removeChild(this._completeBtn);
      }
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
      case FlowerLine.FRESH: return COLORS.FLOWER_FRESH;
      case FlowerLine.BOUQUET: return COLORS.FLOWER_BOUQUET;
      case FlowerLine.GREEN: return COLORS.FLOWER_GREEN;
      case DrinkLine.TEA: return COLORS.DRINK_TEA;
      case DrinkLine.COLD: return COLORS.DRINK_COLD;
      case DrinkLine.DESSERT: return COLORS.DRINK_DESSERT;
      default: return 0x999999;
    }
  }
}
