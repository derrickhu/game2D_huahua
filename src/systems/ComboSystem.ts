/**
 * 连锁合成连击系统
 *
 * - 5秒时间窗口，连续合成累加连击
 * - 连击等级：2连/3连/5连/8连/10连/15连+
 * - 经验加成：+10%~+100%
 * - 10连触发"合成狂热"模式（15秒花瓣飘落+合成溢出概率）
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { Game } from '@/core/Game';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY, BoardMetrics, BOARD_COLS, CELL_GAP } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { SeasonSystem } from '@/systems/SeasonSystem';

const COMBO_WINDOW = 5; // 秒
const FRENZY_THRESHOLD = 10;
const FRENZY_DURATION = 15;
const OVERFLOW_CHANCE = 0.1;

interface ComboLevel {
  min: number;
  name: string;
  expBonus: number;
}

const COMBO_LEVELS: ComboLevel[] = [
  { min: 15, name: '传说连击', expBonus: 1.0 },
  { min: 10, name: '合成狂热', expBonus: 0.8 },
  { min: 8,  name: '超级连击', expBonus: 0.5 },
  { min: 5,  name: '大连击', expBonus: 0.3 },
  { min: 3,  name: '连击', expBonus: 0.2 },
  { min: 2,  name: '小连击', expBonus: 0.1 },
];

export class ComboSystem {
  private _container: PIXI.Container;
  private _comboCount = 0;
  private _timer = 0;
  private _isActive = false;
  private _frenzyTimer = 0;
  private _isFrenzy = false;

  /** UI 元素 */
  private _timerBar: PIXI.Graphics;
  private _comboText: PIXI.Text;
  private _frenzyOverlay: PIXI.Graphics;

  /** 统计 */
  private _bestCombo = 0;
  private _todayBestCombo = 0;
  private _totalBonusExp = 0;

  constructor(parent: PIXI.Container) {
    this._container = new PIXI.Container();
    this._container.visible = false;
    parent.addChild(this._container);

    // 计时条（右上角弧形）
    this._timerBar = new PIXI.Graphics();
    this._timerBar.position.set(DESIGN_WIDTH - 80, 80);
    this._container.addChild(this._timerBar);

    // 连击文字
    this._comboText = new PIXI.Text('', {
      fontSize: 24,
      fill: 0xFFD700,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 3,
    });
    this._comboText.anchor.set(0.5, 0.5);
    this._comboText.visible = false;
    this._container.addChild(this._comboText);

    // 狂热模式遮罩
    this._frenzyOverlay = new PIXI.Graphics();
    this._frenzyOverlay.visible = false;
    this._container.addChild(this._frenzyOverlay);

    this._bindEvents();
  }

  private _bindEvents(): void {
    EventBus.on('board:merged', (_src: number, _dst: number, resultId: string, resultCell: number) => {
      this._onMerge(resultId, resultCell);
    });
  }

  private _onMerge(resultId: string, resultCell: number): void {
    this._comboCount++;
    this._timer = COMBO_WINDOW;
    this._isActive = true;
    this._container.visible = true;

    // 计算经验加成（含季节加成）
    const level = this._getCurrentLevel();
    if (level) {
      const def = ITEM_DEFS.get(resultId);
      const baseExp = (def?.level || 1) * 10;
      const seasonMul = def ? SeasonSystem.getExpMultiplier(def.line) : 1;
      const bonusExp = Math.floor(baseExp * level.expBonus * seasonMul);
      if (bonusExp > 0) {
        this._totalBonusExp += bonusExp;
        // 加入经验（简化处理，直接加到经验值）
        CurrencyManager.addExp(bonusExp);
      }
    }

    // 触发狂热
    if (this._comboCount >= FRENZY_THRESHOLD && !this._isFrenzy) {
      this._startFrenzy();
    }

    // 更新最高记录
    if (this._comboCount > this._bestCombo) this._bestCombo = this._comboCount;
    if (this._comboCount > this._todayBestCombo) this._todayBestCombo = this._comboCount;

    // 显示连击文字
    this._showComboText(resultCell);

    // 通知提示系统有操作
    EventBus.emit('combo:hit', this._comboCount);
  }

  /** 每帧更新 */
  update(dt: number): void {
    if (!this._isActive) return;

    this._timer -= dt;
    this._updateTimerBar();

    if (this._timer <= 0) {
      this._endCombo();
    }

    // 狂热模式计时
    if (this._isFrenzy) {
      this._frenzyTimer -= dt;
      if (this._frenzyTimer <= 0) {
        this._endFrenzy();
      }
    }
  }

  private _getCurrentLevel(): ComboLevel | null {
    for (const level of COMBO_LEVELS) {
      if (this._comboCount >= level.min) return level;
    }
    return null;
  }

  private _showComboText(cellIndex: number): void {
    const level = this._getCurrentLevel();
    if (!level || this._comboCount < 2) return;

    const cs = BoardMetrics.cellSize;
    const col = cellIndex % BOARD_COLS;
    const row = Math.floor(cellIndex / BOARD_COLS);
    const cx = BoardMetrics.paddingX + col * (cs + CELL_GAP) + cs / 2;
    const cy = BoardMetrics.topY + row * (cs + CELL_GAP) - 10;

    this._comboText.text = `×${this._comboCount}!`;
    this._comboText.position.set(cx, cy);
    this._comboText.visible = true;
    this._comboText.alpha = 1;
    this._comboText.scale.set(0.5);

    // 字体大小随连击数增长
    const fontSize = Math.min(36, 20 + this._comboCount * 1.5);
    this._comboText.style.fontSize = fontSize;

    // 颜色变化
    if (this._comboCount >= 10) {
      this._comboText.style.fill = 0xFF4500;
    } else if (this._comboCount >= 5) {
      this._comboText.style.fill = 0xFF8C00;
    } else {
      this._comboText.style.fill = 0xFFD700;
    }

    TweenManager.cancelTarget(this._comboText.scale);
    TweenManager.cancelTarget(this._comboText);
    TweenManager.to({
      target: this._comboText.scale,
      props: { x: 1.2, y: 1.2 },
      duration: 0.15,
      ease: Ease.easeOutBack,
    });
    TweenManager.to({
      target: this._comboText,
      props: { alpha: 0 },
      duration: 0.8,
      delay: 0.5,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this._comboText.visible = false;
      },
    });
    TweenManager.to({
      target: this._comboText.position,
      props: { y: cy - 30 },
      duration: 1.0,
      ease: Ease.easeOutQuad,
    });
  }

  private _updateTimerBar(): void {
    const progress = Math.max(0, this._timer / COMBO_WINDOW);
    this._timerBar.clear();

    // 弧形进度条
    const radius = 20;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * progress;

    // 背景圆
    this._timerBar.beginFill(0x000000, 0.3);
    this._timerBar.drawCircle(0, 0, radius + 3);
    this._timerBar.endFill();

    // 进度弧
    const color = this._comboCount >= 10 ? 0xFF4500 :
                  this._comboCount >= 5 ? 0xFF8C00 : 0xFFD700;
    this._timerBar.lineStyle(4, color, 0.9);
    this._timerBar.arc(0, 0, radius, startAngle, endAngle);

    // 中心连击数
    const countText = `${this._comboCount}`;
    // 用 Graphics 直接写不了文字，用已有 comboText 的方式
  }

  private _startFrenzy(): void {
    this._isFrenzy = true;
    this._frenzyTimer = FRENZY_DURATION;

    // 金色滤镜
    this._frenzyOverlay.clear();
    this._frenzyOverlay.beginFill(0xFFD700, 0.08);
    this._frenzyOverlay.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    this._frenzyOverlay.endFill();
    this._frenzyOverlay.visible = true;

    EventBus.emit('combo:frenzyStart');
  }

  private _endFrenzy(): void {
    this._isFrenzy = false;
    this._frenzyOverlay.visible = false;
    EventBus.emit('combo:frenzyEnd');
  }

  private _endCombo(): void {
    if (this._comboCount >= 2) {
      // 显示结算
      EventBus.emit('combo:end', this._comboCount, this._totalBonusExp);
    }

    this._comboCount = 0;
    this._timer = 0;
    this._isActive = false;
    this._totalBonusExp = 0;
    this._container.visible = false;
    this._timerBar.clear();

    if (this._isFrenzy) {
      this._endFrenzy();
    }
  }

  get bestCombo(): number { return this._bestCombo; }
  get todayBestCombo(): number { return this._todayBestCombo; }
  get isFrenzy(): boolean { return this._isFrenzy; }
  get currentCombo(): number { return this._comboCount; }
}
