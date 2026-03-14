/**
 * 签到系统 - 7日循环签到
 *
 * 每日登录领取奖励，连续签到有额外加成。
 * 7天一个周期，循环进行。
 */
import { EventBus } from '@/core/EventBus';
import { CurrencyManager } from './CurrencyManager';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const CHECKIN_STORAGE_KEY = 'huahua_checkin';

export interface CheckInReward {
  day: number; // 1-7
  gold?: number;
  stamina?: number;
  diamond?: number;
  huayuan?: number;
  desc: string;
  icon: string;
}

/** 7日签到奖励表 */
export const CHECK_IN_REWARDS: CheckInReward[] = [
  { day: 1, gold: 100, desc: '金币×100', icon: '💰' },
  { day: 2, stamina: 30, desc: '体力×30', icon: '💖' },
  { day: 3, gold: 150, huayuan: 5, desc: '金币×150 花愿×5', icon: '🎁' },
  { day: 4, gold: 100, diamond: 5, desc: '金币×100 钻石×5', icon: '💎' },
  { day: 5, gold: 200, stamina: 20, desc: '金币×200 体力×20', icon: '🌟' },
  { day: 6, diamond: 10, desc: '钻石×10', icon: '💎' },
  { day: 7, gold: 500, diamond: 15, huayuan: 20, desc: '金币×500 钻石×15 花愿×20', icon: '🏆' },
];

export interface CheckInState {
  /** 当前周期内已签到天数（0-7） */
  signedDays: number;
  /** 连续签到天数（跨周期累计） */
  consecutiveDays: number;
  /** 上次签到日期 YYYY-MM-DD */
  lastSignDate: string;
  /** 今天是否已签到 */
  signedToday: boolean;
}

class CheckInManagerClass {
  private _state: CheckInState = {
    signedDays: 0,
    consecutiveDays: 0,
    lastSignDate: '',
    signedToday: false,
  };

  get state(): Readonly<CheckInState> { return this._state; }

  /** 今日是否可签到 */
  get canCheckIn(): boolean {
    return !this._state.signedToday;
  }

  /** 获取今天应该签到的 day（1-7） */
  get currentDay(): number {
    return (this._state.signedDays % 7) + 1;
  }

  /** 获取今天的奖励定义 */
  get todayReward(): CheckInReward {
    return CHECK_IN_REWARDS[this.currentDay - 1];
  }

  /** 获取连续签到天数 */
  get consecutiveDays(): number {
    return this._state.consecutiveDays;
  }

  /** 连续签到加成描述 */
  get streakBonusDesc(): string {
    if (this._state.consecutiveDays >= 30) return '限定店主服装解锁';
    if (this._state.consecutiveDays >= 7) return '每日额外+100金币';
    if (this._state.consecutiveDays >= 3) return '每日额外+50金币';
    return '';
  }

  init(): void {
    this._loadState();
    this._checkNewDay();
  }

  /** 执行签到 */
  checkIn(): CheckInReward | null {
    if (this._state.signedToday) return null;

    const reward = this.todayReward;

    // 发放基础奖励
    if (reward.gold) CurrencyManager.addGold(reward.gold);
    if (reward.stamina) CurrencyManager.addStamina(reward.stamina);
    if (reward.diamond) CurrencyManager.addDiamond(reward.diamond);
    if (reward.huayuan) CurrencyManager.addHuayuan(reward.huayuan);

    // 连续签到额外加成
    const streakBonus = this._getStreakBonus();
    if (streakBonus > 0) {
      CurrencyManager.addGold(streakBonus);
    }

    // 更新状态
    this._state.signedDays++;
    this._state.consecutiveDays++;
    this._state.signedToday = true;
    this._state.lastSignDate = this._getTodayStr();

    // 7天一个周期重置
    if (this._state.signedDays >= 7) {
      this._state.signedDays = 0;
    }

    this._saveState();
    EventBus.emit('checkin:signed', reward, streakBonus);
    return reward;
  }

  /** 获取连续签到额外金币 */
  private _getStreakBonus(): number {
    if (this._state.consecutiveDays >= 7) return 100;
    if (this._state.consecutiveDays >= 3) return 50;
    return 0;
  }

  /** 检查新的一天 */
  private _checkNewDay(): void {
    const today = this._getTodayStr();
    if (this._state.lastSignDate === today) {
      this._state.signedToday = true;
      return;
    }

    this._state.signedToday = false;

    // 检查连续签到是否断了
    if (this._state.lastSignDate) {
      const lastDate = new Date(this._state.lastSignDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000);
      if (diffDays > 1) {
        // 断签，重置连续天数
        this._state.consecutiveDays = 0;
      }
    }
  }

  private _getTodayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  // ====== 存档 ======

  private _saveState(): void {
    try {
      _api?.setStorageSync(CHECKIN_STORAGE_KEY, JSON.stringify(this._state));
    } catch (_) {}
  }

  private _loadState(): void {
    try {
      const raw = _api?.getStorageSync(CHECKIN_STORAGE_KEY);
      if (raw) {
        Object.assign(this._state, JSON.parse(raw));
      }
    } catch (_) {}
  }
}

export const CheckInManager = new CheckInManagerClass();
