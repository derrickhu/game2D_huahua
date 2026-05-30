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
import { captureLayersShareImageUrl } from '@/utils/shareSnapshot';
import { TweenManager, Ease } from '@/core/TweenManager';
import { AudioManager } from '@/core/AudioManager';
import { shareAppMessageWithAnalytics } from '@/utils/wechatShare';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { CARD_RARITY_COLOR, type CardRarity } from '@/config/AffinityCardConfig';
import { createAffinityCardShare } from '@/config/ShareConfig';
import type { AffinityCardDropResult } from '@/managers/AffinityCardManager';
import { RewardFlyCoordinator } from '@/core/RewardFlyCoordinator';
import { ToastMessage } from './ToastMessage';
import { TextureCache } from '@/utils/TextureCache';
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
  private _titleLayer!: PIXI.Container;
  private _hint!: PIXI.Text;
  private _shareBtn: PIXI.Container | null = null;
  private _unsubTextures: (() => void) | null = null;

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
    if (!this._isOpen) void this._showNextAsync();
  }

  private _textureKeysForDrop(item: DropQueueItem): string[] {
    const set = new Set<string>(['affinity_card_back_default']);
    for (const r of item.results) {
      if (!r?.card) continue;
      set.add(r.card.artKey ?? `customer_${r.card.ownerTypeId}`);
    }
    return [...set];
  }

  private async _ensureDropTextures(keys: readonly string[]): Promise<void> {
    try {
      await Promise.all([
        TextureCache.loadPanelsSubpackage(),
        TextureCache.loadCharsSubpackage(),
      ]);
      await TextureCache.preloadKeys(keys);
    } catch (e) {
      console.warn('[AffinityCardDropPopup] 友谊卡资源预热失败:', e);
    }
  }

  private _bindTextureRefresh(keys: readonly string[]): void {
    this._unsubTextures?.();
    this._unsubTextures = TextureCache.observeTextureDependencies(
      { keys: [...keys] },
      () => {
        if (!this._isOpen || this._flipping) return;
        if (!this._flipDone) this._renderCardBack();
        else this._renderCardFront();
      },
    );
  }

  private _clearTextureRefresh(): void {
    this._unsubTextures?.();
    this._unsubTextures = null;
  }

  private async _showNextAsync(): Promise<void> {
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

    const keys = this._textureKeysForDrop(next);
    await this._ensureDropTextures(keys);
    this._bindTextureRefresh(keys);

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
    const cardCenterY = H / 2 - 10;
    this._cardMount = new PIXI.Container();
    this._cardMount.position.set(W / 2, cardCenterY);
    this.addChild(this._cardMount);

    this._titleLayer = new PIXI.Container();
    this._buildTitleBanner(W, cardCenterY);
    this.addChild(this._titleLayer);

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

  /** 卡面上方蜜黄标题条 +「获得友谊卡」 */
  private _buildTitleBanner(screenW: number, cardCenterY: number): void {
    this._titleLayer.removeChildren();
    const cardTopY = cardCenterY - LARGE_CARD_H / 2;
    const ribbonTargetW = Math.min(420, screenW - 48);
    const ribTex = TextureCache.get('merge_chain_ribbon');
    let ribbonTop = cardTopY - 56;
    let ribbonH = 48;

    if (ribTex && ribTex.width > 0) {
      const rs = ribbonTargetW / ribTex.width;
      ribbonH = ribTex.height * rs;
      ribbonTop = cardTopY - ribbonH - 14;
      const rib = new PIXI.Sprite(ribTex);
      rib.scale.set(rs);
      rib.anchor.set(0.5, 0);
      rib.position.set(screenW / 2, ribbonTop);
      rib.eventMode = 'none';
      this._titleLayer.addChild(rib);
    } else {
      ribbonTop = cardTopY - ribbonH - 14;
      const g = new PIXI.Graphics();
      g.beginFill(0xffc75d, 0.98);
      g.lineStyle(2, 0xffffff, 0.7);
      g.drawRoundedRect((screenW - ribbonTargetW) / 2, ribbonTop, ribbonTargetW, ribbonH, 20);
      g.endFill();
      g.eventMode = 'none';
      this._titleLayer.addChild(g);
    }

    const title = new PIXI.Text('获得友谊卡', {
      fontSize: 26,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x5d4037,
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.35,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    } as PIXI.TextStyle);
    title.anchor.set(0.5, 0.5);
    title.position.set(screenW / 2, ribbonTop + ribbonH * 0.4);
    title.eventMode = 'none';
    this._titleLayer.addChild(title);
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
      if (this._queue.length > 0) void this._showNextAsync();
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

    const btnW = 208;
    const btnH = 52;
    const btn = new PIXI.Container();
    btn.position.set(DESIGN_WIDTH / 2, this._hint.y + 46);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.RoundedRectangle(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);

    const glow = new PIXI.Graphics();
    glow.beginFill(0xff8ac9, 0.42);
    glow.drawRoundedRect(-btnW / 2 - 6, -btnH / 2 - 6, btnW + 12, btnH + 12, (btnH + 12) / 2);
    glow.endFill();
    btn.addChild(glow);

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x5c2a4a, 0.32);
    shadow.drawRoundedRect(-btnW / 2, -btnH / 2 + 4, btnW, btnH, btnH / 2);
    shadow.endFill();
    btn.addChild(shadow);

    const bg = new PIXI.Graphics();
    bg.beginFill(0xff9ec8, 1);
    bg.lineStyle(3, 0xffffff, 0.92);
    bg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
    bg.endFill();
    const sheen = new PIXI.Graphics();
    sheen.beginFill(0xffffff, 0.38);
    sheen.drawRoundedRect(-btnW / 2 + 6, -btnH / 2 + 5, btnW - 12, btnH * 0.42, 12);
    sheen.endFill();
    bg.addChild(sheen);
    btn.addChild(bg);

    const label = new PIXI.Text('晒一下', {
      fontSize: 22,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x9c3d6b,
      strokeThickness: 3,
      dropShadow: true,
      dropShadowColor: 0xc75d8b,
      dropShadowAlpha: 0.55,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    } as PIXI.TextStyle);
    label.anchor.set(0.5);
    btn.addChild(label);

    btn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      void this._onShareTap(cur);
    });

    this._shareBtn = btn;
    this.addChild(btn);
  }

  private async _onShareTap(cur: AffinityCardDropResult): Promise<void> {
    const imageUrl = await this.createShareSnapshotImageUrl();
    shareAppMessageWithAnalytics(
      createAffinityCardShare(cur.card, imageUrl ?? undefined),
      'affinity_card',
      { card_id: String(cur.card.id ?? ''), has_snapshot: !!imageUrl },
    );
    ToastMessage.show(imageUrl ? `已分享「${cur.card.title}」` : `已分享「${cur.card.title}」（使用默认图）`);
  }

  /** 截取弹层内容（标题条 + 卡面），生成微信分享用临时图 */
  async createShareSnapshotImageUrl(): Promise<string | null> {
    return captureLayersShareImageUrl([this], {
      padding: 16,
      destWidth: 500,
      aspectRatio: 5 / 4,
      hide: [
        ...(this._shareBtn ? [this._shareBtn] : []),
        this._hint,
        this._overlay,
      ],
    });
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
    this._clearTextureRefresh();
    this._clearShareButton();
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.18,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.removeChildren();
        if (this._queue.length > 0) {
          void this._showNextAsync();
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
