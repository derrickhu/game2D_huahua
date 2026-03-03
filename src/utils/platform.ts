/**
 * 平台检测工具
 * 判断当前运行环境是微信小游戏还是浏览器
 */

export function isWxMiniGame(): boolean {
  return typeof wx !== 'undefined' && typeof GameGlobal !== 'undefined';
}

export function getWxCanvas(): any {
  if (isWxMiniGame()) {
    // 优先使用适配器存储的引用（确保与触摸事件桥接的是同一个 canvas）
    const c = (GameGlobal as any).__wxCanvas || (GameGlobal as any).canvas || null;
    console.log('[platform] getWxCanvas:', c ? 'found' : 'null');
    return c;
  }
  return null;
}

export function getSystemInfo(): { width: number; height: number; pixelRatio: number } {
  if (isWxMiniGame()) {
    const info = wx.getSystemInfoSync();
    return {
      width: info.windowWidth,
      height: info.windowHeight,
      pixelRatio: info.pixelRatio,
    };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: window.devicePixelRatio || 1,
  };
}

// 存储适配
export const storage = {
  getItem(key: string): string | null {
    if (isWxMiniGame()) {
      try {
        const val = wx.getStorageSync(key);
        return val || null;
      } catch {
        return null;
      }
    }
    return localStorage.getItem(key);
  },

  setItem(key: string, value: string): void {
    if (isWxMiniGame()) {
      try {
        wx.setStorageSync(key, value);
      } catch (e) {
        console.error('wx storage setItem failed:', e);
      }
      return;
    }
    localStorage.setItem(key, value);
  },

  removeItem(key: string): void {
    if (isWxMiniGame()) {
      try {
        wx.removeStorageSync(key);
      } catch (e) {
        console.error('wx storage removeItem failed:', e);
      }
      return;
    }
    localStorage.removeItem(key);
  },
};
