/**
 * 底部 Tab 导航栏 — 参考 Merge Mansion / Love & Pies / 四季物语
 *
 * 业界标准设计：
 * ┌────────────────────────────────────────────────────────┐
 * │   合成     花店     装扮     图鉴              │
 * └────────────────────────────────────────────────────────┘
 *
 * - 4个等宽Tab，居中排列
 * - 激活态：icon放大 + 颜色高亮 + 底部指示条
 * - 支持红点提醒
 * - 磨砂半透明背景 + 顶部高光分割线
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';

/** Tab栏总高度（含安全区） */
export const TAB_BAR_HEIGHT = 100;
/** 内容区高度 */
const CONTENT_H = 72;
/** 底部安全区预留 */
const SAFE_BOTTOM = 28;

/** Tab项定义 */
interface TabDef {
  id: string;
  icon: string;
  activeIcon: string;
  label: string;
  event: string;
}

const TABS: TabDef[] = [
  { id: 'merge',  icon: '合', activeIcon: '合', label: '合成',  event: 'tab:merge' },
  { id: 'shop',   icon: '花', activeIcon: '花', label: '花店',  event: 'tab:shop' },
  { id: 'dressup', icon: '装', activeIcon: '装', label: '装扮', event: 'tab:dressup' },
  { id: 'album',  icon: '鉴', activeIcon: '鉴', label: '图鉴',  event: 'tab:album' },
];

// 颜色配置
const C = {
  BG: 0xFFFAF5,           // 温暖奶白底
  BG_ALPHA: 0.96,
  TOP_LINE: 0xF0E0D0,     // 顶部分割线
  ACTIVE_TEXT: 0xFF7043,   // 激活态文字(暖橙)
  INACTIVE_TEXT: 0xA0A0A0, // 未激活(浅灰)
  INDICATOR: 0xFF7043,     // 底部指示条
  RED_DOT: 0xFF3333,       // 红点
};

export class BottomTabBar extends PIXI.Container {
  private _activeTab = 'merge';
  private _tabItems: Map<string, {
    container: PIXI.Container;
    iconText: PIXI.Text;
    labelText: PIXI.Text;
    redDot: PIXI.Graphics;
    indicator: PIXI.Graphics;
  }> = new Map();

  constructor() {
    super();
    this.zIndex = 6000;
    this._build();
    this._setActive('merge', false);
    this._bindEvents();
  }

  get activeTabId(): string { return this._activeTab; }

  /** 外部调用切换Tab */
  switchTo(tabId: string): void {
    this._setActive(tabId, true);
  }

  /** 设置红点可见性 */
  setRedDot(tabId: string, visible: boolean): void {
    const item = this._tabItems.get(tabId);
    if (item) item.redDot.visible = visible;
  }

  private _build(): void {
    // 背景
    const bg = new PIXI.Graphics();
    // 主体背景
    bg.beginFill(C.BG, C.BG_ALPHA);
    bg.drawRoundedRect(0, 0, DESIGN_WIDTH, TAB_BAR_HEIGHT, 0);
    bg.endFill();
    // 顶部高光线
    bg.beginFill(C.TOP_LINE, 0.8);
    bg.drawRect(0, 0, DESIGN_WIDTH, 1.5);
    bg.endFill();
    // 微弱阴影效果（上方渐变）
    bg.beginFill(0x000000, 0.03);
    bg.drawRect(0, -4, DESIGN_WIDTH, 4);
    bg.endFill();
    this.addChild(bg);

    const tabW = DESIGN_WIDTH / TABS.length;
    const centerY = 8 + CONTENT_H / 2;

    for (let i = 0; i < TABS.length; i++) {
      const def = TABS[i];
      const tabContainer = new PIXI.Container();
      const cx = tabW * i + tabW / 2;

      // 底部指示条（激活态显示）
      const indicator = new PIXI.Graphics();
      indicator.beginFill(C.INDICATOR);
      indicator.drawRoundedRect(cx - 16, 2, 32, 3, 1.5);
      indicator.endFill();
      indicator.visible = false;
      tabContainer.addChild(indicator);

      // 图标
      const iconText = new PIXI.Text(def.icon, {
        fontSize: 28,
        fontFamily: FONT_FAMILY,
      });
      iconText.anchor.set(0.5, 0.5);
      iconText.position.set(cx, centerY - 10);
      tabContainer.addChild(iconText);

      // 文字标签
      const labelText = new PIXI.Text(def.label, {
        fontSize: 11,
        fill: C.INACTIVE_TEXT,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      labelText.anchor.set(0.5, 0);
      labelText.position.set(cx, centerY + 12);
      tabContainer.addChild(labelText);

      // 红点
      const redDot = new PIXI.Graphics();
      redDot.beginFill(C.RED_DOT);
      redDot.drawCircle(cx + 14, centerY - 22, 5);
      redDot.endFill();
      redDot.visible = false;
      tabContainer.addChild(redDot);

      // 点击区域
      const hitArea = new PIXI.Container();
      hitArea.hitArea = new PIXI.Rectangle(tabW * i, 0, tabW, CONTENT_H + SAFE_BOTTOM);
      hitArea.eventMode = 'static';
      hitArea.cursor = 'pointer';
      hitArea.on('pointerdown', () => {
        this._setActive(def.id, true);
        EventBus.emit(def.event);
      });
      tabContainer.addChild(hitArea);

      this.addChild(tabContainer);

      this._tabItems.set(def.id, {
        container: tabContainer,
        iconText,
        labelText,
        redDot,
        indicator,
      });
    }
  }

  private _setActive(tabId: string, animate: boolean): void {
    if (!this._tabItems.has(tabId)) return;
    this._activeTab = tabId;

    for (const [id, item] of this._tabItems) {
      const isActive = id === tabId;

      // 指示条
      item.indicator.visible = isActive;

      // 颜色
      item.labelText.style.fill = isActive ? C.ACTIVE_TEXT : C.INACTIVE_TEXT;

      // 图标缩放
      const targetScale = isActive ? 1.2 : 1.0;
      if (animate && isActive) {
        TweenManager.cancelTarget(item.iconText.scale);
        item.iconText.scale.set(0.8);
        TweenManager.to({
          target: item.iconText.scale,
          props: { x: targetScale, y: targetScale },
          duration: 0.3,
          ease: Ease.easeOutBack,
        });
      } else {
        item.iconText.scale.set(targetScale);
      }

      // 整体透明度
      item.iconText.alpha = isActive ? 1 : 0.6;
    }
  }

  private _bindEvents(): void {
    // 外部可以通过事件请求切换tab
    EventBus.on('tabBar:switchTo', (tabId: string) => {
      this.switchTo(tabId);
    });
  }
}
