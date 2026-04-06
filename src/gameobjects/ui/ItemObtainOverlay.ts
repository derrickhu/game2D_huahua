/**
 * 通用「恭喜获得」全屏遮罩：merge_chain_ribbon 标题 + 仅图标与数量 +「点击继续」。
 * 由调用方在 onClaim 内发奖/存档；许愿喷泉等可在抽奖成功与点击之间挂起 pending 以防强关丢奖。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { OverlayManager } from '@/core/OverlayManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';

/**
 * board_item：进收纳盒/棋盘的棋子，数量用 ×N；
 * direct_currency：直加顶栏体力/花愿/钻石，仅显示数字（无 ×，避免与「几个棋子」混淆）。
 */
export type ItemObtainEntry =
  | { kind: 'board_item'; itemId: string; count: number }
  | { kind: 'direct_currency'; currency: 'stamina' | 'huayuan' | 'diamond'; amount: number };

const Z = 12500;
/** 仅用于计算物品区垂直位置（与此前居中逻辑一致，避免改标题缩放时带动格子） */
const RIBBON_LAYOUT_MAX_W = 420;
/** 实际展示的标题彩带宽度上限（更大） */
const RIBBON_DISPLAY_MAX_W = 520;
/** 标题相对「贴网格摆放」再整体上移的像素（仅彩带/字，物品区不动） */
const TITLE_LIFT_PX = 40;
/** 「恭喜获得」在彩带高度上的位置（越小越靠上） */
const TITLE_ON_RIBBON_Y_FRAC = 0.39;
/** 不低于彩带高度的该比例，避免贴顶裁切 */
const TITLE_ON_RIBBON_MIN_FRAC = 0.28;
/** 相对 frac 再向上微调像素 */
const TITLE_NUDGE_UP_PX = 8;
/** 标题字号：基准与上限（随彩带宽度缩放） */
const TITLE_FONT_BASE = 26;
const TITLE_FONT_MAX = 34;
/** 单格占位（图标按格内缩放，略小于格以留出间距感） */
const CELL = 96;
const GAP = 28;
const MASK_ALPHA = 0.62;

/** 中心散射光：细放射条，避免实心大圆盘感 */
function drawSunburstRays(g: PIXI.Graphics, cx: number, cy: number, outerR: number): void {
  const innerR = 6;
  const rays = 32;
  const twoPi = Math.PI * 2;
  for (let i = 0; i < rays; i++) {
    const base = (i / rays) * twoPi - Math.PI / 2;
    const span = (twoPi / rays) * 0.52;
    const t0 = base;
    const t1 = base + span;
    const alpha = 0.07 + (i % 2) * 0.06;
    g.beginFill(0xfffef5, alpha);
    g.moveTo(cx + Math.cos(t0) * innerR, cy + Math.sin(t0) * innerR);
    g.lineTo(cx + Math.cos(t0) * outerR, cy + Math.sin(t0) * outerR);
    g.lineTo(cx + Math.cos(t1) * outerR, cy + Math.sin(t1) * outerR);
    g.lineTo(cx + Math.cos(t1) * innerR, cy + Math.sin(t1) * innerR);
    g.closePath();
    g.endFill();
  }
  /** 亮心随散射范围略缩，避免抢眼 */
  g.beginFill(0xffffff, 0.16);
  g.drawCircle(cx, cy, Math.max(8, outerR * 0.06));
  g.endFill();
}

const DIRECT_CURRENCY_ICON: Record<'stamina' | 'huayuan' | 'diamond', string> = {
  stamina: 'icon_energy',
  huayuan: 'icon_huayuan',
  diamond: 'icon_gem',
};

/** 单格展示（许愿池 / 升级奖励等共用） */
export function createItemObtainRewardCell(entry: ItemObtainEntry): PIXI.Container {
  const root = new PIXI.Container();
  root.eventMode = 'none';

  let texKey = '';
  let qtyStr = '';
  if (entry.kind === 'board_item') {
    const def = ITEM_DEFS.get(entry.itemId);
    texKey = def?.icon ?? '';
    qtyStr = `×${entry.count}`;
  } else {
    texKey = DIRECT_CURRENCY_ICON[entry.currency];
    qtyStr = `${entry.amount}`;
  }

  const tex = TextureCache.get(texKey);
  if (tex?.width) {
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    const sc = Math.min((CELL - 10) / tex.width, (CELL - 10) / tex.height);
    sp.scale.set(sc);
    root.addChild(sp);
  } else {
    const ph = new PIXI.Text('?', { fontSize: 30, fontFamily: FONT_FAMILY, fill: 0xffffff });
    ph.anchor.set(0.5);
    root.addChild(ph);
  }
  const cnt = new PIXI.Text(qtyStr, {
    fontSize: 18,
    fill: 0xffeb3b,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    stroke: 0x4e342e,
    strokeThickness: 2,
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowAlpha: 0.45,
    dropShadowBlur: 2,
    dropShadowDistance: 1,
  });
  cnt.anchor.set(0.5, 0);
  cnt.position.set(0, CELL * 0.36);
  root.addChild(cnt);
  return root;
}

export interface ObtainStyleLayoutParams {
  ribbonTexKey: string;
  titleText: string;
}

export interface ObtainStyleLayoutOutcome {
  /** 收纳盒类奖励格中心（与 content 同坐标系，content 通常置于根 0,0） */
  boardItemSlots: Array<{ cx: number; cy: number; itemId: string; count: number }>;
}

/**
 * 许愿池同款：散射光 + 彩带标题 + 网格奖励 +「点击继续」。
 * 由 LevelUpPopup 等外层自行加遮罩与点击关闭逻辑。
 */
export function layoutObtainStyleRewardBlock(
  content: PIXI.Container,
  W: number,
  H: number,
  rewards: ItemObtainEntry[],
  params: ObtainStyleLayoutParams,
): ObtainStyleLayoutOutcome {
  const boardItemSlots: ObtainStyleLayoutOutcome['boardItemSlots'] = [];

  const n = rewards.length;
  const cols = n <= 1 ? 1 : Math.min(5, n);
  const rows = Math.ceil(n / cols) || 1;
  const gridW = cols * CELL + (cols - 1) * GAP;
  const gridH = rows * CELL + (rows - 1) * GAP;

  const ribTex = TextureCache.get(params.ribbonTexKey);
  const layoutTargetW = Math.min(RIBBON_LAYOUT_MAX_W, W - 40);
  let ribH_layout = 48;
  if (ribTex && ribTex.width > 0) {
    const rsL = layoutTargetW / ribTex.width;
    ribH_layout = ribTex.height * rsL;
  }

  const GAP_RIBBON_GRID = 52;
  const GAP_GRID_HINT = 52;
  const hintLineH = 26;
  const totalBlockH_layout = ribH_layout + GAP_RIBBON_GRID + gridH + GAP_GRID_HINT + hintLineH;
  const ribbonTop_layout = Math.max(
    Game.safeTop + 12,
    Math.min((H - totalBlockH_layout) / 2, H - totalBlockH_layout - 28),
  );
  const gridTop = ribbonTop_layout + ribH_layout + GAP_RIBBON_GRID;
  const gridCx = W / 2;
  const gridCy = gridTop + gridH / 2;

  const displayTargetW = Math.min(RIBBON_DISPLAY_MAX_W, W - 24);
  let ribH_display = 48;
  let titleCenterOffset = 24;
  let rsDisplay = 1;
  if (ribTex && ribTex.width > 0) {
    rsDisplay = displayTargetW / ribTex.width;
    ribH_display = ribTex.height * rsDisplay;
    titleCenterOffset = ribH_display * TITLE_ON_RIBBON_Y_FRAC - TITLE_NUDGE_UP_PX;
  } else {
    ribH_display = Math.round(52 * (displayTargetW / RIBBON_LAYOUT_MAX_W));
  }
  let ribbonTop = gridTop - GAP_RIBBON_GRID - ribH_display - TITLE_LIFT_PX;
  ribbonTop = Math.max(Game.safeTop + 4, ribbonTop);

  if (ribTex && ribTex.width > 0) {
    const r = new PIXI.Sprite(ribTex);
    r.scale.set(rsDisplay);
    r.anchor.set(0.5, 0);
    r.position.set(W / 2, ribbonTop);
    r.eventMode = 'none';
    content.addChild(r);
    const titleY = ribbonTop + Math.max(ribH_display * TITLE_ON_RIBBON_MIN_FRAC, titleCenterOffset);
    const titleFont = Math.min(
      TITLE_FONT_MAX,
      Math.round(TITLE_FONT_BASE * (displayTargetW / RIBBON_LAYOUT_MAX_W)),
    );
    const titleTxt = new PIXI.Text(params.titleText, {
      fontSize: titleFont,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x5d4037,
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.4,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    titleTxt.anchor.set(0.5, 0.5);
    titleTxt.position.set(W / 2, titleY);
    titleTxt.eventMode = 'none';
    content.addChild(titleTxt);
  } else {
    const rw = Math.min(displayTargetW, W - 48);
    const rh = ribH_display;
    const rx = (W - rw) / 2;
    const g = new PIXI.Graphics();
    g.beginFill(0xffb088, 0.98);
    g.drawRoundedRect(rx, ribbonTop, rw, rh, 18);
    g.endFill();
    g.eventMode = 'none';
    content.addChild(g);
    const titleFontFb = Math.min(
      TITLE_FONT_MAX,
      Math.round(TITLE_FONT_BASE * (displayTargetW / RIBBON_LAYOUT_MAX_W)),
    );
    const titleTxt = new PIXI.Text(params.titleText, {
      fontSize: titleFontFb,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x5d4037,
      strokeThickness: 4,
    });
    titleTxt.anchor.set(0.5, 0.5);
    const fbY = ribbonTop + Math.max(rh * TITLE_ON_RIBBON_MIN_FRAC, rh * TITLE_ON_RIBBON_Y_FRAC - TITLE_NUDGE_UP_PX);
    titleTxt.position.set(W / 2, fbY);
    content.addChild(titleTxt);
  }

  const burst = new PIXI.Graphics();
  const burstR = (Math.max(gridW, gridH) * 0.72 + 56) * 0.5;
  drawSunburstRays(burst, gridCx, gridCy, burstR);
  burst.eventMode = 'none';
  content.addChildAt(burst, 0);

  const startX = gridCx - gridW / 2;
  const startY = gridTop;
  for (let i = 0; i < n; i++) {
    const rw = Math.floor(i / cols);
    const c = i % cols;
    const entry = rewards[i]!;
    const cell = createItemObtainRewardCell(entry);
    const cx = startX + c * (CELL + GAP) + CELL / 2;
    const cy = startY + rw * (CELL + GAP) + CELL / 2;
    cell.position.set(cx, cy);
    content.addChild(cell);
    if (entry.kind === 'board_item') {
      boardItemSlots.push({ cx, cy, itemId: entry.itemId, count: entry.count });
    }
  }

  const hint = new PIXI.Text('点击继续', {
    fontSize: 18,
    fill: 0xfff8e7,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    stroke: 0x4e342e,
    strokeThickness: 2,
    dropShadow: true,
    dropShadowColor: 0x1a0f0a,
    dropShadowAlpha: 0.45,
    dropShadowBlur: 3,
    dropShadowDistance: 2,
  });
  hint.anchor.set(0.5, 0);
  hint.position.set(W / 2, gridTop + gridH + GAP_GRID_HINT);
  hint.eventMode = 'none';
  content.addChild(hint);

  return { boardItemSlots };
}

export class ItemObtainOverlay extends PIXI.Container {
  private static _current: ItemObtainOverlay | null = null;

  private _onClaim!: () => void;
  private _settled = false;

  /**
   * 展示获得物品；点击任意处触发 onClaim 后移除自身。
   * @param parent 默认全局 Overlay 容器
   */
  static show(
    rewards: ItemObtainEntry[],
    onClaim: () => void,
    parent: PIXI.Container = OverlayManager.container,
  ): void {
    ItemObtainOverlay.forceClose();
    OverlayManager.bringToFront();
    parent.sortableChildren = true;
    const layer = new ItemObtainOverlay(rewards, onClaim);
    layer.zIndex = Z;
    ItemObtainOverlay._current = layer;
    parent.addChild(layer);
    layer.alpha = 0;
    TweenManager.to({ target: layer, props: { alpha: 1 }, duration: 0.22, ease: Ease.easeOutQuad });
  }

  /** 仅移除弹层，不触发 onClaim（用于外层面板强制关闭时由调用方自行发奖） */
  static forceClose(): void {
    const c = ItemObtainOverlay._current;
    if (!c) return;
    ItemObtainOverlay._current = null;
    TweenManager.cancelTarget(c);
    if (c.parent) c.parent.removeChild(c);
    c.destroy({ children: true });
  }

  private constructor(rewards: ItemObtainEntry[], onClaim: () => void) {
    super();
    this._onClaim = onClaim;
    this.sortableChildren = true;
    this._build(rewards);
  }

  private _build(rewards: ItemObtainEntry[]): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    this.eventMode = 'static';
    this.hitArea = new PIXI.Rectangle(0, 0, W, H);
    this.on('pointertap', () => this._finish());

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, MASK_ALPHA);
    mask.drawRect(0, 0, W, H);
    mask.endFill();
    mask.eventMode = 'none';
    this.addChild(mask);

    const content = new PIXI.Container();
    content.eventMode = 'none';
    this.addChild(content);

    layoutObtainStyleRewardBlock(content, W, H, rewards, {
      ribbonTexKey: 'merge_chain_ribbon',
      titleText: '恭喜获得',
    });
  }

  private _finish(): void {
    if (this._settled) return;
    this._settled = true;
    if (ItemObtainOverlay._current === this) {
      ItemObtainOverlay._current = null;
    }
    const fn = this._onClaim;
    this._onClaim = () => {};
    TweenManager.cancelTarget(this);
    if (this.parent) this.parent.removeChild(this);
    this.destroy({ children: true });
    fn();
  }
}
