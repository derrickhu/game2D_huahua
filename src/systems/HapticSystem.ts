/**
 * 合成/升级的粒子与全屏闪、硬件震动均已关闭。
 * 保留类与 `MainScene` 中的构造、`update`、`stopAll` 调用，便于日后接新反馈。
 */
import * as PIXI from 'pixi.js';

export class HapticSystem {
  constructor(_parent: PIXI.Container) {}

  update(_dt: number): void {}

  stopAll(): void {}
}
