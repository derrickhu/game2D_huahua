/**
 * 新手大礼包「清涟荷影」：教程完成后累计观看激励视频领取
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { AdManager, AdScene, type AdFailReason } from '@/managers/AdManager';
import { NewbieGiftPackManager } from '@/managers/NewbieGiftPackManager';
import {
  NEWBIE_GIFT_PACK_ADS_REQUIRED,
  getNewbieGiftPackPreviewItems,
} from '@/config/NewbieGiftPackConfig';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { createAdIcon } from '@/gameobjects/ui/AdBadge';
import { createFlowerEggModalFrame } from '@/gameobjects/ui/FlowerEggModalFrame';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';

const GRID_COLS = 4;
const ICON_SZ = 52;
const CELL = 76;
const GRID_GAP = 10;

export class NewbieGiftPackPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _progressFill!: PIXI.Graphics;
  private _progressLabel!: PIXI.Text;
  private _isOpen = false;
  private _adRequesting = false;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5200;
    this._build();
    EventBus.on('newbieGiftPack:progress', () => this.refreshIfOpen());
    EventBus.on('newbieGiftPack:claimed', () => this.close());
  }

  open(): void {
    if (this._isOpen || !NewbieGiftPackManager.shouldShowEntry) return;
    this._isOpen = true;
    this.visible = true;
    this.alpha = 1;
    void TextureCache.loadDecoSubpackage('deco').finally(() => {
      this._refresh();
      TweenManager.cancelTarget(this._content);
      this._content.alpha = 0;
      this._content.scale.set(0.88);
      TweenManager.to({
        target: this._content,
        props: { alpha: 1 },
        duration: 0.22,
        ease: Ease.easeOutQuad,
      });
      TweenManager.to({
        target: this._content.scale,
        props: { x: 1, y: 1 },
        duration: 0.28,
        ease: Ease.easeOutBack,
      });
    });
  }

  refreshIfOpen(): void {
    if (this._isOpen) this._refresh();
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._adRequesting = false;
    this.visible = false;
  }

  private _build(): void {
    const viewW = DESIGN_WIDTH;
    const viewH = Game.logicHeight;
    this._bg = new PIXI.Graphics();
    this._bg.eventMode = 'static';
    this._bg.cursor = 'pointer';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);
    this._content = new PIXI.Container();
    this._content.eventMode = 'passive';
    this.addChild(this._content);
  }

  private _refresh(): void {
    const viewW = DESIGN_WIDTH;
    const viewH = Game.logicHeight;
    this._bg.clear();
    this._bg.beginFill(0x000000, 0.55);
    this._bg.drawRect(0, 0, viewW, viewH);
    this._bg.endFill();
    this._content.removeChildren();

    const items = getNewbieGiftPackPreviewItems();
    const gridW = GRID_COLS * CELL + (GRID_COLS - 1) * GRID_GAP;
    const gridRows = Math.ceil(items.length / GRID_COLS);
    const gridH = gridRows * CELL + (gridRows - 1) * GRID_GAP;
    const progressH = 28;
    const btnH = 56;
    const contentH = gridH + 16 + progressH + 14 + btnH;

    const frame = createFlowerEggModalFrame({
      viewW,
      viewH,
      title: '清涟荷影 · 新手礼',
      titleFontSize: 20,
      contentWidth: gridW,
      contentHeight: contentH,
      onCloseTap: () => this.close(),
    });
    this._content.addChild(frame.root);
    const mount = frame.contentMount;

    for (let i = 0; i < items.length; i++) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const cx = col * (CELL + GRID_GAP) + CELL / 2;
      const cy = row * (CELL + GRID_GAP) + CELL / 2;
      this._drawPreviewCell(mount, cx, cy, items[i]);
    }
    const y0 = gridH + 16;
    const progressW = gridW;
    const watched = NewbieGiftPackManager.adsWatched;

    const progressBg = new PIXI.Graphics();
    progressBg.beginFill(0xe8e0d4, 1);
    progressBg.drawRoundedRect(0, y0, progressW, progressH, progressH / 2);
    progressBg.endFill();
    mount.addChild(progressBg);

    this._progressFill = new PIXI.Graphics();
    const ratio = Math.min(1, watched / NEWBIE_GIFT_PACK_ADS_REQUIRED);
    if (ratio > 0) {
      this._progressFill.beginFill(0x7ec8a0, 1);
      this._progressFill.drawRoundedRect(0, y0, Math.max(progressH, progressW * ratio), progressH, progressH / 2);
      this._progressFill.endFill();
    }
    mount.addChild(this._progressFill);

    this._progressLabel = new PIXI.Text(`观看广告 ${watched}/${NEWBIE_GIFT_PACK_ADS_REQUIRED}`, {
      fontSize: 15,
      fill: 0x4a3728,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._progressLabel.anchor.set(0.5, 0.5);
    this._progressLabel.position.set(progressW / 2, y0 + progressH / 2);
    mount.addChild(this._progressLabel);

    const btn = this._buildActionButton(progressW / 2, y0 + progressH + 14 + btnH / 2, progressW, btnH);
    mount.addChild(btn);
  }

  private _drawPreviewCell(
    parent: PIXI.Container,
    cx: number,
    cy: number,
    item: { textureKey: string; label: string; amount?: number },
  ): void {
    const root = new PIXI.Container();
    root.position.set(cx, cy);
    parent.addChild(root);

    const card = new PIXI.Graphics();
    card.beginFill(0xfff8ef, 0.96);
    card.drawRoundedRect(-CELL / 2 + 2, -CELL / 2 + 2, CELL - 4, CELL - 4, 12);
    card.endFill();
    card.lineStyle(1.5, 0xffc9dc, 0.7);
    card.drawRoundedRect(-CELL / 2 + 4, -CELL / 2 + 4, CELL - 8, CELL - 8, 10);
    root.addChild(card);

    const tex = TextureCache.get(item.textureKey);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const sc = ICON_SZ / Math.max(tex.width, tex.height);
      sp.scale.set(sc);
      sp.position.set(0, -6);
      root.addChild(sp);
    }

    if (item.amount != null && item.amount > 1) {
      const amt = new PIXI.Text(`×${item.amount}`, {
        fontSize: 13,
        fill: 0xe8751a,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      amt.anchor.set(1, 0);
      amt.position.set(CELL / 2 - 8, -CELL / 2 + 6);
      root.addChild(amt);
    }

    const lbl = new PIXI.Text(item.label, {
      fontSize: 11,
      fill: 0x6a5a4d,
      fontFamily: FONT_FAMILY,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: CELL - 6,
    });
    lbl.anchor.set(0.5, 0);
    lbl.position.set(0, ICON_SZ / 2 - 2);
    root.addChild(lbl);
  }

  private _buildActionButton(cx: number, cy: number, w: number, h: number): PIXI.Container {
    const root = new PIXI.Container();
    root.position.set(cx, cy);
    const canAd = NewbieGiftPackManager.canWatchAd;

    const bg = new PIXI.Graphics();
    bg.beginFill(canAd ? 0xf4845f : 0xb0a89e, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.endFill();
    root.addChild(bg);

    const labelRow = new PIXI.Container();
    if (canAd) {
      const adIcon = createAdIcon(22);
      adIcon.position.set(-78, 0);
      labelRow.addChild(adIcon);
    }
    const label = new PIXI.Text(canAd ? '观看广告领取进度' : '已全部领取', {
      fontSize: 18,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(canAd ? 10 : 0, 0);
    labelRow.addChild(label);
    root.addChild(labelRow);

    if (canAd) {
      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointertap', () => this._onWatchAd());
      root.addChild(hit);
    }
    return root;
  }

  private _onWatchAd(): void {
    if (this._adRequesting || !NewbieGiftPackManager.canWatchAd) return;
    this._adRequesting = true;
    AdManager.showRewardedAd(AdScene.NEWBIE_GIFT_PACK, (success, reason?: AdFailReason) => {
      this._adRequesting = false;
      if (!success) {
        ToastMessage.show(reason === 'skipped' ? '需要看完广告才能获得奖励' : '广告暂不可用，请稍后再试');
        return;
      }
      const claimed = NewbieGiftPackManager.onAdSuccess();
      this._refresh();
      if (claimed) {
        ToastMessage.show('清涟荷影新手礼已领取！');
        setTimeout(() => this.close(), 600);
      }
    });
  }
}
