import { ITEM_DEFS, isFruitCutLine } from '@/config/ItemConfig';
import { fruitCutGlobalTier } from '@/config/OrderHuayuanConfig';
import {
  ACTIVE_EXCHANGE_THEME,
  EXCHANGE_CATEGORY_MAP,
  EXCHANGE_PRODUCT_MAP,
  findPastExchangeTheme,
} from '@/config/events/exchange/ExchangeEventRegistry';
import type {
  ExchangeEarnRule,
  ExchangeGrant,
  ExchangeShopProduct,
} from '@/config/events/exchange/ExchangeEventTheme';
import { EventBus } from '@/core/EventBus';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { DecorationManager } from '@/managers/DecorationManager';
import { FurnitureWorkshopManager } from '@/managers/FurnitureWorkshopManager';
import { grantQuest } from '@/utils/UnlockChecker';
import { DECO_MAP } from '@/config/DecorationConfig';

const THEME = ACTIVE_EXCHANGE_THEME;

export type ExchangeActivityStatus = 'upcoming' | 'active' | 'ended';

/** SaveManager 可直接嵌入主存档的数据结构。 */
export interface ExchangeEventState {
  seasonId: string;
  currency: number;
  purchases: Record<string, number>;
  claimedCategoryRewardIds: string[];
  /** 活动结束后剩余货币是否已结算为花愿（防重复兑换）。 */
  currencySettled?: boolean;
}

export interface ExchangeActivitySnapshot {
  status: ExchangeActivityStatus;
  startAt: number;
  endAt: number;
  /** 未开始时距开始、进行中距结束；已结束为 0。 */
  remainingMs: number;
}

export type ExchangePurchaseFailure =
  | 'not_active'
  | 'product_not_found'
  | 'out_of_stock'
  | 'not_enough_currency'
  | 'already_owned'
  | 'grant_failed';

export type ExchangePurchaseResult =
  | {
      ok: true;
      product: ExchangeShopProduct;
      grant: ExchangeGrant;
      remainingCurrency: number;
      purchasedCount: number;
    }
  | { ok: false; reason: ExchangePurchaseFailure };

export type ExchangeCategoryClaimFailure =
  | 'not_active'
  | 'category_not_found'
  | 'not_complete'
  | 'already_claimed'
  | 'grant_failed';

export type ExchangeCategoryClaimResult =
  | { ok: true; categoryId: string; grants: readonly ExchangeGrant[] }
  | { ok: false; reason: ExchangeCategoryClaimFailure };

function emptyState(): ExchangeEventState {
  return {
    seasonId: THEME.seasonId,
    currency: 0,
    purchases: {},
    claimedCategoryRewardIds: [],
    currencySettled: false,
  };
}

function ruleMatches(rule: ExchangeEarnRule, category: string, line: string): boolean {
  if (rule.category !== category) return false;
  if (rule.fruitCutLines) return isFruitCutLine(line);
  return rule.line === line;
}

class ExchangeEventManagerClass {
  private _currency = 0;
  private _purchases: Record<string, number> = {};
  private _claimedCategoryRewardIds = new Set<string>();
  private _currencySettled = false;
  private _lastRedDot = false;
  private _initialized = false;
  private _ticker = 0;
  private _lastStatus: ExchangeActivityStatus | null = null;
  private _gmActiveOverride = false;
  /** 读档时结算了上一期货币；等首帧 update 再提示，避免 UI 未就绪。 */
  private _pendingToast: string | null = null;

  get theme() {
    return THEME;
  }

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._lastStatus = this.status;
    EventBus.on('customer:delivered', (_uid: number, customer: {
      exchangeEventReward?: number;
    }) => {
      if (!this.isActive()) return;
      const reward = Math.max(0, Math.floor(customer?.exchangeEventReward ?? 0));
      if (reward > 0) this.addCurrency(reward);
    });
  }

  update(dt: number): void {
    if (this._pendingToast) {
      ToastMessage.show(this._pendingToast);
      this._pendingToast = null;
    }
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
    EventBus.emit('exchangeEvent:periodChanged', status);
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

  get status(): ExchangeActivityStatus {
    return this.getActivitySnapshot().status;
  }

  get remainingMs(): number {
    return this.getActivitySnapshot().remainingMs;
  }

  get hasRedDot(): boolean {
    if (!this.isActive()) return false;
    return [...EXCHANGE_CATEGORY_MAP.keys()].some(id => this.canClaimCategoryReward(id))
      || THEME.products.some(product =>
        !this.isProductSatisfied(product.id)
        && this.getRemainingStock(product.id) > 0
        && this._currency >= product.cost);
  }

  getActivitySnapshot(now = Date.now()): ExchangeActivitySnapshot {
    const { startAt, endAt } = THEME;
    if (now < startAt) {
      return { status: 'upcoming', startAt, endAt, remainingMs: startAt - now };
    }
    if (now <= endAt) {
      return { status: 'active', startAt, endAt, remainingMs: Math.max(0, endAt - now) };
    }
    return { status: 'ended', startAt, endAt, remainingMs: 0 };
  }

  calculateOrderReward(itemIds: readonly string[]): number {
    let total = 0;
    const hitRuleIds = new Set<string>();

    for (const itemId of itemIds) {
      const item = ITEM_DEFS.get(itemId);
      if (!item) continue;
      const rule = THEME.earnRules.find(r => ruleMatches(r, item.category, item.line));
      if (!rule) continue;

      let tier = 0;
      if (rule.tier === 'fruitCutGlobal') {
        if (item.level < 1 || item.level > 3) continue;
        tier = fruitCutGlobalTier(item.line, item.level);
      } else {
        tier = item.level;
      }
      if (tier <= 0) continue;
      const reward = rule.rewards[tier - 1] ?? 0;
      if (reward <= 0) continue;
      total += reward;
      hitRuleIds.add(rule.id);
    }

    const mixed = THEME.mixedRuleIds.length > 1
      && THEME.mixedRuleIds.every(id => hitRuleIds.has(id));
    return mixed ? Math.ceil(total * THEME.mixedMultiplier) : total;
  }

  /**
   * 增加活动货币。活动外或非正整数输入不会入账。
   * 返回当前余额，便于订单结算层直接刷新展示。
   */
  addCurrency(amount: number): number {
    if (!this.isActive()) return this._currency;
    const add = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    if (add <= 0) return this._currency;
    this._currency += add;
    EventBus.emit('exchangeEvent:currencyAdded', add, this._currency);
    this._emitChanged();
    return this._currency;
  }

  getPurchasedCount(productId: string): number {
    return this._purchases[productId] ?? 0;
  }

  getRemainingStock(productId: string): number {
    const product = EXCHANGE_PRODUCT_MAP.get(productId);
    if (!product) return 0;
    return Math.max(0, product.stock - this.getPurchasedCount(productId));
  }

  isProductSatisfied(productId: string): boolean {
    const product = EXCHANGE_PRODUCT_MAP.get(productId);
    if (!product) return false;
    return this.getPurchasedCount(productId) >= product.stock
      || (product.stock === 1 && this._isUniqueGrantOwned(product.grant));
  }

  isCategoryRewardClaimed(categoryId: string): boolean {
    return this._claimedCategoryRewardIds.has(categoryId);
  }

  isCategoryComplete(categoryId: string): boolean {
    if (!EXCHANGE_CATEGORY_MAP.has(categoryId)) return false;
    const products = THEME.products.filter(product => product.categoryId === categoryId);
    return products.length > 0 && products.every(product => this.isProductSatisfied(product.id));
  }

  canClaimCategoryReward(categoryId: string): boolean {
    return this.isCategoryComplete(categoryId) && !this.isCategoryRewardClaimed(categoryId);
  }

  purchase(productId: string): ExchangePurchaseResult {
    if (!this.isActive()) return { ok: false, reason: 'not_active' };
    const product = EXCHANGE_PRODUCT_MAP.get(productId);
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
    EventBus.emit('exchangeEvent:purchased', product, product.grant);
    this._emitChanged();
    return {
      ok: true,
      product,
      grant: product.grant,
      remainingCurrency: this._currency,
      purchasedCount,
    };
  }

  claimCategoryReward(categoryId: string): ExchangeCategoryClaimResult {
    if (!this.isActive()) return { ok: false, reason: 'not_active' };
    const category = EXCHANGE_CATEGORY_MAP.get(categoryId);
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
    EventBus.emit('exchangeEvent:categoryRewardClaimed', categoryId, category.completionRewards);
    this._emitChanged();
    return { ok: true, categoryId, grants: category.completionRewards };
  }

  exportState(): ExchangeEventState {
    return {
      seasonId: THEME.seasonId,
      currency: this._currency,
      purchases: { ...this._purchases },
      claimedCategoryRewardIds: [...this._claimedCategoryRewardIds],
      currencySettled: this._currencySettled,
    };
  }

  /** 存档里是上一期（含旧字段 coolSummerEvent）时，先结算剩余货币，再以本期空状态开始。 */
  loadState(raw?: Partial<ExchangeEventState> | null): void {
    if (raw && raw.seasonId !== THEME.seasonId) this._settlePastSeason(raw);
    const state = raw?.seasonId === THEME.seasonId ? raw : emptyState();
    this._currency = Number.isFinite(state.currency)
      ? Math.max(0, Math.floor(state.currency ?? 0))
      : 0;
    this._purchases = {};
    for (const [productId, count] of Object.entries(state.purchases ?? {})) {
      const product = EXCHANGE_PRODUCT_MAP.get(productId);
      if (!product || !Number.isFinite(count)) continue;
      this._purchases[productId] = Math.max(0, Math.min(product.stock, Math.floor(count)));
    }
    this._claimedCategoryRewardIds = new Set(
      (state.claimedCategoryRewardIds ?? []).filter(id => EXCHANGE_CATEGORY_MAP.has(id)),
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
    EventBus.emit('exchangeEvent:periodChanged', this.status);
    this._emitChanged();
  }

  /** GM：无视活动日期直接调整活动货币。 */
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

  private _settlePastSeason(raw: Partial<ExchangeEventState>): void {
    if (raw.currencySettled) return;
    const past = findPastExchangeTheme(raw.seasonId);
    if (!past) return;
    const amount = Number.isFinite(raw.currency) ? Math.max(0, Math.floor(raw.currency ?? 0)) : 0;
    if (amount <= 0) return;
    const huayuan = amount * past.settleToHuayuanRate;
    CurrencyManager.addHuayuan(huayuan);
    EventBus.emit('exchangeEvent:currencySettled', amount, huayuan, past.seasonId);
    this._pendingToast = `${past.name}已结束，剩余${amount}${past.currencyName}已兑换为${huayuan}花愿`;
  }

  /**
   * 活动截止后：剩余货币按比例换算花愿，只结算一次。
   * @returns 换算的花愿数量（0 表示无需结算或已结算过）
   */
  private _trySettleExpiredCurrency(opts?: { notify?: boolean }): number {
    if (this._currencySettled) return 0;
    if (this.getActivitySnapshot().status !== 'ended') return 0;
    // GM 体验中仍视为活动中，不提前结算
    if (this._gmActiveOverride) return 0;

    const amount = Math.max(0, Math.floor(this._currency));
    const huayuan = amount * THEME.settleToHuayuanRate;
    this._currency = 0;
    this._currencySettled = true;

    if (huayuan > 0) {
      CurrencyManager.addHuayuan(huayuan);
      EventBus.emit('exchangeEvent:currencySettled', amount, huayuan, THEME.seasonId);
      if (opts?.notify) {
        ToastMessage.show(`${THEME.name}已结束，剩余${amount}${THEME.currencyName}已兑换为${huayuan}花愿`);
      }
    }

    this._emitChanged();
    return huayuan;
  }

  private _isUniqueGrantOwned(grant: ExchangeGrant): boolean {
    if (grant.kind === 'blueprint') return FurnitureWorkshopManager.hasBlueprint(grant.blueprintId);
    if (grant.kind === 'deco') return DecorationManager.isUnlocked(grant.decoId);
    return false;
  }

  private _grant(grant: ExchangeGrant): boolean {
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
    EventBus.emit('exchangeEvent:changed', state);
    const redDot = this.hasRedDot;
    if (redDot !== this._lastRedDot) {
      this._lastRedDot = redDot;
      EventBus.emit('exchangeEvent:redDotChanged', redDot);
    }
  }
}

export const ExchangeEventManager = new ExchangeEventManagerClass();
