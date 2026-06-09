/**
 * 棋盘快照 → 订单系统用「已解锁产线」（与 BuildingConfig 产出表一致）
 */
import { CellState } from '@/config/BoardLayout';
import {
  findBoardProducerDef,
  boardProducerOutputsProductLine,
} from '@/config/BuildingConfig';
import { Category, DrinkLine, FlowerLine, FoodLine, ToolLine } from '@/config/ItemConfig';
import type { UnlockedLines } from '@/config/OrderTierConfig';

export interface OrderBoardCell {
  state: CellState;
  itemId: string | null;
}

export function computeUnlockedLines(cells: readonly OrderBoardCell[]): UnlockedLines {
  let maxPlantToolLevel = 0;
  let maxArrangeToolLevel = 0;
  let maxDrinkToolLevel = 0;
  let maxFarmToolLevel = 0;
  let maxFruitCutToolLevel = 0;
  let hasBouquet = false;
  let hasGreen = false;
  let hasDrink = false;
  let hasFood = false;
  const drinkLinesOnBoard = new Set<string>();
  const drinkToolMaxByLine: Partial<Record<DrinkLine, number>> = {};
  const foodToolMaxByLine: Partial<Record<FoodLine, number>> = {};

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
      const dl = def.produceLine as DrinkLine;
      drinkToolMaxByLine[dl] = Math.max(drinkToolMaxByLine[dl] ?? 0, def.level);
    } else if (def.toolLine === ToolLine.FARM) {
      maxFarmToolLevel = Math.max(maxFarmToolLevel, def.level);
    } else if (def.toolLine === ToolLine.FRUIT_CUT) {
      maxFruitCutToolLevel = Math.max(maxFruitCutToolLevel, def.level);
    }
  }

  if (maxFarmToolLevel >= 3 && maxFruitCutToolLevel >= 1) {
    hasFood = true;
    const fruitCutLines = [FoodLine.CUT_AVOCADO, FoodLine.CUT_WATERMELON];
    if (maxFarmToolLevel >= 4) {
      fruitCutLines.push(FoodLine.CUT_PINEAPPLE, FoodLine.CUT_DRAGONFRUIT);
    }
    for (const line of fruitCutLines) {
      foodToolMaxByLine[line] = maxFruitCutToolLevel;
    }
  }

  let unlockedLineCount = 0;
  if (hasBouquet) unlockedLineCount++;
  if (hasGreen) unlockedLineCount++;
  unlockedLineCount += drinkLinesOnBoard.size;
  unlockedLineCount += Object.keys(foodToolMaxByLine).length;

  return {
    hasBouquet,
    hasGreen,
    hasDrink,
    hasFood,
    maxPlantToolLevel,
    maxArrangeToolLevel,
    maxDrinkToolLevel,
    maxFarmToolLevel,
    maxFruitCutToolLevel,
    drinkToolMaxByLine,
    foodToolMaxByLine,
    unlockedLineCount,
  };
}
