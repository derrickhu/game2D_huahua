/**
 * 顶部信息栏
 *
 * 布局：[🌿花露]  [💎花愿]  [⚡体力胶囊 … +]  [💠钻石条+加号]（无等级星，四区垂直中线对齐）
 *
 * - 体力：粉米色圆角外框 + 内绿进度 + 左侧闪电叠压 + 闪电右下绿圆加号 + 居中数值 + 条下倒计时
 * - 花露/花愿：图标 + 数值叠在底边，图标中心与体力闪电/钻石宝石同一水平中线
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';
import { TweenManager, Ease } from '@/core/TweenManager';

/** 含体力条下方倒计时，略高于原 60 */
export const TOP_BAR_HEIGHT = 76;

const PILL_H = 42;
const PILL_R = PILL_H / 2;
const PY = Math.round((TOP_BAR_HEIGHT - PILL_H) / 2);
/** 顶栏内统一垂直中线（花露/花愿图标、闪电、钻石宝石中心对齐） */
const BAR_MID_Y = TOP_BAR_HEIGHT / 2;

// ── 水平布局（花露 → 花愿 → 体力 → 钻石，间距放宽）──
const LEFT_MARGIN = 28;
const CURRENCY_ICON    = 46;
const HUALU_CX = LEFT_MARGIN + CURRENCY_ICON / 2;
/** 花露/花愿图标中心 y：与体力闪电、钻石宝石同中线 */
const CURRENCY_ICON_CY = BAR_MID_Y;
const CURRENCY_TEXT_CY = CURRENCY_ICON_CY + CURRENCY_ICON / 2 - 5;

const GAP_HUALU_HYUAN = 74;
const HYUAN_CX = HUALU_CX + GAP_HUALU_HYUAN;

const GAP_HYUAN_TO_STAMINA = 36;
const STA_X = HYUAN_CX + CURRENCY_ICON / 2 + GAP_HYUAN_TO_STAMINA;
const STA_W = 102;

const GAP_STAMINA_TO_DIAMOND = 28;
/** 钻石条（含左侧宝石叠压）左上角 x */
const DIAMOND_LP = STA_X + STA_W + GAP_STAMINA_TO_DIAMOND;

// 钻石条（参考：浅色圆角底 + 左侧宝石 + 绿加号 + 棕色数字）
const GEM_BAR_H = 38;
/** 钻石胶囊主体宽度（整体比体力条更短） */
const GEM_BAR_W = 86;
const GEM_BAR_R = 12;
const GEM_ICON_SIZE = 48;
// ── 颜色（体力胶囊参考：浅粉框 + 鲜绿填充 + 绿圆加号）──
const C = {
  /** 胶囊外沿浅粉米 */
  CAPSULE_FACE:   0xFFEFE8,
  CAPSULE_RIM:    0xE5989E,
  /** 内圈深粉边 */
  CAPSULE_INSET:  0xCE93A8,
  /** 未满槽浅绿底 */
  STAMINA_TRACK:  0xDcedc8,
  STAMINA_FILL:   0x8BC34A,
  PLUS_GREEN:     0x66BB6A,
  PLUS_GREEN_DK:  0x2E7D32,
  PLUS_RING:      0x1B5E20,
  TEXT_WHITE:     0xFFFFFF,
  TEXT_DARK:      0x5D4037,
  TIMER_FILL:     0x5D4037,
  TIMER_STROKE:   0xFFFFFF,
};

export class TopBar extends PIXI.Container {
  private _staminaText!: PIXI.Text;
  private _staminaTimer!: PIXI.Text;
  /** 体力条内绿进度（内缩区域左上角为原点） */
  private _staminaFill!: PIXI.Graphics;
  /** 体力内槽尺寸（用于绘制进度） */
  private _staminaInner = { x: 0, y: 0, w: 0, h: 0 };
  private _hualuText!: PIXI.Text;
  private _huayuanText!: PIXI.Text;
  private _diamondBar!: PIXI.Container;
  private _diamondText!: PIXI.Text;

  constructor() {
    super();
    this._buildHualu();
    this._buildHuayuan();
    this._buildStaminaPill();
    this._buildDiamondPill();
    this._bindEvents();
    this._updateAll();
  }

  /* ============== 体力胶囊（参考：粉框 + 内绿进度 + 闪电叠压 + 闪电角绿圆加号） ============== */

  private _buildStaminaPill(): void {
    const BOLT_W = 50;
    const BOLT_H = 54;
    const ix = STA_X + 6;
    /** 闪电中心与花露/花愿/钻石宝石同一中线 */
    const iy = BAR_MID_Y;

    // 外框：浅粉米胶囊 + 粉描边
    const frame = new PIXI.Graphics();
    frame.lineStyle(2.2, C.CAPSULE_RIM, 1);
    frame.beginFill(C.CAPSULE_FACE);
    frame.drawRoundedRect(STA_X, PY, STA_W, PILL_H, PILL_R);
    frame.endFill();
    this.addChild(frame);

    // 内凹槽描边（略嵌套感）
    const inset = 3.5;
    const ix0 = STA_X + inset;
    const iy0 = PY + inset;
    const iw = STA_W - inset * 2;
    const ih = PILL_H - inset * 2;
    const ir = Math.max(6, PILL_R - inset);
    this._staminaInner = { x: ix0, y: iy0, w: iw, h: ih };

    const innerRim = new PIXI.Graphics();
    innerRim.lineStyle(1.2, C.CAPSULE_INSET, 0.85);
    innerRim.beginFill(C.STAMINA_TRACK);
    innerRim.drawRoundedRect(ix0, iy0, iw, ih, ir);
    innerRim.endFill();
    this.addChild(innerRim);

    // 绿色进度（盖在浅槽上）
    this._staminaFill = new PIXI.Graphics();
    this._staminaFill.position.set(ix0, iy0);
    this.addChild(this._staminaFill);

    // 闪电 + 与体力相同的绿圆「+」（叠在闪电右下）
    const boltWrap = new PIXI.Container();
    boltWrap.position.set(ix, iy);
    const energyTex = TextureCache.get('icon_energy');
    if (energyTex) {
      const sp = new PIXI.Sprite(energyTex);
      sp.anchor.set(0.5);
      sp.width = BOLT_W;
      sp.height = BOLT_H;
      sp.position.set(0, 0);
      boltWrap.addChild(sp);
    } else {
      const iconBg = new PIXI.Graphics();
      iconBg.beginFill(0xFFEB3B);
      iconBg.drawCircle(0, 0, BOLT_W / 2);
      iconBg.endFill();
      boltWrap.addChild(iconBg);
    }
    const staminaPlus = this._createGreenCirclePlusButton();
    staminaPlus.position.set(BOLT_W * 0.22, BOLT_H * 0.28);
    staminaPlus.eventMode = 'static';
    staminaPlus.cursor = 'pointer';
    staminaPlus.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      // 预留：体力补充入口
    });
    boltWrap.addChild(staminaPlus);
    this.addChild(boltWrap);

    // 体力数值：条内水平居中，白字 + 深色描边
    this._staminaText = new PIXI.Text('0/0', {
      fontSize: 17,
      fontWeight: 'bold',
      fill: C.TEXT_WHITE,
      fontFamily: FONT_FAMILY,
      stroke: 0x3E2723,
      strokeThickness: 2.5,
    });
    this._staminaText.anchor.set(0.5, 0.5);
    this._staminaText.position.set(STA_X + STA_W / 2 + 8, BAR_MID_Y);
    this.addChild(this._staminaText);

    // 倒计时：条下方居中，深棕字 + 白描边
    this._staminaTimer = new PIXI.Text('', {
      fontSize: 13,
      fontWeight: 'bold',
      fill: C.TIMER_FILL,
      fontFamily: FONT_FAMILY,
      stroke: C.TIMER_STROKE,
      strokeThickness: 2,
    });
    this._staminaTimer.anchor.set(0.5, 0);
    this._staminaTimer.position.set(STA_X + STA_W / 2 + 8, PY + PILL_H + 1);
    this.addChild(this._staminaTimer);
  }

  /* ============== 花露（上图标 + 下文字叠压，参考星星样式） ============== */

  private _buildHualu(): void {
    const tex = TextureCache.get('icon_hualu');
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.width = CURRENCY_ICON;
      sp.height = CURRENCY_ICON;
      sp.position.set(HUALU_CX, CURRENCY_ICON_CY);
      this.addChild(sp);
    }

    this._hualuText = new PIXI.Text('0', {
      fontSize: 19,
      fontWeight: 'bold',
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      stroke: 0x1565C0,
      strokeThickness: 3,
    });
    this._hualuText.anchor.set(0.5, 0.5);
    this._hualuText.position.set(HUALU_CX, CURRENCY_TEXT_CY);
    this.addChild(this._hualuText);
  }

  /* ============== 花愿（上图标 + 下文字叠压，参考星星样式） ============== */

  private _buildHuayuan(): void {
    const tex = TextureCache.get('icon_huayuan');
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.width = CURRENCY_ICON;
      sp.height = CURRENCY_ICON;
      sp.position.set(HYUAN_CX, CURRENCY_ICON_CY);
      this.addChild(sp);
    }

    this._huayuanText = new PIXI.Text('0', {
      fontSize: 19,
      fontWeight: 'bold',
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      stroke: 0xC2185B,
      strokeThickness: 3,
    });
    this._huayuanText.anchor.set(0.5, 0.5);
    this._huayuanText.position.set(HYUAN_CX, CURRENCY_TEXT_CY);
    this.addChild(this._huayuanText);
  }

  /* ============== 钻石（与体力条同系粉框胶囊 + 叠压宝石 + 同款绿圆加号） ============== */

  private _buildDiamondPill(): void {
    /** 胶囊竖直居中于 BAR_MID_Y，宝石中心落在 BAR_MID_Y */
    const topY = Math.round(BAR_MID_Y - GEM_BAR_H / 2);
    const root = new PIXI.Container();
    root.position.set(DIAMOND_LP, topY);
    this._diamondBar = root;

    const barX = 16;
    const barW = GEM_BAR_W + 4;
    const barH = GEM_BAR_H;
    const barR = GEM_BAR_R;

    const outer = new PIXI.Graphics();
    outer.lineStyle(2, C.CAPSULE_RIM, 1);
    outer.beginFill(C.CAPSULE_FACE);
    outer.drawRoundedRect(barX, 0, barW, barH, barR);
    outer.endFill();
    root.addChild(outer);

    const ins = 3;
    const ir = Math.max(5, barR - ins);
    const inner = new PIXI.Graphics();
    inner.lineStyle(1.1, C.CAPSULE_INSET, 0.8);
    inner.beginFill(0xF7F5F0);
    inner.drawRoundedRect(barX + ins, ins, barW - ins * 2, barH - ins * 2, ir);
    inner.endFill();
    root.addChild(inner);

    const gemWrap = new PIXI.Container();
    gemWrap.position.set(22, GEM_BAR_H / 2);
    const gemTex = TextureCache.get('icon_gem');
    if (gemTex) {
      const sp = new PIXI.Sprite(gemTex);
      sp.anchor.set(0.5);
      sp.width = GEM_ICON_SIZE;
      sp.height = GEM_ICON_SIZE;
      sp.position.set(0, 0);
      gemWrap.addChild(sp);
    } else {
      const fb = new PIXI.Text('💎', { fontSize: 28 });
      fb.anchor.set(0.5);
      gemWrap.addChild(fb);
    }
    const dPlus = this._createGreenCirclePlusButton();
    dPlus.position.set(GEM_ICON_SIZE * 0.22, GEM_ICON_SIZE * 0.28);
    dPlus.eventMode = 'static';
    dPlus.cursor = 'pointer';
    dPlus.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      // 暂不接入购买/获取，预留
    });
    gemWrap.addChild(dPlus);
    root.addChild(gemWrap);

    this._diamondText = new PIXI.Text('0', {
      fontSize: 19,
      fontWeight: 'bold',
      fill: C.TEXT_DARK,
      fontFamily: FONT_FAMILY,
    });
    this._diamondText.anchor.set(1, 0.5);
    this._diamondText.position.set(barX + barW - ins - 4, GEM_BAR_H / 2);
    root.addChild(this._diamondText);

    this.addChild(root);
  }

  /**
   * 体力闪电角 / 钻石宝石角共用的绿圆白「+」（与参考图一致：亮绿圆 + 底侧略深 + 细描边）
   */
  private _createGreenCirclePlusButton(): PIXI.Container {
    const r = 11;
    const root = new PIXI.Container();
    const hitPad = 4;
    root.hitArea = new PIXI.Rectangle(-r - hitPad, -r - hitPad, (r + hitPad) * 2, (r + hitPad) * 2);

    const body = new PIXI.Graphics();
    body.beginFill(C.PLUS_GREEN_DK, 0.95);
    body.drawEllipse(0, 2.2, r * 0.92, r * 0.42);
    body.endFill();
    body.beginFill(C.PLUS_GREEN);
    body.drawCircle(0, -0.5, r - 0.5);
    body.endFill();
    body.lineStyle(1.3, C.PLUS_RING, 0.95);
    body.drawCircle(0, -0.5, r - 0.5);
    body.endFill();
    root.addChild(body);

    const arm = 2.4;
    const len = r * 0.42;
    const cross = new PIXI.Graphics();
    cross.beginFill(C.TEXT_WHITE);
    cross.drawRoundedRect(-len, -arm / 2, len * 2, arm, 1.1);
    cross.drawRoundedRect(-arm / 2, -len, arm, len * 2, 1.1);
    cross.endFill();
    root.addChild(cross);

    return root;
  }

  /* ============== 事件 & 更新 ============== */

  private _bindEvents(): void {
    EventBus.on('currency:changed', () => this._updateAll());
    EventBus.on('currency:loaded', () => this._updateAll());
  }

  private _updateAll(): void {
    const s = CurrencyManager.state;
    const cap = CurrencyManager.staminaCap;
    this._staminaText.text = `${s.stamina}/${cap}`;
    this._hualuText.text = this._fmtNum(s.hualu);
    this._huayuanText.text = this._fmtNum(s.huayuan);
    this._diamondText.text = this._fmtNum(s.diamond);
    this._drawStaminaBar(s.stamina / cap);
  }

  /** 由外部 ticker 调用，刷新体力倒计时 */
  updateTimer(): void {
    const remain = CurrencyManager.staminaRecoverRemain;
    if (remain <= 0) {
      this._staminaTimer.text = '';
    } else {
      const m = Math.floor(remain / 60);
      const sec = Math.floor(remain % 60);
      this._staminaTimer.text = `${m}:${sec.toString().padStart(2, '0')}`;
    }
  }

  /* ============== 绘制工具 ============== */

  private _drawStaminaBar(ratio: number): void {
    const g = this._staminaFill;
    const { w, h } = this._staminaInner;
    const t = Math.min(1, Math.max(0, ratio));
    const fillW = Math.max(0, w * t);
    g.clear();
    if (fillW < 0.5) return;
    const rr = Math.min(h / 2 - 0.5, fillW / 2);
    g.beginFill(C.STAMINA_FILL);
    g.drawRoundedRect(0, 0, fillW, h, rr);
    g.endFill();
  }

  private _fmtNum(n: number): string {
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  }

  /** 获取花愿图标在 TopBar 内的中心坐标 */
  getHuayuanIconPos(): { x: number; y: number } {
    return { x: HYUAN_CX, y: CURRENCY_ICON_CY };
  }

  /** 获取花露图标在 TopBar 内的中心坐标 */
  getHualuIconPos(): { x: number; y: number } {
    return { x: HUALU_CX, y: CURRENCY_ICON_CY };
  }

  /** 获取钻石图标在 TopBar 内的中心坐标（与 _buildDiamondPill 内宝石精灵对齐） */
  getDiamondIconPos(): { x: number; y: number } {
    return { x: DIAMOND_LP + 22, y: BAR_MID_Y };
  }

  /** 花愿数值闪烁弹跳效果 */
  flashHuayuan(): void {
    this._flashText(this._huayuanText);
  }

  /** 花露数值闪烁弹跳效果 */
  flashHualu(): void {
    this._flashText(this._hualuText);
  }

  private _flashText(txt: PIXI.Text): void {
    const origSX = txt.scale.x;
    const origSY = txt.scale.y;
    TweenManager.to({
      target: txt.scale,
      props: { x: origSX * 1.5, y: origSY * 1.5 },
      duration: 0.15,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        TweenManager.to({
          target: txt.scale,
          props: { x: origSX, y: origSY },
          duration: 0.25,
          ease: Ease.easeOutBounce,
        });
      },
    });
  }
}
