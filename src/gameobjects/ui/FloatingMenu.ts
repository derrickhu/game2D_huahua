/**
 * 功能入口管理器 — 不再有独立的UI组件
 *
 * 签到/任务/花店入口已整合到底部 ItemInfoBar 的默认态中，
 * 这样完全不遮挡棋盘，不占用任何额外空间。
 *
 * 本模块仅保留红点状态管理和事件接口，供 MainScene 调用。
 */
import * as PIXI from 'pixi.js';

/** 对外暴露的高度 — 完全不占用空间 */
export const FUNC_BAR_HEIGHT = 0;

export class FloatingMenu extends PIXI.Container {
  /** 红点状态（由 MainScene 更新，ItemInfoBar 读取） */
  private static _redDots: Map<string, boolean> = new Map();

  constructor() {
    super();
    // 不渲染任何内容，功能按钮已整合进底部 InfoBar
  }

  /** 设置红点 */
  setRedDot(btnId: string, visible: boolean): void {
    FloatingMenu._redDots.set(btnId, visible);
  }

  /** 外部读取红点状态 */
  static getRedDot(btnId: string): boolean {
    return FloatingMenu._redDots.get(btnId) || false;
  }

  /** 检查任一按钮是否有红点 */
  get hasAnyRedDot(): boolean {
    for (const [, v] of FloatingMenu._redDots) {
      if (v) return true;
    }
    return false;
  }
}
