/**
 * 客人横向滚动区域 - 参考四季物语柜台排队设计
 *
 * 功能：
 * - 横向展示多位排队客人（卡片式半身像）
 * - 支持触控左右滑动 + 惯性滚动
 * - 带遮罩裁剪，超出区域不可见
 * - 前2位客人为「服务中」（可交付），后续为「排队中」（预览需求）
 */
import * as PIXI from 'pixi.js';
import { CustomerView } from './CustomerView';
import { CustomerInstance, CustomerManager } from '@/managers/CustomerManager';
import { EventBus } from '@/core/EventBus';
import { COLORS, FONT_FAMILY, MAX_VISIBLE_CUSTOMERS } from '@/config/Constants';

/** 单张客人卡片宽度 */
const CARD_W = 130;
/** 卡片间距 */
const CARD_GAP = 10;
/** 滚动区域高度 */
const AREA_H = 140;
/** 惯性摩擦系数 */
const FRICTION = 0.92;
/** 最小惯性速度阈值 */
const MIN_VELOCITY = 0.3;
/** 回弹系数 */
const BOUNCE_FACTOR = 0.15;

export class CustomerScrollArea extends PIXI.Container {
  /** 可视区域宽度（由外部设置） */
  private _viewWidth = 500;
  /** 内部滚动容器 */
  private _scrollContent: PIXI.Container;
  /** 遮罩图形 */
  private _maskGraphics: PIXI.Graphics;
  /** 客人视图列表 */
  private _customerViews: CustomerView[] = [];

  // ---- 滑动状态 ----
  private _isDragging = false;
  private _dragStartX = 0;
  private _scrollStartX = 0;
  private _velocity = 0;
  private _lastDragX = 0;
  private _lastDragTime = 0;
  /** 是否为有效的滑动（区别于点击） */
  private _hasMoved = false;

  /** 空状态提示 */
  private _emptyHint: PIXI.Text;

  constructor(viewWidth: number) {
    super();
    this._viewWidth = viewWidth;

    // 遮罩
    this._maskGraphics = new PIXI.Graphics();
    this._updateMask();
    this.addChild(this._maskGraphics);

    // 滚动容器
    this._scrollContent = new PIXI.Container();
    this._scrollContent.mask = this._maskGraphics;
    this.addChild(this._scrollContent);

    // 空状态
    this._emptyHint = new PIXI.Text('等待客人中...', {
      fontSize: 13,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    this._emptyHint.anchor.set(0.5, 0.5);
    this._emptyHint.position.set(this._viewWidth / 2, AREA_H / 2);
    this._emptyHint.alpha = 0.5;
    this.addChild(this._emptyHint);

    // 触控交互区域
    this._setupInteraction();

    // 监听客人事件
    this._bindEvents();
  }

  /** 区域高度 */
  static readonly HEIGHT = AREA_H;

  /** 获取客人视图列表（供外部引用） */
  get customerViews(): readonly CustomerView[] {
    return this._customerViews;
  }

  /** 刷新客人显示 */
  refresh(): void {
    const customers = CustomerManager.customers;

    // 调整视图数量
    while (this._customerViews.length < customers.length) {
      const cv = new CustomerView();
      this._scrollContent.addChild(cv);
      this._customerViews.push(cv);
    }

    // 隐藏多余的视图
    for (let i = 0; i < this._customerViews.length; i++) {
      if (i < customers.length) {
        const cx = i * (CARD_W + CARD_GAP) + CARD_W / 2;
        this._customerViews[i].position.set(cx, AREA_H / 2 + 8);
        this._customerViews[i].setCustomer(customers[i]);
      } else {
        this._customerViews[i].setCustomer(null);
      }
    }

    // 空状态
    this._emptyHint.visible = customers.length === 0;
  }

  /** 每帧更新（惯性滚动） */
  update(_dt: number): void {
    if (this._isDragging) return;

    // 惯性滑动
    if (Math.abs(this._velocity) > MIN_VELOCITY) {
      this._scrollContent.x += this._velocity;
      this._velocity *= FRICTION;
    } else {
      this._velocity = 0;
    }

    // 边界回弹
    const minX = this._getMinScrollX();
    const maxX = 0;

    if (this._scrollContent.x > maxX) {
      this._scrollContent.x += (maxX - this._scrollContent.x) * BOUNCE_FACTOR;
      this._velocity = 0;
    } else if (this._scrollContent.x < minX) {
      this._scrollContent.x += (minX - this._scrollContent.x) * BOUNCE_FACTOR;
      this._velocity = 0;
    }
  }

  // ═══════ 私有方法 ═══════

  private _updateMask(): void {
    this._maskGraphics.clear();
    this._maskGraphics.beginFill(0xFFFFFF);
    this._maskGraphics.drawRoundedRect(0, 0, this._viewWidth, AREA_H, 8);
    this._maskGraphics.endFill();
  }

  private _getMinScrollX(): number {
    const customers = CustomerManager.customers;
    const contentW = customers.length * (CARD_W + CARD_GAP) - CARD_GAP;
    if (contentW <= this._viewWidth) return 0;
    return -(contentW - this._viewWidth);
  }

  private _setupInteraction(): void {
    // 创建一个透明的交互背景
    const hitArea = new PIXI.Graphics();
    hitArea.beginFill(0xFFFFFF, 0.001);
    hitArea.drawRect(0, 0, this._viewWidth, AREA_H);
    hitArea.endFill();
    hitArea.eventMode = 'static';
    hitArea.cursor = 'grab';
    this.addChildAt(hitArea, 0);

    hitArea.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._isDragging = true;
      this._hasMoved = false;
      this._dragStartX = e.globalX;
      this._scrollStartX = this._scrollContent.x;
      this._lastDragX = e.globalX;
      this._lastDragTime = Date.now();
      this._velocity = 0;
    });

    hitArea.on('globalpointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!this._isDragging) return;

      const dx = e.globalX - this._dragStartX;
      if (Math.abs(dx) > 5) this._hasMoved = true;

      // 计算速度
      const now = Date.now();
      const dtMs = Math.max(1, now - this._lastDragTime);
      this._velocity = (e.globalX - this._lastDragX) / dtMs * 16; // 归一化到帧
      this._lastDragX = e.globalX;
      this._lastDragTime = now;

      // 应用滚动（带阻尼的过界拖拽）
      let newX = this._scrollStartX + dx;
      const minX = this._getMinScrollX();
      if (newX > 0) newX *= 0.3;
      if (newX < minX) newX = minX + (newX - minX) * 0.3;

      this._scrollContent.x = newX;
    });

    const endDrag = () => {
      this._isDragging = false;
    };
    hitArea.on('pointerup', endDrag);
    hitArea.on('pointerupoutside', endDrag);
  }

  private _bindEvents(): void {
    EventBus.on('customer:arrived', () => this.refresh());
    EventBus.on('customer:lockChanged', () => this.refresh());
    EventBus.on('customer:delivered', () => this.refresh());
  }
}
