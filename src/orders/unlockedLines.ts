/**
 * 棋盘快照 → 订单系统用「已解锁产线」（与 BuildingConfig 产出表一致）
 */
import { CellState } from '@/config/BoardLayout';
import {
  findBoardProducerDef,
  boardProducerOutputsProductLine,
} from '@/config/BuildingConfig';
import { Category, FlowerLine, ToolLine } from '@/config/ItemConfig';
import type { UnlockedLines } from '@/config/OrderTierConfig';

export interface OrderBoardCell {
  state: CellState;
  itemId: string | null;
}

export function computeUnlockedLines(cells: readonly OrderBoardCell[]): UnlockedLines {
  let maxPlantToolLevel = 0;
  let maxArrangeToolLevel = 0;
  let maxDrinkToolLevel = 0;
  let hasBouquet = false;
  let hasGreen = false;
  let hasDrink = false;
  const drinkLinesOnBoard = new Set<string>();

  for (const c of cells) {
    if (c.state !== CellState.OPEN || !c.itemId) continue;

    const def = findBoardProducerDef(c.itemId);
    if (!def) continue;

    if (boardProducerOutputsProductLine(def, Category.FLOWER, FlowerLine.BOUQUET)) {
      hasBouquet = true;
    }
    if (boardProducerOutputsProductLine(def, Category.FLOWER, FlowerLine.GREEN)) {
      hasGreen = true;
    }

    if (def.toolLine === ToolLine.PLANT) {
      maxPlantToolLevel = Math.max(maxPlantToolLevel, def.level);
    } else if (def.toolLine === ToolLine.ARRANGE) {
      maxArrangeToolLevel = Math.max(maxArrangeToolLevel, def.level);
      if (def.level >= 3) hasBouquet = true;
    } else if (def.produceCategory === Category.DRINK && def.canProduce) {
      hasDrink = true;
      maxDrinkToolLevel = Math.max(maxDrinkToolLevel, def.level);
      drinkLinesOnBoard.add(def.produceLine);
    }
  }

  let unlockedLineCount = 0;
  if (hasBouquet) unlockedLineCount++;
  if (hasGreen) unlockedLineCount++;
  unlockedLineCount += drinkLinesOnBoard.size;

  return {
    hasBouquet,
    hasGreen,
    hasDrink,
    maxPlantToolLevel,
    maxArrangeToolLevel,
    maxDrinkToolLevel,
    unlockedLineCount,
  };
}
