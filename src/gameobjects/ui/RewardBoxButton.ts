/**
 * 奖励收纳框 — 收起态（合成页店主下方）
 *
 * **圆形托盘**（与方形棋盘格区分）+ 暖色/粉紫散射光斑 + 中心浅碟承托物品；右上红角标加大、数字描边便于辨认。
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { BoardMetrics, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { TextureCache } from '@/utils/TextureCache';

/** 主白碟半径占格边长的比例（略小于 0.5 留边，避免贴死方形容器） */
const DISC_R_RATIO = 0.48;
/** 图标最大边相对碟直径 */
const ICON_IN_DISC = 0.76;
const BADGE_R = 17;
const BADGE_FONT = 15;
const BREATH_AMP = 0.055;

export class RewardBoxButton extends PIXI.Container {
  private _cellRoot!: PIXI.Container;
  private _cellBg!: PIXI.Graphics;
  private _itemSprite!: PIXI.Sprite;
  private _badge!: PIXI.Graphics;
  private _badgeText!: PIXI.Text;
  private _itemBaseScale = 1;
  private _hasItemTexture = false;
  private _breathStopped = false;
  private _rewardActive = false;
  private _textureUnsub: (() => void) | null = null;

  constructor() {
    super();
    this._build();
    this._refresh();
    EventBus.on('rewardBox:changed', () => this._refresh());
    this._textureUnsub = TextureCache.observeTextureDependencies({ groups: ['items'] }, () => this._refresh());
    Game.ticker.add(this._onBreathTick, this);
  }

  destroy(options?: PIXI.IDestroyOptions | boolean): void {
    this._breathStopped = true;
    this._textureUnsub?.();
    this._textureUnsub = null;
    Game.ticker.remove(this._onBreathTick, this);
    super.destroy(options);
  }

  /** 占位区域仍与棋盘格同边长，便于布局对齐 */
  static layoutSize(): { w: number; h: number } {
    const cs = BoardMetrics.cellSize;
    return { w: cs, h: cs };
  }

  getItemSlotCenterLocal(): PIXI.Point {
    const cs = BoardMetrics.cellSize;
    return new PIXI.Point(cs / 2, cs / 2);
  }

  private _build(): void {
    this._cellRoot = new PIXI.Container();

    this._cellBg = new PIXI.Graphics();
    this._cellRoot.addChild(this._cellBg);

    this._itemSprite = new PIXI.Sprite();
    this._itemSprite.anchor.set(0.5);
    this._itemSprite.eventMode = 'none';
    this._cellRoot.addChild(this._itemSprite);

    this._badge = new PIXI.Graphics();
    this._cellRoot.addChild(this._badge);

    this._badgeText = new PIXI.Text('', {
      fontSize: BADGE_FONT,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x3d0a0a,
      strokeThickness: 3,
    });
    this._badgeText.anchor.set(0.5);
    this._cellRoot.addChild(this._badgeText);

    this.addChild(this._cellRoot);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => {
      EventBus.emit('rewardBox:open');
    });
  }

  /** 圆形碟 + 多色散射光（与棋盘方格明显不同） */
  private _paintRewardPlate(g: PIXI.Graphics, cs: number, hasItems: boolean): void {
    g.clear();
    const cx = cs / 2;
    const cy = cs / 2;
    const strong = hasItems ? 1 : 0.55;

    type Blob = { ox: number; oy: number; rRatio: number; color: number; a: number };
    const blobs: Blob[] = [
      { ox: -0.2, oy: -0.24, rRatio: 0.34, color: 0xffe8a8, a: 0.38 * strong },
      { ox: 0.22, oy: -0.1, rRatio: 0.28, color: 0xe4d4ff, a: 0.32 * strong },
      { ox: 0.06, oy: 0.22, rRatio: 0.26, color: 0xffc0d8, a: 0.28 * strong },
      { ox: -0.18, oy: 0.2, rRatio: 0.24, color: 0xb8e8ff, a: 0.26 * strong },
      { ox: 0.02, oy: -0.06, rRatio: 0.21, color: 0xfffacd, a: 0.22 * strong },
    ];
    for (const b of blobs) {
      g.beginFill(b.color, Math.min(1, b.a));
      g.drawCircle(cx + b.ox * cs, cy + b.oy * cs, b.rRatio * cs);
      g.endFill();
    }

    g.beginFill(0xffefd8, 0.45 * strong);
    g.drawCircle(cx, cy, cs * 0.495);
    g.endFill();

    g.beginFill(0xfffaee, 0.35 * strong);
    g.drawCircle(cx, cy, cs * 0.44);
    g.endFill();

    const discR = cs * DISC_R_RATIO;
    g.beginFill(0xfffffd, hasItems ? 0.96 : 0.62);
    g.drawCircle(cx, cy, discR);
    g.endFill();
    g.lineStyle(2.5, 0xffb88a, hasItems ? 0.9 : 0.45);
    g.drawCircle(cx, cy, Math.max(2, discR - 1.25));
    g.lineStyle(1, 0xffffff, hasItems ? 0.55 : 0.3);
    g.drawCircle(cx, cy, discR - 3);
  }

  private _discRadius(cs: number): number {
    return cs * DISC_R_RATIO;
  }

  private _layoutHitArea(): void {
    const cs = BoardMetrics.cellSize;
    this.hitArea = new PIXI.Rectangle(0, 0, cs, cs);
    const cx = cs / 2;
    const cy = cs / 2;
    this._itemSprite.position.set(cx, cy);
  }

  private _onBreathTick(): void {
    if (this._breathStopped || !this.visible) return;
    if (!this._rewardActive || !this._hasItemTexture) {
      this._itemSprite.scale.set(this._itemBaseScale);
      return;
    }
    const t = performance.now() * 0.0028;
    const breathe = 1 + Math.sin(t) * BREATH_AMP;
    this._itemSprite.scale.set(this._itemBaseScale * breathe);
  }

  private _refresh(): void {
    const total = RewardBoxManager.totalCount;
    this.visible = true;
    this._rewardActive = total > 0;

    const cs = BoardMetrics.cellSize;
    this._layoutHitArea();

    this._paintRewardPlate(this._cellBg, cs, this._rewardActive);

    const latestId = RewardBoxManager.latestDisplayItemId();
    const def = latestId ? ITEM_DEFS.get(latestId) : undefined;
    const iconKey = def?.icon;
    const tex = iconKey ? TextureCache.get(iconKey) : null;

    const cx = cs / 2;
    const cy = cs / 2;
    const discR = this._discRadius(cs);
    const maxSize = discR * 2 * ICON_IN_DISC;

    if (this._rewardActive && tex && tex.width > 0) {
      this._hasItemTexture = true;
      this._itemSprite.texture = tex;
      this._itemSprite.visible = true;
      const s = Math.min(maxSize / tex.width, maxSize / tex.height);
      this._itemBaseScale = s;
      this._itemSprite.scale.set(this._itemBaseScale);
      this._itemSprite.position.set(cx, cy);
    } else {
      this._hasItemTexture = false;
      this._itemSprite.visible = false;
      this._itemSprite.texture = PIXI.Texture.EMPTY;
      this._itemBaseScale = 1;
      this._itemSprite.scale.set(1);
      this._itemSprite.position.set(cx, cy);
    }

    const badgeX = cs - 1;
    const badgeY = 1;
    this._badge.clear();
    if (this._rewardActive) {
      this._badge.visible = true;
      this._badgeText.visible = true;
      this._badge.beginFill(0xd32f2f);
      this._badge.drawCircle(badgeX, badgeY, BADGE_R);
      this._badge.endFill();
      this._badge.lineStyle(2.2, 0xffffff, 0.92);
      this._badge.drawCircle(badgeX, badgeY, BADGE_R - 1);

      const label = total > 99 ? '99+' : `${total}`;
      this._badgeText.text = label;
      this._badgeText.style.fontSize = label.length >= 3 ? 13 : BADGE_FONT;
      this._badgeText.position.set(badgeX, badgeY);
    } else {
      this._badge.visible = false;
      this._badgeText.visible = false;
      this._badgeText.text = '';
    }
  }
}
