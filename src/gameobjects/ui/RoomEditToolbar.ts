/**
 * 房间编辑工具栏
 *
 * 编辑模式下选中家具后显示，提供缩放/翻转/删除操作。
 * 悬浮在选中家具附近，跟随家具位置。
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { TweenManager, Ease } from '@/core/TweenManager';
import {
  RoomLayoutManager,
  FURNITURE_PLACEMENT_SCALE_MIN,
  FURNITURE_PLACEMENT_SCALE_MAX,
} from '@/managers/RoomLayoutManager';
import { FurnitureDragSystem } from '@/systems/FurnitureDragSystem';
import { DECO_MAP } from '@/config/DecorationConfig';
import { FONT_FAMILY, COLORS } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';

// ---- 常量 ----
/** 六个操作钮横排槽宽（图标缩放后居中） */
const TOOL_SLOT_W = 56;
const ICON_MAX = 50;
const BTN_GAP = 8;
/** 确认：复用棋盘/订单同款 `ui_order_check_badge`，与左侧图标同量级略大 */
const CONFIRM_SLOT_W = 72;
const CONFIRM_ICON_MAX = 48;
const CONFIRM_GAP = 12;
/** 工具钮下方中文标签字号 */
const TOOL_LABEL_FONT_SIZE = 13;
const TOOLBAR_PADDING = 12;
const NAME_TOP = 8;
const ROW_TOP = 28;
/** 图标底到标签顶间距 + 标签行高预留（随 TOOL_LABEL_FONT_SIZE 调） */
const LABEL_BELOW = 20;
const BG_COLOR = 0xFFFFFF;
const BG_ALPHA = 0.96;

interface ToolRowDef {
  textureKey: string;
  icon: string;
  tooltip: string;
  action: () => void;
  tooltipColor?: number;
}

interface ConfirmToolDef {
  action: () => void;
  textureKey: string;
}

export class RoomEditToolbar extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _buttons: PIXI.Container[] = [];
  private _nameLabel!: PIXI.Text;
  private _currentDecoId: string | null = null;
  /** 与 _build 底板宽度一致，供 show 水平居中 */
  private _toolbarTotalW = 750;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5500;
    this._build();
    this._setupEvents();
  }

  // ---- 公共方法 ----

  /** 显示工具栏（固定在屏幕中上方，不遮挡家具） */
  show(decoId: string, _x?: number, _y?: number): void {
    this._currentDecoId = decoId;
    const deco = DECO_MAP.get(decoId);
    if (!deco) return;

    this._nameLabel.text = deco.name;
    this.visible = true;

    // 固定在屏幕水平居中、roomBounds 上方（不遮挡家具）
    this.x = (750 - this._toolbarTotalW) / 2;  // 设计宽度750
    this.y = 240;  // 在顶部UI下方、房间区域上方

    // 弹出动画（仅首次或切换家具时）
    if (this.alpha < 0.5) {
      this.alpha = 0;
      this.scale.set(0.8);
      TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.15, ease: Ease.easeOutQuad });
      TweenManager.to({ target: this.scale, props: { x: 1, y: 1 }, duration: 0.2, ease: Ease.easeOutBack });
    }
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
    const tools: ToolRowDef[] = [
      {
        textureKey: 'room_edit_toolbar_zoom_in',
        icon: '+',
        tooltip: '放大',
        action: () => this._onScale(0.1),
      },
      {
        textureKey: 'room_edit_toolbar_zoom_out',
        icon: '-',
        tooltip: '缩小',
        action: () => this._onScale(-0.1),
      },
      {
        textureKey: 'room_edit_toolbar_flip',
        icon: '<>',
        tooltip: '翻转',
        action: () => this._onFlip(),
      },
      {
        textureKey: 'room_edit_toolbar_layer_up',
        icon: '^',
        tooltip: '置前',
        action: () => this._onBringForward(),
      },
      {
        textureKey: 'room_edit_toolbar_layer_down',
        icon: 'v',
        tooltip: '置后',
        action: () => this._onSendBackward(),
      },
      {
        textureKey: 'room_edit_toolbar_remove',
        icon: 'x',
        tooltip: '移除',
        action: () => this._onRemove(),
      },
    ];

    const confirmDef: ConfirmToolDef = {
      action: () => this._onConfirm(),
      textureKey: 'ui_order_check_badge',
    };

    const toolsRowW = 6 * TOOL_SLOT_W + 5 * BTN_GAP;
    const rowBlockH = ICON_MAX + LABEL_BELOW + 4;

    const confirmTex = TextureCache.get(confirmDef.textureKey);
    let confirmSpriteH = CONFIRM_ICON_MAX;
    if (confirmTex?.width > 0) {
      const maxW = CONFIRM_SLOT_W - 6;
      const maxH = CONFIRM_ICON_MAX;
      const s = Math.min(maxW / confirmTex.width, maxH / confirmTex.height);
      confirmSpriteH = confirmTex.height * s;
    }
    const confirmBlockH = confirmSpriteH;

    const totalW = TOOLBAR_PADDING + toolsRowW + CONFIRM_GAP + CONFIRM_SLOT_W + TOOLBAR_PADDING;
    const bodyH = Math.max(rowBlockH, confirmBlockH);
    const totalH = ROW_TOP + bodyH + TOOLBAR_PADDING + 4;
    this._toolbarTotalW = totalW;

    // 背景（大圆角白色卡片 + 阴影）
    const shadowBg = new PIXI.Graphics();
    shadowBg.beginFill(0x000000, 0.08);
    shadowBg.drawRoundedRect(2, 3, totalW, totalH, 14);
    shadowBg.endFill();
    this.addChild(shadowBg);

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(BG_COLOR, BG_ALPHA);
    this._bg.drawRoundedRect(0, 0, totalW, totalH, 14);
    this._bg.endFill();
    this._bg.lineStyle(1.5, 0xE0D0C0);
    this._bg.drawRoundedRect(0, 0, totalW, totalH, 14);
    this._bg.eventMode = 'none';
    this.addChild(this._bg);

    this._nameLabel = new PIXI.Text('', {
      fontSize: 14, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    this._nameLabel.anchor.set(0.5, 0);
    this._nameLabel.position.set(totalW / 2, NAME_TOP);
    this.addChild(this._nameLabel);

    let bx = TOOLBAR_PADDING;
    const y0 = ROW_TOP;
    for (let i = 0; i < tools.length; i++) {
      const tex = TextureCache.get(tools[i].textureKey);
      const c = this._buildToolButton(tools[i], bx, y0, TOOL_SLOT_W, ICON_MAX, tex);
      this.addChild(c);
      this._buttons.push(c);
      bx += TOOL_SLOT_W + BTN_GAP;
    }

    const confirmX = TOOLBAR_PADDING + toolsRowW + CONFIRM_GAP;
    const confirmY = ROW_TOP + (bodyH - confirmBlockH) / 2;
    const confirmC = this._buildConfirmIconOnly(confirmDef, confirmX, confirmY, CONFIRM_SLOT_W, confirmSpriteH);
    this.addChild(confirmC);
    this._buttons.push(confirmC);
  }

  private _buildToolButton(
    def: ToolRowDef,
    x: number,
    y: number,
    slotW: number,
    iconMax: number,
    tex: PIXI.Texture | null,
  ): PIXI.Container {
    const container = new PIXI.Container();
    container.position.set(x, y);

    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5, 0.5);
      const s = Math.min(iconMax / tex.width, iconMax / tex.height);
      sp.scale.set(s);
      sp.position.set(slotW / 2, iconMax / 2);
      container.addChild(sp);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(0xF5F0EB);
      bg.drawRoundedRect(0, 0, slotW, iconMax, 10);
      bg.endFill();
      bg.lineStyle(1, 0xE0D0C0, 0.5);
      bg.drawRoundedRect(0, 0, slotW, iconMax, 10);
      container.addChild(bg);

      const icon = new PIXI.Text(def.icon, { fontSize: 22, fontFamily: FONT_FAMILY });
      icon.anchor.set(0.5, 0.5);
      icon.position.set(slotW / 2, iconMax / 2 - 2);
      container.addChild(icon);
    }

    const tooltip = new PIXI.Text(def.tooltip, {
      fontSize: TOOL_LABEL_FONT_SIZE,
      fill: def.tooltipColor ?? 0x8B7355,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    tooltip.anchor.set(0.5, 0);
    tooltip.position.set(slotW / 2, iconMax + 4);
    container.addChild(tooltip);

    this._wireTap(container, def.action);
    return container;
  }

  private _buildConfirmIconOnly(
    def: ConfirmToolDef,
    x: number,
    y: number,
    slotW: number,
    iconBandH: number,
  ): PIXI.Container {
    const container = new PIXI.Container();
    container.position.set(x, y);

    const tex = TextureCache.get(def.textureKey);
    if (tex?.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5, 0.5);
      const maxW = slotW - 6;
      const maxH = Math.max(iconBandH, CONFIRM_ICON_MAX);
      const s = Math.min(maxW / tex.width, maxH / tex.height);
      sp.scale.set(s);
      sp.position.set(slotW / 2, iconBandH / 2);
      container.addChild(sp);
    }

    this._wireTap(container, def.action);
    return container;
  }

  private _wireTap(container: PIXI.Container, action: () => void): void {
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
      action();
    });
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

    const newScale = Math.max(
      FURNITURE_PLACEMENT_SCALE_MIN,
      Math.min(FURNITURE_PLACEMENT_SCALE_MAX, placement.scale + delta),
    );
    RoomLayoutManager.scaleFurniture(this._currentDecoId, newScale);

    // roomlayout:updated 事件已由 RoomLayoutManager 内部发射
    // ShopScene 会监听该事件实时更新 Sprite 视觉

    // 更新工具栏位置
    this.show(this._currentDecoId, placement.x, placement.y);
  }

  private _onFlip(): void {
    if (!this._currentDecoId) return;
    RoomLayoutManager.flipFurniture(this._currentDecoId);
    // roomlayout:updated 事件已由 RoomLayoutManager 内部发射
  }

  /** 将家具图层往前移（遮挡其它家具） */
  private _onBringForward(): void {
    if (!this._currentDecoId) return;
    RoomLayoutManager.bringForward(this._currentDecoId);
    // 图层变更后需要重新排序
    FurnitureDragSystem.sortByDepth();
    ToastMessage.show('图层前移');
  }

  /** 将家具图层往后移（被其它家具遮挡） */
  private _onSendBackward(): void {
    if (!this._currentDecoId) return;
    RoomLayoutManager.sendBackward(this._currentDecoId);
    FurnitureDragSystem.sortByDepth();
    ToastMessage.show('图层后移');
  }

  private _onRemove(): void {
    if (!this._currentDecoId) return;
    const decoId = this._currentDecoId;
    const deco = DECO_MAP.get(decoId);

    // 先从拖拽系统注销并获取 Sprite 引用
    const sprite = FurnitureDragSystem.getSpriteByDecoId(decoId);
    FurnitureDragSystem.unregisterSprite(decoId);

    // 从视图中移除 Sprite 节点
    if (sprite && sprite.parent) {
      sprite.parent.removeChild(sprite);
      sprite.destroy();
    }

    RoomLayoutManager.removeFurniture(decoId);

    this.hide();
    FurnitureDragSystem.deselect();

    if (deco) {
      ToastMessage.show( `已移除「${deco.name}」`);
    }
    EventBus.emit('roomlayout:changed');
  }

  /** 确认当前家具编辑（取消选中，但保持编辑模式） */
  private _onConfirm(): void {
    if (!this._currentDecoId) return;
    const deco = DECO_MAP.get(this._currentDecoId);

    // 取消选中 + 隐藏工具栏
    FurnitureDragSystem.deselect();
    this.hide();

    // 保存当前布局
    RoomLayoutManager.saveNow();

    if (deco) {
      ToastMessage.show( `「${deco.name}」已确认`);
    }
  }
}
