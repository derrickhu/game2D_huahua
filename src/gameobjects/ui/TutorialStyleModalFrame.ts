/**
 * 新手引导 / ConfirmDialog 同款绘制壳体：粉紫外框 + 奶油内底 + 蜜黄标题条。
 * 用于装修「获得新家具」等，勿与礼包预览 `FlowerEggModalFrame` 混用。
 */
import * as PIXI from 'pixi.js';
import { FONT_FAMILY } from '@/config/Constants';

const BUBBLE_R = 26;
const INNER_PAD = 28;
const TITLE_H = 46;
const TITLE_PAD_X = 22;

export interface CreateTutorialStyleModalFrameOptions {
  viewW: number;
  viewH: number;
  title: string;
  /** 标题条下方内容区宽高（按钮、图标等） */
  contentWidth: number;
  contentHeight: number;
  onCloseTap?: () => void;
  /** 右上红圆关闭，默认 onCloseTap 存在时显示 */
  showCloseButton?: boolean;
}

export interface TutorialStyleModalFrame {
  /** 已置于 (viewW/2, viewH/2)，子节点以面板中心为原点 */
  root: PIXI.Container;
  /** 内容区左上角；有效区域与 contentWidth × contentHeight 一致 */
  contentMount: PIXI.Container;
  panelW: number;
  panelH: number;
}

export function createTutorialStyleModalFrame(
  opts: CreateTutorialStyleModalFrameOptions,
): TutorialStyleModalFrame {
  const { viewW, viewH, title, contentWidth, contentHeight } = opts;
  const onCloseTap = opts.onCloseTap;
  const showClose = opts.showCloseButton ?? !!onCloseTap;

  const titleBlockH = TITLE_H + 14;
  const panelW = Math.min(560, Math.max(300, Math.ceil(contentWidth + INNER_PAD * 2)));
  const panelH = Math.ceil(
    INNER_PAD + 8 + titleBlockH + contentHeight + INNER_PAD + 6,
  );

  const panelRoot = new PIXI.Container();
  panelRoot.position.set(viewW / 2, viewH / 2);
  panelRoot.eventMode = 'static';
  panelRoot.hitArea = new PIXI.Rectangle(-panelW / 2, -panelH / 2, panelW, panelH);
  panelRoot.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());

  const left = -panelW / 2;
  const top = -panelH / 2;

  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x4c2f4f, 0.15);
  shadow.drawRoundedRect(left + 8, top + 14, panelW, panelH, BUBBLE_R);
  shadow.endFill();

  const outer = new PIXI.Graphics();
  outer.beginFill(0xd8c4ff, 0.98);
  outer.drawRoundedRect(left, top, panelW, panelH, BUBBLE_R);
  outer.endFill();
  outer.lineStyle(3, 0xffffff, 0.55);
  outer.drawRoundedRect(left + 2, top + 2, panelW - 4, panelH - 4, BUBBLE_R - 2);

  const inner = new PIXI.Graphics();
  inner.beginFill(0xfff7ea, 0.98);
  inner.drawRoundedRect(left + 9, top + 9, panelW - 18, panelH - 18, BUBBLE_R - 9);
  inner.endFill();
  inner.lineStyle(3, 0xffc9dc, 0.78);
  inner.drawRoundedRect(left + 10.5, top + 10.5, panelW - 21, panelH - 21, BUBBLE_R - 10);

  panelRoot.addChild(shadow, outer, inner);

  const titleText = new PIXI.Text(title, {
    fontSize: 26,
    fill: 0x4a3728,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    stroke: 0xfffcf5,
    strokeThickness: 2,
  });
  const titleW = Math.max(200, titleText.width + TITLE_PAD_X * 2);
  const titleX = left + (panelW - titleW) / 2;
  let contentY = top + INNER_PAD + 6;

  const titleBg = new PIXI.Graphics();
  titleBg.beginFill(0xffd76e, 1);
  titleBg.drawRoundedRect(titleX, contentY, titleW, TITLE_H, 22);
  titleBg.endFill();
  titleBg.lineStyle(2, 0xfff5bf, 0.95);
  titleBg.drawRoundedRect(titleX + 3, contentY + 3, titleW - 6, TITLE_H - 6, 18);
  panelRoot.addChild(titleBg);

  titleText.anchor.set(0.5, 0.5);
  titleText.position.set(0, contentY + TITLE_H / 2 - 1);
  panelRoot.addChild(titleText);

  if (showClose && onCloseTap) {
    const closeRoot = new PIXI.Container();
    closeRoot.position.set(left + panelW - INNER_PAD - 6, contentY + TITLE_H / 2);
    closeRoot.eventMode = 'static';
    closeRoot.cursor = 'pointer';
    closeRoot.hitArea = new PIXI.Circle(0, 0, 22);
    const closeDisc = new PIXI.Graphics();
    closeDisc.beginFill(0xef5350);
    closeDisc.drawCircle(0, 0, 18);
    closeDisc.endFill();
    closeDisc.lineStyle(2, 0xffffff, 0.65);
    closeDisc.drawCircle(0, 0, 16);
    closeRoot.addChild(closeDisc);
    const closeLbl = new PIXI.Text('×', {
      fontSize: 22,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    closeLbl.anchor.set(0.5);
    closeRoot.addChild(closeLbl);
    closeRoot.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onCloseTap();
    });
    panelRoot.addChild(closeRoot);
  }

  contentY += titleBlockH;

  const contentMount = new PIXI.Container();
  contentMount.position.set(-contentWidth / 2, contentY);
  contentMount.eventMode = 'static';
  contentMount.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
  panelRoot.addChild(contentMount);

  return { root: panelRoot, contentMount, panelW, panelH };
}
