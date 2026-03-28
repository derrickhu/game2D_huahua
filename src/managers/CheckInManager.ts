/**
 * 签到系统 - 7日循环签到 + 累计里程碑
 *
 * - 每日登录领取奖励，连续签到有额外加成
 * - 7天一个周期，循环进行
 * - 断签重置到第1天重新开始
 * - 累计签到天数触发里程碑奖励
 */
import { EventBus } from '@/core/EventBus';
import { CurrencyManager } from './CurrencyManager';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const CHECKIN_STORAGE_KEY = 'huahua_checkin';

export interface RewardItem {
  type: 'hualu' | 'stamina' | 'diamond' | 'huayuan';
  amount: number;
  textureKey: string;
}

export interface CheckInReward {
  day: number;
  hualu?: number;
  stamina?: number;
  diamond?: number;
  huayuan?: number;
  desc: string;
  icon: string;
  items: RewardItem[];
}

function _buildItems(r: Omit<CheckInReward, 'items'>): RewardItem[] {
  const items: RewardItem[] = [];
  if (r.hualu) items.push({ type: 'hualu', amount: r.hualu, textureKey: 'icon_hualu' });
  if (r.stamina) items.push({ type: 'stamina', amount: r.stamina, textureKey: 'icon_energy' });
  if (r.diamond) items.push({ type: 'diamond', amount: r.diamond, textureKey: 'icon_gem' });
  if (r.huayuan) items.push({ type: 'huayuan', amount: r.huayuan, textureKey: 'icon_huayuan' });
  return items;
}

/** 7日签到奖励表（花露投放量压缩至原 40%，延长服装攒币周期） */
export const CHECK_IN_REWARDS: CheckInReward[] = [
  { day: 1, hualu: 40,  desc: '花露×40',  icon: '💧' },
  { day: 2, stamina: 30, desc: '体力×30', icon: '💖' },
  { day: 3, hualu: 60,  huayuan: 5, desc: '花露×60 花愿×5', icon: '🎁' },
  { day: 4, hualu: 40,  diamond: 5, desc: '花露×40 钻石×5', icon: '💎' },
  { day: 5, hualu: 80,  stamina: 20, desc: '花露×80 体力×20', icon: '🌟' },
  { day: 6, diamond: 10, desc: '钻石×10', icon: '💎' },
  { day: 7, hualu: 200, diamond: 15, huayuan: 20, desc: '花露×200 钻石×15 花愿×20', icon: '🏆' },
].map(r => ({ ...r, items: _buildItems(r as any) }));

/** 里程碑配置 */
export interface MilestoneDef {
  threshold: number;
  reward: { hualu?: number; diamond?: number; huayuan?: number };
  items: RewardItem[];
}

export const MILESTONES: MilestoneDef[] = [
  { threshold: 8,  reward: { hualu: 120, diamond: 5 } },
  { threshold: 15, reward: { hualu: 200, huayuan: 10 } },
  { threshold: 22, reward: { hualu: 300, diamond: 15 } },
  { threshold: 30, reward: { hualu: 500, diamond: 30, huayuan: 30 } },
].map(m => ({
  ...m,
  items: _buildItems({ day: 0, desc: '', icon: '', ...m.reward }),
}));

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

  get state(): Readonly<CheckInState> { return this._state; }

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
    if (this._state.consecutiveDays >= 7) return '每日额外+40花露';
    if (this._state.consecutiveDays >= 3) return '每日额外+20花露';
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

  /** 签到结果：用于 UI 飞入动效（含连续签到花露加成） */
  checkIn(): { reward: CheckInReward; streakBonusHualu: number } | null {
    if (this._state.signedToday) return null;

    const reward = this.todayReward;

    if (reward.hualu) CurrencyManager.addHualu(reward.hualu);
    if (reward.stamina) CurrencyManager.addStamina(reward.stamina);
    if (reward.diamond) CurrencyManager.addDiamond(reward.diamond);
    if (reward.huayuan) CurrencyManager.addHuayuan(reward.huayuan);

    const streakBonusHualu = this._getStreakBonus();
    if (streakBonusHualu > 0) {
      CurrencyManager.addHualu(streakBonusHualu);
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
    EventBus.emit('checkin:signed', reward, streakBonusHualu);
    return { reward, streakBonusHualu };
  }

  /** 领取里程碑奖励 */
  claimMilestone(threshold: number): MilestoneDef | null {
    const ms = MILESTONES.find(m => m.threshold === threshold);
    if (!ms) return null;
    if (!this.canClaimMilestone(threshold)) return null;

    if (ms.reward.hualu) CurrencyManager.addHualu(ms.reward.hualu);
    if (ms.reward.diamond) CurrencyManager.addDiamond(ms.reward.diamond);
    if (ms.reward.huayuan) CurrencyManager.addHuayuan(ms.reward.huayuan);

    this._state.claimedMilestones.push(threshold);
    this._saveState();
    EventBus.emit('checkin:milestoneClaimed', threshold, ms);
    return ms;
  }

  private _getStreakBonus(): number {
    if (this._state.consecutiveDays >= 7) return 40;
    if (this._state.consecutiveDays >= 3) return 20;
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
      const lastDate = new Date(this._state.lastSignDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000);
      if (diffDays > 1) {
        this._state.consecutiveDays = 0;
        this._state.signedDays = 0;
      }
    }
  }

  private _getTodayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private _saveState(): void {
    try {
      _api?.setStorageSync(CHECKIN_STORAGE_KEY, JSON.stringify(this._state));
    } catch (_) {}
  }

  private _loadState(): void {
    try {
      const raw = _api?.getStorageSync(CHECKIN_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
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
