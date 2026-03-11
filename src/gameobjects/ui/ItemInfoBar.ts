/**
 * 底部物品信息栏 - 仿四季物语风格
 *
 * 布局：
 * ┌─────────────────────────────────────────────────────────┐
 * │ [返回]  物品名 Lv.X  ⚠  描述文字           [出售] [仓库] │
 * └─────────────────────────────────────────────────────────┘
 *
 * - 左侧：返回按钮（圆形，预留跳转换装页面）
 * - 中间：物品名称 + 等级 + 描述（合成提示等）
 * - 右侧：出售按钮 + 仓库按钮
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, ItemDef, Category } from '@/config/ItemConfig';
import { BUILDING_DEFS } from '@/config/BuildingConfig';
import { CellState } from '@/config/BoardLayout';
import { BoardManager } from '@/managers/BoardManager';

/** 底部栏总高度（含安全区） */
export const INFO_BAR_HEIGHT = 110;

/** 内容区高度 */
const CONTENT_HEIGHT = 90;
/** 底部安全区（小游戏 iPhone 刘海屏底部间距） */
const SAFE_BOTTOM = 20;

/** 按钮尺寸 */
const BTN_SIZE = 52;
const BTN_RADIUS = BTN_SIZE / 2;

/** 出售按钮宽度 */
const SELL_BTN_W = 72;
const SELL_BTN_H = 40;

export class ItemInfoBar extends PIXI.Container {
  /** 背景 */
  private _bg!: PIXI.Graphics;
  /** 分隔装饰线 */
  private _topLine!: PIXI.Graphics;

  /** 返回按钮（圆形） */
  private _backBtn!: PIXI.Container;
  /** 仓库按钮（圆形） */
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

  /** 无选中时的提示 */
  private _hintText!: PIXI.Text;

  /** 信息内容容器（选中后显示） */
  private _infoContainer!: PIXI.Container;

  /** 当前选中的物品ID */
  private _selectedItemId: string | null = null;
  /** 当前选中的格子索引 */
  private _selectedCellIndex = -1;

  constructor() {
    super();
    this._buildBg();
    this._buildBackBtn();
    this._buildInfoArea();
    this._buildChainBtn();
    this._buildSellBtn();
    this._buildWarehouseBtn();
    this._buildHint();
    this._bindEvents();

    // 初始态：显示提示，隐藏信息
    this._infoContainer.visible = false;
    this._sellBtn.visible = false;
    this._chainBtn.visible = false;
    this._hintText.visible = true;
  }

  // ===================== 构建 =====================

  private _buildBg(): void {
    this._bg = new PIXI.Graphics();
    this._drawBg();
    this.addChild(this._bg);

    // 顶部装饰线
    this._topLine = new PIXI.Graphics();
    this._topLine.beginFill(0xE8D5C0);
    this._topLine.drawRoundedRect(20, 0, DESIGN_WIDTH - 40, 3, 1.5);
    this._topLine.endFill();
    this.addChild(this._topLine);
  }

  private _drawBg(): void {
    this._bg.clear();
    // 主背景：暖色渐变风格（用纯色模拟）
    this._bg.beginFill(0xFFF8F0, 0.97);
    this._bg.drawRoundedRect(0, 0, DESIGN_WIDTH, INFO_BAR_HEIGHT, 0);
    this._bg.endFill();

    // 上部圆角装饰
    this._bg.beginFill(0xFFF0E0, 0.6);
    this._bg.drawRoundedRect(8, 4, DESIGN_WIDTH - 16, CONTENT_HEIGHT - 4, 16);
    this._bg.endFill();
  }

  /** 左侧返回按钮 */
  private _buildBackBtn(): void {
    this._backBtn = new PIXI.Container();
    const cx = 46;
    const cy = CONTENT_HEIGHT / 2;

    // 圆形背景
    const circle = new PIXI.Graphics();
    circle.beginFill(0xFFE4C8, 0.9);
    circle.drawCircle(0, 0, BTN_RADIUS);
    circle.endFill();
    circle.lineStyle(2, 0xE8C9A8);
    circle.drawCircle(0, 0, BTN_RADIUS);
    this._backBtn.addChild(circle);

    // 返回箭头图标
    const arrow = new PIXI.Graphics();
    arrow.lineStyle(3, COLORS.TEXT_DARK, 1, 0.5);
    arrow.moveTo(6, 0);
    arrow.lineTo(-4, 0);
    arrow.moveTo(-4, 0);
    arrow.lineTo(2, -6);
    arrow.moveTo(-4, 0);
    arrow.lineTo(2, 6);
    this._backBtn.addChild(arrow);

    this._backBtn.position.set(cx, cy);
    this._backBtn.eventMode = 'static';
    this._backBtn.cursor = 'pointer';
    this._backBtn.hitArea = new PIXI.Circle(0, 0, BTN_RADIUS + 6);
    this._backBtn.on('pointerdown', () => this._onBackTap());
    this.addChild(this._backBtn);
  }

  /** 中间信息区域 */
  private _buildInfoArea(): void {
    this._infoContainer = new PIXI.Container();

    const infoX = 90;
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

  /** 合成线按钮（出售按钮左侧） */
  private _buildChainBtn(): void {
    this._chainBtn = new PIXI.Container();
    const CHAIN_BTN_W = 72;
    const CHAIN_BTN_H = 40;
    const rightEdge = DESIGN_WIDTH - 56 - SELL_BTN_W / 2 - BTN_SIZE - 14 - SELL_BTN_W - 12;

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
    const rightEdge = DESIGN_WIDTH - 56 - SELL_BTN_W / 2 - BTN_SIZE - 14;

    // 按钮背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFF8C69);
    bg.drawRoundedRect(-SELL_BTN_W / 2, -SELL_BTN_H / 2, SELL_BTN_W, SELL_BTN_H, 10);
    bg.endFill();
    this._sellBtn.addChild(bg);

    // 出售文字
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

  /** 右侧仓库按钮 */
  private _buildWarehouseBtn(): void {
    this._warehouseBtn = new PIXI.Container();
    const cx = DESIGN_WIDTH - 46;
    const cy = CONTENT_HEIGHT / 2;

    // 圆形背景
    const circle = new PIXI.Graphics();
    circle.beginFill(0xD0E8F8, 0.9);
    circle.drawCircle(0, 0, BTN_RADIUS);
    circle.endFill();
    circle.lineStyle(2, 0xA8C8E8);
    circle.drawCircle(0, 0, BTN_RADIUS);
    this._warehouseBtn.addChild(circle);

    // 仓库图标（简易箱子）
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
    this._warehouseBtn.hitArea = new PIXI.Circle(0, 0, BTN_RADIUS + 6);
    this._warehouseBtn.on('pointerdown', () => this._onWarehouseTap());
    this.addChild(this._warehouseBtn);
  }

  /** 未选中时的提示文字 */
  private _buildHint(): void {
    this._hintText = new PIXI.Text('点击棋盘上的物品查看详情', {
      fontSize: 15,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    this._hintText.anchor.set(0.5, 0.5);
    this._hintText.position.set(DESIGN_WIDTH / 2, CONTENT_HEIGHT / 2);
    this.addChild(this._hintText);
  }

  // ===================== 事件 =====================

  private _bindEvents(): void {
    EventBus.on('board:itemSelected', (cellIndex: number, itemId: string | null) => {
      this._onItemSelected(cellIndex, itemId);
    });
    EventBus.on('board:selectionCleared', () => {
      this._clearSelection();
    });
    // 物品变化时刷新（合成/移动/删除后）
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

    // 更新等级（在名称右侧）
    this._levelText.text = ` Lv.${def.level}`;
    this._levelText.position.x = this._nameText.position.x + this._nameText.width + 4;

    // 描述文字
    this._descText.text = this._getDescription(def);

    // 显示/隐藏
    this._infoContainer.visible = true;
    this._hintText.visible = false;

    // 出售按钮：建筑不可出售，未解锁区域(FOG/KEY/PEEK)不可出售
    const cell = BoardManager.getCellByIndex(cellIndex);
    const canSell = def.category !== Category.BUILDING
      && !!cell && cell.state === CellState.OPEN;
    this._sellBtn.visible = canSell;

    // 合成线按钮：可合成物品（非建筑）才显示
    const showChain = def.category !== Category.BUILDING
      && def.maxLevel > 1;
    this._chainBtn.visible = showChain;

    // 入场动画
    this._playShowAnim();
  }

  private _clearSelection(): void {
    this._selectedItemId = null;
    this._selectedCellIndex = -1;
    this._infoContainer.visible = false;
    this._sellBtn.visible = false;
    this._chainBtn.visible = false;
    this._hintText.visible = true;
  }

  /** 获取物品描述 */
  private _getDescription(def: ItemDef): string {
    // 建筑
    if (def.category === Category.BUILDING) {
      const bDef = BUILDING_DEFS.get(def.id);
      if (bDef) {
        return `⚡${bDef.staminaCost} | 冷却 ${bDef.cooldown}s | 产出 Lv.${bDef.produceLevelRange[0]}~${bDef.produceLevelRange[1]}`;
      }
      return '功能建筑';
    }

    // 宝箱
    if (def.category === Category.CHEST) {
      return '点击开启，获得随机物品';
    }

    // 可合成物品
    if (def.level < def.maxLevel) {
      return `合成后可获得更高级物品。`;
    }

    // 满级
    return `已达最高等级！可用于完成订单。`;
  }

  // ===================== 按钮回调 =====================

  private _onBackTap(): void {
    this._playBtnBounce(this._backBtn);
    EventBus.emit('nav:goToDressup');
  }

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

  /** 信息栏入场动画 */
  private _playShowAnim(): void {
    this._infoContainer.alpha = 0;
    TweenManager.to({
      target: this._infoContainer,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
  }

  /** 按钮按下弹跳反馈 */
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
