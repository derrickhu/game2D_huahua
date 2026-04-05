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
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
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
/** 无场景图时回退用圆角壳 */
const FALLBACK_CORNER_R = 26;

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
    this._bg.beginFill(0x000000, 0.58);
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

    const topBand = Game.safeTop + 64;
    const bottomReserve = 96;
    const maxArtW = W - 16;
    const maxArtH = Math.max(220, H - topBand - bottomReserve);
    const artCenterY = topBand + maxArtH * 0.5;

    const bgTex = TextureCache.get('flower_sign_gacha_bg_nb2');
    const npcTex = TextureCache.get('flower_sign_gacha_npc_nb2');
    const fullTex = TextureCache.get('flower_sign_gacha_scene_nb2');

    type ArtMode = 'layered' | 'full' | 'none';
    let artMode: ArtMode = 'none';
    if (bgTex && bgTex.width > 2 && npcTex && npcTex.width > 2) {
      artMode = 'layered';
      const artRoot = new PIXI.Container();
      artRoot.position.set(W / 2, artCenterY);
      artRoot.eventMode = 'none';
      const tw = bgTex.width;
      const th = bgTex.height;
      const scale = Math.min(maxArtW / tw, maxArtH / th);
      const bgSp = new PIXI.Sprite(bgTex);
      bgSp.anchor.set(0.5);
      bgSp.scale.set(scale);
      artRoot.addChild(bgSp);
      const npcSp = new PIXI.Sprite(npcTex);
      npcSp.anchor.set(0.5);
      npcSp.scale.set(scale);
      artRoot.addChild(npcSp);
      this._panelRoot.addChild(artRoot);
    } else if (fullTex && fullTex.width > 2) {
      artMode = 'full';
      const tw = fullTex.width;
      const th = fullTex.height;
      const scale = Math.min(maxArtW / tw, maxArtH / th);
      const sp = new PIXI.Sprite(fullTex);
      sp.anchor.set(0.5);
      sp.scale.set(scale);
      sp.position.set(W / 2, artCenterY);
      sp.eventMode = 'none';
      this._panelRoot.addChild(sp);
    } else {
      const shell = new PIXI.Graphics();
      shell.beginFill(0xfff7f0, 0.98);
      shell.drawRoundedRect(px, py, pw, ph, FALLBACK_CORNER_R);
      shell.endFill();
      shell.lineStyle(2.5, 0xd4a574, 0.75);
      shell.drawRoundedRect(px, py, pw, ph, FALLBACK_CORNER_R);
      this._panelRoot.addChild(shell);
    }

    const immersive = artMode === 'layered' || artMode === 'full';
    const closeX = immersive ? W - 36 : px + pw - 20;
    const closeY = immersive ? Game.safeTop + 22 : py + 20;

    if (artMode === 'none') {
      const titleY = py + 16;
      const subY = py + 52;
      const ticketY = py + 86;

      const title = new PIXI.Text('许愿喷泉', {
        fontSize: 28,
        fill: 0x4e342e,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      title.anchor.set(0.5, 0);
      title.position.set(W / 2, titleY);
      this._panelRoot.addChild(title);

      const sub = new PIXI.Text('消耗许愿券祈愿，奖励进入收纳盒', {
        fontSize: 13,
        fill: 0x6d4c41,
        fontFamily: FONT_FAMILY,
      });
      sub.anchor.set(0.5, 0);
      sub.position.set(W / 2, subY);
      this._panelRoot.addChild(sub);

      const ticketRow = new PIXI.Container();
      ticketRow.position.set(W / 2, ticketY);
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
    } else if (artMode === 'layered') {
      this._buildGachaRibbonHeader(W);
    } else {
      this._buildFullSceneTitleOverArt(W);
    }

    const closeBtn = new PIXI.Container();
    closeBtn.position.set(closeX, closeY);
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

    this._idleLayer = new PIXI.Container();
    this._panelRoot.addChild(this._idleLayer);

    this._resultLayer = new PIXI.Container();
    this._resultLayer.visible = false;
    this._resultLayer.position.set(0, immersive ? Game.safeTop + 88 : py + 100);
    this._panelRoot.addChild(this._resultLayer);

    this._buildIdleContent(W, H, immersive, immersive ? 0 : py + 118, ph - 130);
  }

  /**
   * 分层场景：装修同款红彩带标题 + 副标题 + 许愿券（人物/场景为透明底叠层 PNG）
   */
  private _buildGachaRibbonHeader(W: number): void {
    const cx = W / 2;
    let y = Game.safeTop + 28;
    const decoRibbon = TextureCache.get('deco_panel_title_ribbon');
    let titleCenterY = y + 22;
    let onRedRibbon = false;

    if (decoRibbon && decoRibbon.width > 2) {
      const BW = 440;
      let BH = Math.round((BW * decoRibbon.height) / decoRibbon.width);
      BH = Math.max(52, Math.min(86, BH));
      const sp = new PIXI.Sprite(decoRibbon);
      sp.anchor.set(0.5, 0.5);
      sp.position.set(cx, y + BH / 2);
      sp.width = BW;
      sp.height = BH;
      this._panelRoot.addChild(sp);
      titleCenterY = y + BH / 2;
      y += BH + 10;
      onRedRibbon = true;
    } else {
      const title = new PIXI.Text('许愿喷泉', {
        fontSize: 28,
        fill: 0x4e342e,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      title.anchor.set(0.5, 0);
      title.position.set(cx, y);
      this._panelRoot.addChild(title);
      y += title.height + 10;
    }

    if (onRedRibbon) {
      const titleOnRibbon = new PIXI.Text('许愿喷泉', {
        fontSize: 24,
        fill: 0xffffff,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0x4e2018,
        strokeThickness: 3,
      });
      titleOnRibbon.anchor.set(0.5, 0.5);
      titleOnRibbon.position.set(cx, titleCenterY);
      this._panelRoot.addChild(titleOnRibbon);
    }

    const sub = new PIXI.Text('消耗许愿券祈愿，奖励进入收纳盒', {
      fontSize: 13,
      fill: 0xfff8f0,
      fontFamily: FONT_FAMILY,
      stroke: 0x3e2723,
      strokeThickness: 2,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.35,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    sub.anchor.set(0.5, 0);
    sub.position.set(cx, y);
    this._panelRoot.addChild(sub);
    y += sub.height + 12;

    const ticketRow = new PIXI.Container();
    ticketRow.position.set(cx, y);
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
      fill: 0xfff8f0,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x3e2723,
      strokeThickness: 2,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.35,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    this._ticketText.anchor.set(0, 0.5);
    this._ticketText.position.set(8, 0);
    ticketRow.addChild(this._ticketText);
    this._panelRoot.addChild(ticketRow);
    this._syncTicketLabel();
  }

  /** 单张全幅场景：底图自带花簇标题位时仅叠字（回退用） */
  private _buildFullSceneTitleOverArt(W: number): void {
    const header = new PIXI.Container();
    header.eventMode = 'none';
    header.position.set(W / 2, Game.safeTop + 78);

    const titleInArt = new PIXI.Text('许愿喷泉', {
      fontSize: 28,
      fill: 0xfffbef,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x5d3a2a,
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: 0x2a1810,
      dropShadowAlpha: 0.45,
      dropShadowBlur: 3,
      dropShadowDistance: 1,
    });
    titleInArt.anchor.set(0.5, 0);
    titleInArt.position.set(0, 0);
    header.addChild(titleInArt);
    let belowRibbon = titleInArt.height + 10;

    const sub = new PIXI.Text('消耗许愿券祈愿，奖励进入收纳盒', {
      fontSize: 13,
      fill: 0xfff8f0,
      fontFamily: FONT_FAMILY,
      stroke: 0x3e2723,
      strokeThickness: 2,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.35,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    sub.anchor.set(0.5, 0);
    sub.position.set(0, belowRibbon);
    header.addChild(sub);
    belowRibbon += sub.height + 12;

    const ticketRow = new PIXI.Container();
    ticketRow.position.set(0, belowRibbon);
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
      fill: 0xfff8f0,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x3e2723,
      strokeThickness: 2,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.35,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    this._ticketText.anchor.set(0, 0.5);
    this._ticketText.position.set(8, 0);
    ticketRow.addChild(this._ticketText);
    header.addChild(ticketRow);

    this._panelRoot.addChild(header);
    this._syncTicketLabel();
  }

  private _syncTicketLabel(): void {
    this._ticketText.text = `许愿券：${FlowerSignTicketManager.count}`;
  }

  private _buildIdleContent(
    W: number,
    H: number,
    immersiveArt: boolean,
    idleLayerY: number,
    innerH: number,
  ): void {
    this._idleLayer.removeChildren();
    this._idleLayer.position.set(0, idleLayerY);

    let hintY: number;
    let btnRowY: number;
    if (immersiveArt) {
      /** 上移到画内喷泉石基一带（相对原 H-178 再上移约 70px） */
      btnRowY = H - 248 - idleLayerY;
      hintY = btnRowY - 46;
    } else {
      hintY = Math.min(innerH * 0.4, 228);
      btnRowY = hintY + 120;
    }
    const hint = new PIXI.Text('心诚则灵，愿望会开花 ✿', {
      fontSize: 15,
      fill: 0xfff5eb,
      fontFamily: FONT_FAMILY,
      stroke: 0x4e342e,
      strokeThickness: 2,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.4,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    hint.anchor.set(0.5, 0.5);
    hint.position.set(W / 2, hintY);
    this._idleLayer.addChild(hint);

    if (!immersiveArt) {
      const btnY = hintY + 120;
      this._idleLayer.addChild(
        this._makeStackedGreenBtns(W, btnY, () => this._doDraw('single'), () => this._doDraw('multi')),
      );
    } else {
      const row = new PIXI.Container();
      row.position.set(W / 2, btnRowY);
      const gap = 14;
      const maxBtnW = 160;
      const b1 = this._makeDecoWishBtn(
        '许愿一次',
        FLOWER_SIGN_DRAW_COST_SINGLE,
        maxBtnW,
        immersiveArt,
        () => this._doDraw('single'),
      );
      const b2 = this._makeDecoWishBtn(
        '许愿十次',
        FLOWER_SIGN_DRAW_COST_MULTI,
        maxBtnW,
        immersiveArt,
        () => this._doDraw('multi'),
      );
      const hw = maxBtnW + gap;
      b1.position.set(-hw / 2, 0);
      b2.position.set(hw / 2, 0);
      row.addChild(b1, b2);
      this._idleLayer.addChild(row);
    }
  }

  /** 参考占卜页：横向双 pill + 文案在上、券标在按钮内 */
  private _makeDecoWishBtn(
    titleAbove: string,
    cost: number,
    maxBtnW: number,
    fullScene: boolean,
    onTap: () => void,
  ): PIXI.Container {
    const root = new PIXI.Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';

    const btnTex = TextureCache.get('deco_card_btn_1');
    let hitW = maxBtnW;
    let hitH = 48;
    let sp: PIXI.Sprite | null = null;

    if (btnTex && btnTex.width > 2) {
      const s = new PIXI.Sprite(btnTex);
      s.anchor.set(0.5);
      const sc = maxBtnW / btnTex.width;
      s.scale.set(sc);
      hitW = btnTex.width * sc;
      hitH = btnTex.height * sc;
      sp = s;
      root.addChild(s);
    } else {
      const g = new PIXI.Graphics();
      g.beginFill(0x66bb6a, 0.95);
      g.drawRoundedRect(-maxBtnW / 2, -24, maxBtnW, 48, 22);
      g.endFill();
      root.addChild(g);
      hitH = 48;
    }

    const costRow = new PIXI.Container();
    const icTex = TextureCache.get('icon_flower_sign_ticket');
    if (icTex && icTex.width > 1) {
      const ic = new PIXI.Sprite(icTex);
      ic.anchor.set(1, 0.5);
      ic.height = 22;
      ic.width = (icTex.width / icTex.height) * 22;
      ic.position.set(-2, 0);
      costRow.addChild(ic);
    }
    const cx = new PIXI.Text(`×${cost}`, {
      fontSize: 17,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x3e2723,
      strokeThickness: 3,
    });
    cx.anchor.set(0, 0.5);
    cx.position.set(6, 0);
    costRow.addChild(cx);
    costRow.position.set(0, sp ? -4 : 0);
    root.addChild(costRow);

    const titleFill = fullScene ? 0xfff5eb : 0x4e342e;
    const title = new PIXI.Text(titleAbove, {
      fontSize: 15,
      fill: titleFill,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x2c1e16,
      strokeThickness: fullScene ? 3 : 2,
      dropShadow: fullScene,
      dropShadowColor: 0x000000,
      dropShadowAlpha: fullScene ? 0.45 : 0,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    title.anchor.set(0.5, 1);
    title.position.set(0, -hitH / 2 - 8);
    root.addChild(title);

    const topPad = title.height + 10;
    root.hitArea = new PIXI.Rectangle(
      -hitW / 2 - 6,
      -hitH / 2 - topPad,
      hitW + 12,
      hitH + topPad + 6,
    );
    root.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onTap();
    });
    return root;
  }

  /** 无全屏场景时维持纵向绿色双按钮 */
  private _makeStackedGreenBtns(
    W: number,
    btnY: number,
    onSingle: () => void,
    onMulti: () => void,
  ): PIXI.Container {
    const wrap = new PIXI.Container();
    const mk = (label: string, cost: number, y: number, onTap: () => void): void => {
      const c = new PIXI.Container();
      c.position.set(W / 2, y);
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
      wrap.addChild(c);
    };
    mk('许愿一次', FLOWER_SIGN_DRAW_COST_SINGLE, btnY, onSingle);
    mk('许愿十次', FLOWER_SIGN_DRAW_COST_MULTI, btnY + 58, onMulti);
    return wrap;
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
      fill: 0xffe082,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x4e342e,
      strokeThickness: 3,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.45,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
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
