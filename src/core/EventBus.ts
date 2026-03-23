/**
 * 桥接模块 - 从 engine 重导出
 *
 * 保留此文件使 `@/core/EventBus` 路径继续有效。
 * 真正实现已迁移至 `@/engine/events/EventBus`。
 */
export { EventBus } from '@/engine/events/EventBus';
