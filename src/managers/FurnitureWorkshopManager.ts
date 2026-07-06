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
  makeWorkshopVariantKey,
  parseWorkshopVariantKey,
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
}

export interface WorkshopCraftCheck {
  ok: boolean;
  reason?: 'missing_blueprint' | 'already_crafted' | 'locked' | 'missing_material' | 'missing_dye' | 'not_enough_huayuan';
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
  private _initialized = false;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._load();
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
    this._load();
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

  hasCraftedColor(blueprintId: string, colorId: string): boolean {
    return this._craftedVariants.has(makeWorkshopVariantKey(blueprintId, colorId));
  }

  /** 该图纸所有配色均已制作 */
  isBlueprintFullyCrafted(blueprintId: string): boolean {
    const def = WORKSHOP_BLUEPRINT_MAP.get(blueprintId);
    if (!def || def.colorOptions.length === 0) return true;
    return def.colorOptions.every(c => this.hasCraftedColor(blueprintId, c.id));
  }

  grantBlueprint(blueprintId: string): boolean {
    if (!WORKSHOP_BLUEPRINT_MAP.has(blueprintId)) return false;
    if (this._blueprints.has(blueprintId)) return false;
    this._blueprints.add(blueprintId);
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
    if (this.hasCraftedColor(blueprintId, colorId) || DecorationManager.isUnlocked(option.outputDecoId)) {
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
    this._workshopMaterial = Math.max(0, this._workshopMaterial - option.materialCost);
    this._consumeDyeForOption(option);

    const outputDeco = DECO_MAP.get(option.outputDecoId);
    const deferStarGrant = (outputDeco?.starValue ?? 0) > 0;
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
    this._save();
    EventBus.emit('furnitureWorkshop:crafted', option.outputDecoId, { blueprintId, colorId, option });
    EventBus.emit('furnitureWorkshop:changed');
    return { ok: true };
  }

  exportState(): FurnitureWorkshopSaveData {
    return {
      blueprints: [...this._blueprints].filter(id => WORKSHOP_BLUEPRINT_MAP.has(id)),
      workshopMaterial: this._workshopMaterial,
      workshopDyePink: this._workshopDyePink,
      workshopDyeYellow: this._workshopDyeYellow,
      workshopDyeBlue: this._workshopDyeBlue,
      workshopDyeGreen: this._workshopDyeGreen,
      craftedVariants: [...this._craftedVariants],
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
