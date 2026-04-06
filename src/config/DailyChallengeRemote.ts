/**
 * 远端每日挑战配置（扩展点）。
 *
 * 接入微信云 / CDN 后，可在此 `fetch` JSON，与
 * {@link DailyChallengeTierConfig} 本地表 merge；失败或未接入时返回 `null`，
 * 逻辑层仅使用包内配置。
 */
export type RemoteDailyChallengePayload = Record<string, unknown>;

/**
 * @returns 解析后的 JSON，或 `null` 表示沿用本地默认（当前恒为 null）
 */
export async function loadRemoteDailyChallengeConfig(): Promise<RemoteDailyChallengePayload | null> {
  return null;
}
