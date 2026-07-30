/**
 * 抖音专属福利面板：侧边栏复访 + 添加到桌面
 *
 * 纯 Graphics 绘制，不依赖任何新美术资源，避免为单平台功能增加包体。
 * 「添加到桌面」按钮的回调必须停留在 pointertap 的同步调用栈内——
 * 抖音的 addShortcut 要求用户手势，套一层 await / setTimeout 就会失败。
 *
 * 侧边栏复访须展示完备操作指引（平台审核必检，对齐官方「图二」三步说明）：
 * 1) 点击侧边栏图标 → 2) 点击「花花妙屋」→ 3) 领取奖励，再点「进入侧边栏」。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { OverlayManager } from '@/core/OverlayManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import { AudioManager } from '@/core/AudioManager';
import { SidebarService } from '@/core/SidebarService';
import { DesktopShortcutService } from '@/core/DesktopShortcutService';
import { DouyinWelfareManager } from '@/managers/DouyinWelfareManager';
import { DOUYIN_WELFARE } from '@/config/DouyinWelfareConfig';
import { ToastMessage } from './ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';

const Z = 11300;
const PANEL_W = 600;
/** 桌面卡 / 侧边栏已领完等短卡 */
const CARD_H = 210;
/** 侧边栏待前往：含三步操作指引 */
const SIDEBAR_GUIDE_CARD_H = 470;
/** 侧边栏可领取：略高于短卡 */
const SIDEBAR_CLAIM_CARD_H = 250;
const CARD_GAP = 24;
const BTN_W = 280;
const BTN_H = 76;

const SIDEBAR_GUIDE_STEPS = [
  '点击侧边栏图标',
  '点击「花花妙屋」',
  '领取奖励',
] as const;

interface WelfareCard {
  root: PIXI.Container;
  bg: PIXI.Graphics;
  title: PIXI.Text;
  desc: PIXI.Text;
  guide: PIXI.Container | null;
  btnBg: PIXI.Graphics;
  btnLabel: PIXI.Text;
  btn: PIXI.Container;
  height: number;
}

export class DouyinWelfarePanel extends PIXI.Container {
  private _isOpen = false;
  private _dim!: PIXI.Graphics;
  private _root!: PIXI.Container;
  private _panelTitle!: PIXI.Text;
  private _closeBtn!: PIXI.Container;
  private _sidebarCard: WelfareCard | null = null;
  private _desktopCard: WelfareCard | null = null;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = Z;
    this.sortableChildren = true;
    this._build();
    EventBus.on('panel:openDouyinWelfare', () => this.open());
    EventBus.on('douyinWelfare:changed', () => {
      if (this._isOpen) this._sync();
    });
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  open(): void {
    if (this._isOpen) return;
    if (!DouyinWelfareManager.hasAnyEntry) return;
    this._isOpen = true;
    OverlayManager.bringToFront();
    this.visible = true;
    this._sync();
    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.22, ease: Ease.easeOutQuad });
  }

  close(): void {
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

  relayout(): void {
    this._layout();
  }

  private _build(): void {
    this._dim = new PIXI.Graphics();
    this._dim.eventMode = 'static';
    this._dim.on('pointertap', () => this.close());
    this.addChild(this._dim);

    this._root = new PIXI.Container();
    this._root.eventMode = 'passive';
    this.addChild(this._root);

    this._panelTitle = new PIXI.Text('抖音专属福利', {
      fontSize: 42,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 6,
    } as PIXI.TextStyle);
    this._panelTitle.anchor.set(0.5, 0);
    this._root.addChild(this._panelTitle);

    this._sidebarCard = this._buildSidebarCard();
    this._desktopCard = this._buildCard(
      '添加到桌面',
      `一次性 · ${DOUYIN_WELFARE.desktop.diamond}钻石`,
      () => this._onDesktopTap(),
      CARD_H,
      false,
    );

    this._closeBtn = this._buildCloseButton();
    this._root.addChild(this._closeBtn);

    this._layout();
  }

  /** 侧边栏卡：内置官方图二风格三步指引（审核必检） */
  private _buildSidebarCard(): WelfareCard {
    const card = this._buildCard(
      '侧边栏进入领奖励',
      `每日一次 · ${DOUYIN_WELFARE.sidebar.diamond}钻石 + ${DOUYIN_WELFARE.sidebar.stamina}体力`,
      () => this._onSidebarTap(),
      SIDEBAR_GUIDE_CARD_H,
      true,
    );
    return card;
  }

  private _buildCard(
    titleText: string,
    subText: string,
    onTap: () => void,
    height: number,
    withGuide: boolean,
  ): WelfareCard {
    const root = new PIXI.Container();
    this._root.addChild(root);

    const bg = new PIXI.Graphics();
    root.addChild(bg);

    const title = new PIXI.Text(titleText, {
      fontSize: 32,
      fill: 0x8b5a2b,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    title.anchor.set(0, 0.5);
    root.addChild(title);

    const desc = new PIXI.Text(subText, {
      fontSize: 22,
      fill: 0xa98763,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: PANEL_W - 80,
    } as PIXI.TextStyle);
    desc.anchor.set(0, 0.5);
    root.addChild(desc);

    let guide: PIXI.Container | null = null;
    if (withGuide) {
      guide = this._buildSidebarGuideSteps();
      root.addChild(guide);
    }

    const btn = new PIXI.Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.Rectangle(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H);
    // 直接用 pointertap 同步回调：addShortcut / navigateToScene 依赖用户手势
    btn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.play('button_click');
      onTap();
    });
    root.addChild(btn);

    const btnBg = new PIXI.Graphics();
    btn.addChild(btnBg);

    const btnLabel = new PIXI.Text('', {
      fontSize: 30,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    btnLabel.anchor.set(0.5);
    btn.addChild(btnLabel);

    const card: WelfareCard = { root, bg, title, desc, guide, btnBg, btnLabel, btn, height };
    this._applyCardChrome(card, height, withGuide);
    return card;
  }

  private _buildSidebarGuideSteps(): PIXI.Container {
    const box = new PIXI.Container();
    const stepH = 56;
    const startY = 0;

    SIDEBAR_GUIDE_STEPS.forEach((text, i) => {
      const row = new PIXI.Container();
      row.position.set(0, startY + i * stepH);

      const badge = new PIXI.Container();
      const badgeBg = new PIXI.Graphics();
      badgeBg.beginFill(0xff7a45, 1);
      badgeBg.drawCircle(0, 0, 18);
      badgeBg.endFill();
      badge.addChild(badgeBg);
      const num = new PIXI.Text(String(i + 1), {
        fontSize: 22,
        fill: 0xffffff,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as PIXI.TextStyle);
      num.anchor.set(0.5);
      badge.addChild(num);
      badge.position.set(-PANEL_W / 2 + 56, 0);
      row.addChild(badge);

      const label = new PIXI.Text(text, {
        fontSize: 26,
        fill: 0x5c4030,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as PIXI.TextStyle);
      label.anchor.set(0, 0.5);
      label.position.set(-PANEL_W / 2 + 90, 0);
      row.addChild(label);

      // 步骤间虚线连接（最后一步不加）
      if (i < SIDEBAR_GUIDE_STEPS.length - 1) {
        const link = new PIXI.Graphics();
        link.lineStyle(3, 0xe8c9a0, 0.9);
        const x = -PANEL_W / 2 + 56;
        link.moveTo(x, 20);
        link.lineTo(x, stepH - 20);
        row.addChild(link);
      }

      box.addChild(row);
    });

    const tip = new PIXI.Text('按以上步骤从抖音首页侧边栏进入后，即可领取今日奖励', {
      fontSize: 20,
      fill: 0xb8956a,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: PANEL_W - 80,
      align: 'left',
    } as PIXI.TextStyle);
    tip.anchor.set(0, 0);
    tip.position.set(-PANEL_W / 2 + 40, startY + SIDEBAR_GUIDE_STEPS.length * stepH + 8);
    box.addChild(tip);

    return box;
  }

  private _applyCardChrome(card: WelfareCard, height: number, showGuide: boolean): void {
    card.height = height;
    card.bg.clear();
    card.bg.beginFill(0xfffaf2, 1);
    card.bg.lineStyle(4, 0xe8c9a0, 1);
    card.bg.drawRoundedRect(-PANEL_W / 2, -height / 2, PANEL_W, height, 28);
    card.bg.endFill();

    card.title.position.set(-PANEL_W / 2 + 40, -height / 2 + 48);
    card.desc.position.set(-PANEL_W / 2 + 40, -height / 2 + 92);

    if (card.guide) {
      card.guide.visible = showGuide;
      card.guide.position.set(0, -height / 2 + 140);
    }

    card.btn.position.set(0, height / 2 - 56);
  }

  private _buildCloseButton(): PIXI.Container {
    const btn = new PIXI.Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.Circle(0, 0, 34);
    btn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });

    const g = new PIXI.Graphics();
    g.beginFill(0x000000, 0.35);
    g.drawCircle(0, 0, 30);
    g.endFill();
    g.lineStyle(5, 0xffffff, 0.9);
    g.moveTo(-11, -11); g.lineTo(11, 11);
    g.moveTo(11, -11); g.lineTo(-11, 11);
    btn.addChild(g);
    return btn;
  }

  private _setButtonState(card: WelfareCard, label: string, enabled: boolean): void {
    card.btnLabel.text = label;
    card.btn.eventMode = enabled ? 'static' : 'none';
    card.btn.cursor = enabled ? 'pointer' : 'default';
    card.btnBg.clear();
    card.btnBg.beginFill(enabled ? 0xff7a45 : 0xcfc3b8, 1);
    card.btnBg.drawRoundedRect(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H, BTN_H / 2);
    card.btnBg.endFill();
  }

  private _layout(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    this._dim.clear();
    this._dim.beginFill(0x000000, 0.6);
    this._dim.drawRect(0, 0, W, H);
    this._dim.endFill();

    this._root.position.set(W / 2, H / 2);

    const visibleCards: WelfareCard[] = [];
    if (this._sidebarCard) {
      this._sidebarCard.root.visible = DouyinWelfareManager.sidebarAvailable;
      if (this._sidebarCard.root.visible) visibleCards.push(this._sidebarCard);
    }
    if (this._desktopCard) {
      this._desktopCard.root.visible = DouyinWelfareManager.desktopAvailable;
      if (this._desktopCard.root.visible) visibleCards.push(this._desktopCard);
    }

    const totalH =
      visibleCards.reduce((sum, c) => sum + c.height, 0)
      + Math.max(0, visibleCards.length - 1) * CARD_GAP;
    let y = -totalH / 2;
    for (const card of visibleCards) {
      card.root.position.set(0, y + card.height / 2);
      y += card.height + CARD_GAP;
    }

    const topY = visibleCards.length > 0
      ? visibleCards[0]!.root.position.y - visibleCards[0]!.height / 2
      : -120;
    this._panelTitle.position.set(0, topY - 78);
    this._closeBtn.position.set(PANEL_W / 2 - 10, topY - 28);
  }

  private _sync(): void {
    if (this._sidebarCard && DouyinWelfareManager.sidebarAvailable) {
      const card = this._sidebarCard;
      if (DouyinWelfareManager.sidebarClaimedToday) {
        card.title.text = '侧边栏复访';
        card.desc.text = '今日已领取，明天从侧边栏再来看看吧';
        this._applyCardChrome(card, CARD_H, false);
        this._setButtonState(card, '明日再来', false);
      } else if (SidebarService.isFromSidebar()) {
        card.title.text = '侧边栏进入领奖励';
        card.desc.text =
          `本次已从侧边栏进入 · 可领 ${DOUYIN_WELFARE.sidebar.diamond}钻石 + ${DOUYIN_WELFARE.sidebar.stamina}体力`;
        this._applyCardChrome(card, SIDEBAR_CLAIM_CARD_H, false);
        this._setButtonState(card, '领取奖励', true);
      } else {
        // 审核要求：未前往前必须展示清晰完备的三步操作指引
        card.title.text = '侧边栏进入领奖励';
        card.desc.text =
          `每日一次 · ${DOUYIN_WELFARE.sidebar.diamond}钻石 + ${DOUYIN_WELFARE.sidebar.stamina}体力`;
        this._applyCardChrome(card, SIDEBAR_GUIDE_CARD_H, true);
        this._setButtonState(card, '进入侧边栏', true);
      }
    }

    if (this._desktopCard && DouyinWelfareManager.desktopAvailable) {
      const added = DesktopShortcutService.alreadyAdded;
      if (DouyinWelfareManager.desktopRewardClaimed) {
        this._desktopCard.desc.text = added ? '已添加到桌面，奖励已领取' : '奖励已领取';
        this._setButtonState(this._desktopCard, '已完成', false);
      } else {
        this._desktopCard.desc.text =
          `添加到手机桌面，一键直达花店 · ${DOUYIN_WELFARE.desktop.diamond}钻石`;
        this._setButtonState(this._desktopCard, added ? '领取奖励' : '添加到桌面', true);
      }
    }

    this._layout();
  }

  private _onSidebarTap(): void {
    if (DouyinWelfareManager.sidebarClaimedToday) return;

    if (SidebarService.isFromSidebar()) {
      if (DouyinWelfareManager.claimSidebarReward()) {
        ToastMessage.show(
          `领取成功！钻石 +${DOUYIN_WELFARE.sidebar.diamond}，体力 +${DOUYIN_WELFARE.sidebar.stamina}`,
        );
      }
      this._sync();
      return;
    }

    SidebarService.navigateToSidebar({
      onFail: () => ToastMessage.show('当前版本暂不支持侧边栏，请升级抖音后重试'),
    });
  }

  private _onDesktopTap(): void {
    if (DouyinWelfareManager.desktopRewardClaimed) return;

    // 已添加过的用户直接补发，不必再走一次系统弹窗
    if (DesktopShortcutService.alreadyAdded) {
      if (DouyinWelfareManager.claimDesktopReward()) {
        ToastMessage.show(`领取成功！钻石 +${DOUYIN_WELFARE.desktop.diamond}`);
      }
      this._sync();
      return;
    }

    const started = DesktopShortcutService.addToDesktop({
      onSuccess: () => {
        if (DouyinWelfareManager.claimDesktopReward()) {
          ToastMessage.show(`添加成功！钻石 +${DOUYIN_WELFARE.desktop.diamond}`);
        }
        this._sync();
      },
      onFail: () => ToastMessage.show('添加失败，请在系统弹窗中允许创建桌面快捷方式'),
    });
    if (!started) ToastMessage.show('当前设备不支持添加到桌面');
  }
}
