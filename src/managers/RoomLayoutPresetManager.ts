/**
 * 房屋布局预设：每个 sceneId 最多 3 槽；默认开放前 2 槽，第 3 槽看广告解锁。
 * 与当前生效布局（huahua_room_layout）分离存储。
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { DecorationManager } from '@/managers/DecorationManager';
import {
  RoomLayoutManager,
  type FurniturePlacement,
} from '@/managers/RoomLayoutManager';
import { DEFAULT_SCENE_ID } from '@/config/StarLevelConfig';

export const ROOM_LAYOUT_PRESETS_SAVE_KEY = 'huahua_room_layout_presets';
export const ROOM_LAYOUT_PRESET_SLOT_COUNT = 3;
/** 默认免费开放的槽位数（0-based 下标 < FREE） */
export const ROOM_LAYOUT_PRESET_FREE_SLOTS = 2;

export interface RoomLayoutPresetSlot {
  savedAt: number;
  placements: FurniturePlacement[];
  ownerPos?: { x: number; y: number };
  /** 保存时的房壳风格 id（DecorationManager.roomStyleId） */
  roomStyleId?: string;
  /** 可选小图 dataURL；无则面板用家具图标拼贴 */
  thumb?: string;
}

interface ScenePresetData {
  slot3Unlocked: boolean;
  slots: Array<RoomLayoutPresetSlot | null>;
}

interface RoomLayoutPresetsSave {
  version: 1;
  scenes: Record<string, ScenePresetData>;
}

function emptySlots(): Array<RoomLayoutPresetSlot | null> {
  return [null, null, null];
}

function emptyScene(): ScenePresetData {
  return { slot3Unlocked: false, slots: emptySlots() };
}

class RoomLayoutPresetManagerClass {
  private _scenes: Record<string, ScenePresetData> = {};
  private _initialized = false;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._load();
    EventBus.on('decoration:reset', this._onDecoReset);
    console.log(
      `[RoomLayoutPreset] 初始化 scenes=${Object.keys(this._scenes).length}`,
    );
  }

  reloadFromStorage(): void {
    if (!this._initialized) {
      this.init();
      return;
    }
    this._load();
    EventBus.emit('roomlayoutPreset:changed');
  }

  private readonly _onDecoReset = (): void => {
    this._scenes = {};
    this._save();
    EventBus.emit('roomlayoutPreset:changed');
  };

  private _sceneId(): string {
    return CurrencyManager.state.sceneId || DEFAULT_SCENE_ID;
  }

  private _ensureScene(sceneId: string): ScenePresetData {
    if (!this._scenes[sceneId]) {
      this._scenes[sceneId] = emptyScene();
    }
    const data = this._scenes[sceneId];
    if (!Array.isArray(data.slots) || data.slots.length !== ROOM_LAYOUT_PRESET_SLOT_COUNT) {
      const next = emptySlots();
      for (let i = 0; i < ROOM_LAYOUT_PRESET_SLOT_COUNT; i++) {
        next[i] = data.slots?.[i] ?? null;
      }
      data.slots = next;
    }
    data.slot3Unlocked = !!data.slot3Unlocked;
    return data;
  }

  isSlotUnlocked(slotIndex: number, sceneId?: string): boolean {
    if (slotIndex < 0 || slotIndex >= ROOM_LAYOUT_PRESET_SLOT_COUNT) return false;
    if (slotIndex < ROOM_LAYOUT_PRESET_FREE_SLOTS) return true;
    const data = this._ensureScene(sceneId ?? this._sceneId());
    return data.slot3Unlocked;
  }

  isSlot3Unlocked(sceneId?: string): boolean {
    return this.isSlotUnlocked(2, sceneId);
  }

  unlockSlot3(sceneId?: string): boolean {
    const sid = sceneId ?? this._sceneId();
    const data = this._ensureScene(sid);
    if (data.slot3Unlocked) return true;
    data.slot3Unlocked = true;
    this._save();
    EventBus.emit('roomlayoutPreset:changed');
    return true;
  }

  getSlot(slotIndex: number, sceneId?: string): RoomLayoutPresetSlot | null {
    if (slotIndex < 0 || slotIndex >= ROOM_LAYOUT_PRESET_SLOT_COUNT) return null;
    const data = this._ensureScene(sceneId ?? this._sceneId());
    return data.slots[slotIndex] ?? null;
  }

  getSlots(sceneId?: string): Array<RoomLayoutPresetSlot | null> {
    return this._ensureScene(sceneId ?? this._sceneId()).slots.slice();
  }

  /**
   * 将当前房间布局写入指定槽。
   * @returns false 表示槽未解锁或当前无家具
   */
  saveCurrentLayoutToSlot(
    slotIndex: number,
    opts?: { thumb?: string; sceneId?: string },
  ): boolean {
    if (!this.isSlotUnlocked(slotIndex, opts?.sceneId)) return false;
    RoomLayoutManager.saveNow();
    const layout = RoomLayoutManager.getLayout();
    if (layout.length <= 0) return false;

    const sid = opts?.sceneId ?? this._sceneId();
    const data = this._ensureScene(sid);
    const owner = RoomLayoutManager.ownerPos;
    data.slots[slotIndex] = {
      savedAt: Date.now(),
      placements: layout.map(p => ({ ...p })),
      ownerPos: owner ? { ...owner } : undefined,
      roomStyleId: DecorationManager.roomStyleId,
      thumb: typeof opts?.thumb === 'string' && opts.thumb ? opts.thumb : undefined,
    };
    this._save();
    EventBus.emit('roomlayoutPreset:changed');
    return true;
  }

  clearSlot(slotIndex: number, sceneId?: string): boolean {
    if (slotIndex < 0 || slotIndex >= ROOM_LAYOUT_PRESET_SLOT_COUNT) return false;
    if (!this.isSlotUnlocked(slotIndex, sceneId)) return false;
    const data = this._ensureScene(sceneId ?? this._sceneId());
    if (!data.slots[slotIndex]) return false;
    data.slots[slotIndex] = null;
    this._save();
    EventBus.emit('roomlayoutPreset:changed');
    return true;
  }

  /**
   * 将槽位预设应用到当前房间（整房替换）。
   * @returns null 表示槽空或未解锁
   */
  applySlotToCurrentRoom(
    slotIndex: number,
    sceneId?: string,
  ): { placed: number; skipped: number; roomStyleApplied: boolean } | null {
    if (!this.isSlotUnlocked(slotIndex, sceneId)) return null;
    const slot = this.getSlot(slotIndex, sceneId);
    if (!slot || slot.placements.length <= 0) return null;

    let roomStyleApplied = false;
    if (typeof slot.roomStyleId === 'string' && slot.roomStyleId) {
      // 未解锁或本场景不允许时 equip 会失败，保持当前房壳
      roomStyleApplied = DecorationManager.equipRoomStyle(slot.roomStyleId);
    }

    const layoutResult = RoomLayoutManager.replaceCurrentSceneLayout(
      slot.placements,
      slot.ownerPos ?? null,
    );
    return { ...layoutResult, roomStyleApplied };
  }

  private _load(): void {
    try {
      const raw = PersistService.readRaw(ROOM_LAYOUT_PRESETS_SAVE_KEY);
      if (!raw) {
        this._scenes = {};
        return;
      }
      const data = JSON.parse(raw) as RoomLayoutPresetsSave;
      if (!data || data.version !== 1 || !data.scenes || typeof data.scenes !== 'object') {
        this._scenes = {};
        return;
      }
      const merged: Record<string, ScenePresetData> = {};
      for (const [sid, bucket] of Object.entries(data.scenes)) {
        const slots = emptySlots();
        const src = Array.isArray(bucket?.slots) ? bucket.slots : [];
        for (let i = 0; i < ROOM_LAYOUT_PRESET_SLOT_COUNT; i++) {
          const s = src[i];
          if (!s || !Array.isArray(s.placements) || s.placements.length <= 0) {
            slots[i] = null;
            continue;
          }
          slots[i] = {
            savedAt: typeof s.savedAt === 'number' ? s.savedAt : Date.now(),
            placements: s.placements.map(p => ({ ...p })),
            ownerPos: s.ownerPos ? { ...s.ownerPos } : undefined,
            roomStyleId: typeof s.roomStyleId === 'string' ? s.roomStyleId : undefined,
            thumb: typeof s.thumb === 'string' ? s.thumb : undefined,
          };
        }
        merged[sid] = {
          slot3Unlocked: !!bucket?.slot3Unlocked,
          slots,
        };
      }
      this._scenes = merged;
    } catch (e) {
      console.warn('[RoomLayoutPreset] load failed', e);
      this._scenes = {};
    }
  }

  private _save(): void {
    const payload: RoomLayoutPresetsSave = {
      version: 1,
      scenes: {},
    };
    for (const [sid, bucket] of Object.entries(this._scenes)) {
      payload.scenes[sid] = {
        slot3Unlocked: !!bucket.slot3Unlocked,
        slots: bucket.slots.map(s =>
          s
            ? {
                savedAt: s.savedAt,
                placements: s.placements.map(p => ({ ...p })),
                ownerPos: s.ownerPos ? { ...s.ownerPos } : undefined,
                roomStyleId: s.roomStyleId,
                thumb: s.thumb,
              }
            : null,
        ),
      };
    }
    try {
      PersistService.writeRaw(ROOM_LAYOUT_PRESETS_SAVE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('[RoomLayoutPreset] save failed', e);
    }
  }
}

export const RoomLayoutPresetManager = new RoomLayoutPresetManagerClass();
