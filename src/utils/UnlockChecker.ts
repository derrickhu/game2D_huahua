/**
 * 通用解锁条件系统
 *
 * 支持：花店等级门槛、自定义条件（成就/活动 questId）、花系图鉴、预留扩展
 * 家具 / 换装 / 房间风格共用同一套 UnlockRequirement 结构
 */
import { LevelManager } from '@/managers/LevelManager';
import { CollectionManager, CollectionCategory } from '@/managers/CollectionManager';
import { ITEM_DEFS } from '@/config/ItemConfig';

export interface UnlockRequirement {
  /** 花店等级 >= level 才可解锁 */
  level?: number;
  /** 自定义条件 id（由外部系统通过 grantQuest 标记为已达成） */
  questId?: string;
  /** 条件文案（questId / 图鉴等的 UI 兜底显示） */
  conditionText?: string;
  /**
   * 花系图鉴（棋盘鲜花首次出现即解锁）中已记录该 itemId 才可购买/显示为可解锁。
   * 用于花房「棋盘同花」小盆栽等；与 level / questId 同时存在时为 AND。
   */
  flowerCollectionItemId?: string;
}

export interface RequirementResult {
  met: boolean;
  text: string;
}

const _grantedQuests = new Set<string>();

export function grantQuest(questId: string): void {
  _grantedQuests.add(questId);
}

export function isQuestGranted(questId: string): boolean {
  return _grantedQuests.has(questId);
}

export function checkRequirement(req?: UnlockRequirement): RequirementResult {
  if (!req) return { met: true, text: '' };

  if (req.level !== undefined && req.level > 0 && LevelManager.level < req.level) {
    return { met: false, text: `Lv.${req.level} 解锁` };
  }

  if (req.questId && !_grantedQuests.has(req.questId)) {
    return { met: false, text: req.conditionText || '未达成条件' };
  }

  if (req.flowerCollectionItemId) {
    const fid = req.flowerCollectionItemId;
    if (!CollectionManager.isDiscovered(CollectionCategory.FLOWER, fid)) {
      const flowerName = ITEM_DEFS.get(fid)?.name;
      const fallback =
        flowerName !== undefined
          ? `图鉴：先在棋盘获得「${flowerName}」`
          : '图鉴：先在棋盘获得对应鲜花';
      return { met: false, text: req.conditionText || fallback };
    }
  }

  return { met: true, text: '' };
}
