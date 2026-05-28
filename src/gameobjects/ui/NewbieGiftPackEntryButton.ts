/**
 * 合成页店铺区 — 新手礼包入口
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { NewbieGiftPackManager } from '@/managers/NewbieGiftPackManager';
import { TextureCache } from '@/utils/TextureCache';
import { FONT_FAMILY } from '@/config/Constants';

const BTN = 72;

export class NewbieGiftPackEntryButton extends PIXI.Container {
  private _sprite!: PIXI.Sprite;
  private _redDot!: PIXI.Graphics;
  private _label!: PIXI.Text;
  private _breathPhase = 0;
  private _stopped = false;

  constructor(private _onTap: () => void) {
    super();
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
    const tex = TextureCache.get('icon_newbie_gift_qinglian') ?? TextureCache.get('icon_gift');
    this._sprite = new PIXI.Sprite(tex ?? PIXI.Texture.EMPTY);
    this._sprite.anchor.set(0.5);
    if (tex) {
      const sc = BTN / Math.max(tex.width, tex.height);
      this._sprite.scale.set(sc);
    }
    this.addChild(this._sprite);

    this._label = new PIXI.Text('新手礼', {
      fontSize: 12,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x5a3d52,
      strokeThickness: 3,
    });
    this._label.anchor.set(0.5, 0);
    this._label.position.set(0, BTN * 0.38);
    this.addChild(this._label);

    this._redDot = new PIXI.Graphics();
    this._redDot.beginFill(0xff4444, 1);
    this._redDot.drawCircle(0, 0, 7);
    this._redDot.endFill();
    this._redDot.position.set(BTN * 0.32, -BTN * 0.32);
    this.addChild(this._redDot);

    this.hitArea = new PIXI.Circle(0, 0, BTN * 0.55);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => this._onTap());
  }

  private _syncVisibility(): void {
    this.visible = NewbieGiftPackManager.shouldShowEntry;
    if (this.visible) this._breathPhase = 0;
  }
}
