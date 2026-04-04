export { computeUnlockedLines, type OrderBoardCell } from './unlockedLines';
export {
  generateOrderDemands,
  tryGenerateChainOrderTriple,
} from './OrderGeneratorRegistry';
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
