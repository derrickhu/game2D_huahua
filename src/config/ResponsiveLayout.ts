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
}

export interface ResponsiveBoardMetrics {
  cellSize: number;
  paddingX: number;
  topY: number;
  areaHeight: number;
}

/**
 * 模拟器基准：旧版在 390×844 一类长屏上的实际间距约 70。
 * 固定后既保留客人订单盘完整露出，也不再随更长屏幕继续增大。
 */
export const MAIN_BOARD_TOP_GAP = 70;
/** 4:3 平板仍需容纳完整 9 行；手机上通常会由宽/高约束得到 80px 以上。 */
export const MIN_RESPONSIVE_CELL_SIZE = 44;

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
  safeTop: number,
  topBarHeight: number,
  shopHeight: number,
  gap = 4,
): MainSceneLayout {
  const topBarY = Math.max(0, safeTop);
  const shopY = topBarY + topBarHeight + gap;
  return {
    topBarY,
    shopY,
    topReserved: shopY + shopHeight,
  };
}

/**
 * 棋盘以前固定的顶部间距为准。不同长宽比的额外高度留在棋盘下方，
 * 防止客人区在长屏设备上被拉散。
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
