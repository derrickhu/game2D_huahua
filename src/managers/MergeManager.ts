/**
 * 合成管理器 - 处理拖拽合成的高级逻辑（含跨格合成）
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TutorialInteractionGuard } from '@/systems/TutorialInteractionGuard';

/** 拖拽松手后的结算结果（供 BoardView 反馈动画与 Toast） */
export type MergeEndDragResult =
  | { kind: 'merged' | 'moved' | 'swapped' | 'cancelled' }
  | { kind: 'lucky_coin'; direction: 'up' | 'down' }
  | { kind: 'lucky_coin_fail'; toast: string }
  | { kind: 'crystal_ball_confirm'; srcIndex: number; dstIndex: number; newId: string }
  | { kind: 'golden_scissors_confirm'; srcIndex: number; dstIndex: number; splitId: string }
  | { kind: 'special_consumable_fail'; toast: string };

class MergeManagerClass {
  /** 当前正在拖拽的格子索引 */
  draggingIndex: number = -1;

  startDrag(cellIndex: number): boolean {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell || !cell.itemId || cell.state !== 'open') return false;
    if (!TutorialInteractionGuard.canStartDrag(cellIndex)) {
      TutorialInteractionGuard.notifyInvalidAction();
      return false;
    }
    this.draggingIndex = cellIndex;
    EventBus.emit('merge:dragStart', cellIndex);
    return true;
  }

  /** 拖拽结束，判定幸运金币、合成（含跨格）、互换、或移入空格 */
  endDrag(targetIndex: number): MergeEndDragResult {
    if (this.draggingIndex < 0) return { kind: 'cancelled' };
    const srcIndex = this.draggingIndex;
    this.draggingIndex = -1;

    if (srcIndex === targetIndex) {
      EventBus.emit('merge:dragCancel', srcIndex);
      return { kind: 'cancelled' };
    }

    if (!TutorialInteractionGuard.validateDrag(srcIndex, targetIndex)) {
      EventBus.emit('merge:dragCancel', srcIndex);
      return { kind: 'cancelled' };
    }

    const lucky = BoardManager.tryApplyLuckyCoin(srcIndex, targetIndex);
    if (lucky.kind === 'ok') {
      console.log(`[Merge] 幸运金币: ${lucky.direction === 'up' ? '升级' : '降级'} → ${ITEM_DEFS.get(lucky.newId)?.name}`);
      return { kind: 'lucky_coin', direction: lucky.direction };
    }
    if (lucky.kind === 'fail') {
      EventBus.emit('merge:dragCancel', srcIndex);
      return { kind: 'lucky_coin_fail', toast: lucky.toast };
    }

    const crystalPrev = BoardManager.previewCrystalBallApply(srcIndex, targetIndex);
    if (crystalPrev.kind === 'ok') {
      return { kind: 'crystal_ball_confirm', srcIndex, dstIndex: targetIndex, newId: crystalPrev.newId };
    }
    if (crystalPrev.kind === 'fail') {
      EventBus.emit('merge:dragCancel', srcIndex);
      return { kind: 'special_consumable_fail', toast: crystalPrev.toast };
    }

    const scissorsPrev = BoardManager.previewGoldenScissorsApply(srcIndex, targetIndex);
    if (scissorsPrev.kind === 'ok') {
      return {
        kind: 'golden_scissors_confirm',
        srcIndex,
        dstIndex: targetIndex,
        splitId: scissorsPrev.splitId,
      };
    }
    if (scissorsPrev.kind === 'fail') {
      EventBus.emit('merge:dragCancel', srcIndex);
      return { kind: 'special_consumable_fail', toast: scissorsPrev.toast };
    }

    // 尝试合成（BoardManager.canMerge 已支持 PEEK 跨格合成）
    if (BoardManager.canMerge(srcIndex, targetIndex)) {
      const dstBefore = BoardManager.getCellByIndex(targetIndex);
      const srcBefore = BoardManager.getCellByIndex(srcIndex);
      const peekInvolved =
        dstBefore?.state === 'peek' || srcBefore?.state === 'peek';
      const resultId = BoardManager.doMerge(srcIndex, targetIndex);
      if (resultId) {
        const def = ITEM_DEFS.get(resultId);
        const mergeType = peekInvolved ? '跨格合成' : '合成';
        console.log(`[Merge] ${mergeType}成功: ${def?.name} (Lv.${def?.level})`);
        return { kind: 'merged' };
      }
    }

    // 目标格有物品且不能合成：两格互换
    if (BoardManager.swapItems(srcIndex, targetIndex)) {
      return { kind: 'swapped' };
    }

    // 尝试移动到空格
    if (BoardManager.moveItem(srcIndex, targetIndex)) {
      return { kind: 'moved' };
    }

    EventBus.emit('merge:dragCancel', srcIndex);
    return { kind: 'cancelled' };
  }

  cancelDrag(): void {
    if (this.draggingIndex >= 0) {
      EventBus.emit('merge:dragCancel', this.draggingIndex);
      this.draggingIndex = -1;
    }
  }
}

export const MergeManager = new MergeManagerClass();
