/**
 * 成长之路常驻挂件：画在底部 `ItemInfoBar` 的提示卡区域内，显示当前章的一条重点目标。
 *
 * 底栏未选中棋盘物品时那张卡本来只写「点击任意物品查看详情」，是主界面唯一常驻的空位，
 * 拿来做成长引导最合适；选中物品后整个提示卡（含本挂件）由 `ItemInfoBar` 一起隐藏。
 *
 * 自身不管布局来源：卡片矩形由 `ItemInfoBar` 通过 `layout()` 传入，窗口变化时再调一次即可。
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { GrowthQuestManager } from '@/managers/GrowthQuestManager';
import { TextureCache } from '@/utils/TextureCache';
import { FONT_FAMILY } from '@/config/Constants';

const TEXT_DARK = 0x6b5644;
const TEXT_MUTED = 0x9a86b8;
const CHAPTER_PURPLE = 0x7a5aa8;
const BAR_TRACK_FILL = 0xfff7fb;
const BAR_TRACK_LINE = 0xe4cfe0;
const BAR_FILL = 0x7ed957;
const BAR_FILL_DONE = 0xffc247;
const CLAIM_GREEN = 0x63c74d;

const ICON_D = 46;

interface CardRect {
  left: number;
  top: number;
  w: number;
  h: number;
}

export class GrowthGoalWidget extends PIXI.Container {
  private _rect: CardRect = { left: 0, top: 0, w: 0, h: 0 };
  private _body = new PIXI.Container();
  /** 可领取时呼吸的胶囊；重建前须 cancel，否则 tween 仍持有已 destroy 的对象 */
  private _pulseTarget: PIXI.ObservablePoint | null = null;
  /** 有目标可显示时为 true；`ItemInfoBar` 据此决定是否还画默认提示文案 */
  private _hasGoal = false;

  constructor() {
    super();
    this.addChild(this._body);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      if (!this._hasGoal) return;
      e.stopPropagation();
      EventBus.emit('nav:openGrowthQuest');
    });
    EventBus.on('growth:updated', () => this.refresh());
  }

  get hasGoal(): boolean {
    return this._hasGoal;
  }

  /** 卡片矩形变化（初始化 / 窗口 relayout）时调用 */
  layout(rect: CardRect): void {
    this._rect = { ...rect };
    this.hitArea = new PIXI.Rectangle(rect.left, rect.top, rect.w, rect.h);
    this.refresh();
  }

  refresh(): void {
    this._clear();
    const { left, top, w, h } = this._rect;
    if (w <= 0 || h <= 0) {
      this._hasGoal = false;
      return;
    }

    const chapter = GrowthQuestManager.getCurrentChapterView();
    const task = GrowthQuestManager.getFeaturedTask();
    if (!chapter || !task) {
      // 全部章节通关，或当前章剩下的任务都被等级门锁住 —— 让位给默认提示文案
      this._hasGoal = false;
      this.visible = false;
      return;
    }
    this._hasGoal = true;
    this.visible = true;

    const padX = 12;
    const iconCx = left + padX + ICON_D / 2;
    const textLeft = iconCx + ICON_D / 2 + 10;
    const actionW = 108;
    const textRight = left + w - padX - actionW;

    this._drawIcon(iconCx, top + h * 0.42);
    this._drawChapterLine(textLeft, top + 18, chapter.def.title, chapter.index);
    this._drawGoalTitle(textLeft, top + 46, textRight - textLeft, task.def.title);
    this._drawProgress(textLeft, top + h - 34, textRight - textLeft, task);
    this._drawAction(left + w - padX - actionW / 2, top + h * 0.5, actionW, task.claimable);
  }

  private _clear(): void {
    if (this._pulseTarget) {
      TweenManager.cancelTarget(this._pulseTarget);
      this._pulseTarget = null;
    }
    while (this._body.children.length > 0) {
      const c = this._body.children[0];
      this._body.removeChild(c);
      c.destroy({ children: true });
    }
  }

  private _text(str: string, style: Partial<PIXI.ITextStyle>): PIXI.Text {
    return new PIXI.Text(str, { fontFamily: FONT_FAMILY, fill: TEXT_DARK, ...style } as PIXI.ITextStyle);
  }

  private _drawIcon(cx: number, cy: number): void {
    const tex = TextureCache.get('icon_growth');
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.scale.set(ICON_D / Math.max(tex.width, tex.height));
      sp.position.set(cx, cy);
      this._body.addChild(sp);
      return;
    }
    const t = this._text('成长', { fontSize: 18, fill: CHAPTER_PURPLE, fontWeight: 'bold' });
    t.anchor.set(0.5);
    t.position.set(cx, cy);
    this._body.addChild(t);
  }

  private _drawChapterLine(x: number, y: number, title: string, index: number): void {
    const t = this._text(`成长之路 · 第${index + 1}章 ${title}`, {
      fontSize: 17,
      fill: CHAPTER_PURPLE,
      fontWeight: 'bold',
    });
    t.anchor.set(0, 0.5);
    t.position.set(x, y);
    this._body.addChild(t);
  }

  private _drawGoalTitle(x: number, y: number, maxW: number, title: string): void {
    const t = this._text(title, {
      fontSize: 22,
      fontWeight: 'bold',
      fill: TEXT_DARK,
    });
    t.anchor.set(0, 0.5);
    // 单行显示，超宽直接横向压扁，比换行更不容易撞到下方进度条
    if (t.width > maxW && maxW > 0) t.scale.x = maxW / t.width;
    t.position.set(x, y);
    this._body.addChild(t);
  }

  private _drawProgress(
    x: number,
    y: number,
    maxW: number,
    task: { current: number; target: number; completed: boolean },
  ): void {
    const label = this._text(`${task.current}/${task.target}`, {
      fontSize: 17,
      fontWeight: 'bold',
      fill: task.completed ? 0xe8952f : TEXT_MUTED,
    });
    label.anchor.set(1, 0.5);
    label.position.set(x + maxW, y);
    this._body.addChild(label);

    const barW = Math.max(40, maxW - label.width - 8);
    const barH = 16;
    const pct = task.target > 0 ? Math.min(1, task.current / task.target) : 0;
    const g = new PIXI.Graphics();
    const r = barH / 2;
    g.lineStyle(1.6, BAR_TRACK_LINE, 0.9);
    g.beginFill(BAR_TRACK_FILL);
    g.drawRoundedRect(x, y - barH / 2, barW, barH, r);
    g.endFill();
    if (pct > 0) {
      g.lineStyle(0);
      g.beginFill(task.completed ? BAR_FILL_DONE : BAR_FILL);
      g.drawRoundedRect(x + 2, y - barH / 2 + 2, Math.max(barH - 4, (barW - 4) * pct), barH - 4, (barH - 4) / 2);
      g.endFill();
    }
    this._body.addChild(g);
  }

  private _drawAction(cx: number, cy: number, w: number, claimable: boolean): void {
    const wrap = new PIXI.Container();
    wrap.position.set(cx, cy);
    const h = 44;

    const g = new PIXI.Graphics();
    g.beginFill(0x9b8ab8, 0.16);
    g.drawRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, h / 2);
    g.endFill();
    g.beginFill(claimable ? CLAIM_GREEN : 0xf3e4c9);
    g.lineStyle(2, claimable ? 0x4b9c3a : 0xdcbd86, 0.9);
    g.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.endFill();
    wrap.addChild(g);

    const t = this._text(claimable ? '领取' : '查看', {
      fontSize: 22,
      fontWeight: 'bold',
      fill: claimable ? 0xffffff : 0xa9834a,
      ...(claimable
        ? { stroke: 0x3f7d34, strokeThickness: 4 }
        : {}),
    });
    t.anchor.set(0.5);
    wrap.addChild(t);

    this._body.addChild(wrap);

    if (claimable) {
      const dot = new PIXI.Graphics();
      dot.beginFill(0xff3333);
      dot.lineStyle(2, 0xffffff, 0.9);
      dot.drawCircle(w / 2 - 4, -h / 2 + 2, 7);
      dot.endFill();
      wrap.addChild(dot);
      this._startPulse(wrap.scale);
    }
  }

  /** `TweenManager` 无 yoyo/repeat，用 onComplete 互相回调做循环 */
  private _startPulse(scale: PIXI.ObservablePoint): void {
    TweenManager.cancelTarget(scale);
    scale.x = scale.y = 1;
    const grow = (): void => {
      TweenManager.to({
        target: scale, props: { x: 1.07, y: 1.07 }, duration: 0.5,
        ease: Ease.easeInOutQuad, onComplete: shrink,
      });
    };
    const shrink = (): void => {
      TweenManager.to({
        target: scale, props: { x: 1, y: 1 }, duration: 0.5,
        ease: Ease.easeInOutQuad, onComplete: grow,
      });
    };
    grow();
    this._pulseTarget = scale;
  }
}
