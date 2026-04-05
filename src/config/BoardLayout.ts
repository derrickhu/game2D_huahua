/**
 * 棋盘布局配置 - 仅定义核心区域预设，未覆盖格子使用默认规则补齐
 */

export enum CellState {
  OPEN = 'open',
  FOG = 'fog',
  PEEK = 'peek',   // 可窥视（能看到内容但不能操作，需合成波及解锁）
  KEY = 'key',      // 钥匙格（需金币解锁）
}

export interface CellPreset {
  row: number;
  col: number;
  state: CellState;
  /** 预置物品ID，空格为 null */
  itemId: string | null;
  /** 钥匙格解锁价格 */
  keyPrice: number;
  /** 解锁优先级（越小越先解锁） */
  unlockPriority: number;
}

/**
 * 固定开局棋盘（7 列 × 9 行），**无随机**：BoardManager 不再改写预设。
 *
 * **圈层**：`layer = max(|row - 4|, |col - 3|)`（以几何中心为「内」），layer 越大越靠外。
 * **开局约束**：迷雾/钥匙格内花束线、蝴蝶标本线、冷饮/甜品成品为散落的低～中阶棋子（各线数量不匀）；冷饮线仅 Lv1 量杯 `tool_mixer_1`，无冰箱/制冰机等高阶器具；**不含**捕虫网 `tool_butterfly_net_*`（蝴蝶线须合成或产出获得）。
 * **例外**：中央 2×2 OPEN 仍为双铲 + 两空格；`(2,3)` 迷雾水壶为合成链，`BoardManager` 会在首次合铲后兜底半锁。
 * **约束**：`FOG` / `PEEK` 内不得放合成链**顶格**（`getMergeResultId` 为 null 的产品/工具），否则半解锁后无法在开放格再凑一对合成，格子永远打不开。
 */
export const BOARD_PRESETS: CellPreset[] = [
  // layer 4 外圈
  { row: 0, col: 0, state: CellState.FOG,  itemId: 'tool_plant_5',     keyPrice: 0, unlockPriority: 80 },
  { row: 0, col: 1, state: CellState.KEY,  itemId: null,               keyPrice: 500, unlockPriority: 81 },
  { row: 0, col: 2, state: CellState.FOG,  itemId: 'flower_fresh_8',   keyPrice: 0, unlockPriority: 82 },
  { row: 0, col: 3, state: CellState.FOG,  itemId: 'drink_butterfly_2', keyPrice: 0, unlockPriority: 83 },
  { row: 0, col: 4, state: CellState.FOG,  itemId: 'drink_butterfly_3', keyPrice: 0, unlockPriority: 84 },
  { row: 0, col: 5, state: CellState.KEY,  itemId: null,               keyPrice: 500, unlockPriority: 85 },
  { row: 0, col: 6, state: CellState.FOG,  itemId: null,                 keyPrice: 0, unlockPriority: 86 },

  { row: 1, col: 0, state: CellState.FOG,  itemId: 'drink_dessert_6', keyPrice: 0, unlockPriority: 70 },
  { row: 1, col: 1, state: CellState.FOG,  itemId: 'flower_fresh_6',   keyPrice: 0, unlockPriority: 71 },
  { row: 1, col: 2, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 72 },
  { row: 1, col: 3, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 73 },
  { row: 1, col: 4, state: CellState.FOG,  itemId: 'flower_green_4',   keyPrice: 0, unlockPriority: 74 },
  { row: 1, col: 5, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 75 },
  { row: 1, col: 6, state: CellState.FOG,  itemId: 'flower_fresh_7',   keyPrice: 0, unlockPriority: 76 },

  { row: 2, col: 0, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 60 },
  { row: 2, col: 1, state: CellState.FOG,  itemId: 'flower_fresh_3',   keyPrice: 0, unlockPriority: 61 },
  { row: 2, col: 2, state: CellState.FOG,  itemId: 'flower_bouquet_1', keyPrice: 0, unlockPriority: 62 },
  { row: 2, col: 3, state: CellState.FOG,  itemId: 'tool_plant_2',     keyPrice: 0, unlockPriority: 63 },
  { row: 2, col: 4, state: CellState.FOG,  itemId: 'flower_green_3',   keyPrice: 0, unlockPriority: 64 },
  { row: 2, col: 5, state: CellState.FOG,  itemId: 'tool_mixer_1',     keyPrice: 0, unlockPriority: 65 },
  { row: 2, col: 6, state: CellState.FOG,  itemId: 'drink_dessert_5',  keyPrice: 0, unlockPriority: 66 },

  { row: 3, col: 0, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 50 },
  { row: 3, col: 1, state: CellState.FOG,  itemId: 'flower_fresh_2',   keyPrice: 0, unlockPriority: 51 },
  { row: 3, col: 2, state: CellState.OPEN, itemId: 'tool_plant_1',     keyPrice: 0, unlockPriority: 0 },
  { row: 3, col: 3, state: CellState.OPEN, itemId: 'tool_plant_1',     keyPrice: 0, unlockPriority: 0 },
  { row: 3, col: 4, state: CellState.FOG,  itemId: 'flower_fresh_2',   keyPrice: 0, unlockPriority: 52 },
  { row: 3, col: 5, state: CellState.FOG,  itemId: 'tool_arrange_2',   keyPrice: 0, unlockPriority: 53 },
  { row: 3, col: 6, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 54 },

  { row: 4, col: 0, state: CellState.FOG,  itemId: 'flower_green_5',   keyPrice: 0, unlockPriority: 40 },
  { row: 4, col: 1, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 41 },
  { row: 4, col: 2, state: CellState.OPEN, itemId: null,               keyPrice: 0, unlockPriority: 0 },
  { row: 4, col: 3, state: CellState.OPEN, itemId: null,               keyPrice: 0, unlockPriority: 0 },
  { row: 4, col: 4, state: CellState.FOG,  itemId: 'flower_fresh_2',   keyPrice: 0, unlockPriority: 42 },
  { row: 4, col: 5, state: CellState.FOG,  itemId: 'drink_cold_4',     keyPrice: 0, unlockPriority: 43 },
  { row: 4, col: 6, state: CellState.KEY,  itemId: null,               keyPrice: 200, unlockPriority: 44 },

  { row: 5, col: 0, state: CellState.KEY,  itemId: null,               keyPrice: 300, unlockPriority: 33 },
  { row: 5, col: 1, state: CellState.FOG,  itemId: 'flower_bouquet_2', keyPrice: 0, unlockPriority: 34 },
  { row: 5, col: 2, state: CellState.FOG,  itemId: 'flower_fresh_1',   keyPrice: 0, unlockPriority: 35 },
  { row: 5, col: 3, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 36 },
  { row: 5, col: 4, state: CellState.FOG,  itemId: 'flower_green_1',   keyPrice: 0, unlockPriority: 37 },
  { row: 5, col: 5, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 38 },
  { row: 5, col: 6, state: CellState.FOG,  itemId: 'drink_dessert_3',  keyPrice: 0, unlockPriority: 39 },

  { row: 6, col: 0, state: CellState.FOG,  itemId: 'flower_fresh_5',   keyPrice: 0, unlockPriority: 20 },
  { row: 6, col: 1, state: CellState.FOG,  itemId: 'flower_green_3',   keyPrice: 0, unlockPriority: 21 },
  { row: 6, col: 2, state: CellState.FOG,  itemId: 'tool_arrange_1',     keyPrice: 0, unlockPriority: 22 },
  { row: 6, col: 3, state: CellState.KEY,  itemId: null,               keyPrice: 300, unlockPriority: 23 },
  { row: 6, col: 4, state: CellState.FOG,  itemId: 'drink_dessert_3',  keyPrice: 0, unlockPriority: 24 },
  { row: 6, col: 5, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 25 },
  { row: 6, col: 6, state: CellState.FOG,  itemId: 'drink_cold_5',     keyPrice: 0, unlockPriority: 26 },

  { row: 7, col: 0, state: CellState.FOG,  itemId: 'tool_plant_5',     keyPrice: 0, unlockPriority: 10 },
  { row: 7, col: 1, state: CellState.FOG,  itemId: 'flower_fresh_6',   keyPrice: 0, unlockPriority: 11 },
  { row: 7, col: 2, state: CellState.FOG,  itemId: 'flower_green_4',   keyPrice: 0, unlockPriority: 12 },
  { row: 7, col: 3, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 13 },
  { row: 7, col: 4, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 14 },
  { row: 7, col: 5, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 15 },
  { row: 7, col: 6, state: CellState.FOG,  itemId: 'drink_dessert_6',  keyPrice: 0, unlockPriority: 16 },

  { row: 8, col: 0, state: CellState.KEY,  itemId: null,               keyPrice: 500, unlockPriority: 90 },
  { row: 8, col: 1, state: CellState.FOG,  itemId: 'flower_green_8',   keyPrice: 0, unlockPriority: 91 },
  { row: 8, col: 2, state: CellState.FOG,  itemId: 'flower_fresh_7',   keyPrice: 0, unlockPriority: 92 },
  { row: 8, col: 3, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 93 },
  { row: 8, col: 4, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 94 },
  { row: 8, col: 5, state: CellState.FOG,  itemId: null,               keyPrice: 0, unlockPriority: 99 },
  { row: 8, col: 6, state: CellState.KEY,  itemId: null,               keyPrice: 500, unlockPriority: 96 },
];
