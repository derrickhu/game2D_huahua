/**
 * TutorialManager — 新手引导全局状态机（纯逻辑，无 UI）
 *
 * 职责：
 * - 维护当前教程步骤（TutorialStep 枚举）
 * - 步骤推进 / 回退 / 完成
 * - 存档读写（huahua_tutorial）
 * - 通过 EventBus 广播步骤变更，由各场景的 TutorialOverlay 渲染 UI
 *
 * 设计原则：
 * - 不持有任何 PIXI 对象，可安全跨场景存活
 * - 场景 onEnter 时检查 currentStep 决定是否渲染引导 UI
 */

import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { CurrencyManager } from '@/managers/CurrencyManager';

const TUTORIAL_STORAGE_KEY = 'huahua_tutorial';

export enum TutorialStep {
  NOT_STARTED       = 0,
  STORY_INTRO       = 1,

  // ── 棋盘空间认知教学（编号追加，实际顺序由 TUTORIAL_SEQUENCE 控制） ──
  BOARD_INTRO_OPEN  = 20,
  BOARD_INTRO_PEEK  = 21,
  BOARD_INTRO_FOG_KEY = 22,

  // ── 工具合成教学 ──
  GUIDE_MERGE_TOOL  = 2,
  GUIDE_TAP_TOOL    = 3,

  // ── 第一轮客人（1级花） ──
  CUSTOMER1_ARRIVE  = 4,
  GUIDE_DELIVER1    = 5,
  DELIVER1_SUCCESS  = 6,

  // ── 花朵合成教学 ──
  GUIDE_TAP_MORE    = 7,
  GUIDE_MERGE_FLOWER = 8,

  // ── 第二轮客人（2级花） ──
  CUSTOMER2_ARRIVE  = 9,
  GUIDE_DELIVER2    = 10,
  DELIVER2_SUCCESS  = 11,

  // ── 盒子解锁教学（花朵拖到丝带格） ──
  GUIDE_MERGE_PEEK_FLOWER = 23,
  GUIDE_TAP_MORE_PEEK_FLOWER = 27,
  GUIDE_MERGE_FLOWER_PEEK_PREP = 28,
  CUSTOMER3_ARRIVE = 24,
  GUIDE_DELIVER3 = 25,
  DELIVER3_SUCCESS = 26,

  // ── 花店引导 ──
  SHOP_INTRO_DIALOG = 12,
  SWITCH_TO_SHOP    = 13,
  SHOP_TOUR         = 14,
  GUIDE_BUY_FURNITURE  = 15,
  GUIDE_PLACE_FURNITURE = 16,
  SHOP_COMPLETE_DIALOG  = 17,
  SWITCH_BACK_MERGE     = 18,
  TUTORIAL_GIFT         = 19,
  COMPLETED             = 99,
}

/** 旧版 TutorialStep 最大有效值（v1/v2 完成后存 99；v2 最大步骤 19） */
const LEGACY_COMPLETED_THRESHOLD = 19;

const TUTORIAL_SEQUENCE: TutorialStep[] = [
  TutorialStep.STORY_INTRO,
  TutorialStep.BOARD_INTRO_OPEN,
  TutorialStep.GUIDE_MERGE_TOOL,
  TutorialStep.GUIDE_TAP_TOOL,
  TutorialStep.CUSTOMER1_ARRIVE,
  TutorialStep.GUIDE_DELIVER1,
  TutorialStep.DELIVER1_SUCCESS,
  TutorialStep.GUIDE_TAP_MORE,
  TutorialStep.GUIDE_MERGE_FLOWER,
  TutorialStep.CUSTOMER2_ARRIVE,
  TutorialStep.GUIDE_DELIVER2,
  TutorialStep.DELIVER2_SUCCESS,
  TutorialStep.GUIDE_TAP_MORE_PEEK_FLOWER,
  TutorialStep.GUIDE_MERGE_FLOWER_PEEK_PREP,
  TutorialStep.GUIDE_MERGE_PEEK_FLOWER,
  TutorialStep.CUSTOMER3_ARRIVE,
  TutorialStep.GUIDE_DELIVER3,
  TutorialStep.DELIVER3_SUCCESS,
  TutorialStep.SHOP_INTRO_DIALOG,
  TutorialStep.SWITCH_TO_SHOP,
  TutorialStep.SHOP_TOUR,
  TutorialStep.GUIDE_BUY_FURNITURE,
  TutorialStep.GUIDE_PLACE_FURNITURE,
  TutorialStep.SHOP_COMPLETE_DIALOG,
  TutorialStep.SWITCH_BACK_MERGE,
  TutorialStep.TUTORIAL_GIFT,
  TutorialStep.COMPLETED,
];

const TUTORIAL_ORDER = new Map<TutorialStep, number>(
  TUTORIAL_SEQUENCE.map((step, index) => [step, index]),
);

class TutorialManagerClass {
  private _step: TutorialStep = TutorialStep.NOT_STARTED;
  private _started = false;

  get currentStep(): TutorialStep { return this._step; }
  get isActive(): boolean { return this._started && this._step < TutorialStep.COMPLETED; }
  get isCompleted(): boolean { return this._step >= TutorialStep.COMPLETED; }

  /** 属于 MainScene 的步骤范围 */
  isMainSceneStep(): boolean {
    return this._step <= TutorialStep.SWITCH_TO_SHOP
      || this._step === TutorialStep.BOARD_INTRO_OPEN
      || this._step === TutorialStep.BOARD_INTRO_PEEK
      || this._step === TutorialStep.BOARD_INTRO_FOG_KEY
      || this._step >= TutorialStep.SWITCH_BACK_MERGE;
  }

  /** 属于 ShopScene 的步骤范围 */
  isShopSceneStep(): boolean {
    return this._step >= TutorialStep.SHOP_TOUR
      && this._step <= TutorialStep.SWITCH_BACK_MERGE;
  }

  /**
   * 启动教程（MainScene._onGameReady 调用）。
   * 若存档已完成则静默返回。
   */
  start(): void {
    const saved = this._loadProgress();

    if (saved >= TutorialStep.COMPLETED || saved === LEGACY_COMPLETED_THRESHOLD) {
      this._step = TutorialStep.COMPLETED;
      this._started = false;
      this._saveProgress(TutorialStep.COMPLETED);
      return;
    }

    this._step = saved || TutorialStep.NOT_STARTED;

    if (this._step === TutorialStep.BOARD_INTRO_PEEK || this._step === TutorialStep.BOARD_INTRO_FOG_KEY) {
      this._step = TutorialStep.GUIDE_MERGE_TOOL;
    }

    if (this._step === TutorialStep.NOT_STARTED) {
      this._step = TutorialStep.STORY_INTRO;
    }

    this._started = true;
    this._saveProgress(this._step);
    EventBus.emit('tutorial:stepChanged', this._step);
  }

  /** 推进到指定步骤 */
  advanceTo(step: TutorialStep): void {
    if (step !== TutorialStep.COMPLETED) {
      const currentOrder = TUTORIAL_ORDER.get(this._step);
      const nextOrder = TUTORIAL_ORDER.get(step);
      if (currentOrder !== undefined && nextOrder !== undefined) {
        if (nextOrder <= currentOrder) return;
      } else if (step <= this._step) {
        return;
      }
    }
    this._step = step;
    this._saveProgress(step);

    if (step >= TutorialStep.COMPLETED) {
      this._complete();
      return;
    }

    EventBus.emit('tutorial:stepChanged', this._step);
  }

  /** 标记教程完成，发放新手礼包 */
  private _complete(): void {
    this._step = TutorialStep.COMPLETED;
    this._started = false;
    this._saveProgress(TutorialStep.COMPLETED);
    EventBus.emit('tutorial:completed');
  }

  /** 发放新手礼包奖励 */
  grantTutorialGift(): void {
    CurrencyManager.addStamina(100);
    CurrencyManager.addDiamond(30);
  }

  /** 强制完成（GM 用） */
  forceComplete(): void {
    this._complete();
  }

  /** 强制重置（GM 用） */
  forceReset(): void {
    this._step = TutorialStep.NOT_STARTED;
    this._started = false;
    PersistService.remove(TUTORIAL_STORAGE_KEY);
  }

  // ── 存档 ──

  private _saveProgress(step: TutorialStep): void {
    try {
      PersistService.writeRaw(TUTORIAL_STORAGE_KEY, String(step));
    } catch (_) { /* ignore */ }
  }

  private _loadProgress(): TutorialStep {
    try {
      const raw = PersistService.readRaw(TUTORIAL_STORAGE_KEY);
      if (raw) return Number(raw) as TutorialStep;
    } catch (_) { /* ignore */ }
    return TutorialStep.NOT_STARTED;
  }
}

export const TutorialManager = new TutorialManagerClass();
