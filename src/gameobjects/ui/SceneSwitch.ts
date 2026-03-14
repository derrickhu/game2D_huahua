/**
 * 场景切换组件 — 已整合到底部 ItemInfoBar 中
 *
 * 花店入口按钮现在是底部 InfoBar 默认态的功能快捷按钮之一，
 * 不再需要独立的悬浮按钮遮挡棋盘。
 *
 * 本组件保留空壳以兼容 MainScene 中的引用。
 */
import * as PIXI from 'pixi.js';

export class SceneSwitch extends PIXI.Container {
  constructor() {
    super();
    // 不渲染任何内容，花店入口已在 ItemInfoBar 中
  }

  /** 兼容旧调用 */
  updateRedDot(): void {
    // 红点由 ItemInfoBar.updateQuickBtnRedDots() 统一管理
  }
}
