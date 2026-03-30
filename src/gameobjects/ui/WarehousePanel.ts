/**
 * 仓库面板 - 花篮整图底 + 顶栏「仓库」/底栏「扩容」+ 奶油区 5 列自适应行数格子
 *
 * 底图：minigame/images/ui/warehouse_panel_bg.png（可用 scripts/matte_warehouse_panel.py 重抠压边）
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { Game } from '@/core/Game';
import { CELL_GAP, DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, Category, FlowerLine } from '@/config/ItemConfig';
import { WarehouseManager } from '@/managers/WarehouseManager';
import { BuildingManager } from '@/managers/BuildingManager';
import { BoardManager } from '@/managers/BoardManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { findBoardProducerDef } from '@/config/BuildingConfig';
import { TextureCache } from '@/utils/TextureCache';
import { bringToolEnergyToFront, createToolEnergySprite } from '@/utils/ToolEnergyBadge';
import { ToolSparkleLayer } from '@/utils/ToolSparkleLayer';
import { ToastMessage } from './ToastMessage';
import { ConfirmDialog } from './ConfirmDialog';

const TEX_W = 768;
const TEX_H = 1376;

/** 与棋盘 ItemView 一致的图标占比 */
const WH_ITEM_FILL = 0.72;
const WH_BOUQUET_FILL = 0.9;

/** 偏圆、偏可爱的中文回退栈（微信常见系统字体） */
const FONT_CUTE = `'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans SC',${FONT_FAMILY}`;

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 对齐微调（坐标相对整图中心，单位 = 底图像素；右/下为正）
 * 改这里即可：顶栏「仓库」、底栏「扩容+钻+数字」、右上角关闭钮见下方 CLOSE_BTN_*
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
const HEADER_TITLE_X = 0;
/** 下移（增大 Y）更靠下，进入上方面紫条 */
const HEADER_TITLE_Y = -450;
const FOOTER_ROW_X = 0;
/** 减小 Y 更靠上，离开最底藤编，落回下方面紫条 */
const FOOTER_ROW_Y = 295;

/**
 * 关闭钮 `warehouse_close_btn`（与顶栏同一坐标系：相对花篮底图中心，右 + / 下 +）
 * - CLOSE_BTN_X 增大 → 往右；减小 → 往左
 * - CLOSE_BTN_Y 增大 → 往下；减小 → 往上
 * - CLOSE_BTN_MAX_SIDE：显示时最长边（底图像素），整体缩放
 * - CLOSE_BTN_HIT_PAD：点击热区在图标外扩多少，方便手指点
 */
const CLOSE_BTN_X = 255;
const CLOSE_BTN_Y = -425;
const CLOSE_BTN_MAX_SIDE = 78;
const CLOSE_BTN_HIT_PAD = 12;

/**
 * 奶油格区（仅中间奶油，不含上下紫条；格子 1:1 正方形画在此矩形内）
 * left/top 相对纹理中心；与棋盘 CELL_GAP 一致用 Constants.CELL_GAP
 */
const CREAM = {
  left: -270,
  top: -476,
  width: 540,
  height: 856,
};

const GRID_COLS = 5;
/** 与棋盘格子间距一致（见 Constants.CELL_GAP） */
const GRID_GAP = CELL_GAP;

/**
 * 相对 CREAM 再内缩，避免格子与上下紫条重叠（已缩小留白，让格区更大）。
 * 若与条重叠：略增 GRID_INSET_TOP/BOTTOM；若仍太靠边：略减 CREAM.width/height。
 */
const GRID_INSET_TOP = 48;
const GRID_INSET_BOTTOM = 66;
const GRID_INSET_X = 6;

/** 行数上限 */
const MAX_GRID_ROWS = 6;

/**
 * 整块格子容器缩放（越大格越大；1.0 为逻辑尺寸满铺安全区宽向）。
 */
const GRID_VISUAL_SCALE = 0.96;

interface GridLayout {
  rows: number;
  /** 正方形边长（逻辑尺寸，再乘 GRID_VISUAL_SCALE 显示） */
  cellSize: number;
  gap: number;
  /** 相对 CREAM 左上角偏移（已含内缩；已按缩放后视觉包络居中） */
  offX: number;
  offY: number;
}

/**
 * 5 列、1:1 正方形；在安全区内排版，行数 ≤ MAX_GRID_ROWS，
 * cellSize = min(按宽, 按当前行数高度)，保证整块网格不超高。
 */
function computeGrid(): GridLayout {
  const gap = GRID_GAP;
  const innerW = Math.max(40, CREAM.width - GRID_INSET_X * 2);
  const innerH = Math.max(40, CREAM.height - GRID_INSET_TOP - GRID_INSET_BOTTOM);

  const cellByWidth = (innerW - gap * (GRID_COLS - 1)) / GRID_COLS;

  let rows = Math.min(
    MAX_GRID_ROWS,
    Math.max(2, Math.floor((innerH + gap) / (cellByWidth + gap))),
  );

  let cellSize = Math.min(cellByWidth, (innerH - gap * (rows - 1)) / rows);
  let gridW = GRID_COLS * cellSize + (GRID_COLS - 1) * gap;
  let gridH = rows * cellSize + (rows - 1) * gap;

  while (gridH > innerH + 0.5 && rows > 2) {
    rows -= 1;
    cellSize = Math.min(cellByWidth, (innerH - gap * (rows - 1)) / rows);
    gridW = GRID_COLS * cellSize + (GRID_COLS - 1) * gap;
    gridH = rows * cellSize + (rows - 1) * gap;
  }

  const sc = GRID_VISUAL_SCALE;
  const visW = gridW * sc;
  const visH = gridH * sc;
  const offX = GRID_INSET_X + (innerW - visW) / 2;
  const offY = GRID_INSET_TOP + (innerH - visH) / 2;

  return { rows, cellSize, gap, offX, offY };
}

export class WarehousePanel extends PIXI.Container {
  private _overlay!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _basketSprite!: PIXI.Sprite;
  /** 顶栏：仅「仓库」 */
  private _headerTitle!: PIXI.Text;
  /** 底栏 */
  private _footerRoot!: PIXI.Container;
  private _expandWord!: PIXI.Text;
  private _gemSprite!: PIXI.Sprite;
  private _footerCost!: PIXI.Text;
  private _footerLocked!: PIXI.Text;
  private _slotContainer!: PIXI.Container;
  /** NB2 关闭钮，叠在最上层 */
  private _closeBtn!: PIXI.Container;
  private _isOpen = false;

  constructor() {
    super();
    this.visible = false;
    this._buildOverlay();
    this._buildContent();
    this._bindEvents();
  }

  private _buildOverlay(): void {
    this._overlay = new PIXI.Graphics();
    this._overlay.beginFill(0x000000, 0.5);
    this._overlay.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    this._overlay.endFill();
    this._overlay.eventMode = 'static';
    this._overlay.on('pointerdown', () => this.close());
    this.addChild(this._overlay);
  }

  private _cuteTextStyle(base: Partial<PIXI.ITextStyle>): PIXI.ITextStyle {
    return {
      fontFamily: FONT_CUTE,
      fontWeight: '900',
      fill: 0xfff5ff,
      stroke: 0xb794f6,
      strokeThickness: 5,
      dropShadow: true,
      dropShadowColor: 0x6b4a9e,
      dropShadowBlur: 3,
      dropShadowDistance: 2,
      ...base,
    } as PIXI.ITextStyle;
  }

  private _buildContent(): void {
    this._content = new PIXI.Container();
    this._content.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._content.eventMode = 'static';

    const tapBlock = new PIXI.Sprite(PIXI.Texture.WHITE);
    tapBlock.anchor.set(0.5);
    tapBlock.width = TEX_W;
    tapBlock.height = TEX_H;
    tapBlock.alpha = 0;
    tapBlock.eventMode = 'static';
    tapBlock.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._content.addChild(tapBlock);

    const tex = TextureCache.get('warehouse_panel_bg');
    this._basketSprite = new PIXI.Sprite(tex ?? PIXI.Texture.EMPTY);
    this._basketSprite.anchor.set(0.5);
    this._basketSprite.position.set(0, 0);
    this._basketSprite.eventMode = 'static';
    this._basketSprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._content.addChild(this._basketSprite);

    this._slotContainer = new PIXI.Container();
    this._slotContainer.position.set(CREAM.left, CREAM.top);
    this._content.addChild(this._slotContainer);

    this._headerTitle = new PIXI.Text('仓库', this._cuteTextStyle({ fontSize: 36 }));
    this._headerTitle.anchor.set(0.5, 0.5);
    this._headerTitle.position.set(HEADER_TITLE_X, HEADER_TITLE_Y);
    this._headerTitle.eventMode = 'static';
    this._headerTitle.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._content.addChild(this._headerTitle);

    this._footerRoot = new PIXI.Container();
    this._footerRoot.position.set(FOOTER_ROW_X, FOOTER_ROW_Y);
    this._footerRoot.eventMode = 'static';

    this._expandWord = new PIXI.Text('扩容', this._cuteTextStyle({ fontSize: 28 }));
    this._expandWord.anchor.set(0.5, 0.5);

    const gemTex = TextureCache.get('icon_gem');
    this._gemSprite = new PIXI.Sprite(gemTex ?? PIXI.Texture.EMPTY);
    this._gemSprite.anchor.set(0.5, 0.5);

    this._footerCost = new PIXI.Text('', this._cuteTextStyle({ fontSize: 28 }));

    this._footerLocked = new PIXI.Text('已达上限', this._cuteTextStyle({ fontSize: 22, fill: 0xeee8ff }));
    this._footerLocked.anchor.set(0.5, 0.5);
    this._footerLocked.visible = false;

    this._footerRoot.addChild(this._expandWord);
    this._footerRoot.addChild(this._gemSprite);
    this._footerRoot.addChild(this._footerCost);
    this._footerRoot.addChild(this._footerLocked);

    this._footerRoot.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      if (WarehouseManager.canExpand) void this._onExpandTap();
    });
    this._content.addChild(this._footerRoot);

    this._closeBtn = new PIXI.Container();
    this._closeBtn.position.set(CLOSE_BTN_X, CLOSE_BTN_Y);
    this._closeBtn.eventMode = 'static';
    this._closeBtn.cursor = 'pointer';
    const closeTex = TextureCache.get('warehouse_close_btn');
    const closeSp = new PIXI.Sprite(closeTex ?? PIXI.Texture.EMPTY);
    closeSp.anchor.set(0.5);
    if (closeTex && closeTex.width > 0) {
      const s = CLOSE_BTN_MAX_SIDE / Math.max(closeTex.width, closeTex.height);
      closeSp.scale.set(s);
    }
    this._closeBtn.addChild(closeSp);
    const hit = Math.max(CLOSE_BTN_MAX_SIDE + CLOSE_BTN_HIT_PAD * 2, 88);
    this._closeBtn.hitArea = new PIXI.Circle(0, 0, hit / 2);
    this._closeBtn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._content.addChild(this._closeBtn);

    this.addChild(this._content);
  }

  /** 底栏：扩容 + 钻石 + 数字 水平居中 */
  private _layoutFooterExpand(): void {
    const pad = 10;
    const iconH = 34;
    if (this._gemSprite.texture?.width) {
      const t = this._gemSprite.texture;
      const s = iconH / Math.max(t.height, 1);
      this._gemSprite.scale.set(s);
    } else {
      this._gemSprite.scale.set(1);
    }

    this._footerCost.anchor.set(0.5, 0.5);
    const wEx = this._expandWord.width;
    const wGem = this._gemSprite.width;
    const wCost = this._footerCost.width;
    const total = wEx + pad + wGem + pad + wCost;
    let x = -total / 2;
    this._expandWord.position.set(x + wEx / 2, 0);
    x += wEx + pad;
    this._gemSprite.position.set(x + wGem / 2, 0);
    x += wGem + pad;
    this._footerCost.position.set(x + wCost / 2, 0);

    const hitPadX = 40;
    const hitPadY = 28;
    this._footerRoot.hitArea = new PIXI.Rectangle(
      -total / 2 - hitPadX,
      -hitPadY,
      total + hitPadX * 2,
      hitPadY * 2,
    );
    this._footerRoot.cursor = 'pointer';
  }

  private _bindEvents(): void {
    EventBus.on('warehouse:changed', () => {
      if (this._isOpen) this._refreshSlots();
    });
  }

  /** 花篮中心在屏外下方的 Y（打开滑入 / 关闭滑出，与 MergeChainPanel 同类动效） */
  private _warehouseContentHideY(s1: number): number {
    const th = this._basketSprite.texture?.height || TEX_H;
    return Game.logicHeight + Math.ceil(th * s1 * 0.52) + 48;
  }

  open(): void {
    this._isOpen = true;
    this.visible = true;
    this._refreshSlots();

    const tw = this._basketSprite.texture?.width || TEX_W;
    const th = this._basketSprite.texture?.height || TEX_H;
    const s1 = Math.min((DESIGN_WIDTH - 36) / tw, (Game.logicHeight - 72) / th, 1);
    const s0 = s1 * 0.92;
    const cx = DESIGN_WIDTH / 2;
    const cyOpen = Game.logicHeight / 2;
    const yFrom = this._warehouseContentHideY(s1);

    this._content.scale.set(s0);
    this._content.position.set(cx, yFrom);
    this._content.alpha = 1;

    this._overlay.alpha = 0;

    TweenManager.to({
      target: this._overlay,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._content.position,
      props: { y: cyOpen },
      duration: 0.32,
      ease: Ease.easeOutBack,
    });
    TweenManager.to({
      target: this._content.scale,
      props: { x: s1, y: s1 },
      duration: 0.32,
      ease: Ease.easeOutBack,
    });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;

    const s1 = this._content.scale.x;
    const yTo = this._warehouseContentHideY(s1);
    const cx = DESIGN_WIDTH / 2;

    TweenManager.to({
      target: this._overlay,
      props: { alpha: 0 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._content.position,
      props: { y: yTo },
      duration: 0.26,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this._content.position.set(cx, Game.logicHeight / 2);
      },
    });
  }

  get isOpen(): boolean { return this._isOpen; }

  private _refreshSlots(): void {
    while (this._slotContainer.children.length > 0) {
      const child = this._slotContainer.children[0];
      this._slotContainer.removeChild(child);
      child.destroy({ children: true });
    }

    const cap = WarehouseManager.capacity;
    const items = WarehouseManager.items;
    const grid = computeGrid();
    const { rows, cellSize, gap, offX, offY } = grid;

    this._slotContainer.scale.set(GRID_VISUAL_SCALE);
    this._slotContainer.position.set(CREAM.left + offX, CREAM.top + offY);

    this._headerTitle.text = '仓库';
    this._headerTitle.position.set(HEADER_TITLE_X, HEADER_TITLE_Y);
    this._footerRoot.position.set(FOOTER_ROW_X, FOOTER_ROW_Y);

    if (WarehouseManager.canExpand) {
      this._expandWord.visible = true;
      this._gemSprite.visible = true;
      this._footerCost.visible = true;
      this._footerLocked.visible = false;
      this._footerCost.text = `${WarehouseManager.expandCost}`;
      this._layoutFooterExpand();
    } else {
      this._expandWord.visible = false;
      this._gemSprite.visible = false;
      this._footerCost.visible = false;
      this._footerLocked.visible = true;
      this._footerLocked.anchor.set(0.5, 0.5);
      this._footerLocked.position.set(0, 0);
      this._footerRoot.hitArea = new PIXI.Rectangle(-120, -22, 240, 44);
      this._footerRoot.cursor = 'default';
    }

    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const locked = idx >= cap;
        const itemId = !locked ? (items[idx] || null) : null;
        const slot = this._createSlot(idx, itemId, cellSize, locked);
        slot.position.set(c * (cellSize + gap), r * (cellSize + gap));
        this._slotContainer.addChild(slot);
        idx += 1;
      }
    }
  }

  private _createSlot(
    index: number,
    itemId: string | null,
    s: number,
    locked: boolean,
  ): PIXI.Container {
    const slot = new PIXI.Container();
    /** 与棋盘 CellView 圆角一致（格小时略缩） */
    const rad = Math.min(8, Math.max(4, s * 0.11));
    const inset = Math.max(2, Math.min(4, s * 0.06));
    const innerR = Math.min(8, Math.max(3, (s - inset * 2) * 0.12));

    const bg = new PIXI.Graphics();
    if (locked) {
      bg.lineStyle(1.5, COLORS.CELL_BORDER, 0.45);
      bg.beginFill(0xd8ccbe, 0.35);
      bg.drawRoundedRect(0, 0, s, s, rad);
      bg.endFill();
      slot.addChild(bg);
      // 必须先铺底再叠锁，否则格底会盖住 `warehouse_slot_lock` 图标
      const lockTex = TextureCache.get('warehouse_slot_lock');
      if (lockTex && lockTex.width > 0) {
        const sp = new PIXI.Sprite(lockTex);
        const fit = s * 0.64;
        const sc = Math.min(fit / lockTex.width, fit / lockTex.height);
        sp.scale.set(sc);
        sp.anchor.set(0.5, 0.5);
        sp.position.set(s / 2, s / 2);
        slot.addChild(sp);
      } else {
        const lock = new PIXI.Text('🔒', {
          fontSize: Math.min(22, s * 0.28),
          fontFamily: FONT_FAMILY,
        });
        lock.anchor.set(0.5, 0.5);
        lock.position.set(s / 2, s / 2);
        lock.alpha = 0.55;
        slot.addChild(lock);
      }
      return slot;
    } else if (itemId) {
      const def = ITEM_DEFS.get(itemId);
      const tex0 = def ? TextureCache.get(def.icon) : null;
      const hasTex = !!(tex0 && tex0.width > 0);
      if (hasTex) {
        // 与棋盘一致：格缘 + 浅底，物品由图标叠上（无内圈装饰）
        bg.lineStyle(1.5, COLORS.CELL_BORDER, 0.85);
        bg.beginFill(0xfffbf5, 0.55);
        bg.drawRoundedRect(0, 0, s, s, rad);
        bg.endFill();
      } else {
        const lineColor = def ? this._getLineColor(def.line) : COLORS.CELL_BORDER;
        bg.lineStyle(1.5, COLORS.CELL_BORDER, 0.85);
        bg.beginFill(lineColor, 0.12);
        bg.drawRoundedRect(inset, inset, s - inset * 2, s - inset * 2, innerR);
        bg.endFill();
        bg.beginFill(lineColor, 0.22);
        bg.drawCircle(s / 2, s / 2 - s * 0.04, s * 0.28);
        bg.endFill();
      }
    } else {
      // 空格：与 CellView 开放格米白底一致
      bg.lineStyle(1.5, COLORS.CELL_BORDER, 0.5);
      bg.beginFill(0xfffbf5, 0.55);
      bg.drawRoundedRect(0, 0, s, s, rad);
      bg.endFill();
    }
    slot.addChild(bg);

    if (itemId) {
      const def = ITEM_DEFS.get(itemId);
      if (def) {
        const fill = (def.line === FlowerLine.BOUQUET || def.line === FlowerLine.WRAP) ? WH_BOUQUET_FILL : WH_ITEM_FILL;
        const maxIcon = s * fill;
        const tex = TextureCache.get(def.icon);
        if (tex && tex.width > 0) {
          const sprite = new PIXI.Sprite(tex);
          const sc = Math.min(maxIcon / tex.width, maxIcon / tex.height);
          sprite.scale.set(sc);
          sprite.anchor.set(0.5, 0.5);
          sprite.position.set(s / 2, s / 2);
          slot.addChild(sprite);
          // 与 ItemView 一致：仅 BOARD_PRODUCER 且 canProduce 才叠闪光与体力角标
          const producerDef = findBoardProducerDef(def.id);
          if (producerDef?.canProduce) {
            slot.addChild(new ToolSparkleLayer(s, s));
            const energy = createToolEnergySprite(s, s, { maxSideFrac: 0.30, pad: 4 });
            if (energy) {
              slot.addChild(energy);
              bringToolEnergyToFront(slot, energy);
            }
          }
        } else {
          const iconColor = this._getLineColor(def.line);
          const fallback = new PIXI.Graphics();
          fallback.beginFill(iconColor, 0.15);
          fallback.drawRoundedRect(inset, inset, s - inset * 2, s - inset * 2, innerR);
          fallback.endFill();
          fallback.beginFill(iconColor, 0.3);
          fallback.drawCircle(s / 2, s / 2 - s * 0.04, s * 0.28);
          fallback.endFill();
          slot.addChild(fallback);

          const emoji = new PIXI.Text(this._getCategoryEmoji(def.category), {
            fontSize: Math.min(18, s * 0.22),
            fontFamily: FONT_FAMILY,
          });
          emoji.anchor.set(0.5, 0.5);
          emoji.position.set(s / 2, s / 2);
          slot.addChild(emoji);
        }

        // 与棋盘一致：仅图标，不叠等级与名称
      }

      slot.eventMode = 'static';
      slot.cursor = 'pointer';
      slot.hitArea = new PIXI.Rectangle(0, 0, s, s);
      slot.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._onSlotTap(index);
      });
    }

    return slot;
  }

  private _onSlotTap(index: number): void {
    if (index >= WarehouseManager.capacity) return;
    const emptyCell = BoardManager.findEmptyOpenCell();
    if (emptyCell < 0) {
      ToastMessage.show('棋盘已满，请先合成或出售物品腾出空间');
      return;
    }

    const entry = WarehouseManager.withdrawSlot(index);
    if (entry) {
      BoardManager.placeItem(emptyCell, entry.itemId);
      BuildingManager.restoreStateFromWarehouse(emptyCell, entry.itemId, entry.toolState);
      ToastMessage.show('已取出到棋盘');
    }
  }

  private async _onExpandTap(): Promise<void> {
    if (!WarehouseManager.canExpand) return;
    const cost = WarehouseManager.expandCost;
    const newCap = WarehouseManager.capacity + 1;

    const confirmed = await ConfirmDialog.show(
      '扩容仓库',
      `消耗 ${cost} 💎钻石扩容仓库至 ${newCap} 格？\n当前钻石：${Math.floor(CurrencyManager.state.diamond)}`,
      `扩容（${cost}💎）`,
      '取消',
    );
    if (!confirmed) return;

    if (!WarehouseManager.expand()) {
      ToastMessage.show('钻石不足');
    }
  }

  private _getLineColor(line: string): number {
    const map: Record<string, number> = {
      fresh: COLORS.FLOWER_FRESH, bouquet: COLORS.FLOWER_BOUQUET,
      green: COLORS.FLOWER_GREEN, tea: COLORS.DRINK_TEA,
      cold: COLORS.DRINK_COLD, dessert: COLORS.DRINK_DESSERT,
    };
    return map[line] || 0x999999;
  }

  private _getCategoryEmoji(category: Category): string {
    switch (category) {
      case Category.FLOWER: return '🌸';
      case Category.DRINK: return '🍵';
      case Category.BUILDING: return '🏠';
      case Category.CHEST: return '📦';
      default: return '❓';
    }
  }
}
