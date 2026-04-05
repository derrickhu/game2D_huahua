/**
 * 挂单、订单队列预览、链式限时与活动深度接入 —— 占位模块（P3）。
 * 生成侧链式三连入口仍为 `tryGenerateChainOrderTriple`（OrderGeneratorRegistry）。
 * 后续可在此注册：挂单槽位、下 N 单模糊预告、限时链奖励回调等。
 */

export type DeferredOrderFeatureId = 'pendingSlot' | 'queuePreview' | 'chainTimed';

/** 仅占位：接入时由 GameManager / UI 调用 */
export function registerDeferredOrderPlaceholder(_id: DeferredOrderFeatureId): void {
  // no-op
}
