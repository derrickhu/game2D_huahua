/**
 * GM 调试面板 - 游戏内 GM 工具
 *
 * 激活方式：顶栏「内购商店」与右侧系统菜单之间的空白区连点 5 次（见 TopBar 隐形热区）
 *
 * 滚动：与 DecorationPanel 一致使用 stage 级 pointermove（微信子节点 pointermove 不可靠）；
 * 列表区按下后移动超过阈值视为滑动；否则松手视为点击。
 * 另提供右侧轨道点击、滑块拖动、▲▼ 翻页。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { GMManager, GMCommand } from '@/managers/GMManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';

/** 指令按钮高度（标题一行 + 说明约两行） */
const BTN_H = 78;
const BTN_GAP = 10;
const PAD = 22;
const RIGHT_CHROME = 52;
const SCROLL_SLOP_PX = 16;
const SCROLL_PAGE_STEP = 180;

const C = {
  panelBg: 0x1a1d33,
  panelStroke: 0x3d4d73,
  headerBg: 0x232742,
  title: 0xe8ecf4,
  muted: 0x7a8699,
  group: 0x9aacbf,
  btnFill: 0x2a314f,
  btnStroke: 0x455078,
  btnText: 0xedf1f7,
  desc: 0x8a93a8,
  accent: 0x5eb8d4,
  ok: 0x6bc9a6,
  track: 0x2c3248,
  thumb: 0x5a6a8c,
  arrowBg: 0x343b55,
};

function globalToDesignY(globalY: number): number {
  return globalY / Game.scale;
}

export class GMPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _scrollContainer!: PIXI.Container;
  private _resultText!: PIXI.Text;
  private _isOpen = false;
  private _scrollY = 0;
  private _maxScrollY = 0;

  private _gmPointerActive = false;
  private _gmStartDesignY = 0;
  private _gmStartScrollY = 0;
  private _gmPendingCmd: GMCommand | null = null;
  private _gmSlopExceeded = false;

  private _sbThumb: PIXI.Graphics | null = null;
  private _sbTrack: PIXI.Graphics | null = null;
  private _sbTrackX = 0;
  private _sbTrackY = 0;
  private _sbTrackH = 0;
  private _sbThumbDrag = false;
  private _sbThumbStartScroll = 0;
  private _sbThumbStartDesignY = 0;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 9000;
    this._build();
    this._bindEvents();
  }

  private readonly _onGmStageMove = (e: PIXI.FederatedPointerEvent): void => {
    if (!this._gmPointerActive || !this._isOpen) return;
    const y = globalToDesignY(e.global.y);
    if (this._sbThumbDrag) {
      const dy = y - this._sbThumbStartDesignY;
      const range = Math.max(1, this._sbTrackH - this._thumbLength());
      const dScroll = (dy / range) * this._maxScrollY;
      this._setScrollY(this._sbThumbStartScroll + dScroll);
      return;
    }
    const dy = y - this._gmStartDesignY;
    if (Math.abs(dy) > SCROLL_SLOP_PX) this._gmSlopExceeded = true;
    if (this._gmSlopExceeded) {
      this._setScrollY(this._gmStartScrollY + (this._gmStartDesignY - y));
    }
  };

  private readonly _onGmStageUp = (e?: PIXI.FederatedPointerEvent): void => {
    if (!this._gmPointerActive) return;
    const st = Game.app.stage;
    st.off('pointermove', this._onGmStageMove);
    st.off('pointerup', this._onGmStageUp);
    st.off('pointerupoutside', this._onGmStageUp);
    st.off('pointercancel', this._onGmStageUp);
    this._gmPointerActive = false;
    const wasThumb = this._sbThumbDrag;
    this._sbThumbDrag = false;

    const endY = e ? globalToDesignY(e.global.y) : this._gmStartDesignY;
    const moved = Math.abs(endY - this._gmStartDesignY);
    const cmd = this._gmPendingCmd;
    this._gmPendingCmd = null;
    if (!wasThumb && cmd && !this._gmSlopExceeded && moved < SCROLL_SLOP_PX) {
      const result = GMManager.executeCommand(cmd.id);
      this._showResult(result);
    }
    this._gmSlopExceeded = false;
  };

  private _beginListScroll(e: PIXI.FederatedPointerEvent, pendingCmd: GMCommand | null): void {
    if (this._gmPointerActive || !this._isOpen) return;
    this._gmPointerActive = true;
    this._gmSlopExceeded = false;
    this._gmPendingCmd = pendingCmd;
    this._gmStartDesignY = globalToDesignY(e.global.y);
    this._gmStartScrollY = this._scrollY;
    const st = Game.app.stage;
    st.on('pointermove', this._onGmStageMove);
    st.on('pointerup', this._onGmStageUp);
    st.on('pointerupoutside', this._onGmStageUp);
    st.on('pointercancel', this._onGmStageUp);
  }

  private _teardownGmPointer(): void {
    if (!this._gmPointerActive) return;
    this._onGmStageUp();
  }

  private _thumbLength(): number {
    if (this._maxScrollY <= 0 || !this._sbTrackH) return this._sbTrackH;
    const minThumb = 44;
    const ratio = this._sbTrackH / (this._sbTrackH + this._maxScrollY);
    return Math.max(minThumb, Math.floor(this._sbTrackH * ratio));
  }

  private _setScrollY(y: number): void {
    this._scrollY = Math.max(0, Math.min(this._maxScrollY, y));
    if (this._scrollContainer) this._scrollContainer.y = -this._scrollY;
    this._layoutScrollbarThumb();
  }

  private _scrollBy(delta: number): void {
    this._setScrollY(this._scrollY + delta);
  }

  private _layoutScrollbarThumb(): void {
    if (!this._sbThumb || !this._sbTrack || this._maxScrollY <= 0) {
      if (this._sbThumb) this._sbThumb.visible = false;
      if (this._sbTrack) this._sbTrack.visible = false;
      return;
    }
    this._sbThumb.visible = true;
    this._sbTrack.visible = true;
    const th = this._thumbLength();
    const range = Math.max(1, this._sbTrackH - th);
    const t = this._scrollY / this._maxScrollY;
    const y0 = t * range;
    this._sbThumb.clear();
    this._sbThumb.beginFill(C.thumb, 0.95);
    const barW = 12;
    this._sbThumb.drawRoundedRect(0, y0, barW, th, 6);
    this._sbThumb.endFill();
    this._sbThumb.position.set(this._sbTrackX, this._sbTrackY);
    this._sbThumb.hitArea = new PIXI.Rectangle(0, y0, barW, th);
  }

  open(): void {
    if (!GMManager.isRuntimeAllowed) return;
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._scrollY = 0;
    this._refresh();

    this.alpha = 0;
    this._content.scale.set(0.92);
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.scale, props: { x: 1, y: 1 }, duration: 0.22, ease: Ease.easeOutBack });
  }

  close(): void {
    if (!this._isOpen) return;
    this._teardownGmPointer();
    this._isOpen = false;
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  private _bindEvents(): void {
    EventBus.on('gm:open', () => this.open());
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.55);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointerdown', () => this.close());
    this.addChild(this._bg);

    this._content = new PIXI.Container();
    this._content.pivot.set(w / 2, h / 2);
    this._content.position.set(w / 2, h / 2);
    this.addChild(this._content);
  }

  private _refresh(): void {
    this._teardownGmPointer();
    while (this._content.children.length > 0) {
      const child = this._content.children[0];
      this._content.removeChild(child);
      child.destroy({ children: true });
    }
    this._sbThumb = null;
    this._sbTrack = null;

    const cx = DESIGN_WIDTH / 2;
    const panelW = Math.min(720, DESIGN_WIDTH - 24);
    const panelH = Math.min(Game.logicHeight - 56, 900);
    const panelX = cx - panelW / 2;
    const panelY = (Game.logicHeight - panelH) / 2;

    const bg = new PIXI.Graphics();
    bg.beginFill(C.panelBg, 0.98);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.endFill();
    bg.lineStyle(2, C.panelStroke, 0.92);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.eventMode = 'static';
    bg.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._content.addChild(bg);

    const headerH = 58;
    const titleBg = new PIXI.Graphics();
    titleBg.beginFill(C.headerBg, 1);
    titleBg.drawRoundedRect(panelX, panelY, panelW, headerH, 20);
    titleBg.endFill();
    titleBg.beginFill(C.headerBg, 1);
    titleBg.drawRect(panelX, panelY + headerH - 20, panelW, 20);
    titleBg.endFill();
    this._content.addChild(titleBg);

    const title = new PIXI.Text('GM 调试', {
      fontSize: 26,
      fill: C.title,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    });
    title.anchor.set(0, 0.5);
    title.position.set(panelX + PAD, panelY + headerH / 2);
    this._content.addChild(title);

    const sub = new PIXI.Text('列表上下拖动浏览；点按钮执行；右侧 ▲▼ / 轨道 / 滑块滚动', {
      fontSize: 14,
      fill: C.muted,
      fontFamily: FONT_FAMILY,
      lineHeight: 20,
      wordWrap: true,
      wordWrapWidth: panelW - PAD * 2 - RIGHT_CHROME - 8,
    });
    sub.position.set(panelX + PAD, panelY + headerH + 6);
    this._content.addChild(sub);

    const closeBtn = new PIXI.Text('关闭', {
      fontSize: 20,
      fill: C.accent,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x1a1d33,
      strokeThickness: 3,
    });
    closeBtn.anchor.set(1, 0.5);
    closeBtn.position.set(panelX + panelW - PAD, panelY + headerH / 2);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._content.addChild(closeBtn);

    const footerH = 56;
    const scrollAreaY = panelY + headerH + 38;
    const scrollAreaH = panelH - headerH - 38 - footerH;

    this._resultText = new PIXI.Text('', {
      fontSize: 16,
      fill: C.ok,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      lineHeight: 22,
      wordWrap: true,
      wordWrapWidth: panelW - PAD * 2,
      stroke: 0x0d1118,
      strokeThickness: 2,
    });
    this._resultText.position.set(panelX + PAD, panelY + panelH - footerH + 8);
    this._content.addChild(this._resultText);

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRect(panelX, scrollAreaY, panelW - RIGHT_CHROME, scrollAreaH);
    mask.endFill();
    this._content.addChild(mask);

    this._scrollContainer = new PIXI.Container();
    this._scrollContainer.mask = mask;
    this._content.addChild(this._scrollContainer);

    const btnW = panelW - PAD * 2 - RIGHT_CHROME;
    let curY = scrollAreaY + 6;
    const groups = GMManager.groups;

    const scrollPlate = new PIXI.Container();
    scrollPlate.position.set(panelX, scrollAreaY + 6);
    scrollPlate.hitArea = new PIXI.Rectangle(0, 0, btnW, 4000);
    scrollPlate.eventMode = 'static';
    scrollPlate.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._beginListScroll(e, null);
    });
    this._scrollContainer.addChild(scrollPlate);

    for (const group of groups) {
      const groupTitle = new PIXI.Text(group, {
        fontSize: 17,
        fill: C.group,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        letterSpacing: 0.3,
      });
      groupTitle.position.set(panelX + PAD, curY);
      groupTitle.eventMode = 'none';
      this._scrollContainer.addChild(groupTitle);
      curY += 28;

      const commands = GMManager.getCommandsByGroup(group);
      for (const cmd of commands) {
        this._createButton(cmd, panelX + PAD, curY, btnW, BTN_H);
        curY += BTN_H + BTN_GAP;
      }
      curY += 10;
    }

    const contentH = Math.max(curY - (scrollAreaY + 6), 1);
    scrollPlate.hitArea = new PIXI.Rectangle(0, 0, btnW, contentH);

    const totalContentH = curY - scrollAreaY;
    this._maxScrollY = Math.max(0, totalContentH - scrollAreaH);
    this._scrollContainer.y = -this._scrollY;

    this._sbTrackX = panelX + panelW - PAD - 14;
    this._sbTrackY = scrollAreaY + 42;
    this._sbTrackH = Math.max(48, scrollAreaH - 84);

    const btnUp = this._makeArrowBtn('▲', this._sbTrackX - 6, scrollAreaY + 4);
    btnUp.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._scrollBy(-SCROLL_PAGE_STEP);
    });
    this._content.addChild(btnUp);

    const btnDown = this._makeArrowBtn('▼', this._sbTrackX - 6, scrollAreaY + scrollAreaH - 40);
    btnDown.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._scrollBy(SCROLL_PAGE_STEP);
    });
    this._content.addChild(btnDown);

    this._sbTrack = new PIXI.Graphics();
    this._sbTrack.beginFill(C.track, 0.85);
    this._sbTrack.drawRoundedRect(this._sbTrackX, this._sbTrackY, 12, this._sbTrackH, 6);
    this._sbTrack.endFill();
    this._sbTrack.eventMode = 'static';
    this._sbTrack.cursor = 'pointer';
    this._sbTrack.hitArea = new PIXI.Rectangle(this._sbTrackX, this._sbTrackY, 12, this._sbTrackH);
    this._sbTrack.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      if (this._maxScrollY <= 0) return;
      const ly = globalToDesignY(e.global.y) - this._sbTrackY;
      const th = this._thumbLength();
      const range = Math.max(1, this._sbTrackH - th);
      const target = Math.max(0, Math.min(1, (ly - th / 2) / range));
      this._setScrollY(target * this._maxScrollY);
    });
    this._content.addChild(this._sbTrack);

    this._sbThumb = new PIXI.Graphics();
    this._sbThumb.eventMode = 'static';
    this._sbThumb.cursor = 'pointer';
    this._sbThumb.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      if (this._maxScrollY <= 0) return;
      this._sbThumbDrag = true;
      this._sbThumbStartScroll = this._scrollY;
      this._sbThumbStartDesignY = globalToDesignY(e.global.y);
      this._gmPointerActive = true;
      this._gmPendingCmd = null;
      this._gmStartDesignY = this._sbThumbStartDesignY;
      this._gmStartScrollY = this._scrollY;
      this._gmSlopExceeded = true;
      const st = Game.app.stage;
      st.on('pointermove', this._onGmStageMove);
      st.on('pointerup', this._onGmStageUp);
      st.on('pointerupoutside', this._onGmStageUp);
      st.on('pointercancel', this._onGmStageUp);
    });
    this._content.addChild(this._sbThumb);

    this._layoutScrollbarThumb();
  }

  private _makeArrowBtn(label: string, x: number, y: number): PIXI.Container {
    const bw = 40;
    const bh = 34;
    const c = new PIXI.Container();
    c.position.set(x, y);
    const g = new PIXI.Graphics();
    g.beginFill(C.arrowBg, 1);
    g.drawRoundedRect(0, 0, bw, bh, 8);
    g.endFill();
    g.lineStyle(1.5, C.btnStroke, 0.85);
    g.drawRoundedRect(0, 0, bw, bh, 8);
    c.addChild(g);
    const t = new PIXI.Text(label, {
      fontSize: 17,
      fill: C.title,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    t.anchor.set(0.5, 0.5);
    t.position.set(bw / 2, bh / 2);
    c.addChild(t);
    c.hitArea = new PIXI.Rectangle(0, 0, bw, bh);
    c.eventMode = 'static';
    c.cursor = 'pointer';
    return c;
  }

  private _createButton(cmd: GMCommand, x: number, y: number, w: number, h: number): void {
    const btn = new PIXI.Graphics();
    btn.beginFill(C.btnFill, 1);
    btn.drawRoundedRect(x, y, w, h, 12);
    btn.endFill();
    btn.lineStyle(1.5, C.btnStroke, 0.8);
    btn.drawRoundedRect(x, y, w, h, 12);
    btn.eventMode = 'none';
    this._scrollContainer.addChild(btn);

    const padIn = 14;
    const nameText = new PIXI.Text(cmd.name, {
      fontSize: 17,
      fill: C.btnText,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      lineHeight: 22,
    });
    nameText.position.set(x + padIn, y + 10);
    nameText.eventMode = 'none';
    this._scrollContainer.addChild(nameText);

    const descText = new PIXI.Text(cmd.desc, {
      fontSize: 14,
      fill: C.desc,
      fontFamily: FONT_FAMILY,
      lineHeight: 20,
      wordWrap: true,
      wordWrapWidth: w - padIn * 2,
    });
    descText.position.set(x + padIn, y + 36);
    descText.eventMode = 'none';
    this._scrollContainer.addChild(descText);

    const hitArea = new PIXI.Container();
    hitArea.hitArea = new PIXI.Rectangle(x, y, w, h);
    hitArea.eventMode = 'static';
    hitArea.cursor = 'pointer';
    hitArea.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._beginListScroll(e, cmd);
    });
    this._scrollContainer.addChild(hitArea);
  }

  private _showResult(text: string): void {
    this._resultText.text = `> ${text}`;
    this._resultText.alpha = 1;
    TweenManager.cancelTarget(this._resultText);
    TweenManager.to({
      target: this._resultText,
      props: { alpha: 0 },
      duration: 0.5,
      delay: 3,
    });
  }
}
