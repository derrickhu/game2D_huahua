/**
 * 抖音侧边栏复访（平台必接能力）
 *
 * GameGlobal.__launchInfo / __sidebarSupported 由 minigame/game.js 在 bundle 加载前写入，
 * 因为 onShow 首次回调可能早于业务代码执行；业务层只读状态 + 调 navigateToScene。
 */
import { Platform } from './PlatformService';

declare const GameGlobal: {
  __launchInfo?: DouyinLaunchInfo;
  __sidebarSupported?: boolean;
} | undefined;

export interface DouyinLaunchInfo {
  scene?: string;
  launch_from?: string;
  location?: string;
  query?: Record<string, string>;
}

/** 本地日期 key（YYYY-MM-DD），用于每日一次的领取判定 */
export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

class SidebarServiceClass {
  /** 宿主是否支持侧边栏场景（启动期 checkScene 结果） */
  get supported(): boolean {
    return !!GameGlobal?.__sidebarSupported;
  }

  /** 最近一次 onShow 的启动参数 */
  get launchInfo(): DouyinLaunchInfo {
    return GameGlobal?.__launchInfo ?? {};
  }

  /** 抖音 + 宿主支持 → 才展示侧边栏入口 */
  get isAvailable(): boolean {
    return Platform.isDouyin && this.supported;
  }

  /** 本次启动是否来自抖音首页侧边栏卡片 */
  isFromSidebar(): boolean {
    const info = this.launchInfo;
    return info.scene === '021036'
      && info.launch_from === 'homepage'
      && info.location === 'sidebar_card';
  }

  /** 跳转抖音首页侧边栏（审核必检项） */
  navigateToSidebar(handlers?: { onSuccess?: () => void; onFail?: (msg: string) => void }): void {
    Platform.navigateToScene({
      scene: 'sidebar',
      success: () => {
        console.log('[Sidebar] navigateToScene success');
        handlers?.onSuccess?.();
      },
      fail: (err: any) => {
        const msg = err?.errMsg || 'navigateToScene fail';
        console.warn('[Sidebar]', msg);
        handlers?.onFail?.(msg);
      },
    });
  }
}

export const SidebarService = new SidebarServiceClass();
