/**
 * 奖励收纳框 — 收起态按钮
 *
 * 礼包图常驻；有物品时礼盒呼吸 + 外发光 + 右上角红角标。
 * 空盒时仅静态礼包，无角标、无发光、无呼吸。
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { FONT_FAMILY } from '@/config/Constants';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { TextureCache } from '@/utils/TextureCache';

export const REWARD_BOX_BTN_SIZE = 92;
const CORNER_R = 20;
const FILL_COLOR = 0xfff9e6;
const FILL_ALPHA = 0.98;
const BORDER_COLOR = 0xe8b86a;
const BADGE_R = 13;
/** 礼盒相对「铺满方格」再放大一档 */
const BOX_TEX_ZOOM = 1.22;
/** 呼吸缩放幅度（相对基础 scale） */
const BREATH_AMP = 0.062;

export class RewardBoxButton extends PIXI.Container {
  private _outerGlow!: PIXI.Graphics;
  private _midGlow!: PIXI.Graphics;
  private _glowTint!: PIXI.Graphics;
  private _boxMask!: PIXI.Graphics;
  private _boxSprite!: PIXI.Sprite;
  /** 无 cell_locked_v2 纹理时的矢量兜底 */
  private _bg!: PIXI.Graphics;
  private _innerLight!: PIXI.Graphics;
  private _badge!: PIXI.Graphics;
  private _badgeText!: PIXI.Text;
  private _boxBaseScale = 1;
  private _hasBoxTexture = false;
  /** 与 PIXI Container 的 _destroyed 区分，避免 TS 子类属性不兼容 */
  private _breathStopped = false;
  /** 收纳框内是否有可领物品（决定角标/发光/呼吸） */
  private _rewardActive = false;

  constructor() {
    super();
    this._build();
    this._refresh();
    EventBus.on('rewardBox:changed', () => this._refresh());
    Game.ticker.add(this._onBreathTick, this);
  }

  destroy(options?: PIXI.IDestroyOptions | boolean): void {
    this._breathStopped = true;
    Game.ticker.remove(this._onBreathTick, this);
    super.destroy(options);
  }

  private _build(): void {
    const S = REWARD_BOX_BTN_SIZE;
    const cx = S / 2;
    const cy = S / 2;

    this._outerGlow = new PIXI.Graphics();
    this._outerGlow.position.set(cx, cy);
    this.addChild(this._outerGlow);

    this._glowTint = new PIXI.Graphics();
    this._glowTint.position.set(cx, cy);
    this.addChild(this._glowTint);

    this._midGlow = new PIXI.Graphics();
    this._midGlow.position.set(cx, cy);
    this.addChild(this._midGlow);

    this._boxMask = new PIXI.Graphics();
    this.addChild(this._boxMask);

    this._boxSprite = new PIXI.Sprite();
    this._boxSprite.anchor.set(0.5);
    this._boxSprite.position.set(cx, cy);
    this.addChild(this._boxSprite);

    this._bg = new PIXI.Graphics();
    this.addChild(this._bg);

    this._innerLight = new PIXI.Graphics();
    this.addChild(this._innerLight);

    this._badge = new PIXI.Graphics();
    this.addChild(this._badge);

    this._badgeText = new PIXI.Text('', {
      fontSize: 12,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._badgeText.anchor.set(0.5);
    this.addChild(this._badgeText);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new PIXI.Rectangle(0, 0, S, S);
    this.on('pointerdown', () => {
      EventBus.emit('rewardBox:open');
    });
  }

  /** 外发光层：原点为按钮中心 */
  private _drawOuterGlowRings(S: number): void {
    this._outerGlow.clear();
    const outer: [number, number, number][] = [
      [0xffe8a8, 0.38, S * 0.62],
      [0xfff5d6, 0.32, S * 0.54],
      [0xffffff, 0.26, S * 0.46],
      [0xffefd8, 0.2, S * 0.38],
    ];
    for (const [color, alpha, r] of outer) {
      this._outerGlow.beginFill(color, alpha);
      this._outerGlow.drawCircle(0, 0, r);
      this._outerGlow.endFill();
    }

    this._glowTint.clear();
    const tint: [number, number, number][] = [
      [0x7ee8b8, 0.22, S * 0.58],
      [0xa8f0d0, 0.16, S * 0.48],
      [0xc8f8e4, 0.1, S * 0.4],
    ];
    for (const [color, alpha, r] of tint) {
      this._glowTint.beginFill(color, alpha);
      this._glowTint.drawCircle(0, 0, r);
      this._glowTint.endFill();
    }

    this._midGlow.clear();
    const mid: [number, number, number][] = [
      [0xffffff, 0.32, S * 0.42],
      [0xfff8e8, 0.36, S * 0.32],
      [0xffffff, 0.22, S * 0.24],
    ];
    for (const [color, alpha, r] of mid) {
      this._midGlow.beginFill(color, alpha);
      this._midGlow.drawCircle(0, 0, r);
      this._midGlow.endFill();
    }
  }

  private _drawInnerLight(cx: number, cy: number, S: number): void {
    this._innerLight.clear();
    const inner: [number, number, number][] = [
      [0xffffff, 0.45, S * 0.34],
      [0xffefd0, 0.38, S * 0.26],
      [0xffffff, 0.28, S * 0.16],
    ];
    for (const [color, alpha, r] of inner) {
      this._innerLight.beginFill(color, alpha);
      this._innerLight.drawCircle(cx, cy - S * 0.02, r);
      this._innerLight.endFill();
    }
  }

  private _onBreathTick(): void {
    if (this._breathStopped || !this.visible) return;
    if (!this._rewardActive) {
      if (this._hasBoxTexture) {
        this._boxSprite.scale.set(this._boxBaseScale);
      } else if (this._bg.visible) {
        this._bg.scale.set(1);
      }
      return;
    }

    const t = performance.now() * 0.0028;
    const breathe = 1 + Math.sin(t) * BREATH_AMP;
    if (this._hasBoxTexture) {
      this._boxSprite.scale.set(this._boxBaseScale * breathe);
    } else if (this._bg.visible) {
      this._bg.scale.set(breathe);
    }

    const g = 1 + Math.sin(t * 0.95) * 0.085;
    this._outerGlow.scale.set(g);
    this._glowTint.scale.set(g * 1.02);
    this._midGlow.scale.set(1 + Math.sin(t * 1.05) * 0.06);

    const a = 0.88 + Math.sin(t * 0.9) * 0.12;
    this._outerGlow.alpha = a;
    this._glowTint.alpha = 0.75 + Math.sin(t * 1.0) * 0.2;
    this._midGlow.alpha = 0.9 + Math.sin(t * 1.05) * 0.1;
    if (this._innerLight.visible) {
      this._innerLight.alpha = 0.88 + Math.sin(t * 1.12) * 0.12;
    }
  }

  private _refresh(): void {
    const S = REWARD_BOX_BTN_SIZE;
    const total = RewardBoxManager.totalCount;
    this.visible = true;
    this._rewardActive = total > 0;

    const cx = S / 2;
    const cy = S / 2;

    if (this._rewardActive) {
      this._drawOuterGlowRings(S);
      this._outerGlow.visible = true;
      this._glowTint.visible = true;
      this._midGlow.visible = true;
    } else {
      this._outerGlow.clear();
      this._glowTint.clear();
      this._midGlow.clear();
      this._outerGlow.visible = false;
      this._glowTint.visible = false;
      this._midGlow.visible = false;
      this._outerGlow.scale.set(1);
      this._glowTint.scale.set(1);
      this._midGlow.scale.set(1);
    }

    this._boxMask.clear();
    this._boxMask.beginFill(0xffffff);
    this._boxMask.drawRoundedRect(0, 0, S, S, CORNER_R);
    this._boxMask.endFill();

    const boxTex = TextureCache.get('cell_locked_v2');
    this._bg.clear();
    if (boxTex && boxTex.width > 0) {
      this._hasBoxTexture = true;
      this._boxSprite.texture = boxTex;
      const cover = Math.max(S / boxTex.width, S / boxTex.height);
      this._boxBaseScale = cover * BOX_TEX_ZOOM;
      this._boxSprite.scale.set(this._boxBaseScale);
      this._boxSprite.position.set(cx, cy);
      this._boxSprite.visible = true;
      this._boxSprite.mask = this._boxMask;
      this._bg.visible = false;
      this._bg.scale.set(1);
      this._innerLight.visible = false;
    } else {
      this._hasBoxTexture = false;
      this._boxSprite.visible = false;
      this._boxSprite.mask = null;
      this._bg.visible = true;
      this._bg.pivot.set(cx, cy);
      this._bg.position.set(cx, cy);
      this._bg.lineStyle(2, BORDER_COLOR, 0.9);
      this._bg.beginFill(FILL_COLOR, FILL_ALPHA);
      this._bg.drawRoundedRect(-cx, -cy, S, S, CORNER_R);
      this._bg.endFill();
      this._innerLight.visible = this._rewardActive;
      if (this._rewardActive) {
        this._drawInnerLight(cx, cy, S);
      } else {
        this._innerLight.clear();
      }
    }

    const badgeX = S - 3;
    const badgeY = 3;
    this._badge.clear();
    if (this._rewardActive) {
      this._badge.visible = true;
      this._badgeText.visible = true;
      this._badge.beginFill(0xe53935);
      this._badge.drawCircle(badgeX, badgeY, BADGE_R);
      this._badge.endFill();
      this._badgeText.text = total > 99 ? '99+' : `${total}`;
      this._badgeText.position.set(badgeX, badgeY);
    } else {
      this._badge.visible = false;
      this._badgeText.visible = false;
      this._badgeText.text = '';
    }
  }
}
