/**
 * 友谊卡 + 图鉴 + 赛季 — 配置数据
 *
 * 主线流程（V2 · Bond 已退场）：
 *  - 玩家给「赛季客人」交付订单 → AffinityCardManager.rollCardDrop 决定是否掉卡
 *  - 新卡 → 直接入图鉴；
 *  - 重复卡 → 立即按 DUPLICATE_REWARDS 派发花愿/钻石/体力（不再积"碎片"）
 *  - 单客人集齐 50% / 100% → CUSTOMER_MILESTONE_REWARDS 自动结算
 *  - 整赛季 100%（所有客人都集齐）→ SEASON_GRAND_REWARD
 *
 * 接入点：
 *  - AffinityManager.onCustomerDelivered → AffinityCardManager.rollCardDrop
 *  - AffinityCardManager 内部：里程碑触发自己结算并发事件
 *
 * 美术：
 *  - 卡面 PNG：minigame/subpkg_chars/images/affinity_cards/card_<typeId>_<idx>.png
 *  - 缺图时 fallback 到 customer_<typeId> 大头照 + 卡框
 */

// ============================================================================
// 稀有度
// ============================================================================

export type CardRarity = 'N' | 'R' | 'SR' | 'SSR';

export const CARD_RARITIES: readonly CardRarity[] = ['N', 'R', 'SR', 'SSR'] as const;

/** 抽到时的稀有度概率分布（百分比，总和 100） */
export const CARD_RARITY_DROP_WEIGHTS: Record<CardRarity, number> = {
  N: 70,
  R: 22,
  SR: 7,
  SSR: 1,
};

/** 稀有度展示色（卡框边色 / 光环） */
export const CARD_RARITY_COLOR: Record<CardRarity, number> = {
  N: 0xB0BEC5,
  R: 0x64B5F6,
  SR: 0xBA68C8,
  SSR: 0xFFC107,
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

/**
 * 友谊卡系统玩家解锁等级（含）。
 *  - 新手前 5 级专注「合成 + 出花 + 卖花」核心循环
 *  - Lv6 起开放「图鉴掉卡」，作为普通订单上的低频惊喜
 */
export const CARD_SYSTEM_UNLOCK_LEVEL = 6;

/** 一次「是否掉卡」的基础概率（普通订单）— 调低后约 1/10，留出惊喜感 */
export const CARD_DROP_BASE_CHANCE = 0.10;

/**
 * 每日全局掉卡上限。
 * 达到当日上限后所有客人订单当天都不再掉卡，但保底计数仍在累积，
 * 保证"每天最多 N 张惊喜，不打扰核心节奏"。
 * 按本地日历日切日（与签到 / 每日糖一致：UTC 偏移 + GM dateOffset）。
 */
export const CARD_DROP_DAILY_LIMIT = 3;

/** 保底：累计 N 次抽卡未出 SR/SSR → 强制 SR */
export const PITY_TO_SR_THRESHOLD = 30;
/** 保底：累计 N 次抽卡未出 SSR → 强制 SSR */
export const PITY_TO_SSR_THRESHOLD = 100;

// ============================================================================
// 重复卡奖励
// ============================================================================

export interface CardReward {
  huayuan?: number;
  diamond?: number;
  stamina?: number;
  flowerSignTickets?: number;
}

/** 重复卡按稀有度直发的奖励（V2：替代旧"友谊点碎片"） */
export const DUPLICATE_REWARDS: Record<CardRarity, CardReward> = {
  N:   { huayuan: 20 },
  R:   { huayuan: 80 },
  SR:  { huayuan: 300, stamina: 3 },
  SSR: { huayuan: 1500, diamond: 30, stamina: 10 },
};

// ============================================================================
// 单客人图鉴里程碑（每客 12 张卡 → 6 张 / 12 张两档）
// ============================================================================

export interface CustomerMilestone {
  /** 已收集卡数（≥ 即触发，非"恰好等于"） */
  threshold: number;
  /** 文案标题 */
  title: string;
  /** 文案描述（弹窗副文案） */
  desc: string;
  /** 即时结算奖励 */
  reward: CardReward;
  /** 集齐时解锁的限定家具（DecorationConfig.id） */
  decoUnlockId?: string;
  /** 该客人订单永久花愿 +X%（仅 100% 集齐档配置；1.10 = +10%） */
  permanentHuayuanMult?: number;
}

/**
 * 每位赛季客人的图鉴里程碑表。
 * 集齐 50% → 大额花愿 + 钻石；
 * 集齐 100% → 主题家具（复用旧 affinity_*）+ 该客人订单永久 +10% 花愿。
 */
export const CUSTOMER_MILESTONE_REWARDS: Record<string, CustomerMilestone[]> = {
  student: [
    { threshold: 6,  title: '半本成长志', desc: '小诗的图鉴已收齐一半，故事正展开。',
      reward: { huayuan: 500, diamond: 10 } },
    { threshold: 12, title: '青春全章', desc: '集齐小诗 12 张图鉴，「校园书桌」搬进了店铺。',
      reward: { huayuan: 1500, diamond: 30 },
      decoUnlockId: 'affinity_student_desk',
      permanentHuayuanMult: 1.1 },
  ],
  worker: [
    { threshold: 6,  title: '加班半部曲', desc: '阿凯的图鉴已收齐一半，深夜的故事还在续。',
      reward: { huayuan: 500, diamond: 10 } },
    { threshold: 12, title: '通勤全图鉴', desc: '集齐阿凯 12 张图鉴，「通勤咖啡角」永久入驻。',
      reward: { huayuan: 1500, diamond: 30 },
      decoUnlockId: 'affinity_worker_coffee_corner',
      permanentHuayuanMult: 1.1 },
  ],
  mom: [
    { threshold: 6,  title: '半页相册', desc: '林姐的图鉴已收齐一半，那本相册还在添新页。',
      reward: { huayuan: 500, diamond: 10 } },
    { threshold: 12, title: '一家相簿', desc: '集齐林姐 12 张图鉴，「阳台花架」搬进了店铺。',
      reward: { huayuan: 1500, diamond: 30 },
      decoUnlockId: 'affinity_mom_balcony_rack',
      permanentHuayuanMult: 1.1 },
  ],
  // 备用（S2 启用）
  youth: [
    { threshold: 6,  title: '半部诗集', desc: '小景的图鉴已收齐一半，灵感悄悄发酵。',
      reward: { huayuan: 500, diamond: 10 } },
    { threshold: 12, title: '诗意全集', desc: '集齐小景 12 张图鉴，「诗意书架」永久入驻。',
      reward: { huayuan: 1500, diamond: 30 },
      decoUnlockId: 'affinity_youth_book_rack',
      permanentHuayuanMult: 1.1 },
  ],
  athlete: [
    { threshold: 6,  title: '半场冠军路', desc: '小翼的图鉴已收齐一半，冠军离你不远。',
      reward: { huayuan: 500, diamond: 10 } },
    { threshold: 12, title: '夺冠全纪念', desc: '集齐小翼 12 张图鉴，「冠军奖杯柜」永久入驻。',
      reward: { huayuan: 1500, diamond: 30 },
      decoUnlockId: 'affinity_athlete_trophy_case',
      permanentHuayuanMult: 1.1 },
  ],
  celebrity: [
    { threshold: 6,  title: '半卷星光录', desc: '曜辰的图鉴已收齐一半，舞台灯正在渐亮。',
      reward: { huayuan: 500, diamond: 10 } },
    { threshold: 12, title: '巡演全章节', desc: '集齐曜辰 12 张图鉴，「星幕穿衣镜」会把后台那束星光留在店里。',
      reward: { huayuan: 1500, diamond: 30 },
      decoUnlockId: 'affinity_celebrity_dressing_mirror',
      permanentHuayuanMult: 1.1 },
  ],
};

export function getCustomerMilestones(typeId: string): CustomerMilestone[] {
  return CUSTOMER_MILESTONE_REWARDS[typeId] ?? [];
}

// ============================================================================
// 单卡定义
// ============================================================================

export interface AffinityCardUnlocks {
  /** SSR 专属：解锁的赛季限定家具 deco id（可选） */
  decoId?: string;
  /** 解锁该熟客在 CustomerView 偶发气泡里的额外语录 */
  quoteId?: string;
  /** 解锁的称号 */
  titleId?: string;
}

export interface AffinityCardDef {
  /** 主键 `card_<typeId>_<idx>`，例 `card_student_01` */
  id: string;
  /** 归属熟客 typeId */
  ownerTypeId: string;
  rarity: CardRarity;
  title: string;
  story: string;
  artKey?: string;
  unlocks?: AffinityCardUnlocks;
}

// ============================================================================
// S1 卡册：小诗 / 小翼 / 曜辰 各 12 张（共 36 张）
// ============================================================================

const _STUDENT_CARDS: AffinityCardDef[] = [
  { id: 'card_student_01', ownerTypeId: 'student', rarity: 'N',
    title: '放学路过',
    story: '小诗刚下数学课，背着帆布包路过窗前。她朝你眨眨眼，没进来——「下次再买！」',
    artKey: 'affinity_card_student_01' },
  { id: 'card_student_02', ownerTypeId: 'student', rarity: 'N',
    title: '门口便利贴',
    story: '门把上贴着张便利贴：「老板，今天那束粉康乃馨真好看~」字迹圆圆软软，像她的笑。',
    artKey: 'affinity_card_student_02' },
  { id: 'card_student_03', ownerTypeId: 'student', rarity: 'N',
    title: '拍照打卡',
    story: '小诗举着手机在橱窗外拍了五分钟，最后挑了花艺台的角落发了朋友圈。定位写：花花妙屋。',
    artKey: 'affinity_card_student_03' },
  { id: 'card_student_04', ownerTypeId: 'student', rarity: 'N',
    title: '考前应援',
    story: '考试前一天，小诗带走一束向日葵，「老师说要给我们鼓掌的人，我先给自己买好。」',
    artKey: 'affinity_card_student_04' },
  { id: 'card_student_05', ownerTypeId: 'student', rarity: 'N',
    title: '操场远眺',
    story: '黄昏时她在操场看台远远望见亮起灯的店铺，跟同学说：「那家花店的老板特别会插花。」',
    artKey: 'affinity_card_student_05' },
  { id: 'card_student_06', ownerTypeId: 'student', rarity: 'N',
    title: '雨天分享',
    story: '下大雨那天，小诗冲进店里躲雨，把自己的伞硬塞给你，说她还有一把在书包里。',
    artKey: 'affinity_card_student_06' },
  { id: 'card_student_07', ownerTypeId: 'student', rarity: 'R',
    title: '校园书桌',
    story: '小诗送来一张她中学时代的小书桌照片：上面摆满你的花，旁边压着一沓考卷和一只褪色的橡皮。',
    artKey: 'affinity_card_student_07',
    unlocks: { quoteId: 'student_q_studydesk' } },
  { id: 'card_student_08', ownerTypeId: 'student', rarity: 'R',
    title: '闺蜜成团',
    story: '她带了三个同学一起来，每人挑一束送给将来的自己。「这家店要被我们承包了。」',
    artKey: 'affinity_card_student_08' },
  { id: 'card_student_09', ownerTypeId: 'student', rarity: 'R',
    title: '校友录',
    story: '小诗在校友录的「最难忘的角落」一栏写下你的店名。她说每次推门，都像走进青春的封面。',
    artKey: 'affinity_card_student_09' },
  { id: 'card_student_10', ownerTypeId: 'student', rarity: 'SR',
    title: '毕业典礼前夜',
    story: '毕业典礼前一晚，小诗预订了 27 朵向日葵，给班级 27 个人。她说要让每个人都被记得。',
    artKey: 'affinity_card_student_10' },
  { id: 'card_student_11', ownerTypeId: 'student', rarity: 'SR',
    title: '献给老师',
    story: '小诗悄悄留下一束铃兰，「请帮我送给我的语文老师，明天她退休。」她转身跑得飞快。',
    artKey: 'affinity_card_student_11' },
  { id: 'card_student_12', ownerTypeId: 'student', rarity: 'SSR',
    title: '毕业日的花束',
    story: '毕业那天清晨，小诗推门进来，把全班同学集资的钱一股脑放在柜台。「老板，请帮我们做一束最美的，像我们最好的样子。」她流着泪笑。',
    artKey: 'affinity_card_student_12',
    unlocks: { quoteId: 'student_q_graduation', titleId: 'title_student_witness' } },
];

const _ATHLETE_CARDS: AffinityCardDef[] = [
  { id: 'card_athlete_01', ownerTypeId: 'athlete', rarity: 'N',
    title: '放学后三分',
    story: '训练结束，小翼把篮球夹在臂弯，站在店门口朝你笑：「老板，今天进了七个三分，能换一束奖励花吗？」',
    artKey: 'affinity_card_athlete_01' },
  { id: 'card_athlete_02', ownerTypeId: 'athlete', rarity: 'N',
    title: '队长毛巾',
    story: '他的白毛巾总挂在肩上。每次推门进来，先把冰饮放柜台，再认真替教练挑花。',
    artKey: 'affinity_card_athlete_02' },
  { id: 'card_athlete_03', ownerTypeId: 'athlete', rarity: 'N',
    title: '看台挥手',
    story: '黄昏球馆外，他从看台高处朝亮灯的花店挥了挥手，球鞋踏在台阶上，像风一样轻快。',
    artKey: 'affinity_card_athlete_03' },
  { id: 'card_athlete_04', ownerTypeId: 'athlete', rarity: 'N',
    title: '赛前鼓劲',
    story: '决赛前一天，小翼让你把向日葵扎得精神一点。「明天进场前，我想让全队都看到太阳。」',
    artKey: 'affinity_card_athlete_04' },
  { id: 'card_athlete_05', ownerTypeId: 'athlete', rarity: 'N',
    title: '队友起哄',
    story: '他带着一群队友冲进店里，大家一边起哄一边替他选花。小翼耳尖有点红，却还稳稳把付款码举到了最前面。',
    artKey: 'affinity_card_athlete_05' },
  { id: 'card_athlete_06', ownerTypeId: 'athlete', rarity: 'N',
    title: '雨后加练',
    story: '阵雨刚停，小翼浑身带着潮气走进来，发梢还在滴水。「今天加练到最后一个走，老板，给我一束不认输的。」',
    artKey: 'affinity_card_athlete_06' },
  { id: 'card_athlete_07', ownerTypeId: 'athlete', rarity: 'R',
    title: '冠军奖杯柜',
    story: '小翼发来新布置好的奖杯柜照片：奖杯、奖牌、队旗都摆齐了，最中间那格放着你送他的蓝白花束。',
    artKey: 'affinity_card_athlete_07',
    unlocks: { quoteId: 'athlete_q_trophycase' } },
  { id: 'card_athlete_08', ownerTypeId: 'athlete', rarity: 'R',
    title: '更衣室花束',
    story: '队里有个学弟受伤休赛，小翼托你扎了一束浅绿和白色的花带去更衣室。「队长得让他知道，我们等他回来。」',
    artKey: 'affinity_card_athlete_08' },
  { id: 'card_athlete_09', ownerTypeId: 'athlete', rarity: 'R',
    title: '球衣签名',
    story: '全队在一件旧球衣背后签满名字，小翼把它叠好放进纸袋，说要和你的花一起送给退休的老教练。',
    artKey: 'affinity_card_athlete_09' },
  { id: 'card_athlete_10', ownerTypeId: 'athlete', rarity: 'SR',
    title: '决赛前夜',
    story: '球馆灯开到很晚，小翼坐在木地板边一边缠护腕一边看你替他系花束丝带。空气里全是比赛前安静又发烫的心跳。',
    artKey: 'affinity_card_athlete_10' },
  { id: 'card_athlete_11', ownerTypeId: 'athlete', rarity: 'SR',
    title: '终场后的拥抱',
    story: '哨声落下那一刻，全场炸成欢呼。小翼满头汗冲下场，第一件事却是接过你准备的花，笑着把你抱了个满怀。',
    artKey: 'affinity_card_athlete_11' },
  { id: 'card_athlete_12', ownerTypeId: 'athlete', rarity: 'SSR',
    title: '冠军夜 MVP',
    story: '记分牌定格在胜利那一秒，彩带从馆顶落下。小翼站在聚光灯里，左手捧冠军奖杯，右手抱着你扎的花，眼睛亮得像整座球馆都在为他发光。',
    artKey: 'affinity_card_athlete_12',
    unlocks: { quoteId: 'athlete_q_champion', titleId: 'title_athlete_captain' } },
];

const _CELEBRITY_CARDS: AffinityCardDef[] = [
  { id: 'card_celebrity_01', ownerTypeId: 'celebrity', rarity: 'N',
    title: '墨镜后的笑',
    story: '曜辰戴着墨镜和口罩来取花，走出门前忽然回头朝你弯起眼睛，像把整面橱窗都点亮了。',
    artKey: 'affinity_card_celebrity_01' },
  { id: 'card_celebrity_02', ownerTypeId: 'celebrity', rarity: 'N',
    title: '保姆车窗边',
    story: '车门开着一条缝，曜辰靠在车窗旁确认花束颜色，说今晚要唱一首很温柔的歌，想让舞台先安静下来。',
    artKey: 'affinity_card_celebrity_02' },
  { id: 'card_celebrity_03', ownerTypeId: 'celebrity', rarity: 'N',
    title: '彩排间隙',
    story: '彩排换场的十分钟里，曜辰拎着你做的花束坐在台口喝冰饮，睫毛上还挂着舞台灯的金色。',
    artKey: 'affinity_card_celebrity_03' },
  { id: 'card_celebrity_04', ownerTypeId: 'celebrity', rarity: 'N',
    title: '化妆间花瓶',
    story: '助理发来照片：曜辰把你送去的花拆开，亲手插进化妆间的小花瓶，说这样唱高音前会安心一点。',
    artKey: 'affinity_card_celebrity_04' },
  { id: 'card_celebrity_05', ownerTypeId: 'celebrity', rarity: 'N',
    title: '夜录音室',
    story: '录音棚只亮着一盏暖灯。曜辰摘下一边耳机，低头闻了闻花，说这束香气像副歌最后一个长音。',
    artKey: 'affinity_card_celebrity_05' },
  { id: 'card_celebrity_06', ownerTypeId: 'celebrity', rarity: 'N',
    title: '谢幕回眸',
    story: '演出结束后他还没卸妆，抱着一大束花站在侧台回头看你，眼尾的亮片在暗处还在闪。',
    artKey: 'affinity_card_celebrity_06' },
  { id: 'card_celebrity_07', ownerTypeId: 'celebrity', rarity: 'R',
    title: '应援花墙',
    story: '曜辰把粉丝送来的应援花墙拍给你看，却特意把你包的那束放在最中央：「她们的心意很亮，你的花最懂我今天的歌。」',
    artKey: 'affinity_card_celebrity_07',
    unlocks: { quoteId: 'celebrity_q_flowerwall' } },
  { id: 'card_celebrity_08', ownerTypeId: 'celebrity', rarity: 'R',
    title: '庆功香槟',
    story: '首站巡演告捷，曜辰在庆功宴上把香槟玫瑰举到镜头前，说要先谢谢那个总能帮他配出舞台颜色的人。',
    artKey: 'affinity_card_celebrity_08' },
  { id: 'card_celebrity_09', ownerTypeId: 'celebrity', rarity: 'R',
    title: '后台签名照',
    story: '曜辰把一张带签名的舞台返图夹进花束包装里还给你，背面写着：「今天唱到副歌时，我看见你包的花也在发光。」',
    artKey: 'affinity_card_celebrity_09' },
  { id: 'card_celebrity_10', ownerTypeId: 'celebrity', rarity: 'SR',
    title: '舞台彩排夜',
    story: '空场彩排的舞台只开了顶灯。曜辰握着麦克风站在光里，脚边是你为新歌准备的白金花束，整座剧场都像屏住了呼吸。',
    artKey: 'affinity_card_celebrity_10' },
  { id: 'card_celebrity_11', ownerTypeId: 'celebrity', rarity: 'SR',
    title: '安可之前',
    story: '安可上场前一分钟，曜辰在侧台把额前碎发往后一捋，接过你递去的那枝玫瑰，低声说：「这次我要唱给最懂我的人听。」',
    artKey: 'affinity_card_celebrity_11' },
  { id: 'card_celebrity_12', ownerTypeId: 'celebrity', rarity: 'SSR',
    title: '星海主唱',
    story: '正式演出时，整片灯海随着副歌亮起。曜辰站在升降舞台中央高歌，聚光灯、花瓣和掌声一起落在他身上，他手里的花像把整个夜晚都唱开了。',
    artKey: 'affinity_card_celebrity_12',
    unlocks: { quoteId: 'celebrity_q_encore', titleId: 'title_celebrity_starlight' } },
];

/** S1 全部卡 */
export const AFFINITY_CARDS: AffinityCardDef[] = [
  ..._STUDENT_CARDS,
  ..._ATHLETE_CARDS,
  ..._CELEBRITY_CARDS,
];

export const AFFINITY_CARD_MAP = new Map<string, AffinityCardDef>(
  AFFINITY_CARDS.map(c => [c.id, c]),
);

export function getCardsByOwner(typeId: string): AffinityCardDef[] {
  return AFFINITY_CARDS.filter(c => c.ownerTypeId === typeId);
}

export function getCardsByOwnerAndRarity(typeId: string, rarity: CardRarity): AffinityCardDef[] {
  return AFFINITY_CARDS.filter(c => c.ownerTypeId === typeId && c.rarity === rarity);
}

export function hasCardsForOwner(typeId: string): boolean {
  return AFFINITY_CARDS.some(c => c.ownerTypeId === typeId);
}

// ============================================================================
// 赛季
// ============================================================================

export interface SeasonDef {
  /** 赛季 id（持久化标记当前赛季 / 区分往季） */
  id: string;
  /** 展示名（如「初春繁花季」） */
  name: string;
  /** 期号副标题（如「S1」） */
  tag: string;
  /** 起始时间（ms 时间戳） */
  startAt: number;
  /** 结束时间（ms 时间戳，> startAt） */
  endAt: number;
  /** 本赛季参与的客人 typeId 列表 */
  ownerTypeIds: string[];
  /** 整赛季 100% 全集大奖 */
  grandReward: CardReward & {
    /** 赛季限定大件家具 deco id */
    decoUnlockId?: string;
    /** 称号 id（仅展示） */
    titleId?: string;
  };
  /** 赛季宣传词（CodexPanel 顶部展示） */
  tagline?: string;
}

/**
 * S1：初春繁花季
 *
 * 起止：2026-04-22 ~ 2026-06-21（60 天）。
 * 注：上线后由策划在远端配置覆盖；本地默认值仅作开发期 fallback。
 */
export const SEASON_S1: SeasonDef = {
  id: 'S1',
  name: '初春繁花季',
  tag: 'S1',
  startAt: new Date('2026-04-22T00:00:00+08:00').getTime(),
  endAt: new Date('2026-06-21T23:59:59+08:00').getTime(),
  ownerTypeIds: ['student', 'athlete', 'celebrity'],
  grandReward: {
    huayuan: 5000,
    diamond: 100,
    decoUnlockId: 'affinity_season_s1_signlight',
    titleId: 'title_season_s1_explorer',
  },
  tagline: '与小诗 / 小翼 / 曜辰 一起，把这个春天的故事收齐。',
};

/** 当前赛季（V2 单赛季运营，未来可改为 SEASONS 列表） */
export const CURRENT_SEASON: SeasonDef = SEASON_S1;

// ============================================================================
// 工具
// ============================================================================

const _RARITY_ORDER: CardRarity[] = ['N', 'R', 'SR', 'SSR'];

export function bumpRarity(r: CardRarity, by: number): CardRarity {
  const i = _RARITY_ORDER.indexOf(r);
  const j = Math.max(0, Math.min(_RARITY_ORDER.length - 1, i + by));
  return _RARITY_ORDER[j]!;
}

export function rollRarityByWeights(rng: () => number = Math.random): CardRarity {
  const total = CARD_RARITIES.reduce((s, r) => s + CARD_RARITY_DROP_WEIGHTS[r], 0);
  let r = rng() * total;
  for (const rarity of CARD_RARITIES) {
    r -= CARD_RARITY_DROP_WEIGHTS[rarity];
    if (r <= 0) return rarity;
  }
  return 'N';
}
