/**
 * 大地图 — 全屏独立页（挂 OverlayManager，盖住花店/顶栏）
 *
 * 可横向 + 纵向拖拽浏览超大地图底图与建筑节点；canvas 级 pointermove。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { AudioManager } from '@/core/AudioManager';
import { SoundSystem } from '@/systems/SoundSystem';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { TextureCache } from '@/utils/TextureCache';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { OverlayManager } from '@/core/OverlayManager';
import { COLORS, DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
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
const DRAG_THRESHOLD = 6;

/** 高于花店内 UI，低于地图弹窗商店 */
export const WORLD_MAP_PANEL_Z = 10500;

export class WorldMapPanel extends PIXI.Container {
  private _isOpen = false;
  private _opening = false;
  private _assetUnsub: (() => void) | null = null;
  private _pageBg!: PIXI.Graphics;
  private _scrollContent!: PIXI.Container;
  private _scrollMask!: PIXI.Graphics;
  private _topBar!: PIXI.Container;
  private _closeBtn!: PIXI.Container;
  private _huayuanText!: PIXI.Text;
  private _staminaText!: PIXI.Text;
  private _staminaTimer!: PIXI.Text;
  private _diamondText!: PIXI.Text;
  private _staminaFill!: PIXI.Graphics;
  private _staminaInner = { x: 0, y: 0, w: 0, h: 0 };
  private _lastStaminaTimerText = '';

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
  /** 小游戏环境里 `pointertap` 易丢；改为 node `pointerdown` 标记，canvas `pointerup` 统一判定点击 */
  private _pressedNodeIndex = -1;

  /** 许愿喷泉两帧精灵，大地图打开时交替显示模拟水波 */
  private _wishingFountainAnimPair: [PIXI.Sprite, PIXI.Sprite] | null = null;
  private _wishingFountainAnimAcc = 0;

  /** 花店场景截取的当前房间缩略图（关闭大地图后销毁） */
  private _liveHouseRt: PIXI.RenderTexture | null = null;

  private _onRawMove: ((e: any) => void) | null = null;
  private _onRawUp: ((e: any) => void) | null = null;

  private readonly _onTicker = (): void => {
    if (!this._isOpen || !this.visible) return;
    this._updateHudTimer();
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
    if (this._isOpen || this._opening) return;
    this._opening = true;
    void TextureCache.preloadPanelAssets('worldmap').finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    /** 构造阶段 _build 可能早于纹理入缓存；preloadPanelAssets 完成后重绘，避免长期停在程序占位五边形 */
    this._rebuildMapContent();
    this._assetUnsub = TextureCache.onAssetGroupLoaded('worldmap', () => {
      if (this._isOpen) {
        this._rebuildMapContent();
        this._refreshNodes();
        this._refreshHud();
      }
    });
    AudioManager.play('world_map_open');
    SoundSystem.playWorldMapBGM();
    this._wishingFountainAnimAcc = 0;
    this._refreshNodes();
    this._refreshHud();
    this._updateHudTimer();
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
    this._opening = false;
    if (!this._isOpen) return;
    this._isOpen = false;
    this._assetUnsub?.();
    this._assetUnsub = null;
    this._pressedNodeIndex = -1;
    Game.ticker.remove(this._onTicker, this);
    this._cleanupRawEvents();
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.22, ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this._releaseLiveHouseThumb();
        SoundSystem.resumeSceneBGMAfterWorldMap();
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

    this._velocityY = 0;

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
    EventBus.on('currency:changed', () => this._refreshHud());
    EventBus.on('currency:loaded', () => this._refreshHud());
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

  private _rebuildMapContent(): void {
    this._scrollContent.removeChildren();
    this._nodeContainers = [];
    this._drawMapBackground();
    this._buildNodes();
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
    /**
     * 热区须盖住：缩略图按「最长边 = thumbSize」缩放后的实际高度（约 ±thumbSize/2）
     * 以及下方名称牌行。旧矩形底边约在 +thumbSize*0.6，喷泉等竖长缩略图下半截与整行文字都在区外，点击无反应。
     */
    const hitHalfW = thumbSize / 2;
    const hitTop = -thumbSize * 0.52 - 6;
    const hitBottom = namePlateY + 30;
    c.hitArea = new PIXI.Rectangle(-hitHalfW, hitTop, thumbSize, hitBottom - hitTop);

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

      nc.removeAllListeners('pointerdown');
      nc.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        this._beginPointerTracking(e, i);
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
      this._beginPointerTracking(e, -1);
    });
  }

  private _beginPointerTracking(e: PIXI.FederatedPointerEvent, nodeIndex: number): void {
    const canvas = Game.app.view as any;
    this._isDragging = true;
    this._hasMoved = false;
    this._pressedNodeIndex = nodeIndex;
    const { gx, gy } = this._designFromFederated(e);
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
      const { gx: nx } = this._rawToDesign(rawE);
      const dxTotal = nx - this._dragStartGX;
      if (Math.abs(dxTotal) > DRAG_THRESHOLD) {
        this._hasMoved = true;
      }

      const now = Date.now();
      const dtMs = Math.max(1, now - this._lastDragTime);
      this._velocityX = (nx - this._lastDragGX) / dtMs * 16;
      this._velocityY = 0;
      this._lastDragGX = nx;
      this._lastDragTime = now;

      this._scrollX = this._clampScrollX(this._scrollStartX + dxTotal);
      this._scrollY = this._contentH > Game.logicHeight
        ? this._scrollStartY
        : (Game.logicHeight - this._contentH) / 2;
      this._syncScroll();
    };

    this._onRawUp = () => {
      const pressedNodeIndex = this._pressedNodeIndex;
      this._pressedNodeIndex = -1;
      this._isDragging = false;
      this._cleanupRawEvents();
      if (pressedNodeIndex >= 0 && !this._hasMoved) {
        const tappedNode = MAP_NODES[pressedNodeIndex];
        if (!tappedNode) return;
        const currentLevel = CurrencyManager.globalLevel;
        const currentSceneId = CurrencyManager.state.sceneId;
        const unlocked = currentLevel >= tappedNode.unlockLevel;
        const isCurrent = tappedNode.targetSceneId === currentSceneId;
        this._onNodeTap(tappedNode, unlocked, isCurrent);
      }
    };

    canvas.addEventListener('pointermove', this._onRawMove);
    canvas.addEventListener('pointerup', this._onRawUp);
    canvas.addEventListener('pointercancel', this._onRawUp);
  }

  /**
   * Pixi Federated 事件的 `global` 位于 renderer/canvas 像素空间；
   * 拖拽 move 逻辑则使用浏览器 client 坐标换算出的设计坐标。
   * 若两者混用，在高 DPR 设备上按下起点会比 move 坐标大一截，轻触也会被判定为拖拽。
   */
  private _designFromFederated(e: PIXI.FederatedPointerEvent): { gx: number; gy: number } {
    return {
      gx: (e.global.x / Game.dpr) * Game.designWidth / Game.screenWidth,
      gy: (e.global.y / Game.dpr) * Game.designWidth / Game.screenWidth,
    };
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

  private _clampScrollX(x: number): number {
    const minX = Math.min(0, -(this._contentW - DESIGN_WIDTH));
    return Math.max(minX, Math.min(0, x));
  }

  private _applyBounce(): void {
    const H = Game.logicHeight;
    const clampedX = this._clampScrollX(this._scrollX);
    if (clampedX !== this._scrollX) {
      this._scrollX = clampedX;
      this._velocityX = 0;
    }
    this._scrollY = this._contentH > H
      ? Math.max(-(this._contentH - H), Math.min(0, this._scrollY))
      : (H - this._contentH) / 2;
    this._velocityY = 0;
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
    const RIGHT_MENU_RESERVE = 172;
    const BAR_MID_Y = 38;
    const LEFT_MARGIN = 28;
    const CURRENCY_ICON = 46;
    const HYUAN_CX = LEFT_MARGIN + CURRENCY_ICON / 2;
    const CURRENCY_ICON_CY = BAR_MID_Y;
    const CURRENCY_TEXT_CY = CURRENCY_ICON_CY + CURRENCY_ICON / 2 - 5;
    const GAP_HYUAN_TO_STAMINA = 36;
    const STA_X = HYUAN_CX + CURRENCY_ICON / 2 + GAP_HYUAN_TO_STAMINA;
    const STA_W = 102;
    const PILL_H = 42;
    const PILL_R = PILL_H / 2;
    const PY = Math.round((76 - PILL_H) / 2);
    const GAP_STAMINA_TO_DIAMOND = 28;
    const DIAMOND_LP = STA_X + STA_W + GAP_STAMINA_TO_DIAMOND;
    const GEM_BAR_H = 38;
    const GEM_BAR_W = 86;
    const GEM_BAR_R = 12;
    const GEM_ICON_SIZE = 48;
    const DIAMOND_BAR_RIGHT = DIAMOND_LP + 16 + (GEM_BAR_W + 4);
    const GAP_DIAMOND_TO_SHOP = 10;
    const SHOP_PILL_LEFT = DIAMOND_BAR_RIGHT + GAP_DIAMOND_TO_SHOP;
    const SHOP_ICON = 56;
    const SHOP_HIT = SHOP_ICON + 18;

    this._topBar = new PIXI.Container();
    this._topBar.position.set(0, Game.safeTop);
    this._topBar.zIndex = 4000;
    this._topBar.eventMode = 'passive';
    this._topBar.interactiveChildren = true;

    const hyTex = TextureCache.get('icon_huayuan');
    if (hyTex) {
      const sp = new PIXI.Sprite(hyTex);
      sp.anchor.set(0.5);
      sp.width = CURRENCY_ICON;
      sp.height = CURRENCY_ICON;
      sp.position.set(HYUAN_CX, CURRENCY_ICON_CY);
      this._topBar.addChild(sp);
    }
    this._huayuanText = new PIXI.Text('0', {
      fontSize: 19,
      fontWeight: 'bold',
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      stroke: 0xC2185B,
      strokeThickness: 3,
    });
    this._huayuanText.anchor.set(0.5);
    this._huayuanText.position.set(HYUAN_CX, CURRENCY_TEXT_CY);
    this._topBar.addChild(this._huayuanText);

    const staminaFrame = new PIXI.Graphics();
    staminaFrame.lineStyle(2.2, 0xE5989E, 1);
    staminaFrame.beginFill(0xFFEFE8);
    staminaFrame.drawRoundedRect(STA_X, PY, STA_W, PILL_H, PILL_R);
    staminaFrame.endFill();
    this._topBar.addChild(staminaFrame);

    const inset = 3.5;
    const ix0 = STA_X + inset;
    const iy0 = PY + inset;
    const iw = STA_W - inset * 2;
    const ih = PILL_H - inset * 2;
    const ir = Math.max(6, PILL_R - inset);
    this._staminaInner = { x: ix0, y: iy0, w: iw, h: ih };
    const staminaInner = new PIXI.Graphics();
    staminaInner.lineStyle(1.2, 0xCE93A8, 0.85);
    staminaInner.beginFill(COLORS.STAMINA_BAR_TRACK);
    staminaInner.drawRoundedRect(ix0, iy0, iw, ih, ir);
    staminaInner.endFill();
    this._topBar.addChild(staminaInner);

    this._staminaFill = new PIXI.Graphics();
    this._staminaFill.position.set(ix0, iy0);
    this._topBar.addChild(this._staminaFill);

    const boltWrap = new PIXI.Container();
    boltWrap.position.set(STA_X + 6, BAR_MID_Y);
    const energyTex = TextureCache.get('icon_energy');
    if (energyTex) {
      const sp = new PIXI.Sprite(energyTex);
      sp.anchor.set(0.5);
      sp.width = 50;
      sp.height = 54;
      boltWrap.addChild(sp);
    }
    const plusBtn = this._createGreenCirclePlusButton();
    plusBtn.position.set(11, 15);
    plusBtn.eventMode = 'static';
    plusBtn.cursor = 'pointer';
    plusBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      EventBus.emit('panel:openStamina');
    });
    boltWrap.addChild(plusBtn);
    this._topBar.addChild(boltWrap);

    this._staminaText = new PIXI.Text('0/0', {
      fontSize: 17,
      fontWeight: 'bold',
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      stroke: 0x3E2723,
      strokeThickness: 2.5,
    });
    this._staminaText.anchor.set(0.5);
    this._staminaText.position.set(STA_X + STA_W / 2 + 8, BAR_MID_Y);
    this._topBar.addChild(this._staminaText);

    this._staminaTimer = new PIXI.Text('', {
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0x5D4037,
      fontFamily: FONT_FAMILY,
      stroke: 0xFFFFFF,
      strokeThickness: 2,
    });
    this._staminaTimer.anchor.set(0.5, 0);
    this._staminaTimer.position.set(STA_X + STA_W / 2 + 8, PY + PILL_H + 1);
    this._topBar.addChild(this._staminaTimer);

    const diamondRoot = new PIXI.Container();
    diamondRoot.position.set(DIAMOND_LP, Math.round(BAR_MID_Y - GEM_BAR_H / 2));
    const barX = 16;
    const barW = GEM_BAR_W + 4;
    const barH = GEM_BAR_H;
    const outer = new PIXI.Graphics();
    outer.lineStyle(2, 0xE5989E, 1);
    outer.beginFill(0xFFEFE8);
    outer.drawRoundedRect(barX, 0, barW, barH, GEM_BAR_R);
    outer.endFill();
    diamondRoot.addChild(outer);
    const inner = new PIXI.Graphics();
    inner.lineStyle(1.1, 0xCE93A8, 0.8);
    inner.beginFill(0xF7F5F0);
    inner.drawRoundedRect(barX + 3, 3, barW - 6, barH - 6, Math.max(5, GEM_BAR_R - 3));
    inner.endFill();
    diamondRoot.addChild(inner);
    const gemWrap = new PIXI.Container();
    gemWrap.position.set(22, GEM_BAR_H / 2);
    const gemTex = TextureCache.get('icon_gem');
    if (gemTex) {
      const sp = new PIXI.Sprite(gemTex);
      sp.anchor.set(0.5);
      sp.width = GEM_ICON_SIZE;
      sp.height = GEM_ICON_SIZE;
      gemWrap.addChild(sp);
    }
    diamondRoot.addChild(gemWrap);
    this._diamondText = new PIXI.Text('0', {
      fontSize: 19,
      fontWeight: 'bold',
      fill: 0x5D4037,
      fontFamily: FONT_FAMILY,
    });
    this._diamondText.anchor.set(1, 0.5);
    this._diamondText.position.set(barX + barW - 7, GEM_BAR_H / 2);
    diamondRoot.addChild(this._diamondText);
    this._topBar.addChild(diamondRoot);

    const shopRoot = new PIXI.Container();
    shopRoot.position.set(SHOP_PILL_LEFT + SHOP_HIT / 2, BAR_MID_Y);
    const shopTex = TextureCache.get('icon_shop_nb2');
    if (shopTex) {
      const sp = new PIXI.Sprite(shopTex);
      sp.anchor.set(0.5);
      sp.width = SHOP_ICON;
      sp.height = SHOP_ICON;
      shopRoot.addChild(sp);
    }
    shopRoot.eventMode = 'static';
    shopRoot.cursor = 'pointer';
    shopRoot.hitArea = new PIXI.Rectangle(-SHOP_HIT / 2, -SHOP_HIT / 2, SHOP_HIT, SHOP_HIT);
    shopRoot.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      EventBus.emit('panel:openMerchShop');
    });
    this._topBar.addChild(shopRoot);

    this._closeBtn = new PIXI.Container();
    const btnW = 90;
    const btnH = 42;
    const btnR = 21;
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.26);
    shadow.drawRoundedRect(-btnW / 2 - 8, -btnH / 2 - 8, btnW + 16, btnH + 16, btnR + 8);
    shadow.endFill();
    this._closeBtn.addChild(shadow);

    const bg = new PIXI.Graphics();
    bg.beginFill(0x3C4A38, 0.82);
    bg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR);
    bg.endFill();
    bg.lineStyle(2, 0xFFF8F0, 0.95);
    bg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR);
    this._closeBtn.addChild(bg);

    const label = new PIXI.Text('返回', {
      fontSize: 20,
      fontWeight: 'bold',
      fill: 0xFFF8F0,
      fontFamily: FONT_FAMILY,
      stroke: 0x2C2419,
      strokeThickness: 2,
    });
    label.anchor.set(0.5);
    this._closeBtn.addChild(label);

    this._closeBtn.position.set(24 + btnW / 2, Game.safeTop + 96);
    this._closeBtn.zIndex = 4010;
    this._closeBtn.eventMode = 'static';
    this._closeBtn.cursor = 'pointer';
    this._closeBtn.hitArea = new PIXI.Rectangle(-btnW / 2 - 8, -btnH / 2 - 8, btnW + 16, btnH + 16);
    this._closeBtn.on('pointerdown', () => this.close());

    this.addChild(this._topBar);
    this.addChild(this._closeBtn);
  }

  private _refreshHud(): void {
    if (!this._huayuanText || !this._staminaText || !this._diamondText || !this._staminaFill) return;
    const s = CurrencyManager.state;
    const cap = CurrencyManager.staminaCap;
    this._huayuanText.text = this._fmtNum(s.huayuan);
    this._staminaText.text = `${s.stamina}/${cap}`;
    this._diamondText.text = this._fmtNum(s.diamond);
    this._drawStaminaFill(cap > 0 ? Math.min(1, s.stamina / cap) : 0);
  }

  private _updateHudTimer(): void {
    if (!this._staminaTimer) return;
    const remain = CurrencyManager.staminaRecoverRemain;
    let nextText = '';
    if (remain > 0) {
      const m = Math.floor(remain / 60);
      const sec = Math.floor(remain % 60);
      nextText = `${m}:${sec.toString().padStart(2, '0')}`;
    }
    if (nextText !== this._lastStaminaTimerText) {
      this._lastStaminaTimerText = nextText;
      this._staminaTimer.text = nextText;
    }
  }

  private _drawStaminaFill(ratio: number): void {
    const g = this._staminaFill;
    const { w, h } = this._staminaInner;
    const fillW = Math.max(0, w * Math.min(1, Math.max(0, ratio)));
    g.clear();
    if (fillW < 0.5) return;
    const rr = Math.min(h / 2 - 0.5, fillW / 2);
    g.beginFill(COLORS.STAMINA_BAR_FILL);
    g.drawRoundedRect(0, 0, fillW, h, rr);
    g.endFill();
  }

  private _fmtNum(n: number): string {
    if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return `${n}`;
  }

  private _createGreenCirclePlusButton(): PIXI.Container {
    const r = 11;
    const root = new PIXI.Container();
    const body = new PIXI.Graphics();
    body.beginFill(0x2E7D32, 0.95);
    body.drawEllipse(0, 2.2, r * 0.92, r * 0.42);
    body.endFill();
    body.beginFill(0x66BB6A);
    body.drawCircle(0, -0.5, r - 0.5);
    body.endFill();
    body.lineStyle(1.3, 0x1B5E20, 0.95);
    body.drawCircle(0, -0.5, r - 0.5);
    root.addChild(body);

    const arm = 2.4;
    const len = r * 0.42;
    const cross = new PIXI.Graphics();
    cross.beginFill(0xFFFFFF);
    cross.drawRoundedRect(-len, -arm / 2, len * 2, arm, 1.1);
    cross.drawRoundedRect(-arm / 2, -len, arm, len * 2, 1.1);
    cross.endFill();
    root.addChild(cross);
    return root;
  }
}
