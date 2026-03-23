/**
 * 引擎核心模块 - 统一导出
 *
 * 所有模块零业务依赖，可直接复制到任何 PixiJS 项目复用。
 * 依赖方向：engine/ ← core/ ← managers/systems/gameobjects/
 */

// 事件系统
export { EventBus } from './events/EventBus';

// 补间动画
export { TweenManager, Ease } from './tween/TweenManager';
export type { EaseFunc, TweenConfig, ActiveTween } from './tween/TweenManager';

// 音频管理
export { AudioManager } from './audio/AudioManager';

// UI 组件
export { SoundButton } from './ui/SoundButton';
export type { SoundButtonOptions } from './ui/SoundButton';
