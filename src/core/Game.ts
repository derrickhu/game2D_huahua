/**
 * 全局游戏单例 - 持有 PIXI.Application 和核心引用
 */
import * as PIXI from 'pixi.js';
import { TweenManager } from './TweenManager';

class GameClass {
  app!: PIXI.Application;
  stage!: PIXI.Container;

  /** 设计分辨率 */
  designWidth = 750;
  designHeight = 1334;

  /** 实际屏幕尺寸（逻辑像素） */
  screenWidth = 375;
  screenHeight = 667;

  /** 缩放比 */
  scale = 1;

  /** 像素密度 */
  dpr = 1;

  private _initialized = false;

  init(canvas: any): void {
    if (this._initialized) return;

    // 获取屏幕信息
    const sysInfo = (typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null)
      ?.getSystemInfoSync?.();

    if (sysInfo) {
      this.screenWidth = sysInfo.screenWidth;
      this.screenHeight = sysInfo.screenHeight;
      this.dpr = sysInfo.pixelRatio || 2;
    }

    // 计算缩放：以宽度为基准适配
    this.scale = this.screenWidth / this.designWidth * this.dpr;

    const realWidth = this.screenWidth * this.dpr;
    const realHeight = this.screenHeight * this.dpr;

    canvas.width = realWidth;
    canvas.height = realHeight;

    this.app = new PIXI.Application({
      view: canvas,
      width: realWidth,
      height: realHeight,
      backgroundColor: 0xFFF5EE,
      resolution: 1,
      antialias: true,
    });

    this.stage = this.app.stage;

    // 整体缩放到设计分辨率
    this.stage.scale.set(this.scale, this.scale);

    // 注册 ticker 更新 TweenManager
    this.app.ticker.add(() => {
      const dt = this.app.ticker.deltaMS / 1000;
      TweenManager.update(dt);
    });

    this._initialized = true;
    console.log(`[Game] 初始化完成: ${realWidth}x${realHeight}, scale=${this.scale.toFixed(2)}, dpr=${this.dpr}`);
  }

  /** 设计坐标转实际像素 */
  toReal(v: number): number {
    return v * this.scale;
  }

  /** 获取设计分辨率下的逻辑宽度 */
  get logicWidth(): number {
    return this.designWidth;
  }

  /** 获取设计分辨率下的逻辑高度 */
  get logicHeight(): number {
    return this.screenHeight / this.screenWidth * this.designWidth;
  }
}

export const Game = new GameClass();
