/**
 * 许愿池彩蛋 / 升星「礼包预览」同款壳体：`flower_egg_reward_bg` + `item_info_title_ribbon` + 右上红圆关闭。
 * 与 `LevelUpPopup._layoutStarGiftPreviewBox` 的尺寸与顶区算法对齐，便于多面板复用。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { COLORS, FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';

export interface CreateFlowerEggModalFrameOptions {
  viewW: number;
  viewH: number;
  title: string;
  /** 彩条上的标题字号，默认与升星礼包预览一致 */
  titleFontSize?: number;
  /** 内层内容占位（如双按钮一行的总宽高），用于 panelW/panelH 与内容区纵向位置 */
  contentWidth: number;
  contentHeight: number;
  onCloseTap: () => void;
}

export interface FlowerEggModalFrame {
  root: PIXI.Container;
  /**
   * 在标题彩条下方的内容区挂载子节点；原点为内容区左上角，
   * 有效区域宽 `contentWidth`、高 `contentHeight`（与入参一致）。
   */
  contentMount: PIXI.Container;
}

export function createFlowerEggModalFrame(opts: CreateFlowerEggModalFrameOptions): FlowerEggModalFrame {
  const { viewW, viewH, title, contentWidth, contentHeight, onCloseTap } = opts;
  const titleFontSize = opts.titleFontSize ?? 18;
  const titleStroke = Math.max(3, Math.round(titleFontSize * 0.2));
  const bgTex = TextureCache.get('flower_egg_reward_bg');
  const ribTex = TextureCache.get('item_info_title_ribbon');

  const panelRoot = new PIXI.Container();
  panelRoot.position.set(viewW / 2, viewH / 2);
  panelRoot.eventMode = 'passive';
  panelRoot.interactiveChildren = true;

  const gridW = contentWidth;
  const gridH = contentHeight;

  let panelW = Math.min(viewW - 40, Math.max(300, gridW + 80));
  let panelH: number;
  let ribW = 0;
  let ribH = 0;

  if (bgTex && bgTex.width > 0) {
    if (ribTex && ribTex.width > 0) {
      ribW = Math.min(panelW - 28, 400);
      ribH = (ribW * ribTex.height) / ribTex.width;
    }
    const naturalH = (panelW * bgTex.height) / bgTex.width;
    const contentFloor = gridH + 56 + 48;
    panelH = Math.max(naturalH, (ribH > 0 ? ribH * 0.5 : 0) + contentFloor);
    panelH = Math.min(panelH, viewH - Game.safeTop - 48);
  } else {
    panelH = 52 + 36 + 14 + gridH + 52;
  }

  const hx = panelW / 2;
  const hy = panelH / 2;

  if (bgTex && bgTex.width > 0) {
    const bgSp = new PIXI.Sprite(bgTex);
    bgSp.anchor.set(0.5, 0.5);
    bgSp.position.set(0, 0);
    bgSp.width = panelW;
    bgSp.height = panelH;
    bgSp.eventMode = 'static';
    bgSp.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    panelRoot.addChild(bgSp);

    if (ribTex && ribTex.width > 0) {
      ribW = Math.min(panelW - 28, 400);
      ribH = (ribW * ribTex.height) / ribTex.width;
      const ribbon = new PIXI.Sprite(ribTex);
      ribbon.anchor.set(0.5, 1);
      const ribbonBottomY = -hy + 14;
      ribbon.position.set(0, ribbonBottomY);
      ribbon.width = ribW;
      ribbon.height = ribH;
      ribbon.eventMode = 'static';
      ribbon.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      panelRoot.addChild(ribbon);

      const titleTxt = new PIXI.Text(title, {
        fontSize: titleFontSize,
        fill: 0xffffff,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0x6b1818,
        strokeThickness: titleStroke,
        wordWrap: true,
        wordWrapWidth: ribW - 48,
        align: 'center',
      } as PIXI.TextStyle);
      titleTxt.anchor.set(0.5, 0.5);
      titleTxt.position.set(0, ribbonBottomY - ribH * 0.48);
      titleTxt.eventMode = 'static';
      titleTxt.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      panelRoot.addChild(titleTxt);
    } else {
      const titleTxt = new PIXI.Text(title, {
        fontSize: Math.max(19, titleFontSize),
        fill: COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: panelW - 48,
        align: 'center',
      } as PIXI.TextStyle);
      titleTxt.anchor.set(0.5, 0);
      titleTxt.position.set(0, -hy + 28);
      titleTxt.eventMode = 'static';
      titleTxt.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      panelRoot.addChild(titleTxt);
    }
  } else {
    const px = -panelW / 2;
    const py = -panelH / 2;
    const panelBg = new PIXI.Graphics();
    panelBg.beginFill(0xfff8f0, 0.98);
    panelBg.drawRoundedRect(px, py, panelW, panelH, 22);
    panelBg.endFill();
    panelBg.lineStyle(3, 0xd2b48c, 0.55);
    panelBg.drawRoundedRect(px, py, panelW, panelH, 22);
    panelBg.eventMode = 'static';
    panelBg.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    panelRoot.addChild(panelBg);

    const titleTxt = new PIXI.Text(title, {
      fontSize: Math.max(19, titleFontSize),
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: panelW - 40,
      align: 'center',
    } as PIXI.TextStyle);
    titleTxt.anchor.set(0.5, 0);
    titleTxt.position.set(0, py + 26);
    titleTxt.eventMode = 'static';
    titleTxt.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    panelRoot.addChild(titleTxt);
  }

  const gridTop =
    -hy + (ribH > 0 ? Math.max(ribH * 0.42 + 28, panelH * 0.2) : 72);

  const contentMount = new PIXI.Container();
  contentMount.position.set(-gridW / 2, gridTop);
  contentMount.eventMode = 'static';
  contentMount.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
  panelRoot.addChild(contentMount);

  const closeBtn = new PIXI.Container();
  const cr = 16;
  const cbgClose = new PIXI.Graphics();
  cbgClose.beginFill(0xe57373, 0.95);
  cbgClose.drawCircle(0, 0, cr);
  cbgClose.endFill();
  cbgClose.lineStyle(2, 0xffffff, 0.92);
  const arm = 6;
  cbgClose.moveTo(-arm, -arm);
  cbgClose.lineTo(arm, arm);
  cbgClose.moveTo(arm, -arm);
  cbgClose.lineTo(-arm, arm);
  closeBtn.addChild(cbgClose);
  closeBtn.position.set(hx - 22, -hy + 26);
  closeBtn.eventMode = 'static';
  closeBtn.cursor = 'pointer';
  closeBtn.hitArea = new PIXI.Circle(0, 0, cr + 10);
  closeBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
    e.stopPropagation();
    onCloseTap();
  });
  panelRoot.addChild(closeBtn);

  return { root: panelRoot, contentMount };
}
