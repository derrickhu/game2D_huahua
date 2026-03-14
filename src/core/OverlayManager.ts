/**
 * 全局弹窗覆盖层管理器
 *
 * 将弹窗面板（签到、任务、装修、熟客等）放在场景之上的全局层级，
 * 这样无论当前在哪个场景（合成棋盘 / 花店），弹窗都能正常显示。
 */
import * as PIXI from 'pixi.js';
import { Game } from './Game';

class OverlayManagerClass {
  private _container: PIXI.Container | null = null;

  /** 获取全局覆盖层容器 */
  get container(): PIXI.Container {
    if (!this._container) {
      this._container = new PIXI.Container();
      this._container.sortableChildren = true;
      this._container.zIndex = 10000;
      Game.stage.addChild(this._container);
    }
    return this._container;
  }

  /** 确保覆盖层在最顶部 */
  bringToFront(): void {
    if (this._container && this._container.parent) {
      const parent = this._container.parent;
      parent.removeChild(this._container);
      parent.addChild(this._container);
    }
  }
}

export const OverlayManager = new OverlayManagerClass();
