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
  /** 条件文案（questId 未达成时的 UI 短提示，如「活动解锁」） */
  conditionText?: string;
  /** quest 未达成时点击/Toast 的完整说明；缺省与 conditionText 相同 */
  questDetailText?: string;
  /**
   * 花系图鉴（棋盘鲜花/绿植首次出现即解锁）中已记录该 itemId 才可购买/显示为可解锁。
   * 用于花房「棋盘同花」小盆栽、同名花瓶、绿植对应家具等。
   * **与 level 互斥**：凡填写本字段，checkRequirement 将**忽略** level（仅以图鉴为准，不叠扣花店等级）。
   * 与 questId 同时存在时仍为 AND（quest 先判，再判图鉴）。
   * 未解锁时卡片按钮短文案固定为「图鉴解锁」；点击说明用 detailText（具体花名等）。
   */
  flowerCollectionItemId?: string;
}

export interface RequirementResult {
  met: boolean;
  /** 卡片按钮等短文案 */
  text: string;
  /** 点击锁定项时的完整说明；缺省与 text 相同 */
  detailText?: string;
}

/** Toast / 弹层说明：有 detailText 时用 detailText（如图鉴锁的具体花名） */
export function requirementHintText(r: RequirementResult): string {
  return r.detailText ?? r.text;
}

/**
 * 装修面板：锁定家具的 Toast（短按钮文案常为「活动解锁」时需说明具体哪类活动）
 */
export function decorationLockedToastText(
  unlockReq: UnlockRequirement | undefined,
  result: RequirementResult,
): string {
  const ur = unlockReq;
  if (ur?.conditionText === '活动解锁') {
    const detail = ur.questDetailText?.trim();
    if (!detail || detail === '签到奖励') {
      return '完成当月签到任务后即可解锁（详见活动中心 · 签到）';
    }
    return detail;
  }
  if (ur?.questId) {
    return requirementHintText(result);
  }
  return requirementHintText(result);
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

  const gatedByFlowerCollection = Boolean(req.flowerCollectionItemId);
  if (
    !gatedByFlowerCollection &&
    req.level !== undefined &&
    req.level > 0 &&
    LevelManager.level < req.level
  ) {
    return { met: false, text: `Lv.${req.level} 解锁` };
  }

  if (req.questId && !_grantedQuests.has(req.questId)) {
    const text = req.conditionText || '未达成条件';
    const detail = req.questDetailText ?? text;
    return { met: false, text, detailText: detail === text ? undefined : detail };
  }

  if (req.flowerCollectionItemId) {
    const fid = req.flowerCollectionItemId;
    if (!CollectionManager.isDiscovered(CollectionCategory.FLOWER, fid)) {
      const flowerName = ITEM_DEFS.get(fid)?.name;
      const detail =
        flowerName !== undefined
          ? `图鉴：先在棋盘获得「${flowerName}」`
          : '图鉴：先在棋盘获得对应鲜花';
      return { met: false, text: '图鉴解锁', detailText: detail };
    }
  }

  return { met: true, text: '' };
}
