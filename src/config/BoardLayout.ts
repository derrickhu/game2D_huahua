/**
 * 棋盘布局配置 - 30格初始预设
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
 * 30格棋盘预设（6列×5行）
 * 初始开放：中心 2×2 = 4格 (row 1~2, col 2~3)
 */
export const BOARD_PRESETS: CellPreset[] = [
  // 第0行（最上方）- 第三圈
  { row: 0, col: 0, state: CellState.FOG,  itemId: 'bmat_flower_build_3', keyPrice: 0, unlockPriority: 25 },
  { row: 0, col: 1, state: CellState.KEY,  itemId: null,                  keyPrice: 500, unlockPriority: 26 },
  { row: 0, col: 2, state: CellState.PEEK, itemId: 'flower_luxury_4',     keyPrice: 0, unlockPriority: 21 },
  { row: 0, col: 3, state: CellState.FOG,  itemId: 'drink_dessert_3',     keyPrice: 0, unlockPriority: 22 },
  { row: 0, col: 4, state: CellState.KEY,  itemId: null,                  keyPrice: 500, unlockPriority: 27 },
  { row: 0, col: 5, state: CellState.FOG,  itemId: 'bmat_drink_build_3',  keyPrice: 0, unlockPriority: 28 },

  // 第1行 - 第二圈外 + 初始区
  { row: 1, col: 0, state: CellState.FOG,  itemId: 'flower_daily_3',      keyPrice: 0, unlockPriority: 15 },
  { row: 1, col: 1, state: CellState.PEEK, itemId: 'flower_romantic_2',   keyPrice: 0, unlockPriority: 5 },
  { row: 1, col: 2, state: CellState.OPEN, itemId: 'flower_daily_1',      keyPrice: 0, unlockPriority: 0 },  // 初始
  { row: 1, col: 3, state: CellState.OPEN, itemId: 'flower_daily_1',      keyPrice: 0, unlockPriority: 0 },  // 初始
  { row: 1, col: 4, state: CellState.PEEK, itemId: 'flower_daily_2',      keyPrice: 0, unlockPriority: 6 },
  { row: 1, col: 5, state: CellState.FOG,  itemId: 'drink_tea_2',         keyPrice: 0, unlockPriority: 16 },

  // 第2行 - 初始区 + 第一圈
  { row: 2, col: 0, state: CellState.PEEK, itemId: 'flower_daily_3',      keyPrice: 0, unlockPriority: 13 },
  { row: 2, col: 1, state: CellState.FOG,  itemId: 'bmat_flower_build_1', keyPrice: 0, unlockPriority: 7 },
  { row: 2, col: 2, state: CellState.OPEN, itemId: 'building_cons_1',     keyPrice: 0, unlockPriority: 0 },  // 初始：花材礼盒
  { row: 2, col: 3, state: CellState.OPEN, itemId: null,                  keyPrice: 0, unlockPriority: 0 },  // 初始：空格
  { row: 2, col: 4, state: CellState.FOG,  itemId: 'bmat_flower_build_1', keyPrice: 0, unlockPriority: 8 },
  { row: 2, col: 5, state: CellState.PEEK, itemId: 'drink_cold_2',        keyPrice: 0, unlockPriority: 14 },

  // 第3行 - 第一圈 + 第二圈
  { row: 3, col: 0, state: CellState.FOG,  itemId: 'flower_romantic_3',   keyPrice: 0, unlockPriority: 17 },
  { row: 3, col: 1, state: CellState.PEEK, itemId: 'flower_daily_2',      keyPrice: 0, unlockPriority: 9 },
  { row: 3, col: 2, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 10 },
  { row: 3, col: 3, state: CellState.FOG,  itemId: 'flower_daily_1',      keyPrice: 0, unlockPriority: 11 },
  { row: 3, col: 4, state: CellState.PEEK, itemId: 'drink_tea_1',         keyPrice: 0, unlockPriority: 12 },
  { row: 3, col: 5, state: CellState.KEY,  itemId: null,                  keyPrice: 200, unlockPriority: 18 },

  // 第4行（最下方）- 第二圈 + 第三圈
  { row: 4, col: 0, state: CellState.KEY,  itemId: null,                  keyPrice: 300, unlockPriority: 23 },
  { row: 4, col: 1, state: CellState.FOG,  itemId: 'bmat_flower_build_2', keyPrice: 0, unlockPriority: 19 },
  { row: 4, col: 2, state: CellState.PEEK, itemId: 'flower_luxury_2',     keyPrice: 0, unlockPriority: 20 },
  { row: 4, col: 3, state: CellState.FOG,  itemId: 'building_cons_4',     keyPrice: 0, unlockPriority: 24 },
  { row: 4, col: 4, state: CellState.PEEK, itemId: 'drink_dessert_2',     keyPrice: 0, unlockPriority: 29 },
  { row: 4, col: 5, state: CellState.FOG,  itemId: 'bmat_drink_build_2',  keyPrice: 0, unlockPriority: 30 },
];
