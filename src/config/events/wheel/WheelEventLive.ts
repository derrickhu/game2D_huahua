/**
 * 转盘「还能产出 / 还能拿货币」的开关。
 * Manager.init 接上自己的判断（活动中且转盘没抽完，含 GM）。
 * 工具产出和订单解锁只读这里，避免配置去 import Manager。
 */
let earnChecker: () => boolean = () => false;

export function setWheelEarnChecker(fn: () => boolean): void {
  earnChecker = fn;
}

export function isWheelEarnActive(): boolean {
  return earnChecker();
}
