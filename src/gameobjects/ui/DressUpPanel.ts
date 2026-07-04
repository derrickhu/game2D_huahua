/**
 * 形象换装面板 — 单张壳体 + PIXI 叠标题/进度/3 列形象卡网格
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { AudioManager } from '@/core/AudioManager';
import { EventBus } from '@/core/EventBus';
import { OverlayManager } from '@/core/OverlayManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DressUpManager, Outfit } from '@/managers/DressUpManager';
import { getOwnerChibiTextureKey, getOwnerFullOpenTextureKey } from '@/config/DressUpConfig';
import { AdManager, AdScene } from '@/managers/AdManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { ConfirmDialog } from './ConfirmDialog';
import { createFreeAdBadge } from './AdBadge';
import { SaveManager } from '@/managers/SaveManager';
import { TextureCache } from '@/utils/TextureCache';
import { checkRequirement, requirementHintText } from '@/utils/UnlockChecker';
import { ToastMessage } from './ToastMessage';
import { addMysteryCardPlaceholder, createSmallNameLockIcon } from '@/gameobjects/ui/mysteryCardPlaceholder';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

/** 壳体锚点：相对壳图宽/高的比例或壳图 px，经 scale 映射到屏幕 */
const SHELL = {
  W: 680,
  H: 1218,
  TITLE_Y_FRAC: 0.088,
  CLOSE_CX_PX: 640,
  CLOSE_CY_PX: 44,
  CLOSE_HIT_R_PX: 46,
  PROGRESS_Y_FRAC: 0.134,
  INNER_PAD_X_FRAC: 0.048,
  CONTENT_TOP_FRAC: 0.158,
  CONTENT_BOTTOM_FRAC: 0.96,
};

const GRID_COLS = 3;
const CARD_GAP = 6;
const CARD_BASE_W = 140;
const CARD_BASE_H = 168;
const CARD_MAX_W = 256;
const CARD_MIN_W = 96;
/** 半身预览在卡内留白内再放大一点 */
const PORTRAIT_DISPLAY_BOOST = 1.28;
const CARD_R = 10;

const ROSE_LINE = 0xf0b8d0;
const ROSE_INNER = 0xe8a0c0;
const CREAM_FILL = 0xfff6f9;
const SHADOW_COLOR = 0xd898b0;
/** 标题 / 进度字：清爽淡粉，与壳体同系 */
const DRESSUP_TITLE_STROKE = 0xcc6890;
const DRESSUP_SUBTITLE_STROKE = 0xb05880;

function measureDressGrid(gridW: number): { cw: number; ch: number; startX: number } {
  const cwRaw = Math.floor((gridW - CARD_GAP * (GRID_COLS + 1)) / GRID_COLS);
  const cw = Math.max(CARD_MIN_W, Math.min(CARD_MAX_W, cwRaw));
  const ch = Math.round((cw * CARD_BASE_H) / CARD_BASE_W);
  const blockW = GRID_COLS * cw + (GRID_COLS - 1) * CARD_GAP;
  const startX = Math.floor((gridW - blockW) / 2);
  return { cw, ch, startX };
}

function dressGridListTopPad(availH: number, totalRows: number, ch: number): number {
  const baseH = CARD_GAP + totalRows * (ch + CARD_GAP);
  if (baseH >= availH) return 10;
  const spare = availH - baseH;
  return Math.min(10, Math.max(0, Math.floor(spare * 0.28)));
}

function nativeClientToDesignY(clientY: number): number {
  return (clientY * Game.designHeight) / Game.screenHeight;
}

function federatedPointerToDesignY(e: PIXI.FederatedPointerEvent): number {
  const native = e.nativeEvent as PointerEvent | MouseEvent | undefined;
  if (native != null && typeof (native as PointerEvent).clientY === 'number') {
    return nativeClientToDesignY((native as PointerEvent).clientY);
  }
  return e.global.y / Game.scale;
}

function isActivityLockedOutfit(outfit: Outfit): boolean {
  return Boolean(
    outfit.unlockRequirement?.questId && outfit.unlockRequirement.conditionText === '活动解锁',
  );
}

function outfitSortRank(outfit: Outfit & { unlocked: boolean; equipped: boolean }): number {
  if (outfit.unlocked) return 0;
  if (outfit.id === 'outfit_default') return 0;
  if (isActivityLockedOutfit(outfit)) return 1;
  if (DressUpManager.isAdUnlockOutfit(outfit.id)) return 1;
  return 2;
}

export class DressUpPanel extends PIXI.Container {
  private _overlay!: PIXI.Graphics;
  private _panel!: PIXI.Container;
  private _shellSprite!: PIXI.Sprite;
  private _gridViewport!: PIXI.Container;
  private _gridContainer!: PIXI.Container;
  private _gridMask!: PIXI.Graphics;
  private _titleText!: PIXI.Text;
  private _progressText!: PIXI.Text;
  private _closeHit!: PIXI.Container;
  private _layoutScale = 1;
  private _contentW = 0;
  private _contentH = 0;
  private _scrollY = 0;
  private _maxScrollY = 0;
  private _draggingGrid = false;
  private _dragStartDesignY = 0;
  private _dragStartScrollY = 0;
  private _dragMoved = false;
  private _ignoreNextCardTap = false;
  private _isOpen = false;
  private _opening = false;
  /** 飞星动画结束后再入账的星星数（与 DressUpManager.unlock defer 配对） */
  private _pendingDressUpStarGrant = 0;
  private _assetUnsub: (() => void) | null = null;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
    EventBus.on('panel:openDressUp', () => this.open());
    EventBus.on('decoration:shopStarFlyComplete', () => this._onDressUpStarFlyComplete());
  }

  private readonly _onCanvasGridMove = (ev: PointerEvent): void => {
    if (!this._isOpen || !this._draggingGrid) return;
    const dy = nativeClientToDesignY(ev.clientY) - this._dragStartDesignY;
    if (Math.abs(dy) > 4) this._dragMoved = true;
    this._setScrollY(this._dragStartScrollY + dy);
  };

  private readonly _onCanvasGridUp = (ev: PointerEvent): void => {
    this._finishGridScroll(ev);
  };

  private _grantPendingDressUpStarIfAny(): void {
    if (this._pendingDressUpStarGrant <= 0) return;
    const n = this._pendingDressUpStarGrant;
    this._pendingDressUpStarGrant = 0;
    CurrencyManager.addStar(n);
    SaveManager.save();
  }

  private _onDressUpStarFlyComplete(): void {
    this._grantPendingDressUpStarIfAny();
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    this._opening = true;
    void TextureCache.preloadPanelAssets('dressup').finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    OverlayManager.bringToFront();
    this._assetUnsub = TextureCache.onAssetGroupLoaded('dressup', () => {
      if (!this._isOpen) return;
      this._applyShellLayout();
      this._refreshHeaderNumbers();
      this._rebuildGrid();
    });
    this._applyShellLayout();
    this._refreshHeaderNumbers();
    this._rebuildGrid();

    this.alpha = 0;
    TweenManager.cancelTarget(this);
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.22, ease: Ease.easeOutQuad });
  }

  close(): void {
    this._opening = false;
    if (!this._isOpen) return;
    this._grantPendingDressUpStarIfAny();
    this._isOpen = false;
    this._assetUnsub?.();
    this._assetUnsub = null;
    this._unbindCanvasGridScroll();
    TweenManager.cancelTarget(this);
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.18, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  private _shellLayout() {
    const shellTex = TextureCache.get('dressup_panel_shell_nb2');
    const sw = shellTex?.width ?? SHELL.W;
    const sh = shellTex?.height ?? SHELL.H;
    const panelW = DESIGN_WIDTH - 24;
    const scale = panelW / sw;
    const dispH = sh * scale;
    const panelX = DESIGN_WIDTH / 2 - panelW / 2;
    const panelY = Math.max(36, (Game.logicHeight - dispH) / 2);
    const sx = (px: number) => px * scale;
    const sy = (py: number) => py * scale;
    const sxFrac = (frac: number) => sx(sw * frac);
    const syFrac = (frac: number) => sy(sh * frac);
    return { scale, panelX, panelY, panelW, dispH, sw, sh, sx, sy, sxFrac, syFrac, shellTex };
  }

  private _applyShellLayout(): void {
    const layout = this._shellLayout();
    this._layoutScale = layout.scale;
    this._panel.position.set(layout.panelX, layout.panelY);

    const shellTex = layout.shellTex;
    if (shellTex) {
      this._shellSprite.texture = shellTex;
      this._shellSprite.scale.set(layout.scale);
      this._shellSprite.visible = true;
    } else {
      this._shellSprite.visible = false;
    }

    this._titleText.position.set(layout.sxFrac(0.5), layout.syFrac(SHELL.TITLE_Y_FRAC));
    this._titleText.style.fontSize = Math.max(28, Math.round(38 * layout.scale));

    this._progressText.position.set(layout.sxFrac(0.5), layout.syFrac(SHELL.PROGRESS_Y_FRAC));
    this._progressText.style.fontSize = Math.max(16, Math.round(20 * layout.scale));

    this._closeHit.position.set(
      layout.sx(SHELL.CLOSE_CX_PX),
      layout.sy(SHELL.CLOSE_CY_PX),
    );
    this._closeHit.hitArea = new PIXI.Circle(0, 0, layout.sx(SHELL.CLOSE_HIT_R_PX));

    const padX = layout.sxFrac(SHELL.INNER_PAD_X_FRAC);
    const contentTop = layout.syFrac(SHELL.CONTENT_TOP_FRAC);
    const contentBottom = layout.syFrac(SHELL.CONTENT_BOTTOM_FRAC);
    this._contentW = layout.panelW - padX * 2;
    this._contentH = Math.max(120, contentBottom - contentTop);

    this._gridViewport.position.set(padX, contentTop);
    this._gridViewport.hitArea = new PIXI.Rectangle(0, 0, this._contentW, this._contentH);
    this._gridMask.clear();
    this._gridMask.beginFill(0xffffff);
    this._gridMask.drawRect(padX, contentTop, this._contentW, this._contentH);
    this._gridMask.endFill();

    this._overlay.clear();
    this._overlay.beginFill(0x000000, 0.48);
    this._overlay.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    this._overlay.endFill();
  }

  private _refreshHeaderNumbers(): void {
    this._progressText.text = `已解锁 ${DressUpManager.unlockedCount}/${DressUpManager.totalCount}`;
  }

  private _applyScroll(): void {
    const inner = this._gridContainer.children[0];
    if (inner) inner.y = this._scrollY;
  }

  private _setScrollY(nextY: number): void {
    this._scrollY = Math.max(-this._maxScrollY, Math.min(0, nextY));
    this._applyScroll();
  }

  private _onGridPointerDown(e: PIXI.FederatedPointerEvent): void {
    if (this._maxScrollY <= 0) return;
    if (this._draggingGrid) return;
    this._draggingGrid = true;
    this._dragMoved = false;
    this._ignoreNextCardTap = false;
    this._dragStartDesignY = federatedPointerToDesignY(e);
    this._dragStartScrollY = this._scrollY;
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.addEventListener) {
      canvas.addEventListener('pointermove', this._onCanvasGridMove);
      canvas.addEventListener('pointerup', this._onCanvasGridUp);
      canvas.addEventListener('pointercancel', this._onCanvasGridUp);
    }
  }

  private _onGridPointerMove(e: PIXI.FederatedPointerEvent): void {
    if (!this._draggingGrid) return;
    const dy = federatedPointerToDesignY(e) - this._dragStartDesignY;
    if (Math.abs(dy) > 4) this._dragMoved = true;
    if (this._dragMoved) e.stopPropagation();
    this._setScrollY(this._dragStartScrollY + dy);
  }

  private _onGridPointerEnd(e?: PIXI.FederatedPointerEvent): void {
    this._finishGridScroll(e);
  }

  private _unbindCanvasGridScroll(): void {
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (!canvas?.removeEventListener) return;
    canvas.removeEventListener('pointermove', this._onCanvasGridMove);
    canvas.removeEventListener('pointerup', this._onCanvasGridUp);
    canvas.removeEventListener('pointercancel', this._onCanvasGridUp);
  }

  private _finishGridScroll(e?: PIXI.FederatedPointerEvent | PointerEvent): void {
    if (!this._draggingGrid) return;
    this._unbindCanvasGridScroll();
    if (this._dragMoved) {
      this._ignoreNextCardTap = true;
      window.setTimeout(() => { this._ignoreNextCardTap = false; }, 250);
      if (e != null && 'stopPropagation' in e) e.stopPropagation();
    }
    this._draggingGrid = false;
    this._dragMoved = false;
  }

  private _rebuildGrid(): void {
    this._gridContainer.removeChildren();
    const gridW = this._contentW;
    const availH = this._contentH;
    if (gridW <= 0 || availH <= 0) return;

    const outfits = DressUpManager.getAllOutfits()
      .map((outfit, index) => ({ outfit, index }))
      .sort((a, b) => {
        const ra = outfitSortRank(a.outfit);
        const rb = outfitSortRank(b.outfit);
        if (ra !== rb) return ra - rb;
        const la = a.outfit.unlockRequirement?.level ?? 0;
        const lb = b.outfit.unlockRequirement?.level ?? 0;
        if (la !== lb) return la - lb;
        return a.index - b.index;
      })
      .map(entry => entry.outfit);
    const { cw, ch, startX } = measureDressGrid(gridW);
    const cols = GRID_COLS;
    const totalRows = Math.ceil(outfits.length / cols);
    const listTopPad = dressGridListTopPad(availH, totalRows, ch);

    const inner = new PIXI.Container();
    this._gridContainer.addChild(inner);

    outfits.forEach((outfit, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cw + CARD_GAP);
      const y = listTopPad + CARD_GAP + row * (ch + CARD_GAP);
      inner.addChild(this._buildOutfitCard(outfit, x, y, cw, ch));
    });

    const contentH = listTopPad + CARD_GAP + totalRows * (ch + CARD_GAP);
    const plate = new PIXI.Container();
    plate.eventMode = 'static';
    plate.hitArea = new PIXI.Rectangle(0, 0, gridW, contentH);
    inner.addChildAt(plate, 0);

    this._maxScrollY = Math.max(0, contentH - availH);
    this._scrollY = 0;
  }

  private _drawCardBg(card: PIXI.Container, cw: number, ch: number, unlocked: boolean, equipped: boolean): void {
    const shadow = new PIXI.Graphics();
    shadow.beginFill(SHADOW_COLOR, 0.15);
    shadow.drawRoundedRect(2, 3, cw, ch, CARD_R);
    shadow.endFill();
    card.addChild(shadow);

    const bg = new PIXI.Graphics();
    if (equipped) {
      bg.lineStyle(2.5, COLORS.BUTTON_PRIMARY, 0.95);
    } else {
      bg.lineStyle(2, ROSE_LINE, unlocked ? 0.85 : 0.45);
    }
    bg.beginFill(unlocked ? CREAM_FILL : 0xf5ece8, unlocked ? 0.98 : 0.75);
    bg.drawRoundedRect(0, 0, cw, ch, CARD_R);
    bg.endFill();

    if (unlocked) {
      bg.lineStyle(1, ROSE_INNER, equipped ? 0.35 : 0.45);
      bg.drawRoundedRect(3, 3, cw - 6, ch - 6, Math.max(6, CARD_R - 2));
    }
    card.addChild(bg);
  }

  private _addEquipBadge(card: PIXI.Container, cw: number): void {
    const g = new PIXI.Graphics();
    g.beginFill(COLORS.BUTTON_PRIMARY);
    g.drawCircle(cw - 14, 14, 11);
    g.endFill();
    card.addChild(g);
    const t = new PIXI.Text('√', { fontSize: 13, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold' });
    t.anchor.set(0.5, 0.5);
    t.position.set(cw - 14, 14);
    card.addChild(t);
  }

  /** 购买后获得的星分角标（与 DecorationPanel 一致） */
  private _addStarValueBadge(card: PIXI.Container, cw: number, starValue: number): void {
    if (starValue <= 0) return;
    const tagPad = 4;
    const iconH = Math.min(19, Math.max(14, Math.round(cw * 0.11)));
    const gap = 4;
    const fontSize = Math.round(Math.min(13, Math.max(11, cw * 0.085)));

    const wrap = new PIXI.Container();
    wrap.position.set(tagPad, tagPad);

    const content = new PIXI.Container();
    let iconW = iconH;
    const starTex = TextureCache.get('icon_star');
    if (starTex?.width) {
      const sp = new PIXI.Sprite(starTex);
      sp.height = iconH;
      sp.width = (starTex.width / starTex.height) * iconH;
      sp.position.set(0, 0);
      content.addChild(sp);
      iconW = sp.width;
    } else {
      const fb = new PIXI.Text('★', { fontSize: Math.round(iconH * 0.9), fontFamily: FONT_FAMILY });
      content.addChild(fb);
      iconW = fb.width;
    }

    const num = new PIXI.Text(String(starValue), {
      fontSize,
      fill: 0x8d4a1a,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 2,
    } as any);
    num.anchor.set(0, 0.5);
    num.position.set(iconW + gap, iconH / 2);
    content.addChild(num);

    const pillPadX = 6;
    const pillPadY = 3;
    const pillW = pillPadX * 2 + iconW + gap + num.width;
    const pillH = pillPadY * 2 + iconH;

    const pill = new PIXI.Graphics();
    pill.beginFill(0xfff3e0, 0.95);
    pill.lineStyle(1.2, 0xffb74d, 0.88);
    pill.drawRoundedRect(0, 0, pillW, pillH, 9);
    pill.endFill();
    wrap.addChild(pill);
    content.position.set(pillPadX, pillPadY);
    wrap.addChild(content);

    card.addChild(wrap);
  }

  private _addDressFooter(
    card: PIXI.Container, cw: number, ch: number,
    mode: 'equipped' | 'ready' | 'purchase' | 'locked' | 'ad_unlock',
    line: string,
    purchaseHualuCost?: number,
  ): void {
    const bottomPad = 10;
    const maxBtnW = cw - 12;
    const targetH = Math.min(44, Math.round((34 * ch) / CARD_BASE_H));
    const labelFont = 16;
    const labelStyle = {
      fontSize: labelFont,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold' as const,
      stroke: 0x333333,
      strokeThickness: 2,
    };

    const key = mode === 'equipped' ? 'deco_card_btn_1' : mode === 'locked' ? 'deco_card_btn_2' : 'deco_card_btn_3';
    const tex = TextureCache.get(key);
    const pillCenterY = (btnHScaled: number) => ch - bottomPad - btnHScaled / 2;

    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      const s = Math.min(maxBtnW / tex.width, targetH / tex.height);
      sp.scale.set(s);
      sp.anchor.set(0.5, 1);
      sp.position.set(cw / 2, ch - bottomPad);
      card.addChild(sp);
      const scaledH = tex.height * s;
      const cy = pillCenterY(scaledH);

      if (mode === 'ad_unlock') {
        const badge = createFreeAdBadge(14, 0xffffff, 0x333333, line || '看广告解锁', Math.round(scaledH * 0.58));
        badge.position.set(cw / 2, cy);
        card.addChild(badge);
      } else if (mode === 'purchase' && purchaseHualuCost !== undefined) {
        const iconTex = TextureCache.get('icon_huayuan');
        const gap = 5;
        const iconH = Math.max(16, Math.min(28, Math.round(scaledH * 0.62)));
        let iconW = 0;
        const row = new PIXI.Container();
        row.position.set(cw / 2, cy);
        if (iconTex?.width) {
          const iconSp = new PIXI.Sprite(iconTex);
          iconSp.anchor.set(0.5, 0.5);
          iconSp.height = iconH;
          iconSp.width = (iconTex.width / iconTex.height) * iconH;
          iconW = iconSp.width;
          row.addChild(iconSp);
        }
        const price = new PIXI.Text(String(purchaseHualuCost), labelStyle as any);
        price.anchor.set(0.5, 0.5);
        row.addChild(price);
        const rowW = iconW > 0 ? iconW + gap + price.width : price.width;
        let xLeft = -rowW / 2;
        if (iconW > 0) {
          (row.children[0] as PIXI.Sprite).position.set(xLeft + iconW / 2, 0);
          xLeft += iconW + gap;
        }
        price.position.set(xLeft + price.width / 2, 0);
        card.addChild(row);
      } else {
        const lockStyle = mode === 'locked' ? { ...labelStyle, fontSize: 13 } : labelStyle;
        const label = new PIXI.Text(line, lockStyle as any);
        label.anchor.set(0.5, 0.5);
        label.position.set(cw / 2, cy);
        card.addChild(label);
      }
    } else {
      const btnW = Math.min(maxBtnW, 100);
      const btnH = targetH;
      const btnY = ch - bottomPad - btnH;
      const color = mode === 'equipped' ? 0xbb88dd : mode === 'locked' ? 0xf0a030 : mode === 'ready' ? COLORS.BUTTON_PRIMARY : 0x4caf50;
      const g = new PIXI.Graphics();
      g.beginFill(color);
      g.drawRoundedRect(cw / 2 - btnW / 2, btnY, btnW, btnH, btnH / 2);
      g.endFill();
      card.addChild(g);
      const cy = btnY + btnH / 2;
      if (mode === 'ad_unlock') {
        const badge = createFreeAdBadge(13, 0xffffff, 0x333333, line || '看广告解锁', Math.round(btnH * 0.55));
        badge.position.set(cw / 2, cy);
        card.addChild(badge);
      } else if (mode === 'purchase' && purchaseHualuCost !== undefined) {
        const row = new PIXI.Container();
        row.position.set(cw / 2, cy);
        const gap = 5;
        const iconH = Math.max(16, Math.min(26, Math.round(btnH * 0.58)));
        const iconTex = TextureCache.get('icon_huayuan');
        let iconW = 0;
        if (iconTex?.width) {
          const iconSp = new PIXI.Sprite(iconTex);
          iconSp.anchor.set(0.5, 0.5);
          iconSp.height = iconH;
          iconSp.width = (iconTex.width / iconTex.height) * iconH;
          iconW = iconSp.width;
          row.addChild(iconSp);
        }
        const price = new PIXI.Text(String(purchaseHualuCost), labelStyle as any);
        price.anchor.set(0.5, 0.5);
        row.addChild(price);
        const rowW = iconW > 0 ? iconW + gap + price.width : price.width;
        let xLeft = -rowW / 2;
        if (iconW > 0 && row.children[0]) {
          (row.children[0] as PIXI.Sprite).position.set(xLeft + iconW / 2, 0);
          xLeft += iconW + gap;
        }
        price.position.set(xLeft + price.width / 2, 0);
        card.addChild(row);
      } else {
        const fs = mode === 'locked' ? 12 : 14;
        const t = new PIXI.Text(line, { fontSize: fs, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold' });
        t.anchor.set(0.5, 0.5);
        t.position.set(cw / 2, cy);
        card.addChild(t);
      }
    }
  }

  private async _unlockOutfitWithAd(outfit: Outfit): Promise<void> {
    const ok = await ConfirmDialog.show(
      '解锁购买资格',
      `观看广告解锁「${outfit.name}」购买资格，之后仍需 ${outfit.huayuanCost} 花愿购买。`,
      '看广告解锁',
      '取消',
    );
    if (!ok) return;

    const adScene = AdScene.SPECIAL_DECO_UNLOCK;
    AdManager.showRewardedAd(adScene, (success) => {
      if (!success) {
        ToastMessage.show('广告未看完，未解锁');
        return;
      }
      if (!DressUpManager.unlockAdPurchaseGate(outfit.id)) {
        ToastMessage.show('该形象已不可解锁');
        return;
      }
      ToastMessage.show(`已解锁「${outfit.name}」购买资格`);
      this._refreshHeaderNumbers();
      this._rebuildGrid();
    });
  }

  private _buildOutfitCard(
    outfit: Outfit & { unlocked: boolean; equipped: boolean },
    x: number, y: number, cw: number, ch: number,
  ): PIXI.Container {
    const card = new PIXI.Container();
    card.position.set(x, y);

    const isEquipped = outfit.equipped;
    const isUnlocked = outfit.unlocked;
    const reqResult = checkRequirement(outfit.unlockRequirement);
    const reqMet = reqResult.met;
    const isAdOutfit = DressUpManager.isAdUnlockOutfit(outfit.id);
    const adGateSatisfied = DressUpManager.isAdPurchaseGateSatisfied(outfit.id);
    const needsAdGate = isAdOutfit && reqMet && !isUnlocked && !adGateSatisfied;
    const purchaseAllowed = reqMet && (!isAdOutfit || adGateSatisfied);
    const cardUnlockedLook = isUnlocked || purchaseAllowed || needsAdGate;

    this._drawCardBg(card, cw, ch, cardUnlockedLook, isEquipped);

    const nameY = Math.round((ch * 93) / CARD_BASE_H);
    const portraitTop = 4;
    const portraitBottom = nameY - 2;
    const maxPortraitH = Math.max(44, portraitBottom - portraitTop);
    const maxPortraitW = cw - 6;
    const portraitCy = portraitTop + maxPortraitH / 2;

    const showPortrait = isUnlocked || reqMet || needsAdGate || isActivityLockedOutfit(outfit);
    if (!showPortrait) {
      const mysteryWrap = new PIXI.Container();
      mysteryWrap.position.set(cw / 2, portraitCy);
      addMysteryCardPlaceholder(mysteryWrap, cw, CARD_BASE_W, Math.min(maxPortraitW, maxPortraitH));
      card.addChild(mysteryWrap);
    } else {
      const chibiTex = TextureCache.get(getOwnerChibiTextureKey(outfit.id));
      const fullTex = TextureCache.get(getOwnerFullOpenTextureKey(outfit.id));
      const previewTex =
        chibiTex && chibiTex.width > 0 ? chibiTex
          : fullTex && fullTex.width > 0 ? fullTex
            : null;

      if (previewTex) {
        const sp = new PIXI.Sprite(previewTex);
        sp.anchor.set(0.5, 0.5);
        const s = Math.min(maxPortraitW / previewTex.width, maxPortraitH / previewTex.height) * PORTRAIT_DISPLAY_BOOST;
        sp.scale.set(s);
        sp.position.set(cw / 2, portraitCy);
        card.addChild(sp);
        this._addStarValueBadge(card, cw, outfit.starValue);
      } else {
        const iconCy = Math.round((ch * 54) / CARD_BASE_H);
        const mark = outfit.icon?.trim() ? outfit.icon : outfit.name.charAt(0) || '?';
        const icon = new PIXI.Text(mark, { fontSize: Math.round((44 * cw) / CARD_BASE_W), fontFamily: FONT_FAMILY });
        icon.anchor.set(0.5, 0.5);
        icon.position.set(cw / 2, iconCy);
        card.addChild(icon);
        this._addStarValueBadge(card, cw, outfit.starValue);
      }
    }

    if (!showPortrait && outfit.starValue > 0) {
      this._addStarValueBadge(card, cw, outfit.starValue);
    }

    if (isEquipped) this._addEquipBadge(card, cw);

    if (!showPortrait) {
      const nameGap = 12;
      const lockSlot = Math.max(26, Math.round((28 * cw) / CARD_BASE_W));
      const nameWrap = Math.max(36, cw - 12 - nameGap - lockSlot);
      const nameRow = new PIXI.Container();
      const name = new PIXI.Text(outfit.name, {
        fontSize: 15,
        fill: COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        align: 'left',
        wordWrap: true,
        wordWrapWidth: nameWrap,
      });
      name.anchor.set(0, 0);
      nameRow.addChild(name);
      const lockIcon = createSmallNameLockIcon(cw, CARD_BASE_W);
      lockIcon.position.set(name.width + nameGap, name.height * 0.5);
      nameRow.addChild(lockIcon);
      const nb = nameRow.getLocalBounds();
      nameRow.position.set(Math.round((cw - nb.width) / 2 - nb.x), nameY - nb.y - 2);
      card.addChild(nameRow);
    } else {
      const name = new PIXI.Text(outfit.name, {
        fontSize: 15,
        fill: isUnlocked || reqMet ? COLORS.TEXT_DARK : COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        align: 'center',
        wordWrap: true,
        wordWrapWidth: cw - 12,
      });
      name.anchor.set(0.5, 0);
      name.position.set(cw / 2, nameY);
      card.addChild(name);
    }

    if (isEquipped) {
      this._addDressFooter(card, cw, ch, 'equipped', '穿戴中');
    } else if (isUnlocked) {
      this._addDressFooter(card, cw, ch, 'ready', '换装');
    } else if (needsAdGate) {
      this._addDressFooter(card, cw, ch, 'ad_unlock', '看广告解锁');
    } else if (!reqResult.met) {
      this._addDressFooter(card, cw, ch, 'locked', reqResult.text);
    } else if (outfit.huayuanCost > 0) {
      this._addDressFooter(card, cw, ch, 'purchase', '', outfit.huayuanCost);
    } else {
      this._addDressFooter(card, cw, ch, 'ready', '领取');
    }

    const canTapPurchase =
      !isEquipped && purchaseAllowed && outfit.huayuanCost > 0
      && CurrencyManager.state.huayuan >= outfit.huayuanCost;

    card.eventMode = 'static';
    card.hitArea = new PIXI.Rectangle(0, 0, cw, ch);
    card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => this._onGridPointerDown(e));
    if (!isEquipped) {
      card.cursor = (isUnlocked || needsAdGate || canTapPurchase) ? 'pointer' : 'default';
      card.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (this._ignoreNextCardTap) {
          this._ignoreNextCardTap = false;
          return;
        }
        if (isUnlocked) {
          if (DressUpManager.equip(outfit.id)) {
            ToastMessage.show(`已切换为「${outfit.name}」`);
            this._refreshHeaderNumbers();
            this._rebuildGrid();
          }
        } else if (needsAdGate) {
          void this._unlockOutfitWithAd(outfit);
        } else {
          const req = checkRequirement(outfit.unlockRequirement);
          if (!req.met) {
            ToastMessage.show(`${requirementHintText(req)}`);
            return;
          }
          if (!DressUpManager.canPurchaseOutfit(outfit.id)) {
            ToastMessage.show('请先观看广告解锁购买资格');
            return;
          }
          if (CurrencyManager.state.huayuan < outfit.huayuanCost) {
            ToastMessage.show('花愿不足');
            return;
          }
          const deferStar = outfit.starValue > 0;
          const flyLp = new PIXI.Point(14, 14);
          const flyGlobal = deferStar ? card.toGlobal(flyLp) : null;
          if (DressUpManager.unlock(outfit.id, { deferStarGrant: deferStar })) {
            if (outfit.huayuanCost > 0) AudioManager.play('purchase_tap');
            ToastMessage.show(`已解锁「${outfit.name}」！`);
            if (deferStar && flyGlobal) {
              this._pendingDressUpStarGrant = outfit.starValue;
              EventBus.emit('decoration:shopStarFly', {
                globalX: flyGlobal.x,
                globalY: flyGlobal.y,
                amount: outfit.starValue,
              });
            }
            this._refreshHeaderNumbers();
            this._rebuildGrid();
          }
        }
      });
    } else {
      card.cursor = 'default';
      card.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (this._ignoreNextCardTap) this._ignoreNextCardTap = false;
      });
    }

    return card;
  }

  private _build(): void {
    this._overlay = new PIXI.Graphics();
    this._overlay.eventMode = 'static';
    this._overlay.on('pointerdown', () => this.close());
    this.addChild(this._overlay);

    this._panel = new PIXI.Container();
    this._panel.sortableChildren = true;
    this._panel.eventMode = 'static';
    this._panel.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._panel);

    this._shellSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this._panel.addChild(this._shellSprite);

    this._titleText = new PIXI.Text('形象换装', {
      fontSize: 38,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: '900',
      stroke: DRESSUP_TITLE_STROKE,
      strokeThickness: 5,
    } as PIXI.ITextStyle);
    this._titleText.anchor.set(0.5);
    this._titleText.zIndex = 20;
    this._panel.addChild(this._titleText);

    this._progressText = new PIXI.Text('', {
      fontSize: 20,
      fill: DRESSUP_TITLE_STROKE,
      fontFamily: FONT_FAMILY,
      fontWeight: '900',
      stroke: DRESSUP_SUBTITLE_STROKE,
      strokeThickness: 1,
    } as PIXI.ITextStyle);
    this._progressText.anchor.set(0.5);
    this._progressText.zIndex = 20;
    this._panel.addChild(this._progressText);

    this._closeHit = new PIXI.Container();
    this._closeHit.zIndex = 100;
    this._closeHit.eventMode = 'static';
    this._closeHit.cursor = 'pointer';
    const onCloseTap = (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    };
    this._closeHit.on('pointerdown', onCloseTap);
    this._closeHit.on('pointertap', onCloseTap);
    this._panel.addChild(this._closeHit);

    this._gridViewport = new PIXI.Container();
    this._gridViewport.zIndex = 10;
    this._gridViewport.eventMode = 'static';
    this._gridViewport.on('pointerdown', (e: PIXI.FederatedPointerEvent) => this._onGridPointerDown(e));
    this._gridViewport.on('pointermove', (e: PIXI.FederatedPointerEvent) => this._onGridPointerMove(e));
    this._gridViewport.on('globalpointermove', (e: PIXI.FederatedPointerEvent) => this._onGridPointerMove(e));
    this._gridViewport.on('pointerup', (e: PIXI.FederatedPointerEvent) => this._onGridPointerEnd(e));
    this._gridViewport.on('pointerupoutside', (e: PIXI.FederatedPointerEvent) => this._onGridPointerEnd(e));
    this._gridViewport.on('pointercancel', (e: PIXI.FederatedPointerEvent) => this._onGridPointerEnd(e));
    this._panel.addChild(this._gridViewport);

    this._gridMask = new PIXI.Graphics();
    this._gridMask.eventMode = 'none';
    this._panel.addChild(this._gridMask);
    this._gridViewport.mask = this._gridMask;

    this._gridContainer = new PIXI.Container();
    this._gridViewport.addChild(this._gridContainer);
    this._gridContainer.eventMode = 'static';
    this._gridContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => this._onGridPointerDown(e));
    this._gridContainer.on('wheel', (e: WheelEvent) => {
      this._setScrollY(this._scrollY - (e.deltaY || 0));
    });

    this._applyShellLayout();
  }
}
