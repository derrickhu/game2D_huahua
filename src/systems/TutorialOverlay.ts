/**
 * TutorialOverlay — 新手引导 UI 渲染层
 *
 * 负责镂空高亮、手指动画、角色对话气泡等 UI 表现。
 * 由各场景在 onEnter 时根据 TutorialManager.currentStep 创建并绑定。
 *
 * 支持两个场景复用：
 * - MainScene 阶段：STORY_INTRO ~ SWITCH_TO_SHOP, SWITCH_BACK_MERGE ~ TUTORIAL_GIFT
 * - ShopScene 阶段：SHOP_TOUR ~ SWITCH_BACK_MERGE
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { TutorialManager, TutorialStep } from '@/managers/TutorialManager';
import { BoardManager } from '@/managers/BoardManager';
import { CustomerManager } from '@/managers/CustomerManager';
import { DESIGN_WIDTH, FONT_FAMILY, BoardMetrics, BOARD_COLS, CELL_GAP } from '@/config/Constants';
import { TOP_BAR_HEIGHT } from '@/gameobjects/ui/TopBar';
import { TutorialDialogBubble, type DialogBubbleOptions } from '@/gameobjects/ui/TutorialDialogBubble';
import { StorySequenceOverlay } from '@/gameobjects/ui/StorySequenceOverlay';
import { TextureCache } from '@/utils/TextureCache';
import { RewardFlyCoordinator } from '@/core/RewardFlyCoordinator';
import { TUTORIAL_COPY } from '@/config/TutorialCopy';
import { TutorialInteractionGuard } from '@/systems/TutorialInteractionGuard';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import type { CustomerScrollArea } from '@/gameobjects/customer/CustomerScrollArea';
import type { ItemInfoBar } from '@/gameobjects/ui/ItemInfoBar';
import { OverlayManager } from '@/core/OverlayManager';
import { DecorationPanel } from '@/gameobjects/ui/DecorationPanel';
import { SoundSystem } from '@/systems/SoundSystem';

interface SpotlightRect {
  x: number; y: number; w: number; h: number; r?: number;
}

type StepCleanup = (() => void) | null;

export interface TutorialOverlayOptions {
  /** 主场景客人区；传入后「交付订单」引导手指可对准真实「完成」按钮（含全景滑动后的坐标） */
  customerScrollArea?: CustomerScrollArea | null;
  /** 主场景底栏；传入后「进入花店」引导可对齐真实左下进店钮与气泡位置 */
  itemInfoBar?: ItemInfoBar | null;
}

export class TutorialOverlay {
  private _container: PIXI.Container;
  private _overlay: PIXI.Container;
  private _customerScrollArea: CustomerScrollArea | null;
  private _itemInfoBar: ItemInfoBar | null;
  private _currentBubble: TutorialDialogBubble | null = null;
  private _transientHint: PIXI.Text | null = null;
  private _fingerAnim: { finger: PIXI.Container; cancel: () => void } | null = null;
  private _storyOverlay: StorySequenceOverlay | null = null;
  /** 盖在装修面板之上（overlay 根），用于家具购买指引 */
  private _overlayTop: PIXI.Container | null = null;
  private _cleanup: StepCleanup = null;
  private _stepChangedHandler: ((step: TutorialStep) => void) | null = null;

  constructor(parentContainer: PIXI.Container, options?: TutorialOverlayOptions) {
    this._container = parentContainer;
    this._customerScrollArea = options?.customerScrollArea ?? null;
    this._itemInfoBar = options?.itemInfoBar ?? null;
    this._overlay = new PIXI.Container();
    this._overlay.visible = false;
    this._overlay.zIndex = 8000;
    this._container.addChild(this._overlay);
  }

  bind(scene: 'main' | 'shop'): void {
    this._unbind();
    this._stepChangedHandler = (step: TutorialStep) => {
      this._onStepChanged(step, scene);
    };
    EventBus.on('tutorial:stepChanged', this._stepChangedHandler);

    if (TutorialManager.isActive) {
      this._onStepChanged(TutorialManager.currentStep, scene);
    }
  }

  unbind(): void {
    this._unbind();
  }

  private _unbind(): void {
    if (this._stepChangedHandler) {
      EventBus.off('tutorial:stepChanged', this._stepChangedHandler);
      this._stepChangedHandler = null;
    }
    this._runCleanup();
    this._clearOverlay();
    this._overlay.visible = false;
  }

  get isActive(): boolean { return TutorialManager.isActive; }

  // ── 步骤路由 ──

  private _onStepChanged(step: TutorialStep, scene: 'main' | 'shop'): void {
    this._runCleanup();
    this._clearOverlay();

    if (scene === 'main') {
      switch (step) {
        case TutorialStep.STORY_INTRO:       this._showStoryIntro(); break;
        case TutorialStep.BOARD_INTRO_OPEN:  this._showBoardIntroOpen(); break;
        case TutorialStep.BOARD_INTRO_PEEK:  this._showBoardIntroPeek(); break;
        case TutorialStep.BOARD_INTRO_FOG_KEY: this._showBoardIntroFogKey(); break;
        case TutorialStep.GUIDE_MERGE_TOOL:  this._showGuideMergeTool(); break;
        case TutorialStep.GUIDE_TAP_TOOL:    this._showGuideTapTool(); break;
        case TutorialStep.CUSTOMER1_ARRIVE:  this._showCustomerArrive(1); break;
        case TutorialStep.GUIDE_DELIVER1:    this._showGuideDeliver(1); break;
        case TutorialStep.DELIVER1_SUCCESS:  this._showDeliverSuccess(1); break;
        case TutorialStep.GUIDE_TAP_MORE:    this._showGuideTapMore(); break;
        case TutorialStep.GUIDE_MERGE_FLOWER: this._showGuideMergeFlower(); break;
        case TutorialStep.CUSTOMER2_ARRIVE:  this._showCustomerArrive(2); break;
        case TutorialStep.GUIDE_DELIVER2:    this._showGuideDeliver(2); break;
        case TutorialStep.DELIVER2_SUCCESS:  this._showDeliverSuccess(2); break;
        case TutorialStep.GUIDE_TAP_MORE_PEEK_FLOWER: this._showGuideTapMoreForPeek(); break;
        case TutorialStep.GUIDE_MERGE_FLOWER_PEEK_PREP: this._showGuideMergeFlowerForPeek(); break;
        case TutorialStep.GUIDE_MERGE_PEEK_FLOWER: this._showGuideMergePeekFlower(); break;
        case TutorialStep.CUSTOMER3_ARRIVE:  this._showCustomerArrive(3); break;
        case TutorialStep.GUIDE_DELIVER3:    this._showGuideDeliver(3); break;
        case TutorialStep.DELIVER3_SUCCESS:  this._showDeliverSuccess(3); break;
        case TutorialStep.SHOP_INTRO_DIALOG: this._showShopIntroDialog(); break;
        case TutorialStep.SWITCH_TO_SHOP:    this._showSwitchToShop(); break;
        case TutorialStep.TUTORIAL_GIFT:     this._showTutorialGift(); break;
        default: this._overlay.visible = false; break;
      }
    } else if (scene === 'shop') {
      switch (step) {
        case TutorialStep.SHOP_TOUR:              this._showShopTour(); break;
        case TutorialStep.GUIDE_BUY_FURNITURE:    this._showGuideBuyFurniture(); break;
        case TutorialStep.GUIDE_PLACE_FURNITURE:  this._showGuidePlaceFurniture(); break;
        case TutorialStep.SHOP_COMPLETE_DIALOG:   this._showShopCompleteDialog(); break;
        case TutorialStep.SWITCH_BACK_MERGE:      this._showSwitchBackMerge(); break;
        default: this._overlay.visible = false; break;
      }
    }
  }

  // ══════════════════════════════════════════════
  //  MAIN SCENE — 故事 & 工具合成
  // ══════════════════════════════════════════════

  private _showStoryIntro(): void {
    this._overlay.visible = false;
    SoundSystem.playTutorialStoryIntroBGM();
    this._storyOverlay = new StorySequenceOverlay(() => {
      this._storyOverlay = null;
      SoundSystem.playMainBGM();
      TutorialManager.advanceTo(TutorialStep.BOARD_INTRO_OPEN);
    });
    this._container.addChild(this._storyOverlay);
  }

  private _showBoardIntroOpen(): void {
    this._overlay.visible = true;
    const pair = this._findToolPair();
    const spotlight = pair
      ? this._mergePairSpotlight(this._getCellRect(pair[0]), this._getCellRect(pair[1]), 8)
      : this._getCellRect(3 * BOARD_COLS + 2);
    this._drawBlockingDimWithGlow([{ ...spotlight, r: 14 }], 0.45);

    this._showBubble({
      ...TUTORIAL_COPY.boardIntroOpen,
      buttonText: '开始准备',
      variant: 'dialog',
      spotlightTop: spotlight.y,
      spotlightBottom: spotlight.y + spotlight.h,
      onButton: () => TutorialManager.advanceTo(TutorialStep.GUIDE_MERGE_TOOL),
    });
  }

  private _showBoardIntroPeek(): void {
    this._overlay.visible = true;
    const pair = this._findToolPair();
    const srcIdx = pair?.[0] ?? (3 * BOARD_COLS + 2);
    const dstIdx = pair?.[1] ?? (3 * BOARD_COLS + 3);
    const srcRect = this._getCellRect(srcIdx);
    const rect = this._getCellRect(dstIdx);
    const spotlight = this._mergePairSpotlight(srcRect, rect, 8);
    this._drawBlockingDimWithGlow([spotlight], 0.64);
    this._startFingerDragAnim(
      srcRect.x + srcRect.w / 2,
      srcRect.y + srcRect.h / 2,
      rect.x + rect.w / 2,
      rect.y + rect.h / 2,
    );

    this._showBubble({
      ...TUTORIAL_COPY.boardIntroPeek,
      buttonText: '继续',
      variant: 'dialog',
      showAvatar: false,
      spotlightTop: spotlight.y,
      spotlightBottom: spotlight.y + spotlight.h,
      onButton: () => TutorialManager.advanceTo(TutorialStep.BOARD_INTRO_FOG_KEY),
    });
  }

  private _showBoardIntroFogKey(): void {
    this._overlay.visible = true;
    const fogRect = this._getCellRect(3 * BOARD_COLS + 1);
    const keyRect = this._getCellRect(4 * BOARD_COLS + 6);
    const spotlight = this._getBoundingSpotlight([fogRect, keyRect]);
    this._drawBlockingDimWithGlow([{ ...spotlight, r: 14 }], 0.64);

    this._showBubble({
      ...TUTORIAL_COPY.boardIntroFogKey,
      buttonText: '开始整理',
      variant: 'dialog',
      showAvatar: false,
      spotlightTop: spotlight.y,
      spotlightBottom: spotlight.y + spotlight.h,
      onButton: () => TutorialManager.advanceTo(TutorialStep.GUIDE_MERGE_TOOL),
    });
  }

  /** 引导合成工具（循环：1级→2级→3级，直到 tool_plant_3 出现） */
  private _showGuideMergeTool(): void {
    this._clearOverlay();

    if (this._findToolOnBoard('tool_plant_3') >= 0) {
      TutorialManager.advanceTo(TutorialStep.GUIDE_TAP_TOOL);
      return;
    }

    const pair = this._findToolPair();
    if (!pair) {
      TutorialManager.advanceTo(TutorialStep.GUIDE_TAP_TOOL);
      return;
    }

    this._overlay.visible = true;
    const [srcIdx, dstIdx] = pair;
    if (!BoardManager.canMerge(srcIdx, dstIdx)) {
      this._clearOverlay();
      requestAnimationFrame(() => {
        if (TutorialManager.currentStep === TutorialStep.GUIDE_MERGE_TOOL) {
          this._showGuideMergeTool();
        }
      });
      return;
    }

    const srcRect = this._getCellRect(srcIdx);
    const dstRect = this._getCellRect(dstIdx);
    const srcItem = BoardManager.getCellByIndex(srcIdx)?.itemId ?? '';
    const isLevel1 = srcItem.endsWith('_1');
    const isLevel2 = srcItem.endsWith('_2');

    const pad = 8;
    const spotlight = this._mergePairSpotlight(srcRect, dstRect, pad);
    this._drawMergeGuideGlow(srcRect, dstRect, pad);
    this._startFingerDragAnim(
      srcRect.x + srcRect.w / 2, srcRect.y + srcRect.h / 2,
      dstRect.x + dstRect.w / 2, dstRect.y + dstRect.h / 2,
    );

    const dstCell = BoardManager.getCellByIndex(dstIdx);
    const dstIsPeek = dstCell?.state === 'peek';

    let guideTitle: string;
    let guideBody: string;
    if (isLevel1 && dstIsPeek) {
      guideTitle = TUTORIAL_COPY.mergeTool.unlockTitle;
      guideBody = TUTORIAL_COPY.mergeTool.unlockBody;
    } else if (isLevel1) {
      guideTitle = TUTORIAL_COPY.mergeTool.mergeTitle;
      guideBody = TUTORIAL_COPY.mergeTool.mergeBody;
    } else if (dstIsPeek) {
      guideTitle = isLevel2 ? '解锁水壶' : TUTORIAL_COPY.mergeTool.continueTitle;
      guideBody = TUTORIAL_COPY.mergeTool.continueBody;
    } else {
      guideTitle = isLevel2 ? '合成水壶' : TUTORIAL_COPY.mergeTool.continueTitle;
      guideBody = TUTORIAL_COPY.mergeTool.continueBody;
    }

    this._showBubble({
      title: guideTitle,
      body: guideBody,
      actionText: TUTORIAL_COPY.mergeTool.actionText,
      spotlightTop: spotlight.y,
      spotlightBottom: spotlight.y + spotlight.h,
    });

    TutorialInteractionGuard.allowMerge({
      srcIndex: srcIdx,
      dstIndex: dstIdx,
      allowReverse: dstCell?.state === 'open',
    });

    const onInvalidAction = (): void => {
      this._nudgeBubble();
      this._showInlineHint(TUTORIAL_COPY.mergeTool.invalidActionText);
      this._stopFingerAnim();
      this._startFingerDragAnim(
        srcRect.x + srcRect.w / 2, srcRect.y + srcRect.h / 2,
        dstRect.x + dstRect.w / 2, dstRect.y + dstRect.h / 2,
      );
    };

    const onCellsPeeked = (): void => {
      this._showInlineHint(TUTORIAL_COPY.boardIntroFogKey.actionText);
    };

    let finished = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const pollTimer = setInterval(() => {
      if (finished || TutorialManager.currentStep !== TutorialStep.GUIDE_MERGE_TOOL) return;
      const srcNow = BoardManager.getCellByIndex(srcIdx);
      if (
        this._findToolOnBoard('tool_plant_3') >= 0
        || srcNow?.itemId !== srcItem
        || !BoardManager.canMerge(srcIdx, dstIdx)
      ) {
        refreshGuideFromBoard();
      }
    }, 180);

    const cleanupGuide = (): void => {
      EventBus.off('board:merged', onMerged);
      EventBus.off('tutorial:invalidAction', onInvalidAction);
      EventBus.off('board:cellsPeeked', onCellsPeeked);
      EventBus.off('tutorial:boardActionSettled', onBoardActionSettled);
      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      clearInterval(pollTimer);
      TutorialInteractionGuard.clear();
    };

    const refreshGuideFromBoard = (): void => {
      if (finished || TutorialManager.currentStep !== TutorialStep.GUIDE_MERGE_TOOL) return;
      finished = true;
      cleanupGuide();
      this._clearOverlay();
      if (this._findToolOnBoard('tool_plant_3') >= 0) {
        TutorialManager.advanceTo(TutorialStep.GUIDE_TAP_TOOL);
        return;
      }
      this._showGuideMergeTool();
    };

    const onBoardActionSettled = (kind: string): void => {
      if (kind !== 'merged' && kind !== 'moved' && kind !== 'swapped') return;
      refreshTimer = setTimeout(() => {
        if (finished || TutorialManager.currentStep !== TutorialStep.GUIDE_MERGE_TOOL) return;
        const srcNow = BoardManager.getCellByIndex(srcIdx);
        const dstNow = BoardManager.getCellByIndex(dstIdx);
        const pairChanged = srcNow?.itemId !== srcItem || !BoardManager.canMerge(srcIdx, dstIdx);
        if (pairChanged || dstNow?.itemId?.startsWith('tool_plant_')) {
          refreshGuideFromBoard();
        }
      }, 60);
    };

    const onMerged = (_mergedSrc: number, _mergedDst: number, resultId: string, _resultCell: number, isPeekMerge?: boolean): void => {
      if (!resultId.startsWith('tool_plant_')) return;
      finished = true;
      cleanupGuide();
      this._clearOverlay();
      this._overlay.visible = true;
      if (isPeekMerge) {
        this._showInlineHint('丝带盒打开了，周围的神秘盒子也露出惊喜了');
      }

      const hasLv3 = this._findToolOnBoard('tool_plant_3') >= 0;
      if (hasLv3) {
        TutorialManager.advanceTo(TutorialStep.GUIDE_TAP_TOOL);
      } else {
        refreshTimer = setTimeout(() => {
          if (TutorialManager.currentStep === TutorialStep.GUIDE_MERGE_TOOL) {
            this._showGuideMergeTool();
          }
        }, 280);
        this._cleanup = () => {
          if (refreshTimer !== null) clearTimeout(refreshTimer);
          TutorialInteractionGuard.clear();
        };
      }
    };
    EventBus.on('board:merged', onMerged);
    EventBus.on('tutorial:invalidAction', onInvalidAction);
    EventBus.on('board:cellsPeeked', onCellsPeeked);
    EventBus.on('tutorial:boardActionSettled', onBoardActionSettled);
    this._cleanup = cleanupGuide;
  }

  /** 引导点击 3 级工具产出花朵 */
  private _showGuideTapTool(): void {
    const toolIdx = this._findToolOnBoard('tool_plant_3');
    if (toolIdx < 0) {
      TutorialManager.advanceTo(TutorialStep.CUSTOMER1_ARRIVE);
      return;
    }

    this._overlay.visible = true;
    const rect = this._getCellRect(toolIdx);
    this._drawSpotlightMask([{ ...rect, r: 10 }], 0.65);
    this._startFingerTapAnim(rect.x + rect.w / 2, rect.y + rect.h / 2);

    this._showBubble({
      title: TUTORIAL_COPY.tapTool.title,
      body: TUTORIAL_COPY.tapTool.body,
      actionText: TUTORIAL_COPY.tapTool.actionText,
      spotlightTop: rect.y,
      spotlightBottom: rect.y + rect.h,
    });

    const onProduced = (_srcIdx: number, _tgtIdx: number, producedId: string): void => {
      if (!producedId.startsWith('flower_')) return;
      EventBus.off('building:produced', onProduced);
      this._clearOverlay();
      this._overlay.visible = true;
      this._drawSpotlightMask([], 0.5);

      this._showBubble({
        title: '花朵培育成功',
        body: '花种子出来了！\n等客人来买的时候就能用到~',
        buttonText: '继续',
        onButton: () => TutorialManager.advanceTo(TutorialStep.CUSTOMER1_ARRIVE),
      });
    };
    EventBus.on('building:produced', onProduced);
    this._cleanup = () => EventBus.off('building:produced', onProduced);
  }

  // ══════════════════════════════════════════════
  //  MAIN SCENE — 第一轮客人（1级花）
  // ══════════════════════════════════════════════

  private _showCustomerArrive(round: number): void {
    this._overlay.visible = true;
    this._drawSpotlightMask([], 0.5);

    if (round === 1) {
      CustomerManager.spawnScriptedCustomer(['flower_fresh_1']);
      this._showBubble({
        title: '第一位客人来了',
        body: '客人想要一朵「花种子」！\n棋盘上有匹配的花就能交付~',
        buttonText: '知道了',
        onButton: () => TutorialManager.advanceTo(TutorialStep.GUIDE_DELIVER1),
      });
    } else if (round === 2) {
      CustomerManager.spawnScriptedCustomer(['flower_fresh_2']);
      this._showBubble({
        title: '又有客人来了',
        body: '这位客人想要一朵「花苞」！\n刚好是合成的那朵~',
        buttonText: '知道了',
        onButton: () => TutorialManager.advanceTo(TutorialStep.GUIDE_DELIVER2),
      });
    } else {
      CustomerManager.spawnScriptedCustomer(['flower_fresh_3']);
      this._showBubble({
        title: '再接一单',
        body: '刚合成出的高级花，\n正好可以给这位客人~',
        buttonText: '交给客人',
        onButton: () => TutorialManager.advanceTo(TutorialStep.GUIDE_DELIVER3),
      });
    }
  }

  private _showGuideDeliver(round: number): void {
    this._clearOverlay();

    const nextStep = round === 1
      ? TutorialStep.DELIVER1_SUCCESS
      : round === 2
        ? TutorialStep.DELIVER2_SUCCESS
        : TutorialStep.DELIVER3_SUCCESS;

    const onDelivered = (): void => {
      EventBus.off('customer:delivered', onDelivered);
      EventBus.off('customer:lockChanged', checkReady);
      clearTimeout(timeout);
      TutorialManager.advanceTo(nextStep);
    };

    const showDeliverHint = (): void => {
      this._clearOverlay();
      this._overlay.visible = true;

      const areaY = Game.safeTop + TOP_BAR_HEIGHT;
      const areaH = BoardMetrics.topY - areaY;
      this._drawSpotlightMask([{
        x: 0, y: areaY, w: DESIGN_WIDTH, h: areaH, r: 0,
      }], 0.55);

      let fingerX = DESIGN_WIDTH * 0.5;
      let fingerY = areaY + areaH * 0.72;
      const btnGlobal = this._customerScrollArea?.getFirstDeliverReadyCompleteBtnGlobal() ?? null;
      if (btnGlobal) {
        const local = this._container.toLocal(btnGlobal);
        fingerX = local.x;
        fingerY = local.y;
      }
      this._drawDeliverButtonFocus(fingerX, fingerY);
      this._startFingerTapAnim(fingerX, fingerY);

      this._showBubble({
        title: round === 1 ? '交付订单' : '再次交付',
        body: '客人的订单已经凑齐了！\n点击客人完成交付吧~',
        spotlightTop: this._getDeliverBubbleAnchor().y,
        spotlightBottom: this._getDeliverBubbleAnchor().y + this._getDeliverBubbleAnchor().h,
        spotlightCenterX: this._getDeliverBubbleAnchor().x + this._getDeliverBubbleAnchor().w / 2,
        dialogVerticalMode: 'below',
      });
    };

    const checkReady = (): void => {
      if (CustomerManager.customers.some(c => c.allSatisfied)) {
        showDeliverHint();
      }
    };

    EventBus.on('customer:delivered', onDelivered);
    EventBus.on('customer:lockChanged', checkReady);

    if (CustomerManager.customers.some(c => c.allSatisfied)) {
      showDeliverHint();
    } else {
      this._overlay.visible = false;
    }

    const timeout = setTimeout(() => {
      const curStep = TutorialManager.currentStep;
      if (
        curStep === TutorialStep.GUIDE_DELIVER1
        || curStep === TutorialStep.GUIDE_DELIVER2
        || curStep === TutorialStep.GUIDE_DELIVER3
      ) {
        EventBus.off('customer:delivered', onDelivered);
        EventBus.off('customer:lockChanged', checkReady);
        TutorialManager.advanceTo(nextStep);
      }
    }, 60000);

    this._cleanup = () => {
      EventBus.off('customer:delivered', onDelivered);
      EventBus.off('customer:lockChanged', checkReady);
      clearTimeout(timeout);
    };
  }

  private _showDeliverSuccess(round: number): void {
    this._overlay.visible = true;
    this._clearOverlay();
    this._drawSpotlightMask([], 0.5);

    if (round === 1) {
      this._showBubble({
        title: '第一笔生意',
        body: '客人满意地离开了！\n我们赚到了花愿~',
        buttonText: '花愿是什么？',
        onButton: () => this._showHuayuanExplain(),
      });
    } else if (round === 2) {
      this._showBubble({
        title: '做得好',
        body: '连续完成两笔订单！\n接下来先准备一个花苞，\n再用它打开丝带盒。',
        buttonText: '继续',
        onButton: () => TutorialManager.advanceTo(TutorialStep.GUIDE_TAP_MORE_PEEK_FLOWER),
      });
    } else {
      this._showBubble({
        title: '盒子也会帮忙',
        body: '做得好！\n把同样物品拖到丝带盒上，\n就能打开更多格子。',
        buttonText: '去装修花店',
        onButton: () => TutorialManager.advanceTo(TutorialStep.SHOP_INTRO_DIALOG),
      });
    }
  }

  private _getDeliverBubbleAnchor(): SpotlightRect {
    const toolIdx = this._findProducibleTool();
    if (toolIdx >= 0) {
      const rect = this._getCellRect(toolIdx);
      return {
        x: rect.x,
        y: rect.y + rect.h + Math.round(rect.h * 0.9),
        w: rect.w,
        h: rect.h,
        r: 12,
      };
    }
    return {
      x: DESIGN_WIDTH * 0.5 - 60,
      y: BoardMetrics.topY + BoardMetrics.cellSize * 3,
      w: 120,
      h: BoardMetrics.cellSize,
      r: 12,
    };
  }

  private _showHuayuanExplain(): void {
    this._clearOverlay();
    this._overlay.visible = true;

    const rect = this._getHuayuanSpotlight();
    this._drawSpotlightMask([rect], 0.6);
    this._startFingerTapAnim(rect.x + rect.w / 2, rect.y + rect.h / 2);

    this._showBubble({
      title: '花愿',
      body: '花愿是花店的收入！\n完成客人的订单就能赚取花愿，\n花愿可以用来装修花店哦~',
      buttonText: '继续培育',
      spotlightTop: rect.y,
      spotlightBottom: rect.y + rect.h,
      onButton: () => TutorialManager.advanceTo(TutorialStep.GUIDE_TAP_MORE),
    });
  }

  private _getHuayuanSpotlight(): SpotlightRect {
    const cx = 51;
    const iconR = 23;
    return {
      x: cx - iconR - 6,
      y: Game.safeTop + 6,
      w: (iconR + 6) * 2,
      h: 64,
      r: 12,
    };
  }

  // ══════════════════════════════════════════════
  //  MAIN SCENE — 花朵合成教学
  // ══════════════════════════════════════════════

  /** 引导多次点击工具产出花朵（需要 2 朵才能合成） */
  private _showGuideTapMore(): void {
    const toolIdx = this._findProducibleTool();
    if (toolIdx < 0) {
      TutorialManager.advanceTo(TutorialStep.GUIDE_MERGE_FLOWER);
      return;
    }

    this._overlay.visible = true;
    const rect = this._getCellRect(toolIdx);
    this._drawSpotlightMask([{ ...rect, r: 10 }], 0.65);
    this._startFingerTapAnim(rect.x + rect.w / 2, rect.y + rect.h / 2);

    this._showBubble({
      title: '继续培育',
      body: '多点几次育苗盘，\n凑齐两朵一样的花就能合成更高级的~',
      spotlightTop: rect.y,
      spotlightBottom: rect.y + rect.h,
    });

    let flowerCount = this._countFlowersOnBoard('flower_fresh_1');
    const onProduced = (_srcIdx: number, _tgtIdx: number, producedId: string): void => {
      if (producedId === 'flower_fresh_1') flowerCount++;
      if (flowerCount >= 2) {
        EventBus.off('building:produced', onProduced);
        this._clearOverlay();
        this._overlay.visible = true;
        this._drawSpotlightMask([], 0.5);

        this._showBubble({
          title: '花朵够了',
          body: '已经有两朵花种子了！\n把它们合成一朵更高级的花吧~',
          buttonText: '继续',
          onButton: () => TutorialManager.advanceTo(TutorialStep.GUIDE_MERGE_FLOWER),
        });
      }
    };
    EventBus.on('building:produced', onProduced);

    const timeout = setTimeout(() => {
      if (TutorialManager.currentStep === TutorialStep.GUIDE_TAP_MORE) {
        EventBus.off('building:produced', onProduced);
        TutorialManager.advanceTo(TutorialStep.GUIDE_MERGE_FLOWER);
      }
    }, 60000);

    this._cleanup = () => {
      EventBus.off('building:produced', onProduced);
      clearTimeout(timeout);
    };
  }

  /** 引导把开放花种子拖到丝带花格，触发盒子解锁 */
  private _showGuideTapMoreForPeek(): void {
    const toolIdx = this._findProducibleTool();
    if (toolIdx < 0) {
      TutorialManager.advanceTo(TutorialStep.GUIDE_MERGE_FLOWER_PEEK_PREP);
      return;
    }

    this._overlay.visible = true;
    const rect = this._getCellRect(toolIdx);
    this._drawSpotlightMask([{ ...rect, r: 10 }], 0.65);
    this._startFingerTapAnim(rect.x + rect.w / 2, rect.y + rect.h / 2);

    this._showBubble({
      title: '准备花种子',
      body: '再点击育苗盘，\n先准备两朵花种子。',
      actionText: '点击育苗盘产出花种子',
      spotlightTop: rect.y,
      spotlightBottom: rect.y + rect.h,
    });

    let flowerCount = this._countFlowersOnBoard('flower_fresh_1');
    const onProduced = (_srcIdx: number, _tgtIdx: number, producedId: string): void => {
      if (producedId === 'flower_fresh_1') flowerCount++;
      if (flowerCount >= 2) {
        cleanup();
        TutorialManager.advanceTo(TutorialStep.GUIDE_MERGE_FLOWER_PEEK_PREP);
      }
    };
    EventBus.on('building:produced', onProduced);

    const cleanup = (): void => {
      EventBus.off('building:produced', onProduced);
    };
    this._cleanup = cleanup;
  }

  private _showGuideMergeFlowerForPeek(): void {
    const pair = this._findFlowerPair('flower_fresh_1');
    if (!pair) {
      TutorialManager.advanceTo(TutorialStep.GUIDE_MERGE_PEEK_FLOWER);
      return;
    }

    this._overlay.visible = true;
    const [srcIdx, dstIdx] = pair;
    const srcRect = this._getCellRect(srcIdx);
    const dstRect = this._getCellRect(dstIdx);
    const pad = 8;
    const spotlight = this._mergePairSpotlight(srcRect, dstRect, pad);
    this._drawMergeGuideGlow(srcRect, dstRect, pad);
    this._startFingerDragAnim(
      srcRect.x + srcRect.w / 2, srcRect.y + srcRect.h / 2,
      dstRect.x + dstRect.w / 2, dstRect.y + dstRect.h / 2,
    );

    this._showBubble({
      title: '先合成花苞',
      body: '把两朵花种子合在一起，\n得到一朵花苞。',
      actionText: '拖动花种子到另一朵花种子',
      spotlightTop: spotlight.y,
      spotlightBottom: spotlight.y + spotlight.h,
    });

    TutorialInteractionGuard.allowMerge({
      srcIndex: srcIdx,
      dstIndex: dstIdx,
      allowReverse: true,
    });

    const onInvalidAction = (): void => {
      this._nudgeBubble();
      this._showInlineHint('先把两朵花种子合成花苞');
    };

    const onMerged = (_src: number, _dst: number, resultId: string): void => {
      if (resultId !== 'flower_fresh_2') return;
      cleanup();
      TutorialManager.advanceTo(TutorialStep.GUIDE_MERGE_PEEK_FLOWER);
    };

    EventBus.on('board:merged', onMerged);
    EventBus.on('tutorial:invalidAction', onInvalidAction);

    const cleanup = (): void => {
      EventBus.off('board:merged', onMerged);
      EventBus.off('tutorial:invalidAction', onInvalidAction);
      TutorialInteractionGuard.clear();
    };
    this._cleanup = cleanup;
  }

  private _showGuideMergePeekFlower(): void {
    this._clearOverlay();
    const pair = this._findFlowerPeekPair('flower_fresh_2');
    if (!pair) {
      TutorialManager.advanceTo(TutorialStep.CUSTOMER3_ARRIVE);
      return;
    }

    this._overlay.visible = true;
    const [srcIdx, dstIdx] = pair;
    const srcRect = this._getCellRect(srcIdx);
    const dstRect = this._getCellRect(dstIdx);
    const pad = 8;
    const spotlight = this._mergePairSpotlight(srcRect, dstRect, pad);

    this._drawMergeGuideGlow(srcRect, dstRect, pad);
    this._startFingerDragAnim(
      srcRect.x + srcRect.w / 2, srcRect.y + srcRect.h / 2,
      dstRect.x + dstRect.w / 2, dstRect.y + dstRect.h / 2,
    );

    this._showBubble({
      title: '打开丝带盒',
      body: '丝带盒里藏着花苞。\n把同样的花苞拖上去，\n就能合成出更高级的花。',
      actionText: '拖动花苞到丝带花苞格',
      spotlightTop: spotlight.y,
      spotlightBottom: spotlight.y + spotlight.h,
    });

    TutorialInteractionGuard.allowMerge({
      srcIndex: srcIdx,
      dstIndex: dstIdx,
      allowReverse: false,
    });

    const onInvalidAction = (): void => {
      this._nudgeBubble();
      this._showInlineHint('把开放格里的花苞拖到丝带花苞格上');
      this._stopFingerAnim();
      this._startFingerDragAnim(
        srcRect.x + srcRect.w / 2, srcRect.y + srcRect.h / 2,
        dstRect.x + dstRect.w / 2, dstRect.y + dstRect.h / 2,
      );
    };

    const onMerged = (_src: number, _dst: number, resultId: string, _resultCell: number, isPeekMerge?: boolean): void => {
      if (!resultId.startsWith('flower_')) return;
      cleanup();
      this._clearOverlay();
      this._overlay.visible = true;
      if (isPeekMerge) {
        this._showInlineHint('丝带盒打开了，周围的神秘盒子也露出惊喜了');
      }
      this._showBubble({
        title: '盒子打开了',
        body: '太好了！花苞合成了更高级的花，\n周围盒子也露出了惊喜。',
        buttonText: '接下一单',
        onButton: () => TutorialManager.advanceTo(TutorialStep.CUSTOMER3_ARRIVE),
      });
    };

    EventBus.on('board:merged', onMerged);
    EventBus.on('tutorial:invalidAction', onInvalidAction);

    const cleanup = (): void => {
      EventBus.off('board:merged', onMerged);
      EventBus.off('tutorial:invalidAction', onInvalidAction);
      TutorialInteractionGuard.clear();
    };
    this._cleanup = cleanup;
  }

  /** 引导合成两朵 1 级花 → 2 级花 */
  private _showGuideMergeFlower(): void {
    const pair = this._findFlowerPair('flower_fresh_1');
    if (!pair) {
      TutorialManager.advanceTo(TutorialStep.CUSTOMER2_ARRIVE);
      return;
    }

    this._overlay.visible = true;
    const [srcIdx, dstIdx] = pair;
    const srcRect = this._getCellRect(srcIdx);
    const dstRect = this._getCellRect(dstIdx);

    const pad = 8;
    const spotlight = this._mergePairSpotlight(srcRect, dstRect, pad);
    this._drawMergeGuideGlow(srcRect, dstRect, pad);
    this._startFingerDragAnim(
      srcRect.x + srcRect.w / 2, srcRect.y + srcRect.h / 2,
      dstRect.x + dstRect.w / 2, dstRect.y + dstRect.h / 2,
    );

    this._showBubble({
      title: '合成花朵',
      body: '把两朵相同的花拖到一起，\n就能合成更高级的花朵！',
      actionText: '拖动高亮鲜花到目标格',
      spotlightTop: spotlight.y,
      spotlightBottom: spotlight.y + spotlight.h,
    });

    TutorialInteractionGuard.allowMerge({
      srcIndex: srcIdx,
      dstIndex: dstIdx,
      allowReverse: true,
    });

    const onInvalidAction = (): void => {
      this._nudgeBubble();
      this._showInlineHint('找一样的花拖到一起试试');
      this._stopFingerAnim();
      this._startFingerDragAnim(
        srcRect.x + srcRect.w / 2, srcRect.y + srcRect.h / 2,
        dstRect.x + dstRect.w / 2, dstRect.y + dstRect.h / 2,
      );
    };

    const onMerged = (_src: number, _dst: number, resultId: string): void => {
      if (!resultId.startsWith('flower_')) return;
      EventBus.off('board:merged', onMerged);
      EventBus.off('tutorial:invalidAction', onInvalidAction);
      TutorialInteractionGuard.clear();
      this._clearOverlay();
      this._overlay.visible = true;
      this._drawSpotlightMask([], 0.5);

      this._showBubble({
        title: '合成成功',
        body: '花种子变成了花苞！\n更高级的花可以满足更多客人~',
        buttonText: '继续',
        onButton: () => TutorialManager.advanceTo(TutorialStep.CUSTOMER2_ARRIVE),
      });
    };
    EventBus.on('board:merged', onMerged);
    EventBus.on('tutorial:invalidAction', onInvalidAction);
    this._cleanup = () => {
      EventBus.off('board:merged', onMerged);
      EventBus.off('tutorial:invalidAction', onInvalidAction);
      TutorialInteractionGuard.clear();
    };
  }

  // ══════════════════════════════════════════════
  //  MAIN SCENE — 花店引导过渡
  // ══════════════════════════════════════════════

  private _showShopIntroDialog(): void {
    this._overlay.visible = true;
    this._clearOverlay();

    const rect = this._getHuayuanSpotlight();
    this._drawSpotlightMask([rect], 0.6);

    this._showBubble({
      title: '花店需要装修',
      body: '花店里面也太旧了……\n用赚到的花愿来装修花店吧！\n花愿越多，能买的家具越多哦~',
      buttonText: '去看看',
      spotlightTop: rect.y,
      spotlightBottom: rect.y + rect.h,
      onButton: () => TutorialManager.advanceTo(TutorialStep.SWITCH_TO_SHOP),
    });
  }

  private _showSwitchToShop(): void {
    this._overlay.visible = true;
    this._clearOverlay();

    let spotlight: SpotlightRect;
    let fingerX: number;
    let fingerY: number;
    let spotlightCenterX: number;

    if (this._itemInfoBar) {
      const local = this._itemInfoBar.getHouseButtonSpotlightRectLocal();
      spotlight = {
        x: this._itemInfoBar.x + local.x,
        y: this._itemInfoBar.y + local.y,
        w: local.w,
        h: local.h,
        r: 16,
      };
      fingerX = spotlight.x + spotlight.w / 2;
      fingerY = spotlight.y + spotlight.h / 2;
      spotlightCenterX = fingerX;
    } else {
      const btnX = 10;
      const btnY = Game.logicHeight - 120;
      const btnW = 150;
      const btnH = 60;
      spotlight = { x: btnX, y: btnY, w: btnW, h: btnH, r: 16 };
      fingerX = btnX + btnW / 2;
      fingerY = btnY + btnH / 2;
      spotlightCenterX = fingerX;
    }

    this._drawSpotlightMask([spotlight], 0.65);
    this._startFingerTapAnim(fingerX, fingerY);

    this._showBubble({
      title: '进入花店',
      body: '点击这里进入花店~',
      spotlightTop: spotlight.y,
      spotlightBottom: spotlight.y + spotlight.h,
      spotlightCenterX,
    });

    const onSceneSwitch = (): void => {
      EventBus.off('scene:switchToShop', onSceneSwitch);
      this._clearOverlay();
      this._overlay.visible = false;
    };
    EventBus.on('scene:switchToShop', onSceneSwitch);
    this._cleanup = () => EventBus.off('scene:switchToShop', onSceneSwitch);
  }

  private _showTutorialGift(): void {
    this._overlay.visible = true;
    this._clearOverlay();
    this._drawSpotlightMask([], 0.55);

    const PANEL_W = Math.min(560, DESIGN_WIDTH - 48);
    const INNER_PAD = 30;
    const TITLE_H = 48;
    const ICON_S = 58;
    const rewards = [
      { texKey: 'icon_energy', amount: 100, label: '体力' },
      { texKey: 'icon_gem',    amount: 30, label: '钻石' },
    ];

    const panel = new PIXI.Container();
    panel.eventMode = 'passive';

    const titleText = new PIXI.Text('花店重新开业了', {
      fontSize: 27, fill: 0x4a3728, fontFamily: FONT_FAMILY,
      fontWeight: 'bold', stroke: 0xfffcf8, strokeThickness: 2,
    });

    const subtitleText = new PIXI.Text('恭喜完成引导！获得：', {
      fontSize: 22, fill: 0x5c4a3d, fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });

    const storyText = new PIXI.Text('奶奶一定很欣慰。\n加油，让花花妙屋成为小镇最棒的花店！', {
      fontSize: 21, fill: 0x5c4a3d, fontFamily: FONT_FAMILY,
      wordWrap: true, wordWrapWidth: PANEL_W - INNER_PAD * 2, lineHeight: 32,
    });

    let y = INNER_PAD + 6;
    const titleW = Math.max(260, titleText.width + 52);
    const titleBg = new PIXI.Graphics();
    titleBg.beginFill(0xffd76e, 1);
    titleBg.drawRoundedRect((PANEL_W - titleW) / 2, y, titleW, TITLE_H, 24);
    titleBg.endFill();
    titleBg.lineStyle(2, 0xfff5bf, 0.95);
    titleBg.drawRoundedRect((PANEL_W - titleW) / 2 + 3, y + 3, titleW - 6, TITLE_H - 6, 20);
    titleText.anchor.set(0.5, 0.5);
    titleText.position.set(PANEL_W / 2, y + TITLE_H / 2 - 1);
    y += TITLE_H + 18;
    subtitleText.position.set(INNER_PAD, y); y += subtitleText.height + 14;

    const rewardRowY = y;
    const GAP = 24;
    const itemW = 132;
    const totalItemsW = rewards.length * itemW + (rewards.length - 1) * GAP;
    const rowStartX = (PANEL_W - totalItemsW) / 2;

    const rewardSprites: PIXI.Container[] = [];
    for (let i = 0; i < rewards.length; i++) {
      const r = rewards[i];
      const cx = rowStartX + i * (itemW + GAP) + itemW / 2;
      const item = new PIXI.Container();

      const card = new PIXI.Graphics();
      card.beginFill(0xffefd1, 0.96);
      card.drawRoundedRect(-itemW / 2, -ICON_S / 2 - 16, itemW, 116, 24);
      card.endFill();
      card.lineStyle(2, 0xffc76c, 0.55);
      card.drawRoundedRect(-itemW / 2 + 3, -ICON_S / 2 - 13, itemW - 6, 110, 20);
      item.addChild(card);

      const tex = TextureCache.get(r.texKey);
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const sc = ICON_S / Math.max(tex.width, tex.height);
        sp.scale.set(sc);
        item.addChild(sp);
      }

      const numText = new PIXI.Text(`+${r.amount}`, {
        fontSize: 25, fontWeight: 'bold', fill: 0xE8751A, fontFamily: FONT_FAMILY,
      });
      numText.anchor.set(0.5, 0);
      numText.position.set(0, ICON_S / 2 + 4);
      item.addChild(numText);

      const labelText = new PIXI.Text(r.label, {
        fontSize: 16, fill: 0x8a7a6d, fontFamily: FONT_FAMILY,
      });
      labelText.anchor.set(0.5, 0);
      labelText.position.set(0, ICON_S / 2 + 28);
      item.addChild(labelText);

      item.position.set(cx, rewardRowY + ICON_S / 2);
      item.alpha = 0;
      item.scale.set(0.3);
      rewardSprites.push(item);
      panel.addChild(item);
    }
    y = rewardRowY + ICON_S + 70;

    storyText.position.set(INNER_PAD, y); y += storyText.height + 16;

    const BTN_W = 220;
    const BTN_H = 56;
    const BTN_R = 28;
    const btnX = (PANEL_W - BTN_W) / 2;
    const btnY = y;
    y += BTN_H + INNER_PAD;

    const panelH = y;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x4c2f4f, 0.16);
    bg.drawRoundedRect(8, 12, PANEL_W, panelH, 32);
    bg.endFill();
    bg.beginFill(0xd8c4ff, 0.98);
    bg.drawRoundedRect(0, 0, PANEL_W, panelH, 32);
    bg.endFill();
    bg.lineStyle(3, 0xffffff, 0.55);
    bg.drawRoundedRect(3, 3, PANEL_W - 6, panelH - 6, 29);
    bg.beginFill(0xfff7ea, 0.98);
    bg.drawRoundedRect(10, 10, PANEL_W - 20, panelH - 20, 23);
    bg.endFill();
    bg.lineStyle(3, 0xffc9dc, 0.75);
    bg.drawRoundedRect(12, 12, PANEL_W - 24, panelH - 24, 21);
    panel.addChildAt(bg, 0);

    panel.addChild(titleBg);
    panel.addChild(titleText);
    panel.addChild(subtitleText);
    panel.addChild(storyText);

    const btnBg = new PIXI.Graphics();
    btnBg.beginFill(0xF4845F);
    btnBg.drawRoundedRect(btnX, btnY, BTN_W, BTN_H, BTN_R);
    btnBg.endFill();
    btnBg.lineStyle(2, 0xffffff, 0.58);
    btnBg.drawRoundedRect(btnX + 4, btnY + 4, BTN_W - 8, BTN_H - 8, BTN_R - 4);
    panel.addChild(btnBg);

    const btnLabel = new PIXI.Text('开始游戏', {
      fontSize: 21, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    btnLabel.anchor.set(0.5, 0.5);
    btnLabel.position.set(btnX + BTN_W / 2, btnY + BTN_H / 2);
    panel.addChild(btnLabel);

    const hitArea = new PIXI.Container();
    hitArea.hitArea = new PIXI.Rectangle(btnX, btnY, BTN_W, BTN_H);
    hitArea.eventMode = 'static';
    hitArea.cursor = 'pointer';
    hitArea.on('pointertap', () => {
      this._playRewardFlyToTopBar(rewards, panel);
      TutorialManager.grantTutorialGift();
      setTimeout(() => {
        TutorialManager.advanceTo(TutorialStep.COMPLETED);
        this._clearOverlay();
        this._overlay.visible = false;
      }, 900);
    });
    panel.addChild(hitArea);

    const avatarTex = TextureCache.get('owner_chibi_default');
    if (avatarTex) {
      const AVATAR_SIZE = 104;
      const halo = new PIXI.Graphics();
      halo.beginFill(0xffe3ef, 0.95);
      halo.drawCircle(PANEL_W / 2, -AVATAR_SIZE * 0.24, AVATAR_SIZE / 2);
      halo.endFill();
      halo.lineStyle(3, 0xffffff, 0.8);
      halo.drawCircle(PANEL_W / 2, -AVATAR_SIZE * 0.24, AVATAR_SIZE / 2 - 3);
      panel.addChild(halo);
      const avatarSp = new PIXI.Sprite(avatarTex);
      const sc = AVATAR_SIZE / Math.max(avatarTex.width, avatarTex.height);
      avatarSp.scale.set(sc);
      avatarSp.anchor.set(0.5, 0.5);
      avatarSp.position.set(PANEL_W / 2, -AVATAR_SIZE * 0.24);
      panel.addChild(avatarSp);
    }

    panel.position.set(
      (DESIGN_WIDTH - PANEL_W) / 2,
      Game.logicHeight * 0.3 - panelH / 2,
    );

    this._overlay.addChild(panel);

    for (let i = 0; i < rewardSprites.length; i++) {
      const sp = rewardSprites[i];
      TweenManager.to({
        target: sp, props: { alpha: 1 }, duration: 0.3, delay: 0.15 + i * 0.15,
      });
      TweenManager.to({
        target: sp.scale, props: { x: 1, y: 1 },
        duration: 0.4, delay: 0.15 + i * 0.15, ease: Ease.easeOutBack,
      });
    }
  }

  private _playRewardFlyToTopBar(
    rewards: { texKey: string; amount: number }[],
    sourcePanel: PIXI.Container,
  ): void {
    const srcGlobal = sourcePanel.toGlobal(new PIXI.Point(
      (sourcePanel.width / sourcePanel.scale.x) / 2,
      (sourcePanel.height / sourcePanel.scale.y) / 2,
    ));

    for (let i = 0; i < rewards.length; i++) {
      const r = rewards[i];
      const targetDesignX = r.texKey === 'icon_energy' ? 100 : 280;
      const targetDesignY = Game.safeTop + TOP_BAR_HEIGHT / 2;

      const endGlobal = this._container.toGlobal(
        new PIXI.Point(targetDesignX, targetDesignY),
      );

      RewardFlyCoordinator.playRewardFlyGlobal(
        r.texKey,
        srcGlobal,
        endGlobal,
        r.amount,
        () => {},
        i * 0.12,
        i === 0,
      );
    }
  }

  // ══════════════════════════════════════════════
  //  SHOP SCENE STEPS
  // ══════════════════════════════════════════════

  private _showShopTour(): void {
    this._overlay.visible = true;
    this._clearOverlay();
    this._drawSpotlightMask([], 0.4);

    this._showBubble({
      title: '欢迎来到花店',
      body: '这就是我们的花店！\n虽然有点旧，但稍微装修一下就会很漂亮~',
      buttonText: '开始装修',
      onButton: () => TutorialManager.advanceTo(TutorialStep.GUIDE_BUY_FURNITURE),
    });
  }

  private _showGuideBuyFurniture(): void {
    void TextureCache.preloadTutorialDeco();

    const showBtnGuide = (): void => {
      this._clearOverlay();
      this._overlay.visible = true;

      const ICON_R = 40;
      const btnCX = ICON_R + 14;
      const btnCY = Game.logicHeight - 92;
      const hitR = ICON_R + 18;
      const pad = 12;
      const rect: SpotlightRect = {
        x: Math.max(0, btnCX - hitR - pad),
        y: btnCY - hitR - pad,
        w: (hitR + pad) * 2,
        h: (hitR + pad) * 2,
        r: hitR,
      };

      this._drawSpotlightMask([rect], 0.68);
      this._drawGlowBorder(rect);
      this._drawTapTargetBurst(btnCX, btnCY, hitR + 10);
      this._startFingerTapAnim(btnCX, btnCY);

      this._showBubble({
        title: '选购家具',
        body: '点击左下角「家具」按钮，\n挑选一件喜欢的家具吧！',
        actionText: '只能点击高亮的家具按钮',
        spotlightTop: rect.y,
        spotlightBottom: rect.y + rect.h,
        spotlightCenterX: btnCX,
      });
    };

    showBtnGuide();

    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const onDecoOpen = (): void => {
      this._clearOverlay();
      this._overlay.visible = false;
      OverlayManager.bringToFront();

      const tryShow = (attempt: number): void => {
        retryTimer = null;
        const panel = DecorationPanel.shared;
        const g = panel?.getTutorialPurchasableBuyButtonGlobal() ?? null;
        if (panel?.isOpen && g) {
          this._showDecoPurchaseGuideAt(g);
          return;
        }
        if (attempt < 24) {
          retryTimer = setTimeout(() => tryShow(attempt + 1), 55);
        }
      };
      retryTimer = setTimeout(() => tryShow(0), 280);
    };

    const onBackdrop = (ev: { open: boolean }): void => {
      if (!ev.open) this._clearDecoPurchaseOverlay();
    };

    const onEditEnabled = (): void => {
      cleanup();
      TutorialManager.advanceTo(TutorialStep.GUIDE_PLACE_FURNITURE);
    };

    const onUnlockPlaceReady = (): void => {
      let n = 0;
      const tryUnlockGuide = (): void => {
        const g = DecorationPanel.shared?.getTutorialUnlockPlaceRoomButtonGlobal() ?? null;
        if (g) {
          this._showDecoUnlockPlaceGuideAt(g);
          return;
        }
        if (n++ < 16) requestAnimationFrame(tryUnlockGuide);
      };
      requestAnimationFrame(tryUnlockGuide);
    };

    const onUnlockPopupClosed = (): void => {
      this._clearDecoPurchaseOverlay();
    };

    EventBus.on('nav:openDeco', onDecoOpen);
    EventBus.on('decoration:decoPanelBackdrop', onBackdrop);
    EventBus.on('furniture:edit_enabled', onEditEnabled);
    EventBus.on('decoration:tutorialUnlockPlaceReady', onUnlockPlaceReady);
    EventBus.on('decoration:tutorialUnlockPopupClosed', onUnlockPopupClosed);

    const cleanup = (): void => {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      EventBus.off('nav:openDeco', onDecoOpen);
      EventBus.off('decoration:decoPanelBackdrop', onBackdrop);
      EventBus.off('furniture:edit_enabled', onEditEnabled);
      EventBus.off('decoration:tutorialUnlockPlaceReady', onUnlockPlaceReady);
      EventBus.off('decoration:tutorialUnlockPopupClosed', onUnlockPopupClosed);
      this._clearDecoPurchaseOverlay();
    };
    this._cleanup = cleanup;
  }

  /**
   * 在装修面板之上的 overlay 层展示局部高亮 + 手指 + 气泡（气泡默认贴底，不挡中部列表）。
   */
  private _showDecoFloatingGuideAt(
    globalCenter: PIXI.Point,
    spec: {
      zIndex: number;
      title: string;
      body: string;
      hitW: number;
      hitH: number;
      dimAlpha?: number;
    },
  ): void {
    this._clearDecoPurchaseOverlay();
    const ov = OverlayManager.container;
    ov.sortableChildren = true;
    const top = new PIXI.Container();
    top.zIndex = spec.zIndex;
    top.sortableChildren = true;
    this._overlayTop = top;
    ov.addChild(top);
    ov.sortChildren();

    const local = ov.toLocal(globalCenter);

    const rect: SpotlightRect = {
      x: local.x - spec.hitW / 2,
      y: local.y - spec.hitH / 2,
      w: spec.hitW,
      h: spec.hitH,
      r: 14,
    };
    this._drawSpotlightMaskOn(top, [rect], spec.dimAlpha ?? 0.52);
    this._drawGlowBorderOn(top, rect);
    this._startFingerTapAnim(local.x, local.y, top);

    this._showBubble(
      {
        title: spec.title,
        body: spec.body,
        spotlightTop: rect.y,
        spotlightBottom: rect.y + rect.h,
        spotlightCenterX: local.x,
        dialogVerticalMode: 'bottom',
      },
      top,
    );
  }

  /** 购买条指引（须高于 DecorationPanel） */
  private _showDecoPurchaseGuideAt(globalCenter: PIXI.Point): void {
    this._showDecoFloatingGuideAt(globalCenter, {
      zIndex: 5700,
      title: '购买家具',
      body: '点击绿色按钮，\n用花愿买下这件家具~',
      hitW: 138,
      hitH: 58,
    });
  }

  /** 「获得新家具」上「放入房间」指引（须高于弹层内 zIndex） */
  private _showDecoUnlockPlaceGuideAt(globalCenter: PIXI.Point): void {
    this._showDecoFloatingGuideAt(globalCenter, {
      zIndex: 13000,
      title: '放入房间',
      body: '点「放入房间」，\n到花店里摆放这件家具~',
      hitW: 156,
      hitH: 50,
      dimAlpha: 0.38,
    });
  }

  private _clearDecoPurchaseOverlay(): void {
    this._stopFingerAnim();
    if (this._currentBubble?.parent === this._overlayTop) {
      this._disposeBubble();
    }
    if (this._overlayTop) {
      if (this._overlayTop.parent) this._overlayTop.parent.removeChild(this._overlayTop);
      this._overlayTop.destroy({ children: true });
      this._overlayTop = null;
    }
  }

  private _showGuidePlaceFurniture(): void {
    this._overlay.visible = true;
    this._clearOverlay();

    const bounds = RoomLayoutManager.bounds;
    const placeRect: SpotlightRect = {
      x: bounds.minX,
      y: bounds.minY,
      w: bounds.maxX - bounds.minX,
      h: bounds.maxY - bounds.minY,
      r: 22,
    };

    let placed = false;
    let moved = false;

    const showMoveGuide = (placement?: { x: number; y: number } | null): void => {
      this._clearOverlay();
      this._overlay.visible = true;
      this._drawNonBlockingDim(0.25);
      this._drawGlowBorder(placeRect);

      const fromX = placement?.x ?? (placeRect.x + placeRect.w * 0.56);
      const fromY = placement?.y ?? (placeRect.y + placeRect.h * 0.54);
      const toX = Math.max(bounds.minX + 40, Math.min(bounds.maxX - 40, fromX - 130));
      const toY = Math.max(bounds.minY + 40, Math.min(bounds.maxY - 40, fromY - 70));
      this._startFingerDragAnim(fromX, fromY, toX, toY);

      this._showBubble({
        title: '调整家具',
        body: '家具已经放进房间了。\n按住家具拖到喜欢的位置吧。',
        actionText: '拖动房间里的家具到空地',
        spotlightTop: placeRect.y,
        spotlightBottom: placeRect.y + placeRect.h,
        showAvatar: true,
      });
    };

    const showFinishGuide = (): void => {
      this._clearOverlay();
      this._overlay.visible = true;

      const trayOpenY = Game.logicHeight - 310 - 50 + 30;
      const rect: SpotlightRect = {
        x: DESIGN_WIDTH / 2 - 142,
        y: trayOpenY + 36 - 40,
        w: 284,
        h: 80,
        r: 28,
      };
      this._drawSpotlightMask([rect], 0.62);
      this._drawGlowBorder(rect);
      this._startFingerTapAnim(rect.x + rect.w / 2, rect.y + rect.h / 2);
      this._showBubble({
        title: TUTORIAL_COPY.furniturePlace.finishTitle,
        body: TUTORIAL_COPY.furniturePlace.finishBody,
        actionText: TUTORIAL_COPY.furniturePlace.finishAction,
        spotlightTop: rect.y,
        spotlightBottom: rect.y + rect.h,
        showAvatar: true,
      });
    };

    const onPlaced = (): void => {
      if (placed) return;
      placed = true;
      const first = RoomLayoutManager.getLayout()[0] ?? null;
      showMoveGuide(first);
    };

    const onMoved = (): void => {
      if (moved) return;
      moved = true;
      showFinishGuide();
    };

    const onDragCancelled = (): void => {
      if (placed) return;
      this._nudgeBubble();
      this._showInlineHint(TUTORIAL_COPY.furniturePlace.invalidAction);
    };

    const onEditDisabled = (): void => {
      cleanup();
      TutorialManager.advanceTo(TutorialStep.SHOP_COMPLETE_DIALOG);
    };

    EventBus.on('furniture:placed', onPlaced);
    EventBus.on('furniture:moved', onMoved);
    EventBus.on('furniture:drag_cancelled', onDragCancelled);
    EventBus.on('furniture:edit_disabled', onEditDisabled);

    const existing = RoomLayoutManager.getLayout()[0] ?? null;
    if (existing) {
      placed = true;
      showMoveGuide(existing);
    } else {
      showMoveGuide(null);
    }

    const cleanup = (): void => {
      EventBus.off('furniture:placed', onPlaced);
      EventBus.off('furniture:moved', onMoved);
      EventBus.off('furniture:drag_cancelled', onDragCancelled);
      EventBus.off('furniture:edit_disabled', onEditDisabled);
    };
    this._cleanup = cleanup;
  }

  private _showShopCompleteDialog(): void {
    this._overlay.visible = true;
    this._clearOverlay();
    this._drawSpotlightMask([], 0.5);

    this._showBubble({
      title: '花店焕然一新',
      body: '哇！花店看起来好多了！\n客人们一定会喜欢的~',
      buttonText: '回去继续做花束',
      onButton: () => TutorialManager.advanceTo(TutorialStep.SWITCH_BACK_MERGE),
    });
  }

  private _showSwitchBackMerge(): void {
    this._overlay.visible = true;
    this._clearOverlay();

    const btnCX = DESIGN_WIDTH - 72;
    const btnCY = Game.logicHeight - 90;
    const hitR = 52;
    const pad = 8;
    const rect: SpotlightRect = {
      x: btnCX - hitR - pad,
      y: btnCY - hitR - pad,
      w: (hitR + pad) * 2,
      h: (hitR + pad) * 2,
      r: hitR,
    };

    this._drawSpotlightMask([rect], 0.62);
    this._drawGlowBorder(rect);
    this._startFingerTapAnim(btnCX, btnCY);

    this._showBubble({
      title: '回到合成',
      body: '点击返回按钮，\n继续完成客人的订单吧~',
      actionText: '只能点击高亮返回按钮',
      spotlightTop: rect.y,
      spotlightBottom: rect.y + rect.h,
    });

    this._cleanup = () => {};
  }

  // ══════════════════════════════════════════════
  //  SPOTLIGHT / MASK RENDERING
  // ══════════════════════════════════════════════

  private _drawSpotlightMask(spotlights: SpotlightRect[], alpha: number): void {
    this._drawSpotlightMaskOn(this._overlay, spotlights, alpha);
  }

  private _drawSpotlightMaskOn(parent: PIXI.Container, spotlights: SpotlightRect[], alpha: number): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    if (spotlights.length === 0) {
      const mask = new PIXI.Graphics();
      mask.beginFill(0x000000, alpha);
      mask.drawRect(0, 0, W, H);
      mask.endFill();
      mask.eventMode = 'static';
      parent.addChild(mask);
      return;
    }

    const sp = this._getBoundingSpotlight(spotlights);
    if (sp.y > 0) this._addMaskRectOn(parent, 0, 0, W, sp.y, alpha);
    if (sp.y + sp.h < H) this._addMaskRectOn(parent, 0, sp.y + sp.h, W, H - sp.y - sp.h, alpha);
    if (sp.x > 0) this._addMaskRectOn(parent, 0, sp.y, sp.x, sp.h, alpha);
    if (sp.x + sp.w < W) this._addMaskRectOn(parent, sp.x + sp.w, sp.y, W - sp.x - sp.w, sp.h, alpha);

    for (const s of spotlights) {
      const r = s.r || 0;
      const glow = new PIXI.Graphics();
      glow.lineStyle(4, 0xFFD700, 0.5);
      glow.drawRoundedRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4, r + 2);
      glow.lineStyle(2, 0xFFD700, 0.9);
      glow.drawRoundedRect(s.x, s.y, s.w, s.h, r);
      glow.eventMode = 'none';
      parent.addChild(glow);
      this._breatheAnim(glow);
    }
  }

  private _drawNonBlockingDim(alpha: number): void {
    const g = new PIXI.Graphics();
    g.beginFill(0x000000, alpha);
    g.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    g.endFill();
    g.eventMode = 'none';
    this._overlay.addChild(g);
  }

  private _drawBlockingDimWithGlow(spotlights: SpotlightRect[], alpha: number): void {
    const g = new PIXI.Graphics();
    g.beginFill(0x000000, alpha);
    g.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    g.endFill();
    g.eventMode = 'static';
    this._overlay.addChild(g);

    for (const rect of spotlights) {
      this._drawGlowBorder(rect);
    }
  }

  private _drawMergeGuideGlow(srcRect: SpotlightRect, dstRect: SpotlightRect, pad: number): void {
    this._drawNonBlockingDim(0.62);
    this._drawGlowBorder({
      x: srcRect.x - pad,
      y: srcRect.y - pad,
      w: srcRect.w + pad * 2,
      h: srcRect.h + pad * 2,
      r: 12,
    });
    this._drawGlowBorder({
      x: dstRect.x - pad,
      y: dstRect.y - pad,
      w: dstRect.w + pad * 2,
      h: dstRect.h + pad * 2,
      r: 12,
    });
  }

  private _drawGlowBorder(rect: SpotlightRect): void {
    this._drawGlowBorderOn(this._overlay, rect);
  }

  private _drawGlowBorderOn(parent: PIXI.Container, rect: SpotlightRect): void {
    const r = rect.r || 0;
    const glow = new PIXI.Graphics();
    glow.lineStyle(4, 0xFFD700, 0.5);
    glow.drawRoundedRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4, r + 2);
    glow.lineStyle(2, 0xFFD700, 0.9);
    glow.drawRoundedRect(rect.x, rect.y, rect.w, rect.h, r);
    glow.eventMode = 'none';
    parent.addChild(glow);
    this._breatheAnim(glow);
  }

  private _drawTapTargetBurst(x: number, y: number, radius: number): void {
    this._drawTapTargetBurstOn(this._overlay, x, y, radius);
  }

  private _drawTapTargetBurstOn(parent: PIXI.Container, x: number, y: number, radius: number): void {
    const ring = new PIXI.Graphics();
    ring.lineStyle(6, 0xff7a4d, 0.9);
    ring.drawCircle(x, y, radius);
    ring.lineStyle(3, 0xffffff, 0.9);
    ring.drawCircle(x, y, radius - 6);
    ring.eventMode = 'none';
    parent.addChild(ring);
    this._breatheAnim(ring);

    const label = new PIXI.Text('点这里', {
      fontSize: 22,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xb84b2b,
      strokeThickness: 5,
    });
    label.anchor.set(0.5, 1);
    label.position.set(x, y - radius - 8);
    label.eventMode = 'none';
    parent.addChild(label);
  }

  private _drawDeliverButtonFocus(x: number, y: number): void {
    const w = 146;
    const h = 58;
    const rect: SpotlightRect = { x: x - w / 2, y: y - h / 2, w, h, r: 24 };
    this._drawGlowBorder(rect);

  }

  private _addMaskRect(x: number, y: number, w: number, h: number, alpha: number): void {
    this._addMaskRectOn(this._overlay, x, y, w, h, alpha);
  }

  private _addMaskRectOn(parent: PIXI.Container, x: number, y: number, w: number, h: number, alpha: number): void {
    if (w <= 0 || h <= 0) return;
    const g = new PIXI.Graphics();
    g.beginFill(0x000000, alpha);
    g.drawRect(x, y, w, h);
    g.endFill();
    g.eventMode = 'static';
    parent.addChild(g);
  }

  private _getBoundingSpotlight(spotlights: SpotlightRect[]): SpotlightRect {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of spotlights) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.w);
      maxY = Math.max(maxY, s.y + s.h);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  // ══════════════════════════════════════════════
  //  DIALOG BUBBLE
  // ══════════════════════════════════════════════

  private _showBubble(opts: DialogBubbleOptions, attachParent: PIXI.Container = this._overlay): void {
    this._disposeBubble();
    this._currentBubble = new TutorialDialogBubble(opts);
    attachParent.addChild(this._currentBubble);
  }

  private _disposeBubble(): void {
    if (this._currentBubble) {
      this._currentBubble.dispose();
      this._currentBubble = null;
    }
  }

  private _nudgeBubble(): void {
    if (!this._currentBubble) return;
    TweenManager.cancelTarget(this._currentBubble);
    const startX = this._currentBubble.x;
    TweenManager.to({
      target: this._currentBubble,
      props: { x: startX - 8 },
      duration: 0.06,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        if (!this._currentBubble) return;
        TweenManager.to({
          target: this._currentBubble,
          props: { x: startX + 8 },
          duration: 0.08,
          ease: Ease.easeInOutQuad,
          onComplete: () => {
            if (!this._currentBubble) return;
            TweenManager.to({
              target: this._currentBubble,
              props: { x: startX },
              duration: 0.08,
              ease: Ease.easeOutQuad,
            });
          },
        });
      },
    });
  }

  private _showInlineHint(text: string): void {
    if (this._transientHint) {
      TweenManager.cancelTarget(this._transientHint);
      this._transientHint.parent?.removeChild(this._transientHint);
      this._transientHint.destroy();
      this._transientHint = null;
    }
    const hint = new PIXI.Text(text, {
      fontSize: 22,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x7a4a1e,
      strokeThickness: 5,
    });
    hint.anchor.set(0.5, 0.5);
    hint.position.set(DESIGN_WIDTH / 2, Math.max(Game.safeTop + 92, BoardMetrics.topY - 38));
    hint.alpha = 0;
    this._overlay.addChild(hint);
    this._transientHint = hint;
    TweenManager.to({
      target: hint,
      props: { alpha: 1 },
      duration: 0.12,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        TweenManager.to({
          target: hint,
          props: { alpha: 0 },
          duration: 0.28,
          delay: 0.85,
          onComplete: () => {
            if (this._transientHint === hint) this._transientHint = null;
            hint.parent?.removeChild(hint);
            hint.destroy();
          },
        });
      },
    });
  }

  // ══════════════════════════════════════════════
  //  FINGER ANIMATIONS
  // ══════════════════════════════════════════════

  private _startFingerDragAnim(fromX: number, fromY: number, toX: number, toY: number): void {
    this._stopFingerAnim();
    const finger = this._createFinger();
    finger.position.set(fromX, fromY);
    this._overlay.addChild(finger);

    let cancelled = false;
    const playOnce = (): void => {
      if (cancelled) return;
      finger.position.set(fromX, fromY);
      finger.alpha = 0;
      finger.scale.set(1);

      TweenManager.to({
        target: finger, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad,
        onComplete: () => {
          if (cancelled) return;
          TweenManager.to({
            target: finger.scale, props: { x: 0.85, y: 0.85 }, duration: 0.15,
            onComplete: () => {
              if (cancelled) return;
              TweenManager.to({
                target: finger, props: { x: toX, y: toY }, duration: 0.6, ease: Ease.easeInOutQuad,
                onComplete: () => {
                  if (cancelled) return;
                  TweenManager.to({
                    target: finger.scale, props: { x: 1, y: 1 }, duration: 0.1,
                    onComplete: () => {
                      if (cancelled) return;
                      TweenManager.to({
                        target: finger, props: { alpha: 0 }, duration: 0.3, delay: 0.3,
                        onComplete: () => { if (!cancelled) playOnce(); },
                      });
                    },
                  });
                },
              });
            },
          });
        },
      });
    };
    playOnce();
    this._fingerAnim = { finger, cancel: () => { cancelled = true; } };
  }

  private _startFingerTapAnim(x: number, y: number, attachParent: PIXI.Container = this._overlay): void {
    this._stopFingerAnim();
    const finger = this._createFinger();
    finger.position.set(x, y + 10);
    attachParent.addChild(finger);

    let cancelled = false;
    const playOnce = (): void => {
      if (cancelled) return;
      finger.position.set(x, y + 10);
      finger.alpha = 0;
      finger.scale.set(1);

      TweenManager.to({
        target: finger, props: { alpha: 1 }, duration: 0.2,
        onComplete: () => {
          if (cancelled) return;
          TweenManager.to({ target: finger, props: { y }, duration: 0.15, ease: Ease.easeOutQuad });
          TweenManager.to({
            target: finger.scale, props: { x: 0.8, y: 0.8 }, duration: 0.15,
            onComplete: () => {
              if (cancelled) return;
              TweenManager.to({ target: finger.scale, props: { x: 1, y: 1 }, duration: 0.15 });
              TweenManager.to({
                target: finger, props: { y: y + 10 }, duration: 0.15,
                onComplete: () => {
                  if (cancelled) return;
                  TweenManager.to({
                    target: finger, props: { alpha: 0 }, duration: 0.3, delay: 0.5,
                    onComplete: () => { if (!cancelled) playOnce(); },
                  });
                },
              });
            },
          });
        },
      });
    };
    playOnce();
    this._fingerAnim = { finger, cancel: () => { cancelled = true; } };
  }

  private _stopFingerAnim(): void {
    if (this._fingerAnim) {
      this._fingerAnim.cancel();
      TweenManager.cancelTarget(this._fingerAnim.finger);
      TweenManager.cancelTarget(this._fingerAnim.finger.scale);
      if (this._fingerAnim.finger.parent) {
        this._fingerAnim.finger.parent.removeChild(this._fingerAnim.finger);
      }
      this._fingerAnim.finger.destroy({ children: true });
      this._fingerAnim = null;
    }
  }

  private _createFinger(): PIXI.Container {
    const container = new PIXI.Container();
    const fingerText = new PIXI.Text('\u{1F449}', { fontSize: 40, fontFamily: FONT_FAMILY });
    fingerText.anchor.set(0.4, 0);
    container.addChild(fingerText);
    const shadow = new PIXI.Text('\u{1F449}', { fontSize: 40, fontFamily: FONT_FAMILY });
    shadow.anchor.set(0.4, 0);
    shadow.alpha = 0.3;
    shadow.position.set(2, 2);
    container.addChildAt(shadow, 0);
    container.eventMode = 'none';
    return container;
  }

  // ══════════════════════════════════════════════
  //  BOARD HELPERS
  // ══════════════════════════════════════════════

  private _breatheAnim(target: PIXI.DisplayObject): void {
    const breathe = (): void => {
      TweenManager.to({
        target, props: { alpha: 0.4 }, duration: 0.7, ease: Ease.easeInOutQuad,
        onComplete: () => {
          TweenManager.to({
            target, props: { alpha: 1 }, duration: 0.7, ease: Ease.easeInOutQuad,
            onComplete: breathe,
          });
        },
      });
    };
    breathe();
  }

  private _getCellRect(cellIndex: number): SpotlightRect {
    const cs = BoardMetrics.cellSize;
    const col = cellIndex % BOARD_COLS;
    const row = Math.floor(cellIndex / BOARD_COLS);
    return {
      x: BoardMetrics.paddingX + col * (cs + CELL_GAP),
      y: BoardMetrics.topY + row * (cs + CELL_GAP),
      w: cs, h: cs,
    };
  }

  private _mergePairSpotlight(a: SpotlightRect, b: SpotlightRect, pad: number): SpotlightRect {
    return {
      x: Math.min(a.x, b.x) - pad,
      y: Math.min(a.y, b.y) - pad,
      w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x) + pad * 2,
      h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y) + pad * 2,
      r: 12,
    };
  }

  /**
   * 找棋盘上两个可合成的同 itemId 工具。
   * 源必须是 OPEN（可拖拽），目标可以是 OPEN 或 PEEK（半解锁）。
   * 返回 [srcIndex, dstIndex]，src 一定是 OPEN。
   */
  private _findToolPair(): [number, number] | null {
    const map = new Map<string, { open: number[]; peek: number[] }>();
    for (const cell of BoardManager.cells) {
      if (!cell.itemId || !cell.itemId.startsWith('tool_')) continue;
      if (cell.state !== 'open' && cell.state !== 'peek') continue;
      if (!map.has(cell.itemId)) map.set(cell.itemId, { open: [], peek: [] });
      const entry = map.get(cell.itemId)!;
      if (cell.state === 'open') entry.open.push(cell.index);
      else entry.peek.push(cell.index);
    }
    for (const [, entry] of map) {
      if (entry.open.length >= 1 && (entry.open.length + entry.peek.length) >= 2) {
        const src = entry.open[0];
        const dst = entry.peek.length > 0 ? entry.peek[0] : entry.open[1];
        return [src, dst];
      }
    }
    return null;
  }

  /** 找棋盘上指定 itemId 的格子索引（包括 PEEK） */
  private _findToolOnBoard(itemId: string): number {
    for (const cell of BoardManager.cells) {
      if ((cell.state === 'open' || cell.state === 'peek') && cell.itemId === itemId) {
        return cell.index;
      }
    }
    return -1;
  }

  /** 找棋盘上任意可产出的工具 */
  private _findProducibleTool(): number {
    for (const cell of BoardManager.cells) {
      if (cell.state !== 'open' || !cell.itemId) continue;
      if (cell.itemId.startsWith('tool_')) {
        const level = parseInt(cell.itemId.split('_').pop() || '0', 10);
        if (level >= 3) return cell.index;
      }
    }
    return -1;
  }

  /** 统计棋盘上指定 itemId 的花朵数量 */
  private _countFlowersOnBoard(itemId: string): number {
    let count = 0;
    for (const cell of BoardManager.cells) {
      if (cell.state === 'open' && cell.itemId === itemId) count++;
    }
    return count;
  }

  /** 找棋盘上两个指定 itemId 的花朵 */
  private _findFlowerPair(itemId: string): [number, number] | null {
    const indices: number[] = [];
    for (const cell of BoardManager.cells) {
      if (cell.state === 'open' && cell.itemId === itemId) {
        indices.push(cell.index);
        if (indices.length >= 2) return [indices[0], indices[1]];
      }
    }
    return null;
  }

  /** 找开放花朵 + 丝带花格，用于教学半锁格解锁 */
  private _findFlowerPeekPair(itemId: string): [number, number] | null {
    let openIdx = -1;
    let peekIdx = -1;
    for (const cell of BoardManager.cells) {
      if (cell.itemId !== itemId) continue;
      if (cell.state === 'open' && openIdx < 0) openIdx = cell.index;
      if (cell.state === 'peek' && peekIdx < 0) peekIdx = cell.index;
      if (openIdx >= 0 && peekIdx >= 0) return [openIdx, peekIdx];
    }
    return null;
  }

  private _runCleanup(): void {
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = null;
    }
    TutorialInteractionGuard.clear();
  }

  private _clearOverlay(): void {
    this._clearDecoPurchaseOverlay();
    this._stopFingerAnim();
    this._disposeBubble();
    if (this._transientHint) {
      TweenManager.cancelTarget(this._transientHint);
      this._transientHint.parent?.removeChild(this._transientHint);
      this._transientHint.destroy();
      this._transientHint = null;
    }
    while (this._overlay.children.length > 0) {
      const child = this._overlay.children[0];
      this._overlay.removeChild(child);
      child.destroy({ children: true });
    }
    if (this._storyOverlay && this._storyOverlay.parent) {
      this._storyOverlay.parent.removeChild(this._storyOverlay);
      this._storyOverlay.destroy({ children: true });
      this._storyOverlay = null;
    }
  }

  destroy(): void {
    this._unbind();
    this._clearDecoPurchaseOverlay();
    if (this._overlay.parent) {
      this._overlay.parent.removeChild(this._overlay);
    }
    this._overlay.destroy({ children: true });
  }
}
