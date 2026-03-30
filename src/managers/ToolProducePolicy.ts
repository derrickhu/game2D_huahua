/**
 * 棋盘工具点击产出：体力倍率与产出等级加成（全局策略）。
 * 默认 1 倍体力、0 级加成；日后双倍体力卡等可 setBuff + EventBus `toolproduce:policyChanged`。
 */
import { EventBus } from '@/core/EventBus';

type BuffState = {
  staminaMultiplier: number;
  produceLevelBonus: number;
};

const DEFAULT_BUFF: BuffState = {
  staminaMultiplier: 1,
  produceLevelBonus: 0,
};

class ToolProducePolicyClass {
  private _buff: BuffState = { ...DEFAULT_BUFF };

  getStaminaMultiplier(): number {
    return Math.max(1, this._buff.staminaMultiplier);
  }

  getProduceLevelBonus(): number {
    return Math.max(0, Math.floor(this._buff.produceLevelBonus));
  }

  /**
   * @param baseStamina 配置体力（0 = 不消耗，如不可产出工具）
   */
  getEffectiveStaminaCost(baseStamina: number): number {
    if (baseStamina <= 0) return 0;
    return Math.ceil(baseStamina * this.getStaminaMultiplier());
  }

  /**
   * 接限时 Buff（如 2 倍体力卡：multiplier=2, levelBonus=1）。
   * 传 null 或全默认字段则恢复默认。
   */
  setBuff(partial: Partial<BuffState> | null): void {
    if (!partial) {
      this._buff = { ...DEFAULT_BUFF };
    } else {
      this._buff = {
        staminaMultiplier:
          partial.staminaMultiplier != null
            ? Math.max(1, partial.staminaMultiplier)
            : DEFAULT_BUFF.staminaMultiplier,
        produceLevelBonus:
          partial.produceLevelBonus != null
            ? Math.max(0, Math.floor(partial.produceLevelBonus))
            : DEFAULT_BUFF.produceLevelBonus,
      };
    }
    EventBus.emit('toolproduce:policyChanged');
  }
}

export const ToolProducePolicy = new ToolProducePolicyClass();
