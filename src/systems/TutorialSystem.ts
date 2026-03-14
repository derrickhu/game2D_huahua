/**
 * 新手引导系统 v2 - 业界最佳实践
 *
 * 核心设计模式：
 * 1. 镂空高亮（Spotlight Cutout）—— 全屏暗色遮罩上「挖洞」，只露出需要操作的区域
 * 2. 对话框智能避让 —— 对话框自动放在高亮区域上方或下方，绝不遮挡操作区
 * 3. 手指拖拽动画 —— 模拟手指从源拖到目标的循环动画，替代静态箭头
 * 4. 精准事件穿透 —— 只有镂空区域允许交互（防误触 + 聚焦注意力）
 *
 * Step 1: 首次合成引导（拖拽两朵相同花合成）
 * Step 2: 首位客人（引导交付订单赚取金币）
 * Step 3: 建筑认知（点击建筑产出新花束）
 * Step 4: 自由探索（关闭引导，给予新手礼包）
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { BoardManager } from '@/managers/BoardManager';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS, BoardMetrics, BOARD_COLS, CELL_GAP } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const TUTORIAL_STORAGE_KEY = 'huahua_tutorial';

/** 镂空区域描述 */
interface SpotlightRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 圆角半径 */
  r?: number;
}

export enum TutorialStep {
  NOT_STARTED = 0,
  MERGE_INTRO = 1,
  WAIT_MERGE = 2,
  CUSTOMER_INTRO = 3,
  WAIT_DELIVER = 4,
  BUILDING_INTRO = 5,
  WAIT_BUILDING = 6,
  FREE_EXPLORE = 7,
  COMPLETED = 99,
}

export class TutorialSystem {
  private _container: PIXI.Container;
  private _overlay!: PIXI.Container;
  private _step: TutorialStep = TutorialStep.NOT_STARTED;
  private _isActive = false;

  /** 手指动画精灵，用于取消动画 */
  private _fingerAnim: { finger: PIXI.Container; cancel: () => void } | null = null;

  constructor(parentContainer: PIXI.Container) {
    this._container = parentContainer;
    this._overlay = new PIXI.Container();
    this._overlay.visible = false;
    this._overlay.zIndex = 8000;
    this._container.addChild(this._overlay);
  }

  start(): void {
    const saved = this._loadProgress();
    if (saved >= TutorialStep.COMPLETED) {
      this._step = TutorialStep.COMPLETED;
      return;
    }

    this._step = saved || TutorialStep.NOT_STARTED;

    if (this._step === TutorialStep.NOT_STARTED) {
      this._step = TutorialStep.MERGE_INTRO;
      this._isActive = true;
      this._showStep();
    } else if (this._step < TutorialStep.COMPLETED) {
      this._isActive = true;
      this._showStep();
    }
  }

  get isActive(): boolean { return this._isActive; }
  get currentStep(): TutorialStep { return this._step; }
  get isCompleted(): boolean { return this._step >= TutorialStep.COMPLETED; }

  // ====== 步骤调度 ======

  private _showStep(): void {
    if (!this._isActive) return;
    this._overlay.visible = true;
    this._clearOverlay();

    switch (this._step) {
      case TutorialStep.MERGE_INTRO:
      case TutorialStep.WAIT_MERGE:
        this._showMergeGuide();
        break;
      case TutorialStep.CUSTOMER_INTRO:
        this._showCustomerIntro();
        break;
      case TutorialStep.WAIT_DELIVER:
        this._waitForDeliver();
        break;
      case TutorialStep.BUILDING_INTRO:
      case TutorialStep.WAIT_BUILDING:
        this._showBuildingGuide();
        break;
      case TutorialStep.FREE_EXPLORE:
        this._showFreeExplore();
        break;
      default:
        this._complete();
    }
  }

  // ====== Step 1 & 2: 合成引导 ======

  private _showMergeGuide(): void {
    const pairs = this._findMergePair();
    if (!pairs) {
      this._advanceTo(TutorialStep.CUSTOMER_INTRO);
      return;
    }

    const [srcIdx, dstIdx] = pairs;
    const srcRect = this._getCellRect(srcIdx);
    const dstRect = this._getCellRect(dstIdx);

    // 镂空高亮：同时露出两个格子（用一个包围矩形 + 外扩边距）
    const pad = 8;
    const minX = Math.min(srcRect.x, dstRect.x) - pad;
    const minY = Math.min(srcRect.y, dstRect.y) - pad;
    const maxX = Math.max(srcRect.x + srcRect.w, dstRect.x + dstRect.w) + pad;
    const maxY = Math.max(srcRect.y + srcRect.h, dstRect.y + dstRect.h) + pad;

    const spotlights: SpotlightRect[] = [{
      x: minX, y: minY, w: maxX - minX, h: maxY - minY, r: 12,
    }];

    this._drawSpotlightMask(spotlights, 0.65);

    // 手指拖拽动画：从源格子中心拖到目标格子中心
    this._startFingerDragAnim(
      srcRect.x + srcRect.w / 2,
      srcRect.y + srcRect.h / 2,
      dstRect.x + dstRect.w / 2,
      dstRect.y + dstRect.h / 2,
    );

    // 对话框智能避让
    const spotlightTop = minY;
    const spotlightBottom = maxY;
    this._showSmartDialog(
      '🌼 欢迎来到花语小筑！',
      '把两朵相同的花拖到一起，合成更高级的花束吧~',
      null,
      undefined,
      spotlightTop,
      spotlightBottom,
    );

    // 保存步骤 & 监听合成完成
    this._step = TutorialStep.WAIT_MERGE;
    this._saveProgress(this._step);

    const onMerged = () => {
      EventBus.off('board:merged', onMerged);
      this._showMergeSuccess();
    };
    EventBus.on('board:merged', onMerged);
  }

  private _showMergeSuccess(): void {
    this._clearOverlay();
    this._drawSpotlightMask([], 0.5); // 全遮罩，无镂空

    this._showSmartDialog(
      '✨ 太棒了！',
      '合成成功！每种花都有独特的花语和故事哦~\n继续合成吧，客人马上就到！',
      '继续',
      () => this._advanceTo(TutorialStep.CUSTOMER_INTRO),
    );
  }

  // ====== Step 3 & 4: 客人引导 ======

  private _showCustomerIntro(): void {
    this._clearOverlay();
    this._drawSpotlightMask([], 0.5);

    this._showSmartDialog(
      '👋 客人来啦！',
      '看到上方的客人了吗？他们需要特定的花束。\n当花束在棋盘上时会自动锁定，\n点击客人旁边的"✓"按钮即可交付哦！',
      '知道了',
      () => this._advanceTo(TutorialStep.WAIT_DELIVER),
    );
  }

  private _waitForDeliver(): void {
    this._clearOverlay();
    this._overlay.visible = false;

    const onDelivered = () => {
      EventBus.off('customer:delivered', onDelivered);
      this._showDeliverSuccess();
    };
    EventBus.on('customer:delivered', onDelivered);
  }

  private _showDeliverSuccess(): void {
    this._overlay.visible = true;
    this._clearOverlay();
    this._drawSpotlightMask([], 0.5);

    this._showSmartDialog(
      '💰 赚到了第一笔钱！',
      '客人满意离开了！金币可以用来解锁新区域。\n接下来认识一下建筑吧~',
      '继续',
      () => this._advanceTo(TutorialStep.BUILDING_INTRO),
    );
  }

  // ====== Step 5 & 6: 建筑引导 ======

  private _showBuildingGuide(): void {
    this._clearOverlay();

    const buildingIdx = BoardManager.cells.findIndex(
      c => c.state === 'open' && c.itemId?.startsWith('building_perm'),
    );

    if (buildingIdx < 0) {
      this._advanceTo(TutorialStep.FREE_EXPLORE);
      return;
    }

    const rect = this._getCellRect(buildingIdx);
    const pad = 10;
    const spotlights: SpotlightRect[] = [{
      x: rect.x - pad,
      y: rect.y - pad,
      w: rect.w + pad * 2,
      h: rect.h + pad * 2,
      r: 12,
    }];

    this._drawSpotlightMask(spotlights, 0.65);

    // 手指点击动画
    this._startFingerTapAnim(
      rect.x + rect.w / 2,
      rect.y + rect.h / 2,
    );

    const spotlightTop = rect.y - pad;
    const spotlightBottom = rect.y + rect.h + pad;
    this._showSmartDialog(
      '🏠 认识建筑',
      '点击建筑可以产出新的花束哦~\n试试点一下吧！',
      null,
      undefined,
      spotlightTop,
      spotlightBottom,
    );

    this._step = TutorialStep.WAIT_BUILDING;
    this._saveProgress(this._step);

    const onProduced = () => {
      EventBus.off('building:produced', onProduced);
      this._showBuildingSuccess();
    };
    EventBus.on('building:produced', onProduced);

    // 30秒超时自动跳过
    setTimeout(() => {
      EventBus.off('building:produced', onProduced);
      if (this._step === TutorialStep.WAIT_BUILDING) {
        this._advanceTo(TutorialStep.FREE_EXPLORE);
      }
    }, 30000);
  }

  private _showBuildingSuccess(): void {
    this._clearOverlay();
    this._drawSpotlightMask([], 0.5);

    this._showSmartDialog(
      '🌸 很好！',
      '建筑是获取花束的主要方式。\n合成更多花束来满足客人吧！',
      '继续',
      () => this._advanceTo(TutorialStep.FREE_EXPLORE),
    );
  }

  // ====== Step 7: 自由探索 + 新手礼包 ======

  private _showFreeExplore(): void {
    this._clearOverlay();
    this._drawSpotlightMask([], 0.55);

    CurrencyManager.addStamina(50);
    CurrencyManager.addGold(200);
    CurrencyManager.addDiamond(20);

    this._showSmartDialog(
      '🎁 新手礼包',
      '恭喜完成引导！获得：\n💖 体力 +50   💰 金币 +200   💎 钻石 +20\n\n💡 小贴士：长按物品可查看合成路线哦！',
      '开始游戏',
      () => this._complete(),
    );
  }

  // ====== 核心：镂空高亮遮罩 ======

  /**
   * 绘制「镂空高亮」遮罩 —— 业界最佳引导模式
   *
   * 原理：用全屏半透明黑色遮罩覆盖整个屏幕，然后在指定区域「挖洞」
   * - 镂空区域完全透明，可以看到并操作下方内容
   * - 非镂空区域变暗，引导玩家注意力
   * - 事件：镂空区域的事件穿透到下方（玩家可操作），非镂空区域阻断事件
   */
  private _drawSpotlightMask(spotlights: SpotlightRect[], alpha: number): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    if (spotlights.length === 0) {
      // 无镂空区域 —— 全屏阻断遮罩
      const mask = new PIXI.Graphics();
      mask.beginFill(0x000000, alpha);
      mask.drawRect(0, 0, W, H);
      mask.endFill();
      mask.eventMode = 'static';
      this._overlay.addChild(mask);
      return;
    }

    // ---- 有镂空区域：分区域绘制遮罩 + 镂空区域不阻断 ----

    // 方案：将屏幕分成「遮罩区域」和「镂空区域」
    // 遮罩区域用多个 Graphics 拼接（上、下、左、右），eventMode = 'static' 阻断
    // 镂空区域不画任何东西，事件自然穿透到下方的棋盘

    // 为简化，我们只处理一个主 spotlight（取所有 spotlight 的包围盒）
    const sp = this._getBoundingSpotlight(spotlights);

    // 上方遮罩（从顶部到 spotlight 顶部）
    if (sp.y > 0) {
      this._addMaskRect(0, 0, W, sp.y, alpha);
    }
    // 下方遮罩（从 spotlight 底部到屏幕底部）
    if (sp.y + sp.h < H) {
      this._addMaskRect(0, sp.y + sp.h, W, H - sp.y - sp.h, alpha);
    }
    // 左侧遮罩（spotlight 高度范围内的左侧）
    if (sp.x > 0) {
      this._addMaskRect(0, sp.y, sp.x, sp.h, alpha);
    }
    // 右侧遮罩（spotlight 高度范围内的右侧）
    if (sp.x + sp.w < W) {
      this._addMaskRect(sp.x + sp.w, sp.y, W - sp.x - sp.w, sp.h, alpha);
    }

    // 镂空区域边框（发光高亮效果）
    for (const s of spotlights) {
      const r = s.r || 0;
      const glow = new PIXI.Graphics();

      // 外发光（模拟光晕）
      glow.lineStyle(4, 0xFFD700, 0.5);
      glow.drawRoundedRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4, r + 2);
      glow.lineStyle(2, 0xFFD700, 0.9);
      glow.drawRoundedRect(s.x, s.y, s.w, s.h, r);

      glow.eventMode = 'none'; // 不阻断
      this._overlay.addChild(glow);

      // 呼吸动画
      this._breatheAnim(glow);
    }
  }

  /** 添加一个遮罩矩形块（阻断事件） */
  private _addMaskRect(x: number, y: number, w: number, h: number, alpha: number): void {
    if (w <= 0 || h <= 0) return;
    const g = new PIXI.Graphics();
    g.beginFill(0x000000, alpha);
    g.drawRect(x, y, w, h);
    g.endFill();
    g.eventMode = 'static'; // 阻断事件
    this._overlay.addChild(g);
  }

  /** 获取多个 spotlight 的包围盒 */
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

  // ====== 核心：对话框智能避让 ======

  /**
   * 智能对话框 —— 自动避让高亮区域
   *
   * 逻辑：
   * - 优先放在 spotlight 上方（常见方案）
   * - 如果上方空间不够，放在 spotlight 下方
   * - 如果都不够（极端情况），放在屏幕最顶部
   */
  private _showSmartDialog(
    title: string,
    body: string,
    buttonText: string | null,
    onButton?: () => void,
    /** 高亮区域顶部 Y（用于智能避让） */
    spotlightTop?: number,
    /** 高亮区域底部 Y */
    spotlightBottom?: number,
  ): void {
    const dialog = new PIXI.Container();
    const cx = DESIGN_WIDTH / 2;
    const cardW = 520;
    const cardH = buttonText ? 200 : 160;
    const margin = 20; // 对话框与 spotlight 的间距

    // 计算对话框 Y 位置
    let cardY: number;

    if (spotlightTop !== undefined && spotlightBottom !== undefined) {
      const spaceAbove = spotlightTop;
      const spaceBelow = Game.logicHeight - spotlightBottom;

      if (spaceAbove >= cardH + margin + 40) {
        // 放在 spotlight 上方
        cardY = spotlightTop - cardH - margin;
      } else if (spaceBelow >= cardH + margin + 40) {
        // 放在 spotlight 下方
        cardY = spotlightBottom + margin;
      } else {
        // 空间都不够，放在屏幕顶部安全区域
        cardY = 40;
      }
    } else {
      // 无 spotlight 信息，居中偏上
      cardY = Game.logicHeight * 0.3 - cardH / 2;
    }

    // 确保不超出屏幕
    cardY = Math.max(30, Math.min(cardY, Game.logicHeight - cardH - 30));

    // 背景卡片 —— 奶油底 + 金色边框 + 圆角
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFBF0, 0.96);
    bg.drawRoundedRect(cx - cardW / 2, cardY, cardW, cardH, 20);
    bg.endFill();
    bg.lineStyle(2.5, 0xFFD700, 0.7);
    bg.drawRoundedRect(cx - cardW / 2, cardY, cardW, cardH, 20);
    dialog.addChild(bg);

    // 标题
    const titleText = new PIXI.Text(title, {
      fontSize: 22,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    titleText.anchor.set(0.5, 0);
    titleText.position.set(cx, cardY + 18);
    dialog.addChild(titleText);

    // 正文
    const bodyText = new PIXI.Text(body, {
      fontSize: 15,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: cardW - 60,
      lineHeight: 22,
    });
    bodyText.anchor.set(0.5, 0);
    bodyText.position.set(cx, cardY + 52);
    dialog.addChild(bodyText);

    // 按钮
    if (buttonText && onButton) {
      const btnW = 160;
      const btnH = 44;
      const btnY = cardY + cardH - btnH - 16;

      const btn = new PIXI.Graphics();
      btn.beginFill(COLORS.BUTTON_PRIMARY);
      btn.drawRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 22);
      btn.endFill();
      dialog.addChild(btn);

      const btnLabel = new PIXI.Text(buttonText, {
        fontSize: 17,
        fill: 0xFFFFFF,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      btnLabel.anchor.set(0.5, 0.5);
      btnLabel.position.set(cx, btnY + btnH / 2);
      dialog.addChild(btnLabel);

      const hitArea = new PIXI.Container();
      hitArea.hitArea = new PIXI.Rectangle(cx - btnW / 2, btnY, btnW, btnH);
      hitArea.eventMode = 'static';
      hitArea.cursor = 'pointer';
      hitArea.on('pointerdown', () => {
        // 点击反馈
        btn.tint = 0xFFFFFF;
        setTimeout(() => { btn.tint = 0xFFFFFF; }, 120);
        onButton();
      });
      dialog.addChild(hitArea);
    }

    // 入场动画 —— 从透明 + 小缩放弹入
    dialog.alpha = 0;
    dialog.scale.set(0.9);
    dialog.pivot.set(cx, cardY + cardH / 2);
    dialog.position.set(cx, cardY + cardH / 2);

    TweenManager.to({
      target: dialog,
      props: { alpha: 1 },
      duration: 0.25,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: dialog.scale,
      props: { x: 1, y: 1 },
      duration: 0.3,
      ease: Ease.easeOutBack,
    });

    this._overlay.addChild(dialog);
  }

  // ====== 核心：手指动画引导 ======

  /**
   * 手指拖拽动画 —— 模拟从源拖到目标的手指
   * 循环播放，直到玩家完成操作
   */
  private _startFingerDragAnim(
    fromX: number, fromY: number,
    toX: number, toY: number,
  ): void {
    this._stopFingerAnim();

    const finger = this._createFinger();
    finger.position.set(fromX, fromY);
    this._overlay.addChild(finger);

    let cancelled = false;
    const playOnce = () => {
      if (cancelled) return;

      // 重置到起点
      finger.position.set(fromX, fromY);
      finger.alpha = 0;
      finger.scale.set(1);

      // 淡入
      TweenManager.to({
        target: finger,
        props: { alpha: 1 },
        duration: 0.2,
        ease: Ease.easeOutQuad,
        onComplete: () => {
          if (cancelled) return;

          // 按下效果（缩小一点）
          TweenManager.to({
            target: finger.scale,
            props: { x: 0.85, y: 0.85 },
            duration: 0.15,
            onComplete: () => {
              if (cancelled) return;

              // 拖拽到目标
              TweenManager.to({
                target: finger,
                props: { x: toX, y: toY },
                duration: 0.6,
                ease: Ease.easeInOutQuad,
                onComplete: () => {
                  if (cancelled) return;

                  // 松开效果
                  TweenManager.to({
                    target: finger.scale,
                    props: { x: 1, y: 1 },
                    duration: 0.1,
                    onComplete: () => {
                      if (cancelled) return;

                      // 淡出 + 等待后重播
                      TweenManager.to({
                        target: finger,
                        props: { alpha: 0 },
                        duration: 0.3,
                        delay: 0.3,
                        onComplete: () => {
                          if (!cancelled) playOnce();
                        },
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

    this._fingerAnim = {
      finger,
      cancel: () => { cancelled = true; },
    };
  }

  /**
   * 手指点击动画 —— 模拟在目标位置点击
   */
  private _startFingerTapAnim(x: number, y: number): void {
    this._stopFingerAnim();

    const finger = this._createFinger();
    finger.position.set(x, y + 10);
    this._overlay.addChild(finger);

    let cancelled = false;
    const playOnce = () => {
      if (cancelled) return;

      finger.position.set(x, y + 10);
      finger.alpha = 0;
      finger.scale.set(1);

      // 淡入
      TweenManager.to({
        target: finger,
        props: { alpha: 1 },
        duration: 0.2,
        onComplete: () => {
          if (cancelled) return;

          // 按下（向上移动 + 缩小）
          TweenManager.to({
            target: finger,
            props: { y: y },
            duration: 0.15,
            ease: Ease.easeOutQuad,
          });
          TweenManager.to({
            target: finger.scale,
            props: { x: 0.8, y: 0.8 },
            duration: 0.15,
            onComplete: () => {
              if (cancelled) return;

              // 松开
              TweenManager.to({
                target: finger.scale,
                props: { x: 1, y: 1 },
                duration: 0.15,
              });
              TweenManager.to({
                target: finger,
                props: { y: y + 10 },
                duration: 0.15,
                onComplete: () => {
                  if (cancelled) return;

                  // 淡出
                  TweenManager.to({
                    target: finger,
                    props: { alpha: 0 },
                    duration: 0.3,
                    delay: 0.5,
                    onComplete: () => {
                      if (!cancelled) playOnce();
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

    this._fingerAnim = {
      finger,
      cancel: () => { cancelled = true; },
    };
  }

  /** 停止手指动画 */
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

  /** 创建手指图形（用绘制的简约手指图标） */
  private _createFinger(): PIXI.Container {
    const container = new PIXI.Container();

    // 手指图标（用 emoji text 或简单图形）
    const fingerText = new PIXI.Text('👆', {
      fontSize: 40,
      fontFamily: FONT_FAMILY,
    });
    fingerText.anchor.set(0.4, 0); // 指尖大约在顶部偏左
    container.addChild(fingerText);

    // 添加阴影效果
    const shadow = new PIXI.Text('👆', {
      fontSize: 40,
      fontFamily: FONT_FAMILY,
    });
    shadow.anchor.set(0.4, 0);
    shadow.alpha = 0.3;
    shadow.position.set(2, 2);
    container.addChildAt(shadow, 0);

    container.eventMode = 'none'; // 不阻断事件
    return container;
  }

  // ====== 工具方法 ======

  /** 呼吸动画 */
  private _breatheAnim(target: PIXI.DisplayObject): void {
    const breathe = () => {
      TweenManager.to({
        target,
        props: { alpha: 0.4 },
        duration: 0.7,
        ease: Ease.easeInOutQuad,
        onComplete: () => {
          TweenManager.to({
            target,
            props: { alpha: 1 },
            duration: 0.7,
            ease: Ease.easeInOutQuad,
            onComplete: breathe,
          });
        },
      });
    };
    breathe();
  }

  /** 获取棋盘格子的屏幕矩形 */
  private _getCellRect(cellIndex: number): SpotlightRect {
    const cs = BoardMetrics.cellSize;
    const col = cellIndex % BOARD_COLS;
    const row = Math.floor(cellIndex / BOARD_COLS);
    const x = BoardMetrics.paddingX + col * (cs + CELL_GAP);
    const y = BoardMetrics.topY + row * (cs + CELL_GAP);
    return { x, y, w: cs, h: cs };
  }

  /** 找到棋盘上第一对可合成的物品 */
  private _findMergePair(): [number, number] | null {
    const countMap = new Map<string, number[]>();
    for (const cell of BoardManager.cells) {
      if (cell.state !== 'open' || !cell.itemId) continue;
      const def = ITEM_DEFS.get(cell.itemId);
      if (!def || def.level >= def.maxLevel) continue;
      if (!countMap.has(cell.itemId)) countMap.set(cell.itemId, []);
      countMap.get(cell.itemId)!.push(cell.index);
    }
    for (const [, indices] of countMap) {
      if (indices.length >= 2) return [indices[0], indices[1]];
    }
    return null;
  }

  private _advanceTo(step: TutorialStep): void {
    this._step = step;
    this._saveProgress(step);
    this._showStep();
  }

  private _complete(): void {
    this._step = TutorialStep.COMPLETED;
    this._isActive = false;
    this._saveProgress(TutorialStep.COMPLETED);
    this._clearOverlay();
    this._overlay.visible = false;
    EventBus.emit('tutorial:completed');
  }

  private _clearOverlay(): void {
    this._stopFingerAnim();
    while (this._overlay.children.length > 0) {
      const child = this._overlay.children[0];
      this._overlay.removeChild(child);
      child.destroy({ children: true });
    }
  }

  // ====== 存档 ======

  private _saveProgress(step: TutorialStep): void {
    try {
      _api?.setStorageSync(TUTORIAL_STORAGE_KEY, String(step));
    } catch (_) {}
  }

  private _loadProgress(): TutorialStep {
    try {
      const raw = _api?.getStorageSync(TUTORIAL_STORAGE_KEY);
      if (raw) return Number(raw) as TutorialStep;
    } catch (_) {}
    return TutorialStep.NOT_STARTED;
  }
}
