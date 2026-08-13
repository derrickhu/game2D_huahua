/**
 * 更新公告面板：壳图 + 可滚动正文 + 「知道了」主按钮。
 * 关闭 / 知道了 均 markSeen，同版本不再弹出。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';
import {
  type UpdateAnnouncementDef,
  type UpdateAnnouncementSection,
} from '@/config/UpdateAnnouncementConfig';
import { UpdateAnnouncementManager } from '@/managers/UpdateAnnouncementManager';

/** 与当前花房布告板壳实测比例对齐 */
const SHELL_ASPECT = 938 / 520;
const SCREEN_MARGIN_X = 18;
const SCREEN_MARGIN_Y = 36;

/** 壳图分区（拱形木布告板：吊牌标题 / 羊皮纸正文 / 底木条 CTA） */
const TITLE_NY = 0.158;
const VERSION_NY = 0.205;
const CLOSE_NX = 0.93;
const CLOSE_NY = 0.055;
const CLOSE_R_FRAC = 0.055;
/** 避开左右花蝶装饰 */
const CONTENT_PAD_X_FRAC = 0.155;
const CONTENT_TOP_NY = 0.255;
const CONTENT_BOTTOM_NY = 0.735;
const CTA_NY = 0.875;

const TEXT_DARK = 0x5c4636;
const TEXT_MUTED = 0x8a735a;
const SECTION_PURPLE = 0x6b4f9a;
/** 条目要点前缀（「xxx：」）强调色 */
const ITEM_KEY_ACCENT = 0xc45a4a;
const DRAG_THRESHOLD = 4;

/** 拆出「要点：」前缀；无冒号或过长则整句当正文 */
function splitAnnouncementItemKey(item: string): { key: string; body: string } | null {
  const m = item.match(/^(.{1,16}?[:：])\s*(.+)$/u);
  if (!m) return null;
  return { key: m[1]!, body: m[2]! };
}

function nativeClientToDesignY(clientY: number): number {
  return Game.clientToDesign(0, clientY).y;
}

function federatedPointerToDesignY(e: PIXI.FederatedPointerEvent): number {
  const native = e.nativeEvent as PointerEvent | MouseEvent | undefined;
  if (native != null && typeof (native as PointerEvent).clientY === 'number') {
    return nativeClientToDesignY((native as PointerEvent).clientY);
  }
  return Game.globalToDesign(e.global.x, e.global.y).y;
}

function rawEventToDesignY(ev: PointerEvent | any): number {
  if (ev && typeof ev.clientY === 'number') return nativeClientToDesignY(ev.clientY);
  return 0;
}

function computePanelSize(): { panelW: number; panelH: number; scale: number } {
  const maxW = DESIGN_WIDTH - SCREEN_MARGIN_X * 2;
  const maxH = Game.logicHeight - SCREEN_MARGIN_Y * 2;
  let panelW = maxW;
  let panelH = Math.round(panelW * SHELL_ASPECT);
  if (panelH > maxH) {
    panelH = maxH;
    panelW = Math.round(panelH / SHELL_ASPECT);
  }
  // 相对原始 520 壳宽的字号缩放
  const scale = panelW / 520;
  return { panelW, panelH, scale };
}

export class UpdateAnnouncementPanel extends PIXI.Container {
  private _overlay!: PIXI.Graphics;
  private _panel!: PIXI.Container;
  private _shellSprite: PIXI.Sprite | null = null;
  private _fallbackBg: PIXI.Graphics | null = null;
  private _titleText!: PIXI.Text;
  private _versionText!: PIXI.Text;
  private _closeHit!: PIXI.Container;
  private _scrollViewport!: PIXI.Container;
  private _scrollContent!: PIXI.Container;
  private _scrollMask!: PIXI.Graphics;
  private _ctaBtn!: PIXI.Container;
  private _ctaBg!: PIXI.Graphics;
  private _ctaLabel!: PIXI.Text;
  private _isOpen = false;
  private _announcement: UpdateAnnouncementDef | null = null;
  private _onClosed: (() => void) | null = null;
  private _markSeenOnClose = true;
  private _textureUnsub: (() => void) | null = null;

  private _panelW = 520;
  private _panelH = Math.round(520 * SHELL_ASPECT);
  private _uiScale = 1;
  private _contentW = 400;
  private _contentH = 400;

  private _scrollY = 0;
  private _maxScrollY = 0;
  private _dragging = false;
  private _dragMoved = false;
  private _dragStartDesignY = 0;
  private _dragStartScrollY = 0;

  private readonly _onCanvasMove = (ev: PointerEvent): void => {
    if (!this._dragging) return;
    const dy = this._dragStartDesignY - rawEventToDesignY(ev);
    if (Math.abs(dy) > DRAG_THRESHOLD) this._dragMoved = true;
    this._setScrollY(this._dragStartScrollY + dy);
  };

  private readonly _onCanvasUp = (): void => {
    this._finishScroll();
  };

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 6200;
    this._build();
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * @param onClosed 关闭后回调（用于继续签到等进场队列）
   * @param options.markSeenOnClose 默认 true；GM 预览传 false，避免改已读状态
   */
  open(
    announcement?: UpdateAnnouncementDef | null,
    onClosed?: (() => void) | null,
    options?: { markSeenOnClose?: boolean },
  ): void {
    const data = announcement ?? UpdateAnnouncementManager.active;
    if (!data || this._isOpen) return;
    this._announcement = data;
    this._onClosed = onClosed ?? null;
    this._markSeenOnClose = options?.markSeenOnClose !== false;
    this._isOpen = true;
    this.visible = true;
    this._scrollY = 0;

    this._textureUnsub?.();
    this._textureUnsub = TextureCache.observeTextureDependencies(
      { keys: ['update_announcement_panel_shell_nb2'] },
      () => {
        if (this._isOpen) this._syncShell();
      },
    );
    void TextureCache.preloadKeys(['update_announcement_panel_shell_nb2']).finally(() => {
      if (this._isOpen) this._syncShell();
    });

    this._relayout();
    this._rebuildBody();

    this.alpha = 0;
    this._panel.scale.set(0.92);
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.22, ease: Ease.easeOutQuad });
    TweenManager.to({
      target: this._panel.scale,
      props: { x: 1, y: 1 },
      duration: 0.28,
      ease: Ease.easeOutBack,
    });
  }

  close(markSeen = true): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._cleanupScrollListeners();
    this._textureUnsub?.();
    this._textureUnsub = null;

    if (markSeen && this._markSeenOnClose && this._announcement) {
      UpdateAnnouncementManager.markSeen(this._announcement.id);
    }
    this._markSeenOnClose = true;

    const cb = this._onClosed;
    this._onClosed = null;
    this._announcement = null;

    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.18,
      ease: Ease.easeInQuad,
      onComplete: () => {
        // 关闭动画期间若又被 open（如 GM 连点），勿把新开的面板藏掉
        if (!this._isOpen) {
          this.visible = false;
          cb?.();
        }
      },
    });
  }

  private _build(): void {
    this._overlay = new PIXI.Graphics();
    this._overlay.eventMode = 'static';
    this._overlay.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
    });
    this.addChild(this._overlay);

    this._panel = new PIXI.Container();
    this._panel.eventMode = 'static';
    this._panel.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._panel);

    this._titleText = new PIXI.Text('更新公告', {
      fontFamily: FONT_FAMILY,
      fontSize: 28,
      fill: 0x6b4a2e,
      fontWeight: 'bold',
      align: 'center',
      stroke: 0xfff6e8,
      strokeThickness: 4,
    } as Partial<PIXI.ITextStyle>);
    this._titleText.anchor.set(0.5);
    this._panel.addChild(this._titleText);

    this._versionText = new PIXI.Text('', {
      fontFamily: FONT_FAMILY,
      fontSize: 16,
      fill: 0xa07850,
      fontWeight: 'bold',
      align: 'center',
    });
    this._versionText.anchor.set(0.5, 0);
    this._panel.addChild(this._versionText);

    this._closeHit = new PIXI.Container();
    this._closeHit.eventMode = 'static';
    this._closeHit.cursor = 'pointer';
    this._closeHit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close(true);
    });
    this._panel.addChild(this._closeHit);

    this._scrollViewport = new PIXI.Container();
    this._scrollViewport.eventMode = 'static';
    this._panel.addChild(this._scrollViewport);

    this._scrollMask = new PIXI.Graphics();
    this._scrollViewport.addChild(this._scrollMask);

    this._scrollContent = new PIXI.Container();
    this._scrollViewport.addChild(this._scrollContent);
    this._scrollContent.mask = this._scrollMask;

    this._scrollViewport.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._beginScroll(e);
    });

    this._ctaBtn = this._buildCta();
    this._panel.addChild(this._ctaBtn);
  }

  private _buildCta(): PIXI.Container {
    const btn = new PIXI.Container();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    this._ctaBg = new PIXI.Graphics();
    btn.addChild(this._ctaBg);
    this._ctaLabel = new PIXI.Text('知道了', {
      fontFamily: FONT_FAMILY,
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: 'bold',
      stroke: 0x3d8f7a,
      strokeThickness: 3,
    } as Partial<PIXI.ITextStyle>);
    this._ctaLabel.anchor.set(0.5);
    btn.addChild(this._ctaLabel);
    btn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      if (this._dragMoved) return;
      this.close(true);
    });
    return btn;
  }

  private _drawCta(w: number, h: number): void {
    const g = this._ctaBg;
    g.clear();
    g.beginFill(0x7ec8b8, 1);
    g.lineStyle(3, 0xd4b483, 1);
    g.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.endFill();
    g.lineStyle(1.5, 0xe8fff8, 0.65);
    g.drawRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, h / 2 - 2);
    this._ctaBtn.hitArea = new PIXI.Rectangle(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
  }

  private _relayout(): void {
    const { panelW, panelH, scale } = computePanelSize();
    this._panelW = panelW;
    this._panelH = panelH;
    this._uiScale = scale;

    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;
    this._overlay.clear();
    this._overlay.beginFill(0x000000, 0.55);
    this._overlay.drawRect(0, 0, w, h);
    this._overlay.endFill();

    this._panel.position.set(w / 2, h / 2);
    this._panel.hitArea = new PIXI.RoundedRectangle(
      -panelW / 2,
      -panelH / 2,
      panelW,
      panelH,
      28,
    );

    const fs = (base: number) => Math.max(14, Math.round(base * scale));

    this._titleText.style.fontFamily = FONT_FAMILY;
    this._titleText.style.fontSize = fs(28);
    this._titleText.style.strokeThickness = Math.max(3, Math.round(4 * scale));
    this._titleText.position.set(0, -panelH / 2 + panelH * TITLE_NY);

    this._versionText.style.fontFamily = FONT_FAMILY;
    this._versionText.style.fontSize = fs(15);
    this._versionText.position.set(0, -panelH / 2 + panelH * VERSION_NY);

    const closeR = Math.max(24, panelW * CLOSE_R_FRAC);
    this._closeHit.hitArea = new PIXI.Circle(0, 0, closeR);
    this._closeHit.position.set(
      -panelW / 2 + panelW * CLOSE_NX,
      -panelH / 2 + panelH * CLOSE_NY,
    );

    const padX = Math.round(panelW * CONTENT_PAD_X_FRAC);
    const contentW = panelW - padX * 2;
    const contentTop = -panelH / 2 + panelH * CONTENT_TOP_NY;
    const contentBottom = -panelH / 2 + panelH * CONTENT_BOTTOM_NY;
    const contentH = contentBottom - contentTop;
    this._contentW = contentW;
    this._contentH = contentH;

    this._scrollViewport.position.set(-contentW / 2, contentTop);
    this._scrollViewport.hitArea = new PIXI.Rectangle(0, 0, contentW, contentH);

    this._scrollMask.clear();
    this._scrollMask.beginFill(0xffffff);
    this._scrollMask.drawRoundedRect(0, 0, contentW, contentH, 8);
    this._scrollMask.endFill();

    const ctaW = Math.round(268 * scale);
    const ctaH = Math.round(52 * scale);
    this._drawCta(ctaW, ctaH);
    this._ctaLabel.style.fontFamily = FONT_FAMILY;
    this._ctaLabel.style.fontSize = fs(24);
    this._ctaLabel.style.strokeThickness = Math.max(2, Math.round(3 * scale));
    this._ctaBtn.position.set(0, -panelH / 2 + panelH * CTA_NY);

    this._syncShell();
    this._applyScroll();
  }

  private _syncShell(): void {
    const tex = TextureCache.get('update_announcement_panel_shell_nb2');
    if (tex && tex.width > 0) {
      if (!this._shellSprite) {
        this._shellSprite = new PIXI.Sprite(tex);
        this._shellSprite.anchor.set(0.5);
        this._panel.addChildAt(this._shellSprite, 0);
      } else {
        this._shellSprite.texture = tex;
      }
      this._shellSprite.width = this._panelW;
      this._shellSprite.height = this._panelH;
      this._shellSprite.visible = true;
      if (this._fallbackBg) this._fallbackBg.visible = false;
      return;
    }
    this._ensureFallbackBg();
    if (this._shellSprite) this._shellSprite.visible = false;
  }

  private _ensureFallbackBg(): void {
    if (this._fallbackBg) {
      this._fallbackBg.visible = true;
      return;
    }
    const bg = new PIXI.Graphics();
    const pw = this._panelW;
    const ph = this._panelH;
    bg.beginFill(0x000000, 0.12);
    bg.drawRoundedRect(-pw / 2 + 4, -ph / 2 + 6, pw, ph, 28);
    bg.endFill();
    bg.beginFill(0xfffdf5, 0.98);
    bg.lineStyle(4, 0xc9a8e8, 1);
    bg.drawRoundedRect(-pw / 2, -ph / 2, pw, ph, 28);
    bg.endFill();
    this._panel.addChildAt(bg, 0);
    this._fallbackBg = bg;
  }

  private _rebuildBody(): void {
    while (this._scrollContent.children.length > 0) {
      const c = this._scrollContent.children[0];
      this._scrollContent.removeChild(c);
      c.destroy({ children: true });
    }
    const data = this._announcement;
    if (!data) return;

    this._titleText.text = data.title || '更新公告';
    this._versionText.text = data.version ? `v${data.version}` : '';

    const s = this._uiScale;
    const contentW = this._contentW;
    const fs = (base: number) => Math.max(14, Math.round(base * s));
    const padTop = Math.round(10 * s);
    const sectionGap = Math.round(18 * s);
    const itemGap = Math.round(12 * s);
    let y = padTop;

    if (data.greeting) {
      const greet = new PIXI.Text(data.greeting, {
        fontFamily: FONT_FAMILY,
        fontSize: fs(18),
        fill: TEXT_DARK,
        wordWrap: true,
        wordWrapWidth: contentW,
        breakWords: true,
        lineHeight: Math.round(30 * s),
      } as Partial<PIXI.ITextStyle>);
      greet.position.set(0, y);
      this._scrollContent.addChild(greet);
      y += greet.height + Math.round(20 * s);
    }

    for (const section of data.sections) {
      y = this._addSection(section, contentW, y, fs, itemGap, s);
      y += sectionGap;
    }

    if (data.footer) {
      y += Math.round(4 * s);
      const foot = new PIXI.Text(data.footer, {
        fontFamily: FONT_FAMILY,
        fontSize: fs(15),
        fill: TEXT_MUTED,
        wordWrap: true,
        wordWrapWidth: contentW,
        breakWords: true,
        lineHeight: Math.round(26 * s),
      } as Partial<PIXI.ITextStyle>);
      foot.position.set(0, y);
      this._scrollContent.addChild(foot);
      y += foot.height + Math.round(14 * s);
    } else {
      y += Math.round(8 * s);
    }

    this._maxScrollY = Math.max(0, y - this._contentH);
    this._scrollY = 0;
    this._applyScroll();
  }

  private _addSection(
    section: UpdateAnnouncementSection,
    contentW: number,
    startY: number,
    fs: (n: number) => number,
    itemGap: number,
    s: number,
  ): number {
    let y = startY;
    if (!section.items?.length) return y;

    const head = new PIXI.Text(section.title, {
      fontFamily: FONT_FAMILY,
      fontSize: fs(19),
      fill: SECTION_PURPLE,
      fontWeight: 'bold',
    });
    head.position.set(0, y);
    this._scrollContent.addChild(head);
    y += head.height + Math.round(10 * s);

    for (const item of section.items) {
      y = this._addItemLine(item, contentW, y, fs, itemGap, s);
    }
    return y;
  }

  private _addItemLine(
    item: string,
    contentW: number,
    startY: number,
    fs: (n: number) => number,
    itemGap: number,
    s: number,
  ): number {
    const fontSize = fs(17);
    const lineHeight = Math.round(28 * s);
    const baseStyle = {
      fontFamily: FONT_FAMILY,
      fontSize,
      breakWords: true,
      lineHeight,
    } as Partial<PIXI.ITextStyle>;

    const split = splitAnnouncementItemKey(item);
    if (!split) {
      const line = new PIXI.Text(`· ${item}`, {
        ...baseStyle,
        fill: TEXT_DARK,
        wordWrap: true,
        wordWrapWidth: contentW - 2,
      } as Partial<PIXI.ITextStyle>);
      line.position.set(0, startY);
      this._scrollContent.addChild(line);
      return startY + line.height + itemGap;
    }

    const row = new PIXI.Container();
    row.position.set(0, startY);
    this._scrollContent.addChild(row);

    const keyText = new PIXI.Text(`· ${split.key}`, {
      ...baseStyle,
      fill: ITEM_KEY_ACCENT,
      fontWeight: 'bold',
    } as Partial<PIXI.ITextStyle>);
    row.addChild(keyText);

    const minBodyW = Math.round(contentW * 0.38);
    const inline = keyText.width <= contentW - minBodyW;
    const bodyText = new PIXI.Text(split.body, {
      ...baseStyle,
      fill: TEXT_DARK,
      wordWrap: true,
      wordWrapWidth: inline ? contentW - keyText.width - 2 : contentW - 2,
    } as Partial<PIXI.ITextStyle>);
    bodyText.position.set(inline ? keyText.width : 0, inline ? 0 : keyText.height);
    row.addChild(bodyText);

    const h = inline
      ? Math.max(keyText.height, bodyText.height)
      : keyText.height + bodyText.height;
    return startY + h + itemGap;
  }

  private _setScrollY(next: number): void {
    this._scrollY = Math.max(0, Math.min(this._maxScrollY, next));
    this._applyScroll();
  }

  private _applyScroll(): void {
    this._scrollContent.y = -this._scrollY;
  }

  private _beginScroll(e: PIXI.FederatedPointerEvent): void {
    if (this._maxScrollY <= 0) return;
    this._cleanupScrollListeners();
    this._dragging = true;
    this._dragMoved = false;
    this._dragStartDesignY = federatedPointerToDesignY(e);
    this._dragStartScrollY = this._scrollY;
    const canvas = Game.app?.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.addEventListener) {
      canvas.addEventListener('pointermove', this._onCanvasMove);
      canvas.addEventListener('pointerup', this._onCanvasUp);
      canvas.addEventListener('pointercancel', this._onCanvasUp);
    }
  }

  private _finishScroll(): void {
    if (!this._dragging) return;
    this._dragging = false;
    this._cleanupScrollListeners();
    if (this._dragMoved) {
      setTimeout(() => { this._dragMoved = false; }, 80);
    }
  }

  private _cleanupScrollListeners(): void {
    const canvas = Game.app?.view as unknown as HTMLCanvasElement | undefined;
    if (!canvas?.removeEventListener) return;
    canvas.removeEventListener('pointermove', this._onCanvasMove);
    canvas.removeEventListener('pointerup', this._onCanvasUp);
    canvas.removeEventListener('pointercancel', this._onCanvasUp);
  }
}
