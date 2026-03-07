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
 * 核心区预设（7列×9行）
 * 未覆盖的格子由 BoardManager 自动补齐为迷雾格
 */
export const BOARD_PRESETS: CellPreset[] = [
  // ── 第0行 - 外围迷雾 ──
  { row: 0, col: 0, state: CellState.FOG,  itemId: 'bmat_flower_build_3', keyPrice: 0, unlockPriority: 40 },
  { row: 0, col: 1, state: CellState.KEY,  itemId: null,                  keyPrice: 500, unlockPriority: 41 },
  { row: 0, col: 2, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 42 },
  { row: 0, col: 3, state: CellState.PEEK, itemId: 'flower_luxury_4',     keyPrice: 0, unlockPriority: 35 },
  { row: 0, col: 4, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 43 },
  { row: 0, col: 5, state: CellState.KEY,  itemId: null,                  keyPrice: 500, unlockPriority: 44 },
  { row: 0, col: 6, state: CellState.FOG,  itemId: 'bmat_drink_build_3',  keyPrice: 0, unlockPriority: 45 },

  // ── 第1行 - 外围迷雾/窥视 ──
  { row: 1, col: 0, state: CellState.FOG,  itemId: 'drink_dessert_3',     keyPrice: 0, unlockPriority: 36 },
  { row: 1, col: 1, state: CellState.FOG,  itemId: 'flower_daily_3',      keyPrice: 0, unlockPriority: 25 },
  { row: 1, col: 2, state: CellState.PEEK, itemId: 'flower_romantic_2',   keyPrice: 0, unlockPriority: 15 },
  { row: 1, col: 3, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 26 },
  { row: 1, col: 4, state: CellState.PEEK, itemId: 'flower_daily_2',      keyPrice: 0, unlockPriority: 16 },
  { row: 1, col: 5, state: CellState.FOG,  itemId: 'drink_tea_2',         keyPrice: 0, unlockPriority: 27 },
  { row: 1, col: 6, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 37 },

  // ── 第2行 - 第二圈 + 窥视 ──
  { row: 2, col: 0, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 38 },
  { row: 2, col: 1, state: CellState.PEEK, itemId: 'flower_daily_3',      keyPrice: 0, unlockPriority: 17 },
  { row: 2, col: 2, state: CellState.FOG,  itemId: 'bmat_flower_build_1', keyPrice: 0, unlockPriority: 10 },
  { row: 2, col: 3, state: CellState.OPEN, itemId: 'flower_daily_1',      keyPrice: 0, unlockPriority: 0 },
  { row: 2, col: 4, state: CellState.FOG,  itemId: 'bmat_flower_build_1', keyPrice: 0, unlockPriority: 11 },
  { row: 2, col: 5, state: CellState.PEEK, itemId: 'drink_cold_2',        keyPrice: 0, unlockPriority: 18 },
  { row: 2, col: 6, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 39 },

  // ── 第3行 - 初始核心区 ──
  { row: 3, col: 0, state: CellState.FOG,  itemId: 'flower_romantic_3',   keyPrice: 0, unlockPriority: 28 },
  { row: 3, col: 1, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 12 },
  { row: 3, col: 2, state: CellState.OPEN, itemId: 'flower_daily_1',      keyPrice: 0, unlockPriority: 0 },
  { row: 3, col: 3, state: CellState.OPEN, itemId: 'building_cons_1',     keyPrice: 0, unlockPriority: 0 },
  { row: 3, col: 4, state: CellState.OPEN, itemId: 'flower_daily_1',      keyPrice: 0, unlockPriority: 0 },
  { row: 3, col: 5, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 13 },
  { row: 3, col: 6, state: CellState.FOG,  itemId: 'drink_tea_2',         keyPrice: 0, unlockPriority: 29 },

  // ── 第4行 - 初始核心区 ──
  { row: 4, col: 0, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 30 },
  { row: 4, col: 1, state: CellState.PEEK, itemId: 'flower_daily_2',      keyPrice: 0, unlockPriority: 14 },
  { row: 4, col: 2, state: CellState.OPEN, itemId: 'building_perm_1',     keyPrice: 0, unlockPriority: 0 },
  { row: 4, col: 3, state: CellState.OPEN, itemId: 'flower_daily_1',      keyPrice: 0, unlockPriority: 0 },
  { row: 4, col: 4, state: CellState.OPEN, itemId: null,                  keyPrice: 0, unlockPriority: 0 },
  { row: 4, col: 5, state: CellState.PEEK, itemId: 'drink_tea_1',         keyPrice: 0, unlockPriority: 19 },
  { row: 4, col: 6, state: CellState.KEY,  itemId: null,                  keyPrice: 200, unlockPriority: 31 },

  // ── 第5行 - 第二圈 ──
  { row: 5, col: 0, state: CellState.KEY,  itemId: null,                  keyPrice: 300, unlockPriority: 32 },
  { row: 5, col: 1, state: CellState.FOG,  itemId: 'bmat_flower_build_2', keyPrice: 0, unlockPriority: 20 },
  { row: 5, col: 2, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 21 },
  { row: 5, col: 3, state: CellState.FOG,  itemId: 'flower_daily_1',      keyPrice: 0, unlockPriority: 22 },
  { row: 5, col: 4, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 23 },
  { row: 5, col: 5, state: CellState.FOG,  itemId: 'bmat_drink_build_2',  keyPrice: 0, unlockPriority: 24 },
  { row: 5, col: 6, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 33 },

  // ── 第6行 - 外围迷雾 ──
  { row: 6, col: 0, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 46 },
  { row: 6, col: 1, state: CellState.PEEK, itemId: 'flower_luxury_2',     keyPrice: 0, unlockPriority: 34 },
  { row: 6, col: 2, state: CellState.FOG,  itemId: 'building_cons_4',     keyPrice: 0, unlockPriority: 47 },
  { row: 6, col: 3, state: CellState.KEY,  itemId: null,                  keyPrice: 300, unlockPriority: 48 },
  { row: 6, col: 4, state: CellState.FOG,  itemId: 'drink_dessert_2',     keyPrice: 0, unlockPriority: 49 },
  { row: 6, col: 5, state: CellState.PEEK, itemId: 'flower_romantic_3',   keyPrice: 0, unlockPriority: 50 },
  { row: 6, col: 6, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 51 },

  // ── 第7行 - 外围迷雾 ──
  { row: 7, col: 0, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 52 },
  { row: 7, col: 1, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 53 },
  { row: 7, col: 2, state: CellState.FOG,  itemId: 'bmat_flower_build_3', keyPrice: 0, unlockPriority: 54 },
  { row: 7, col: 3, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 55 },
  { row: 7, col: 4, state: CellState.FOG,  itemId: 'bmat_drink_build_3',  keyPrice: 0, unlockPriority: 56 },
  { row: 7, col: 5, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 57 },
  { row: 7, col: 6, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 58 },

  // ── 第8行 - 最外围 ──
  { row: 8, col: 0, state: CellState.KEY,  itemId: null,                  keyPrice: 500, unlockPriority: 59 },
  { row: 8, col: 1, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 60 },
  { row: 8, col: 2, state: CellState.FOG,  itemId: 'flower_luxury_4',     keyPrice: 0, unlockPriority: 61 },
  { row: 8, col: 3, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 62 },
  { row: 8, col: 4, state: CellState.FOG,  itemId: 'drink_dessert_3',     keyPrice: 0, unlockPriority: 63 },
  { row: 8, col: 5, state: CellState.FOG,  itemId: null,                  keyPrice: 0, unlockPriority: 64 },
  { row: 8, col: 6, state: CellState.KEY,  itemId: null,                  keyPrice: 500, unlockPriority: 65 },
];
