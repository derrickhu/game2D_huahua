/**
 * 限时活动系统管理器
 *
 * 活动类型：
 * - 🌸 春·樱花祭：限定樱花合成线 + 樱花装饰
 * - 🌻 夏·花火大会：限定向日葵合成线 + 烟花特效
 * - 🍂 秋·丰收感恩：限定秋菊合成线 + 丰收装饰
 * - ❄️ 冬·圣诞花市：限定圣诞合成线 + 雪花装饰
 *
 * 活动机制：
 * - 活动期间完成特定合成/任务获得活动积分
 * - 积分兑换限定装饰/服装/花语卡片
 * - 活动排行榜
 * - 倒计时紧迫感
 */
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { CurrencyManager } from './CurrencyManager';

const STORAGE_KEY = 'huahua_events';

/** 活动状态 */
export enum EventStatus {
  UPCOMING = 'upcoming',    // 即将开始
  ACTIVE = 'active',        // 进行中
  ENDING_SOON = 'ending',   // 即将结束（最后24小时）
  ENDED = 'ended',          // 已结束
}

/** 活动任务 */
export interface EventTask {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** 目标数量 */
  target: number;
  /** 当前进度 */
  current: number;
  /** 积分奖励 */
  pointReward: number;
  /** 是否已完成 */
  completed: boolean;
  /** 是否已领取 */
  claimed: boolean;
}

/** 活动商店物品 */
export interface EventShopItem {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** 需要的活动积分 */
  pointCost: number;
  /** 库存（-1=无限） */
  stock: number;
  /** 已购买数量 */
  bought: number;
  /** 奖励类型 */
  rewardType: 'gold' | 'diamond' | 'huayuan' | 'hualu' | 'decoration' | 'costume' | 'card';
  rewardId?: string;
  rewardAmount?: number;
}

/** 活动定义 */
export interface GameEvent {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** 主题色 */
  themeColor: number;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime: number;
  /** 活动任务列表 */
  tasks: EventTask[];
  /** 活动商店 */
  shop: EventShopItem[];
}

/** 预配置的活动模板 */
const EVENT_TEMPLATES: Omit<GameEvent, 'startTime' | 'endTime'>[] = [
  {
    id: 'spring_sakura',
    name: '🌸 春·樱花祭',
    icon: '🌸',
    desc: '樱花烂漫的季节，收集花瓣兑换限定奖励！',
    themeColor: 0xFFB7C5,
    tasks: [
      { id: 'e_merge_10', name: '合成达人', desc: '完成10次合成', icon: '🧩', target: 10, current: 0, pointReward: 50, completed: false, claimed: false },
      { id: 'e_merge_50', name: '合成大师', desc: '完成50次合成', icon: '🧩', target: 50, current: 0, pointReward: 200, completed: false, claimed: false },
      { id: 'e_combo_5', name: '连击挑战', desc: '达成5连击', icon: '🔥', target: 5, current: 0, pointReward: 100, completed: false, claimed: false },
      { id: 'e_customer_5', name: '花店人气', desc: '服务5位客人', icon: '👤', target: 5, current: 0, pointReward: 80, completed: false, claimed: false },
      { id: 'e_lv6_flower', name: '满级花束', desc: '合成1个6级花束', icon: '💐', target: 1, current: 0, pointReward: 300, completed: false, claimed: false },
      { id: 'e_daily_login', name: '每日登录', desc: '活动期间登录3天', icon: '📅', target: 3, current: 0, pointReward: 150, completed: false, claimed: false },
    ],
    shop: [
      { id: 'es_gold_500', name: '金币×500', icon: '💰', desc: '', pointCost: 100, stock: -1, bought: 0, rewardType: 'gold', rewardAmount: 500 },
      { id: 'es_diamond_10', name: '钻石×10', icon: '💎', desc: '', pointCost: 200, stock: 3, bought: 0, rewardType: 'diamond', rewardAmount: 10 },
      { id: 'es_huayuan_3', name: '花愿×3', icon: '🌸', desc: '', pointCost: 300, stock: 2, bought: 0, rewardType: 'huayuan', rewardAmount: 3 },
      { id: 'es_hualu_5', name: '花露×5', icon: '💧', desc: '稀缺换装货币', pointCost: 500, stock: 1, bought: 0, rewardType: 'hualu', rewardAmount: 5 },
      { id: 'es_deco_sakura', name: '🌸 樱花窗帘', icon: '🌸', desc: '限定装饰', pointCost: 800, stock: 1, bought: 0, rewardType: 'decoration', rewardId: 'deco_sakura_curtain' },
    ],
  },
  {
    id: 'summer_firework',
    name: '🌻 夏·花火大会',
    icon: '🎆',
    desc: '夏日花火，绽放最绚丽的色彩！',
    themeColor: 0xFF8C00,
    tasks: [
      { id: 'e_merge_20', name: '合成冲刺', desc: '完成20次合成', icon: '🧩', target: 20, current: 0, pointReward: 80, completed: false, claimed: false },
      { id: 'e_frenzy', name: '狂热达人', desc: '触发1次合成狂热', icon: '🔥', target: 1, current: 0, pointReward: 250, completed: false, claimed: false },
      { id: 'e_drink_3', name: '饮品师', desc: '合成3杯3级花饮', icon: '🍵', target: 3, current: 0, pointReward: 150, completed: false, claimed: false },
      { id: 'e_gold_1000', name: '小富翁', desc: '累计获得1000金币', icon: '💰', target: 1000, current: 0, pointReward: 120, completed: false, claimed: false },
      { id: 'e_daily_login', name: '每日签到', desc: '活动期间登录5天', icon: '📅', target: 5, current: 0, pointReward: 200, completed: false, claimed: false },
    ],
    shop: [
      { id: 'es_gold_800', name: '金币×800', icon: '💰', desc: '', pointCost: 120, stock: -1, bought: 0, rewardType: 'gold', rewardAmount: 800 },
      { id: 'es_diamond_15', name: '钻石×15', icon: '💎', desc: '', pointCost: 250, stock: 3, bought: 0, rewardType: 'diamond', rewardAmount: 15 },
      { id: 'es_costume_summer', name: '🌻 向日葵发饰', icon: '🌻', desc: '限定服装', pointCost: 900, stock: 1, bought: 0, rewardType: 'costume', rewardId: 'hair_sunflower' },
    ],
  },
];

interface EventSave {
  activeEventId: string | null;
  points: number;
  tasks: Record<string, { current: number; completed: boolean; claimed: boolean }>;
  shopBought: Record<string, number>;
  dailyLoginDays: string[];
}

class EventManagerClass {
  /** 当前活动 */
  private _activeEvent: GameEvent | null = null;
  /** 活动积分 */
  private _points = 0;
  /** 每日登录记录 */
  private _dailyLoginDays: Set<string> = new Set();

  init(): void {
    this._loadState();
    this._checkEventStatus();
    this._bindEvents();
    console.log(`[EventManager] 初始化完成, 活动: ${this._activeEvent?.name || '无'}, 积分: ${this._points}`);
  }

  private _bindEvents(): void {
    if (!this._activeEvent) return;

    // 合成计数
    EventBus.on('board:merged', () => {
      this._incrementTask('e_merge_10', 1);
      this._incrementTask('e_merge_20', 1);
      this._incrementTask('e_merge_50', 1);
    });

    // 连击
    EventBus.on('combo:hit', (count: number) => {
      this._updateTaskMax('e_combo_5', count);
    });

    // 狂热
    EventBus.on('combo:frenzyStart', () => {
      this._incrementTask('e_frenzy', 1);
    });

    // 客人服务
    EventBus.on('customer:delivered', () => {
      this._incrementTask('e_customer_5', 1);
    });

    // 金币获得
    EventBus.on('currency:changed', (type: string, value: number) => {
      if (type === 'gold') {
        this._updateTaskMax('e_gold_1000', value);
      }
    });

    // 每日登录
    this._recordDailyLogin();
  }

  /** 记录每日登录 */
  private _recordDailyLogin(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (!this._dailyLoginDays.has(today)) {
      this._dailyLoginDays.add(today);
      this._incrementTask('e_daily_login', 1);
      this._saveState();
    }
  }

  /** 增量更新任务进度 */
  private _incrementTask(taskId: string, amount: number): void {
    if (!this._activeEvent) return;
    const task = this._activeEvent.tasks.find(t => t.id === taskId);
    if (!task || task.completed) return;

    task.current = Math.min(task.target, task.current + amount);
    if (task.current >= task.target && !task.completed) {
      task.completed = true;
      EventBus.emit('event:taskCompleted', taskId, task);
    }
    this._saveState();
  }

  /** 更新任务（取最大值） */
  private _updateTaskMax(taskId: string, value: number): void {
    if (!this._activeEvent) return;
    const task = this._activeEvent.tasks.find(t => t.id === taskId);
    if (!task || task.completed) return;

    task.current = Math.max(task.current, Math.min(task.target, value));
    if (task.current >= task.target && !task.completed) {
      task.completed = true;
      EventBus.emit('event:taskCompleted', taskId, task);
    }
    this._saveState();
  }

  /** 领取任务奖励 */
  claimTaskReward(taskId: string): boolean {
    if (!this._activeEvent) return false;
    const task = this._activeEvent.tasks.find(t => t.id === taskId);
    if (!task || !task.completed || task.claimed) return false;

    task.claimed = true;
    this._points += task.pointReward;
    this._saveState();
    EventBus.emit('event:rewardClaimed', taskId, task.pointReward);
    return true;
  }

  /** 活动商店购买 */
  buyShopItem(itemId: string): boolean {
    if (!this._activeEvent) return false;
    const item = this._activeEvent.shop.find(i => i.id === itemId);
    if (!item) return false;
    if (item.stock >= 0 && item.bought >= item.stock) return false;
    if (this._points < item.pointCost) return false;

    this._points -= item.pointCost;
    item.bought++;

    // 发放奖励
    switch (item.rewardType) {
      case 'gold': CurrencyManager.addGold(item.rewardAmount || 0); break;
      case 'diamond': CurrencyManager.addDiamond(item.rewardAmount || 0); break;
      case 'huayuan': CurrencyManager.addHuayuan(item.rewardAmount || 0); break;
      case 'hualu': CurrencyManager.addHualu(item.rewardAmount || 0); break;
      case 'decoration':
        EventBus.emit('event:grantDecoration', item.rewardId);
        break;
      case 'costume':
        EventBus.emit('event:grantCostume', item.rewardId);
        break;
    }

    this._saveState();
    EventBus.emit('event:shopBought', itemId, item);
    return true;
  }

  // ═══════════════ 查询 ═══════════════

  /** 当前活动 */
  get activeEvent(): GameEvent | null { return this._activeEvent; }
  get hasActiveEvent(): boolean { return this._activeEvent !== null && this.eventStatus === EventStatus.ACTIVE; }
  get points(): number { return this._points; }

  /** 活动状态 */
  get eventStatus(): EventStatus {
    if (!this._activeEvent) return EventStatus.ENDED;
    const now = Date.now();
    if (now < this._activeEvent.startTime) return EventStatus.UPCOMING;
    if (now > this._activeEvent.endTime) return EventStatus.ENDED;
    if (this._activeEvent.endTime - now < 24 * 3600 * 1000) return EventStatus.ENDING_SOON;
    return EventStatus.ACTIVE;
  }

  /** 活动剩余时间（秒） */
  get timeRemaining(): number {
    if (!this._activeEvent) return 0;
    return Math.max(0, Math.floor((this._activeEvent.endTime - Date.now()) / 1000));
  }

  /** 格式化剩余时间 */
  get timeRemainingText(): string {
    const sec = this.timeRemaining;
    if (sec <= 0) return '已结束';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}天${h}小时`;
    if (h > 0) return `${h}小时${m}分`;
    return `${m}分钟`;
  }

  /** 是否有可领取的任务奖励 */
  get hasClaimableTask(): boolean {
    if (!this._activeEvent) return false;
    return this._activeEvent.tasks.some(t => t.completed && !t.claimed);
  }

  // ═══════════════ 活动调度 ═══════════════

  /** 手动启动活动（GM 或服务端下发） */
  startEvent(templateIndex: number, durationDays: number): void {
    const template = EVENT_TEMPLATES[templateIndex % EVENT_TEMPLATES.length];
    const now = Date.now();
    this._activeEvent = {
      ...template,
      tasks: template.tasks.map(t => ({ ...t, current: 0, completed: false, claimed: false })),
      shop: template.shop.map(s => ({ ...s, bought: 0 })),
      startTime: now,
      endTime: now + durationDays * 24 * 3600 * 1000,
    };
    this._points = 0;
    this._dailyLoginDays.clear();
    this._saveState();

    this._bindEvents();
    EventBus.emit('event:started', this._activeEvent);
    console.log(`[EventManager] 活动开始: ${this._activeEvent.name}, 持续 ${durationDays} 天`);
  }

  /** 检查活动状态（启动时调用） */
  private _checkEventStatus(): void {
    if (this._activeEvent && Date.now() > this._activeEvent.endTime) {
      EventBus.emit('event:ended', this._activeEvent);
      console.log(`[EventManager] 活动已结束: ${this._activeEvent.name}`);
      // 不清除数据，让玩家还能查看结果
    }
  }

  /** 获取活动模板列表（GM用） */
  get eventTemplates(): { id: string; name: string }[] {
    return EVENT_TEMPLATES.map(t => ({ id: t.id, name: t.name }));
  }

  // ═══════════════ 存档 ═══════════════

  private _saveState(): void {
    if (!this._activeEvent) return;
    const data: EventSave = {
      activeEventId: this._activeEvent.id,
      points: this._points,
      tasks: {},
      shopBought: {},
      dailyLoginDays: Array.from(this._dailyLoginDays),
    };
    for (const t of this._activeEvent.tasks) {
      data.tasks[t.id] = { current: t.current, completed: t.completed, claimed: t.claimed };
    }
    for (const s of this._activeEvent.shop) {
      data.shopBought[s.id] = s.bought;
    }
    Platform.setStorageSync(STORAGE_KEY, JSON.stringify(data));
  }

  private _loadState(): void {
    try {
      const raw = Platform.getStorageSync(STORAGE_KEY);
      if (!raw) return;
      const data: EventSave = JSON.parse(raw);
      if (!data.activeEventId) return;

      // 找到对应模板重建活动
      const template = EVENT_TEMPLATES.find(t => t.id === data.activeEventId);
      if (!template) return;

      // 注意：startTime/endTime 需要从存档恢复，但模板中没有
      // 简化处理：假设活动7天，从首次保存开始算
      // 真实场景应该从服务端获取活动时间
      this._points = data.points || 0;
      if (data.dailyLoginDays) {
        this._dailyLoginDays = new Set(data.dailyLoginDays);
      }

      // 恢复任务状态
      const tasks = template.tasks.map(t => {
        const saved = data.tasks?.[t.id];
        return {
          ...t,
          current: saved?.current || 0,
          completed: saved?.completed || false,
          claimed: saved?.claimed || false,
        };
      });

      const shop = template.shop.map(s => ({
        ...s,
        bought: data.shopBought?.[s.id] || 0,
      }));

      // 如果没保存时间，用默认7天
      const firstLogin = data.dailyLoginDays?.[0];
      const startTime = firstLogin ? new Date(firstLogin).getTime() : Date.now() - 3 * 86400000;
      const endTime = startTime + 7 * 86400000;

      this._activeEvent = {
        ...template,
        tasks,
        shop,
        startTime,
        endTime,
      };
    } catch (_) {}
  }
}

export const EventManager = new EventManagerClass();
