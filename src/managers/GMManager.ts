/**
 * GM（Game Master）调试管理器
 *
 * 提供游戏内调试功能：
 * - 清除所有数据 / 重置游戏
 * - 增减货币（金币、钻石、体力、花愿、花露）
 * - 设置等级/经验
 * - 跳过/重置新手引导
 * - 解锁/锁定所有格子
 * - 填充棋盘物品
 * - 清空棋盘
 * - 模拟离线收益
 * - 完成所有每日任务
 * - 重置签到
 *
 * 激活方式：连按招牌 5 次 → 弹出 GM 面板
 */
import { EventBus } from '@/core/EventBus';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { SaveManager } from './SaveManager';
import { CheckInManager } from './CheckInManager';
import { QuestManager } from './QuestManager';
import { IdleManager } from './IdleManager';
import { LevelManager } from './LevelManager';
import { DecorationManager } from './DecorationManager';
import { CellState } from '@/config/BoardLayout';
import { ITEM_DEFS, Category, FlowerLine, findItemId } from '@/config/ItemConfig';
import { STAMINA_MAX } from '@/config/Constants';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const GM_STORAGE_KEY = 'huahua_gm';

/** GM 指令定义 */
export interface GMCommand {
  id: string;
  /** 分组 */
  group: string;
  name: string;
  desc: string;
  /** 执行函数，返回执行结果描述 */
  execute: () => string;
}

class GMManagerClass {
  private _enabled = false;
  private _tapCount = 0;
  private _lastTapTime = 0;
  private _commands: GMCommand[] = [];

  /** GM 模式是否已开启 */
  get isEnabled(): boolean { return this._enabled; }

  /** 获取所有指令 */
  get commands(): readonly GMCommand[] { return this._commands; }

  /** 获取分组列表 */
  get groups(): string[] {
    const set = new Set<string>();
    for (const cmd of this._commands) set.add(cmd.group);
    return [...set];
  }

  /** 按分组获取指令 */
  getCommandsByGroup(group: string): GMCommand[] {
    return this._commands.filter(c => c.group === group);
  }

  constructor() {
    this._registerCommands();
    this._loadState();
  }

  /** 记录连按（招牌点击时调用） */
  onTitleTap(): void {
    const now = Date.now();
    if (now - this._lastTapTime > 1500) {
      // 间隔超过1.5秒，重新计数
      this._tapCount = 1;
    } else {
      this._tapCount++;
    }
    this._lastTapTime = now;

    if (this._tapCount >= 5) {
      this._tapCount = 0;
      this._enabled = true;
      this._saveState();
      console.log('[GM] 🔑 GM模式已激活！');
      EventBus.emit('gm:activated');
      EventBus.emit('gm:open');
    }
  }

  /** 打开 GM 面板 */
  openPanel(): void {
    if (!this._enabled) {
      console.warn('[GM] GM模式未激活，请连按招牌5次');
      return;
    }
    EventBus.emit('gm:open');
  }

  /** 执行指令 */
  executeCommand(id: string): string {
    const cmd = this._commands.find(c => c.id === id);
    if (!cmd) return `❌ 未知指令: ${id}`;
    try {
      const result = cmd.execute();
      console.log(`[GM] 执行: ${cmd.name} → ${result}`);
      return result;
    } catch (e) {
      const msg = `❌ 执行失败: ${e}`;
      console.error(`[GM] ${cmd.name}:`, e);
      return msg;
    }
  }

  /** 注册所有 GM 指令 */
  private _registerCommands(): void {
    // ========== 数据重置 ==========
    this._commands.push({
      id: 'reset_all',
      group: '🗑️ 数据重置',
      name: '🔄 重置全部数据',
      desc: '清除所有存档，游戏回到初始状态（需重启）',
      execute: () => {
        SaveManager.clearAllData();
        return '✅ 所有数据已清除，请刷新游戏重新开始';
      },
    });

    this._commands.push({
      id: 'reset_tutorial',
      group: '🗑️ 数据重置',
      name: '🎓 重置新手引导',
      desc: '清除教程进度，下次启动重新引导',
      execute: () => {
        try { _api?.removeStorageSync('huahua_tutorial'); } catch (_) {}
        return '✅ 教程进度已清除，刷新后将重新开始新手引导';
      },
    });

    this._commands.push({
      id: 'reset_checkin',
      group: '🗑️ 数据重置',
      name: '📅 重置签到',
      desc: '清除签到进度',
      execute: () => {
        try { _api?.removeStorageSync('huahua_checkin'); } catch (_) {}
        return '✅ 签到数据已清除，刷新后重新开始';
      },
    });

    this._commands.push({
      id: 'reset_quests',
      group: '🗑️ 数据重置',
      name: '📋 重置任务/成就',
      desc: '清除每日任务和成就进度',
      execute: () => {
        try { _api?.removeStorageSync('huahua_quests'); } catch (_) {}
        try { _api?.removeStorageSync('huahua_achievements'); } catch (_) {}
        return '✅ 任务和成就数据已清除，刷新后重新开始';
      },
    });

    this._commands.push({
      id: 'reset_idle',
      group: '🗑️ 数据重置',
      name: '💤 重置离线数据',
      desc: '清除离线挂机时间戳',
      execute: () => {
        try { _api?.removeStorageSync('huahua_idle'); } catch (_) {}
        return '✅ 离线数据已清除';
      },
    });

    // ========== 货币调整 ==========
    this._commands.push({
      id: 'add_gold_1000',
      group: '💰 货币调整',
      name: '💰 +1000 金币',
      desc: '增加1000金币',
      execute: () => {
        CurrencyManager.addGold(1000);
        return `✅ +1000金币，当前: ${CurrencyManager.state.gold}`;
      },
    });

    this._commands.push({
      id: 'add_gold_10000',
      group: '💰 货币调整',
      name: '💰 +10000 金币',
      desc: '增加10000金币',
      execute: () => {
        CurrencyManager.addGold(10000);
        return `✅ +10000金币，当前: ${CurrencyManager.state.gold}`;
      },
    });

    this._commands.push({
      id: 'add_diamond_100',
      group: '💰 货币调整',
      name: '💎 +100 钻石',
      desc: '增加100钻石',
      execute: () => {
        CurrencyManager.addDiamond(100);
        return `✅ +100钻石，当前: ${CurrencyManager.state.diamond}`;
      },
    });

    this._commands.push({
      id: 'add_stamina_max',
      group: '💰 货币调整',
      name: '⚡ 体力充满',
      desc: '体力恢复至上限',
      execute: () => {
        const need = STAMINA_MAX - CurrencyManager.state.stamina;
        if (need > 0) CurrencyManager.addStamina(need);
        return `✅ 体力已充满: ${CurrencyManager.state.stamina}/${STAMINA_MAX}`;
      },
    });

    this._commands.push({
      id: 'add_huayuan_100',
      group: '💰 货币调整',
      name: '🌸 +100 花愿',
      desc: '增加100花愿',
      execute: () => {
        CurrencyManager.addHuayuan(100);
        return `✅ +100花愿，当前: ${CurrencyManager.state.huayuan}`;
      },
    });

    this._commands.push({
      id: 'add_exp_500',
      group: '💰 货币调整',
      name: '✨ +500 经验',
      desc: '增加500经验值（可能触发升级）',
      execute: () => {
        LevelManager.addExp(500);
        return `✅ +500经验，当前 Lv.${LevelManager.level} Exp:${LevelManager.exp}/${LevelManager.expToNextLevel}`;
      },
    });

    // ========== 等级调整 ==========
    this._commands.push({
      id: 'set_level_5',
      group: '📊 等级调整',
      name: '⭐ 设为 Lv.5',
      desc: '直接设置等级为5',
      execute: () => {
        CurrencyManager.setLevel(5);
        CurrencyManager.setExp(0);
        return `✅ 等级已设为 Lv.5`;
      },
    });

    this._commands.push({
      id: 'set_level_10',
      group: '📊 等级调整',
      name: '⭐ 设为 Lv.10',
      desc: '直接设置等级为10',
      execute: () => {
        CurrencyManager.setLevel(10);
        CurrencyManager.setExp(0);
        return `✅ 等级已设为 Lv.10`;
      },
    });

    this._commands.push({
      id: 'set_level_20',
      group: '📊 等级调整',
      name: '⭐ 设为 Lv.20',
      desc: '直接设置等级为20',
      execute: () => {
        CurrencyManager.setLevel(20);
        CurrencyManager.setExp(0);
        return `✅ 等级已设为 Lv.20`;
      },
    });

    // ========== 棋盘操作 ==========
    this._commands.push({
      id: 'clear_board',
      group: '🎮 棋盘操作',
      name: '🧹 清空棋盘物品',
      desc: '移除棋盘上所有物品（不影响格子状态）',
      execute: () => {
        let count = 0;
        for (const cell of BoardManager.cells) {
          if (cell.itemId && cell.state === CellState.OPEN) {
            BoardManager.removeItem(cell.index);
            count++;
          }
        }
        EventBus.emit('board:loaded'); // 触发视图刷新
        return `✅ 清除了 ${count} 个物品`;
      },
    });

    this._commands.push({
      id: 'unlock_all_cells',
      group: '🎮 棋盘操作',
      name: '🔓 解锁所有格子',
      desc: '把所有迷雾/窥视/钥匙格全部解锁',
      execute: () => {
        let count = 0;
        for (const cell of BoardManager.cells) {
          if (cell.state !== CellState.OPEN) {
            cell.state = CellState.OPEN;
            count++;
          }
        }
        EventBus.emit('board:loaded');
        return `✅ 解锁了 ${count} 个格子`;
      },
    });

    this._commands.push({
      id: 'fill_low_flowers',
      group: '🎮 棋盘操作',
      name: '🌺 填充低级花朵',
      desc: '在空格子中填满1-2级花朵',
      execute: () => {
        let count = 0;
        const lines = [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY];
        for (const cell of BoardManager.cells) {
          if (cell.state === CellState.OPEN && !cell.itemId) {
            const line = lines[Math.floor(Math.random() * lines.length)];
            const level = Math.random() < 0.6 ? 1 : 2;
            const itemId = findItemId(Category.FLOWER, line, level);
            if (itemId) {
              BoardManager.placeItem(cell.index, itemId);
              count++;
            }
          }
        }
        return `✅ 填充了 ${count} 个花朵`;
      },
    });

    this._commands.push({
      id: 'fill_same_flowers',
      group: '🎮 棋盘操作',
      name: '🌹 填充相同花朵',
      desc: '用同一种花填满空格（方便测试合成）',
      execute: () => {
        let count = 0;
        const itemId = findItemId(Category.FLOWER, FlowerLine.DAILY, 1);
        if (!itemId) return '❌ 找不到花朵配置';
        for (const cell of BoardManager.cells) {
          if (cell.state === CellState.OPEN && !cell.itemId) {
            BoardManager.placeItem(cell.index, itemId);
            count++;
          }
        }
        return `✅ 填充了 ${count} 个相同花朵 (${ITEM_DEFS.get(itemId)?.name || itemId})`;
      },
    });

    this._commands.push({
      id: 'fill_high_flowers',
      group: '🎮 棋盘操作',
      name: '💐 填充高级花朵',
      desc: '在空格子中填满4-5级花朵',
      execute: () => {
        let count = 0;
        const lines = [FlowerLine.DAILY, FlowerLine.ROMANTIC, FlowerLine.LUXURY];
        for (const cell of BoardManager.cells) {
          if (cell.state === CellState.OPEN && !cell.itemId) {
            const line = lines[Math.floor(Math.random() * lines.length)];
            const level = Math.random() < 0.5 ? 4 : 5;
            const itemId = findItemId(Category.FLOWER, line, level);
            if (itemId) {
              BoardManager.placeItem(cell.index, itemId);
              count++;
            }
          }
        }
        return `✅ 填充了 ${count} 个高级花朵`;
      },
    });

    // ========== 系统测试 ==========
    this._commands.push({
      id: 'skip_tutorial',
      group: '🔧 系统测试',
      name: '⏩ 跳过教程',
      desc: '标记教程为已完成',
      execute: () => {
        try { _api?.setStorageSync('huahua_tutorial', '99'); } catch (_) {}
        return '✅ 教程已标记完成（重刷生效）';
      },
    });

    this._commands.push({
      id: 'trigger_checkin',
      group: '🔧 系统测试',
      name: '📅 打开签到面板',
      desc: '强制打开签到面板',
      execute: () => {
        EventBus.emit('nav:openCheckIn');
        return '✅ 已打开签到面板';
      },
    });

    this._commands.push({
      id: 'trigger_quest',
      group: '🔧 系统测试',
      name: '📋 打开任务面板',
      desc: '强制打开任务面板',
      execute: () => {
        EventBus.emit('nav:openQuest');
        return '✅ 已打开任务面板';
      },
    });

    this._commands.push({
      id: 'trigger_levelup',
      group: '🔧 系统测试',
      name: '🎉 测试升级弹窗',
      desc: '模拟一次升级动画',
      execute: () => {
        EventBus.emit('level:up', LevelManager.level, { gold: 200, stamina: 30, diamond: 10 });
        return '✅ 已触发升级弹窗';
      },
    });

    this._commands.push({
      id: 'force_save',
      group: '🔧 系统测试',
      name: '💾 立即存档',
      desc: '手动触发一次存档',
      execute: () => {
        SaveManager.save();
        return '✅ 存档已保存';
      },
    });

    this._commands.push({
      id: 'show_state',
      group: '🔧 系统测试',
      name: '📊 显示游戏状态',
      desc: '打印当前各系统状态摘要',
      execute: () => {
        const cs = CurrencyManager.state;
        const cells = BoardManager.cells;
        const openCount = cells.filter(c => c.state === CellState.OPEN).length;
        const itemCount = cells.filter(c => c.itemId).length;
        const lines = [
          `Lv.${cs.level} Exp:${cs.exp}`,
          `💰${cs.gold} 💎${cs.diamond} ⚡${cs.stamina} 🌸${cs.huayuan}`,
          `棋盘: ${openCount}格开放, ${itemCount}物品`,
          `签到: 连续${CheckInManager.consecutiveDays}天`,
          `装修: ${DecorationManager.unlockedCount}/${DecorationManager.totalCount}解锁`,
        ];
        const msg = lines.join(' | ');
        console.log('[GM State]', msg);
        return msg;
      },
    });

    // ========== 装修系统 ==========
    this._commands.push({
      id: 'add_huayuan_500',
      group: '🏠 装修系统',
      name: '🌸 +500 花愿',
      desc: '大量花愿用于购买装修',
      execute: () => {
        CurrencyManager.addHuayuan(500);
        return `✅ +500花愿，当前: ${CurrencyManager.state.huayuan}`;
      },
    });

    this._commands.push({
      id: 'open_deco_panel',
      group: '🏠 装修系统',
      name: '🏠 打开装修面板',
      desc: '直接打开花店装修面板',
      execute: () => {
        EventBus.emit('nav:openDeco');
        return '✅ 已打开装修面板';
      },
    });

    this._commands.push({
      id: 'unlock_all_deco',
      group: '🏠 装修系统',
      name: '🔓 解锁全部装修',
      desc: '解锁所有装饰（不扣货币）',
      execute: () => {
        // 直接调用内部方法添加大量花愿后逐个解锁
        const { DECO_DEFS } = require('@/config/DecorationConfig');
        let count = 0;
        for (const deco of DECO_DEFS) {
          if (!DecorationManager.isUnlocked(deco.id)) {
            // 给足花愿再解锁
            CurrencyManager.addHuayuan(deco.cost);
            if (DecorationManager.unlock(deco.id)) count++;
          }
        }
        return `✅ 解锁了 ${count} 个装饰`;
      },
    });

    this._commands.push({
      id: 'reset_deco',
      group: '🏠 装修系统',
      name: '🗑️ 重置装修数据',
      desc: '清除所有装修存档',
      execute: () => {
        try { _api?.removeStorageSync('huahua_decoration'); } catch (_) {}
        DecorationManager.reset();
        return '✅ 装修数据已清除';
      },
    });

    this._commands.push({
      id: 'open_room_editor',
      group: '🏠 装修系统',
      name: '✏️ 打开房间编辑器',
      desc: '在花店场景中进入编辑模式',
      execute: () => {
        EventBus.emit('nav:switchToShop');
        setTimeout(() => EventBus.emit('furniture:edit_mode_enter'), 500);
        return '✅ 切换到花店场景并进入编辑模式';
      },
    });

    this._commands.push({
      id: 'reset_room_layout',
      group: '🏠 装修系统',
      name: '🏗️ 重置房间布局',
      desc: '清除家具摆放数据，恢复默认布局',
      execute: () => {
        try { _api?.removeStorageSync('huahua_room_layout'); } catch (_) {}
        const { RoomLayoutManager } = require('@/managers/RoomLayoutManager');
        RoomLayoutManager.reset();
        return '✅ 房间布局已重置为默认';
      },
    });

    this._commands.push({
      id: 'fill_room',
      group: '🏠 装修系统',
      name: '🛋️ 填充全部家具',
      desc: '解锁所有装饰并全部放入房间',
      execute: () => {
        const { DECO_DEFS: allDecos } = require('@/config/DecorationConfig');
        // 先给足够花愿
        CurrencyManager.addHuayuan(50000);
        let count = 0;
        for (const d of allDecos) {
          if (!DecorationManager.isUnlocked(d.id)) {
            DecorationManager.unlock(d.id);
          }
          count++;
        }
        // 重建房间布局
        const { RoomLayoutManager } = require('@/managers/RoomLayoutManager');
        RoomLayoutManager.reset();
        return `✅ 已解锁并放置 ${count} 件家具`;
      },
    });

    // ========== GM 设置 ==========

    // ========== 🎪 新系统调试 ==========
    this._commands.push({
      id: 'add_hualu_100',
      group: '🎪 新系统',
      name: '💧 +100 花露',
      desc: '换装用稀缺货币',
      execute: () => {
        CurrencyManager.addHualu(100);
        return `✅ +100花露，当前: ${CurrencyManager.state.hualu}`;
      },
    });

    this._commands.push({
      id: 'start_event',
      group: '🎪 新系统',
      name: '🎪 开启限时活动',
      desc: '开启春·樱花祭活动(7天)',
      execute: () => {
        const { EventManager: EM } = require('@/managers/EventManager');
        EM.startEvent(0, 7);
        return '✅ 春·樱花祭活动已开启！';
      },
    });

    this._commands.push({
      id: 'add_event_points',
      group: '🎪 新系统',
      name: '🎟️ +500 活动积分',
      desc: '增加活动积分',
      execute: () => {
        const { EventManager: EM } = require('@/managers/EventManager');
        if (!EM.hasActiveEvent) return '❌ 没有进行中的活动';
        // 通过完成任务间接增加（直接设置积分需要内部方法）
        return '请通过完成活动任务获取积分';
      },
    });

    this._commands.push({
      id: 'open_collection',
      group: '🎪 新系统',
      name: '📖 打开图鉴',
      desc: '打开图鉴收集面板',
      execute: () => {
        EventBus.emit('panel:openCollection');
        return '✅ 已打开图鉴面板';
      },
    });

    this._commands.push({
      id: 'open_dressup',
      group: '🎪 新系统',
      name: '👗 打开换装',
      desc: '打开店主换装面板',
      execute: () => {
        EventBus.emit('panel:openDressUp');
        return '✅ 已打开换装面板';
      },
    });

    this._commands.push({
      id: 'open_challenge',
      group: '🎪 新系统',
      name: '🏆 打开挑战关卡',
      desc: '打开挑战关卡面板',
      execute: () => {
        EventBus.emit('panel:openChallenge');
        return '✅ 已打开挑战关卡';
      },
    });

    this._commands.push({
      id: 'disable_gm',
      group: '⚙️ GM设置',
      name: '🔒 关闭GM模式',
      desc: '关闭GM面板访问权限',
      execute: () => {
        this._enabled = false;
        this._saveState();
        return '✅ GM模式已关闭，连按招牌5次可再次激活';
      },
    });
  }

  // ====== 持久化 ======

  private _saveState(): void {
    try {
      _api?.setStorageSync(GM_STORAGE_KEY, JSON.stringify({ enabled: this._enabled }));
    } catch (_) {}
  }

  private _loadState(): void {
    try {
      const raw = _api?.getStorageSync(GM_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this._enabled = !!data.enabled;
      }
    } catch (_) {}

    // 开发模式下自动激活 GM（微信开发者工具的 devtools 环境）
    if (!this._enabled) {
      try {
        const sysInfo = _api?.getSystemInfoSync?.();
        // 开发者工具中 platform 为 'devtools'
        if (sysInfo?.platform === 'devtools') {
          this._enabled = true;
          this._saveState();
          console.log('[GM] 🔧 开发者工具环境，自动激活GM模式');
        }
      } catch (_) {}
    }
  }
}

export const GMManager = new GMManagerClass();
