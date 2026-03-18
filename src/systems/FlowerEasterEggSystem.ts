/**
 * 花语合成彩蛋系统
 *
 * - 首次合成某种花束时触发花语文案弹窗
 * - 显示花语寓意 + 小奖励（金币/钻石/经验）
 * - 记录已触发的花语，不重复触发
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { Game } from '@/core/Game';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, Category } from '@/config/ItemConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';

/** 花语配置 */
interface FlowerQuote {
  name: string;
  quote: string;
  huayuanReward: number;
  expReward: number;
}

const FLOWER_QUOTES: Record<string, FlowerQuote> = {
  // 日常花系
  flower_daily_1: { name: '小雏菊', quote: '纯真无邪，藏在心底的小美好。', huayuanReward: 10, expReward: 5 },
  flower_daily_2: { name: '向日葵', quote: '沉默的爱，追随着你的光芒。', huayuanReward: 15, expReward: 8 },
  flower_daily_3: { name: '康乃馨', quote: '温馨的祝福，感恩每一份爱。', huayuanReward: 20, expReward: 12 },
  flower_daily_4: { name: '满天星花束', quote: '甘愿做配角，只为衬托你的美。', huayuanReward: 30, expReward: 18 },
  flower_daily_5: { name: '混搭花束', quote: '缤纷世界，每一种美都值得。', huayuanReward: 40, expReward: 25 },
  flower_daily_6: { name: '精致礼盒花', quote: '最好的礼物，是用心准备的惊喜。', huayuanReward: 60, expReward: 35 },

  // 浪漫花系
  flower_romantic_1: { name: '粉玫瑰', quote: '初恋的感觉，心跳如花绽放。', huayuanReward: 12, expReward: 6 },
  flower_romantic_2: { name: '百合', quote: '百年好合，纯洁的守候。', huayuanReward: 18, expReward: 10 },
  flower_romantic_3: { name: '郁金香', quote: '高贵的爱恋，无可救药的浪漫。', huayuanReward: 25, expReward: 15 },
  flower_romantic_4: { name: '薰衣草花束', quote: '等待爱情，紫色的承诺。', huayuanReward: 35, expReward: 22 },
  flower_romantic_5: { name: '告白玫瑰礼盒', quote: '鼓起勇气说出口，你是我的唯一。', huayuanReward: 50, expReward: 30 },
  flower_romantic_6: { name: '婚礼花艺', quote: '执子之手，与子偕老。', huayuanReward: 80, expReward: 45 },

  // 奢华花系
  flower_luxury_1: { name: '星空兰', quote: '在星光下绽放，如梦如幻。', huayuanReward: 15, expReward: 8 },
  flower_luxury_2: { name: '生日花礼', quote: '又长大了一岁，愿你永远闪闪发光。', huayuanReward: 22, expReward: 13 },
  flower_luxury_3: { name: '星空花礼', quote: '把星空装进花束，送给最特别的你。', huayuanReward: 30, expReward: 20 },
  flower_luxury_4: { name: '鎏金花束', quote: '金色的祝福，闪耀的未来。', huayuanReward: 45, expReward: 28 },
  flower_luxury_5: { name: '极光花礼', quote: '像极光一样璀璨，像花一样芬芳。', huayuanReward: 65, expReward: 38 },
  flower_luxury_6: { name: '永恒花海典藏', quote: '时光流转，花香永存，这是永恒的约定。', huayuanReward: 100, expReward: 55 },
};

export class FlowerEasterEggSystem {
  private _parent: PIXI.Container;
  /** 已触发过的花语ID集合 */
  private _triggered: Set<string> = new Set();
  /** 当前是否正在显示弹窗 */
  private _isShowing = false;

  constructor(parent: PIXI.Container) {
    this._parent = parent;
    this._loadTriggered();
    this._bindEvents();
  }

  private _bindEvents(): void {
    EventBus.on('board:merged', (_src: number, _dst: number, resultId: string, _resultCell: number) => {
      this._checkEasterEgg(resultId);
    });
  }

  private _checkEasterEgg(itemId: string): void {
    if (this._isShowing) return;

    const def = ITEM_DEFS.get(itemId);
    if (!def) return;

    // 只有花束品类触发彩蛋
    if (def.category !== Category.FLOWER) return;

    // 已触发过不重复
    if (this._triggered.has(itemId)) return;

    const quoteData = FLOWER_QUOTES[itemId];
    if (!quoteData) return;

    this._triggered.add(itemId);
    this._saveTriggered();
    // 延迟一小段时间显示，让合成动画先播放完
    setTimeout(() => {
      this._showQuotePanel(itemId, quoteData);
    }, 600);
  }

  private _showQuotePanel(itemId: string, data: FlowerQuote): void {
    this._isShowing = true;

    const overlay = new PIXI.Container();

    // 半透明遮罩
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.45);
    mask.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    mask.endFill();
    mask.eventMode = 'static';
    overlay.addChild(mask);

    // 卡片
    const cardW = 300;
    const cardH = 280;
    const cx = DESIGN_WIDTH / 2;
    const cy = Game.logicHeight / 2 - 30;

    const card = new PIXI.Graphics();
    card.beginFill(0xFFFDF5);
    card.drawRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 20);
    card.endFill();
    // 装饰边框
    card.lineStyle(2, 0xE8C8A0, 0.6);
    card.drawRoundedRect(cx - cardW / 2 + 6, cy - cardH / 2 + 6, cardW - 12, cardH - 12, 16);
    overlay.addChild(card);

    // 标题
    const titleBg = new PIXI.Graphics();
    titleBg.beginFill(0xFFF0D4);
    titleBg.drawRoundedRect(cx - 80, cy - cardH / 2 - 8, 160, 32, 16);
    titleBg.endFill();
    overlay.addChild(titleBg);

    const title = new PIXI.Text('🌸 花语彩蛋 🌸', {
      fontSize: 16,
      fill: 0xC97B3A,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0.5);
    title.position.set(cx, cy - cardH / 2 + 8);
    overlay.addChild(title);

    // 花名
    const name = new PIXI.Text(data.name, {
      fontSize: 22,
      fill: 0x5A3E2B,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    name.anchor.set(0.5, 0);
    name.position.set(cx, cy - cardH / 2 + 40);
    overlay.addChild(name);

    // 分隔线
    const sep = new PIXI.Graphics();
    sep.lineStyle(1, 0xE8C8A0, 0.5);
    sep.moveTo(cx - 100, cy - cardH / 2 + 72);
    sep.lineTo(cx + 100, cy - cardH / 2 + 72);
    overlay.addChild(sep);

    // 花语文案
    const quote = new PIXI.Text(`「${data.quote}」`, {
      fontSize: 16,
      fill: 0x7D6B5D,
      fontFamily: FONT_FAMILY,
      fontStyle: 'italic',
      wordWrap: true,
      wordWrapWidth: cardW - 60,
      align: 'center',
    });
    quote.anchor.set(0.5, 0);
    quote.position.set(cx, cy - cardH / 2 + 86);
    overlay.addChild(quote);

    // 奖励信息
    const rewardText = new PIXI.Text(
      `🎁 首次合成奖励\n🌸 花愿 +${data.huayuanReward}  ⭐ 经验 +${data.expReward}`,
      {
        fontSize: 14,
        fill: 0x8B7355,
        fontFamily: FONT_FAMILY,
        align: 'center',
        lineHeight: 22,
      }
    );
    rewardText.anchor.set(0.5, 0);
    rewardText.position.set(cx, cy + 20);
    overlay.addChild(rewardText);

    // 关闭按钮
    const btnW = 120;
    const btnH = 38;
    const btnY = cy + cardH / 2 - 52;

    const btn = new PIXI.Graphics();
    btn.beginFill(0xE8A87C);
    btn.drawRoundedRect(cx - btnW / 2, btnY, btnW, btnH, 12);
    btn.endFill();
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    overlay.addChild(btn);

    const btnText = new PIXI.Text('收下奖励', {
      fontSize: 15,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    btnText.anchor.set(0.5, 0.5);
    btnText.position.set(cx, btnY + btnH / 2);
    overlay.addChild(btnText);

    // 入场动画
    overlay.alpha = 0;
    this._parent.addChild(overlay);

    TweenManager.to({
      target: overlay,
      props: { alpha: 1 },
      duration: 0.3,
      ease: Ease.easeOutQuad,
    });

    // 关闭面板的逻辑
    const closePanel = () => {
      CurrencyManager.addHuayuan(data.huayuanReward);
      CurrencyManager.addExp(data.expReward);

      TweenManager.to({
        target: overlay,
        props: { alpha: 0 },
        duration: 0.25,
        ease: Ease.easeInQuad,
        onComplete: () => {
          this._parent.removeChild(overlay);
          overlay.destroy({ children: true });
          this._isShowing = false;
        },
      });
    };

    // 点击收下奖励
    btn.on('pointerdown', closePanel);

    // 点遮罩也关闭
    mask.on('pointerdown', closePanel);
  }

  /** 导出已触发的花语（用于存档） */
  exportTriggered(): string[] {
    return Array.from(this._triggered);
  }

  /** 加载已触发的花语 */
  loadTriggered(ids: string[]): void {
    this._triggered = new Set(ids);
  }

  /** 自动持久化到本地存储 */
  private _saveTriggered(): void {
    try {
      const _api = typeof (globalThis as any).wx !== 'undefined' ? (globalThis as any).wx :
                   typeof (globalThis as any).tt !== 'undefined' ? (globalThis as any).tt : null;
      if (_api) {
        _api.setStorageSync('huahua_flower_quotes', JSON.stringify(this.exportTriggered()));
      }
    } catch (_) {}
  }

  /** 从本地存储加载 */
  private _loadTriggered(): void {
    try {
      const _api = typeof (globalThis as any).wx !== 'undefined' ? (globalThis as any).wx :
                   typeof (globalThis as any).tt !== 'undefined' ? (globalThis as any).tt : null;
      if (_api) {
        const raw = _api.getStorageSync('huahua_flower_quotes');
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            this._triggered = new Set(arr);
          }
        }
      }
    } catch (_) {}
  }
}
