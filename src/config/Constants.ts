import { getSystemInfo } from '../utils/platform';

// ============================================================
// 动态分辨率：宽度固定750，高度按屏幕真实比例自适应
// 这样 canvas 内容比例 === 屏幕比例，永远不会变形
// ============================================================
export const GAME_WIDTH = 750;

// 计算游戏高度
function calcGameHeight(): number {
  const info = getSystemInfo();
  const screenRatio = info.height / info.width; // 竖屏宽高比
  // 750 / h = screenWidth / screenHeight → h = 750 * screenRatio
  const h = Math.round(GAME_WIDTH * screenRatio);
  console.log(`[Constants] 屏幕: ${info.width}x${info.height} dpr=${info.pixelRatio} → 游戏分辨率: ${GAME_WIDTH}x${h}`);
  return h;
}

export const GAME_HEIGHT = calcGameHeight();

// ============================================================
// 区域布局（基于动态高度，按比例分配）
// ============================================================
// 顶部栏固定 80px
// 花店区域（客人区）固定 400px
// 底部导航栏固定 100px
// 棋盘区域 = 剩余空间
const TOP_BAR_H = 80;
const SHOP_AREA_H = 400;
const NAV_BAR_H = 100;

export const LAYOUT = {
  TOP_BAR_HEIGHT: TOP_BAR_H,
  SHOP_AREA_Y: TOP_BAR_H,
  SHOP_AREA_HEIGHT: SHOP_AREA_H,
  BOARD_AREA_Y: TOP_BAR_H + SHOP_AREA_H,
  BOARD_AREA_HEIGHT: GAME_HEIGHT - TOP_BAR_H - SHOP_AREA_H - NAV_BAR_H,
  NAV_BAR_Y: GAME_HEIGHT - NAV_BAR_H,
  NAV_BAR_HEIGHT: NAV_BAR_H,
};

// 棋盘 — 根据可用空间动态计算格子大小
const BOARD_ROWS = 8;
const BOARD_COLS = 7;
const BOARD_PADDING = 4;
const boardAvailW = GAME_WIDTH - 16;   // 左右各留8px
const boardAvailH = LAYOUT.BOARD_AREA_HEIGHT - 12; // 上下各留6px
// 格子必须是正方形，取宽/高中较小的值
const cellFromW = Math.floor((boardAvailW - (BOARD_COLS - 1) * BOARD_PADDING) / BOARD_COLS);
const cellFromH = Math.floor((boardAvailH - (BOARD_ROWS - 1) * BOARD_PADDING) / BOARD_ROWS);
const CELL_SIZE = Math.min(cellFromW, cellFromH);

export const BOARD = {
  INIT_ROWS: BOARD_ROWS,
  INIT_COLS: BOARD_COLS,
  MAX_ROWS: 9,
  MAX_COLS: 8,
  CELL_SIZE: CELL_SIZE,
  CELL_PADDING: BOARD_PADDING,
  BOARD_OFFSET_X: GAME_WIDTH / 2,
  BOARD_OFFSET_Y: 520,
};

// 商品品类
export enum ItemCategory {
  FLOWER = 'flower',  // 花束
  DRINK = 'drink',    // 花饮
}

// 花系（花束品类下的子分类）
export enum FlowerFamily {
  DAILY = 'daily',
  ROMANTIC = 'romantic',
  LUXURY = 'luxury',
}

// 饮品线（花饮品类下的子分类）
export enum DrinkLine {
  TEA = 'tea',        // 茶饮线
  COLD = 'cold',      // 冷饮线
  DESSERT = 'dessert', // 甜品线
}

// 客人
export const CUSTOMER = {
  MAX_ACTIVE: 2,
  REFRESH_MIN: 8000,
  REFRESH_MAX: 15000,
  WAIT_TIMEOUT: 60000,
};

// 挂机
export const IDLE = {
  PRODUCE_INTERVAL: 60000,
  MAX_OFFLINE_MS: 4 * 60 * 60 * 1000,
};

// 存档
export const SAVE_KEY = 'huahua_save';
export const AUTO_SAVE_INTERVAL = 30000;

// 颜色
export const COLORS = {
  BG: 0xFFF8F0,
  BOARD_BG: 0xF5E6D3,
  CELL_BG: 0xFFF5E8,
  CELL_BORDER: 0xE8D5C0,
  CELL_LOCKED: 0xD0D0D0,
  GOLD: 0xFFD700,
  WISH: 0xC89EFF,
  DEW: 0x7EC8E3,
  DAILY_GLOW: 0xE8E060,
  ROMANTIC_GLOW: 0xFF9ECC,
  LUXURY_GLOW: 0xC0A868,
  TEXT_PRIMARY: 0x5A4A3A,
  TEXT_SECONDARY: 0x8A7A6A,
  WHITE: 0xFFFFFF,
  RED_DOT: 0xFF4444,
  GREEN: 0x66CC66,
};

// 花系对应颜色
export const FAMILY_COLORS: Record<string, number> = {
  [FlowerFamily.DAILY]: 0x8BC34A,
  [FlowerFamily.ROMANTIC]: 0xE91E90,
  [FlowerFamily.LUXURY]: 0x3F51B5,
};

// 花系对应中文名
export const FAMILY_NAMES: Record<string, string> = {
  [FlowerFamily.DAILY]: '日常',
  [FlowerFamily.ROMANTIC]: '浪漫',
  [FlowerFamily.LUXURY]: '奢华',
};

// 饮品线对应颜色
export const DRINK_COLORS: Record<string, number> = {
  [DrinkLine.TEA]: 0xA67B5B,
  [DrinkLine.COLD]: 0x4FC3F7,
  [DrinkLine.DESSERT]: 0xFF8A65,
};

// 饮品线对应中文名
export const DRINK_NAMES: Record<string, string> = {
  [DrinkLine.TEA]: '茶饮',
  [DrinkLine.COLD]: '冷饮',
  [DrinkLine.DESSERT]: '甜品',
};

// 所有产出线（花系+饮品线）合并的颜色和名称映射
export const LINE_COLORS: Record<string, number> = {
  ...FAMILY_COLORS,
  ...DRINK_COLORS,
};

export const LINE_NAMES: Record<string, string> = {
  ...FAMILY_NAMES,
  ...DRINK_NAMES,
};
