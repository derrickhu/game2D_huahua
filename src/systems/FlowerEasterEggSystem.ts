/**
 * 首次合成解锁弹窗
 *
 * 任意棋盘物品（花、饮品、工具等）第一次合成出该 id 时弹出：遮罩 + 标题「新解锁」+ 物品图 + 名称 + 物品短描述（花语/物语）+ 收下按钮。
 * 花愿仅订单+离线，本弹窗不再发放花愿。
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { TweenManager, Ease } from '@/core/TweenManager';
import { Game } from '@/core/Game';
import { AudioManager } from '@/core/AudioManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, Category, type ItemDef } from '@/config/ItemConfig';
import { getItemCollectionBlurb } from '@/config/ItemCollectionBlurbs';
import { TextureCache } from '@/utils/TextureCache';
import { createCurrencyIconCluster } from '@/utils/CurrencyCellIcons';

interface UnlockRewards {
  huayuanReward: number;
}

function getUnlockRewards(_itemId: string, _def: ItemDef): UnlockRewards {
  /** 花愿仅订单+离线发放，首次合成弹窗不再塞花愿 */
  return { huayuanReward: 0 };
}

export class FlowerEasterEggSystem {
  private _parent: PIXI.Container;
  private _triggered: Set<string> = new Set();
  private _isShowing = false;

  constructor(parent: PIXI.Container) {
    this._parent = parent;
    this._loadTriggered();
    this._bindEvents();
  }

  private _bindEvents(): void {
    EventBus.on('board:merged', (_src: number, _dst: number, resultId: string, _resultCell: number) => {
      this._checkFirstMergeUnlock(resultId);
    });
  }

  private _checkFirstMergeUnlock(itemId: string): void {
    if (this._isShowing) return;

    const def = ITEM_DEFS.get(itemId);
    if (!def) return;
    if (this._triggered.has(itemId)) return;

    this._triggered.add(itemId);
    this._saveTriggered();
    const rewards = getUnlockRewards(itemId, def);
    setTimeout(() => {
      this._showUnlockPanel(itemId, def.name, rewards);
    }, 600);
  }

  /* ====== 弹窗 UI ====== */

  private _showUnlockPanel(itemId: string, displayName: string, rewards: UnlockRewards): void {
    this._isShowing = true;
    AudioManager.play('collection_unlock');

    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;
    const cx = W / 2;

    const overlay = new PIXI.Container();

    // ---- 全屏遮罩 ----
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.52);
    mask.drawRect(0, 0, W, H);
    mask.endFill();
    mask.eventMode = 'static';
    overlay.addChild(mask);

    // ---- 散落装饰粒子（樱花瓣 / 星星）----
    this._addDecoParticles(overlay, W, H);

    const CARD_W = 380;
    const FRAME_PAD = 20;

    let curY = H * 0.155;

    curY = this._drawTitleBanner(overlay, cx, curY);

    curY += 16;

    const cardTop = curY;
    const cardBgTex = TextureCache.get('flower_egg_card_bg');
    let cardH: number;
    let cardContentW = CARD_W;

    if (cardBgTex) {
      let dispW = CARD_W;
      cardH = Math.round((dispW * cardBgTex.height) / cardBgTex.width);
      const maxCardH = Math.floor(H * 0.52);
      if (cardH > maxCardH) {
        const s = maxCardH / cardH;
        cardH = maxCardH;
        dispW = Math.round(CARD_W * s);
      }
      cardContentW = dispW;
      const csp = new PIXI.Sprite(cardBgTex);
      csp.anchor.set(0.5, 0);
      csp.position.set(cx, cardTop);
      csp.width = dispW;
      csp.height = cardH;
      overlay.addChild(csp);
    } else {
      const ITEM_PREVIEW_SZ = 200;
      const NAME_BELOW_H = 40;
      cardH = ITEM_PREVIEW_SZ + FRAME_PAD * 2 + NAME_BELOW_H;
      const cardBg = new PIXI.Graphics();
      cardBg.beginFill(0xFFFDF5, 0.96);
      cardBg.drawRoundedRect(cx - CARD_W / 2, cardTop, CARD_W, cardH, 22);
      cardBg.endFill();
      cardBg.lineStyle(2.5, 0xE8C8A0, 0.55);
      cardBg.drawRoundedRect(cx - CARD_W / 2 + 7, cardTop + 7, CARD_W - 14, cardH - 14, 17);
      overlay.addChild(cardBg);
    }

    const maxIconBox = Math.min(
      cardContentW * 0.44,
      Math.max(80, Math.floor(cardH * 0.42)),
    );
    /** 图标 + 名称整体在卡背矩形内垂直居中（略偏上补偿花边上沿） */
    const nameGap = 14;
    const nameLineApprox = 32;
    const halfIcon = maxIconBox * 0.5;
    let previewCy =
      cardTop + cardH * 0.5 - (nameGap + nameLineApprox) * 0.5;
    const minCy = cardTop + halfIcon + Math.max(22, cardH * 0.08);
    const maxCy =
      cardTop + cardH - halfIcon - nameGap - nameLineApprox - Math.max(20, cardH * 0.1);
    previewCy = Math.max(minCy, Math.min(maxCy, previewCy));
    const nameY = Math.round(previewCy + halfIcon + nameGap);

    // 物品图（叠在底板奶油区；货币线与棋盘一致用多枚簇，避免 L2 只显示单闪电）
    const def = ITEM_DEFS.get(itemId);
    const csPreview = Math.round(maxIconBox);
    const currencyCluster =
      def?.category === Category.CURRENCY ? createCurrencyIconCluster(def, csPreview) : null;

    if (currencyCluster) {
      currencyCluster.pivot.set(csPreview / 2, csPreview / 2);
      currencyCluster.position.set(cx, previewCy);
      currencyCluster.scale.set(0);
      currencyCluster.rotation = -0.12;
      overlay.addChild(currencyCluster);
      TweenManager.to({
        target: currencyCluster.scale,
        props: { x: 1, y: 1 },
        duration: 0.5,
        ease: Ease.easeOutBack,
      });
      TweenManager.to({
        target: currencyCluster,
        props: { rotation: 0 },
        duration: 0.5,
        ease: Ease.easeOutBack,
      });
    } else {
      const iconKey = def ? def.icon : itemId;
      const flowerTex = TextureCache.get(iconKey);
      if (flowerTex) {
        const sp = new PIXI.Sprite(flowerTex);
        const maxSz = maxIconBox;
        const sc = Math.min(maxSz / flowerTex.width, maxSz / flowerTex.height);
        sp.scale.set(sc);
        sp.anchor.set(0.5, 0.5);
        sp.position.set(cx, previewCy);
        overlay.addChild(sp);

        sp.scale.set(0);
        sp.rotation = -0.15;
        TweenManager.to({ target: sp.scale, props: { x: sc, y: sc }, duration: 0.5, ease: Ease.easeOutBack });
        TweenManager.to({ target: sp, props: { rotation: 0 }, duration: 0.5, ease: Ease.easeOutBack });
      } else {
        const placeholder = new PIXI.Text(displayName.charAt(0) || '?', { fontSize: Math.min(88, Math.round(maxIconBox * 0.55)), fontFamily: FONT_FAMILY });
        placeholder.anchor.set(0.5, 0.5);
        placeholder.position.set(cx, previewCy);
        overlay.addChild(placeholder);
      }
    }

    const nameText = new PIXI.Text(displayName, {
      fontSize: 26,
      fill: 0x5A3E2B,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(cx, nameY);
    overlay.addChild(nameText);

    curY = cardTop + cardH + 24;

    const rewardLayout = this._drawRewardSection(overlay, cx, curY, rewards, CARD_W, itemId);
    curY = rewardLayout.nextY;

    curY += 24;

    // ---- "收下奖励" 按钮 ----
    const btnW = 200;
    const btnH = 50;
    const btnY = curY;
    const btnClaimTex = TextureCache.get('flower_egg_btn_claim');

    const btnWrap = new PIXI.Container();
    btnWrap.position.set(cx, btnY + btnH / 2);
    btnWrap.eventMode = 'static';
    btnWrap.cursor = 'pointer';
    btnWrap.hitArea = new PIXI.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);

    if (btnClaimTex) {
      const bsp = new PIXI.Sprite(btnClaimTex);
      bsp.anchor.set(0.5, 0.5);
      bsp.width = btnW;
      bsp.height = btnH;
      btnWrap.addChild(bsp);
    } else {
      const btnShadow = new PIXI.Graphics();
      btnShadow.beginFill(0x3E8E41, 0.35);
      btnShadow.drawRoundedRect(-btnW / 2 + 2, -btnH / 2 + 3, btnW, btnH, 14);
      btnShadow.endFill();
      btnWrap.addChild(btnShadow);

      const btn = new PIXI.Graphics();
      btn.beginFill(0x66BB6A);
      btn.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);
      btn.endFill();
      btn.lineStyle(2, 0x81C784, 1);
      btn.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);
      btnWrap.addChild(btn);

      const btnHighlight = new PIXI.Graphics();
      btnHighlight.beginFill(0xFFFFFF, 0.18);
      btnHighlight.drawRoundedRect(-btnW / 2 + 4, -btnH / 2 + 3, btnW - 8, btnH * 0.4, 10);
      btnHighlight.endFill();
      btnWrap.addChild(btnHighlight);
    }

    const btnText = new PIXI.Text(rewards.huayuanReward > 0 ? '收下奖励' : '知道了', {
      fontSize: 20,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x388E3C,
      strokeThickness: 2,
    });
    btnText.anchor.set(0.5, 0.5);
    btnText.position.set(0, 0);
    btnText.eventMode = 'none';
    btnWrap.addChild(btnText);

    overlay.addChild(btnWrap);

    const breathObj = { s: 1 };
    const applyBreathScale = (): void => {
      if (btnWrap.destroyed || !btnWrap.scale) return;
      btnWrap.scale.set(breathObj.s);
    };
    const breathe = (): void => {
      TweenManager.to({
        target: breathObj, props: { s: 1.04 }, duration: 0.8, ease: Ease.easeInOutQuad,
        onUpdate: applyBreathScale,
        onComplete: () => {
          TweenManager.to({
            target: breathObj, props: { s: 1 }, duration: 0.8, ease: Ease.easeInOutQuad,
            onUpdate: applyBreathScale,
            onComplete: breathe,
          });
        },
      });
    };
    breathe();

    curY = btnY + btnH + 24;

    // ---- 底部提示 ----
    const hint = new PIXI.Text('点击空白区域关闭', {
      fontSize: 14,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
    });
    hint.anchor.set(0.5, 0);
    hint.position.set(cx, curY);
    hint.alpha = 0.6;
    overlay.addChild(hint);

    // ---- 入场 ----
    overlay.alpha = 0;
    this._parent.addChild(overlay);
    TweenManager.to({ target: overlay, props: { alpha: 1 }, duration: 0.35, ease: Ease.easeOutQuad });

    // ---- 关闭 & 回调（花愿为 0 时仅关窗；若有花愿则经 EventBus 飞入顶栏）----
    let claimStarted = false;
    const finishClose = (): void => {
      TweenManager.cancelTarget(breathObj);
      TweenManager.cancelTarget(overlay);
      TweenManager.to({
        target: overlay,
        props: { alpha: 0 },
        duration: 0.25,
        ease: Ease.easeInQuad,
        onComplete: () => {
          TweenManager.cancelTarget(breathObj);
          this._parent.removeChild(overlay);
          overlay.destroy({ children: true });
          this._isShowing = false;
        },
      });
    };

    const closePanel = (): void => {
      if (claimStarted) return;
      claimStarted = true;
      TweenManager.cancelTarget(breathObj);
      btnWrap.eventMode = 'none';
      mask.eventMode = 'none';

      const gp = overlay.toGlobal(new PIXI.Point(cx, rewardLayout.flyCenterY));
      const lp = this._parent.toLocal(gp);

      EventBus.emit('firstMergeUnlock:claimFly', {
        source: { x: lp.x, y: lp.y },
        huayuanReward: rewards.huayuanReward,
        onComplete: finishClose,
      });
    };

    btnWrap.on('pointerdown', closePanel);
    mask.on('pointerdown', closePanel);
  }

  /* ---- 标题横幅（与装修面板同款 deco_panel_title_ribbon）---- */
  private _drawTitleBanner(container: PIXI.Container, cx: number, y: number): number {
    const decoRibbon = TextureCache.get('deco_panel_title_ribbon');
    const eggBanner = TextureCache.get('flower_egg_title_banner');

    let BW: number;
    let BH: number;
    let onRedRibbon: boolean;

    if (decoRibbon) {
      BW = 440;
      BH = Math.round((BW * decoRibbon.height) / decoRibbon.width);
      BH = Math.max(52, Math.min(86, BH));
      const sp = new PIXI.Sprite(decoRibbon);
      sp.anchor.set(0.5, 0.5);
      sp.position.set(cx, y + BH / 2);
      sp.width = BW;
      sp.height = BH;
      container.addChild(sp);
      onRedRibbon = true;
    } else if (eggBanner) {
      BW = 220;
      BH = 44;
      const sp = new PIXI.Sprite(eggBanner);
      sp.anchor.set(0.5, 0.5);
      sp.position.set(cx, y + BH / 2);
      sp.width = BW;
      sp.height = BH;
      container.addChild(sp);
      onRedRibbon = false;
    } else {
      BW = 300;
      BH = 48;
      const ribbon = new PIXI.Graphics();
      ribbon.beginFill(0xFFF0D4, 0.95);
      ribbon.lineStyle(2, 0xD4A054, 0.8);
      ribbon.drawRoundedRect(cx - BW / 2, y, BW, BH, BH / 2);
      ribbon.endFill();
      ribbon.lineStyle(1, 0xE8C8A0, 0.45);
      ribbon.drawRoundedRect(cx - BW / 2 + 4, y + 4, BW - 8, BH - 8, (BH - 8) / 2);
      container.addChild(ribbon);
      onRedRibbon = false;
    }

    const title = new PIXI.Text('新解锁', onRedRibbon
      ? {
          fontSize: 24,
          fill: 0xFFFFFF,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
          stroke: 0x4E2018,
          strokeThickness: 3,
        }
      : {
          fontSize: 20,
          fill: 0xC97B3A,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
        });
    title.anchor.set(0.5, 0.5);
    title.position.set(cx, y + BH / 2);
    container.addChild(title);

    return y + BH;
  }

  /**
   * 「首次合成奖励」：无长条底图；居中花愿一格，大号描边框格（中间透明），格内图标、格下 × 数量。
   */
  private _drawRewardSection(
    container: PIXI.Container,
    cx: number,
    y: number,
    data: UnlockRewards,
    _cardW: number,
    itemId: string,
  ): { nextY: number; flyCenterY: number } {
    const CELL = 78;

    if (data.huayuanReward <= 0) {
      const blurb = getItemCollectionBlurb(itemId);
      const hint = new PIXI.Text(blurb, {
        fontSize: 17,
        fill: 0xfffef5,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0x3e2723,
        strokeThickness: 2,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: Math.min(340, _cardW + 40),
      });
      hint.anchor.set(0.5, 0);
      hint.position.set(cx, y);
      container.addChild(hint);
      const h = Math.max(44, hint.height + 8);
      return { nextY: y + h + 12, flyCenterY: y + h * 0.45 };
    }

    const labelText = new PIXI.Text('首次合成奖励', {
      fontSize: 23,
      fill: 0xfffef5,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x3e2723,
      strokeThickness: 2.2,
    });
    labelText.anchor.set(0.5, 0);
    labelText.position.set(cx, y);
    container.addChild(labelText);

    const cellTop = y + 34;

    this._drawRewardFramedCell(container, cx, cellTop, CELL, 'icon_huayuan', data.huayuanReward);

    const flyCenterY = cellTop + CELL * 0.5;
    return { nextY: cellTop + CELL + 38, flyCenterY };
  }

  /** 仅圆角描边框，内部透明（透出遮罩）；格内图标 + 格下数量 */
  private _drawRewardFramedCell(
    parent: PIXI.Container,
    centerX: number,
    topY: number,
    cellSize: number,
    textureKey: string,
    amount: number,
  ): void {
    const half = cellSize / 2;
    const left = centerX - half;
    const rr = 10;

    const frame = new PIXI.Graphics();
    frame.lineStyle(2.8, 0xb8956a, 0.92);
    frame.drawRoundedRect(left, topY, cellSize, cellSize, rr);
    frame.lineStyle(1.2, 0xfff5e6, 0.45);
    frame.drawRoundedRect(left + 2.5, topY + 2.5, cellSize - 5, cellSize - 5, Math.max(6, rr - 2));
    parent.addChild(frame);

    const pad = 10;
    const iconMax = cellSize - pad * 2;
    const cy = topY + cellSize / 2;
    const tex = TextureCache.get(textureKey);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const sc = iconMax / Math.max(tex.width, tex.height);
      sp.scale.set(sc);
      sp.position.set(centerX, cy);
      parent.addChild(sp);
    } else {
      const fb = new PIXI.Graphics();
      fb.beginFill(0x888888);
      fb.drawCircle(centerX, cy, iconMax / 2);
      fb.endFill();
      parent.addChild(fb);
    }

    const amt = new PIXI.Text(`×${amount}`, {
      fontSize: 26,
      fill: 0xfff8e8,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x3e2723,
      strokeThickness: 2.2,
    });
    amt.anchor.set(0.5, 0);
    amt.position.set(centerX, topY + cellSize + 10);
    parent.addChild(amt);
  }

  /* ---- 装饰粒子 ---- */
  private _addDecoParticles(container: PIXI.Container, W: number, H: number): void {
    const petals = ['·', '·', '·', '·', '·'];
    for (let i = 0; i < 12; i++) {
      const t = new PIXI.Text(petals[i % petals.length], { fontSize: 16 + Math.random() * 14 });
      t.anchor.set(0.5);
      t.alpha = 0.35 + Math.random() * 0.25;
      t.rotation = Math.random() * Math.PI * 2;
      const px = 30 + Math.random() * (W - 60);
      const py = H * 0.08 + Math.random() * (H * 0.82);
      t.position.set(px, py);
      container.addChild(t);

      const drift = 8 + Math.random() * 14;
      const dur = 2 + Math.random() * 3;
      const startY = py;
      const floatUp = (): void => {
        TweenManager.to({
          target: t, props: { y: startY - drift }, duration: dur, ease: Ease.easeInOutQuad,
          onComplete: () => {
            TweenManager.to({
              target: t, props: { y: startY + drift * 0.5 }, duration: dur * 0.8, ease: Ease.easeInOutQuad,
              onComplete: floatUp,
            });
          },
        });
      };
      floatUp();
    }
  }

  /* ====== 持久化 ====== */

  exportTriggered(): string[] {
    return Array.from(this._triggered);
  }

  loadTriggered(ids: string[]): void {
    this._triggered = new Set(ids);
  }

  private _saveTriggered(): void {
    try {
      PersistService.writeRaw('huahua_flower_quotes', JSON.stringify(this.exportTriggered()));
    } catch (_) { /* ignore */ }
  }

  private _loadTriggered(): void {
    try {
      const raw = PersistService.readRaw('huahua_flower_quotes');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this._triggered = new Set(arr);
        }
      }
    } catch (_) { /* ignore */ }
  }
}
