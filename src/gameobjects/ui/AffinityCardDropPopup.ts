/**
 * 熟客友谊卡掉落弹窗
 *
 * 触发：AffinityCardManager 在 rollCardDrop / redeemPack / gmGrantCard 后
 *      EventBus.emit('affinityCard:dropped', typeId, results: AffinityCardDropResult[])
 *
 * 流程（每张卡）：
 *   背面 (placeholder) → 翻牌 (Y 轴 scaleX 0→1 反转) → 正面（含稀有度光环、闪光）
 *   重复卡：正面右下角额外角标 +N 友谊点
 *   单次 dropped 多张时：用「下一张」按钮逐张翻；末张点击关闭
 *
 * 视觉：透明黑遮罩 + 中央卡（W 280 × H 380），稀有度色光环；
 *      正面：标题 + story 文本 + 「稀有度 + 拥有数」次行
 *
 * 队列：连发多次 dropped 事件 → 排队播放，避免重叠
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { AudioManager } from '@/core/AudioManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';
import {
  CARD_RARITY_COLOR,
  CARD_RARITY_LABEL,
  type AffinityCardDef,
  type CardRarity,
} from '@/config/AffinityCardConfig';
import type { AffinityCardDropResult } from '@/managers/AffinityCardManager';

interface DropQueueItem {
  typeId: string;
  results: AffinityCardDropResult[];
}

const CARD_W = 280;
const CARD_H = 380;

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
    this._overlay.beginFill(0x000000, 0.7);
    this._overlay.drawRect(0, 0, W, H);
    this._overlay.endFill();
    this._overlay.eventMode = 'static';
    this._overlay.cursor = 'pointer';
    this._overlay.on('pointertap', () => this._onTap());
    this.addChild(this._overlay);

    this._cardMount = new PIXI.Container();
    this._cardMount.position.set(W / 2, H / 2 - 20);
    this.addChild(this._cardMount);

    this._hint = new PIXI.Text('点击翻牌', {
      fontSize: 18,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    this._hint.anchor.set(0.5);
    this._hint.position.set(W / 2, H / 2 + CARD_H / 2 + 28);
    this.addChild(this._hint);

    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.22, ease: Ease.easeOutQuad });
  }

  private _renderCardBack(): void {
    this._cardMount.removeChildren();
    this._flipping = false;
    this._flipDone = false;
    const cur = this._curResults[this._curIndex]!;
    const tint = CARD_RARITY_COLOR[cur.card.rarity];

    // 卡背：优先用美术资源 affinity_card_back_default；找不到时回落手画
    const backTex = TextureCache.get('affinity_card_back_default');
    if (backTex && backTex.width > 0) {
      const sp = new PIXI.Sprite(backTex);
      sp.anchor.set(0.5);
      const k = Math.max(CARD_W / backTex.width, CARD_H / backTex.height);
      sp.scale.set(k);
      // 矩形 mask 把 1:1 卡背裁成 280×380 卡片
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff);
      mask.drawRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
      mask.endFill();
      sp.mask = mask;
      this._cardMount.addChild(mask);
      this._cardMount.addChild(sp);
      // 稀有度色边
      const border = new PIXI.Graphics();
      border.lineStyle(4, tint, 1);
      border.drawRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
      this._cardMount.addChild(border);
    } else {
      const back = new PIXI.Graphics();
      back.beginFill(0x4a2f10, 1);
      back.lineStyle(4, tint, 1);
      back.drawRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
      back.endFill();
      back.lineStyle(2, tint, 0.45);
      back.drawRoundedRect(-CARD_W / 2 + 10, -CARD_H / 2 + 10, CARD_W - 20, CARD_H - 20, 12);
      const center = new PIXI.Graphics();
      center.beginFill(tint, 0.9);
      center.drawCircle(0, 0, 30);
      center.endFill();
      center.beginFill(0x4a2f10, 1);
      center.drawCircle(0, 0, 16);
      center.endFill();
      this._cardMount.addChild(back);
      this._cardMount.addChild(center);
    }

    this._hint.text = `点击翻牌（${this._curIndex + 1}/${this._curResults.length}）`;

    AudioManager.play('ui_click_subtle');
  }

  private _onTap(): void {
    if (this._flipping) return;
    if (!this._flipDone) {
      this._flip();
      return;
    }
    // 已翻过 → 下一张 / 关闭
    this._curIndex += 1;
    if (this._curIndex >= this._curResults.length) {
      // 当前批次已展完 → 看队列还有没有
      if (this._queue.length > 0) this._showNext();
      else this._dismiss();
      return;
    }
    this._renderCardBack();
  }

  /** Y 轴假翻牌：scaleX 1→0（同时缩边），切到正面，再 0→1 */
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
        this._renderCardFront();
        TweenManager.to({
          target: this._cardMount.scale,
          props: { x: 1 },
          duration: 0.22,
          ease: Ease.easeOutBack,
          onComplete: () => {
            this._flipping = false;
            this._flipDone = true;
            this._showHintForFront();
            this._burstShine();
            const cur = this._curResults[this._curIndex]!;
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
    const cur = this._curResults[this._curIndex]!;
    const def: AffinityCardDef = cur.card;
    const tint = CARD_RARITY_COLOR[def.rarity];

    // 稀有度光环（SR/SSR 才发光）
    if (def.rarity === 'SR' || def.rarity === 'SSR') {
      const halo = new PIXI.Graphics();
      const haloAlpha = def.rarity === 'SSR' ? 0.7 : 0.5;
      halo.beginFill(tint, haloAlpha);
      halo.drawRoundedRect(-CARD_W / 2 - 12, -CARD_H / 2 - 12, CARD_W + 24, CARD_H + 24, 22);
      halo.endFill();
      this._cardMount.addChild(halo);
    }

    // 卡面底
    const bg = new PIXI.Graphics();
    bg.beginFill(0xfff8e7, 1);
    bg.lineStyle(4, tint, 1);
    bg.drawRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
    bg.endFill();
    this._cardMount.addChild(bg);

    // 上半部分：客人立绘（用 customer_<typeId> 大头作为 fallback）
    const portraitMaskH = CARD_H * 0.55;
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRoundedRect(-CARD_W / 2 + 10, -CARD_H / 2 + 10, CARD_W - 20, portraitMaskH, 14);
    mask.endFill();
    this._cardMount.addChild(mask);

    const artKey = def.artKey ?? `customer_${def.ownerTypeId}`;
    const tex = TextureCache.get(artKey);
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const targetH = portraitMaskH * 1.15;
      const k = targetH / tex.height;
      sp.scale.set(k);
      sp.position.set(0, -CARD_H / 2 + 10 + portraitMaskH / 2);
      sp.mask = mask;
      this._cardMount.addChild(sp);
    }

    // 稀有度小角标（左上）
    const rarityChip = new PIXI.Container();
    const chipW = 64, chipH = 22;
    const chipBg = new PIXI.Graphics();
    chipBg.beginFill(tint, 0.95);
    chipBg.drawRoundedRect(0, 0, chipW, chipH, chipH / 2);
    chipBg.endFill();
    const chipTxt = new PIXI.Text(`${def.rarity} · ${CARD_RARITY_LABEL[def.rarity]}`, {
      fontSize: 12, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    } as PIXI.TextStyle);
    chipTxt.anchor.set(0.5);
    chipTxt.position.set(chipW / 2, chipH / 2);
    rarityChip.addChild(chipBg);
    rarityChip.addChild(chipTxt);
    rarityChip.position.set(-CARD_W / 2 + 14, -CARD_H / 2 + 14);
    this._cardMount.addChild(rarityChip);

    // 标题
    const title = new PIXI.Text(def.title, {
      fontSize: 22,
      fill: 0x4a2f10,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      align: 'center',
    } as PIXI.TextStyle);
    title.anchor.set(0.5, 0);
    title.position.set(0, -CARD_H / 2 + portraitMaskH + 16);
    this._cardMount.addChild(title);

    // 故事
    const story = new PIXI.Text(def.story, {
      fontSize: 13,
      fill: 0x6b4a1c,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: CARD_W - 36,
      align: 'center',
      lineHeight: 18,
    } as PIXI.TextStyle);
    story.anchor.set(0.5, 0);
    story.position.set(0, -CARD_H / 2 + portraitMaskH + 16 + title.height + 8);
    this._cardMount.addChild(story);

    // 重复卡角标 + 蝶变文案
    if (cur.isDuplicate) {
      const dupChip = new PIXI.Graphics();
      const dupW = 130, dupH = 28;
      dupChip.beginFill(0xfff3c4, 0.95);
      dupChip.lineStyle(2, 0xb8860b, 1);
      dupChip.drawRoundedRect(0, 0, dupW, dupH, dupH / 2);
      dupChip.endFill();
      const dupTxt = new PIXI.Text(`重复 → +${cur.shardGain} 友谊点`, {
        fontSize: 13, fill: 0x8a5a00, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      } as PIXI.TextStyle);
      dupTxt.anchor.set(0.5);
      dupTxt.position.set(dupW / 2, dupH / 2);
      dupChip.addChild(dupTxt);
      dupChip.position.set(-dupW / 2, CARD_H / 2 - dupH - 12);
      this._cardMount.addChild(dupChip);
    } else {
      const obtainChip = new PIXI.Graphics();
      const obW = 110, obH = 28;
      obtainChip.beginFill(tint, 0.92);
      obtainChip.drawRoundedRect(0, 0, obW, obH, obH / 2);
      obtainChip.endFill();
      const obTxt = new PIXI.Text(`收入图鉴 +${cur.bondPoints}`, {
        fontSize: 13, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      } as PIXI.TextStyle);
      obTxt.anchor.set(0.5);
      obTxt.position.set(obW / 2, obH / 2);
      obtainChip.addChild(obTxt);
      obtainChip.position.set(-obW / 2, CARD_H / 2 - obH - 12);
      this._cardMount.addChild(obtainChip);
    }
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
  }

  /** SR/SSR 翻牌后简单闪光：alpha 闪一下 */
  private _burstShine(): void {
    const cur = this._curResults[this._curIndex]!;
    if (cur.card.rarity !== 'SR' && cur.card.rarity !== 'SSR') return;
    const tint = CARD_RARITY_COLOR[cur.card.rarity];
    const flash = new PIXI.Graphics();
    flash.beginFill(tint, 0.6);
    flash.drawRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
    flash.endFill();
    flash.alpha = 0.9;
    this._cardMount.addChild(flash);
    TweenManager.to({
      target: flash,
      props: { alpha: 0 },
      duration: 0.45,
      ease: Ease.easeOutQuad,
      onComplete: () => flash.destroy(),
    });
  }

  private _dismiss(): void {
    this._isOpen = false;
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.16,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.removeChildren();
        if (this._queue.length > 0) {
          this._showNext();
        } else {
          this.visible = false;
        }
      },
    });
  }
}

/** 静态引用避免 unused（typeId 在事件 payload 里使用） */
const _RARITY_REF: CardRarity = 'N';
void _RARITY_REF;
