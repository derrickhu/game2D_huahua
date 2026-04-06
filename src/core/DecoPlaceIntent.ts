/**
 * 从装修面板「去放置 / 放入房间」切到花店场景时，携带待摆放的 decoId。
 * - 从合成页进店：ShopScene.onEnter 里 take 并消费。
 * - 已在花店时打开面板：须由 ShopScene 对 scene:switchToShop 的监听 take（onEnter 不会跑）。
 */
let _pendingDecoId: string | null = null;

export function setPendingPlaceDeco(decoId: string): void {
  _pendingDecoId = decoId;
}

export function takePendingPlaceDeco(): string | null {
  const id = _pendingDecoId;
  _pendingDecoId = null;
  return id;
}
