/**
 * 「添加到桌面」（抖音必接，快手同样接入）
 *
 * GameGlobal.__desktopShortcut* 由 minigame/game.js 在启动期探测写入。
 * addShortcut 必须在用户点击的同步调用栈内触发，异步 await 之后再调会被判为非用户手势。
 * 快手 checkShortcut 只在 Android 返回 installed，iOS 失败时按未知处理，入口照常展示。
 */
import { Platform } from './PlatformService';

declare const GameGlobal: {
  __desktopShortcutSupported?: boolean;
  __desktopShortcutStatus?: { exist?: boolean; needUpdate?: boolean } | null;
  __launchFromShortcut?: boolean;
  /** 快手点过「添加到桌面」。iOS 没有成功回调，回来后靠这个标志改成可领取。 */
  __desktopAddRequested?: boolean;
  __desktopLeftApp?: boolean;
} | undefined;

export interface DesktopShortcutStatus {
  exist: boolean;
  needUpdate: boolean;
}

class DesktopShortcutServiceClass {
  /** 宿主是否暴露 addShortcut（启动期探测） */
  get supported(): boolean {
    return !!GameGlobal?.__desktopShortcutSupported;
  }

  /** checkShortcut 结果；iOS 侧常返回 null，此时按「未知」处理并照常展示入口 */
  get status(): DesktopShortcutStatus | null {
    const s = GameGlobal?.__desktopShortcutStatus;
    if (!s) return null;
    return { exist: !!s.exist, needUpdate: !!s.needUpdate };
  }

  get isAvailable(): boolean {
    return (Platform.isDouyin || Platform.isKuaishou) && this.supported;
  }

  /** 已确认添加过，或这次是从桌面图标进来的 */
  get alreadyAdded(): boolean {
    return this.status?.exist === true || !!GameGlobal?.__launchFromShortcut;
  }

  /** 快手点过添加到桌面。iOS 没有成功回调，回来后再点一次就能领。 */
  get addRequested(): boolean {
    return !!GameGlobal?.__desktopAddRequested;
  }
  get launchFromShortcut(): boolean {
    return !!GameGlobal?.__launchFromShortcut;
  }

  /** 读快手 isLaunchFromShortcut，命中就当成已经添加 */
  captureLaunch(): void {
    if (!Platform.isKuaishou) return;
    if (Platform.isLaunchFromShortcut() && typeof GameGlobal !== 'undefined') {
      GameGlobal.__launchFromShortcut = true;
      GameGlobal.__desktopShortcutSupported = true;
      GameGlobal.__desktopShortcutStatus = { exist: true, needUpdate: false };
    }
  }

  refreshStatus(done?: () => void): void {
    Platform.checkShortcut({
      success: (res: any) => {
        if (typeof GameGlobal !== 'undefined') {
          const prev = GameGlobal.__desktopShortcutStatus;
          const next = res?.status ?? null;
          if (next?.exist) {
            GameGlobal.__desktopShortcutStatus = next;
          } else if (!prev?.exist) {
            GameGlobal.__desktopShortcutStatus = next;
          }
        }
        done?.();
      },
      fail: () => done?.(),
    });
  }

  /**
   * 添加到桌面 —— 调用方必须处于点击回调的同步栈内。
   * @returns 是否已发起原生调用（false = 当前环境不支持）
   */
  addToDesktop(handlers?: {
    onSuccess?: () => void;
    onFail?: (errMsg: string) => void;
  }): boolean {
    if (!this.isAvailable) {
      handlers?.onFail?.('addShortcut not supported');
      return false;
    }
    if (Platform.isKuaishou && typeof GameGlobal !== 'undefined') {
      GameGlobal.__desktopAddRequested = true;
    }
    Platform.addShortcut({
      success: () => {
        console.log('[DesktopShortcut] addShortcut ok');
        if (typeof GameGlobal !== 'undefined') {
          GameGlobal.__desktopShortcutStatus = { exist: true, needUpdate: false };
        }
        this.refreshStatus();
        handlers?.onSuccess?.();
      },
      fail: (err) => {
        const msg = err?.errMsg || (err as { msg?: string } | undefined)?.msg || 'addShortcut fail';
        console.warn('[DesktopShortcut]', msg, err);
        this.refreshStatus(() => {
          if (this.alreadyAdded) {
            handlers?.onSuccess?.();
            return;
          }
          handlers?.onFail?.(msg);
        });
      },
    });
    return true;
  }
}

export const DesktopShortcutService = new DesktopShortcutServiceClass();
