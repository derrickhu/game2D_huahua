/**
 * 房间编辑工具栏
 *
 * 编辑模式下选中家具后显示，提供缩放/翻转/删除操作。
 * 悬浮在选中家具附近，跟随家具位置。
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import { FurnitureDragSystem } from '@/systems/FurnitureDragSystem';
import { DECO_MAP } from '@/config/DecorationConfig';
import { FONT_FAMILY, COLORS } from '@/config/Constants';

// ---- 常量 ----
const BTN_SIZE = 52;
const BTN_GAP = 10;
const TOOLBAR_PADDING = 12;
const BG_COLOR = 0xFFFFFF;
const BG_ALPHA = 0.96;

interface ToolButton {
  icon: string;
  tooltip: string;
  action: () => void;
}

export class RoomEditToolbar extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _buttons: PIXI.Container[] = [];
  private _nameLabel!: PIXI.Text;
  private _currentDecoId: string | null = null;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5500;
    this._build();
    this._setupEvents();
  }

  // ---- 公共方法 ----

  /** 显示工具栏（在指定位置） */
  show(decoId: string, x: number, y: number): void {
    this._currentDecoId = decoId;
    const deco = DECO_MAP.get(decoId);
    if (!deco) return;

    this._nameLabel.text = `✏️ ${deco.name}`;
    this.visible = true;

    // 定位在家具上方
    this.x = x - this.width / 2;
    this.y = y - 60;

    // 确保不超出屏幕
    if (this.x < 10) this.x = 10;
    if (this.x + this.width > 740) this.x = 740 - this.width;
    if (this.y < 10) this.y = 10;

    // 弹出动画
    this.alpha = 0;
    this.scale.set(0.8);
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.15, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this.scale, props: { x: 1, y: 1 }, duration: 0.2, ease: Ease.easeOutBack });
  }

  /** 隐藏工具栏 */
  hide(): void {
    if (!this.visible) return;
    this._currentDecoId = null;

    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.1,
      ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  // ---- 构建 UI ----

  private _build(): void {
    const buttons: ToolButton[] = [
      { icon: '➕', tooltip: '放大', action: () => this._onScale(0.1) },
      { icon: '➖', tooltip: '缩小', action: () => this._onScale(-0.1) },
      { icon: '↔️', tooltip: '翻转', action: () => this._onFlip() },
      { icon: '🗑️', tooltip: '移除', action: () => this._onRemove() },
    ];

    const totalW = TOOLBAR_PADDING * 2 + buttons.length * BTN_SIZE + (buttons.length - 1) * BTN_GAP;
    const totalH = BTN_SIZE + TOOLBAR_PADDING * 2 + 24; // +24 for name label

    // 背景（大圆角白色卡片 + 阴影）
    const shadowBg = new PIXI.Graphics();
    shadowBg.beginFill(0x000000, 0.1);
    shadowBg.drawRoundedRect(2, 3, totalW, totalH, 14);
    shadowBg.endFill();
    this.addChild(shadowBg);

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(BG_COLOR, BG_ALPHA);
    this._bg.drawRoundedRect(0, 0, totalW, totalH, 14);
    this._bg.endFill();
    this._bg.lineStyle(1.5, 0xE0D0C0);
    this._bg.drawRoundedRect(0, 0, totalW, totalH, 14);
    // 底部小三角（指向家具）
    this._bg.beginFill(BG_COLOR, BG_ALPHA);
    this._bg.moveTo(totalW / 2 - 10, totalH);
    this._bg.lineTo(totalW / 2, totalH + 10);
    this._bg.lineTo(totalW / 2 + 10, totalH);
    this._bg.endFill();
    this._bg.eventMode = 'static'; // 阻止穿透
    this.addChild(this._bg);

    // 名称标签
    this._nameLabel = new PIXI.Text('', {
      fontSize: 14, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    this._nameLabel.anchor.set(0.5, 0);
    this._nameLabel.position.set(totalW / 2, 8);
    this.addChild(this._nameLabel);

    // 按钮
    buttons.forEach((btn, i) => {
      const x = TOOLBAR_PADDING + i * (BTN_SIZE + BTN_GAP);
      const y = 28;
      const container = this._buildButton(btn, x, y);
      this.addChild(container);
      this._buttons.push(container);
    });
  }

  private _buildButton(def: ToolButton, x: number, y: number): PIXI.Container {
    const container = new PIXI.Container();
    container.position.set(x, y);

    // 按钮背景（圆角）
    const bg = new PIXI.Graphics();
    bg.beginFill(0xF5F0EB);
    bg.drawRoundedRect(0, 0, BTN_SIZE, BTN_SIZE, 10);
    bg.endFill();
    bg.lineStyle(1, 0xE0D0C0, 0.5);
    bg.drawRoundedRect(0, 0, BTN_SIZE, BTN_SIZE, 10);
    container.addChild(bg);

    // 图标（大号）
    const icon = new PIXI.Text(def.icon, {
      fontSize: 22, fontFamily: FONT_FAMILY,
    });
    icon.anchor.set(0.5, 0.5);
    icon.position.set(BTN_SIZE / 2, BTN_SIZE / 2 - 6);
    container.addChild(icon);

    // 功能文字说明（底部小字）
    const tooltip = new PIXI.Text(def.tooltip, {
      fontSize: 10, fill: 0x8B7355, fontFamily: FONT_FAMILY,
    });
    tooltip.anchor.set(0.5, 0.5);
    tooltip.position.set(BTN_SIZE / 2, BTN_SIZE - 8);
    container.addChild(tooltip);

    // 交互
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', () => {
      TweenManager.to({
        target: container.scale,
        props: { x: 0.88, y: 0.88 },
        duration: 0.06,
        ease: Ease.easeOutQuad,
      });
    });
    container.on('pointerup', () => {
      TweenManager.to({
        target: container.scale,
        props: { x: 1, y: 1 },
        duration: 0.12,
        ease: Ease.easeOutBack,
      });
      def.action();
    });

    return container;
  }

  // ---- 事件处理 ----

  private _setupEvents(): void {
    EventBus.on('furniture:selected', (decoId: string) => {
      const placement = RoomLayoutManager.getPlacement(decoId);
      if (placement) {
        this.show(decoId, placement.x, placement.y);
      }
    });

    EventBus.on('furniture:deselected', () => {
      this.hide();
    });

    EventBus.on('furniture:edit_disabled', () => {
      this.hide();
    });
  }

  // ---- 操作回调 ----

  private _onScale(delta: number): void {
    if (!this._currentDecoId) return;
    const placement = RoomLayoutManager.getPlacement(this._currentDecoId);
    if (!placement) return;

    const newScale = Math.max(0.5, Math.min(2.0, placement.scale + delta));
    RoomLayoutManager.scaleFurniture(this._currentDecoId, newScale);
    EventBus.emit('roomlayout:updated', placement);

    // 更新工具栏位置
    this.show(this._currentDecoId, placement.x, placement.y);
  }

  private _onFlip(): void {
    if (!this._currentDecoId) return;
    RoomLayoutManager.flipFurniture(this._currentDecoId);
    EventBus.emit('roomlayout:updated', RoomLayoutManager.getPlacement(this._currentDecoId));
  }

  private _onRemove(): void {
    if (!this._currentDecoId) return;
    const decoId = this._currentDecoId;
    const deco = DECO_MAP.get(decoId);

    FurnitureDragSystem.unregisterSprite(decoId);
    RoomLayoutManager.removeFurniture(decoId);

    this.hide();
    FurnitureDragSystem.deselect();

    if (deco) {
      EventBus.emit('toast:show', `已移除「${deco.name}」`);
    }
    EventBus.emit('roomlayout:changed');
  }
}
