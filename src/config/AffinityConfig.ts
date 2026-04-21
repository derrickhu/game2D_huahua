/**
 * 熟客（Loyal Customer）系统配置
 *
 * 数据驱动 5 位首发熟客（与 CUSTOMER_TYPES 共用 typeId）：
 *  - 解锁等级、Bond 等级阈值、专属订单偏好（line / category 软偏好）
 *  - 留言模板（离线回归 / 关店糖果）、Bond 升级文案
 *  - milestoneRewards：每个 Bond 升级时发放的礼包；Lv4 主题家具用 itemId（DecorationConfig.id）
 *
 * Manager 见 src/managers/AffinityManager.ts。
 *
 * 设计参考：docs/规划稿（已收口）+ 用户拍板：
 *  - 解锁等级范围：L4-L8
 *  - Bond 共 5 级（1=初识 / 2=熟脸 / 3=老友 / 4=知交 / 5=知己）
 *  - Lv5 仅给软 buff（该熟客订单花愿 +10%）
 *  - 专属订单触发概率根据玩家等级动态：L4-6 0.20 / L7-9 0.15 / L10+ 0.12
 *  - 主题家具同时进入 DecorationConfig（待美术 5 件入库）
 */

import { Category, FlowerLine, DrinkLine } from './ItemConfig';

/** Bond 等级（1~5） */
export type BondLevel = 1 | 2 | 3 | 4 | 5;
export const BOND_MAX_LEVEL: BondLevel = 5;

/** 5 位首发熟客的解锁等级（玩家 globalLevel 达到时由 LevelManager 解锁） */
export const AFFINITY_UNLOCK_LEVELS: Record<string, number> = {
  student: 4,
  worker: 5,
  mom: 6,
  youth: 7,
  athlete: 8,
};

/** Bond 累计点数阈值（达到即升级）；点数仅由「该熟客订单交付」累加 */
export const BOND_THRESHOLDS: Record<BondLevel, number> = {
  1: 0,
  2: 5,
  3: 15,
  4: 30,
  5: 55,
};

/**
 * 普通订单交付：+1 Bond 点
 * 专属订单交付：+2 Bond 点
 */
export const BOND_GAIN_NORMAL = 1;
export const BOND_GAIN_EXCLUSIVE = 2;

/** 专属订单触发概率（按当前玩家全局等级取段） */
export function exclusiveOrderChanceByLevel(playerLevel: number): number {
  if (playerLevel >= 10) return 0.12;
  if (playerLevel >= 7) return 0.15;
  return 0.20;
}

/** 专属单完成花愿倍率（叠加在常规计算之上；与 challenge 倍率独立） */
export const EXCLUSIVE_ORDER_HUAYUAN_MULTIPLIER = 2;

/** 专属单交付额外随礼（必给） */
export const EXCLUSIVE_ORDER_BONUS = {
  stamina: 5,
  flowerSignTickets: 1,
} as const;

/** Bond Lv5「知己」buff：该熟客订单花愿 +10%（仅普通单；专属单已有 ×2） */
export const BOND_L5_SOFT_BUFF_MULT = 1.1;

/** 防连续同熟客上单（与普通客人 _lastSpawnTypeId 复用同一规则） */
export const AFFINITY_EXCLUSIVE_AVOID_RECENT = true;

/** 单个熟客的「专属单」内部冷却（最近 N 次刷客内最多触发 1 次） */
export const AFFINITY_EXCLUSIVE_PER_TYPE_COOLDOWN = 4;

/** 离线/糖果留言：避重窗口长度 */
export const AFFINITY_NOTE_AVOID_RECENT_N = 3;

// ============================================================================
// 5 位首发熟客详细配置
// ============================================================================

export interface AffinityFavoriteLine {
  category: Category;
  line: string;
  /** 偏好权重（用于随机抽取该熟客的专属订单 line；越大越倾向） */
  weight?: number;
}

export interface AffinityMilestoneReward {
  bondLevel: BondLevel;
  /** 文字标题（升级弹窗显示） */
  title: string;
  /** 内容描述（升级弹窗副文案） */
  desc: string;
  /** 立即结算奖励 */
  huayuan?: number;
  diamond?: number;
  stamina?: number;
  flowerSignTickets?: number;
  /** 主题家具 deco id（仅 Lv4 一件，未到位时仅展示文案） */
  decoUnlockId?: string;
  /** 角色立绘 / 故事篇章 key（仅展示） */
  storyKey?: string;
}

export interface AffinityCustomerDef {
  /** 与 CustomerConfig.CUSTOMER_TYPES.id 一致 */
  typeId: string;
  /** 熟客名（覆盖 CUSTOMER_TYPES.name 用于熟客面板；订单上仍用原名） */
  bondName: string;
  /** 一句话人设（熟客资料卡） */
  persona: string;
  /** 喜爱的产线（专属订单生成时会软偏好这些 line） */
  favoriteLines: AffinityFavoriteLine[];
  /** Bond 升级文案/奖励（5 档；Lv1=解锁；Lv2~5 在累计交付达阈值时触发） */
  milestones: Record<BondLevel, AffinityMilestoneReward>;
  /** 离线留言模板（pickRandomAffinityNote 抽签）；可包含 {name} {bondLabel} 占位 */
  notes: string[];
}

const _BOND_LEVEL_LABELS: Record<BondLevel, string> = {
  1: '初识',
  2: '熟脸',
  3: '老友',
  4: '知交',
  5: '知己',
};

export function getBondLevelLabel(level: BondLevel): string {
  return _BOND_LEVEL_LABELS[level] ?? '初识';
}

export const AFFINITY_DEFS: AffinityCustomerDef[] = [
  // -------------------- L4 学生少女 --------------------
  {
    typeId: 'student',
    bondName: '小诗',
    persona: '准备毕业晚会的学生少女，偏爱清新鲜花与甜品',
    favoriteLines: [
      { category: Category.FLOWER, line: FlowerLine.FRESH, weight: 2 },
      { category: Category.DRINK, line: DrinkLine.DESSERT, weight: 1 },
    ],
    milestones: {
      1: { bondLevel: 1, title: '初次见面', desc: '小诗第一次走进了花花妙屋，记住了你的笑脸。' },
      2: {
        bondLevel: 2,
        title: '熟脸客人',
        desc: '小诗开始把这里当成放学路上的固定一站。',
        huayuan: 60,
        stamina: 5,
      },
      3: {
        bondLevel: 3,
        title: '放学约会',
        desc: '她会带同学过来挑花，订单越做越大胆。',
        huayuan: 120,
        diamond: 5,
        stamina: 10,
      },
      4: {
        bondLevel: 4,
        title: '校园书桌',
        desc: '小诗送来一张「校园书桌」摆件，记下与你共同的青春。',
        diamond: 10,
        flowerSignTickets: 2,
        decoUnlockId: 'affinity_student_desk',
      },
      5: {
        bondLevel: 5,
        title: '知己挚友',
        desc: '从今往后，小诗的订单收益永久 +10%。',
        diamond: 20,
        flowerSignTickets: 3,
      },
    },
    notes: [
      '小诗放学顺路来店里，留了张便条说「明天考试，老板加油」。',
      '小诗在桌上留了一束你给的花，说想拿去送给闺蜜。',
      '门口便签：「老板，今天那束粉康乃馨真好看~」—— 小诗',
      '小诗经过窗外，朝你的店挥了挥手。',
    ],
  },
  // -------------------- L5 上班族 --------------------
  {
    typeId: 'worker',
    bondName: '阿凯',
    persona: '加班到晚的程序员，常买咖啡续命；偶尔挑束花给同事庆生',
    favoriteLines: [
      { category: Category.DRINK, line: DrinkLine.COLD, weight: 2 },
      { category: Category.FLOWER, line: FlowerLine.BOUQUET, weight: 1 },
    ],
    milestones: {
      1: { bondLevel: 1, title: '加班路过', desc: '阿凯在加班路上推门而入，要了一杯冷萃。' },
      2: {
        bondLevel: 2,
        title: '常客',
        desc: '阿凯把这里收藏进了通勤路线，工牌上多了一朵小花。',
        huayuan: 80,
        stamina: 8,
      },
      3: {
        bondLevel: 3,
        title: '深夜战友',
        desc: '阿凯说：「老板你也加班？我请客！」并坚持多付了一份打赏。',
        huayuan: 160,
        diamond: 6,
        stamina: 12,
      },
      4: {
        bondLevel: 4,
        title: '通勤咖啡角',
        desc: '阿凯带来一台「通勤咖啡角」桌面摆件，献给同样熬夜的店主。',
        diamond: 12,
        flowerSignTickets: 2,
        decoUnlockId: 'affinity_worker_coffee_corner',
      },
      5: {
        bondLevel: 5,
        title: '深夜知己',
        desc: '阿凯订单永久 +10% 收益，是花花妙屋最靠谱的常客。',
        diamond: 22,
        flowerSignTickets: 3,
      },
    },
    notes: [
      '阿凯丢了张便利贴：「明天还来，记得给我留杯冷萃。」',
      '阿凯的工位拍照发来：花已经摆上同事桌啦。',
      '阿凯说：「凌晨两点路过，看见店里灯还亮，心安。」',
      '阿凯挂在门把上的咖啡券：「下次给我打折哦~」',
    ],
  },
  // -------------------- L6 温柔妈妈 --------------------
  {
    typeId: 'mom',
    bondName: '林姐',
    persona: '带娃的温柔妈妈，喜欢把客厅插满应季花',
    favoriteLines: [
      { category: Category.FLOWER, line: FlowerLine.FRESH, weight: 1 },
      { category: Category.FLOWER, line: FlowerLine.GREEN, weight: 2 },
    ],
    milestones: {
      1: { bondLevel: 1, title: '邻家妈妈', desc: '林姐推着童车进来，挑了一盆好养的小绿植。' },
      2: {
        bondLevel: 2,
        title: '客厅常驻',
        desc: '林姐家的客厅多了你的花，孩子会指着喊「店店！」',
        huayuan: 100,
        stamina: 10,
      },
      3: {
        bondLevel: 3,
        title: '家庭顾问',
        desc: '林姐让你帮忙挑当季花艺，说要做家里的小派对。',
        huayuan: 200,
        diamond: 8,
        stamina: 15,
      },
      4: {
        bondLevel: 4,
        title: '阳台花架',
        desc: '林姐送你一座「阳台花架」，作为家里那盆绿植的「老朋友」。',
        diamond: 14,
        flowerSignTickets: 2,
        decoUnlockId: 'affinity_mom_balcony_rack',
      },
      5: {
        bondLevel: 5,
        title: '邻家知己',
        desc: '林姐订单永久 +10% 收益，并答应把好邻居都介绍来花花妙屋。',
        diamond: 25,
        flowerSignTickets: 4,
      },
    },
    notes: [
      '林姐在朋友圈晒了你那盆绿萝，配文「越养越精神」。',
      '林姐留言：「孩子今早把昨天的花瓣全捡起来了，可爱死。」',
      '林姐顺手带了一袋自家烤的小饼干放在柜台。',
      '林姐路过窗外，朝里挥手，孩子在童车里也学着挥手。',
    ],
  },
  // -------------------- L7 文艺青年 --------------------
  {
    typeId: 'youth',
    bondName: '小景',
    persona: '写诗的文艺青年，常买花做静物拍摄道具',
    favoriteLines: [
      { category: Category.FLOWER, line: FlowerLine.BOUQUET, weight: 2 },
      { category: Category.DRINK, line: DrinkLine.BUTTERFLY, weight: 1 },
    ],
    milestones: {
      1: { bondLevel: 1, title: '取景灵感', desc: '小景把第一束花拍进了静物里，朋友圈赞了 99。' },
      2: {
        bondLevel: 2,
        title: '常驻模特',
        desc: '小景说：「下次帮你拍一组店内照片吧。」',
        huayuan: 110,
        stamina: 10,
      },
      3: {
        bondLevel: 3,
        title: '镜头之友',
        desc: '小景把你的店做成了文艺指南上的隐藏小店。',
        huayuan: 230,
        diamond: 9,
        stamina: 16,
      },
      4: {
        bondLevel: 4,
        title: '诗意书架',
        desc: '小景搬来一个「诗意书架」摆件，说花和书才是绝配。',
        diamond: 16,
        flowerSignTickets: 3,
        decoUnlockId: 'affinity_youth_book_rack',
      },
      5: {
        bondLevel: 5,
        title: '诗意知己',
        desc: '小景订单永久 +10% 收益，并把第一首店内主题诗送给你。',
        diamond: 28,
        flowerSignTickets: 4,
      },
    },
    notes: [
      '小景在窗台留了张诗签：「春迟一日，花语漫长。」',
      '小景发来今天为你的店拍的照片，光线刚刚好。',
      '小景说：「门口那束蝴蝶兰挪一下角度更上镜。」',
      '小景路过门口，远远朝你比了个手势：拍照 OK。',
    ],
  },
  // -------------------- L8 运动少年 --------------------
  {
    typeId: 'athlete',
    bondName: '小翼',
    persona: '准备校际比赛的运动少年，习惯赛前买花给教练；信赖电解质冷饮',
    favoriteLines: [
      { category: Category.DRINK, line: DrinkLine.COLD, weight: 2 },
      { category: Category.FLOWER, line: FlowerLine.GREEN, weight: 1 },
    ],
    milestones: {
      1: { bondLevel: 1, title: '赛前补给', desc: '小翼在比赛日前推门而入，要了一杯冷饮和一束鼓励花。' },
      2: {
        bondLevel: 2,
        title: '主场粉丝',
        desc: '小翼把你的店列入「赛前必打卡」。',
        huayuan: 130,
        stamina: 12,
      },
      3: {
        bondLevel: 3,
        title: '夺冠见证',
        desc: '小翼把奖牌照片发来：「冠军里有你一份功劳！」',
        huayuan: 260,
        diamond: 10,
        stamina: 20,
      },
      4: {
        bondLevel: 4,
        title: '冠军奖杯柜',
        desc: '小翼送来一座「冠军奖杯柜」，把胜利与你共享。',
        diamond: 18,
        flowerSignTickets: 3,
        decoUnlockId: 'affinity_athlete_trophy_case',
      },
      5: {
        bondLevel: 5,
        title: '赛场知己',
        desc: '小翼订单永久 +10% 收益，下次校际赛预留你 VIP 位。',
        diamond: 30,
        flowerSignTickets: 5,
      },
    },
    notes: [
      '小翼留下今早晨练打卡：「店没开就路过，下午再来。」',
      '小翼说：「教练赛后举着花拍照啦，很神气！」',
      '小翼拎来运动饮料丢柜台：「老板，互换一杯冷萃如何？」',
      '小翼擦着汗冲进来：「再给我一束鼓励花！」',
    ],
  },
];

/** 按 typeId 索引 */
export const AFFINITY_MAP = new Map<string, AffinityCustomerDef>(
  AFFINITY_DEFS.map(d => [d.typeId, d]),
);

/** 取首发解锁的 typeId 列表，按解锁等级排序 */
export function getAffinityUnlocksAtLevel(level: number): string[] {
  return Object.entries(AFFINITY_UNLOCK_LEVELS)
    .filter(([, lv]) => lv === level)
    .map(([id]) => id);
}

/** 全部熟客 typeId（含 5 位首发） */
export function listAllAffinityTypeIds(): string[] {
  return AFFINITY_DEFS.map(d => d.typeId);
}
