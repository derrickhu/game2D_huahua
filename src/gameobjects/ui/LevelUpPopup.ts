/**
 * 升级弹窗 —— 视觉与首次解锁弹窗一致：红横幅 + 花蛋奖励条底图 + 描边透明格展示奖励 + deco 红按钮。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';

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
}

export class LevelUpPopup extends PIXI.Container {
  private _dismissing = false;
  private _pendingBoxItems: Array<{ itemId: string; count: number }> = [];
  private _flySources: Array<{ x: number; y: number; texKey: string; count: number }> = [];
  private _rewardFlyTargetGlobal: PIXI.Point | null = null;
  private _onGrantRewardBoxItems: LevelUpPopupShowOptions['onGrantRewardBoxItems'];

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
    this.removeChildren();
    this._pendingBoxItems = [...(reward.rewardBoxItems ?? [])];
    this._flySources = [];
    this._rewardFlyTargetGlobal = options?.rewardFlyTargetGlobal ?? null;
    this._onGrantRewardBoxItems = options?.onGrantRewardBoxItems;

    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;
    const cx = W / 2;

    const huayuan = reward.huayuan > 0 ? reward.huayuan : (reward.gold ?? 0);
    const stamina = reward.stamina ?? 0;
    const diamond = reward.diamond ?? 0;
    const rewardBoxItems = reward.rewardBoxItems ?? [];

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.52);
    mask.drawRect(0, 0, W, H);
    mask.endFill();
    mask.eventMode = 'static';
    this.addChild(mask);

    let curY = H * 0.155;
    curY = this._drawTitleBanner(this, cx, curY, `升级 Lv.${level}`);

    curY += 16;

    const barW = Math.min(520, W - 36);
    const rewardTex = TextureCache.get('flower_egg_reward_bg');

    type RowItem = { texKey: string; amount: number };
    const rowItems: RowItem[] = [];
    if (huayuan > 0) rowItems.push({ texKey: 'icon_huayuan', amount: huayuan });
    if (stamina > 0) rowItems.push({ texKey: 'icon_energy', amount: stamina });
    if (diamond > 0) rowItems.push({ texKey: 'icon_gem', amount: diamond });

    const n = rowItems.length;
    const CELL = n >= 3 ? 54 : 68;
    const GAP = n >= 3 ? 16 : 26;
    const BOX_CELL = 56;
    const BOX_GAP = 18;
    const boxCount = rewardBoxItems.length;

    let barH = 150;
    if (rewardTex) {
      barH = Math.round((barW * rewardTex.height) / rewardTex.width);
      barH = Math.max(188, Math.min(228, barH));
    } else {
      barH = 172;
    }
    const innerMin =
      30 + 36 + (n > 0 ? CELL + 36 : 0) +
      (boxCount > 0 ? 22 + BOX_CELL + 36 : 0) + 16;
    barH = Math.max(barH, innerMin);

    const barTop = curY;
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

    const labelText = new PIXI.Text('升级奖励', {
      fontSize: 23,
      fill: 0x0f2414,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfffef8,
      strokeThickness: 4,
    });
    labelText.anchor.set(0.5, 0);
    labelText.position.set(cx, barTop + 30);
    this.addChild(labelText);

    const cellTop = barTop + 66;
    if (n > 0) {
      const rowW = n * CELL + Math.max(0, n - 1) * GAP;
      const rowLeft = cx - rowW / 2;
      for (let i = 0; i < n; i++) {
        const cellCx = rowLeft + CELL / 2 + i * (CELL + GAP);
        this._drawFramedRewardCell(this, cellCx, cellTop, CELL, rowItems[i].texKey, rowItems[i].amount);
      }
    }

    if (boxCount > 0) {
      const afterCurrencyY = cellTop + (n > 0 ? CELL + 36 : 0) + 8;
      const hint = new PIXI.Text('确定后将飞入奖励收纳盒', {
        fontSize: 17,
        fill: 0x2e4a38,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0xfffef8,
        strokeThickness: 2.5,
      });
      hint.anchor.set(0.5, 0);
      hint.position.set(cx, afterCurrencyY);
      this.addChild(hint);

      const boxRowTop = afterCurrencyY + 22;
      const boxRowW = boxCount * BOX_CELL + Math.max(0, boxCount - 1) * BOX_GAP;
      const boxLeft = cx - boxRowW / 2;
      for (let i = 0; i < boxCount; i++) {
        const { itemId, count } = rewardBoxItems[i];
        const def = ITEM_DEFS.get(itemId);
        const texKey = def?.icon ?? itemId;
        const cellCx = boxLeft + BOX_CELL / 2 + i * (BOX_CELL + BOX_GAP);
        this._drawFramedRewardCell(this, cellCx, boxRowTop, BOX_CELL, texKey, count);
        const iconY = boxRowTop + BOX_CELL / 2;
        this._flySources.push({ x: cellCx, y: iconY, texKey, count });
      }
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

      const btnLabel = new PIXI.Text('确定', {
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
      const btnLabel = new PIXI.Text('确定', {
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
    const hasFly =
      pending.length > 0 &&
      this._flySources.length > 0 &&
      this._rewardFlyTargetGlobal !== null &&
      this.parent;

    if (hasFly) {
      this._setPopupInteractive(false);
      this._playRewardFlyToBox(() => {
        this._onGrantRewardBoxItems?.(pending);
        this._fadeOutAndClose();
      });
      return;
    }

    if (pending.length > 0) {
      this._onGrantRewardBoxItems?.(pending);
    }
    this._fadeOutAndClose();
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
        this.visible = false;
        this.removeChildren();
        this._dismissing = false;
        this._pendingBoxItems = [];
        this._flySources = [];
        this._rewardFlyTargetGlobal = null;
        this._onGrantRewardBoxItems = undefined;
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
