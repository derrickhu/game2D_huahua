/**
 * 抖音福利入口（主界面右侧悬浮按钮）
 *
 * 仅在抖音宿主且至少有一项能力可用时可见，微信端 visible 恒为 false。
 * 纯 Graphics 绘制，不新增美术资源。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { AudioManager } from '@/core/AudioManager';
import { DouyinWelfareManager } from '@/managers/DouyinWelfareManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';

/** 直径约 56，贴近顶部胶囊与活动入口体量，避免挡住角色 */
const R = 28;

export class DouyinWelfareEntry extends PIXI.Container {
  private _redDot!: PIXI.Graphics;

  constructor() {
    super();
    this.zIndex = 36;
    this._build();
    this.refresh();
    EventBus.on('douyinWelfare:changed', () => this.refresh());
  }

  refresh(): void {
    this.visible = DouyinWelfareManager.hasAnyEntry;
    this._redDot.visible = this.visible && DouyinWelfareManager.hasRedDot;
  }

  relayout(): void {
    this.position.set(DESIGN_WIDTH - R - 16, Game.safeTop + 112);
  }

  private _build(): void {
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new PIXI.Circle(0, 0, R);
    this.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.play('button_click');
      EventBus.emit('panel:openDouyinWelfare');
    });

    const bg = new PIXI.Graphics();
    bg.beginFill(0xff7a45, 1);
    bg.lineStyle(2.5, 0xffffff, 0.95);
    bg.drawCircle(0, 0, R);
    bg.endFill();
    this.addChild(bg);

    const label = new PIXI.Text('福利', {
      fontSize: 20,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    label.anchor.set(0.5);
    this.addChild(label);

    this._redDot = new PIXI.Graphics();
    this._redDot.beginFill(0xff3b30, 1);
    this._redDot.lineStyle(2, 0xffffff, 1);
    this._redDot.drawCircle(0, 0, 7);
    this._redDot.endFill();
    this._redDot.position.set(R * 0.72, -R * 0.72);
    this._redDot.visible = false;
    this.addChild(this._redDot);

    this.relayout();
  }
}
