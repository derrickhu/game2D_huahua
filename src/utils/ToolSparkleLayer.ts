/**
 * 棋盘「工具」物品上的金光闪星
 * 造型参考常见合成游戏：中心实心菱形 + 四向渐细「针状」射线（程序可画，不必强依赖贴图；若要 1:1 美术可再换 Sprite）
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';

type SparkSpec = { nx: number; ny: number; sizeFrac: number; speed: number; phaseOff: number };

/** 4 颗：一大三小错落；尺寸控制在格内（含射线 + 脉冲缩放） */
const SPARKS: SparkSpec[] = [
  { nx: 0.72, ny: 0.30, sizeFrac: 0.125, speed: 1.15, phaseOff: 0 },
  { nx: 0.28, ny: 0.36, sizeFrac: 0.068, speed: 1.4, phaseOff: 1.2 },
  { nx: 0.55, ny: 0.60, sizeFrac: 0.056, speed: 1.25, phaseOff: 2.4 },
  { nx: 0.44, ny: 0.48, sizeFrac: 0.038, speed: 1.6, phaseOff: 3.7 },
];

/** 用 sin 得到 0..1 后拉高次幂 → 大部分时间暗、短促变亮 */
function flashCurve(phase: number, power: number): number {
  const u = (Math.sin(phase) + 1) * 0.5;
  return Math.pow(u, power);
}

/** 射线略浅、芯更亮、描边琥珀 */
const GOLD_RAY = 0xffd54a;
const GOLD_RAY_EDGE = 0xffa726;
const GOLD_CORE_SOFT = 0xffe082;
const GOLD_CORE = 0xfff9c4;
const GOLD_STROKE = 0xf57c00;

/**
 * 参考图式闪星：四向三角形射线（底边贴在菱形顶点外沿、收尖）+ 内外双层菱形芯，无大圆饼
 */
function drawReferenceStyleSparkle(g: PIXI.Graphics, radius: number): void {
  g.clear();
  const w = radius * 0.42;
  const rb = Math.max(0.9, radius * 0.14);
  /** 射线缩短，避免顶点穿出格缘（脉冲 scale 峰值约 1 时仍留余量） */
  const L = radius * 0.62;

  const drawRayTri = (pts: number[], fill: number, alpha: number, lineW: number, lineC: number): void => {
    g.beginFill(fill, alpha);
    g.drawPolygon(pts);
    g.endFill();
    if (lineW > 0) {
      g.lineStyle(lineW, lineC, 0.55);
      g.drawPolygon(pts);
      g.lineStyle(0);
    }
  };

  // 四向针状射线（先画，压在下面）
  drawRayTri([0, -radius - L, -rb, -radius, rb, -radius], GOLD_RAY, 0.82, 0.6, GOLD_RAY_EDGE);
  drawRayTri([0, radius + L, -rb, radius, rb, radius], GOLD_RAY, 0.82, 0.6, GOLD_RAY_EDGE);
  drawRayTri([-radius - L, 0, -radius, -rb, -radius, rb], GOLD_RAY, 0.82, 0.6, GOLD_RAY_EDGE);
  drawRayTri([radius + L, 0, radius, -rb, radius, rb], GOLD_RAY, 0.82, 0.6, GOLD_RAY_EDGE);

  // 外层略大菱形，柔一点过渡
  const r2 = radius * 1.04;
  const w2 = w * 1.04;
  const soft = [0, -r2, w2, 0, 0, r2, -w2, 0];
  g.beginFill(GOLD_CORE_SOFT, 0.55);
  g.drawPolygon(soft);
  g.endFill();

  const core = [0, -radius, w, 0, 0, radius, -w, 0];
  g.beginFill(GOLD_CORE, 1);
  g.drawPolygon(core);
  g.endFill();
  g.lineStyle(1.35, GOLD_STROKE, 0.92);
  g.drawPolygon(core);
  g.lineStyle(0);
}

export class ToolSparkleLayer extends PIXI.Container {
  private readonly _stars: PIXI.Graphics[] = [];
  private readonly _phases: number[] = [];
  private readonly _speeds: number[] = [];
  private readonly _powers: number[] = [];
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

    const powers = [2.8, 3.5, 3.2, 4.2];

    for (let i = 0; i < SPARKS.length; i++) {
      const spec = SPARKS[i];
      const g = new PIXI.Graphics();
      g.blendMode = PIXI.BLEND_MODES.ADD;
      const r = short * spec.sizeFrac;
      drawReferenceStyleSparkle(g, r);
      g.position.set(pad + spec.nx * iw, pad + spec.ny * ih);
      this.addChild(g);
      this._stars.push(g);
      this._phases.push(spec.phaseOff + Math.random() * 0.4);
      this._speeds.push(spec.speed);
      this._powers.push(powers[i] ?? 3.5);
    }

    this._boundTick = this._onTick.bind(this);
    Game.ticker.add(this._boundTick, this);
  }

  private _onTick(): void {
    if (!this.parent) return;
    const dt = Game.ticker.deltaMS;
    const rate = 0.0038;

    for (let i = 0; i < this._stars.length; i++) {
      this._phases[i] += dt * rate * this._speeds[i];
      const f = flashCurve(this._phases[i], this._powers[i]);
      // 低谷几乎看不见，峰值拉满 → 「很闪」
      this._stars[i].alpha = 0.02 + 0.98 * f;
      // 峰值不超过 1，避免闪一下时顶穿格子
      const sc = 0.68 + 0.32 * f;
      this._stars[i].scale.set(sc);
      // 与参考图一致：保持竖横轴向，不旋转
      this._stars[i].rotation = 0;
    }
  }

  override destroy(options?: PIXI.IDestroyOptions | boolean): void {
    Game.ticker.remove(this._boundTick, this);
    super.destroy(options);
  }
}
