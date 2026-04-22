/**
 * 熟客友谊卡 + 图鉴系统 — 配置数据
 *
 * 数据驱动 AffinityCardManager（src/managers/AffinityCardManager.ts）：
 *  - 4 档稀有度 N/R/SR/SSR：积分（推 Bond）、掉落权重、重复转碎片
 *  - 抽卡概率：普通单 / 专属单 base chance + 稀有度档位偏移
 *  - S1 首发卡册：小诗/阿凯/林姐 各 12 张（共 36 张）
 *
 * 接入点：
 *  - 由 AffinityManager.onCustomerDelivered 触发（FF AFFINITY_CARD_SYSTEM_ENABLED=true 时）
 *  - 卡片积分 → 同步到 AffinityEntryState.points → 推 Bond 等级
 *
 * 美术：
 *  - 卡面 PNG 路径建议 minigame/subpkg_chars/images/affinity_cards/card_<typeId>_<rarity>_<idx>.png
 *  - 缺图时 fallback 到 customer_<typeId> 大头照 + 卡框
 */

// ============================================================================
// 稀有度
// ============================================================================

export type CardRarity = 'N' | 'R' | 'SR' | 'SSR';

export const CARD_RARITIES: readonly CardRarity[] = ['N', 'R', 'SR', 'SSR'] as const;

/** 单卡积分（合并入 Bond 累计点） */
export const CARD_RARITY_POINTS: Record<CardRarity, number> = {
  N: 1,
  R: 3,
  SR: 8,
  SSR: 25,
};

/** 抽到时的稀有度概率分布（百分比，总和 100） */
export const CARD_RARITY_DROP_WEIGHTS: Record<CardRarity, number> = {
  N: 70,
  R: 22,
  SR: 7,
  SSR: 1,
};

/** 重复卡转友谊点 */
export const SHARD_PER_DUP: Record<CardRarity, number> = {
  N: 1,
  R: 3,
  SR: 8,
  SSR: 25,
};

/** 稀有度展示色（卡框边色 / 光环） */
export const CARD_RARITY_COLOR: Record<CardRarity, number> = {
  N: 0xB0BEC5,    // 灰白
  R: 0x64B5F6,    // 蓝
  SR: 0xBA68C8,   // 紫
  SSR: 0xFFC107,  // 金
};

/** 稀有度展示中文 */
export const CARD_RARITY_LABEL: Record<CardRarity, string> = {
  N: '日常',
  R: '侧写',
  SR: '故事',
  SSR: '高光',
};

// ============================================================================
// 抽卡参数
// ============================================================================

/** 一次「是否掉卡」的基础概率 */
export const CARD_DROP_BASE_CHANCE = 0.35;
/** 专属订单交付的掉卡概率（覆盖 base） */
export const CARD_DROP_EXCLUSIVE_CHANCE = 0.85;
/** 专属订单稀有度档位偏移（N→R, R→SR, SR→SSR, SSR→SSR） */
export const CARD_DROP_EXCLUSIVE_RARITY_BUMP = 1;
/** 专属订单二张卡触发概率（在已掉一张后再 roll） */
export const CARD_DROP_EXCLUSIVE_SECOND_CHANCE = 0.30;

/** 保底：累计 N 次抽卡未出 SR/SSR → 强制 SR */
export const PITY_TO_SR_THRESHOLD = 30;
/** 保底：累计 N 次抽卡未出 SSR → 强制 SSR */
export const PITY_TO_SSR_THRESHOLD = 100;

// ============================================================================
// 友谊点商店
// ============================================================================

/** 指定稀有度卡包（必出该客人 + 该稀有度，从未得卡里抽；全得则给重复 + 双倍碎片） */
export const SHARD_PACK_COSTS: Record<CardRarity, number> = {
  N: 5,
  R: 18,
  SR: 60,
  SSR: 220,
};

/** Bond 直升 1 等的道具（仅 Lv1~4 可用） */
export const SHARD_BOND_PUSH_COST = 100;

// ============================================================================
// 单卡定义
// ============================================================================

export interface AffinityCardUnlocks {
  /** SSR 专属：解锁的赛季限定家具 deco id（DecorationConfig 中需有定义；P1 demo 阶段可不填） */
  decoId?: string;
  /** 解锁该熟客在 CustomerView 偶发气泡里的额外语录 */
  quoteId?: string;
  /** 解锁的称号（图鉴满图鉴大奖另外计算，本字段是单卡级别的小称号） */
  titleId?: string;
}

export interface AffinityCardDef {
  /** 主键，建议 `card_<typeId>_<idx>`，例 `card_student_01` */
  id: string;
  /** 归属熟客 typeId（与 AffinityConfig.AffinityCustomerDef.typeId 一致） */
  ownerTypeId: string;
  /** 稀有度 */
  rarity: CardRarity;
  /** 卡片标题（4~10 字） */
  title: string;
  /** 微剧情正文（1~3 句，建议 ≤ 120 字；CodexPanel 详情页展示） */
  story: string;
  /** 卡面美术 key（TextureCache）；缺省时 fallback 到 customer_<ownerTypeId> + 滤镜 */
  artKey?: string;
  /** 解锁附加内容 */
  unlocks?: AffinityCardUnlocks;
}

// ============================================================================
// S1 卡册：小诗 / 阿凯 / 林姐 各 12 张（共 36 张）
// ============================================================================
//
// 每位结构：N×6 / R×3 / SR×2 / SSR×1
// SSR 卡面美术 P1 demo 阶段可不补，先用立绘 fallback；P2 美术上来后回填 artKey + decoId

const _STUDENT_CARDS: AffinityCardDef[] = [
  // ── N×6 日常 ──
  { id: 'card_student_01', ownerTypeId: 'student', rarity: 'N',
    title: '放学路过',
    story: '小诗刚下数学课，背着帆布包路过窗前。她朝你眨眨眼，没进来——「下次再买！」' },
  { id: 'card_student_02', ownerTypeId: 'student', rarity: 'N',
    title: '门口便利贴',
    story: '门把上贴着张便利贴：「老板，今天那束粉康乃馨真好看~」字迹圆圆软软，像她的笑。' },
  { id: 'card_student_03', ownerTypeId: 'student', rarity: 'N',
    title: '拍照打卡',
    story: '小诗举着手机在橱窗外拍了五分钟，最后挑了花艺台的角落发了朋友圈。定位写：花花妙屋。' },
  { id: 'card_student_04', ownerTypeId: 'student', rarity: 'N',
    title: '考前应援',
    story: '考试前一天，小诗带走一束向日葵，「老师说要给我们鼓掌的人，我先给自己买好。」' },
  { id: 'card_student_05', ownerTypeId: 'student', rarity: 'N',
    title: '操场远眺',
    story: '黄昏时她在操场看台远远望见亮起灯的店铺，跟同学说：「那家花店的老板特别会插花。」' },
  { id: 'card_student_06', ownerTypeId: 'student', rarity: 'N',
    title: '雨天分享',
    story: '下大雨那天，小诗冲进店里躲雨，把自己的伞硬塞给你，说她还有一把在书包里。' },

  // ── R×3 侧写 ──
  { id: 'card_student_07', ownerTypeId: 'student', rarity: 'R',
    title: '校园书桌',
    story: '小诗送来一张她中学时代的小书桌照片：上面摆满你的花，旁边压着一沓考卷和一只褪色的橡皮。',
    unlocks: { quoteId: 'student_q_studydesk' } },
  { id: 'card_student_08', ownerTypeId: 'student', rarity: 'R',
    title: '闺蜜成团',
    story: '她带了三个同学一起来，每人挑一束送给将来的自己。「这家店要被我们承包了。」' },
  { id: 'card_student_09', ownerTypeId: 'student', rarity: 'R',
    title: '校友录',
    story: '小诗在校友录的「最难忘的角落」一栏写下你的店名。她说每次推门，都像走进青春的封面。' },

  // ── SR×2 故事 ──
  { id: 'card_student_10', ownerTypeId: 'student', rarity: 'SR',
    title: '毕业典礼前夜',
    story: '毕业典礼前一晚，小诗预订了 27 朵向日葵，给班级 27 个人。她说要让每个人都被记得。' },
  { id: 'card_student_11', ownerTypeId: 'student', rarity: 'SR',
    title: '献给老师',
    story: '小诗悄悄留下一束铃兰，「请帮我送给我的语文老师，明天她退休。」她转身跑得飞快。' },

  // ── SSR×1 高光 ──
  { id: 'card_student_12', ownerTypeId: 'student', rarity: 'SSR',
    title: '毕业日的花束',
    story: '毕业那天清晨，小诗推门进来，把全班同学集资的钱一股脑放在柜台。「老板，请帮我们做一束最美的，像我们最好的样子。」她流着泪笑。',
    unlocks: { quoteId: 'student_q_graduation', titleId: 'title_student_witness' } },
];

const _WORKER_CARDS: AffinityCardDef[] = [
  // ── N×6 日常 ──
  { id: 'card_worker_01', ownerTypeId: 'worker', rarity: 'N',
    title: '凌晨打卡',
    story: '凌晨两点，阿凯路过你的店，看见灯还亮，扶着门框喘了口气：「老板，又是你和我。」' },
  { id: 'card_worker_02', ownerTypeId: 'worker', rarity: 'N',
    title: '工牌小花',
    story: '阿凯工牌上别了你那束花里掉下来的一朵小满天星，到下班还没有谢。' },
  { id: 'card_worker_03', ownerTypeId: 'worker', rarity: 'N',
    title: '通勤的窗',
    story: '地铁在你店门口的高架上经过时，他每次都会朝窗外看一眼。今天他第一次看见你也在朝他挥手。' },
  { id: 'card_worker_04', ownerTypeId: 'worker', rarity: 'N',
    title: '快递便利贴',
    story: '阿凯给你寄来一袋程序员同款挂耳咖啡，便利贴上写：「续命用，互相尊重。」' },
  { id: 'card_worker_05', ownerTypeId: 'worker', rarity: 'N',
    title: '同事庆生',
    story: '同事生日，阿凯破天荒来店里挑了束玫瑰：「不是浪漫，是公司组的份子。」嘴硬。' },
  { id: 'card_worker_06', ownerTypeId: 'worker', rarity: 'N',
    title: '周五特调',
    story: '每个周五晚上他都会来续一杯冷萃。「这是我跟自己的契约：撑过本周。」' },

  // ── R×3 侧写 ──
  { id: 'card_worker_07', ownerTypeId: 'worker', rarity: 'R',
    title: '通勤咖啡角',
    story: '阿凯发来照片：他工位上多了一个迷你咖啡角，最显眼的位置摆着你那只杯子。「以后每天都看见你。」',
    unlocks: { quoteId: 'worker_q_coffeecorner' } },
  { id: 'card_worker_08', ownerTypeId: 'worker', rarity: 'R',
    title: '项目上线',
    story: '阿凯凌晨四点冲进店里：「老板，发版了！来束最贵的，给我自己。」眼眶通红。' },
  { id: 'card_worker_09', ownerTypeId: 'worker', rarity: 'R',
    title: '团队下午茶',
    story: '阿凯包了你店里所有的甜品，给整个加班的小组送过去。「老板，发票要分十张开。」' },

  // ── SR×2 故事 ──
  { id: 'card_worker_10', ownerTypeId: 'worker', rarity: 'SR',
    title: '程序员节',
    story: '10 月 24 日，阿凯穿着 1024 文化衫来店里，要了 1024 朵满天星，要送给写代码的所有人。' },
  { id: 'card_worker_11', ownerTypeId: 'worker', rarity: 'SR',
    title: '凌晨四点的拥抱',
    story: '上线那夜，整个小组路过你的店。阿凯第一次张开手抱了你一下：「谢谢你这一年没让我崩溃。」' },

  // ── SSR×1 高光 ──
  { id: 'card_worker_12', ownerTypeId: 'worker', rarity: 'SSR',
    title: '离职花束',
    story: '阿凯换工作那天，最后一次推门进来。「老板，我要走了。」他放下一只信封：「这是给你的，下家公司在花花妙屋楼上。我们还做邻居。」',
    unlocks: { quoteId: 'worker_q_farewell', titleId: 'title_worker_partner' } },
];

const _MOM_CARDS: AffinityCardDef[] = [
  // ── N×6 日常 ──
  { id: 'card_mom_01', ownerTypeId: 'mom', rarity: 'N',
    title: '童车进店',
    story: '林姐推着童车小心地避开你店门口的台阶。孩子在车里仰头看花，忍不住伸手。' },
  { id: 'card_mom_02', ownerTypeId: 'mom', rarity: 'N',
    title: '客厅插画',
    story: '林姐说：「我家客厅的画不会换，但花要每周都换。」于是你的店成了她的星期二日程。' },
  { id: 'card_mom_03', ownerTypeId: 'mom', rarity: 'N',
    title: '朋友圈晒图',
    story: '林姐朋友圈晒了你那盆绿萝，配文：「越养越精神，可惜不是我养的。」收到点赞 38 个。' },
  { id: 'card_mom_04', ownerTypeId: 'mom', rarity: 'N',
    title: '小饼干',
    story: '林姐顺手把自家烤的小饼干放在柜台。「这是赠品，你不收我下次不来了。」' },
  { id: 'card_mom_05', ownerTypeId: 'mom', rarity: 'N',
    title: '童车挥手',
    story: '林姐路过窗外冲你挥手，孩子在童车里学着妈妈，把小手举得高高。' },
  { id: 'card_mom_06', ownerTypeId: 'mom', rarity: 'N',
    title: '换季问候',
    story: '入秋第一天，林姐特意发来微信：「记得给店里换换花，秋天要有秋天的样子。」' },

  // ── R×3 侧写 ──
  { id: 'card_mom_07', ownerTypeId: 'mom', rarity: 'R',
    title: '阳台花架',
    story: '林姐发来阳台照片：你帮她搭的花架已经塞满，孩子在地上仰着脸喊她「快看！」',
    unlocks: { quoteId: 'mom_q_balcony' } },
  { id: 'card_mom_08', ownerTypeId: 'mom', rarity: 'R',
    title: '家庭小派对',
    story: '林姐家办亲子派对，全部花艺由你负责。她说她朋友们看完都问：「这家店在哪？」' },
  { id: 'card_mom_09', ownerTypeId: 'mom', rarity: 'R',
    title: '邻居推荐',
    story: '林姐拉了 5 个小区妈妈进群，群名「花花妙屋姐妹团」。她在群里 @ 你：「老板出来收花。」' },

  // ── SR×2 故事 ──
  { id: 'card_mom_10', ownerTypeId: 'mom', rarity: 'SR',
    title: '母亲节惊喜',
    story: '母亲节那天，林姐在店门口哭出了声——孩子的爸爸偷偷订了一束你做的花，附卡：「辛苦了。」' },
  { id: 'card_mom_11', ownerTypeId: 'mom', rarity: 'SR',
    title: '宝宝第一句',
    story: '林姐发来视频：孩子指着你店门口的花，奶声奶气地说出第一个字——「花」。' },

  // ── SSR×1 高光 ──
  { id: 'card_mom_12', ownerTypeId: 'mom', rarity: 'SSR',
    title: '全家福里的花艺',
    story: '林姐家年度全家福挂上了客厅。爸爸妈妈和孩子站在中间，背景是你为她家做的整面花墙。「老板，我家最重要的一年，有你的痕迹。」',
    unlocks: { quoteId: 'mom_q_familyportrait', titleId: 'title_mom_witness' } },
];

/** S1 全部卡（按客人解锁等级排序） */
export const AFFINITY_CARDS: AffinityCardDef[] = [
  ..._STUDENT_CARDS,
  ..._WORKER_CARDS,
  ..._MOM_CARDS,
];

/** id → def */
export const AFFINITY_CARD_MAP = new Map<string, AffinityCardDef>(
  AFFINITY_CARDS.map(c => [c.id, c]),
);

/** 按 ownerTypeId 索引（含未解锁客人的空数组） */
export function getCardsByOwner(typeId: string): AffinityCardDef[] {
  return AFFINITY_CARDS.filter(c => c.ownerTypeId === typeId);
}

/** 按 owner+稀有度索引 */
export function getCardsByOwnerAndRarity(typeId: string, rarity: CardRarity): AffinityCardDef[] {
  return AFFINITY_CARDS.filter(c => c.ownerTypeId === typeId && c.rarity === rarity);
}

/** 该熟客是否有任意卡定义（用于 manager 早退） */
export function hasCardsForOwner(typeId: string): boolean {
  return AFFINITY_CARDS.some(c => c.ownerTypeId === typeId);
}

// ============================================================================
// 老存档迁移：按当前 Bond 等级回填的卡数（仅展示用，不补发奖励）
// ============================================================================

import type { BondLevel } from './AffinityConfig';

/**
 * Bond 等级 → 该等级及以下应该已"看见"的卡片数（按稀有度）。
 * 玩家迁移时按下表从该客人卡池中**随机选**对应张数标记为已得；不补发任何奖励。
 *
 * 设计原则：
 *  - Lv1: 1 张 N（解锁感），Lv2: 3N+1R（熟脸），Lv3: 5N+2R（老友），
 *    Lv4: 6N+3R+1SR（知交，与原 Bond Lv4 主题家具呼应），
 *    Lv5: 6N+3R+2SR（知己，留 SSR 给玩家自己抽）
 */
export const LEGACY_BOND_TO_CARDS: Record<BondLevel, { N: number; R: number; SR: number }> = {
  1: { N: 1, R: 0, SR: 0 },
  2: { N: 3, R: 1, SR: 0 },
  3: { N: 5, R: 2, SR: 0 },
  4: { N: 6, R: 3, SR: 1 },
  5: { N: 6, R: 3, SR: 2 },
};

// ============================================================================
// 工具：稀有度档位偏移（用于专属单 bump）
// ============================================================================

const _RARITY_ORDER: CardRarity[] = ['N', 'R', 'SR', 'SSR'];

export function bumpRarity(r: CardRarity, by: number): CardRarity {
  const i = _RARITY_ORDER.indexOf(r);
  const j = Math.max(0, Math.min(_RARITY_ORDER.length - 1, i + by));
  return _RARITY_ORDER[j]!;
}

/** 加权随机抽稀有度 */
export function rollRarityByWeights(rng: () => number = Math.random): CardRarity {
  const total = CARD_RARITIES.reduce((s, r) => s + CARD_RARITY_DROP_WEIGHTS[r], 0);
  let r = rng() * total;
  for (const rarity of CARD_RARITIES) {
    r -= CARD_RARITY_DROP_WEIGHTS[rarity];
    if (r <= 0) return rarity;
  }
  return 'N';
}

