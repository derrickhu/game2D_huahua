import { EventBus } from '@/core/EventBus';
import { AudioManager } from '@/core/AudioManager';
import { PersistService } from '@/core/PersistService';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { DecorationManager } from '@/managers/DecorationManager';
import {
  WORKSHOP_BLUEPRINT_MAP,
  WORKSHOP_DYE_MATERIAL_ID,
  WORKSHOP_DYE_PINK_ID,
  WORKSHOP_DYE_YELLOW_ID,
  WORKSHOP_DYE_BLUE_ID,
  WORKSHOP_DYE_GREEN_ID,
  WORKSHOP_MATERIAL_ID,
  WORKSHOP_RESOURCE_BAR,
  getBlueprintColorOption,
  getBlueprintDiamondCost,
  isBlueprintDiamondPurchasable,
  listDiamondShopBlueprintIds,
  makeWorkshopVariantKey,
  parseWorkshopVariantKey,
  WORKSHOP_SHOP_CATALOG_SEEN_BASELINE_IDS,
  WORKSHOP_SHOP_CATALOG_SEEN_MIGRATION,
  type WorkshopColorOption,
} from '@/config/FurnitureWorkshopConfig';
import { DECO_MAP } from '@/config/DecorationConfig';

export const FURNITURE_WORKSHOP_SAVE_KEY = 'huahua_furniture_workshop';

export interface FurnitureWorkshopSaveData {
  blueprints: string[];
  workshopMaterial: number;
  workshopDyePink: number;
  workshopDyeYellow: number;
  workshopDyeBlue: number;
  workshopDyeGreen: number;
  craftedVariants: string[];
  /**
   * 新获得、尚未制作过的图纸 id（新→旧）：商店购买 / 活动 / 成长之路等均计入。
   * 工坊列表置顶并显示「新」角标；首次制作该图纸任一配色后清除。
   */
  newBlueprintIds?: string[];
  /**
   * 玩家已看过的「钻石在售」图纸目录。缺省字段时首次读档会用
   * `WORKSHOP_SHOP_CATALOG_SEEN_BASELINE_IDS` 灌基线（不是整店当前货架），
   * 避免老玩家一上线就把整店标成「上新」；基线外的新增图纸会触发「上新」。
   */
  seenShopBlueprintIds?: string[];
  /** 是否已完成商店目录基线灌入 */
  shopCatalogSeenBootstrapped?: boolean;
  /** 商店目录基线迁移版本（见 WORKSHOP_SHOP_CATALOG_SEEN_MIGRATION） */
  shopCatalogSeenMigration?: number;
}

export interface WorkshopCraftCheck {
  ok: boolean;
  reason?: 'missing_blueprint' | 'already_crafted' | 'limit_reached' | 'locked' | 'missing_material' | 'missing_dye' | 'not_enough_huayuan';
}

export interface WorkshopBlueprintPurchaseCheck {
  ok: boolean;
  reason?: 'missing_blueprint' | 'already_owned' | 'not_purchasable' | 'not_enough_diamond';
}

const KNOWN_MATERIAL_IDS = new Set([
  WORKSHOP_MATERIAL_ID,
  WORKSHOP_DYE_PINK_ID,
  WORKSHOP_DYE_YELLOW_ID,
  WORKSHOP_DYE_BLUE_ID,
  WORKSHOP_DYE_GREEN_ID,
  WORKSHOP_DYE_MATERIAL_ID,
  'workshop_wood',
  'workshop_fabric',
  'workshop_metal',
  'workshop_stardust',
  'dye_moon_blue',
  'dye_sakura_pink',
]);

class FurnitureWorkshopManagerClass {
  private _blueprints = new Set<string>();
  private _workshopMaterial = 0;
  private _workshopDyePink = 0;
  private _workshopDyeYellow = 0;
  private _workshopDyeBlue = 0;
  private _workshopDyeGreen = 0;
  private _craftedVariants = new Set<string>();
  /** 新购图纸高亮顺序（index 0 = 最新） */
  private _newBlueprintIds: string[] = [];
  /** 已看过的钻石在售图纸目录 */
  private _seenShopBlueprintIds = new Set<string>();
  private _shopCatalogSeenBootstrapped = false;
  private _shopCatalogSeenMigration = 0;
  private _initialized = false;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._load();
    this._syncCraftedVariantsFromDecorations();
    this._pruneNewBlueprintIds();
    this._bootstrapShopCatalogSeenIfNeeded();
    this._migrateShopCatalogSeenIfNeeded();
    this._save();
    console.log(
      `[FurnitureWorkshop] 初始化: 图纸 ${this._blueprints.size}, 材料 ${this._workshopMaterial}, 粉染 ${this._workshopDyePink}, 黄染 ${this._workshopDyeYellow}, 蓝染 ${this._workshopDyeBlue}, 绿染 ${this._workshopDyeGreen}, 已制作 ${this._craftedVariants.size}`,
    );
  }

  reloadFromStorage(): void {
    this._blueprints.clear();
    this._workshopMaterial = 0;
    this._workshopDyePink = 0;
    this._workshopDyeYellow = 0;
    this._workshopDyeBlue = 0;
    this._workshopDyeGreen = 0;
    this._craftedVariants.clear();
    this._newBlueprintIds = [];
    this._seenShopBlueprintIds.clear();
    this._shopCatalogSeenBootstrapped = false;
    this._shopCatalogSeenMigration = 0;
    this._load();
    this._syncCraftedVariantsFromDecorations();
    this._pruneNewBlueprintIds();
    this._bootstrapShopCatalogSeenIfNeeded();
    this._migrateShopCatalogSeenIfNeeded();
    this._save();
    EventBus.emit('furnitureWorkshop:changed');
  }

  hasBlueprint(blueprintId: string): boolean {
    return this._blueprints.has(blueprintId);
  }

  getBlueprints(): string[] {
    return [...this._blueprints];
  }

  getResourceCount(materialId: string): number {
    switch (materialId) {
      case WORKSHOP_MATERIAL_ID: return this._workshopMaterial;
      case WORKSHOP_DYE_PINK_ID: return this._workshopDyePink;
      case WORKSHOP_DYE_YELLOW_ID: return this._workshopDyeYellow;
      case WORKSHOP_DYE_BLUE_ID: return this._workshopDyeBlue;
      case WORKSHOP_DYE_GREEN_ID: return this._workshopDyeGreen;
      default: return 0;
    }
  }

  getWorkshopMaterialCount(): number {
    return this._workshopMaterial;
  }

  /** @deprecated 使用 getResourceCount(WORKSHOP_DYE_PINK_ID) */
  getWorkshopDyeCount(): number {
    return this._workshopDyePink;
  }

  getMaterialCount(materialId: string): number {
    return this.getResourceCount(materialId);
  }

  /**
   * 某配色是否已制作：以当前账号是否已解锁对应家具为准。
   * 不单独信任本地 craftedVariants（清云存档换新号时本地工坊记录会残留，导致误判「已制作」）。
   */
  hasCraftedColor(blueprintId: string, colorId: string): boolean {
    const option = getBlueprintColorOption(blueprintId, colorId);
    if (!option) return false;
    return DecorationManager.isUnlocked(option.outputDecoId);
  }

  getCraftedCount(blueprintId: string, colorId: string): number {
    const option = getBlueprintColorOption(blueprintId, colorId);
    return option ? DecorationManager.getOwnedCount(option.outputDecoId) : 0;
  }

  getCraftLimit(blueprintId: string, colorId: string): number {
    const option = getBlueprintColorOption(blueprintId, colorId);
    return option ? DecorationManager.getMaxOwned(option.outputDecoId) : 1;
  }

  isCraftLimitReached(blueprintId: string, colorId: string): boolean {
    return this.getCraftedCount(blueprintId, colorId) >= this.getCraftLimit(blueprintId, colorId);
  }

  /**
   * 已制作过的「图纸+配色」种类数（成长任务 workshopCrafted 进度）。
   * 以 `_craftedVariants` 为准，它在读档时已由 `_syncCraftedVariantsFromDecorations` 按
   * 实际已解锁家具重建，因此老存档也能正确追溯。
   */
  get craftedVariantCount(): number {
    return this._craftedVariants.size;
  }

  /** 该图纸所有配色均已制作（均已拥有对应家具） */
  isBlueprintFullyCrafted(blueprintId: string): boolean {
    const def = WORKSHOP_BLUEPRINT_MAP.get(blueprintId);
    if (!def || def.colorOptions.length === 0) return true;
    return def.colorOptions.every(c => this.isCraftLimitReached(blueprintId, c.id));
  }

  /** 新获得且尚未制作时显示「新」角标并置顶 */
  isNewBlueprintHighlight(blueprintId: string): boolean {
    return this._newBlueprintIds.includes(blueprintId);
  }

  /** 新图纸排序：越新越靠前；非新标返回 0 */
  compareNewBlueprintOrder(aId: string, bId: string): number {
    const ai = this._newBlueprintIds.indexOf(aId);
    const bi = this._newBlueprintIds.indexOf(bId);
    if (ai < 0 && bi < 0) return 0;
    if (ai < 0) return 1;
    if (bi < 0) return -1;
    return ai - bi;
  }

  private _markBlueprintNew(blueprintId: string): void {
    this._newBlueprintIds = [
      blueprintId,
      ...this._newBlueprintIds.filter(id => id !== blueprintId),
    ];
  }

  private _clearBlueprintNew(blueprintId: string): boolean {
    const before = this._newBlueprintIds.length;
    this._newBlueprintIds = this._newBlueprintIds.filter(id => id !== blueprintId);
    return this._newBlueprintIds.length !== before;
  }

  /** 去掉已不拥有、或任一配色已制作过的「新」标记 */
  private _pruneNewBlueprintIds(): void {
    this._newBlueprintIds = this._newBlueprintIds.filter((id) => {
      if (!this._blueprints.has(id) || !WORKSHOP_BLUEPRINT_MAP.has(id)) return false;
      const def = WORKSHOP_BLUEPRINT_MAP.get(id)!;
      return !def.colorOptions.some(c => this.hasCraftedColor(id, c.id));
    });
  }

  private _bootstrapShopCatalogSeenIfNeeded(): void {
    if (this._shopCatalogSeenBootstrapped) return;
    // 只用冻结基线灌「已看」，勿用当前整店货架（否则同期上架的新品会被吞掉）
    for (const id of WORKSHOP_SHOP_CATALOG_SEEN_BASELINE_IDS) {
      if (WORKSHOP_BLUEPRINT_MAP.has(id)) this._seenShopBlueprintIds.add(id);
    }
    this._shopCatalogSeenBootstrapped = true;
  }

  /**
   * 修正「上新」功能上线时误把当时整店（含新品）灌进已看的存档：
   * 将基线外的钻石图纸从已看中移除，补发商店入口「上新」。
   */
  private _migrateShopCatalogSeenIfNeeded(): void {
    if (this._shopCatalogSeenMigration >= WORKSHOP_SHOP_CATALOG_SEEN_MIGRATION) return;
    const baseline = new Set(WORKSHOP_SHOP_CATALOG_SEEN_BASELINE_IDS);
    for (const id of listDiamondShopBlueprintIds()) {
      if (!baseline.has(id)) this._seenShopBlueprintIds.delete(id);
    }
    for (const id of WORKSHOP_SHOP_CATALOG_SEEN_BASELINE_IDS) {
      if (WORKSHOP_BLUEPRINT_MAP.has(id)) this._seenShopBlueprintIds.add(id);
    }
    this._shopCatalogSeenBootstrapped = true;
    this._shopCatalogSeenMigration = WORKSHOP_SHOP_CATALOG_SEEN_MIGRATION;
  }

  /** 钻石在售、玩家未拥有、且尚未打开商店看过的「上新」图纸 */
  isUnseenShopSaleBlueprint(blueprintId: string): boolean {
    this._bootstrapShopCatalogSeenIfNeeded();
    if (!isBlueprintDiamondPurchasable(blueprintId)) return false;
    if (this._blueprints.has(blueprintId)) return false;
    return !this._seenShopBlueprintIds.has(blueprintId);
  }

  hasUnseenShopSaleBlueprints(): boolean {
    this._bootstrapShopCatalogSeenIfNeeded();
    return listDiamondShopBlueprintIds().some(id => this.isUnseenShopSaleBlueprint(id));
  }

  /** 打开图纸商店时调用：当前货架全部记为已看，清除「上新」提醒 */
  markShopCatalogSeen(): void {
    for (const id of listDiamondShopBlueprintIds()) {
      this._seenShopBlueprintIds.add(id);
    }
    this._shopCatalogSeenBootstrapped = true;
    this._save();
    EventBus.emit('furnitureWorkshop:changed');
  }

  grantBlueprint(blueprintId: string): boolean {
    if (!WORKSHOP_BLUEPRINT_MAP.has(blueprintId)) return false;
    if (this._blueprints.has(blueprintId)) return false;
    this._blueprints.add(blueprintId);
    this._markBlueprintNew(blueprintId);
    this._save();
    EventBus.emit('furnitureWorkshop:blueprintGranted', blueprintId);
    EventBus.emit('furnitureWorkshop:changed');
    return true;
  }

  canPurchaseBlueprint(blueprintId: string): WorkshopBlueprintPurchaseCheck {
    if (!WORKSHOP_BLUEPRINT_MAP.has(blueprintId)) {
      return { ok: false, reason: 'missing_blueprint' };
    }
    if (this._blueprints.has(blueprintId)) {
      return { ok: false, reason: 'already_owned' };
    }
    if (!isBlueprintDiamondPurchasable(blueprintId)) {
      return { ok: false, reason: 'not_purchasable' };
    }
    const cost = getBlueprintDiamondCost(blueprintId)!;
    if (CurrencyManager.state.diamond < cost) {
      return { ok: false, reason: 'not_enough_diamond' };
    }
    return { ok: true };
  }

  purchaseBlueprint(blueprintId: string): WorkshopBlueprintPurchaseCheck {
    const check = this.canPurchaseBlueprint(blueprintId);
    if (!check.ok) return check;

    const cost = getBlueprintDiamondCost(blueprintId)!;
    CurrencyManager.addDiamond(-cost);
    AudioManager.play('purchase_tap');
    this._blueprints.add(blueprintId);
    this._markBlueprintNew(blueprintId);
    this._save();
    EventBus.emit('furnitureWorkshop:blueprintGranted', blueprintId);
    EventBus.emit('furnitureWorkshop:changed');
    return { ok: true };
  }

  addMaterial(materialId: string, count: number): boolean {
    if (!KNOWN_MATERIAL_IDS.has(materialId)) return false;
    const n = Math.floor(count);
    if (n <= 0) return false;

    switch (materialId) {
      case WORKSHOP_MATERIAL_ID:
      case 'workshop_wood':
      case 'workshop_fabric':
      case 'workshop_metal':
      case 'workshop_stardust':
        this._workshopMaterial += n;
        break;
      case WORKSHOP_DYE_PINK_ID:
      case WORKSHOP_DYE_MATERIAL_ID:
      case 'dye_sakura_pink':
        this._workshopDyePink += n;
        break;
      case WORKSHOP_DYE_YELLOW_ID:
      case 'dye_moon_blue':
        this._workshopDyeYellow += n;
        break;
      case WORKSHOP_DYE_BLUE_ID:
        this._workshopDyeBlue += n;
        break;
      case WORKSHOP_DYE_GREEN_ID:
        this._workshopDyeGreen += n;
        break;
      default:
        return false;
    }

    this._save();
    EventBus.emit('furnitureWorkshop:materialChanged', materialId, this.getResourceCount(materialId));
    EventBus.emit('furnitureWorkshop:changed');
    return true;
  }

  addWorkshopMaterial(count: number): void {
    this.addMaterial(WORKSHOP_MATERIAL_ID, count);
  }

  private _getDyeCountForOption(option: WorkshopColorOption): number {
    if (!option.dyeMaterialId || option.dyeCost <= 0) return 0;
    return this.getResourceCount(option.dyeMaterialId);
  }

  private _adjustDyeCount(materialId: string, delta: number): void {
    switch (materialId) {
      case WORKSHOP_DYE_PINK_ID:
      case WORKSHOP_DYE_MATERIAL_ID:
      case 'dye_sakura_pink':
        this._workshopDyePink = Math.max(0, this._workshopDyePink + delta);
        break;
      case WORKSHOP_DYE_YELLOW_ID:
      case 'dye_moon_blue':
        this._workshopDyeYellow = Math.max(0, this._workshopDyeYellow + delta);
        break;
      case WORKSHOP_DYE_BLUE_ID:
        this._workshopDyeBlue = Math.max(0, this._workshopDyeBlue + delta);
        break;
      case WORKSHOP_DYE_GREEN_ID:
        this._workshopDyeGreen = Math.max(0, this._workshopDyeGreen + delta);
        break;
      default:
        break;
    }
  }

  private _consumeDyeForOption(option: WorkshopColorOption): void {
    if (!option.dyeMaterialId || option.dyeCost <= 0) return;
    this._adjustDyeCount(option.dyeMaterialId, -option.dyeCost);
  }

  private _refundDyeForOption(option: WorkshopColorOption): void {
    if (!option.dyeMaterialId || option.dyeCost <= 0) return;
    this._adjustDyeCount(option.dyeMaterialId, option.dyeCost);
  }

  canCraftColor(blueprintId: string, colorId: string): WorkshopCraftCheck {
    const option = getBlueprintColorOption(blueprintId, colorId);
    if (!option) return { ok: false, reason: 'missing_blueprint' };
    if (!this._blueprints.has(blueprintId)) {
      return { ok: false, reason: 'missing_blueprint' };
    }
    const outputDeco = DECO_MAP.get(option.outputDecoId);
    if (outputDeco?.stackable) {
      if (!DecorationManager.canOwnMore(option.outputDecoId)) {
        return { ok: false, reason: 'limit_reached' };
      }
    } else if (DecorationManager.isUnlocked(option.outputDecoId)) {
      return { ok: false, reason: 'already_crafted' };
    }
    if (this._workshopMaterial < option.materialCost) {
      return { ok: false, reason: 'missing_material' };
    }
    if (option.dyeCost > 0 && this._getDyeCountForOption(option) < option.dyeCost) {
      return { ok: false, reason: 'missing_dye' };
    }
    if (CurrencyManager.state.huayuan < option.huayuanCost) {
      return { ok: false, reason: 'not_enough_huayuan' };
    }
    return { ok: true };
  }

  craftColor(blueprintId: string, colorId: string): WorkshopCraftCheck {
    const check = this.canCraftColor(blueprintId, colorId);
    if (!check.ok) return check;

    const option = getBlueprintColorOption(blueprintId, colorId)!;
    const ownedBefore = DecorationManager.getOwnedCount(option.outputDecoId);
    this._workshopMaterial = Math.max(0, this._workshopMaterial - option.materialCost);
    this._consumeDyeForOption(option);

    const outputDeco = DECO_MAP.get(option.outputDecoId);
    const deferStarGrant = ownedBefore === 0 && (outputDeco?.starValue ?? 0) > 0;
    const unlocked = DecorationManager.unlockFromWorkshop(option.outputDecoId, option.huayuanCost, {
      deferStarGrant,
    });
    if (!unlocked) {
      this._workshopMaterial += option.materialCost;
      this._refundDyeForOption(option);
      this._save();
      return { ok: false, reason: 'missing_blueprint' };
    }

    this._craftedVariants.add(makeWorkshopVariantKey(blueprintId, colorId));
    this._clearBlueprintNew(blueprintId);
    this._save();
    EventBus.emit('furnitureWorkshop:crafted', option.outputDecoId, {
      blueprintId,
      colorId,
      option,
      ownedCount: ownedBefore + 1,
      maxOwned: DecorationManager.getMaxOwned(option.outputDecoId),
      isFirstCraft: ownedBefore === 0,
    });
    EventBus.emit('furnitureWorkshop:changed');
    return { ok: true };
  }

  /** 按当前已解锁家具重建「已制作」列表，避免本地残留挡住新号 */
  private _syncCraftedVariantsFromDecorations(): void {
    this._craftedVariants.clear();
    for (const [blueprintId, def] of WORKSHOP_BLUEPRINT_MAP) {
      for (const opt of def.colorOptions) {
        if (DecorationManager.isUnlocked(opt.outputDecoId)) {
          this._craftedVariants.add(makeWorkshopVariantKey(blueprintId, opt.id));
        }
      }
    }
  }

  exportState(): FurnitureWorkshopSaveData {
    this._syncCraftedVariantsFromDecorations();
    this._pruneNewBlueprintIds();
    this._bootstrapShopCatalogSeenIfNeeded();
    return {
      blueprints: [...this._blueprints].filter(id => WORKSHOP_BLUEPRINT_MAP.has(id)),
      workshopMaterial: this._workshopMaterial,
      workshopDyePink: this._workshopDyePink,
      workshopDyeYellow: this._workshopDyeYellow,
      workshopDyeBlue: this._workshopDyeBlue,
      workshopDyeGreen: this._workshopDyeGreen,
      craftedVariants: [...this._craftedVariants],
      newBlueprintIds: [...this._newBlueprintIds],
      seenShopBlueprintIds: [...this._seenShopBlueprintIds],
      shopCatalogSeenBootstrapped: this._shopCatalogSeenBootstrapped,
      shopCatalogSeenMigration: this._shopCatalogSeenMigration,
    };
  }

  private _load(): void {
    try {
      const raw = PersistService.readRaw(FURNITURE_WORKSHOP_SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<FurnitureWorkshopSaveData> & {
        materials?: Record<string, number>;
        craftedRecipeIds?: string[];
        workshopDye?: number;
      };

      if (Array.isArray(data.blueprints)) {
        for (const id of data.blueprints) {
          if (typeof id === 'string' && WORKSHOP_BLUEPRINT_MAP.has(id)) this._blueprints.add(id);
        }
      }

      if (typeof data.workshopMaterial === 'number') {
        this._workshopMaterial = Math.max(0, Math.floor(data.workshopMaterial));
      }
      if (typeof data.workshopDyePink === 'number') {
        this._workshopDyePink = Math.max(0, Math.floor(data.workshopDyePink));
      }
      if (typeof data.workshopDyeYellow === 'number') {
        this._workshopDyeYellow = Math.max(0, Math.floor(data.workshopDyeYellow));
      }
      if (typeof data.workshopDyeBlue === 'number') {
        this._workshopDyeBlue = Math.max(0, Math.floor(data.workshopDyeBlue));
      }
      if (typeof data.workshopDyeGreen === 'number') {
        this._workshopDyeGreen = Math.max(0, Math.floor(data.workshopDyeGreen));
      }
      if (typeof data.workshopDye === 'number') {
        this._workshopDyePink += Math.max(0, Math.floor(data.workshopDye));
      }

      if (data.materials && typeof data.materials === 'object') {
        for (const [id, value] of Object.entries(data.materials)) {
          const count = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
          if (count <= 0 || !KNOWN_MATERIAL_IDS.has(id)) continue;
          switch (id) {
            case WORKSHOP_MATERIAL_ID:
            case 'workshop_wood':
            case 'workshop_fabric':
            case 'workshop_metal':
            case 'workshop_stardust':
              this._workshopMaterial += count;
              break;
            case WORKSHOP_DYE_PINK_ID:
            case WORKSHOP_DYE_MATERIAL_ID:
            case 'dye_sakura_pink':
              this._workshopDyePink += count;
              break;
            case WORKSHOP_DYE_YELLOW_ID:
            case 'dye_moon_blue':
              this._workshopDyeYellow += count;
              break;
            case WORKSHOP_DYE_BLUE_ID:
              this._workshopDyeBlue += count;
              break;
            case WORKSHOP_DYE_GREEN_ID:
              this._workshopDyeGreen += count;
              break;
            default:
              break;
          }
        }
      }

      // craftedVariants 仅作兼容字段；是否已制作以 DecorationManager 解锁为准（见 hasCraftedColor）
      if (Array.isArray(data.craftedVariants)) {
        for (const key of data.craftedVariants) {
          if (typeof key === 'string' && parseWorkshopVariantKey(key)) {
            this._craftedVariants.add(key);
          }
        }
      }

      if (Array.isArray(data.craftedRecipeIds)) {
        const legacyMap: Record<string, string> = {
          recipe_workshop_plush_green_sofa: makeWorkshopVariantKey('blueprint_workshop_plush_green_sofa', 'default'),
          recipe_workshop_plush_sofa_sakura: makeWorkshopVariantKey('blueprint_workshop_plush_green_sofa', 'sakura'),
          recipe_workshop_plush_sofa_blue: makeWorkshopVariantKey('blueprint_workshop_plush_green_sofa', 'blue'),
        };
        for (const id of data.craftedRecipeIds) {
          if (typeof id === 'string' && legacyMap[id]) this._craftedVariants.add(legacyMap[id]);
        }
      }

      // 读档后立即按当前家具解锁纠偏，避免旧号本地残留挡住新号制作
      this._syncCraftedVariantsFromDecorations();

      if (Array.isArray(data.newBlueprintIds)) {
        const seen = new Set<string>();
        this._newBlueprintIds = [];
        for (const id of data.newBlueprintIds) {
          if (typeof id !== 'string' || seen.has(id)) continue;
          if (!this._blueprints.has(id) || !WORKSHOP_BLUEPRINT_MAP.has(id)) continue;
          seen.add(id);
          this._newBlueprintIds.push(id);
        }
      }
      this._pruneNewBlueprintIds();

      if (data.shopCatalogSeenBootstrapped === true && Array.isArray(data.seenShopBlueprintIds)) {
        this._shopCatalogSeenBootstrapped = true;
        this._seenShopBlueprintIds.clear();
        for (const id of data.seenShopBlueprintIds) {
          if (typeof id === 'string' && WORKSHOP_BLUEPRINT_MAP.has(id)) {
            this._seenShopBlueprintIds.add(id);
          }
        }
      } else {
        this._shopCatalogSeenBootstrapped = false;
        this._seenShopBlueprintIds.clear();
      }

      this._shopCatalogSeenMigration =
        typeof data.shopCatalogSeenMigration === 'number' && data.shopCatalogSeenMigration > 0
          ? data.shopCatalogSeenMigration
          : 0;

    } catch (e) {
      console.warn('[FurnitureWorkshop] 加载失败:', e);
    }
  }

  private _save(): void {
    try {
      PersistService.writeRaw(FURNITURE_WORKSHOP_SAVE_KEY, JSON.stringify(this.exportState()));
    } catch (e) {
      console.warn('[FurnitureWorkshop] 保存失败:', e);
    }
  }
}

export const FurnitureWorkshopManager = new FurnitureWorkshopManagerClass();
