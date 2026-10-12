/**
 * 月满中秋结束后，月饼不再进入商店、抽奖和订单。
 * 读档时把棋盘、仓库、收纳盒、花语泡泡、已开宝箱队列里的月饼折成花愿。
 * 提示先记在存档里，主场景进入后再弹一次，避免重启把提示丢掉。
 */
import {
  isMooncakeItemId,
  mooncakeRetirementHuayuan,
} from '@/config/ItemConfig';

export interface MooncakeRetirementNotice {
  pieces: number;
  huayuan: number;
}

interface Acc {
  pieces: number;
  huayuan: number;
}

let pendingNotice: MooncakeRetirementNotice | null = null;

/** 读档时以存档里的未弹提示为准，避免同一次提示被累加。 */
export function restoreMooncakeRetirementNotice(
  notice: MooncakeRetirementNotice | null | undefined,
): void {
  if (!notice || notice.pieces <= 0 || notice.huayuan <= 0) {
    pendingNotice = null;
    return;
  }
  pendingNotice = { pieces: notice.pieces, huayuan: notice.huayuan };
}

export function noteMooncakeRetirement(pieces: number, huayuan: number): void {
  if (pieces <= 0 || huayuan <= 0) return;
  if (!pendingNotice) {
    pendingNotice = { pieces, huayuan };
    return;
  }
  pendingNotice.pieces += pieces;
  pendingNotice.huayuan += huayuan;
}

export function exportMooncakeRetirementNotice(): MooncakeRetirementNotice | undefined {
  if (!pendingNotice || pendingNotice.pieces <= 0 || pendingNotice.huayuan <= 0) return undefined;
  return { pieces: pendingNotice.pieces, huayuan: pendingNotice.huayuan };
}

/** 取出待提示并清空。调用方负责弹字和再存一次档。 */
export function consumeMooncakeRetirementNotice(): MooncakeRetirementNotice | null {
  const notice = pendingNotice;
  pendingNotice = null;
  if (!notice || notice.pieces <= 0 || notice.huayuan <= 0) return null;
  return notice;
}

function takePieces(acc: Acc, itemId: string, count = 1): boolean {
  if (!isMooncakeItemId(itemId)) return false;
  const n = Math.max(1, Math.floor(count));
  acc.pieces += n;
  acc.huayuan += mooncakeRetirementHuayuan(itemId, n);
  return true;
}

function retireQueue(queue: string[] | undefined, acc: Acc): string[] | undefined {
  if (!queue || queue.length === 0) return queue;
  const next: string[] = [];
  let changed = false;
  for (const id of queue) {
    if (takePieces(acc, id, 1)) {
      changed = true;
      continue;
    }
    next.push(id);
  }
  return changed ? next : queue;
}

export interface MooncakeRetirementSave {
  pendingMooncakeNotice?: MooncakeRetirementNotice | null;
  board?: { itemId: string | null }[];
  buildings?: { chestQueue?: string[] }[];
  warehouse?: {
    items: ({
      itemId: string;
      count?: number;
      toolState?: { chestQueue?: string[] };
    } | string | null)[];
  };
  rewardBox?: {
    items: [string, number][];
    lastAddedItemId?: string | null;
  };
  mergeCompanions?: { bubbles: { payloadItemId: string }[] };
  eventBoard?: {
    cells?: { itemId: string | null; chestQueue?: string[] }[];
  };
}

export function retireMooncakesInSave(data: MooncakeRetirementSave): MooncakeRetirementNotice {
  restoreMooncakeRetirementNotice(data.pendingMooncakeNotice);
  const acc: Acc = { pieces: 0, huayuan: 0 };

  if (data.board) {
    for (const cell of data.board) {
      if (cell.itemId && takePieces(acc, cell.itemId, 1)) cell.itemId = null;
    }
  }

  if (data.buildings) {
    for (const entry of data.buildings) {
      entry.chestQueue = retireQueue(entry.chestQueue, acc);
    }
  }

  const warehouseItems = data.warehouse?.items;
  if (warehouseItems) {
    for (let i = 0; i < warehouseItems.length; i++) {
      const raw = warehouseItems[i];
      if (raw == null) continue;
      if (typeof raw === 'string') {
        if (takePieces(acc, raw, 1)) warehouseItems[i] = null;
        continue;
      }
      if (raw.toolState) {
        raw.toolState.chestQueue = retireQueue(raw.toolState.chestQueue, acc);
      }
      const count = Math.max(1, Math.floor(raw.count ?? 1));
      if (takePieces(acc, raw.itemId, count)) warehouseItems[i] = null;
    }
  }

  if (data.rewardBox?.items) {
    const next: [string, number][] = [];
    for (const [itemId, count] of data.rewardBox.items) {
      const n = Math.max(0, Math.floor(count));
      if (n > 0 && takePieces(acc, itemId, n)) continue;
      next.push([itemId, count]);
    }
    data.rewardBox.items = next;
    const last = data.rewardBox.lastAddedItemId;
    if (last && isMooncakeItemId(last)) {
      data.rewardBox.lastAddedItemId = next.length > 0 ? next[next.length - 1]![0] : null;
    }
  }

  if (data.mergeCompanions?.bubbles) {
    data.mergeCompanions.bubbles = data.mergeCompanions.bubbles.filter((bubble) => {
      return !takePieces(acc, bubble.payloadItemId, 1);
    });
  }

  const eventCells = data.eventBoard?.cells;
  if (eventCells) {
    for (const cell of eventCells) {
      if (cell.itemId && takePieces(acc, cell.itemId, 1)) cell.itemId = null;
      cell.chestQueue = retireQueue(cell.chestQueue, acc);
    }
  }

  if (acc.pieces > 0) noteMooncakeRetirement(acc.pieces, acc.huayuan);
  return acc;
}
