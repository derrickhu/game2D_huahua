/**
 * 熟客友谊卡掉落弹窗
 *
 * 触发：AffinityCardManager 在 rollCardDrop / gmGrantCard / gmSimulateDrop 后
 *      EventBus.emit('affinityCard:dropped', typeId, results: AffinityCardDropResult[])
 *
 * 流程（每张卡）：
 *   背面 (LARGE_CARD) → 翻牌 (Y 轴 scaleX 1→0→1) → 正面（共享 buildLargeAffinityCardFront）
 *   重复卡：底部 chip 显示对应奖励（花愿/钻石/体力）
 *   单次 dropped 多张时：用「下一张」按钮逐张翻；末张点击关闭
 *
 * 视觉：
 *   - 半透明黑遮罩 + 中央大卡（380×560，约屏宽 51%）
 *   - art 区 360×360 完整方形展示原图（不再用横长方形 mask 裁角色身子）
 *   - SR/SSR 加重发光 + 翻牌闪光，给惊喜感
 *
 * 队列：连发多次 dropped 事件 → 排队播放，避免重叠
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { AudioManager } from '@/core/AudioManager';
import { Platform } from '@/core/PlatformService';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { CARD_RARITY_COLOR, type CardRarity } from '@/config/AffinityCardConfig';
import { createAffinityCardShare } from '@/config/ShareConfig';
import type { AffinityCardDropResult } from '@/managers/AffinityCardManager';
import { RewardFlyCoordinator } from '@/core/RewardFlyCoordinator';
import { ToastMessage } from './ToastMessage';
import {
  LARGE_CARD_W,
  LARGE_CARD_H,
  buildLargeAffinityCardBack,
  buildLargeAffinityCardFront,
  rewardToFlyItems,
} from './AffinityCardArt';

interface DropQueueItem {
  typeId: string;
  results: AffinityCardDropResult[];
}

export class AffinityCardDropPopup extends PIXI.Container {
  private _isOpen = false;
  private _queue: DropQueueItem[] = [];
  private _curIndex = 0;
  private _curResults: AffinityCardDropResult[] = [];
  private _curTypeId = '';
  private _flipping = false;
  private _flipDone = false;
  private _overlay!: PIXI.Graphics;
  private _cardMount!: PIXI.Container;
  private _hint!: PIXI.Text;
  private _shareBtn: PIXI.Container | null = null;

  constructor() {
    super();
    this.zIndex = 8300;
    this.visible = false;
    EventBus.on(
      'affinityCard:dropped',
      (typeId: string, results: AffinityCardDropResult[]) => this.enqueue({ typeId, results }),
    );
  }

  get isOpen(): boolean { return this._isOpen; }

  enqueue(item: DropQueueItem): void {
    if (!item.results || item.results.length === 0) return;
    this._queue.push(item);
    if (!this._isOpen) this._showNext();
  }

  private _showNext(): void {
    const next = this._queue.shift();
    if (!next) {
      this._dismiss();
      return;
    }
    this._isOpen = true;
    this.visible = true;
    this._curTypeId = next.typeId;
    this._curResults = next.results;
    this._curIndex = 0;
    this._build();
    this._renderCardBack();
  }

  private _build(): void {
    this.removeChildren();
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    this._overlay = new PIXI.Graphics();
    this._overlay.beginFill(0x000000, 0.72);
    this._overlay.drawRect(0, 0, W, H);
    this._overlay.endFill();
    this._overlay.eventMode = 'static';
    this._overlay.cursor = 'pointer';
    this._overlay.on('pointertap', () => this._onTap());
    this.addChild(this._overlay);

    // 卡挂载点：中心点对齐屏幕中心，由子节点偏移到 (-W/2, -H/2)
    this._cardMount = new PIXI.Container();
    this._cardMount.position.set(W / 2, H / 2 - 10);
    this.addChild(this._cardMount);

    this._hint = new PIXI.Text('点击翻牌', {
      fontSize: 18,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    this._hint.anchor.set(0.5);
    this._hint.position.set(W / 2, H / 2 + LARGE_CARD_H / 2 + 22);
    this.addChild(this._hint);

    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.22, ease: Ease.easeOutQuad });
  }

  private _mountCardCentered(view: PIXI.Container): void {
    view.position.set(-LARGE_CARD_W / 2, -LARGE_CARD_H / 2);
    this._cardMount.addChild(view);
  }

  private _renderCardBack(): void {
    this._cardMount.removeChildren();
    this._clearShareButton();
    this._cardMount.scale.set(1, 1);
    this._flipping = false;
    this._flipDone = false;
    const cur = this._curResults[this._curIndex];
    if (!cur) {
      this._dismiss();
      return;
    }
    const back = buildLargeAffinityCardBack(cur.card.rarity);
    this._mountCardCentered(back);

    this._hint.text = `点击翻牌（${this._curIndex + 1}/${this._curResults.length}）`;
    AudioManager.play('ui_click_subtle');
  }

  private _onTap(): void {
    if (this._flipping) return;
    const cur = this._curResults[this._curIndex];
    if (!cur) {
      this._dismiss();
      return;
    }
    if (!this._flipDone) {
      this._flip();
      return;
    }
    // 重复卡 → 先把图标从卡片飞向顶栏对应资源（奖励已在 AffinityCardManager 内到账，这里只播视觉）
    if (cur.isDuplicate && cur.duplicateReward) {
      this._playDuplicateRewardFly(cur.duplicateReward);
    }
    this._curIndex += 1;
    if (this._curIndex >= this._curResults.length) {
      if (this._queue.length > 0) this._showNext();
      else this._dismiss();
      return;
    }
    this._renderCardBack();
  }

  /** 重复卡图标飞入 TopBar：起点为卡片中心，终点交由 RewardFlyCoordinator 绑定 */
  private _playDuplicateRewardFly(reward: NonNullable<AffinityCardDropResult['duplicateReward']>): void {
    const items = rewardToFlyItems(reward);
    if (items.length === 0) return;
    const startGlobal = this._cardMount.toGlobal(new PIXI.Point(0, 0));
    RewardFlyCoordinator.playBatch(items, startGlobal);
  }

  /** Y 轴假翻牌：scaleX 1→0，切到正面，再 0→1 */
  private _flip(): void {
    this._flipping = true;
    this._hint.text = '';
    AudioManager.play('ui_card_flip');

    TweenManager.to({
      target: this._cardMount.scale,
      props: { x: 0 },
      duration: 0.2,
      ease: Ease.easeInQuad,
      onComplete: () => {
        const cur = this._curResults[this._curIndex];
        if (!cur) {
          this._flipping = false;
          this._dismiss();
          return;
        }
        this._renderCardFront();
        TweenManager.to({
          target: this._cardMount.scale,
          props: { x: 1 },
          duration: 0.24,
          ease: Ease.easeOutBack,
          onComplete: () => {
            this._flipping = false;
            this._flipDone = true;
            this._showHintForFront();
            this._burstShine();
            if (cur.card.rarity === 'SSR') AudioManager.play('ui_reward_fanfare');
            else if (cur.card.rarity === 'SR') AudioManager.play('ui_unlock_chime');
            else AudioManager.play('ui_pop');
          },
        });
      },
    });
  }

  private _renderCardFront(): void {
    this._cardMount.removeChildren();
    this._clearShareButton();
    const cur = this._curResults[this._curIndex];
    if (!cur) {
      this._dismiss();
      return;
    }
    const front = buildLargeAffinityCardFront(cur.card, {
      mode: 'reveal',
      isDuplicate: cur.isDuplicate,
      duplicateReward: cur.duplicateReward,
    });
    this._mountCardCentered(front);
  }

  private _showHintForFront(): void {
    const last = this._curIndex >= this._curResults.length - 1;
    const moreInQueue = this._queue.length > 0;
    if (!last) {
      this._hint.text = '点击查看下一张';
    } else if (moreInQueue) {
      this._hint.text = '点击继续';
    } else {
      this._hint.text = '点击关闭';
    }
    this._renderShareButtonIfNeeded();
  }

  private _renderShareButtonIfNeeded(): void {
    this._clearShareButton();
    const cur = this._curResults[this._curIndex];
    if (!cur) return;
    const shouldShow = !cur.isDuplicate || cur.card.rarity === 'SR' || cur.card.rarity === 'SSR';
    if (!shouldShow) return;

    const btn = new PIXI.Container();
    btn.position.set(DESIGN_WIDTH / 2, this._hint.y + 38);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.RoundedRectangle(-72, -18, 144, 36, 18);

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x3d244f, 0.28);
    shadow.drawRoundedRect(-70, -15, 140, 34, 17);
    shadow.endFill();
    shadow.position.set(0, 3);
    btn.addChild(shadow);

    const bg = new PIXI.Graphics();
    bg.beginFill(0xfff1a8, 0.98);
    bg.lineStyle(2, 0xffc75d, 1);
    bg.drawRoundedRect(-70, -17, 140, 34, 17);
    bg.endFill();
    btn.addChild(bg);

    const label = new PIXI.Text('晒一下', {
      fontSize: 16,
      fill: 0x7a3f00,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    label.anchor.set(0.5);
    btn.addChild(label);

    btn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      Platform.shareAppMessage(createAffinityCardShare(cur.card));
      ToastMessage.show(`已分享「${cur.card.title}」`);
    });

    this._shareBtn = btn;
    this.addChild(btn);
  }

  private _clearShareButton(): void {
    if (!this._shareBtn) return;
    if (this._shareBtn.parent) this._shareBtn.parent.removeChild(this._shareBtn);
    this._shareBtn.destroy({ children: true });
    this._shareBtn = null;
  }

  /** SR/SSR 翻牌后简单闪光：alpha 闪一下 */
  private _burstShine(): void {
    const cur = this._curResults[this._curIndex];
    if (!cur) return;
    if (cur.card.rarity !== 'SR' && cur.card.rarity !== 'SSR') return;
    const tint = CARD_RARITY_COLOR[cur.card.rarity];
    const flash = new PIXI.Graphics();
    flash.beginFill(tint, 0.7);
    flash.drawRoundedRect(-LARGE_CARD_W / 2, -LARGE_CARD_H / 2, LARGE_CARD_W, LARGE_CARD_H, 22);
    flash.endFill();
    flash.alpha = 0.95;
    this._cardMount.addChild(flash);
    TweenManager.to({
      target: flash,
      props: { alpha: 0 },
      duration: 0.5,
      ease: Ease.easeOutQuad,
      onComplete: () => flash.destroy(),
    });
  }

  private _dismiss(): void {
    this._isOpen = false;
    this._clearShareButton();
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.18,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.removeChildren();
        if (this._queue.length > 0) {
          this._showNext();
        } else {
          this.visible = false;
          EventBus.emit('affinityCard:dropPopupClosed');
        }
      },
    });
  }
}

/** 静态引用避免 unused（typeId 在事件 payload 里使用，CardRarity 仅出现在 import 类型签名上） */
const _RARITY_REF: CardRarity = 'N';
void _RARITY_REF;
