/**
 * 签到面板 - 全屏遮罩覆盖式 3+3+1 卡片布局
 *
 * 无面板背景框，所有元素直接绘制在半透明遮罩上。
 * 包含里程碑进度条、物品图标（TextureCache）、领取飞入动效接口。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import {
  CheckInManager, MILESTONES,
  getCheckInRewardForCycleDay,
  CHECKIN_AD_BONUS_STAMINA,
  CHECKIN_AD_BONUS_DIAMOND,
  type RewardItem,
} from '@/managers/CheckInManager';
import { AdManager, AdScene, type AdFailReason } from '@/managers/AdManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';

const CARD_AREA_W = 620;
const CARD_GAP = 14;
const CARD_W = Math.floor((CARD_AREA_W - CARD_GAP * 2) / 3);
const CARD_H = 172;
const DAY7_H = 132;

export class CheckInPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _isOpen = false;
  private _opening = false;
  private _adBonusRequesting = false;
  private _assetUnsub: (() => void) | null = null;

  /** 每张日卡的屏幕中心坐标，供飞入动效使用 */
  _dayCardCenters: { x: number; y: number }[] = [];

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    this._opening = true;
    void TextureCache.preloadCheckIn().finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this.alpha = 1;
    this._assetUnsub = TextureCache.onAssetGroupLoaded('checkin', () => this.refreshIfOpen());
    this._refresh();

    TweenManager.cancelTarget(this._bg);
    TweenManager.cancelTarget(this._content);
    TweenManager.cancelTarget(this._content.scale);
    this.position.set(0, 0);
    this.scale.set(1, 1);

    this._bg.alpha = 0;
    this._content.alpha = 0;
    this._content.scale.set(0.85);
    TweenManager.to({ target: this._bg, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.scale, props: { x: 1, y: 1 }, duration: 0.3, ease: Ease.easeOutBack });

    this._maybeAutoMilestoneClaimCelebration();
  }

  /** 主场景里程碑祝贺关闭后刷新日卡/礼包状态（公开供 MainScene 回调） */
  refreshIfOpen(): void {
    if (this._isOpen) this._refresh();
  }

  /** 将签到内容层本地坐标转为场景全局坐标（用于飞入动效与 MainScene.container 对齐） */
  contentToGlobal(local: { x: number; y: number }): PIXI.Point {
    return this._content.toGlobal(new PIXI.Point(local.x, local.y));
  }

  close(): void {
    this._opening = false;
    this._adBonusRequesting = false;
    if (!this._isOpen) return;
    this._isOpen = false;
    this._assetUnsub?.();
    this._assetUnsub = null;
    TweenManager.cancelTarget(this._bg);
    TweenManager.cancelTarget(this._content);
    TweenManager.cancelTarget(this._content.scale);

    TweenManager.to({ target: this._bg, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad });
    TweenManager.to({
      target: this._content, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; this.alpha = 1; },
    });
    TweenManager.to({ target: this._content.scale, props: { x: 0.9, y: 0.9 }, duration: 0.15, ease: Ease.easeInQuad });
  }

  /* ====== 骨架 ====== */

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.6);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.cursor = 'pointer';
    this._bg.hitArea = new PIXI.Rectangle(0, 0, w, h);
    const onDimClose = (): void => this.close();
    this._bg.on('pointerdown', onDimClose);
    /** 微信小游戏上 pointertap 更可靠落到遮罩 */
    this._bg.on('pointertap', onDimClose);
    this.addChild(this._bg);

    this._content = new PIXI.Container();
    this.addChild(this._content);
  }

  /* ====== 内容刷新 ====== */

  private _refresh(): void {
    while (this._content.children.length > 0) {
      const c = this._content.children[0];
      this._content.removeChild(c);
      c.destroy({ children: true });
    }
    this._dayCardCenters = [];

    const cx = DESIGN_WIDTH / 2;
    const logicH = Game.logicHeight;
    this._content.pivot.set(cx, logicH / 2);
    this._content.position.set(cx, logicH / 2);

    const state = CheckInManager.state;
    const justCompletedCycle = state.signedToday && state.signedDays === 0;
    const effectiveSignedDays = justCompletedCycle ? 7 : state.signedDays;
    const displayCycleIndex = justCompletedCycle
      ? Math.max(0, Math.floor((state.totalSignedDays - 1) / 7))
      : Math.max(0, Math.floor(state.totalSignedDays / 7));

    const cardAreaX = cx - CARD_AREA_W / 2;

    const ESTIMATED_H = 200 + 220 + CARD_H + CARD_GAP + CARD_H + CARD_GAP + DAY7_H + 20 + 56 + 140;
    const startY = Math.max(36, (logicH - ESTIMATED_H) / 2);
    let y = startY;

    /** 仅用 Alpha 垫层次，勿 static —— 否则会吞掉整块矩形内的点击，遮罩关不掉 */
    const blocker = new PIXI.Graphics();
    blocker.beginFill(0x000000, 0.001);
    blocker.drawRoundedRect(cardAreaX - 28, startY - 36, CARD_AREA_W + 56, ESTIMATED_H + 120, 20);
    blocker.endFill();
    blocker.eventMode = 'none';
    this._content.addChild(blocker);

    y = this._buildTitleBanner(cx, y);

    const subTxt = new PIXI.Text(
      `累计签到 ${state.totalSignedDays} 天  ·  连续 ${state.consecutiveDays} 天`,
      { fontSize: 17, fill: 0xE0E0E0, fontFamily: FONT_FAMILY, fontWeight: 'bold' },
    );
    subTxt.anchor.set(0.5, 0);
    subTxt.position.set(cx, y);
    this._content.addChild(subTxt);
    y += 32;

    y += this._buildMilestoneBar(cardAreaX, y, state.totalSignedDays, CARD_AREA_W);

    // ── 日卡 Row 1 (Day 1-3) ──
    for (let i = 0; i < 3; i++) {
      const x = cardAreaX + i * (CARD_W + CARD_GAP);
      this._buildDayCard(x, y, CARD_W, CARD_H, i, effectiveSignedDays, state.signedToday, false, displayCycleIndex);
    }
    y += CARD_H + CARD_GAP;

    // ── 日卡 Row 2 (Day 4-6) ──
    for (let i = 3; i < 6; i++) {
      const x = cardAreaX + (i - 3) * (CARD_W + CARD_GAP);
      this._buildDayCard(x, y, CARD_W, CARD_H, i, effectiveSignedDays, state.signedToday, false, displayCycleIndex);
    }
    y += CARD_H + CARD_GAP;

    // ── 日卡 Row 3 (Day 7) ──
    this._buildDayCard(cardAreaX, y, CARD_AREA_W, DAY7_H, 6, effectiveSignedDays, state.signedToday, true, displayCycleIndex);
    y += DAY7_H + 20;

    // ── 签到 / 签到后广告加餐 ──
    if (CheckInManager.canCheckIn) {
      this._buildSignButton(cx, y);
      y += 68;
    }
    if (CheckInManager.canClaimCheckInAdBonus) {
      this._buildCheckInAdBonusButton(cx, y);
      y += 68;
    } else if (state.signedToday && CheckInManager.hasClaimedCheckInAdBonusToday) {
      const tip = new PIXI.Text('今日额外奖励已领取', {
        fontSize: 15,
        fill: 0xAAAAAA,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      tip.anchor.set(0.5, 0);
      tip.position.set(cx, y + 8);
      this._content.addChild(tip);
    }
  }

  /** 打开面板后：有可领里程碑则下一帧弹出与升星同款的全屏祝贺 */
  private _maybeAutoMilestoneClaimCelebration(): void {
    if (!CheckInManager.hasClaimableMilestone) return;
    const m = MILESTONES.find(ms => CheckInManager.canClaimMilestone(ms.threshold));
    if (!m) return;
    requestAnimationFrame(() => {
      EventBus.emit('checkin:requestMilestoneClaim', m.threshold);
    });
  }

  /* ====== 标题横幅 ====== */

  private _buildTitleBanner(cx: number, y: number): number {
    const tex = TextureCache.get('checkin_title_banner');
    if (!tex) {
      const title = new PIXI.Text('每日奖励', {
        fontSize: 36, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 2, dropShadowAlpha: 0.5,
      });
      title.anchor.set(0.5, 0);
      title.position.set(cx, y);
      this._content.addChild(title);
      return y + 48;
    }
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5, 0);
    const tw = Math.min(560, DESIGN_WIDTH - 40);
    sp.width = tw;
    sp.height = (tex.height / tex.width) * tw;
    sp.position.set(cx, y);
    this._content.addChild(sp);
    const title = new PIXI.Text('每日奖励', {
      fontSize: 30,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x6D4C41,
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 1,
      dropShadowAlpha: 0.45,
    });
    title.anchor.set(0.5, 0.5);
    title.position.set(cx, y + sp.height * 0.72);
    this._content.addChild(title);
    return y + sp.height + 8;
  }

  /* ====== 里程碑：与下方日卡同宽；底板内礼包+程序绘制进度条+文字 ====== */

  private _buildMilestoneBar(x: number, y: number, totalDays: number, blockW: number): number {
    const SIDE_PAD = 20;
    const INNER_TOP = 12;
    const GAP_GIFT_TO_TRACK = 12;
    const GAP_TRACK_TO_LABEL = 10;
    const INNER_BOTTOM = 14;
    const GIFT_SZ = 48;
    const TRACK_H = 22;
    /** 礼包与「N天」以中心对齐轨道；末位若贴满 track 右缘会裁切，故左右内缩 */
    const MILESTONE_X_INSET = Math.max(30, Math.ceil(GIFT_SZ * 0.62));
    const maxDays = Math.max(...MILESTONES.map(ms => ms.threshold), 1);

    const trackW = blockW - SIDE_PAD * 2;
    const trackLeft = x + SIDE_PAD;
    const trackR = TRACK_H / 2;

    const innerY = y + INNER_TOP;
    const GIFT_Y = innerY + GIFT_SZ * 0.5 + 4;
    const trackTop = innerY + GIFT_SZ + GAP_GIFT_TO_TRACK;
    const labelTop = trackTop + TRACK_H + GAP_TRACK_TO_LABEL;
    const blockH = (labelTop + 22 + INNER_BOTTOM) - y;

    const panelTex = TextureCache.get('checkin_milestone_panel');
    if (panelTex) {
      const panel = new PIXI.Sprite(panelTex);
      panel.position.set(x, y);
      panel.width = blockW;
      panel.height = blockH;
      this._content.addChild(panel);
    } else {
      const plate = new PIXI.Graphics();
      plate.lineStyle(2, 0xC4A574, 0.9);
      plate.beginFill(0xFFF8EE, 0.92);
      plate.drawRoundedRect(x, y, blockW, blockH, 18);
      plate.endFill();
      this._content.addChild(plate);
    }

    const trackBg = new PIXI.Graphics();
    trackBg.lineStyle(2, 0xCEB8A8, 1);
    trackBg.beginFill(0xEEF6E8);
    trackBg.drawRoundedRect(trackLeft, trackTop, trackW, TRACK_H, trackR);
    trackBg.endFill();
    this._content.addChild(trackBg);

    const fillRatio = Math.min(1, totalDays / maxDays);
    const fillW = Math.max(0, fillRatio * trackW);
    if (fillW > 1.5) {
      const inset = 3;
      const fw = Math.max(0, fillW - inset * 2);
      const fillBar = new PIXI.Graphics();
      fillBar.beginFill(0x8BC34A);
      fillBar.drawRoundedRect(trackLeft + inset, trackTop + inset, fw, TRACK_H - inset * 2, Math.max(4, trackR - inset));
      fillBar.endFill();
      this._content.addChild(fillBar);
      const gloss = new PIXI.Graphics();
      gloss.beginFill(0xffffff, 0.22);
      gloss.drawRoundedRect(trackLeft + inset + 2, trackTop + inset + 1, Math.max(0, fw - 4), (TRACK_H - inset * 2) * 0.35, 6);
      gloss.endFill();
      this._content.addChild(gloss);
    }

    const mileSpan = Math.max(40, trackW - MILESTONE_X_INSET * 2);
    MILESTONES.forEach((ms, mi) => {
      const nodeX = trackLeft + MILESTONE_X_INSET + (ms.threshold / maxDays) * mileSpan;
      const giftTex = TextureCache.get(`checkin_milestone_gift_${mi + 1}`);
      const claimed = CheckInManager.isMilestoneClaimed(ms.threshold);

      if (giftTex) {
        const sp = new PIXI.Sprite(giftTex);
        sp.anchor.set(0.5);
        sp.position.set(nodeX, GIFT_Y);
        sp.width = GIFT_SZ;
        sp.height = GIFT_SZ;
        if (claimed) sp.alpha = 0.38;
        this._content.addChild(sp);
      } else {
        const g = new PIXI.Graphics();
        g.beginFill(0xFFD54F);
        g.lineStyle(2, 0xF57C00, 1);
        g.drawRoundedRect(nodeX - 16, GIFT_Y - 16, 32, 32, 6);
        g.endFill();
        if (claimed) g.alpha = 0.38;
        this._content.addChild(g);
      }

      if (claimed) {
        const ck = new PIXI.Text('√', { fontSize: 20, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold', stroke: 0x2E7D32, strokeThickness: 3 });
        ck.anchor.set(0.5);
        ck.position.set(nodeX, GIFT_Y);
        ck.alpha = 0.85;
        this._content.addChild(ck);
      }

      // 可领时不再画红点、不做缩放脉冲：里程碑奖励打开面板会自动弹出祝贺，图标保持静态即可

      const lbl = new PIXI.Text(`${ms.threshold}天`, {
        fontSize: 16, fill: 0x5D4037, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        stroke: 0xFFFFFF,
        strokeThickness: 3,
      });
      lbl.anchor.set(0.5, 0);
      lbl.position.set(nodeX, labelTop);
      if (claimed) lbl.alpha = 0.55;
      this._content.addChild(lbl);

      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Circle(nodeX, GIFT_Y, GIFT_SZ * 0.65);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (CheckInManager.canClaimMilestone(ms.threshold)) {
          EventBus.emit('checkin:requestMilestoneClaim', ms.threshold);
        } else {
          EventBus.emit('checkin:requestMilestonePreview', ms.threshold);
        }
      });
      this._content.addChild(hit);
    });

    return blockH + 10;
  }

  /* ====== 日卡 ====== */

  private _buildDayCard(
    x: number, y: number, w: number, h: number,
    dayIndex: number, effectiveSigned: number, signedToday: boolean,
    isWide = false,
    cycleIndex = 0,
  ): void {
    const reward = getCheckInRewardForCycleDay(dayIndex + 1, cycleIndex);
    const isSigned = dayIndex < effectiveSigned;
    const isToday = !signedToday && dayIndex === effectiveSigned;

    const card = new PIXI.Container();
    card.position.set(x, y);

    const R = 14;
    let cardBg: PIXI.Graphics | PIXI.Sprite | null = null;
    const texKey = isWide
      ? 'checkin_card_day7'
      : isSigned
        ? 'checkin_card_signed'
        : isToday
          ? 'checkin_card_today'
          : 'checkin_card_future';
    const cardTex = TextureCache.get(texKey);
    if (cardTex) {
      const sp = new PIXI.Sprite(cardTex);
      sp.width = w;
      sp.height = h;
      card.addChild(sp);
      cardBg = sp;
    } else {
      const bg = new PIXI.Graphics();
      if (isSigned) {
        bg.beginFill(0x2E7D32, 0.45);
      } else if (isToday) {
        bg.lineStyle(2.5, 0xFFD700, 0.85);
        bg.beginFill(0x5D4037, 0.4);
      } else {
        bg.beginFill(0x37474F, 0.38);
      }
      bg.drawRoundedRect(0, 0, w, h, R);
      bg.endFill();
      card.addChild(bg);
      cardBg = bg;
    }

    const dayStr = isToday ? '今天' : `第${reward.day}天`;
    const dayLbl = new PIXI.Text(dayStr, {
      fontSize: isWide ? 20 : 18,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x3E2723,
      strokeThickness: 4,
    });
    dayLbl.anchor.set(0.5, 0);
    dayLbl.position.set(w / 2, 7);
    card.addChild(dayLbl);

    const items = reward.items;
    const ICON_SZ = isWide ? (items.length > 2 ? 42 : 48) : (items.length > 1 ? 40 : 52);
    const contentCY = h / 2 + 10;

    if (isWide || items.length > 1) {
      const spacing = isWide ? Math.max(82, Math.min(100, (w - 80) / Math.max(1, items.length - 1))) : 78;
      const startIX = w / 2 - ((items.length - 1) * spacing) / 2;
      for (let j = 0; j < items.length; j++) {
        this._drawRewardItem(card, startIX + j * spacing, contentCY, items[j], isSigned, ICON_SZ);
      }
    } else {
      this._drawRewardItem(card, w / 2, contentCY, items[0], isSigned, ICON_SZ);
    }

    // 已签到覆盖层
    if (isSigned) {
      const overlay = new PIXI.Graphics();
      overlay.beginFill(0x1B5E20, 0.2);
      overlay.drawRoundedRect(0, 0, w, h, R);
      overlay.endFill();
      card.addChild(overlay);

      const chk = new PIXI.Text('√', {
        fontSize: isWide ? 36 : 28, fill: 0x66BB6A, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      chk.anchor.set(0.5);
      chk.position.set(w / 2, h / 2);
      card.addChild(chk);
    }

    // 今天脉冲
    if (isToday && cardBg) {
      const p = { a: 0.92 };
      const up = (): void => {
        TweenManager.to({
          target: p, props: { a: 1 }, duration: 0.8, ease: Ease.easeInOutQuad,
          onUpdate: () => { cardBg!.alpha = p.a; },
          onComplete: () => {
            TweenManager.to({
              target: p, props: { a: 0.88 }, duration: 0.8, ease: Ease.easeInOutQuad,
              onUpdate: () => { cardBg!.alpha = p.a; },
              onComplete: up,
            });
          },
        });
      };
      up();
    }

    this._content.addChild(card);
    this._dayCardCenters[dayIndex] = { x: x + w / 2, y: y + h / 2 };
  }

  private _drawRewardItem(
    parent: PIXI.Container, cx: number, cy: number,
    item: RewardItem, dimmed: boolean, size: number,
  ): void {
    const tex = TextureCache.get(item.textureKey);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const sc = size / Math.max(tex.width, tex.height);
      sp.scale.set(sc);
      sp.position.set(cx, cy - 8);
      if (dimmed) sp.alpha = 0.35;
      parent.addChild(sp);
    } else {
      const fb = new PIXI.Graphics();
      fb.beginFill(0x888888);
      fb.drawCircle(cx, cy - 8, size / 2);
      fb.endFill();
      if (dimmed) fb.alpha = 0.35;
      parent.addChild(fb);
    }

    const qtyText = item.type === 'deco' ? '专属家具' : `×${item.amount}`;
    const amt = new PIXI.Text(qtyText, {
      fontSize: 16, fill: dimmed ? 0xAAAAAA : 0x4E342E,
      fontFamily: FONT_FAMILY, fontWeight: 'bold',
      stroke: dimmed ? 0x000000 : 0xFFFFFF,
      strokeThickness: dimmed ? 0 : 2.5,
    });
    amt.anchor.set(0.5, 0);
    amt.position.set(cx, cy + size / 2 - 4);
    parent.addChild(amt);
  }

  /* ====== 签到按钮 ====== */

  private _buildSignButton(cx: number, y: number): void {
    const BW = 240;
    const BH = 52;

    const btnTex = TextureCache.get('deco_card_btn_2');
    if (btnTex) {
      const sp = new PIXI.Sprite(btnTex);
      sp.anchor.set(0.5, 0);
      sp.width = BW;
      sp.height = BH;
      sp.position.set(cx, y);
      this._content.addChild(sp);
    } else {
      const btnBg = new PIXI.Graphics();
      btnBg.lineStyle(2, 0xFFAA80, 0.6);
      btnBg.beginFill(0xFF8C69);
      btnBg.drawRoundedRect(cx - BW / 2, y, BW, BH, BH / 2);
      btnBg.endFill();
      this._content.addChild(btnBg);
    }

    const btnTxt = new PIXI.Text('点击领取', {
      fontSize: 22, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    btnTxt.anchor.set(0.5, 0.5);
    btnTxt.position.set(cx, y + BH / 2);
    this._content.addChild(btnTxt);

    const hit = new PIXI.Container();
    hit.hitArea = new PIXI.Rectangle(cx - BW / 2, y, BW, BH);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointerdown', () => this._onCheckIn());
    this._content.addChild(hit);
  }

  private _buildCheckInAdBonusButton(cx: number, y: number): void {
    const BW = Math.min(360, DESIGN_WIDTH - 40);
    const BH = 58;

    const btnTex = TextureCache.get('deco_card_btn_3');
    if (btnTex) {
      const sp = new PIXI.Sprite(btnTex);
      sp.anchor.set(0.5, 0);
      sp.width = BW;
      sp.height = BH;
      sp.position.set(cx, y);
      this._content.addChild(sp);
    } else {
      const btnBg = new PIXI.Graphics();
      btnBg.lineStyle(2, 0x2e7d32, 0.95);
      btnBg.beginFill(0x2e7d32);
      btnBg.drawRoundedRect(cx - BW / 2, y, BW, BH, BH / 2);
      btnBg.endFill();
      this._content.addChild(btnBg);
    }

    const root = new PIXI.Container();
    root.eventMode = 'none';
    root.position.set(cx, y + BH / 2);

    const titleStyle = {
      fontSize: 16,
      fill: 0xfffef9,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold' as const,
      stroke: 0x1b3320,
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
      dropShadowAlpha: 0.55,
    };
    const t1 = new PIXI.Text('看广告 · 额外领取', titleStyle as any);
    t1.anchor.set(0.5, 1);
    t1.position.set(0, -4);
    root.addChild(t1);

    const rewardRow = new PIXI.Container();
    const iconH = 22;
    const strokeAmt = {
      fontSize: 16,
      fill: 0xfffef9,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold' as const,
      stroke: 0x263826,
      strokeThickness: 3,
    };

    let rx = 0;
    const stTex = TextureCache.get('icon_energy');
    if (stTex?.width) {
      const sp = new PIXI.Sprite(stTex);
      sp.anchor.set(0, 0.5);
      sp.height = iconH;
      sp.width = (stTex.width / stTex.height) * iconH;
      sp.position.set(rx, 0);
      rewardRow.addChild(sp);
      rx += sp.width + 5;
    }
    const stAmt = new PIXI.Text(`+${CHECKIN_AD_BONUS_STAMINA}`, strokeAmt as any);
    stAmt.anchor.set(0, 0.5);
    stAmt.position.set(rx, 0);
    rewardRow.addChild(stAmt);
    rx += stAmt.width + 18;

    const dmTex = TextureCache.get('icon_gem');
    if (dmTex?.width) {
      const sp = new PIXI.Sprite(dmTex);
      sp.anchor.set(0, 0.5);
      sp.height = iconH;
      sp.width = (dmTex.width / dmTex.height) * iconH;
      sp.position.set(rx, 0);
      rewardRow.addChild(sp);
      rx += sp.width + 5;
    }
    const dmAmt = new PIXI.Text(`+${CHECKIN_AD_BONUS_DIAMOND}`, strokeAmt as any);
    dmAmt.anchor.set(0, 0.5);
    dmAmt.position.set(rx, 0);
    rewardRow.addChild(dmAmt);

    const rb = rewardRow.getLocalBounds();
    rewardRow.pivot.set(rb.x + rb.width / 2, rb.y + rb.height / 2);
    rewardRow.position.set(0, 10);
    root.addChild(rewardRow);

    this._content.addChild(root);

    const hit = new PIXI.Container();
    hit.hitArea = new PIXI.Rectangle(cx - BW / 2, y, BW, BH);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      if (this._adBonusRequesting) return;
      this._adBonusRequesting = true;
      AdManager.showRewardedAd(AdScene.CHECKIN_AD_BONUS, (success, reason) => {
        this._adBonusRequesting = false;
        if (!success) {
          ToastMessage.show(this._adBonusFailMessage(reason));
          return;
        }
        if (!CheckInManager.grantCheckInAdBonusFromAd()) {
          ToastMessage.show('今日额外奖励已领取');
          return;
        }
        const items: RewardItem[] = [
          { type: 'stamina', amount: CHECKIN_AD_BONUS_STAMINA, textureKey: 'icon_energy' },
          { type: 'diamond', amount: CHECKIN_AD_BONUS_DIAMOND, textureKey: 'icon_gem' },
        ];
        const center = { x: cx, y: y + BH / 2 };
        /** 加餐领完飞入结束后关面板；此处不再 _refresh，避免动画进行中拆掉节点 */
        EventBus.emit('checkin:flyReward', { items, autoClosePanel: true }, center);
      });
    });
    this._content.addChild(hit);
  }

  private _adBonusFailMessage(reason?: AdFailReason): string {
    if (reason === 'skipped') return '广告未看完，未领取额外奖励';
    if (reason === 'busy') return '广告正在加载，请稍候';
    return '广告暂不可用，请稍后再试';
  }

  /* ====== 签到逻辑 ====== */

  _onCheckIn(): void {
    const dayIdx = CheckInManager.state.signedDays;
    const center = this._dayCardCenters[dayIdx];

    const result = CheckInManager.checkIn();
    if (!result) return;

    const flyItems = [...result.reward.items];
    if (result.streakBonus > 0) {
      flyItems.push({ type: 'diamond', amount: result.streakBonus, textureKey: 'icon_gem' });
    }
    /** 飞完不关面板：便于继续点「看广告加餐」；仅点遮罩关闭（见 _bg） */
    if (center && flyItems.length > 0) {
      EventBus.emit('checkin:flyReward', { items: flyItems, autoClosePanel: false }, center);
    }

    this._refresh();
    this._maybeAutoMilestoneClaimCelebration();
  }
}
