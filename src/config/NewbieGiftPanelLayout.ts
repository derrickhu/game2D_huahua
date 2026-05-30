/**
 * 清涟荷影新手礼包宣传页布局（相对母图 640×1005 归一化坐标）
 */
export const NEWBIE_GIFT_PANEL_LAYOUT = {
  maxWidthPad: 16,
  maxHeightRatio: 0.92,

  closeNx: 0.8925,
  closeNy: 0.0824,
  closeR: 26,

  ctaCenterNx: 0.4954,
  ctaCenterNy: 0.8988,
  ctaNw: 0.6683,
  ctaNh: 0.1327,
  ctaLabelDyRatio: -0.06,
  ctaLabelFontSize: 38,

  contentLeftNx: 0.10,
  contentRightNx: 0.90,

  /** 上区：限定家具（7 件，4+3） */
  decoTitleNy: 0.278,
  decoGridTopNy: 0.305,
  decoGridBottomNy: 0.575,
  decoCols: 4,
  decoIconFillRatio: 0.84,

  /** 下区：高级物品（3 件横排，整体上移） */
  boardTitleNy: 0.618,
  boardGridTopNy: 0.642,
  boardGridBottomNy: 0.792,
  boardCols: 3,
  boardIconFillRatio: 0.48,

  /** 按钮上方规则说明（须在按钮顶缘之上，避免与橙钮重叠） */
  ctaRuleNy: 0.808,

  /** 母图标题区（叠字盖住 AI 内嵌字，真机更清晰） */
  mainTitleNy: 0.132,
  ribbonTitleNy: 0.208,
  mainTitleFontSize: 36,
  ribbonTitleFontSize: 30,

  sectionTitleFontSize: 26,
  decoLabelFontSize: 20,
  boardLabelFontSize: 20,
  boardAmountFontSize: 32,
  /** 数量角标相对图标右缘的水平偏移（越小越靠左） */
  boardAmountOffsetXRatio: 0.28,
  ctaRuleFontSize: 28,
  ctaRuleHighlightFontSize: 30,
} as const;

export interface NormalizedPoint {
  nx: number;
  ny: number;
}

/** 在矩形区内按行列均匀排布中心点；末行不足列数时居中 */
export function gridCentersInNormRect(
  leftNx: number,
  rightNx: number,
  topNy: number,
  bottomNy: number,
  cols: number,
  count: number,
): NormalizedPoint[] {
  if (count <= 0 || cols <= 0) return [];
  const rows = Math.ceil(count / cols);
  const out: NormalizedPoint[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const colInRow = i % cols;
    const itemsInRow = row === rows - 1 ? count - row * cols : cols;
    const rowWidth = (rightNx - leftNx) / cols;
    const rowStartNx = leftNx + (cols - itemsInRow) * rowWidth * 0.5;
    out.push({
      nx: rowStartNx + (colInRow + 0.5) * rowWidth,
      ny: topNy + ((row + 0.5) / rows) * (bottomNy - topNy),
    });
  }
  return out;
}

export function cellWidthInNorm(panelW: number, leftNx: number, rightNx: number, cols: number): number {
  return ((rightNx - leftNx) / cols) * panelW;
}
