/**
 * 花店房间布局管理器
 *
 * 管理花店内家具的自由摆放位置数据（x/y/scale/flipped）。
 * 与 DecorationManager 职责分离：
 *   - DecorationManager：管理装饰的 解锁/装备 状态
 *   - RoomLayoutManager：管理已放置到房间中的家具 空间布局
 * 二者通过 decoId 关联。
 *
 * 数据持久化到 'huahua_room_layout'
 */

import { EventBus } from '@/core/EventBus';
import { DECO_MAP, DecoSlot, isDecoAllowedInScene } from '@/config/DecorationConfig';
import { ROOM_DEPTH_AUX_MAX } from '@/config/RoomDepthSort';
import { CurrencyManager } from './CurrencyManager';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from '@/config/Constants';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const SAVE_KEY = 'huahua_room_layout';

/** 存档版本：2 = 家具贴图统一折半后，placement.scale 语义与 v1 对齐（见 _load 迁移） */
const LAYOUT_SAVE_VERSION = 2;

/** placement.scale 合法区间（小贴图 defaultScale 可低于 0.5） */
const PLACEMENT_SCALE_MIN = 0.1;
const PLACEMENT_SCALE_MAX = 2;

function clampPlacementScale(s: number): number {
  return Math.max(PLACEMENT_SCALE_MIN, Math.min(PLACEMENT_SCALE_MAX, s));
}

// ---- 数据结构 ----

export interface FurniturePlacement {
  /** 对应 DecorationConfig 中的装饰 ID */
  decoId: string;
  /** 设计坐标 x（基于 750×1334 设计分辨率） */
  x: number;
  /** 设计坐标 y */
  y: number;
  /** 缩放系数（约 0.1~2.0，与贴图分辨率配套） */
  scale: number;
  /** 是否水平翻转 */
  flipped: boolean;
  /** 图层偏移（默认 0，正数=置前/更靠前，负数=置后） */
  zLayer?: number;
  /**
   * 手动深度前移累加（与 getDepthSortTypeLift 相加后参与排序，有上限，见 RoomDepthSort）。
   * 「图层前移」会增大此值，解决同格 y 下 zLayer 权重不足以压过桌子的问题。
   */
  depthManualBias?: number;
}

export interface RoomLayoutSave {
  version: number;
  placements: FurniturePlacement[];
  ownerPos?: { x: number; y: number };
}

// ---- 默认摆放位置（槽位 → 初始位置） ----
// 基于 shop.png 2.5D 花店的开放式室内区域

const DEFAULT_POSITIONS: Record<string, { x: number; y: number; scale: number }> = {
  [DecoSlot.SHELF]:    { x: 180, y: 520, scale: 0.45 },
  [DecoSlot.TABLE]:    { x: 375, y: 620, scale: 0.425 },
  [DecoSlot.LIGHT]:    { x: 400, y: 380, scale: 0.35 },
  [DecoSlot.ORNAMENT]: { x: 560, y: 560, scale: 0.4 },
  [DecoSlot.WALLART]:  { x: 260, y: 420, scale: 0.325 },
  [DecoSlot.GARDEN]:   { x: 200, y: 780, scale: 0.425 },
};

// ---- 房间可摆放区域边界 (设计坐标) ----
// 默认值（非编辑模式 / 初始值），编辑模式下由 ShopScene 动态更新
const ROOM_BOUNDS = {
  minX: 50,
  maxX: 700,
  minY: 280,
  maxY: 800,
};

// ---- 管理器实现 ----

class RoomLayoutManagerClass {
  private _placements: FurniturePlacement[] = [];
  private _ownerPos: { x: number; y: number } | null = null;
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private _initialized = false;

  /**
   * 初始化：加载存档；若无存档则房间为空（家具需在花店装修模式中从托盘拖入摆放）
   */
  init(): void {
    if (this._initialized) return;
    this._initialized = true;

    const loaded = this._load();
    if (!loaded) {
      this._generateEmptyLayout();
    }

    EventBus.on('decoration:reset', this._onDecoReset.bind(this));

    console.log(`[RoomLayout] 初始化: ${this._placements.length} 件家具已放置`);
  }

  // ---- 查询 ----

  /** 获取所有家具摆放数据（只读副本） */
  getLayout(): ReadonlyArray<FurniturePlacement> {
    return this._placements;
  }

  /** 获取指定装饰的摆放数据 */
  getPlacement(decoId: string): FurniturePlacement | undefined {
    return this._placements.find(p => p.decoId === decoId);
  }

  /** 房间内家具数量 */
  get count(): number {
    return this._placements.length;
  }

  /** 获取店主位置（null 则使用默认） */
  get ownerPos(): { x: number; y: number } | null {
    return this._ownerPos;
  }

  /** 更新店主位置 */
  setOwnerPos(x: number, y: number): void {
    this._ownerPos = { x, y };
    this._debounceSave();
  }

  /** 房间可摆放区域 */
  get bounds() {
    return { ...ROOM_BOUNDS };
  }

  /**
   * 动态更新可摆放区域边界
   * 编辑模式下由 ShopScene 根据实际 UI 布局调用
   */
  updateBounds(partial: Partial<typeof ROOM_BOUNDS>): void {
    if (partial.minX !== undefined) ROOM_BOUNDS.minX = partial.minX;
    if (partial.maxX !== undefined) ROOM_BOUNDS.maxX = partial.maxX;
    if (partial.minY !== undefined) ROOM_BOUNDS.minY = partial.minY;
    if (partial.maxY !== undefined) ROOM_BOUNDS.maxY = partial.maxY;
    console.log(`[RoomLayout] bounds 已更新: minX=${ROOM_BOUNDS.minX}, maxX=${ROOM_BOUNDS.maxX}, minY=${ROOM_BOUNDS.minY}, maxY=${ROOM_BOUNDS.maxY}`);
  }

  // ---- 操作 ----

  /**
   * 添加家具到房间
   * @param decoId 装饰ID
   * @param x 设计坐标 x
   * @param y 设计坐标 y
   * @param scale 缩放
   * @param flipped 是否翻转
   * @returns 添加后的 FurniturePlacement，如已存在返回 null
   */
  addFurniture(
    decoId: string,
    x?: number,
    y?: number,
    scale?: number,
    flipped?: boolean,
  ): FurniturePlacement | null {
    // 不允许重复添加同一装饰
    if (this._placements.some(p => p.decoId === decoId)) {
      console.warn(`[RoomLayout] 装饰 ${decoId} 已存在于房间中`);
      return null;
    }

    const deco = DECO_MAP.get(decoId);
    if (!deco) return null;

    if (!isDecoAllowedInScene(deco, CurrencyManager.state.sceneId)) {
      console.warn(`[RoomLayout] 装饰 ${decoId} 不可在当前场景摆放`);
      return null;
    }

    // 默认位置
    const defaults = DEFAULT_POSITIONS[deco.slot] || { x: 375, y: 550, scale: 0.4 };
    // 新放入的家具：zLayer 比当前房间里任意一件 +1（封顶），同脚点 Y 附近后放的略靠前。
    // 深度排序以 Y 为主（RoomDepthSort），zLayer 权重远小于 Y 台阶，不会压过人物。
    const maxZExisting = this._placements.reduce(
      (m, p) => Math.max(m, p.zLayer ?? 0),
      -1,
    );
    const zLayerForNew = Math.min(8, maxZExisting + 1);

    const placement: FurniturePlacement = {
      decoId,
      x: this._clampX(x ?? defaults.x),
      y: this._clampY(y ?? defaults.y),
      scale: clampPlacementScale(scale ?? deco.defaultScale ?? defaults.scale),
      flipped: flipped ?? false,
      zLayer: zLayerForNew,
      depthManualBias: 0,
    };

    this._placements.push(placement);
    this._debounceSave();

    EventBus.emit('roomlayout:added', placement);
    console.log(`[RoomLayout] 添加: ${deco.name} @(${placement.x}, ${placement.y})`);
    return placement;
  }

  /**
   * 从房间中移除家具
   * @returns 被移除的 placement，不存在返回 null
   */
  removeFurniture(decoId: string): FurniturePlacement | null {
    const idx = this._placements.findIndex(p => p.decoId === decoId);
    if (idx === -1) return null;

    const [removed] = this._placements.splice(idx, 1);
    this._debounceSave();

    EventBus.emit('roomlayout:removed', removed);
    console.log(`[RoomLayout] 移除: ${decoId}`);
    return removed;
  }

  /**
   * 移动家具位置
   */
  moveFurniture(decoId: string, x: number, y: number): boolean {
    const p = this._placements.find(p => p.decoId === decoId);
    if (!p) return false;

    p.x = this._clampX(x);
    p.y = this._clampY(y);
    this._debounceSave();

    EventBus.emit('roomlayout:moved', p);
    return true;
  }

  /**
   * 更新家具缩放
   */
  scaleFurniture(decoId: string, scale: number): boolean {
    const p = this._placements.find(p => p.decoId === decoId);
    if (!p) return false;

    p.scale = clampPlacementScale(scale);
    this._debounceSave();

    EventBus.emit('roomlayout:updated', p);
    return true;
  }

  /**
   * 翻转家具
   */
  flipFurniture(decoId: string): boolean {
    const p = this._placements.find(p => p.decoId === decoId);
    if (!p) return false;

    p.flipped = !p.flipped;
    this._debounceSave();

    EventBus.emit('roomlayout:updated', p);
    return true;
  }

  /**
   * 将家具图层往前移一级（更靠近屏幕前方）
   */
  bringForward(decoId: string): boolean {
    const p = this._placements.find(p => p.decoId === decoId);
    if (!p) return false;

    const step = 100;
    p.depthManualBias = Math.min(
      ROOM_DEPTH_AUX_MAX,
      (p.depthManualBias ?? 0) + step,
    );
    p.zLayer = Math.min(8, (p.zLayer ?? 0) + 1);
    this._debounceSave();

    EventBus.emit('roomlayout:updated', p);
    console.log(
      `[RoomLayout] ${decoId} 图层前移 → zLayer=${p.zLayer} depthManualBias=${p.depthManualBias}`,
    );
    return true;
  }

  /**
   * 将家具图层往后移一级（更远离屏幕）
   */
  sendBackward(decoId: string): boolean {
    const p = this._placements.find(p => p.decoId === decoId);
    if (!p) return false;

    const step = 100;
    p.depthManualBias = Math.max(0, (p.depthManualBias ?? 0) - step);
    p.zLayer = Math.max(-5, (p.zLayer ?? 0) - 1);
    this._debounceSave();

    EventBus.emit('roomlayout:updated', p);
    console.log(
      `[RoomLayout] ${decoId} 图层后移 → zLayer=${p.zLayer} depthManualBias=${p.depthManualBias}`,
    );
    return true;
  }

  /**
   * 批量更新整个布局（用于撤销/重做）
   */
  setLayout(placements: FurniturePlacement[]): void {
    this._placements = placements.map(p => ({
      decoId: p.decoId,
      x: this._clampX(p.x),
      y: this._clampY(p.y),
      scale: clampPlacementScale(p.scale),
      flipped: p.flipped,
      zLayer: p.zLayer ?? 0,
      depthManualBias: p.depthManualBias ?? 0,
    }));
    this._debounceSave();

    EventBus.emit('roomlayout:changed');
  }

  // ---- 存档 ----

  /** 立即保存 */
  saveNow(): void {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._save();
  }

  /** 导出布局数据 */
  exportState(): RoomLayoutSave {
    return {
      version: LAYOUT_SAVE_VERSION,
      placements: this._placements.map(p => ({ ...p })),
    };
  }

  /** 重置布局（GM 调试用）：清空房间内所有已摆放家具 */
  reset(): void {
    this._placements = [];
    this._save();
    EventBus.emit('roomlayout:changed');
    console.log('[RoomLayout] 已清空房间布局');
  }

  // ---- 私有方法 ----

  /** 无存档时的初始布局：空房间 */
  private _generateEmptyLayout(): void {
    this._placements = [];
    this._save();
  }

  /** 装饰数据重置时重建布局 */
  private _onDecoReset(): void {
    this.reset();
  }

  /** 防抖保存（500ms） */
  private _debounceSave(): void {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._save();
    }, 500);
  }

  private _save(): void {
    try {
      const data: RoomLayoutSave = {
        version: LAYOUT_SAVE_VERSION,
        placements: this._placements,
        ownerPos: this._ownerPos ?? undefined,
      };
      const json = JSON.stringify(data);
      if (_api) {
        _api.setStorageSync(SAVE_KEY, json);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SAVE_KEY, json);
      }
    } catch (e) {
      console.warn('[RoomLayout] 保存失败:', e);
    }
  }

  private _load(): boolean {
    try {
      let raw: string | null = null;
      if (_api) {
        raw = _api.getStorageSync(SAVE_KEY) || null;
      } else if (typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(SAVE_KEY);
      }

      if (!raw) return false;

      const data: RoomLayoutSave = JSON.parse(raw);
      if (!data.placements || !Array.isArray(data.placements)) return false;

      const fileVersion = data.version ?? 1;
      const needsScaleMigration = fileVersion < LAYOUT_SAVE_VERSION;

      // 加载店主位置
      if (data.ownerPos && typeof data.ownerPos.x === 'number') {
        this._ownerPos = { x: data.ownerPos.x, y: data.ownerPos.y };
      }

      // 验证并过滤无效数据（装饰不存在或未解锁的跳过）
      let rows = data.placements.filter(p => {
        const deco = DECO_MAP.get(p.decoId);
        if (!deco) {
          console.warn(`[RoomLayout] 跳过无效装饰: ${p.decoId}`);
          return false;
        }
        return true;
      });

      if (needsScaleMigration) {
        // 贴图折半后 min(130/w,130/h) 翻倍，旧存档 scale 乘 0.5 维持屏上大小
        rows = rows.map(p => ({
          ...p,
          scale: (typeof p.scale === 'number' ? p.scale : 1) * 0.5,
        }));
        console.log('[RoomLayout] 存档 v1→v2：已按贴图折半迁移 placement.scale');
      }

      this._placements = rows.map(p => ({
        decoId: p.decoId,
        x: p.x,
        y: p.y,
        scale: clampPlacementScale(p.scale ?? 1),
        flipped: !!p.flipped,
        zLayer: p.zLayer ?? 0,
        depthManualBias: typeof p.depthManualBias === 'number' ? p.depthManualBias : 0,
      }));

      if (needsScaleMigration) {
        this._save();
      }

      return true;
    } catch (e) {
      console.warn('[RoomLayout] 加载失败:', e);
      return false;
    }
  }

  /** 限制 x 在房间范围内 */
  private _clampX(x: number): number {
    return Math.max(ROOM_BOUNDS.minX, Math.min(ROOM_BOUNDS.maxX, x));
  }

  /** 限制 y 在房间范围内 */
  private _clampY(y: number): number {
    return Math.max(ROOM_BOUNDS.minY, Math.min(ROOM_BOUNDS.maxY, y));
  }
}

export const RoomLayoutManager = new RoomLayoutManagerClass();
