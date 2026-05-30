/**
 * 清涟荷影新手礼包宣传页（花店底栏入口）
 * 壳体 + 空按钮在 AI 母图内；分区标题、奖励与按钮文案由 PIXI 叠字。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { OverlayManager } from '@/core/OverlayManager';
import { RewardFlyCoordinator, type RewardFlyItem } from '@/core/RewardFlyCoordinator';
import { TextureCache } from '@/utils/TextureCache';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { NewbieGiftPackManager } from '@/managers/NewbieGiftPackManager';
import { AdManager, AdScene, type AdFailReason } from '@/managers/AdManager';
import { AudioManager } from '@/core/AudioManager';
import {
  NEWBIE_GIFT_PACK_ADS_REQUIRED,
  NEWBIE_GIFT_PACK_BOARD_GRANTS,
  getNewbieGiftBoardPreviewItems,
  getNewbieGiftDecoPreviewItems,
  getNewbieGiftCtaRulePrefix,
  NEWBIE_GIFT_CTA_RULE_HIGHLIGHT,
  type NewbieGiftPreviewItem,
} from '@/config/NewbieGiftPackConfig';
import {
  NEWBIE_GIFT_PANEL_LAYOUT,
  cellWidthInNorm,
  gridCentersInNormRect,
} from '@/config/NewbieGiftPanelLayout';

const Z = 11200;
const L = NEWBIE_GIFT_PANEL_LAYOUT;

const TEXT_RES = Math.min(Math.max(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 2, 2), 3);

function makeCrispText(content: string, style: Partial<PIXI.ITextStyle>): PIXI.Text {
  const text = new PIXI.Text(content, style);
  text.roundPixels = true;
  text.resolution = TEXT_RES;
  return text;
}

const MAIN_TITLE_STYLE: Partial<PIXI.ITextStyle> = {
  fontSize: L.mainTitleFontSize,
  fill: 0xfff8e8,
  fontFamily: FONT_FAMILY,
  fontWeight: 'bold',
  letterSpacing: 1,
};

const RIBBON_TITLE_STYLE: Partial<PIXI.ITextStyle> = {
  fontSize: L.ribbonTitleFontSize,
  fill: 0xffffff,
  fontFamily: FONT_FAMILY,
  fontWeight: 'bold',
  letterSpacing: 1,
};

const SECTION_TITLE_STYLE: Partial<PIXI.ITextStyle> = {
  fontSize: L.sectionTitleFontSize,
  fill: 0x8b4513,
  fontFamily: FONT_FAMILY,
  fontWeight: 'bold',
  letterSpacing: 0.5,
};

const DECO_LABEL_STYLE: Partial<PIXI.ITextStyle> = {
  fontSize: L.decoLabelFontSize,
  fill: 0x5c3318,
  fontFamily: FONT_FAMILY,
  fontWeight: 'bold',
  align: 'center',
  lineHeight: L.decoLabelFontSize + 4,
};

const BOARD_LABEL_STYLE: Partial<PIXI.ITextStyle> = {
  ...DECO_LABEL_STYLE,
  fontSize: L.boardLabelFontSize,
  lineHeight: L.boardLabelFontSize + 4,
};

const CTA_RULE_BASE_STYLE: Partial<PIXI.ITextStyle> = {
  fontSize: L.ctaRuleFontSize,
  fill: 0x6b4423,
  fontFamily: FONT_FAMILY,
  fontWeight: 'bold',
  letterSpacing: 0.5,
};

const CTA_RULE_HIGHLIGHT_STYLE: Partial<PIXI.ITextStyle> = {
  fontSize: L.ctaRuleHighlightFontSize,
  fill: 0xd4880f,
  fontFamily: FONT_FAMILY,
  fontWeight: 'bold',
  letterSpacing: 0.5,
};

const BOARD_AMOUNT_STYLE: Partial<PIXI.ITextStyle> = {
  fontSize: L.boardAmountFontSize,
  fill: 0xe85d0a,
  fontFamily: FONT_FAMILY,
  fontWeight: 'bold',
};

export class NewbieGiftPackPanel extends PIXI.Container {
  private _isOpen = false;
  private _opening = false;
  private _adRequesting = false;
  private _claiming = false;
  private _assetUnsub: (() => void) | null = null;
  private _bg!: PIXI.Graphics;
  private _root!: PIXI.Container;
  private _art!: PIXI.Sprite;
  private _rewardMount!: PIXI.Container;
  private _headerMount!: PIXI.Container;
  private _ctaHit!: PIXI.Container;
  private _ctaLabel!: PIXI.Text;
  private _ctaRuleMount!: PIXI.Container;
  private _closeHit!: PIXI.Container;
  private _panelW = 0;
  private _panelH = 0;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = Z;
    this.sortableChildren = true;
    this._build();
    EventBus.on('newbieGiftPack:progress', () => {
      if (this._isOpen) this._syncCta();
    });
    EventBus.on('panel:openNewbieGiftPack', () => this.open());
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    if (!NewbieGiftPackManager.shouldShowEntry) return;
    NewbieGiftPackManager.markIntroPromptShown();
    this._opening = true;
    void TextureCache.preloadNewbieGiftPackPanel()
      .then(() => {
        this._openReady();
      })
      .catch(err => {
        console.warn('[NewbieGiftPackPanel] 礼包资源未就绪:', err);
        ToastMessage.show('礼包资源加载中，请稍后再试');
      })
      .finally(() => {
        this._opening = false;
      });
  }

  refreshIfOpen(): void {
    if (this._isOpen) this._syncCta();
  }

  close(): void {
    this._opening = false;
    this._adRequesting = false;
    this._claiming = false;
    this._assetUnsub?.();
    this._assetUnsub = null;
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.18,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this.alpha = 1;
        this._setContentVisible(false);
      },
    });
  }

  private _openReady(): void {
    if (this._isOpen || !NewbieGiftPackManager.shouldShowEntry) return;
    if (!TextureCache.get('newbie_gift_qinglian_promo_panel_nb2')) {
      ToastMessage.show('礼包资源加载中，请稍后再试');
      return;
    }

    this._isOpen = true;
    OverlayManager.bringToFront();
    this.visible = true;
    this._rebuildArt();
    this._rebuildRewards();
    this._syncCta();
    this._setContentVisible(this._panelW > 0);

    this._assetUnsub?.();
    this._assetUnsub = TextureCache.onAssetGroupLoaded('newbieGiftPack', () => {
      if (!this._isOpen) return;
      this._rebuildArt();
      this._rebuildRewards();
      this._syncCta();
      this._setContentVisible(this._panelW > 0);
    });

    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.22, ease: Ease.easeOutQuad });
  }

  private _setContentVisible(visible: boolean): void {
    this._headerMount.visible = visible;
    this._rewardMount.visible = visible;
    this._ctaHit.visible = visible;
    this._ctaRuleMount.visible = visible;
    this._closeHit.visible = visible;
    this._art.visible = visible && !!TextureCache.get('newbie_gift_qinglian_promo_panel_nb2');
  }

  private _build(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.55);
    this._bg.drawRect(0, 0, W, H);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    this._root = new PIXI.Container();
    this._root.eventMode = 'passive';
    this._root.position.set(W / 2, H / 2);
    this.addChild(this._root);

    this._art = new PIXI.Sprite();
    this._art.anchor.set(0.5);
    this._root.addChild(this._art);

    this._rewardMount = new PIXI.Container();
    this._rewardMount.visible = false;
    this._root.addChild(this._rewardMount);

    this._headerMount = new PIXI.Container();
    this._headerMount.visible = false;
    this._root.addChild(this._headerMount);

    this._closeHit = new PIXI.Container();
    this._closeHit.visible = false;
    this._closeHit.eventMode = 'static';
    this._closeHit.cursor = 'pointer';
    this._closeHit.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._root.addChild(this._closeHit);

    this._ctaHit = new PIXI.Container();
    this._ctaHit.visible = false;
    this._ctaHit.eventMode = 'static';
    this._ctaHit.cursor = 'pointer';
    this._ctaHit.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._onCtaTap();
    });
    this._root.addChild(this._ctaHit);

    this._ctaLabel = makeCrispText('', {
      fontSize: L.ctaLabelFontSize,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._ctaLabel.anchor.set(0.5);
    this._ctaHit.addChild(this._ctaLabel);

    this._ctaRuleMount = new PIXI.Container();
    this._ctaRuleMount.visible = false;
    this._ctaRuleMount.eventMode = 'none';
    this._root.addChild(this._ctaRuleMount);
  }

  private _panelSize(): { w: number; h: number; scale: number } {
    const tex = this._art.texture;
    if (!tex || tex === PIXI.Texture.EMPTY) {
      return { w: 0, h: 0, scale: 1 };
    }
    const maxW = DESIGN_WIDTH - L.maxWidthPad;
    const maxH = Game.logicHeight * L.maxHeightRatio;
    const scale = Math.min(maxW / tex.width, maxH / tex.height);
    return { w: tex.width * scale, h: tex.height * scale, scale };
  }

  private _normToLocal(nx: number, ny: number): { x: number; y: number } {
    return {
      x: -this._panelW / 2 + nx * this._panelW,
      y: -this._panelH / 2 + ny * this._panelH,
    };
  }

  private _rebuildArt(): void {
    const tex = TextureCache.get('newbie_gift_qinglian_promo_panel_nb2');
    if (!tex) {
      this._panelW = 0;
      this._panelH = 0;
      this._art.visible = false;
      return;
    }
    this._art.texture = tex;
    this._art.visible = true;
    const { w, h, scale } = this._panelSize();
    this._panelW = w;
    this._panelH = h;
    this._art.scale.set(scale);

    const close = this._normToLocal(L.closeNx, L.closeNy);
    this._closeHit.position.set(close.x, close.y);
    this._closeHit.hitArea = new PIXI.Circle(0, 0, L.closeR);

    const cta = this._normToLocal(L.ctaCenterNx, L.ctaCenterNy);
    const ctaW = w * L.ctaNw;
    const ctaH = h * L.ctaNh;
    this._ctaHit.position.set(cta.x, cta.y);
    this._ctaHit.hitArea = new PIXI.Rectangle(-ctaW / 2, -ctaH / 2, ctaW, ctaH);
    this._ctaLabel.position.set(0, ctaH * L.ctaLabelDyRatio);

    this._rebuildCtaRule();
    this._rebuildHeaderTexts();
  }

  private _rebuildHeaderTexts(): void {
    this._headerMount.removeChildren();
    if (this._panelW <= 0) return;

    this._drawHeaderBand(
      0.5,
      L.mainTitleNy,
      0.84,
      0.052,
      0xffd76e,
      '清涟荷影 · 新手礼',
      MAIN_TITLE_STYLE,
    );
    this._drawHeaderBand(
      0.5,
      L.ribbonTitleNy,
      0.78,
      0.042,
      0x58b5a6,
      '10件豪礼 免费领',
      RIBBON_TITLE_STYLE,
    );
  }

  private _drawHeaderBand(
    centerNx: number,
    centerNy: number,
    widthRatio: number,
    heightRatio: number,
    fillColor: number,
    label: string,
    style: Partial<PIXI.ITextStyle>,
  ): void {
    const pos = this._normToLocal(centerNx, centerNy);
    const bandW = this._panelW * widthRatio;
    const bandH = this._panelH * heightRatio;
    const band = new PIXI.Graphics();
    band.beginFill(fillColor, 1);
    band.drawRoundedRect(pos.x - bandW / 2, pos.y - bandH / 2, bandW, bandH, bandH * 0.42);
    band.endFill();
    this._headerMount.addChild(band);

    const text = makeCrispText(label, style);
    text.anchor.set(0.5);
    text.position.set(Math.round(pos.x), Math.round(pos.y));
    this._headerMount.addChild(text);
  }

  private _rebuildCtaRule(): void {
    this._ctaRuleMount.removeChildren();
    if (this._panelW <= 0) return;

    const prefix = makeCrispText(getNewbieGiftCtaRulePrefix(), CTA_RULE_BASE_STYLE);
    const highlight = makeCrispText(NEWBIE_GIFT_CTA_RULE_HIGHLIGHT, CTA_RULE_HIGHLIGHT_STYLE);
    prefix.anchor.set(0, 0.5);
    highlight.anchor.set(0, 0.5);
    highlight.position.set(prefix.width + 4, 0);

    const row = new PIXI.Container();
    row.addChild(prefix, highlight);
    row.position.set(-(prefix.width + 4 + highlight.width) / 2, 0);
    this._ctaRuleMount.addChild(row);

    const rule = this._normToLocal(0.5, L.ctaRuleNy);
    this._ctaRuleMount.position.set(rule.x, rule.y);
  }

  private _rebuildRewards(): void {
    this._rewardMount.removeChildren();
    if (this._panelW <= 0) return;

    this._drawSectionTitle('限定家具', L.decoTitleNy);

    const decoItems = getNewbieGiftDecoPreviewItems();
    const decoSlots = gridCentersInNormRect(
      L.contentLeftNx,
      L.contentRightNx,
      L.decoGridTopNy,
      L.decoGridBottomNy,
      L.decoCols,
      decoItems.length,
    );
    const decoCellW = cellWidthInNorm(this._panelW, L.contentLeftNx, L.contentRightNx, L.decoCols);
    const decoIconMax = decoCellW * L.decoIconFillRatio;
    decoItems.forEach((item, i) => {
      const pos = this._normToLocal(decoSlots[i].nx, decoSlots[i].ny);
      this._drawDecoCell(this._rewardMount, pos.x, pos.y, item, decoIconMax, decoCellW);
    });

    this._drawSectionTitle('高级物品', L.boardTitleNy);

    const boardItems = getNewbieGiftBoardPreviewItems();
    const boardSlots = gridCentersInNormRect(
      L.contentLeftNx,
      L.contentRightNx,
      L.boardGridTopNy,
      L.boardGridBottomNy,
      L.boardCols,
      boardItems.length,
    );
    const boardCellW = cellWidthInNorm(this._panelW, L.contentLeftNx, L.contentRightNx, L.boardCols);
    const boardIconMax = boardCellW * L.boardIconFillRatio;
    boardItems.forEach((item, i) => {
      const pos = this._normToLocal(boardSlots[i].nx, boardSlots[i].ny);
      this._drawBoardCell(this._rewardMount, pos.x, pos.y, item, boardIconMax, boardCellW);
    });
  }

  private _drawSectionTitle(text: string, titleNy: number): void {
    const pos = this._normToLocal(0.5, titleNy);
    const title = makeCrispText(text, SECTION_TITLE_STYLE);
    title.anchor.set(0.5, 0.5);
    title.position.set(Math.round(pos.x), Math.round(pos.y));
    this._rewardMount.addChild(title);
  }

  private _drawDecoCell(
    parent: PIXI.Container,
    cx: number,
    cy: number,
    item: NewbieGiftPreviewItem,
    iconMax: number,
    cellW: number,
  ): void {
    const root = new PIXI.Container();
    root.position.set(cx, cy);
    parent.addChild(root);

    const iconY = -iconMax * 0.14;
    this._drawIcon(root, item.textureKey, iconMax, iconY);

    const lbl = makeCrispText(item.label, {
      ...DECO_LABEL_STYLE,
      wordWrap: true,
      wordWrapWidth: cellW - 2,
    });
    lbl.anchor.set(0.5, 0);
    lbl.position.set(0, iconY + iconMax * 0.44);
    root.addChild(lbl);
  }

  private _drawBoardCell(
    parent: PIXI.Container,
    cx: number,
    cy: number,
    item: NewbieGiftPreviewItem,
    iconMax: number,
    cellW: number,
  ): void {
    const root = new PIXI.Container();
    root.position.set(cx, cy);
    parent.addChild(root);

    const iconY = -iconMax * 0.12;
    this._drawIcon(root, item.textureKey, iconMax, iconY);

    if (item.amount != null && item.amount > 1) {
      const amt = makeCrispText(`×${item.amount}`, BOARD_AMOUNT_STYLE);
      amt.anchor.set(1, 1);
      amt.position.set(iconMax * L.boardAmountOffsetXRatio, iconY + iconMax * 0.48);
      root.addChild(amt);
    }

    const lbl = makeCrispText(item.label, {
      ...BOARD_LABEL_STYLE,
      wordWrap: true,
      wordWrapWidth: cellW - 2,
    });
    lbl.anchor.set(0.5, 0);
    lbl.position.set(0, iconY + iconMax * 0.50);
    root.addChild(lbl);
  }

  private _drawIcon(parent: PIXI.Container, textureKey: string, iconMax: number, iconY: number): void {
    const tex = TextureCache.get(textureKey);
    if (!tex) return;
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    const sc = iconMax / Math.max(tex.width, tex.height);
    sp.scale.set(sc);
    sp.position.set(0, iconY);
    parent.addChild(sp);
  }

  private _syncCta(): void {
    const watched = NewbieGiftPackManager.adsWatched;
    const canClaim = NewbieGiftPackManager.canClaim;
    const canAd = NewbieGiftPackManager.canWatchAd;
    this._art.alpha = 1;
    this._ctaHit.alpha = 1;

    if (canClaim) {
      this._ctaLabel.text = '领取';
      this._ctaLabel.style.fill = 0xffffff;
      this._ctaHit.cursor = this._claiming ? 'default' : 'pointer';
      this._ctaHit.eventMode = this._claiming ? 'none' : 'static';
      return;
    }

    if (canAd) {
      this._ctaLabel.text = `看广告 ${watched}/${NEWBIE_GIFT_PACK_ADS_REQUIRED}`;
      this._ctaLabel.style.fill = 0xffffff;
      this._ctaHit.cursor = 'pointer';
      this._ctaHit.eventMode = 'static';
      return;
    }

    this._ctaLabel.text = '已全部领取';
    this._ctaLabel.style.fill = 0xffffff;
    this._ctaHit.cursor = 'default';
    this._ctaHit.eventMode = 'none';
  }

  private _onCtaTap(): void {
    if (NewbieGiftPackManager.canClaim) {
      this._onClaimTap();
      return;
    }
    if (this._adRequesting || !NewbieGiftPackManager.canWatchAd) return;
    this._adRequesting = true;
    AdManager.showRewardedAd(AdScene.NEWBIE_GIFT_PACK, (success, reason?: AdFailReason) => {
      this._adRequesting = false;
      if (!success) {
        ToastMessage.show(
          reason === 'skipped' ? '需要看完广告才能获得奖励' : '广告暂不可用，请稍后再试',
        );
        return;
      }
      NewbieGiftPackManager.onAdSuccess();
      this._syncCta();
    });
  }

  private _onClaimTap(): void {
    if (this._claiming || !NewbieGiftPackManager.canClaim) return;
    this._claiming = true;
    this._syncCta();

    const flyItems: RewardFlyItem[] = NEWBIE_GIFT_PACK_BOARD_GRANTS.map(g => ({
      type: 'rewardBox',
      textureKey: g.textureKey,
      amount: g.count,
      itemId: g.itemId,
      grantOnArrive: false,
    }));

    const startGlobal = this._ctaHit.toGlobal(new PIXI.Point(0, 0));
    const ok = NewbieGiftPackManager.claim();
    if (!ok) {
      this._claiming = false;
      this._syncCta();
      ToastMessage.show('领取失败，请稍后再试');
      return;
    }

    AudioManager.play('purchase_tap');

    const finish = (): void => {
      this._claiming = false;
      ToastMessage.show('清涟荷影新手礼已领取！');
      this.close();
    };

    if (flyItems.length > 0) {
      RewardFlyCoordinator.playBatch(flyItems, startGlobal, finish);
    } else {
      finish();
    }
  }
}
