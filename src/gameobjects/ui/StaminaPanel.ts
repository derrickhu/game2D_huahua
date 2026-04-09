/**
 * 体力不足面板 - 当体力不足时弹出
 *
 * 提供3种恢复方式：
 * 1. 等待自然恢复（显示倒计时）
 * 2. 钻石购买体力（递增定价，每日限5次）
 * 3. 看广告恢复体力（每日限5次）
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import { ToastMessage } from './ToastMessage';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY, STAMINA_RECOVER_INTERVAL } from '@/config/Constants';
import { AdManager, AdScene } from '@/managers/AdManager';

const PANEL_W = 520;
const PANEL_H = 380;

export class StaminaPanel extends PIXI.Container {
  private _content!: PIXI.Container;
  private _buyBtn!: PIXI.Container;
  private _buyLabel!: PIXI.Text;
  private _adBtn!: PIXI.Container;
  private _adLabel!: PIXI.Text;
  private _timerText!: PIXI.Text;
  private _staminaText!: PIXI.Text;
  private _isOpen = false;

  constructor() {
    super();
    this.visible = false;
    this._build();
  }

  get isOpen(): boolean { return this._isOpen; }

  /** 打开面板 */
  open(neededStamina?: number): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._refresh(neededStamina);

    this.alpha = 0;
    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
  }

  /** 关闭面板 */
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

  /** 外部 ticker 调用，更新倒计时 */
  updateTimer(): void {
    if (!this._isOpen) return;
    const remain = CurrencyManager.staminaRecoverRemain;
    if (remain <= 0) {
      this._timerText.text = '体力已满！';
    } else {
      const m = Math.floor(remain / 60);
      const s = Math.floor(remain % 60);
      this._timerText.text = `下一点体力恢复：${m}:${s.toString().padStart(2, '0')}`;
    }

    // 更新体力数值
    this._staminaText.text = ` ${CurrencyManager.state.stamina} / ${CurrencyManager.staminaCap}`;
  }

  // ====== 构建 UI ======

  private _build(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    // 全屏遮罩
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.45);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    overlay.on('pointerdown', () => this.close());
    this.addChild(overlay);

    // 面板主体
    this._content = new PIXI.Container();
    const px = (W - PANEL_W) / 2;
    const py = (H - PANEL_H) / 2;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFDF8, 0.97);
    bg.drawRoundedRect(px, py, PANEL_W, PANEL_H, 20);
    bg.endFill();
    bg.lineStyle(2, COLORS.CELL_BORDER, 0.4);
    bg.drawRoundedRect(px, py, PANEL_W, PANEL_H, 20);
    bg.eventMode = 'static'; // 阻止穿透
    this._content.addChild(bg);

    // 标题
    const title = new PIXI.Text(' 体力不足', {
      fontSize: 24,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(W / 2, py + 24);
    this._content.addChild(title);

    // 当前体力
    this._staminaText = new PIXI.Text('', {
      fontSize: 32,
      fill: 0x43A047,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._staminaText.anchor.set(0.5, 0);
    this._staminaText.position.set(W / 2, py + 60);
    this._content.addChild(this._staminaText);

    // 自然恢复倒计时
    this._timerText = new PIXI.Text('', {
      fontSize: 14,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    this._timerText.anchor.set(0.5, 0);
    this._timerText.position.set(W / 2, py + 104);
    this._content.addChild(this._timerText);

    // 恢复速度说明
    const rateMin = Math.round(STAMINA_RECOVER_INTERVAL / 60);
    const rateText = new PIXI.Text(`(每${rateMin}分钟自动恢复1点体力)`, {
      fontSize: 12,
      fill: 0xBBBBBB,
      fontFamily: FONT_FAMILY,
    });
    rateText.anchor.set(0.5, 0);
    rateText.position.set(W / 2, py + 124);
    this._content.addChild(rateText);

    // 分割线
    const divider = new PIXI.Graphics();
    divider.beginFill(COLORS.CELL_BORDER, 0.3);
    divider.drawRect(px + 30, py + 150, PANEL_W - 60, 1);
    divider.endFill();
    this._content.addChild(divider);

    // 恢复方式标题
    const methodTitle = new PIXI.Text('快速恢复', {
      fontSize: 16,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    methodTitle.anchor.set(0.5, 0);
    methodTitle.position.set(W / 2, py + 162);
    this._content.addChild(methodTitle);

    // ---- 钻石购买按钮 ----
    const btnW = 200;
    const btnH = 56;
    const btnY = py + 196;

    this._buyBtn = this._makeButton(
      ' 钻石购买',
      '',
      0xAB47BC,
      px + (PANEL_W / 2 - btnW) / 2,
      btnY,
      btnW,
      btnH,
    );
    this._buyLabel = this._buyBtn.getChildByName('subLabel') as PIXI.Text;
    this._buyBtn.on('pointerdown', () => this._onBuyStamina());
    this._content.addChild(this._buyBtn);

    // ---- 看广告按钮 ----
    this._adBtn = this._makeButton(
      ' 看广告',
      '',
      0x43A047,
      px + PANEL_W / 2 + (PANEL_W / 2 - btnW) / 2,
      btnY,
      btnW,
      btnH,
    );
    this._adLabel = this._adBtn.getChildByName('subLabel') as PIXI.Text;
    this._adBtn.on('pointerdown', () => this._onAdStamina());
    this._content.addChild(this._adBtn);

    // 关闭按钮
    const closeBtn = new PIXI.Container();
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';

    const closeBg = new PIXI.Graphics();
    closeBg.beginFill(COLORS.BUTTON_SECONDARY);
    closeBg.drawRoundedRect(0, 0, 160, 44, 12);
    closeBg.endFill();
    closeBtn.addChild(closeBg);

    const closeTxt = new PIXI.Text('稍后再说', {
      fontSize: 16,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    closeTxt.anchor.set(0.5, 0.5);
    closeTxt.position.set(80, 22);
    closeBtn.addChild(closeTxt);

    closeBtn.position.set(W / 2 - 80, py + PANEL_H - 66);
    closeBtn.on('pointerdown', () => this.close());
    this._content.addChild(closeBtn);

    this.addChild(this._content);
  }

  /** 创建按钮 */
  private _makeButton(
    mainLabel: string,
    subLabel: string,
    color: number,
    x: number, y: number,
    w: number, h: number,
  ): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.position.set(x, y);

    const bg = new PIXI.Graphics();
    bg.beginFill(color);
    bg.drawRoundedRect(0, 0, w, h, 14);
    bg.endFill();
    c.addChild(bg);

    const main = new PIXI.Text(mainLabel, {
      fontSize: 16,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    main.anchor.set(0.5, 0.5);
    main.position.set(w / 2, h / 2 - 8);
    c.addChild(main);

    const sub = new PIXI.Text(subLabel, {
      fontSize: 11,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
    });
    sub.alpha = 0.85;
    sub.anchor.set(0.5, 0.5);
    sub.position.set(w / 2, h / 2 + 14);
    sub.name = 'subLabel';
    c.addChild(sub);

    return c;
  }

  /** 刷新按钮状态 */
  private _refresh(neededStamina?: number): void {
    const s = CurrencyManager.state;
    const cap = CurrencyManager.staminaCap;
    this._staminaText.text = ` ${s.stamina} / ${cap}`;

    // 钻石购买
    const buyRemain = CurrencyManager.staminaBuyRemaining;
    const buyPrice = CurrencyManager.staminaBuyPrice;
    const buyAmount = CurrencyManager.staminaBuyAmount;
    if (buyRemain > 0) {
      this._buyLabel.text = `+${buyAmount}  花费${buyPrice}  (${buyRemain}次)`;
      this._buyBtn.alpha = s.diamond >= buyPrice ? 1 : 0.5;
    } else {
      this._buyLabel.text = '今日已达上限';
      this._buyBtn.alpha = 0.4;
    }

    // 广告
    const adRemain = CurrencyManager.staminaAdRemaining;
    const adAmount = CurrencyManager.staminaAdAmount;
    if (adRemain > 0) {
      this._adLabel.text = `+${adAmount}  免费  (${adRemain}次)`;
      this._adBtn.alpha = 1;
    } else {
      this._adLabel.text = '今日已达上限';
      this._adBtn.alpha = 0.4;
    }

    this.updateTimer();
  }

  /** 钻石购买体力 */
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

  /** 看广告恢复体力 */
  private _onAdStamina(): void {
    if (CurrencyManager.staminaAdRemaining <= 0) {
      ToastMessage.show('今日广告次数已用完');
      return;
    }

    // 通过 AdManager 展示激励视频广告
    AdManager.showRewardedAd(AdScene.STAMINA_RECOVER, (success) => {
      if (success) {
        const ok = CurrencyManager.recoverStaminaByAd();
        if (ok) {
          ToastMessage.show(`广告奖励：+${CurrencyManager.staminaAdAmount}`);
          this._refresh();
        }
      } else {
        ToastMessage.show('广告未完成，无法获得奖励');
      }
    });
  }
}
