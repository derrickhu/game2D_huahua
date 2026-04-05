/**
 * 大地图「许愿喷泉」缩略图：**叠在建筑图之上**的细闪点（ADD），无大圆框、无大白块。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';

type Speck = {
  nx: number;
  ny: number;
  phase: number;
  speed: number;
  /** 相对 thumb 边长的半径比例，约 0.01～0.018 */
  rFrac: number;
  color: number;
};

export class WishingFountainMapFxLayer extends PIXI.Container {
  private readonly _box: number;
  private readonly _g: PIXI.Graphics;
  private readonly _specks: Speck[];
  private readonly _boundTick: () => void;

  constructor(boxSize: number) {
    super();
    this.eventMode = 'none';
    this._box = boxSize;

    this._g = new PIXI.Graphics();
    this._g.blendMode = PIXI.BLEND_MODES.ADD;
    this._g.eventMode = 'none';
    this.addChild(this._g);

    const s = boxSize;
    /** 伪随机固定分布，避免每开地图变位 */
    const seeds: Omit<Speck, 'phase'>[] = [
      { nx: -0.28, ny: -0.42, speed: 2.8, rFrac: 0.014, color: 0xffffff },
      { nx: 0.08, ny: -0.48, speed: 3.4, rFrac: 0.011, color: 0xe8fbff },
      { nx: 0.32, ny: -0.36, speed: 2.2, rFrac: 0.012, color: 0xfff8e8 },
      { nx: -0.12, ny: -0.22, speed: 3.1, rFrac: 0.009, color: 0xffffff },
      { nx: 0.22, ny: -0.18, speed: 2.6, rFrac: 0.013, color: 0xffeecc },
      { nx: -0.35, ny: -0.08, speed: 3.7, rFrac: 0.01, color: 0xd8f8ff },
      { nx: 0.38, ny: 0.02, speed: 2.4, rFrac: 0.012, color: 0xffffff },
      { nx: -0.08, ny: 0.06, speed: 3.2, rFrac: 0.008, color: 0xfff5dc },
      { nx: 0.18, ny: 0.14, speed: 2.9, rFrac: 0.011, color: 0xe0f4ff },
      { nx: -0.25, ny: 0.18, speed: 3.5, rFrac: 0.01, color: 0xffffff },
      { nx: 0.02, ny: -0.32, speed: 2.1, rFrac: 0.015, color: 0xfffcf0 },
      { nx: -0.18, ny: -0.38, speed: 3.0, rFrac: 0.009, color: 0xc8ecff },
      { nx: 0.28, ny: -0.08, speed: 3.3, rFrac: 0.01, color: 0xffffff },
      { nx: -0.04, ny: -0.12, speed: 2.7, rFrac: 0.012, color: 0xfff0c8 },
      { nx: 0.14, ny: -0.44, speed: 3.6, rFrac: 0.008, color: 0xf0fcff },
    ];
    this._specks = seeds.map((se, i) => ({
      ...se,
      phase: (i * 0.73) % (Math.PI * 2),
    }));

    this._boundTick = this._onTick.bind(this);
    Game.ticker.add(this._boundTick, this);
  }

  /** 亮峰略宽于 v1，避免几乎全暗；峰值仍偏「点闪」 */
  private static _twinkle(phase: number): number {
    const u = (Math.sin(phase) + 1) * 0.5;
    return Math.pow(u, 3.2);
  }

  private _onTick(): void {
    if (!this.parent) return;
    const dt = Game.ticker.deltaMS * 0.001;
    const s = this._box;
    const g = this._g;
    g.clear();

    for (const sp of this._specks) {
      sp.phase += dt * sp.speed * 6.5;
      const w = WishingFountainMapFxLayer._twinkle(sp.phase);

      const cx = sp.nx * s * 0.52;
      const cy = sp.ny * s * 0.52 - s * 0.04;
      const bob = Math.sin(sp.phase * 1.7) * s * 0.006;
      const r = Math.max(0.85, sp.rFrac * s * 1.12);
      const aCore = 0.12 + 0.78 * w;

      if (w < 0.04) {
        g.beginFill(sp.color, aCore * 0.35);
        g.drawCircle(cx, cy + bob, r * 0.9);
        g.endFill();
        continue;
      }

      g.beginFill(sp.color, aCore * 0.5);
      g.drawCircle(cx, cy + bob, r * 1.05);
      g.endFill();
      g.beginFill(0xffffff, aCore);
      g.drawCircle(cx, cy + bob, r * 0.42);
      g.endFill();
    }
  }

  override destroy(options?: PIXI.IDestroyOptions | boolean): void {
    Game.ticker.remove(this._boundTick, this);
    super.destroy(options);
  }
}
