import {
  BOARD_COLS,
  BOARD_BAR_HEIGHT,
  BOARD_ROWS,
  CELL_GAP,
  DESIGN_WIDTH,
  INFO_BAR_HEIGHT,
} from './LayoutPrimitives';

export interface ViewportMetricInput {
  width?: number;
  height?: number;
  pixelRatio?: number;
  statusBarHeight?: number;
  safeAreaTop?: number;
  safeAreaBottom?: number;
  capsuleTop?: number;
}

export interface ViewportMetrics {
  width: number;
  height: number;
  pixelRatio: number;
  safeTopPx: number;
  safeBottomPx: number;
}

export interface MainSceneLayout {
  topBarY: number;
  shopY: number;
  topReserved: number;
  middleGap: number;
  infoBarY: number;
  infoBarHeight: number;
  infoBarSafeBottom: number;
  board: ResponsiveBoardMetrics;
}

export interface ResponsiveBoardMetrics {
  cellSize: number;
  paddingX: number;
  topY: number;
  areaHeight: number;
}

/** 客人区到棋盘的刚性间距。 */
export const MAIN_BOARD_TOP_GAP = 70;
/** 标准长屏固定棋盘格；短屏/平板空间不足时才进入紧凑档。 */
export const MAIN_PREFERRED_CELL_SIZE = 102;
/** 上区与客人区之间至少保留的弹性带。 */
export const MAIN_MIN_MIDDLE_GAP = 12;
/** 长安全区设备压缩详情主体到 76px，安全区本身仍完整保留。 */
export const MAIN_INFO_CONTENT_HEIGHT = 76;
/** 4:3 平板仍需容纳完整 9 行。 */
export const MIN_RESPONSIVE_CELL_SIZE = 44;

/** 装修页房屋内部坐标以 390×844 长屏为母版，切换设备只平移整个房屋层。 */
export const SHOP_ROOM_CANONICAL_CENTER_Y =
  (844 / 390 * DESIGN_WIDTH) * 0.442;
const SHOP_REFERENCE_LOGIC_HEIGHT = 844 / 390 * DESIGN_WIDTH;
const SHOP_REFERENCE_SAFE_BOTTOM = (844 - 810) / 390 * DESIGN_WIDTH;
export const SHOP_ROOM_CENTER_FROM_SAFE_BOTTOM =
  SHOP_REFERENCE_LOGIC_HEIGHT - SHOP_REFERENCE_SAFE_BOTTOM - SHOP_ROOM_CANONICAL_CENTER_Y;
export const SHOP_ROOM_MIN_GAP_BELOW_HEADER = 310;
export const SHOP_BROWSE_BOTTOM_RESERVED = 260;

const finitePositive = (value: number | undefined, fallback: number): number =>
  Number.isFinite(value) && (value as number) > 0 ? (value as number) : fallback;

/**
 * 将窗口、胶囊、安全区数据归一到同一个逻辑像素坐标系。
 * 输入必须来自同一份 windowInfo；异常胶囊值会退回 safeArea/statusBar。
 */
export function normalizeViewportMetrics(
  input: ViewportMetricInput,
  fallbackWidth = 375,
  fallbackHeight = 667,
): ViewportMetrics {
  const width = finitePositive(input.width, fallbackWidth);
  const height = finitePositive(input.height, fallbackHeight);
  const pixelRatio = finitePositive(input.pixelRatio, 1);
  const maxSafeTop = Math.min(height * 0.2, 160);
  const capsuleTop = Number(input.capsuleTop);
  const safeAreaTop = Math.max(0, Number(input.safeAreaTop) || 0);
  const statusTop = Math.max(0, Number(input.statusBarHeight) || 0);
  const validCapsuleTop = Number.isFinite(capsuleTop)
    && capsuleTop > 0
    && capsuleTop <= maxSafeTop;
  const safeTopPx = validCapsuleTop
    ? capsuleTop
    : Math.min(maxSafeTop, safeAreaTop || (statusTop > 0 ? statusTop + 6 : 40));
  const safeAreaBottom = Number(input.safeAreaBottom);
  const safeBottomPx = Number.isFinite(safeAreaBottom)
    ? Math.max(0, Math.min(height * 0.2, height - safeAreaBottom))
    : 0;

  return { width, height, pixelRatio, safeTopPx, safeBottomPx };
}

export function computeMainSceneLayout(
  logicHeight: number,
  safeTop: number,
  safeBottom: number,
  topBarHeight: number,
  shopHeight: number,
  gap = 4,
): MainSceneLayout {
  const topBarY = Math.max(0, safeTop);
  const topClusterBottom = topBarY + topBarHeight + gap;
  const infoBarSafeBottom = Math.max(24, safeBottom);
  const infoBarHeight = Math.max(
    INFO_BAR_HEIGHT,
    MAIN_INFO_CONTENT_HEIGHT + infoBarSafeBottom,
  );
  const infoBarY = Math.round(logicHeight - infoBarHeight);
  const maxCellByWidth = Math.floor(
    (DESIGN_WIDTH - (BOARD_COLS - 1) * CELL_GAP) / BOARD_COLS,
  );
  const maxGridHeight =
    infoBarY - BOARD_BAR_HEIGHT - MAIN_BOARD_TOP_GAP
    - shopHeight - topClusterBottom - MAIN_MIN_MIDDLE_GAP;
  const maxCellByHeight = Math.floor(
    (maxGridHeight - (BOARD_ROWS - 1) * CELL_GAP) / BOARD_ROWS,
  );
  const cellSize = Math.max(
    MIN_RESPONSIVE_CELL_SIZE,
    Math.min(MAIN_PREFERRED_CELL_SIZE, maxCellByWidth, maxCellByHeight),
  );
  const gridWidth = cellSize * BOARD_COLS + CELL_GAP * (BOARD_COLS - 1);
  const areaHeight = cellSize * BOARD_ROWS + CELL_GAP * (BOARD_ROWS - 1);
  const boardTopY = infoBarY - BOARD_BAR_HEIGHT - areaHeight;
  const shopY = boardTopY - MAIN_BOARD_TOP_GAP - shopHeight;
  return {
    topBarY,
    shopY,
    topReserved: shopY + shopHeight,
    middleGap: shopY - topClusterBottom,
    infoBarY,
    infoBarHeight,
    infoBarSafeBottom,
    board: {
      cellSize,
      paddingX: Math.floor((DESIGN_WIDTH - gridWidth) / 2),
      topY: boardTopY,
      areaHeight,
    },
  };
}

/**
 * 兼容旧调用：仅用于 V2 关闭时的独立棋盘计算。
 * V2 应直接消费 computeMainSceneLayout() 返回的 board。
 */
export function calculateResponsiveBoardMetrics(
  logicHeight: number,
  topReserved: number,
  boardTopGap = MAIN_BOARD_TOP_GAP,
): ResponsiveBoardMetrics {
  const bottomMargin = 8;
  const topY = Math.round(topReserved + boardTopGap);
  const maxCellByWidth = Math.floor(
    (DESIGN_WIDTH - (BOARD_COLS - 1) * CELL_GAP) / BOARD_COLS,
  );
  const availableHeight =
    logicHeight - topY - BOARD_BAR_HEIGHT - INFO_BAR_HEIGHT - bottomMargin;
  const maxCellByHeight = Math.floor(
    (availableHeight - (BOARD_ROWS - 1) * CELL_GAP) / BOARD_ROWS,
  );
  const cellSize = Math.max(
    MIN_RESPONSIVE_CELL_SIZE,
    Math.min(maxCellByWidth, maxCellByHeight),
  );
  const gridWidth = cellSize * BOARD_COLS + CELL_GAP * (BOARD_COLS - 1);
  const areaHeight = cellSize * BOARD_ROWS + CELL_GAP * (BOARD_ROWS - 1);

  return {
    cellSize,
    paddingX: Math.floor((DESIGN_WIDTH - gridWidth) / 2),
    topY,
    areaHeight,
  };
}

/** 装修页顶部区结束位置；房屋在标准设备上相对底部固定，紧凑屏只做防顶栏兜底。 */
export function computeShopRoomCenterY(
  logicHeight: number,
  safeTop: number,
  safeBottom: number,
  topBarHeight: number,
  progressBarHeight: number,
): number {
  const headerBottom = safeTop + topBarHeight + 16 + progressBarHeight;
  const bottomAnchored = logicHeight - safeBottom - SHOP_ROOM_CENTER_FROM_SAFE_BOTTOM;
  return Math.max(headerBottom + SHOP_ROOM_MIN_GAP_BELOW_HEADER, bottomAnchored);
}

/** 浏览态可摆放下沿与底部操作区保持固定距离。 */
export function computeShopBrowseMaxY(logicHeight: number, safeBottom: number): number {
  return Math.round(logicHeight - safeBottom - SHOP_BROWSE_BOTTOM_RESERVED);
}
