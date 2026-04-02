/**
 * 升级弹窗 —— 红横幅 + 花蛋奖励条底图；礼包内货币与收纳物品同一流式横排（可换行）+ 数量，无内文说明。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import { RewardFlyCoordinator, type RewardFlyItem } from '@/core/RewardFlyCoordinator';

export interface LevelUpRewardPayload {
  huayuan: number;
  stamina: number;
  diamond: number;
  /** 收纳盒物品（展示 + 关闭时飞入礼包后再发放） */
  rewardBoxItems?: Array<{ itemId: string; count: number }>;
}

export interface LevelUpPopupShowOptions {
  /** 左下礼包按钮中心（全局坐标），用于飞入动画 */
  rewardFlyTargetGlobal?: PIXI.Point;
  /** 飞入结束（或无动画）后写入收纳盒 */
  onGrantRewardBoxItems?: (entries: Array<{ itemId: string; count: number }>) => void;
  /** 仅预览礼包，关闭时不写入收纳盒、不播放飞入 */
  previewOnly?: boolean;
  /** 顶栏标题；默认「恭喜升至 N 星」 */
  bannerTitle?: string;
  /** 淡出并从舞台移除完毕后回调（用于衔接后续弹窗，如花店「获得新家具」） */
  onFullyClosed?: () => void;
}

export class LevelUpPopup extends PIXI.Container {
  private _dismissing = false;
  private _previewOnly = false;
  private _pendingBoxItems: Array<{ itemId: string; count: number }> = [];
  private _flySources: Array<{ x: number; y: number; texKey: string; count: number }> = [];
  private _rewardFlyTargetGlobal: PIXI.Point | null = null;
  private _onGrantRewardBoxItems: LevelUpPopupShowOptions['onGrantRewardBoxItems'];
  private _onFullyClosed: LevelUpPopupShowOptions['onFullyClosed'];
  /** 弹窗展示用（与已入账数值一致；确定后用于飞入顶栏特效） */
  private _showHuayuan = 0;
  private _showStamina = 0;
  private _showDiamond = 0;

  constructor() {
    super();
    this.zIndex = 8000;
    this.visible = false;
  }

  show(
    level: number,
    reward: LevelUpRewardPayload & { gold?: number },
    options?: LevelUpPopupShowOptions,
  ): void {
    this.visible = true;
    this._dismissing = false;
    this._previewOnly = options?.previewOnly ?? false;
    this.removeChildren();
    this._pendingBoxItems = this._previewOnly ? [] : [...(reward.rewardBoxItems ?? [])];
    this._flySources = [];
    this._rewardFlyTargetGlobal = options?.rewardFlyTargetGlobal ?? null;
    this._onGrantRewardBoxItems = options?.onGrantRewardBoxItems;
    this._onFullyClosed = options?.onFullyClosed;

    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;
    const cx = W / 2;

    const huayuan = reward.huayuan > 0 ? reward.huayuan : (reward.gold ?? 0);
    const stamina = reward.stamina ?? 0;
    const diamond = reward.diamond ?? 0;
    const rewardBoxItems = reward.rewardBoxItems ?? [];
    this._showHuayuan = huayuan;
    this._showStamina = stamina;
    this._showDiamond = diamond;

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.52);
    mask.drawRect(0, 0, W, H);
    mask.endFill();
    mask.eventMode = 'static';
    mask.cursor = 'pointer';
    mask.on('pointertap', () => this._dismiss());
    this.addChild(mask);

    let curY = H * 0.155;
    const bannerTitle = options?.bannerTitle ?? `恭喜升至 ${level}星`;
    curY = this._drawTitleBanner(this, cx, curY, bannerTitle);

    curY += 16;

    const barW = Math.min(520, W - 36);
    const rewardTex = TextureCache.get('flower_egg_reward_bg');

    type RewardEntry = { texKey: string; amount: number; flyToBox: boolean };
    const entries: RewardEntry[] = [];
    if (huayuan > 0) entries.push({ texKey: 'icon_huayuan', amount: huayuan, flyToBox: false });
    if (stamina > 0) entries.push({ texKey: 'icon_energy', amount: stamina, flyToBox: false });
    if (diamond > 0) entries.push({ texKey: 'icon_gem', amount: diamond, flyToBox: false });
    for (const { itemId, count } of rewardBoxItems) {
      const def = ITEM_DEFS.get(itemId);
      entries.push({ texKey: def?.icon ?? itemId, amount: count, flyToBox: true });
    }

    const PAD_X = 28;
    const PAD_TOP = 22;
    const PAD_BOT = 28;
    const CELL = 56;
    const HGAP = 12;
    const VGAP = 10;

    const innerLeft = cx - barW / 2 + PAD_X;
    const innerRight = cx + barW / 2 - PAD_X;

    const barTop = curY;

    let x = innerLeft;
    let rowTop = barTop + PAD_TOP;
    let rowH = 0;
    type Placement = { cx: number; ty: number; e: RewardEntry };
    const placements: Placement[] = [];

    for (const e of entries) {
      if (x + CELL > innerRight && x > innerLeft + 0.5) {
        rowTop += rowH + VGAP;
        x = innerLeft;
        rowH = 0;
      }
      const cxCell = x + CELL / 2;
      placements.push({ cx: cxCell, ty: rowTop, e });
      if (e.flyToBox) {
        this._flySources.push({ x: cxCell, y: rowTop + CELL / 2, texKey: e.texKey, count: e.amount });
      }
      rowH = Math.max(rowH, CELL + 36);
      x += CELL + HGAP;
    }

    let barH: number;
    if (entries.length === 0) {
      barH = rewardTex ? Math.round((barW * rewardTex.height) / rewardTex.width) : 120;
      barH = Math.max(120, Math.min(228, barH));
    } else {
      const contentBottom = rowTop + rowH;
      barH = contentBottom - barTop + PAD_BOT;
      if (rewardTex) {
        const texH = Math.round((barW * rewardTex.height) / rewardTex.width);
        barH = Math.max(barH, Math.max(160, Math.min(260, texH)));
      } else {
        barH = Math.max(barH, 140);
      }
    }

    if (rewardTex) {
      const barSp = new PIXI.Sprite(rewardTex);
      barSp.anchor.set(0.5, 0);
      barSp.position.set(cx, barTop);
      barSp.width = barW;
      barSp.height = barH;
      this.addChild(barSp);
    } else {
      const g = new PIXI.Graphics();
      g.beginFill(0xe8f5e9, 0.92);
      g.drawRoundedRect(cx - barW / 2, barTop, barW, barH, 18);
      g.endFill();
      g.lineStyle(2, 0x81c784, 0.65);
      g.drawRoundedRect(cx - barW / 2, barTop, barW, barH, 18);
      this.addChild(g);
    }

    for (const p of placements) {
      this._drawFramedRewardCell(this, p.cx, p.ty, CELL, p.e.texKey, p.e.amount);
    }

    curY = barTop + barH + 22;

    const btnTex = TextureCache.get('deco_card_btn_4');
    let btnW = 200;
    let btnH = 50;
    const btnY = curY;
    if (btnTex) {
      btnH = Math.round((btnW * btnTex.height) / btnTex.width);
      btnH = Math.max(46, Math.min(72, btnH));
      const btnSp = new PIXI.Sprite(btnTex);
      btnSp.anchor.set(0.5, 0.5);
      btnSp.position.set(cx, btnY + btnH / 2);
      btnSp.width = btnW;
      btnSp.height = btnH;
      this.addChild(btnSp);

      const btnLabel = new PIXI.Text(this._previewOnly ? '知道了' : '确定', {
        fontSize: 21,
        fill: 0xffffff,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0x3e0a0a,
        strokeThickness: 3.2,
      });
      btnLabel.anchor.set(0.5, 0.5);
      btnLabel.position.set(cx, btnY + btnH / 2);
      this.addChild(btnLabel);

      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Rectangle(cx - btnW / 2, btnY, btnW, btnH);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointerdown', () => this._dismiss());
      this.addChild(hit);
    } else {
      const btn = new PIXI.Graphics();
      btn.beginFill(0xe53935);
      btn.drawRoundedRect(cx - btnW / 2, btnY, btnW, btnH, btnH / 2);
      btn.endFill();
      this.addChild(btn);
      const btnLabel = new PIXI.Text(this._previewOnly ? '知道了' : '确定', {
        fontSize: 20,
        fill: 0xffffff,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      btnLabel.anchor.set(0.5, 0.5);
      btnLabel.position.set(cx, btnY + btnH / 2);
      this.addChild(btnLabel);
      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Rectangle(cx - btnW / 2, btnY, btnW, btnH);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointerdown', () => this._dismiss());
      this.addChild(hit);
    }

    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.35, ease: Ease.easeOutQuad });
  }

  /** 与首次解锁、装修顶栏同款红丝带 + 白字 */
  private _drawTitleBanner(container: PIXI.Container, cx: number, y: number, title: string): number {
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
      ribbon.beginFill(0xfff0d4, 0.95);
      ribbon.lineStyle(2, 0xd4a054, 0.8);
      ribbon.drawRoundedRect(cx - BW / 2, y, BW, BH, BH / 2);
      ribbon.endFill();
      container.addChild(ribbon);
      onRedRibbon = false;
    }

    const titleText = new PIXI.Text(title, onRedRibbon
      ? {
          fontSize: 24,
          fill: 0xffffff,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
          stroke: 0x4e2018,
          strokeThickness: 3,
        }
      : {
          fontSize: 20,
          fill: 0xc97b3a,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
        });
    titleText.anchor.set(0.5, 0.5);
    titleText.position.set(cx, y + BH / 2);
    container.addChild(titleText);

    return y + BH;
  }

  /** 与 FlowerEasterEggSystem 奖励格一致：双描边 + 透明心 */
  private _drawFramedRewardCell(
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
    const icy = topY + cellSize / 2;
    const tex = TextureCache.get(textureKey);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const sc = iconMax / Math.max(tex.width, tex.height);
      sp.scale.set(sc);
      sp.position.set(centerX, icy);
      parent.addChild(sp);
    } else {
      const fb = new PIXI.Graphics();
      fb.beginFill(0x888888);
      fb.drawCircle(centerX, icy, iconMax / 2);
      fb.endFill();
      parent.addChild(fb);
    }

    const amtText = new PIXI.Text(`×${amount}`, {
      fontSize: cellSize >= 70 ? 26 : 23,
      fill: 0x0f2414,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xf5fff8,
      strokeThickness: 3.2,
    });
    amtText.anchor.set(0.5, 0);
    amtText.position.set(centerX, topY + cellSize + 8);
    parent.addChild(amtText);
  }

  private _dismiss(): void {
    if (this._dismissing) return;
    this._dismissing = true;

    const pending = this._pendingBoxItems;
    const preview = this._previewOnly;

    const finishClose = (): void => {
      this._fadeOutAndClose();
    };

    const grantBoxIfNeeded = (): void => {
      if (pending.length > 0 && !preview) {
        this._onGrantRewardBoxItems?.(pending);
      }
    };

    /** 收纳盒物品飞入目标点后再入库 */
    const tryBoxFly = (after: () => void): void => {
      if (
        !preview &&
        pending.length > 0 &&
        this._flySources.length > 0 &&
        this._rewardFlyTargetGlobal !== null &&
        this.parent
      ) {
        this._setPopupInteractive(false);
        this._playRewardFlyToBox(() => {
          grantBoxIfNeeded();
          after();
        });
      } else {
        grantBoxIfNeeded();
        after();
      }
    };

    const currencyItems: RewardFlyItem[] = [];
    if (!preview) {
      if (this._showHuayuan > 0) {
        currencyItems.push({ type: 'huayuan', textureKey: 'icon_huayuan', amount: this._showHuayuan });
      }
      if (this._showStamina > 0) {
        currencyItems.push({ type: 'stamina', textureKey: 'icon_energy', amount: this._showStamina });
      }
      if (this._showDiamond > 0) {
        currencyItems.push({ type: 'diamond', textureKey: 'icon_gem', amount: this._showDiamond });
      }
    }

    const startGlobal = this.toGlobal(new PIXI.Point(DESIGN_WIDTH / 2, Game.logicHeight * 0.36));

    if (currencyItems.length > 0) {
      this._setPopupInteractive(false);
      RewardFlyCoordinator.playBatch(currencyItems, startGlobal, () => {
        tryBoxFly(finishClose);
      });
    } else {
      tryBoxFly(finishClose);
    }
  }

  private _setPopupInteractive(active: boolean): void {
    const mode: PIXI.EventMode = active ? 'static' : 'none';
    for (const c of this.children) {
      if ('eventMode' in c) (c as PIXI.Container).eventMode = mode;
    }
  }

  private _fadeOutAndClose(): void {
    TweenManager.cancelTarget(this);
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.28,
      ease: Ease.easeInQuad,
      onComplete: () => {
        const closedCb = this._onFullyClosed;
        this.visible = false;
        this.removeChildren();
        this._dismissing = false;
        this._previewOnly = false;
        this._pendingBoxItems = [];
        this._flySources = [];
        this._rewardFlyTargetGlobal = null;
        this._onGrantRewardBoxItems = undefined;
        this._onFullyClosed = undefined;
        this._showHuayuan = 0;
        this._showStamina = 0;
        this._showDiamond = 0;
        closedCb?.();
      },
    });
  }

  /** 从收纳奖励格飞向左下礼包 */
  private _playRewardFlyToBox(onArrived: () => void): void {
    const parent = this.parent!;
    const endGlobal = this._rewardFlyTargetGlobal!;
    const endLocal = parent.toLocal(endGlobal);

    const flyLayer = new PIXI.Container();
    flyLayer.zIndex = 9500;
    parent.addChild(flyLayer);
    if ('sortableChildren' in parent) {
      (parent as PIXI.Container).sortableChildren = true;
      parent.sortChildren();
    }

    let remaining = this._flySources.length;
    const doneOne = (): void => {
      remaining--;
      if (remaining <= 0) {
        parent.removeChild(flyLayer);
        flyLayer.destroy({ children: true });
        onArrived();
      }
    };

    const baseIcon = 40;

    for (let i = 0; i < this._flySources.length; i++) {
      const src = this._flySources[i];
      const startGlobal = this.toGlobal(new PIXI.Point(src.x, src.y));
      const startLocal = parent.toLocal(startGlobal);

      const holder = new PIXI.Container();
      holder.position.set(startLocal.x, startLocal.y);
      flyLayer.addChild(holder);

      const tex = TextureCache.get(src.texKey);
      if (tex && tex.width > 0 && tex.height > 0) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const k = baseIcon / Math.max(tex.width, tex.height);
        sp.scale.set(k);
        holder.addChild(sp);
      } else {
        const g = new PIXI.Graphics();
        g.beginFill(0x8d9b88);
        g.drawCircle(0, 0, baseIcon * 0.42);
        g.endFill();
        holder.addChild(g);
      }

      const o = { x: startLocal.x, y: startLocal.y, s: 1 };
      TweenManager.to({
        target: o,
        props: { x: endLocal.x, y: endLocal.y, s: 0.3 },
        duration: 0.52,
        delay: i * 0.075,
        ease: Ease.easeInQuad,
        onUpdate: () => {
          holder.position.set(o.x, o.y);
          holder.scale.set(o.s);
        },
        onComplete: () => {
          holder.destroy({ children: true });
          doneOne();
        },
      });
    }
  }
}
