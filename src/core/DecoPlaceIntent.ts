/**
 * 从装修面板「去放置 / 放入房间」切到花店场景时，携带待摆放的 decoId。
 * ShopScene.onEnter 后消费并清空，避免与 SceneManager 切换时序打架。
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
