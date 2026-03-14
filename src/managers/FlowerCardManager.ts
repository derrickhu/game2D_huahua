/**
 * 花语卡片收藏管理器
 *
 * - 每种花首次合成时获得对应花语卡片
 * - 可在卡片图鉴中查看所有已收集卡片
 * - 卡片可分享到朋友圈（带花语文案+花名+精美背景）
 * - 收集全套触发特殊奖励
 *
 * 花语数据来自 FlowerEasterEggSystem 的 FLOWER_QUOTES
 */
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { Category, ITEM_DEFS } from '@/config/ItemConfig';
import { CurrencyManager } from './CurrencyManager';

const STORAGE_KEY = 'huahua_flower_cards';

/** 花语卡片数据 */
export interface FlowerCard {
  id: string;          // 物品 ID（flower_daily_1 等）
  name: string;        // 花名
  quote: string;       // 花语文案
  line: string;        // 花系
  level: number;       // 等级
  icon: string;        // 图标
  discoveredAt: number; // 发现时间戳
}

/** 完整的花语数据库 */
const FLOWER_QUOTES: Record<string, { name: string; quote: string }> = {
  // 日常花系
  flower_daily_1: { name: '小雏菊', quote: '纯真无邪，藏在心底的小美好。' },
  flower_daily_2: { name: '向日葵', quote: '沉默的爱，追随着你的光芒。' },
  flower_daily_3: { name: '康乃馨', quote: '温馨的祝福，感恩每一份爱。' },
  flower_daily_4: { name: '满天星花束', quote: '甘愿做配角，只为衬托你的美。' },
  flower_daily_5: { name: '混搭花束', quote: '缤纷世界，每一种美都值得。' },
  flower_daily_6: { name: '精致礼盒花', quote: '最好的礼物，是用心准备的惊喜。' },
  // 浪漫花系
  flower_romantic_1: { name: '粉玫瑰', quote: '初恋的感觉，心跳如花绽放。' },
  flower_romantic_2: { name: '百合', quote: '百年好合，纯洁的守候。' },
  flower_romantic_3: { name: '郁金香', quote: '高贵的爱恋，无可救药的浪漫。' },
  flower_romantic_4: { name: '薰衣草花束', quote: '等待爱情，紫色的承诺。' },
  flower_romantic_5: { name: '告白玫瑰礼盒', quote: '鼓起勇气说出口，你是我的唯一。' },
  flower_romantic_6: { name: '婚礼花艺', quote: '执子之手，与子偕老。' },
  // 奢华花系
  flower_luxury_1: { name: '星空兰', quote: '在星光下绽放，如梦如幻。' },
  flower_luxury_2: { name: '生日花礼', quote: '又长大了一岁，愿你永远闪闪发光。' },
  flower_luxury_3: { name: '星空花礼', quote: '把星空装进花束，送给最特别的你。' },
  flower_luxury_4: { name: '鎏金花束', quote: '金色的祝福，闪耀的未来。' },
  flower_luxury_5: { name: '极光花礼', quote: '像极光一样璀璨，像花一样芬芳。' },
  flower_luxury_6: { name: '永恒花海典藏', quote: '时光流转，花香永存，这是永恒的约定。' },
};

class FlowerCardManagerClass {
  /** 已收集的花语卡片 */
  private _cards: Map<string, FlowerCard> = new Map();

  init(): void {
    this._loadState();
    this._bindEvents();
    console.log(`[FlowerCard] 初始化完成, 已收集 ${this._cards.size}/18 张花语卡片`);
  }

  private _bindEvents(): void {
    // 合成花束时自动收集卡片
    EventBus.on('board:merged', (_s: number, _d: number, resultId: string) => {
      this._tryCollect(resultId);
    });
  }

  /** 尝试收集新卡片 */
  private _tryCollect(itemId: string): void {
    if (this._cards.has(itemId)) return;

    const quoteData = FLOWER_QUOTES[itemId];
    if (!quoteData) return;

    const def = ITEM_DEFS.get(itemId);
    if (!def || def.category !== Category.FLOWER) return;

    const card: FlowerCard = {
      id: itemId,
      name: quoteData.name,
      quote: quoteData.quote,
      line: def.line,
      level: def.level,
      icon: def.icon,
      discoveredAt: Date.now(),
    };

    this._cards.set(itemId, card);
    this._saveState();

    EventBus.emit('flowerCard:collected', card);
    console.log(`[FlowerCard] 新收集: ${card.name} - 「${card.quote}」`);

    // 检查是否集齐
    if (this._cards.size === 18) {
      EventBus.emit('flowerCard:complete');
      CurrencyManager.addDiamond(100);
      CurrencyManager.addHuayuan(20);
    }
  }

  // ═══════════════ 查询 ═══════════════

  /** 获取已收集的卡片列表 */
  get collectedCards(): FlowerCard[] {
    return Array.from(this._cards.values()).sort((a, b) => {
      // 按花系→等级排序
      if (a.line !== b.line) return a.line.localeCompare(b.line);
      return a.level - b.level;
    });
  }

  /** 获取所有卡片（含未收集的灰色占位） */
  get allCards(): (FlowerCard | { id: string; name: string; discovered: false })[] {
    const result: any[] = [];
    for (const [id, data] of Object.entries(FLOWER_QUOTES)) {
      const card = this._cards.get(id);
      if (card) {
        result.push({ ...card, discovered: true });
      } else {
        result.push({ id, name: data.name, discovered: false });
      }
    }
    return result;
  }

  /** 是否已收集 */
  isCollected(itemId: string): boolean {
    return this._cards.has(itemId);
  }

  /** 获取卡片详情 */
  getCard(itemId: string): FlowerCard | null {
    return this._cards.get(itemId) || null;
  }

  /** 收集进度 */
  get collectedCount(): number { return this._cards.size; }
  get totalCount(): number { return 18; }
  get isComplete(): boolean { return this._cards.size >= 18; }

  /** 获取分享文案 */
  getShareText(card: FlowerCard): string {
    return `🌸 ${card.name}\n「${card.quote}」\n\n—— 来自「花语小筑」，每朵花都有一段故事 💕`;
  }

  /** 分享花语卡片 */
  shareCard(card: FlowerCard): void {
    Platform.shareAppMessage({
      title: `${card.name} —— ${card.quote}`,
      query: `card=${card.id}`,
    });
    EventBus.emit('flowerCard:shared', card);
  }

  // ═══════════════ 存档 ═══════════════

  private _saveState(): void {
    const data: Record<string, FlowerCard> = {};
    for (const [id, card] of this._cards) {
      data[id] = card;
    }
    Platform.setStorageSync(STORAGE_KEY, JSON.stringify(data));
  }

  private _loadState(): void {
    try {
      const raw = Platform.getStorageSync(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const [id, card] of Object.entries(data)) {
        this._cards.set(id, card as FlowerCard);
      }
    } catch (_) {}
  }
}

export const FlowerCardManager = new FlowerCardManagerClass();
