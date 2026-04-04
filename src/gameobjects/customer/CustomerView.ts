/**
 * 单个客人视图 - 四季物语风格（无边框大半身像 + 底部信息面板）
 *
 * 布局（以 center(0,0) 为原点）:
 *
 *       大半身像（脚底略下移）            <- 需求面板与胸像下沿略有重叠，整体略下移近棋盘
 *
 *        ┌──完成──┐
 *   ┌──── 需求面板（放大，最多3格）──────── [花愿]
 *   │      [🌸] [🌸] [🌸]            │
 *   └────────────────────────────────┘
 */
import * as PIXI from 'pixi.js';
import { COLORS, FONT_FAMILY } from '@/config/Constants';
import { CustomerManager } from '@/managers/CustomerManager';
import { ITEM_DEFS, Category, FlowerLine, DrinkLine } from '@/config/ItemConfig';
import { TIER_COLORS, type OrderTier } from '@/config/OrderTierConfig';
import { TextureCache } from '@/utils/TextureCache';
import { createToolEnergySprite, isBoardToolInteract } from '@/utils/ToolEnergyBadge';
import { ToolSparkleLayer } from '@/utils/ToolSparkleLayer';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { CustomerInstance } from '@/managers/CustomerManager';
/** 单格物品显示边长（3 个并排仍落在 PANEL_W 内） */
const SLOT_SIZE = 66;
const SLOT_GAP = 8;
/** 需求面板至少容纳 3 个槽位（左右内边距略收，让给图标） */
const PANEL_W = SLOT_SIZE * 3 + SLOT_GAP * 2 + 24;
/** 比槽位略高，避免角标贴边 */
const PANEL_H = SLOT_SIZE + 30;
/**
 * 胸像脚底锚点在容器中的 y（>0 则整体下移，让面板能叠住胸像下沿直边）
 */
const AVATAR_FEET_Y = 22;
/** 需求面板 y：略负可与胸像底重叠；增大则整体下移靠近棋盘（胸像锚点不变） */
const PANEL_Y = 4;

/** 「完成」：放大、水平居中，中心略低于面板上沿以压住面板与腰线 */
const COMPLETE_BTN_W = 118;
const COMPLETE_BTN_H = 42;
const COMPLETE_BTN_X = 0;
const COMPLETE_BTN_Y = PANEL_Y + 16 - Math.round(COMPLETE_BTN_H / 2);

/** 卡片水平占位：取「面板半宽」与「完成按钮半宽」较大者 */
const CARD_LAYOUT_HALF = Math.max(PANEL_W / 2, COMPLETE_BTN_W / 2);
export const CARD_W = Math.max(
  Math.ceil(PANEL_W + 4),
  Math.ceil(CARD_LAYOUT_HALF * 2 + 8),
);
export const CARD_H = 278;

const REWARD_BADGE_Y = -12;

export class CustomerView extends PIXI.Container {
  private _customer: CustomerInstance | null = null;

  private _avatar: PIXI.Text;
  private _avatarSprite: PIXI.Sprite;
  private _infoPanel: PIXI.Container;
  private _completeBtn: PIXI.Container | null = null;
  private _bounceTween: { config: any; startValues: any; elapsed: number; delayRemaining: number } | null = null;
  private _queueIndex = 0;
  /** 当前卡片已绑定的客人 uid，用于 refresh 时避免全员重复播放入场动画 */
  private _boundCustomerUid = -1;

  constructor() {
    super();
    this.sortableChildren = true;

    this._avatarSprite = new PIXI.Sprite();
    this._avatarSprite.anchor.set(0.5, 1.0);
    this._avatarSprite.position.set(0, AVATAR_FEET_Y);
    this._avatarSprite.visible = false;
    this.addChild(this._avatarSprite);

    this._avatar = new PIXI.Text('', { fontSize: 52 });
    this._avatar.anchor.set(0.5, 1.0);
    this._avatar.position.set(0, AVATAR_FEET_Y);
    this.addChild(this._avatar);

    this._infoPanel = new PIXI.Container();
    this._infoPanel.position.set(0, PANEL_Y);
    this._infoPanel.zIndex = 5;
    this.addChild(this._infoPanel);

    this.sortChildren();
    this.visible = false;
  }

  get customerUid(): number {
    return this._customer?.uid ?? -1;
  }

  setQueueIndex(index: number): void {
    this._queueIndex = index;
  }

  setCustomer(customer: CustomerInstance | null): void {
    this._clearCompleteBtn();

    if (!customer) {
      TweenManager.cancelTarget(this);
      TweenManager.cancelTarget(this.scale);
      this._boundCustomerUid = -1;
      this._customer = null;
      this.visible = false;
      return;
    }

    const prevUid = this._boundCustomerUid;
    this._customer = customer;
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

    const isQueuing = this._queueIndex >= CustomerManager.maxCustomers;
    const targetAlpha = isQueuing ? 0.6 : 1;
    const sameGuest = customer.uid === prevUid;

    TweenManager.cancelTarget(this);
    TweenManager.cancelTarget(this.scale);

    if (sameGuest) {
      // 仅需求/锁定状态等刷新：保持缩放，只平滑排队透明度
      this.scale.set(1, 1);
      TweenManager.to({
        target: this,
        props: { alpha: targetAlpha },
        duration: 0.18,
      });
      return;
    }

    this._boundCustomerUid = customer.uid;
    const wasShowingSomeone = prevUid >= 0 && this.alpha > 0.35;

    if (wasShowingSomeone) {
      // 队伍前移：此槽位换了人，用轻微变淡再亮代替全员 scale 弹跳
      this.scale.set(1, 1);
      this.alpha = Math.min(this.alpha, 0.72);
      TweenManager.to({
        target: this,
        props: { alpha: targetAlpha },
        duration: 0.22,
      });
    } else {
      // 首次出现（新客人进入空槽）
      this.alpha = 0;
      this.scale.set(0.6);
      TweenManager.to({
        target: this,
        props: { alpha: targetAlpha },
        duration: 0.3,
      });
      TweenManager.to({
        target: this.scale,
        props: { x: 1, y: 1 },
        duration: 0.4,
        ease: Ease.easeOutBack,
      });
    }
  }

  refreshSlots(): void {
    if (!this._customer) return;
    this._rebuildInfoPanel();
  }

  /**
   * 需求槽位物品图标中心在 CustomerView 局部坐标系中的位置（与 _rebuildInfoPanel 布局一致）
   */
  getDemandSlotIconLocalCenter(slotIndex: number): PIXI.Point | null {
    if (!this._customer || slotIndex < 0 || slotIndex >= this._customer.slots.length) {
      return null;
    }
    const n = this._customer.slots.length;
    const panelLeft = -PANEL_W / 2;
    const totalSlotW = n * SLOT_SIZE + (n - 1) * SLOT_GAP;
    const slotStartX = panelLeft + (PANEL_W - totalSlotW) / 2;
    const slotY = (PANEL_H - SLOT_SIZE) / 2;
    const sx = slotStartX + slotIndex * (SLOT_SIZE + SLOT_GAP);
    const cx = sx + SLOT_SIZE / 2;
    const cy = PANEL_Y + slotY + SLOT_SIZE / 2;
    return new PIXI.Point(cx, cy);
  }

  // ========== 底部信息面板 ==========

  private _rebuildInfoPanel(): void {
    this._infoPanel.removeChildren();
    this._clearCompleteBtn();
    this._clearRewardBadge();
    this._clearTierBadge();
    if (!this._customer) return;

    const allDone = this._customer.allSatisfied && this._queueIndex < CustomerManager.maxCustomers;

    // 奖励徽章（头像底部；花愿与交付到账一致）
    this._buildRewardBadge();

    // 档位角标（需求面板左上角小圆标）
    this._buildTierBadge();

    // 需求面板单独居中（宽度不含完成按钮）
    const panelLeft = -PANEL_W / 2;

    const panelShadow = new PIXI.Graphics();
    panelShadow.beginFill(0x8B7355, 0.18);
    panelShadow.drawRoundedRect(panelLeft + 2, 3, PANEL_W, PANEL_H, 12);
    panelShadow.endFill();
    this._infoPanel.addChild(panelShadow);

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
      bg.beginFill(0xFFFBF2, 0.96);
      bg.drawRoundedRect(panelLeft, 0, PANEL_W, PANEL_H, 12);
      bg.endFill();
      bg.lineStyle(1.5, 0xDEC090, 0.6);
      bg.drawRoundedRect(panelLeft, 0, PANEL_W, PANEL_H, 12);
      this._infoPanel.addChild(bg);
    }

    // 需求槽位（在面板矩形内水平居中）
    const slots = this._customer.slots;
    const totalSlotW = slots.length * SLOT_SIZE + (slots.length - 1) * SLOT_GAP;
    const slotStartX = panelLeft + (PANEL_W - totalSlotW) / 2;
    const slotY = (PANEL_H - SLOT_SIZE) / 2;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const sx = slotStartX + i * (SLOT_SIZE + SLOT_GAP);
      const filled = slot.lockedCellIndex >= 0;
      this._drawSlotItem(sx, slotY, slot.itemId, filled);
    }

    // 全部满足 → 完成按钮在半身像右侧肩颈区域
    if (allDone) {
      this._showCompleteBtn();
    }
  }

  private _rewardBadge: PIXI.Container | null = null;

  private _buildRewardBadge(): void {
    if (!this._customer) return;
    const badge = new PIXI.Container();
    badge.position.set(PANEL_W / 2, REWARD_BADGE_Y);

    const iconSize = 22;
    const gap = 4;
    let offsetX = 0;
    const items: { icon: string; value: number }[] = [];

    items.push({ icon: 'icon_huayuan', value: this._customer.huayuanReward });

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
    badge.pivot.set(bw, bh / 2);
    badge.zIndex = 8;
    this.addChild(badge);
    this._rewardBadge = badge;
    this.sortChildren();
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

  private _tierBadge: PIXI.Container | null = null;

  private _buildTierBadge(): void {
    this._clearTierBadge();
    if (!this._customer) return;
    const tier: OrderTier = (this._customer as any).tier ?? 'C';
    const color = TIER_COLORS[tier] ?? 0x999999;

    const badge = new PIXI.Container();
    const r = 11;
    const bg = new PIXI.Graphics();
    bg.beginFill(color, 0.92);
    bg.drawCircle(0, 0, r);
    bg.endFill();
    badge.addChild(bg);

    const label = new PIXI.Text(tier, {
      fontSize: 12,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5, 0.5);
    badge.addChild(label);

    badge.position.set(-PANEL_W / 2 + r + 2, PANEL_Y - r - 2);
    badge.zIndex = 10;
    this.addChild(badge);
    this._tierBadge = badge;
  }

  private _clearTierBadge(): void {
    if (this._tierBadge) {
      if (this._tierBadge.parent) this._tierBadge.parent.removeChild(this._tierBadge);
      this._tierBadge.destroy({ children: true });
      this._tierBadge = null;
    }
  }

  private _drawSlotItem(x: number, y: number, itemId: string, filled: boolean): void {
    const cs = SLOT_SIZE;
    const def = ITEM_DEFS.get(itemId);
    if (!def) return;

    const slotCornerR = Math.max(8, Math.round(cs * 0.12));
    const checkPad = Math.max(4, Math.round(cs * 0.07));
    /** 满足：与棋盘订单格一致的薄荷浅底 + 绿描边 + 更大对钩 */
    const checkTarget = Math.min(40, Math.max(28, Math.round(cs * 0.46)));

    // 每个需求槽都有圆角底框 + 描边：未满足浅米底，已满足暖黄底
    const slotBg = new PIXI.Graphics();
    if (filled) {
      slotBg.lineStyle(
        1.5,
        COLORS.CUSTOMER_DEMAND_SATISFIED_BORDER,
        COLORS.CUSTOMER_DEMAND_SATISFIED_BORDER_ALPHA,
      );
      slotBg.beginFill(
        COLORS.CELL_ORDER_MATCH_OVERLAY,
        COLORS.CELL_ORDER_MATCH_OVERLAY_ALPHA,
      );
      slotBg.drawRoundedRect(x, y, cs, cs, slotCornerR);
      slotBg.endFill();
    } else {
      slotBg.lineStyle(
        1.5,
        COLORS.CUSTOMER_DEMAND_PENDING_BORDER,
        COLORS.CUSTOMER_DEMAND_PENDING_BORDER_ALPHA,
      );
      slotBg.beginFill(
        COLORS.CUSTOMER_DEMAND_PENDING_BG,
        COLORS.CUSTOMER_DEMAND_PENDING_BG_ALPHA,
      );
      slotBg.drawRoundedRect(x, y, cs, cs, slotCornerR);
      slotBg.endFill();
    }
    this._infoPanel.addChild(slotBg);

    const texture = TextureCache.get(def.icon);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      const s = Math.min(cs / texture.width, cs / texture.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(x + cs / 2, y + cs / 2);

      this._infoPanel.addChild(sprite);

      if (isBoardToolInteract(def.interactType)) {
        const spark = new ToolSparkleLayer(cs, cs);
        spark.position.set(x, y);
        this._infoPanel.addChild(spark);
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
      const badgeTex = TextureCache.get('ui_order_check_badge');
      if (badgeTex) {
        const sp = new PIXI.Sprite(badgeTex);
        const s = checkTarget / Math.max(badgeTex.width, badgeTex.height);
        sp.scale.set(s);
        sp.anchor.set(1, 1);
        sp.position.set(x + cs - checkPad, y + cs - checkPad);
        this._infoPanel.addChild(sp);
      } else {
        const cr = Math.max(11, Math.round(checkTarget * 0.38));
        const cx = x + cs - checkPad;
        const cy = y + cs - checkPad;
        const check = new PIXI.Graphics();
        check.beginFill(0x4CAF50);
        check.drawCircle(cx, cy, cr);
        check.endFill();
        this._infoPanel.addChild(check);

        const checkMark = new PIXI.Text('✓', {
          fontSize: Math.round(checkTarget * 0.48),
          fill: 0xFFFFFF,
          fontWeight: 'bold',
        });
        checkMark.anchor.set(0.5, 0.5);
        checkMark.position.set(cx, cy);
        this._infoPanel.addChild(checkMark);
      }
    }
  }

  // ========== 完成按钮 ==========

  private _showCompleteBtn(): void {
    if (this._completeBtn) return;

    const BTN_W = COMPLETE_BTN_W;
    const BTN_H = COMPLETE_BTN_H;
    const btn = new PIXI.Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const btnTex = TextureCache.get('ui_complete_btn');
    if (btnTex) {
      const sp = new PIXI.Sprite(btnTex);
      sp.width = BTN_W;
      sp.height = BTN_H;
      sp.anchor.set(0.5, 0.5);
      btn.addChild(sp);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(0x4CAF50);
      bg.drawRoundedRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, BTN_H / 2);
      bg.endFill();
      bg.lineStyle(2, 0x388E3C, 0.5);
      bg.drawRoundedRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, BTN_H / 2);
      btn.addChild(bg);
    }

    const txt = new PIXI.Text('完成', {
      fontSize: 18,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x1b5e20,
      strokeThickness: 3,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.35,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    txt.anchor.set(0.5, 0.5);
    btn.addChild(txt);

    const btnCenterX = COMPLETE_BTN_X;
    const btnCenterY = COMPLETE_BTN_Y;
    btn.position.set(btnCenterX, btnCenterY);
    btn.zIndex = 2000;
    btn.on('pointertap', () => {
      if (this._customer) {
        const globalPos = this.toGlobal(new PIXI.Point(0, 0));
        EventBus.emit('customer:requestDeliver', this._customer.uid, this._customer, globalPos);
        btn.eventMode = 'none';
      }
    });

    this.addChild(btn);
    this.sortChildren();
    this._completeBtn = btn;

    const proxy = { t: 0 };
    this._bounceTween = TweenManager.to({
      target: proxy,
      props: { t: 600 },
      duration: 600,
      onUpdate: () => {
        if (this._completeBtn && !this._completeBtn.destroyed) {
          this._completeBtn.y = btnCenterY + Math.sin(proxy.t * 0.5) * 2;
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
      case FlowerLine.WRAP: return COLORS.FLOWER_WRAP;
      case FlowerLine.GREEN: return COLORS.FLOWER_GREEN;
      case DrinkLine.TEA: return COLORS.DRINK_TEA;
      case DrinkLine.COLD: return COLORS.DRINK_COLD;
      case DrinkLine.DESSERT: return COLORS.DRINK_DESSERT;
      default: return 0x999999;
    }
  }
}
