/**
 * 棋盘「工具」物品上的高光闪星（程序 Graphics，非 Pixi 内置粒子库）
 * 造型参考合成类 UI：竖略长于横的四角尖星 + 白芯高对比 + ADD，小圆点作辅光点
 * 动态：轻量「下落」循环（格内短程飘落 + 微摆），贴近参考里星光下滑的感觉
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';

type SparkSpec = {
  nx: number;
  ny: number;
  sizeFrac: number;
  speed: number;
  phaseOff: number;
  /** 是否画辅光小圆点（图2 里大星旁的小白点） */
  dots: boolean;
};

/** 一大三小 + 错落相位；主星略大但勿压格（右上易显臃肿） */
const SPARKS: SparkSpec[] = [
  { nx: 0.72, ny: 0.30, sizeFrac: 0.105, speed: 1.2, phaseOff: 0, dots: true },
  { nx: 0.28, ny: 0.36, sizeFrac: 0.078, speed: 1.45, phaseOff: 1.2, dots: false },
  { nx: 0.55, ny: 0.60, sizeFrac: 0.064, speed: 1.3, phaseOff: 2.4, dots: true },
  { nx: 0.44, ny: 0.48, sizeFrac: 0.044, speed: 1.65, phaseOff: 3.7, dots: false },
];

/** sin→0..1 后幂次：略降幂让「亮」的占比更大，避免长时间几乎看不见 */
function flashCurve(phase: number, power: number): number {
  const u = (Math.sin(phase) + 1) * 0.5;
  return Math.pow(u, power);
}

const WHITE = 0xffffff;
/** 尖端极淡暖色，ADD 下仍偏白 */
const RAY_TIP = 0xfffef0;
const SOFT_HALO = 0xfffcf5;

/**
 * 图2 风格：竖轴略长于横轴的四角星 + 上下射线更长、左右略短 + 白芯
 */
function drawReferenceStyleSparkle(g: PIXI.Graphics, radius: number, withDots: boolean): void {
  g.clear();
  /** 竖向半轴 > 横向半轴，形成「高挑」四芒 */
  const rh = radius;
  const rw = radius * 0.38;
  const rbV = Math.max(0.85, radius * 0.11);
  const rbH = Math.max(0.75, radius * 0.09);
  const Lv = radius * 0.72;
  const Lh = radius * 0.48;

  const drawRayTri = (pts: number[], fill: number, alpha: number): void => {
    g.beginFill(fill, alpha);
    g.drawPolygon(pts);
    g.endFill();
  };

  // 最外柔光（略扩一圈，ADD 下像轻晕）
  const rh2 = rh * 1.08;
  const rw2 = rw * 1.1;
  g.beginFill(SOFT_HALO, 0.22);
  g.drawPolygon([0, -rh2, rw2, 0, 0, rh2, -rw2, 0]);
  g.endFill();

  // 射线：上下长、左右短，先画暖白再叠纯白芯
  drawRayTri([0, -rh - Lv, -rbV, -rh, rbV, -rh], RAY_TIP, 0.55);
  drawRayTri([0, rh + Lv, -rbV, rh, rbV, rh], RAY_TIP, 0.55);
  drawRayTri([-rh - Lh, 0, -rh, -rbH, -rh, rbH], RAY_TIP, 0.42);
  drawRayTri([rh + Lh, 0, rh, -rbH, rh, rbH], RAY_TIP, 0.42);

  drawRayTri([0, -rh - Lv * 0.92, -rbV * 0.85, -rh, rbV * 0.85, -rh], WHITE, 0.72);
  drawRayTri([0, rh + Lv * 0.92, -rbV * 0.85, rh, rbV * 0.85, rh], WHITE, 0.72);
  drawRayTri([-rh - Lh * 0.92, 0, -rh, -rbH * 0.85, -rh, rbH * 0.85], WHITE, 0.58);
  drawRayTri([rh + Lh * 0.92, 0, rh, -rbH * 0.85, rh, rbH * 0.85], WHITE, 0.58);

  // 芯：竖长横窄菱形，中心「过曝」白
  const core = [0, -rh, rw, 0, 0, rh, -rw, 0];
  g.beginFill(WHITE, 0.45);
  g.drawPolygon([0, -rh * 1.06, rw * 1.08, 0, 0, rh * 1.06, -rw * 1.08, 0]);
  g.endFill();
  g.beginFill(WHITE, 1);
  g.drawPolygon(core);
  g.endFill();

  if (withDots && radius > 6) {
    const d = radius * 0.07;
    const places: [number, number][] = [
      [rw * 1.9, -rh * 0.35],
      [-rw * 1.75, rh * 0.45],
      [rw * 0.4, rh * 0.92],
    ];
    for (const [dx, dy] of places) {
      g.beginFill(WHITE, 0.85);
      g.drawCircle(dx, dy, d);
      g.endFill();
      g.beginFill(WHITE, 0.25);
      g.drawCircle(dx, dy, d * 1.8);
      g.endFill();
    }
  }
}

export class ToolSparkleLayer extends PIXI.Container {
  private readonly _stars: PIXI.Graphics[] = [];
  private readonly _phases: number[] = [];
  private readonly _speeds: number[] = [];
  private readonly _powers: number[] = [];
  /** 下落路径：锚点（格内局部坐标） */
  private readonly _anchorX: number[] = [];
  private readonly _anchorY: number[] = [];
  /** 下落相位 ms，用于循环；与 _speeds 组合成不同飘落节奏 */
  private readonly _fallMs: number[] = [];
  private _fallSpan = 0;
  private _wigglePx = 0;
  private _boundTick!: () => void;

  constructor(boxW: number, boxH: number = boxW) {
    super();
    this.eventMode = 'none';
    /** 与底图相加，浅色格子上也更「刺」一眼 */
    this.blendMode = PIXI.BLEND_MODES.ADD;

    const short = Math.min(boxW, boxH);
    const pad = short * 0.11;
    const iw = boxW - pad * 2;
    const ih = boxH - pad * 2;

    /** 单颗星在格内的竖直飘落幅度（避免穿出格缘） */
    this._fallSpan = Math.min(ih, short) * 0.2;
    this._wigglePx = short * 0.022;

    const powers = [2.2, 2.9, 2.6, 3.1];

    for (let i = 0; i < SPARKS.length; i++) {
      const spec = SPARKS[i];
      const g = new PIXI.Graphics();
      g.blendMode = PIXI.BLEND_MODES.ADD;
      const r = short * spec.sizeFrac;
      drawReferenceStyleSparkle(g, r, spec.dots);
      const ax = pad + spec.nx * iw;
      const ay = pad + spec.ny * ih;
      g.position.set(ax, ay);
      this.addChild(g);
      this._stars.push(g);
      this._phases.push(spec.phaseOff + Math.random() * 0.4);
      this._speeds.push(spec.speed);
      this._powers.push(powers[i] ?? 3.5);
      this._anchorX.push(ax);
      this._anchorY.push(ay);
      /** 错开起点：整段下落周期约 2.8～4.2s，按 speed 微调 */
      this._fallMs.push(spec.phaseOff * 420 + Math.random() * 600);
    }

    this._boundTick = this._onTick.bind(this);
    Game.ticker.add(this._boundTick, this);
  }

  private _onTick(): void {
    if (!this.parent) return;
    const dt = Game.ticker.deltaMS;
    const rate = 0.0055;
    /** 下落一整趟的时间基数（ms），数值越小飘得越快 */
    const fallCycleBase = 3400;

    for (let i = 0; i < this._stars.length; i++) {
      this._phases[i] += dt * rate * this._speeds[i];
      const f = flashCurve(this._phases[i], this._powers[i]);
      // 低谷仍留一点底光，峰值拉满 → 更易辨认 + 仍有一闪的感觉
      this._stars[i].alpha = 0.1 + 0.9 * f;
      const sc = 0.76 + 0.26 * f;
      this._stars[i].scale.set(sc);
      this._stars[i].rotation = Math.sin(this._phases[i] * 0.85) * 0.06;

      this._fallMs[i] += dt * this._speeds[i];
      const cycle = fallCycleBase / this._speeds[i];
      const u = (this._fallMs[i] % cycle) / cycle;
      /** u:0→1 匀速下移；到底后循环回顶，形成连续下落 */
      const half = this._fallSpan * 0.5;
      const dy = -half + u * this._fallSpan;
      /** 轻微左右摆，避免纯竖直机械感 */
      const wobble = Math.sin(u * Math.PI * 2 + this._phases[i] * 0.4) * this._wigglePx;
      this._stars[i].position.set(this._anchorX[i] + wobble, this._anchorY[i] + dy);
    }
  }

  override destroy(options?: PIXI.IDestroyOptions | boolean): void {
    Game.ticker.remove(this._boundTick, this);
    super.destroy(options);
  }
}
