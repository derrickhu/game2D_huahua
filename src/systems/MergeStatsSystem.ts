/**
 * 合成统计面板系统
 *
 * - 记录今日/历史合成数据
 * - 周/月合成目标奖励
 * - 自动持久化到本地存储
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { PersistService } from '@/core/PersistService';
import { TweenManager, Ease } from '@/core/TweenManager';
import { Game } from '@/core/Game';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';

interface StatsData {
  /** 今日合成次数 */
  todayMerges: number;
  /** 今日合成最高级物品ID */
  todayBestItemId: string;
  /** 今日交付订单数 */
  todayOrders: number;
  /** 今日消耗体力 */
  todayStamina: number;
  /** 累计合成次数 */
  totalMerges: number;
  /** 已合成出的最高级物品ID */
  bestItemId: string;
  /** 累计交付订单数 */
  totalOrders: number;
  /** 累计经营天数 */
  totalDays: number;
  /** 本周合成次数 */
  weekMerges: number;
  /** 本月合成次数 */
  monthMerges: number;
  /** 上次记录的日期 (YYYY-MM-DD) */
  lastDate: string;
  /** 上次记录的周号 */
  lastWeek: number;
  /** 上次记录的月份 */
  lastMonth: number;
  /** 已领取的周目标ID集合 */
  claimedWeekly: string[];
  /** 已领取的月目标ID集合 */
  claimedMonthly: string[];
}

interface GoalDef {
  id: string;
  name: string;
  type: 'weekly' | 'monthly';
  condition: (stats: StatsData) => boolean;
  reward: { huayuan?: number; diamond?: number };
  desc: string;
}

const WEEKLY_GOALS: GoalDef[] = [
  { id: 'w1', name: '初级合成师', type: 'weekly',
    condition: s => s.weekMerges >= 100,
    reward: { diamond: 12 }, desc: '本周合成100次' },
  { id: 'w2', name: '中级合成师', type: 'weekly',
    condition: s => s.weekMerges >= 300,
    reward: { diamond: 28 }, desc: '本周合成300次' },
  { id: 'w3', name: '高级合成师', type: 'weekly',
    condition: s => s.weekMerges >= 500,
    reward: { diamond: 15 }, desc: '本周合成500次' },
  { id: 'w4', name: '合成大师', type: 'weekly',
    condition: s => s.weekMerges >= 400,
    reward: { diamond: 18 }, desc: '本周合成400次' },
];

const MONTHLY_GOALS: GoalDef[] = [
  { id: 'm1', name: '月度合成达人', type: 'monthly',
    condition: s => s.monthMerges >= 2000,
    reward: { diamond: 35 }, desc: '本月合成2000次' },
  { id: 'm2', name: '月度合成王', type: 'monthly',
    condition: s => s.monthMerges >= 3500,
    reward: { diamond: 45 }, desc: '本月合成3500次' },
];

const STORAGE_KEY = 'huahua_merge_stats';

export class MergeStatsSystem {
  private _parent: PIXI.Container;
  private _stats: StatsData;
  private _panelVisible = false;
  private _panel: PIXI.Container | null = null;

  constructor(parent: PIXI.Container) {
    this._parent = parent;
    this._stats = this._createDefaultStats();
    this._loadStats();
    this._checkDateReset();
    this._bindEvents();
  }

  private _createDefaultStats(): StatsData {
    return {
      todayMerges: 0,
      todayBestItemId: '',
      todayOrders: 0,
      todayStamina: 0,
      totalMerges: 0,
      bestItemId: '',
      totalOrders: 0,
      totalDays: 1,
      weekMerges: 0,
      monthMerges: 0,
      lastDate: this._getDateStr(),
      lastWeek: this._getWeekNum(),
      lastMonth: new Date().getMonth(),
      claimedWeekly: [],
      claimedMonthly: [],
    };
  }

  private _getDateStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private _getWeekNum(): number {
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - start.getTime();
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
  }

  /** 检查日期变更，重置日/周/月数据 */
  private _checkDateReset(): void {
    const today = this._getDateStr();
    const thisWeek = this._getWeekNum();
    const thisMonth = new Date().getMonth();

    if (this._stats.lastDate !== today) {
      // 新的一天
      this._stats.totalDays++;
      this._stats.todayMerges = 0;
      this._stats.todayBestItemId = '';
      this._stats.todayOrders = 0;
      this._stats.todayStamina = 0;
      this._stats.lastDate = today;
    }

    if (this._stats.lastWeek !== thisWeek) {
      this._stats.weekMerges = 0;
      this._stats.claimedWeekly = [];
      this._stats.lastWeek = thisWeek;
    }

    if (this._stats.lastMonth !== thisMonth) {
      this._stats.monthMerges = 0;
      this._stats.claimedMonthly = [];
      this._stats.lastMonth = thisMonth;
    }

    this._saveStats();
  }

  private _bindEvents(): void {
    // 合成成功
    EventBus.on('board:merged', (_src: number, _dst: number, resultId: string) => {
      this._stats.todayMerges++;
      this._stats.totalMerges++;
      this._stats.weekMerges++;
      this._stats.monthMerges++;

      // 更新最高级物品
      const def = ITEM_DEFS.get(resultId);
      if (def) {
        const bestDef = ITEM_DEFS.get(this._stats.todayBestItemId);
        if (!bestDef || def.level > bestDef.level) {
          this._stats.todayBestItemId = resultId;
        }
        const histBest = ITEM_DEFS.get(this._stats.bestItemId);
        if (!histBest || def.level > histBest.level) {
          this._stats.bestItemId = resultId;
        }
      }

      this._saveStats();
    });

    // 交付订单
    EventBus.on('customer:delivered', () => {
      this._stats.todayOrders++;
      this._stats.totalOrders++;
      this._saveStats();
    });

    // 体力消耗追踪（建筑产出时消耗体力）
    EventBus.on('building:produced', () => {
      this._stats.todayStamina++;
      this._saveStats();
    });

    // 打开统计面板
    EventBus.on('stats:open', () => {
      this.openPanel();
    });
  }

  get stats(): Readonly<StatsData> { return this._stats; }

  /** 打开统计面板 */
  openPanel(): void {
    if (this._panelVisible) return;
    this._panelVisible = true;
    this._buildPanel();
  }

  private _buildPanel(): void {
    const panel = new PIXI.Container();
    this._panel = panel;

    // 遮罩
    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, 0.6);
    mask.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    mask.endFill();
    mask.eventMode = 'static';
    panel.addChild(mask);

    // 卡片
    const cardW = DESIGN_WIDTH - 60;
    const cardH = 520;
    const cardX = 30;
    const cardY = (Game.logicHeight - cardH) / 2;

    const card = new PIXI.Graphics();
    card.beginFill(0xFFFFF0);
    card.drawRoundedRect(cardX, cardY, cardW, cardH, 16);
    card.endFill();
    panel.addChild(card);

    // 标题
    const title = new PIXI.Text(' 合成统计', {
      fontSize: 20,
      fill: 0x4A3728,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(DESIGN_WIDTH / 2, cardY + 16);
    panel.addChild(title);

    let yOff = cardY + 52;

    // --- 今日数据 ---
    yOff = this._addSection(panel, '今日数据', cardX + 20, yOff, cardW - 40);
    const todayBestName = ITEM_DEFS.get(this._stats.todayBestItemId)?.name || '-';
    const todayItems = [
      `合成次数：${this._stats.todayMerges} 次`,
      `最佳合成：${todayBestName}`,
      `交付订单：${this._stats.todayOrders} 单`,
    ];
    for (const line of todayItems) {
      yOff = this._addLine(panel, line, cardX + 30, yOff);
    }

    yOff += 8;

    // --- 历史数据 ---
    yOff = this._addSection(panel, '历史数据', cardX + 20, yOff, cardW - 40);
    const histBestName = ITEM_DEFS.get(this._stats.bestItemId)?.name || '-';
    const histItems = [
      `累计合成：${this._stats.totalMerges} 次`,
      `最高合成物品：${histBestName}`,
      `累计订单：${this._stats.totalOrders} 单`,
      `经营天数：${this._stats.totalDays} 天`,
    ];
    for (const line of histItems) {
      yOff = this._addLine(panel, line, cardX + 30, yOff);
    }

    yOff += 8;

    // --- 周目标 ---
    yOff = this._addSection(panel, `本周目标 (合成 ${this._stats.weekMerges} 次)`, cardX + 20, yOff, cardW - 40);
    for (const goal of WEEKLY_GOALS) {
      const done = goal.condition(this._stats);
      const claimed = this._stats.claimedWeekly.includes(goal.id);
      yOff = this._addGoalLine(panel, goal, done, claimed, cardX + 30, yOff);
    }

    yOff += 4;

    // --- 月目标 ---
    yOff = this._addSection(panel, `本月目标 (合成 ${this._stats.monthMerges} 次)`, cardX + 20, yOff, cardW - 40);
    for (const goal of MONTHLY_GOALS) {
      const done = goal.condition(this._stats);
      const claimed = this._stats.claimedMonthly.includes(goal.id);
      yOff = this._addGoalLine(panel, goal, done, claimed, cardX + 30, yOff);
    }

    // 关闭按钮
    const closeBtn = new PIXI.Graphics();
    closeBtn.beginFill(0xE0D5C5);
    closeBtn.drawRoundedRect(0, 0, 100, 36, 18);
    closeBtn.endFill();
    closeBtn.position.set((DESIGN_WIDTH - 100) / 2, cardY + cardH - 50);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    panel.addChild(closeBtn);

    const closeTxt = new PIXI.Text('关闭', {
      fontSize: 14,
      fill: 0x4A3728,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    closeTxt.anchor.set(0.5, 0.5);
    closeTxt.position.set(50, 18);
    closeBtn.addChild(closeTxt);

    const close = () => {
      TweenManager.to({
        target: panel,
        props: { alpha: 0 },
        duration: 0.2,
        ease: Ease.easeInQuad,
        onComplete: () => {
          this._parent.removeChild(panel);
          panel.destroy({ children: true });
          this._panel = null;
          this._panelVisible = false;
        },
      });
    };

    closeBtn.on('pointerdown', close);
    mask.on('pointerdown', close);

    panel.alpha = 0;
    this._parent.addChild(panel);
    TweenManager.to({
      target: panel,
      props: { alpha: 1 },
      duration: 0.25,
      ease: Ease.easeOutQuad,
    });
  }

  private _addSection(panel: PIXI.Container, text: string, x: number, y: number, w: number): number {
    const line = new PIXI.Graphics();
    line.beginFill(0xE8D8C8);
    line.drawRoundedRect(x, y, w, 22, 4);
    line.endFill();
    panel.addChild(line);

    const t = new PIXI.Text(text, {
      fontSize: 12,
      fill: 0x6B5B4A,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    t.position.set(x + 8, y + 4);
    panel.addChild(t);

    return y + 28;
  }

  private _addLine(panel: PIXI.Container, text: string, x: number, y: number): number {
    const t = new PIXI.Text(text, {
      fontSize: 12,
      fill: 0x4A3728,
      fontFamily: FONT_FAMILY,
    });
    t.position.set(x, y);
    panel.addChild(t);
    return y + 20;
  }

  private _addGoalLine(panel: PIXI.Container, goal: GoalDef, done: boolean, claimed: boolean, x: number, y: number): number {
    const prefix = claimed ? '' : done ? '' : '⬜';
    const t = new PIXI.Text(`${prefix} ${goal.name}：${goal.desc}`, {
      fontSize: 11,
      fill: claimed ? 0x999999 : done ? 0x228B22 : 0x4A3728,
      fontFamily: FONT_FAMILY,
    });
    t.position.set(x, y);
    panel.addChild(t);

    // 可领取按钮
    if (done && !claimed) {
      const btn = new PIXI.Graphics();
      btn.beginFill(0xFF8C69);
      btn.drawRoundedRect(0, 0, 48, 20, 10);
      btn.endFill();
      btn.position.set(DESIGN_WIDTH - 120, y);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const btnTxt = new PIXI.Text('领取', {
        fontSize: 10,
        fill: 0xFFFFFF,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      btnTxt.anchor.set(0.5, 0.5);
      btnTxt.position.set(24, 10);
      btn.addChild(btnTxt);

      btn.on('pointerdown', () => {
        this._claimGoal(goal);
        // 刷新面板
        if (this._panel) {
          this._parent.removeChild(this._panel);
          this._panel.destroy({ children: true });
          this._panel = null;
          this._panelVisible = false;
          this.openPanel();
        }
      });

      panel.addChild(btn);
    }

    return y + 22;
  }

  private _claimGoal(goal: GoalDef): void {
    if (goal.type === 'weekly') {
      if (this._stats.claimedWeekly.includes(goal.id)) return;
      this._stats.claimedWeekly.push(goal.id);
    } else {
      if (this._stats.claimedMonthly.includes(goal.id)) return;
      this._stats.claimedMonthly.push(goal.id);
    }

    if (goal.reward.diamond) CurrencyManager.addDiamond(goal.reward.diamond);

    this._saveStats();
    EventBus.emit('stats:goalClaimed', goal.id);
  }

  // ========== 持久化 ==========

  private _saveStats(): void {
    try {
      PersistService.writeRaw(STORAGE_KEY, JSON.stringify(this._stats));
    } catch (_) {}
  }

  private _loadStats(): void {
    try {
      const raw = PersistService.readRaw(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          Object.assign(this._stats, parsed);
        }
      }
    } catch (_) {}
  }
}
