/**
 * 抖音专属福利面板：侧边栏复访 + 添加到桌面
 *
 * 纯 Graphics 绘制，不依赖任何新美术资源，避免为单平台功能增加包体。
 * 「添加到桌面」按钮的回调必须停留在 pointertap 的同步调用栈内——
 * 抖音的 addShortcut 要求用户手势，套一层 await / setTimeout 就会失败。
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
const CARD_H = 210;
const CARD_GAP = 24;
const BTN_W = 240;
const BTN_H = 76;

interface WelfareCard {
  root: PIXI.Container;
  desc: PIXI.Text;
  btnBg: PIXI.Graphics;
  btnLabel: PIXI.Text;
  btn: PIXI.Container;
}

export class DouyinWelfarePanel extends PIXI.Container {
  private _isOpen = false;
  private _dim!: PIXI.Graphics;
  private _root!: PIXI.Container;
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

    const title = new PIXI.Text('抖音专属福利', {
      fontSize: 42,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x8b4513,
      strokeThickness: 6,
    } as PIXI.TextStyle);
    title.anchor.set(0.5, 0);
    title.position.set(0, -CARD_H - CARD_GAP / 2 - 90);
    this._root.addChild(title);

    this._sidebarCard = this._buildCard(
      '侧边栏复访',
      `每日一次 · ${DOUYIN_WELFARE.sidebar.diamond}钻石 + ${DOUYIN_WELFARE.sidebar.stamina}体力`,
      () => this._onSidebarTap(),
    );
    this._desktopCard = this._buildCard(
      '添加到桌面',
      `一次性 · ${DOUYIN_WELFARE.desktop.diamond}钻石`,
      () => this._onDesktopTap(),
    );

    const close = this._buildCloseButton();
    this._root.addChild(close);

    this._layout();
  }

  private _buildCard(titleText: string, subText: string, onTap: () => void): WelfareCard {
    const root = new PIXI.Container();
    this._root.addChild(root);

    const bg = new PIXI.Graphics();
    bg.beginFill(0xfffaf2, 1);
    bg.lineStyle(4, 0xe8c9a0, 1);
    bg.drawRoundedRect(-PANEL_W / 2, -CARD_H / 2, PANEL_W, CARD_H, 28);
    bg.endFill();
    root.addChild(bg);

    const title = new PIXI.Text(titleText, {
      fontSize: 34,
      fill: 0x8b5a2b,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    title.anchor.set(0, 0.5);
    title.position.set(-PANEL_W / 2 + 40, -CARD_H / 2 + 52);
    root.addChild(title);

    const desc = new PIXI.Text(subText, {
      fontSize: 24,
      fill: 0xa98763,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: PANEL_W - 80,
    } as PIXI.TextStyle);
    desc.anchor.set(0, 0.5);
    desc.position.set(-PANEL_W / 2 + 40, -CARD_H / 2 + 100);
    root.addChild(desc);

    const btn = new PIXI.Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.Rectangle(-BTN_W / 2, -BTN_H / 2, BTN_W, BTN_H);
    // 直接用 pointertap 同步回调：addShortcut 依赖用户手势，不能延后到下一帧
    btn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.play('button_click');
      onTap();
    });
    btn.position.set(0, CARD_H / 2 - 56);
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

    return { root, desc, btnBg, btnLabel, btn };
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

    btn.position.set(PANEL_W / 2 - 10, -CARD_H - CARD_GAP / 2 - 40);
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

    const totalH = visibleCards.length * CARD_H + Math.max(0, visibleCards.length - 1) * CARD_GAP;
    let y = -totalH / 2 + CARD_H / 2;
    for (const card of visibleCards) {
      card.root.position.set(0, y);
      y += CARD_H + CARD_GAP;
    }
  }

  private _sync(): void {
    this._layout();

    if (this._sidebarCard && DouyinWelfareManager.sidebarAvailable) {
      if (DouyinWelfareManager.sidebarClaimedToday) {
        this._sidebarCard.desc.text = '今日已领取，明天从侧边栏再来看看吧';
        this._setButtonState(this._sidebarCard, '明日再来', false);
      } else if (SidebarService.isFromSidebar()) {
        this._sidebarCard.desc.text = `本次从侧边栏进入 · ${DOUYIN_WELFARE.sidebar.diamond}钻石 + ${DOUYIN_WELFARE.sidebar.stamina}体力`;
        this._setButtonState(this._sidebarCard, '领取奖励', true);
      } else {
        this._sidebarCard.desc.text =
          `加到抖音侧边栏，从侧边栏进入即可领 · ${DOUYIN_WELFARE.sidebar.diamond}钻石 + ${DOUYIN_WELFARE.sidebar.stamina}体力`;
        this._setButtonState(this._sidebarCard, '去侧边栏', true);
      }
    }

    if (this._desktopCard && DouyinWelfareManager.desktopAvailable) {
      const added = DesktopShortcutService.alreadyAdded;
      if (DouyinWelfareManager.desktopRewardClaimed) {
        this._desktopCard.desc.text = added ? '已添加到桌面，奖励已领取' : '奖励已领取';
        this._setButtonState(this._desktopCard, '已完成', false);
      } else {
        this._desktopCard.desc.text = `添加到手机桌面，一键直达花店 · ${DOUYIN_WELFARE.desktop.diamond}钻石`;
        this._setButtonState(this._desktopCard, added ? '领取奖励' : '添加到桌面', true);
      }
    }
  }

  private _onSidebarTap(): void {
    if (DouyinWelfareManager.sidebarClaimedToday) return;

    if (SidebarService.isFromSidebar()) {
      if (DouyinWelfareManager.claimSidebarReward()) {
        ToastMessage.show(`领取成功！钻石 +${DOUYIN_WELFARE.sidebar.diamond}，体力 +${DOUYIN_WELFARE.sidebar.stamina}`);
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
