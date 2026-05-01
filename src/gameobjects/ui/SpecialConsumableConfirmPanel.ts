/**
 * 棋盘消耗品（万能水晶 / 金剪刀）确认面板 — 排版与视觉对齐通用教程 / ConfirmDialog（粉紫外框 + 奶油内底 + 蜜黄标题条 + 珊瑚主按钮）。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { TweenManager, Ease } from '@/core/TweenManager';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';

const BUBBLE_R = 26;
const INNER_PAD = 28;
const TITLE_H = 46;
const TITLE_PAD_X = 22;

const ICON_BOX = 88;
const GAP = 14;
/** 公式里「+」「▶」用柔和棕色，避免刺眼大红 */
const SYMBOL_FILL = 0xa86852;

function makeIconFromKey(iconKey: string, box: number): PIXI.Container {
  const wrap = new PIXI.Container();
  const hit = new PIXI.Graphics();
  hit.beginFill(0xffffff, 0.001);
  hit.drawRect(0, 0, box, box);
  hit.endFill();
  wrap.addChild(hit);
  const tex = TextureCache.get(iconKey);
  if (tex) {
    const sp = new PIXI.Sprite(tex);
    const m = Math.max(sp.texture.width, sp.texture.height);
    const s = (box * 0.88) / m;
    sp.scale.set(s);
    sp.anchor.set(0.5);
    sp.position.set(box / 2, box / 2);
    wrap.addChild(sp);
  } else {
    const g = new PIXI.Graphics();
    g.beginFill(0xe8e0f5, 0.95);
    g.lineStyle(2, 0xffffff, 0.6);
    g.drawRoundedRect(4, 4, box - 8, box - 8, 14);
    g.endFill();
    wrap.addChild(g);
  }
  return wrap;
}

function symbolText(ch: string, size: number): PIXI.Text {
  const t = new PIXI.Text(ch, {
    fontSize: size,
    fill: SYMBOL_FILL,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    stroke: 0xfff8f0,
    strokeThickness: 2,
  });
  t.anchor.set(0.5);
  return t;
}

export class SpecialConsumableConfirmPanel extends PIXI.Container {
  private _resolve!: (value: boolean) => void;

  static showCrystalBall(targetItemId: string, resultItemId: string): Promise<boolean> {
    return new Promise(resolve => {
      const p = new SpecialConsumableConfirmPanel();
      p._resolve = resolve;
      p.zIndex = 30000;
      p._buildCrystal(targetItemId, resultItemId);
      Game.stage.addChild(p);
      if (Game.stage.sortableChildren) Game.stage.sortChildren();
    });
  }

  static showGoldenScissors(targetItemId: string, splitItemId: string): Promise<boolean> {
    return new Promise(resolve => {
      const p = new SpecialConsumableConfirmPanel();
      p._resolve = resolve;
      p.zIndex = 30000;
      p._buildScissors(targetItemId, splitItemId);
      Game.stage.addChild(p);
      if (Game.stage.sortableChildren) Game.stage.sortChildren();
    });
  }

  private _buildCrystal(targetItemId: string, resultItemId: string): void {
    const targetDef = ITEM_DEFS.get(targetItemId);
    const resultDef = ITEM_DEFS.get(resultItemId);
    const row = new PIXI.Container();
    let x = 0;
    const h = ICON_BOX;

    const a = makeIconFromKey('icon_crystal_ball', ICON_BOX);
    a.position.set(x, 0);
    row.addChild(a);
    x += ICON_BOX + GAP;

    const plus = symbolText('+', 36);
    plus.position.set(x + 16, h / 2);
    row.addChild(plus);
    x += 32 + GAP;

    const b = makeIconFromKey(targetDef?.icon ?? '', ICON_BOX);
    b.position.set(x, 0);
    row.addChild(b);
    x += ICON_BOX + GAP;

    const arr = symbolText('▶', 28);
    arr.position.set(x + 16, h / 2);
    row.addChild(arr);
    x += 32 + GAP;

    const c = makeIconFromKey(resultDef?.icon ?? '', ICON_BOX);
    c.position.set(x, 0);
    row.addChild(c);

    this._buildShell('万能水晶', row, { formulaMinHeight: ICON_BOX });
  }

  private _buildScissors(targetItemId: string, splitItemId: string): void {
    const targetDef = ITEM_DEFS.get(targetItemId);
    const splitDef = ITEM_DEFS.get(splitItemId);
    const row = new PIXI.Container();
    let x = 0;
    const h = ICON_BOX;

    const twinW = 68;
    const twinGap = 10;
    const twinStackH = twinW * 2 + twinGap;
    /** 双结果列总高度可能大于左侧 88 格，必须与教程面板一样预留足量纵向空间，避免「使用」压到图标 */
    const formulaMinHeight = Math.max(ICON_BOX, twinStackH);
    const rowIconY = (formulaMinHeight - ICON_BOX) / 2;

    const tool = makeIconFromKey('icon_golden_scissors', ICON_BOX);
    tool.position.set(x, rowIconY);
    row.addChild(tool);
    x += ICON_BOX + GAP;

    const plus = symbolText('+', 36);
    plus.position.set(x + 16, rowIconY + h / 2);
    row.addChild(plus);
    x += 32 + GAP;

    const tgt = makeIconFromKey(targetDef?.icon ?? '', ICON_BOX);
    tgt.position.set(x, rowIconY);
    row.addChild(tgt);
    x += ICON_BOX + GAP;

    const arr = symbolText('▶', 28);
    arr.position.set(x + 16, rowIconY + h / 2);
    row.addChild(arr);
    x += 32 + GAP;

    const twin = new PIXI.Container();
    const s1 = makeIconFromKey(splitDef?.icon ?? '', twinW);
    s1.position.set(0, 0);
    const s2 = makeIconFromKey(splitDef?.icon ?? '', twinW);
    s2.position.set(0, twinW + twinGap);
    twin.addChild(s1);
    twin.addChild(s2);
    twin.position.set(x, (formulaMinHeight - twinStackH) / 2);
    row.addChild(twin);

    this._buildShell('金剪刀', row, { formulaMinHeight });
  }

  private _buildShell(
    title: string,
    formulaRow: PIXI.Container,
    opts?: { formulaMinHeight?: number },
  ): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.5);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    overlay.on('pointertap', () => this._close(false));
    this.addChild(overlay);

    const formulaMinH = Math.max(opts?.formulaMinHeight ?? ICON_BOX, ICON_BOX);
    const rowB = formulaRow.getLocalBounds();
    const rowVisualW = Math.max(rowB.width, 1);
    /** 纹理未就绪时 getLocalBounds 可能过扁，用下限撑开面板；金剪刀双列必 ≥ twinStack */
    const bandH = Math.max(rowB.height, formulaMinH);

    const hint = new PIXI.Text('确定要使用吗？', {
      fontSize: 20,
      fill: 0x5c4a3d,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfffdf8,
      strokeThickness: 2,
    });
    hint.anchor.set(0.5, 0);

    const BTN_W = 228;
    const BTN_H = 52;
    const BTN_R = 24;

    const titleBlockH = TITLE_H + 14;
    const panelW = Math.min(
      560,
      Math.max(480, Math.ceil(rowVisualW + INNER_PAD * 2 + 36)),
    );

    const GAP_ROW_TO_BTN = 40;

    const panelH = Math.ceil(
      INNER_PAD +
        8 +
        titleBlockH +
        hint.height +
        20 +
        bandH +
        GAP_ROW_TO_BTN +
        BTN_H +
        INNER_PAD +
        14,
    );

    const px = (W - panelW) / 2;
    const py = (H - panelH) / 2;

    const panelRoot = new PIXI.Container();
    panelRoot.hitArea = new PIXI.Rectangle(0, 0, panelW, panelH);
    panelRoot.eventMode = 'static';
    panelRoot.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(panelRoot);

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x4c2f4f, 0.15);
    shadow.drawRoundedRect(8, 14, panelW, panelH, BUBBLE_R);
    shadow.endFill();

    const outer = new PIXI.Graphics();
    outer.beginFill(0xd8c4ff, 0.98);
    outer.drawRoundedRect(0, 0, panelW, panelH, BUBBLE_R);
    outer.endFill();
    outer.lineStyle(3, 0xffffff, 0.55);
    outer.drawRoundedRect(2, 2, panelW - 4, panelH - 4, BUBBLE_R - 2);

    const inner = new PIXI.Graphics();
    inner.beginFill(0xfff7ea, 0.98);
    inner.drawRoundedRect(9, 9, panelW - 18, panelH - 18, BUBBLE_R - 9);
    inner.endFill();
    inner.lineStyle(3, 0xffc9dc, 0.78);
    inner.drawRoundedRect(10.5, 10.5, panelW - 21, panelH - 21, BUBBLE_R - 10);

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
    const titleX = (panelW - titleW) / 2;
    let contentY = INNER_PAD + 6;

    const titleBg = new PIXI.Graphics();
    titleBg.beginFill(0xffd76e, 1);
    titleBg.drawRoundedRect(titleX, contentY, titleW, TITLE_H, 22);
    titleBg.endFill();
    titleBg.lineStyle(2, 0xfff5bf, 0.95);
    titleBg.drawRoundedRect(titleX + 3, contentY + 3, titleW - 6, TITLE_H - 6, 18);
    panelRoot.addChild(titleBg);

    titleText.anchor.set(0.5, 0.5);
    titleText.position.set(panelW / 2, contentY + TITLE_H / 2 - 1);
    panelRoot.addChild(titleText);

    const closeRoot = new PIXI.Container();
    closeRoot.position.set(panelW - INNER_PAD - 6, contentY + TITLE_H / 2);
    closeRoot.eventMode = 'static';
    closeRoot.cursor = 'pointer';
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
      this._close(false);
    });
    panelRoot.addChild(closeRoot);

    contentY += titleBlockH;

    hint.position.set(panelW / 2, contentY);
    panelRoot.addChild(hint);
    contentY += hint.height + 20;

    const bandTop = contentY;
    const cx = panelW / 2;
    const cy = bandTop + bandH / 2;
    formulaRow.position.set(
      cx - (rowB.x + rowB.width / 2),
      cy - (rowB.y + rowB.height / 2),
    );
    panelRoot.addChild(formulaRow);
    contentY += bandH + GAP_ROW_TO_BTN;

    const useBtn = new PIXI.Container();
    useBtn.position.set((panelW - BTN_W) / 2, contentY);
    useBtn.eventMode = 'static';
    useBtn.cursor = 'pointer';

    const ug = new PIXI.Graphics();
    ug.beginFill(COLORS.BUTTON_PRIMARY);
    ug.drawRoundedRect(0, 0, BTN_W, BTN_H, BTN_R);
    ug.endFill();
    ug.lineStyle(2, 0xffffff, 0.55);
    ug.drawRoundedRect(3, 3, BTN_W - 6, BTN_H - 6, BTN_R - 3);
    useBtn.addChild(ug);

    const ut = new PIXI.Text('使用', {
      fontSize: 21,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    ut.anchor.set(0.5, 0.5);
    ut.position.set(BTN_W / 2, BTN_H / 2);
    useBtn.addChild(ut);

    useBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._close(true);
    });
    panelRoot.addChild(useBtn);

    panelRoot.pivot.set(panelW / 2, panelH / 2);
    panelRoot.position.set(px + panelW / 2, py + panelH / 2);
    panelRoot.scale.set(0.94, 0.94);

    this.alpha = 0;
    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: panelRoot.scale,
      props: { x: 1, y: 1 },
      duration: 0.28,
      ease: Ease.easeOutBack,
    });
  }

  private _close(result: boolean): void {
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.14,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.parent?.removeChild(this);
        this.destroy({ children: true });
        this._resolve(result);
      },
    });
  }
}
