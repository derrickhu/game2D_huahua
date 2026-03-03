// 游戏设计分辨率
export const GAME_WIDTH = 750;
export const GAME_HEIGHT = 1334;

// 区域布局（Y坐标划分）
export const LAYOUT = {
  TOP_BAR_HEIGHT: 80,
  SHOP_AREA_Y: 80,
  SHOP_AREA_HEIGHT: 400,
  BOARD_AREA_Y: 480,
  BOARD_AREA_HEIGHT: 670,
  NAV_BAR_Y: 1234,
  NAV_BAR_HEIGHT: 100,
};

// 棋盘
export const BOARD = {
  INIT_ROWS: 3,
  INIT_COLS: 4,
  MAX_ROWS: 5,
  MAX_COLS: 6,
  CELL_SIZE: 108,
  CELL_PADDING: 8,
  BOARD_OFFSET_X: 750 / 2,  // 棋盘居中X
  BOARD_OFFSET_Y: 520,       // 棋盘起始Y（相对于BOARD_AREA_Y有一些上边距）
};

// 花系
export enum FlowerFamily {
  DAILY = 'daily',
  ROMANTIC = 'romantic',
  LUXURY = 'luxury',
}

// 花朵最大等级
export const MAX_FLOWER_LEVEL = 6;

// 建筑
export const BUILDING = {
  WORKBENCH_CD: 15,     // 花艺操作台CD（秒）—— 阶段1用较短CD便于测试
  SEEDBOX_CD: 20,
  WRAPPER_CD: 25,
  GREENHOUSE_CD: 30,
};

// 客人
export const CUSTOMER = {
  MAX_ACTIVE: 2,
  REFRESH_MIN: 8000,     // 最短刷新间隔（ms）—— 阶段1用较短间隔
  REFRESH_MAX: 15000,
  WAIT_TIMEOUT: 60000,   // 等待超时（ms）
};

// 挂机
export const IDLE = {
  PRODUCE_INTERVAL: 60000,  // 挂机产出间隔（ms）
  MAX_OFFLINE_MS: 4 * 60 * 60 * 1000, // 最大离线收益时长4小时
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
  WISH: 0xC89EFF,    // 花愿（淡紫）
  DEW: 0x7EC8E3,     // 花露（淡蓝）
  DAILY_GLOW: 0xE8E060,    // 日常花系光晕
  ROMANTIC_GLOW: 0xFF9ECC,  // 浪漫花系光晕
  LUXURY_GLOW: 0xC0A868,   // 奢华花系光晕
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
