/**
 * 顶部信息栏
 *
 * 布局：[⭐Lv.5]  [⚡体力胶囊 105/105 进度条 倒计时 +]  [🌿花露 数值]  [💎花愿 数值]  [📊]
 *
 * - 等级：星星图标，Lv 文字叠在星星内部
 * - 体力：胶囊进度条 + 恢复倒计时 + 加号按钮
 * - 花露/花愿：图标上方 + 数值下方，紧凑排列
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';

export const TOP_BAR_HEIGHT = 60;

const PILL_H = 42;
const PILL_R = PILL_H / 2;
const PY = Math.round((TOP_BAR_HEIGHT - PILL_H) / 2);

// ── 水平布局 ──
const LVL_X = 12;
const LVL_D = 48;                       // 等级徽章直径
const STA_X = LVL_X + LVL_D + 8;       // 68
const STA_W = 158;

// 花露/花愿：上图标+下文字叠排，文字压在图标底边（参考星星样式）
const CURRENCY_ICON    = 46;            // 图标尺寸（加大）
const CURRENCY_ICON_CY = 19;           // 图标中心 y（偏上，让图标占据上半区）
const CURRENCY_TEXT_CY = CURRENCY_ICON_CY + CURRENCY_ICON / 2 - 4; // 文字中心压在图标底边

const HUALU_CX  = STA_X + STA_W + 42;  // 花露图标中心 x（与体力条留足间距）
const HYUAN_CX  = HUALU_CX + 64;       // 花愿图标中心 x（间距加大）
const STATS_CX  = HYUAN_CX + 58;       // 统计图标中心 x

// ── 颜色 ──
const C = {
  STAMINA_BG:   0x43A047,
  STAMINA_DARK: 0x2E7D32,
  TEXT_WHITE:   0xFFFFFF,
  TEXT_DARK:    0x5D4037,
  TIMER_TEXT:   0xC8E6C9,
};

export class TopBar extends PIXI.Container {
  private _levelText!: PIXI.Text;
  private _staminaText!: PIXI.Text;
  private _staminaTimer!: PIXI.Text;
  private _staminaBar!: PIXI.Graphics;
  private _hualuText!: PIXI.Text;
  private _huayuanText!: PIXI.Text;

  constructor() {
    super();
    this._buildLevelBadge();
    this._buildStaminaPill();
    this._buildHualu();
    this._buildHuayuan();
    this._buildStatsBtn();
    this._bindEvents();
    this._updateAll();
  }

  /* ============== 等级星星徽章（Lv 叠在星星内） ============== */

  private _buildLevelBadge(): void {
    const cx = LVL_X + LVL_D / 2;
    const cy = TOP_BAR_HEIGHT / 2;

    const tex = TextureCache.get('icon_star');
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.width = LVL_D;
      sp.height = LVL_D;
      sp.position.set(cx, cy);
      this.addChild(sp);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(0xFF7043);
      bg.drawCircle(cx, cy, LVL_D / 2 - 2);
      bg.endFill();
      this.addChild(bg);
    }

    this._levelText = new PIXI.Text('Lv.1', {
      fontSize: 14,
      fontWeight: 'bold',
      fill: C.TEXT_WHITE,
      fontFamily: FONT_FAMILY,
    });
    this._levelText.anchor.set(0.5);
    this._levelText.position.set(cx, cy + 1);
    this.addChild(this._levelText);
  }

  /* ============== 体力胶囊（保留进度条 + 倒计时 + 加号） ============== */

  private _buildStaminaPill(): void {
    const ICON_SIZE = 38;
    const ICON_R = ICON_SIZE / 2;

    // 胶囊背景
    const bg = new PIXI.Graphics();
    bg.beginFill(C.STAMINA_DARK);
    bg.drawRoundedRect(STA_X, PY, STA_W, PILL_H, PILL_R);
    bg.endFill();
    bg.beginFill(C.STAMINA_BG, 0.85);
    bg.drawRoundedRect(STA_X, PY, STA_W, PILL_H - 4, PILL_R);
    bg.endFill();
    this.addChild(bg);

    // 闪电图标
    const ix = STA_X + 3 + ICON_R;
    const iy = PY + PILL_H / 2;
    const energyTex = TextureCache.get('icon_energy');
    if (energyTex) {
      const sp = new PIXI.Sprite(energyTex);
      sp.anchor.set(0.5);
      sp.width = ICON_SIZE + 4;
      sp.height = ICON_SIZE + 4;
      sp.position.set(ix, iy);
      this.addChild(sp);
    } else {
      const iconBg = new PIXI.Graphics();
      iconBg.beginFill(0xFFEB3B);
      iconBg.drawCircle(ix, iy, ICON_R);
      iconBg.endFill();
      this.addChild(iconBg);
    }

    // 体力数值
    this._staminaText = new PIXI.Text('0/0', {
      fontSize: 18,
      fontWeight: 'bold',
      fill: C.TEXT_WHITE,
      fontFamily: FONT_FAMILY,
    });
    this._staminaText.anchor.set(0, 0.5);
    this._staminaText.position.set(STA_X + ICON_SIZE + 10, PY + PILL_H / 2 - 3);
    this.addChild(this._staminaText);

    // 迷你进度条
    this._staminaBar = new PIXI.Graphics();
    this._staminaBar.position.set(STA_X + ICON_SIZE + 10, PY + PILL_H - 8);
    this.addChild(this._staminaBar);

    // 恢复倒计时
    this._staminaTimer = new PIXI.Text('', {
      fontSize: 13,
      fill: C.TIMER_TEXT,
      fontFamily: FONT_FAMILY,
    });
    this._staminaTimer.anchor.set(1, 0.5);
    this._staminaTimer.position.set(STA_X + STA_W - 28, PY + PILL_H / 2);
    this.addChild(this._staminaTimer);

    // "+" 按钮
    this._drawPlusBtn(STA_X + STA_W - 2, PY + PILL_H / 2);
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

  /* ============== 统计按钮 ============== */

  private _buildStatsBtn(): void {
    const r = 20;
    const chartTex = TextureCache.get('icon_chart');
    if (chartTex) {
      const sp = new PIXI.Sprite(chartTex);
      sp.anchor.set(0.5);
      sp.width = r * 2;
      sp.height = r * 2;
      sp.position.set(STATS_CX, TOP_BAR_HEIGHT / 2);
      this.addChild(sp);
    }

    const hitArea = new PIXI.Container();
    hitArea.hitArea = new PIXI.Circle(STATS_CX, TOP_BAR_HEIGHT / 2, r + 6);
    hitArea.eventMode = 'static';
    hitArea.cursor = 'pointer';
    hitArea.on('pointerdown', () => EventBus.emit('stats:open'));
    this.addChild(hitArea);
  }

  /* ============== 加号按钮 ============== */

  private _drawPlusBtn(cx: number, cy: number): void {
    const r = 12;
    const plusTex = TextureCache.get('icon_plus');
    if (plusTex) {
      const sp = new PIXI.Sprite(plusTex);
      sp.anchor.set(0.5);
      sp.width = r * 2;
      sp.height = r * 2;
      sp.position.set(cx, cy);
      this.addChild(sp);
    } else {
      const g = new PIXI.Graphics();
      g.beginFill(0xFFFFFF);
      g.drawCircle(cx, cy, r);
      g.endFill();
      g.beginFill(C.STAMINA_DARK);
      g.drawCircle(cx, cy, r - 1.5);
      g.endFill();
      g.beginFill(0xFFFFFF);
      g.drawRect(cx - 4, cy - 1, 8, 2);
      g.drawRect(cx - 1, cy - 4, 2, 8);
      g.endFill();
      this.addChild(g);
    }
  }

  /* ============== 事件 & 更新 ============== */

  private _bindEvents(): void {
    EventBus.on('currency:changed', () => this._updateAll());
    EventBus.on('currency:loaded', () => this._updateAll());
  }

  private _updateAll(): void {
    const s = CurrencyManager.state;
    const cap = CurrencyManager.staminaCap;
    this._levelText.text = `Lv.${s.level}`;
    this._staminaText.text = `${s.stamina}/${cap}`;
    this._hualuText.text = this._fmtNum(s.hualu);
    this._huayuanText.text = this._fmtNum(s.huayuan);
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
    const g = this._staminaBar;
    const w = 80, h = 4;
    g.clear();
    g.beginFill(0x000000, 0.25);
    g.drawRoundedRect(0, 0, w, h, 2);
    g.endFill();
    if (ratio > 0) {
      g.beginFill(0xFFEB3B);
      g.drawRoundedRect(0, 0, Math.max(4, w * Math.min(1, ratio)), h, 2);
      g.endFill();
    }
  }

  private _fmtNum(n: number): string {
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  }
}
