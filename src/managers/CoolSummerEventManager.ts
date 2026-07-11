import { Category, DrinkLine, ITEM_DEFS, isFruitCutLine } from '@/config/ItemConfig';
import { fruitCutGlobalTier } from '@/config/OrderHuayuanConfig';
import {
  COOL_SUMMER_CATEGORY_MAP,
  COOL_SUMMER_COLD_DRINK_REWARDS,
  COOL_SUMMER_DEFAULT_END_AT,
  COOL_SUMMER_DEFAULT_START_AT,
  COOL_SUMMER_FAN_TO_HUAYUAN_RATE,
  COOL_SUMMER_FRUIT_CUT_REWARDS,
  COOL_SUMMER_MIXED_ORDER_MULTIPLIER,
  COOL_SUMMER_PRODUCT_MAP,
  COOL_SUMMER_SEASON_ID,
  COOL_SUMMER_SHOP_PRODUCTS,
  type CoolSummerCategoryId,
  type CoolSummerGrant as CoolSummerGrantDef,
  type CoolSummerShopProduct,
} from '@/config/events/CoolSummerEventConfig';
import { EventBus } from '@/core/EventBus';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { DecorationManager } from '@/managers/DecorationManager';
import { FurnitureWorkshopManager } from '@/managers/FurnitureWorkshopManager';
import { grantQuest } from '@/utils/UnlockChecker';
import { DECO_MAP } from '@/config/DecorationConfig';

export type CoolSummerGrant = CoolSummerGrantDef;
export type CoolSummerActivityStatus = 'upcoming' | 'active' | 'ended';

/** SaveManager 可直接嵌入主存档的数据结构。 */
export interface CoolSummerEventState {
  seasonId: string;
  currency: number;
  purchases: Record<string, number>;
  claimedCategoryRewardIds: CoolSummerCategoryId[];
  /** 活动结束后剩余小扇是否已结算为花愿（防重复兑换）。 */
  currencySettled?: boolean;
}
export type CoolSummerEventPersistState = CoolSummerEventState;

export interface CoolSummerActivitySnapshot {
  status: CoolSummerActivityStatus;
  startAt: number;
  endAt: number;
  /** 未开始时距开始、进行中距结束；已结束为 0。 */
  remainingMs: number;
}

export type CoolSummerPurchaseFailure =
  | 'not_active'
  | 'product_not_found'
  | 'out_of_stock'
  | 'not_enough_currency'
  | 'already_owned'
  | 'grant_failed';

export type CoolSummerPurchaseResult =
  | {
      ok: true;
      product: CoolSummerShopProduct;
      grant: CoolSummerGrant;
      remainingCurrency: number;
      purchasedCount: number;
    }
  | { ok: false; reason: CoolSummerPurchaseFailure };

export type CoolSummerCategoryClaimFailure =
  | 'not_active'
  | 'category_not_found'
  | 'not_complete'
  | 'already_claimed'
  | 'grant_failed';

export type CoolSummerCategoryClaimResult =
  | { ok: true; categoryId: CoolSummerCategoryId; grants: readonly CoolSummerGrant[] }
  | { ok: false; reason: CoolSummerCategoryClaimFailure };

function emptyState(): CoolSummerEventState {
  return {
    seasonId: COOL_SUMMER_SEASON_ID,
    currency: 0,
    purchases: {},
    claimedCategoryRewardIds: [],
    currencySettled: false,
  };
}

class CoolSummerEventManagerClass {
  private _currency = 0;
  private _purchases: Record<string, number> = {};
  private _claimedCategoryRewardIds = new Set<CoolSummerCategoryId>();
  private _currencySettled = false;
  private _lastRedDot = false;
  private _initialized = false;
  private _ticker = 0;
  private _lastStatus: CoolSummerActivityStatus | null = null;
  private _gmActiveOverride = false;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._lastStatus = this.status;
    EventBus.on('customer:delivered', (_uid: number, customer: {
      coolSummerFanReward?: number;
    }) => {
      if (!this.isActive()) return;
      const reward = Math.max(0, Math.floor(customer?.coolSummerFanReward ?? 0));
      if (reward > 0) this.addCurrency(reward);
    });
  }

  update(dt: number): void {
    this._ticker += dt;
    if (this._ticker < 30) return;
    this._ticker = 0;
    const status = this.status;
    if (status === this._lastStatus) {
      // 活动已结束但读档/跨日时可能尚未结算
      if (status === 'ended') this._trySettleExpiredCurrency({ notify: true });
      return;
    }
    this._lastStatus = status;
    if (status === 'ended') {
      this._trySettleExpiredCurrency({ notify: true });
    }
    EventBus.emit('coolSummerEvent:periodChanged', status);
    this._emitChanged();
  }

  isActive(): boolean {
    return this._gmActiveOverride || this.status === 'active';
  }

  countdownLabel(): string | null {
    if (!this.isActive()) return null;
    if (this._gmActiveOverride && this.status !== 'active') return 'GM体验中';
    const sec = Math.max(0, Math.ceil(this.remainingMs / 1000));
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    if (days > 0) return `${days}天${hours}小时`;
    const minutes = Math.max(1, Math.ceil(sec / 60));
    if (hours > 0) return `${hours}小时${Math.floor((sec % 3600) / 60)}分`;
    return `${minutes}分钟`;
  }

  get currency(): number {
    return this._currency;
  }

  get status(): CoolSummerActivityStatus {
    return this.getActivitySnapshot().status;
  }

  get remainingMs(): number {
    return this.getActivitySnapshot().remainingMs;
  }

  get hasRedDot(): boolean {
    if (!this.isActive()) return false;
    return [...COOL_SUMMER_CATEGORY_MAP.keys()].some(id => this.canClaimCategoryReward(id))
      || COOL_SUMMER_SHOP_PRODUCTS.some(product =>
        !this.isProductSatisfied(product.id)
        && this.getRemainingStock(product.id) > 0
        && this._currency >= product.cost);
  }

  getActivitySnapshot(now = Date.now()): CoolSummerActivitySnapshot {
    if (now < COOL_SUMMER_DEFAULT_START_AT) {
      return {
        status: 'upcoming',
        startAt: COOL_SUMMER_DEFAULT_START_AT,
        endAt: COOL_SUMMER_DEFAULT_END_AT,
        remainingMs: COOL_SUMMER_DEFAULT_START_AT - now,
      };
    }
    if (now <= COOL_SUMMER_DEFAULT_END_AT) {
      return {
        status: 'active',
        startAt: COOL_SUMMER_DEFAULT_START_AT,
        endAt: COOL_SUMMER_DEFAULT_END_AT,
        remainingMs: Math.max(0, COOL_SUMMER_DEFAULT_END_AT - now),
      };
    }
    return {
      status: 'ended',
      startAt: COOL_SUMMER_DEFAULT_START_AT,
      endAt: COOL_SUMMER_DEFAULT_END_AT,
      remainingMs: 0,
    };
  }

  calculateOrderReward(itemIds: readonly string[]): number {
    let total = 0;
    let hasColdDrink = false;
    let hasFruitCut = false;

    for (const itemId of itemIds) {
      const item = ITEM_DEFS.get(itemId);
      if (!item) continue;

      if (item.category === Category.DRINK && item.line === DrinkLine.COLD) {
        const reward = COOL_SUMMER_COLD_DRINK_REWARDS[item.level - 1] ?? 0;
        if (reward > 0) {
          total += reward;
          hasColdDrink = true;
        }
        continue;
      }

      if (
        item.category !== Category.FOOD
        || !isFruitCutLine(item.line)
        || item.level < 1
        || item.level > 3
      ) {
        continue;
      }
      const globalLevel = fruitCutGlobalTier(item.line, item.level);
      if (globalLevel <= 0) continue;
      const reward = COOL_SUMMER_FRUIT_CUT_REWARDS[globalLevel - 1] ?? 0;
      if (reward <= 0) continue;
      total += reward;
      hasFruitCut = true;
    }

    return hasColdDrink && hasFruitCut
      ? Math.ceil(total * COOL_SUMMER_MIXED_ORDER_MULTIPLIER)
      : total;
  }

  /**
   * 增加清凉小扇。活动外或非正整数输入不会入账。
   * 返回当前余额，便于订单结算层直接刷新展示。
   */
  addCurrency(amount: number): number {
    if (!this.isActive()) return this._currency;
    const add = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    if (add <= 0) return this._currency;
    this._currency += add;
    EventBus.emit('coolSummerEvent:currencyAdded', add, this._currency);
    this._emitChanged();
    return this._currency;
  }

  getPurchasedCount(productId: string): number {
    return this._purchases[productId] ?? 0;
  }

  getRemainingStock(productId: string): number {
    const product = COOL_SUMMER_PRODUCT_MAP.get(productId);
    if (!product) return 0;
    return Math.max(0, product.stock - this.getPurchasedCount(productId));
  }

  isProductSatisfied(productId: string): boolean {
    const product = COOL_SUMMER_PRODUCT_MAP.get(productId);
    if (!product) return false;
    return this.getPurchasedCount(productId) >= product.stock
      || (product.stock === 1 && this._isUniqueGrantOwned(product.grant));
  }

  isCategoryRewardClaimed(categoryId: CoolSummerCategoryId): boolean {
    return this._claimedCategoryRewardIds.has(categoryId);
  }

  isCategoryComplete(categoryId: CoolSummerCategoryId): boolean {
    if (!COOL_SUMMER_CATEGORY_MAP.has(categoryId)) return false;
    const products = COOL_SUMMER_SHOP_PRODUCTS.filter(product => product.categoryId === categoryId);
    return products.length > 0 && products.every(product => this.isProductSatisfied(product.id));
  }

  canClaimCategoryReward(categoryId: CoolSummerCategoryId): boolean {
    return this.isCategoryComplete(categoryId) && !this.isCategoryRewardClaimed(categoryId);
  }

  purchase(productId: string): CoolSummerPurchaseResult {
    if (!this.isActive()) return { ok: false, reason: 'not_active' };
    const product = COOL_SUMMER_PRODUCT_MAP.get(productId);
    if (!product) return { ok: false, reason: 'product_not_found' };
    if (this.getPurchasedCount(productId) >= product.stock) {
      return { ok: false, reason: 'out_of_stock' };
    }
    if (this._isUniqueGrantOwned(product.grant)) {
      return { ok: false, reason: 'already_owned' };
    }
    if (this._currency < product.cost) {
      return { ok: false, reason: 'not_enough_currency' };
    }
    if (!this._grant(product.grant)) {
      return { ok: false, reason: 'grant_failed' };
    }

    this._currency -= product.cost;
    const purchasedCount = this.getPurchasedCount(productId) + 1;
    this._purchases[productId] = purchasedCount;
    EventBus.emit('coolSummerEvent:purchased', product, product.grant);
    this._emitChanged();
    return {
      ok: true,
      product,
      grant: product.grant,
      remainingCurrency: this._currency,
      purchasedCount,
    };
  }

  claimCategoryReward(categoryId: CoolSummerCategoryId): CoolSummerCategoryClaimResult {
    if (!this.isActive()) return { ok: false, reason: 'not_active' };
    const category = COOL_SUMMER_CATEGORY_MAP.get(categoryId);
    if (!category) return { ok: false, reason: 'category_not_found' };
    if (this.isCategoryRewardClaimed(categoryId)) {
      return { ok: false, reason: 'already_claimed' };
    }
    if (!this.isCategoryComplete(categoryId)) {
      return { ok: false, reason: 'not_complete' };
    }
    if (category.completionRewards.some(grant => this._isUniqueGrantOwned(grant))) {
      return { ok: false, reason: 'grant_failed' };
    }
    for (const grant of category.completionRewards) {
      if (!this._grant(grant)) return { ok: false, reason: 'grant_failed' };
    }

    this._claimedCategoryRewardIds.add(categoryId);
    EventBus.emit('coolSummerEvent:categoryRewardClaimed', categoryId, category.completionRewards);
    this._emitChanged();
    return { ok: true, categoryId, grants: category.completionRewards };
  }

  exportState(): CoolSummerEventState {
    return {
      seasonId: COOL_SUMMER_SEASON_ID,
      currency: this._currency,
      purchases: { ...this._purchases },
      claimedCategoryRewardIds: [...this._claimedCategoryRewardIds],
      currencySettled: this._currencySettled,
    };
  }

  loadState(raw?: Partial<CoolSummerEventState> | null): void {
    const state = raw?.seasonId === COOL_SUMMER_SEASON_ID ? raw : emptyState();
    this._currency = Number.isFinite(state.currency)
      ? Math.max(0, Math.floor(state.currency ?? 0))
      : 0;
    this._purchases = {};
    for (const [productId, count] of Object.entries(state.purchases ?? {})) {
      const product = COOL_SUMMER_PRODUCT_MAP.get(productId);
      if (!product || !Number.isFinite(count)) continue;
      this._purchases[productId] = Math.max(0, Math.min(product.stock, Math.floor(count)));
    }
    this._claimedCategoryRewardIds = new Set(
      (state.claimedCategoryRewardIds ?? []).filter(
        (id): id is CoolSummerCategoryId => COOL_SUMMER_CATEGORY_MAP.has(id as CoolSummerCategoryId),
      ),
    );
    this._currencySettled = !!state.currencySettled;
    this._lastStatus = this.status;
    // 读档时若活动已结束且尚未结算，立即换算
    this._trySettleExpiredCurrency({ notify: false });
    this._emitChanged();
  }

  /** GM：在正式日期外临时开放活动，便于验收；不写入存档。 */
  gmSetActiveOverride(active: boolean): void {
    if (this._gmActiveOverride === active) return;
    this._gmActiveOverride = active;
    if (!active && this.status === 'ended') {
      this._trySettleExpiredCurrency({ notify: true });
    }
    EventBus.emit('coolSummerEvent:periodChanged', this.status);
    this._emitChanged();
  }

  /** GM：无视活动日期直接调整清凉小扇。 */
  gmAddCurrency(amount: number): number {
    const delta = Number.isFinite(amount) ? Math.floor(amount) : 0;
    this._currency = Math.max(0, this._currency + delta);
    if (delta > 0) this._currencySettled = false;
    this._emitChanged();
    return this._currency;
  }

  gmReset(): void {
    const state = emptyState();
    this._currency = state.currency;
    this._purchases = {};
    this._claimedCategoryRewardIds.clear();
    this._currencySettled = false;
    this._emitChanged();
  }

  /**
   * 活动截止后：剩余小扇按等量换算花愿，只结算一次。
   * @returns 换算的花愿数量（0 表示无需结算或已结算过）
   */
  private _trySettleExpiredCurrency(opts?: { notify?: boolean }): number {
    if (this._currencySettled) return 0;
    if (this.getActivitySnapshot().status !== 'ended') return 0;
    // GM 体验中仍视为活动中，不提前结算
    if (this._gmActiveOverride) return 0;

    const fans = Math.max(0, Math.floor(this._currency));
    const huayuan = fans * COOL_SUMMER_FAN_TO_HUAYUAN_RATE;
    this._currency = 0;
    this._currencySettled = true;

    if (huayuan > 0) {
      CurrencyManager.addHuayuan(huayuan);
      EventBus.emit('coolSummerEvent:currencySettled', fans, huayuan);
      if (opts?.notify) {
        ToastMessage.show(`清凉一夏已结束，剩余${fans}把小扇已兑换为${huayuan}花愿`);
      }
    }

    this._emitChanged();
    return huayuan;
  }

  private _isUniqueGrantOwned(grant: CoolSummerGrant): boolean {
    if (grant.kind === 'blueprint') return FurnitureWorkshopManager.hasBlueprint(grant.blueprintId);
    if (grant.kind === 'deco') return DecorationManager.isUnlocked(grant.decoId);
    return false;
  }

  private _grant(grant: CoolSummerGrant): boolean {
    switch (grant.kind) {
      case 'stamina':
        CurrencyManager.addStamina(grant.amount);
        return true;
      case 'huayuan':
        CurrencyManager.addHuayuan(grant.amount);
        return true;
      case 'diamond':
        CurrencyManager.addDiamond(grant.amount);
        return true;
      case 'workshopMaterial':
        return FurnitureWorkshopManager.addMaterial(grant.materialId, grant.amount);
      case 'blueprint':
        return FurnitureWorkshopManager.grantBlueprint(grant.blueprintId);
      case 'deco': {
        const deco = DECO_MAP.get(grant.decoId);
        const questId = deco?.unlockRequirement?.questId;
        if (questId) grantQuest(questId);
        return DecorationManager.gmUnlockDeco(grant.decoId);
      }
    }
  }

  private _emitChanged(): void {
    const state = this.exportState();
    EventBus.emit('coolSummerEvent:changed', state);
    const redDot = this.hasRedDot;
    if (redDot !== this._lastRedDot) {
      this._lastRedDot = redDot;
      EventBus.emit('coolSummerEvent:redDotChanged', redDot);
    }
  }
}

export const CoolSummerEventManager = new CoolSummerEventManagerClass();
