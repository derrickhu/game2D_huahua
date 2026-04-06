/**
 * 主场景店铺整行：默认看店主+礼包+客人，左侧大号活动入口藏在屏外。
 *
 * **不再支持横向滑动展开左侧**——只能点「展开 / 收起」；避免与客人区横向滑动抢手势、拖动手感割裂。
 * 客人列表的滑动由 `CustomerScrollArea` 单独处理。
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventManager } from '@/managers/EventManager';
import { FloatingMenu } from './FloatingMenu';
import { TextureCache } from '@/utils/TextureCache';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { ENABLE_CHALLENGE_LEVEL_FEATURE } from '@/config/FeatureFlags';

/** 左侧活动列宽度（大图标区） */
export const SHOP_PANORAMA_ACTIVITY_W = 232;
/** 与 CustomerScrollArea 高度对齐，避免裁切需求面板 */
export const SHOP_PANORAMA_VIEW_H = 310;

const BIG_BTN = 92;
const BIG_ICON = 72;
const BIG_GAP = 20;
const BIG_R = 18;
const RED_DOT_R = 5;
const ACTIVITY_PAD_TOP = 28;

/** 店主左侧展开 / 收起条尺寸 */
const TOGGLE_BTN_W = 36;
const TOGGLE_BTN_H = 80;
const TOGGLE_TWEEN_DURATION = 0.34;

interface TaskDef {
  id: string;
  texKey: string;
  event: string;
  redDotKey?: string;
  isVisible?: () => boolean;
}

const TASK_DEFS: TaskDef[] = [
  { id: 'quest', texKey: 'icon_quest', event: 'nav:openQuest', redDotKey: 'quest' },
  {
    id: 'challenge',
    texKey: 'icon_challenge',
    event: 'nav:openChallenge',
    isVisible: () => ENABLE_CHALLENGE_LEVEL_FEATURE,
  },
  {
    id: 'event',
    texKey: 'icon_gift',
    event: 'nav:openEvent',
    redDotKey: 'event',
    isVisible: () => EventManager.hasActiveEvent,
  },
];

export class ShopRowPanoramaScroll extends PIXI.Container {
  private _viewportW: number;
  private _viewportH: number;
  private _activityW: number;
  private _maskG!: PIXI.Graphics;
  private _scrollContent!: PIXI.Container;
  private _underlay!: PIXI.Graphics;
  private _activityRoot!: PIXI.Container;
  private _arrowLayer!: PIXI.Container;
  private _arrowHintL!: PIXI.Graphics;
  private _arrowHintR!: PIXI.Graphics;
  private _toggleLayer!: PIXI.Container;
  private _expandBtn!: PIXI.Container;
  private _collapseBtn!: PIXI.Container;

  private _shopBlock: PIXI.Container | null = null;
  private _taskCards = new Map<string, { root: PIXI.Container; redDot: PIXI.Graphics; def: TaskDef }>();

  private _minScrollX = 0;
  private _maxScrollX = 0;

  private _arrowPhase = 0;
  private _stopped = false;

  constructor(viewportW = DESIGN_WIDTH, viewportH = SHOP_PANORAMA_VIEW_H, activityW = SHOP_PANORAMA_ACTIVITY_W) {
    super();
    this._viewportW = viewportW;
    this._viewportH = viewportH;
    this._activityW = activityW;

    this._maskG = new PIXI.Graphics();
    this._scrollContent = new PIXI.Container();
    this._scrollContent.mask = this._maskG;

    this._underlay = new PIXI.Graphics();
    /** 仅作占位/层次底图，不接收指针（整行滑动已关闭） */
    this._underlay.eventMode = 'none';

    this._activityRoot = new PIXI.Container();

    this._arrowLayer = new PIXI.Container();
    this._arrowHintL = new PIXI.Graphics();
    this._arrowHintR = new PIXI.Graphics();
    this._arrowLayer.addChild(this._arrowHintL);
    this._arrowLayer.addChild(this._arrowHintR);

    this._toggleLayer = new PIXI.Container();
    this._buildToggleButtons();

    this.addChild(this._maskG);
    this.addChild(this._scrollContent);
    this.addChild(this._arrowLayer);
    this.addChild(this._toggleLayer);

    this._scrollContent.addChild(this._underlay);
    this._scrollContent.addChild(this._activityRoot);
    this._buildActivityColumn();
    this._redrawUnderlay();
    this._drawViewportMask();
    this._scrollContent.x = -this._activityW;
    this._refreshScrollBounds();
    this._updateToggleVisibility();
  }

  /** 右侧店铺块（店主、礼包、客人区），内部坐标与原先 shopArea 子节点一致 */
  setShopBlock(block: PIXI.Container): void {
    if (this._shopBlock) {
      this._scrollContent.removeChild(this._shopBlock);
    }
    this._shopBlock = block;
    block.position.set(this._activityW, 0);
    this._scrollContent.addChild(block);
    this._scrollContent.setChildIndex(this._underlay, 0);
    this._scrollContent.setChildIndex(this._activityRoot, 1);
    this._scrollContent.setChildIndex(block, 2);
  }

  updateRedDots(): void {
    for (const [, card] of this._taskCards) {
      if (card.def.isVisible) {
        card.root.visible = card.def.isVisible();
      }
      if (card.def.redDotKey) {
        card.redDot.visible = FloatingMenu.getRedDot(card.def.redDotKey);
      }
    }
    this._layoutActivityColumn();
    this._updateToggleVisibility();
  }

  update(dt: number): void {
    if (this._stopped) return;
    this._arrowPhase += dt * 2.6;
    this._updateArrowHints();
    this._updateToggleVisibility();
    /** 整行位置仅由展开/收起 tween 驱动，无惯性滑动 */
    this._clampScroll(true);
  }

  destroy(options?: PIXI.IDestroyOptions | boolean): void {
    this._stopped = true;
    TweenManager.cancelTarget(this._scrollContent);
    super.destroy(options);
  }

  private _buildToggleButtons(): void {
    const cy = this._viewportH * 0.38 - TOGGLE_BTN_H / 2;

    this._expandBtn = this._makeToggleButton('››', '展开', TOGGLE_BTN_W, TOGGLE_BTN_H);
    this._expandBtn.position.set(4, cy);
    this._expandBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._animateScrollTo(this._maxScrollX);
    });
    this._toggleLayer.addChild(this._expandBtn);

    this._collapseBtn = this._makeToggleButton('‹‹', '收起', TOGGLE_BTN_W, TOGGLE_BTN_H);
    this._collapseBtn.position.set(6, cy);
    this._collapseBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._animateScrollTo(this._minScrollX);
    });
    this._toggleLayer.addChild(this._collapseBtn);

    this._updateToggleVisibility();
  }

  private _makeToggleButton(chevron: string, label: string, w: number, h: number): PIXI.Container {
    const root = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0xfffdf8, 0.78);
    bg.lineStyle(1.5, 0xe8c8a0, 0.95);
    bg.drawRoundedRect(0, 0, w, h, 10);
    bg.endFill();
    root.addChild(bg);

    const ch = new PIXI.Text(chevron, {
      fontSize: 16,
      fill: 0xa1887f,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    ch.anchor.set(0.5, 0);
    ch.position.set(w / 2, 8);
    root.addChild(ch);

    const lines = label.length === 2 ? `${label[0]}\n${label[1]}` : label;
    const tx = new PIXI.Text(lines, {
      fontSize: 11,
      fill: 0x6d4c41,
      fontFamily: FONT_FAMILY,
      lineHeight: 13,
      align: 'center',
    });
    tx.anchor.set(0.5, 0);
    tx.position.set(w / 2, 28);
    root.addChild(tx);

    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(0, 0, w, h);
    return root;
  }

  private _animateScrollTo(targetX: number): void {
    TweenManager.cancelTarget(this._scrollContent);
    TweenManager.to({
      target: this._scrollContent,
      props: { x: targetX },
      duration: TOGGLE_TWEEN_DURATION,
      ease: Ease.easeOutQuad,
      onUpdate: () => {
        this._clampScroll(false);
        this._updateToggleVisibility();
      },
      onComplete: () => {
        this._clampScroll(false);
        this._updateToggleVisibility();
      },
    });
  }

  /** 店铺态显示「展开」，活动态显示「收起」（与滑动位置同步） */
  private _updateToggleVisibility(): void {
    if (!this._expandBtn || !this._collapseBtn) return;
    if (this._minScrollX >= -4) {
      this._expandBtn.visible = false;
      this._collapseBtn.visible = false;
      return;
    }
    const x = this._scrollContent.x;
    const mid = this._minScrollX * 0.5;
    this._expandBtn.visible = x < mid - 8;
    this._collapseBtn.visible = x > mid + 8;
  }

  private _contentTotalW(): number {
    return this._activityW + this._viewportW;
  }

  private _refreshScrollBounds(): void {
    const cw = this._contentTotalW();
    this._minScrollX = Math.min(0, this._viewportW - cw);
    this._maxScrollX = 0;
    this._clampScroll(false);
  }

  private _clampScroll(soft: boolean): void {
    let x = this._scrollContent.x;
    if (x > this._maxScrollX) x = this._maxScrollX;
    if (x < this._minScrollX) x = this._minScrollX;
    this._scrollContent.x = x;
  }

  private _drawViewportMask(): void {
    this._maskG.clear();
    this._maskG.beginFill(0xffffff);
    this._maskG.drawRect(0, 0, this._viewportW, this._viewportH);
    this._maskG.endFill();
  }

  private _redrawUnderlay(): void {
    const w = this._contentTotalW();
    this._underlay.clear();
    this._underlay.beginFill(0xffffff, 0.004);
    this._underlay.drawRect(0, 0, w, this._viewportH);
    this._underlay.endFill();
    this._underlay.hitArea = new PIXI.Rectangle(0, 0, w, this._viewportH);
  }

  private _buildActivityColumn(): void {
    for (const def of TASK_DEFS) {
      const card = this._buildBigTaskCard(def);
      this._taskCards.set(def.id, card);
      this._activityRoot.addChild(card.root);
    }
    this._layoutActivityColumn();
  }

  private _buildBigTaskCard(def: TaskDef): { root: PIXI.Container; redDot: PIXI.Graphics; def: TaskDef } {
    const root = new PIXI.Container();

    const bg = new PIXI.Graphics();
    bg.beginFill(0xfffdf8, 0.72);
    bg.lineStyle(2, 0xffffff, 0.55);
    bg.drawRoundedRect(0, 0, BIG_BTN, BIG_BTN, BIG_R);
    bg.endFill();
    root.addChild(bg);

    const tex = TextureCache.get(def.texKey);
    const icon = new PIXI.Sprite(tex && tex.width > 0 ? tex : PIXI.Texture.EMPTY);
    icon.anchor.set(0.5);
    icon.position.set(BIG_BTN / 2, BIG_BTN / 2);
    if (tex && tex.width > 0) {
      const s = Math.min(BIG_ICON / tex.width, BIG_ICON / tex.height);
      icon.scale.set(s);
    }
    root.addChild(icon);

    const redDot = new PIXI.Graphics();
    redDot.beginFill(0xff3333);
    redDot.drawCircle(BIG_BTN - 5, 5, RED_DOT_R);
    redDot.endFill();
    redDot.lineStyle(1, 0xffffff);
    redDot.drawCircle(BIG_BTN - 5, 5, RED_DOT_R);
    redDot.visible = false;
    root.addChild(redDot);

    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(0, 0, BIG_BTN, BIG_BTN);
    root.on('pointerdown', () => {
      TweenManager.cancelTarget(root.scale);
      root.scale.set(0.92);
      TweenManager.to({
        target: root.scale,
        props: { x: 1, y: 1 },
        duration: 0.2,
        ease: Ease.easeOutBack,
      });
      EventBus.emit(def.event);
    });

    if (def.isVisible) {
      root.visible = def.isVisible();
    }

    return { root, redDot, def };
  }

  private _layoutActivityColumn(): void {
    const colX = (this._activityW - BIG_BTN) / 2;
    let y = ACTIVITY_PAD_TOP;
    for (const def of TASK_DEFS) {
      const card = this._taskCards.get(def.id)!;
      if (!card.root.visible) continue;
      card.root.position.set(colX, y);
      y += BIG_BTN + BIG_GAP;
    }
  }

  /** 已有展开/收起按钮，不再显示边缘呼吸箭头，避免干扰 */
  private _updateArrowHints(): void {
    this._arrowHintL.visible = false;
    this._arrowHintR.visible = false;
  }

}
