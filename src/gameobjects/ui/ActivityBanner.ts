/**
 * 活动横幅 - 顶部横向滚动 Banner
 *
 * 参考主流手游的公告/活动入口设计：
 * - 横向排列多个入口卡片（限时活动 / 每日任务 / 挑战关卡）
 * - 自动轮播 + 手动滑动
 * - 每个卡片可点击打开对应面板
 * - 有红点提示
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { COLORS, FONT_FAMILY } from '@/config/Constants';
import { EventManager } from '@/managers/EventManager';
import { QuestManager } from '@/managers/QuestManager';
import { ChallengeManager } from '@/managers/ChallengeManager';
import { FloatingMenu } from './FloatingMenu';

/** 横幅高度 */
export const BANNER_HEIGHT = 38;

/** 单个入口卡片 */
interface BannerEntry {
  id: string;
  icon: string;
  label: string;
  /** 背景色 */
  color: number;
  /** 点击事件 */
  event: string;
  /** 红点 key */
  redDotKey?: string;
  /** 是否可见的动态判断 */
  isVisible?: () => boolean;
}

/** 所有可能的入口 */
const ENTRIES: BannerEntry[] = [
  {
    id: 'event',
    icon: '🎪',
    label: '限时活动',
    color: 0xFFB7C5,
    event: 'nav:openEvent',
    redDotKey: 'event',
    isVisible: () => EventManager.hasActiveEvent,
  },
  {
    id: 'quest',
    icon: '📋',
    label: '每日任务',
    color: 0xFFD699,
    event: 'nav:openQuest',
    redDotKey: 'quest',
  },
  {
    id: 'challenge',
    icon: '⚔️',
    label: '挑战关卡',
    color: 0xB8D4FF,
    event: 'nav:openChallenge',
  },
];

const CARD_H = 30;
const CARD_GAP = 8;
const CARD_RADIUS = 15;
const RED_DOT_R = 4;

export class ActivityBanner extends PIXI.Container {
  private _areaWidth: number;
  private _cards: Map<string, {
    container: PIXI.Container;
    redDot: PIXI.Graphics;
    entry: BannerEntry;
  }> = new Map();

  constructor(areaWidth: number) {
    super();
    this._areaWidth = areaWidth;
    this._build();
  }

  /** 刷新可见性和红点 */
  updateRedDots(): void {
    for (const [, card] of this._cards) {
      // 可见性
      if (card.entry.isVisible) {
        card.container.visible = card.entry.isVisible();
      }
      // 红点
      if (card.entry.redDotKey) {
        card.redDot.visible = FloatingMenu.getRedDot(card.entry.redDotKey);
      }
    }
    // 重排位置（因为有的卡片可能隐藏了）
    this._relayout();
  }

  private _build(): void {
    for (const entry of ENTRIES) {
      const card = this._buildCard(entry);
      this._cards.set(entry.id, card);
      this.addChild(card.container);
    }
    this._relayout();
  }

  private _buildCard(entry: BannerEntry): {
    container: PIXI.Container;
    redDot: PIXI.Graphics;
    entry: BannerEntry;
  } {
    const container = new PIXI.Container();

    // 测量文字宽度来决定卡片宽度
    const labelText = new PIXI.Text(`${entry.icon} ${entry.label}`, {
      fontSize: 12,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    const cardW = labelText.width + 24;

    // 胶囊背景
    const bg = new PIXI.Graphics();
    bg.beginFill(entry.color, 0.85);
    bg.drawRoundedRect(0, 0, cardW, CARD_H, CARD_RADIUS);
    bg.endFill();
    // 边框
    bg.lineStyle(1, 0xFFFFFF, 0.3);
    bg.drawRoundedRect(0, 0, cardW, CARD_H, CARD_RADIUS);
    container.addChild(bg);

    // 文字
    labelText.anchor.set(0.5, 0.5);
    labelText.position.set(cardW / 2, CARD_H / 2);
    container.addChild(labelText);

    // 红点
    const redDot = new PIXI.Graphics();
    redDot.beginFill(0xFF3333);
    redDot.drawCircle(cardW - 4, 4, RED_DOT_R);
    redDot.endFill();
    redDot.lineStyle(1, 0xFFFFFF);
    redDot.drawCircle(cardW - 4, 4, RED_DOT_R);
    redDot.visible = false;
    container.addChild(redDot);

    // 点击
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new PIXI.Rectangle(0, 0, cardW, CARD_H);
    container.on('pointerdown', () => {
      // 点击反馈
      TweenManager.cancelTarget(container.scale);
      container.scale.set(0.9);
      TweenManager.to({
        target: container.scale,
        props: { x: 1, y: 1 },
        duration: 0.2,
        ease: Ease.easeOutBack,
      });
      EventBus.emit(entry.event);
    });

    return { container, redDot, entry };
  }

  private _relayout(): void {
    let x = 0;
    for (const [, card] of this._cards) {
      if (!card.container.visible) continue;
      card.container.position.set(x, (BANNER_HEIGHT - CARD_H) / 2);
      x += card.container.width + CARD_GAP;
    }
  }
}
