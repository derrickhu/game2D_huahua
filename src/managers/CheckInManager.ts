/**
 * 签到系统 - 7日循环签到 + 累计里程碑
 *
 * - 每日登录领取奖励，连续签到有额外加成
 * - 7天一个周期，循环进行
 * - 断签重置到第1天重新开始
 * - 累计签到天数触发里程碑奖励
 */
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { CurrencyManager } from './CurrencyManager';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const CHECKIN_STORAGE_KEY = 'huahua_checkin';

export interface RewardItem {
  type: 'stamina' | 'diamond' | 'huayuan' | 'board';
  amount: number;
  textureKey: string;
  /** type === board 时发放的物品 id */
  itemId?: string;
}

export interface CheckInReward {
  day: number;
  stamina?: number;
  diamond?: number;
  huayuan?: number;
  /** 棋盘物品（飞入空格子后落子；不可入仓类亦走此逻辑） */
  boardGrants?: Array<{ itemId: string; count: number }>;
  desc: string;
  icon: string;
  items: RewardItem[];
}

function _buildItems(r: Omit<CheckInReward, 'items'>): RewardItem[] {
  const items: RewardItem[] = [];
  if (r.stamina) items.push({ type: 'stamina', amount: r.stamina, textureKey: 'icon_energy' });
  if (r.diamond) items.push({ type: 'diamond', amount: r.diamond, textureKey: 'icon_gem' });
  if (r.huayuan) items.push({ type: 'huayuan', amount: r.huayuan, textureKey: 'icon_huayuan' });
  if (r.boardGrants?.length) {
    for (const g of r.boardGrants) {
      const def = ITEM_DEFS.get(g.itemId);
      if (!def || g.count <= 0) continue;
      items.push({
        type: 'board',
        amount: g.count,
        textureKey: def.icon,
        itemId: g.itemId,
      });
    }
  }
  return items;
}

/** 7日签到 */
export const CHECK_IN_REWARDS: CheckInReward[] = [
  {
    day: 1,
    diamond: 8,
    boardGrants: [{ itemId: 'hongbao_1', count: 1 }],
    desc: '钻石×8 迎春红包×1',
    icon: '',
  },
  { day: 2, stamina: 30, desc: '体力×30', icon: '' },
  { day: 3, diamond: 12, desc: '钻石×12', icon: '' },
  { day: 4, diamond: 10, stamina: 15, desc: '钻石×10 体力×15', icon: '' },
  { day: 5, diamond: 15, stamina: 25, desc: '钻石×15 体力×25', icon: '' },
  { day: 6, diamond: 12, desc: '钻石×12', icon: '' },
  { day: 7, diamond: 35, stamina: 30, desc: '钻石×35 体力×30', icon: '' },
].map(r => ({ ...r, items: _buildItems(r as any) }));

/** 里程碑配置 */
export interface MilestoneDef {
  threshold: number;
  reward: { diamond?: number; huayuan?: number };
  items: RewardItem[];
}

export const MILESTONES: MilestoneDef[] = [
  { threshold: 8,  reward: { diamond: 25 } },
  { threshold: 15, reward: { diamond: 40 } },
  { threshold: 22, reward: { diamond: 60 } },
  { threshold: 30, reward: { diamond: 100 } },
].map(m => ({
  ...m,
  items: _buildItems({ day: 0, desc: '', icon: '', ...m.reward }),
}));

/** 与 `LevelUpPopup` 展示字段对齐（预览 / 祝贺同款布局） */
export function milestoneRewardToLevelUpPayload(ms: MilestoneDef): {
  huayuan: number;
  stamina: number;
  diamond: number;
  rewardBoxItems: Array<{ itemId: string; count: number }>;
} {
  const r = ms.reward;
  return {
    huayuan: r.huayuan ?? 0,
    stamina: 0,
    diamond: r.diamond ?? 0,
    rewardBoxItems: [],
  };
}

export interface CheckInState {
  signedDays: number;
  consecutiveDays: number;
  totalSignedDays: number;
  lastSignDate: string;
  signedToday: boolean;
  claimedMilestones: number[];
}

class CheckInManagerClass {
  private _state: CheckInState = {
    signedDays: 0,
    consecutiveDays: 0,
    totalSignedDays: 0,
    lastSignDate: '',
    signedToday: false,
    claimedMilestones: [],
  };

  /**
   * GM 调试：相对真实 UTC 日历前进的天数，参与 `_getTodayStr()`。
   * 写入 `huahua_checkin` 的 `_gmDateOffset` 字段，「重置签到」会一并清除。
   */
  private _gmDateOffsetDays = 0;

  get state(): Readonly<CheckInState> { return this._state; }

  /** 当前虚拟日期偏移（天），仅 GM 调试用 */
  get gmDateOffsetDays(): number {
    return this._gmDateOffsetDays;
  }

  get canCheckIn(): boolean {
    return !this._state.signedToday;
  }

  /** 当前周期内的 day 索引（1-7） */
  get currentDay(): number {
    return (this._state.signedDays % 7) + 1;
  }

  get todayReward(): CheckInReward {
    return CHECK_IN_REWARDS[this.currentDay - 1];
  }

  get consecutiveDays(): number {
    return this._state.consecutiveDays;
  }

  get totalSignedDays(): number {
    return this._state.totalSignedDays;
  }

  get streakBonusDesc(): string {
    if (this._state.consecutiveDays >= 30) return '限定店主服装解锁';
    if (this._state.consecutiveDays >= 7) return '每日签到额外+5钻石';
    if (this._state.consecutiveDays >= 3) return '每日签到额外+2钻石';
    return '';
  }

  /** 是否有可领取的里程碑 */
  get hasClaimableMilestone(): boolean {
    return MILESTONES.some(m =>
      this._state.totalSignedDays >= m.threshold &&
      !this._state.claimedMilestones.includes(m.threshold),
    );
  }

  /** 检查某个里程碑是否可领取 */
  canClaimMilestone(threshold: number): boolean {
    return this._state.totalSignedDays >= threshold &&
      !this._state.claimedMilestones.includes(threshold);
  }

  /** 检查某个里程碑是否已领取 */
  isMilestoneClaimed(threshold: number): boolean {
    return this._state.claimedMilestones.includes(threshold);
  }

  init(): void {
    this._loadState();
    this._checkNewDay();
  }

  /** 签到结果：用于 UI 飞入动效（含连续签到钻石加成） */
  checkIn(): { reward: CheckInReward; streakBonus: number } | null {
    if (this._state.signedToday) return null;

    const reward = this.todayReward;

    if (reward.stamina) CurrencyManager.addStamina(reward.stamina);
    if (reward.diamond) CurrencyManager.addDiamond(reward.diamond);
    const streakBonus = this._getStreakBonus();
    if (streakBonus > 0) {
      CurrencyManager.addDiamond(streakBonus);
    }

    this._state.signedDays++;
    this._state.consecutiveDays++;
    this._state.totalSignedDays++;
    this._state.signedToday = true;
    this._state.lastSignDate = this._getTodayStr();

    if (this._state.signedDays >= 7) {
      this._state.signedDays = 0;
    }

    this._saveState();
    EventBus.emit('checkin:signed', reward, streakBonus);
    return { reward, streakBonus };
  }

  /** 领取里程碑奖励 */
  claimMilestone(threshold: number): MilestoneDef | null {
    const ms = MILESTONES.find(m => m.threshold === threshold);
    if (!ms) return null;
    if (!this.canClaimMilestone(threshold)) return null;

    if (ms.reward.diamond) CurrencyManager.addDiamond(ms.reward.diamond);

    this._state.claimedMilestones.push(threshold);
    this._saveState();
    EventBus.emit('checkin:milestoneClaimed', threshold, ms);
    return ms;
  }

  private _getStreakBonus(): number {
    if (this._state.consecutiveDays >= 7) return 5;
    if (this._state.consecutiveDays >= 3) return 2;
    return 0;
  }

  private _checkNewDay(): void {
    const today = this._getTodayStr();
    if (this._state.lastSignDate === today) {
      this._state.signedToday = true;
      return;
    }

    this._state.signedToday = false;

    if (this._state.lastSignDate) {
      const lastDate = new Date(`${this._state.lastSignDate}T12:00:00.000Z`);
      const todayDate = new Date(`${today}T12:00:00.000Z`);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000);
      if (diffDays > 1) {
        this._state.consecutiveDays = 0;
        this._state.signedDays = 0;
      }
    }
  }

  private _getTodayStr(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + this._gmDateOffsetDays);
    return d.toISOString().slice(0, 10);
  }

  /** GM：虚拟日历 +1 天，可再次签到；连续签到若仅隔 1 天会保留 */
  gmAdvanceVirtualDay(): void {
    this._gmDateOffsetDays += 1;
    this._saveState();
    this._checkNewDay();
    EventBus.emit('checkin:gmVirtualDayAdvanced');
  }

  /** GM：清除虚拟日期偏移 */
  gmResetVirtualDayOffset(): void {
    this._gmDateOffsetDays = 0;
    this._saveState();
    this._checkNewDay();
    EventBus.emit('checkin:gmVirtualDayAdvanced');
  }

  /** GM：直接覆盖连续签到天数（用于测试 DailyCandy 连签里程碑） */
  gmSetConsecutiveDays(n: number): void {
    const clamped = Math.max(0, Math.floor(n));
    this._state.consecutiveDays = clamped;
    if (this._state.totalSignedDays < clamped) {
      this._state.totalSignedDays = clamped;
    }
    this._saveState();
    EventBus.emit('checkin:dataChanged');
  }

  private _saveState(): void {
    try {
      PersistService.writeRaw(
        CHECKIN_STORAGE_KEY,
        JSON.stringify({
          ...this._state,
          _gmDateOffset: this._gmDateOffsetDays,
        }),
      );
    } catch (_) {}
  }

  private _loadState(): void {
    try {
      const raw = PersistService.readRaw(CHECKIN_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this._gmDateOffsetDays =
          typeof data._gmDateOffset === 'number' && Number.isFinite(data._gmDateOffset)
            ? Math.trunc(data._gmDateOffset)
            : 0;
        this._state.signedDays = data.signedDays ?? 0;
        this._state.consecutiveDays = data.consecutiveDays ?? 0;
        this._state.totalSignedDays = data.totalSignedDays ?? (data.consecutiveDays ?? 0);
        this._state.lastSignDate = data.lastSignDate ?? '';
        this._state.signedToday = data.signedToday ?? false;
        this._state.claimedMilestones = data.claimedMilestones ?? [];
      }
    } catch (_) {}
  }
}

export const CheckInManager = new CheckInManagerClass();
