/**
 * 华为快游戏帐号：qg.gameLoginWithReal / getCachePlayerId
 * https://developer.huawei.com/consumer/cn/doc/quickApp-References/quickgame-api-account-0000001083874630
 */

export type HuaweiAccount = {
  playerId: string;
  displayName?: string;
  gameAuthSign?: string;
  ts?: string;
};

/** 花花妙屋 AGC App ID。打包时可用 VITE_HUAWEI_APPID 覆盖。 */
export const HUAWEI_AG_APPID = '118944555';

export function readHuaweiAppId(api: { getSystemInfoSync?: () => Record<string, unknown> } | null | undefined): string {
  const fromEnv = String(
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_HUAWEI_APPID) || '',
  ).trim();
  if (fromEnv) return fromEnv;
  if (HUAWEI_AG_APPID) return HUAWEI_AG_APPID;
  try {
    const info = api?.getSystemInfoSync?.() || {};
    const raw = info.appID ?? info.appId ?? info.appid ?? '';
    return String(raw).trim();
  } catch {
    return '';
  }
}

export function parseHuaweiLoginData(data: unknown): HuaweiAccount | null {
  if (typeof data === 'string') {
    const playerId = data.trim();
    return playerId.length >= 4 && playerId.length <= 128 ? { playerId } : null;
  }
  if (!data || typeof data !== 'object') return null;
  const rec = data as Record<string, unknown>;
  const nested = rec.data && typeof rec.data === 'object' ? rec.data as Record<string, unknown> : rec;
  const playerId = String(
    nested.playerId ?? nested.playerID ?? nested.player_id
    ?? rec.playerId ?? rec.playerID ?? rec.player_id ?? '',
  ).trim();
  if (playerId.length < 4 || playerId.length > 128) return null;
  const displayName = String(nested.displayName ?? rec.displayName ?? '').trim();
  const gameAuthSign = String(nested.gameAuthSign ?? rec.gameAuthSign ?? '').trim();
  const ts = String(nested.ts ?? rec.ts ?? '').trim();
  return {
    playerId,
    ...(displayName ? { displayName } : {}),
    ...(gameAuthSign ? { gameAuthSign } : {}),
    ...(ts ? { ts } : {}),
  };
}

/** 设备匿名号升级成华为帐号，不算换人，避免把刚玩的档清掉 */
export function isHuaweiAnonUpgrade(previousUserId: string, nextUserId: string): boolean {
  const prev = previousUserId.trim();
  const next = nextUserId.trim();
  return prev.startsWith('hw:anon_') && next.startsWith('hw:') && !next.startsWith('hw:anon_');
}
