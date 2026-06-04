/**
 * 合成页「升级/活动奖励在奖励篮」软提醒：首次升到 2 级后回到合成页提示一次。
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { REWARD_BOX_HINT_TRIGGER_LEVEL } from '@/config/RewardBoxHintConfig';
import { LevelManager } from '@/managers/LevelManager';
import { RewardBoxManager } from '@/managers/RewardBoxManager';

const STORAGE_KEY = 'huahua_reward_box_hint';

interface RewardBoxHintSave {
  dismissed?: boolean;
  /** 已升到目标星级，等待下次进入合成页展示 */
  pendingMainReturn?: boolean;
}

class RewardBoxHintManagerClass {
  private _dismissed = false;
  private _pendingMainReturn = false;
  private _loaded = false;
  private _inited = false;

  init(): void {
    if (this._inited) return;
    this._inited = true;
    this._ensureLoaded();
    EventBus.on('level:up', (level: number, _reward: unknown, oldLevel?: number) => {
      const prev = typeof oldLevel === 'number' ? oldLevel : level - 1;
      if (level >= REWARD_BOX_HINT_TRIGGER_LEVEL && prev < REWARD_BOX_HINT_TRIGGER_LEVEL) {
        this._markPendingMainReturn();
      }
    });
    EventBus.on('rewardBox:changed', () => {
      this._ensureLoaded();
      if (this._dismissed) return;
      if (LevelManager.level < REWARD_BOX_HINT_TRIGGER_LEVEL) return;
      if (RewardBoxManager.totalCount <= 0) return;
      if (!this._pendingMainReturn) this._markPendingMainReturn();
    });
  }

  private _ensureLoaded(): void {
    if (this._loaded) return;
    try {
      const raw = PersistService.readRaw(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as RewardBoxHintSave;
        this._dismissed = !!data.dismissed;
        this._pendingMainReturn = !!data.pendingMainReturn;
      }
    } catch {
      this._dismissed = false;
      this._pendingMainReturn = false;
    }
    this._loaded = true;
  }

  private _save(): void {
    PersistService.writeRaw(
      STORAGE_KEY,
      JSON.stringify({
        dismissed: this._dismissed,
        pendingMainReturn: this._pendingMainReturn,
      } satisfies RewardBoxHintSave),
    );
  }

  private _markPendingMainReturn(): void {
    this._ensureLoaded();
    if (this._dismissed) return;
    this._pendingMainReturn = true;
    this._save();
    EventBus.emit('rewardBoxHint:pending');
  }

  /** 合成页 onEnter：补打 pending 并通知主场景尝试弹出 */
  onMainSceneEnter(): void {
    this._ensureLoaded();
    if (this._dismissed) return;
    if (LevelManager.level < REWARD_BOX_HINT_TRIGGER_LEVEL) return;
    if (!this._pendingMainReturn && RewardBoxManager.totalCount > 0) {
      this._pendingMainReturn = true;
      this._save();
    }
    if (!this._pendingMainReturn) return;
    EventBus.emit('rewardBoxHint:pending');
  }

  /** 是否满足弹出条件（不含 UI 互斥） */
  shouldPrompt(): boolean {
    this._ensureLoaded();
    if (this._dismissed) return false;
    if (LevelManager.level < REWARD_BOX_HINT_TRIGGER_LEVEL) return false;
    if (this._pendingMainReturn) return true;
    // 兜底：已达触发等级且篮内有待领物品（pending 漏标或冷启动未调度时仍可提示一次）
    return RewardBoxManager.totalCount > 0;
  }

  markDismissed(): void {
    this._ensureLoaded();
    this._dismissed = true;
    this._pendingMainReturn = false;
    this._save();
  }

  /** GM / 调试 */
  resetDismissed(): void {
    this._dismissed = false;
    this._pendingMainReturn = false;
    this._loaded = true;
    this._save();
  }
}

export const RewardBoxHintManager = new RewardBoxHintManagerClass();
