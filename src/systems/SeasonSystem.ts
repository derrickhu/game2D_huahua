/**
 * 季节花语主题棋盘系统
 *
 * - 每7天(现实时间)切换一个季节：春→夏→秋→冬
 * - 棋盘背景色/格子边框/粒子效果随季节变化
 * - 各季节对特定花系/饮品线有合成加成（冷饮/甜品等，见 SeasonId）
 *
 * 加成规则：
 *   春天 → 日常花系 → 合成有20%概率跳级(产物额外+1级)
 *   夏天 → 冷饮线   → 生成器产出数量×2
 *   秋天 → 浪漫花系 → 合成经验×1.5
 *   冬天 → 甜品线   → 出售价格×2（getSellPriceMultiplier 当前未接入棋盘出售，API 保留）
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, FONT_FAMILY, BoardMetrics, BOARD_COLS, BOARD_ROWS, CELL_GAP } from '@/config/Constants';
import { Game } from '@/core/Game';

export enum Season {
  SPRING = 'spring',
  SUMMER = 'summer',
  AUTUMN = 'autumn',
  WINTER = 'winter',
}

export interface SeasonConfig {
  name: string;
  icon: string;
  bgColor: number;
  bgColor2: number;
  cellBorderColor: number;
  particleColor: number;
  particleEmoji: string;
  bonusLine: string;       // 加成的 line
  bonusDesc: string;       // 加成描述
}

const SEASON_CONFIGS: Record<Season, SeasonConfig> = {
  [Season.SPRING]: {
    name: '春',
    icon: '🌸',
    bgColor: 0xFFE4E1,
    bgColor2: 0xE8F5E9,
    cellBorderColor: 0xFFB6C1,
    particleColor: 0xFFB7C5,
    particleEmoji: '🌸',
    bonusLine: 'fresh',
    bonusDesc: '鲜花线合成20%跳级',
  },
  [Season.SUMMER]: {
    name: '夏',
    icon: '🍃',
    bgColor: 0xE0F7FA,
    bgColor2: 0xE8F5E9,
    cellBorderColor: 0x90EE90,
    particleColor: 0x98FB98,
    particleEmoji: '🍃',
    bonusLine: 'cold',
    bonusDesc: '冷饮线产出×2',
  },
  [Season.AUTUMN]: {
    name: '秋',
    icon: '🍂',
    bgColor: 0xFFF3E0,
    bgColor2: 0xFFF9C4,
    cellBorderColor: 0xFFCC80,
    particleColor: 0xE67E22,
    particleEmoji: '🍂',
    bonusLine: 'bouquet',
    bonusDesc: '花束线经验×1.5',
  },
  [Season.WINTER]: {
    name: '冬',
    icon: '❄️',
    bgColor: 0xECEFF1,
    bgColor2: 0xFAFAFA,
    cellBorderColor: 0xB0BEC5,
    particleColor: 0xE0E0E0,
    particleEmoji: '❄️',
    bonusLine: 'dessert',
    bonusDesc: '甜品线售价×2（棋盘出售未接入）',
  },
};

const SEASON_ORDER: Season[] = [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER];
const SEASON_DURATION_DAYS = 7;

export class SeasonSystem {
  private _parent: PIXI.Container;
  private _particleContainer: PIXI.Container;
  private _particles: { sprite: PIXI.Text; vx: number; vy: number; life: number }[] = [];
  private _seasonBadge: PIXI.Container;
  private _bgOverlay: PIXI.Graphics;

  private _currentSeason: Season;
  private _spawnTimer = 0;

  constructor(parent: PIXI.Container) {
    this._parent = parent;
    this._currentSeason = SeasonSystem.getCurrentSeason();

    // 棋盘背景色覆盖层(放在棋盘下方)
    this._bgOverlay = new PIXI.Graphics();
    this._bgOverlay.alpha = 0.15;
    this._parent.addChildAt(this._bgOverlay, 0);

    // 粒子容器
    this._particleContainer = new PIXI.Container();
    this._parent.addChild(this._particleContainer);

    // 季节标识(左上角)
    this._seasonBadge = new PIXI.Container();
    this._seasonBadge.position.set(10, BoardMetrics.topY - 30);
    this._seasonBadge.eventMode = 'static';
    this._seasonBadge.cursor = 'pointer';
    this._seasonBadge.on('pointerdown', () => this._showSeasonInfo());
    this._parent.addChild(this._seasonBadge);

    this._drawBgOverlay();
    this._drawSeasonBadge();

    // 广播当前季节
    EventBus.emit('season:changed', this._currentSeason, this.getConfig());
  }

  /** 根据当前日期计算季节 */
  static getCurrentSeason(): Season {
    // 以2024-01-01为基准周期起点
    const epoch = new Date(2024, 0, 1).getTime();
    const now = Date.now();
    const daysSinceEpoch = Math.floor((now - epoch) / (24 * 60 * 60 * 1000));
    const seasonIndex = Math.floor(daysSinceEpoch / SEASON_DURATION_DAYS) % 4;
    return SEASON_ORDER[seasonIndex];
  }

  /** 当前季节剩余天数 */
  static getRemainingDays(): number {
    const epoch = new Date(2024, 0, 1).getTime();
    const now = Date.now();
    const daysSinceEpoch = Math.floor((now - epoch) / (24 * 60 * 60 * 1000));
    const dayInCycle = daysSinceEpoch % SEASON_DURATION_DAYS;
    return SEASON_DURATION_DAYS - dayInCycle;
  }

  get currentSeason(): Season { return this._currentSeason; }
  getConfig(): SeasonConfig { return SEASON_CONFIGS[this._currentSeason]; }

  /** 判断某个line是否有当前季节加成 */
  static hasBonus(line: string): boolean {
    const season = SeasonSystem.getCurrentSeason();
    return SEASON_CONFIGS[season].bonusLine === line;
  }

  /** 春天鲜花线跳级概率 */
  static getSkipLevelChance(line: string): number {
    const season = SeasonSystem.getCurrentSeason();
    if (season === Season.SPRING && line === 'fresh') return 0.2;
    return 0;
  }

  /** 夏天冷饮线产出倍数 */
  static getProduceMultiplier(line: string): number {
    const season = SeasonSystem.getCurrentSeason();
    if (season === Season.SUMMER && line === 'cold') return 2;
    return 1;
  }

  /** 秋天花束线经验倍数 */
  static getExpMultiplier(line: string): number {
    const season = SeasonSystem.getCurrentSeason();
    if (season === Season.AUTUMN && line === 'bouquet') return 1.5;
    return 1;
  }

  /**
   * 冬天甜品线售价倍数（预留；棋盘出售未调用，出售价为 ItemDef.sellHuayuan 固定值）
   */
  static getSellPriceMultiplier(line: string): number {
    const season = SeasonSystem.getCurrentSeason();
    if (season === Season.WINTER && line === 'dessert') return 2;
    return 1;
  }

  /** 每帧更新 */
  update(dt: number): void {
    // 检查季节是否切换
    const newSeason = SeasonSystem.getCurrentSeason();
    if (newSeason !== this._currentSeason) {
      this._currentSeason = newSeason;
      this._onSeasonChange();
    }

    // 粒子生成
    this._spawnTimer += dt;
    if (this._spawnTimer > 0.8) {
      this._spawnTimer = 0;
      this._spawnParticle();
    }

    // 更新粒子
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.alpha = Math.max(0, p.life / 6);

      if (p.life <= 0) {
        this._particleContainer.removeChild(p.sprite);
        p.sprite.destroy();
        this._particles.splice(i, 1);
      }
    }
  }

  private _spawnParticle(): void {
    if (this._particles.length >= 12) return;

    const cfg = this.getConfig();
    const sprite = new PIXI.Text(cfg.particleEmoji, { fontSize: 14 });
    sprite.alpha = 0.6;
    sprite.x = Math.random() * DESIGN_WIDTH;
    sprite.y = BoardMetrics.topY - 20;

    this._particleContainer.addChild(sprite);
    this._particles.push({
      sprite,
      vx: (Math.random() - 0.5) * 15,
      vy: 30 + Math.random() * 20,
      life: 5 + Math.random() * 3,
    });
  }

  private _drawBgOverlay(): void {
    const cfg = this.getConfig();
    this._bgOverlay.clear();
    this._bgOverlay.beginFill(cfg.bgColor);
    const gridW = BoardMetrics.cellSize * BOARD_COLS + CELL_GAP * (BOARD_COLS - 1);
    const gridH = BoardMetrics.cellSize * BOARD_ROWS + CELL_GAP * (BOARD_ROWS - 1);
    this._bgOverlay.drawRoundedRect(
      BoardMetrics.paddingX - 6,
      BoardMetrics.topY - 6,
      gridW + 12,
      gridH + 12,
      12,
    );
    this._bgOverlay.endFill();
  }

  private _drawSeasonBadge(): void {
    this._seasonBadge.removeChildren();
    const cfg = this.getConfig();

    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFFFF, 0.85);
    bg.drawRoundedRect(0, 0, 62, 26, 13);
    bg.endFill();
    this._seasonBadge.addChild(bg);

    const text = new PIXI.Text(`${cfg.icon} ${cfg.name}`, {
      fontSize: 13,
      fill: 0x4A3728,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(31, 13);
    this._seasonBadge.addChild(text);
  }

  private _onSeasonChange(): void {
    this._drawBgOverlay();
    this._drawSeasonBadge();

    // 清除旧粒子
    for (const p of this._particles) {
      this._particleContainer.removeChild(p.sprite);
      p.sprite.destroy();
    }
    this._particles = [];

    EventBus.emit('season:changed', this._currentSeason, this.getConfig());
  }

  private _showSeasonInfo(): void {
    const cfg = this.getConfig();
    const remaining = SeasonSystem.getRemainingDays();

    // 创建弹出层
    const overlay = new PIXI.Container();
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.5);
    mask.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    mask.endFill();
    mask.eventMode = 'static';
    overlay.addChild(mask);

    // 信息卡片
    const card = new PIXI.Graphics();
    const cardW = 360;
    const cardH = 200;
    const cardX = (DESIGN_WIDTH - cardW) / 2;
    const cardY = (Game.logicHeight - cardH) / 2;
    card.beginFill(0xFFFFF0);
    card.drawRoundedRect(cardX, cardY, cardW, cardH, 16);
    card.endFill();
    overlay.addChild(card);

    const titleText = new PIXI.Text(`${cfg.icon}  当前季节：${cfg.name}天`, {
      fontSize: 20,
      fill: 0x4A3728,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    titleText.anchor.set(0.5, 0);
    titleText.position.set(DESIGN_WIDTH / 2, cardY + 24);
    overlay.addChild(titleText);

    const infoLines = [
      `剩余 ${remaining} 天`,
      ``,
      `季节加成：`,
      `${cfg.bonusDesc}`,
    ];

    const infoText = new PIXI.Text(infoLines.join('\n'), {
      fontSize: 14,
      fill: 0x6B5B4A,
      fontFamily: FONT_FAMILY,
      lineHeight: 22,
      align: 'center',
    });
    infoText.anchor.set(0.5, 0);
    infoText.position.set(DESIGN_WIDTH / 2, cardY + 60);
    overlay.addChild(infoText);

    overlay.alpha = 0;
    this._parent.addChild(overlay);

    TweenManager.to({
      target: overlay,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });

    const close = () => {
      TweenManager.to({
        target: overlay,
        props: { alpha: 0 },
        duration: 0.2,
        ease: Ease.easeInQuad,
        onComplete: () => {
          this._parent.removeChild(overlay);
          overlay.destroy({ children: true });
        },
      });
    };

    mask.on('pointerdown', close);
  }
}
