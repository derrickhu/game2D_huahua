export { computeUnlockedLines, type OrderBoardCell } from './unlockedLines';
export {
  generateOrderDemands,
  tryGenerateChainOrderTriple,
  validateOrderSlotsToolCap,
  toolCapForLine,
  lineOrderSpecsForTier,
} from './OrderGeneratorRegistry';
export {
  ORDER_PRODUCT_IDS,
  productOrderSpecsForTier,
  productToolCap,
  resolveOrderProduct,
  type OrderProductId,
  type ProductOrderSpec,
} from '@/config/OrderProductConfig';
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
