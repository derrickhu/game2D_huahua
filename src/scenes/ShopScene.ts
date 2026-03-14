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
import { CurrencyManager } from '@/managers/CurrencyManager';
import { CheckInManager } from '@/managers/CheckInManager';
import { QuestManager } from '@/managers/QuestManager';
import { RegularCustomerManager } from '@/managers/RegularCustomerManager';
import { SaveManager } from '@/managers/SaveManager';
import { TextureCache } from '@/utils/TextureCache';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';

// ── 布局常量 ──
const PROGRESS_BAR_W = 400;
const PROGRESS_BAR_H = 28;
const RETURN_BTN_SIZE = 72;

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
};

/** 左侧活动按钮定义 */
interface ActivityBtnDef {
  id: string;
  icon: string;
  label: string;
  event: string;
  color: number;
}

const ACTIVITY_BUTTONS: ActivityBtnDef[] = [
  { id: 'deco',    icon: '🔧', label: '装修',  event: 'nav:openDeco',     color: 0xFFB347 },
  { id: 'dressup', icon: '👗', label: '装扮',  event: 'nav:openDressup',  color: 0xFF69B4 },
  { id: 'album',   icon: '📖', label: '图鉴',  event: 'nav:openAlbum',    color: 0x9370DB },
];

/** 右侧快捷按钮定义 */
const QUICK_BUTTONS: ActivityBtnDef[] = [
  { id: 'checkin',  icon: '📅', label: '签到',  event: 'nav:openCheckIn', color: 0xFFB347 },
  { id: 'quest',    icon: '📋', label: '任务',  event: 'nav:openQuest',   color: 0x87CEEB },
  { id: 'regular',  icon: '💝', label: '熟客',  event: 'nav:openRegular', color: 0xFF69B4 },
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

  constructor() {
    this.container = new PIXI.Container();
  }

  onEnter(): void {
    this._build();
    this._playEnterAnim();
    Game.ticker.add(this._update, this);
  }

  onExit(): void {
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

    // ============== 9. 绑定事件 ==============
    this._bindEvents();
  }

  // ─────────────────── 背景 ───────────────────

  private _buildBackground(w: number, h: number): void {
    const bg = new PIXI.Graphics();

    // 整体深色背景（花店内部）
    bg.beginFill(C.BG_TOP);
    bg.drawRect(0, 0, w, h);
    bg.endFill();

    // 地板区域（下半部分）
    const floorY = h * 0.6;
    bg.beginFill(C.FLOOR, 0.6);
    bg.drawRect(0, floorY, w, h - floorY);
    bg.endFill();

    // 墙壁区域（中间部分）
    const wallTop = h * 0.15;
    const wallBottom = floorY;
    bg.beginFill(C.WALL, 0.4);
    bg.drawRect(0, wallTop, w, wallBottom - wallTop);
    bg.endFill();

    // 温暖的光照效果（中央发散）
    const lightGradient = new PIXI.Graphics();
    lightGradient.beginFill(C.WARM_LIGHT, 0.08);
    lightGradient.drawEllipse(w / 2, h * 0.4, w * 0.5, h * 0.3);
    lightGradient.endFill();
    lightGradient.beginFill(C.WARM_LIGHT, 0.04);
    lightGradient.drawEllipse(w / 2, h * 0.4, w * 0.7, h * 0.5);
    lightGradient.endFill();

    this.container.addChild(bg);
    this.container.addChild(lightGradient);
  }

  // ─────────────────── 花店房间 ───────────────────

  private _buildRoom(w: number, h: number): void {
    const centerX = w / 2;
    const centerY = h * 0.42;

    // 窗户（背景装饰）
    this._drawWindow(centerX + 160, centerY - 80, 120, 100);

    // 展示已装备的家具
    this._drawEquippedFurniture(centerX, centerY);

    // 店主角色（花店中央，大一些的Q版形象）
    this._drawShopOwner(centerX, centerY + 60);

    // 桌子上的花瓶等小物件（氛围装饰）
    this._drawTableDecor(centerX - 180, centerY + 130);

    // 吊灯/风扇（顶部装饰）
    this._drawCeilingDecor(centerX, centerY - 160);
  }

  /** 绘制窗户 */
  private _drawWindow(cx: number, cy: number, w: number, h: number): void {
    const win = new PIXI.Graphics();
    // 窗框
    win.lineStyle(4, 0x8B7355);
    win.drawRoundedRect(cx - w / 2, cy - h / 2, w, h, 6);
    // 窗户玻璃（浅蓝）
    win.beginFill(0x87CEEB, 0.3);
    win.drawRoundedRect(cx - w / 2 + 4, cy - h / 2 + 4, w - 8, h - 8, 4);
    win.endFill();
    // 窗户十字分割
    win.lineStyle(2, 0x8B7355);
    win.moveTo(cx, cy - h / 2 + 4);
    win.lineTo(cx, cy + h / 2 - 4);
    win.moveTo(cx - w / 2 + 4, cy);
    win.lineTo(cx + w / 2 - 4, cy);
    // 月光/光晕
    win.beginFill(0xFFF8DC, 0.15);
    win.drawEllipse(cx, cy + h, w * 0.8, h * 0.6);
    win.endFill();
    this._roomContainer.addChild(win);
  }

  /** 展示已装备的家具纹理 */
  private _drawEquippedFurniture(centerX: number, centerY: number): void {
    const equipped = DecorationManager.getAllEquipped();
    // 按槽位放置在不同位置
    const slotPositions: Record<string, { x: number; y: number; scale: number }> = {
      shelf:     { x: centerX - 200, y: centerY - 40, scale: 1.2 },
      counter:   { x: centerX, y: centerY + 100, scale: 1.0 },
      light:     { x: centerX + 20, y: centerY - 180, scale: 0.8 },
      ornament:  { x: centerX + 180, y: centerY + 80, scale: 0.9 },
      wall:      { x: centerX - 120, y: centerY - 100, scale: 0.7 },
      signboard: { x: centerX, y: centerY - 220, scale: 0.8 },
    };

    for (const { slot, deco } of equipped) {
      const pos = slotPositions[slot];
      if (!pos) continue;

      const texture = TextureCache.get(deco.icon);
      if (texture) {
        const sprite = new PIXI.Sprite(texture);
        const maxSize = 100 * pos.scale;
        const s = Math.min(maxSize / texture.width, maxSize / texture.height);
        sprite.scale.set(s);
        sprite.anchor.set(0.5, 0.5);
        sprite.position.set(pos.x, pos.y);
        sprite.alpha = 0.9;
        this._roomContainer.addChild(sprite);
      }
    }
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

  /** 天花板装饰 */
  private _drawCeilingDecor(cx: number, cy: number): void {
    // 简易吊灯
    const lamp = new PIXI.Graphics();
    // 链条
    lamp.lineStyle(2, 0xA0A0A0);
    lamp.moveTo(cx, cy - 50);
    lamp.lineTo(cx, cy);
    // 灯罩
    lamp.beginFill(0xFFE4B5, 0.7);
    lamp.moveTo(cx - 30, cy);
    lamp.lineTo(cx + 30, cy);
    lamp.lineTo(cx + 20, cy + 20);
    lamp.lineTo(cx - 20, cy + 20);
    lamp.closePath();
    lamp.endFill();
    // 灯泡光晕
    lamp.beginFill(0xFFF8DC, 0.2);
    lamp.drawCircle(cx, cy + 30, 40);
    lamp.endFill();
    this._roomContainer.addChild(lamp);
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

  // ─────────────────── 左侧活动按钮 ───────────────────

  private _buildActivityButtons(): void {
    const startY = Game.logicHeight * 0.55;
    const btnSize = 56;
    const gap = 14;

    for (let i = 0; i < ACTIVITY_BUTTONS.length; i++) {
      const def = ACTIVITY_BUTTONS[i];
      const y = startY + i * (btnSize + gap);
      const btn = this._createCircleButton(def, 44, y, btnSize);
      this.container.addChild(btn.container);
      this._activityBtns.set(def.id, btn);
    }
  }

  // ─────────────────── 右侧快捷按钮 ───────────────────

  private _buildQuickButtons(): void {
    const startY = Game.safeTop + TOP_BAR_HEIGHT + PROGRESS_BAR_H + 60;
    const btnSize = 50;
    const gap = 12;
    const w = DESIGN_WIDTH;

    for (let i = 0; i < QUICK_BUTTONS.length; i++) {
      const def = QUICK_BUTTONS[i];
      const y = startY + i * (btnSize + gap);
      const btn = this._createCircleButton(def, w - 44, y, btnSize);
      this.container.addChild(btn.container);
      this._activityBtns.set(def.id, btn);
    }
  }

  /** 创建圆形功能按钮（参考四季物语侧边按钮） */
  private _createCircleButton(
    def: ActivityBtnDef, cx: number, cy: number, size: number,
  ): { container: PIXI.Container; redDot: PIXI.Graphics } {
    const container = new PIXI.Container();
    container.position.set(cx, cy);

    const r = size / 2;

    // 阴影
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.15);
    shadow.drawCircle(2, 2, r);
    shadow.endFill();
    container.addChild(shadow);

    // 主体圆形
    const circle = new PIXI.Graphics();
    circle.beginFill(C.ACTIVITY_BG, 0.92);
    circle.drawCircle(0, 0, r);
    circle.endFill();
    circle.lineStyle(2, def.color, 0.4);
    circle.drawCircle(0, 0, r);
    container.addChild(circle);

    // 图标
    const icon = new PIXI.Text(def.icon, {
      fontSize: size * 0.4,
      fontFamily: FONT_FAMILY,
    });
    icon.anchor.set(0.5, 0.5);
    icon.position.set(0, -4);
    container.addChild(icon);

    // 标签
    const label = new PIXI.Text(def.label, {
      fontSize: 10,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(0, r * 0.55);
    container.addChild(label);

    // 红点
    const redDot = new PIXI.Graphics();
    redDot.beginFill(0xFF3333);
    redDot.drawCircle(r * 0.6, -r * 0.6, 6);
    redDot.endFill();
    redDot.lineStyle(1.5, 0xFFFFFF);
    redDot.drawCircle(r * 0.6, -r * 0.6, 6);
    redDot.visible = false;
    container.addChild(redDot);

    // 点击
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.hitArea = new PIXI.Circle(0, 0, r + 8);
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

  // ─────────────────── 返回按钮 ───────────────────

  private _buildReturnButton(w: number, h: number): void {
    this._returnBtn = new PIXI.Container();
    const cx = w - 70;
    const cy = h - 90;

    // 大的绿色三角返回按钮（参考四季物语右下角）
    const r = RETURN_BTN_SIZE / 2;

    // 阴影
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.2);
    shadow.drawCircle(3, 3, r + 2);
    shadow.endFill();
    this._returnBtn.addChild(shadow);

    // 主体圆形
    const bg = new PIXI.Graphics();
    bg.beginFill(C.RETURN_BG);
    bg.drawCircle(0, 0, r);
    bg.endFill();
    // 高光
    bg.beginFill(0x66BB6A, 0.5);
    bg.drawCircle(-4, -4, r - 6);
    bg.endFill();
    this._returnBtn.addChild(bg);

    // 返回箭头（大的弯箭头，参考四季物语）
    const arrow = new PIXI.Graphics();
    arrow.lineStyle(5, C.RETURN_ARROW, 1, 0.5);
    // 弯曲箭头
    arrow.arc(2, 0, 18, -Math.PI * 0.8, Math.PI * 0.3);
    // 箭头头部
    arrow.lineStyle(4, C.RETURN_ARROW, 1, 0.5);
    const endX = 2 + 18 * Math.cos(Math.PI * 0.3);
    const endY = 0 + 18 * Math.sin(Math.PI * 0.3);
    arrow.moveTo(endX, endY);
    arrow.lineTo(endX - 8, endY - 6);
    arrow.moveTo(endX, endY);
    arrow.lineTo(endX + 2, endY - 10);
    this._returnBtn.addChild(arrow);

    this._returnBtn.position.set(cx, cy);
    this._returnBtn.eventMode = 'static';
    this._returnBtn.cursor = 'pointer';
    this._returnBtn.hitArea = new PIXI.Circle(0, 0, r + 10);
    this._returnBtn.on('pointerdown', () => {
      this._playReturnAnim();
    });
    this.container.addChild(this._returnBtn);

    // 返回按钮呼吸动画
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
    // 花店场景中，装修/装扮/图鉴的面板事件直接由 MainScene 的全局覆盖层处理
    // nav:openDeco 事件会触发 DecorationPanel.open()（已绑定在 MainScene._bindSystemEvents）
    // 不需要额外绑定，因为面板现在在全局覆盖层中
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
