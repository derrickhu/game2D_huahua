/**
 * 家具拖拽交互系统
 *
 * 在编辑模式下，管理家具 Sprite 的拖拽交互。
 * 采用与 BoardView 一致的事件策略：
 *   - pointerdown 用 PIXI 事件系统（精确命中测试）
 *   - pointermove / pointerup 绑定 canvas（绕过微信小游戏事件丢失问题）
 *
 * 支持：
 *   - 拖拽已放置的家具移动位置
 *   - 从 FurnitureTray 拖入新家具到房间（脚下柔光 + alpha 外缘细亮黄描边）
 *   - 拖拽时半透明投影 + 边界约束
 *   - 放置时弹跳动画
 *   - 按 y 坐标自动排序（2.5D 遮挡）
 */

import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import {
  RoomLayoutManager,
  FurniturePlacement,
  FURNITURE_PLACEMENT_SCALE_MIN,
  FURNITURE_PLACEMENT_SCALE_MAX,
} from '@/managers/RoomLayoutManager';
import {
  DECO_MAP,
  SHOP_FURNITURE_TEX_BASE_PX,
  isDecoAllowedInScene,
  formatAllowedScenesShort,
} from '@/config/DecorationConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { TextureCache } from '@/utils/TextureCache';
import { ROOM_DEPTH_AUX_MAX, roomDepthZForPlacement } from '@/config/RoomDepthSort';

// ---- 常量 ----

/** 拖拽时的透明度 */
const DRAG_ALPHA = 0.7;
/** 拖拽时的缩放加成（让家具稍微放大，便于识别） */
const DRAG_SCALE_BOOST = 1.1;
/** 放置弹跳动画时长 */
const BOUNCE_DURATION = 0.25;
/** 长按判定时间（ms） */
const LONG_PRESS_MS = 200;
/** 移动距离阈值（设计坐标），超过此距离视为拖拽 */
const MOVE_THRESHOLD = 8;

// ---- 接口 ----

export interface DragContext {
  /** 被拖拽的 PIXI Sprite（房间中的家具） */
  sprite: PIXI.Sprite;
  /** 对应的装饰 ID */
  decoId: string;
  /** 拖拽起始时 sprite 的 x */
  startX: number;
  /** 拖拽起始时 sprite 的 y */
  startY: number;
  /** pointer 起始位置 (设计坐标) */
  pointerStartX: number;
  pointerStartY: number;
  /** 是否确认开始拖拽（超过移动阈值后为 true） */
  dragging: boolean;
  /** 是从托盘拖入的新家具 */
  isNew: boolean;
  /** 原始缩放 */
  originalScale: number;
  /** 仅 isNew：脚下柔光层（随 sprite 移动，落地后移除） */
  newFurnitureGlow?: PIXI.Graphics;
}

class FurnitureDragSystemClass {
  /** 是否启用（编辑模式开关） */
  private _enabled = false;

  /** 房间家具容器（由 ShopScene 传入） */
  private _roomContainer: PIXI.Container | null = null;

  /** decoId → PIXI.Sprite 映射 */
  private _spriteMap = new Map<string, PIXI.Sprite>();

  /** 当前拖拽上下文 */
  private _dragCtx: DragContext | null = null;

  /** 当前选中的家具 ID */
  private _selectedDecoId: string | null = null;

  /** canvas 事件引用（用于 cleanup） */
  private _onRawMove: ((e: any) => void) | null = null;
  private _onRawUp: ((e: any) => void) | null = null;

  // ---- 公共 API ----

  /**
   * 启用拖拽系统（进入编辑模式）
   * @param roomContainer 房间家具的 PIXI 容器
   */
  enable(roomContainer: PIXI.Container): void {
    if (this._enabled) return;
    this._enabled = true;
    this._roomContainer = roomContainer;

    // 让容器支持排序
    roomContainer.sortableChildren = true;

    // 为所有家具 Sprite 启用交互
    for (const child of roomContainer.children) {
      if (child instanceof PIXI.Sprite && (child as any)._decoId) {
        this._enableSpriteInteraction(child as PIXI.Sprite);
        this._spriteMap.set((child as any)._decoId, child as PIXI.Sprite);
      }
    }

    // 绑定 canvas 级别的 move / up 事件
    const canvas = Game.app.view as any;
    this._onRawMove = this._handleRawMove.bind(this);
    this._onRawUp = this._handleRawUp.bind(this);
    canvas.addEventListener('pointermove', this._onRawMove);
    canvas.addEventListener('pointerup', this._onRawUp);
    canvas.addEventListener('pointercancel', this._onRawUp);

    console.log('[FurnitureDrag] 已启用');
    EventBus.emit('furniture:edit_enabled');
  }

  /**
   * 禁用拖拽系统（退出编辑模式）
   */
  disable(): void {
    if (!this._enabled) return;
    this._enabled = false;

    // 取消正在进行的拖拽
    if (this._dragCtx) {
      this._cancelDrag();
    }

    // 清除选中
    this.deselect();

    // 移除所有 Sprite 交互
    for (const sprite of this._spriteMap.values()) {
      sprite.eventMode = 'none';
      sprite.removeAllListeners();
    }

    // 解绑 canvas 事件
    const canvas = Game.app.view as any;
    if (this._onRawMove) {
      canvas.removeEventListener('pointermove', this._onRawMove);
      this._onRawMove = null;
    }
    if (this._onRawUp) {
      canvas.removeEventListener('pointerup', this._onRawUp);
      canvas.removeEventListener('pointercancel', this._onRawUp);
      this._onRawUp = null;
    }

    this._spriteMap.clear();
    this._roomContainer = null;

    // 保存布局
    RoomLayoutManager.saveNow();

    console.log('[FurnitureDrag] 已禁用');
    EventBus.emit('furniture:edit_disabled');
  }

  /** 是否正在编辑模式 */
  get isEnabled(): boolean {
    return this._enabled;
  }

  /** 当前选中的家具 ID */
  get selectedDecoId(): string | null {
    return this._selectedDecoId;
  }

  /**
   * 注册一个家具 Sprite（新添加到房间时调用）
   */
  registerSprite(sprite: PIXI.Sprite, decoId: string): void {
    (sprite as any)._decoId = decoId;
    this._spriteMap.set(decoId, sprite);
    if (this._enabled) {
      this._enableSpriteInteraction(sprite);
    }
  }

  /**
   * 注销一个家具 Sprite（从房间移除时调用）
   */
  unregisterSprite(decoId: string): void {
    if (this._selectedDecoId === decoId) {
      this.deselect();
    }
    const sprite = this._spriteMap.get(decoId);
    if (sprite) {
      sprite.eventMode = 'none';
      sprite.removeAllListeners();
      this._spriteMap.delete(decoId);
    }
  }

  /**
   * 根据 decoId 获取对应的 Sprite 引用
   */
  getSpriteByDecoId(decoId: string): PIXI.Sprite | undefined {
    return this._spriteMap.get(decoId);
  }

  /**
   * 选中家具
   */
  select(decoId: string): void {
    // 先取消旧选中
    if (this._selectedDecoId && this._selectedDecoId !== decoId) {
      this.deselect();
    }

    this._selectedDecoId = decoId;
    const sprite = this._spriteMap.get(decoId);
    if (sprite) {
      sprite.tint = 0xfff6cf;
      sprite.filters = null;
    }
    EventBus.emit('furniture:selected', decoId);
  }

  /**
   * 取消选中
   */
  deselect(): void {
    if (!this._selectedDecoId) return;
    const sprite = this._spriteMap.get(this._selectedDecoId);
    if (sprite) {
      sprite.tint = 0xffffff;
      sprite.filters = null;
    }
    this._selectedDecoId = null;
    EventBus.emit('furniture:deselected');
  }

  /**
   * 从外部（FurnitureTray）开始拖入新家具
   * 创建一个临时 Sprite 跟随手指
   * @param decoId 装饰 ID
   * @param globalX pointer 的全局 x（设计坐标）
   * @param globalY pointer 的全局 y（设计坐标）
   */
  startDragFromTray(decoId: string, globalX: number, globalY: number): void {
    if (!this._enabled || !this._roomContainer) return;

    this.deselect();

    const deco = DECO_MAP.get(decoId);
    if (!deco) return;

    if (!isDecoAllowedInScene(deco, CurrencyManager.state.sceneId)) {
      ToastMessage.show(`当前场景不可用（${formatAllowedScenesShort(deco)}）`);
      return;
    }

    const tex = TextureCache.get(deco.icon);
    if (!tex) return;

    // 将设计坐标转为容器本地坐标（支持 roomContainer 缩放后拖入）
    const localPos = this._designToLocal(globalX, globalY);

    const defaultPlacementScale = deco.defaultScale ?? 0.4;
    const baseScale =
      Math.min(SHOP_FURNITURE_TEX_BASE_PX / tex.width, SHOP_FURNITURE_TEX_BASE_PX / tex.height)
      * defaultPlacementScale;

    const glow = this._createNewFurnitureFeetGlow();
    glow.position.set(localPos.x, localPos.y);
    this._roomContainer.addChild(glow);

    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5, 0.8); // 底部偏中心作为锚点
    sprite.x = localPos.x;
    sprite.y = localPos.y;
    sprite.alpha = DRAG_ALPHA;
    sprite.scale.set(baseScale * DRAG_SCALE_BOOST);
    sprite.tint = 0xffffff;
    // 微信小游戏 WebGL 对自定义 Filter 兼容不稳；拖入预览只保留本体 + 脚底光圈，避免 sprite 被滤镜吞掉。
    sprite.filters = null;
    (sprite as any)._decoId = decoId;

    this._roomContainer.addChild(sprite);
    this._startNewFurnitureGlowPulse(glow);

    this._dragCtx = {
      sprite,
      decoId,
      startX: localPos.x,
      startY: localPos.y,
      pointerStartX: localPos.x,
      pointerStartY: localPos.y,
      dragging: true, // 从托盘拖入直接视为拖拽状态
      isNew: true,
      originalScale: baseScale,
      newFurnitureGlow: glow,
    };
    this.sortByDepth();
  }

  /**
   * 对房间内所有家具按 y 坐标排序（2.5D 遮挡），考虑手动图层偏移
   */
  sortByDepth(): void {
    if (!this._roomContainer) return;
    const layout = RoomLayoutManager.getLayout();
    const stackOrder = new Map<string, number>();
    for (let i = 0; i < layout.length; i++) {
      stackOrder.set(layout[i].decoId, i);
    }
    for (const child of this._roomContainer.children) {
      if (child instanceof PIXI.Sprite && (child as any)._decoId) {
        const decoId = (child as any)._decoId as string;
        const placement = RoomLayoutManager.getPlacement(decoId);
        const deco = DECO_MAP.get(decoId);
        if (!deco) continue;
        const feetY = child.y;
        // 从托盘拖入、尚未写入布局：用当前 y + 高后缀保证浮在前景，避免 zIndex=0 贴后墙
        if (!placement) {
          const dc = this._dragCtx;
          if (dc?.isNew && dc.decoId === decoId && child === dc.sprite) {
            child.zIndex = roomDepthZForPlacement(
              feetY,
              8,
              999,
              deco,
              ROOM_DEPTH_AUX_MAX,
            );
            if (dc.newFurnitureGlow) {
              dc.newFurnitureGlow.zIndex = child.zIndex - 2;
            }
          }
          continue;
        }
        const zLayer = placement.zLayer ?? 0;
        const pi = stackOrder.get(decoId) ?? 0;
        const stackTie = Math.min(pi, 999);
        child.zIndex = roomDepthZForPlacement(
          feetY,
          zLayer,
          stackTie,
          deco,
          placement.depthManualBias,
        );
      }
    }
    this._roomContainer.sortChildren();
  }

  // ---- 私有方法 ----

  /** 启用单个 Sprite 的交互 */
  private _enableSpriteInteraction(sprite: PIXI.Sprite): void {
    sprite.eventMode = 'static';
    sprite.cursor = 'grab';

    sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (!this._enabled || this._dragCtx) return;

      const decoId = (sprite as any)._decoId as string;
      const localPos = this._rawEventToDesign(e);

      // 用 scale.y 作为 originalScale（始终为正值，不受翻转影响）
      const absScale = Math.abs(sprite.scale.y);

      this._dragCtx = {
        sprite,
        decoId,
        startX: sprite.x,
        startY: sprite.y,
        pointerStartX: localPos.x,
        pointerStartY: localPos.y,
        dragging: false,
        isNew: false,
        originalScale: absScale,
      };

      // 选中该家具
      this.select(decoId);
    });
  }

  /** 处理 canvas 级别的 pointermove */
  private _handleRawMove(e: any): void {
    if (!this._dragCtx || !this._enabled) return;

    const pos = this._clientToDesign(e);
    const ctx = this._dragCtx;

    // 判定是否开始拖拽（超过移动阈值）
    if (!ctx.dragging) {
      const dx = pos.x - ctx.pointerStartX;
      const dy = pos.y - ctx.pointerStartY;
      if (Math.sqrt(dx * dx + dy * dy) < MOVE_THRESHOLD) return;
      ctx.dragging = true;
      ctx.sprite.alpha = DRAG_ALPHA;
      // 保持翻转方向：scale.x 可能为负值（翻转），只改变绝对值
      const boosted = ctx.originalScale * DRAG_SCALE_BOOST;
      const signX = ctx.sprite.scale.x < 0 ? -1 : 1;
      ctx.sprite.scale.set(signX * boosted, boosted);
      ctx.sprite.cursor = 'grabbing';
    }

    // 计算新位置
    const bounds = RoomLayoutManager.bounds;
    const dx = pos.x - ctx.pointerStartX;
    const dy = pos.y - ctx.pointerStartY;
    const newX = Math.max(bounds.minX, Math.min(bounds.maxX, ctx.startX + dx));
    const newY = Math.max(bounds.minY, Math.min(bounds.maxY, ctx.startY + dy));

    ctx.sprite.x = newX;
    ctx.sprite.y = newY;
    if (ctx.newFurnitureGlow) {
      ctx.newFurnitureGlow.x = newX;
      ctx.newFurnitureGlow.y = newY;
    }

    // 实时排序
    this.sortByDepth();
  }

  /** 处理 canvas 级别的 pointerup */
  private _handleRawUp(e: any): void {
    if (!this._dragCtx || !this._enabled) return;

    const ctx = this._dragCtx;
    this._dragCtx = null;

    if (!ctx.dragging) {
      // 没有实际拖动，只是点击 → 保持选中状态即可
      return;
    }

    const bounds = RoomLayoutManager.bounds;
    const finalX = ctx.sprite.x;
    const finalY = ctx.sprite.y;

    // 检查是否在房间区域内
    const inBounds = finalX >= bounds.minX && finalX <= bounds.maxX
                  && finalY >= bounds.minY && finalY <= bounds.maxY;

    const disposeNewDragExtras = () => {
      this._disposeNewFurnitureDragExtras(ctx);
    };

    if (ctx.isNew) {
      if (inBounds) {
        // 从托盘拖入成功 → 添加到布局
        // placement.scale 存的是「相对纹理基准」倍率（与 ShopScene 渲染一致），
        // 不是 PIXI 上的绝对 scale（后者 = baseRatio * 倍率）。
        const deco = DECO_MAP.get(ctx.decoId);
        const tex = deco ? TextureCache.get(deco.icon) : null;
        let placementScaleMult = deco?.defaultScale ?? 0.4;
        if (deco && tex) {
          const baseRatio = Math.min(
            SHOP_FURNITURE_TEX_BASE_PX / tex.width,
            SHOP_FURNITURE_TEX_BASE_PX / tex.height,
          );
          if (baseRatio > 1e-6) {
            placementScaleMult = ctx.originalScale / baseRatio;
          }
        }
        placementScaleMult = Math.max(
          FURNITURE_PLACEMENT_SCALE_MIN,
          Math.min(FURNITURE_PLACEMENT_SCALE_MAX, placementScaleMult),
        );

        const placement = RoomLayoutManager.addFurniture(
          ctx.decoId, finalX, finalY, placementScaleMult, false
        );
        if (placement) {
          disposeNewDragExtras();
          this.registerSprite(ctx.sprite, ctx.decoId);
          this._playBounceAnimation(ctx.sprite, ctx.originalScale);
          this.select(ctx.decoId);
          EventBus.emit('furniture:placed', placement);
        } else {
          // 已存在，移除临时 Sprite
          disposeNewDragExtras();
          ctx.sprite.parent?.removeChild(ctx.sprite);
          ctx.sprite.destroy();
        }
      } else {
        // 拖出了房间 → 移除临时 Sprite
        disposeNewDragExtras();
        ctx.sprite.parent?.removeChild(ctx.sprite);
        ctx.sprite.destroy();
        EventBus.emit('furniture:drag_cancelled', ctx.decoId);
      }
    } else {
      // 移动已有家具
      if (inBounds) {
        const moved = RoomLayoutManager.moveFurniture(ctx.decoId, finalX, finalY);
        this._playBounceAnimation(ctx.sprite, ctx.originalScale);
        if (moved) EventBus.emit('furniture:moved', RoomLayoutManager.getPlacement(ctx.decoId));
      } else {
        // 拖出房间 → 回到原位
        TweenManager.to({
          target: ctx.sprite,
          props: { x: ctx.startX, y: ctx.startY },
          duration: 0.2,
          ease: Ease.easeOutQuad,
          onComplete: () => {
            ctx.sprite.alpha = 1;
            this.sortByDepth();
          },
        });
        const signX = ctx.sprite.scale.x < 0 ? -1 : 1;
        ctx.sprite.scale.set(signX * ctx.originalScale, ctx.originalScale);
        return;
      }
    }

    // 恢复外观
    ctx.sprite.alpha = 1;
    ctx.sprite.cursor = 'grab';
    this.sortByDepth();
  }

  /** 放置时的弹跳动画（保持翻转方向） */
  private _playBounceAnimation(sprite: PIXI.Sprite, targetScale: number): void {
    const signX = sprite.scale.x < 0 ? -1 : 1;
    // 先压扁再弹回
    sprite.scale.set(signX * targetScale * 0.85, targetScale * 1.15);
    TweenManager.to({
      target: sprite.scale,
      props: { x: signX * targetScale, y: targetScale },
      duration: BOUNCE_DURATION,
      ease: Ease.easeOutBack,
    });
  }

  /** 取消当前拖拽 */
  private _cancelDrag(): void {
    if (!this._dragCtx) return;
    const ctx = this._dragCtx;
    this._dragCtx = null;

    if (ctx.isNew) {
      this._disposeNewFurnitureDragExtras(ctx);
      ctx.sprite.parent?.removeChild(ctx.sprite);
      ctx.sprite.destroy();
    } else {
      ctx.sprite.x = ctx.startX;
      ctx.sprite.y = ctx.startY;
      ctx.sprite.alpha = 1;
      const signX = ctx.sprite.scale.x < 0 ? -1 : 1;
      ctx.sprite.scale.set(signX * ctx.originalScale, ctx.originalScale);
    }
  }

  /** FederatedPointerEvent → 容器本地坐标（考虑 roomContainer 的 transform） */
  private _rawEventToDesign(e: PIXI.FederatedPointerEvent): { x: number; y: number } {
    // global 坐标是 canvas 物理像素空间 [0, screenWidth*dpr]
    // 转为设计坐标 [0, designWidth]：除以 dpr 得到逻辑像素，再乘 designWidth/screenWidth
    const designX = (e.global.x / Game.dpr) * Game.designWidth / Game.screenWidth;
    const designY = (e.global.y / Game.dpr) * Game.designHeight / Game.screenHeight;
    return this._designToLocal(designX, designY);
  }

  /** canvas 原生事件 → 容器本地坐标（考虑 roomContainer 的 transform） */
  private _clientToDesign(e: any): { x: number; y: number } {
    const clientX = e.clientX ?? e.pageX ?? 0;
    const clientY = e.clientY ?? e.pageY ?? 0;
    const designX = clientX * Game.designWidth / Game.screenWidth;
    const designY = clientY * Game.designHeight / Game.screenHeight;
    return this._designToLocal(designX, designY);
  }

  private _disposeNewFurnitureDragExtras(ctx: DragContext): void {
    if (ctx.newFurnitureGlow) {
      TweenManager.cancelTarget(ctx.newFurnitureGlow);
      ctx.newFurnitureGlow.parent?.removeChild(ctx.newFurnitureGlow);
      ctx.newFurnitureGlow.destroy();
      ctx.newFurnitureGlow = undefined;
    }
    if (ctx.isNew) {
      ctx.sprite.filters = null;
    }
  }

  /** 从托盘拖入时脚下柔光：仅脚点附近小圈（无外圈大椭圆），不挡触摸 */
  private _createNewFurnitureFeetGlow(): PIXI.Graphics {
    const g = new PIXI.Graphics();
    g.beginFill(0xfff5e0, 0.48);
    g.drawEllipse(0, -16, 32, 21);
    g.endFill();
    g.beginFill(0xffffff, 0.2);
    g.drawEllipse(0, -17, 18, 12);
    g.endFill();
    g.eventMode = 'none';
    (g as any)._isNewFurnitureGlow = true;
    return g;
  }

  /** 柔光轻微呼吸，便于在复杂地面上发现新件 */
  private _startNewFurnitureGlowPulse(g: PIXI.Graphics): void {
    TweenManager.cancelTarget(g);
    const runUp = () => {
      TweenManager.to({
        target: g,
        props: { alpha: 1 },
        duration: 0.48,
        ease: Ease.easeInOutQuad,
        onComplete: runDown,
      });
    };
    const runDown = () => {
      TweenManager.to({
        target: g,
        props: { alpha: 0.72 },
        duration: 0.48,
        ease: Ease.easeInOutQuad,
        onComplete: runUp,
      });
    };
    g.alpha = 0.88;
    runDown();
  }

  /** 设计坐标 → roomContainer 本地坐标 */
  private _designToLocal(designX: number, designY: number): { x: number; y: number } {
    if (!this._roomContainer) return { x: designX, y: designY };
    const c = this._roomContainer;
    const s = c.scale.x || 1;  // 假设 scale.x === scale.y
    return {
      x: (designX - c.position.x) / s + c.pivot.x,
      y: (designY - c.position.y) / s + c.pivot.y,
    };
  }
}

export const FurnitureDragSystem = new FurnitureDragSystemClass();
