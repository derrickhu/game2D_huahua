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
  id: string;          // 物品 ID（flower_fresh_1 等）
  name: string;        // 花名
  quote: string;       // 花语文案
  line: string;        // 花系
  level: number;       // 等级
  icon: string;        // 图标
  discoveredAt: number; // 发现时间戳
}

/** 完整的花语数据库 */
const FLOWER_QUOTES: Record<string, { name: string; quote: string }> = {
  // 鲜花线
  flower_fresh_1: { name: '花种子', quote: '纯真无邪，藏在心底的小美好。' },
  flower_fresh_2: { name: '花苞', quote: '沉默的爱，追随着你的光芒。' },
  flower_fresh_3: { name: '小雏菊', quote: '温馨的祝福，感恩每一份爱。' },
  flower_fresh_4: { name: '向日葵', quote: '甘愿做配角，只为衬托你的美。' },
  flower_fresh_5: { name: '康乃馨', quote: '缤纷世界，每一种美都值得。' },
  flower_fresh_6: { name: '玫瑰', quote: '最好的礼物，是用心准备的惊喜。' },
  // 花束线
  flower_bouquet_1: { name: '一小捧散花', quote: '初恋的感觉，心跳如花绽放。' },
  flower_bouquet_2: { name: '迷你花束', quote: '百年好合，纯洁的守候。' },
  flower_bouquet_3: { name: '郁金香花束', quote: '高贵的爱恋，无可救药的浪漫。' },
  flower_bouquet_4: { name: '玫瑰满天星', quote: '等待爱情，紫色的承诺。' },
  flower_bouquet_5: { name: '田园混搭花束', quote: '鼓起勇气说出口，你是我的唯一。' },
  flower_bouquet_6: { name: '精美花盒', quote: '执子之手，与子偕老。' },
  // 绿植线
  flower_green_1: { name: '小芽苗', quote: '小小的芽，蕴含着生命的力量。' },
  flower_green_2: { name: '多肉盆栽', quote: '圆润饱满，安静而治愈。' },
  flower_green_3: { name: '绿萝', quote: '顽强生长，为你带来好运。' },
  flower_green_4: { name: '波士顿蕨', quote: '优雅的弧线，如绿色瀑布。' },
  flower_green_5: { name: '虎皮兰', quote: '坚韧挺拔，守护者的姿态。' },
  flower_green_6: { name: '龟背竹', quote: '独一无二的裂叶，大自然的艺术。' },
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
