/**
 * 新手礼包入口 — 花店底栏（shopRow）或合成页条带（mergeStrip，已弃用主场景挂载）
 */
import * as PIXI from 'pixi.js';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { NewbieGiftPackManager } from '@/managers/NewbieGiftPackManager';
import { TextureCache } from '@/utils/TextureCache';
import { FONT_FAMILY } from '@/config/Constants';

const MERGE_STRIP_BTN = 72;
/** 与 ShopScene 大地图/许愿底栏图标一致 */
const SHOP_NAV_ICON_R = 40;
/** 礼包 PNG 留白较多，显示略放大以对齐许愿/地图视觉体量 */
const SHOP_ROW_GIFT_ICON_SCALE = 1.22;
const SHOP_NAV_LABEL_FONT = 14;
const SHOP_NAV_LABEL_H = 18;

export type NewbieGiftPackEntryVariant = 'shopRow' | 'mergeStrip';

export interface NewbieGiftPackEntryOptions {
  variant?: NewbieGiftPackEntryVariant;
}

export class NewbieGiftPackEntryButton extends PIXI.Container {
  private _sprite!: PIXI.Sprite;
  private _redDot!: PIXI.Graphics;
  private _label!: PIXI.Text;
  private _breathPhase = 0;
  private _stopped = false;
  private readonly _variant: NewbieGiftPackEntryVariant;

  constructor(
    private _onTap: () => void,
    options?: NewbieGiftPackEntryOptions,
  ) {
    super();
    this._variant = options?.variant ?? 'mergeStrip';
    this._build();
    this._syncVisibility();
    EventBus.on('newbieGiftPack:progress', () => this._syncVisibility());
    EventBus.on('newbieGiftPack:claimed', () => this._syncVisibility());
    EventBus.on('tutorial:completed', () => this._syncVisibility());
  }

  destroy(options?: PIXI.IDestroyOptions | boolean): void {
    this._stopped = true;
    super.destroy(options);
  }

  tickBreath(): void {
    if (this._stopped || !this.visible) return;
    this._breathPhase += 0.04;
    const s = 1 + Math.sin(this._breathPhase) * 0.04;
    this.scale.set(s);
  }

  private _build(): void {
    if (this._variant === 'shopRow') {
      this._buildShopRow();
      return;
    }
    this._buildMergeStrip();
  }

  private _buildShopRow(): void {
    const r = SHOP_NAV_ICON_R;
    const displayR = r * SHOP_ROW_GIFT_ICON_SCALE;
    const tex = TextureCache.get('icon_newbie_gift_qinglian') ?? TextureCache.get('icon_gift');
    if (tex && tex.width > 1) {
      this._sprite = new PIXI.Sprite(tex);
      this._sprite.anchor.set(0.5);
      this._sprite.width = displayR * 2;
      this._sprite.height = displayR * 2;
      this.addChild(this._sprite);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(0xffb74d, 0.9);
      bg.drawCircle(0, 0, displayR);
      bg.endFill();
      bg.lineStyle(2.5, 0xffffff, 0.6);
      bg.drawCircle(0, 0, displayR);
      this.addChild(bg);
      this._sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
      const icon = new PIXI.Text('礼', {
        fontSize: Math.round(displayR * 0.72),
        fontFamily: FONT_FAMILY,
        fill: 0xffffff,
      });
      icon.anchor.set(0.5);
      this.addChild(icon);
    }

    const labelY = r - 10;
    this._label = new PIXI.Text('新手礼包', {
      fontSize: SHOP_NAV_LABEL_FONT,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x3e2723,
      strokeThickness: 2.5,
    });
    this._label.anchor.set(0.5, 0);
    this._label.y = labelY;
    this.addChild(this._label);

    this._redDot = new PIXI.Graphics();
    this._redDot.beginFill(0xff4444, 1);
    this._redDot.drawCircle(0, 0, 7);
    this._redDot.endFill();
    this._redDot.position.set(displayR * 0.55, -displayR * 0.55);
    this.addChild(this._redDot);

    const hitH = r * 2 + SHOP_NAV_LABEL_H + 12;
    this.hitArea = new PIXI.Rectangle(-displayR - 12, -displayR - 8, displayR * 2 + 24, hitH);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => {
      TweenManager.cancelTarget(this.scale);
      this.scale.set(0.85);
      TweenManager.to({
        target: this.scale,
        props: { x: 1, y: 1 },
        duration: 0.25,
        ease: Ease.easeOutBack,
      });
      this._onTap();
    });
  }

  private _buildMergeStrip(): void {
    const tex = TextureCache.get('icon_newbie_gift_qinglian') ?? TextureCache.get('icon_gift');
    this._sprite = new PIXI.Sprite(tex ?? PIXI.Texture.EMPTY);
    this._sprite.anchor.set(0.5);
    if (tex) {
      const sc = MERGE_STRIP_BTN / Math.max(tex.width, tex.height);
      this._sprite.scale.set(sc);
    }
    this.addChild(this._sprite);

    this._label = new PIXI.Text('新手礼包', {
      fontSize: 12,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x5a3d52,
      strokeThickness: 3,
    });
    this._label.anchor.set(0.5, 0);
    this._label.position.set(0, MERGE_STRIP_BTN * 0.38);
    this.addChild(this._label);

    this._redDot = new PIXI.Graphics();
    this._redDot.beginFill(0xff4444, 1);
    this._redDot.drawCircle(0, 0, 7);
    this._redDot.endFill();
    this._redDot.position.set(MERGE_STRIP_BTN * 0.32, -MERGE_STRIP_BTN * 0.32);
    this.addChild(this._redDot);

    this.hitArea = new PIXI.Circle(0, 0, MERGE_STRIP_BTN * 0.55);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => this._onTap());
  }

  private _syncVisibility(): void {
    this.visible = NewbieGiftPackManager.shouldShowEntry;
    if (this.visible) this._breathPhase = 0;
  }
}
