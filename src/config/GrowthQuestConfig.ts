/**
 * 成长之路（新手成长任务）：5 章 × 6 条并行任务表。
 *
 * 与「每日挑战」（`DailyChallengeConfig`）的区别：成长任务是**一次性**的长线引导，
 * 章内任务可任意顺序完成，全章 6/6 后可领章节大奖并开启下一章。
 *
 * 数值口径见文件末尾 `GROWTH_BALANCE_BASELINE`：每章的家具 / 订单目标都压在
 * 「玩家自然打到该星级时的实际下界」的 80%～95%，既不白送也不卡关。
 *
 * 工具补给只走「每章 1 次 × 1 个 1 级工具」，全部挂在章节大奖上（见 `CHAPTER_TOOL`）；
 * 前期目前只补鲜花铲 / 花束铁丝两条长链路（以后可按需加其它工具线，不做白名单拦截）。
 * 章内任务改发 5 级以上成品花 / 绿植 / 花束（见 `GIFT_*`）。
 * 「1 级 / 每次 1 个 / 一章 1 次」由 `assertGrowthRewardsValid` 强制。
 */
import { CRYSTAL_BALL_ITEM_ID, GOLDEN_SCISSORS_ITEM_ID, ITEM_DEFS, InteractType, LUCKY_COIN_ITEM_ID } from '@/config/ItemConfig';
import {
  WORKSHOP_DYE_BLUE_ID,
  WORKSHOP_DYE_GREEN_ID,
  WORKSHOP_DYE_YELLOW_ID,
  WORKSHOP_MATERIAL_ID,
  WORKSHOP_NOVICE_BLUEPRINT_ID,
} from '@/config/FurnitureWorkshopConfig';

/**
 * 任务进度的统计口径。
 *
 * - **snapshot**（快照）：每次求值时直接读当前游戏状态，天然可追溯 —— 老玩家装上本系统后，
 *   已达成的目标立刻显示完成。
 * - **counter**（累计）：靠 EventBus 累加，只能从本系统生效那一刻开始记，无法追溯历史。
 *
 * 因此**能用 snapshot 的一律用 snapshot**，counter 只留给「过程型」目标（合成次数、许愿次数等）。
 */
export type GrowthMetricMode = 'snapshot' | 'counter';

export enum GrowthMetric {
  /** 当前全局星级（快照） */
  Level = 'level',
  /** 已拥有家具种类数，不含房间样式（快照） */
  DecoOwned = 'decoOwned',
  /** 所有装修场景已摆放家具总数（快照） */
  DecoPlaced = 'decoPlaced',
  /** 图鉴已发现「鲜花线」种类数，不含花束/绿植/包装（快照） */
  FlowerKinds = 'flowerKinds',
  /** 友谊卡持有总张数，含重复张（快照） */
  AffinityCards = 'affinityCards',
  /** 工坊已制作过的「图纸+配色」种类数（快照） */
  WorkshopCrafted = 'workshopCrafted',
  /** 已解锁店主形象套装数（快照） */
  OutfitOwned = 'outfitOwned',
  /** 已解锁房屋数（快照） */
  HouseUnlocked = 'houseUnlocked',
  /** 指定物品是否已进图鉴，0/1（快照，需配 targetItemId） */
  ItemDiscovered = 'itemDiscovered',

  /** 棋盘合成次数（累计） */
  MergeCount = 'mergeCount',
  /** 订单交付数（累计） */
  DeliverCount = 'deliverCount',
  /** 许愿喷泉抽奖次数（累计） */
  FountainDrawCount = 'fountainDrawCount',
  /** 「当日全部每日挑战达成」次数（累计） */
  DailyAllCompleteCount = 'dailyAllCompleteCount',
}

export const GROWTH_METRIC_MODE: Readonly<Record<GrowthMetric, GrowthMetricMode>> = {
  [GrowthMetric.Level]: 'snapshot',
  [GrowthMetric.DecoOwned]: 'snapshot',
  [GrowthMetric.DecoPlaced]: 'snapshot',
  [GrowthMetric.FlowerKinds]: 'snapshot',
  [GrowthMetric.AffinityCards]: 'snapshot',
  [GrowthMetric.WorkshopCrafted]: 'snapshot',
  [GrowthMetric.OutfitOwned]: 'snapshot',
  [GrowthMetric.HouseUnlocked]: 'snapshot',
  [GrowthMetric.ItemDiscovered]: 'snapshot',
  [GrowthMetric.MergeCount]: 'counter',
  [GrowthMetric.DeliverCount]: 'counter',
  [GrowthMetric.FountainDrawCount]: 'counter',
  [GrowthMetric.DailyAllCompleteCount]: 'counter',
};

export function isCounterMetric(metric: GrowthMetric): boolean {
  return GROWTH_METRIC_MODE[metric] === 'counter';
}

/** 单条任务/章节大奖的奖励内容；字段可任意组合 */
export interface GrowthReward {
  huayuan?: number;
  stamina?: number;
  diamond?: number;
  /** 许愿喷泉硬币（走 `FlowerSignTicketManager`，非收纳盒物品） */
  flowerSignTickets?: number;
  /**
   * 棋盘物品（走 `RewardBoxManager`）。工具类受三条铁律约束，见 `assertGrowthRewardsValid`：
   * **必须 1 级**、**每次只给 1 个**、**一章内只能出现 1 次**。
   */
  items?: ReadonlyArray<{ itemId: string; count: number }>;
  /** 工坊材料（锤子 / 分色染料），走 `FurnitureWorkshopManager.addMaterial` */
  workshopMaterials?: ReadonlyArray<{ materialId: string; count: number }>;
  /** 赠送工坊图纸，走 `FurnitureWorkshopManager.grantBlueprint`；已拥有则静默跳过 */
  blueprintId?: string;
}

export interface GrowthTaskDef {
  id: string;
  /** 任务列表里显示的一行中文目标 */
  title: string;
  metric: GrowthMetric;
  target: number;
  /** metric 为 ItemDiscovered 时的目标物品 id */
  targetItemId?: string;
  reward: GrowthReward;
  /**
   * 任务未达标时「前往」按钮要跳的 EventBus 事件名；缺省则不显示按钮。
   * 例：`nav:openShop`、`panel:openFurnitureWorkshop`。
   */
  gotoEvent?: string;
  /**
   * 玩家等级低于此值时该任务显示为「N 星后开启」且不计进度。
   * 用于目标本身被等级门锁住的任务（工坊 6 星、大地图 8 星等），避免玩家干瞪眼。
   */
  requireLevel?: number;
}

export interface GrowthChapterDef {
  id: string;
  /** 章节标题，如「初开花店」 */
  title: string;
  /** 章节副标题：本章要把玩家带到哪 */
  subtitle: string;
  tasks: ReadonlyArray<GrowthTaskDef>;
  /** 全章 6/6 后的章节大奖 */
  chapterReward: GrowthReward;
  /** 章节大奖卡上显示的礼包名 */
  chapterRewardLabel: string;
}

/**
 * 工具补给：**每章只在「章节大奖」这一处发 1 个 1 级工具**。
 *
 * 放在章节大奖而不是任务奖励里，是因为这样「一章一次」由结构本身保证 —— 任务奖励里再也不会
 * 出现工具，不可能手滑在一章内发两次（`assertGrowthRewardsValid` 另有兜底校验）。
 *
 * **只补两条最长链路**：鲜花园艺铲（`tool_plant_1`）与花束包装铁丝（`tool_arrange_1`）。
 * 冷饮 / 烘焙等短线不走成长之路送，靠自然掉落与升星礼包即可。
 *
 * 节奏：前两章补铲子（开局主产线）；花束线约 5 星开放，第 3、4 章补铁丝；终章再回一把铲子。
 */
const CHAPTER_TOOL: Readonly<Record<string, string>> = {
  ch1: 'tool_plant_1',
  ch2: 'tool_plant_1',
  ch3: 'tool_arrange_1',
  ch4: 'tool_arrange_1',
  ch5: 'tool_plant_1',
};

/**
 * 章节内任务的「中高级样品」奖励：直接送 5 级以上成品花 / 绿植 / 花束。
 *
 * 用来替代过去成串发 1 级工具的做法 —— 玩家拿到就能交一笔大额订单，或摆回棋盘继续往上合，
 * 即时收益比一把铲子明显，又不会替玩家跳过温室线的养成。
 * 档位口径对齐升星礼包（`LevelUnlockConfig`：3 星送 `flower_green_6`、7 星送 `flower_bouquet_5`）。
 */
const GIFT_FRESH_LV5 = 'flower_fresh_5';       // 康乃馨
const GIFT_FRESH_LV6 = 'flower_fresh_6';       // 玫瑰
const GIFT_GREEN_LV6 = 'flower_green_6';       // 虎皮兰
const GIFT_BOUQUET_LV5 = 'flower_bouquet_5';   // 阳光田园束
const GIFT_BOUQUET_LV6 = 'flower_bouquet_6';   // 缎带玫瑰礼束

export const GROWTH_CHAPTERS: ReadonlyArray<GrowthChapterDef> = [
  {
    id: 'ch1',
    title: '初开花店',
    subtitle: '认识棋盘与订单，把小店开起来',
    tasks: [
      {
        id: 'g1_merge_50',
        title: '在棋盘上合成 50 次',
        metric: GrowthMetric.MergeCount,
        target: 50,
        reward: { stamina: 20 },
      },
      {
        id: 'g1_deliver_10',
        title: '完成 10 个客人订单',
        metric: GrowthMetric.DeliverCount,
        target: 10,
        reward: { items: [{ itemId: GIFT_FRESH_LV5, count: 1 }] },
      },
      {
        id: 'g1_deco_buy_3',
        title: '购买 3 件家具',
        metric: GrowthMetric.DecoOwned,
        target: 3,
        reward: { items: [{ itemId: 'stamina_chest_1', count: 1 }] },
        gotoEvent: 'nav:openDecoration',
      },
      {
        id: 'g1_deco_place_3',
        title: '在房间摆放 3 件家具',
        metric: GrowthMetric.DecoPlaced,
        target: 3,
        reward: { diamond: 10 },
        gotoEvent: 'nav:openDecoration',
      },
      {
        id: 'g1_flower_kinds_4',
        title: '图鉴收集 4 种鲜花',
        metric: GrowthMetric.FlowerKinds,
        target: 4,
        reward: { items: [{ itemId: 'chest_1', count: 1 }] },
      },
      {
        id: 'g1_level_2',
        title: '花店达到 2 星',
        metric: GrowthMetric.Level,
        target: 2,
        reward: { flowerSignTickets: 3 },
      },
    ],
    chapterReward: { items: [{ itemId: CHAPTER_TOOL.ch1, count: 1 }], stamina: 50 },
    chapterRewardLabel: '园艺补给箱',
  },
  {
    id: 'ch2',
    title: '花语初绽',
    subtitle: '结识常客，试试许愿喷泉',
    tasks: [
      {
        id: 'g2_affinity_card_1',
        title: '获得 1 张友谊卡',
        metric: GrowthMetric.AffinityCards,
        target: 1,
        reward: { stamina: 30 },
      },
      {
        id: 'g2_flower_kinds_6',
        title: '图鉴收集 6 种鲜花',
        metric: GrowthMetric.FlowerKinds,
        target: 6,
        reward: { items: [{ itemId: GIFT_FRESH_LV6, count: 1 }] },
      },
      {
        id: 'g2_deliver_30',
        title: '累计完成 30 个订单',
        metric: GrowthMetric.DeliverCount,
        target: 30,
        reward: { items: [{ itemId: 'stamina_chest_1', count: 1 }], diamond: 5 },
      },
      {
        id: 'g2_deco_buy_5',
        title: '累计拥有 5 件家具',
        metric: GrowthMetric.DecoOwned,
        target: 5,
        reward: { items: [{ itemId: 'hongbao_3', count: 1 }] },
        gotoEvent: 'nav:openDecoration',
      },
      {
        id: 'g2_fountain_1',
        title: '在许愿喷泉许愿 1 次',
        metric: GrowthMetric.FountainDrawCount,
        target: 1,
        reward: { flowerSignTickets: 5 },
        gotoEvent: 'panel:openFlowerSignGacha',
        requireLevel: 3,
      },
      {
        id: 'g2_level_4',
        title: '花店达到 4 星',
        metric: GrowthMetric.Level,
        target: 4,
        reward: { items: [{ itemId: LUCKY_COIN_ITEM_ID, count: 1 }] },
      },
    ],
    chapterReward: { items: [{ itemId: CHAPTER_TOOL.ch2, count: 1 }], stamina: 60 },
    chapterRewardLabel: '园艺补给箱 II',
  },
  {
    id: 'ch3',
    title: '匠坊初启',
    subtitle: '解锁家具工坊，亲手做出第一件家具',
    tasks: [
      {
        /**
         * 本条是工坊闭环的起点：奖励里的图纸 + 8 锤子 + 2 蓝染料，刚好够做出
         * 新手图纸的「默认色」与「天蓝色」两件（见 FurnitureWorkshopConfig 新手图纸注释），
         * 正好接上 g3_workshop_craft_1 与 g4_workshop_craft_2。
         */
        id: 'g3_level_6',
        title: '花店达到 6 星，解锁家具工坊',
        metric: GrowthMetric.Level,
        target: 6,
        reward: {
          blueprintId: WORKSHOP_NOVICE_BLUEPRINT_ID,
          workshopMaterials: [
            { materialId: WORKSHOP_MATERIAL_ID, count: 8 },
            { materialId: WORKSHOP_DYE_BLUE_ID, count: 2 },
          ],
        },
      },
      {
        id: 'g3_workshop_craft_1',
        title: '在工坊制作 1 件家具',
        metric: GrowthMetric.WorkshopCrafted,
        target: 1,
        reward: {
          workshopMaterials: [{ materialId: WORKSHOP_MATERIAL_ID, count: 6 }],
          diamond: 10,
        },
        gotoEvent: 'panel:openFurnitureWorkshop',
        requireLevel: 6,
      },
      {
        id: 'g3_deco_place_8',
        title: '房间累计摆放 8 件家具',
        metric: GrowthMetric.DecoPlaced,
        target: 8,
        reward: { items: [{ itemId: CRYSTAL_BALL_ITEM_ID, count: 1 }] },
        gotoEvent: 'nav:openDecoration',
      },
      {
        id: 'g3_flower_kinds_8',
        title: '图鉴收集 8 种鲜花',
        metric: GrowthMetric.FlowerKinds,
        target: 8,
        reward: { items: [{ itemId: GIFT_GREEN_LV6, count: 1 }] },
      },
      {
        id: 'g3_affinity_cards_6',
        title: '累计获得 6 张友谊卡',
        metric: GrowthMetric.AffinityCards,
        target: 6,
        reward: { flowerSignTickets: 5 },
      },
      {
        id: 'g3_deliver_55',
        title: '累计完成 55 个订单',
        metric: GrowthMetric.DeliverCount,
        target: 55,
        reward: { items: [{ itemId: 'chest_1', count: 2 }] },
      },
    ],
    chapterReward: {
      items: [{ itemId: CHAPTER_TOOL.ch3, count: 1 }],
      workshopMaterials: [{ materialId: WORKSHOP_DYE_YELLOW_ID, count: 1 }],
    },
    chapterRewardLabel: '花束匠人礼盒',
  },
  {
    id: 'ch4',
    title: '花坊有名',
    subtitle: '走出小店，去大地图开新铺子',
    tasks: [
      {
        id: 'g4_level_8',
        title: '花店达到 8 星，解锁大地图',
        metric: GrowthMetric.Level,
        target: 8,
        reward: { items: [{ itemId: 'stamina_chest_1', count: 2 }] },
      },
      {
        id: 'g4_house_2',
        title: '在大地图解锁 2 处房屋',
        metric: GrowthMetric.HouseUnlocked,
        target: 2,
        reward: { diamond: 20 },
        gotoEvent: 'worldmap:open',
        requireLevel: 8,
      },
      {
        id: 'g4_bouquet_3',
        title: '合成出「晴彩郁金香」花束',
        metric: GrowthMetric.ItemDiscovered,
        target: 1,
        targetItemId: 'flower_bouquet_3',
        reward: { items: [{ itemId: GIFT_BOUQUET_LV5, count: 1 }] },
      },
      {
        id: 'g4_workshop_craft_2',
        title: '工坊累计制作 2 件家具',
        metric: GrowthMetric.WorkshopCrafted,
        target: 2,
        reward: {
          workshopMaterials: [
            { materialId: WORKSHOP_MATERIAL_ID, count: 10 },
            { materialId: WORKSHOP_DYE_BLUE_ID, count: 1 },
          ],
        },
        gotoEvent: 'panel:openFurnitureWorkshop',
        requireLevel: 6,
      },
      {
        id: 'g4_deliver_75',
        title: '累计完成 75 个订单',
        metric: GrowthMetric.DeliverCount,
        target: 75,
        reward: { items: [{ itemId: GOLDEN_SCISSORS_ITEM_ID, count: 1 }] },
      },
      {
        id: 'g4_merge_600',
        title: '累计合成 600 次',
        metric: GrowthMetric.MergeCount,
        target: 600,
        reward: { flowerSignTickets: 8 },
      },
    ],
    chapterReward: {
      items: [{ itemId: CHAPTER_TOOL.ch4, count: 1 }],
      diamond: 30,
    },
    chapterRewardLabel: '花束补给箱',
  },
  {
    id: 'ch5',
    title: '花开满城',
    subtitle: '成为花艺大师，把小店经营成招牌',
    tasks: [
      {
        id: 'g5_level_10',
        title: '花店达到 10 星',
        metric: GrowthMetric.Level,
        target: 10,
        reward: { items: [{ itemId: GIFT_BOUQUET_LV6, count: 1 }] },
      },
      {
        id: 'g5_flower_kinds_9',
        title: '图鉴收集 9 种鲜花',
        metric: GrowthMetric.FlowerKinds,
        target: 9,
        reward: { items: [{ itemId: 'diamond_bag_1', count: 1 }] },
      },
      {
        id: 'g5_deco_place_16',
        title: '房间累计摆放 16 件家具',
        metric: GrowthMetric.DecoPlaced,
        target: 16,
        reward: { workshopMaterials: [{ materialId: WORKSHOP_DYE_GREEN_ID, count: 1 }] },
        gotoEvent: 'nav:openDecoration',
      },
      {
        id: 'g5_affinity_cards_18',
        title: '累计获得 12 张友谊卡',
        metric: GrowthMetric.AffinityCards,
        target: 12,
        reward: { flowerSignTickets: 10 },
      },
      {
        id: 'g5_outfit_3',
        title: '解锁 3 套店主形象',
        metric: GrowthMetric.OutfitOwned,
        target: 3,
        reward: { diamond: 20 },
        gotoEvent: 'panel:openDressUp',
      },
      {
        id: 'g5_daily_all_1',
        title: '完成 1 次「当日全部每日挑战」',
        metric: GrowthMetric.DailyAllCompleteCount,
        target: 1,
        reward: { diamond: 20 },
        gotoEvent: 'nav:openQuest',
      },
    ],
    chapterReward: {
      items: [
        { itemId: 'chest_1', count: 3 },
        { itemId: CHAPTER_TOOL.ch5, count: 1 },
      ],
      diamond: 50,
      flowerSignTickets: 10,
    },
    chapterRewardLabel: '花艺大师礼包',
  },
];

export const GROWTH_CHAPTER_MAP: ReadonlyMap<string, GrowthChapterDef> = new Map(
  GROWTH_CHAPTERS.map(c => [c.id, c]),
);

const GROWTH_TASK_INDEX: ReadonlyMap<string, { task: GrowthTaskDef; chapter: GrowthChapterDef }> = new Map(
  GROWTH_CHAPTERS.flatMap(chapter => chapter.tasks.map(task => [task.id, { task, chapter }] as const)),
);

export function getGrowthTask(taskId: string): GrowthTaskDef | undefined {
  return GROWTH_TASK_INDEX.get(taskId)?.task;
}

export function getGrowthChapterOfTask(taskId: string): GrowthChapterDef | undefined {
  return GROWTH_TASK_INDEX.get(taskId)?.chapter;
}

export function getGrowthChapter(chapterId: string): GrowthChapterDef | undefined {
  return GROWTH_CHAPTER_MAP.get(chapterId);
}

/** 章节在 `GROWTH_CHAPTERS` 中的序号（0 起）；未知章节返回 -1 */
export function growthChapterIndex(chapterId: string): number {
  return GROWTH_CHAPTERS.findIndex(c => c.id === chapterId);
}

/**
 * 各章「玩家自然打到目标星级时的实际下界」，来自对 `DecorationConfig` / `OrderHuayuanConfig` /
 * `StarLevelConfig` 的推算：按 starValue/cost 效率最优买家具凑够升星所需星星，
 * 再按各阶订单花愿均值反推至少要交付多少单。
 *
 * 用法：任务目标应贴着下界取值（本表落在 80%～95%），既不白送也不卡关。
 * `assertGrowthRewardsValid()` 用它做**上界**校验，容差见 `BASELINE_TOLERANCE`。
 */
export const GROWTH_BALANCE_BASELINE: ReadonlyArray<{
  chapterId: string;
  targetLevel: number;
  minDecoOwned: number;
  minDeliverCount: number;
}> = [
  { chapterId: 'ch1', targetLevel: 2, minDecoOwned: 1, minDeliverCount: 10 },
  { chapterId: 'ch2', targetLevel: 4, minDecoOwned: 5, minDeliverCount: 32 },
  { chapterId: 'ch3', targetLevel: 6, minDecoOwned: 11, minDeliverCount: 59 },
  { chapterId: 'ch4', targetLevel: 8, minDecoOwned: 13, minDeliverCount: 83 },
  { chapterId: 'ch5', targetLevel: 10, minDecoOwned: 20, minDeliverCount: 95 },
];

function collectRewardItems(r: GrowthReward): ReadonlyArray<{ itemId: string; count: number }> {
  return r.items ?? [];
}

/**
 * 目标相对下界的允许上浮比例。留 20% 是因为引导型任务（如第 1 章「买 3 件家具」）
 * 本身就是教操作，可以略高于「升到 2 星最少要买几件」的理论下界。
 */
const BASELINE_TOLERANCE = 1.2;
/** 下界很小时（如 1 件家具）按比例算会过严，给一个绝对地板 */
const BASELINE_FLOOR = 3;

function baselineUpperBound(min: number): number {
  return Math.max(Math.ceil(min * BASELINE_TOLERANCE), BASELINE_FLOOR);
}

/**
 * DEV 期配置自检。故意做成「抛错」而不是打日志：
 * 奖励表手滑（尤其是塞进 2 级以上工具）会直接破坏「高级温室必须自己攒」的核心长线目标，
 * 必须在开发阶段就炸出来，不能带到线上。
 */
export function assertGrowthRewardsValid(): void {
  const errors: string[] = [];
  const seenTaskIds = new Set<string>();

  const checkReward = (where: string, r: GrowthReward): void => {
    for (const { itemId, count } of collectRewardItems(r)) {
      const def = ITEM_DEFS.get(itemId);
      if (!def) {
        errors.push(`${where}: 未知物品 id "${itemId}"`);
        continue;
      }
      if (count <= 0) errors.push(`${where}: 物品 "${itemId}" 数量必须为正，实际 ${count}`);
      if (def.interactType === InteractType.TOOL) {
        // 铁律 1：只允许 1 级。高级工具必须由玩家 2 合 1 自己攒。
        if (def.level !== 1) {
          errors.push(`${where}: 工具奖励只允许 1 级，"${itemId}" 是 ${def.level} 级`);
        }
        // 铁律 2：每次只给 1 个。成串发工具等于替玩家把低级料凑好，长线目标就没了。
        if (count !== 1) {
          errors.push(`${where}: 工具奖励每次只能给 1 个，"${itemId}" 给了 ${count} 个`);
        }
      }
    }
    for (const { materialId, count } of r.workshopMaterials ?? []) {
      if (count <= 0) errors.push(`${where}: 工坊材料 "${materialId}" 数量必须为正`);
    }
  };

  for (const chapter of GROWTH_CHAPTERS) {
    if (chapter.tasks.length === 0) errors.push(`章节 ${chapter.id}: 任务表为空`);

    for (const task of chapter.tasks) {
      if (seenTaskIds.has(task.id)) errors.push(`任务 id 重复: "${task.id}"`);
      seenTaskIds.add(task.id);

      if (task.target <= 0) errors.push(`任务 ${task.id}: target 必须为正`);
      if (task.metric === GrowthMetric.ItemDiscovered) {
        if (!task.targetItemId) {
          errors.push(`任务 ${task.id}: metric=itemDiscovered 必须配 targetItemId`);
        } else if (!ITEM_DEFS.has(task.targetItemId)) {
          errors.push(`任务 ${task.id}: targetItemId "${task.targetItemId}" 不存在`);
        }
      }
      checkReward(`任务 ${task.id}`, task.reward);
    }

    checkReward(`章节大奖 ${chapter.id}`, chapter.chapterReward);

    // 铁律 3：一章内只能发 1 次工具（任务奖励 + 章节大奖合起来算）。
    const toolSlots = [
      ...chapter.tasks.map(t => ({ where: `任务 ${t.id}`, reward: t.reward })),
      { where: `章节大奖 ${chapter.id}`, reward: chapter.chapterReward },
    ].filter(slot => collectRewardItems(slot.reward).some(
      ({ itemId }) => ITEM_DEFS.get(itemId)?.interactType === InteractType.TOOL,
    ));
    if (toolSlots.length > 1) {
      errors.push(
        `章节 ${chapter.id}: 一章内只能发 1 次工具，实际有 ${toolSlots.length} 处（${toolSlots.map(s => s.where).join('、')}）`,
      );
    }

    const baseline = GROWTH_BALANCE_BASELINE.find(b => b.chapterId === chapter.id);
    if (!baseline) {
      errors.push(`章节 ${chapter.id}: 缺少 GROWTH_BALANCE_BASELINE 条目`);
      continue;
    }
    for (const task of chapter.tasks) {
      if (task.metric === GrowthMetric.DecoOwned) {
        const cap = baselineUpperBound(baseline.minDecoOwned);
        if (task.target > cap) {
          errors.push(
            `任务 ${task.id}: 家具目标 ${task.target} 超过 ${baseline.targetLevel} 星下界 ${baseline.minDecoOwned} 的容许上限 ${cap}，会卡关`,
          );
        }
      }
      if (task.metric === GrowthMetric.DeliverCount) {
        const cap = baselineUpperBound(baseline.minDeliverCount);
        if (task.target > cap) {
          errors.push(
            `任务 ${task.id}: 订单目标 ${task.target} 超过 ${baseline.targetLevel} 星下界 ${baseline.minDeliverCount} 的容许上限 ${cap}，会卡关`,
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`[GrowthQuestConfig] 配置校验失败:\n- ${errors.join('\n- ')}`);
  }
}
