/**
 * 抖音「添加到桌面」能力（投放小游戏必接）
 *
 * GameGlobal.__desktopShortcut* 由 minigame/game.js 在启动期探测写入。
 * addShortcut 必须在用户点击的同步调用栈内触发，异步 await 之后再调会被判为非用户手势。
 */
import { Platform } from './PlatformService';

declare const GameGlobal: {
  __desktopShortcutSupported?: boolean;
  __desktopShortcutStatus?: { exist?: boolean; needUpdate?: boolean } | null;
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
    return Platform.isDouyin && this.supported;
  }

  /** 已确认添加过（status 未知时返回 false，保持引导入口可见） */
  get alreadyAdded(): boolean {
    return this.status?.exist === true;
  }

  refreshStatus(): void {
    Platform.checkShortcut({
      success: (res: any) => {
        if (typeof GameGlobal !== 'undefined') {
          GameGlobal.__desktopShortcutStatus = res?.status ?? null;
        }
      },
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
    Platform.addShortcut({
      success: () => {
        console.log('[DesktopShortcut] addShortcut ok');
        this.refreshStatus();
        handlers?.onSuccess?.();
      },
      fail: (err) => {
        const msg = err?.errMsg || 'addShortcut fail';
        console.warn('[DesktopShortcut]', msg);
        handlers?.onFail?.(msg);
      },
    });
    return true;
  }
}

export const DesktopShortcutService = new DesktopShortcutServiceClass();
