/**
 * 棋盘消耗品（万能水晶 / 金剪刀）确认面板：图标公式 + NB2 面板底与「使用」按钮贴图，标题复用 merge_chain_ribbon。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TweenManager, Ease } from '@/core/TweenManager';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';

const ICON_BOX = 78;
const GAP = 12;
const ACCENT_RED = 0xE53935;
const PANEL_FILL = 0xFFF8F0;
const PANEL_STROKE = 0xFFB300;
const BTN_FALLBACK = 0x4CAF50;
const RIBBON_MAX_W = 420;

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
    g.beginFill(0xE0E0E0, 0.95);
    g.drawRoundedRect(4, 4, box - 8, box - 8, 12);
    g.endFill();
    wrap.addChild(g);
  }
  return wrap;
}

function symbolText(ch: string, size: number): PIXI.Text {
  const t = new PIXI.Text(ch, {
    fontSize: size,
    fill: ACCENT_RED,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
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
      p._buildCrystal(targetItemId, resultItemId);
      Game.stage.addChild(p);
    });
  }

  static showGoldenScissors(targetItemId: string, splitItemId: string): Promise<boolean> {
    return new Promise(resolve => {
      const p = new SpecialConsumableConfirmPanel();
      p._resolve = resolve;
      p._buildScissors(targetItemId, splitItemId);
      Game.stage.addChild(p);
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

    const plus = symbolText('+', 38);
    plus.position.set(x + 18, h / 2);
    row.addChild(plus);
    x += 36 + GAP;

    const b = makeIconFromKey(targetDef?.icon ?? '', ICON_BOX);
    b.position.set(x, 0);
    row.addChild(b);
    x += ICON_BOX + GAP;

    const arr = symbolText('▶', 30);
    arr.position.set(x + 18, h / 2);
    row.addChild(arr);
    x += 36 + GAP;

    const c = makeIconFromKey(resultDef?.icon ?? '', ICON_BOX);
    c.position.set(x, 0);
    row.addChild(c);

    this._buildShell('万能水晶', row);
  }

  private _buildScissors(targetItemId: string, splitItemId: string): void {
    const targetDef = ITEM_DEFS.get(targetItemId);
    const splitDef = ITEM_DEFS.get(splitItemId);
    const row = new PIXI.Container();
    let x = 0;
    const h = ICON_BOX;

    const tool = makeIconFromKey('icon_golden_scissors', ICON_BOX);
    tool.position.set(x, 0);
    row.addChild(tool);
    x += ICON_BOX + GAP;

    const plus = symbolText('+', 38);
    plus.position.set(x + 18, h / 2);
    row.addChild(plus);
    x += 36 + GAP;

    const tgt = makeIconFromKey(targetDef?.icon ?? '', ICON_BOX);
    tgt.position.set(x, 0);
    row.addChild(tgt);
    x += ICON_BOX + GAP;

    const arr = symbolText('▶', 30);
    arr.position.set(x + 18, h / 2);
    row.addChild(arr);
    x += 36 + GAP;

    const twinW = 62;
    const twinH = twinW * 2 + 8;
    const twin = new PIXI.Container();
    const s1 = makeIconFromKey(splitDef?.icon ?? '', twinW);
    s1.position.set(0, 0);
    const s2 = makeIconFromKey(splitDef?.icon ?? '', twinW);
    s2.position.set(0, twinW + 8);
    twin.addChild(s1);
    twin.addChild(s2);
    twin.position.set(x, (h - twinH) / 2);
    row.addChild(twin);

    this._buildShell('金剪刀', row);
  }

  private _buildShell(title: string, formulaRow: PIXI.Container): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.5);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    overlay.on('pointertap', () => this._close(false));
    this.addChild(overlay);

    const panelW = Math.min(560, W - 36);
    const panelH = 308;
    const px = (W - panelW) / 2;
    const py = (H - panelH) / 2;
    /** 整体内容上移：彩带贴顶栏、下方留白收紧 */
    const RIBBON_TOP = py + 2;
    const GAP_AFTER_RIBBON = 6;
    const FORMULA_BELOW_HINT = 22;

    const cardTex = TextureCache.get('special_consumable_panel_bg');
    if (cardTex && cardTex.width > 0) {
      const sp = new PIXI.Sprite(cardTex);
      sp.anchor.set(0.5, 0.5);
      sp.position.set(W / 2, py + panelH / 2);
      const sc = Math.min(panelW / cardTex.width, panelH / cardTex.height);
      sp.scale.set(sc);
      sp.eventMode = 'static';
      sp.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      this.addChild(sp);
    } else {
      const panel = new PIXI.Graphics();
      panel.beginFill(PANEL_FILL, 0.98);
      panel.drawRoundedRect(px, py, panelW, panelH, 22);
      panel.endFill();
      panel.lineStyle(3, PANEL_STROKE, 0.95);
      panel.drawRoundedRect(px, py, panelW, panelH, 22);
      panel.eventMode = 'static';
      panel.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      this.addChild(panel);
    }

    const ribTex = TextureCache.get('merge_chain_ribbon');
    let ribbonH = 46;
    let titleCenterY = RIBBON_TOP + ribbonH / 2 + 2;
    let closeX = px + panelW - 34;
    if (ribTex && ribTex.width > 0) {
      const r = new PIXI.Sprite(ribTex);
      const targetW = Math.min(RIBBON_MAX_W, panelW - 28);
      const rs = targetW / ribTex.width;
      r.scale.set(rs);
      r.anchor.set(0.5, 0);
      r.position.set(W / 2, RIBBON_TOP);
      r.eventMode = 'static';
      r.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      this.addChild(r);
      ribbonH = ribTex.height * rs;
      titleCenterY = RIBBON_TOP + ribbonH * 0.46;
      closeX = W / 2 + targetW / 2 - 28;
    } else {
      const g = new PIXI.Graphics();
      const rw = Math.min(RIBBON_MAX_W, panelW - 28);
      const rx = (W - rw) / 2;
      const ry = RIBBON_TOP + 2;
      g.beginFill(0xffb088, 0.98);
      g.drawRoundedRect(rx, ry, rw, 44, 16);
      g.endFill();
      g.eventMode = 'static';
      g.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      this.addChild(g);
      ribbonH = 44;
      titleCenterY = RIBBON_TOP + 2 + ribbonH / 2;
      closeX = rx + rw - 26;
    }

    const titleTxt = new PIXI.Text(title, {
      fontSize: 20,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    titleTxt.anchor.set(0.5, 0.5);
    titleTxt.position.set(W / 2, titleCenterY);
    titleTxt.eventMode = 'static';
    titleTxt.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(titleTxt);

    const closeBtn = new PIXI.Text('×', {
      fontSize: 22,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    closeBtn.anchor.set(0.5);
    closeBtn.position.set(closeX, titleCenterY);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._close(false);
    });
    this.addChild(closeBtn);

    const hint = new PIXI.Text('确定要使用吗？', {
      fontSize: 16,
      fill: ACCENT_RED,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    hint.anchor.set(0.5, 0);
    hint.position.set(W / 2, RIBBON_TOP + ribbonH + GAP_AFTER_RIBBON);
    hint.eventMode = 'static';
    hint.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(hint);

    const hintBottom = RIBBON_TOP + ribbonH + GAP_AFTER_RIBBON + 20;
    const lb = formulaRow.getLocalBounds();
    formulaRow.position.set(W / 2 - (lb.x + lb.width / 2), hintBottom + FORMULA_BELOW_HINT);
    this.addChild(formulaRow);

    const useW = 236;
    const useH = 56;
    const useY = py + panelH - 36 - useH;
    const useBtn = new PIXI.Container();
    useBtn.eventMode = 'static';
    useBtn.cursor = 'pointer';

    const btnTex = TextureCache.get('special_consumable_use_btn');
    if (btnTex && btnTex.width > 0) {
      const bs = new PIXI.Sprite(btnTex);
      const sc = Math.min(useW / btnTex.width, useH / btnTex.height);
      bs.scale.set(sc);
      bs.anchor.set(0.5, 0.5);
      bs.position.set(useW / 2, useH / 2);
      useBtn.addChild(bs);
    } else {
      const ug = new PIXI.Graphics();
      ug.beginFill(BTN_FALLBACK);
      ug.drawRoundedRect(0, 0, useW, useH, 16);
      ug.endFill();
      useBtn.addChild(ug);
    }

    const ut = new PIXI.Text('使用', {
      fontSize: 22,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    ut.anchor.set(0.5, 0.5);
    ut.position.set(useW / 2, useH / 2);
    useBtn.addChild(ut);

    useBtn.position.set(W / 2 - useW / 2, useY);
    useBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._close(true);
    });
    this.addChild(useBtn);

    this.alpha = 0;
    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.18,
      ease: Ease.easeOutQuad,
    });
  }

  private _close(result: boolean): void {
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.12,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.parent?.removeChild(this);
        this.destroy({ children: true });
        this._resolve(result);
      },
    });
  }
}
