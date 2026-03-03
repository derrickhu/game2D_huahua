/**
 * 微信小游戏全局类型声明
 */

declare const wx: {
  createCanvas(): any;
  createImage(): any;
  createInnerAudioContext(): any;
  getSystemInfoSync(): {
    windowWidth: number;
    windowHeight: number;
    screenWidth: number;
    screenHeight: number;
    pixelRatio: number;
    platform: string;
    model: string;
    system: string;
    brand: string;
    SDKVersion: string;
  };
  getStorageSync(key: string): any;
  setStorageSync(key: string, value: any): void;
  removeStorageSync(key: string): void;
  clearStorageSync(): void;
  request(options: any): void;
  onShow(callback: () => void): void;
  onHide(callback: () => void): void;
  exitMiniProgram(options?: any): void;
  showToast(options: any): void;
  showModal(options: any): void;
  login(options: any): void;
};

declare const GameGlobal: {
  canvas: any;
  window: any;
  [key: string]: any;
};
