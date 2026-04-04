/**
 * GM（Game Master）调试管理器
 *
 * 提供游戏内调试功能：
 * - 清除所有数据 / 重置游戏
 * - 增减货币（金币、钻石、体力、花愿）
 * - 设置等级/经验
 * - 跳过/重置新手引导
 * - 解锁/锁定所有格子
 * - 填充棋盘物品
 * - 增加物品（收纳盒 / 棋盘首空格：幸运金币、万能水晶、金剪刀、钻石袋与体力箱全套）
 * - 清空棋盘
 * - 模拟离线收益
 * - 完成所有每日任务
 * - 重置签到
 *
 * 激活方式：连按招牌 5 次 → 弹出 GM 面板
 */
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { SaveManager } from './SaveManager';
import { CheckInManager } from './CheckInManager';
import { QuestManager } from './QuestManager';
import { IdleManager } from './IdleManager';
import { LevelManager } from './LevelManager';
import { DecorationManager } from './DecorationManager';
import { EventManager } from './EventManager';
import { RoomLayoutManager } from './RoomLayoutManager';
import { CellState } from '@/config/BoardLayout';
import { DECO_DEFS } from '@/config/DecorationConfig';
import {
  getNextLevelStarRequired,
  getStarLevelLabel,
  getMaxStar,
  isSceneCompleted,
} from '@/config/StarLevelConfig';
import {
  ITEM_DEFS,
  Category,
  FlowerLine,
  findItemId,
  CRYSTAL_BALL_ITEM_ID,
  GOLDEN_SCISSORS_ITEM_ID,
  LUCKY_COIN_ITEM_ID,
} from '@/config/ItemConfig';
import { RewardBoxManager } from './RewardBoxManager';
import { STAMINA_MAX } from '@/config/Constants';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const GM_DIAMOND_BAG_IDS = ['diamond_bag_1', 'diamond_bag_2', 'diamond_bag_3'] as const;
const GM_STAMINA_CHEST_IDS = ['stamina_chest_1', 'stamina_chest_2', 'stamina_chest_3'] as const;

const GM_STORAGE_KEY = 'huahua_gm';

/** 「导出缩放」落盘键：无需剪贴板隐私，微信开发者工具 → 调试 → Storage 里可复制全文 */
const GM_STORAGE_EXPORT_SCALES = 'huahua_gm_export_scales';

const LOG_CHUNK = 3200;

/** 长 JSON 分段写入 console，避免单条日志被截断 */
function logLongStringToConsole(title: string, text: string): void {
  if (text.length <= LOG_CHUNK) {
    console.log(`${title}\n${text}`);
    return;
  }
  const n = Math.ceil(text.length / LOG_CHUNK);
  console.log(`${title}（共 ${n} 段，按序号拼接）`);
  for (let i = 0; i < n; i++) {
    console.log(`[GM export ${i + 1}/${n}]\n${text.slice(i * LOG_CHUNK, (i + 1) * LOG_CHUNK)}`);
  }
}

/** GM 面板分组显示顺序（按注册顺序时「装修」会排在「系统测试」之后，首屏看不到） */
const GM_GROUP_ORDER: readonly string[] = [
  '🗑️ 数据重置',
  '💰 货币调整',
  '📊 等级调整',
  '🎮 棋盘操作',
  '➕ 增加物品',
  '🏠 装修系统',
  '🔧 系统测试',
  '🎪 新系统',
  '⚙️ GM设置',
];

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
    const present = new Set<string>();
    for (const cmd of this._commands) present.add(cmd.group);
    const ordered: string[] = [];
    for (const g of GM_GROUP_ORDER) {
      if (present.has(g)) {
        ordered.push(g);
        present.delete(g);
      }
    }
    for (const g of present) ordered.push(g);
    return ordered;
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
      name: '💰 +1000 花愿',
      desc: '增加1000花愿',
      execute: () => {
        CurrencyManager.addHuayuan(1000);
        return `✅ +1000花愿，当前: ${CurrencyManager.state.huayuan}`;
      },
    });

    this._commands.push({
      id: 'add_gold_10000',
      group: '💰 货币调整',
      name: '💰 +10000 花愿',
      desc: '增加10000花愿',
      execute: () => {
        CurrencyManager.addHuayuan(10000);
        return `✅ +10000花愿，当前: ${CurrencyManager.state.huayuan}`;
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
        CurrencyManager.addStar(10);
        return `✅ +10星星，当前 ${LevelManager.level}星 ⭐${CurrencyManager.state.star}`;
      },
    });

    // ========== 等级调整 ==========
    this._commands.push({
      id: 'set_level_5',
      group: '📊 等级调整',
      name: '⭐ 设为 Lv.5',
      desc: '当前装修场景星级→5（并同步星星）；globalLevel 用于合成气泡等门控',
      execute: () => {
        CurrencyManager.setLevel(5);
        return `✅ 当前房 Lv.5，globalLevel=${CurrencyManager.globalLevel}（合成气泡需≥3）`;
      },
    });

    this._commands.push({
      id: 'set_level_10',
      group: '📊 等级调整',
      name: '⭐ 设为 Lv.10',
      desc: '当前装修场景星级→10（花店满星会钳制在 10）',
      execute: () => {
        CurrencyManager.setLevel(10);
        return `✅ 当前房 Lv.${CurrencyManager.state.level}，globalLevel=${CurrencyManager.globalLevel}`;
      },
    });

    this._commands.push({
      id: 'set_level_20',
      group: '📊 等级调整',
      name: '⭐ 设为 Lv.20',
      desc: '按当前场景上限钳制（花店最高 10 星）',
      execute: () => {
        CurrencyManager.setLevel(20);
        return `✅ 当前房 Lv.${CurrencyManager.state.level}，globalLevel=${CurrencyManager.globalLevel}`;
      },
    });

    this._commands.push({
      id: 'gm_star_up_one',
      group: '📊 等级调整',
      name: '⭐ 当前场景升 1 星级',
      desc: '按装修进度条：补足星星升到下一星级（花店/茶屋等当前房）',
      execute: () => {
        const sid = CurrencyManager.state.sceneId;
        const star = CurrencyManager.state.star;
        const level = CurrencyManager.state.level;
        if (isSceneCompleted(sid, level)) {
          return '❌ 当前装修场景已满星';
        }
        const nextReq = getNextLevelStarRequired(sid, level);
        if (nextReq < 0) {
          return '❌ 无法解析下一星级阈值';
        }
        const delta = Math.max(1, nextReq - star);
        const labelBefore = getStarLevelLabel(sid, level);
        CurrencyManager.addStar(delta);
        const afterLv = CurrencyManager.state.level;
        const labelAfter = getStarLevelLabel(sid, afterLv);
        return `✅ +${delta}⭐ → ${labelBefore}→${labelAfter}，累计 ${CurrencyManager.state.star}⭐`;
      },
    });

    this._commands.push({
      id: 'gm_star_max_scene',
      group: '📊 等级调整',
      name: '⭐ 当前场景一键满星',
      desc: '将当前装修场景星星拉到该场景满星阈值',
      execute: () => {
        const sid = CurrencyManager.state.sceneId;
        const maxStar = getMaxStar(sid);
        if (maxStar <= 0) {
          return '❌ 未知场景';
        }
        const cur = CurrencyManager.state.star;
        if (cur >= maxStar) {
          return '❌ 当前场景已满星';
        }
        const delta = maxStar - cur;
        const labelBefore = getStarLevelLabel(sid, CurrencyManager.state.level);
        CurrencyManager.addStar(delta);
        const labelAfter = getStarLevelLabel(sid, CurrencyManager.state.level);
        return `✅ +${delta}⭐ → ${labelBefore}→${labelAfter}（满星 ${maxStar}⭐）`;
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
        const lines = [FlowerLine.FRESH, FlowerLine.BOUQUET, FlowerLine.GREEN];
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
        const itemId = findItemId(Category.FLOWER, FlowerLine.FRESH, 1);
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
        const lines = [FlowerLine.FRESH, FlowerLine.BOUQUET, FlowerLine.GREEN];
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

    // ========== 增加物品（收纳盒 / 棋盘）==========
    this._commands.push({
      id: 'give_lucky_coin',
      group: '➕ 增加物品',
      name: '🪙 幸运金币 → 收纳盒×1',
      desc: '发放到奖励收纳盒，取出后可拖至鲜花/饮品上随机升或降一级',
      execute: () => {
        RewardBoxManager.addItem(LUCKY_COIN_ITEM_ID, 1);
        return '✅ 已发放 1 枚幸运金币到收纳盒';
      },
    });

    this._commands.push({
      id: 'give_crystal_ball',
      group: '➕ 增加物品',
      name: '🔮 万能水晶 → 收纳盒×1',
      desc: '发放到收纳盒；拖到鲜花/饮品（非工具）上确认后稳定升一级',
      execute: () => {
        RewardBoxManager.addItem(CRYSTAL_BALL_ITEM_ID, 1);
        return '✅ 已发放 1 个万能水晶到收纳盒';
      },
    });

    this._commands.push({
      id: 'give_golden_scissors',
      group: '➕ 增加物品',
      name: '✂️ 金剪刀 → 收纳盒×1',
      desc: '发放到收纳盒；拖到 2 级及以上鲜花/饮品上确认后拆成两个低一级同线物品',
      execute: () => {
        RewardBoxManager.addItem(GOLDEN_SCISSORS_ITEM_ID, 1);
        return '✅ 已发放 1 把金剪刀到收纳盒';
      },
    });

    this._commands.push({
      id: 'board_place_lucky_coin',
      group: '➕ 增加物品',
      name: '🪙 幸运金币 → 棋盘首空格',
      desc: '在第一个空的已开放格放置 1 枚（无空格则失败）',
      execute: () => {
        const idx = BoardManager.findEmptyOpenCell();
        if (idx < 0) return '❌ 没有空的已开放格';
        if (!BoardManager.placeItem(idx, LUCKY_COIN_ITEM_ID)) return '❌ 放置失败';
        return `✅ 已在格子 #${idx} 放置幸运金币`;
      },
    });

    this._commands.push({
      id: 'board_place_crystal_ball',
      group: '➕ 增加物品',
      name: '🔮 万能水晶 → 棋盘首空格',
      desc: '在第一个空的已开放格放置 1 个（无空格则失败）',
      execute: () => {
        const idx = BoardManager.findEmptyOpenCell();
        if (idx < 0) return '❌ 没有空的已开放格';
        if (!BoardManager.placeItem(idx, CRYSTAL_BALL_ITEM_ID)) return '❌ 放置失败';
        return `✅ 已在格子 #${idx} 放置万能水晶`;
      },
    });

    this._commands.push({
      id: 'board_place_golden_scissors',
      group: '➕ 增加物品',
      name: '✂️ 金剪刀 → 棋盘首空格',
      desc: '在第一个空的已开放格放置 1 把（无空格则失败）',
      execute: () => {
        const idx = BoardManager.findEmptyOpenCell();
        if (idx < 0) return '❌ 没有空的已开放格';
        if (!BoardManager.placeItem(idx, GOLDEN_SCISSORS_ITEM_ID)) return '❌ 放置失败';
        return `✅ 已在格子 #${idx} 放置金剪刀`;
      },
    });

    this._commands.push({
      id: 'give_diamond_bags_all',
      group: '➕ 增加物品',
      name: '💎 钻石袋 1–3 级 → 收纳盒',
      desc: '各等级 1 个（碎钻小袋 / 晶钻布袋 / 璨钻锦袋）',
      execute: () => {
        const names: string[] = [];
        for (const id of GM_DIAMOND_BAG_IDS) {
          if (!ITEM_DEFS.has(id)) return `❌ 未注册物品 ${id}`;
          RewardBoxManager.addItem(id, 1);
          names.push(ITEM_DEFS.get(id)!.name);
        }
        return `✅ 已发放到收纳盒：${names.join('、')}`;
      },
    });

    this._commands.push({
      id: 'give_stamina_chests_all',
      group: '➕ 增加物品',
      name: '⚡ 体力箱 1–3 级 → 收纳盒',
      desc: '各等级 1 个（元气小箱 / 能量补给箱 / 澎湃体力宝箱）',
      execute: () => {
        const names: string[] = [];
        for (const id of GM_STAMINA_CHEST_IDS) {
          if (!ITEM_DEFS.has(id)) return `❌ 未注册物品 ${id}`;
          RewardBoxManager.addItem(id, 1);
          names.push(ITEM_DEFS.get(id)!.name);
        }
        return `✅ 已发放到收纳盒：${names.join('、')}`;
      },
    });

    this._commands.push({
      id: 'board_place_diamond_bags_all',
      group: '➕ 增加物品',
      name: '💎 钻石袋 1–3 级 → 棋盘',
      desc: '按 1→2→3 顺序各占一格，需至少 3 个空已开放格',
      execute: () => {
        const placed: string[] = [];
        for (const id of GM_DIAMOND_BAG_IDS) {
          if (!ITEM_DEFS.has(id)) return `❌ 未注册物品 ${id}`;
          const idx = BoardManager.findEmptyOpenCell();
          if (idx < 0) {
            return placed.length === 0
              ? '❌ 没有空的已开放格'
              : `⚠️ 仅放置 ${placed.length}/3（空格不足）：${placed.join('；')}`;
          }
          if (!BoardManager.placeItem(idx, id)) {
            return placed.length === 0
              ? '❌ 放置失败'
              : `⚠️ 部分放置后失败：${placed.join('；')}`;
          }
          const nm = ITEM_DEFS.get(id)!.name;
          placed.push(`#${idx} ${nm}`);
        }
        return `✅ 已放置 3 个钻石袋：${placed.join('；')}`;
      },
    });

    this._commands.push({
      id: 'board_place_stamina_chests_all',
      group: '➕ 增加物品',
      name: '⚡ 体力箱 1–3 级 → 棋盘',
      desc: '按 1→2→3 顺序各占一格，需至少 3 个空已开放格',
      execute: () => {
        const placed: string[] = [];
        for (const id of GM_STAMINA_CHEST_IDS) {
          if (!ITEM_DEFS.has(id)) return `❌ 未注册物品 ${id}`;
          const idx = BoardManager.findEmptyOpenCell();
          if (idx < 0) {
            return placed.length === 0
              ? '❌ 没有空的已开放格'
              : `⚠️ 仅放置 ${placed.length}/3（空格不足）：${placed.join('；')}`;
          }
          if (!BoardManager.placeItem(idx, id)) {
            return placed.length === 0
              ? '❌ 放置失败'
              : `⚠️ 部分放置后失败：${placed.join('；')}`;
          }
          const nm = ITEM_DEFS.get(id)!.name;
          placed.push(`#${idx} ${nm}`);
        }
        return `✅ 已放置 3 个体力箱：${placed.join('；')}`;
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
        CurrencyManager.addHuayuan(200);
        CurrencyManager.addStamina(30);
        CurrencyManager.addDiamond(10);
        EventBus.emit('level:up', LevelManager.level, { huayuan: 200, stamina: 30, diamond: 10 });
        return '✅ 已触发升级弹窗（已入账+飞入预览）';
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
          `${cs.level}星 ⭐${cs.star}`,
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
      desc: '解锁所有家具装饰 + 全部房间风格（无视场景/等级/花愿，不扣款不加星）',
      execute: () => {
        const decos = DecorationManager.gmUnlockAllDecos();
        const styles = DecorationManager.gmUnlockAllRoomStyles();
        SaveManager.save();
        return `✅ 装饰 +${decos} 件，房间风格 +${styles} 套（总计已解锁 ${DecorationManager.unlockedCount}/${DecorationManager.totalCount} 装饰）`;
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
        setTimeout(() => EventBus.emit('furniture:edit_enabled'), 500);
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
        RoomLayoutManager.reset();
        return '✅ 房间布局已重置为默认';
      },
    });

    this._commands.push({
      id: 'fill_room',
      group: '🏠 装修系统',
      name: '🛋️ 填充全部家具',
      desc: 'GM 解锁全部装饰与风格，清空房间后尽量摆入（仅当前场景允许的家具会进房）',
      execute: () => {
        DecorationManager.gmUnlockAllDecos();
        DecorationManager.gmUnlockAllRoomStyles();
        RoomLayoutManager.reset();
        let placed = 0;
        for (const d of DECO_DEFS) {
          if (RoomLayoutManager.getPlacement(d.id)) continue;
          if (RoomLayoutManager.addFurniture(d.id)) placed++;
        }
        SaveManager.save();
        return `✅ 已解锁全部装饰，新放入房间 ${placed} 件（其余因场景限制仅解锁未摆放）`;
      },
    });

    this._commands.push({
      id: 'calibrate_deco_scales',
      group: '🏠 装修系统',
      name: '📐 校准：全解锁+全摆放',
      desc: 'GM 解锁全部家具与房间风格并补充放入房间（不清空已有摆放），然后进花店',
      execute: () => {
        const unlocked = DecorationManager.gmUnlockAllDecos();
        const styles = DecorationManager.gmUnlockAllRoomStyles();
        let placed = 0;
        for (const d of DECO_DEFS) {
          if (RoomLayoutManager.getPlacement(d.id)) continue;
          if (RoomLayoutManager.addFurniture(d.id)) placed++;
        }
        SaveManager.save();
        EventBus.emit('scene:switchToShop');
        return `✅ 装饰 +${unlocked}，风格 +${styles}，新放入 ${placed} 件，请在花店编辑模式逐件调整缩放`;
      },
    });

    this._commands.push({
      id: 'export_furniture_scales',
      group: '🏠 装修系统',
      name: '📋 导出缩放配置',
      desc: 'Console 分段日志 + 本地 Storage（不需剪贴板隐私）',
      execute: () => {
        const layout = RoomLayoutManager.getLayout();
        if (!layout || layout.length === 0) {
          return '❌ 房间内没有家具';
        }
        const scaleMap: Record<string, number> = {};
        for (const p of layout) {
          scaleMap[p.decoId] = Math.round(p.scale * 100) / 100;
        }
        const json = JSON.stringify(scaleMap, null, 2);
        logLongStringToConsole('[GM] 家具缩放 defaultScale JSON', json);
        console.log('[GM] ===== END =====');
        try {
          Platform.setStorageSync(GM_STORAGE_EXPORT_SCALES, json);
        } catch (_) {
          console.warn('[GM] 写入本地存储失败');
        }
        return `✅ ${layout.length} 件已导出：① 看 Console 分段 [GM export i/n] ② 开发者工具→调试→Storage→键「${GM_STORAGE_EXPORT_SCALES}」可复制全文`;
      },
    });

    // ========== GM 设置 ==========

    // ========== 🎪 新系统调试 ==========
    this._commands.push({
      id: 'start_event',
      group: '🎪 新系统',
      name: '🎪 开启限时活动',
      desc: '开启春·樱花祭活动(7天)',
      execute: () => {
        EventManager.startEvent(0, 7);
        return '✅ 春·樱花祭活动已开启！';
      },
    });

    this._commands.push({
      id: 'add_event_points',
      group: '🎪 新系统',
      name: '🎟️ +500 活动积分',
      desc: '增加活动积分',
      execute: () => {
        if (!EventManager.hasActiveEvent) return '❌ 没有进行中的活动';
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
