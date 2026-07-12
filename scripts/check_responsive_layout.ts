import assert from 'node:assert/strict';
import {
  MAIN_BOARD_TOP_GAP,
  MAIN_MIN_MIDDLE_GAP,
  MAIN_PREFERRED_CELL_SIZE,
  SHOP_ROOM_CANONICAL_CENTER_Y,
  computeShopBrowseMaxY,
  computeShopRoomCenterY,
  computeMainSceneLayout,
  normalizeViewportMetrics,
} from '../src/config/ResponsiveLayout';

const TOP_BAR_HEIGHT = 76;
const SHOP_HEIGHT = 250;
const DESIGN_WIDTH = 750;
const BOARD_BAR_HEIGHT = 22;

const cases = [
  { name: 'iPhone 8', width: 375, height: 667, capsuleTop: 20, safeBottom: 667 },
  { name: 'iPhone 13', width: 390, height: 844, capsuleTop: 47, safeBottom: 810 },
  { name: 'iPhone Plus', width: 414, height: 896, capsuleTop: 47, safeBottom: 862 },
  { name: 'iPad portrait', width: 768, height: 1024, capsuleTop: 24, safeBottom: 1004 },
  { name: 'PC portrait window', width: 900, height: 1400, capsuleTop: 20, safeBottom: 1400 },
];

for (const c of cases) {
  const viewport = normalizeViewportMetrics({
    width: c.width,
    height: c.height,
    pixelRatio: 2,
    capsuleTop: c.capsuleTop,
    safeAreaBottom: c.safeBottom,
  });
  const safeTop = Math.round(viewport.safeTopPx * DESIGN_WIDTH / viewport.width);
  const safeBottom = Math.round(viewport.safeBottomPx * DESIGN_WIDTH / viewport.width);
  const logicHeight = viewport.height / viewport.width * DESIGN_WIDTH;
  const main = computeMainSceneLayout(
    logicHeight,
    safeTop,
    safeBottom,
    TOP_BAR_HEIGHT,
    SHOP_HEIGHT,
  );
  const board = main.board;

  assert.equal(
    main.shopY - main.topBarY,
    TOP_BAR_HEIGHT + 4 + main.middleGap,
    `${c.name}: 中间弹性带只位于顶栏与客人区之间`,
  );
  assert.equal(board.topY - main.topReserved, MAIN_BOARD_TOP_GAP, `${c.name}: 客人/棋盘间距`);
  assert.ok(
    main.middleGap >= MAIN_MIN_MIDDLE_GAP - 1,
    `${c.name}: 额外高度必须位于上下固定区之间`,
  );
  assert.ok(board.cellSize > 0 && board.cellSize <= MAIN_PREFERRED_CELL_SIZE, `${c.name}: 棋盘尺寸有效`);
  assert.equal(
    board.topY + board.areaHeight + BOARD_BAR_HEIGHT,
    main.infoBarY,
    `${c.name}: 棋盘、装饰条与详情栏连续`,
  );
  assert.equal(main.infoBarY + main.infoBarHeight, Math.round(logicHeight), `${c.name}: 详情栏贴底`);
  assert.ok(main.infoBarSafeBottom >= safeBottom, `${c.name}: 详情栏完整避让底部安全区`);
  assert.ok(viewport.safeTopPx >= 0 && viewport.safeBottomPx >= 0, `${c.name}: 安全区有效`);

  const roomCenterY = computeShopRoomCenterY(
    logicHeight,
    safeTop,
    safeBottom,
    TOP_BAR_HEIGHT,
    28,
  );
  const browseMaxY = computeShopBrowseMaxY(logicHeight, safeBottom);
  assert.ok(roomCenterY > safeTop + TOP_BAR_HEIGHT, `${c.name}: 房屋不得侵入顶部固定区`);
  assert.ok(browseMaxY < logicHeight - safeBottom, `${c.name}: 房屋操作区须避开底部控件`);
}

const invalidCapsule = normalizeViewportMetrics({
  width: 390,
  height: 844,
  statusBarHeight: 44,
  capsuleTop: 999,
});
assert.equal(invalidCapsule.safeTopPx, 50, '异常胶囊坐标应回退 statusBarHeight + 6');

// 视觉基准：390×844 模拟器上，详情栏缩短、棋盘整体下移，
// 从而把多出的高度还给顶部图标与客人之间的弹性带。
const baselineSafeTop = Math.round(47 * DESIGN_WIDTH / 390);
const baselineSafeBottom = Math.round(34 * DESIGN_WIDTH / 390);
const baselineLogicH = 844 / 390 * DESIGN_WIDTH;
const baselineMain = computeMainSceneLayout(
  baselineLogicH,
  baselineSafeTop,
  baselineSafeBottom,
  TOP_BAR_HEIGHT,
  SHOP_HEIGHT,
);
const baselineBoard = baselineMain.board;
assert.equal(baselineBoard.cellSize, MAIN_PREFERRED_CELL_SIZE, '模拟器使用标准棋盘格');
assert.ok(baselineBoard.topY > 491, '模拟器棋盘应较问题版本下移');
assert.ok(baselineMain.infoBarHeight < 149, '模拟器详情栏应较问题版本缩短');
assert.ok(
  baselineMain.middleGap >= 30,
  '模拟器顶部图标与客人之间应恢复明显弹性间距',
);
assert.ok(
  Math.abs(
    computeShopRoomCenterY(
      baselineLogicH,
      baselineSafeTop,
      baselineSafeBottom,
      TOP_BAR_HEIGHT,
      28,
    ) - SHOP_ROOM_CANONICAL_CENTER_Y
  ) <= 1,
  '模拟器装修房屋应保持母版位置',
);

console.log(`responsive layout checks passed (${cases.length} viewport cases)`);
