/**
 * 花店场景 — 参考四季物语的"故事/装修场景"
 *
 * 从合成棋盘场景切换过来的独立全屏场景：
 * - 全屏展示花店内部，有角色、装饰家具、温馨氛围
 * - 装修进度条（解锁装饰的收集进度）
 * - 可交互元素：装修入口、装扮入口、图鉴入口
 * - 左侧活动入口（签到、任务、熟客等）
 * - 右下角大的返回按钮，切回合成棋盘
 * - 顶部复用 TopBar（花露/花愿/体力/钻石）
 *
 * 对标四季物语第二张截图的交互体验
 */
import * as PIXI from 'pixi.js';
import { Scene } from '@/core/SceneManager';
import { SceneManager } from '@/core/SceneManager';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { TopBar, TOP_BAR_HEIGHT } from '@/gameobjects/ui/TopBar';
import { DecorationManager } from '@/managers/DecorationManager';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { CheckInManager } from '@/managers/CheckInManager';
import { QuestManager } from '@/managers/QuestManager';
import { RegularCustomerManager } from '@/managers/RegularCustomerManager';
import { SaveManager } from '@/managers/SaveManager';
import { DressUpManager } from '@/managers/DressUpManager';
import { getOwnerShopDisplayScale } from '@/config/DressUpConfig';
import { FurnitureDragSystem } from '@/systems/FurnitureDragSystem';
import { FurnitureTray, FURNITURE_TRAY_H } from '@/gameobjects/ui/FurnitureTray';
import { RoomEditToolbar } from '@/gameobjects/ui/RoomEditToolbar';
import { TextureCache } from '@/utils/TextureCache';
import { DECO_MAP } from '@/config/DecorationConfig';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';

// ── 布局常量 ──
const PROGRESS_BAR_W = 400;
const PROGRESS_BAR_H = 28;
const RETURN_BTN_SIZE = 80;   // ← 放大返回按钮

/** 与 FurnitureTray 一致，避免遮挡过多场景 */
const TRAY_HEIGHT = FURNITURE_TRAY_H;

/** 「装修花店」主按钮宽度（与 _buildEditButton 一致） */
const EDIT_MAIN_BTN_W = (): number => Math.round(DESIGN_WIDTH * 0.5);
const EDIT_MAIN_BTN_H = 64;
const EDIT_MAIN_BTN_R = 18;

/** 花店建筑竖直位置：中心 Y ≈ logicH * ratio + offset，ratio 增大则整体下移（原 0.405 偏上易顶到进度条） */
const SHOP_BUILDING_CENTER_Y_RATIO = 0.442;
const SHOP_BUILDING_ANCHOR_OFFSET_Y = 18;

/** 装修/花店场景中店主全身像目标高度（设计分辨率）。基准原为 150，现为 ×1.1。 */
const SHOP_OWNER_TARGET_H = 165;
/** 店主点击热区（锚点在脚底）：相对原 Circle(0,-40,60) 同比例 ×1.1 */
const SHOP_OWNER_HIT_CY = -44;
const SHOP_OWNER_HIT_R = 66;

// ── 颜色（偏白天花店，与合成页明度更接近；无 house_bg 时 fallback 不再用夜间深蓝） ──
const C = {
  BG_TOP: 0xE8F0E5,          // 浅薄荷灰绿 fallback
  BG_BOTTOM: 0xC8D9C4,       // 柔和绿底（备用）
  FLOOR: 0x8B7355,           // 地板色
  WALL: 0x5D4E37,            // 墙壁色
  WARM_LIGHT: 0xFFF0D8,      // 略偏晨黄的暖光
  PROGRESS_BG: 0xFFE0C0,     // 进度条背景
  PROGRESS_FILL: 0xFF8C69,   // 进度条填充
  PROGRESS_BORDER: 0xD4A574, // 进度条边框
  ACTIVITY_BG: 0xFFFFFF,     // 活动按钮底色
  RETURN_BG: 0x4CAF50,       // 返回按钮底色（绿色，参考四季物语）
  RETURN_ARROW: 0xFFFFFF,    // 返回箭头色
  SIDE_BTN_BG: 0xFFFFFF,     // 侧边胶囊按钮底色
  SIDE_BTN_SHADOW: 0x000000, // 侧边按钮阴影
};

/** 侧边功能按钮定义 */
interface SideBtnDef {
  id: string;
  icon: string;       // 主图标 emoji（图标纹理不可用时降级）
  texKey?: string;     // TextureCache 图标 key
  label: string;
  event: string;
  iconBg: number;
  labelColor: number;
}

/** 左下角横排 — 家具 / 装扮（无遮罩，大图标） */
const DECO_PAIR_BUTTONS: SideBtnDef[] = [
  { id: 'deco',    icon: '🛋️', texKey: 'icon_furniture', label: '家具', event: 'nav:openDeco',    iconBg: 0xFFB347, labelColor: 0xD48B2E },
  { id: 'dressup', icon: '👗', texKey: 'icon_dress',      label: '装扮', event: 'nav:openDressup', iconBg: 0xFF7EB3, labelColor: 0xE0559C },
];

/** 左上角 — 图鉴 + 熟客（竖排） */
const LEFT_TOP_BUTTONS: SideBtnDef[] = [
  { id: 'album',   icon: '📖', texKey: 'icon_book',  label: '图鉴', event: 'nav:openAlbum',   iconBg: 0xA78BFA, labelColor: 0x7C5FC5 },
  { id: 'regular', icon: '💝', texKey: 'icon_heart', label: '熟客', event: 'nav:openRegular', iconBg: 0xEF5350, labelColor: 0xC62828 },
];

/** 右侧 — 活动快捷按钮（签到/任务） */
const RIGHT_BUTTONS: SideBtnDef[] = [
  { id: 'checkin', icon: '📅', texKey: 'icon_checkin', label: '签到', event: 'nav:openCheckIn', iconBg: 0xFFA726, labelColor: 0xD48B2E },
  { id: 'quest',   icon: '📋', texKey: 'icon_quest',   label: '任务', event: 'nav:openQuest',   iconBg: 0x42A5F5, labelColor: 0x1976D2 },
];

export class ShopScene implements Scene {
  readonly name = 'shop';
  readonly container: PIXI.Container;

  private _topBar!: TopBar;
  private _progressText!: PIXI.Text;
  private _progressBar!: PIXI.Graphics;
  private _progressFill!: PIXI.Graphics;
  private _returnBtn!: PIXI.Container;
  private _roomContainer!: PIXI.Container;
  private _activityBtns: Map<string, { container: PIXI.Container; redDot: PIXI.Graphics }> = new Map();

  // ── 编辑模式相关 ──
  private _isEditMode = false;
  private _editBtn!: PIXI.Container;
  private _furnitureTray!: FurnitureTray;
  private _editToolbar!: RoomEditToolbar;
  private _particleContainer!: PIXI.Container;
  private _shopBuildingSprite: PIXI.Sprite | null = null;

  // ── 店主 ──
  private _ownerContainer: PIXI.Container | null = null;
  private _ownerSprite: PIXI.Sprite | null = null;

  private readonly _onDressUpEquipped = (): void => {
    this._refreshShopOwnerOutfitTextures();
  };
  private _blinkTimer = 0;
  private _blinkInterval = 3.5;
  private _isBlinking = false;
  private _ownerDragging = false;
  private _ownerDragOffset = { x: 0, y: 0 };
  private _onOwnerRawMove: ((e: any) => void) | null = null;
  private _onOwnerRawUp: ((e: any) => void) | null = null;

  // ── 编辑模式缩放相关 ──
  private _viewScale = 1.0;                   // 当前视图缩放倍数
  private _viewScaleMin = 1.0;
  private _viewScaleMax = 2.0;
  /** 编辑模式：贴右缘的缩放滑杆 */
  private _zoomSlider: PIXI.Container | null = null;
  private _zoomSliderThumb: PIXI.Graphics | null = null;
  /** 滑杆可视高度（触摸区会再上下各扩一点） */
  private _zoomSliderTrackH = 280;
  private _zoomSliderDragging = false;
  /** 已为 true 时才开始改缩放（长按或滑出阈值后） */
  private _zoomSliderDragActive = false;
  private _zoomSliderLastTap = 0;
  private _zoomSliderLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  private _zoomSliderPressClient = { x: 0, y: 0 };
  /** 按下时手指在轨道上的 y（0~H），长按到期时用 */
  private _zoomSliderArmLocalY = 0;
  private _zoomSliderPointerId = 0;
  private _onZoomSliderCanvasMove: ((e: PointerEvent) => void) | null = null;
  private _onZoomSliderCanvasUp: ((e: PointerEvent) => void) | null = null;
  // pinch 手势追踪
  private _pinchPointers = new Map<number, { x: number; y: number }>();
  private _pinchStartDist = 0;
  private _pinchStartScale = 1;
  private _onPinchDown: ((e: any) => void) | null = null;
  private _onPinchMove: ((e: any) => void) | null = null;
  private _onPinchUp: ((e: any) => void) | null = null;

  constructor() {
    this.container = new PIXI.Container();
  }

  onEnter(): void {
    // 确保容器 transform 干净
    this.container.position.set(0, 0);
    this.container.scale.set(1, 1);
    this.container.pivot.set(0, 0);
    this.container.alpha = 1;

    // 初始化房间布局管理器
    RoomLayoutManager.init();

    this._build();
    this._playEnterAnim();
    Game.ticker.add(this._update, this);
  }

  onExit(): void {
    EventBus.off('decoration:room_style', this._refreshShopBuildingTexture);
    EventBus.off('dressup:equipped', this._onDressUpEquipped);
    // 如果在编辑模式，退出时自动保存
    if (this._isEditMode) {
      this._exitEditMode();
    }
    // 清理店主拖拽的 canvas 事件
    this._cleanupOwnerDragEvents();
    // 无论是否编辑模式，都强制刷写布局存档（防止防抖 timer 未触发）
    RoomLayoutManager.saveNow();
    Game.ticker.remove(this._update, this);
    this.container.removeChildren();
  }

  private _cleanupOwnerDragEvents(): void {
    const canvas = Game.app.view as any;
    if (this._onOwnerRawMove) {
      canvas.removeEventListener('pointermove', this._onOwnerRawMove);
      this._onOwnerRawMove = null;
    }
    if (this._onOwnerRawUp) {
      canvas.removeEventListener('pointerup', this._onOwnerRawUp);
      canvas.removeEventListener('pointercancel', this._onOwnerRawUp);
      this._onOwnerRawUp = null;
    }
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    // ============== 1. 背景（花店内部氛围） ==============
    this._buildBackground(w, h);

    // ============== 2. 花店房间内容 ==============
    this._roomContainer = new PIXI.Container();
    this._buildRoom(w, h);
    this.container.addChild(this._roomContainer);

    // ============== 3. 顶部 TopBar ==============
    this._topBar = new TopBar();
    this._topBar.position.set(0, Game.safeTop);
    this.container.addChild(this._topBar);

    // ============== 4. 装修进度条（TopBar 下方） ==============
    this._buildProgressBar(w);

    // ============== 5. 左上角按钮（图鉴 + 熟客） ==============
    this._buildLeftTopButtons();

    // ============== 6. 右侧快捷按钮（签到/任务/熟客） ==============
    this._buildQuickButtons();

    // ============== 7. 左下横排装修/装扮按钮（无遮罩，大图标） ==============
    this._buildDecoPairBtns();

    // ============== 8. 右下角返回按钮（参考四季物语的大箭头） ==============
    this._buildReturnButton(w, h);

    // ============== 9. 编辑模式组件（初始隐藏） ==============
    this._furnitureTray = new FurnitureTray();
    this.container.addChild(this._furnitureTray);

    this._editToolbar = new RoomEditToolbar();
    this.container.addChild(this._editToolbar);

    // ============== 10. 编辑模式按钮（放在最后，确保在最顶层） ==============
    this._buildEditButton(w, h);

    // ============== 11. 氛围粒子 ==============
    this._particleContainer = new PIXI.Container();
    this._particleContainer.zIndex = 100;
    this.container.addChild(this._particleContainer);
    this._spawnAmbientParticles(w, h);

    // ============== 12. 绑定事件 ==============
    this._bindEvents();
  }

  // ─────────────────── 背景 ───────────────────

  private _buildBackground(w: number, h: number): void {
    // 使用 house/bg.png 作为背景
    const bgTex = TextureCache.get('house_bg');
    if (bgTex) {
      const bgSprite = new PIXI.Sprite(bgTex);
      const bgScale = Math.max(w / bgTex.width, h / bgTex.height);
      bgSprite.scale.set(bgScale);
      bgSprite.anchor.set(0.5, 0.5);
      bgSprite.position.set(w / 2, h / 2);
      this.container.addChild(bgSprite);
      // 均匀薄提亮（无形状边缘），略压暗的贴图整体抬一档明度
      const lift = new PIXI.Graphics();
      lift.beginFill(0xFFFAF2, 0.045);
      lift.drawRect(0, 0, w, h * 0.88);
      lift.endFill();
      this.container.addChild(lift);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(C.BG_TOP);
      bg.drawRect(0, 0, w, h);
      bg.endFill();
      this.container.addChild(bg);
      const lower = new PIXI.Graphics();
      lower.beginFill(C.BG_BOTTOM, 0.45);
      lower.drawRect(0, h * 0.55, w, h * 0.45);
      lower.endFill();
      this.container.addChild(lower);
    }

    // 底部地面区域（略提亮）
    const ground = new PIXI.Graphics();
    ground.beginFill(0xE8DFD2, 0.42);
    ground.drawRect(0, h * 0.82, w, h * 0.18);
    ground.endFill();
    this.container.addChild(ground);

    // 自然环境光：模拟天光自上而下的漫反射，全宽水平带叠层，不用椭圆以免「舞台灯」感
    this._addSkyAmbientBands(w, h);
  }

  /** 水平分层环境光（无径向聚光），与等轴房间的「顶亮底稳」更一致 */
  private _addSkyAmbientBands(w: number, h: number): void {
    const g = new PIXI.Graphics();
    const maxY = h * 0.78;
    const bands = 9;
    for (let i = 0; i < bands; i++) {
      const y0 = (maxY * i) / bands;
      const y1 = (maxY * (i + 1)) / bands + 1;
      const falloff = 1 - i / (bands + 1);
      const a = 0.052 * falloff * falloff;
      g.beginFill(0xFFFCF8, a);
      g.drawRect(0, y0, w, y1 - y0);
      g.endFill();
    }
    // 极轻的暖色空气透视（仍无圆形），与 C.WARM_LIGHT 色温一致
    g.beginFill(C.WARM_LIGHT, 0.018);
    g.drawRect(0, 0, w, h * 0.35);
    g.endFill();
    this.container.addChild(g);
  }

  // ─────────────────── 花店房间 ───────────────────

  private _buildRoom(w: number, h: number): void {
    const centerX = w / 2;
    const centerY = h * SHOP_BUILDING_CENTER_Y_RATIO;

    // ---- 花店建筑底板：房间风格图 bg_room_*（TextureCache 键），缺省回退 shop.png ----
    const bgKey = DecorationManager.getRoomBgTextureKey();
    const shopTex = TextureCache.get(bgKey) ?? TextureCache.get('house_shop');
    if (shopTex) {
      this._shopBuildingSprite = new PIXI.Sprite(shopTex);
      this._layoutShopBuildingSprite(w, h, centerX, centerY);
      this._roomContainer.addChild(this._shopBuildingSprite);
    }

    // ---- 从 RoomLayoutManager 渲染所有已放置的家具 ----
    this._renderFurnitureLayout();

    // ---- 店主角色（位置可由玩家在编辑模式自定义） ----
    const savedPos = RoomLayoutManager.ownerPos;
    const ownerX = savedPos?.x ?? (centerX + 140);
    const ownerY = savedPos?.y ?? (centerY + 120);
    this._drawShopOwner(ownerX, ownerY);

  }

  /** 按当前纹理尺寸缩放、定位建筑底板 */
  private _layoutShopBuildingSprite(w: number, h: number, centerX: number, centerY: number): void {
    if (!this._shopBuildingSprite) return;
    const tex = this._shopBuildingSprite.texture;
    const shopScale = Math.min((w * 1.18) / tex.width, (h * 0.72) / tex.height);
    this._shopBuildingSprite.scale.set(shopScale);
    this._shopBuildingSprite.anchor.set(0.5, 0.5);
    this._shopBuildingSprite.position.set(centerX, centerY + SHOP_BUILDING_ANCHOR_OFFSET_Y);
  }

  /** 切换房间风格后刷新建筑贴图 */
  private _refreshShopBuildingTexture = (): void => {
    if (!this._shopBuildingSprite) return;
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;
    const centerX = w / 2;
    const centerY = h * SHOP_BUILDING_CENTER_Y_RATIO;
    const bgKey = DecorationManager.getRoomBgTextureKey();
    const tex = TextureCache.get(bgKey) ?? TextureCache.get('house_shop');
    if (!tex) return;
    this._shopBuildingSprite.texture = tex;
    this._layoutShopBuildingSprite(w, h, centerX, centerY);
  };

  /** 从 RoomLayoutManager 渲染家具布局 */
  private _renderFurnitureLayout(): void {
    // 移除旧家具（保留建筑底板、店主、桌面装饰）
    const toRemove: PIXI.DisplayObject[] = [];
    for (const child of this._roomContainer.children) {
      if ((child as any)._decoId) toRemove.push(child);
    }
    toRemove.forEach(c => this._roomContainer.removeChild(c));

    // 启用排序
    this._roomContainer.sortableChildren = true;

    const layout = RoomLayoutManager.getLayout();
    for (const placement of layout) {
      const deco = DECO_MAP.get(placement.decoId);
      if (!deco) continue;

      const texture = TextureCache.get(deco.icon);
      if (!texture) continue;

      const sprite = new PIXI.Sprite(texture);
      const baseSize = 100;
      const s = Math.min(baseSize / texture.width, baseSize / texture.height) * placement.scale;
      sprite.scale.set(
        placement.flipped ? -s : s,
        s
      );
      sprite.anchor.set(0.5, 0.8); // 底部偏中心
      sprite.position.set(placement.x, placement.y);
      sprite.zIndex = Math.floor(placement.y) + (placement.zLayer ?? 0) * 1000; // 2.5D 遮挡排序 + 手动图层偏移

      // 标记 decoId（用于拖拽系统识别）
      (sprite as any)._decoId = placement.decoId;

      this._roomContainer.addChild(sprite);
    }

    this._roomContainer.sortChildren();
  }

  private _ownerFullOpenTexKey(): string {
    const id = DressUpManager.getEquipped()?.id ?? 'outfit_default';
    return id === 'outfit_default' ? 'owner_full_default' : `owner_full_${id}`;
  }

  private _ownerFullBlinkTexKey(): string {
    const id = DressUpManager.getEquipped()?.id ?? 'outfit_default';
    return id === 'outfit_default' ? 'owner_full_default_blink' : `owner_full_${id}_blink`;
  }

  /** 按当前换装刷新花店店主全身贴图与缩放（含眨眼所用睁眼/闭眼键） */
  private _refreshShopOwnerOutfitTextures(): void {
    if (!this._ownerSprite) return;
    const openKey = this._ownerFullOpenTexKey();
    const blinkKey = this._ownerFullBlinkTexKey();
    const openTex = TextureCache.get(openKey) ?? TextureCache.get('owner_full_default');
    const blinkTex = TextureCache.get(blinkKey) ?? TextureCache.get('owner_full_default_blink');
    if (!openTex?.width) return;
    const useClosed = this._isBlinking && blinkTex?.width;
    this._ownerSprite.texture = useClosed ? blinkTex! : openTex;
    const outfitId = DressUpManager.getEquipped()?.id ?? 'outfit_default';
    const targetH = SHOP_OWNER_TARGET_H * getOwnerShopDisplayScale(outfitId);
    const scale = targetH / this._ownerSprite.texture.height;
    this._ownerSprite.scale.set(scale);
  }

  /** 绘制店主形象 */
  private _drawShopOwner(cx: number, cy: number): void {
    const owner = new PIXI.Container();
    owner.position.set(cx, cy);
    this._ownerContainer = owner;

    const openKey = this._ownerFullOpenTexKey();
    const tex = TextureCache.get(openKey) ?? TextureCache.get('owner_full_default');
    if (tex) {
      this._ownerSprite = new PIXI.Sprite(tex);
      this._ownerSprite.anchor.set(0.5, 1);
      const outfitId = DressUpManager.getEquipped()?.id ?? 'outfit_default';
      const targetH = SHOP_OWNER_TARGET_H * getOwnerShopDisplayScale(outfitId);
      const scale = targetH / tex.height;
      this._ownerSprite.scale.set(scale);
      owner.addChild(this._ownerSprite);
    }

    owner.zIndex = Math.floor(cy);
    owner.eventMode = 'static';
    owner.cursor = 'pointer';
    owner.hitArea = new PIXI.Circle(0, SHOP_OWNER_HIT_CY, SHOP_OWNER_HIT_R);

    // 交互：普通模式点击对话，编辑模式拖拽移动
    owner.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (this._isEditMode) {
        this._ownerDragging = true;
        const designX = (e.global.x / Game.dpr) * Game.designWidth / Game.screenWidth;
        const designY = (e.global.y / Game.dpr) * Game.designHeight / Game.screenHeight;
        const c = this._roomContainer;
        const s = c.scale.x || 1;
        const localX = (designX - c.position.x) / s + c.pivot.x;
        const localY = (designY - c.position.y) / s + c.pivot.y;
        this._ownerDragOffset.x = owner.x - localX;
        this._ownerDragOffset.y = owner.y - localY;
        owner.alpha = 0.7;
        return;
      }
      const greetings = [
        '欢迎来到花语小筑~ 🌸',
        '今天想做什么呢？可以装修花店哦！',
        '新的花材到了，快去合成吧~',
        '花店越来越漂亮了呢！💕',
        '记得每天签到领奖励呀~',
      ];
      const msg = greetings[Math.floor(Math.random() * greetings.length)];
      ToastMessage.show(`💬 店主：「${msg}」`);
      TweenManager.cancelTarget(owner.scale);
      owner.scale.set(0.9);
      TweenManager.to({
        target: owner.scale,
        props: { x: 1, y: 1 },
        duration: 0.3,
        ease: Ease.easeOutBack,
      });
    });

    // 使用 canvas 级别事件处理拖拽（与 FurnitureDragSystem 一致，兼容微信小游戏）
    const canvas = Game.app.view as any;
    this._onOwnerRawMove = (rawEvt: any) => {
      if (!this._ownerDragging) return;
      const clientX = rawEvt.clientX ?? rawEvt.pageX ?? 0;
      const clientY = rawEvt.clientY ?? rawEvt.pageY ?? 0;
      const designX = clientX * Game.designWidth / Game.screenWidth;
      const designY = clientY * Game.designHeight / Game.screenHeight;
      const c = this._roomContainer;
      const s = c.scale.x || 1;
      const localX = (designX - c.position.x) / s + c.pivot.x;
      const localY = (designY - c.position.y) / s + c.pivot.y;
      owner.x = localX + this._ownerDragOffset.x;
      owner.y = localY + this._ownerDragOffset.y;
      owner.zIndex = Math.floor(owner.y);
      this._roomContainer.sortChildren();
    };
    this._onOwnerRawUp = () => {
      if (!this._ownerDragging) return;
      this._ownerDragging = false;
      owner.alpha = 1;
      RoomLayoutManager.setOwnerPos(owner.x, owner.y);
    };
    canvas.addEventListener('pointermove', this._onOwnerRawMove);
    canvas.addEventListener('pointerup', this._onOwnerRawUp);
    canvas.addEventListener('pointercancel', this._onOwnerRawUp);

    this._roomContainer.addChild(owner);
  }

  // ─────────────────── 装修进度条 ───────────────────

  private _buildProgressBar(w: number): void {
    const y = Game.safeTop + TOP_BAR_HEIGHT + 16;
    const cx = w / 2;

    // 进度条容器
    const barContainer = new PIXI.Container();
    barContainer.position.set(cx - PROGRESS_BAR_W / 2, y);

    // 等级徽章图标
    const badgeTex = TextureCache.get('icon_level_badge');
    if (badgeTex) {
      const badgeSp = new PIXI.Sprite(badgeTex);
      badgeSp.anchor.set(0.5, 0.5);
      badgeSp.width = 32;
      badgeSp.height = 32;
      badgeSp.position.set(-20, PROGRESS_BAR_H / 2);
      barContainer.addChild(badgeSp);
    } else {
      const levelIcon = new PIXI.Text('🐱', { fontSize: 24, fontFamily: FONT_FAMILY });
      levelIcon.anchor.set(0.5, 0.5);
      levelIcon.position.set(-20, PROGRESS_BAR_H / 2);
      barContainer.addChild(levelIcon);
    }

    // 进度条背景
    this._progressBar = new PIXI.Graphics();
    this._progressBar.beginFill(C.PROGRESS_BG);
    this._progressBar.drawRoundedRect(0, 0, PROGRESS_BAR_W, PROGRESS_BAR_H, PROGRESS_BAR_H / 2);
    this._progressBar.endFill();
    this._progressBar.lineStyle(2, C.PROGRESS_BORDER);
    this._progressBar.drawRoundedRect(0, 0, PROGRESS_BAR_W, PROGRESS_BAR_H, PROGRESS_BAR_H / 2);
    barContainer.addChild(this._progressBar);

    // 进度条填充
    this._progressFill = new PIXI.Graphics();
    barContainer.addChild(this._progressFill);
    this._updateProgressBar();

    // 等级数字（进度条左侧）
    const unlocked = DecorationManager.unlockedCount;
    const total = DecorationManager.totalCount;
    const level = Math.floor(unlocked / 4) + 1; // 每4个装饰算一级
    const levelText = new PIXI.Text(`${level}`, {
      fontSize: 16, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    levelText.anchor.set(0.5, 0.5);
    levelText.position.set(-20, PROGRESS_BAR_H / 2);
    barContainer.addChild(levelText);

    // 进度文字
    this._progressText = new PIXI.Text(`${unlocked}/${total}`, {
      fontSize: 17, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      stroke: 0xFFFFFF, strokeThickness: 2,
    });
    this._progressText.anchor.set(0.5, 0.5);
    this._progressText.position.set(PROGRESS_BAR_W / 2, PROGRESS_BAR_H / 2);
    barContainer.addChild(this._progressText);

    // 右端礼盒图标（满级奖励）
    const giftTex = TextureCache.get('icon_gift');
    if (giftTex) {
      const giftSp = new PIXI.Sprite(giftTex);
      giftSp.anchor.set(0.5, 0.5);
      giftSp.width = 30;
      giftSp.height = 30;
      giftSp.position.set(PROGRESS_BAR_W + 24, PROGRESS_BAR_H / 2);
      barContainer.addChild(giftSp);
    } else {
      const gift = new PIXI.Text('🎁', { fontSize: 22, fontFamily: FONT_FAMILY });
      gift.anchor.set(0.5, 0.5);
      gift.position.set(PROGRESS_BAR_W + 24, PROGRESS_BAR_H / 2);
      barContainer.addChild(gift);
    }

    this.container.addChild(barContainer);
  }

  private _updateProgressBar(): void {
    const unlocked = DecorationManager.unlockedCount;
    const total = DecorationManager.totalCount;
    const ratio = total > 0 ? unlocked / total : 0;

    this._progressFill.clear();
    if (ratio > 0) {
      const fillW = Math.max(PROGRESS_BAR_H, PROGRESS_BAR_W * ratio);
      this._progressFill.beginFill(C.PROGRESS_FILL);
      this._progressFill.drawRoundedRect(0, 0, fillW, PROGRESS_BAR_H, PROGRESS_BAR_H / 2);
      this._progressFill.endFill();
    }

    if (this._progressText) {
      this._progressText.text = `${unlocked}/${total}`;
    }
  }

  // ─────────────────── 左上角按钮（图鉴 + 熟客） ───────────────────

  private _buildLeftTopButtons(): void {
    const btnW = 84;
    const btnH = 84;
    const gap = 10;
    const startY = Game.safeTop + TOP_BAR_HEIGHT + PROGRESS_BAR_H + 66 + btnH / 2;
    const cx = btnW / 2 + 14;

    for (let i = 0; i < LEFT_TOP_BUTTONS.length; i++) {
      const def = LEFT_TOP_BUTTONS[i];
      const y = startY + i * (btnH + gap);
      const btn = this._createSideButton(def, cx, y, btnW, btnH);
      this.container.addChild(btn.container);
      this._activityBtns.set(def.id, btn);
    }
  }

  // ─────────────────── 左下横排装修/装扮按钮 ───────────────────

  private _buildDecoPairBtns(): void {
    const ICON_R = 40;
    const GAP = 18;
    const pairY = Game.logicHeight - 92;
    const startX = ICON_R + 14;      // 第一个按钮中心 x
    const stepX = ICON_R * 2 + GAP;  // 两按钮间距

    for (let i = 0; i < DECO_PAIR_BUTTONS.length; i++) {
      const def = DECO_PAIR_BUTTONS[i];
      const cx = startX + i * stepX;
      const btn = this._createBareIconBtn(def, cx, pairY, ICON_R);
      this.container.addChild(btn.container);
      this._activityBtns.set(def.id, btn);
    }
  }

  /** 无遮罩底板的纯图标按钮（用于左下横排） */
  private _createBareIconBtn(
    def: SideBtnDef, cx: number, cy: number, iconR: number,
  ): { container: PIXI.Container; redDot: PIXI.Graphics } {
    const container = new PIXI.Container();
    container.position.set(cx, cy);

    // 图标（优先纹理，否则 emoji）
    const iconSize = iconR * 2;
    const tex = def.texKey ? TextureCache.get(def.texKey) : null;
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.width = iconSize;
      sp.height = iconSize;
      container.addChild(sp);
    } else {
      const icon = new PIXI.Text(def.icon, {
        fontSize: iconR * 1.1, fontFamily: FONT_FAMILY,
      });
      icon.anchor.set(0.5, 0.5);
      container.addChild(icon);
    }

    // 红点
    const redDot = new PIXI.Graphics();
    redDot.beginFill(0xFF3333);
    redDot.drawCircle(iconR - 4, -iconR + 4, 6);
    redDot.endFill();
    redDot.lineStyle(2, 0xFFFFFF);
    redDot.drawCircle(iconR - 4, -iconR + 4, 6);
    redDot.visible = false;
    container.addChild(redDot);

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new PIXI.Circle(0, 0, iconR + 10);
    container.on('pointerdown', () => {
      TweenManager.cancelTarget(container.scale);
      container.scale.set(0.85);
      TweenManager.to({
        target: container.scale,
        props: { x: 1, y: 1 },
        duration: 0.25,
        ease: Ease.easeOutBack,
      });
      EventBus.emit(def.event);
    });

    return { container, redDot };
  }

  // ─────────────────── 右侧快捷按钮（签到/任务/熟客） ───────────────────

  private _buildQuickButtons(): void {
    const btnW = 84;
    const btnH = 84;
    const gap = 10;
    const startY = Game.safeTop + TOP_BAR_HEIGHT + PROGRESS_BAR_H + 66 + btnH / 2;
    const w = DESIGN_WIDTH;

    for (let i = 0; i < RIGHT_BUTTONS.length; i++) {
      const def = RIGHT_BUTTONS[i];
      const y = startY + i * (btnH + gap);
      const btn = this._createSideButton(def, w - btnW / 2 - 14, y, btnW, btnH);
      this.container.addChild(btn.container);
      this._activityBtns.set(def.id, btn);
    }
  }

  /**
   * 创建侧边按钮（半透明底板 + 大图标 + 白色描边标签压底边）
   */
  private _createSideButton(
    def: SideBtnDef, cx: number, cy: number, btnW: number, btnH: number,
  ): { container: PIXI.Container; redDot: PIXI.Graphics } {
    const container = new PIXI.Container();
    container.position.set(cx, cy);

    const halfW = btnW / 2;
    const halfH = btnH / 2;

    // 1. 半透明白色圆角底板
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFFFF, 0.40);
    bg.drawRoundedRect(-halfW, -halfH, btnW, btnH, 18);
    bg.endFill();
    container.addChild(bg);

    // 2. 图标（优先纹理，占满大部分区域，中心偏上）
    const iconSize = btnW * 0.72;  // 约60px（84×0.72）
    const iconCY = -halfH * 0.15;  // 图标中心偏上
    const tex = def.texKey ? TextureCache.get(def.texKey) : null;
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.width = iconSize;
      sp.height = iconSize;
      sp.position.set(0, iconCY);
      container.addChild(sp);
    } else {
      const icon = new PIXI.Text(def.icon, { fontSize: iconSize * 0.7, fontFamily: FONT_FAMILY });
      icon.anchor.set(0.5, 0.5);
      icon.position.set(0, iconCY);
      container.addChild(icon);
    }

    // 3. 文字标签：白色+描边，压在图标底边（参考 TopBar 星星样式）
    const labelY = iconCY + iconSize / 2 - 2; // 与图标底边重合
    const label = new PIXI.Text(def.label, {
      fontSize: 16,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x00000040,   // 半透明黑色描边增加对比
      strokeThickness: 3,
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(0, labelY);
    container.addChild(label);

    // 4. 红点（右上角）
    const redDot = new PIXI.Graphics();
    redDot.beginFill(0xFF3333);
    redDot.drawCircle(halfW - 6, -halfH + 6, 7);
    redDot.endFill();
    redDot.lineStyle(2, 0xFFFFFF);
    redDot.drawCircle(halfW - 6, -halfH + 6, 7);
    redDot.visible = false;
    container.addChild(redDot);

    // 5. 点击交互
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new PIXI.Rectangle(-halfW - 6, -halfH - 6, btnW + 12, btnH + 12);
    container.on('pointerdown', () => {
      TweenManager.cancelTarget(container.scale);
      container.scale.set(0.88);
      TweenManager.to({
        target: container.scale,
        props: { x: 1, y: 1 },
        duration: 0.25,
        ease: Ease.easeOutBack,
      });
      EventBus.emit(def.event);
    });

    return { container, redDot };
  }

  // ─────────────────── 返回按钮（右下角，醒目大按钮） ───────────────────

  private _buildReturnButton(w: number, h: number): void {
    this._returnBtn = new PIXI.Container();
    const cx = w - 72;
    const cy = h - 90;

    const r = RETURN_BTN_SIZE / 2;

    // 1. 外层阴影
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x2E7D32, 0.3);
    shadow.drawCircle(2, 3, r + 3);
    shadow.endFill();
    this._returnBtn.addChild(shadow);

    // 2. 营业按钮图标
    const backTex = TextureCache.get('icon_operate');
    if (backTex) {
      const sp = new PIXI.Sprite(backTex);
      sp.anchor.set(0.5);
      sp.width = r * 2;
      sp.height = r * 2;
      this._returnBtn.addChild(sp);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(C.RETURN_BG);
      bg.drawCircle(0, 0, r);
      bg.endFill();
      bg.beginFill(0x66BB6A, 0.45);
      bg.drawCircle(-6, -6, r - 10);
      bg.endFill();
      bg.lineStyle(2.5, 0xFFFFFF, 0.35);
      bg.drawCircle(0, 0, r);
      this._returnBtn.addChild(bg);

      const arrow = new PIXI.Graphics();
      arrow.lineStyle(6, C.RETURN_ARROW, 1, 0.5);
      arrow.arc(2, -4, 20, -Math.PI * 0.8, Math.PI * 0.25);
      const endX = 2 + 20 * Math.cos(Math.PI * 0.25);
      const endY = -4 + 20 * Math.sin(Math.PI * 0.25);
      arrow.lineStyle(5, C.RETURN_ARROW, 1, 0.5);
      arrow.moveTo(endX, endY);
      arrow.lineTo(endX - 10, endY - 6);
      arrow.moveTo(endX, endY);
      arrow.lineTo(endX + 2, endY - 12);
      this._returnBtn.addChild(arrow);
    }

    this._returnBtn.position.set(cx, cy);
    this._returnBtn.eventMode = 'static';
    this._returnBtn.cursor = 'pointer';
    this._returnBtn.hitArea = new PIXI.Circle(0, 0, r + 12);
    this._returnBtn.on('pointerdown', () => {
      this._playReturnAnim();
    });
    this.container.addChild(this._returnBtn);

    // 呼吸动画
    this._pulseReturnBtn();
  }

  /** 返回按钮呼吸脉冲 */
  private _pulseReturnBtn(): void {
    const pulse = () => {
      TweenManager.to({
        target: this._returnBtn.scale,
        props: { x: 1.08, y: 1.08 },
        duration: 0.8,
        ease: Ease.easeInOutQuad,
        onComplete: () => {
          TweenManager.to({
            target: this._returnBtn.scale,
            props: { x: 1, y: 1 },
            duration: 0.8,
            ease: Ease.easeInOutQuad,
            onComplete: pulse,
          });
        },
      });
    };
    pulse();
  }

  // ─────────────────── 事件 ───────────────────

  private _bindEvents(): void {
    EventBus.on('decoration:room_style', this._refreshShopBuildingTexture);
    EventBus.on('dressup:equipped', this._onDressUpEquipped);

    // 监听布局变化 — 仅在非编辑模式下才完整重渲染
    // 编辑模式下由 FurnitureDragSystem 直接操控 Sprite
    EventBus.on('roomlayout:changed', () => {
      if (!this._isEditMode) {
        this._renderFurnitureLayout();
      }
    });

    // 添加家具：编辑模式下只刷新托盘（Sprite已由DragSystem创建）
    EventBus.on('roomlayout:added', () => {
      if (!this._isEditMode) {
        this._renderFurnitureLayout();
      }
      if (this._furnitureTray.isOpen) this._furnitureTray.refresh();
    });

    // 移除家具：编辑模式下Sprite已由Toolbar移除
    EventBus.on('roomlayout:removed', () => {
      if (!this._isEditMode) {
        this._renderFurnitureLayout();
      }
      if (this._furnitureTray.isOpen) this._furnitureTray.refresh();
    });

    // 缩放/翻转：编辑模式下实时更新 Sprite 视觉
    EventBus.on('roomlayout:updated', (placement: any) => {
      if (this._isEditMode && placement && placement.decoId) {
        this._updateSpriteVisual(placement);
      }
    });
  }

  /** 编辑模式下实时更新家具 Sprite 的缩放/翻转视觉（不重建） */
  private _updateSpriteVisual(placement: { decoId: string; scale: number; flipped: boolean }): void {
    for (const child of this._roomContainer.children) {
      if ((child as any)._decoId === placement.decoId && child instanceof PIXI.Sprite) {
        const texture = child.texture;
        const baseSize = 100;
        const s = Math.min(baseSize / texture.width, baseSize / texture.height) * placement.scale;
        child.scale.set(
          placement.flipped ? -s : s,
          s
        );
        break;
      }
    }
  }

  // ─────────────────── 编辑模式 ───────────────────

  /** 创建编辑模式入口按钮（加宽双行文案，主 CTA 更醒目） */
  private _buildEditButton(w: number, h: number): void {
    this._editBtn = new PIXI.Container();
    const btnW = EDIT_MAIN_BTN_W();
    const btnH = EDIT_MAIN_BTN_H;
    const cornerR = EDIT_MAIN_BTN_R;

    // 1. 阴影层
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.14);
    shadow.drawRoundedRect(-btnW / 2 + 2, -btnH / 2 + 4, btnW, btnH, cornerR);
    shadow.endFill();
    this._editBtn.addChild(shadow);

    // 2. 白色胶囊底板
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFFFF, 0.97);
    bg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, cornerR);
    bg.endFill();
    bg.lineStyle(2.5, COLORS.BUTTON_PRIMARY, 0.55);
    bg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, cornerR);
    this._editBtn.addChild(bg);

    // 3. 施工图标
    const pencilTex = TextureCache.get('icon_build');
    const iconX = -btnW / 2 + 36;
    if (pencilTex) {
      const sp = new PIXI.Sprite(pencilTex);
      sp.anchor.set(0.5);
      sp.width = 34;
      sp.height = 34;
      sp.position.set(iconX, -6);
      this._editBtn.addChild(sp);
    } else {
      const iconText = new PIXI.Text('✏️', { fontSize: 24, fontFamily: FONT_FAMILY });
      iconText.anchor.set(0.5, 0.5);
      iconText.position.set(iconX, -6);
      this._editBtn.addChild(iconText);
    }

    const label = new PIXI.Text('装修花店', {
      fontSize: 20, fill: COLORS.BUTTON_PRIMARY, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    label.anchor.set(0, 0.5);
    label.position.set(-btnW / 2 + 62, -14);
    this._editBtn.addChild(label);

    const sub = new PIXI.Text('摆放家具 · 拖动调整', {
      fontSize: 13, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    sub.anchor.set(0, 0.5);
    sub.position.set(-btnW / 2 + 62, 12);
    this._editBtn.addChild(sub);

    // 底部居中，略上移避免与系统安全区/返回键重叠
    this._editBtn.position.set(w / 2, h - 118);
    this._editBtn.eventMode = 'static';
    this._editBtn.cursor = 'pointer';
    this._editBtn.hitArea = new PIXI.Rectangle(-btnW / 2 - 12, -btnH / 2 - 12, btnW + 24, btnH + 24);
    this._editBtn.on('pointerdown', () => {
      TweenManager.cancelTarget(this._editBtn.scale);
      this._editBtn.scale.set(0.92);
      TweenManager.to({
        target: this._editBtn.scale,
        props: { x: 1, y: 1 },
        duration: 0.2,
        ease: Ease.easeOutBack,
      });

      if (this._isEditMode) {
        this._exitEditMode();
      } else {
        this._enterEditMode();
      }
    });

    this.container.addChild(this._editBtn);

    // 编辑按钮微弱脉冲引导注意力
    this._pulseEditBtn();
  }

  /** 编辑按钮柔和脉冲（吸引玩家注意） */
  private _pulseEditBtn(): void {
    const pulse = () => {
      TweenManager.to({
        target: this._editBtn.scale,
        props: { x: 1.04, y: 1.04 },
        duration: 1.2,
        ease: Ease.easeInOutQuad,
        onComplete: () => {
          TweenManager.to({
            target: this._editBtn.scale,
            props: { x: 1, y: 1 },
            duration: 1.2,
            ease: Ease.easeInOutQuad,
            onComplete: pulse,
          });
        },
      });
    };
    pulse();
  }

  /** 进入编辑模式 */
  private _enterEditMode(): void {
    if (this._isEditMode) return;
    this._isEditMode = true;

    // 停止脉冲动画
    TweenManager.cancelTarget(this._editBtn.scale);
    this._editBtn.scale.set(1);

    const bw = EDIT_MAIN_BTN_W();
    const bh = EDIT_MAIN_BTN_H;
    const br = EDIT_MAIN_BTN_R;

    const children = this._editBtn.children;
    for (const child of children) {
      if (child instanceof PIXI.Text) {
        if (child.text === '装修花店') child.text = '✅ 完成编辑';
        if (child.text.includes('摆放家具')) child.visible = false;
      }
      if (child instanceof PIXI.Graphics) {
        child.visible = false;
      }
    }

    const completeBg = new PIXI.Graphics();
    completeBg.beginFill(0x4CAF50, 0.95);
    completeBg.drawRoundedRect(-bw / 2, -bh / 2, bw, bh, br);
    completeBg.endFill();
    completeBg.lineStyle(2, 0x388E3C, 0.5);
    completeBg.drawRoundedRect(-bw / 2, -bh / 2, bw, bh, br);
    (completeBg as any)._editModeBg = true;
    this._editBtn.addChildAt(completeBg, 0);

    for (const child of this._editBtn.children) {
      if (child instanceof PIXI.Text && child.text === '✅ 完成编辑') {
        child.style.fill = 0xFFFFFF;
        child.style.fontSize = 20;
        child.anchor.set(0.5, 0.5);
        child.position.set(0, 0);
      }
    }

    const h = Game.logicHeight;
    const trayTopY = h - TRAY_HEIGHT;
    this._editBtn.position.set(DESIGN_WIDTH / 2, trayTopY - 36);

    const editBtnY = trayTopY - 36;
    RoomLayoutManager.updateBounds({
      minX: 50,
      maxX: 700,
      minY: 280,
      maxY: editBtnY - 60,
    });

    // 启用拖拽系统
    FurnitureDragSystem.enable(this._roomContainer);

    // 打开家具托盘
    this._furnitureTray.open();

    // 隐藏返回按钮和侧边按钮（编辑模式下不能退出场景）
    this._returnBtn.visible = false;
    for (const { container } of this._activityBtns.values()) {
      container.visible = false;
    }

    // 添加缩放控件 + 双指缩放手势
    this._buildZoomControls();
    this._enablePinchZoom();

    ToastMessage.show('🔨 装修模式：拖动家具；右侧滑杆需长按或滑动后拖动缩放；双击滑杆恢复 1×');
    EventBus.emit('furniture:edit_enabled');
  }

  /** 退出编辑模式 */
  private _exitEditMode(): void {
    if (!this._isEditMode) return;
    this._isEditMode = false;

    // 移除绿色完成按钮背景
    const toRemoveBg: PIXI.DisplayObject[] = [];
    for (const child of this._editBtn.children) {
      if ((child as any)._editModeBg) toRemoveBg.push(child);
    }
    toRemoveBg.forEach(c => { this._editBtn.removeChild(c); c.destroy(); });

    // 还原编辑按钮
    const children = this._editBtn.children;
    const btnW = EDIT_MAIN_BTN_W();
    for (const child of children) {
      child.visible = true;
      if (child instanceof PIXI.Text) {
        if (child.text === '✅ 完成编辑') {
          child.text = '装修花店';
          child.style.fill = COLORS.BUTTON_PRIMARY;
          child.style.fontSize = 20;
          child.anchor.set(0, 0.5);
          child.position.set(-btnW / 2 + 62, -14);
        }
        if (child.text.includes('摆放家具')) {
          child.visible = true;
        }
      }
      if (child instanceof PIXI.Graphics) {
        child.visible = true;
      }
    }

    const h = Game.logicHeight;
    this._editBtn.position.set(DESIGN_WIDTH / 2, h - 118);

    // 恢复脉冲动画
    this._pulseEditBtn();

    // 禁用拖拽系统（自动保存）
    FurnitureDragSystem.disable();

    // 恢复默认可摆放区域（maxY 限制在地面遮罩上方）
    RoomLayoutManager.updateBounds({
      minX: 50,
      maxX: 700,
      minY: 280,
      maxY: Math.round(Game.logicHeight * 0.80),
    });

    // 关闭家具托盘和工具栏
    this._furnitureTray.close();
    this._editToolbar.hide();

    // 恢复视图缩放 + 移除缩放控件
    this._resetViewZoom();
    this._removeZoomControls();
    this._disablePinchZoom();

    // 恢复按钮显示
    this._returnBtn.visible = true;
    for (const { container } of this._activityBtns.values()) {
      container.visible = true;
    }

    // 刷新房间渲染
    this._renderFurnitureLayout();

    ToastMessage.show('💾 布局已保存');
    EventBus.emit('furniture:edit_disabled');
  }

  // ─────────────────── 编辑模式缩放控制 ───────────────────

  /** 应用视图缩放 — 以屏幕中心为基点缩放 roomContainer */
  private _applyViewZoom(newScale: number): void {
    const s = Math.max(this._viewScaleMin, Math.min(this._viewScaleMax, newScale));
    this._viewScale = s;

    // 以屏幕中心为缩放基点
    const cx = DESIGN_WIDTH / 2;
    const cy = Game.logicHeight * SHOP_BUILDING_CENTER_Y_RATIO + SHOP_BUILDING_ANCHOR_OFFSET_Y;

    // 调整容器 pivot + position 实现中心缩放
    this._roomContainer.pivot.set(cx, cy);
    this._roomContainer.position.set(cx, cy);
    this._roomContainer.scale.set(s);

    this._syncZoomSliderThumb();
  }

  /** 重置缩放 */
  private _resetViewZoom(): void {
    this._viewScale = 1.0;
    this._roomContainer.pivot.set(0, 0);
    this._roomContainer.position.set(0, 0);
    this._roomContainer.scale.set(1);
  }

  /**
   * 屏幕 clientY → 滑杆轨道局部 y（0~轨道高度）。
   * 场景高度必须用 Game.logicHeight，若误用 designHeight 会导致 y 系统性偏小、始终夹到轨道顶端（最大缩放）。
   */
  private _sliderLocalYFromClientY(clientY: number): number {
    const H = this._zoomSliderTrackH;
    const gh = clientY * Game.logicHeight / Game.screenHeight;
    const topY = this._zoomSlider?.position.y ?? (Game.logicHeight - H) / 2;
    return Math.max(0, Math.min(H, gh - topY));
  }

  /** 构建缩放滑杆（编辑模式：靠右但内缩，大触摸区） */
  private _buildZoomControls(): void {
    if (this._zoomSlider) return;

    /** 距屏幕右缘留白，避免贴边难点 */
    const EDGE_INSET = 36;
    const TRACK_W = 16;
    /** 触摸热区宽度（约两指宽，易拖） */
    const HIT_W = 88;
    /** 轨道上下各扩一点也算可点区域 */
    const HIT_PAD_Y = 20;
    const H = this._zoomSliderTrackH;
    const cy = (Game.logicHeight - H) / 2;

    const root = new PIXI.Container();
    root.position.set(DESIGN_WIDTH - EDGE_INSET, cy);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-HIT_W, -HIT_PAD_Y, HIT_W, H + HIT_PAD_Y * 2);

    const track = new PIXI.Graphics();
    track.beginFill(0xFFFFFF, 0.38);
    track.drawRoundedRect(-TRACK_W, 0, TRACK_W, H, Math.min(8, TRACK_W / 2));
    track.endFill();
    track.lineStyle(2, 0x2C1810, 0.18);
    track.drawRoundedRect(-TRACK_W, 0, TRACK_W, H, Math.min(8, TRACK_W / 2));
    root.addChild(track);

    const thumb = new PIXI.Graphics();
    thumb.eventMode = 'none';
    root.addChild(thumb);
    this._zoomSliderThumb = thumb;

    this._zoomSlider = root;
    this.container.addChild(root);
    this._syncZoomSliderThumb();

    const LONG_PRESS_MS = 320;
    const MOVE_START_PX = 14;

    const clearLongPressTimer = () => {
      if (this._zoomSliderLongPressTimer) {
        clearTimeout(this._zoomSliderLongPressTimer);
        this._zoomSliderLongPressTimer = null;
      }
    };

    const beginDragFromPointerEvent = (ev: PointerEvent) => {
      if (!this._zoomSlider || this._zoomSliderDragActive) return;
      this._zoomSliderDragActive = true;
      const cvs = Game.app.view as HTMLCanvasElement;
      if (cvs.setPointerCapture) {
        try {
          cvs.setPointerCapture(ev.pointerId);
        } catch (_) { /* */ }
      }
      const ly0 = this._sliderLocalYFromClientY(ev.clientY);
      this._applyViewZoom(this._scaleFromTrackY(ly0));
    };

    root.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      const native = e.nativeEvent as PointerEvent | undefined;

      const now = Date.now();
      if (now - this._zoomSliderLastTap < 280) {
        this._applyViewZoom(1.0);
        this._zoomSliderLastTap = 0;
        return;
      }
      this._zoomSliderLastTap = now;

      if (this._zoomSliderDragging) return;
      this._zoomSliderDragging = true;
      this._zoomSliderDragActive = false;
      this._zoomSliderPointerId = native?.pointerId ?? 0;
      this._zoomSliderPressClient.x = native?.clientX ?? 0;
      this._zoomSliderPressClient.y = native?.clientY ?? 0;

      this._zoomSliderArmLocalY = native?.clientY != null
        ? this._sliderLocalYFromClientY(native.clientY)
        : Math.max(0, Math.min(H, root.toLocal(e.global).y));

      const canvas = Game.app.view as HTMLCanvasElement;

      clearLongPressTimer();
      this._zoomSliderLongPressTimer = setTimeout(() => {
        this._zoomSliderLongPressTimer = null;
        if (!this._zoomSliderDragging || this._zoomSliderDragActive) return;
        this._zoomSliderDragActive = true;
        if (native?.pointerId != null && canvas.setPointerCapture) {
          try {
            canvas.setPointerCapture(native.pointerId);
          } catch (_) { /* */ }
        }
        this._applyViewZoom(this._scaleFromTrackY(this._zoomSliderArmLocalY));
      }, LONG_PRESS_MS);

      this._onZoomSliderCanvasMove = (ev: PointerEvent) => {
        if (!this._zoomSliderDragging || !this._zoomSlider) return;
        if (this._zoomSliderPointerId && ev.pointerId !== this._zoomSliderPointerId) return;

        const ly2 = this._sliderLocalYFromClientY(ev.clientY);

        if (!this._zoomSliderDragActive) {
          const dxp = ev.clientX - this._zoomSliderPressClient.x;
          const dyp = ev.clientY - this._zoomSliderPressClient.y;
          if (dxp * dxp + dyp * dyp >= MOVE_START_PX * MOVE_START_PX) {
            clearLongPressTimer();
            beginDragFromPointerEvent(ev);
          } else {
            return;
          }
        }

        this._applyViewZoom(this._scaleFromTrackY(ly2));
      };

      this._onZoomSliderCanvasUp = (ev: PointerEvent) => {
        if (this._zoomSliderPointerId && ev.pointerId !== this._zoomSliderPointerId) return;
        clearLongPressTimer();
        this._zoomSliderDragging = false;
        this._zoomSliderDragActive = false;
        this._zoomSliderPointerId = 0;
        if (canvas.releasePointerCapture && ev.pointerId != null) {
          try {
            canvas.releasePointerCapture(ev.pointerId);
          } catch (_) { /* */ }
        }
        if (this._onZoomSliderCanvasMove) {
          canvas.removeEventListener('pointermove', this._onZoomSliderCanvasMove);
          this._onZoomSliderCanvasMove = null;
        }
        if (this._onZoomSliderCanvasUp) {
          canvas.removeEventListener('pointerup', this._onZoomSliderCanvasUp);
          canvas.removeEventListener('pointercancel', this._onZoomSliderCanvasUp);
          this._onZoomSliderCanvasUp = null;
        }
      };

      canvas.addEventListener('pointermove', this._onZoomSliderCanvasMove);
      canvas.addEventListener('pointerup', this._onZoomSliderCanvasUp);
      canvas.addEventListener('pointercancel', this._onZoomSliderCanvasUp);
    });
  }

  /** 滑杆 y（0=顶）→ 缩放值 */
  private _scaleFromTrackY(y: number): number {
    const t = 1 - y / this._zoomSliderTrackH;
    return this._viewScaleMin + t * (this._viewScaleMax - this._viewScaleMin);
  }

  private _syncZoomSliderThumb(): void {
    if (!this._zoomSliderThumb || !this._zoomSlider) return;
    const H = this._zoomSliderTrackH;
    const t = (this._viewScale - this._viewScaleMin) / (this._viewScaleMax - this._viewScaleMin);
    const y = H * (1 - Math.max(0, Math.min(1, t)));
    const cx = -8;
    const r = 22;
    const g = this._zoomSliderThumb;
    g.clear();
    g.beginFill(0xFFFDF8, 0.92);
    g.lineStyle(2.5, 0x5D4037, 0.35);
    g.drawCircle(cx, y, r);
    g.endFill();
    g.beginFill(0xFFFFFF, 0.45);
    g.drawCircle(cx - 5, y - 5, r * 0.35);
    g.endFill();
  }

  /** 移除缩放滑杆 */
  private _removeZoomControls(): void {
    if (this._zoomSliderLongPressTimer) {
      clearTimeout(this._zoomSliderLongPressTimer);
      this._zoomSliderLongPressTimer = null;
    }
    this._zoomSliderDragging = false;
    this._zoomSliderDragActive = false;
    const canvas = Game.app.view as HTMLCanvasElement;
    if (this._onZoomSliderCanvasMove) {
      canvas.removeEventListener('pointermove', this._onZoomSliderCanvasMove);
      this._onZoomSliderCanvasMove = null;
    }
    if (this._onZoomSliderCanvasUp) {
      canvas.removeEventListener('pointerup', this._onZoomSliderCanvasUp);
      canvas.removeEventListener('pointercancel', this._onZoomSliderCanvasUp);
      this._onZoomSliderCanvasUp = null;
    }
    if (this._zoomSlider) {
      this._zoomSlider.parent?.removeChild(this._zoomSlider);
      this._zoomSlider.destroy({ children: true });
      this._zoomSlider = null;
    }
    this._zoomSliderThumb = null;
  }

  /** 启用双指捏合缩放手势 */
  private _enablePinchZoom(): void {
    const canvas = Game.app.view as any;

    this._onPinchDown = (e: PointerEvent) => {
      if (!this._isEditMode) return;
      this._pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };

    this._onPinchMove = (e: PointerEvent) => {
      if (!this._isEditMode) return;
      if (!this._pinchPointers.has(e.pointerId)) return;

      this._pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this._pinchPointers.size === 2) {
        const pts = Array.from(this._pinchPointers.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (this._pinchStartDist === 0) {
          // 首次检测到双指 → 记录初始距离和缩放
          this._pinchStartDist = dist;
          this._pinchStartScale = this._viewScale;
        } else {
          // 计算缩放比例
          const ratio = dist / this._pinchStartDist;
          this._applyViewZoom(this._pinchStartScale * ratio);
        }
      }
    };

    this._onPinchUp = (e: PointerEvent) => {
      this._pinchPointers.delete(e.pointerId);
      if (this._pinchPointers.size < 2) {
        this._pinchStartDist = 0;
      }
    };

    canvas.addEventListener('pointerdown', this._onPinchDown);
    canvas.addEventListener('pointermove', this._onPinchMove);
    canvas.addEventListener('pointerup', this._onPinchUp);
    canvas.addEventListener('pointercancel', this._onPinchUp);
  }

  /** 禁用双指缩放手势 */
  private _disablePinchZoom(): void {
    const canvas = Game.app.view as any;
    if (this._onPinchDown) {
      canvas.removeEventListener('pointerdown', this._onPinchDown);
      this._onPinchDown = null;
    }
    if (this._onPinchMove) {
      canvas.removeEventListener('pointermove', this._onPinchMove);
      this._onPinchMove = null;
    }
    if (this._onPinchUp) {
      canvas.removeEventListener('pointerup', this._onPinchUp);
      canvas.removeEventListener('pointercancel', this._onPinchUp);
      this._onPinchUp = null;
    }
    this._pinchPointers.clear();
    this._pinchStartDist = 0;
  }

  // ─────────────────── 氛围粒子 ───────────────────

  /** 生成飘落的花瓣/光斑粒子 */
  private _spawnAmbientParticles(w: number, h: number): void {
    const emojis = ['🌸', '✨', '🌿', '💫', '🍃'];
    const count = 13;

    for (let i = 0; i < count; i++) {
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const particle = new PIXI.Text(emoji, {
        fontSize: 10 + Math.random() * 10,
        fontFamily: FONT_FAMILY,
      });
      particle.anchor.set(0.5, 0.5);
      particle.alpha = 0.35 + Math.random() * 0.35;
      particle.position.set(
        Math.random() * w,
        Math.random() * h * 0.6
      );
      this._particleContainer.addChild(particle);

      // 缓慢飘落动画（循环）
      this._animateParticle(particle, w, h);
    }
  }

  /** 单个粒子的飘落动画（循环） */
  private _animateParticle(particle: PIXI.Text, w: number, h: number): void {
    const duration = 4 + Math.random() * 6;
    const startX = Math.random() * w;
    const startY = -20;
    const endX = startX + (Math.random() - 0.5) * 100;
    const endY = h * 0.7 + Math.random() * h * 0.3;

    particle.position.set(startX, startY);
    particle.alpha = 0.3 + Math.random() * 0.3;

    TweenManager.to({
      target: particle,
      props: { x: endX, y: endY, alpha: 0 },
      duration,
      ease: Ease.linear,
      onComplete: () => {
        // 循环
        this._animateParticle(particle, w, h);
      },
    });
  }

  // ─────────────────── 动画 ───────────────────

  /** 进入花店场景的过渡动画 */
  private _playEnterAnim(): void {
    // 整体淡入
    this.container.alpha = 0;
    TweenManager.to({
      target: this.container,
      props: { alpha: 1 },
      duration: 0.4,
      ease: Ease.easeOutQuad,
    });

    // 房间从下方滑入
    if (this._roomContainer) {
      const origY = this._roomContainer.y;
      this._roomContainer.y = origY + 60;
      TweenManager.to({
        target: this._roomContainer,
        props: { y: origY },
        duration: 0.5,
        delay: 0.1,
        ease: Ease.easeOutBack,
      });
    }
  }

  /** 返回棋盘的过渡动画 */
  private _playReturnAnim(): void {
    // 按钮弹跳
    TweenManager.cancelTarget(this._returnBtn.scale);
    this._returnBtn.scale.set(0.8);
    TweenManager.to({
      target: this._returnBtn.scale,
      props: { x: 1, y: 1 },
      duration: 0.2,
      ease: Ease.easeOutBack,
    });

    // 整体淡出 → 切换场景
    TweenManager.to({
      target: this.container,
      props: { alpha: 0 },
      duration: 0.3,
      delay: 0.1,
      ease: Ease.easeInQuad,
      onComplete: () => {
        SceneManager.switchTo('main');
      },
    });
  }

  // ─────────────────── 更新 ───────────────────

  private _update = (): void => {
    const dt = Game.ticker.deltaMS / 1000;
    CurrencyManager.update(dt);
    SaveManager.update(dt);
    this._topBar.updateTimer();
    this._updateRedDots();
    this._updateOwnerBlink(dt);
  };

  /** 店主眨眼动画：每隔一段时间闭眼 0.15 秒 */
  private _updateOwnerBlink(dt: number): void {
    if (!this._ownerSprite) return;

    this._blinkTimer += dt;

    if (this._isBlinking) {
      if (this._blinkTimer >= 0.15) {
        this._isBlinking = false;
        this._blinkTimer = 0;
        this._blinkInterval = 2.5 + Math.random() * 3;
        const openTex = TextureCache.get(this._ownerFullOpenTexKey())
          ?? TextureCache.get('owner_full_default');
        if (openTex) this._ownerSprite.texture = openTex;
      }
    } else {
      if (this._blinkTimer >= this._blinkInterval) {
        this._isBlinking = true;
        this._blinkTimer = 0;
        const closedTex = TextureCache.get(this._ownerFullBlinkTexKey())
          ?? TextureCache.get('owner_full_default_blink');
        if (closedTex) this._ownerSprite.texture = closedTex;
      }
    }
  }

  private _updateRedDots(): void {
    // 签到红点
    const checkinBtn = this._activityBtns.get('checkin');
    if (checkinBtn) checkinBtn.redDot.visible = CheckInManager.canCheckIn;

    // 任务红点
    const questBtn = this._activityBtns.get('quest');
    if (questBtn) questBtn.redDot.visible = QuestManager.hasClaimableQuest || QuestManager.hasClaimableAchievement;

    // 熟客红点
    const regularBtn = this._activityBtns.get('regular');
    if (regularBtn) {
      const hasNewStory = RegularCustomerManager.getAllRegulars().some(d => {
        return RegularCustomerManager.getUnlockableStory(d.typeId) !== null;
      });
      regularBtn.redDot.visible = hasNewStory;
    }

    // 装修红点（有可购买的新装饰）
    const decoBtn = this._activityBtns.get('deco');
    if (decoBtn) decoBtn.redDot.visible = DecorationManager.hasAffordableNew();
  }

}
