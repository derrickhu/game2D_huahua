import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { COLORS, DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { FurnitureWorkshopManager } from '@/managers/FurnitureWorkshopManager';
import {
  WORKSHOP_BLUEPRINT_DEFS,
  WORKSHOP_RESOURCE_BAR,
  getWorkshopMaterialDisplayName,
  getWorkshopResourceHelp,
  WORKSHOP_CRAFT_CATEGORY_TABS,
  getBlueprintCraftCategory,
  getBlueprintDisplayName,
  FURNITURE_WORKSHOP_UNLOCK_LEVEL,
  type WorkshopBlueprintDef,
  type WorkshopCraftCategoryFilter,
} from '@/config/FurnitureWorkshopConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { DecorationManager } from '@/managers/DecorationManager';
import { DECO_MAP } from '@/config/DecorationConfig';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { TextureCache } from '@/utils/TextureCache';
import { appendWorkshopBlueprintFeatureTags } from '@/utils/WorkshopBlueprintDisplay';
import { resolveFurnitureTexture } from '@/config/FurnitureRenderConfig';
import { FurnitureWorkshopCraftPopup } from '@/gameobjects/ui/FurnitureWorkshopCraftPopup';
import {
  FurnitureWorkshopShopPopup,
  SHOP_PAGE_TOP_FRAC,
  computeShopPopupFitScale,
} from '@/gameobjects/ui/FurnitureWorkshopShopPopup';
import {
  celebrateDecoObtain,
  dismissDecoObtainCelebrate,
} from '@/gameobjects/ui/DecoObtainCelebratePopup';
import { AudioManager } from '@/core/AudioManager';
import { OverlayManager } from '@/core/OverlayManager';

/** 工坊面板右下角「图纸商店」卷轴图标（勿回退到底栏工坊建造台） */
const SHOP_DOCK_ICON_KEY = 'icon_workshop_blueprint_scroll';

/**
 * 壳体锚点：均为相对壳图宽/高的比例（0~1），再经 sx/sy 映射到屏幕。
 * 换设备时只随面板壳缩放，不漂移。
 */
const SHELL = {
  W: 680,
  H: 1238,
  TITLE_Y_FRAC: 0.088,
  /** 壳图 px：红叉实测中心 (641, 39)；热区略下移，方便点面板内露出的下半圆 */
  CLOSE_CX_PX: 641,
  CLOSE_CY_PX: 56,
  /** 触控热区半径（壳图 px，大于可视钮半径 ~33） */
  CLOSE_HIT_R_PX: 46,
  INNER_PAD_X_FRAC: 0.076,
  /** 材料装饰 tray 中心（双行图标区） */
  RESOURCE_TRAY_CENTER_Y_FRAC: 0.228,
  RESOURCE_TRAY_H_FRAC: 0.084,
  /** 「材料」：tray 上方小标签区 */
  RESOURCE_LABEL_X_FRAC: 0.485,
  RESOURCE_LABEL_Y_FRAC: 0.169 - 13 / 1238,
  /** Tab 行顶（整体下移约 25 壳图 px） */
  CATEGORY_TAB_Y_FRAC: 0.278 + 25 / 1238,
  CATEGORY_TAB_H_FRAC: 0.042,
  CATEGORY_TAB_GAP_FRAC: 0.012,
  /** 可滚动图纸网格区：Tab 下沿 ~ 底栏分割线上 */
  CONTENT_BOTTOM_FRAC: 0.858,
  FOOTER_CHIP_X_FRAC: 0.805,
  FOOTER_CHIP_Y_FRAC: 0.908,
  /** 材料图标/字号（壳图 px，随 scale 缩放） */
  RESOURCE_ICON_PX: 34,
  RESOURCE_LABEL_PX: 20,
  RESOURCE_QTY_PX: 20,
  /** 相对 tray 中心：第一行锤子 / 第二行染料 */
  RESOURCE_ROW1_OFFSET_Y_PX: -30,
  RESOURCE_ROW2_OFFSET_Y_PX: 18,
  RESOURCE_SLOT_START_X_FRAC: 0.16,
  RESOURCE_DYE_SLOT_GAP_PX: 92,
  /** 底栏图纸商店：卷轴 + 标签，占满 footer 右下预留区 */
  SHOP_CHIP_ICON_PX: 108,
  SHOP_CHIP_LABEL_PX: 18,
  /** 标签顶边相对 chip 锚点（壳图 px，正值向下） */
  SHOP_CHIP_LABEL_Y_PX: 46,
  /** 制作弹窗中心 Y：下缘对齐材料 tray 下方，露出材料栏 */
  CRAFT_POPUP_Y_FRAC:
    0.228 + 0.084 / 2 + 320 / 1238 + 18 / 1238,
};

const BLUEPRINT_GRID_COLS = 2;
const BLUEPRINT_GRID_GAP = 16;
const BLUEPRINT_GRID_VISIBLE_ROWS = 2;
const BLUEPRINT_IMAGE_H = 188;

function textStyle(base: Partial<PIXI.ITextStyle>): PIXI.ITextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fill: COLORS.TEXT_DARK,
    ...base,
  } as PIXI.ITextStyle;
}

function contentTopFrac(): number {
  return SHELL.CATEGORY_TAB_Y_FRAC + SHELL.CATEGORY_TAB_H_FRAC + SHELL.CATEGORY_TAB_GAP_FRAC;
}

/** 与 DecorationPanel / MerchShopPanel 一致：原生 clientY → 设计坐标纵轴 */
function nativeClientToDesignY(clientY: number): number {
  return (clientY * Game.designHeight) / Game.screenHeight;
}

function federatedPointerToDesignY(e: PIXI.FederatedPointerEvent): number {
  const n = e.nativeEvent as PointerEvent | MouseEvent | undefined;
  if (n != null && typeof (n as PointerEvent).clientY === 'number') {
    return nativeClientToDesignY((n as PointerEvent).clientY);
  }
  return e.global.y / Game.scale;
}

function blueprintCardHeight(): number {
  return 12 + BLUEPRINT_IMAGE_H + 10 + 34 + 52 + 12;
}

/** 滚动视口高度 = 恰好 N 行卡片 + 行间距（与 _renderCraftGrid 布局一致） */
function blueprintGridViewportH(): number {
  const cardH = blueprintCardHeight();
  const rows = BLUEPRINT_GRID_VISIBLE_ROWS;
  return rows * cardH + Math.max(0, rows - 1) * BLUEPRINT_GRID_GAP;
}

function getSortedOwnedBlueprints(): WorkshopBlueprintDef[] {
  return WORKSHOP_BLUEPRINT_DEFS
    .filter(b => FurnitureWorkshopManager.hasBlueprint(b.id))
    .sort((a, b) => {
      const aDone = FurnitureWorkshopManager.isBlueprintFullyCrafted(a.id) ? 1 : 0;
      const bDone = FurnitureWorkshopManager.isBlueprintFullyCrafted(b.id) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return 0;
    });
}

function filterBlueprintsByCategory(
  blueprints: WorkshopBlueprintDef[],
  category: WorkshopCraftCategoryFilter,
): WorkshopBlueprintDef[] {
  if (category === 'all') return blueprints;
  return blueprints.filter(b => getBlueprintCraftCategory(b) === category);
}

export class FurnitureWorkshopPanel extends PIXI.Container {
  private _overlay!: PIXI.Graphics;
  private _panel!: PIXI.Container;
  private _shellSprite!: PIXI.Sprite;
  private _titleText!: PIXI.Text;
  private _closeHit!: PIXI.Container;
  private _categoryTabRow!: PIXI.Container;
  private _content!: PIXI.Container;
  private _contentScroll!: PIXI.Container;
  private _contentMask!: PIXI.Graphics;
  private _bottomDock!: PIXI.Container;
  private _shopDockBtn!: PIXI.Container;
  private _shopDockShadow!: PIXI.Graphics;
  private _shopDockIcon!: PIXI.Sprite;
  private _shopDockLabel!: PIXI.Text;
  private _resourceBar!: PIXI.Container;
  private _resourceLabel!: PIXI.Text;
  private _materialSlot!: PIXI.Container;
  private _dyeSlots: PIXI.Container[] = [];
  private _resourceCountTexts = new Map<string, PIXI.Text>();
  private _craftPopup!: FurnitureWorkshopCraftPopup;
  private _shopPopup!: FurnitureWorkshopShopPopup;
  private _categoryFilter: WorkshopCraftCategoryFilter = 'all';
  private _isOpen = false;
  private _opening = false;
  private _layoutScale = 1;
  private _assetUnsub: (() => void) | null = null;
  private _contentScrollY = 0;
  private _contentScrollListening = false;
  private _contentScrollStartDesignY = 0;
  private _contentScrollStartScrollY = 0;
  private _resourceTipRoot: PIXI.Container | null = null;
  private _resourceTipMaterialId: string | null = null;

  constructor() {
    super();
    this.visible = false;
    this.sortableChildren = true;
    this._build();
    EventBus.on('furnitureWorkshop:changed', () => {
      if (this._isOpen) this._refresh();
      this._craftPopup.refresh();
      this._shopPopup.refresh();
    });
    EventBus.on('panel:closeFurnitureWorkshop', () => {
      if (this.visible) this.close();
    });
  }

  open(): void {
    if (CurrencyManager.state.level < FURNITURE_WORKSHOP_UNLOCK_LEVEL) {
      ToastMessage.show(`家具工坊将在 ${FURNITURE_WORKSHOP_UNLOCK_LEVEL}级 开放`);
      return;
    }
    if (this._isOpen || this._opening) return;
    this._opening = true;
    void TextureCache.preloadPanelAssets('furnitureWorkshop').finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    OverlayManager.bringToFront();
    this._assetUnsub?.();
    this._assetUnsub = TextureCache.onAssetGroupLoaded('furnitureWorkshop', () => {
      if (this._isOpen) {
        this._applyShellLayout();
        this._refresh();
        this._craftPopup.refresh();
        this._shopPopup.refresh();
      }
    });
    this._shopPopup.close();
    this._categoryFilter = 'all';
    this._contentScrollY = 0;
    this._applyShellLayout();
    this._refresh();
  }

  close(): void {
    this._opening = false;
    this._teardownContentScroll();
    this._hideResourceTip();
    dismissDecoObtainCelebrate(this);
    this._craftPopup.close();
    this._shopPopup.close();
    this._assetUnsub?.();
    this._assetUnsub = null;
    this.visible = false;
    this._isOpen = false;
  }

  private _build(): void {
    this._overlay = new PIXI.Graphics();
    this._overlay.beginFill(0x000000, 0.48);
    this._overlay.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    this._overlay.endFill();
    this._overlay.eventMode = 'static';
    this._overlay.on('pointerdown', () => {
      this._hideResourceTip();
      this.close();
    });
    this.addChild(this._overlay);

    this._panel = new PIXI.Container();
    this._panel.sortableChildren = true;
    this._panel.eventMode = 'static';
    this._panel.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (this._resourceTipRoot) this._hideResourceTip();
      e.stopPropagation();
    });
    this.addChild(this._panel);

    this._shellSprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this._panel.addChild(this._shellSprite);

    this._titleText = new PIXI.Text('家具工坊', textStyle({
      fontSize: 38,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: 0x9b6bd3,
      strokeThickness: 5,
    }));
    this._titleText.anchor.set(0.5);
    this._panel.addChild(this._titleText);

    this._closeHit = new PIXI.Container();
    this._closeHit.zIndex = 100;
    this._closeHit.eventMode = 'static';
    this._closeHit.cursor = 'pointer';
    const onCloseTap = (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      if (this._shopPopup.visible) {
        this._shopPopup.close();
        this._refreshDockHighlight();
        return;
      }
      this.close();
    };
    this._closeHit.on('pointerdown', onCloseTap);
    this._closeHit.on('pointertap', onCloseTap);
    this._panel.addChild(this._closeHit);

    this._buildResourceBar();

    this._resourceLabel = new PIXI.Text('材料', textStyle({
      fontSize: SHELL.RESOURCE_LABEL_PX,
      fill: 0x8a6aad,
      fontWeight: '900',
      stroke: 0x6f5490,
      strokeThickness: 1,
    }));
    this._resourceLabel.anchor.set(0.5, 0.5);
    this._resourceLabel.zIndex = 15;
    this._panel.addChild(this._resourceLabel);

    this._categoryTabRow = new PIXI.Container();
    this._categoryTabRow.zIndex = 20;
    this._panel.addChild(this._categoryTabRow);

    this._content = new PIXI.Container();
    this._content.zIndex = 10;
    this._panel.addChild(this._content);

    this._contentScroll = new PIXI.Container();
    this._content.addChild(this._contentScroll);

    this._contentMask = new PIXI.Graphics();
    this._panel.addChild(this._contentMask);
    this._content.mask = this._contentMask;

    this._bindContentScrollHandlers();

    this._buildBottomDock();

    this._craftPopup = new FurnitureWorkshopCraftPopup();
    this._craftPopup.zIndex = 60;
    this._panel.addChild(this._craftPopup);

    this._shopPopup = new FurnitureWorkshopShopPopup();
    this._panel.addChild(this._shopPopup);

    this._applyShellLayout();
  }

  /** 壳体缩放与面板定位（对齐每日挑战/图鉴面板用法） */
  private _shellLayout() {
    const shellTex = TextureCache.get('furniture_workshop_panel_shell_nb2');
    const sw = shellTex?.width ?? SHELL.W;
    const sh = shellTex?.height ?? SHELL.H;
    const panelW = DESIGN_WIDTH - 24;
    const scale = panelW / sw;
    const dispH = sh * scale;
    const panelX = DESIGN_WIDTH / 2 - panelW / 2;
    const panelY = Math.max(36, (Game.logicHeight - dispH) / 2);
    const sx = (px: number) => px * scale;
    const sy = (py: number) => py * scale;
    const sxFrac = (frac: number) => sx(sw * frac);
    const syFrac = (frac: number) => sy(sh * frac);
    return { scale, panelX, panelY, panelW, dispH, sw, sh, sx, sy, sxFrac, syFrac, shellTex };
  }

  private _applyShellLayout(): void {
    const layout = this._shellLayout();
    this._layoutScale = layout.scale;
    this._panel.position.set(layout.panelX, layout.panelY);

    const shellTex = layout.shellTex;
    if (shellTex) {
      this._shellSprite.texture = shellTex;
      this._shellSprite.scale.set(layout.scale);
      this._shellSprite.position.set(0, 0);
      this._shellSprite.visible = true;
    } else {
      this._shellSprite.visible = false;
    }

    this._titleText.position.set(layout.sxFrac(0.5), layout.syFrac(SHELL.TITLE_Y_FRAC));
    this._titleText.scale.set(1);

    const closeR = layout.sx(SHELL.CLOSE_HIT_R_PX);
    this._closeHit.position.set(
      layout.sx(SHELL.CLOSE_CX_PX),
      layout.sy(SHELL.CLOSE_CY_PX),
    );
    this._closeHit.hitArea = new PIXI.Circle(0, 0, closeR);

    const barW = layout.sxFrac(1 - SHELL.INNER_PAD_X_FRAC * 2);
    this._resourceLabel.position.set(
      layout.sxFrac(SHELL.RESOURCE_LABEL_X_FRAC),
      layout.syFrac(SHELL.RESOURCE_LABEL_Y_FRAC),
    );
    this._resourceLabel.anchor.set(0.5, 0.5);
    this._resourceLabel.style.fontSize = Math.max(16, Math.round(SHELL.RESOURCE_LABEL_PX * layout.scale));

    this._resourceBar.position.set(
      layout.sxFrac(0.5),
      layout.syFrac(SHELL.RESOURCE_TRAY_CENTER_Y_FRAC),
    );
    const slotStartX = -barW / 2 + layout.sxFrac(SHELL.RESOURCE_SLOT_START_X_FRAC);
    const row1Y = layout.sy(SHELL.RESOURCE_ROW1_OFFSET_Y_PX);
    const row2Y = layout.sy(SHELL.RESOURCE_ROW2_OFFSET_Y_PX);
    const dyeGap = layout.sx(SHELL.RESOURCE_DYE_SLOT_GAP_PX);

    this._layoutResourceCell(this._materialSlot, slotStartX, row1Y, layout);

    this._dyeSlots.forEach((cell, i) => {
      this._layoutResourceCell(cell, slotStartX + i * dyeGap, row2Y, layout);
    });

    this._categoryTabRow.position.set(
      layout.sxFrac(SHELL.INNER_PAD_X_FRAC),
      layout.syFrac(SHELL.CATEGORY_TAB_Y_FRAC),
    );
    this._content.position.set(
      layout.sxFrac(SHELL.INNER_PAD_X_FRAC),
      layout.syFrac(contentTopFrac()),
    );

    this._bottomDock.position.set(0, 0);
    this._shopDockBtn.position.set(
      layout.sxFrac(SHELL.FOOTER_CHIP_X_FRAC),
      layout.syFrac(SHELL.FOOTER_CHIP_Y_FRAC),
    );
    this._layoutShopDockChip(layout);

    this._craftPopup.position.set(layout.sxFrac(0.5), layout.syFrac(SHELL.CRAFT_POPUP_Y_FRAC));
    this._craftPopup.scale.set(layout.scale);

    const shopFit = computeShopPopupFitScale(layout.sw, layout.sh);
    this._shopPopup.position.set(
      layout.sxFrac(0.5),
      layout.syFrac(SHOP_PAGE_TOP_FRAC),
    );
    this._shopPopup.scale.set(layout.scale * shopFit);
    this._shopPopup.zIndex = 58;

    this._panel.sortChildren();
    this.sortChildren();

    this._updateContentMask();
    this._contentScroll.position.y = -this._contentScrollY;
  }

  private _innerContentW(): number {
    const { sxFrac } = this._shellLayout();
    return sxFrac(1 - SHELL.INNER_PAD_X_FRAC * 2);
  }

  private _contentViewportH(): number {
    return blueprintGridViewportH();
  }

  private _updateContentMask(): void {
    const layout = this._shellLayout();
    const w = this._innerContentW();
    const h = this._contentViewportH();
    this._contentMask.clear();
    this._contentMask.beginFill(0xffffff, 1);
    this._contentMask.drawRect(
      layout.sxFrac(SHELL.INNER_PAD_X_FRAC),
      layout.syFrac(contentTopFrac()),
      w,
      h,
    );
    this._contentMask.endFill();

    this._content.eventMode = 'static';
    this._content.hitArea = new PIXI.Rectangle(0, 0, w, h);
  }

  /** 微信小游戏上容器级 pointermove 常丢失，须绑 canvas（与 DecorationPanel 一致） */
  private readonly _onCanvasContentMove = (ev: PointerEvent): void => {
    if (!this._isOpen || !this._contentScrollListening) return;
    const dy = nativeClientToDesignY(ev.clientY) - this._contentScrollStartDesignY;
    this._setContentScroll(this._contentScrollStartScrollY - dy);
  };

  private readonly _onCanvasContentUp = (): void => {
    this._teardownContentScroll();
  };

  private _teardownContentScroll(): void {
    if (!this._contentScrollListening) return;
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.removeEventListener) {
      canvas.removeEventListener('pointermove', this._onCanvasContentMove);
      canvas.removeEventListener('pointerup', this._onCanvasContentUp);
      canvas.removeEventListener('pointercancel', this._onCanvasContentUp);
    }
    this._contentScrollListening = false;
  }

  private _beginContentScroll(e: PIXI.FederatedPointerEvent): void {
    if (!this._isOpen || this._shopPopup.visible || this._contentScrollListening) return;
    this._contentScrollListening = true;
    this._contentScrollStartDesignY = federatedPointerToDesignY(e);
    this._contentScrollStartScrollY = this._contentScrollY;
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.addEventListener) {
      canvas.addEventListener('pointermove', this._onCanvasContentMove);
      canvas.addEventListener('pointerup', this._onCanvasContentUp);
      canvas.addEventListener('pointercancel', this._onCanvasContentUp);
    }
  }

  private _bindContentScrollHandlers(): void {
    this._content.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginContentScroll(e);
    });
  }

  private _setContentScroll(y: number, maxScroll = this._contentMaxScroll()): void {
    this._contentScrollY = Math.max(0, Math.min(maxScroll, y));
    this._contentScroll.position.y = -this._contentScrollY;
  }

  private _contentMaxScroll(contentHeight = 0): number {
    if (contentHeight <= 0) {
      for (const child of this._contentScroll.children) {
        const c = child as PIXI.Container;
        const bottom = c.y + (c.height || 0);
        if (bottom > contentHeight) contentHeight = bottom;
      }
    }
    return Math.max(0, contentHeight - this._contentViewportH());
  }

  private _buildBottomDock(): void {
    this._bottomDock = new PIXI.Container();
    this._panel.addChild(this._bottomDock);

    const chip = this._createDockShopChip(() => this._openShop());
    this._bottomDock.addChild(chip);
    this._shopDockBtn = chip;
  }

  /** 底栏快捷入口：图标下椭圆阴影 + 标签，无白底框 */
  private _createDockShopChip(onTap: () => void): PIXI.Container {
    const root = new PIXI.Container();

    this._shopDockShadow = new PIXI.Graphics();
    root.addChild(this._shopDockShadow);

    const tex = TextureCache.get(SHOP_DOCK_ICON_KEY);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      this._shopDockIcon = sp;
      root.addChild(sp);
    } else {
      this._shopDockIcon = new PIXI.Sprite(PIXI.Texture.EMPTY);
    }

    const txt = new PIXI.Text('图纸商店', textStyle({
      fontSize: SHELL.SHOP_CHIP_LABEL_PX,
      fill: 0x7a579b,
      fontWeight: '900',
    }));
    txt.anchor.set(0.5, 0);
    this._shopDockLabel = txt;
    root.addChild(txt);

    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-62, -68, 124, 142);
    root.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onTap();
    });
    return root;
  }

  /** 图纸商店入口：图标缩放 + 脚下椭圆投影（可点击立体感） */
  private _layoutShopDockChip(layout: ReturnType<typeof this._shellLayout>): void {
    const iconSize = layout.sx(SHELL.SHOP_CHIP_ICON_PX);
    const iconY = -layout.sy(18);

    const dockTex = TextureCache.get(SHOP_DOCK_ICON_KEY);
    if (this._shopDockIcon && dockTex?.width) {
      this._shopDockIcon.texture = dockTex;
      this._shopDockIcon.scale.set(
        iconSize / Math.max(dockTex.width, dockTex.height),
      );
      this._shopDockIcon.y = iconY;
    }

    if (this._shopDockShadow) {
      const shadowY = iconY + iconSize * 0.44 + layout.sy(3);
      this._shopDockShadow.clear();
      this._shopDockShadow.beginFill(0x6b5085, 0.26);
      this._shopDockShadow.drawEllipse(0, shadowY, iconSize * 0.36, iconSize * 0.1);
      this._shopDockShadow.endFill();
    }

    if (this._shopDockLabel) {
      this._shopDockLabel.style.fontSize = Math.max(14, Math.round(SHELL.SHOP_CHIP_LABEL_PX * layout.scale));
      this._shopDockLabel.y = layout.sy(SHELL.SHOP_CHIP_LABEL_Y_PX);
    }
  }

  private _openShop(): void {
    this._hideResourceTip();
    this._shopPopup.open(
      () => this._refreshDockHighlight(),
      () => this._refresh(),
    );
    this._refreshDockHighlight();
  }

  private _createResourceCell(res: (typeof WORKSHOP_RESOURCE_BAR)[number]): PIXI.Container {
    const cell = new PIXI.Container();
    const icon = new PIXI.Sprite(TextureCache.get(res.icon) ?? PIXI.Texture.EMPTY);
    icon.anchor.set(0.5, 0.5);
    if (icon.texture.width) {
      icon.scale.set(SHELL.RESOURCE_ICON_PX / Math.max(icon.texture.width, icon.texture.height));
    }
    if (res.tint != null) icon.tint = res.tint;
    icon.x = -14;
    cell.addChild(icon);

    const qty = new PIXI.Text('0', textStyle({ fontSize: SHELL.RESOURCE_QTY_PX, fill: 0x5c4938, fontWeight: '900' }));
    qty.anchor.set(0, 0.5);
    qty.x = 12;
    cell.addChild(qty);
    this._resourceCountTexts.set(res.id, qty);

    if (getWorkshopResourceHelp(res.id)) {
      cell.eventMode = 'static';
      cell.cursor = 'pointer';
      cell.hitArea = new PIXI.Rectangle(-28, -24, 88, 48);
      cell.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      cell.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._toggleResourceTip(res.id, cell);
      });
    }

    return cell;
  }

  private _hideResourceTip(): void {
    if (this._resourceTipRoot) {
      this._resourceTipRoot.destroy({ children: true });
      this._resourceTipRoot = null;
    }
    this._resourceTipMaterialId = null;
  }

  private _toggleResourceTip(materialId: string, anchorCell: PIXI.Container): void {
    if (this._resourceTipMaterialId === materialId) {
      this._hideResourceTip();
      return;
    }
    this._showResourceTip(materialId, anchorCell);
  }

  private _showResourceTip(materialId: string, anchorCell: PIXI.Container): void {
    const help = getWorkshopResourceHelp(materialId);
    if (!help) return;

    this._hideResourceTip();
    this._resourceTipMaterialId = materialId;

    const layout = this._shellLayout();
    const scale = layout.scale;
    const padX = Math.round(16 * scale);
    const padY = Math.round(12 * scale);
    const cardW = Math.round(288 * scale);
    const innerW = cardW - padX * 2;
    const titleFs = Math.max(16, Math.round(18 * scale));
    const labelFs = Math.max(12, Math.round(13 * scale));
    const bodyFs = Math.max(13, Math.round(14 * scale));
    const sectionGap = Math.round(10 * scale);
    const lineGap = Math.round(5 * scale);
    const leftX = -cardW / 2 + padX;

    const root = new PIXI.Container();
    root.zIndex = 90;
    root.eventMode = 'static';

    let y = padY;

    const title = new PIXI.Text(getWorkshopMaterialDisplayName(materialId), textStyle({
      fontSize: titleFs,
      fill: 0x5c3d8f,
      fontWeight: '900',
    }));
    title.anchor.set(0, 0);
    title.position.set(leftX, y);
    root.addChild(title);
    y += title.height + Math.round(8 * scale);

    const divider = new PIXI.Graphics();
    divider.beginFill(0xe8dcf8, 1);
    divider.drawRect(leftX, y, innerW, Math.max(1, Math.round(1.5 * scale)));
    divider.endFill();
    root.addChild(divider);
    y += Math.round(8 * scale);

    const purposeLabel = new PIXI.Text('用途', textStyle({
      fontSize: labelFs,
      fill: 0x9a86b8,
      fontWeight: '800',
    }));
    purposeLabel.anchor.set(0, 0);
    purposeLabel.position.set(leftX, y);
    root.addChild(purposeLabel);
    y += purposeLabel.height + lineGap;

    const purpose = new PIXI.Text(help.purpose, textStyle({
      fontSize: bodyFs,
      fill: 0x5c4938,
      fontWeight: '600',
      lineHeight: Math.round(bodyFs * 1.5),
      wordWrap: true,
      wordWrapWidth: innerW,
      align: 'left',
    }));
    purpose.anchor.set(0, 0);
    purpose.position.set(leftX, y);
    root.addChild(purpose);
    y += purpose.height + sectionGap;

    const acquireLabel = new PIXI.Text('获取途径', textStyle({
      fontSize: labelFs,
      fill: 0x9a86b8,
      fontWeight: '800',
    }));
    acquireLabel.anchor.set(0, 0);
    acquireLabel.position.set(leftX, y);
    root.addChild(acquireLabel);
    y += acquireLabel.height + lineGap;

    const acquireLines = help.acquire
      .split(/[，,]/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const line of acquireLines) {
      const row = new PIXI.Text(`· ${line}`, textStyle({
        fontSize: bodyFs,
        fill: 0x6b5644,
        fontWeight: '700',
        lineHeight: Math.round(bodyFs * 1.45),
        wordWrap: true,
        wordWrapWidth: innerW - Math.round(4 * scale),
        align: 'left',
      }));
      row.anchor.set(0, 0);
      row.position.set(leftX, y);
      root.addChild(row);
      y += row.height + Math.round(3 * scale);
    }

    const cardH = y + padY - Math.round(3 * scale);

    const bg = new PIXI.Graphics();
    bg.beginFill(0xfffdf8, 0.98);
    bg.lineStyle(2, 0xd4c0f0, 1);
    bg.drawRoundedRect(-cardW / 2, 0, cardW, cardH, Math.round(14 * scale));
    bg.endFill();
    bg.lineStyle(1.5, 0xffffff, 0.65);
    bg.drawRoundedRect(-cardW / 2 + 2, 2, cardW - 4, cardH - 4, Math.round(12 * scale));
    root.addChildAt(bg, 0);

    const anchorLocal = this._panel.toLocal(anchorCell.toGlobal(new PIXI.Point(0, 0)));
    let tipX = anchorLocal.x;
    let tipY = anchorLocal.y + layout.sy(36);
    const minX = layout.sxFrac(SHELL.INNER_PAD_X_FRAC) + cardW / 2 + 4;
    const maxX = layout.sxFrac(1 - SHELL.INNER_PAD_X_FRAC) - cardW / 2 - 4;
    tipX = Math.max(minX, Math.min(maxX, tipX));
    const maxY = layout.syFrac(SHELL.CONTENT_BOTTOM_FRAC) - cardH - 8;
    tipY = Math.min(tipY, maxY);
    root.position.set(tipX, tipY);

    root.hitArea = new PIXI.Rectangle(-cardW / 2, 0, cardW, cardH);
    root.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());

    this._resourceTipRoot = root;
    this._panel.addChild(root);
    this._panel.sortChildren();
  }

  private _layoutResourceCell(
    cell: PIXI.Container,
    x: number,
    y: number,
    layout: ReturnType<FurnitureWorkshopPanel['_shellLayout']>,
  ): void {
    cell.position.set(x, y);
    const icon = cell.children.find(c => c instanceof PIXI.Sprite) as PIXI.Sprite | undefined;
    const qty = cell.children.find(c => c instanceof PIXI.Text) as PIXI.Text | undefined;
    if (icon?.texture.width) {
      const target = layout.sx(SHELL.RESOURCE_ICON_PX);
      icon.scale.set(target / Math.max(icon.texture.width, icon.texture.height));
    }
    if (qty) {
      qty.style.fontSize = Math.max(16, Math.round(SHELL.RESOURCE_QTY_PX * layout.scale));
    }
  }

  private _buildResourceBar(): void {
    this._resourceBar = new PIXI.Container();
    this._panel.addChild(this._resourceBar);

    const [materialDef, ...dyeDefs] = WORKSHOP_RESOURCE_BAR;
    this._materialSlot = this._createResourceCell(materialDef);
    this._resourceBar.addChild(this._materialSlot);

    this._dyeSlots = dyeDefs.map(def => {
      const cell = this._createResourceCell(def);
      this._resourceBar.addChild(cell);
      return cell;
    });
  }

  private _refreshResourceBar(): void {
    for (const res of WORKSHOP_RESOURCE_BAR) {
      const txt = this._resourceCountTexts.get(res.id);
      if (txt) txt.text = String(FurnitureWorkshopManager.getResourceCount(res.id));
    }
  }

  private _rebuildCategoryTabs(): void {
    this._categoryTabRow.removeChildren();
    const layout = this._shellLayout();
    const rowW = this._innerContentW();
    const tabCount = WORKSHOP_CRAFT_CATEGORY_TABS.length;
    const tabH = layout.syFrac(SHELL.CATEGORY_TAB_H_FRAC);
    const tabW = Math.floor((rowW - layout.sxFrac(SHELL.CATEGORY_TAB_GAP_FRAC) * (tabCount - 1)) / tabCount);
    const tabGap = layout.sxFrac(SHELL.CATEGORY_TAB_GAP_FRAC);
    const fontSize = Math.max(16, Math.round(22 * layout.scale));

    WORKSHOP_CRAFT_CATEGORY_TABS.forEach((def, i) => {
      const selected = this._categoryFilter === def.id;
      const tab = new PIXI.Container();
      tab.position.set(i * (tabW + tabGap), 0);

      const bg = new PIXI.Graphics();
      bg.beginFill(selected ? 0xc4a8e8 : 0xe8dcff, 1);
      bg.drawRoundedRect(0, 0, tabW, tabH, tabH / 2);
      bg.endFill();
      if (selected) {
        bg.lineStyle(2, 0xffffff, 0.75);
        bg.drawRoundedRect(1, 1, tabW - 2, tabH - 2, tabH / 2 - 1);
      }
      tab.addChild(bg);

      const txt = new PIXI.Text(def.label, textStyle({
        fontSize,
        fill: selected ? 0xffffff : 0x7a579b,
        fontWeight: '900',
      }));
      txt.anchor.set(0.5);
      txt.position.set(tabW / 2, tabH / 2);
      tab.addChild(txt);

      tab.eventMode = 'static';
      tab.cursor = 'pointer';
      tab.hitArea = new PIXI.Rectangle(0, 0, tabW, tabH);
      tab.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (this._categoryFilter === def.id) return;
        this._categoryFilter = def.id;
        this._contentScrollY = 0;
        this._refresh();
      });

      this._categoryTabRow.addChild(tab);
    });
  }

  private _openCraftPopup(blueprintId: string): void {
    this._hideResourceTip();
    this._craftPopup.open(
      blueprintId,
      () => {},
      (decoId, flyGlobal, isFirstCraft) => {
        const deco = DECO_MAP.get(decoId);
        if (!deco) {
          this._refresh();
          return;
        }
        AudioManager.play('purchase_tap');
        if (isFirstCraft) {
          celebrateDecoObtain(this, deco, flyGlobal);
        } else {
          ToastMessage.show(`制作成功，现有 ${DecorationManager.getOwnedCount(decoId)}/${DecorationManager.getMaxOwned(decoId)} 件`);
        }
        this._refresh();
      },
    );
  }

  private _createRoundButton(label: string, color: number, w: number, h: number, onTap: () => void): PIXI.Container {
    const btn = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(color, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.endFill();
    bg.lineStyle(3, 0xffffff, 0.85);
    bg.drawRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, h / 2 - 2);
    btn.addChild(bg);

    const txt = new PIXI.Text(label, textStyle({
      fontSize: label === '×' ? 34 : 21,
      fill: 0xffffff,
      fontWeight: '900',
    }));
    txt.anchor.set(0.5);
    txt.y = label === '×' ? -2 : 0;
    btn.addChild(txt);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onTap();
    });
    return btn;
  }

  private _refresh(): void {
    this._applyShellLayout();
    this._refreshResourceBar();
    this._refreshDockHighlight();
    this._rebuildCategoryTabs();
    this._contentScroll.removeChildren();
    this._contentScrollY = 0;
    this._renderCraftGrid();
    this._setContentScroll(0);
  }

  private _refreshDockHighlight(): void {
    if (!this._shopDockBtn) return;
    const shopOpen = this._shopPopup?.visible ?? false;
    this._shopDockBtn.alpha = shopOpen ? 1 : 0.92;
    this._shopDockBtn.scale.set(shopOpen ? 1.06 : 1);
    this._categoryTabRow.visible = !shopOpen;
    this._content.visible = !shopOpen;
    this._contentMask.visible = !shopOpen;
    // 图纸商店打开时置于工坊关闭钮之上，保证壳体红 X 热区可点
    if (this._shopPopup) {
      this._shopPopup.zIndex = shopOpen ? 110 : 58;
      this._panel.sortChildren();
    }
  }

  private _renderCraftGrid(): void {
    const owned = filterBlueprintsByCategory(getSortedOwnedBlueprints(), this._categoryFilter);

    if (owned.length === 0) {
      const emptyTitle = this._categoryFilter === 'all'
        ? '还没有图纸'
        : '该分类暂无图纸';
      this._renderEmpty(
        emptyTitle,
        '点击右下角图纸商店，用钻石购买图纸。',
      );
      return;
    }

    const contentW = this._innerContentW();
    const cardW = Math.floor((contentW - BLUEPRINT_GRID_GAP * (BLUEPRINT_GRID_COLS - 1)) / BLUEPRINT_GRID_COLS);
    const cardH = blueprintCardHeight();
    let col = 0;
    let row = 0;

    for (const blueprint of owned) {
      const card = this._createCraftGalleryCard(blueprint, cardW);
      card.x = col * (cardW + BLUEPRINT_GRID_GAP);
      card.y = row * (cardH + BLUEPRINT_GRID_GAP);
      this._contentScroll.addChild(card);
      col++;
      if (col >= BLUEPRINT_GRID_COLS) {
        col = 0;
        row++;
      }
    }

    const totalH = (row + 1) * (cardH + BLUEPRINT_GRID_GAP);
    this._setContentScroll(this._contentScrollY, this._contentMaxScroll(totalH));
  }

  private _renderEmpty(titleText: string, bodyText: string): void {
    const rowW = this._innerContentW();
    const box = new PIXI.Graphics();
    box.beginFill(0xffffff, 0.9);
    box.drawRoundedRect(0, 20, rowW, 230, 24);
    box.endFill();
    this._contentScroll.addChild(box);

    const title = new PIXI.Text(titleText, textStyle({ fontSize: 28, fontWeight: '900', fill: 0x8b65a5 }));
    title.anchor.set(0.5, 0);
    title.position.set(rowW / 2, 56);
    this._contentScroll.addChild(title);

    const body = new PIXI.Text(bodyText, textStyle({
      fontSize: 20,
      fill: 0x735f52,
      lineHeight: 32,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: rowW - 80,
    }));
    body.anchor.set(0.5, 0);
    body.position.set(rowW / 2, 106);
    this._contentScroll.addChild(body);
  }

  private _resolveBlueprintPreviewDecoId(blueprint: WorkshopBlueprintDef): string {
    return blueprint.colorOptions[0]?.outputDecoId ?? blueprint.outputDecoId;
  }

  private _createCraftGalleryCard(blueprint: WorkshopBlueprintDef, cardW: number): PIXI.Container {
    const root = new PIXI.Container();
    const fullyCrafted = FurnitureWorkshopManager.isBlueprintFullyCrafted(blueprint.id);
    const previewDecoId = this._resolveBlueprintPreviewDecoId(blueprint);
    const deco = DECO_MAP.get(previewDecoId);
    const defaultColor = blueprint.colorOptions[0];
    const craftedCount = defaultColor
      ? FurnitureWorkshopManager.getCraftedCount(blueprint.id, defaultColor.id)
      : 0;
    const craftLimit = defaultColor
      ? FurnitureWorkshopManager.getCraftLimit(blueprint.id, defaultColor.id)
      : 1;
    const displayName = getBlueprintDisplayName(blueprint);

    const pad = 12;
    const imageW = cardW - pad * 2;
    const nameY = pad + BLUEPRINT_IMAGE_H + 10;
    const btnY = nameY + 34;
    const cardH = btnY + 52 + pad;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xffffff, fullyCrafted ? 0.88 : 0.96);
    bg.drawRoundedRect(0, 0, cardW, cardH, 18);
    bg.endFill();
    bg.lineStyle(2, fullyCrafted ? 0xc8c0b8 : 0x77c878, 0.95);
    bg.drawRoundedRect(1, 1, cardW - 2, cardH - 2, 17);
    root.addChild(bg);

    const imageFrame = new PIXI.Graphics();
    imageFrame.beginFill(0xfffdf8, 1);
    imageFrame.drawRoundedRect(pad, pad, imageW, BLUEPRINT_IMAGE_H, 14);
    imageFrame.endFill();
    imageFrame.lineStyle(2, 0xe8d4b8, 0.9);
    imageFrame.drawRoundedRect(pad + 1, pad + 1, imageW - 2, BLUEPRINT_IMAGE_H - 2, 13);
    root.addChild(imageFrame);

    const resolvedTex = resolveFurnitureTexture(previewDecoId, deco?.icon ?? '', {});
    const tex = TextureCache.get(resolvedTex.textureKey);
    const preview = new PIXI.Sprite(tex ?? PIXI.Texture.EMPTY);
    preview.anchor.set(0.5);
    if (tex?.width) {
      const fit = Math.min(imageW - 24, BLUEPRINT_IMAGE_H - 24);
      preview.scale.set(Math.min(fit / tex.width, fit / tex.height));
    }
    preview.position.set(cardW / 2, pad + BLUEPRINT_IMAGE_H / 2);
    root.addChild(preview);

    appendWorkshopBlueprintFeatureTags(root, blueprint, pad + imageW - 6, pad + BLUEPRINT_IMAGE_H - 6, {
      fontSize: 15,
      layout: 'vertical',
      gap: 5,
      align: 'right',
      corner: 'bottom-right',
    });

    const name = new PIXI.Text(displayName, textStyle({
      fontSize: 20,
      fill: fullyCrafted ? 0x9a9088 : 0x5c4938,
      fontWeight: '900',
      align: 'center',
      wordWrap: true,
      wordWrapWidth: imageW - 8,
    }));
    name.anchor.set(0.5, 0);
    name.position.set(cardW / 2, nameY);
    root.addChild(name);

    if (fullyCrafted) {
      const badge = new PIXI.Text(
        deco?.stackable ? `已达上限 ${craftedCount}/${craftLimit}` : '已完成',
        textStyle({ fontSize: 18, fill: 0x9a9088, fontWeight: '900' }),
      );
      badge.anchor.set(0.5);
      badge.position.set(cardW / 2, btnY + 22);
      root.addChild(badge);
    } else {
      const btnLabel = deco?.stackable ? `制作 ${craftedCount}/${craftLimit}` : '制作';
      const btn = this._createRoundButton(btnLabel, 0x63b96f, 132, 44, () => this._openCraftPopup(blueprint.id));
      btn.position.set(cardW / 2, btnY + 22);
      root.addChild(btn);
    }

    return root;
  }
}
