/**
 * 全局常量
 */

// 设计分辨率
export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1334;

// 棋盘
export const BOARD_COLS = 6;
export const BOARD_ROWS = 9;
export const BOARD_TOTAL = BOARD_COLS * BOARD_ROWS;
export const CELL_GAP = 6;

/**
 * 棋盘动态布局参数（用对象包裹防止 Terser 常量内联）
 * 在 computeBoardMetrics() 之后通过属性访问获取最新值
 */
export const BoardMetrics = {
  cellSize: 108,
  paddingX: 0,
  topY: 380,
};

// 兼容旧引用的 getter
export function getCellSize(): number { return BoardMetrics.cellSize; }

/** 根据实际屏幕尺寸重新计算棋盘布局参数，需在 Game.init 之后调用 */
export function computeBoardMetrics(logicHeight: number): void {
  const shopBottom = 350;  // 顶栏90 + 店铺区260
  const navHeight = 90;
  const topMargin = 10;
  const bottomMargin = 10;

  const boardTop = shopBottom + topMargin;
  const availableHeight = logicHeight - boardTop - navHeight - bottomMargin;

  // 宽度优先：保证 6 列铺满宽度；高度仅做上限保护
  const maxCellByWidth = Math.floor((DESIGN_WIDTH - (BOARD_COLS - 1) * CELL_GAP) / BOARD_COLS);
  const maxCellByHeight = Math.floor((availableHeight - (BOARD_ROWS - 1) * CELL_GAP) / BOARD_ROWS);

  BoardMetrics.cellSize = Math.max(72, Math.min(maxCellByWidth, maxCellByHeight));
  BoardMetrics.paddingX = Math.floor((DESIGN_WIDTH - (BoardMetrics.cellSize * BOARD_COLS + CELL_GAP * (BOARD_COLS - 1))) / 2);

  const gridHeight = BoardMetrics.cellSize * BOARD_ROWS + CELL_GAP * (BOARD_ROWS - 1);
  BoardMetrics.areaHeight = gridHeight;
  // 贴近底部导航，优先消除下方空白
  BoardMetrics.topY = Math.floor(logicHeight - navHeight - bottomMargin - gridHeight);

  console.log(`[Board] 动态布局: cellSize=${BoardMetrics.cellSize}, topY=${BoardMetrics.topY}, area=${DESIGN_WIDTH}x${BoardMetrics.areaHeight}`);
}

// 客人
export const MAX_CUSTOMERS = 2;
export const CUSTOMER_REFRESH_MIN = 10; // 秒
export const CUSTOMER_REFRESH_MAX = 30;

// 体力
export const STAMINA_MAX = 100;
export const STAMINA_RECOVER_INTERVAL = 180; // 3分钟恢复1点

// 挂机
export const IDLE_PRODUCE_INTERVAL = 60; // 60秒产出一个1级物品
export const OFFLINE_MAX_HOURS = 4;

// 颜色主题
export const COLORS = {
  BG: 0xFFF5EE,
  CELL_OPEN: 0xFFF8F0,
  CELL_FOG: 0xC0C0C0,
  CELL_PEEK: 0xE8E0D8,
  CELL_KEY: 0xFFD700,
  CELL_BORDER: 0xD4C4B0,
  CELL_HIGHLIGHT: 0xFFE4B5,

  // 花系色标
  FLOWER_DAILY: 0xFFB347,    // 日常花系 - 暖橙
  FLOWER_ROMANTIC: 0xFF69B4, // 浪漫花系 - 粉红
  FLOWER_LUXURY: 0x9370DB,   // 奢华花系 - 紫色

  // 饮品线色标
  DRINK_TEA: 0x90EE90,       // 茶饮线 - 浅绿
  DRINK_COLD: 0x87CEEB,      // 冷饮线 - 天蓝
  DRINK_DESSERT: 0xFFB6C1,   // 甜品线 - 浅粉

  // UI
  GOLD: 0xFFD700,
  TEXT_DARK: 0x4A3728,
  TEXT_LIGHT: 0x8B7355,
  BUTTON_PRIMARY: 0xFF8C69,
  BUTTON_SECONDARY: 0xB0A090,
};

// 字体
export const FONT_FAMILY = 'sans-serif';
