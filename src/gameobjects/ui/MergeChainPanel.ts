/**
 * 合成线可视化面板 — 屏幕居中弹窗；NB2 小彩带 + 金边奶油主面板；合成链 4 列网格（无图时矢量回退）
 */
import * as PIXI from 'pixi.js';
import { TweenManager, Ease } from '@/core/TweenManager';
import { Game } from '@/core/Game';
import {
  CELL_GAP,
  DESIGN_WIDTH,
  COLORS,
  FONT_FAMILY,
  BOARD_BAR_HEIGHT,
  BoardMetrics,
} from '@/config/Constants';
import {
  getSourceToolsForProductLine,
  findBoardProducerDef,
  getBoardProducerOutcomePercents,
  type ToolProduceDisplayEntry,
  type ToolDef,
} from '@/config/BuildingConfig';
import { ITEM_DEFS, getMergeChain, Category, InteractType, FlowerLine, type ItemDef } from '@/config/ItemConfig';
import {
  findRepresentativeChestForDrop,
  getChestProduceOutcomePercents,
} from '@/managers/BuildingManager';
import { CellState } from '@/config/BoardLayout';
import { BoardManager } from '@/managers/BoardManager';
import { CollectionManager, CollectionCategory } from '@/managers/CollectionManager';
import { WarehouseManager } from '@/managers/WarehouseManager';
import { TextureCache } from '@/utils/TextureCache';
import { createCurrencyIconCluster } from '@/utils/CurrencyCellIcons';
import { bringToolEnergyToFront, createToolEnergySprite } from '@/utils/ToolEnergyBadge';
import { ToolSparkleLayer } from '@/utils/ToolSparkleLayer';

/** 弹窗最小高度（过矮时仍可读） */
const PANEL_MIN_HEIGHT = 580;
/** 主面板相对设计宽度的左右留白（越小面板越“满屏”） */
const PANEL_SIDE_INSET = 4;
/** 合成链网格左右安全边距（相对设计宽，防止格子贴边溢出底图金边） */
const CHAIN_AREA_PAD_X = 20;
/** 与 ItemView 一致的图标占比 */
const ITEM_CELL_FILL = 0.72;
const BOUQUET_CELL_FILL = 0.9;
/** 三角连接件在水平方向占位（与 stepX 一致） */
const ARROW_W = 24;
const CHAIN_CELL_GAP = CELL_GAP;
/** 合成链网格：每行物品数（与参考图一致） */
const CHAIN_COLS = 4;
const CHAIN_ROW_GAP = CELL_GAP * 2;
/** 链区域与标题/彩带拉开，避免第一行与顶栏视觉重叠 */
const CHAIN_PAD_TOP = 46;

/** 内容区顶部（小彩带 + 面板顶边） */
const SCROLL_TOP = 90;
/** 标题文字纵坐标（叠在彩带上） */
const TITLE_CENTER_Y = 58;
/** 副标题占用底部高度 */
const SUBTITLE_RESERVE = 54;
/** 「获取来源」分隔线 + 文案 + 与格子行的纵向余量（格子高度另加 cellSize） */
const SOURCES_HEADER_H = 52;
const SOURCE_CELL_GAP = CELL_GAP;
/** 「获取来源」整块相对预留区上移，贴近合成链（像素，负值向上） */
const SOURCES_ROOT_OFFSET_Y = -20;
/** 标题彩带最大宽度（随面板略放大） */
const RIBBON_MAX_W = 500;

/** 复用仓库面板关闭钮资源与比例（设计坐标下最长边） */
const MERGE_CLOSE_BTN_MAX_SIDE = 56;
const MERGE_CLOSE_BTN_HIT_PAD = 12;
/** 相对原右上锚位向左、向下微调（更贴彩带内侧） */
const MERGE_CLOSE_BTN_SHIFT_X = 42;
const MERGE_CLOSE_BTN_SHIFT_Y = 26;

/** 获取来源里尚未解锁的工具：仅底图+图标，不用 ADD 星光（否则半透明也像「亮」） */
const SOURCE_TOOL_NOT_OBTAINED_ALPHA = 0.4;

/** 可产出工具：产出预览悬浮框（偏大便于阅读） */
const PRODUCE_POPOVER_PAD = 18;
const PRODUCE_POPOVER_ICON = 66;
const PRODUCE_POPOVER_CELL_GAP = 12;
const PRODUCE_POPOVER_PCT_FONT = 17;

export class MergeChainPanel extends PIXI.Container {
  private _overlay!: PIXI.Graphics;
  private _panel!: PIXI.Container;
  private _bgLayer!: PIXI.Container;
  /** NB2 主面板精灵（动态高度时重算缩放） */
  private _panelCardSp: PIXI.Sprite | null = null;
  private _panelRibbonSp: PIXI.Sprite | null = null;
  private _panelCardGfx: PIXI.Graphics | null = null;
  /** 当前面板总高度（随棋盘区变化） */
  private _panelHeight = 724;
  private _titleText!: PIXI.Text;
  private _subtitleText!: PIXI.Text;
  private _closeBtn!: PIXI.Container;
  private _scrollContainer!: PIXI.Container;
  private _scrollMask!: PIXI.Graphics;
  private _sourcesLayer!: PIXI.Container;
  private _isOpen = false;
  private _ownedItems = new Set<string>();
  /** 当前面板展示的合成链（打开时缓存） */
  private _chainIds: string[] = [];
  /** 用户选中的链上物品（可点击已解锁格切换） */
  private _selectedItemId = '';
  /** 产出预览悬浮层：挂在面板根节点上，避免与滚动区/mask/工具星光混合模式产生错误叠放 */
  private _producePopoverLayer!: PIXI.Container;
  /** 当前正在展示产出列表的工具 id；与选中一致时再次点击可收起 */
  private _producePopoverForId: string | null = null;

  constructor() {
    super();
    this.visible = false;
    this._buildOverlay();
    this._buildPanel();
    this._buildCloseBtn();
    this._buildScrollArea();
    this._buildSourcesLayer();
    this._buildProducePopoverLayer();
    this._syncPanelFrame();
  }

  /** 与截图红框一致：纵向占满棋盘区，上沿贴近棋盘、下沿在底部信息栏之上 */
  private _computePanelGeometry(): { y: number; h: number } {
    const barY = BoardMetrics.topY + BoardMetrics.areaHeight + BOARD_BAR_HEIGHT;
    const top = Math.max(12, BoardMetrics.topY - 14);
    const bottom = Math.min(Game.logicHeight - 12, barY - 8);
    const h = Math.max(PANEL_MIN_HEIGHT, Math.round(bottom - top));
    return { y: top, h };
  }

  private _sourcesSectionHeight(): number {
    return SOURCES_HEADER_H + BoardMetrics.cellSize + 14;
  }

  private _scrollInnerHeight(): number {
    return this._panelHeight - SCROLL_TOP - SUBTITLE_RESERVE - this._sourcesSectionHeight();
  }

  /** 根据当前逻辑高度与棋盘位置更新面板外框、遮罩与底图缩放 */
  private _syncPanelFrame(): void {
    const { y, h } = this._computePanelGeometry();
    this._panelHeight = h;
    this._panel.position.y = y;

    this._subtitleText.position.y = h - SUBTITLE_RESERVE + 4;

    const innerH = this._scrollInnerHeight();
    const pad = PANEL_SIDE_INSET + 6;
    this._scrollMask.clear();
    this._scrollMask.beginFill(0xffffff);
    this._scrollMask.drawRect(pad, SCROLL_TOP, DESIGN_WIDTH - pad * 2, innerH);
    this._scrollMask.endFill();
    this._sourcesLayer.position.y = SCROLL_TOP + innerH;

    const cardTop = 26;
    const cardMaxW = DESIGN_WIDTH - PANEL_SIDE_INSET * 2;
    const cardMaxH = h - cardTop - 8;

    if (this._panelCardSp && this._panelCardSp.texture?.width > 0) {
      const tex = this._panelCardSp.texture;
      const sc = Math.min(cardMaxW / tex.width, cardMaxH / tex.height);
      this._panelCardSp.scale.set(sc);
    } else if (this._panelCardGfx) {
      const g = this._panelCardGfx;
      const x = PANEL_SIDE_INSET;
      const y0 = cardTop;
      const w = DESIGN_WIDTH - PANEL_SIDE_INSET * 2;
      const rOut = 28;
      g.clear();
      g.lineStyle(4, 0xffd700, 0.95);
      g.beginFill(0xfff9e6, 0.98);
      g.drawRoundedRect(x, y0, w, cardMaxH, rOut);
      g.endFill();
      const inset = 5;
      g.lineStyle(2, 0xd97b00, 0.92);
      g.drawRoundedRect(x + inset, y0 + inset, w - inset * 2, cardMaxH - inset * 2, Math.max(12, rOut - inset));
    }

    this._layoutProducePopoverPosition();
  }

  private _buildOverlay(): void {
    this._overlay = new PIXI.Graphics();
    this._overlay.beginFill(0x000000, 0.55);
    this._overlay.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    this._overlay.endFill();
    this._overlay.eventMode = 'static';
    this._overlay.on('pointerdown', () => this.close());
    this.addChild(this._overlay);
  }

  /** NB2 主面板底 + 标题彩带；无纹理时回退矢量 */
  private _buildDecorBackground(): void {
    this._bgLayer = new PIXI.Container();
    const cardTex = TextureCache.get('merge_chain_panel');
    const ribTex = TextureCache.get('merge_chain_ribbon');

    const cardTop = 26;
    const cardMaxW = DESIGN_WIDTH - PANEL_SIDE_INSET * 2;
    const cardMaxH = this._panelHeight - cardTop - 8;

    if (cardTex && cardTex.width > 0) {
      const sp = new PIXI.Sprite(cardTex);
      this._panelCardSp = sp;
      sp.anchor.set(0.5, 0);
      sp.position.set(DESIGN_WIDTH / 2, cardTop);
      const sc = Math.min(cardMaxW / cardTex.width, cardMaxH / cardTex.height);
      sp.scale.set(sc);
      sp.eventMode = 'static';
      sp.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      this._bgLayer.addChild(sp);
    } else {
      const g = new PIXI.Graphics();
      this._panelCardGfx = g;
      const x = PANEL_SIDE_INSET;
      const y = cardTop;
      const w = DESIGN_WIDTH - PANEL_SIDE_INSET * 2;
      const h = cardMaxH;
      const rOut = 28;
      g.lineStyle(4, 0xffd700, 0.95);
      g.beginFill(0xfff9e6, 0.98);
      g.drawRoundedRect(x, y, w, h, rOut);
      g.endFill();
      const inset = 5;
      g.lineStyle(2, 0xd97b00, 0.92);
      g.drawRoundedRect(x + inset, y + inset, w - inset * 2, h - inset * 2, Math.max(12, rOut - inset));
      g.eventMode = 'static';
      g.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      this._bgLayer.addChild(g);
    }

    if (ribTex && ribTex.width > 0) {
      const r = new PIXI.Sprite(ribTex);
      this._panelRibbonSp = r;
      r.anchor.set(0.5, 0);
      const targetW = Math.min(RIBBON_MAX_W, DESIGN_WIDTH - 48);
      r.scale.set(targetW / ribTex.width);
      r.position.set(DESIGN_WIDTH / 2, 8);
      r.eventMode = 'static';
      r.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      this._bgLayer.addChild(r);
    } else {
      const g = new PIXI.Graphics();
      const rw = Math.min(RIBBON_MAX_W, DESIGN_WIDTH - 88);
      const rh = 46;
      const rx = (DESIGN_WIDTH - rw) / 2;
      const ry = 12;
      g.beginFill(0xffb088, 0.98);
      g.drawRoundedRect(rx, ry, rw, rh, 18);
      g.endFill();
      g.lineStyle(2, 0xff7f50, 0.7);
      g.drawRoundedRect(rx, ry, rw, rh, 18);
      g.eventMode = 'static';
      g.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      this._bgLayer.addChild(g);
    }

    this._panel.addChildAt(this._bgLayer, 0);
  }

  private _buildPanel(): void {
    this._panel = new PIXI.Container();
    this._panel.position.set(0, 0);

    this._buildDecorBackground();

    this._titleText = new PIXI.Text('', this._mergeRibbonTitleStyle());
    this._titleText.anchor.set(0.5, 0.5);
    this._titleText.position.set(DESIGN_WIDTH / 2, TITLE_CENTER_Y);
    this._titleText.eventMode = 'static';
    this._titleText.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._panel.addChild(this._titleText);

    this._subtitleText = new PIXI.Text('', {
      fontSize: 15,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
    });
    this._subtitleText.anchor.set(0.5, 0);
    this._subtitleText.position.set(DESIGN_WIDTH / 2, this._panelHeight - SUBTITLE_RESERVE + 4);
    this._panel.addChild(this._subtitleText);

    this.addChild(this._panel);
  }

  /** 合成线彩带标题：深描边 + 略深阴影，在橙/粉彩带上更易辨认 */
  private _mergeRibbonTitleStyle(): PIXI.ITextStyle {
    return {
      fontFamily: FONT_FAMILY,
      fontWeight: '900',
      fontSize: 32,
      fill: 0xffffff,
      stroke: 0x7a4530,
      strokeThickness: 5,
      dropShadow: true,
      dropShadowColor: 0x4a2818,
      dropShadowBlur: 3,
      dropShadowDistance: 2,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: DESIGN_WIDTH - 140,
    } as PIXI.ITextStyle;
  }

  private _buildCloseBtn(): void {
    this._closeBtn = new PIXI.Container();
    this._closeBtn.position.set(
      DESIGN_WIDTH - 48 - MERGE_CLOSE_BTN_SHIFT_X,
      TITLE_CENTER_Y + MERGE_CLOSE_BTN_SHIFT_Y,
    );
    this._closeBtn.eventMode = 'static';
    this._closeBtn.cursor = 'pointer';
    const closeTex = TextureCache.get('warehouse_close_btn');
    const closeSp = new PIXI.Sprite(closeTex ?? PIXI.Texture.EMPTY);
    closeSp.anchor.set(0.5);
    if (closeTex && closeTex.width > 0) {
      const s = MERGE_CLOSE_BTN_MAX_SIDE / Math.max(closeTex.width, closeTex.height);
      closeSp.scale.set(s);
    }
    this._closeBtn.addChild(closeSp);
    const hit = Math.max(MERGE_CLOSE_BTN_MAX_SIDE + MERGE_CLOSE_BTN_HIT_PAD * 2, 72);
    this._closeBtn.hitArea = new PIXI.Circle(0, 0, hit / 2);
    this._closeBtn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._panel.addChild(this._closeBtn);
  }

  private _buildScrollArea(): void {
    const innerH = this._scrollInnerHeight();
    this._scrollContainer = new PIXI.Container();
    this._scrollContainer.position.set(0, SCROLL_TOP);
    this._panel.addChild(this._scrollContainer);

    this._scrollMask = new PIXI.Graphics();
    this._scrollMask.beginFill(0xffffff);
    const pad = PANEL_SIDE_INSET + 6;
    this._scrollMask.drawRect(pad, SCROLL_TOP, DESIGN_WIDTH - pad * 2, innerH);
    this._scrollMask.endFill();
    this._panel.addChild(this._scrollMask);
    this._scrollContainer.mask = this._scrollMask;
  }

  private _buildSourcesLayer(): void {
    this._sourcesLayer = new PIXI.Container();
    this._sourcesLayer.position.set(0, SCROLL_TOP + this._scrollInnerHeight());
    this._panel.addChild(this._sourcesLayer);
  }

  private _buildProducePopoverLayer(): void {
    this._producePopoverLayer = new PIXI.Container();
    this._producePopoverLayer.visible = false;
    this._producePopoverLayer.eventMode = 'static';
    this._producePopoverLayer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    /** 与 _panel 同级且在其后 addChild，保证整块浮层画在链格子/来源行之上（不受 scroll mask 批次影响） */
    this.addChild(this._producePopoverLayer);
    this._panel.setChildIndex(this._closeBtn, this._panel.children.length - 1);
  }

  open(itemId: string): void {
    const chain = getMergeChain(itemId);
    if (chain.length === 0) return;

    this._isOpen = true;
    this.visible = true;
    this._chainIds = chain;
    this._selectedItemId = itemId;
    this._hideProducePopover();

    this._refreshOwnedFromBoard();
    this._applySelectedItemUi();

    this._syncPanelFrame();
    this._renderChain(chain, this._selectedItemId);

    const targetY = this._computePanelGeometry().y;
    this._overlay.alpha = 0;
    this._panel.position.y = Game.logicHeight;
    TweenManager.to({
      target: this._overlay,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._panel.position,
      props: { y: targetY },
      duration: 0.32,
      ease: Ease.easeOutBack,
    });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;

    TweenManager.to({
      target: this._overlay,
      props: { alpha: 0 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._panel.position,
      props: { y: Game.logicHeight },
      duration: 0.26,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this._chainIds = [];
        this._selectedItemId = '';
        this._hideProducePopover();
        this._clearSourcesLayer();
        this._clearChain();
      },
    });
  }

  get isOpen(): boolean { return this._isOpen; }

  /**
   * 仅统计「已开放格」上的物品：迷雾 / 半解锁格内物尚未可操作、也未视为已产出，
   * 合成链展示与图鉴外的「已持有」判定均不采用（链上显示问号，除非图鉴已收录）。
   */
  private _refreshOwnedFromBoard(): void {
    this._ownedItems.clear();
    for (const cell of BoardManager.cells) {
      if (cell.itemId && cell.state === CellState.OPEN) {
        this._ownedItems.add(cell.itemId);
      }
    }
  }

  /**
   * 「获取来源」工具栏：已解锁 = 当前开放棋盘上有 / 仓库槽位中有 / 图鉴已收录该物品。
   * （与合成链格子问号规则一致，并含仓库，避免仅入仓却被当成未获得。）
   */
  private _isSourceToolUnlocked(toolItemId: string, def: ItemDef): boolean {
    if (this._ownedItems.has(toolItemId)) return true;
    for (const id of WarehouseManager.items) {
      if (id === toolItemId) return true;
    }
    return this._isDiscoveredInAlbum(def);
  }

  /** 图鉴已收录（花束/饮品/建筑）；宝箱线等未进图鉴的仍只看棋盘 */
  private _isDiscoveredInAlbum(def: ItemDef): boolean {
    switch (def.category) {
      case Category.FLOWER:
        return CollectionManager.isDiscovered(CollectionCategory.FLOWER, def.id);
      case Category.DRINK:
        return CollectionManager.isDiscovered(CollectionCategory.DRINK, def.id);
      case Category.BUILDING:
        return CollectionManager.isDiscovered(CollectionCategory.BUILDING, def.id);
      case Category.CHEST:
        return CollectionManager.isDiscovered(CollectionCategory.CHEST, def.id);
      case Category.CURRENCY:
        return true;
      default:
        return false;
    }
  }

  /** 链上格子是否展示为已解锁（已开放棋盘上有 / 图鉴有 / 当前选中；半解锁与迷雾不算） */
  private _isChainSlotRevealed(itemId: string, isCurrent: boolean): boolean {
    if (isCurrent) return true;
    if (this._ownedItems.has(itemId)) return true;
    const def = ITEM_DEFS.get(itemId);
    return def ? this._isDiscoveredInAlbum(def) : false;
  }

  /** 根据 _selectedItemId 更新标题、副标题、来源（不重建链格子时由外部先 render） */
  private _applySelectedItemUi(): void {
    const chain = this._chainIds;
    const itemId = this._selectedItemId;
    const def = ITEM_DEFS.get(itemId);
    this._titleText.text = def?.name ?? '';

    if (def && def.level >= def.maxLevel) {
      this._subtitleText.text = '✨ 已达到最高等级！';
    } else if (def) {
      const nextDef = chain[def.level] ? ITEM_DEFS.get(chain[def.level]) : null;
      this._subtitleText.text = nextDef
        ? `合成 2个 ${def.name} 可获得 ${nextDef.name}`
        : '';
    } else {
      this._subtitleText.text = '';
    }
    if (def) this._renderSources(def.category, def.line, def.id);
    else this._clearSourcesLayer();
  }

  private _onChainCellPointerTap(itemId: string): void {
    if (!this._isOpen) return;
    const def = ITEM_DEFS.get(itemId);
    if (!def) return;
    if (!this._isChainSlotRevealed(itemId, itemId === this._selectedItemId)) return;

    const prod = findBoardProducerDef(itemId);
    const isProducer = !!(prod?.canProduce);
    const isChest = def.interactType === InteractType.CHEST;
    const chestEntries = isChest ? getChestProduceOutcomePercents(itemId) : [];
    const hasChestPopover = chestEntries.length > 0;

    if (itemId === this._selectedItemId) {
      if (isProducer && prod) {
        if (this._producePopoverForId === itemId) {
          this._hideProducePopover();
        } else {
          this._showProducePopover(itemId, prod);
        }
      } else if (hasChestPopover) {
        if (this._producePopoverForId === itemId) {
          this._hideProducePopover();
        } else {
          this._showChestProducePopover(itemId);
        }
      }
      return;
    }

    this._selectedItemId = itemId;
    this._refreshOwnedFromBoard();
    this._applySelectedItemUi();
    this._renderChain(this._chainIds, this._selectedItemId);
    if (isProducer && prod) {
      this._showProducePopover(itemId, prod);
    } else if (hasChestPopover) {
      this._showChestProducePopover(itemId);
    } else {
      this._hideProducePopover();
    }
  }

  private _hideProducePopover(): void {
    this._producePopoverForId = null;
    if (!this._producePopoverLayer) return;
    this._producePopoverLayer.visible = false;
    this._producePopoverLayer.removeChildren();
  }

  private _formatOutcomePercent(p: number): string {
    const r = Math.round(p * 10) / 10;
    if (Math.abs(r - Math.round(r)) < 1e-5) return `${Math.round(r)}%`;
    return `${r.toFixed(1)}%`;
  }

  /** 白底圆角卡片 + 产出图标列，锚点在卡片中心 */
  private _buildProducePopoverContent(entries: ToolProduceDisplayEntry[]): {
    w: number;
    h: number;
    root: PIXI.Container;
  } {
    const pad = PRODUCE_POPOVER_PAD;
    const iconBox = PRODUCE_POPOVER_ICON;
    const gap = PRODUCE_POPOVER_CELL_GAP;
    const maxInnerW = DESIGN_WIDTH - 40;

    const content = new PIXI.Container();
    let rowX = 0;
    let rowY = 0;
    let rowH = 0;
    let maxRowW = 0;

    for (const { itemId, percent } of entries) {
      const odef = ITEM_DEFS.get(itemId);
      if (!odef) continue;

      if (rowX + iconBox > maxInnerW && rowX > 0) {
        maxRowW = Math.max(maxRowW, rowX - gap);
        rowX = 0;
        rowY += rowH + gap;
        rowH = 0;
      }

      const col = new PIXI.Container();
      col.position.set(rowX, rowY);

      const cellBg = new PIXI.Graphics();
      cellBg.beginFill(0xfff5ee, 0.95);
      cellBg.drawRoundedRect(0, 0, iconBox, iconBox, 10);
      cellBg.endFill();
      col.addChild(cellBg);

      let iconAdded = false;
      if (odef.category === Category.CURRENCY) {
        const cluster = createCurrencyIconCluster(odef, iconBox);
        if (cluster) {
          col.addChild(cluster);
          iconAdded = true;
        }
      }
      if (!iconAdded) {
        const tex = TextureCache.get(odef.icon);
        if (tex && tex.width > 0) {
          const sp = new PIXI.Sprite(tex);
          const fill =
            odef.line === FlowerLine.BOUQUET || odef.line === FlowerLine.WRAP
              ? BOUQUET_CELL_FILL
              : ITEM_CELL_FILL;
          const maxS = iconBox * fill;
          const sc = Math.min(maxS / tex.width, maxS / tex.height);
          sp.scale.set(sc);
          sp.anchor.set(0.5, 0.5);
          sp.position.set(iconBox / 2, iconBox / 2);
          col.addChild(sp);
        }
      }

      const pct = new PIXI.Text(this._formatOutcomePercent(percent), {
        fontSize: PRODUCE_POPOVER_PCT_FONT,
        fill: 0x3d3530,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      pct.anchor.set(0.5, 0);
      pct.position.set(iconBox / 2, iconBox + 5);
      col.addChild(pct);

      content.addChild(col);
      rowH = Math.max(rowH, iconBox + Math.round(PRODUCE_POPOVER_PCT_FONT * 1.35));
      rowX += iconBox + gap;
    }

    maxRowW = Math.max(maxRowW, rowX > 0 ? rowX - gap : 0, iconBox);
    const totalInnerW = Math.min(maxInnerW, maxRowW);
    const totalInnerH = rowY + rowH;

    const w = totalInnerW + pad * 2;
    const h = totalInnerH + pad * 2;

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x2a2018, 0.22);
    shadow.drawRoundedRect(4, 5, w, h, 20);
    shadow.endFill();

    const card = new PIXI.Graphics();
    card.lineStyle(3, 0xc4a882, 0.95);
    card.beginFill(0xffffff, 0.98);
    card.drawRoundedRect(0, 0, w, h, 18);
    card.endFill();

    content.position.set(pad, pad);

    const root = new PIXI.Container();
    root.addChild(shadow);
    root.addChild(card);
    root.addChild(content);

    return { w, h, root };
  }

  private _showProducePopover(itemId: string, toolDef: ToolDef): void {
    const entries = getBoardProducerOutcomePercents(toolDef);
    this._producePopoverLayer.removeChildren();
    if (entries.length === 0) {
      this._producePopoverForId = null;
      this._producePopoverLayer.visible = false;
      return;
    }
    const { w, h, root } = this._buildProducePopoverContent(entries);
    root.position.set(-w / 2, -h / 2);
    this._producePopoverLayer.addChild(root);
    this._producePopoverForId = itemId;
    this._producePopoverLayer.visible = true;
    this._layoutProducePopoverPosition();
  }

  private _showChestProducePopover(chestItemId: string): void {
    const entries = getChestProduceOutcomePercents(chestItemId);
    this._producePopoverLayer.removeChildren();
    if (entries.length === 0) {
      this._producePopoverForId = null;
      this._producePopoverLayer.visible = false;
      return;
    }
    const { w, h, root } = this._buildProducePopoverContent(entries);
    root.position.set(-w / 2, -h / 2);
    this._producePopoverLayer.addChild(root);
    this._producePopoverForId = chestItemId;
    this._producePopoverLayer.visible = true;
    this._layoutProducePopoverPosition();
  }

  private _layoutProducePopoverPosition(): void {
    if (!this._producePopoverLayer?.visible) return;
    const innerH = this._scrollInnerHeight();
    const px = this._panel.position.x + DESIGN_WIDTH / 2;
    const py = this._panel.position.y + SCROLL_TOP + innerH * 0.52;
    this._producePopoverLayer.position.set(px, py);
    /** 防止外部或后续改动打乱子节点顺序 */
    this.setChildIndex(this._producePopoverLayer, this.children.length - 1);
  }

  /** 点击「获取来源」中的工具：若该工具有合成线则切换面板内容（等同关闭再打开） */
  private _switchToSourceToolIfChain(toolItemId: string): void {
    const chain = getMergeChain(toolItemId);
    if (chain.length === 0) return;
    this._hideProducePopover();
    this._chainIds = chain;
    this._selectedItemId = toolItemId;
    this._refreshOwnedFromBoard();
    this._applySelectedItemUi();
    this._renderChain(chain, toolItemId);
  }

  /** 点击「获取来源」中的宝箱：切换到该档宝箱合成线并展示开箱掉落概率 */
  private _switchToSourceChest(chestItemId: string): void {
    const chain = getMergeChain(chestItemId);
    if (chain.length === 0) return;
    this._hideProducePopover();
    this._chainIds = chain;
    this._selectedItemId = chestItemId;
    this._refreshOwnedFromBoard();
    this._applySelectedItemUi();
    this._renderChain(chain, chestItemId);
    this._showChestProducePopover(chestItemId);
  }

  private _renderChain(chain: string[], currentItemId: string): void {
    this._clearChain();

    const cs = BoardMetrics.cellSize;
    const chainPadTop = CHAIN_PAD_TOP + Math.round(cs * 0.5);
    const innerH = this._scrollInnerHeight();
    const stepX = cs + ARROW_W + CHAIN_CELL_GAP;
    const fullRowW = CHAIN_COLS * cs + (CHAIN_COLS - 1) * (ARROW_W + CHAIN_CELL_GAP);
    const availW = Math.max(200, DESIGN_WIDTH - CHAIN_AREA_PAD_X * 2);
    const rowScale = Math.min(1, availW / fullRowW);

    const chainRoot = new PIXI.Container();
    this._scrollContainer.addChild(chainRoot);
    chainRoot.scale.set(rowScale);
    chainRoot.position.x = (DESIGN_WIDTH - fullRowW * rowScale) / 2;

    let maxBottom = chainPadTop;
    for (let i = 0; i < chain.length; i++) {
      const id = chain[i];
      const row = Math.floor(i / CHAIN_COLS);
      const col = i % CHAIN_COLS;
      const x = col * stepX;
      const y = chainPadTop + row * (cs + CHAIN_ROW_GAP);
      const isCurrent = id === currentItemId;
      const cell = this._createChainCell(id, isCurrent);
      cell.position.set(x, y);
      chainRoot.addChild(cell);
      maxBottom = Math.max(maxBottom, y + cs);

      if (i < chain.length - 1 && col < CHAIN_COLS - 1) {
        const arrow = this._createArrow();
        arrow.position.set(x + cs + CHAIN_CELL_GAP / 2 + ARROW_W / 2, y + cs / 2);
        chainRoot.addChild(arrow);
      }
    }

    const contentH = maxBottom + Math.max(10, Math.round(cs * 0.35));
    const contentVisualH = contentH * rowScale;
    if (contentVisualH > innerH) {
      this._enableVerticalScroll(contentVisualH - innerH);
    }
  }

  /** 与棋盘 CellView 开放格底一致 + 仅图标（同 ItemView 缩放）；选中黄角框同棋盘 */
  private _createChainCell(itemId: string, isCurrent: boolean): PIXI.Container {
    const cell = new PIXI.Container();
    const def = ITEM_DEFS.get(itemId);
    if (!def) return cell;

    const cs = BoardMetrics.cellSize;
    const revealed = this._isChainSlotRevealed(itemId, isCurrent);
    const locked = !revealed;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xfffbf5, 0.55);
    bg.drawRoundedRect(0, 0, cs, cs, 8);
    bg.endFill();
    cell.addChild(bg);

    if (!locked) {
      this._addBoardLikeItemIcon(cell, def, cs);
    } else {
      const q = new PIXI.Text('?', {
        fontSize: Math.round(cs * 0.42),
        fill: 0xe8956a,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      q.anchor.set(0.5, 0.5);
      q.position.set(cs / 2, cs / 2);
      cell.addChild(q);
    }

    if (isCurrent) {
      const selTex = TextureCache.get('ui_cell_selection_corners');
      if (selTex) {
        const corners = new PIXI.Sprite(selTex);
        corners.width = cs;
        corners.height = cs;
        corners.position.set(0, 0);
        cell.addChild(corners);
      }
    }

    if (!locked) {
      cell.eventMode = 'static';
      cell.cursor = 'pointer';
      cell.hitArea = new PIXI.Rectangle(0, 0, cs, cs);
      cell.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._onChainCellPointerTap(itemId);
      });
    }

    return cell;
  }

  /**
   * 棋盘格内绘制物品图标；可产出工具默认加闪光/体力（与 ItemView 一致）。
   * `toolProduceDecor === false` 时跳过星光与体力角标（用于获取来源里未解锁工具的弱显）。
   */
  private _addBoardLikeItemIcon(
    parent: PIXI.Container,
    def: ItemDef,
    cs: number,
    toolProduceDecor = true,
  ): void {
    if (def.category === Category.CURRENCY) {
      const cluster = createCurrencyIconCluster(def, cs);
      if (cluster) {
        parent.addChild(cluster);
        return;
      }
    }

    const tex = TextureCache.get(def.icon);
    if (tex) {
      const sprite = new PIXI.Sprite(tex);
      const fill = (def.line === FlowerLine.BOUQUET || def.line === FlowerLine.WRAP) ? BOUQUET_CELL_FILL : ITEM_CELL_FILL;
      const maxSize = cs * fill;
      const s = Math.min(maxSize / tex.width, maxSize / tex.height);
      sprite.scale.set(s);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(cs / 2, cs / 2);
      parent.addChild(sprite);

      /** 与 ItemView 一致：tool_* 与 flower_wrap_4 等均在 BOARD_PRODUCER / TOOL_DEFS，品类不一定是 BUILDING */
      const producerDef = findBoardProducerDef(def.id);
      if (toolProduceDecor && producerDef?.canProduce) {
        const sparkle = new ToolSparkleLayer(cs, cs);
        sparkle.position.set(0, 0);
        parent.addChild(sparkle);
        const energy = createToolEnergySprite(cs, cs, { maxSideFrac: 0.28, pad: 5 });
        if (energy) {
          parent.addChild(energy);
          bringToolEnergyToFront(parent, energy);
        }
      }
    } else {
      const iconColor = this._getLineColor(def.line);
      const fallback = new PIXI.Graphics();
      fallback.beginFill(iconColor, 0.25);
      fallback.drawCircle(cs / 2, cs / 2, cs * 0.28);
      fallback.endFill();
      parent.addChild(fallback);

      const emoji = new PIXI.Text(this._getCategoryEmoji(def.category), {
        fontSize: Math.round(cs * 0.36),
        fontFamily: FONT_FAMILY,
      });
      emoji.anchor.set(0.5, 0.5);
      emoji.position.set(cs / 2, cs / 2);
      parent.addChild(emoji);
    }
  }

  /** 右指三角 + ×2（陶土色、略浮雕感，对齐参考图） */
  private _createArrow(): PIXI.Container {
    const c = new PIXI.Container();
    const back = -9;
    const tip = 10;
    const halfH = 9;

    const body = new PIXI.Graphics();
    body.beginFill(0x8f6e5e, 0.55);
    body.drawPolygon([back + 1.2, -halfH + 0.8, back + 1.2, halfH - 0.2, tip + 0.8, 0.3]);
    body.endFill();

    body.beginFill(0xc9a088, 1);
    body.drawPolygon([back, -halfH, back, halfH, tip, 0]);
    body.endFill();

    body.lineStyle(1.2, 0xdab9a4, 0.75);
    body.moveTo(back + 0.6, -halfH + 0.8);
    body.lineTo(tip - 2.2, -0.15);

    body.lineStyle(1, 0xa07868, 0.5);
    body.moveTo(back + 0.5, halfH - 0.6);
    body.lineTo(tip - 1.8, 0.35);

    c.addChild(body);

    const txt = new PIXI.Text('×2', {
      fontSize: 10,
      fill: 0xa89488,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    txt.anchor.set(0.5, 0);
    txt.position.set(0, halfH + 3);
    c.addChild(txt);

    return c;
  }

  private _enableVerticalScroll(maxOffset: number): void {
    let dragging = false;
    let startY = 0;
    let startScrollY = 0;
    const innerH = this._scrollInnerHeight();
    const topY = SCROLL_TOP;

    this._scrollContainer.eventMode = 'static';
    this._scrollContainer.hitArea = new PIXI.Rectangle(0, 0, DESIGN_WIDTH, innerH);

    this._scrollContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      dragging = true;
      startY = e.global.y;
      startScrollY = this._scrollContainer.position.y;
    });
    this._scrollContainer.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!dragging) return;
      const dy = e.global.y - startY;
      let newY = startScrollY + dy;
      newY = Math.max(topY - maxOffset, Math.min(topY, newY));
      this._scrollContainer.position.y = newY;
    });
    this._scrollContainer.on('pointerup', () => { dragging = false; });
    this._scrollContainer.on('pointerupoutside', () => { dragging = false; });
  }

  private _clearChain(): void {
    while (this._scrollContainer.children.length > 0) {
      const child = this._scrollContainer.children[0];
      this._scrollContainer.removeChild(child);
      child.destroy({ children: true });
    }
    this._scrollContainer.position.set(0, SCROLL_TOP);
    this._scrollContainer.eventMode = 'auto';
    this._scrollContainer.removeAllListeners();
  }

  private _clearSourcesLayer(): void {
    while (this._sourcesLayer.children.length > 0) {
      const ch = this._sourcesLayer.children[0];
      this._sourcesLayer.removeChild(ch);
      ch.destroy({ children: true });
    }
  }

  private _renderSources(category: Category, productLine: string, selectedItemId: string): void {
    this._clearSourcesLayer();
    const root = new PIXI.Container();
    root.position.y = SOURCES_ROOT_OFFSET_Y;
    this._sourcesLayer.addChild(root);

    const mid = DESIGN_WIDTH / 2;
    const lineY = 14;
    const lineInset = 108;
    const labelGapHalf = 78;
    const lineG = new PIXI.Graphics();
    lineG.lineStyle(2, 0xd4c4b0, 0.88);
    lineG.moveTo(lineInset, lineY);
    lineG.lineTo(mid - labelGapHalf, lineY);
    lineG.moveTo(mid + labelGapHalf, lineY);
    lineG.lineTo(DESIGN_WIDTH - lineInset, lineY);
    root.addChild(lineG);

    const label = new PIXI.Text('获取来源', {
      fontSize: 22,
      fill: 0x7a6a58,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(mid, lineY);
    root.addChild(label);

    const cs = BoardMetrics.cellSize;
    const rowY = 30;

    let ids: string[] = [];
    const selectedDef = ITEM_DEFS.get(this._selectedItemId ?? '');
    if (!selectedDef || selectedDef.interactType === InteractType.NONE) {
      ids = getSourceToolsForProductLine(category, productLine);
    }

    const chainItemDef = ITEM_DEFS.get(selectedItemId);
    const representativeChestId =
      chainItemDef &&
      chainItemDef.interactType === InteractType.NONE
        ? findRepresentativeChestForDrop(category, productLine, chainItemDef.level)
        : null;
    const showChest = representativeChestId !== null;

    const nSlots = ids.length + (showChest ? 1 : 0);
    if (nSlots === 0) {
      this._appendSourcesFooterHint(root, rowY + 8, mid);
      return;
    }

    const availW = DESIGN_WIDTH - 48;
    const totalW = nSlots * cs + (nSlots - 1) * SOURCE_CELL_GAP;
    const row = new PIXI.Container();
    row.position.set(0, rowY);

    let x = 0;
    for (const tid of ids) {
      const slot = this._createSourceBoardCell(tid);
      slot.position.set(x, 0);
      row.addChild(slot);
      x += cs + SOURCE_CELL_GAP;
    }
    if (showChest && representativeChestId) {
      const chestSlot = this._createChestSourceIconCell(representativeChestId);
      chestSlot.position.set(x, 0);
      row.addChild(chestSlot);
    }

    if (totalW <= availW) {
      row.position.x = (DESIGN_WIDTH - totalW) / 2;
    } else {
      const padX = 24;
      row.position.x = padX;
      const maskG = new PIXI.Graphics();
      maskG.beginFill(0xffffff);
      maskG.drawRect(padX, rowY, availW, cs + 8);
      maskG.endFill();
      root.addChild(maskG);
      row.mask = maskG;
      this._enableSourcesRowScroll(row, totalW - availW, totalW, cs, padX);
    }

    root.addChild(row);
    this._appendSourcesFooterHint(root, rowY + cs + 18, mid);
  }

  /** 获取来源下方：活动/任务等补充说明（非工具链查看时） */
  private _appendSourcesFooterHint(root: PIXI.Container, y0: number, mid: number): void {
    const selDef = ITEM_DEFS.get(this._selectedItemId ?? '');
    if (selDef && selDef.interactType !== InteractType.NONE) return;
    const style = { fontSize: 14, fill: 0x9a8b7a, fontFamily: FONT_FAMILY };
    const ev = new PIXI.Text('· 限时活动、任务等可能产出额外奖励', style);
    ev.anchor.set(0.5, 0);
    ev.position.set(mid, y0);
    root.addChild(ev);
  }

  /** 获取来源：可点击切换到对应档位宝箱合成线并查看开箱掉落概率 */
  private _createChestSourceIconCell(chestItemId: string): PIXI.Container {
    const cell = new PIXI.Container();
    const cs = BoardMetrics.cellSize;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xfffbf5, 0.55);
    bg.drawRoundedRect(0, 0, cs, cs, 8);
    bg.endFill();
    cell.addChild(bg);

    const chestDef = ITEM_DEFS.get(chestItemId);
    const iconKey = chestDef?.icon ?? 'icon_gift';
    const tex = TextureCache.get(iconKey);
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      const maxSize = cs * ITEM_CELL_FILL;
      const s = Math.min(maxSize / tex.width, maxSize / tex.height);
      sp.scale.set(s);
      sp.anchor.set(0.5, 0.5);
      sp.position.set(cs / 2, cs / 2);
      cell.addChild(sp);
    } else {
      const q = new PIXI.Text('📦', {
        fontSize: Math.round(cs * 0.42),
        fontFamily: FONT_FAMILY,
      });
      q.anchor.set(0.5, 0.5);
      q.position.set(cs / 2, cs / 2);
      cell.addChild(q);
    }

    cell.eventMode = 'static';
    cell.cursor = 'pointer';
    cell.hitArea = new PIXI.Rectangle(0, 0, cs, cs);
    cell.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._switchToSourceChest(chestItemId);
    });

    return cell;
  }

  private _createSourceBoardCell(toolItemId: string): PIXI.Container {
    const cell = new PIXI.Container();
    const def = ITEM_DEFS.get(toolItemId);
    if (!def) return cell;

    const cs = BoardMetrics.cellSize;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xfffbf5, 0.55);
    bg.drawRoundedRect(0, 0, cs, cs, 8);
    bg.endFill();
    cell.addChild(bg);

    const unlocked = this._isSourceToolUnlocked(toolItemId, def);
    const iconLayer = new PIXI.Container();
    this._addBoardLikeItemIcon(iconLayer, def, cs, unlocked);
    iconLayer.alpha = unlocked ? 1 : SOURCE_TOOL_NOT_OBTAINED_ALPHA;
    cell.addChild(iconLayer);

    const canOpenChain = getMergeChain(toolItemId).length > 1;
    if (canOpenChain) {
      cell.eventMode = 'static';
      cell.cursor = 'pointer';
      cell.hitArea = new PIXI.Rectangle(0, 0, cs, cs);
      cell.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._switchToSourceToolIfChain(toolItemId);
      });
    }

    return cell;
  }

  private _enableSourcesRowScroll(
    row: PIXI.Container,
    maxOffset: number,
    contentW: number,
    cellH: number,
    padX: number,
  ): void {
    let dragging = false;
    let startX = 0;
    let startRowX = 0;
    row.eventMode = 'static';
    row.cursor = 'pointer';
    row.hitArea = new PIXI.Rectangle(0, 0, contentW, cellH + 8);

    row.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      dragging = true;
      startX = e.global.x;
      startRowX = row.position.x;
    });
    row.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!dragging) return;
      const dx = e.global.x - startX;
      let nx = startRowX + dx;
      nx = Math.max(padX - maxOffset, Math.min(padX, nx));
      row.position.x = nx;
    });
    row.on('pointerup', () => { dragging = false; });
    row.on('pointerupoutside', () => { dragging = false; });
  }

  private _getLineColor(line: string): number {
    const map: Record<string, number> = {
      fresh: COLORS.FLOWER_FRESH,
      bouquet: COLORS.FLOWER_BOUQUET,
      green: COLORS.FLOWER_GREEN,
      butterfly: COLORS.DRINK_BUTTERFLY,
      cold: COLORS.DRINK_COLD,
      dessert: COLORS.DRINK_DESSERT,
    };
    return map[line] || 0x999999;
  }

  private _getCategoryEmoji(category: Category): string {
    switch (category) {
      case Category.FLOWER: return '🌸';
      case Category.DRINK: return '🦋';
      case Category.BUILDING: return '🏠';
      case Category.CHEST: return '📦';
      case Category.CURRENCY: return '💰';
      default: return '❓';
    }
  }
}
