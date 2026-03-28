/**
 * 触觉反馈系统 - 合成爽感增强
 *
 * 结合硬件震动 + 屏幕抖动 + 粒子爆发，
 * 让合成操作产生强烈的"爽"感。
 *
 * 震动等级：
 * - 普通合成：轻震 + 微抖 + 小粒子
 * - 连击合成(3+)：中震 + 中抖 + 中粒子
 * - 大连击(5+)：中震 + 大抖 + 大粒子 + 缩放脉冲
 * - 狂热模式(10+)：长震 + 强抖 + 超大粒子 + 全屏闪光
 * - 传说连击(15+)：长震×2 + 持续抖动 + 星爆粒子
 */
import * as PIXI from 'pixi.js';
import { Platform } from '@/core/PlatformService';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import {
  DESIGN_WIDTH, BoardMetrics, BOARD_COLS, CELL_GAP, COLORS,
} from '@/config/Constants';

/** 粒子颜色组 */
const MERGE_PARTICLE_COLORS = [0xFFD700, 0xFF8C00, 0xFFB74D, 0xFFE4B5, 0xFF6B6B];
const FRENZY_PARTICLE_COLORS = [0xFF4500, 0xFF6347, 0xFFD700, 0xFF8C00, 0xFFA07A, 0xFF69B4];
const LEGENDARY_PARTICLE_COLORS = [0xFF00FF, 0x00FFFF, 0xFFD700, 0xFF4500, 0x7B68EE, 0x00FF00];

/** 单个粒子 */
interface Particle {
  gfx: PIXI.Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  gravity: number;
  scale: number;
  rotation: number;
  rotSpeed: number;
}

export class HapticSystem {
  private _container: PIXI.Container;
  /** 屏幕抖动的目标容器（场景 container，而非 Game.stage） */
  private _shakeTarget: PIXI.Container;
  private _particles: Particle[] = [];
  private _screenShakeOffset = { x: 0, y: 0 };
  private _shakeTimer = 0;
  private _shakeIntensity = 0;
  /** 用户设置：是否开启震动 */
  private _vibrationEnabled = true;
  /** 用户设置：是否开启屏幕特效 */
  private _effectsEnabled = true;

  /**
   * @param parent 粒子挂载的父容器
   * @param shakeTarget 屏幕抖动作用的容器（通常是场景的 container），
   *                    不再修改 Game.stage.pivot 以避免场景切换后坐标系污染
   */
  constructor(parent: PIXI.Container, shakeTarget?: PIXI.Container) {
    this._container = new PIXI.Container();
    this._container.zIndex = 100;
    parent.addChild(this._container);

    this._shakeTarget = shakeTarget || parent;

    this._loadSettings();
    this._bindEvents();
  }

  // ═══════════════ 事件绑定 ═══════════════

  private _bindEvents(): void {
    // 合成成功
    EventBus.on('board:merged', (_src: number, _dst: number, _resultId: string, resultCell: number) => {
      this._onMergeSuccess(resultCell);
    });

    // 连击
    EventBus.on('combo:hit', (count: number) => {
      this._onComboHit(count);
    });

    // 狂热开始
    EventBus.on('combo:frenzyStart', () => {
      this._onFrenzyStart();
    });

    // 合成溢出
    EventBus.on('combo:overflow', (cellIndex: number, _resultId: string) => {
      this._onOverflow(cellIndex);
    });

    // 升级
    EventBus.on('level:up', () => {
      this._onLevelUp();
    });

    // 成就解锁
    EventBus.on('achievement:unlocked', () => {
      if (this._vibrationEnabled) Platform.vibrateShort('medium');
    });

    // 格子解锁
    EventBus.on('board:cellUnlocked', () => {
      if (this._vibrationEnabled) Platform.vibrateShort('light');
    });

    // 宝箱打开 / 建筑产出
    EventBus.on('building:produced', () => {
      if (this._vibrationEnabled) Platform.vibrateShort('light');
    });
  }

  // ═══════════════ 合成反馈 ═══════════════

  /** 普通合成成功 */
  private _onMergeSuccess(cellIndex: number): void {
    // 轻震
    if (this._vibrationEnabled) {
      Platform.vibrateShort('light');
    }

    // 粒子爆发
    if (this._effectsEnabled) {
      const pos = this._getCellWorldPos(cellIndex);
      this._spawnMergeParticles(pos.x, pos.y, 6, MERGE_PARTICLE_COLORS, 1.0);
    }

    // 微抖
    this._shakeScreen(0.08, 2);
  }

  /** 连击反馈 */
  private _onComboHit(count: number): void {
    if (count < 2) return;

    if (count >= 15) {
      // 传说连击
      if (this._vibrationEnabled) Platform.vibrateLong();
      this._shakeScreen(0.4, 6);
      if (this._effectsEnabled) this._flashScreen(0xFFD700, 0.15, 0.5);
    } else if (count >= 10) {
      // 狂热连击
      if (this._vibrationEnabled) Platform.vibrateLong();
      this._shakeScreen(0.3, 5);
    } else if (count >= 5) {
      // 大连击
      if (this._vibrationEnabled) Platform.vibrateShort('heavy');
      this._shakeScreen(0.2, 4);
    } else if (count >= 3) {
      // 小连击
      if (this._vibrationEnabled) Platform.vibrateShort('medium');
      this._shakeScreen(0.12, 3);
    }
  }

  /** 狂热模式开始 */
  private _onFrenzyStart(): void {
    if (this._vibrationEnabled) Platform.vibrateLong();

    if (this._effectsEnabled) {
      // 全屏金色闪光
      this._flashScreen(0xFFD700, 0.2, 0.8);

      // 全屏粒子爆发
      const cx = DESIGN_WIDTH / 2;
      const cy = Game.logicHeight / 2;
      this._spawnMergeParticles(cx, cy, 30, FRENZY_PARTICLE_COLORS, 2.5);
    }
  }

  /** 合成溢出 */
  private _onOverflow(cellIndex: number): void {
    if (this._vibrationEnabled) Platform.vibrateShort('heavy');

    if (this._effectsEnabled) {
      const pos = cellIndex >= 0
        ? this._getCellWorldPos(cellIndex)
        : { x: DESIGN_WIDTH / 2, y: Game.logicHeight / 2 };
      this._spawnMergeParticles(pos.x, pos.y, 12, FRENZY_PARTICLE_COLORS, 1.5);
    }
  }

  /** 升级 */
  private _onLevelUp(): void {
    if (this._vibrationEnabled) Platform.vibrateLong();

    if (this._effectsEnabled) {
      const cx = DESIGN_WIDTH / 2;
      const cy = Game.logicHeight * 0.35;
      this._spawnMergeParticles(cx, cy, 20, LEGENDARY_PARTICLE_COLORS, 2.0);
      this._flashScreen(0xFFFFFF, 0.12, 0.4);
    }
  }

  // ═══════════════ 粒子系统 ═══════════════

  /** 生成合成粒子爆发 */
  private _spawnMergeParticles(
    cx: number, cy: number,
    count: number,
    colors: number[],
    speedScale: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = (60 + Math.random() * 80) * speedScale;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 2 + Math.random() * 4;

      const gfx = new PIXI.Graphics();

      // 随机粒子形状（圆/方/星）
      const shape = Math.random();
      if (shape < 0.5) {
        gfx.beginFill(color, 0.9);
        gfx.drawCircle(0, 0, size);
        gfx.endFill();
      } else if (shape < 0.8) {
        gfx.beginFill(color, 0.85);
        gfx.drawRoundedRect(-size, -size, size * 2, size * 2, 1);
        gfx.endFill();
      } else {
        // 小星星
        this._drawStar(gfx, color, size * 1.5);
      }

      gfx.position.set(cx, cy);
      this._container.addChild(gfx);

      const particle: Particle = {
        gfx,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30, // 初始向上偏移
        life: 0.6 + Math.random() * 0.5,
        maxLife: 0.6 + Math.random() * 0.5,
        gravity: 120 + Math.random() * 80,
        scale: 1 + Math.random() * 0.5,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
      };
      particle.maxLife = particle.life;
      gfx.scale.set(particle.scale);
      this._particles.push(particle);
    }
  }

  /** 绘制小星星形状 */
  private _drawStar(gfx: PIXI.Graphics, color: number, radius: number): void {
    gfx.beginFill(color, 0.9);
    const points: number[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? radius : radius * 0.4;
      points.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    gfx.drawPolygon(points);
    gfx.endFill();
  }

  // ═══════════════ 屏幕效果 ═══════════════

  /** 屏幕抖动 */
  private _shakeScreen(duration: number, intensity: number): void {
    if (!this._effectsEnabled) return;
    this._shakeTimer = duration;
    this._shakeIntensity = Math.max(this._shakeIntensity, intensity);
  }

  /** 全屏闪光 */
  private _flashScreen(color: number, alpha: number, duration: number): void {
    const flash = new PIXI.Graphics();
    flash.beginFill(color, alpha);
    flash.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    flash.endFill();
    flash.alpha = 1;
    this._container.addChild(flash);

    TweenManager.to({
      target: flash,
      props: { alpha: 0 },
      duration: duration,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        this._container.removeChild(flash);
        flash.destroy();
      },
    });
  }

  // ═══════════════ 每帧更新 ═══════════════

  update(dt: number): void {
    // 更新粒子
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this._container.removeChild(p.gfx);
        p.gfx.destroy();
        this._particles.splice(i, 1);
        continue;
      }

      // 运动
      p.vx *= 0.98; // 空气阻力
      p.vy += p.gravity * dt;
      p.gfx.x += p.vx * dt;
      p.gfx.y += p.vy * dt;
      p.gfx.rotation += p.rotSpeed * dt;

      // 透明度和缩放衰减
      const lifeRatio = p.life / p.maxLife;
      p.gfx.alpha = lifeRatio;
      const s = p.scale * (0.3 + 0.7 * lifeRatio);
      p.gfx.scale.set(s);
    }

    // 更新屏幕抖动 —— 作用于场景容器而不是 stage，避免影响全局渲染
    if (this._shakeTimer > 0) {
      this._shakeTimer -= dt;
      const intensity = this._shakeIntensity * Math.min(1, this._shakeTimer * 8);
      this._screenShakeOffset.x = (Math.random() - 0.5) * intensity * 2;
      this._screenShakeOffset.y = (Math.random() - 0.5) * intensity * 2;

      // 应用到场景容器（而非 Game.stage，避免 pivot 污染全局坐标系）
      this._shakeTarget.position.set(this._screenShakeOffset.x, this._screenShakeOffset.y);

      if (this._shakeTimer <= 0) {
        this._shakeIntensity = 0;
        this._shakeTarget.position.set(0, 0);
      }
    }
  }

  /** 立即停止所有效果并恢复状态（场景退出时调用） */
  stopAll(): void {
    // 停止屏幕抖动，恢复位置
    this._shakeTimer = 0;
    this._shakeIntensity = 0;
    this._screenShakeOffset.x = 0;
    this._screenShakeOffset.y = 0;
    this._shakeTarget.position.set(0, 0);

    // 清理所有粒子
    for (const p of this._particles) {
      this._container.removeChild(p.gfx);
      p.gfx.destroy();
    }
    this._particles.length = 0;
  }

  // ═══════════════ 设置 ═══════════════

  get vibrationEnabled(): boolean { return this._vibrationEnabled; }
  set vibrationEnabled(v: boolean) {
    this._vibrationEnabled = v;
    this._saveSettings();
  }

  get effectsEnabled(): boolean { return this._effectsEnabled; }
  set effectsEnabled(v: boolean) {
    this._effectsEnabled = v;
    this._saveSettings();
  }

  private _saveSettings(): void {
    Platform.setStorageSync('huahua_haptic', JSON.stringify({
      vibration: this._vibrationEnabled,
      effects: this._effectsEnabled,
    }));
  }

  private _loadSettings(): void {
    try {
      const raw = Platform.getStorageSync('huahua_haptic');
      if (raw) {
        const data = JSON.parse(raw);
        this._vibrationEnabled = data.vibration !== false;
        this._effectsEnabled = data.effects !== false;
      }
    } catch (_) {}
  }

  // ═══════════════ 工具 ═══════════════

  private _getCellWorldPos(cellIndex: number): { x: number; y: number } {
    const cs = BoardMetrics.cellSize;
    const col = cellIndex % BOARD_COLS;
    const row = Math.floor(cellIndex / BOARD_COLS);
    return {
      x: BoardMetrics.paddingX + col * (cs + CELL_GAP) + cs / 2,
      y: BoardMetrics.topY + row * (cs + CELL_GAP) + cs / 2,
    };
  }
}
