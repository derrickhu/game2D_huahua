/**
 * 合成管理器 - 处理拖拽合成的高级逻辑
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { ITEM_DEFS } from '@/config/ItemConfig';

class MergeManagerClass {
  /** 当前正在拖拽的格子索引 */
  draggingIndex: number = -1;

  startDrag(cellIndex: number): boolean {
    const cell = BoardManager.getCellByIndex(cellIndex);
    if (!cell || !cell.itemId || cell.state !== 'open') return false;
    this.draggingIndex = cellIndex;
    EventBus.emit('merge:dragStart', cellIndex);
    return true;
  }

  /** 拖拽结束，判定合成或移动 */
  endDrag(targetIndex: number): 'merged' | 'moved' | 'cancelled' {
    if (this.draggingIndex < 0) return 'cancelled';
    const srcIndex = this.draggingIndex;
    this.draggingIndex = -1;

    if (srcIndex === targetIndex) {
      EventBus.emit('merge:dragCancel', srcIndex);
      return 'cancelled';
    }

    // 尝试合成
    if (BoardManager.canMerge(srcIndex, targetIndex)) {
      const resultId = BoardManager.doMerge(srcIndex, targetIndex);
      if (resultId) {
        const def = ITEM_DEFS.get(resultId);
        console.log(`[Merge] 合成成功: ${def?.name} (Lv.${def?.level})`);
        return 'merged';
      }
    }

    // 尝试移动到空格
    if (BoardManager.moveItem(srcIndex, targetIndex)) {
      return 'moved';
    }

    EventBus.emit('merge:dragCancel', srcIndex);
    return 'cancelled';
  }

  cancelDrag(): void {
    if (this.draggingIndex >= 0) {
      EventBus.emit('merge:dragCancel', this.draggingIndex);
      this.draggingIndex = -1;
    }
  }
}

export const MergeManager = new MergeManagerClass();
