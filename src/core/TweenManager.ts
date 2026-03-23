/**
 * 桥接模块 - 从 engine 重导出
 *
 * 保留此文件使 `@/core/TweenManager` 路径继续有效。
 * 真正实现已迁移至 `@/engine/tween/TweenManager`。
 */
export { TweenManager, Ease } from '@/engine/tween/TweenManager';
export type { EaseFunc, TweenConfig, ActiveTween } from '@/engine/tween/TweenManager';
