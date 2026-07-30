/**
 * 安全读取 CheckInManager 的「虚拟日」相关字段。
 *
 * 多个活动 Manager 在模块顶层 `new XxxManager()` 时就会读日期，
 * 而它们又 import CheckInManager，形成循环依赖。
 * 此时 `CheckInManager?.xxx` 的可选链无效：const 绑定仍处在 TDZ，
 * 访问会直接抛 ReferenceError（抖音/微信打包成 IIFE 后表现为
 * Cannot access 'Oe' before initialization）。
 */
import { CheckInManager } from './CheckInManager';

export function getCheckInGmDateOffsetDays(): number {
  try {
    return CheckInManager.gmDateOffsetDays ?? 0;
  } catch {
    return 0;
  }
}

export function getCheckInEffectiveDateKey(): string | null {
  try {
    return CheckInManager.effectiveDateKey ?? null;
  } catch {
    return null;
  }
}
