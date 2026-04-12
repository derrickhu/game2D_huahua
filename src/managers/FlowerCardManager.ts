/**
 * 花语卡片收藏管理器
 *
 * - 每种花首次合成时获得对应花语卡片
 * - 可在卡片图鉴中查看所有已收集卡片
 * - 卡片可分享到朋友圈（带花语文案+花名+精美背景）
 * - 收集全套触发特殊奖励
 *
 * 花语数据来自 `ItemCollectionBlurbs.FLOWER_CARD_QUOTES`
 */
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { PersistService } from '@/core/PersistService';
import { Category, ITEM_DEFS } from '@/config/ItemConfig';
import {
  FLOWER_CARD_QUOTES,
  FLOWER_CARD_TRACKED_TOTAL,
} from '@/config/ItemCollectionBlurbs';
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

class FlowerCardManagerClass {
  /** 已收集的花语卡片 */
  private _cards: Map<string, FlowerCard> = new Map();

  init(): void {
    this._loadState();
    this._bindEvents();
    console.log(`[FlowerCard] 初始化完成, 已收集 ${this._cards.size}/${FLOWER_CARD_TRACKED_TOTAL} 张花语卡片`);
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

    const quoteData = FLOWER_CARD_QUOTES[itemId];
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
    if (this._cards.size === FLOWER_CARD_TRACKED_TOTAL) {
      EventBus.emit('flowerCard:complete');
      CurrencyManager.addDiamond(120);
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
    for (const [id, data] of Object.entries(FLOWER_CARD_QUOTES)) {
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
  get totalCount(): number { return FLOWER_CARD_TRACKED_TOTAL; }
  get isComplete(): boolean { return this._cards.size >= FLOWER_CARD_TRACKED_TOTAL; }

  /** 获取分享文案 */
  getShareText(card: FlowerCard): string {
    return `${card.name}\n「${card.quote}」\n\n—— 来自「花花妙屋」，每朵花都有一段故事`;
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
    PersistService.writeRaw(STORAGE_KEY, JSON.stringify(data));
  }

  private _loadState(): void {
    try {
      const raw = PersistService.readRaw(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const [id, card] of Object.entries(data)) {
        this._cards.set(id, card as FlowerCard);
      }
    } catch (_) {}
  }
}

export const FlowerCardManager = new FlowerCardManagerClass();

/** 供图鉴等模块引用，与 `ItemCollectionBlurbs` 同步 */
export { FLOWER_CARD_TRACKED_TOTAL };
