/**
 * 限时活动物品到期下线。
 * 读档时改存档；游戏进行中活动状态变成结束时再扫一遍运行中的棋盘和订单。
 * 提示先记在存档里，主场景进入后再弹一次，避免重启把提示丢掉。
 */
import { MID_AUTUMN_2026 } from '@/config/events/wheel/themes/midAutumn2026';
import {
  isSeasonalItemRetired,
  seasonalItemRetireHuayuan,
  seasonalLineForItem,
} from '@/config/events/SeasonalItemRegistry';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { BoardManager } from '@/managers/BoardManager';
import { BuildingManager } from '@/managers/BuildingManager';
import { WarehouseManager } from '@/managers/WarehouseManager';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { MergeCompanionManager } from '@/managers/MergeCompanionManager';
import { EventBoardManager } from '@/managers/EventBoardManager';
import { CustomerManager } from '@/managers/CustomerManager';
import { MerchShopManager } from '@/managers/MerchShopManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';

export interface SeasonalRetirementNotice {
  pieces: number;
  huayuan: number;
  eventNames: string[];
}

interface Acc {
  pieces: number;
  huayuan: number;
  eventNames: Set<string>;
}

let pendingNotice: SeasonalRetirementNotice | null = null;

function emptyAcc(): Acc {
  return { pieces: 0, huayuan: 0, eventNames: new Set() };
}

function accToNotice(acc: Acc): SeasonalRetirementNotice {
  return {
    pieces: acc.pieces,
    huayuan: acc.huayuan,
    eventNames: [...acc.eventNames],
  };
}

function takePieces(acc: Acc, itemId: string, count = 1): boolean {
  if (!isSeasonalItemRetired(itemId)) return false;
  const n = Math.max(1, Math.floor(count));
  acc.pieces += n;
  acc.huayuan += seasonalItemRetireHuayuan(itemId, n);
  const spec = seasonalLineForItem(itemId);
  if (spec) acc.eventNames.add(spec.eventName);
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

/** 读档时以存档里的未弹提示为准，避免同一次提示被累加。 */
export function restoreSeasonalRetirementNotice(
  notice: SeasonalRetirementNotice | null | undefined,
): void {
  if (!notice || notice.pieces <= 0 || notice.huayuan <= 0) {
    pendingNotice = null;
    return;
  }
  pendingNotice = {
    pieces: notice.pieces,
    huayuan: notice.huayuan,
    eventNames: [...(notice.eventNames ?? [])],
  };
}

export function noteSeasonalRetirement(notice: SeasonalRetirementNotice): void {
  if (notice.pieces <= 0 || notice.huayuan <= 0) return;
  if (!pendingNotice) {
    pendingNotice = {
      pieces: notice.pieces,
      huayuan: notice.huayuan,
      eventNames: [...notice.eventNames],
    };
    return;
  }
  pendingNotice.pieces += notice.pieces;
  pendingNotice.huayuan += notice.huayuan;
  pendingNotice.eventNames = [...new Set([...pendingNotice.eventNames, ...notice.eventNames])];
}

export function exportSeasonalRetirementNotice(): SeasonalRetirementNotice | undefined {
  if (!pendingNotice || pendingNotice.pieces <= 0 || pendingNotice.huayuan <= 0) return undefined;
  return {
    pieces: pendingNotice.pieces,
    huayuan: pendingNotice.huayuan,
    eventNames: [...pendingNotice.eventNames],
  };
}

/** 取出待提示并清空。调用方负责弹字和再存一次档。 */
export function consumeSeasonalRetirementNotice(): SeasonalRetirementNotice | null {
  const notice = pendingNotice;
  pendingNotice = null;
  if (!notice || notice.pieces <= 0 || notice.huayuan <= 0) return null;
  return notice;
}

export function formatSeasonalRetirementToast(notice: SeasonalRetirementNotice): string {
  const title = notice.eventNames.length > 0 ? notice.eventNames.join('、') : '限时活动';
  return `${title}已结束，剩余${notice.pieces}个活动物品已换成${notice.huayuan}花愿`;
}

export interface SeasonalRetirementSave {
  pendingSeasonalItemNotice?: SeasonalRetirementNotice | null;
  /** 旧字段：只含月饼折算，读档时并进通用提示 */
  pendingMooncakeNotice?: { pieces: number; huayuan: number } | null;
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

export function retireSeasonalItemsInSave(data: SeasonalRetirementSave): SeasonalRetirementNotice {
  const saved = data.pendingSeasonalItemNotice
    ?? (data.pendingMooncakeNotice
      ? { ...data.pendingMooncakeNotice, eventNames: [MID_AUTUMN_2026.name] }
      : null);
  restoreSeasonalRetirementNotice(saved);
  const acc = emptyAcc();

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
    if (last && isSeasonalItemRetired(last)) {
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

  const fresh = accToNotice(acc);
  if (fresh.pieces > 0) noteSeasonalRetirement(fresh);
  return fresh;
}

/** 活动在本次游戏过程中结束：清掉还拿在手里的活动物品。已经清过则什么都不做。 */
export function retireLiveSeasonalItems(opts?: { notify?: boolean }): SeasonalRetirementNotice {
  const acc = emptyAcc();
  CustomerManager.dropRetiredSeasonalOrderItems();

  for (const cell of BoardManager.cells) {
    if (!cell.itemId || !takePieces(acc, cell.itemId, 1)) continue;
    BoardManager.removeItem(cell.index);
  }

  for (const pulled of WarehouseManager.pullWhere(isSeasonalItemRetired)) {
    takePieces(acc, pulled.itemId, pulled.count);
  }
  for (const [itemId, count] of RewardBoxManager.pullWhere(isSeasonalItemRetired)) {
    takePieces(acc, itemId, count);
  }
  for (const itemId of MergeCompanionManager.pullBubblesWhere(isSeasonalItemRetired)) {
    takePieces(acc, itemId, 1);
  }
  for (const itemId of BuildingManager.pullChestQueueWhere(isSeasonalItemRetired)) {
    takePieces(acc, itemId, 1);
  }
  for (const itemId of EventBoardManager.pullItemsWhere(isSeasonalItemRetired)) {
    takePieces(acc, itemId, 1);
  }
  MerchShopManager.replaceBlockedSeasonalSlots();

  const fresh = accToNotice(acc);
  if (fresh.pieces <= 0) return fresh;
  CurrencyManager.addHuayuan(fresh.huayuan);
  noteSeasonalRetirement(fresh);
  if (opts?.notify) {
    const shown = consumeSeasonalRetirementNotice();
    if (shown) ToastMessage.show(formatSeasonalRetirementToast(shown), 3.2);
  }
  return fresh;
}
