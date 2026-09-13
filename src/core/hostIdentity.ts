import { isHuaweiAnonUpgrade } from './huaweiAccount';

/**
 * 宿主账号是否换人。
 * 华为：设备匿名号升级成华为帐号不算换人。
 */
export function didHostIdentityChange(previousUserId: string, nextUserId: string): boolean {
  const prev = previousUserId.trim();
  const next = nextUserId.trim();
  if (!prev || !next || prev === next) return false;
  if (isHuaweiAnonUpgrade(prev, next)) return false;
  return true;
}
