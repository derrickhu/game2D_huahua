/**
 * 许愿喷泉抽奖面板 — 挂 OverlayManager，可从大地图节点打开；高于 WorldMapPanel。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { OverlayManager } from '@/core/OverlayManager';
import { TextureCache } from '@/utils/TextureCache';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import {
  FLOWER_SIGN_DRAW_COST_MULTI,
  FLOWER_SIGN_DRAW_COST_SINGLE,
} from '@/config/FlowerSignGachaConfig';
import { FlowerSignGachaManager, type FlowerSignReward } from '@/managers/FlowerSignGachaManager';
import { FlowerSignTicketManager } from '@/managers/FlowerSignTicketManager';

const Z = 11500;
const CELL = 72;
const GAP = 8;

export class FlowerSignGachaPanel extends PIXI.Container {
  private _isOpen = false;
  private _bg!: PIXI.Graphics;
  private _panelRoot!: PIXI.Container;
  private _idleLayer!: PIXI.Container;
  private _resultLayer!: PIXI.Container;
  private _ticketText!: PIXI.Text;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = Z;
    this.sortableChildren = true;
    this._build();
    EventBus.on('panel:openFlowerSignGacha', () => this.open());
    EventBus.on('flowerSignTicket:changed', () => this._syncTicketLabel());
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    OverlayManager.bringToFront();
    this.visible = true;
    this._showIdle();
    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.25, ease: Ease.easeOutQuad });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.2,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
      },
    });
  }

  private _build(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.52);
    this._bg.drawRect(0, 0, W, H);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    this._panelRoot = new PIXI.Container();
    this._panelRoot.eventMode = 'static';
    this._panelRoot.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._panelRoot);

    const pw = Math.min(560, W - 32);
    const ph = Math.min(620, H - Game.safeTop - 80);
    const px = (W - pw) / 2;
    const py = Game.safeTop + 56 + (H - Game.safeTop - 56 - ph) / 2;

    const shell = new PIXI.Graphics();
    shell.beginFill(0xfff7f0, 0.98);
    shell.drawRoundedRect(px, py, pw, ph, 22);
    shell.endFill();
    shell.lineStyle(2.5, 0xd4a574, 0.75);
    shell.drawRoundedRect(px, py, pw, ph, 22);
    this._panelRoot.addChild(shell);

    const title = new PIXI.Text('许愿喷泉', {
      fontSize: 28,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(W / 2, py + 16);
    this._panelRoot.addChild(title);

    const sub = new PIXI.Text('消耗许愿券祈愿，奖励进入收纳盒', {
      fontSize: 13,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    sub.anchor.set(0.5, 0);
    sub.position.set(W / 2, py + 52);
    this._panelRoot.addChild(sub);

    const closeBtn = new PIXI.Container();
    closeBtn.position.set(px + pw - 20, py + 20);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    const cx = new PIXI.Graphics();
    cx.beginFill(0xc45c4a, 0.95);
    cx.drawCircle(0, 0, 16);
    cx.endFill();
    closeBtn.addChild(cx);
    const xtxt = new PIXI.Text('✕', { fontSize: 16, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold' });
    xtxt.anchor.set(0.5);
    closeBtn.addChild(xtxt);
    closeBtn.hitArea = new PIXI.Circle(0, 0, 22);
    closeBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._panelRoot.addChild(closeBtn);

    const ticketRow = new PIXI.Container();
    ticketRow.position.set(W / 2, py + 86);
    const tTex = TextureCache.get('icon_flower_sign_ticket');
    if (tTex?.width) {
      const tsp = new PIXI.Sprite(tTex);
      tsp.anchor.set(1, 0.5);
      tsp.height = 28;
      tsp.width = (tTex.width / tTex.height) * 28;
      tsp.position.set(-6, 0);
      ticketRow.addChild(tsp);
    }
    this._ticketText = new PIXI.Text('', {
      fontSize: 18,
      fill: 0x5d4037,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._ticketText.anchor.set(0, 0.5);
    this._ticketText.position.set(8, 0);
    ticketRow.addChild(this._ticketText);
    this._panelRoot.addChild(ticketRow);
    this._syncTicketLabel();

    this._idleLayer = new PIXI.Container();
    this._idleLayer.position.set(0, py + 118);
    this._panelRoot.addChild(this._idleLayer);

    this._resultLayer = new PIXI.Container();
    this._resultLayer.visible = false;
    this._resultLayer.position.set(0, py + 100);
    this._panelRoot.addChild(this._resultLayer);

    this._buildIdleContent(W, pw, ph - 130);
  }

  private _syncTicketLabel(): void {
    this._ticketText.text = `许愿券：${FlowerSignTicketManager.count}`;
  }

  private _buildIdleContent(W: number, pw: number, innerH: number): void {
    this._idleLayer.removeChildren();

    const cy = Math.min(innerH * 0.35, 200);
    const hint = new PIXI.Text('心诚则灵，愿望会开花 ✿', {
      fontSize: 15,
      fill: 0x8d6e63,
      fontFamily: FONT_FAMILY,
    });
    hint.anchor.set(0.5, 0.5);
    hint.position.set(W / 2, cy);
    this._idleLayer.addChild(hint);

    const btnY = cy + 120;
    const mkBtn = (label: string, cost: number, onTap: () => void): PIXI.Container => {
      const c = new PIXI.Container();
      c.position.set(W / 2, btnY);
      c.eventMode = 'static';
      c.cursor = 'pointer';
      const g = new PIXI.Graphics();
      g.beginFill(0x66bb6a, 0.95);
      g.drawRoundedRect(-130, -22, 260, 44, 22);
      g.endFill();
      c.addChild(g);
      const t = new PIXI.Text(`${label}（${cost}券）`, {
        fontSize: 17,
        fill: 0xffffff,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      t.anchor.set(0.5);
      c.addChild(t);
      c.hitArea = new PIXI.Rectangle(-130, -22, 260, 44);
      c.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        onTap();
      });
      return c;
    };

    this._idleLayer.addChild(
      mkBtn('许愿一次', FLOWER_SIGN_DRAW_COST_SINGLE, () => this._doDraw('single')),
    );
    const row2 = mkBtn('许愿十次', FLOWER_SIGN_DRAW_COST_MULTI, () => this._doDraw('multi'));
    row2.position.y = btnY + 58;
    this._idleLayer.addChild(row2);
  }

  private _doDraw(kind: 'single' | 'multi'): void {
    const res = kind === 'single' ? FlowerSignGachaManager.drawSingle() : FlowerSignGachaManager.drawMulti();
    if (!res.ok) {
      if (res.reason === 'no_ticket') ToastMessage.show('许愿券不足');
      else ToastMessage.show('奖池配置异常');
      return;
    }
    this._showResults(res.rewards);
  }

  private _showIdle(): void {
    this._idleLayer.visible = true;
    this._resultLayer.visible = false;
    this._resultLayer.removeChildren();
    this._syncTicketLabel();
  }

  private _showResults(rewards: FlowerSignReward[]): void {
    this._idleLayer.visible = false;
    this._resultLayer.visible = true;
    this._resultLayer.removeChildren();
    this._syncTicketLabel();

    const W = DESIGN_WIDTH;
    const banner = new PIXI.Text('恭喜获得', {
      fontSize: 22,
      fill: 0xe65100,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    banner.anchor.set(0.5, 0);
    banner.position.set(W / 2, 0);
    this._resultLayer.addChild(banner);

    const n = rewards.length;
    const cols = n <= 1 ? 1 : 5;
    const rows = Math.ceil(n / cols);
    const gridW = cols * CELL + (cols - 1) * GAP;
    const gridH = rows * CELL + (rows - 1) * GAP;
    const startX = W / 2 - gridW / 2;
    const startY = 44;

    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const cell = this._makeRewardCell(rewards[i]!);
      cell.position.set(startX + c * (CELL + GAP) + CELL / 2, startY + r * (CELL + GAP) + CELL / 2);
      this._resultLayer.addChild(cell);
    }

    const cont = new PIXI.Container();
    cont.position.set(W / 2, startY + gridH + 28);
    cont.eventMode = 'static';
    cont.cursor = 'pointer';
    const bg = new PIXI.Graphics();
    bg.beginFill(0xffb74d, 0.95);
    bg.drawRoundedRect(-72, -18, 144, 36, 18);
    bg.endFill();
    cont.addChild(bg);
    const tap = new PIXI.Text('继续许愿', {
      fontSize: 15,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    tap.anchor.set(0.5);
    cont.addChild(tap);
    cont.hitArea = new PIXI.Rectangle(-72, -18, 144, 36);
    cont.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._showIdle();
    });
    this._resultLayer.addChild(cont);
  }

  private _makeRewardCell(r: FlowerSignReward): PIXI.Container {
    const root = new PIXI.Container();
    const def = ITEM_DEFS.get(r.itemId);
    const texKey = def?.icon ?? '';
    const tex = TextureCache.get(texKey);
    if (tex?.width) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const sc = Math.min((CELL - 8) / tex.width, (CELL - 8) / tex.height);
      sp.scale.set(sc);
      root.addChild(sp);
    } else {
      const ph = new PIXI.Text('?', { fontSize: 28, fontFamily: FONT_FAMILY });
      ph.anchor.set(0.5);
      root.addChild(ph);
    }
    const cnt = new PIXI.Text(`×${r.count}`, {
      fontSize: 13,
      fill: 0x5d4037,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    cnt.anchor.set(0.5, 0);
    cnt.position.set(0, CELL * 0.38);
    root.addChild(cnt);
    return root;
  }
}
