/**
 * 花店场景 — 参考四季物语的"故事/装修场景"
 *
 * 从合成棋盘场景切换过来的独立全屏场景：
 * - 全屏展示花店内部，有角色、装饰家具、温馨氛围
 * - 装修进度条（解锁装饰的收集进度）
 * - 可交互元素：装修入口、装扮入口、图鉴入口
 * - 左侧活动入口（签到、任务、熟客等）
 * - 右下角大的返回按钮，切回合成棋盘
 * - 顶部复用 TopBar（等级/体力/金币/钻石）
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
import { FurnitureDragSystem } from '@/systems/FurnitureDragSystem';
import { FurnitureTray } from '@/gameobjects/ui/FurnitureTray';
import { RoomEditToolbar } from '@/gameobjects/ui/RoomEditToolbar';
import { TextureCache } from '@/utils/TextureCache';
import { DECO_MAP } from '@/config/DecorationConfig';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';

// ── 布局常量 ──
const PROGRESS_BAR_W = 400;
const PROGRESS_BAR_H = 28;
const RETURN_BTN_SIZE = 80;   // ← 放大返回按钮

// ── 颜色 ──
const C = {
  BG_TOP: 0x2C3E50,          // 深蓝色背景（花店夜间氛围）
  BG_BOTTOM: 0x4A6741,       // 温暖绿底
  FLOOR: 0x8B7355,           // 地板色
  WALL: 0x5D4E37,            // 墙壁色
  WARM_LIGHT: 0xFFE4B5,      // 暖光
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
  icon: string;       // 主图标 emoji
  label: string;      // 中文标签
  event: string;
  iconBg: number;     // 图标背景色
  labelColor: number; // 标签颜色
}

/** 左侧 — 核心功能按钮（装修/装扮/图鉴） */
const LEFT_BUTTONS: SideBtnDef[] = [
  { id: 'deco',    icon: '🔨', label: '装修', event: 'nav:openDeco',    iconBg: 0xFFB347, labelColor: 0xD48B2E },
  { id: 'dressup', icon: '👗', label: '装扮', event: 'nav:openDressup', iconBg: 0xFF7EB3, labelColor: 0xE0559C },
  { id: 'album',   icon: '📖', label: '图鉴', event: 'nav:openAlbum',   iconBg: 0xA78BFA, labelColor: 0x7C5FC5 },
];

/** 右侧 — 活动快捷按钮（签到/任务/熟客） */
const RIGHT_BUTTONS: SideBtnDef[] = [
  { id: 'checkin',  icon: '📅', label: '签到', event: 'nav:openCheckIn', iconBg: 0xFFA726, labelColor: 0xD48B2E },
  { id: 'quest',    icon: '📋', label: '任务', event: 'nav:openQuest',   iconBg: 0x42A5F5, labelColor: 0x1976D2 },
  { id: 'regular',  icon: '💝', label: '熟客', event: 'nav:openRegular', iconBg: 0xEF5350, labelColor: 0xC62828 },
];

export class ShopScene implements Scene {
  readonly name = 'shop';
  readonly container: PIXI.Container;

  private _topBar!: TopBar;
  private _progressText!: PIXI.Text;
  private _progressBar!: PIXI.Graphics;
  private _progressFill!: PIXI.Graphics;
  private _starText!: PIXI.Text;
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
    // 如果在编辑模式，退出时自动保存
    if (this._isEditMode) {
      this._exitEditMode();
    }
    Game.ticker.remove(this._update, this);
    this.container.removeChildren();
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

    // ============== 5. 花愿星星数显示 ==============
    this._buildStarDisplay(w);

    // ============== 6. 左侧活动按钮（装修/装扮/图鉴） ==============
    this._buildActivityButtons();

    // ============== 7. 右侧快捷按钮（签到/任务/熟客） ==============
    this._buildQuickButtons();

    // ============== 8. 右下角返回按钮（参考四季物语的大箭头） ==============
    this._buildReturnButton(w, h);

    // ============== 9. 编辑模式按钮 ==============
    this._buildEditButton(w, h);

    // ============== 10. 编辑模式组件（初始隐藏） ==============
    this._furnitureTray = new FurnitureTray();
    this.container.addChild(this._furnitureTray);

    this._editToolbar = new RoomEditToolbar();
    this.container.addChild(this._editToolbar);

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
    } else {
      // fallback: 渐变背景
      const bg = new PIXI.Graphics();
      bg.beginFill(C.BG_TOP);
      bg.drawRect(0, 0, w, h);
      bg.endFill();
      this.container.addChild(bg);
    }

    // 底部地面区域（柔和渐变）
    const ground = new PIXI.Graphics();
    ground.beginFill(0xD4C4A0, 0.5);
    ground.drawRect(0, h * 0.75, w, h * 0.25);
    ground.endFill();
    this.container.addChild(ground);

    // 温暖的光照效果（中央发散）
    const lightGradient = new PIXI.Graphics();
    lightGradient.beginFill(C.WARM_LIGHT, 0.06);
    lightGradient.drawEllipse(w / 2, h * 0.4, w * 0.5, h * 0.3);
    lightGradient.endFill();
    lightGradient.beginFill(C.WARM_LIGHT, 0.03);
    lightGradient.drawEllipse(w / 2, h * 0.4, w * 0.7, h * 0.5);
    lightGradient.endFill();
    this.container.addChild(lightGradient);
  }

  // ─────────────────── 花店房间 ───────────────────

  private _buildRoom(w: number, h: number): void {
    const centerX = w / 2;
    const centerY = h * 0.42;

    // ---- 花店建筑 (shop.png) 作为 2.5D 底板 ----
    const shopTex = TextureCache.get('house_shop');
    if (shopTex) {
      this._shopBuildingSprite = new PIXI.Sprite(shopTex);
      // 根据宽度缩放让花店占据屏幕主体
      const shopScale = Math.min((w * 0.95) / shopTex.width, (h * 0.55) / shopTex.height);
      this._shopBuildingSprite.scale.set(shopScale);
      this._shopBuildingSprite.anchor.set(0.5, 0.5);
      this._shopBuildingSprite.position.set(centerX, centerY + 20);
      this._roomContainer.addChild(this._shopBuildingSprite);
    }

    // ---- 从 RoomLayoutManager 渲染所有已放置的家具 ----
    this._renderFurnitureLayout();

    // ---- 店主角色 ----
    this._drawShopOwner(centerX, centerY + 100);

    // ---- 氛围小物件 ----
    this._drawTableDecor(centerX - 180, centerY + 170);
  }

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
      sprite.zIndex = Math.floor(placement.y); // 2.5D 遮挡排序

      // 标记 decoId（用于拖拽系统识别）
      (sprite as any)._decoId = placement.decoId;

      this._roomContainer.addChild(sprite);
    }

    this._roomContainer.sortChildren();
  }

  /** 绘制店主形象（大版本） */
  private _drawShopOwner(cx: number, cy: number): void {
    const owner = new PIXI.Container();
    owner.position.set(cx, cy);

    // 身体
    const body = new PIXI.Graphics();
    body.beginFill(0xFFE4CC, 0.9);
    body.drawEllipse(0, 20, 35, 45);
    body.endFill();
    // 围裙
    body.beginFill(0xFFC0CB, 0.7);
    body.drawEllipse(0, 30, 30, 35);
    body.endFill();
    owner.addChild(body);

    // 头部
    const head = new PIXI.Graphics();
    head.beginFill(0xFFDDB8);
    head.drawCircle(0, -25, 30);
    head.endFill();
    // 头发
    head.beginFill(0x8B4513, 0.8);
    head.drawEllipse(0, -40, 32, 18);
    head.endFill();
    // 眼睛
    head.beginFill(0x4A3728);
    head.drawCircle(-10, -25, 3.5);
    head.drawCircle(10, -25, 3.5);
    head.endFill();
    // 微笑
    head.lineStyle(2, 0x4A3728);
    head.arc(0, -16, 8, 0.1, Math.PI - 0.1);
    // 腮红
    head.beginFill(0xFFB6C1, 0.5);
    head.drawEllipse(-18, -18, 6, 4);
    head.drawEllipse(18, -18, 6, 4);
    head.endFill();
    owner.addChild(head);

    // 花束（手持）
    const flower = new PIXI.Text('💐', { fontSize: 28, fontFamily: FONT_FAMILY });
    flower.anchor.set(0.5, 0.5);
    flower.position.set(30, 10);
    owner.addChild(flower);

    // 名牌
    const nameTag = new PIXI.Text('花语小筑 · 店主', {
      fontSize: 13, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    nameTag.anchor.set(0.5, 0);
    nameTag.position.set(0, 72);
    owner.addChild(nameTag);

    // 点击店主可触发对话
    owner.eventMode = 'static';
    owner.cursor = 'pointer';
    owner.hitArea = new PIXI.Circle(0, 0, 60);
    owner.on('pointerdown', () => {
      const greetings = [
        '欢迎来到花语小筑~ 🌸',
        '今天想做什么呢？可以装修花店哦！',
        '新的花材到了，快去合成吧~',
        '花店越来越漂亮了呢！💕',
        '记得每天签到领奖励呀~',
      ];
      const msg = greetings[Math.floor(Math.random() * greetings.length)];
      ToastMessage.show(`💬 店主：「${msg}」`);

      // 弹跳动画
      TweenManager.cancelTarget(owner.scale);
      owner.scale.set(0.9);
      TweenManager.to({
        target: owner.scale,
        props: { x: 1, y: 1 },
        duration: 0.3,
        ease: Ease.easeOutBack,
      });
    });

    this._roomContainer.addChild(owner);
  }

  /** 桌面装饰 */
  private _drawTableDecor(cx: number, cy: number): void {
    const table = new PIXI.Graphics();
    // 圆桌
    table.beginFill(0xD2B48C, 0.8);
    table.drawEllipse(cx, cy, 60, 30);
    table.endFill();
    table.beginFill(0xC4A882, 0.6);
    table.drawEllipse(cx, cy + 5, 55, 25);
    table.endFill();
    this._roomContainer.addChild(table);

    // 茶杯
    const cup = new PIXI.Text('☕', { fontSize: 24, fontFamily: FONT_FAMILY });
    cup.anchor.set(0.5, 0.5);
    cup.position.set(cx - 15, cy - 10);
    this._roomContainer.addChild(cup);

    // 小花瓶
    const vase = new PIXI.Text('🌷', { fontSize: 20, fontFamily: FONT_FAMILY });
    vase.anchor.set(0.5, 0.5);
    vase.position.set(cx + 20, cy - 12);
    this._roomContainer.addChild(vase);
  }

  // ─────────────────── 装修进度条 ───────────────────

  private _buildProgressBar(w: number): void {
    const y = Game.safeTop + TOP_BAR_HEIGHT + 16;
    const cx = w / 2;

    // 进度条容器
    const barContainer = new PIXI.Container();
    barContainer.position.set(cx - PROGRESS_BAR_W / 2, y);

    // 等级图标（猫猫/小图标）
    const levelIcon = new PIXI.Text('🐱', { fontSize: 24, fontFamily: FONT_FAMILY });
    levelIcon.anchor.set(0.5, 0.5);
    levelIcon.position.set(-20, PROGRESS_BAR_H / 2);
    barContainer.addChild(levelIcon);

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
      fontSize: 13, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    this._progressText.anchor.set(0.5, 0.5);
    this._progressText.position.set(PROGRESS_BAR_W / 2, PROGRESS_BAR_H / 2);
    barContainer.addChild(this._progressText);

    // 右端礼盒图标（满级奖励）
    const gift = new PIXI.Text('🎁', { fontSize: 22, fontFamily: FONT_FAMILY });
    gift.anchor.set(0.5, 0.5);
    gift.position.set(PROGRESS_BAR_W + 24, PROGRESS_BAR_H / 2);
    barContainer.addChild(gift);

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

  // ─────────────────── 花愿星星显示 ───────────────────

  private _buildStarDisplay(w: number): void {
    const y = Game.safeTop + TOP_BAR_HEIGHT + PROGRESS_BAR_H + 28;
    const huayuan = CurrencyManager.state.huayuan || 0;

    const container = new PIXI.Container();
    container.position.set(w / 2, y);

    // 背景胶囊
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFFFF, 0.3);
    bg.drawRoundedRect(-60, -14, 120, 28, 14);
    bg.endFill();
    container.addChild(bg);

    // 🔧 花愿图标
    const icon = new PIXI.Text('🌸', { fontSize: 16, fontFamily: FONT_FAMILY });
    icon.anchor.set(0.5, 0.5);
    icon.position.set(-35, 0);
    container.addChild(icon);

    this._starText = new PIXI.Text(`${huayuan}`, {
      fontSize: 16, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    this._starText.anchor.set(0, 0.5);
    this._starText.position.set(-20, 0);
    container.addChild(this._starText);

    // ⭐ 装饰
    const star = new PIXI.Text('⭐', { fontSize: 14, fontFamily: FONT_FAMILY });
    star.anchor.set(0.5, 0.5);
    star.position.set(40, 0);
    container.addChild(star);

    this.container.addChild(container);
  }

  // ─────────────────── 左侧功能按钮（装修/装扮/图鉴） ───────────────────

  private _buildActivityButtons(): void {
    const startY = Game.logicHeight * 0.50;
    const btnW = 72;
    const btnH = 72;
    const gap = 12;

    for (let i = 0; i < LEFT_BUTTONS.length; i++) {
      const def = LEFT_BUTTONS[i];
      const y = startY + i * (btnH + gap);
      const btn = this._createSideButton(def, btnW / 2 + 14, y, btnW, btnH);
      this.container.addChild(btn.container);
      this._activityBtns.set(def.id, btn);
    }
  }

  // ─────────────────── 右侧快捷按钮（签到/任务/熟客） ───────────────────

  private _buildQuickButtons(): void {
    const startY = Game.safeTop + TOP_BAR_HEIGHT + PROGRESS_BAR_H + 66;
    const btnW = 72;
    const btnH = 72;
    const gap = 12;
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
   * 创建侧边胶囊按钮（参考业界：圆角卡片 + 彩色图标圈 + 清晰标签）
   * 尺寸: 72×72，图标36px，标签14px
   */
  private _createSideButton(
    def: SideBtnDef, cx: number, cy: number, btnW: number, btnH: number,
  ): { container: PIXI.Container; redDot: PIXI.Graphics } {
    const container = new PIXI.Container();
    container.position.set(cx, cy);

    const halfW = btnW / 2;
    const halfH = btnH / 2;

    // 1. 阴影层
    const shadow = new PIXI.Graphics();
    shadow.beginFill(C.SIDE_BTN_SHADOW, 0.12);
    shadow.drawRoundedRect(-halfW + 2, -halfH + 3, btnW, btnH, 16);
    shadow.endFill();
    container.addChild(shadow);

    // 2. 白色卡片底板
    const card = new PIXI.Graphics();
    card.beginFill(C.SIDE_BTN_BG, 0.95);
    card.drawRoundedRect(-halfW, -halfH, btnW, btnH, 16);
    card.endFill();
    card.lineStyle(1.5, def.iconBg, 0.3);
    card.drawRoundedRect(-halfW, -halfH, btnW, btnH, 16);
    container.addChild(card);

    // 3. 彩色圆形图标背景（大而醒目）
    const iconBgCircle = new PIXI.Graphics();
    const iconR = 18;
    iconBgCircle.beginFill(def.iconBg, 0.2);
    iconBgCircle.drawCircle(0, -6, iconR);
    iconBgCircle.endFill();
    container.addChild(iconBgCircle);

    // 4. Emoji 图标（大号）
    const icon = new PIXI.Text(def.icon, {
      fontSize: 26,
      fontFamily: FONT_FAMILY,
    });
    icon.anchor.set(0.5, 0.5);
    icon.position.set(0, -6);
    container.addChild(icon);

    // 5. 文字标签（加粗，清晰可读）
    const label = new PIXI.Text(def.label, {
      fontSize: 13,
      fill: def.labelColor,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(0, halfH - 14);
    container.addChild(label);

    // 6. 红点（右上角）
    const redDot = new PIXI.Graphics();
    redDot.beginFill(0xFF3333);
    redDot.drawCircle(halfW - 8, -halfH + 8, 7);
    redDot.endFill();
    redDot.lineStyle(2, 0xFFFFFF);
    redDot.drawCircle(halfW - 8, -halfH + 8, 7);
    redDot.visible = false;
    container.addChild(redDot);

    // 7. 点击交互
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

    // 2. 主体圆形（绿色渐变效果）
    const bg = new PIXI.Graphics();
    bg.beginFill(C.RETURN_BG);
    bg.drawCircle(0, 0, r);
    bg.endFill();
    // 高光（左上角偏亮模拟立体感）
    bg.beginFill(0x66BB6A, 0.45);
    bg.drawCircle(-6, -6, r - 10);
    bg.endFill();
    // 细白边框增加质感
    bg.lineStyle(2.5, 0xFFFFFF, 0.35);
    bg.drawCircle(0, 0, r);
    this._returnBtn.addChild(bg);

    // 3. 返回箭头图标（更大更粗）
    const arrow = new PIXI.Graphics();
    arrow.lineStyle(6, C.RETURN_ARROW, 1, 0.5);
    // 弯曲箭头
    arrow.arc(2, -4, 20, -Math.PI * 0.8, Math.PI * 0.25);
    // 箭头头部
    const endX = 2 + 20 * Math.cos(Math.PI * 0.25);
    const endY = -4 + 20 * Math.sin(Math.PI * 0.25);
    arrow.lineStyle(5, C.RETURN_ARROW, 1, 0.5);
    arrow.moveTo(endX, endY);
    arrow.lineTo(endX - 10, endY - 6);
    arrow.moveTo(endX, endY);
    arrow.lineTo(endX + 2, endY - 12);
    this._returnBtn.addChild(arrow);

    // 4. "返回"文字标签
    const label = new PIXI.Text('返回', {
      fontSize: 12,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(0, r * 0.52);
    this._returnBtn.addChild(label);

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
    // 监听布局变化，刷新房间渲染
    EventBus.on('roomlayout:changed', () => {
      this._renderFurnitureLayout();
    });
    EventBus.on('roomlayout:added', () => {
      this._renderFurnitureLayout();
      if (this._furnitureTray.isOpen) this._furnitureTray.refresh();
    });
    EventBus.on('roomlayout:removed', () => {
      this._renderFurnitureLayout();
      if (this._furnitureTray.isOpen) this._furnitureTray.refresh();
    });
  }

  // ─────────────────── 编辑模式 ───────────────────

  /** 创建编辑模式入口按钮（大号醒目胶囊，花店核心交互入口） */
  private _buildEditButton(w: number, h: number): void {
    this._editBtn = new PIXI.Container();
    const btnW = 160;
    const btnH = 50;

    // 1. 阴影层
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.15);
    shadow.drawRoundedRect(-btnW / 2 + 2, -btnH / 2 + 3, btnW, btnH, btnH / 2);
    shadow.endFill();
    this._editBtn.addChild(shadow);

    // 2. 白色胶囊底板
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFFFF, 0.95);
    bg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
    bg.endFill();
    bg.lineStyle(2.5, COLORS.BUTTON_PRIMARY, 0.5);
    bg.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
    this._editBtn.addChild(bg);

    // 3. 左侧彩色圆形图标背景
    const iconBg = new PIXI.Graphics();
    iconBg.beginFill(COLORS.BUTTON_PRIMARY, 0.15);
    iconBg.drawCircle(-btnW / 2 + 30, 0, 16);
    iconBg.endFill();
    this._editBtn.addChild(iconBg);

    // 4. 图标
    const iconText = new PIXI.Text('✏️', {
      fontSize: 22, fontFamily: FONT_FAMILY,
    });
    iconText.anchor.set(0.5, 0.5);
    iconText.position.set(-btnW / 2 + 30, 0);
    this._editBtn.addChild(iconText);

    // 5. 文字标签（加粗大号）
    const label = new PIXI.Text('编辑花店', {
      fontSize: 18, fill: COLORS.BUTTON_PRIMARY, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(12, 0);
    this._editBtn.addChild(label);

    // 位置：花店下方居中（底部留安全间距）
    this._editBtn.position.set(w / 2, h - 140);
    this._editBtn.eventMode = 'static';
    this._editBtn.cursor = 'pointer';
    this._editBtn.hitArea = new PIXI.Rectangle(-btnW / 2 - 10, -btnH / 2 - 10, btnW + 20, btnH + 20);
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

    // 更新编辑按钮（图标+文字分开存储）
    const children = this._editBtn.children;
    for (const child of children) {
      if (child instanceof PIXI.Text) {
        if (child.text === '编辑花店') child.text = '完成编辑';
        if (child.text === '✏️') child.text = '✅';
      }
    }

    // 启用拖拽系统
    FurnitureDragSystem.enable(this._roomContainer);

    // 打开家具托盘
    this._furnitureTray.open();

    // 隐藏返回按钮和侧边按钮（编辑模式下不能退出场景）
    this._returnBtn.visible = false;
    for (const { container } of this._activityBtns.values()) {
      container.visible = false;
    }

    ToastMessage.show('✏️ 编辑模式：拖拽家具到花店内任意位置');
    EventBus.emit('furniture:edit_mode_enter');
  }

  /** 退出编辑模式 */
  private _exitEditMode(): void {
    if (!this._isEditMode) return;
    this._isEditMode = false;

    // 还原编辑按钮
    const children = this._editBtn.children;
    for (const child of children) {
      if (child instanceof PIXI.Text) {
        if (child.text === '完成编辑') child.text = '编辑花店';
        if (child.text === '✅') child.text = '✏️';
      }
    }

    // 禁用拖拽系统（自动保存）
    FurnitureDragSystem.disable();

    // 关闭家具托盘和工具栏
    this._furnitureTray.close();
    this._editToolbar.hide();

    // 恢复按钮显示
    this._returnBtn.visible = true;
    for (const { container } of this._activityBtns.values()) {
      container.visible = true;
    }

    // 刷新房间渲染
    this._renderFurnitureLayout();

    ToastMessage.show('💾 布局已保存');
    EventBus.emit('furniture:edit_mode_exit');
  }

  // ─────────────────── 氛围粒子 ───────────────────

  /** 生成飘落的花瓣/光斑粒子 */
  private _spawnAmbientParticles(w: number, h: number): void {
    const emojis = ['🌸', '✨', '🌿', '💫'];
    const count = 8;

    for (let i = 0; i < count; i++) {
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const particle = new PIXI.Text(emoji, {
        fontSize: 10 + Math.random() * 10,
        fontFamily: FONT_FAMILY,
      });
      particle.anchor.set(0.5, 0.5);
      particle.alpha = 0.3 + Math.random() * 0.3;
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
    this._updateStarDisplay();
  };

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

  private _updateStarDisplay(): void {
    if (this._starText) {
      const huayuan = CurrencyManager.state.huayuan || 0;
      this._starText.text = `${huayuan}`;
    }
  }
}
