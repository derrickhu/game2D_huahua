import assert from 'node:assert/strict';
import {
  MAIN_BOARD_TOP_GAP,
  calculateResponsiveBoardMetrics,
  computeMainSceneLayout,
  normalizeViewportMetrics,
} from '../src/config/ResponsiveLayout';

const TOP_BAR_HEIGHT = 76;
const SHOP_HEIGHT = 250;
const DESIGN_WIDTH = 750;
const INFO_BAR_HEIGHT = 112;
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
  const logicHeight = viewport.height / viewport.width * DESIGN_WIDTH;
  const main = computeMainSceneLayout(safeTop, TOP_BAR_HEIGHT, SHOP_HEIGHT);
  const board = calculateResponsiveBoardMetrics(logicHeight, main.topReserved);

  assert.equal(main.shopY - main.topBarY, TOP_BAR_HEIGHT + 4, `${c.name}: 顶栏/客人间距`);
  assert.equal(board.topY - main.topReserved, MAIN_BOARD_TOP_GAP, `${c.name}: 客人/棋盘间距`);
  assert.ok(board.cellSize > 0 && board.paddingX >= 0, `${c.name}: 棋盘尺寸有效`);
  assert.ok(
    board.topY + board.areaHeight + BOARD_BAR_HEIGHT + INFO_BAR_HEIGHT <= logicHeight,
    `${c.name}: 棋盘和底栏不得越界`,
  );
  assert.ok(viewport.safeTopPx >= 0 && viewport.safeBottomPx >= 0, `${c.name}: 安全区有效`);
}

const invalidCapsule = normalizeViewportMetrics({
  width: 390,
  height: 844,
  statusBarHeight: 44,
  capsuleTop: 999,
});
assert.equal(invalidCapsule.safeTopPx, 50, '异常胶囊坐标应回退 statusBarHeight + 6');

// 视觉基准：390×844 模拟器改版前棋盘 topY≈491、说明栏 topY≈1474。
// 新版修正 TopBar 60→76 后用固定 70px 间距抵消，二者应保持在 1px 内。
const baselineSafeTop = Math.round(47 * DESIGN_WIDTH / 390);
const baselineLogicH = 844 / 390 * DESIGN_WIDTH;
const baselineMain = computeMainSceneLayout(
  baselineSafeTop,
  TOP_BAR_HEIGHT,
  SHOP_HEIGHT,
);
const baselineBoard = calculateResponsiveBoardMetrics(
  baselineLogicH,
  baselineMain.topReserved,
);
assert.ok(Math.abs(baselineBoard.topY - 491) <= 1, '模拟器棋盘顶边应保持改版前位置');
assert.ok(
  Math.abs(
    baselineBoard.topY + baselineBoard.areaHeight + BOARD_BAR_HEIGHT - 1474,
  ) <= 1,
  '模拟器说明栏顶边应保持改版前位置',
);

console.log(`responsive layout checks passed (${cases.length} viewport cases)`);
