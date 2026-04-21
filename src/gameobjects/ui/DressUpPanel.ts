/**
 * 换装面板 — 复用装修面板的金边抽屉壳与资源（merge_chain_panel / ribbon / 关闭钮 / 卡片底）
 *
 * 2 列形象卡：花愿解锁 / 条件解锁 / 切换穿戴
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { AudioManager } from '@/core/AudioManager';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DressUpManager, Outfit } from '@/managers/DressUpManager';
import { getOwnerChibiTextureKey, getOwnerFullOpenTextureKey } from '@/config/DressUpConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { SaveManager } from '@/managers/SaveManager';
import { TextureCache } from '@/utils/TextureCache';
import { checkRequirement, requirementHintText } from '@/utils/UnlockChecker';
import { ToastMessage } from './ToastMessage';
import { addMysteryCardPlaceholder, createSmallNameLockIcon } from '@/gameobjects/ui/mysteryCardPlaceholder';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

const PANEL_W = DESIGN_WIDTH - 40;
const PANEL_MARGIN_LEFT = 36;
const PANEL_H_RATIO = 0.74;
const PANEL_TOP_R = 20;

const RIBBON_MAX_W = Math.min(PANEL_W - 8, Math.round(PANEL_W * 0.98));
const RIBBON_MAX_H = 124;
const RIBBON_Y = 34;
const CLOSE_BTN_INSET_RIGHT = 56;
const PROGRESS_BELOW_RIBBON = 8;
const PROGRESS_TO_DIVIDER = 14;
const DIVIDER_TO_CONTENT = 6;
const HEADER_DIVIDER_WIDTH_RATIO = 0.56;
const CONTENT_BOTTOM = 10;
const GRID_MARGIN_H = 22;

const GRID_COLS = 2;
const CARD_GAP = 10;
const CARD_BASE_W = 140;
const CARD_BASE_H = 160;
const CARD_MAX_W = 200;
const CARD_R = 10;

const GOLD_LINE = 0xe8c078;
const GOLD_INNER = 0xd4a84b;
const CREAM_FILL = 0xfff9ec;
const SHADOW_COLOR = 0x8b7355;

function measureDressGrid(gridW: number): { cw: number; ch: number; startX: number } {
  const cwRaw = Math.floor((gridW - CARD_GAP * (GRID_COLS + 1)) / GRID_COLS);
  const cw = Math.max(110, Math.min(CARD_MAX_W, cwRaw));
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

export class DressUpPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _gridViewport!: PIXI.Container;
  private _gridContainer!: PIXI.Container;
  private _gridMask!: PIXI.Graphics;
  private _titleText!: PIXI.Text;
  private _progressText!: PIXI.Text;
  private _closeBtn: PIXI.Sprite | PIXI.Text | null = null;
  private _titleCenterY = 58;
  private _contentTopY = 168;
  private _scrollY = 0;
  private _maxScrollY = 0;
  private _isOpen = false;
  /** 记录面板高度，logicHeight 变化时拉伸底图与遮罩 */
  private _panelHBuilt = 0;
  /** 飞星动画结束后再入账的星星数（与 DressUpManager.unlock defer 配对） */
  private _pendingDressUpStarGrant = 0;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
    EventBus.on('panel:openDressUp', () => this.open());
    EventBus.on('decoration:shopStarFlyComplete', () => this._onDressUpStarFlyComplete());
  }

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
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._resizePanelIfNeeded();
    this._refreshHeaderNumbers();
    this._rebuildGrid();

    const h = Game.logicHeight;
    const panelH = Math.round(h * PANEL_H_RATIO);
    const panelY = h - panelH;
    const panelX = this._content.position.x;

    TweenManager.cancelTarget(this._content.position);
    this._content.position.set(panelX, h);
    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.18, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.position, props: { y: panelY }, duration: 0.28, ease: Ease.easeOutQuad });
  }

  close(): void {
    if (!this._isOpen) return;
    this._grantPendingDressUpStarIfAny();
    this._isOpen = false;
    const h = Game.logicHeight;
    TweenManager.cancelTarget(this._content.position);
    TweenManager.to({ target: this._content.position, props: { y: h }, duration: 0.22, ease: Ease.easeInQuad });
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.2, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  private _layoutCloseButton(): void {
    if (!this._closeBtn) return;
    this._closeBtn.position.set(PANEL_W - CLOSE_BTN_INSET_RIGHT, this._titleCenterY);
  }

  private _refreshHeaderNumbers(): void {
    this._progressText.text = `已解锁 ${DressUpManager.unlockedCount}/${DressUpManager.totalCount}`;
  }

  private _applyScroll(): void {
    const inner = this._gridContainer.children[0];
    if (inner) inner.y = this._scrollY;
  }

  private _rebuildGrid(): void {
    this._syncDressGridClip();
    this._gridContainer.removeChildren();
    const h = Game.logicHeight;
    const panelH = Math.round(h * PANEL_H_RATIO);
    const availH = panelH - this._contentTopY - CONTENT_BOTTOM;
    const gridW = PANEL_W - GRID_MARGIN_H * 2;

    const outfits = DressUpManager.getAllOutfits();
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
      bg.lineStyle(2, GOLD_LINE, unlocked ? 0.85 : 0.45);
    }
    bg.beginFill(unlocked ? CREAM_FILL : 0xf0ecea, unlocked ? 0.98 : 0.75);
    bg.drawRoundedRect(0, 0, cw, ch, CARD_R);
    bg.endFill();

    if (unlocked) {
      bg.lineStyle(1, GOLD_INNER, equipped ? 0.35 : 0.45);
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
    mode: 'equipped' | 'ready' | 'purchase' | 'locked',
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

      if (mode === 'purchase' && purchaseHualuCost !== undefined) {
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
      if (mode === 'purchase' && purchaseHualuCost !== undefined) {
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

    this._drawCardBg(card, cw, ch, isUnlocked || reqMet, isEquipped);

    const nameY = Math.round((ch * 88) / CARD_BASE_H);
    const portraitTop = 10;
    const portraitBottom = nameY - 6;
    const maxPortraitH = Math.max(40, portraitBottom - portraitTop);
    const maxPortraitW = cw - 16;
    const portraitCy = portraitTop + maxPortraitH / 2;

    const showPortrait = isUnlocked || reqMet;
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
        const s = Math.min(maxPortraitW / previewTex.width, maxPortraitH / previewTex.height);
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
    } else if (!reqResult.met) {
      this._addDressFooter(card, cw, ch, 'locked', reqResult.text);
    } else if (outfit.huayuanCost > 0) {
      this._addDressFooter(card, cw, ch, 'purchase', '', outfit.huayuanCost);
    } else {
      this._addDressFooter(card, cw, ch, 'ready', '领取');
    }

    card.eventMode = 'static';
    card.hitArea = new PIXI.Rectangle(0, 0, cw, ch);
    if (!isEquipped) {
      card.cursor = (isUnlocked || (reqResult.met && CurrencyManager.state.huayuan >= outfit.huayuanCost)) ? 'pointer' : 'default';
      card.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (isUnlocked) {
          if (DressUpManager.equip(outfit.id)) {
            ToastMessage.show(`已切换为「${outfit.name}」`);
            this._refreshHeaderNumbers();
            this._rebuildGrid();
          }
        } else {
          const req = checkRequirement(outfit.unlockRequirement);
          if (!req.met) {
            ToastMessage.show(`${requirementHintText(req)}`);
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
      card.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    }

    return card;
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    const panelH = Math.round(h * PANEL_H_RATIO);
    const panelX = PANEL_MARGIN_LEFT;
    const panelY = h - panelH;

    this._content = new PIXI.Container();
    this._content.sortableChildren = true;
    this._content.position.set(panelX, panelY);
    this.addChild(this._content);

    const panelTex = TextureCache.get('merge_chain_panel');
    if (panelTex?.width) {
      const panelBg = new PIXI.Sprite(panelTex);
      panelBg.width = PANEL_W;
      panelBg.height = panelH;
      panelBg.eventMode = 'static';
      this._content.addChild(panelBg);
    } else {
      const g = new PIXI.Graphics();
      g.lineStyle(3, 0xd97b00);
      g.beginFill(0xfff9e6);
      g.drawRoundedRect(0, 0, PANEL_W, panelH, PANEL_TOP_R);
      g.endFill();
      g.lineStyle(2, 0xffd700);
      g.drawRoundedRect(3, 3, PANEL_W - 6, panelH - 6, PANEL_TOP_R - 2);
      g.eventMode = 'static';
      this._content.addChild(g);
    }

    const ribbonTex = TextureCache.get('merge_chain_ribbon');
    let titleCenterY = 58;
    let ribbonBottom = titleCenterY + 36;
    if (ribbonTex?.width) {
      const rib = new PIXI.Sprite(ribbonTex);
      const s = Math.min(RIBBON_MAX_W / ribbonTex.width, RIBBON_MAX_H / ribbonTex.height);
      rib.scale.set(s);
      rib.anchor.set(0.5, 0);
      rib.position.set(PANEL_W / 2, RIBBON_Y);
      rib.eventMode = 'static';
      rib.zIndex = 5;
      this._content.addChild(rib);
      titleCenterY = RIBBON_Y + (ribbonTex.height * s) * 0.45;
      ribbonBottom = RIBBON_Y + ribbonTex.height * s;
    }
    this._titleCenterY = titleCenterY;

    this._titleText = new PIXI.Text('形象换装', {
      fontSize: 30,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x7a4530,
      strokeThickness: 5,
      dropShadow: true,
      dropShadowColor: 0x5a2d10,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    } as any);
    this._titleText.anchor.set(0.5, 0.5);
    this._titleText.position.set(PANEL_W / 2, titleCenterY);
    this._titleText.zIndex = 6;
    this._content.addChild(this._titleText);

    const progressY = Math.round(ribbonBottom + PROGRESS_BELOW_RIBBON);

    this._progressText = new PIXI.Text('', {
      fontSize: 20,
      fill: 0xfff5e8,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xb86b4a,
      strokeThickness: 3,
      dropShadow: true,
      dropShadowColor: 0x4a3020,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    } as any);
    this._progressText.anchor.set(0.5, 0.5);
    this._progressText.position.set(PANEL_W / 2, progressY);
    this._progressText.zIndex = 6;
    this._content.addChild(this._progressText);

    const dividerY = Math.round(progressY + PROGRESS_TO_DIVIDER);
    const divHalfW = Math.round((PANEL_W * HEADER_DIVIDER_WIDTH_RATIO) / 2);
    const headerDivider = new PIXI.Graphics();
    headerDivider.zIndex = 5;
    headerDivider.lineStyle(2, GOLD_LINE, 0.75);
    headerDivider.moveTo(Math.round(PANEL_W / 2) - divHalfW, dividerY);
    headerDivider.lineTo(Math.round(PANEL_W / 2) + divHalfW, dividerY);
    this._content.addChild(headerDivider);

    this._contentTopY = Math.round(dividerY + DIVIDER_TO_CONTENT);

    const gridW = PANEL_W - GRID_MARGIN_H * 2;
    const gridH = panelH - this._contentTopY - CONTENT_BOTTOM;

    this._gridViewport = new PIXI.Container();
    this._gridViewport.position.set(GRID_MARGIN_H, this._contentTopY);
    this._gridViewport.eventMode = 'static';
    this._gridViewport.hitArea = new PIXI.Rectangle(0, 0, gridW, gridH);
    this._content.addChild(this._gridViewport);

    this._gridMask = new PIXI.Graphics();
    this._gridMask.beginFill(0xffffff);
    this._gridMask.drawRect(0, 0, gridW, gridH);
    this._gridMask.endFill();
    this._gridMask.eventMode = 'none';
    this._gridViewport.addChild(this._gridMask);

    this._gridContainer = new PIXI.Container();
    this._gridViewport.addChild(this._gridContainer);
    this._gridContainer.mask = this._gridMask;

    this._gridContainer.eventMode = 'static';
    this._gridContainer.on('wheel', (e: any) => {
      this._scrollY = Math.max(-this._maxScrollY, Math.min(0, this._scrollY - (e.deltaY || 0)));
      this._applyScroll();
    });

    const closeTex = TextureCache.get('warehouse_close_btn');
    if (closeTex?.width) {
      const closeBtn = new PIXI.Sprite(closeTex);
      const cs = Math.min(54 / closeTex.width, 54 / closeTex.height);
      closeBtn.scale.set(cs);
      closeBtn.anchor.set(0.5, 0.5);
      closeBtn.eventMode = 'static';
      closeBtn.cursor = 'pointer';
      closeBtn.zIndex = 2000;
      closeBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => { e.stopPropagation(); this.close(); });
      this._content.addChild(closeBtn);
      this._closeBtn = closeBtn;
    } else {
      const closeBtn = new PIXI.Text('×', {
        fontSize: 34, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        stroke: 0x7a4530, strokeThickness: 4,
      } as any);
      closeBtn.anchor.set(0.5, 0.5);
      closeBtn.eventMode = 'static';
      closeBtn.cursor = 'pointer';
      closeBtn.zIndex = 2000;
      closeBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => { e.stopPropagation(); this.close(); });
      this._content.addChild(closeBtn);
      this._closeBtn = closeBtn;
    }
    this._layoutCloseButton();

    this._panelHBuilt = panelH;
  }

  private _syncDressGridClip(): void {
    const panelH = Math.round(Game.logicHeight * PANEL_H_RATIO);
    const gridW = PANEL_W - GRID_MARGIN_H * 2;
    const gridH = panelH - this._contentTopY - CONTENT_BOTTOM;
    this._gridViewport.position.set(GRID_MARGIN_H, this._contentTopY);
    this._gridViewport.hitArea = new PIXI.Rectangle(0, 0, gridW, gridH);
    this._gridMask.clear();
    this._gridMask.beginFill(0xffffff);
    this._gridMask.drawRect(0, 0, gridW, gridH);
    this._gridMask.endFill();
  }

  private _resizePanelIfNeeded(): void {
    const h = Game.logicHeight;
    const panelH = Math.round(h * PANEL_H_RATIO);
    if (panelH === this._panelHBuilt) return;
    const bg = this._content.children[0];
    if (bg instanceof PIXI.Sprite) {
      bg.height = panelH;
    }
    this._syncDressGridClip();
    this._panelHBuilt = panelH;
  }
}
