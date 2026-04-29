/**
 * 体力购买面板 - 顶栏「+」或体力不足时弹出
 *
 * 壳体：`flower_egg_reward_bg` + `item_info_title_ribbon`（`FlowerEggModalFrame`）。
 * **左右两列**：各列外包一层圆角框以免混淆；上为体力图标+角标，下左为钻石价、下右为广告免费恢复+次数。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import { ToastMessage } from './ToastMessage';
import { COLORS, DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { createFlowerEggModalFrame } from '@/gameobjects/ui/FlowerEggModalFrame';
import { TextureCache } from '@/utils/TextureCache';
import { AdManager, AdScene } from '@/managers/AdManager';
import { createFreeAdBadge } from '@/gameobjects/ui/AdBadge';

const COL_W = 200;
const COL_GAP = 36;
const TOP_ICON = 56;
/** 上区（体力展示）高度 */
const TOP_BLOCK_H = 88;
const TOP_TO_BTN = 16;
const BTN_H = 52;
const AD_QUOTA_GAP = 6;
const AD_QUOTA_H = 22;
const TITLE_FONT = 24;

/** 左右分栏独立圆角框（与面板 pastel 协调，不拦截点击） */
function addColumnSurroundBox(
  col: PIXI.Container,
  w: number,
  h: number,
  rim: number,
  face: number,
): void {
  const g = new PIXI.Graphics();
  g.eventMode = 'none';
  g.lineStyle(2, rim, 0.95);
  g.beginFill(face, 0.42);
  g.drawRoundedRect(0, 0, w, h, 14);
  g.endFill();
  g.lineStyle(1, rim, 0.35);
  g.drawRoundedRect(2.5, 2.5, w - 5, h - 5, 11);
  col.addChildAt(g, 0);
}

export class StaminaPanel extends PIXI.Container {
  private _content!: PIXI.Container;
  private _buyBtn!: PIXI.Container;
  private _adBtn!: PIXI.Container;
  private _leftHead!: PIXI.Container;
  private _rightHead!: PIXI.Container;
  private _adQuotaText!: PIXI.Text;
  private _isOpen = false;

  constructor() {
    super();
    this.visible = false;
    this._build();
  }

  get isOpen(): boolean { return this._isOpen; }

  open(_neededStamina?: number): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._refresh();

    this.alpha = 0;
    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;

    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.15,
      ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  updateTimer(): void {
    if (!this._isOpen) return;
  }

  /** 体力闪电 + 右下角数字（体力条同源 `icon_energy`） */
  private _buildStaminaHeaderBlock(): PIXI.Container {
    const wrap = new PIXI.Container();
    const energyTex = TextureCache.get('icon_energy');
    if (energyTex) {
      const sp = new PIXI.Sprite(energyTex);
      sp.anchor.set(0.5);
      sp.width = TOP_ICON;
      sp.height = Math.round(TOP_ICON * (energyTex.height / Math.max(1, energyTex.width)));
      sp.position.set(0, 0);
      wrap.addChild(sp);
    } else {
      const fb = new PIXI.Text('体', { fontSize: 32, fontFamily: FONT_FAMILY, fill: COLORS.TEXT_DARK });
      fb.anchor.set(0.5);
      wrap.addChild(fb);
    }

    const amt = new PIXI.Text('0', {
      fontSize: 24,
      fill: 0x4e342e,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfffde7,
      strokeThickness: 4,
    });
    amt.anchor.set(1, 1);
    // 略压出图标右下，大字仍对齐闪电底部
    amt.position.set(TOP_ICON * 0.52 + 6, TOP_ICON * 0.52 + 4);
    amt.name = 'staminaAmt';
    wrap.addChild(amt);

    return wrap;
  }

  /** 左列下：紫钮，仅钻石图标 + 本次需付钻数 */
  private _buildDiamondCostButton(w: number, h: number): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'static';
    c.cursor = 'pointer';

    const bg = new PIXI.Graphics();
    bg.beginFill(0xAB47BC);
    bg.drawRoundedRect(0, 0, w, h, 14);
    bg.endFill();
    c.addChild(bg);

    const gemSize = 30;
    const gemTex = TextureCache.get('icon_gem');
    if (gemTex) {
      const sp = new PIXI.Sprite(gemTex);
      sp.anchor.set(0.5);
      sp.width = gemSize;
      sp.height = gemSize;
      sp.position.set(w / 2 - 22, h / 2);
      c.addChild(sp);
    } else {
      const fb = new PIXI.Text('钻', { fontSize: 18, fontFamily: FONT_FAMILY, fill: 0xffffff });
      fb.anchor.set(0.5);
      fb.position.set(w / 2 - 22, h / 2);
      c.addChild(fb);
    }

    const price = new PIXI.Text('0', {
      fontSize: 22,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    price.anchor.set(0.5);
    price.position.set(w / 2 + 26, h / 2);
    price.name = 'diamondPrice';
    c.addChild(price);

    return c;
  }

  /** 右列下：绿钮，免费 + 广告图标 */
  private _buildAdTextOnlyButton(w: number, h: number): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'static';
    c.cursor = 'pointer';

    const bg = new PIXI.Graphics();
    bg.beginFill(0x43A047);
    bg.drawRoundedRect(0, 0, w, h, 14);
    bg.endFill();
    c.addChild(bg);

    const badge = createFreeAdBadge(18, 0xffffff, 0x2e7d32);
    badge.position.set(w / 2, h / 2);
    c.addChild(badge);

    return c;
  }

  private _build(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.45);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    overlay.on('pointerdown', () => this.close());
    this.addChild(overlay);

    const rowW = COL_W * 2 + COL_GAP;
    const btnTop = TOP_BLOCK_H + TOP_TO_BTN;
    const btnW = COL_W;
    const contentH = btnTop + BTN_H + AD_QUOTA_GAP + AD_QUOTA_H;
    const colBoxH = contentH;

    const frame = createFlowerEggModalFrame({
      viewW: W,
      viewH: H,
      title: '体力购买',
      titleFontSize: TITLE_FONT,
      contentWidth: rowW,
      contentHeight: contentH,
      onCloseTap: () => this.close(),
    });
    this._content = frame.root;
    this.addChild(this._content);
    const mount = frame.contentMount;

    // ── 左列：独立圆角框 + 上 100 体力图标区，下 钻石花费 ──
    const leftCol = new PIXI.Container();
    leftCol.position.set(0, 0);
    mount.addChild(leftCol);
    addColumnSurroundBox(leftCol, COL_W, colBoxH, 0xCE93A8, 0xfff5f8);

    this._leftHead = this._buildStaminaHeaderBlock();
    this._leftHead.position.set(COL_W / 2, TOP_BLOCK_H / 2);
    leftCol.addChild(this._leftHead);

    this._buyBtn = this._buildDiamondCostButton(btnW, BTN_H);
    this._buyBtn.position.set(0, btnTop);
    this._buyBtn.on('pointerdown', () => this._onBuyStamina());
    leftCol.addChild(this._buyBtn);

    // ── 右列：独立圆角框 + 上区广告单次体力，下广告免费恢复 + 次数 ──
    const rightCol = new PIXI.Container();
    rightCol.position.set(COL_W + COL_GAP, 0);
    mount.addChild(rightCol);
    addColumnSurroundBox(rightCol, COL_W, colBoxH, 0x66BB6A, 0xe8f5e9);

    this._rightHead = this._buildStaminaHeaderBlock();
    this._rightHead.position.set(COL_W / 2, TOP_BLOCK_H / 2);
    rightCol.addChild(this._rightHead);

    this._adBtn = this._buildAdTextOnlyButton(btnW, BTN_H);
    this._adBtn.position.set(0, btnTop);
    this._adBtn.on('pointerdown', () => this._onAdStamina());
    rightCol.addChild(this._adBtn);

    this._adQuotaText = new PIXI.Text('', {
      fontSize: 14,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._adQuotaText.anchor.set(0.5, 0);
    this._adQuotaText.position.set(COL_W / 2, btnTop + BTN_H + AD_QUOTA_GAP);
    this._adQuotaText.eventMode = 'none';
    rightCol.addChild(this._adQuotaText);
  }

  private _refresh(): void {
    const s = CurrencyManager.state;

    (this._leftHead.getChildByName('staminaAmt') as PIXI.Text).text = String(
      CurrencyManager.staminaBuyAmount,
    );
    (this._rightHead.getChildByName('staminaAmt') as PIXI.Text).text = String(
      CurrencyManager.staminaAdAmount,
    );

    const buyRemain = CurrencyManager.staminaBuyRemaining;
    const buyPrice = CurrencyManager.staminaBuyPrice;
    const priceTxt = this._buyBtn.getChildByName('diamondPrice') as PIXI.Text;
    if (buyRemain > 0) {
      priceTxt.text = String(buyPrice);
      this._buyBtn.alpha = s.diamond >= buyPrice ? 1 : 0.5;
    } else {
      priceTxt.text = '—';
      this._buyBtn.alpha = 0.4;
    }

    const adRemain = CurrencyManager.staminaAdRemaining;
    const adMax = CurrencyManager.staminaAdMaxDaily;
    this._adQuotaText.text = `${adRemain}/${adMax}`;
    this._adBtn.alpha = adRemain > 0 ? 1 : 0.4;
    this._adQuotaText.alpha = 1;
  }

  private _onBuyStamina(): void {
    if (CurrencyManager.staminaBuyRemaining <= 0) {
      ToastMessage.show('今日购买次数已用完');
      return;
    }
    if (CurrencyManager.state.diamond < CurrencyManager.staminaBuyPrice) {
      ToastMessage.show('钻石不足');
      return;
    }

    const ok = CurrencyManager.buyStaminaWithDiamond();
    if (ok) {
      ToastMessage.show(`+${CurrencyManager.staminaBuyAmount} 体力已恢复`);
      this._refresh();
    }
  }

  private _onAdStamina(): void {
    if (CurrencyManager.staminaAdRemaining <= 0) {
      ToastMessage.show('今日广告恢复次数已用完');
      return;
    }

    AdManager.showRewardedAd(AdScene.STAMINA_RECOVER, (success) => {
      if (!success) {
        ToastMessage.show('广告未看完，无法获得奖励');
        return;
      }
      const ok = CurrencyManager.recoverStaminaByAd();
      if (ok) {
        ToastMessage.show(`+${CurrencyManager.staminaAdAmount} 体力已恢复`);
        this._refresh();
      }
    });
  }

  /** 体力飞入顶栏起点（全局）：左列体力图标中心（钻石购买） */
  getStaminaFlyStartGlobalDiamond(): PIXI.Point {
    return this._leftHead.toGlobal(new PIXI.Point(0, 0));
  }

  /** 体力飞入顶栏起点（全局）：右列体力图标中心（广告恢复） */
  getStaminaFlyStartGlobalAd(): PIXI.Point {
    return this._rightHead.toGlobal(new PIXI.Point(0, 0));
  }
}
