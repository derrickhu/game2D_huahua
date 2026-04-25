/**
 * 熟客（Loyal Customer）系统配置
 *
 * V2 设计（2026-04 改版）：
 *  - 去掉 Bond 等级 / 里程碑 / Lv5 buff，改由「友谊卡 + 图鉴 + 赛季」承接收集驱动；
 *  - 这里只剩：解锁等级 / 留言模板 / 名字/人设
 *  - 集齐里程碑奖励 / 重复卡奖励 / 赛季配置 → AffinityCardConfig.ts
 *
 * Manager 见 src/managers/AffinityManager.ts。
 */

import { Category, FlowerLine, DrinkLine } from './ItemConfig';

/** 熟客的解锁等级（玩家 globalLevel 达到时由 LevelManager 解锁） */
export const AFFINITY_UNLOCK_LEVELS: Record<string, number> = {
  student: 4,
  athlete: 5,
  celebrity: 6,
  worker: 7,
  mom: 8,
  youth: 9,
};

/** 离线/糖果留言：避重窗口长度 */
export const AFFINITY_NOTE_AVOID_RECENT_N = 3;

// ============================================================================
// 熟客详细配置
// ============================================================================

export interface AffinityFavoriteLine {
  category: Category;
  line: string;
  /** 偏好权重（用于随机抽取该熟客的专属订单 line；越大越倾向） */
  weight?: number;
}

export interface AffinityCustomerDef {
  /** 与 CustomerConfig.CUSTOMER_TYPES.id 一致 */
  typeId: string;
  /** 熟客名（覆盖 CUSTOMER_TYPES.name 用于熟客面板；订单上仍用原名） */
  bondName: string;
  /** 一句话人设（熟客资料卡） */
  persona: string;
  /** 喜爱的产线（当前仅保留角色设定语义，后续可用于轻量表现） */
  favoriteLines: AffinityFavoriteLine[];
  /** 离线留言模板（pickRandomAffinityNote 抽签）；可包含 {name} 占位 */
  notes: string[];
}

export const AFFINITY_DEFS: AffinityCustomerDef[] = [
  {
    typeId: 'student',
    bondName: '小诗',
    persona: '准备毕业晚会的学生少女，偏爱清新鲜花与甜品',
    favoriteLines: [
      { category: Category.FLOWER, line: FlowerLine.FRESH, weight: 2 },
      { category: Category.DRINK, line: DrinkLine.DESSERT, weight: 1 },
    ],
    notes: [
      '小诗放学顺路来店里，留了张便条说「明天考试，老板加油」。',
      '小诗在桌上留了一束你给的花，说想拿去送给闺蜜。',
      '门口便签：「老板，今天那束粉康乃馨真好看~」—— 小诗',
      '小诗经过窗外，朝你的店挥了挥手。',
    ],
  },
  {
    typeId: 'worker',
    bondName: '阿凯',
    persona: '加班到晚的程序员，常买咖啡续命；偶尔挑束花给同事庆生',
    favoriteLines: [
      { category: Category.DRINK, line: DrinkLine.COLD, weight: 2 },
      { category: Category.FLOWER, line: FlowerLine.BOUQUET, weight: 1 },
    ],
    notes: [
      '阿凯丢了张便利贴：「明天还来，记得给我留杯冷萃。」',
      '阿凯的工位拍照发来：花已经摆上同事桌啦。',
      '阿凯说：「凌晨两点路过，看见店里灯还亮，心安。」',
      '阿凯挂在门把上的咖啡券：「下次给我打折哦~」',
    ],
  },
  {
    typeId: 'mom',
    bondName: '林姐',
    persona: '带娃的温柔妈妈，喜欢把客厅插满应季花',
    favoriteLines: [
      { category: Category.FLOWER, line: FlowerLine.FRESH, weight: 1 },
      { category: Category.FLOWER, line: FlowerLine.GREEN, weight: 2 },
    ],
    notes: [
      '林姐在朋友圈晒了你那盆绿萝，配文「越养越精神」。',
      '林姐留言：「孩子今早把昨天的花瓣全捡起来了，可爱死。」',
      '林姐顺手带了一袋自家烤的小饼干放在柜台。',
      '林姐路过窗外，朝里挥手，孩子在童车里也学着挥手。',
    ],
  },
  {
    typeId: 'youth',
    bondName: '小景',
    persona: '写诗的文艺青年，常买花做静物拍摄道具',
    favoriteLines: [
      { category: Category.FLOWER, line: FlowerLine.BOUQUET, weight: 2 },
      { category: Category.DRINK, line: DrinkLine.BUTTERFLY, weight: 1 },
    ],
    notes: [
      '小景在窗台留了张诗签：「春迟一日，花语漫长。」',
      '小景发来今天为你的店拍的照片，光线刚刚好。',
      '小景说：「门口那束蝴蝶兰挪一下角度更上镜。」',
      '小景路过门口，远远朝你比了个手势：拍照 OK。',
    ],
  },
  {
    typeId: 'athlete',
    bondName: '小翼',
    persona: '高中篮球队队长，训练后总带着汗意和笑意来店里；赛前爱买花送教练，场下也很会照顾人',
    favoriteLines: [
      { category: Category.DRINK, line: DrinkLine.COLD, weight: 2 },
      { category: Category.FLOWER, line: FlowerLine.GREEN, weight: 1 },
    ],
    notes: [
      '小翼把篮球往脚边一抵，笑着留话：「老板，今晚决赛，花先替我加油。」',
      '小翼发来更衣室合照：「教练把那束花摆在最中间了，兄弟们都说好看。」',
      '小翼拎着冰饮路过门口，冲你扬了扬手：「训练结束，来拿我的幸运花。」',
      '小翼擦着汗冲进来：「老板，给我一束看起来稳赢的！」',
    ],
  },
  {
    typeId: 'celebrity',
    bondName: '曜辰',
    persona: '正准备巡演的当红歌手，台上星光耀眼，台下却会认真替每一场演出挑花和香气',
    favoriteLines: [
      { category: Category.FLOWER, line: FlowerLine.BOUQUET, weight: 2 },
      { category: Category.DRINK, line: DrinkLine.DESSERT, weight: 1 },
    ],
    notes: [
      '曜辰戴着口罩来取花，临走前在卡片背面写了句：「今晚的灯海，也想有你的颜色。」',
      '曜辰发来后台返图：你包的那束香槟玫瑰，正放在麦克风旁边。',
      '曜辰笑着说：「巡演城市会换，但每次上台前想闻到的花香差不多。」',
      '曜辰的助理把花先取走了，留下一句口信：「他说谢幕后会亲自来道谢。」',
    ],
  },
];

/** 按 typeId 索引 */
export const AFFINITY_MAP = new Map<string, AffinityCustomerDef>(
  AFFINITY_DEFS.map(d => [d.typeId, d]),
);

/** 取首发解锁的 typeId 列表 */
export function getAffinityUnlocksAtLevel(level: number): string[] {
  return Object.entries(AFFINITY_UNLOCK_LEVELS)
    .filter(([, lv]) => lv === level)
    .map(([id]) => id);
}

/** 全部熟客 typeId */
export function listAllAffinityTypeIds(): string[] {
  return AFFINITY_DEFS.map(d => d.typeId);
}
