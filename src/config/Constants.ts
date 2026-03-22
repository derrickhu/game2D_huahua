/**
 * 全局常量
 */

// 设计分辨率
export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1334;

// 棋盘
export const BOARD_COLS = 7;
export const BOARD_ROWS = 9;
export const BOARD_TOTAL = BOARD_COLS * BOARD_ROWS;
export const CELL_GAP = 4;

/**
 * 棋盘动态布局参数（用对象包裹防止 Terser 常量内联）
 * 在 computeBoardMetrics() 之后通过属性访问获取最新值
 */
export const BoardMetrics = {
  cellSize: 90,
  paddingX: 0,
  topY: 380,
  areaHeight: 90 * 9 + 4 * 8,  // 初始值，computeBoardMetrics 会覆盖
};

// 兼容旧引用的 getter
export function getCellSize(): number { return BoardMetrics.cellSize; }

/** 底部信息栏高度（与 ItemInfoBar 默认高度对齐，供棋盘布局预留） */
export const INFO_BAR_HEIGHT = 112;

/**
 * 根据实际屏幕尺寸重新计算棋盘布局参数，需在 Game.init 之后调用
 * @param logicHeight  设计坐标下的逻辑屏幕高度
 * @param topReserved  顶部已被占用的设计坐标高度（safeTop + TopBar + ShopArea + 间距）
 */
export function computeBoardMetrics(logicHeight: number, topReserved: number): void {
  const navHeight = INFO_BAR_HEIGHT;
  const bottomMargin = 8;
  const topMargin = 2;

  const maxCellByWidth = Math.floor((DESIGN_WIDTH - (BOARD_COLS - 1) * CELL_GAP) / BOARD_COLS);

  const availableHeight = logicHeight - topReserved - topMargin - navHeight - bottomMargin;
  const maxCellByHeight = Math.floor((availableHeight - (BOARD_ROWS - 1) * CELL_GAP) / BOARD_ROWS);

  BoardMetrics.cellSize = Math.max(72, Math.min(maxCellByWidth, maxCellByHeight));

  const gridWidth = BoardMetrics.cellSize * BOARD_COLS + CELL_GAP * (BOARD_COLS - 1);
  BoardMetrics.paddingX = Math.floor((DESIGN_WIDTH - gridWidth) / 2);

  const gridHeight = BoardMetrics.cellSize * BOARD_ROWS + CELL_GAP * (BOARD_ROWS - 1);
  BoardMetrics.areaHeight = gridHeight;

  // 棋盘下方剩余空间，将 1/3 分配到棋盘上方，2/3 留给底部按钮区
  const bottomSpace = logicHeight - (topReserved + topMargin) - gridHeight;
  const shiftDown = Math.round(bottomSpace / 3);
  BoardMetrics.topY = topReserved + topMargin + shiftDown;

  console.log(`[Board] 动态布局: cellSize=${BoardMetrics.cellSize}, topY=${BoardMetrics.topY}, topReserved=${topReserved}, paddingX=${BoardMetrics.paddingX}, area=${gridWidth}x${gridHeight}`);
}

// 客人
export const MAX_CUSTOMERS = 5;          // 最大排队客人数（含服务中）
export const MAX_VISIBLE_CUSTOMERS = 5;  // 滚动区可见客人数
/** 与可见区一致：前 N 位（滚动区里显示的）客人，需求与棋盘物品一致则锁定/显示满足；可交付也限此范围 */
export const ACTIVE_CUSTOMER_SLOTS = MAX_VISIBLE_CUSTOMERS;
export const CUSTOMER_REFRESH_MIN = 10;  // 秒
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
  /** 订单满足：叠在米白格底上的淡绿遮罩颜色 */
  CELL_ORDER_MATCH_OVERLAY: 0xA5D6A7,
  /** 淡绿遮罩透明度（越大越绿） */
  CELL_ORDER_MATCH_OVERLAY_ALPHA: 0.32,

  // 花系色标
  FLOWER_FRESH: 0xFFB347,    // 鲜花线 - 暖橙
  FLOWER_BOUQUET: 0xFF69B4,  // 花束线 - 粉红
  FLOWER_GREEN: 0x66BB6A,    // 绿植线 - 绿色

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
