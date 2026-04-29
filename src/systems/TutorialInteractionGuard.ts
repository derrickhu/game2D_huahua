import { EventBus } from '@/core/EventBus';

type AllowedMerge = {
  srcIndex: number;
  dstIndex: number;
  allowReverse?: boolean;
};

type GuardState = {
  merge?: AllowedMerge;
};

class TutorialInteractionGuardClass {
  private _state: GuardState = {};

  allowMerge(rule: AllowedMerge): void {
    this._state = { merge: rule };
  }

  clear(): void {
    this._state = {};
  }

  get hasMergeRule(): boolean {
    return !!this._state.merge;
  }

  canStartDrag(srcIndex: number): boolean {
    const rule = this._state.merge;
    if (!rule) return true;
    if (srcIndex === rule.srcIndex) return true;
    return !!rule.allowReverse && srcIndex === rule.dstIndex;
  }

  validateDrag(srcIndex: number, dstIndex: number): boolean {
    const rule = this._state.merge;
    if (!rule) return true;

    const forward = srcIndex === rule.srcIndex && dstIndex === rule.dstIndex;
    const reverse = !!rule.allowReverse && srcIndex === rule.dstIndex && dstIndex === rule.srcIndex;
    if (forward || reverse) return true;

    this.notifyInvalidAction();
    return false;
  }

  notifyInvalidAction(): void {
    EventBus.emit('tutorial:invalidAction');
  }
}

export const TutorialInteractionGuard = new TutorialInteractionGuardClass();
