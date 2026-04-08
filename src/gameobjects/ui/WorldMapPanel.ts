/**
 * 大地图 — 全屏独立页（挂 OverlayManager，盖住花店/顶栏）
 *
 * 可横向 + 纵向拖拽浏览超大地图底图与建筑节点；canvas 级 pointermove。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { AudioManager } from '@/core/AudioManager';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { TextureCache } from '@/utils/TextureCache';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { OverlayManager } from '@/core/OverlayManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import {
  MAP_NODES,
  MAP_NODE_UNMET_UNLOCK_ALPHA,
  WORLD_MAP_CONTENT_W,
  WORLD_MAP_CONTENT_H,
  type MapNodeDef,
} from '@/config/WorldMapConfig';
import { WishingFountainMapFxLayer } from '@/gameobjects/ui/WishingFountainMapFxLayer';
import { createSmallNameLockIcon } from '@/gameobjects/ui/mysteryCardPlaceholder';

const FRICTION = 0.92;
const MIN_VELOCITY = 0.4;
const BOUNCE_FACTOR = 0.18;
const DRAG_THRESHOLD = 6;

/** 高于花店内 UI，低于地图弹窗商店 */
export const WORLD_MAP_PANEL_Z = 10500;

export class WorldMapPanel extends PIXI.Container {
  private _isOpen = false;
  private _pageBg!: PIXI.Graphics;
  private _scrollContent!: PIXI.Container;
  private _scrollMask!: PIXI.Graphics;
  private _topBar!: PIXI.Container;
  private _closeBtn!: PIXI.Container;

  private _scrollX = 0;
  private _scrollY = 0;
  private _velocityX = 0;
  private _velocityY = 0;
  private _contentW = WORLD_MAP_CONTENT_W;
  /** 地图可滚动区域高度 = 整屏逻辑高，底图竖向铺满 9:16 */
  private _contentH = Game.logicHeight;

  private _isDragging = false;
  private _dragStartGX = 0;
  private _dragStartGY = 0;
  private _scrollStartX = 0;
  private _scrollStartY = 0;
  private _lastDragGX = 0;
  private _lastDragGY = 0;
  private _lastDragTime = 0;
  private _hasMoved = false;

  /** 许愿喷泉两帧精灵，大地图打开时交替显示模拟水波 */
  private _wishingFountainAnimPair: [PIXI.Sprite, PIXI.Sprite] | null = null;
  private _wishingFountainAnimAcc = 0;

  /** 花店场景截取的当前房间缩略图（关闭大地图后销毁） */
  private _liveHouseRt: PIXI.RenderTexture | null = null;

  private _onRawMove: ((e: any) => void) | null = null;
  private _onRawUp: ((e: any) => void) | null = null;

  private readonly _onTicker = (): void => {
    if (!this._isOpen || !this.visible) return;
    this._tickWishingFountainWaterAnim(Game.ticker.deltaMS);
    this.update(Game.ticker.deltaMS / 1000);
  };

  constructor() {
    super();
    this.visible = false;
    this.zIndex = WORLD_MAP_PANEL_Z;
    this.sortableChildren = true;
    this._contentW = WORLD_MAP_CONTENT_W;
    this._contentH = Game.logicHeight;
    this._build();
  }

  get isOpen(): boolean { return this._isOpen; }

  /**
   * 设置当前装修房间实时缩略图（仅对与 `CurrencyManager.state.sceneId` 匹配的地图节点生效）。
   * 传入 null 表示仅用静态 thumb；非 null 时面板关闭后会 destroy。
   */
  setLiveHouseThumbnail(rt: PIXI.RenderTexture | null): void {
    const prev = this._liveHouseRt;
    this._liveHouseRt = rt;
    this._syncLiveBuildingThumbTexture();
    if (prev && prev !== rt && !prev.destroyed) prev.destroy(true);
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    AudioManager.play('world_map_open');
    this._wishingFountainAnimAcc = 0;
    this._refreshNodes();
    const wf = this._wishingFountainAnimPair;
    if (wf) {
      wf[0].visible = true;
      wf[1].visible = false;
    }
    this._scrollToCurrentHouse();
    this.alpha = 0;
    Game.ticker.add(this._onTicker, this);
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.28, ease: Ease.easeOutQuad });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    Game.ticker.remove(this._onTicker, this);
    this._cleanupRawEvents();
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.22, ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this._releaseLiveHouseThumb();
      },
    });
  }

  update(dt: number): void {
    if (!this._isOpen || this._isDragging) return;

    if (Math.abs(this._velocityX) > MIN_VELOCITY) {
      this._scrollX += this._velocityX;
      this._velocityX *= FRICTION;
    } else {
      this._velocityX = 0;
    }

    if (Math.abs(this._velocityY) > MIN_VELOCITY) {
      this._scrollY += this._velocityY;
      this._velocityY *= FRICTION;
    } else {
      this._velocityY = 0;
    }

    this._applyBounce();
    this._syncScroll();
  }

  // ═══════════════ 构建 ═══════════════

  private _build(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    // 整页不透明底色（禁止透出花店 UI，参考独立大地图页）
    this._pageBg = new PIXI.Graphics();
    this._pageBg.beginFill(0x9AAB8C);
    this._pageBg.drawRect(0, 0, W, H);
    this._pageBg.endFill();
    this._pageBg.eventMode = 'static';
    this._pageBg.zIndex = 0;
    this.addChild(this._pageBg);

    this._scrollMask = new PIXI.Graphics();
    this._scrollMask.beginFill(0xFFFFFF);
    this._scrollMask.drawRect(0, 0, W, H);
    this._scrollMask.endFill();
    this._scrollMask.eventMode = 'none'; // 勿挡在 scrollContent 前吞掉点击
    this._scrollMask.zIndex = 10;
    this.addChild(this._scrollMask);

    this._scrollContent = new PIXI.Container();
    this._scrollContent.mask = this._scrollMask;
    this._scrollContent.zIndex = 20;
    this.addChild(this._scrollContent);

    this._drawMapBackground();
    this._buildNodes();
    this._setupDrag();
    this._buildTopBar();
  }

  /** 底图缺失时回退到已加载的花店草地 / 主界面顶图，避免整屏纯色 */
  private _resolveWorldmapBgTexture(): PIXI.Texture | null {
    const keys = ['worldmap_bg', 'house_bg', 'shop_scene_bg'] as const;
    for (const k of keys) {
      const t = TextureCache.get(k);
      if (t && t.width > 1) return t;
    }
    return null;
  }

  /** 建筑缩略图缺失时按节点类型回退到已有分包图 */
  private _resolveNodeThumbTexture(node: MapNodeDef): PIXI.Texture | null {
    const keys: string[] = [node.thumbKey];
    switch (node.id) {
      case 'flower_shop':
        keys.push('house_shop', 'bg_room_default');
        break;
      case 'wishing_fountain':
        keys.push('worldmap_thumb_wishing_fountain_2', 'icon_worldmap');
        break;
      case 'butterfly_house':
        keys.push('icon_build');
        break;
      case 'cake_shop':
        keys.push('icon_build');
        break;
      case 'timed_event':
        keys.push('icon_worldmap');
        break;
      default:
        break;
    }
    for (const k of keys) {
      const t = TextureCache.get(k);
      if (t && t.width > 1) return t;
    }
    return null;
  }

  private _drawMapBackground(): void {
    const tex = this._resolveWorldmapBgTexture();
    if (tex && tex.width > 1) {
      const sp = new PIXI.Sprite(tex);
      sp.width = this._contentW;
      sp.height = this._contentH;
      sp.eventMode = 'none'; // 穿透到底层 hitLayer，否则拖不动地图
      this._scrollContent.addChild(sp);
    } else {
      const g = new PIXI.Graphics();
      g.beginFill(0xB4C4A8);
      g.drawRect(0, 0, this._contentW, this._contentH);
      g.endFill();

      g.lineStyle(14, 0xE8E0D4, 0.85);
      g.moveTo(40, this._contentH * 0.72);
      g.bezierCurveTo(
        this._contentW * 0.25, this._contentH * 0.35,
        this._contentW * 0.45, this._contentH * 0.88,
        this._contentW * 0.55, this._contentH * 0.42,
      );
      g.bezierCurveTo(
        this._contentW * 0.68, this._contentH * 0.18,
        this._contentW * 0.82, this._contentH * 0.55,
        this._contentW - 40, this._contentH * 0.38,
      );

      for (let i = 0; i < 32; i++) {
        const tx = 60 + Math.random() * (this._contentW - 120);
        const ty = 40 + Math.random() * (this._contentH - 80);
        const r = 10 + Math.random() * 16;
        g.beginFill(0x6B9E5E, 0.35 + Math.random() * 0.35);
        g.drawCircle(tx, ty, r);
        g.endFill();
      }
      for (let i = 0; i < 14; i++) {
        const tx = 80 + Math.random() * (this._contentW - 160);
        const ty = 50 + Math.random() * (this._contentH - 100);
        g.beginFill(0xE8A0B4, 0.25);
        g.drawEllipse(tx, ty, 18, 10);
        g.endFill();
      }
      g.eventMode = 'none';
      this._scrollContent.addChild(g);
    }
  }

  private _nodeContainers: PIXI.Container[] = [];

  /** 配置里节点 y 基于 WORLD_MAP_CONTENT_H，映射到当前屏高 */
  private _mapNodeY(layoutY: number): number {
    return (layoutY * this._contentH) / WORLD_MAP_CONTENT_H;
  }

  private _buildNodes(): void {
    this._wishingFountainAnimPair = null;
    for (const node of MAP_NODES) {
      const nc = this._createNodeContainer(node);
      nc.position.set(node.x, this._mapNodeY(node.y));
      this._scrollContent.addChild(nc);
      this._nodeContainers.push(nc);
    }
    this._syncLiveBuildingThumbTexture();
  }

  private _createNodeContainer(node: MapNodeDef): PIXI.Container {
    const c = new PIXI.Container();
    (c as any)._nodeId = node.id;

    const thumbSize = node.thumbSize ?? 150;
    const tF1 = TextureCache.get('worldmap_thumb_wishing_fountain_1');
    const tF2 = TextureCache.get('worldmap_thumb_wishing_fountain_2');

    if (node.id === 'wishing_fountain' && tF1 && tF1.width > 1 && tF2 && tF2.width > 1) {
      const sa = new PIXI.Sprite(tF1);
      const sb = new PIXI.Sprite(tF2);
      sa.anchor.set(0.5);
      sb.anchor.set(0.5);
      const maxDim = Math.max(tF1.width, tF1.height, tF2.width, tF2.height);
      const sc = thumbSize / maxDim;
      sa.scale.set(sc);
      sb.scale.set(sc);
      sa.eventMode = 'none';
      sb.eventMode = 'none';
      sb.visible = false;
      c.addChild(sa);
      c.addChild(sb);
      /** 细闪叠在缩略图之上（在图后会被不透明像素挡住），文字 label 后加保持最上层 */
      c.addChild(new WishingFountainMapFxLayer(thumbSize));
      (c as any)._mapThumbSprite = sa;
      this._wishingFountainAnimPair = [sa, sb];
    } else {
      const tex = this._resolveNodeThumbTexture(node);

      if (tex && tex.width > 1) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const sc = thumbSize / Math.max(tex.width, tex.height);
        sp.scale.set(sc);
        sp.eventMode = 'none';
        (c as any)._mapThumbSprite = sp;
        c.addChild(sp);
      } else {
        const g = new PIXI.Graphics();
        const hw = thumbSize / 2;
        const hh = thumbSize * 0.6;
        g.beginFill(this._nodeColor(node), 0.85);
        g.moveTo(0, -hh);
        g.lineTo(hw, -hh * 0.3);
        g.lineTo(hw, hh * 0.5);
        g.lineTo(-hw, hh * 0.5);
        g.lineTo(-hw, -hh * 0.3);
        g.closePath();
        g.endFill();
        g.beginFill(this._nodeColor(node), 0.6);
        g.moveTo(-hw - 10, -hh * 0.3);
        g.lineTo(0, -hh);
        g.lineTo(hw + 10, -hh * 0.3);
        g.closePath();
        g.endFill();
        g.eventMode = 'none';
        (c as any)._mapThumbSprite = undefined;
        c.addChild(g);
      }
    }

    const namePlateY = (thumbSize * 0.6) / 2 + 8 + 15 + 10;
    const namePlate = new PIXI.Container();
    namePlate.eventMode = 'none';
    namePlate.y = namePlateY;
    const mapLabel = new PIXI.Text(node.label, {
      fontSize: 18, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      stroke: 0x2C2419, strokeThickness: 3,
    });
    mapLabel.anchor.set(0, 0);
    mapLabel.eventMode = 'none';
    const mapLockAfterName = createSmallNameLockIcon(240, 140);
    mapLockAfterName.visible = false;
    mapLockAfterName.eventMode = 'none';
    namePlate.addChild(mapLabel);
    namePlate.addChild(mapLockAfterName);
    (c as any)._namePlate = namePlate;
    (c as any)._mapLabel = mapLabel;
    (c as any)._mapLockAfterName = mapLockAfterName;
    c.addChild(namePlate);

    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.hitArea = new PIXI.Rectangle(-thumbSize / 2, -thumbSize * 0.6, thumbSize, thumbSize * 0.6 + 40);

    return c;
  }

  private _tickWishingFountainWaterAnim(deltaMS: number): void {
    const pair = this._wishingFountainAnimPair;
    if (!pair) return;
    this._wishingFountainAnimAcc += deltaMS;
    if (this._wishingFountainAnimAcc < 420) return;
    this._wishingFountainAnimAcc = 0;
    const [a, b] = pair;
    const showA = !a.visible;
    a.visible = showA;
    b.visible = !showA;
  }

  private _nodeColor(node: MapNodeDef): number {
    switch (node.type) {
      case 'current_house': return 0xFFB347;
      case 'house': return 0x81C784;
      case 'popup_shop': return 0x64B5F6;
      case 'gacha': return 0xF48FB1;
      case 'locked': return 0x9E9E9E;
      default: return 0xBDBDBD;
    }
  }

  private _refreshNodes(): void {
    const globalLevel = CurrencyManager.globalLevel;
    const currentSceneId = CurrencyManager.state.sceneId;

    for (let i = 0; i < MAP_NODES.length; i++) {
      const node = MAP_NODES[i];
      const nc = this._nodeContainers[i];
      if (!nc) continue;

      const unlocked = globalLevel >= node.unlockLevel;
      const isCurrent = node.targetSceneId === currentSceneId;

      nc.alpha = unlocked ? 1 : (node.unmetUnlockAlpha ?? MAP_NODE_UNMET_UNLOCK_ALPHA);

      const oldBadges = nc.children.filter(ch => (ch as any)._isBadge);
      for (const b of oldBadges) nc.removeChild(b);

      if (isCurrent && node.type !== 'locked') {
        const badge = this._createBadge('当前');
        (badge as any)._isBadge = true;
        const thumbSize = node.thumbSize ?? 150;
        // 徽章贴在缩略图顶缘略上方（中心约在上半边界外），避免过远飘在天上
        badge.y = -thumbSize * 0.5 - 20;
        nc.addChild(badge);
      }

      const namePlate = (nc as any)._namePlate as PIXI.Container | undefined;
      const mapLabel = (nc as any)._mapLabel as PIXI.Text | undefined;
      const mapLockAfterName = (nc as any)._mapLockAfterName as PIXI.Container | undefined;
      if (namePlate && mapLabel && mapLockAfterName) {
        this._layoutMapNodeNameRow(namePlate, mapLabel, mapLockAfterName, !unlocked);
      }

      nc.removeAllListeners('pointertap');
      nc.on('pointertap', () => {
        if (this._hasMoved) return;
        this._onNodeTap(node, unlocked, isCurrent);
      });
    }

    this._syncLiveBuildingThumbTexture();
  }

  /** 与当前存档 sceneId 一致的节点用实时截图，其余恢复静态 thumb */
  private _syncLiveBuildingThumbTexture(): void {
    const currentSceneId = CurrencyManager.state.sceneId;
    const live = this._liveHouseRt && !this._liveHouseRt.destroyed ? this._liveHouseRt : null;

    for (let i = 0; i < MAP_NODES.length; i++) {
      const node = MAP_NODES[i];
      if (node.id === 'wishing_fountain') continue;
      const nc = this._nodeContainers[i];
      const sp = nc ? (nc as any)._mapThumbSprite as PIXI.Sprite | undefined : undefined;
      if (!sp || sp.destroyed) continue;

      const thumbSize = node.thumbSize ?? 150;
      const allowLive = node.useLiveMapThumb !== false;
      const useLive = allowLive
        && !!live
        && node.targetSceneId === currentSceneId
        && node.type !== 'popup_shop'
        && node.type !== 'gacha'
        && node.type !== 'locked';

      if (useLive && live && live.width >= 2 && live.height >= 2) {
        sp.texture = live;
        sp.visible = true;
        sp.alpha = 1;
        const sc = thumbSize / Math.max(live.width, live.height);
        sp.scale.set(sc);
        continue;
      }

      const tex = this._resolveNodeThumbTexture(node);
      if (tex && tex.width > 1) {
        sp.texture = tex;
        const sc = thumbSize / Math.max(tex.width, tex.height);
        sp.scale.set(sc);
      }
    }
  }

  private _releaseLiveHouseThumb(): void {
    if (!this._liveHouseRt) return;
    const was = this._liveHouseRt;
    this._liveHouseRt = null;
    this._syncLiveBuildingThumbTexture();
    if (!was.destroyed) was.destroy(true);
  }

  private _createBadge(text: string): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'none';
    const t = new PIXI.Text(text, {
      fontSize: 17,
      fill: 0xFFF8F0,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x5C1A12,
      strokeThickness: 3,
      dropShadow: true,
      dropShadowColor: 0x3D0D08,
      dropShadowAlpha: 0.45,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    t.anchor.set(0.5);
    const padX = 10;
    const padY = 7;
    const rw = t.width + padX * 2;
    const rh = t.height + padY * 2;
    const rr = 11;
    const bg = new PIXI.Graphics();
    bg.lineStyle(2.2, 0xFFE8A8, 0.95);
    bg.beginFill(0xD94A3D, 0.97);
    bg.drawRoundedRect(-rw / 2, -rh / 2, rw, rh, rr);
    bg.endFill();
    bg.eventMode = 'none';
    t.eventMode = 'none';
    c.addChild(bg);
    c.addChild(t);
    return c;
  }

  /** 名称 + 未解锁时右侧小锁（与装修面板 createSmallNameLockIcon 同源） */
  private _layoutMapNodeNameRow(
    namePlate: PIXI.Container,
    label: PIXI.Text,
    lockAfter: PIXI.Container,
    showLock: boolean,
  ): void {
    const gap = 6;
    lockAfter.visible = showLock;
    if (showLock) {
      lockAfter.position.set(label.width + gap, label.height * 0.5);
      const lb = lockAfter.getLocalBounds();
      const lockW = Math.max(lb.width, 12);
      const totalW = label.width + gap + lockW;
      namePlate.pivot.set(totalW * 0.5, 0);
    } else {
      namePlate.pivot.set(label.width * 0.5, 0);
    }
  }

  private _onNodeTap(node: MapNodeDef, unlocked: boolean, isCurrent: boolean): void {
    if (!unlocked) {
      ToastMessage.show(`综合等级 ${node.unlockLevel} 解锁「${node.label}」`);
      return;
    }

    if (isCurrent) {
      this.close();
      return;
    }

    switch (node.type) {
      case 'house':
      case 'current_house':
        this.close();
        if (node.targetSceneId) {
          EventBus.emit('worldmap:switchScene', node.targetSceneId);
        }
        break;
      case 'popup_shop':
        if (node.popupEvent && node.shopId) {
          EventBus.emit(node.popupEvent, node.shopId);
        }
        break;
      case 'gacha':
        if (node.popupEvent) {
          OverlayManager.bringToFront();
          EventBus.emit(node.popupEvent);
        }
        break;
      case 'locked':
        ToastMessage.show(`综合等级 ${node.unlockLevel} 解锁「${node.label}」`);
        break;
    }
  }

  // ═══════════════ 滚动与拖拽 ═══════════════

  private _setupDrag(): void {
    const hitLayer = new PIXI.Graphics();
    hitLayer.beginFill(0xFFFFFF, 0.001);
    hitLayer.drawRect(0, 0, this._contentW, this._contentH);
    hitLayer.endFill();
    hitLayer.eventMode = 'static';
    this._scrollContent.addChildAt(hitLayer, 0);

    const canvas = Game.app.view as any;

    hitLayer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._isDragging = true;
      this._hasMoved = false;
      const { gx, gy } = this._rawFromFederated(e);
      this._dragStartGX = gx;
      this._dragStartGY = gy;
      this._scrollStartX = this._scrollX;
      this._scrollStartY = this._scrollY;
      this._lastDragGX = gx;
      this._lastDragGY = gy;
      this._lastDragTime = Date.now();
      this._velocityX = 0;
      this._velocityY = 0;

      this._cleanupRawEvents();

      this._onRawMove = (rawE: any) => {
        if (!this._isDragging) return;
        const { gx: nx, gy: ny } = this._rawToDesign(rawE);
        const dxTotal = nx - this._dragStartGX;
        const dyTotal = ny - this._dragStartGY;
        if (Math.abs(dxTotal) > DRAG_THRESHOLD || Math.abs(dyTotal) > DRAG_THRESHOLD) {
          this._hasMoved = true;
        }

        const now = Date.now();
        const dtMs = Math.max(1, now - this._lastDragTime);
        this._velocityX = (nx - this._lastDragGX) / dtMs * 16;
        this._velocityY = (ny - this._lastDragGY) / dtMs * 16;
        this._lastDragGX = nx;
        this._lastDragGY = ny;
        this._lastDragTime = now;

        this._scrollX = this._scrollStartX + dxTotal;
        this._scrollY = this._scrollStartY + dyTotal;
        this._syncScroll();
      };

      this._onRawUp = () => {
        this._isDragging = false;
        this._cleanupRawEvents();
      };

      canvas.addEventListener('pointermove', this._onRawMove);
      canvas.addEventListener('pointerup', this._onRawUp);
      canvas.addEventListener('pointercancel', this._onRawUp);
    });
  }

  private _rawFromFederated(e: PIXI.FederatedPointerEvent): { gx: number; gy: number } {
    return { gx: e.globalX, gy: e.globalY };
  }

  private _rawToDesign(e: any): { gx: number; gy: number } {
    const rect = (Game.app.view as any).getBoundingClientRect
      ? (Game.app.view as any).getBoundingClientRect()
      : { left: 0, top: 0, width: Game.screenWidth, height: Game.screenHeight };
    const clientX = e.clientX ?? e.pageX ?? (e.changedTouches?.[0]?.clientX ?? 0);
    const clientY = e.clientY ?? e.pageY ?? (e.changedTouches?.[0]?.clientY ?? 0);
    const ratioX = Game.designWidth / (rect.width || Game.screenWidth);
    const ratioY = Game.logicHeight / (rect.height || Game.screenHeight);
    return {
      gx: (clientX - rect.left) * ratioX,
      gy: (clientY - rect.top) * ratioY,
    };
  }

  private _cleanupRawEvents(): void {
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
  }

  private _syncScroll(): void {
    this._scrollContent.x = this._scrollX;
    this._scrollContent.y = this._scrollY;
  }

  private _applyBounce(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;
    const minX = -(this._contentW - W);
    const maxX = 0;
    const minY = -(this._contentH - H);
    const maxY = 0;

    if (this._scrollX > maxX) {
      this._scrollX += (maxX - this._scrollX) * BOUNCE_FACTOR;
      this._velocityX = 0;
    } else if (this._scrollX < minX) {
      this._scrollX += (minX - this._scrollX) * BOUNCE_FACTOR;
      this._velocityX = 0;
    }

    if (this._contentH > H) {
      if (this._scrollY > maxY) {
        this._scrollY += (maxY - this._scrollY) * BOUNCE_FACTOR;
        this._velocityY = 0;
      } else if (this._scrollY < minY) {
        this._scrollY += (minY - this._scrollY) * BOUNCE_FACTOR;
        this._velocityY = 0;
      }
    } else {
      this._scrollY = (H - this._contentH) / 2;
      this._velocityY = 0;
    }
  }

  private _scrollToCurrentHouse(): void {
    const currentSceneId = CurrencyManager.state.sceneId;
    const node = MAP_NODES.find(n => n.targetSceneId === currentSceneId);
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;
    if (!node) {
      this._scrollX = 0;
      this._scrollY = this._contentH > H ? 0 : (H - this._contentH) / 2;
    } else {
      const ny = this._mapNodeY(node.y);
      this._scrollX = Math.max(-(this._contentW - W), Math.min(0, -node.x + W / 2));
      if (this._contentH > H) {
        this._scrollY = Math.max(-(this._contentH - H), Math.min(0, -ny + H / 2));
      } else {
        this._scrollY = (H - this._contentH) / 2;
      }
    }
    this._syncScroll();
  }

  // ═══════════════ 顶栏（独立页导航） ═══════════════

  private _buildTopBar(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;
    const topH = Game.safeTop + 52;

    this._topBar = new PIXI.Container();
    this._topBar.zIndex = 4000;
    this._topBar.eventMode = 'static';

    const barBg = new PIXI.Graphics();
    barBg.beginFill(0x2A241C, 0.78);
    barBg.drawRect(0, 0, W, topH);
    barBg.endFill();
    barBg.lineStyle(0);
    this._topBar.addChild(barBg);

    const title = new PIXI.Text('世界地图', {
      fontSize: 20,
      fill: 0xFFF8F0,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0.5);
    title.position.set(W / 2, Game.safeTop + 26);
    this._topBar.addChild(title);

    const hint = new PIXI.Text('拖动地图探索', {
      fontSize: 12,
      fill: 0xD7CCC8,
      fontFamily: FONT_FAMILY,
    });
    hint.anchor.set(0.5, 0);
    hint.position.set(W / 2, Game.safeTop + 44);
    this._topBar.addChild(hint);

    this._closeBtn = new PIXI.Container();
    const r = 22;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFFFF, 0.18);
    bg.drawCircle(0, 0, r);
    bg.endFill();
    bg.lineStyle(2.2, 0xFFF8F0, 0.95);
    const aw = 8;
    bg.moveTo(-aw * 0.3, 0);
    bg.lineTo(aw * 0.9, -aw);
    bg.lineTo(aw * 0.9, aw);
    bg.closePath();
    this._closeBtn.addChild(bg);
    this._closeBtn.position.set(28 + r, Game.safeTop + 26);
    this._closeBtn.eventMode = 'static';
    this._closeBtn.cursor = 'pointer';
    this._closeBtn.hitArea = new PIXI.Circle(0, 0, r + 14);
    this._closeBtn.on('pointertap', () => this.close());
    this._topBar.addChild(this._closeBtn);

    this.addChild(this._topBar);

    // 底边轻分割线
    const line = new PIXI.Graphics();
    line.beginFill(0x5D4E37, 0.35);
    line.drawRect(0, topH - 1, W, 1);
    line.endFill();
    line.zIndex = 4001;
    this._topBar.addChild(line);
  }
}
