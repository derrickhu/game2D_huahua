/**
 * 底部信息栏 - 双态设计（参考 Merge Mansion / Travel Town / 四季物语）
 *
 * ★ 默认态 → 精致底部 Tab 导航栏
 *   ┌────────────────────────────────────────────────────────────┐
 *   │                                                            │
 *   │  [🧩合成]   [🏡花店]   [📅签到]   [📋任务]   [💝熟客]  [📦] │
 *   │    ───                                                     │
 *   └────────────────────────────────────────────────────────────┘
 *   当前激活的Tab有底部指示条 + 高亮色 + 图标放大
 *
 * ★ 物品选中态 → 物品详情模式
 *   ┌────────────────────────────────────────────────────────────┐
 *   │  物品名 Lv.X  描述文字             [合成线] [出售]     [📦] │
 *   └────────────────────────────────────────────────────────────┘
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, ItemDef, Category } from '@/config/ItemConfig';
import { BUILDING_DEFS } from '@/config/BuildingConfig';
import { CellState } from '@/config/BoardLayout';
import { BoardManager } from '@/managers/BoardManager';
import { FloatingMenu } from './FloatingMenu';
import { DecorationManager } from '@/managers/DecorationManager';

/** 底部栏总高度（含安全区） */
export const INFO_BAR_HEIGHT = 110;

/** 内容区高度 */
const CONTENT_HEIGHT = 90;
/** 底部安全区 */
const SAFE_BOTTOM = 20;

/** 出售按钮宽度 */
const SELL_BTN_W = 72;
const SELL_BTN_H = 40;
/** 仓库按钮半径 */
const WH_BTN_R = 24;

// ==================== Tab 导航定义 ====================

/** 颜色配置 */
const C = {
  BG: 0xFFF8F0,
  BG_ALPHA: 0.97,
  TOP_LINE: 0xF0E0D0,
  ACTIVE_BG: 0xFFF0E5,        // 激活态的Tab背景色
  INDICATOR: 0xFF8C69,         // 底部指示条（暖橙，呼应主题）
  ACTIVE_TEXT: 0xFF7043,       // 激活态文字
  INACTIVE_TEXT: 0xB0A898,     // 未激活态文字
  RED_DOT: 0xFF3333,
  RED_DOT_BORDER: 0xFFFFFF,
};

interface TabDef {
  id: string;
  icon: string;
  label: string;
  event: string;
  isScene?: boolean;   // 是否是场景切换Tab
  redDotKey?: string;  // FloatingMenu 红点对应key
}

const TABS: TabDef[] = [
  { id: 'shop',    icon: '🏡', label: '花店',  event: 'scene:switchToShop',  isScene: true, redDotKey: 'shop' },
  { id: 'checkin', icon: '📅', label: '签到',  event: 'nav:openCheckIn',     redDotKey: 'checkin' },
  { id: 'quest',   icon: '📋', label: '任务',  event: 'nav:openQuest',       redDotKey: 'quest' },
  { id: 'regular', icon: '💝', label: '熟客',  event: 'nav:openRegular',     redDotKey: 'regular' },
];

const TAB_ICON_SIZE = 26;
const TAB_LABEL_SIZE = 11;
const INDICATOR_W = 28;
const INDICATOR_H = 3;
const RED_DOT_R = 5;

// ==================== Tab项视觉结构 ====================

interface TabVisual {
  container: PIXI.Container;
  iconText: PIXI.Text;
  labelText: PIXI.Text;
  activeBg: PIXI.Graphics;
  indicator: PIXI.Graphics;
  redDot: PIXI.Graphics;
  def: TabDef;
}

export class ItemInfoBar extends PIXI.Container {
  /** 背景 */
  private _bg!: PIXI.Graphics;
  /** 分隔装饰线 */
  private _topLine!: PIXI.Graphics;

  /** 仓库按钮（始终可见） */
  private _warehouseBtn!: PIXI.Container;
  /** 出售按钮 */
  private _sellBtn!: PIXI.Container;
  /** 合成线按钮 */
  private _chainBtn!: PIXI.Container;

  /** 物品名称文本 */
  private _nameText!: PIXI.Text;
  /** 等级文本 */
  private _levelText!: PIXI.Text;
  /** 描述文本 */
  private _descText!: PIXI.Text;

  /** 信息内容容器（选中后显示） */
  private _infoContainer!: PIXI.Container;

  /** Tab 导航栏容器（无选中时显示） */
  private _tabContainer!: PIXI.Container;
  private _tabVisuals: Map<string, TabVisual> = new Map();

  /** 当前选中的物品ID */
  private _selectedItemId: string | null = null;
  /** 当前选中的格子索引 */
  private _selectedCellIndex = -1;

  constructor() {
    super();
    this._buildBg();
    this._buildInfoArea();
    this._buildChainBtn();
    this._buildSellBtn();
    this._buildWarehouseBtn();
    this._buildTabBar();
    this._bindEvents();

    // 初始态：显示Tab导航栏，隐藏物品信息
    this._infoContainer.visible = false;
    this._sellBtn.visible = false;
    this._chainBtn.visible = false;
    this._tabContainer.visible = true;
  }

  // ===================== 构建背景 =====================

  private _buildBg(): void {
    this._bg = new PIXI.Graphics();
    this._drawBg();
    this.addChild(this._bg);

    // 顶部装饰线
    this._topLine = new PIXI.Graphics();
    this._topLine.beginFill(C.TOP_LINE, 0.8);
    this._topLine.drawRoundedRect(16, 0, DESIGN_WIDTH - 32, 2, 1);
    this._topLine.endFill();
    this.addChild(this._topLine);
  }

  private _drawBg(): void {
    this._bg.clear();
    // 微弱顶部阴影
    this._bg.beginFill(0x000000, 0.03);
    this._bg.drawRect(0, -3, DESIGN_WIDTH, 3);
    this._bg.endFill();
    // 主背景
    this._bg.beginFill(C.BG, C.BG_ALPHA);
    this._bg.drawRect(0, 0, DESIGN_WIDTH, INFO_BAR_HEIGHT);
    this._bg.endFill();
  }

  // ===================== Tab 导航栏 =====================

  private _buildTabBar(): void {
    this._tabContainer = new PIXI.Container();

    // Tab区域不含仓库按钮的宽度
    const tabAreaW = DESIGN_WIDTH - 70; // 右侧给仓库按钮留空间
    const tabW = tabAreaW / TABS.length;
    const centerY = CONTENT_HEIGHT / 2;

    for (let i = 0; i < TABS.length; i++) {
      const def = TABS[i];
      const cx = tabW * i + tabW / 2;

      const tabItem = new PIXI.Container();

      // 激活态背景（不再使用，但保留数据结构兼容）
      const activeBg = new PIXI.Graphics();
      activeBg.visible = false;
      tabItem.addChild(activeBg);

      // 底部指示条（不再使用）
      const indicator = new PIXI.Graphics();
      indicator.visible = false;
      tabItem.addChild(indicator);

      // 图标
      const iconText = new PIXI.Text(def.icon, {
        fontSize: TAB_ICON_SIZE,
        fontFamily: FONT_FAMILY,
      });
      iconText.anchor.set(0.5, 0.5);
      iconText.position.set(cx, centerY - 10);
      tabItem.addChild(iconText);

      // 文字标签
      const labelText = new PIXI.Text(def.label, {
        fontSize: TAB_LABEL_SIZE,
        fill: C.ACTIVE_TEXT,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      labelText.anchor.set(0.5, 0);
      labelText.position.set(cx, centerY + 12);
      tabItem.addChild(labelText);

      // 红点（右上角小圆点）
      const redDot = new PIXI.Graphics();
      const rdx = cx + TAB_ICON_SIZE / 2 + 2;
      const rdy = centerY - 10 - TAB_ICON_SIZE / 2 + 2;
      redDot.beginFill(C.RED_DOT);
      redDot.drawCircle(rdx, rdy, RED_DOT_R);
      redDot.endFill();
      redDot.lineStyle(1.5, C.RED_DOT_BORDER);
      redDot.drawCircle(rdx, rdy, RED_DOT_R);
      redDot.visible = false;
      tabItem.addChild(redDot);

      // 点击热区
      const hitRect = new PIXI.Container();
      hitRect.hitArea = new PIXI.Rectangle(
        cx - tabW / 2, 0,
        tabW, CONTENT_HEIGHT + SAFE_BOTTOM,
      );
      hitRect.eventMode = 'static';
      hitRect.cursor = 'pointer';
      hitRect.on('pointerdown', () => {
        this._onTabTap(def);
      });
      tabItem.addChild(hitRect);

      this._tabContainer.addChild(tabItem);

      this._tabVisuals.set(def.id, {
        container: tabItem,
        iconText,
        labelText,
        activeBg,
        indicator,
        redDot,
        def,
      });
    }

    // 无默认激活态（所有Tab都是功能入口，不表示当前页面）

    this.addChild(this._tabContainer);
  }

  /** Tab 点击处理 */
  private _onTabTap(def: TabDef): void {
    // 点击反馈动画（所有Tab统一）
    const tab = this._tabVisuals.get(def.id);
    if (tab) {
      TweenManager.cancelTarget(tab.iconText.scale);
      tab.iconText.scale.set(0.75);
      TweenManager.to({
        target: tab.iconText.scale,
        props: { x: 1, y: 1 },
        duration: 0.25,
        ease: Ease.easeOutBack,
      });
    }

    if (def.event) {
      EventBus.emit(def.event);
    }
  }

  // ===================== 红点更新 =====================

  /** 外部定时调用，更新Tab红点 */
  updateQuickBtnRedDots(): void {
    for (const [, tab] of this._tabVisuals) {
      if (!tab.def.redDotKey) continue;

      if (tab.def.redDotKey === 'shop') {
        tab.redDot.visible = DecorationManager.hasAffordableNew();
      } else {
        tab.redDot.visible = FloatingMenu.getRedDot(tab.def.redDotKey);
      }
    }
  }

  // ===================== 物品信息区域 =====================

  /** 中间信息区域 */
  private _buildInfoArea(): void {
    this._infoContainer = new PIXI.Container();

    const infoX = 24;
    const centerY = CONTENT_HEIGHT / 2;

    // 物品名称
    this._nameText = new PIXI.Text('', {
      fontSize: 20,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._nameText.anchor.set(0, 0.5);
    this._nameText.position.set(infoX, centerY - 14);
    this._infoContainer.addChild(this._nameText);

    // 等级标签
    this._levelText = new PIXI.Text('', {
      fontSize: 15,
      fill: COLORS.BUTTON_PRIMARY,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._levelText.anchor.set(0, 0.5);
    this._levelText.position.set(infoX, centerY - 14);
    this._infoContainer.addChild(this._levelText);

    // 描述文本
    this._descText = new PIXI.Text('', {
      fontSize: 14,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: 360,
    });
    this._descText.anchor.set(0, 0.5);
    this._descText.position.set(infoX, centerY + 14);
    this._infoContainer.addChild(this._descText);

    this.addChild(this._infoContainer);
  }

  /** 合成线按钮 */
  private _buildChainBtn(): void {
    this._chainBtn = new PIXI.Container();
    const CHAIN_BTN_W = 72;
    const CHAIN_BTN_H = 40;
    const rightEdge = DESIGN_WIDTH - 56 - SELL_BTN_W / 2 - WH_BTN_R * 2 - 14 - SELL_BTN_W - 12;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x8BB8D0);
    bg.drawRoundedRect(-CHAIN_BTN_W / 2, -CHAIN_BTN_H / 2, CHAIN_BTN_W, CHAIN_BTN_H, 10);
    bg.endFill();
    this._chainBtn.addChild(bg);

    const text = new PIXI.Text('📖合成线', {
      fontSize: 13,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    text.anchor.set(0.5, 0.5);
    this._chainBtn.addChild(text);

    this._chainBtn.position.set(rightEdge, CONTENT_HEIGHT / 2);
    this._chainBtn.eventMode = 'static';
    this._chainBtn.cursor = 'pointer';
    this._chainBtn.hitArea = new PIXI.Rectangle(
      -CHAIN_BTN_W / 2 - 4, -CHAIN_BTN_H / 2 - 4,
      CHAIN_BTN_W + 8, CHAIN_BTN_H + 8,
    );
    this._chainBtn.on('pointerdown', () => this._onChainTap());
    this.addChild(this._chainBtn);
  }

  /** 出售按钮 */
  private _buildSellBtn(): void {
    this._sellBtn = new PIXI.Container();
    const rightEdge = DESIGN_WIDTH - 56 - SELL_BTN_W / 2 - WH_BTN_R * 2 - 14;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xFF8C69);
    bg.drawRoundedRect(-SELL_BTN_W / 2, -SELL_BTN_H / 2, SELL_BTN_W, SELL_BTN_H, 10);
    bg.endFill();
    this._sellBtn.addChild(bg);

    const text = new PIXI.Text('出售', {
      fontSize: 16,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    text.anchor.set(0.5, 0.5);
    this._sellBtn.addChild(text);

    this._sellBtn.position.set(rightEdge, CONTENT_HEIGHT / 2);
    this._sellBtn.eventMode = 'static';
    this._sellBtn.cursor = 'pointer';
    this._sellBtn.hitArea = new PIXI.Rectangle(
      -SELL_BTN_W / 2 - 4, -SELL_BTN_H / 2 - 4,
      SELL_BTN_W + 8, SELL_BTN_H + 8,
    );
    this._sellBtn.on('pointerdown', () => this._onSellTap());
    this.addChild(this._sellBtn);
  }

  /** 右侧仓库按钮 - 始终可见 */
  private _buildWarehouseBtn(): void {
    this._warehouseBtn = new PIXI.Container();
    const cx = DESIGN_WIDTH - 40;
    const cy = CONTENT_HEIGHT / 2;

    // 圆形底
    const circle = new PIXI.Graphics();
    circle.beginFill(0xD0E8F8, 0.9);
    circle.drawCircle(0, 0, WH_BTN_R);
    circle.endFill();
    circle.lineStyle(2, 0xA8C8E8);
    circle.drawCircle(0, 0, WH_BTN_R);
    this._warehouseBtn.addChild(circle);

    // 箱子图标
    const icon = new PIXI.Graphics();
    icon.lineStyle(2.5, COLORS.TEXT_DARK, 1, 0.5);
    icon.drawRoundedRect(-10, -8, 20, 16, 3);
    icon.moveTo(-6, -8);
    icon.lineTo(-6, -12);
    icon.lineTo(6, -12);
    icon.lineTo(6, -8);
    this._warehouseBtn.addChild(icon);

    this._warehouseBtn.position.set(cx, cy);
    this._warehouseBtn.eventMode = 'static';
    this._warehouseBtn.cursor = 'pointer';
    this._warehouseBtn.hitArea = new PIXI.Circle(0, 0, WH_BTN_R + 6);
    this._warehouseBtn.on('pointerdown', () => this._onWarehouseTap());
    this.addChild(this._warehouseBtn);
  }

  // ===================== 事件 =====================

  private _bindEvents(): void {
    EventBus.on('board:itemSelected', (cellIndex: number, itemId: string | null) => {
      this._onItemSelected(cellIndex, itemId);
    });
    EventBus.on('board:selectionCleared', () => {
      this._clearSelection();
    });
    EventBus.on('board:merged', () => this._clearSelection());
    EventBus.on('board:moved', () => this._clearSelection());
    EventBus.on('board:itemRemoved', () => this._clearSelection());
    EventBus.on('board:itemSold', () => this._clearSelection());
  }

  // ===================== 选中逻辑 =====================

  private _onItemSelected(cellIndex: number, itemId: string | null): void {
    if (!itemId) {
      this._clearSelection();
      return;
    }

    this._selectedItemId = itemId;
    this._selectedCellIndex = cellIndex;

    const def = ITEM_DEFS.get(itemId);
    if (!def) {
      this._clearSelection();
      return;
    }

    // 更新名称
    this._nameText.text = def.name;

    // 更新等级
    this._levelText.text = ` Lv.${def.level}`;
    this._levelText.position.x = this._nameText.position.x + this._nameText.width + 4;

    // 描述文字
    this._descText.text = this._getDescription(def);

    // 切换到物品信息模式
    this._infoContainer.visible = true;
    this._tabContainer.visible = false;

    // 出售按钮
    const cell = BoardManager.getCellByIndex(cellIndex);
    const canSell = def.category !== Category.BUILDING
      && !!cell && cell.state === CellState.OPEN;
    this._sellBtn.visible = canSell;

    // 合成线按钮
    const showChain = def.category !== Category.BUILDING
      && def.maxLevel > 1;
    this._chainBtn.visible = showChain;

    // 入场动画
    this._playShowAnim();
  }

  private _clearSelection(): void {
    this._selectedItemId = null;
    this._selectedCellIndex = -1;

    // 切换回Tab导航模式
    this._infoContainer.visible = false;
    this._sellBtn.visible = false;
    this._chainBtn.visible = false;
    this._tabContainer.visible = true;
  }

  /** 获取物品描述 */
  private _getDescription(def: ItemDef): string {
    if (def.category === Category.BUILDING) {
      const bDef = BUILDING_DEFS.get(def.id);
      if (bDef) {
        return `⚡${bDef.staminaCost} | 冷却 ${bDef.cooldown}s | 产出 Lv.${bDef.produceLevelRange[0]}~${bDef.produceLevelRange[1]}`;
      }
      return '功能建筑';
    }

    if (def.category === Category.CHEST) {
      return '点击开启，获得随机物品';
    }

    if (def.level < def.maxLevel) {
      return `合成后可获得更高级物品。`;
    }

    return `已达最高等级！可用于完成订单。`;
  }

  // ===================== 按钮回调 =====================

  private _onSellTap(): void {
    if (this._selectedCellIndex < 0 || !this._selectedItemId) return;
    this._playBtnBounce(this._sellBtn);
    EventBus.emit('board:requestSell', this._selectedCellIndex, this._selectedItemId);
  }

  private _onWarehouseTap(): void {
    this._playBtnBounce(this._warehouseBtn);
    EventBus.emit('nav:openWarehouse');
  }

  private _onChainTap(): void {
    if (!this._selectedItemId) return;
    this._playBtnBounce(this._chainBtn);
    EventBus.emit('mergeChain:open', this._selectedItemId);
  }

  // ===================== 动画 =====================

  private _playShowAnim(): void {
    this._infoContainer.alpha = 0;
    TweenManager.to({
      target: this._infoContainer,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
  }

  private _playBtnBounce(btn: PIXI.Container): void {
    TweenManager.cancelTarget(btn.scale);
    btn.scale.set(0.85);
    TweenManager.to({
      target: btn.scale,
      props: { x: 1, y: 1 },
      duration: 0.2,
      ease: Ease.easeOutBack,
    });
  }
}
