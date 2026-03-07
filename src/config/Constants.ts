/**
 * 全局常量
 */

// 设计分辨率
export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1334;

// 棋盘
export const BOARD_COLS = 6;
export const BOARD_ROWS = 5;
export const BOARD_TOTAL = BOARD_COLS * BOARD_ROWS; // 30
export const CELL_SIZE = 100;
export const CELL_GAP = 8;
export const BOARD_PADDING_X = (DESIGN_WIDTH - (CELL_SIZE + CELL_GAP) * BOARD_COLS + CELL_GAP) / 2;
export const BOARD_TOP_Y = 500; // 棋盘顶部Y坐标（设计坐标）

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
