/**
 * 特殊客人入场横幅：半身像 + 标志性台词，自右滑入、居中停留、向左滑出。
 * 不拦截操作，仅作棋盘区强提醒。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { OverlayManager } from '@/core/OverlayManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import { BoardMetrics, DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import {
  pickCustomerArrivalLine,
  shouldShowCustomerArrivalBanner,
} from '@/config/CustomerArrivalBannerConfig';
import type { CustomerInstance } from '@/managers/CustomerManager';
import { TutorialManager } from '@/managers/TutorialManager';
import { TextureCache } from '@/utils/TextureCache';

const Z_INDEX = 12000;
const AVATAR_TARGET_H = 200;
const SLIDE_IN_SEC = 0.45;
const HOLD_SEC = 1.0;
const SLIDE_OUT_SEC = 0.55;
const QUEUE_GAP_SEC = 0.3;
const BUBBLE_MAX_W = 420;
const BUBBLE_PAD_X = 22;
const BUBBLE_PAD_Y = 16;

export class CustomerArrivalBanner {
  private static _queue: CustomerInstance[] = [];
  private static _playing = false;
  private static _root: PIXI.Container | null = null;

  static tryShow(customer: CustomerInstance): void {
    if (TutorialManager.isActive) return;
    if (!shouldShowCustomerArrivalBanner(customer)) return;
    if (!pickCustomerArrivalLine(customer.typeId)) return;

    this._queue.push(customer);
    this._pumpQueue();
  }

  private static _pumpQueue(): void {
    if (this._playing || this._queue.length === 0) return;
    const customer = this._queue.shift()!;
    this._playing = true;
    this._playOne(customer, () => {
      this._playing = false;
      if (this._queue.length > 0) {
        TweenManager.to({
          target: { t: 0 },
          props: { t: 1 },
          duration: QUEUE_GAP_SEC,
          onComplete: () => this._pumpQueue(),
        });
      }
    });
  }

  private static _ensureRoot(): PIXI.Container {
    if (!this._root || this._root.destroyed) {
      const root = new PIXI.Container();
      root.zIndex = Z_INDEX;
      root.eventMode = 'passive';
      root.visible = false;
      OverlayManager.container.sortableChildren = true;
      OverlayManager.container.addChild(root);
      this._root = root;
    }
    return this._root;
  }

  private static _anchorY(): number {
    const boardMid = BoardMetrics.topY + BoardMetrics.areaHeight * 0.22;
    return Math.max(280, Math.min(boardMid, Game.logicHeight * 0.42));
  }

  private static _playOne(customer: CustomerInstance, onDone: () => void): void {
    const copy = pickCustomerArrivalLine(customer.typeId);
    if (!copy) {
      onDone();
      return;
    }

    const root = this._ensureRoot();
    root.removeChildren();
    root.visible = true;
    root.alpha = 1;
    OverlayManager.bringToFront();
    root.parent?.sortChildren?.();

    const card = new PIXI.Container();
    root.addChild(card);

    const tex = TextureCache.get(`customer_${customer.typeId}`);
    let avatarBottom = 0;
    if (tex && tex.height > 0) {
      const avatar = new PIXI.Sprite(tex);
      avatar.anchor.set(0.5, 1);
      const scale = AVATAR_TARGET_H / tex.height;
      avatar.scale.set(scale);
      avatar.position.set(0, 0);
      avatar.eventMode = 'none';
      card.addChild(avatar);
      avatarBottom = 8;
    }

    let bubbleTop = avatarBottom + 8;
    if (copy.subtitle) {
      const { container: subtitleBadge, height: badgeH } = this._buildSubtitleBadge(copy.subtitle);
      subtitleBadge.position.set(0, bubbleTop + badgeH / 2);
      card.addChild(subtitleBadge);
      bubbleTop += badgeH + 12;
    }

    const body = new PIXI.Text(`「${copy.line}」`, {
      fontSize: 21,
      fill: 0x5c4a3d,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: BUBBLE_MAX_W - BUBBLE_PAD_X * 2,
      align: 'center',
      lineHeight: 30,
    });
    body.anchor.set(0.5, 0);

    const bubbleW = Math.min(BUBBLE_MAX_W, Math.max(200, body.width + BUBBLE_PAD_X * 2));
    const bubbleH = body.height + BUBBLE_PAD_Y * 2;

    const bubbleShadow = new PIXI.Graphics();
    bubbleShadow.beginFill(0x4c2f4f, 0.14);
    bubbleShadow.drawRoundedRect(-bubbleW / 2 + 5, bubbleTop + 5, bubbleW, bubbleH, 18);
    bubbleShadow.endFill();
    card.addChild(bubbleShadow);

    const bubble = new PIXI.Graphics();
    bubble.beginFill(0xf5ecff, 0.98);
    bubble.lineStyle(2, 0xd8c4ff, 0.95);
    bubble.drawRoundedRect(-bubbleW / 2, bubbleTop, bubbleW, bubbleH, 18);
    bubble.endFill();
    card.addChild(bubble);

    body.position.set(0, bubbleTop + BUBBLE_PAD_Y);
    card.addChild(body);

    const centerX = DESIGN_WIDTH / 2;
    const centerY = this._anchorY();
    const offRight = DESIGN_WIDTH / 2 + 280;
    const offLeft = -DESIGN_WIDTH / 2 - 280;

    card.position.set(centerX + offRight, centerY);
    card.alpha = 0;
    card.scale.set(0.92);

    const finish = (): void => {
      TweenManager.cancelTarget(card);
      TweenManager.cancelTarget(card.scale);
      root.removeChildren();
      root.visible = false;
      onDone();
    };

    TweenManager.to({
      target: card.scale,
      props: { x: 1, y: 1 },
      duration: SLIDE_IN_SEC,
      ease: Ease.easeOutBack,
    });

    // 退场须在居中后再启动，否则 delay 期间 startValues 仍是右侧入场坐标，会先从中间跳回右侧
    TweenManager.to({
      target: card,
      props: { x: centerX, alpha: 1 },
      duration: SLIDE_IN_SEC,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        TweenManager.to({
          target: card,
          props: { x: centerX + offLeft },
          duration: SLIDE_OUT_SEC,
          delay: HOLD_SEC,
          ease: Ease.easeInQuad,
          onComplete: finish,
        });
      },
    });
  }

  /** 副标题胶囊牌：金边奶油底 + 深棕字，与台词气泡风格统一 */
  private static _buildSubtitleBadge(label: string): { container: PIXI.Container; height: number } {
    const padX = 24;
    const padY = 10;
    const badge = new PIXI.Container();

    const text = new PIXI.Text(label, {
      fontSize: 24,
      fill: 0x5c3418,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      letterSpacing: 2,
    });
    text.anchor.set(0.5, 0.5);

    const badgeW = Math.max(140, text.width + padX * 2);
    const badgeH = text.height + padY * 2;
    const badgeR = Math.round(badgeH / 2);

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x4c2f4f, 0.12);
    shadow.drawRoundedRect(-badgeW / 2 + 3, -badgeH / 2 + 4, badgeW, badgeH, badgeR);
    shadow.endFill();
    badge.addChild(shadow);

    const rim = new PIXI.Graphics();
    rim.lineStyle(2.5, 0xd4a040, 1);
    rim.beginFill(0xfff6e8, 0.98);
    rim.drawRoundedRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, badgeR);
    rim.endFill();
    badge.addChild(rim);

    const innerLip = new PIXI.Graphics();
    innerLip.lineStyle(1, 0xf0d8a8, 0.85);
    innerLip.drawRoundedRect(-badgeW / 2 + 3, -badgeH / 2 + 3, badgeW - 6, badgeH - 6, badgeR - 2);
    badge.addChild(innerLip);

    badge.addChild(text);
    return { container: badge, height: badgeH };
  }
}
