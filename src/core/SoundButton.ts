/**
 * 通用带音效按钮组件
 *
 * 引擎级模块，零业务依赖。
 * 通过 playSound 回调注入音效行为，不硬依赖任何 AudioManager。
 * 内置按压缩放动画反馈。
 *
 * @example
 * ```ts
 * const btn = new SoundButton({
 *   hitArea: new PIXI.Circle(0, 0, 46),
 *   playSound: () => AudioManager.play('button_click'),
 *   onTap: () => { console.log('clicked!'); },
 * });
 * btn.addChild(mySprite);
 * ```
 */
import * as PIXI from 'pixi.js';

export interface SoundButtonOptions {
  /** 点击区域，不设则由子节点边界决定 */
  hitArea?: PIXI.IHitArea;
  /** 点击回调 */
  onTap?: () => void;
  /** 音效播放回调（注入式，不依赖具体 AudioManager） */
  playSound?: () => void;
  /** 是否启用按压缩放动画，默认 true */
  pressAnimation?: boolean;
  /** 按压时缩放比例，默认 0.9 */
  pressScale?: number;
}

export class SoundButton extends PIXI.Container {
  private _onTap: (() => void) | undefined;
  private _playSound: (() => void) | undefined;
  private _pressAnimation: boolean;
  private _pressScale: number;
  private _origScaleX = 1;
  private _origScaleY = 1;
  private _isPressed = false;

  constructor(opts: SoundButtonOptions = {}) {
    super();

    this._onTap = opts.onTap;
    this._playSound = opts.playSound;
    this._pressAnimation = opts.pressAnimation !== false; // 默认开启
    this._pressScale = opts.pressScale ?? 0.9;

    // 设置交互
    this.eventMode = 'static';
    this.cursor = 'pointer';

    if (opts.hitArea) {
      this.hitArea = opts.hitArea;
    }

    // 事件绑定
    this.on('pointerdown', this._onPointerDown, this);
    this.on('pointerup', this._onPointerUp, this);
    this.on('pointerupoutside', this._onPointerUpOutside, this);
    this.on('pointertap', this._onPointertap, this);
  }

  /** 更新点击回调 */
  set onTap(fn: (() => void) | undefined) {
    this._onTap = fn;
  }

  /** 更新音效回调 */
  set playSound(fn: (() => void) | undefined) {
    this._playSound = fn;
  }

  private _onPointerDown(): void {
    if (!this._pressAnimation) return;
    this._isPressed = true;
    this._origScaleX = this.scale.x;
    this._origScaleY = this.scale.y;
    this.scale.set(
      this._origScaleX * this._pressScale,
      this._origScaleY * this._pressScale,
    );
  }

  private _onPointerUp(): void {
    if (!this._pressAnimation || !this._isPressed) return;
    this._isPressed = false;
    this.scale.set(this._origScaleX, this._origScaleY);
  }

  private _onPointerUpOutside(): void {
    if (!this._pressAnimation || !this._isPressed) return;
    this._isPressed = false;
    this.scale.set(this._origScaleX, this._origScaleY);
  }

  private _onPointertap(): void {
    // 播放音效
    this._playSound?.();
    // 触发业务回调
    this._onTap?.();
  }

  /** 销毁时清理事件 */
  override destroy(options?: boolean | PIXI.IDestroyOptions): void {
    this.off('pointerdown', this._onPointerDown, this);
    this.off('pointerup', this._onPointerUp, this);
    this.off('pointerupoutside', this._onPointerUpOutside, this);
    this.off('pointertap', this._onPointertap, this);
    super.destroy(options);
  }
}
