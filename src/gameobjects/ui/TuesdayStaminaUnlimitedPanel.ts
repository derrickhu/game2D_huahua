/**
 * 周二「体力无限」活动页：壳体上半宣传 + 下半三档看广告领体力。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { OverlayManager } from '@/core/OverlayManager';
import { TextureCache } from '@/utils/TextureCache';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import {
  TuesdayStaminaUnlimitedManager,
  TUESDAY_STAMINA_PACKS,
  type TuesdayStaminaPackId,
} from '@/managers/TuesdayStaminaUnlimitedManager';
import { AdManager, AdScene } from '@/managers/AdManager';
import { AudioManager } from '@/core/AudioManager';

const Z = 11210;

/** 壳图右上红 X 关闭钮中心（相对贴图像素归一化，按当前 v4 壳实测） */
const CLOSE_NX = 0.92;
const CLOSE_NY = 0.124;
const CLOSE_R = 36;

/** 下半空白区相对壳体的归一化矩形（按壳图实测可微调） */
const CONTENT_NX = 0.15;
const CONTENT_NY = 0.63;
const CONTENT_NW = 0.7;
const CONTENT_NH = 0.245;

const ROW_H = 78;
const ROW_GAP = 8;

export class TuesdayStaminaUnlimitedPanel extends PIXI.Container {
  private _isOpen = false;
  private _opening = false;
  private _bg!: PIXI.Graphics;
  private _root!: PIXI.Container;
  private _art!: PIXI.Sprite;
  private _closeHit!: PIXI.Container;
  private _content!: PIXI.Container;
  private _rowHits: PIXI.Container[] = [];

  constructor() {
    super();
    this.visible = false;
    this.zIndex = Z;
    this.sortableChildren = true;
    this._build();
    EventBus.on('panel:openTuesdayStaminaUnlimited', () => this.open());
    EventBus.on('tuesdayStaminaUnlimited:changed', () => {
      if (this._isOpen) this._rebuildRows();
    });
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    if (!TuesdayStaminaUnlimitedManager.isAvailableToday()) {
      ToastMessage.show('体力无限仅每周二开启');
      return;
    }
    this._opening = true;
    void TextureCache.preloadPanelAssets('tuesdayStaminaUnlimited').finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    TuesdayStaminaUnlimitedManager.markPromoShown();
    OverlayManager.bringToFront();
    this.visible = true;
    this._rebuildArt();
    this._rebuildRows();
    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.22, ease: Ease.easeOutQuad });
  }

  close(): void {
    this._opening = false;
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
      },
    });
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
    this._root.sortableChildren = true;
    this._root.position.set(W / 2, H / 2);
    this.addChild(this._root);

    this._art = new PIXI.Sprite();
    this._art.anchor.set(0.5);
    this._art.eventMode = 'none';
    this._art.zIndex = 1;
    this._root.addChild(this._art);

    this._content = new PIXI.Container();
    this._content.zIndex = 2;
    this._root.addChild(this._content);

    this._closeHit = new PIXI.Container();
    this._closeHit.zIndex = 100;
    this._closeHit.eventMode = 'static';
    this._closeHit.cursor = 'pointer';
    const onClose = (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    };
    this._closeHit.on('pointerdown', onClose);
    this._closeHit.on('pointertap', onClose);
    this._root.addChild(this._closeHit);
  }

  private _rebuildArt(): void {
    const tex = TextureCache.get('tuesday_stamina_unlimited_panel_shell_nb2');
    if (!tex) {
      this._art.visible = false;
      return;
    }
    this._art.texture = tex;
    this._art.visible = true;
    const maxW = DESIGN_WIDTH - 36;
    const maxH = Game.logicHeight * 0.88;
    const scale = Math.min(maxW / tex.width, maxH / tex.height, 1);
    this._art.scale.set(scale);
    const w = tex.width * scale;
    const h = tex.height * scale;

    // 热区对齐壳图右上红 X（归一化坐标 × 当前显示尺寸）
    this._closeHit.position.set(-w / 2 + w * CLOSE_NX, -h / 2 + h * CLOSE_NY);
    this._closeHit.hitArea = new PIXI.Circle(0, 0, CLOSE_R);

    this._content.position.set(-w / 2 + w * CONTENT_NX, -h / 2 + h * CONTENT_NY + 7);
  }

  private _rebuildRows(): void {
    this._content.removeChildren();
    this._rowHits = [];

    const tex = TextureCache.get('tuesday_stamina_unlimited_panel_shell_nb2');
    if (!tex) return;
    const scale = this._art.scale.x;
    const panelW = tex.width * scale;
    const panelH = tex.height * scale;
    const areaW = panelW * CONTENT_NW - 18;
    const areaH = panelH * CONTENT_NH;

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRoundedRect(0, 0, areaW, areaH, 16);
    mask.endFill();
    this._content.addChild(mask);
    this._content.mask = mask;

    const startY = 6;
    TUESDAY_STAMINA_PACKS.forEach((pack, i) => {
      const row = this._makeRow(pack.id, areaW);
      row.position.set(0, startY + i * (ROW_H + ROW_GAP));
      this._content.addChild(row);
      this._rowHits.push(row);
    });
  }

  private _makeRow(id: TuesdayStaminaPackId, areaW: number): PIXI.Container {
    const def = TUESDAY_STAMINA_PACKS.find(p => p.id === id)!;
    const progress = TuesdayStaminaUnlimitedManager.getPackProgress(id);
    const label = TuesdayStaminaUnlimitedManager.buttonLabel(id);
    const claimed = progress.claimed;
    const canClaim = TuesdayStaminaUnlimitedManager.canClaim(id);

    const row = new PIXI.Container();
    row.eventMode = 'static';

    const bg = new PIXI.Graphics();
    bg.beginFill(0xfff8ef, 0.98);
    bg.lineStyle(2, 0xd4b896, 0.85);
    bg.drawRoundedRect(0, 0, areaW, ROW_H, 18);
    bg.endFill();
    row.addChild(bg);

    const title = new PIXI.Text(def.label, {
      fontSize: 24,
      fill: 0x5d4037,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    title.position.set(18, 10);
    row.addChild(title);

    const sub = new PIXI.Text(`看广告 ${def.adsRequired} 次领取`, {
      fontSize: 16,
      fill: 0x8d6e63,
      fontFamily: FONT_FAMILY,
    } as PIXI.TextStyle);
    sub.position.set(18, 42);
    row.addChild(sub);

    const btnW = 88;
    const btnH = 36;
    const btnX = areaW - btnW - 12;
    const rewardX = Math.max(areaW * 0.61, btnX - 120);
    const rewardY = ROW_H / 2;

    const boltTex = TextureCache.get('icon_energy');
    if (boltTex) {
      const bolt = new PIXI.Sprite(boltTex);
      bolt.anchor.set(0.5);
      bolt.width = 46;
      bolt.height = 46;
      bolt.position.set(rewardX, rewardY);
      row.addChild(bolt);
    }

    const amount = new PIXI.Text(`x${def.stamina}`, {
      fontSize: 20,
      fill: 0x2e7d32,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    amount.anchor.set(0, 0.5);
    amount.position.set(rewardX + 25, rewardY + 9);
    row.addChild(amount);

    const btn = new PIXI.Graphics();
    let btnFill = 0x26a69a;
    if (claimed) btnFill = 0xb0bec5;
    else if (canClaim) btnFill = 0xff8a65;
    else btnFill = 0x4db6ac;
    btn.beginFill(btnFill, 1);
    btn.drawRoundedRect(0, 0, btnW, btnH, 14);
    btn.endFill();
    btn.position.set(btnX, (ROW_H - btnH) / 2);
    row.addChild(btn);

    const btnText = new PIXI.Text(label, {
      fontSize: 20,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x37474f,
      strokeThickness: 3,
    } as PIXI.TextStyle);
    btnText.anchor.set(0.5);
    btnText.position.set(btnX + btnW / 2, ROW_H / 2);
    row.addChild(btnText);

    if (claimed) {
      row.eventMode = 'none';
      row.cursor = 'default';
      row.alpha = 0.85;
    } else {
      row.cursor = 'pointer';
      row.hitArea = new PIXI.Rectangle(0, 0, areaW, ROW_H);
      row.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._onRowTap(id);
      });
    }

    return row;
  }

  private _onRowTap(id: TuesdayStaminaPackId): void {
    const progress = TuesdayStaminaUnlimitedManager.getPackProgress(id);
    if (progress.claimed) return;

    if (TuesdayStaminaUnlimitedManager.canClaim(id)) {
      const amount = TuesdayStaminaUnlimitedManager.claimPack(id);
      if (amount > 0) {
        AudioManager.play('purchase_tap');
        ToastMessage.show(`获得体力 +${amount}`);
      }
      return;
    }

    AdManager.showRewardedAd(AdScene.TUESDAY_STAMINA_UNLIMITED, (success, reason) => {
      if (!success) {
        if (reason === 'load_failed' || reason === 'no_ad') {
          ToastMessage.show('广告加载失败，请稍后重试');
        } else if (reason === 'busy') {
          ToastMessage.show('广告正在播放中');
        } else {
          ToastMessage.show('广告未看完，进度未增加');
        }
        return;
      }
      const ok = TuesdayStaminaUnlimitedManager.recordAdWatched(id);
      if (!ok) {
        ToastMessage.show('该档位已满或已领取');
        return;
      }
      AudioManager.play('purchase_tap');
      const label = TuesdayStaminaUnlimitedManager.buttonLabel(id);
      if (label === '领取') {
        ToastMessage.show('可以领取了！');
      } else {
        ToastMessage.show(`广告进度 ${label}`);
      }
    });
  }
}
