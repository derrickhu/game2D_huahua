/**
 * 项目级按钮工厂 - 注入本项目的 AudioManager
 *
 * 日常使用一行搞定，底层 SoundButton 可跨项目复用。
 *
 * @example
 * ```ts
 * const btn = createButton({
 *   onTap: () => openShop(),
 *   hitArea: new PIXI.Circle(0, 0, 46),
 * });
 * btn.addChild(icon);
 * parent.addChild(btn);
 * ```
 */
import * as PIXI from 'pixi.js';
import { SoundButton, type SoundButtonOptions } from '@/core/SoundButton';
import { AudioManager } from '@/core/AudioManager';

export interface GameButtonOptions {
  /** 点击回调 */
  onTap?: () => void;
  /** 点击区域 */
  hitArea?: PIXI.IHitArea;
  /** 音效名称，默认 'button_click' */
  sound?: string;
  /** 是否静默（不播放音效），默认 false */
  silent?: boolean;
  /** 是否启用按压缩放动画，默认 true */
  pressAnimation?: boolean;
  /** 按压时缩放比例，默认 0.9 */
  pressScale?: number;
}

/**
 * 创建带音效的按钮（项目级便捷函数）
 */
export function createButton(opts: GameButtonOptions = {}): SoundButton {
  const soundName = opts.sound ?? 'button_click';
  const silent = opts.silent ?? false;

  return new SoundButton({
    hitArea: opts.hitArea,
    onTap: opts.onTap,
    playSound: silent ? undefined : () => AudioManager.play(soundName),
    pressAnimation: opts.pressAnimation,
    pressScale: opts.pressScale,
  });
}
