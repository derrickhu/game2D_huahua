/**
 * 微信游戏圈福利与任务管理器
 *
 * 职责：
 *   1) 追踪玩家加圈状态、今日进圈签到、今日点赞/评论/发帖、跨日累计点赞/评论
 *   2) 真机环境通过 wx.getGameClubData + 云函数 /game-club/decrypt 安全解密真实指标
 *   3) 监听从游戏圈返回小游戏（onHide -> onShow）自动记录当日进圈并同步任务进度
 *   4) 计算任务解锁链（prerequisiteTaskId）、可领状态与双场景入口红点
 */

import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { Platform } from '@/core/PlatformService';
import { BackendService } from '@/core/BackendService';
import { ITEM_DEFS } from '@/config/ItemConfig';
import {
  GAME_CLUB_DAILY_SIGN_REWARD,
  GAME_CLUB_DATA_TYPES,
  GAME_CLUB_STORAGE_KEY,
  GAME_CLUB_TASKS,
  type GameClubRewardSpec,
  type GameClubTaskDef,
} from '@/config/GameClubConfig';
import { formatLocalDateString } from '@/utils/WeeklyCycle';
import type { ItemObtainEntry } from '@/gameobjects/ui/ItemObtainOverlay';
import { CurrencyManager } from './CurrencyManager';
import { FlowerSignTicketManager } from './FlowerSignTicketManager';
import { RewardBoxManager } from './RewardBoxManager';
import { SaveManager } from './SaveManager';
import { CloudSyncManager } from './CloudSyncManager';

export type GameClubTaskStatus = 'claimable' | 'active' | 'locked' | 'claimed';

export interface GameClubTaskView {
  def: GameClubTaskDef;
  progress: number;
  target: number;
  status: GameClubTaskStatus;
}

interface GameClubPersistedState {
  /** 当前统计所属本地自然日 YYYY-MM-DD */
  statsDate: string;
  /** 是否已加入微信游戏圈 */
  joined: boolean;
  /** 今日是否已从本面板跳转访问过游戏圈（YYYY-MM-DD） */
  visitedDate: string;
  /** 今日进圈签到礼包已领日期（YYYY-MM-DD） */
  dailySignClaimedDate: string;
  /** 今日最高点赞数（由 getGameClubData type=4 更新） */
  todayLikes: number;
  /** 今日最高评论数（由 getGameClubData type=5 更新） */
  todayComments: number;
  /** 今日最高发帖数（由 getGameClubData type=6 更新） */
  todayPosts: number;
  /** 历史自然日沉淀的累计点赞数（不含今日，总累计 = archivedLikes + todayLikes） */
  archivedLikes: number;
  /** 历史自然日沉淀的累计评论数（不含今日，总累计 = archivedComments + todayComments） */
  archivedComments: number;
  /** 今日已领取的每日任务 ID 集合 */
  dailyClaimedIds: string[];
  /** 永久已领取的一次性/阶梯任务 ID 集合 */
  onceClaimedIds: string[];
  /** 上次成功从微信同步游戏圈数据的时间戳 */
  lastSyncedAt: number;
}

function createDefaultState(today: string): GameClubPersistedState {
  return {
    statsDate: today,
    joined: false,
    visitedDate: '',
    dailySignClaimedDate: '',
    todayLikes: 0,
    todayComments: 0,
    todayPosts: 0,
    archivedLikes: 0,
    archivedComments: 0,
    dailyClaimedIds: [],
    onceClaimedIds: [],
    lastSyncedAt: 0,
  };
}

class GameClubManagerClass {
  private _inited = false;
  private _state: GameClubPersistedState = createDefaultState(formatLocalDateString());
  private _syncing = false;
  private _authDenied = false;
  private _panelOpen = false;
  /** 面板打开或点击前往游戏圈后离开小游戏，返回时自动判为已访问游戏圈并拉取最新数据 */
  private _pendingClubReturn = false;

  /**
   * 入口是否展示：
   * - 微信端：常驻展示
   * - H5 / 浏览器开发预览：常驻展示便于联调验收
   * - 抖音 / TapTap / 华为快游戏：微信游戏圈专属能力，默认隐藏避免平台审核混淆
   */
  get isEntryVisible(): boolean {
    if (Platform.isDouyin || Platform.isTaptap || Platform.isHuawei) {
      return false;
    }
    return true;
  }

  get isSyncing(): boolean {
    return this._syncing;
  }

  get isAuthDenied(): boolean {
    return this._authDenied;
  }

  get joined(): boolean {
    this._ensureInitAndRollover();
    return this._state.joined;
  }

  get visitedToday(): boolean {
    this._ensureInitAndRollover();
    return this._state.visitedDate === formatLocalDateString();
  }

  get dailySignClaimedToday(): boolean {
    this._ensureInitAndRollover();
    return this._state.dailySignClaimedDate === formatLocalDateString();
  }

  /** 顶部每日签到礼包是否可立即领取（今日已进圈或已加圈，且今日未领） */
  get canClaimDailySign(): boolean {
    this._ensureInitAndRollover();
    if (this.dailySignClaimedToday) return false;
    return this.visitedToday || this._state.joined;
  }

  get todayLikes(): number {
    this._ensureInitAndRollover();
    return this._state.todayLikes;
  }

  get todayComments(): number {
    this._ensureInitAndRollover();
    return this._state.todayComments;
  }

  get todayPosts(): number {
    this._ensureInitAndRollover();
    return this._state.todayPosts;
  }

  get totalLikes(): number {
    this._ensureInitAndRollover();
    return this._state.archivedLikes + this._state.todayLikes;
  }

  get totalComments(): number {
    this._ensureInitAndRollover();
    return this._state.archivedComments + this._state.todayComments;
  }

  init(): void {
    this._inited = true;
    const today = formatLocalDateString();
    const raw = PersistService.readJSON<Partial<GameClubPersistedState>>(GAME_CLUB_STORAGE_KEY);
    if (!raw) {
      this._state = createDefaultState(today);
      return;
    }
    this._state = {
      statsDate: typeof raw.statsDate === 'string' && raw.statsDate ? raw.statsDate : today,
      joined: raw.joined === true,
      visitedDate: typeof raw.visitedDate === 'string' ? raw.visitedDate : '',
      dailySignClaimedDate: typeof raw.dailySignClaimedDate === 'string' ? raw.dailySignClaimedDate : '',
      todayLikes: Math.max(0, Math.floor(Number(raw.todayLikes) || 0)),
      todayComments: Math.max(0, Math.floor(Number(raw.todayComments) || 0)),
      todayPosts: Math.max(0, Math.floor(Number(raw.todayPosts) || 0)),
      archivedLikes: Math.max(0, Math.floor(Number(raw.archivedLikes) || 0)),
      archivedComments: Math.max(0, Math.floor(Number(raw.archivedComments) || 0)),
      dailyClaimedIds: Array.isArray(raw.dailyClaimedIds)
        ? raw.dailyClaimedIds.map(String).filter(Boolean)
        : [],
      onceClaimedIds: Array.isArray(raw.onceClaimedIds)
        ? raw.onceClaimedIds.map(String).filter(Boolean)
        : [],
      lastSyncedAt: Math.max(0, Math.floor(Number(raw.lastSyncedAt) || 0)),
    };
    this._checkDateRollover(today);
  }

  /** 云存档拉取覆盖本地后重读 */
  reloadFromStorage(): void {
    this._inited = false;
    this.init();
    EventBus.emit('gameClub:changed');
  }

  /** 是否有任何可立即领取的奖励（含顶部每日礼包 + 列表任务） */
  get hasClaimable(): boolean {
    if (!this.isEntryVisible) return false;
    if (this.canClaimDailySign) return true;
    return this.getTaskViews().some((t) => t.status === 'claimable');
  }

  /**
   * 入口红点：
   *   1) 有任何可立即领取的奖励；或
   *   2) 今日尚未领取顶部「每日逛圈签到礼包」（提醒玩家每天点进来看看领每日礼包）
   */
  get hasRedDot(): boolean {
    if (!this.isEntryVisible) return false;
    if (this.hasClaimable) return true;
    if (!this.dailySignClaimedToday) return true;
    return false;
  }

  /** 标记玩家点击了「前往游戏圈」按钮（或原生 GameClubButton 被触发） */
  markClubJumpTriggered(): void {
    this._ensureInitAndRollover();
    this._pendingClubReturn = true;
    const today = formatLocalDateString();
    if (this._state.visitedDate !== today) {
      this._state.visitedDate = today;
      this._save();
      EventBus.emit('gameClub:changed');
    }
  }

  setPanelOpen(open: boolean): void {
    this._panelOpen = open;
  }

  /** 小游戏切后台（例如打开微信游戏圈半屏/全屏页） */
  notifyAppHide(): void {
    if (this._panelOpen) {
      this._pendingClubReturn = true;
    }
  }

  /** 从微信游戏圈/后台回到小游戏时自动记录进圈并拉取最新游戏圈互动数据 */
  syncAfterAppShow(reason = 'app-show'): void {
    if (!this.isEntryVisible) return;
    this._ensureInitAndRollover();
    if (this._pendingClubReturn) {
      this._pendingClubReturn = false;
      const today = formatLocalDateString();
      if (this._state.visitedDate !== today) {
        this._state.visitedDate = today;
        this._save();
        EventBus.emit('gameClub:changed');
      }
      void this.syncFromWechat(reason);
    }
  }

  /**
   * 调用 wx.getGameClubData + 云函数解密同步真实游戏圈数据。
   * 返回 true 表示成功拉到并更新了指标。
   */
  async syncFromWechat(reason = 'manual'): Promise<boolean> {
    this._ensureInitAndRollover();
    if (!Platform.isWechat) return false;
    if (this._syncing) return false;

    this._syncing = true;
    EventBus.emit('gameClub:changed');
    try {
      const enc = await Platform.getGameClubData(GAME_CLUB_DATA_TYPES);
      if (!enc) {
        return false;
      }
      this._authDenied = false;

      if (!BackendService.available) return false;
      const res = await BackendService.decryptGameClubData(enc.encryptedData, enc.iv);
      const m = res?.metrics;
      if (!m) return false;

      let changed = false;
      if (m.joined && !this._state.joined) {
        this._state.joined = true;
        changed = true;
      }
      if (m.todayLikes > this._state.todayLikes) {
        this._state.todayLikes = m.todayLikes;
        changed = true;
      }
      if (m.todayComments > this._state.todayComments) {
        this._state.todayComments = m.todayComments;
        changed = true;
      }
      if (m.todayPosts > this._state.todayPosts) {
        this._state.todayPosts = m.todayPosts;
        changed = true;
      }
      this._state.lastSyncedAt = Date.now();
      this._save();
      if (changed) {
        CloudSyncManager.scheduleSync(`game-club-sync:${reason}`);
      }
      return true;
    } catch (err: any) {
      if (err?.authDenied) {
        this._authDenied = true;
      } else {
        console.warn(`[GameClub] syncFromWechat(${reason}) failed:`, err?.message || err);
      }
      return false;
    } finally {
      this._syncing = false;
      EventBus.emit('gameClub:changed');
    }
  }

  /** 引导玩家在微信设置页重新开启「游戏圈数据」权限并立即重拉 */
  async openAuthSettingAndSync(): Promise<boolean> {
    await Platform.openSetting();
    this._authDenied = false;
    return this.syncFromWechat('reauth');
  }

  /** 获取排序后的任务视图列表：可领取 → 进行中 → 待解锁（前置锁）→ 已领取 */
  getTaskViews(): GameClubTaskView[] {
    this._ensureInitAndRollover();
    const dailySet = new Set(this._state.dailyClaimedIds);
    const onceSet = new Set(this._state.onceClaimedIds);

    const rawViews: GameClubTaskView[] = GAME_CLUB_TASKS.map((def) => {
      const isClaimed = def.cycle === 'daily' ? dailySet.has(def.id) : onceSet.has(def.id);
      const prereqUnlocked = !def.prerequisiteTaskId || onceSet.has(def.prerequisiteTaskId);
      const progress = this._getMetricValue(def.metric);

      let status: GameClubTaskStatus;
      if (isClaimed) {
        status = 'claimed';
      } else if (!prereqUnlocked) {
        status = 'locked';
      } else if (progress >= def.target) {
        status = 'claimable';
      } else {
        status = 'active';
      }

      return {
        def,
        progress: Math.min(progress, def.target),
        target: def.target,
        status,
      };
    });

    const orderWeight: Record<GameClubTaskStatus, number> = {
      claimable: 0,
      active: 1,
      locked: 2,
      claimed: 3,
    };

    return rawViews.sort((a, b) => {
      const diff = orderWeight[a.status] - orderWeight[b.status];
      if (diff !== 0) return diff;
      return 0;
    });
  }

  /** 领取顶部「每日逛圈签到礼包」 */
  claimDailySign(): ItemObtainEntry[] | null {
    this._ensureInitAndRollover();
    if (!this.canClaimDailySign) return null;

    const today = formatLocalDateString();
    this._state.dailySignClaimedDate = today;
    const entries = this._grantReward(GAME_CLUB_DAILY_SIGN_REWARD);
    this._save();
    SaveManager.save();
    CloudSyncManager.scheduleSync('game-club:daily-sign');
    EventBus.emit('gameClub:changed');
    return entries;
  }

  /** 领取指定任务奖励 */
  claimTask(taskId: string): ItemObtainEntry[] | null {
    this._ensureInitAndRollover();
    const view = this.getTaskViews().find((v) => v.def.id === taskId);
    if (!view || view.status !== 'claimable') return null;

    if (view.def.cycle === 'daily') {
      if (!this._state.dailyClaimedIds.includes(taskId)) {
        this._state.dailyClaimedIds.push(taskId);
      }
    } else {
      if (!this._state.onceClaimedIds.includes(taskId)) {
        this._state.onceClaimedIds.push(taskId);
      }
    }

    const entries = this._grantReward(view.def.reward);
    this._save();
    SaveManager.save();
    CloudSyncManager.scheduleSync(`game-club:task:${taskId}`);
    EventBus.emit('gameClub:changed');
    return entries;
  }

  // ═══════════════ GM / 开发联调辅助 ═══════════════

  /** GM：模拟加圈 + 点赞/评论/发帖各 +1，便于本地与真机验收任务链 */
  gmSimulateActivityStep(): string {
    this._ensureInitAndRollover();
    this._state.joined = true;
    this._state.visitedDate = formatLocalDateString();
    this._state.todayLikes += 1;
    this._state.todayComments += 1;
    this._state.todayPosts += 1;
    this._save();
    EventBus.emit('gameClub:changed');
    return `已模拟游戏圈活跃：已加圈，今日赞=${this.todayLikes} 评=${this.todayComments} 帖=${this.todayPosts}（累计赞=${this.totalLikes} 评=${this.totalComments}）`;
  }

  /** GM：清空游戏圈所有领奖与统计进度 */
  gmResetAll(): void {
    this._state = createDefaultState(formatLocalDateString());
    this._authDenied = false;
    this._save();
    EventBus.emit('gameClub:changed');
  }

  // ═══════════════ 内部工具 ═══════════════

  private _getMetricValue(metric: GameClubTaskDef['metric']): number {
    switch (metric) {
      case 'join_club':
        return this._state.joined ? 1 : 0;
      case 'daily_like':
        return this._state.todayLikes;
      case 'daily_comment':
        return this._state.todayComments;
      case 'daily_post':
        return this._state.todayPosts;
      case 'cum_like':
        return this.totalLikes;
      case 'cum_comment':
        return this.totalComments;
    }
  }

  private _grantReward(spec: GameClubRewardSpec): ItemObtainEntry[] {
    const entries: ItemObtainEntry[] = [];

    if (spec.diamond && spec.diamond > 0) {
      CurrencyManager.addDiamond(spec.diamond);
      entries.push({ kind: 'direct_currency', currency: 'diamond', amount: spec.diamond });
    }
    if (spec.stamina && spec.stamina > 0) {
      CurrencyManager.addStamina(spec.stamina);
      entries.push({ kind: 'direct_currency', currency: 'stamina', amount: spec.stamina });
    }
    if (spec.huayuan && spec.huayuan > 0) {
      CurrencyManager.addHuayuan(spec.huayuan);
      entries.push({ kind: 'direct_currency', currency: 'huayuan', amount: spec.huayuan });
    }
    if (spec.flowerSign && spec.flowerSign > 0) {
      FlowerSignTicketManager.add(spec.flowerSign);
      entries.push({ kind: 'direct_currency', currency: 'flowerSign', amount: spec.flowerSign });
    }
    for (const item of spec.items ?? []) {
      if (item.count > 0 && ITEM_DEFS.has(item.itemId)) {
        RewardBoxManager.addItem(item.itemId, item.count);
        entries.push({ kind: 'board_item', itemId: item.itemId, count: item.count });
      }
    }

    return entries;
  }

  private _ensureInitAndRollover(): void {
    if (!this._inited) {
      this.init();
      return;
    }
    this._checkDateRollover(formatLocalDateString());
  }

  private _checkDateRollover(today: string): void {
    if (this._state.statsDate === today) return;
    // 跨自然日：将昨日互动数沉淀进累计池，重置今日计数与每日已领列表
    this._state.archivedLikes += Math.max(0, this._state.todayLikes);
    this._state.archivedComments += Math.max(0, this._state.todayComments);
    this._state.todayLikes = 0;
    this._state.todayComments = 0;
    this._state.todayPosts = 0;
    this._state.dailyClaimedIds = [];
    this._state.statsDate = today;
    this._save();
  }

  private _save(): void {
    PersistService.writeJSON(GAME_CLUB_STORAGE_KEY, this._state);
  }
}

export const GameClubManager = new GameClubManagerClass();
