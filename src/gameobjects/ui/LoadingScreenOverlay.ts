/**
 * 启动全屏 Loading：插画 cover 铺满视口，底部叠圆润进度条 + 动态百分比
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TextureCache } from '@/utils/TextureCache';
import { FONT_FAMILY } from '@/config/Constants';

const SPLASH_KEY = 'loading_splash_run_to_shop_nb2';
const TITLE_KEY = 'loading_title_cute_nb2';
/** 标题最大宽度（设计坐标，再乘 TITLE_SCALE） */
const TITLE_MAX_W = 540;
/** 相对上述适配结果的缩放 */
const TITLE_SCALE = 0.95;
/** 标题垂直微调（设计坐标，负值向上） */
const TITLE_NUDGE_Y = -30;
/** 标题区：安全区下额外留白 */
const TITLE_BELOW_SAFE = 20;

/** 进度条距屏幕底边（设计坐标） */
const BAR_INSET_FROM_BOTTOM = 148;
const BAR_MAX_W = 560;
const BAR_PAD_X = 24;
/** 胖圆角胶囊条（半径=半高，最圆润） */
const BAR_H = 38;
const BAR_R = BAR_H / 2;
const INNER_PAD = 4;

const TRACK_LINE = 0x7ec8e3;
const TRACK_FILL = 0xfffcfa;
const BAR_FILL = 0xff8fb0;
const BAR_FILL_DEEP = 0xff6b94;

const SHADOW_OFF_Y = 5;
const SHADOW_ALPHA = 0.2;

export class LoadingScreenOverlay extends PIXI.Container {
  private _lw = 750;
  private _lh = 1334;
  private _splash: PIXI.Sprite | null = null;
  private _title: PIXI.Sprite | null = null;
  private _barShadow = new PIXI.Graphics();
  private _track = new PIXI.Graphics();
  private _fill = new PIXI.Graphics();
  private _pctText: PIXI.Text;
  private _barW = 480;
  private _barX = 0;
  private _barY = 0;
  private _progress = 0;

  constructor() {
    super();
    this.zIndex = 50000;
    this.sortableChildren = true;
    this._barShadow.zIndex = 10;
    this._track.zIndex = 11;
    this._fill.zIndex = 12;

    this._pctText = new PIXI.Text('0%', {
      fontSize: 22,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xe85a82,
      strokeThickness: 5,
      dropShadow: true,
      dropShadowColor: 0x663344,
      dropShadowBlur: 3,
      dropShadowAngle: Math.PI / 2,
      dropShadowDistance: 2,
    });
    this._pctText.anchor.set(0.5, 0.5);
    this._pctText.zIndex = 13;

    this.addChild(this._barShadow);
    this.addChild(this._track);
    this.addChild(this._fill);
    this.addChild(this._pctText);
    this._relayout();
  }

  private _relayout(): void {
    this._lw = Game.logicWidth;
    this._lh = Game.logicHeight;

    if (this._splash && this._splash.texture?.valid) {
      const tex = this._splash.texture;
      const tw = tex.width;
      const th = tex.height;
      const scale = Math.max(this._lw / tw, this._lh / th);
      this._splash.scale.set(scale);
      this._splash.position.set(this._lw * 0.5, this._lh * 0.5);
    }

    if (this._title && this._title.texture?.valid) {
      const tex = this._title.texture;
      const tw = tex.width;
      const th = tex.height;
      const maxW = Math.min(TITLE_MAX_W, this._lw - 32);
      const s = Math.min(1, maxW / tw) * TITLE_SCALE;
      this._title.scale.set(s);
      const cy = Game.safeTop + TITLE_BELOW_SAFE + (th * s) / 2 + TITLE_NUDGE_Y;
      this._title.position.set(this._lw * 0.5, cy);
    }

    this._barW = Math.min(BAR_MAX_W, this._lw - BAR_PAD_X * 2);
    this._barX = (this._lw - this._barW) / 2;
    this._barY = this._lh - BAR_INSET_FROM_BOTTOM - BAR_H;

    this._pctText.position.set(this._lw * 0.5, this._barY + BAR_H * 0.5);

    this._drawShadow();
    this._drawTrack();
    this._drawFill();
    this._syncPercentLabel();
  }

  /** 在 TextureCache.preloadLoadingSplash() 完成后调用 */
  applySplashTexture(): void {
    const tex = TextureCache.get(SPLASH_KEY);
    if (!tex || !tex.valid) return;

    if (this._splash) {
      this.removeChild(this._splash);
      this._splash.destroy();
      this._splash = null;
    }

    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5, 0.5);
    sp.zIndex = 0;
    const insertAt = this._title ? 1 : 0;
    this.addChildAt(sp, insertAt);
    this._splash = sp;
    this._relayout();
  }

  /** 与 applySplashTexture 同批预载后调用，叠在底图之上 */
  applyTitleTexture(): void {
    const tex = TextureCache.get(TITLE_KEY);
    if (!tex || !tex.valid) return;

    if (this._title) {
      this.removeChild(this._title);
      this._title.destroy();
      this._title = null;
    }

    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5, 0.5);
    sp.zIndex = 5;
    if (this._splash) {
      const idx = this.getChildIndex(this._splash);
      this.addChildAt(sp, idx + 1);
    } else {
      this.addChildAt(sp, 0);
    }
    this._title = sp;
    this._relayout();
  }

  setProgress(ratio: number): void {
    const p = Math.max(0, Math.min(1, ratio));
    if (p < this._progress) return;
    this._progress = p;
    this._drawFill();
    this._syncPercentLabel();
  }

  private _syncPercentLabel(): void {
    const n = Math.round(this._progress * 100);
    this._pctText.text = `${n}%`;
  }

  private _drawShadow(): void {
    this._barShadow.clear();
    const pad = 3;
    this._barShadow.beginFill(0x5a7a90, SHADOW_ALPHA);
    this._barShadow.drawRoundedRect(
      this._barX - pad,
      this._barY - pad + SHADOW_OFF_Y,
      this._barW + pad * 2,
      BAR_H + pad * 2,
      BAR_R + pad * 0.6,
    );
    this._barShadow.endFill();
  }

  private _drawTrack(): void {
    this._track.clear();
    this._track.lineStyle(3.5, TRACK_LINE, 0.95);
    this._track.beginFill(TRACK_FILL, 0.78);
    this._track.drawRoundedRect(this._barX, this._barY, this._barW, BAR_H, BAR_R);
    this._track.endFill();
    this._track.lineStyle(2, 0xffffff, 0.5);
    this._track.drawRoundedRect(
      this._barX + 2,
      this._barY + 2,
      this._barW - 4,
      BAR_H - 4,
      Math.max(12, BAR_R - 2),
    );
  }

  private _drawFill(): void {
    this._fill.clear();
    const innerW = this._barW - INNER_PAD * 2;
    const innerH = BAR_H - INNER_PAD * 2;
    const w = Math.max(0, innerW * this._progress);
    if (w < 0.5) return;

    const x0 = this._barX + INNER_PAD;
    const y0 = this._barY + INNER_PAD;
    const r = Math.max(10, BAR_R - INNER_PAD);

    this._fill.beginFill(BAR_FILL_DEEP, 0.98);
    this._fill.drawRoundedRect(x0, y0, w, innerH, r);
    this._fill.endFill();

    const hiH = Math.max(3, Math.floor(innerH * 0.45));
    this._fill.beginFill(BAR_FILL, 0.85);
    this._fill.drawRoundedRect(x0, y0, w, hiH, r);
    this._fill.endFill();
  }

  refreshLayout(): void {
    this._relayout();
  }
}
