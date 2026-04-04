/**
 * 游戏内「购买物品」商店弹窗：
 * - **底板**：`shop_merch_panel_frame`（紫木外框 + 楣/棚/绳），始终在下层；
 * - **货架组件**：`shop_section_panel_bg` × N + 槽位；**缩放按内区高度刚好容纳两行完整层板**（再放大），多出行在陈列区内**纵向拖动滚动**查看。
 * 底板整图缩放与 `WarehousePanel` 一致。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';

function merchPanelScale(texW: number, texH: number, logicH: number): number {
  return Math.min((DESIGN_WIDTH - 36) / texW, (logicH - 72) / texH, 1);
}

/** 底板 `shop_merch_panel_frame.png` 当前裁边后约 741×1292；内区为楣/棚/绳之下的紫木板陈列带 */
const FRAME_REF_W = 741;
const FRAME_REF_H = 1292;
const FRAME_INNER = { x: 52, y: 372, w: 636, h: 833 };

/** 层板 `shop_section_panel_bg.png` 裁边后约 1089×765 */
const REF_SEC_W = 1089;
const REF_SEC_H = 765;
const REF_SLOT_CY = 407;
const REF_SLOT_DX = [-308.5, -2, 303.5] as const;
const REF_SLOT_SIDE = 280;

/** 货架总行数（多于此两行时出现滚动） */
const SHELF_ROWS = 3;
const SHELF_COLS = 3;
const SECTION_GAP = 12;
/** 视口内目标：完整可见的层板行数（用于算放大系数） */
const VISIBLE_SHELF_ROWS = 2;

/** 红关叉中心在底板纹理上的像素（与 `shop_merch_panel_frame` 对齐） */
const FRAME_CLOSE_TEX = { x: 695, y: 65 };

const DEMO_SLOT_ICONS: [number, number, string][] = [
  [0, 0, 'icon_shop_nb2'],
  [0, 1, 'icon_basket'],
];

export class MerchShopPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _frameRoot!: PIXI.Container;
  private _isOpen = false;
  /** 货架滚动层（有组件底板时存在） */
  private _merchScrollContent: PIXI.Container | null = null;
  private _merchScrollMinY = 0;
  private _merchScrollDragging = false;
  private _merchScrollPtrY0 = 0;
  private _merchScrollY0 = 0;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5200;
    this._build();
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this.alpha = 1;
    this.position.set(0, 0);
    this.scale.set(1, 1);

    TweenManager.cancelTarget(this._bg);
    TweenManager.cancelTarget(this._frameRoot);
    TweenManager.cancelTarget(this._frameRoot.scale);

    this._bg.alpha = 0;
    this._frameRoot.alpha = 0;
    this._frameRoot.scale.set(0.92);
    if (this._merchScrollContent) this._merchScrollContent.y = 0;

    TweenManager.to({ target: this._bg, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._frameRoot, props: { alpha: 1 }, duration: 0.22, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._frameRoot.scale, props: { x: 1, y: 1 }, duration: 0.32, ease: Ease.easeOutBack });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.cancelTarget(this._bg);
    TweenManager.cancelTarget(this._frameRoot);
    TweenManager.cancelTarget(this._frameRoot.scale);

    TweenManager.to({ target: this._bg, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad });
    TweenManager.to({
      target: this._frameRoot,
      props: { alpha: 0 },
      duration: 0.15,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this.alpha = 1;
      },
    });
    TweenManager.to({ target: this._frameRoot.scale, props: { x: 0.94, y: 0.94 }, duration: 0.15, ease: Ease.easeInQuad });
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    this._frameRoot = new PIXI.Container();
    this._frameRoot.position.set(DESIGN_WIDTH / 2, h / 2);
    this.addChild(this._frameRoot);

    const frameTex = TextureCache.get('shop_merch_panel_frame');
    const secTex = TextureCache.get('shop_section_panel_bg');
    const slotTex = TextureCache.get('shop_item_slot');

    let closeLX = 0;
    let closeLY = 0;

    if (frameTex?.width && secTex?.width && slotTex?.width) {
      const c = this._buildFrameWithComposedShelves(frameTex, secTex, slotTex, h);
      closeLX = c.closeX;
      closeLY = c.closeY;
    } else if (frameTex?.width) {
      const fw = frameTex.width;
      const fh = frameTex.height;
      const Sf = merchPanelScale(fw, fh, h);
      const sp = new PIXI.Sprite(frameTex);
      sp.anchor.set(0.5);
      sp.scale.set(Sf);
      sp.position.set(0, 0);
      sp.eventMode = 'static';
      sp.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      this._frameRoot.addChild(sp);
      const halfW = (fw * Sf) / 2;
      const halfH = (fh * Sf) / 2;
      const hint = new PIXI.Text('商品筹备中，敬请期待~', {
        fontSize: 22,
        fill: COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
      });
      hint.anchor.set(0.5);
      hint.position.set(0, Math.min(140, halfH * 0.28));
      hint.eventMode = 'none';
      this._frameRoot.addChild(hint);
      const fx0 = fw / FRAME_REF_W;
      const fy0 = fh / FRAME_REF_H;
      closeLX = (FRAME_CLOSE_TEX.x * fx0 - fw / 2) * Sf;
      closeLY = (FRAME_CLOSE_TEX.y * fy0 - fh / 2) * Sf;
    } else {
      const rw = DESIGN_WIDTH - 40;
      const rh = Math.min(1180, h - 80);
      const fb = new PIXI.Graphics();
      fb.beginFill(0xfff5ec, 0.96);
      fb.lineStyle(3, 0xd2b48c, 0.7);
      fb.drawRoundedRect(-rw / 2, -rh / 2, rw, rh, 20);
      fb.endFill();
      fb.eventMode = 'static';
      fb.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      this._frameRoot.addChild(fb);
      const halfW = rw / 2;
      const halfH = rh / 2;
      const hint = new PIXI.Text('商品筹备中，敬请期待~', {
        fontSize: 22,
        fill: COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
      });
      hint.anchor.set(0.5);
      hint.position.set(0, Math.min(140, halfH * 0.28));
      hint.eventMode = 'none';
      this._frameRoot.addChild(hint);
      closeLX = halfW - 22 - 14;
      closeLY = -halfH + 22 + 16;
    }

    const closeBtn = new PIXI.Container();
    const cr = 22;
    closeBtn.position.set(closeLX, closeLY);
    const cbg = new PIXI.Graphics();
    cbg.beginFill(0x000000, 0.42);
    cbg.drawCircle(0, 0, cr);
    cbg.endFill();
    cbg.lineStyle(2.5, 0xffffff, 0.92);
    const arm = 7;
    cbg.moveTo(-arm, -arm);
    cbg.lineTo(arm, arm);
    cbg.moveTo(arm, -arm);
    cbg.lineTo(-arm, arm);
    closeBtn.addChild(cbg);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.hitArea = new PIXI.Circle(0, 0, cr + 12);
    closeBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._frameRoot.addChild(closeBtn);
  }

  /**
   * 底板在下、货架在上；关叉与底板纹理对齐。
   */
  private _buildFrameWithComposedShelves(
    frameTex: PIXI.Texture,
    secTex: PIXI.Texture,
    slotTex: PIXI.Texture,
    logicH: number,
  ): { closeX: number; closeY: number } {
    const fw = frameTex.width;
    const fh = frameTex.height;
    const fx = fw / FRAME_REF_W;
    const fy = fh / FRAME_REF_H;
    const inner = {
      x: FRAME_INNER.x * fx,
      y: FRAME_INNER.y * fy,
      w: FRAME_INNER.w * fx,
      h: FRAME_INNER.h * fy,
    };
    const Sf = merchPanelScale(fw, fh, logicH);

    const frameSp = new PIXI.Sprite(frameTex);
    frameSp.anchor.set(0.5);
    frameSp.scale.set(Sf);
    frameSp.position.set(0, 0);
    frameSp.eventMode = 'static';
    frameSp.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._frameRoot.addChild(frameSp);

    const tw = secTex.width;
    const th = secTex.height;
    const fsx = tw / REF_SEC_W;
    const fsy = th / REF_SEC_H;
    const slotCy = REF_SLOT_CY * fsy;
    const slotDx = REF_SLOT_DX.map((d) => d * fsx);
    const slotSide = REF_SLOT_SIDE * fsx;

    const stackW = tw;
    const stackH = SHELF_ROWS * th + (SHELF_ROWS - 1) * SECTION_GAP;
    const innerLeftX = (inner.x - fw / 2) * Sf;
    const innerTopY = (inner.y - fh / 2) * Sf;
    const innerWscr = inner.w * Sf;
    const innerHscr = inner.h * Sf;
    const visibleTwoTexH =
      VISIBLE_SHELF_ROWS * th + (VISIBLE_SHELF_ROWS - 1) * SECTION_GAP;
    const shelfS = Math.min(innerWscr / stackW, innerHscr / visibleTwoTexH);

    const viewport = new PIXI.Container();
    viewport.position.set(innerLeftX, innerTopY);
    viewport.eventMode = 'static';
    viewport.cursor = 'grab';
    viewport.hitArea = new PIXI.Rectangle(0, 0, innerWscr, innerHscr);

    const maskG = new PIXI.Graphics();
    maskG.beginFill(0xffffff);
    maskG.drawRect(0, 0, innerWscr, innerHscr);
    maskG.endFill();
    viewport.addChild(maskG);
    viewport.mask = maskG;

    const scrollContent = new PIXI.Container();
    scrollContent.sortableChildren = true;
    scrollContent.scale.set(shelfS);
    const offsetX = Math.max(0, (innerWscr - stackW * shelfS) / 2);
    scrollContent.position.set(offsetX, 0);
    viewport.addChild(scrollContent);

    const contentHScr = stackH * shelfS;
    this._merchScrollMinY = Math.min(0, innerHscr - contentHScr);
    this._merchScrollContent = scrollContent;

    const bindScroll = (): void => {
      viewport.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        this._merchScrollDragging = true;
        this._merchScrollPtrY0 = e.global.y;
        this._merchScrollY0 = scrollContent.y;
        viewport.cursor = 'grabbing';
        e.stopPropagation();
      });
      viewport.on('pointerup', () => {
        this._merchScrollDragging = false;
        viewport.cursor = 'grab';
      });
      viewport.on('pointerupoutside', () => {
        this._merchScrollDragging = false;
        viewport.cursor = 'grab';
      });
      viewport.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
        if (!this._merchScrollDragging) return;
        const dy = e.global.y - this._merchScrollPtrY0;
        let ny = this._merchScrollY0 + dy;
        if (ny > 0) ny = 0;
        if (ny < this._merchScrollMinY) ny = this._merchScrollMinY;
        scrollContent.y = ny;
        e.stopPropagation();
      });
      viewport.on('wheel', (e: PIXI.FederatedWheelEvent) => {
        let ny = scrollContent.y - e.deltaY * 0.45;
        if (ny > 0) ny = 0;
        if (ny < this._merchScrollMinY) ny = this._merchScrollMinY;
        scrollContent.y = ny;
        e.stopPropagation();
      });
    };
    bindScroll();

    const demoMap = new Map<string, string>();
    for (const [r, c, key] of DEMO_SLOT_ICONS) {
      demoMap.set(`${r},${c}`, key);
    }

    for (let r = 0; r < SHELF_ROWS; r++) {
      const yTop = r * (th + SECTION_GAP);

      const sec = new PIXI.Sprite(secTex);
      sec.anchor.set(0.5, 0);
      sec.position.set(stackW / 2, yTop);
      sec.eventMode = 'static';
      sec.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      scrollContent.addChild(sec);

      for (let c = 0; c < SHELF_COLS; c++) {
        const sx = stackW / 2 + slotDx[c]!;
        const sy = yTop + slotCy;

        const slot = new PIXI.Sprite(slotTex);
        slot.anchor.set(0.5);
        const ss = slotSide / Math.max(slotTex.width, slotTex.height);
        slot.scale.set(ss);
        slot.position.set(sx, sy);
        slot.eventMode = 'static';
        slot.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
        scrollContent.addChild(slot);

        const iconKey = demoMap.get(`${r},${c}`);
        if (iconKey) {
          const it = TextureCache.get(iconKey);
          if (it?.width) {
            const isp = new PIXI.Sprite(it);
            isp.anchor.set(0.5);
            const iconCap = slotSide * 0.58;
            const isc = iconCap / Math.max(it.width, it.height);
            isp.scale.set(isc);
            isp.position.set(sx, sy);
            isp.eventMode = 'static';
            isp.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
            scrollContent.addChild(isp);
          }
        }
      }
    }

    this._frameRoot.addChild(viewport);

    const closeX = (FRAME_CLOSE_TEX.x * fx - fw / 2) * Sf;
    const closeY = (FRAME_CLOSE_TEX.y * fy - fh / 2) * Sf;
    return { closeX, closeY };
  }
}
