/**
 * 主场景顶栏「内购商店」：随机货架、定时整行刷新、多支付与发奖。
 * 配置见 MerchShopConfig；存档见 SaveManager `merchShop`。
 * 倒计时基于 `Date.now()` 与持久化的 `nextRefreshAt`，**进程不在前台时真实时间仍流逝**，读档与 `ensureUpToDate` 会处理过期货架。
 */
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { ITEM_DEFS } from '@/config/ItemConfig';
import {
  MERCH_SHELVES,
  type MerchPoolEntry,
  type MerchPriceType,
  type MerchShelfDef,
} from '@/config/MerchShopConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { BoardManager } from '@/managers/BoardManager';
import { RewardBoxManager } from '@/managers/RewardBoxManager';
import { AdManager, AdScene } from '@/managers/AdManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';

export interface MerchSlotState {
  itemId: string;
  remaining: number;
  priceType: MerchPriceType;
  priceAmount: number;
}

export interface MerchShelfRuntime {
  nextRefreshAt: number;
  slots: MerchSlotState[];
}

export interface MerchSlotSnapshot extends MerchSlotState {
  name: string;
  icon: string;
}

export interface MerchShelfSnapshot {
  shelfId: string;
  nextRefreshAt: number;
  refreshIntervalSec: number;
  slots: MerchSlotSnapshot[];
}

export interface MerchShopPersistState {
  shelves: {
    nextRefreshAt: number;
    slots: MerchSlotState[];
  }[];
}

function clampPurchaseStock(raw: number | undefined): number {
  const n = raw === undefined ? 1 : Math.floor(Number(raw));
  return Math.max(1, Math.min(99, n));
}

function weightedPickIndex(weights: number[]): number {
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function rollSlotsForShelf(def: MerchShelfDef): MerchSlotState[] {
  const valid = def.pool.filter((p) => ITEM_DEFS.has(p.itemId));
  if (valid.length === 0) {
    console.warn(`[MerchShop] shelf ${def.id} has no valid pool entries`);
    return [];
  }
  const n = def.slotCount;
  const out: MerchPoolEntry[] = [];
  let bag = [...valid];
  for (let k = 0; k < n; k++) {
    if (bag.length === 0) bag = [...valid];
    const weights = bag.map((p) => p.weight);
    const idx = weightedPickIndex(weights);
    const picked = bag[idx]!;
    out.push(picked);
    if (def.pickWithoutReplacement && bag.length > 1) {
      bag = bag.filter((_, j) => j !== idx);
    }
  }
  return out.map((e) => ({
    itemId: e.itemId,
    remaining: clampPurchaseStock(e.purchaseStock),
    priceType: e.priceType,
    priceAmount: Math.max(0, e.priceAmount ?? 0),
  }));
}

class MerchShopManagerClass {
  private _shelves: MerchShelfRuntime[] = [];
  private _tickerBound: (() => void) | null = null;
  private _accumMs = 0;

  init(): void {
    if (this._tickerBound) return;
    this._tickerBound = () => {
      this._accumMs += Game.ticker.deltaMS;
      if (this._accumMs < 900) return;
      this._accumMs = 0;
      this.checkRefreshes();
    };
    Game.ticker.add(this._tickerBound);
  }

  bootstrapFresh(): void {
    const now = Date.now();
    this._shelves = MERCH_SHELVES.map((def) => {
      const slots = rollSlotsForShelf(def);
      return {
        nextRefreshAt: now + def.refreshIntervalSec * 1000,
        slots,
      };
    });
    EventBus.emit('merchShop:changed');
  }

  private _validatePersist(state: MerchShopPersistState | undefined): boolean {
    if (!state?.shelves || state.shelves.length !== MERCH_SHELVES.length) return false;
    for (let i = 0; i < state.shelves.length; i++) {
      const s = state.shelves[i];
      const def = MERCH_SHELVES[i];
      if (!Number.isFinite(s.nextRefreshAt)) return false;
      if (!Array.isArray(s.slots) || s.slots.length !== def.slotCount) return false;
      for (const sl of s.slots) {
        if (!sl.itemId || !ITEM_DEFS.has(sl.itemId)) return false;
        if (sl.remaining < 0 || sl.remaining > 99) return false;
        if (!['free', 'diamond', 'huayuan', 'ad'].includes(sl.priceType)) return false;
      }
    }
    return true;
  }

  loadState(state: MerchShopPersistState | undefined): void {
    if (!this._validatePersist(state)) {
      this.bootstrapFresh();
      return;
    }
    this._shelves = state!.shelves.map((s) => ({
      nextRefreshAt: s.nextRefreshAt,
      slots: s.slots.map((sl) => ({
        itemId: sl.itemId,
        remaining: sl.remaining,
        priceType: sl.priceType,
        priceAmount: Math.max(0, sl.priceAmount ?? 0),
      })),
    }));
    this.ensureUpToDate();
  }

  exportState(): MerchShopPersistState {
    return {
      shelves: this._shelves.map((s) => ({
        nextRefreshAt: s.nextRefreshAt,
        slots: s.slots.map((sl) => ({ ...sl })),
      })),
    };
  }

  /**
   * 打开面板、读档或回前台：若当前时间已过 `nextRefreshAt` 则整行重 roll。
   * @returns 是否有货架被刷新（便于调用方决定是否立即存档）
   */
  ensureUpToDate(): boolean {
    const now = Date.now();
    let changed = false;
    for (let i = 0; i < this._shelves.length; i++) {
      if (now >= this._shelves[i].nextRefreshAt) {
        this.rollShelfNow(i, now);
        changed = true;
      }
    }
    if (changed) EventBus.emit('merchShop:changed');
    return changed;
  }

  /** 到点刷新：新一批商品，nextRefreshAt = now + interval */
  private rollShelfNow(shelfIndex: number, now: number): void {
    const def = MERCH_SHELVES[shelfIndex];
    if (!def) return;
    this._shelves[shelfIndex] = {
      nextRefreshAt: now + def.refreshIntervalSec * 1000,
      slots: rollSlotsForShelf(def),
    };
  }

  checkRefreshes(): void {
    const now = Date.now();
    let changed = false;
    for (let i = 0; i < this._shelves.length; i++) {
      if (now >= this._shelves[i].nextRefreshAt) {
        this.rollShelfNow(i, now);
        changed = true;
      }
    }
    if (changed) EventBus.emit('merchShop:changed');
  }

  /**
   * 花费钻石立即重 roll 指定路货架，`nextRefreshAt = now + refreshIntervalSec`。
   */
  tryDiamondRefreshShelf(shelfIndex: number, diamondCost: number): boolean {
    this.ensureUpToDate();
    if (shelfIndex < 0 || shelfIndex >= MERCH_SHELVES.length) return false;
    if (CurrencyManager.state.diamond < diamondCost) {
      ToastMessage.show('钻石不足');
      return false;
    }
    CurrencyManager.addDiamond(-diamondCost);
    this.rollShelfNow(shelfIndex, Date.now());
    EventBus.emit('merchShop:changed');
    ToastMessage.show('本栏已刷新');
    return true;
  }

  getSnapshot(): MerchShelfSnapshot[] {
    return this._shelves.map((s, i) => {
      const def = MERCH_SHELVES[i]!;
      return {
        shelfId: def.id,
        nextRefreshAt: s.nextRefreshAt,
        refreshIntervalSec: def.refreshIntervalSec,
        slots: s.slots.map((sl) => {
          const d = ITEM_DEFS.get(sl.itemId);
          return {
            ...sl,
            name: d?.name ?? sl.itemId,
            icon: d?.icon ?? 'icon_gem',
          };
        }),
      };
    });
  }

  private grantItem(itemId: string): void {
    const idx = BoardManager.findEmptyOpenCell();
    if (idx >= 0 && BoardManager.placeItem(idx, itemId)) return;
    RewardBoxManager.addItem(itemId, 1);
    ToastMessage.show('棋盘已满，物品已进入收纳盒');
  }

  private canAfford(priceType: MerchPriceType, priceAmount: number): boolean {
    const st = CurrencyManager.state;
    if (priceType === 'free' || priceType === 'ad') return true;
    if (priceType === 'diamond') return st.diamond >= priceAmount;
    if (priceType === 'huayuan') return st.huayuan >= priceAmount;
    return false;
  }

  private pay(priceType: MerchPriceType, priceAmount: number): void {
    if (priceType === 'diamond') CurrencyManager.addDiamond(-priceAmount);
    else if (priceType === 'huayuan') CurrencyManager.addHuayuan(-priceAmount);
  }

  /**
   * 非广告购买；广告位请用 purchaseWithAd。
   */
  tryPurchase(shelfIndex: number, slotIndex: number): boolean {
    this.ensureUpToDate();
    const shelf = this._shelves[shelfIndex];
    if (!shelf || !shelf.slots[slotIndex]) return false;
    const slot = shelf.slots[slotIndex]!;
    if (slot.remaining <= 0) {
      ToastMessage.show('已售罄');
      return false;
    }
    if (slot.priceType === 'ad') {
      ToastMessage.show('请使用广告购买');
      return false;
    }
    if (!this.canAfford(slot.priceType, slot.priceAmount)) {
      if (slot.priceType === 'diamond') ToastMessage.show('钻石不足');
      else if (slot.priceType === 'huayuan') ToastMessage.show('花愿不足');
      return false;
    }
    this.pay(slot.priceType, slot.priceAmount);
    this.grantItem(slot.itemId);
    slot.remaining = Math.max(0, slot.remaining - 1);
    EventBus.emit('merchShop:changed');
    ToastMessage.show(`获得 ${ITEM_DEFS.get(slot.itemId)?.name ?? slot.itemId}`);
    return true;
  }

  purchaseWithAd(shelfIndex: number, slotIndex: number): void {
    this.ensureUpToDate();
    const shelf = this._shelves[shelfIndex];
    if (!shelf || !shelf.slots[slotIndex]) return;
    const slot = shelf.slots[slotIndex]!;
    if (slot.remaining <= 0) {
      ToastMessage.show('已售罄');
      return;
    }
    if (slot.priceType !== 'ad') {
      ToastMessage.show('该商品非广告购买');
      return;
    }
    AdManager.showRewardedAd(AdScene.MERCH_SHOP, (success) => {
      if (!success) {
        ToastMessage.show('广告未看完');
        return;
      }
      this.ensureUpToDate();
      const sh = this._shelves[shelfIndex];
      const sl = sh?.slots[slotIndex];
      if (!sl || sl.itemId !== slot.itemId || sl.remaining <= 0 || sl.priceType !== 'ad') {
        ToastMessage.show('商品已刷新，请重试');
        return;
      }
      this.grantItem(sl.itemId);
      sl.remaining = Math.max(0, sl.remaining - 1);
      EventBus.emit('merchShop:changed');
      ToastMessage.show(`获得 ${ITEM_DEFS.get(sl.itemId)?.name ?? sl.itemId}`);
    });
  }
}

export const MerchShopManager = new MerchShopManagerClass();
