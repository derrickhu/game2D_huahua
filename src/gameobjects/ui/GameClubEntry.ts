/**
 * 游戏圈主界面悬浮入口（合成页右上侧，暖金花坊质感徽章）
 *
 * - 微信小游戏 & H5 预览可见；抖音 / TapTap / 华为端自动隐藏。
 * - 有可领奖励或今日逛圈礼包未领时展示红点。
 */

import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { AudioManager } from '@/core/AudioManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import { GameClubManager } from '@/managers/GameClubManager';
import { TextureCache } from '@/utils/TextureCache';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';

const BTN_R = 32;

export class GameClubEntry extends PIXI.Container {
  private _iconHolder!: PIXI.Container;
  private _iconSprite: PIXI.Sprite | null = null;
  private _redDot!: PIXI.Graphics;
  private _texUnsub: (() => void) | null = null;

  constructor() {
    super();
    this.zIndex = 36;
    this._build();
    this.refresh();

    EventBus.on('gameClub:changed', () => this.refresh());
    this._texUnsub = TextureCache.onKeysLoaded(['icon_game_club_nb2'], () => {
      this._syncIconTexture();
    });
  }

  override destroy(options?: PIXI.IDestroyOptions | boolean): void {
    this._texUnsub?.();
    this._texUnsub = null;
    super.destroy(options);
  }

  refresh(): void {
    this.visible = GameClubManager.isEntryVisible;
    this._redDot.visible = this.visible && GameClubManager.hasRedDot;
    this._syncIconTexture();
  }

  relayout(): void {
    this.position.set(DESIGN_WIDTH - BTN_R - 16, Game.safeTop + 118);
  }

  private _build(): void {
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new PIXI.Rectangle(-BTN_R - 8, -BTN_R - 6, (BTN_R + 8) * 2, BTN_R * 2 + 26);

    this.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.play('button_click');
      TweenManager.cancelTarget(this.scale);
      this.scale.set(0.9);
      TweenManager.to({
        target: this.scale,
        props: { x: 1, y: 1 },
        duration: 0.22,
        ease: Ease.easeOutBack,
      });
      EventBus.emit('panel:openGameClub');
    });

    // 暖金双描边珍珠米白底托（与顶栏/花坊活动图标统一调性）
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x5d4037, 0.22);
    shadow.drawCircle(1, 3, BTN_R);
    shadow.endFill();
    this.addChild(shadow);

    const bg = new PIXI.Graphics();
    bg.lineStyle(2.5, 0xe6be82, 1);
    bg.beginFill(0xfff9ee, 0.98);
    bg.drawCircle(0, 0, BTN_R);
    bg.endFill();
    bg.lineStyle(1.2, 0xffffff, 0.9);
    bg.drawCircle(0, 0, BTN_R - 3);
    this.addChild(bg);

    this._iconHolder = new PIXI.Container();
    this._iconHolder.position.set(0, -3);
    this.addChild(this._iconHolder);
    this._syncIconTexture();

    // 底部暖金琥珀铭牌（去幼稚亮绿，改用温润焦糖金底白字）
    const pillW = 68;
    const pillH = 22;
    const pill = new PIXI.Graphics();
    pill.lineStyle(1.8, 0xffe4b5, 0.98);
    pill.beginFill(0xd4764e, 1);
    pill.drawRoundedRect(-pillW / 2, BTN_R - 13, pillW, pillH, pillH / 2);
    pill.endFill();
    this.addChild(pill);

    const label = new PIXI.Text('游戏圈', {
      fontSize: 13.5,
      fill: 0xfffaf0,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x703119,
      strokeThickness: 2.5,
    } as PIXI.TextStyle);
    label.anchor.set(0.5);
    label.position.set(0, BTN_R - 2);
    this.addChild(label);

    this._redDot = new PIXI.Graphics();
    this._redDot.beginFill(0xff3b30, 1);
    this._redDot.lineStyle(2, 0xffffff, 1);
    this._redDot.drawCircle(0, 0, 8);
    this._redDot.endFill();
    this._redDot.position.set(BTN_R * 0.72, -BTN_R * 0.72);
    this._redDot.visible = false;
    this.addChild(this._redDot);

    this.relayout();
  }

  private _syncIconTexture(): void {
    const tex = TextureCache.get('icon_game_club_nb2');
    if (tex?.width) {
      if (!this._iconSprite) {
        this._iconHolder.removeChildren();
        this._iconSprite = new PIXI.Sprite(tex);
        this._iconSprite.anchor.set(0.5);
        this._iconHolder.addChild(this._iconSprite);
      } else {
        this._iconSprite.texture = tex;
      }
      const size = 50;
      const s = Math.min(size / tex.width, size / tex.height);
      this._iconSprite.scale.set(s);
      return;
    }

    if (this._iconHolder.children.length > 0) return;
    const g = new PIXI.Graphics();
    const colors = [0xf0786c, 0xf5d06c, 0x6fd098, 0x74b4f0];
    for (let i = 0; i < 4; i++) {
      const a0 = (i * Math.PI) / 2 - Math.PI * 0.75;
      const a1 = a0 + Math.PI * 0.46;
      g.lineStyle(7, colors[i]!, 1);
      g.arc(0, 0, 15, a0, a1);
    }
    this._iconHolder.addChild(g);
  }
}
