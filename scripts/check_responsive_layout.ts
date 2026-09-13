import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAIN_BOARD_TOP_GAP,
  MAIN_MIN_MIDDLE_GAP,
  MAIN_PREFERRED_CELL_SIZE,
  MAIN_TOP_BAR_LIFT,
  MIN_CONTENT_HEIGHT,
  SHOP_ROOM_CANONICAL_CENTER_Y,
  computeViewportLayout,
  computeShopBrowseMaxY,
  computeShopRoomCenterY,
  computeMainSceneLayout,
  normalizeViewportMetrics,
  pickHuaweiViewportInput,
  resolveHuaweiLogicalSize,
} from '../src/config/ResponsiveLayout';

const TOP_BAR_HEIGHT = 76;
const SHOP_HEIGHT = 250;
const DESIGN_WIDTH = 750;
const BOARD_BAR_HEIGHT = 22;

const cases = [
  { name: 'iPhone 8', width: 375, height: 667, capsuleTop: 20, safeBottom: 667, mode: 'width-fit' },
  { name: 'iPhone 13', width: 390, height: 844, capsuleTop: 47, safeBottom: 810, mode: 'width-fit' },
  { name: 'iPhone Plus', width: 414, height: 896, capsuleTop: 47, safeBottom: 862, mode: 'width-fit' },
  { name: 'iPad portrait', width: 768, height: 1024, capsuleTop: 24, safeBottom: 1004, mode: 'height-fit' },
  { name: 'iPad Air portrait', width: 834, height: 1194, capsuleTop: 24, safeBottom: 1174, mode: 'height-fit' },
  { name: 'iPad Pro portrait', width: 1024, height: 1366, capsuleTop: 24, safeBottom: 1346, mode: 'height-fit' },
  { name: 'iPad split view', width: 507, height: 1024, capsuleTop: 24, safeBottom: 1004, mode: 'width-fit' },
  { name: 'PC portrait window', width: 900, height: 1400, capsuleTop: 20, safeBottom: 1400, mode: 'height-fit' },
] as const;

let iphone8CellSize = 0;
for (const c of cases) {
  const viewport = normalizeViewportMetrics({
    width: c.width,
    height: c.height,
    pixelRatio: 2,
    capsuleTop: c.capsuleTop,
    safeAreaBottom: c.safeBottom,
  });
  const viewportLayout = computeViewportLayout(viewport);
  const safeTop = Math.round(viewportLayout.safeTop);
  const safeBottom = Math.round(viewportLayout.safeBottom);
  const logicHeight = viewportLayout.visibleHeight;
  assert.equal(viewportLayout.mode, c.mode, `${c.name}: 缩放模式`);
  assert.ok(logicHeight >= MIN_CONTENT_HEIGHT - 1, `${c.name}: 核心高度不得小于设计稿`);
  if (viewportLayout.mode === 'height-fit') {
    assert.ok(viewportLayout.contentOffsetX > 0, `${c.name}: Pad 核心框应水平居中`);
    assert.ok(Math.abs(logicHeight - MIN_CONTENT_HEIGHT) <= 1, `${c.name}: Pad 核心高度固定`);
  }
  const main = computeMainSceneLayout(
    logicHeight,
    safeTop,
    safeBottom,
    TOP_BAR_HEIGHT,
    SHOP_HEIGHT,
  );
  const board = main.board;
  if (c.name === 'iPhone 8') iphone8CellSize = board.cellSize;
  if (viewportLayout.mode === 'height-fit') {
    assert.ok(board.cellSize >= iphone8CellSize, `${c.name}: Pad 棋盘不得小于短屏手机基准`);
  }

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

  const designPoint = { x: 375, y: logicHeight / 2 };
  const clientPoint = {
    x: designPoint.x * viewportLayout.contentScale + viewportLayout.contentOffsetX,
    y: designPoint.y * viewportLayout.contentScale + viewportLayout.contentOffsetY,
  };
  const roundTrip = {
    x: (clientPoint.x - viewportLayout.contentOffsetX) / viewportLayout.contentScale,
    y: (clientPoint.y - viewportLayout.contentOffsetY) / viewportLayout.contentScale,
  };
  assert.ok(Math.abs(roundTrip.x - designPoint.x) < 0.001, `${c.name}: X 坐标往返`);
  assert.ok(Math.abs(roundTrip.y - designPoint.y) < 0.001, `${c.name}: Y 坐标往返`);
}

const huaweiTrapSys = {
  windowWidth: 360,
  windowHeight: 640,
  screenWidth: 425.1,
  screenHeight: 945.9,
  pixelRatio: 2.55,
};
const huaweiPicked = pickHuaweiViewportInput(huaweiTrapSys);
assert.equal(huaweiPicked.width, 425.1, '华为必须忽略 windowWidth');
assert.equal(huaweiPicked.height, 945.9, '华为必须忽略 windowHeight');
const huaweiViewport = normalizeViewportMetrics(huaweiPicked);
const huaweiLayout = computeViewportLayout(huaweiViewport, true);
assert.equal(huaweiLayout.mode, 'width-fit', '华为手机应按宽度铺满，不能被预览窗触发 height-fit');
assert.equal(huaweiLayout.contentOffsetX, 0, '华为手机不得被预览窗尺寸水平 letterbox');

const huaweiPhysical = resolveHuaweiLogicalSize({
  screenWidth: 1084,
  screenHeight: 2412,
  pixelRatio: 2.55,
});
assert.ok(Math.abs(huaweiPhysical.width - 1084 / 2.55) < 0.01, '华为物理 screenWidth 应收成逻辑宽');
assert.ok(Math.abs(huaweiPhysical.height - 2412 / 2.55) < 0.01, '华为物理 screenHeight 应收成逻辑高');
const huaweiPhysicalPicked = pickHuaweiViewportInput({
  windowWidth: 360,
  windowHeight: 640,
  screenWidth: 1084,
  screenHeight: 2412,
  pixelRatio: 2.55,
});
assert.ok(huaweiPhysicalPicked.width! < 500, '华为物理像素不得当逻辑宽用');
const huaweiPhysicalLayout = computeViewportLayout(normalizeViewportMetrics(huaweiPhysicalPicked), true);
assert.equal(huaweiPhysicalLayout.mode, 'width-fit', '华为物理像素收成逻辑后仍按宽度铺满');
assert.equal(huaweiPhysicalLayout.contentOffsetX, 0, '华为物理像素收成逻辑后不得水平 letterbox');

const huaweiCssLogical = resolveHuaweiLogicalSize({
  screenWidth: 1084,
  screenHeight: 2412,
  pixelRatio: 2.55,
  cssWidth: 425.1,
  cssHeight: 945.9,
});
assert.equal(huaweiCssLogical.width, 425.1, '已有 CSS 逻辑矩形时优先用 CSS');

const huaweiCssPhysical = resolveHuaweiLogicalSize({
  screenWidth: 425.1,
  screenHeight: 945.9,
  pixelRatio: 2.55,
  canvasWidth: 1084,
  canvasHeight: 2412,
  cssWidth: 1084,
  cssHeight: 2412,
});
assert.ok(Math.abs(huaweiCssPhysical.width - 1084 / 2.55) < 0.01, 'CSS 矩形等于物理缓冲时应再除 dpr');

const huaweiPadLogical = resolveHuaweiLogicalSize({
  screenWidth: 768,
  screenHeight: 1024,
  pixelRatio: 2,
});
assert.equal(huaweiPadLogical.width, 768, 'Pad 逻辑宽不得被当成物理像素除掉');

const invalidCapsule = normalizeViewportMetrics({
  width: 390,
  height: 844,
  statusBarHeight: 44,
  capsuleTop: 999,
});
assert.equal(invalidCapsule.safeTopPx, 50, '异常胶囊坐标应回退 statusBarHeight + 6');

// 视觉基准：390×844 模拟器上棋盘优先保持标准尺寸，详情栏按剩余空间动态收缩。
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
assert.equal(baselineBoard.cellSize, MAIN_PREFERRED_CELL_SIZE, '模拟器必须使用标准棋盘格');
assert.ok(baselineBoard.paddingX <= 2, '模拟器棋盘须横向铺满，不得保留明显侧边空隙');
assert.equal(
  baselineMain.topBarY,
  Math.max(0, baselineSafeTop - MAIN_TOP_BAR_LIFT),
  '模拟器顶栏应按约定幅度适度上提',
);
assert.ok(
  baselineMain.infoBarHeight >= 130,
  '模拟器详情栏压缩后仍须保留可读说明卡高度',
);
assert.ok(
  baselineMain.middleGap >= MAIN_MIN_MIDDLE_GAP,
  '模拟器顶部图标与客人之间应保留最小操作间距',
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

const sourceRoot = join(process.cwd(), 'src');
const pendingDirs = [sourceRoot];
const tsFiles: string[] = [];
while (pendingDirs.length > 0) {
  const dir = pendingDirs.pop()!;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) pendingDirs.push(path);
    else if (entry.isFile() && entry.name.endsWith('.ts')) tsFiles.push(path);
  }
}
const forbiddenCoordinateMath = [
  /Game\.designHeight\s*\/\s*Game\.screenHeight/,
  /Game\.designWidth\s*\/\s*Game\.screenWidth/,
  /clientX\s*\*\s*Game\.designWidth/,
  /clientY\s*\*\s*Game\.coordinateHeight/,
];
for (const file of tsFiles) {
  const source = readFileSync(file, 'utf8');
  for (const pattern of forbiddenCoordinateMath) {
    assert.equal(
      pattern.test(source),
      false,
      `${file}: 原生/全局事件坐标必须使用 Game.clientToDesign/globalToDesign`,
    );
  }
}

console.log(`responsive layout checks passed (${cases.length} viewport cases)`);
