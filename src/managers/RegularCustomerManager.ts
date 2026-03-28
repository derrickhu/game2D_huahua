/**
 * 熟客养成管理器
 *
 * 功能：
 * - 追踪每种客人类型的来店次数和好感度
 * - 好感度等级：陌生(0) → 熟悉(1) → 亲密(2) → 挚友(3)
 * - 好感度提升：交付订单、赠送花束
 * - 解锁熟客专属故事线（花语故事）
 * - 熟客订单奖励加成（好感度越高加成越大）
 * - 熟客可触发"特殊订单"（高难高回报）
 */
import { EventBus } from '@/core/EventBus';
import { CUSTOMER_TYPES } from '@/config/CustomerConfig';

declare const wx: any;
declare const tt: any;
const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

const STORAGE_KEY = 'huahua_regulars';

/** 好感度等级 */
export enum FavorLevel {
  STRANGER = 0,   // 陌生
  FAMILIAR = 1,   // 熟悉
  CLOSE = 2,      // 亲密
  BESTIE = 3,     // 挚友
}

/** 好感度等级名称 */
export const FAVOR_LEVEL_NAMES: Record<FavorLevel, string> = {
  [FavorLevel.STRANGER]: '陌生',
  [FavorLevel.FAMILIAR]: '熟悉',
  [FavorLevel.CLOSE]: '亲密',
  [FavorLevel.BESTIE]: '挚友',
};

/** 好感度等级颜色 */
export const FAVOR_LEVEL_COLORS: Record<FavorLevel, number> = {
  [FavorLevel.STRANGER]: 0x999999,
  [FavorLevel.FAMILIAR]: 0x4CAF50,
  [FavorLevel.CLOSE]: 0xFF9800,
  [FavorLevel.BESTIE]: 0xE91E63,
};

/** 好感度等级所需累计好感值 */
const FAVOR_THRESHOLDS = [0, 30, 100, 250];

/** 熟客个人数据 */
export interface RegularCustomerData {
  typeId: string;
  /** 累计来店次数 */
  visitCount: number;
  /** 累计好感值 */
  favorPoints: number;
  /** 当前好感度等级 */
  favorLevel: FavorLevel;
  /** 已解锁的故事章节索引 */
  unlockedStoryChapters: number[];
  /** 累计赠送花束次数 */
  giftCount: number;
  /** 上次来店日期（用于判断"每日首访"） */
  lastVisitDate: string;
}

/** 花语故事章节 */
export interface StoryChapter {
  /** 解锁所需好感等级 */
  requiredLevel: FavorLevel;
  /** 章节标题 */
  title: string;
  /** 故事内容 */
  content: string;
  /** 解锁奖励描述 */
  rewardDesc: string;
}

/** 熟客专属对话（随好感度变化） */
export interface RegularDialogue {
  level: FavorLevel;
  greetings: string[];  // 到店问候
  thanks: string[];     // 交付感谢
  special: string[];    // 特殊对话
}

/** ============== 花语故事线配置 ============== */

const STORY_CHAPTERS: Record<string, StoryChapter[]> = {
  student: [
    {
      requiredLevel: FavorLevel.FAMILIAR,
      title: '她总买一朵小雏菊',
      content: '每次来店里，少女总是选最小的那束雏菊。\n"送给奶奶的，她最喜欢简单的花。"\n雏菊花语：天真、和平、希望。',
      rewardDesc: '花愿 ×10',
    },
    {
      requiredLevel: FavorLevel.CLOSE,
      title: '奶奶的花园',
      content: '"小时候，奶奶家有一个大花园。"\n"每到春天，满园的雏菊就像铺了一层白雪。"\n"现在奶奶住进了城里的小公寓……"\n少女笑着说，但眼里有点湿润。',
      rewardDesc: '花愿 ×20 + 钻石 ×5',
    },
    {
      requiredLevel: FavorLevel.BESTIE,
      title: '在阳台种一片花园',
      content: '"谢谢你一直帮我选花！"\n"我在奶奶的阳台上种了好多雏菊。"\n"奶奶说——这才是家的味道。"\n少女递来一张照片，阳光下的小阳台开满了白色的花。',
      rewardDesc: '花愿 ×50 + 限定头框「雏菊守护」',
    },
  ],
  worker: [
    {
      requiredLevel: FavorLevel.FAMILIAR,
      title: '每周五的康乃馨',
      content: '他总是在周五来，固定买一束康乃馨。\n"给妈妈的，周末回家。"\n康乃馨花语：母爱、感恩、尊敬。',
      rewardDesc: '花愿 ×200',
    },
    {
      requiredLevel: FavorLevel.CLOSE,
      title: '加班到深夜',
      content: '"最近太忙了，上周没来得及回家。"\n"妈妈打电话说花都谢了，等不到我了。"\n他苦笑了一下，又看了看手机里妈妈的消息。',
      rewardDesc: '花愿 ×500',
    },
    {
      requiredLevel: FavorLevel.BESTIE,
      title: '把花带到公司',
      content: '"我在工位上也放了一小束。"\n"同事问我是不是恋爱了，我说是想妈妈了。"\n他笑了。\n"以后不只周五来了，心情不好的时候也来，闻闻花就好多了。"',
      rewardDesc: '花愿 ×1000 + 钻石 ×10',
    },
  ],
  mom: [
    {
      requiredLevel: FavorLevel.FAMILIAR,
      title: '最温柔的选择',
      content: '她每次都仔细挑选很久。\n"给女儿房间里放一束，她喜欢粉色的。"\n粉玫瑰花语：温柔、感恩、幸福。',
      rewardDesc: '体力 ×30',
    },
    {
      requiredLevel: FavorLevel.CLOSE,
      title: '两束花的秘密',
      content: '"今天多买一束吧。"\n"一束给女儿，一束……给自己。"\n"当了妈妈以后，好久没给自己买过花了。"\n她挑了一束向日葵，笑得像阳光。',
      rewardDesc: '体力 ×50 + 花愿 ×20',
    },
    {
      requiredLevel: FavorLevel.BESTIE,
      title: '教女儿种花',
      content: '"你猜怎么着？"\n"我女儿说长大了也要开一家花店！"\n"谢谢你让我们爱上了花。"\n她带着女儿来了，小女孩手里紧紧攥着一朵自己画的花。',
      rewardDesc: '花愿 ×80 + 限定头框「温暖花语」',
    },
  ],
  youth: [
    {
      requiredLevel: FavorLevel.FAMILIAR,
      title: '诗人与花',
      content: '"你知道吗？每朵花都是一首诗。"\n他拿起一枝薰衣草深深闻了闻。\n薰衣草花语：等待、浪漫、安静。\n"我在写一本关于花的诗集。"',
      rewardDesc: '花愿 ×15',
    },
    {
      requiredLevel: FavorLevel.CLOSE,
      title: '尚未寄出的花',
      content: `"有没有一种花，代表'对不起我还爱你'？"\n他苦笑了一下。\n"朋友让我放下，可是看到勿忘我就会想起她。"\n勿忘我花语：不要忘记我、真挚的爱。`,
      rewardDesc: '花愿 ×30 + 花露 ×10',
    },
    {
      requiredLevel: FavorLevel.BESTIE,
      title: '新的春天',
      content: `"诗集出版了！"\n他兴奋地递来一本小册子。\n封面画着一朵正在绽放的花。\n"献辞是'给花语小筑——教我重新看见春天'。"\n翻开第一页：\n「花谢了会再开，心碎了会愈合，\n　在一朵花里，我学会了耐心等。」`,
      rewardDesc: '花愿 ×100 + 钻石 ×15 + 限定头框「诗意花间」',
    },
  ],
  couple: [
    {
      requiredLevel: FavorLevel.FAMILIAR,
      title: '那束求婚的花',
      content: '他们总是手牵手来，她挑花，他付钱。\n"我们第一次约会就是在花店。"\n"他送了我99朵玫瑰，结果第二天都蔫了。"\n两人笑作一团。\n红玫瑰花语：热烈的爱。',
      rewardDesc: '花愿 ×300',
    },
    {
      requiredLevel: FavorLevel.CLOSE,
      title: '纪念日的惊喜',
      content: '"嘘！别让她看到！"\n他偷偷来买了一束满天星。\n"明天是我们认识1000天。"\n"我想在花里藏一枚戒指。"\n满天星花语：甘愿做配角，默默守护。',
      rewardDesc: '花愿 ×800 + 花露 ×15',
    },
    {
      requiredLevel: FavorLevel.BESTIE,
      title: '婚礼的花',
      content: '"你愿意帮我们布置婚礼的花吗？"\n她眼眶红红的，举着手给你看无名指上的戒指。\n"我们想让整个会场都是花的香味。"\n"因为我们的故事，是从一朵花开始的。"',
      rewardDesc: '花愿 ×2000 + 钻石 ×20 + 限定头框「花语誓约」',
    },
  ],
  blogger: [
    {
      requiredLevel: FavorLevel.FAMILIAR,
      title: '镜头里的花',
      content: '"哇！这束花太上镜了！"\n她咔咔拍了几十张照片。\n"我的粉丝们一定会爱上这家店的。"\n她给花店做了一条短视频，播放量破了万。',
      rewardDesc: '花愿 ×20',
    },
    {
      requiredLevel: FavorLevel.CLOSE,
      title: '不用拍照的那一束',
      content: '"今天不拍了。"\n她安静地选了一束白色雏菊。\n"有时候总在镜头前，就忘了自己真正喜欢什么了。"\n"这束是买给自己的，不发朋友圈。"',
      rewardDesc: '花愿 ×40 + 花露 ×10',
    },
    {
      requiredLevel: FavorLevel.BESTIE,
      title: '「花与真实」',
      content: `"我拍了一个新系列叫'花与真实'。"\n"不修图、不摆拍，就拍花自然的样子。"\n"比我之前所有视频都火。"\n她笑了。"花教会我，真实比完美更美。"`,
      rewardDesc: '花愿 ×80 + 钻石 ×10 + 限定头框「真实花语」',
    },
  ],
  noble: [
    {
      requiredLevel: FavorLevel.FAMILIAR,
      title: '品味之人',
      content: '"这束花的色彩搭配还不错。"\n她戴着珍珠项链，眼光挑剔而精准。\n"我每周都需要鲜花装点客厅。"\n兰花花语：高洁、优雅、美好。',
      rewardDesc: '花愿 ×500',
    },
    {
      requiredLevel: FavorLevel.CLOSE,
      title: '空荡荡的大房子',
      content: '"你知道大房子最需要什么吗？"\n"不是名画，不是水晶灯。"\n"是一束会枯萎的花。"\n"因为它提醒我，美好的东西需要珍惜。"\n她轻轻抚摸花瓣，眼神意外地柔软。',
      rewardDesc: '花愿 ×1000 + 花露 ×20',
    },
    {
      requiredLevel: FavorLevel.BESTIE,
      title: '共享的花园',
      content: '"我决定把后花园开放了。"\n"让社区的孩子们都来种花、看花。"\n"花不该只属于买得起的人。"\n她第一次笑得像个普通的邻家阿姨。\n"谢谢你让我想起——花是送给所有人的。"',
      rewardDesc: '花愿 ×3000 + 花露 ×50 + 限定头框「花之贵族」',
    },
  ],
};

/** 熟客对话库 */
const REGULAR_DIALOGUES: Record<string, RegularDialogue[]> = {
  student: [
    { level: FavorLevel.STRANGER, greetings: ['你好~'], thanks: ['谢谢！'], special: [] },
    { level: FavorLevel.FAMILIAR, greetings: ['嗨，又来买花啦！', '今天有什么新花？'], thanks: ['太好了，奶奶一定喜欢！', '每次来都很开心~'], special: ['下次能帮我挑吗？'] },
    { level: FavorLevel.CLOSE, greetings: ['我的花店朋友！', '看，我画了朵花送你~'], thanks: ['你真的很懂花！', '有你在真好~'], special: ['奶奶说谢谢你哦'] },
    { level: FavorLevel.BESTIE, greetings: ['最好的花店！', '我把你家店推荐给全班了！'], thanks: ['没有你就没有奶奶的阳台花园！', '你是最棒的花艺师！'], special: ['长大了我也要开花店，可以吗？'] },
  ],
  worker: [
    { level: FavorLevel.STRANGER, greetings: ['来束康乃馨。'], thanks: ['谢了。'], special: [] },
    { level: FavorLevel.FAMILIAR, greetings: ['老样子，一束康乃馨。', '今天准时来了。'], thanks: ['妈妈一定开心。', '谢谢，质量一如既往。'], special: ['最近加班少了，哈哈。'] },
    { level: FavorLevel.CLOSE, greetings: ['给我推荐点新品？', '今天心情不错！'], thanks: ['你家的花保鲜时间真长！', '我工位上的花被夸了！'], special: ['你这花店让我压力小了不少。'] },
    { level: FavorLevel.BESTIE, greetings: ['来了来了！我最喜欢的花店~', '空气里全是花香，好治愈。'], thanks: ['认识你真好。', '现在同事们都跟我来买花了。'], special: ['我妈说感谢你们花店。'] },
  ],
  mom: [
    { level: FavorLevel.STRANGER, greetings: ['你好，我想挑束花。'], thanks: ['包得真漂亮，谢谢。'], special: [] },
    { level: FavorLevel.FAMILIAR, greetings: ['又来啦，女儿的花谢了。', '有没有粉色系的新品？'], thanks: ['她一定超开心！', '谢谢你每次都那么耐心~'], special: ['有时间来我家看看吧，花养得可好了。'] },
    { level: FavorLevel.CLOSE, greetings: ['今天也给自己买一束！', '你帮我选的那束养了两周呢！'], thanks: ['你真有品味~', '女儿说要来找你学插花！'], special: ['你让我想起年轻时也爱花。'] },
    { level: FavorLevel.BESTIE, greetings: ['来啦！我女儿画了张画给你~', '今天天气好，适合赏花！'], thanks: ['你是我们家的御用花艺师了！', '感谢你让花变成了我们家的习惯~'], special: ['以后有什么活动记得叫我！'] },
  ],
};

class RegularCustomerManagerClass {
  private _data: Map<string, RegularCustomerData> = new Map();
  private _initialized = false;

  init(): void {
    if (this._initialized) return;
    this._initialized = true;
    this._loadState();
    this._bindEvents();
  }

  /** 获取某种客人的熟客数据 */
  getData(typeId: string): RegularCustomerData {
    if (!this._data.has(typeId)) {
      this._data.set(typeId, {
        typeId,
        visitCount: 0,
        favorPoints: 0,
        favorLevel: FavorLevel.STRANGER,
        unlockedStoryChapters: [],
        giftCount: 0,
        lastVisitDate: '',
      });
    }
    return this._data.get(typeId)!;
  }

  /** 获取所有已有互动的熟客列表 */
  getAllRegulars(): RegularCustomerData[] {
    return Array.from(this._data.values()).filter(d => d.visitCount > 0);
  }

  /** 判断某种客人类型是否可养成 */
  isRegularType(typeId: string): boolean {
    const type = CUSTOMER_TYPES.find(t => t.id === typeId);
    return type?.isRegular ?? false;
  }

  /** 获取好感度等级名称 */
  getFavorLevelName(typeId: string): string {
    const data = this.getData(typeId);
    return FAVOR_LEVEL_NAMES[data.favorLevel];
  }

  /** 获取好感度进度 (0-1)，当前等级内的进度 */
  getFavorProgress(typeId: string): number {
    const data = this.getData(typeId);
    if (data.favorLevel >= FavorLevel.BESTIE) return 1;

    const currentThreshold = FAVOR_THRESHOLDS[data.favorLevel];
    const nextThreshold = FAVOR_THRESHOLDS[data.favorLevel + 1];
    const progress = (data.favorPoints - currentThreshold) / (nextThreshold - currentThreshold);
    return Math.min(1, Math.max(0, progress));
  }

  /** 获取到下一等级还需多少好感值 */
  getFavorToNextLevel(typeId: string): number {
    const data = this.getData(typeId);
    if (data.favorLevel >= FavorLevel.BESTIE) return 0;
    return FAVOR_THRESHOLDS[data.favorLevel + 1] - data.favorPoints;
  }

  /** 获取订单奖励加成比例 (0 = 无加成, 0.1 = +10%, ...) */
  getRewardBonus(typeId: string): number {
    if (!this.isRegularType(typeId)) return 0;
    const data = this.getData(typeId);
    switch (data.favorLevel) {
      case FavorLevel.STRANGER: return 0;
      case FavorLevel.FAMILIAR: return 0.1;
      case FavorLevel.CLOSE: return 0.2;
      case FavorLevel.BESTIE: return 0.35;
      default: return 0;
    }
  }

  /** 获取可触发特殊订单的概率 */
  getSpecialOrderChance(typeId: string): number {
    const data = this.getData(typeId);
    switch (data.favorLevel) {
      case FavorLevel.STRANGER: return 0;
      case FavorLevel.FAMILIAR: return 0.05;
      case FavorLevel.CLOSE: return 0.15;
      case FavorLevel.BESTIE: return 0.25;
      default: return 0;
    }
  }

  /** 获取对话文本 */
  getGreeting(typeId: string): string {
    const data = this.getData(typeId);
    const dialogues = REGULAR_DIALOGUES[typeId];
    if (!dialogues) return '';
    const lvlDialogue = dialogues.find(d => d.level === data.favorLevel);
    if (!lvlDialogue || lvlDialogue.greetings.length === 0) return '';
    return lvlDialogue.greetings[Math.floor(Math.random() * lvlDialogue.greetings.length)];
  }

  getThanks(typeId: string): string {
    const data = this.getData(typeId);
    const dialogues = REGULAR_DIALOGUES[typeId];
    if (!dialogues) return '';
    const lvlDialogue = dialogues.find(d => d.level === data.favorLevel);
    if (!lvlDialogue || lvlDialogue.thanks.length === 0) return '';
    return lvlDialogue.thanks[Math.floor(Math.random() * lvlDialogue.thanks.length)];
  }

  /** 获取花语故事章节列表 */
  getStoryChapters(typeId: string): StoryChapter[] {
    return STORY_CHAPTERS[typeId] || [];
  }

  /** 获取可解锁但尚未解锁的故事 */
  getUnlockableStory(typeId: string): StoryChapter | null {
    const data = this.getData(typeId);
    const chapters = STORY_CHAPTERS[typeId] || [];
    for (let i = 0; i < chapters.length; i++) {
      if (data.unlockedStoryChapters.includes(i)) continue;
      if (data.favorLevel >= chapters[i].requiredLevel) return chapters[i];
    }
    return null;
  }

  /** 解锁故事章节 */
  unlockStory(typeId: string, chapterIndex: number): void {
    const data = this.getData(typeId);
    if (!data.unlockedStoryChapters.includes(chapterIndex)) {
      data.unlockedStoryChapters.push(chapterIndex);
      this._saveState();
      EventBus.emit('regular:storyUnlocked', typeId, chapterIndex);
    }
  }

  // ====== 私有方法 ======

  private _bindEvents(): void {
    // 客人到来 → 增加来店次数
    EventBus.on('customer:arrived', (customer: any) => {
      if (!this.isRegularType(customer.typeId)) return;
      const data = this.getData(customer.typeId);
      data.visitCount++;

      const today = new Date().toISOString().slice(0, 10);
      const isFirstVisitToday = data.lastVisitDate !== today;
      data.lastVisitDate = today;

      // 每次来店 +2 好感，首日来店 +5
      this._addFavorPoints(customer.typeId, isFirstVisitToday ? 5 : 2);

      // 触发问候对话
      const greeting = this.getGreeting(customer.typeId);
      if (greeting) {
        EventBus.emit('regular:greeting', customer.typeId, customer.name, greeting);
      }
    });

    // 客人交付 → 增加好感
    EventBus.on('customer:delivered', (_uid: number, customer: any) => {
      if (!this.isRegularType(customer.typeId)) return;

      // 交付订单 +10 好感 + 需求数量 ×3
      const bonus = 10 + (customer.slots?.length || 1) * 3;
      this._addFavorPoints(customer.typeId, bonus);

      // 触发感谢对话
      const thanks = this.getThanks(customer.typeId);
      if (thanks) {
        EventBus.emit('regular:thanks', customer.typeId, customer.name, thanks);
      }

      this._saveState();
    });
  }

  /** 增加好感值并检查升级 */
  private _addFavorPoints(typeId: string, amount: number): void {
    const data = this.getData(typeId);
    data.favorPoints += amount;

    // 检查好感度升级
    let leveledUp = false;
    while (data.favorLevel < FavorLevel.BESTIE) {
      const nextThreshold = FAVOR_THRESHOLDS[data.favorLevel + 1];
      if (data.favorPoints >= nextThreshold) {
        data.favorLevel++;
        leveledUp = true;
        console.log(`[Regular] ${typeId} 好感度升级：${FAVOR_LEVEL_NAMES[data.favorLevel]}`);
        EventBus.emit('regular:favorLevelUp', typeId, data.favorLevel);
      } else {
        break;
      }
    }

    // 检查是否有新故事可解锁
    if (leveledUp) {
      const chapters = STORY_CHAPTERS[typeId] || [];
      for (let i = 0; i < chapters.length; i++) {
        if (!data.unlockedStoryChapters.includes(i) && data.favorLevel >= chapters[i].requiredLevel) {
          // 新故事可解锁，通知 UI
          EventBus.emit('regular:storyAvailable', typeId, i, chapters[i]);
          break; // 一次只提示一个
        }
      }
    }

    this._saveState();
  }

  // ====== 存档 ======

  private _saveState(): void {
    const obj: Record<string, RegularCustomerData> = {};
    for (const [k, v] of this._data) {
      obj[k] = v;
    }
    try {
      _api?.setStorageSync(STORAGE_KEY, JSON.stringify(obj));
    } catch (_) {}
  }

  private _loadState(): void {
    try {
      const raw = _api?.getStorageSync(STORAGE_KEY);
      if (raw) {
        const obj = JSON.parse(raw) as Record<string, RegularCustomerData>;
        for (const [k, v] of Object.entries(obj)) {
          this._data.set(k, v);
        }
      }
    } catch (_) {}
  }

  /** 清除全部数据（GM用） */
  clearAll(): void {
    this._data.clear();
    try { _api?.removeStorageSync(STORAGE_KEY); } catch (_) {}
  }
}

export const RegularCustomerManager = new RegularCustomerManagerClass();
