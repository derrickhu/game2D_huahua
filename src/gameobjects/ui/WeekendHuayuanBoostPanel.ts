/**
 * 周末花愿 +50% 活动宣传页（合成顶栏入口）
 * 宣传文案在 AI 母图内；仅按钮状态用 PIXI 叠字。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { OverlayManager } from '@/core/OverlayManager';
import { TextureCache } from '@/utils/TextureCache';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { WeekendHuayuanBoostManager } from '@/managers/WeekendHuayuanBoostManager';
import { AdManager, AdScene } from '@/managers/AdManager';
import { AudioManager } from '@/core/AudioManager';

const Z = 11200;

const CLOSE_NX = 0.94;
const CLOSE_NY = 0.06;
const CLOSE_R = 26;
const CTA_NY = 0.915;
const CTA_NH = 0.13;
const CTA_LABEL_DY_RATIO = 0.14;
const CTA_NW = 0.82;

export class WeekendHuayuanBoostPanel extends PIXI.Container {
  private _isOpen = false;
  private _opening = false;
  private _bg!: PIXI.Graphics;
  private _root!: PIXI.Container;
  private _art!: PIXI.Sprite;
  private _ctaHit!: PIXI.Container;
  private _ctaLabel!: PIXI.Text;
  private _closeHit!: PIXI.Container;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = Z;
    this.sortableChildren = true;
    this._build();
    EventBus.on('panel:openWeekendHuayuanBoost', () => this.open());
    EventBus.on('weekendHuayuanBoost:changed', () => {
      if (this._isOpen) this._syncCta();
    });
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    if (!WeekendHuayuanBoostManager.isAvailableToday()) {
      ToastMessage.show('周末花愿加成仅周六、周日开启');
      return;
    }
    this._opening = true;
    void TextureCache.preloadPanelAssets('weekendHuayuanBoost').finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    OverlayManager.bringToFront();
    this.visible = true;
    this._rebuildArt();
    this._syncCta();
    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.22, ease: Ease.easeOutQuad });
  }

  close(): void {
    this._opening = false;
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.18,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this.alpha = 1;
      },
    });
  }

  private _build(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.55);
    this._bg.drawRect(0, 0, W, H);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    this._root = new PIXI.Container();
    this._root.eventMode = 'passive';
    this._root.position.set(W / 2, H / 2);
    this.addChild(this._root);

    this._art = new PIXI.Sprite();
    this._art.anchor.set(0.5);
    this._root.addChild(this._art);

    this._closeHit = new PIXI.Container();
    this._closeHit.eventMode = 'static';
    this._closeHit.cursor = 'pointer';
    this._closeHit.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._root.addChild(this._closeHit);

    this._ctaHit = new PIXI.Container();
    this._ctaHit.eventMode = 'static';
    this._ctaHit.cursor = 'pointer';
    this._ctaHit.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._onCtaTap();
    });
    this._root.addChild(this._ctaHit);

    this._ctaLabel = new PIXI.Text('', {
      fontSize: 30,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 4,
    } as PIXI.TextStyle);
    this._ctaLabel.anchor.set(0.5);
    this._ctaHit.addChild(this._ctaLabel);
  }

  private _rebuildArt(): void {
    const tex = TextureCache.get('weekend_huayuan_boost_promo_panel_nb2');
    if (!tex) {
      this._art.visible = false;
      return;
    }
    this._art.texture = tex;
    this._art.visible = true;
    const maxW = DESIGN_WIDTH - 40;
    const maxH = Game.logicHeight * 0.82;
    const scale = Math.min(maxW / tex.width, maxH / tex.height, 1);
    this._art.scale.set(scale);
    const w = tex.width * scale;
    const h = tex.height * scale;

    this._closeHit.position.set(-w / 2 + w * CLOSE_NX, -h / 2 + h * CLOSE_NY);
    this._closeHit.hitArea = new PIXI.Circle(0, 0, CLOSE_R);

    const ctaW = w * CTA_NW;
    const ctaH = h * CTA_NH;
    this._ctaHit.position.set(0, -h / 2 + h * CTA_NY);
    this._ctaHit.hitArea = new PIXI.Rectangle(-ctaW / 2, -ctaH / 2, ctaW, ctaH);
    this._ctaLabel.position.set(0, ctaH * CTA_LABEL_DY_RATIO);
  }

  private _syncCta(): void {
    const active = WeekendHuayuanBoostManager.isActive();
    this._art.alpha = 1;
    this._ctaHit.alpha = 1;
    if (active) {
      this._ctaLabel.text = '当日已获得';
      this._ctaLabel.style.fill = 0xffffff;
      this._ctaLabel.style.stroke = 0x5d4037;
      this._ctaHit.cursor = 'default';
      this._ctaHit.eventMode = 'none';
    } else {
      this._ctaLabel.text = '看广告 0/1';
      this._ctaLabel.style.fill = 0xffffff;
      this._ctaLabel.style.stroke = 0x8b4513;
      this._ctaHit.cursor = 'pointer';
      this._ctaHit.eventMode = 'static';
    }
  }

  private _onCtaTap(): void {
    if (WeekendHuayuanBoostManager.isActive()) return;

    AdManager.showRewardedAd(AdScene.WEEKEND_HUAYUAN_BOOST, (success, reason) => {
      if (!success) {
        if (reason === 'load_failed' || reason === 'no_ad') {
          ToastMessage.show('广告加载失败，请稍后重试');
        } else if (reason === 'busy') {
          ToastMessage.show('广告正在播放中');
        } else {
          ToastMessage.show('广告未看完，未激活加成');
        }
        return;
      }
      if (!WeekendHuayuanBoostManager.activateToday()) {
        ToastMessage.show('活动仅周六、周日开启');
        return;
      }
      AudioManager.play('purchase_tap');
      ToastMessage.show('今日订单花愿 +50% 已生效');
      this._syncCta();
      EventBus.emit('customer:rewardBonusChanged');
    });
  }
}
