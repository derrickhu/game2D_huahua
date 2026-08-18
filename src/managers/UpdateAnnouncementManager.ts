/**
 * 更新公告：按公告 id 只展示一次（PersistService 独立 key）。
 */
import { PersistService } from '@/core/PersistService';
import {
  UPDATE_ANNOUNCEMENT_ACTIVE,
  UPDATE_ANNOUNCEMENT_STORAGE_KEY,
  type UpdateAnnouncementDef,
} from '@/config/UpdateAnnouncementConfig';
import { TutorialManager } from '@/managers/TutorialManager';

interface UpdateAnnouncementState {
  seenId?: string;
}

class UpdateAnnouncementManagerClass {
  get active(): UpdateAnnouncementDef | null {
    const a = UPDATE_ANNOUNCEMENT_ACTIVE;
    if (!a.enabled) return null;
    if (!a.id || !a.sections?.length) return null;
    return a;
  }

  /** 教程未完成时不弹；已看过当前 id 不弹 */
  shouldShow(): boolean {
    if (TutorialManager.isActive) return false;
    const active = this.active;
    if (!active) return false;
    return this.getSeenId() !== active.id;
  }

  getSeenId(): string {
    return this._load().seenId ?? '';
  }

  markSeen(id?: string): void {
    const target = id ?? this.active?.id;
    if (!target) return;
    PersistService.writeJSON(UPDATE_ANNOUNCEMENT_STORAGE_KEY, {
      seenId: target,
    } satisfies UpdateAnnouncementState);
  }

  /** GM：清除已读，便于重测进场弹窗 */
  clearSeen(): void {
    PersistService.remove(UPDATE_ANNOUNCEMENT_STORAGE_KEY);
  }

  private _load(): UpdateAnnouncementState {
    const raw = PersistService.readJSON<UpdateAnnouncementState>(UPDATE_ANNOUNCEMENT_STORAGE_KEY);
    if (!raw || typeof raw.seenId !== 'string') return {};
    return { seenId: raw.seenId };
  }
}

export const UpdateAnnouncementManager = new UpdateAnnouncementManagerClass();
