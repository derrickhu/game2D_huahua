/**
 * 顶部信息栏 - 参考四季物语/Merge Mansion 风格
 *
 * 较大的胶囊指示器，图标有明显色差和辨识度
 * 所有元素控制在微信胶囊按钮左侧
 *
 * 布局：[Lv 圆徽章]  [⚡体力胶囊]  [💰金币胶囊]  [💎钻石胶囊]
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { STAMINA_MAX, FONT_FAMILY } from '@/config/Constants';

/** TopBar 对外暴露的逻辑高度（设计坐标） */
export const TOP_BAR_HEIGHT = 60;

const PILL_H = 38;
const PILL_R = PILL_H / 2;
const ICON_SIZE = 34;
const ICON_R = ICON_SIZE / 2;
const PY = Math.round((TOP_BAR_HEIGHT - PILL_H) / 2);

// ── 水平布局 ──
// 等级：圆形徽章
const LVL_X = 14;
const LVL_D = 44; // 直径
// 体力胶囊
const STA_X = LVL_X + LVL_D + 10;   // 68
const STA_W = 172;
// 金币胶囊
const GOLD_X = STA_X + STA_W + 10;   // 250
const GOLD_W = 110;
// 钻石胶囊
const DIA_X = GOLD_X + GOLD_W + 10;  // 370
const DIA_W = 110;
// 统计按钮位置（钻石胶囊右侧）
const STATS_X = DIA_X + DIA_W + 10;  // 490
// 最右端 490+32 = 522，安全范围内

// ── 颜色 ──
const C = {
  LEVEL_BG:    0xFF7043,
  LEVEL_RING:  0xFFAB91,
  STAMINA_BG:  0x43A047, // 参考四季物语的绿色体力条
  STAMINA_DARK:0x2E7D32,
  GOLD_BG:     0xF9A825,
  GOLD_DARK:   0xE65100,
  DIAMOND_BG:  0xAB47BC, // 紫色，与金色形成强反差
  DIAMOND_DARK:0x7B1FA2,
  TEXT_WHITE:   0xFFFFFF,
  TIMER_TEXT:   0xC8E6C9,
};

export class TopBar extends PIXI.Container {
  private _levelText!: PIXI.Text;
  private _staminaText!: PIXI.Text;
  private _staminaTimer!: PIXI.Text;
  private _staminaBar!: PIXI.Graphics;
  private _goldText!: PIXI.Text;
  private _diamondText!: PIXI.Text;

  constructor() {
    super();
    this._buildLevelBadge();
    this._buildStaminaPill();
    this._buildGoldPill();
    this._buildDiamondPill();
    this._buildStatsBtn();
    this._bindEvents();
    this._updateAll();
  }

  /* ============== 等级圆形徽章 ============== */

  private _buildLevelBadge(): void {
    const cx = LVL_X + LVL_D / 2;
    const cy = TOP_BAR_HEIGHT / 2;

    // 外圈光环
    const ring = new PIXI.Graphics();
    ring.lineStyle(3, C.LEVEL_RING, 0.6);
    ring.drawCircle(cx, cy, LVL_D / 2);
    this.addChild(ring);

    // 填充圆
    const bg = new PIXI.Graphics();
    bg.beginFill(C.LEVEL_BG);
    bg.drawCircle(cx, cy, LVL_D / 2 - 2);
    bg.endFill();
    this.addChild(bg);

    this._levelText = new PIXI.Text('Lv.1', {
      fontSize: 16,
      fontWeight: 'bold',
      fill: C.TEXT_WHITE,
      fontFamily: FONT_FAMILY,
    });
    this._levelText.anchor.set(0.5);
    this._levelText.position.set(cx, cy);
    this.addChild(this._levelText);
  }

  /* ============== 体力胶囊（绿色，参考四季物语） ============== */

  private _buildStaminaPill(): void {
    // 胶囊背景（深色底 + 浅色覆盖，营造渐变感）
    const bg = new PIXI.Graphics();
    bg.beginFill(C.STAMINA_DARK);
    bg.drawRoundedRect(STA_X, PY, STA_W, PILL_H, PILL_R);
    bg.endFill();
    bg.beginFill(C.STAMINA_BG, 0.85);
    bg.drawRoundedRect(STA_X, PY, STA_W, PILL_H - 4, PILL_R);
    bg.endFill();
    this.addChild(bg);

    // 闪电图标圆底
    const ix = STA_X + 3 + ICON_R;
    const iy = PY + PILL_H / 2;
    const iconBg = new PIXI.Graphics();
    iconBg.beginFill(0xFFEB3B); // 亮黄
    iconBg.drawCircle(ix, iy, ICON_R);
    iconBg.endFill();
    // 外环
    iconBg.lineStyle(2, 0xFBC02D);
    iconBg.drawCircle(ix, iy, ICON_R);
    this.addChild(iconBg);

    // 闪电符号
    const bolt = new PIXI.Graphics();
    bolt.beginFill(0xE65100);
    this._drawBolt(bolt, ix, iy, 10);
    bolt.endFill();
    this.addChild(bolt);

    // 体力数值
    this._staminaText = new PIXI.Text('50/100', {
      fontSize: 16,
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

    // 恢复倒计时（数值右侧）
    this._staminaTimer = new PIXI.Text('', {
      fontSize: 11,
      fill: C.TIMER_TEXT,
      fontFamily: FONT_FAMILY,
    });
    this._staminaTimer.anchor.set(1, 0.5);
    this._staminaTimer.position.set(STA_X + STA_W - 10, PY + PILL_H / 2);
    this.addChild(this._staminaTimer);

    // "+" 按钮（右侧圆形）
    this._drawPlusBtn(STA_X + STA_W - 2, PY + PILL_H / 2, C.STAMINA_DARK);
  }

  /* ============== 金币胶囊（金黄色） ============== */

  private _buildGoldPill(): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(C.GOLD_DARK);
    bg.drawRoundedRect(GOLD_X, PY, GOLD_W, PILL_H, PILL_R);
    bg.endFill();
    bg.beginFill(C.GOLD_BG, 0.85);
    bg.drawRoundedRect(GOLD_X, PY, GOLD_W, PILL_H - 4, PILL_R);
    bg.endFill();
    this.addChild(bg);

    // 金币图标
    const ix = GOLD_X + 3 + ICON_R;
    const iy = PY + PILL_H / 2;
    const coinBg = new PIXI.Graphics();
    coinBg.beginFill(0xFFF176);
    coinBg.drawCircle(ix, iy, ICON_R);
    coinBg.endFill();
    coinBg.lineStyle(2, 0xF9A825);
    coinBg.drawCircle(ix, iy, ICON_R - 1);
    this.addChild(coinBg);

    // "$" 符号
    const sym = new PIXI.Text('$', {
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xE65100,
      fontFamily: FONT_FAMILY,
    });
    sym.anchor.set(0.5);
    sym.position.set(ix, iy);
    this.addChild(sym);

    // 数值
    this._goldText = new PIXI.Text('100', {
      fontSize: 16,
      fontWeight: 'bold',
      fill: C.TEXT_WHITE,
      fontFamily: FONT_FAMILY,
    });
    this._goldText.anchor.set(0, 0.5);
    this._goldText.position.set(GOLD_X + ICON_SIZE + 10, PY + PILL_H / 2);
    this.addChild(this._goldText);

    // "+"
    this._drawPlusBtn(GOLD_X + GOLD_W - 2, PY + PILL_H / 2, C.GOLD_DARK);
  }

  /* ============== 钻石胶囊（紫色，与金色高反差） ============== */

  private _buildDiamondPill(): void {
    const bg = new PIXI.Graphics();
    bg.beginFill(C.DIAMOND_DARK);
    bg.drawRoundedRect(DIA_X, PY, DIA_W, PILL_H, PILL_R);
    bg.endFill();
    bg.beginFill(C.DIAMOND_BG, 0.85);
    bg.drawRoundedRect(DIA_X, PY, DIA_W, PILL_H - 4, PILL_R);
    bg.endFill();
    this.addChild(bg);

    // 钻石图标
    const ix = DIA_X + 3 + ICON_R;
    const iy = PY + PILL_H / 2;
    const diamBg = new PIXI.Graphics();
    diamBg.beginFill(0xCE93D8); // 浅紫底
    diamBg.drawCircle(ix, iy, ICON_R);
    diamBg.endFill();
    this.addChild(diamBg);

    const diam = new PIXI.Graphics();
    this._drawDiamond(diam, ix, iy, 10);
    this.addChild(diam);

    // 数值
    this._diamondText = new PIXI.Text('10', {
      fontSize: 16,
      fontWeight: 'bold',
      fill: C.TEXT_WHITE,
      fontFamily: FONT_FAMILY,
    });
    this._diamondText.anchor.set(0, 0.5);
    this._diamondText.position.set(DIA_X + ICON_SIZE + 10, PY + PILL_H / 2);
    this.addChild(this._diamondText);

    // "+"
    this._drawPlusBtn(DIA_X + DIA_W - 2, PY + PILL_H / 2, C.DIAMOND_DARK);
  }

  /* ============== 合成统计按钮（📊图标） ============== */

  private _buildStatsBtn(): void {
    const cx = STATS_X + 16;
    const cy = TOP_BAR_HEIGHT / 2;
    const r = 16;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFFFF, 0.2);
    bg.drawCircle(cx, cy, r);
    bg.endFill();
    bg.lineStyle(1.5, 0xFFFFFF, 0.4);
    bg.drawCircle(cx, cy, r);
    this.addChild(bg);

    // 📊 用简易柱状图代替
    const icon = new PIXI.Graphics();
    icon.beginFill(0xFFFFFF, 0.9);
    icon.drawRect(cx - 7, cy - 2, 4, 10);
    icon.drawRect(cx - 1, cy - 7, 4, 15);
    icon.drawRect(cx + 5, cy - 4, 4, 12);
    icon.endFill();
    this.addChild(icon);

    const hitArea = new PIXI.Container();
    hitArea.hitArea = new PIXI.Circle(cx, cy, r + 6);
    hitArea.eventMode = 'static';
    hitArea.cursor = 'pointer';
    hitArea.on('pointerdown', () => {
      EventBus.emit('stats:open');
    });
    this.addChild(hitArea);
  }

  /* ============== 事件 & 更新 ============== */

  private _bindEvents(): void {
    EventBus.on('currency:changed', () => this._updateAll());
    EventBus.on('currency:loaded', () => this._updateAll());
  }

  private _updateAll(): void {
    const s = CurrencyManager.state;
    this._levelText.text = `Lv.${s.level}`;
    this._staminaText.text = `${s.stamina}/${STAMINA_MAX}`;
    this._goldText.text = this._fmtNum(s.gold);
    this._diamondText.text = this._fmtNum(s.diamond);
    this._drawStaminaBar(s.stamina / STAMINA_MAX);
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

  /** 体力进度条 */
  private _drawStaminaBar(ratio: number): void {
    const g = this._staminaBar;
    const w = 90, h = 4;
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

  /** 胶囊右侧 "+" 圆形按钮 */
  private _drawPlusBtn(cx: number, cy: number, color: number): void {
    const r = 11;
    const g = new PIXI.Graphics();
    g.beginFill(0xFFFFFF);
    g.drawCircle(cx, cy, r);
    g.endFill();
    g.beginFill(color);
    g.drawCircle(cx, cy, r - 1.5);
    g.endFill();
    // "+" 十字
    g.beginFill(0xFFFFFF);
    g.drawRect(cx - 4, cy - 1, 8, 2);
    g.drawRect(cx - 1, cy - 4, 2, 8);
    g.endFill();
    this.addChild(g);
  }

  /** 闪电符号 */
  private _drawBolt(g: PIXI.Graphics, cx: number, cy: number, size: number): void {
    const s = size / 9;
    g.moveTo(cx + 1 * s, cy - 5 * s);
    g.lineTo(cx - 2 * s, cy + 0.5 * s);
    g.lineTo(cx + 0.5 * s, cy + 0.5 * s);
    g.lineTo(cx - 1 * s, cy + 5 * s);
    g.lineTo(cx + 2 * s, cy - 0.5 * s);
    g.lineTo(cx - 0.5 * s, cy - 0.5 * s);
    g.closePath();
  }

  /** 钻石形状 */
  private _drawDiamond(g: PIXI.Graphics, cx: number, cy: number, size: number): void {
    // 主体
    g.beginFill(0xFFFFFF, 0.95);
    g.moveTo(cx, cy - size);
    g.lineTo(cx + size * 0.75, cy);
    g.lineTo(cx, cy + size * 0.6);
    g.lineTo(cx - size * 0.75, cy);
    g.closePath();
    g.endFill();
    // 高光面
    g.beginFill(0xE1BEE7, 0.5);
    g.moveTo(cx, cy - size);
    g.lineTo(cx + size * 0.75, cy);
    g.lineTo(cx, cy + size * 0.2);
    g.closePath();
    g.endFill();
  }

  private _fmtNum(n: number): string {
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  }
}
