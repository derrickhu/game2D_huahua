/**
 * GM（Game Master）调试管理器
 *
 * 提供游戏内调试功能：
 * - 清除所有数据 / 重置游戏
 * - 增减货币（金币、钻石、体力、花愿、许愿硬币）
 * - 设置等级/星星
 * - 跳过/重置新手引导
 * - 解锁/锁定所有格子
 * - 填充棋盘物品
 * - 增加物品（收纳盒 / 棋盘首空格：幸运金币、万能水晶、金剪刀、钻石袋与体力箱全套）
 * - 清空棋盘
 * - 模拟离线收益
 * - 完成所有每日任务
 * - 重置签到
 *
 * 激活方式：顶栏「内购商店图标」与右侧系统菜单之间的空白区连点 5 次 → 出现 ；再点打开面板（开发者工具可自动激活）
 */
import { ENABLE_CHALLENGE_LEVEL_FEATURE } from '@/config/FeatureFlags';
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { PersistService } from '@/core/PersistService';
import { BoardManager } from './BoardManager';
import { CurrencyManager } from './CurrencyManager';
import { SaveManager } from './SaveManager';
import { FlowerSignTicketManager } from './FlowerSignTicketManager';
import { CheckInManager } from './CheckInManager';
import { LevelManager } from './LevelManager';
import { DecorationManager } from './DecorationManager';
import { EventManager } from './EventManager';
import { RoomLayoutManager } from './RoomLayoutManager';
import { TutorialManager } from './TutorialManager';
import { AffinityManager } from './AffinityManager';
import { AffinityCardManager } from './AffinityCardManager';
import { DailyCandyManager } from './DailyCandyManager';
import { IdleManager } from './IdleManager';
import { AFFINITY_DEFS } from '@/config/AffinityConfig';
import { AFFINITY_CARDS, CARD_RARITIES, type CardRarity } from '@/config/AffinityCardConfig';
import { getLevelUnlockDef } from '@/config/LevelUnlockConfig';
import { CellState } from '@/config/BoardLayout';
import { DECO_DEFS } from '@/config/DecorationConfig';
import {
  getGlobalNextLevelStarRequired,
  getGlobalStarLevelLabel,
  getGlobalStarRequiredForLevel,
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
import { MergeCompanionManager } from './MergeCompanionManager';
import { STAMINA_MAX } from '@/config/Constants';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const GM_DIAMOND_BAG_IDS = ['diamond_bag_1', 'diamond_bag_2', 'diamond_bag_3'] as const;
const GM_STAMINA_CHEST_IDS = ['stamina_chest_1', 'stamina_chest_2', 'stamina_chest_3'] as const;
const GM_HIGH_PRODUCER_IDS = [
  'tool_plant_7',
  'tool_arrange_5',
  'tool_butterfly_net_5',
  'tool_mixer_5',
  'tool_bake_5',
] as const;
const GM_TEST_BUBBLE_ITEM_ID = 'flower_fresh_6';

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
  ' 数据重置',
  ' 货币调整',
  ' 等级调整',
  ' 升星仪式',
  ' 熟客系统',
  ' 卡牌系统',
  ' 离线/糖果',
  ' 棋盘操作',
  ' 增加物品',
  ' 装修系统',
  ' 系统测试',
  ' 新系统',
  ' GM设置',
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
  private readonly _runtimeAllowed: boolean;
  private _tapCount = 0;
  private _lastTapTime = 0;
  private _commands: GMCommand[] = [];

  /** GM 仅允许在微信/抖音开发者工具模拟器环境触发；真机一律禁用 */
  get isRuntimeAllowed(): boolean { return this._runtimeAllowed; }

  /** GM 模式是否已开启 */
  get isEnabled(): boolean { return this._runtimeAllowed && this._enabled; }

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
    this._runtimeAllowed = this._detectSimulatorRuntime();
    this._registerCommands();
    this._loadState();
  }

  /** 记录连按（顶栏 GM 槽隐形热区点击时调用） */
  onTitleTap(): void {
    if (!this._runtimeAllowed) return;
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
      console.log('[GM]  GM模式已激活！');
      EventBus.emit('gm:activated');
      EventBus.emit('gm:open');
    }
  }

  /** 打开 GM 面板 */
  openPanel(): void {
    if (!this._runtimeAllowed) {
      console.warn('[GM] 真机环境禁用 GM');
      return;
    }
    if (!this._enabled) {
      console.warn('[GM] GM模式未激活：请在顶栏商店与系统菜单之间空白区连点 5 次');
      return;
    }
    EventBus.emit('gm:open');
  }

  /** 执行指令 */
  executeCommand(id: string): string {
    if (!this._runtimeAllowed) return ' 真机环境禁用 GM';
    const cmd = this._commands.find(c => c.id === id);
    if (!cmd) return ` 未知指令: ${id}`;
    try {
      const result = cmd.execute();
      console.log(`[GM] 执行: ${cmd.name} → ${result}`);
      return result;
    } catch (e) {
      const msg = ` 执行失败: ${e}`;
      console.error(`[GM] ${cmd.name}:`, e);
      return msg;
    }
  }

  /** 注册所有 GM 指令 */
  private _registerCommands(): void {
    // ========== 数据重置 ==========
    this._commands.push({
      id: 'reset_all',
      group: ' 数据重置',
      name: ' 重置全部数据',
      desc: '清除所有存档，游戏回到初始状态（需重启）',
      execute: () => {
        SaveManager.clearAllData();
        return ' 所有数据已清除，请刷新游戏重新开始';
      },
    });

    this._commands.push({
      id: 'reset_tutorial',
      group: ' 数据重置',
      name: ' 重置新手引导',
      desc: '清除教程进度，下次启动重新引导',
      execute: () => {
        TutorialManager.forceReset();
        return ' 教程进度已清除，刷新后将重新开始新手引导';
      },
    });

    this._commands.push({
      id: 'reset_checkin',
      group: ' 数据重置',
      name: ' 重置签到',
      desc: '清除签到进度',
      execute: () => {
        PersistService.remove('huahua_checkin');
        return ' 签到数据已清除，刷新后重新开始';
      },
    });

    this._commands.push({
      id: 'reset_quests',
      group: ' 数据重置',
      name: ' 重置每日挑战',
      desc: '清除每日挑战与周积分进度（huahua_quests）',
      execute: () => {
        PersistService.removeMany(['huahua_quests', 'huahua_achievements']);
        return ' 每日挑战数据已清除，刷新后重新开始';
      },
    });

    this._commands.push({
      id: 'reset_idle',
      group: ' 数据重置',
      name: ' 重置离线数据',
      desc: '清除离线挂机时间戳',
      execute: () => {
        PersistService.remove('huahua_idle');
        return ' 离线数据已清除';
      },
    });

    // ========== 货币调整 ==========
    this._commands.push({
      id: 'add_gold_1000',
      group: ' 货币调整',
      name: ' +1000 花愿',
      desc: '增加1000花愿',
      execute: () => {
        CurrencyManager.addHuayuan(1000);
        return ` +1000花愿，当前: ${CurrencyManager.state.huayuan}`;
      },
    });

    this._commands.push({
      id: 'add_gold_10000',
      group: ' 货币调整',
      name: ' +10000 花愿',
      desc: '增加10000花愿',
      execute: () => {
        CurrencyManager.addHuayuan(10000);
        return ` +10000花愿，当前: ${CurrencyManager.state.huayuan}`;
      },
    });

    this._commands.push({
      id: 'add_diamond_100',
      group: ' 货币调整',
      name: ' +100 钻石',
      desc: '增加100钻石',
      execute: () => {
        CurrencyManager.addDiamond(100);
        return ` +100钻石，当前: ${CurrencyManager.state.diamond}`;
      },
    });

    this._commands.push({
      id: 'add_flower_sign_coin_1',
      group: ' 货币调整',
      name: ' +1 许愿硬币',
      desc: '大地图许愿喷泉抽奖货币',
      execute: () => {
        FlowerSignTicketManager.add(1);
        SaveManager.save();
        return ` +1 许愿硬币，当前 ${FlowerSignTicketManager.count}`;
      },
    });

    this._commands.push({
      id: 'add_flower_sign_coin_100',
      group: ' 货币调整',
      name: ' +100 许愿硬币',
      desc: '大地图许愿喷泉抽奖货币',
      execute: () => {
        FlowerSignTicketManager.add(100);
        SaveManager.save();
        return ` +100 许愿硬币，当前 ${FlowerSignTicketManager.count}`;
      },
    });

    this._commands.push({
      id: 'add_flower_sign_coin_500',
      group: ' 货币调整',
      name: ' +500 许愿硬币',
      desc: '大地图许愿喷泉抽奖货币',
      execute: () => {
        FlowerSignTicketManager.add(500);
        SaveManager.save();
        return ` +500 许愿硬币，当前 ${FlowerSignTicketManager.count}`;
      },
    });

    this._commands.push({
      id: 'add_stamina_max',
      group: ' 货币调整',
      name: ' 体力充满',
      desc: '体力恢复至上限',
      execute: () => {
        const need = STAMINA_MAX - CurrencyManager.state.stamina;
        if (need > 0) CurrencyManager.addStamina(need);
        return ` 体力已充满: ${CurrencyManager.state.stamina}/${STAMINA_MAX}`;
      },
    });

    this._commands.push({
      id: 'add_huayuan_100',
      group: ' 货币调整',
      name: ' +100 花愿',
      desc: '增加100花愿',
      execute: () => {
        CurrencyManager.addHuayuan(100);
        return ` +100花愿，当前: ${CurrencyManager.state.huayuan}`;
      },
    });

    this._commands.push({
      id: 'add_star_10',
      group: ' 货币调整',
      name: '+10 星星',
      desc: '增加 10 点全局星星（可能升星）',
      execute: () => {
        CurrencyManager.addStar(10);
        return `+10星，当前 ${LevelManager.level}星，累计 ${CurrencyManager.state.star}星`;
      },
    });

    // ========== 等级调整 ==========
    this._commands.push({
      id: 'set_level_5',
      group: ' 等级调整',
      name: '设为 Lv.5',
      desc: '全局星级→5（并同步累计星星）；globalLevel 与顶栏一致',
      execute: () => {
        CurrencyManager.setLevel(5);
        return ` 当前房 Lv.5，globalLevel=${CurrencyManager.globalLevel}（合成气泡需≥3）`;
      },
    });

    this._commands.push({
      id: 'set_level_10',
      group: ' 等级调整',
      name: '设为 Lv.10',
      desc: '全局星级→10（原花店十星档，160星 门槛）',
      execute: () => {
        CurrencyManager.setLevel(10);
        return ` 当前房 Lv.${CurrencyManager.state.level}，globalLevel=${CurrencyManager.globalLevel}`;
      },
    });

    this._commands.push({
      id: 'set_level_20',
      group: ' 等级调整',
      name: '设为 Lv.20',
      desc: '全局星级→20（超过十星后继续可升）',
      execute: () => {
        CurrencyManager.setLevel(20);
        return ` 当前房 Lv.${CurrencyManager.state.level}，globalLevel=${CurrencyManager.globalLevel}`;
      },
    });

    this._commands.push({
      id: 'gm_star_up_one',
      group: ' 等级调整',
      name: '全局升 1 星级',
      desc: '按顶栏进度条：补足星星升到下一全局星级',
      execute: () => {
        const star = CurrencyManager.state.star;
        const level = CurrencyManager.state.level;
        const nextReq = getGlobalNextLevelStarRequired(level);
        const delta = Math.max(1, nextReq - star);
        const labelBefore = getGlobalStarLevelLabel(level);
        CurrencyManager.addStar(delta);
        const afterLv = CurrencyManager.state.level;
        const labelAfter = getGlobalStarLevelLabel(afterLv);
        return `+${delta}星 → ${labelBefore}→${labelAfter}，累计 ${CurrencyManager.state.star}星`;
      },
    });

    this._commands.push({
      id: 'gm_star_max_scene',
      group: ' 等级调整',
      name: '全局拉到十星门槛',
      desc: '累计星星拉到全局 10 星门槛（160星，与原花店满星一致）',
      execute: () => {
        const target = getGlobalStarRequiredForLevel(10);
        const cur = CurrencyManager.state.star;
        if (cur >= target) {
          return `全局已 ≥ 十星门槛（当前 ${cur}星）`;
        }
        const delta = target - cur;
        const labelBefore = getGlobalStarLevelLabel(CurrencyManager.state.level);
        CurrencyManager.addStar(delta);
        const labelAfter = getGlobalStarLevelLabel(CurrencyManager.state.level);
        return `+${delta}星 → ${labelBefore}→${labelAfter}（${target}星）`;
      },
    });

    // ========== 棋盘操作 ==========
    this._commands.push({
      id: 'clear_board',
      group: ' 棋盘操作',
      name: ' 清空棋盘物品',
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
        return ` 清除了 ${count} 个物品`;
      },
    });

    this._commands.push({
      id: 'unlock_all_cells',
      group: ' 棋盘操作',
      name: ' 解锁所有格子',
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
        return ` 解锁了 ${count} 个格子`;
      },
    });

    this._commands.push({
      id: 'fill_low_flowers',
      group: ' 棋盘操作',
      name: ' 填充低级花朵',
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
        return ` 填充了 ${count} 个花朵`;
      },
    });

    this._commands.push({
      id: 'fill_same_flowers',
      group: ' 棋盘操作',
      name: ' 填充相同花朵',
      desc: '用同一种花填满空格（方便测试合成）',
      execute: () => {
        let count = 0;
        const itemId = findItemId(Category.FLOWER, FlowerLine.FRESH, 1);
        if (!itemId) return ' 找不到花朵配置';
        for (const cell of BoardManager.cells) {
          if (cell.state === CellState.OPEN && !cell.itemId) {
            BoardManager.placeItem(cell.index, itemId);
            count++;
          }
        }
        return ` 填充了 ${count} 个相同花朵 (${ITEM_DEFS.get(itemId)?.name || itemId})`;
      },
    });

    this._commands.push({
      id: 'fill_high_flowers',
      group: ' 棋盘操作',
      name: ' 填充高级花朵',
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
        return ` 填充了 ${count} 个高级花朵`;
      },
    });

    // ========== 增加物品（收纳盒 / 棋盘）==========
    this._commands.push({
      id: 'give_lucky_coin',
      group: ' 增加物品',
      name: ' 幸运金币 → 收纳盒×1',
      desc: '发放到奖励收纳盒，取出后可拖至鲜花或饮品（含蝴蝶标本）上随机升或降一级',
      execute: () => {
        RewardBoxManager.addItem(LUCKY_COIN_ITEM_ID, 1);
        return ' 已发放 1 枚幸运金币到收纳盒';
      },
    });

    this._commands.push({
      id: 'give_crystal_ball',
      group: ' 增加物品',
      name: ' 万能水晶 → 收纳盒×1',
      desc: '发放到收纳盒；拖到鲜花或饮品（非工具，含蝴蝶标本）上确认后稳定升一级',
      execute: () => {
        RewardBoxManager.addItem(CRYSTAL_BALL_ITEM_ID, 1);
        return ' 已发放 1 个万能水晶到收纳盒';
      },
    });

    this._commands.push({
      id: 'give_golden_scissors',
      group: ' 增加物品',
      name: ' 金剪刀 → 收纳盒×1',
      desc: '发放到收纳盒；拖到 2 级及以上鲜花或饮品（含蝴蝶标本）上确认后拆成两个低一级同线物品',
      execute: () => {
        RewardBoxManager.addItem(GOLDEN_SCISSORS_ITEM_ID, 1);
        return ' 已发放 1 把金剪刀到收纳盒';
      },
    });

    this._commands.push({
      id: 'give_flower_sign_tickets',
      group: ' 增加物品',
      name: ' 许愿硬币 +20',
      desc: '大地图许愿喷泉抽奖用（数量仅在许愿池界面显示）',
      execute: () => {
        FlowerSignTicketManager.add(20);
        SaveManager.save();
        return ` 许愿硬币 +20，当前 ${FlowerSignTicketManager.count}`;
      },
    });

    this._commands.push({
      id: 'board_place_lucky_coin',
      group: ' 增加物品',
      name: ' 幸运金币 → 棋盘首空格',
      desc: '在第一个空的已开放格放置 1 枚（无空格则失败）',
      execute: () => {
        const idx = BoardManager.findEmptyOpenCell();
        if (idx < 0) return ' 没有空的已开放格';
        if (!BoardManager.placeItem(idx, LUCKY_COIN_ITEM_ID)) return ' 放置失败';
        return ` 已在格子 #${idx} 放置幸运金币`;
      },
    });

    this._commands.push({
      id: 'board_place_crystal_ball',
      group: ' 增加物品',
      name: ' 万能水晶 → 棋盘首空格',
      desc: '在第一个空的已开放格放置 1 个（无空格则失败）',
      execute: () => {
        const idx = BoardManager.findEmptyOpenCell();
        if (idx < 0) return ' 没有空的已开放格';
        if (!BoardManager.placeItem(idx, CRYSTAL_BALL_ITEM_ID)) return ' 放置失败';
        return ` 已在格子 #${idx} 放置万能水晶`;
      },
    });

    this._commands.push({
      id: 'board_place_golden_scissors',
      group: ' 增加物品',
      name: ' 金剪刀 → 棋盘首空格',
      desc: '在第一个空的已开放格放置 1 把（无空格则失败）',
      execute: () => {
        const idx = BoardManager.findEmptyOpenCell();
        if (idx < 0) return ' 没有空的已开放格';
        if (!BoardManager.placeItem(idx, GOLDEN_SCISSORS_ITEM_ID)) return ' 放置失败';
        return ` 已在格子 #${idx} 放置金剪刀`;
      },
    });

    this._commands.push({
      id: 'give_diamond_bags_all',
      group: ' 增加物品',
      name: ' 钻石袋 1–3 级 → 收纳盒',
      desc: '各等级 1 个（碎钻小袋 / 晶钻布袋 / 璨钻锦袋）',
      execute: () => {
        const names: string[] = [];
        for (const id of GM_DIAMOND_BAG_IDS) {
          if (!ITEM_DEFS.has(id)) return ` 未注册物品 ${id}`;
          RewardBoxManager.addItem(id, 1);
          names.push(ITEM_DEFS.get(id)!.name);
        }
        return ` 已发放到收纳盒：${names.join('、')}`;
      },
    });

    this._commands.push({
      id: 'give_stamina_chests_all',
      group: ' 增加物品',
      name: ' 体力箱 1–3 级 → 收纳盒',
      desc: '各等级 1 个（元气小箱 / 能量补给箱 / 澎湃体力宝箱）',
      execute: () => {
        const names: string[] = [];
        for (const id of GM_STAMINA_CHEST_IDS) {
          if (!ITEM_DEFS.has(id)) return ` 未注册物品 ${id}`;
          RewardBoxManager.addItem(id, 1);
          names.push(ITEM_DEFS.get(id)!.name);
        }
        return ` 已发放到收纳盒：${names.join('、')}`;
      },
    });

    this._commands.push({
      id: 'board_place_diamond_bags_all',
      group: ' 增加物品',
      name: ' 钻石袋 1–3 级 → 棋盘',
      desc: '按 1→2→3 顺序各占一格，需至少 3 个空已开放格',
      execute: () => {
        const placed: string[] = [];
        for (const id of GM_DIAMOND_BAG_IDS) {
          if (!ITEM_DEFS.has(id)) return ` 未注册物品 ${id}`;
          const idx = BoardManager.findEmptyOpenCell();
          if (idx < 0) {
            return placed.length === 0
              ? ' 没有空的已开放格'
              : ` 仅放置 ${placed.length}/3（空格不足）：${placed.join('；')}`;
          }
          if (!BoardManager.placeItem(idx, id)) {
            return placed.length === 0
              ? ' 放置失败'
              : ` 部分放置后失败：${placed.join('；')}`;
          }
          const nm = ITEM_DEFS.get(id)!.name;
          placed.push(`#${idx} ${nm}`);
        }
        return ` 已放置 3 个钻石袋：${placed.join('；')}`;
      },
    });

    this._commands.push({
      id: 'board_place_stamina_chests_all',
      group: ' 增加物品',
      name: ' 体力箱 1–3 级 → 棋盘',
      desc: '按 1→2→3 顺序各占一格，需至少 3 个空已开放格',
      execute: () => {
        const placed: string[] = [];
        for (const id of GM_STAMINA_CHEST_IDS) {
          if (!ITEM_DEFS.has(id)) return ` 未注册物品 ${id}`;
          const idx = BoardManager.findEmptyOpenCell();
          if (idx < 0) {
            return placed.length === 0
              ? ' 没有空的已开放格'
              : ` 仅放置 ${placed.length}/3（空格不足）：${placed.join('；')}`;
          }
          if (!BoardManager.placeItem(idx, id)) {
            return placed.length === 0
              ? ' 放置失败'
              : ` 部分放置后失败：${placed.join('；')}`;
          }
          const nm = ITEM_DEFS.get(id)!.name;
          placed.push(`#${idx} ${nm}`);
        }
        return ` 已放置 3 个体力箱：${placed.join('；')}`;
      },
    });

    this._commands.push({
      id: 'board_place_high_producers',
      group: ' 增加物品',
      name: ' 高级生产器 → 棋盘',
      desc: '放置种植/包装/捕虫/饮品/烘焙各 1 个高级生产器，需空已开放格',
      execute: () => {
        const placed: string[] = [];
        for (const id of GM_HIGH_PRODUCER_IDS) {
          const def = ITEM_DEFS.get(id);
          if (!def) return ` 未注册物品 ${id}`;
          const idx = BoardManager.findEmptyOpenCell();
          if (idx < 0) {
            return placed.length === 0
              ? ' 没有空的已开放格'
              : ` 仅放置 ${placed.length}/${GM_HIGH_PRODUCER_IDS.length}（空格不足）：${placed.join('；')}`;
          }
          if (!BoardManager.placeItem(idx, id)) {
            return placed.length === 0
              ? ' 放置失败'
              : ` 部分放置后失败：${placed.join('；')}`;
          }
          placed.push(`#${idx} ${def.name}`);
        }
        return ` 已放置高级生产器：${placed.join('；')}`;
      },
    });

    this._commands.push({
      id: 'gm_spawn_flower_bubble',
      group: ' 增加物品',
      name: ' 生成花语泡泡',
      desc: '直接生成一个含高级鲜花的花语泡泡，用于测试广告解锁',
      execute: () => {
        const idx = BoardManager.findEmptyOpenCell();
        const ok = MergeCompanionManager.gmSpawnFloatBubble(GM_TEST_BUBBLE_ITEM_ID, idx >= 0 ? idx : undefined);
        if (!ok) return ' 生成失败：物品未注册或当前花语泡泡已达上限';
        const nm = ITEM_DEFS.get(GM_TEST_BUBBLE_ITEM_ID)?.name ?? GM_TEST_BUBBLE_ITEM_ID;
        return ` 已生成花语泡泡（内容：${nm}）`;
      },
    });

    // ========== 系统测试 ==========
    this._commands.push({
      id: 'skip_tutorial',
      group: ' 系统测试',
      name: '⏩ 跳过教程',
      desc: '标记教程为已完成',
      execute: () => {
        TutorialManager.forceComplete();
        return ' 教程已标记完成（重刷生效）';
      },
    });

    this._commands.push({
      id: 'trigger_checkin',
      group: ' 系统测试',
      name: ' 打开签到面板',
      desc: '强制打开签到面板',
      execute: () => {
        EventBus.emit('nav:openCheckIn');
        return ' 已打开签到面板';
      },
    });

    this._commands.push({
      id: 'gm_checkin_advance_day',
      group: ' 系统测试',
      name: ' 签到：虚拟下一天',
      desc: 'UTC 日历 +1 天（测累计签到/再签）；数据写入 huahua_checkin',
      execute: () => {
        CheckInManager.gmAdvanceVirtualDay();
        return ` 虚拟日期 +1，偏移=${CheckInManager.gmDateOffsetDays}天，可签到=${CheckInManager.canCheckIn ? '是' : '否'}`;
      },
    });

    this._commands.push({
      id: 'gm_checkin_reset_virtual_date',
      group: ' 系统测试',
      name: ' 签到：重置虚拟日期',
      desc: '清除 GM 虚拟日期偏移，恢复真实「今日」',
      execute: () => {
        CheckInManager.gmResetVirtualDayOffset();
        return ` 虚拟日期已归零，可签到=${CheckInManager.canCheckIn ? '是' : '否'}`;
      },
    });

    this._commands.push({
      id: 'trigger_quest',
      group: ' 系统测试',
      name: ' 打开任务面板',
      desc: '强制打开任务面板',
      execute: () => {
        EventBus.emit('nav:openQuest');
        return ' 已打开任务面板';
      },
    });

    this._commands.push({
      id: 'trigger_levelup',
      group: ' 系统测试',
      name: ' 测试升级弹窗',
      desc: '模拟一次升级动画',
      execute: () => {
        CurrencyManager.addHuayuan(200);
        CurrencyManager.addStamina(30);
        CurrencyManager.addDiamond(10);
        EventBus.emit('level:up', LevelManager.level, { huayuan: 200, stamina: 30, diamond: 10 });
        return ' 已触发升级弹窗（已入账+飞入预览）';
      },
    });

    this._commands.push({
      id: 'force_save',
      group: ' 系统测试',
      name: ' 立即存档',
      desc: '手动触发一次存档',
      execute: () => {
        SaveManager.save();
        return ' 存档已保存';
      },
    });

    this._commands.push({
      id: 'show_state',
      group: ' 系统测试',
      name: ' 显示游戏状态',
      desc: '打印当前各系统状态摘要',
      execute: () => {
        const cs = CurrencyManager.state;
        const cells = BoardManager.cells;
        const openCount = cells.filter(c => c.state === CellState.OPEN).length;
        const itemCount = cells.filter(c => c.itemId).length;
        const lines = [
          `${cs.level}星 累计${cs.star}星`,
          `花愿${cs.huayuan} ${cs.diamond} ${cs.stamina} 许愿${FlowerSignTicketManager.count}`,
          `棋盘: ${openCount}格开放, ${itemCount}物品`,
          `签到: 连续${CheckInManager.consecutiveDays}天 累计${CheckInManager.totalSignedDays} 虚拟+${CheckInManager.gmDateOffsetDays}天`,
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
      group: ' 装修系统',
      name: ' +500 花愿',
      desc: '大量花愿用于购买装修',
      execute: () => {
        CurrencyManager.addHuayuan(500);
        return ` +500花愿，当前: ${CurrencyManager.state.huayuan}`;
      },
    });

    this._commands.push({
      id: 'open_deco_panel',
      group: ' 装修系统',
      name: ' 打开装修面板',
      desc: '直接打开花店装修面板',
      execute: () => {
        EventBus.emit('nav:openDeco');
        return ' 已打开装修面板';
      },
    });

    this._commands.push({
      id: 'unlock_all_deco',
      group: ' 装修系统',
      name: ' 解锁全部装修',
      desc: '解锁所有家具装饰 + 全部房间风格（无视场景/等级/花愿，不扣款不加星）',
      execute: () => {
        const decos = DecorationManager.gmUnlockAllDecos();
        const styles = DecorationManager.gmUnlockAllRoomStyles();
        SaveManager.save();
        return ` 装饰 +${decos} 件，房间风格 +${styles} 套（总计已解锁 ${DecorationManager.unlockedCount}/${DecorationManager.totalCount} 装饰）`;
      },
    });

    this._commands.push({
      id: 'reset_deco',
      group: ' 装修系统',
      name: ' 重置装修数据',
      desc: '清除所有装修存档',
      execute: () => {
        PersistService.remove('huahua_decoration');
        DecorationManager.reset();
        return ' 装修数据已清除';
      },
    });

    this._commands.push({
      id: 'open_room_editor',
      group: ' 装修系统',
      name: ' 打开房间编辑器',
      desc: '在花店场景中进入编辑模式',
      execute: () => {
        EventBus.emit('nav:switchToShop');
        setTimeout(() => EventBus.emit('furniture:edit_enabled'), 500);
        return ' 切换到花店场景并进入编辑模式';
      },
    });

    this._commands.push({
      id: 'reset_room_layout',
      group: ' 装修系统',
      name: ' 重置房间布局',
      desc: '清除家具摆放数据，恢复默认布局',
      execute: () => {
        PersistService.remove('huahua_room_layout');
        RoomLayoutManager.reset();
        return ' 房间布局已重置为默认';
      },
    });

    this._commands.push({
      id: 'fill_room',
      group: ' 装修系统',
      name: ' 填充全部家具',
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
        return ` 已解锁全部装饰，新放入房间 ${placed} 件（其余因场景限制仅解锁未摆放）`;
      },
    });

    this._commands.push({
      id: 'calibrate_deco_scales',
      group: ' 装修系统',
      name: ' 校准：全解锁+全摆放',
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
        return ` 装饰 +${unlocked}，风格 +${styles}，新放入 ${placed} 件，请在花店编辑模式逐件调整缩放`;
      },
    });

    this._commands.push({
      id: 'export_furniture_scales',
      group: ' 装修系统',
      name: ' 导出缩放配置',
      desc: 'Console 分段日志 + 本地 Storage（不需剪贴板隐私）',
      execute: () => {
        const layout = RoomLayoutManager.getLayout();
        if (!layout || layout.length === 0) {
          return ' 房间内没有家具';
        }
        const scaleMap: Record<string, number> = {};
        for (const p of layout) {
          scaleMap[p.decoId] = Math.round(p.scale * 100) / 100;
        }
        const json = JSON.stringify(scaleMap, null, 2);
        logLongStringToConsole('[GM] 家具缩放 defaultScale JSON', json);
        console.log('[GM] ===== END =====');
        try {
          PersistService.writeRaw(GM_STORAGE_EXPORT_SCALES, json);
        } catch (_) {
          console.warn('[GM] 写入本地存储失败');
        }
        return ` ${layout.length} 件已导出：① 看 Console 分段 [GM export i/n] ② 开发者工具→调试→Storage→键「${GM_STORAGE_EXPORT_SCALES}」可复制全文`;
      },
    });

    // ========== GM 设置 ==========

    // ==========  新系统调试 ==========
    this._commands.push({
      id: 'start_event',
      group: ' 新系统',
      name: ' 开启限时活动',
      desc: '开启春·樱花祭活动(7天)',
      execute: () => {
        EventManager.startEvent(0, 7);
        return ' 春·樱花祭活动已开启！';
      },
    });

    this._commands.push({
      id: 'open_collection',
      group: ' 新系统',
      name: ' 打开图鉴',
      desc: '打开图鉴收集面板',
      execute: () => {
        EventBus.emit('panel:openCollection');
        return ' 已打开图鉴面板';
      },
    });

    this._commands.push({
      id: 'open_dressup',
      group: ' 新系统',
      name: ' 打开换装',
      desc: '打开店主换装面板',
      execute: () => {
        EventBus.emit('panel:openDressUp');
        return ' 已打开换装面板';
      },
    });

    if (ENABLE_CHALLENGE_LEVEL_FEATURE) {
      this._commands.push({
        id: 'open_challenge',
        group: ' 新系统',
        name: ' 打开挑战关卡',
        desc: '打开挑战关卡面板',
        execute: () => {
          EventBus.emit('panel:openChallenge');
          return ' 已打开挑战关卡';
        },
      });
    }

    // ========== 升星仪式 ==========
    this._commands.push({
      id: 'gm_simulate_levelup',
      group: ' 升星仪式',
      name: ' 模拟升星仪式（下一级）',
      desc: '弹出当前等级 → 下一级的升星弹窗（含开放卡片）',
      execute: () => {
        const cur = LevelManager.level;
        const next = Math.max(cur + 1, 1);
        EventBus.emit('level:up', next, {
          huayuan: 100,
          stamina: 20,
          diamond: 5,
        }, cur);
        return ` 已模拟升星 ${cur} → ${next}`;
      },
    });

    this._commands.push({
      id: 'gm_preview_unlock_def',
      group: ' 升星仪式',
      name: ' 预览：当前级开放清单',
      desc: 'console 打印 LEVEL_UNLOCKS 当前等级条目',
      execute: () => {
        const lv = LevelManager.level;
        const def = getLevelUnlockDef(lv);
        if (!def) return ` Lv.${lv} 无升星仪式条目`;
        console.log(`[GM][LevelUnlock] Lv.${lv} - ${def.ceremonyTitle}`);
        for (const e of def.entries) {
          console.log(`  · [${e.kind}] ${e.title} - ${e.desc}`);
        }
        return ` Lv.${lv} 共 ${def.entries.length} 张开放卡片：${def.ceremonyTitle}`;
      },
    });

    // ========== 熟客系统 ==========
    for (const def of AFFINITY_DEFS) {
      this._commands.push({
        id: `gm_affinity_unlock_${def.typeId}`,
        group: ' 熟客系统',
        name: ` 解锁熟客 · ${def.bondName}`,
        desc: `${def.persona}`,
        execute: () => {
          AffinityManager.unlockForLevel(99);
          return ` ${def.bondName} 已解锁`;
        },
      });
    }

    this._commands.push({
      id: 'gm_affinity_reset',
      group: ' 熟客系统',
      name: ' 重置熟客留言/专属队列',
      desc: '清空近期留言/专属订单冷却（不影响图鉴）',
      execute: () => {
        AffinityManager.gmReset();
        return ' 熟客辅助状态已重置';
      },
    });

    this._commands.push({
      id: 'gm_affinity_open_profile_first',
      group: ' 熟客系统',
      name: ' 打开友谊图鉴（首位）',
      desc: '直接打开首位熟客的友谊图鉴页',
      execute: () => {
        const first = AFFINITY_DEFS[0];
        if (!first) return ' 无熟客配置';
        EventBus.emit('affinityCodex:open', first.typeId);
        return ` 已打开 ${first.bondName} 图鉴`;
      },
    });

    // ========== 卡牌系统 ==========
    this._commands.push({
      id: 'gm_affinity_card_open_codex',
      group: ' 卡牌系统',
      name: ' 打开图鉴（首位有卡熟客）',
      desc: '直接弹 AffinityCodexPanel 到首位有卡定义的熟客 tab',
      execute: () => {
        const first = AFFINITY_CARDS[0];
        if (!first) return ' 无卡定义';
        EventBus.emit('affinityCodex:open', first.ownerTypeId);
        return ` 已打开图鉴：${first.ownerTypeId}`;
      },
    });

    this._commands.push({
      id: 'gm_affinity_card_simulate_normal',
      group: ' 卡牌系统',
      name: ' 模拟一次订单掉卡（小诗）',
      desc: '按当前掉率/未拥有池模拟一次卡牌掉落（仅小诗）',
      execute: () => {
        AffinityCardManager.gmSimulateDrop('student');
        return ' 已模拟订单掉卡（事件已发，无卡掉时静默）';
      },
    });

    for (const rarity of CARD_RARITIES) {
      this._commands.push({
        id: `gm_affinity_card_grant_${rarity}_student`,
        group: ' 卡牌系统',
        name: ` 直发一张 ${rarity} 卡（小诗）`,
        desc: `从小诗未拥有的 ${rarity} 卡池中随机直发一张（已拥有则计为重复并发对应奖励）`,
        execute: () => {
          const pool = AFFINITY_CARDS.filter(c =>
            c.ownerTypeId === 'student' && c.rarity === (rarity as CardRarity)
          );
          if (pool.length === 0) return ` 小诗无 ${rarity} 卡定义`;
          const pick = pool[Math.floor(Math.random() * pool.length)]!;
          AffinityCardManager.gmGrantCard(pick.id);
          return ` 已发：${pick.id} ${pick.title}`;
        },
      });
    }

    this._commands.push({
      id: 'gm_affinity_card_grant_all_student',
      group: ' 卡牌系统',
      name: ' 一键全收：小诗',
      desc: '直接 12 张全收，演示「全图鉴」效果',
      execute: () => {
        AffinityCardManager.gmGrantAllForType('student');
        return ' 小诗 12 张已全收';
      },
    });

    this._commands.push({
      id: 'gm_affinity_card_grant_all_athlete',
      group: ' 卡牌系统',
      name: ' 一键全收：小翼',
      desc: '直接 12 张全收，演示小翼的全图鉴效果',
      execute: () => {
        AffinityCardManager.gmGrantAllForType('athlete');
        return ' 小翼 12 张已全收';
      },
    });

    this._commands.push({
      id: 'gm_affinity_card_grant_all_celebrity',
      group: ' 卡牌系统',
      name: ' 一键全收：曜辰',
      desc: '直接 12 张全收，演示曜辰的全图鉴效果',
      execute: () => {
        AffinityCardManager.gmGrantAllForType('celebrity');
        return ' 曜辰 12 张已全收';
      },
    });

    this._commands.push({
      id: 'gm_affinity_card_reset',
      group: ' 卡牌系统',
      name: ' 重置卡牌进度',
      desc: '清空所有客人的拥有卡 + 已领里程碑 + 已领赛季大奖 + 保底计数 + 今日掉卡额度',
      execute: () => {
        AffinityCardManager.gmReset();
        return ' 卡牌进度已重置';
      },
    });

    this._commands.push({
      id: 'gm_affinity_card_reset_daily_quota',
      group: ' 卡牌系统',
      name: ' 重置今日掉卡额度',
      desc: `把"今日已掉 X/${AffinityCardManager.todayDropQuota().limit}"刷回 0，便于反复验证掉卡（不动卡册进度）`,
      execute: () => {
        AffinityCardManager.gmResetDailyQuota();
        const q = AffinityCardManager.todayDropQuota();
        return ` 今日额度已重置：${q.used}/${q.limit}`;
      },
    });

    // ========== 离线 / 开店糖果 ==========
    this._commands.push({
      id: 'gm_simulate_offline_return',
      group: ' 离线/糖果',
      name: ' 模拟离线 1 小时回归',
      desc: '把 lastOnlineTimestamp 回拨 1h，下次进游戏弹离线收益面板',
      execute: () => {
        const now = Date.now();
        const oneHourAgo = now - 3600 * 1000;
        try {
          PersistService.writeRaw('huahua_idle', JSON.stringify({ lastOnlineTimestamp: oneHourAgo }));
        } catch (_) {}
        // 立即触发一次结算与弹窗
        const reward = IdleManager.calculateOfflineReward();
        if (reward) {
          EventBus.emit('panel:showOfflineReward', reward);
        }
        return reward
          ? ` 已模拟 1h 离线，物品 ${reward.producedItems.length} 件，花愿 +${reward.huayuanEarned}`
          : ' 模拟成功但无可结算收益';
      },
    });

    this._commands.push({
      id: 'gm_force_daily_candy',
      group: ' 离线/糖果',
      name: ' 强制弹今日糖果',
      desc: '清今日糖果记录后，立即弹离线/糖果面板',
      execute: () => {
        DailyCandyManager.gmReset();
        const reward = IdleManager.calculateOfflineReward();
        if (reward) {
          EventBus.emit('panel:showOfflineReward', reward);
        }
        return reward
          ? ` 已强制弹糖果（连签 ${reward.dailyCandy?.consecutiveDays ?? 0} 天）`
          : ' 强制后仍无可弹内容';
      },
    });

    this._commands.push({
      id: 'gm_set_consecutive_3',
      group: ' 离线/糖果',
      name: ' 连签设为 3 天',
      desc: '触发「连签 3 天 · 鲜花礼包」里程碑',
      execute: () => {
        CheckInManager.gmSetConsecutiveDays(3);
        DailyCandyManager.gmReset();
        return ' 连签=3，下次糖果触发 3 天里程碑';
      },
    });

    this._commands.push({
      id: 'gm_set_consecutive_7',
      group: ' 离线/糖果',
      name: ' 连签设为 7 天',
      desc: '触发「连签 7 天 · 周礼包」里程碑',
      execute: () => {
        CheckInManager.gmSetConsecutiveDays(7);
        DailyCandyManager.gmReset();
        return ' 连签=7，下次糖果触发 7 天里程碑';
      },
    });

    this._commands.push({
      id: 'gm_set_consecutive_30',
      group: ' 离线/糖果',
      name: ' 连签设为 30 天',
      desc: '触发「连签 30 天 · 熟客盲盒」里程碑',
      execute: () => {
        CheckInManager.gmSetConsecutiveDays(30);
        DailyCandyManager.gmReset();
        return ' 连签=30，下次糖果触发 30 天熟客盲盒';
      },
    });

    this._commands.push({
      id: 'disable_gm',
      group: ' GM设置',
      name: ' 关闭GM模式',
      desc: '关闭GM面板访问权限',
      execute: () => {
        this._enabled = false;
        this._saveState();
        return ' GM模式已关闭，顶栏商店与菜单间空白区连点 5 次可再次激活';
      },
    });
  }

  // ====== 持久化 ======

  private _saveState(): void {
    try {
      PersistService.writeRaw(GM_STORAGE_KEY, JSON.stringify({ enabled: this._enabled }));
    } catch (_) {}
  }

  private _loadState(): void {
    if (!this._runtimeAllowed) {
      this._enabled = false;
      return;
    }

    try {
      const raw = PersistService.readRaw(GM_STORAGE_KEY);
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
          console.log('[GM]  开发者工具环境，自动激活GM模式');
        }
      } catch (_) {}
    }
  }

  private _detectSimulatorRuntime(): boolean {
    try {
      const sysInfo = _api?.getSystemInfoSync?.();
      return sysInfo?.platform === 'devtools';
    } catch (_) {
      return false;
    }
  }
}

export const GMManager = new GMManagerClass();
