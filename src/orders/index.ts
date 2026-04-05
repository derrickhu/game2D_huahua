export { computeUnlockedLines, type OrderBoardCell } from './unlockedLines';
export {
  generateOrderDemands,
  tryGenerateChainOrderTriple,
  validateOrderSlotsToolCap,
  toolCapForLine,
} from './OrderGeneratorRegistry';
export {
  registerDeferredOrderPlaceholder,
  type DeferredOrderFeatureId,
} from './OrderSystemDeferred';
export {
  registerActivityOrderHook,
  getActivityOrderHook,
  type OrderGenContext,
  type OrderGenResult,
  type OrderGenerationKind,
  type OrderGenSlot,
  type ActivityOrderHook,
  type ActivityOrderPartial,
} from './types';
