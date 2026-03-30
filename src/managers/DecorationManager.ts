/**
 * 花店装修管理器
 *
 * 管理装饰拥有（花愿购买）、当前装备、房间风格等
 * 数据持久化到 localStorage 'huahua_decoration'
 */
import { EventBus } from '@/core/EventBus';
import { CurrencyManager } from './CurrencyManager';
import { checkRequirement } from '@/utils/UnlockChecker';
import {
  DECO_DEFS, DECO_MAP, DecoSlot, DecoDef, DecoRarity,
  getSlotDecos, DECO_SLOT_INFO,
  ROOM_STYLES, ROOM_STYLE_MAP,
  getDecosForDecorationPanelTab,
  isDecoAllowedInScene,
  type DecoPanelTabId,
} from '@/config/DecorationConfig';

export interface DecoSaveData {
  /** 已解锁的装饰ID集合 */
  unlocked: string[];
  /** 当前装备：slot → decoId */
  equipped: Record<string, string>;
  /** 当前房间整体风格（对应 ROOM_STYLES） */
  roomStyleId?: string;
  /** 已解锁的房间风格 id */
  unlockedRoomStyles?: string[];
}

class DecorationManagerClass {
  /** 已解锁的装饰 ID */
  private _unlocked = new Set<string>();
  /** 当前装备：slot → decoId */
  private _equipped = new Map<string, string>();
  /** 当前房间风格 id（如 style_default） */
  private _roomStyleId = 'style_default';
  /** 已解锁的房间风格 */
  private _unlockedRoomStyles = new Set<string>();

  private _initRoomStyleDefaults(): void {
    this._roomStyleId = 'style_default';
    this._unlockedRoomStyles.clear();
    for (const s of ROOM_STYLES) {
      if (s.cost === 0 && !s.unlockRequirement) this._unlockedRoomStyles.add(s.id);
    }
  }

  /**
   * 初始化：不赠送任何家具；已拥有/装备仅来自存档。
   * 配置里「无 unlockRequirement」仅表示等级到了即可花愿购买，不等于已拥有。
   */
  init(): void {
    this._initRoomStyleDefaults();
    this._load();
    console.log(`[Decoration] 初始化: ${this._unlocked.size} 个装饰已解锁, 房间风格: ${this._roomStyleId}`);
  }

  /** TextureCache 键：当前房间背景 / 花店建筑底板图 */
  getRoomBgTextureKey(): string {
    const st = ROOM_STYLE_MAP.get(this._roomStyleId);
    return st?.bgTexture ?? 'bg_room_default';
  }

  get roomStyleId(): string {
    return this._roomStyleId;
  }

  isRoomStyleUnlocked(styleId: string): boolean {
    return this._unlockedRoomStyles.has(styleId);
  }

  /**
   * 切换房间整体风格（需已解锁）
   */
  equipRoomStyle(styleId: string): boolean {
    if (!ROOM_STYLE_MAP.has(styleId) || !this._unlockedRoomStyles.has(styleId)) return false;
    this._roomStyleId = styleId;
    this._save();
    EventBus.emit('decoration:room_style', styleId);
    return true;
  }

  /**
   * 花愿解锁付费房间风格
   */
  unlockRoomStyle(styleId: string): boolean {
    const st = ROOM_STYLE_MAP.get(styleId);
    if (!st || this._unlockedRoomStyles.has(styleId)) return false;
    const req = checkRequirement(st.unlockRequirement);
    if (!req.met) return false;
    if (st.cost > 0 && CurrencyManager.state.huayuan < st.cost) return false;
    if (st.cost > 0) {
      CurrencyManager.addHuayuan(-st.cost);
    }
    if (st.starValue > 0) {
      CurrencyManager.addStar(st.starValue);
    }
    this._unlockedRoomStyles.add(styleId);
    this._save();
    console.log(`[Decoration] 解锁房间风格: ${st.name}${st.cost > 0 ? ` (-${st.cost}花愿)` : ''} +${st.starValue}⭐`);
    return true;
  }

  /** 是否已解锁 */
  isUnlocked(decoId: string): boolean {
    return this._unlocked.has(decoId);
  }

  /** 获取当前装备的装饰ID */
  getEquipped(slot: DecoSlot): string | null {
    return this._equipped.get(slot) || null;
  }

  /** 获取当前装备的装饰定义 */
  getEquippedDef(slot: DecoSlot): DecoDef | null {
    const id = this._equipped.get(slot);
    return id ? (DECO_MAP.get(id) || null) : null;
  }

  /** 获取已解锁数量 */
  get unlockedCount(): number {
    return this._unlocked.size;
  }

  /** 获取总装饰数量 */
  get totalCount(): number {
    return DECO_DEFS.length;
  }

  /** 获取指定槽位的解锁进度 */
  getSlotProgress(slot: DecoSlot): { unlocked: number; total: number } {
    const all = getSlotDecos(slot);
    const unlocked = all.filter(d => this._unlocked.has(d.id)).length;
    return { unlocked, total: all.length };
  }

  /** 装修面板合并 Tab（花房/家电/特殊等）的收集进度 */
  getDecorationTabProgress(tab: DecoPanelTabId, sceneId: string): { unlocked: number; total: number } {
    if (tab === 'room_styles') return { unlocked: 0, total: 0 };
    const list = getDecosForDecorationPanelTab(tab, sceneId);
    const unlocked = list.filter(d => this._unlocked.has(d.id)).length;
    return { unlocked, total: list.length };
  }

  /**
   * 花愿购买解锁装饰
   * @returns true 购买成功
   */
  unlock(decoId: string): boolean {
    if (this._unlocked.has(decoId)) return false;

    const deco = DECO_MAP.get(decoId);
    if (!deco) return false;

    if (!isDecoAllowedInScene(deco, CurrencyManager.state.sceneId)) {
      return false;
    }

    const req = checkRequirement(deco.unlockRequirement);
    if (!req.met) return false;

    if (CurrencyManager.state.huayuan < deco.cost) return false;

    CurrencyManager.addHuayuan(-deco.cost);
    if (deco.starValue > 0) {
      CurrencyManager.addStar(deco.starValue);
    }
    this._unlocked.add(decoId);
    this._save();

    console.log(`[Decoration] 解锁装饰: ${deco.name} (-${deco.cost}花愿, +${deco.starValue}⭐)`);
    EventBus.emit('decoration:unlocked', decoId, deco);
    return true;
  }

  /**
   * 已废弃：家具是否进房以 RoomLayoutManager 为准，不再维护槽位互斥装备。
   * 保留方法签名，避免外部旧代码调用时报错。
   */
  equip(decoId: string): boolean {
    return this._unlocked.has(decoId) && DECO_MAP.has(decoId);
  }

  /**
   * 获取所有已装备的装饰列表
   */
  getAllEquipped(): { slot: DecoSlot; deco: DecoDef }[] {
    const result: { slot: DecoSlot; deco: DecoDef }[] = [];
    for (const [slot, id] of this._equipped) {
      const deco = DECO_MAP.get(id);
      if (deco) result.push({ slot: slot as DecoSlot, deco });
    }
    return result;
  }

  /**
   * 获取所有已解锁的装饰定义列表
   */
  getUnlockedDecos(): DecoDef[] {
    return DECO_DEFS.filter(d => this._unlocked.has(d.id));
  }

  /**
   * 获取指定槽位已解锁的装饰列表
   */
  getUnlockedBySlot(slot: DecoSlot): DecoDef[] {
    return getSlotDecos(slot).filter(d => this._unlocked.has(d.id));
  }

  /**
   * 检查是否有可以购买但未解锁的新装饰
   */
  hasAffordableNew(): boolean {
    const huayuan = CurrencyManager.state.huayuan;
    return DECO_DEFS.some(d => {
      if (this._unlocked.has(d.id) || d.cost <= 0) return false;
      if (!checkRequirement(d.unlockRequirement).met) return false;
      return d.cost <= huayuan;
    });
  }

  // ---- 存档 ----

  private _save(): void {
    try {
      const data: DecoSaveData = {
        unlocked: [...this._unlocked],
        equipped: {},
        roomStyleId: this._roomStyleId,
        unlockedRoomStyles: [...this._unlockedRoomStyles],
      };
      const platform = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
      if (platform) {
        platform.setStorageSync('huahua_decoration', JSON.stringify(data));
      } else {
        localStorage.setItem('huahua_decoration', JSON.stringify(data));
      }
    } catch (e) {
      console.warn('[Decoration] 保存失败:', e);
    }
  }

  private _load(): void {
    try {
      const platform = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
      let raw: string | null = null;

      if (platform) {
        raw = platform.getStorageSync('huahua_decoration') || null;
      } else {
        raw = localStorage.getItem('huahua_decoration');
      }

      if (!raw) return;

      const data: DecoSaveData = JSON.parse(raw);
      if (data.unlocked) {
        for (const id of data.unlocked) {
          this._unlocked.add(id);
        }
      }
      // 旧版 equipped（槽位互斥）已废弃，不再读入，避免覆盖房间内多件同槽布局
      if (data.unlockedRoomStyles) {
        for (const id of data.unlockedRoomStyles) {
          if (ROOM_STYLE_MAP.has(id)) this._unlockedRoomStyles.add(id);
        }
      }
      if (
        data.roomStyleId
        && ROOM_STYLE_MAP.has(data.roomStyleId)
        && this._unlockedRoomStyles.has(data.roomStyleId)
      ) {
        this._roomStyleId = data.roomStyleId;
      }
    } catch (e) {
      console.warn('[Decoration] 加载失败:', e);
    }
  }

  /** 导出存档数据 */
  exportState(): DecoSaveData {
    return {
      unlocked: [...this._unlocked],
      equipped: {},
      roomStyleId: this._roomStyleId,
      unlockedRoomStyles: [...this._unlockedRoomStyles],
    };
  }

  /** 重置（GM 调试用） */
  reset(): void {
    this._unlocked.clear();
    this._equipped.clear();
    this.init();
    EventBus.emit('decoration:reset');
  }
}

export const DecorationManager = new DecorationManagerClass();
