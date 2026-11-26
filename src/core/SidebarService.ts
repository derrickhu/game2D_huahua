/**
 * 侧边栏复访（抖音必接，快手同样接入）
 *
 * GameGlobal.__launchInfo / __sidebarSupported 由 minigame/game.js 在 bundle 加载前写入，
 * 因为 onShow 首次回调可能早于业务代码执行；业务层只读状态 + 调 navigateToScene。
 *
 * 抖音：scene=021036 且 launch_from=homepage、location=sidebar_card。
 * 快手：onShow / getLaunchOptionsSync 的 from 或 scene 为 sidebar_new（侧边栏外露小程序）。
 */
import { Platform } from './PlatformService';

declare const GameGlobal: {
  __launchInfo?: DouyinLaunchInfo;
  __sidebarSupported?: boolean;
} | undefined;

export interface DouyinLaunchInfo {
  scene?: string;
  /** 快手进入来源，侧边栏外露小程序为 sidebar_new */
  from?: string;
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

  /** 抖音或快手，且宿主支持侧边栏 → 才展示入口 */
  get isAvailable(): boolean {
    return (Platform.isDouyin || Platform.isKuaishou) && this.supported;
  }

  /** 本次启动是否来自首页侧边栏 */
  isFromSidebar(): boolean {
    const info = this.launchInfo;
    if (Platform.isKuaishou) {
      const from = String(info.from || '');
      const scene = String(info.scene || '');
      return from === 'sidebar_new' || scene === 'sidebar_new' || scene === 'sidebar_miniprogram';
    }
    return info.scene === '021036'
      && info.launch_from === 'homepage'
      && info.location === 'sidebar_card';
  }

  /** 跳转首页侧边栏。快手每天最多唤起 5 次，超限 code=-20041。 */
  navigateToSidebar(handlers?: { onSuccess?: () => void; onFail?: (msg: string) => void }): void {
    Platform.navigateToScene({
      scene: 'sidebar',
      success: () => {
        console.log('[Sidebar] navigateToScene success');
        handlers?.onSuccess?.();
      },
      fail: (err: any) => {
        const code = err?.code != null ? String(err.code) : '';
        const msg = err?.errMsg || err?.msg || 'navigateToScene fail';
        const text = code ? `${code} ${msg}` : msg;
        console.warn('[Sidebar]', text);
        handlers?.onFail?.(text);
      },
    });
  }
}

export const SidebarService = new SidebarServiceClass();
