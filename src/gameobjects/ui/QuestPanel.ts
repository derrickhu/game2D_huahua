/**
 * 每日挑战 + 周积分进度条
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { QuestManager } from '@/managers/QuestManager';
import { TextureCache } from '@/utils/TextureCache';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';
import type { DailyChallengeReward, DailyQuestTemplate } from '@/config/DailyChallengeConfig';
import { WEEKLY_MILESTONES } from '@/config/DailyChallengeConfig';
import {
  getNextWeekResetTimeMs,
  msUntilNextDailyResetAt5am,
} from '@/utils/WeeklyCycle';

/** 任务行总高（与列表 viewport 计算、_drawTaskRow 一致） */
const TASK_ROW_H = 88;

/**
 * 任务行底图：优先 `daily_challenge_ui_C_task_row_textured_nb2`（金渐变质感条），
 * 否则签到条 / 纯色条。Sprite 直接设显示宽高；改比例可调宽窄与行内高度。
 */
const TASK_ROW_BG_WIDTH_FRAC = 0.92;
const TASK_ROW_BG_HEIGHT_FRAC = 0.98;

/**
 * 新壳图 `daily_challenge_panel_shell_nb2.png`（抠空胶囊槽）内 **每日进度** 的纹理 UV。
 * 基于 rembg+crop 后 681×1200 版本，对透明槽做行扫描标定；若换图或尺寸变，需重算。
 *
 * - `u`/`v`：槽左上角占纹理宽高的比例；`uw`/`uh`：槽宽高比例。
 */
const SHELL_DAILY_PROGRESS_TEX_W = 681;
const SHELL_DAILY_PROGRESS_TEX_H = 1200;
/** 相对行扫描略加宽，使黄条贴近胶囊槽左右圆角内侧 */
const SHELL_DAILY_PROGRESS_UV = {
  u: 138 / SHELL_DAILY_PROGRESS_TEX_W,
  v: 205 / SHELL_DAILY_PROGRESS_TEX_H,
  uw: 395 / SHELL_DAILY_PROGRESS_TEX_W,
  uh: 65 / SHELL_DAILY_PROGRESS_TEX_H,
} as const;

/** 壳图进度槽整体平移（设计像素，叠加在 UV 换算结果上） */
const SHELL_DAILY_PROGRESS_NUDGE_X = 0;
const SHELL_DAILY_PROGRESS_NUDGE_Y = 0;

/**
 * 周轨道（D_weekly_rail）透明槽内程序进度条：UV 相对轨道 Sprite 显示矩形（0~1）。
 */
const WEEKLY_RAIL_PROGRESS_UV = {
  u: 150 / 1248,
  v: 84 / 214,
  uw: 947 / 1248,
  uh: 46 / 214,
} as const;

const WEEKLY_RAIL_PROGRESS_NUDGE_X = 0;
const WEEKLY_RAIL_PROGRESS_NUDGE_Y = 0;

/** 里程碑黄点映射在透明轨上的水平内缩（占轨宽比例），避免端点压住两侧小鸡 */
const WEEKLY_MILESTONE_X_INSET_LEFT_FRAC = 0.02;
const WEEKLY_MILESTONE_X_INSET_RIGHT_FRAC = 0.07;

function formatHms(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(n => (n < 10 ? `0${n}` : String(n))).join(':');
}

function formatWeekRemain(ms: number): string {
  if (ms <= 0) return '即将刷新';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}天${h}小时`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}小时${m}分`;
}

function rewardPreview(r: DailyChallengeReward): string {
  const parts: string[] = [];
  if (r.stamina) parts.push(`体力+${r.stamina}`);
  if (r.diamond) parts.push(`💎${r.diamond}`);
  if (r.huayuan) parts.push(`花愿+${r.huayuan}`);
  if (r.itemId) parts.push(`道具×${r.itemCount ?? 1}`);
  return parts.join(' ');
}

/** 周里程碑奖励 → 主包/物品分包纹理 key（与 TextureCache 一致） */
function weeklyMilestoneRewardTextureKey(r: DailyChallengeReward): string | undefined {
  if (r.itemId) return r.itemId;
  if (r.diamond) return 'icon_gem';
  if (r.stamina) return 'icon_energy';
  if (r.huayuan) return 'icon_huayuan';
  return undefined;
}

/** 任务行底图：等比装入 rowW×rowH 框并居中（禁止单独拉宽/压扁） */
function spriteTaskRowPanel(tex: PIXI.Texture, x: number, y: number, rowW: number, rowH: number): PIXI.Sprite {
  const s = new PIXI.Sprite(tex);
  const bw = rowW * TASK_ROW_BG_WIDTH_FRAC;
  const bh = rowH * TASK_ROW_BG_HEIGHT_FRAC;
  const sc = Math.min(bw / tex.width, bh / tex.height);
  s.scale.set(sc);
  const dw = tex.width * sc;
  const dh = tex.height * sc;
  s.position.set(x + (rowW - dw) / 2, y + (rowH - dh) / 2);
  return s;
}

export class QuestPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _isOpen = false;
  private _countdownTimer: ReturnType<typeof setInterval> | null = null;
  private _dailyCountdownText: PIXI.Text | null = null;
  private _weeklyCountdownText: PIXI.Text | null = null;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
    EventBus.on('quest:updated', () => {
      if (this._isOpen) this._refresh();
    });
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this.alpha = 1;
    this._refresh();

    TweenManager.cancelTarget(this._bg);
    TweenManager.cancelTarget(this._content);
    TweenManager.cancelTarget(this._content.scale);

    this.position.set(0, 0);
    this.scale.set(1, 1);

    this._bg.alpha = 0;
    this._content.alpha = 0;
    this._content.scale.set(0.85);
    TweenManager.to({ target: this._bg, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.scale, props: { x: 1, y: 1 }, duration: 0.3, ease: Ease.easeOutBack });

    this._startCountdownTimer();
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._stopCountdownTimer();

    TweenManager.cancelTarget(this._bg);
    TweenManager.cancelTarget(this._content);
    TweenManager.cancelTarget(this._content.scale);

    TweenManager.to({
      target: this._bg, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
    });
    TweenManager.to({
      target: this._content, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; this.alpha = 1; },
    });
    TweenManager.to({
      target: this._content.scale, props: { x: 0.9, y: 0.9 }, duration: 0.15, ease: Ease.easeInQuad,
    });
  }

  private _startCountdownTimer(): void {
    this._stopCountdownTimer();
    this._countdownTimer = setInterval(() => this._tickCountdowns(), 1000);
  }

  private _stopCountdownTimer(): void {
    if (this._countdownTimer !== null) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
  }

  private _tickCountdowns(): void {
    const now = Date.now();
    if (this._dailyCountdownText) {
      this._dailyCountdownText.text = `距下次刷新（05:00） ${formatHms(msUntilNextDailyResetAt5am(new Date(now)))}`;
    }
    if (this._weeklyCountdownText) {
      const left = getNextWeekResetTimeMs(new Date(now)) - now;
      this._weeklyCountdownText.text = `本周进度 ${formatWeekRemain(left)} 后重置`;
    }
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointerdown', () => this.close());
    this.addChild(this._bg);

    this._content = new PIXI.Container();
    this.addChild(this._content);
  }

  private _refresh(): void {
    this._stopCountdownTimer();

    while (this._content.children.length > 0) {
      const child = this._content.children[0];
      this._content.removeChild(child);
      child.destroy({ children: true });
    }

    this._dailyCountdownText = null;
    this._weeklyCountdownText = null;

    this._content.pivot.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._content.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);

    const cx = DESIGN_WIDTH / 2;
    const panelW = DESIGN_WIDTH - 12;
    /** 略增高面板底缘，底部小鸡条+倒计时可再下移约 50 而不溢出 */
    const panelH = Math.min(Game.logicHeight - 16, 1100);
    const panelX = cx - panelW / 2;
    const panelY = (Game.logicHeight - panelH) / 2;

    const shellTex = TextureCache.get('daily_challenge_panel_shell_nb2');
    let shellY = panelY;
    let shellDispH = panelH;
    if (shellTex) {
      const shellSc = panelW / shellTex.width;
      shellDispH = shellTex.height * shellSc;
      shellY = panelY + (panelH - shellDispH) / 2;
      this._addProgressInTextureSlot(
        panelX,
        shellY,
        panelW,
        shellDispH,
        SHELL_DAILY_PROGRESS_UV,
        this._dailyHeaderProgressFraction(),
        0xe8dcef,
        0.9,
        0xffca28,
        SHELL_DAILY_PROGRESS_NUDGE_X,
        SHELL_DAILY_PROGRESS_NUDGE_Y,
      );
      const sh = new PIXI.Sprite(shellTex);
      sh.scale.set(shellSc);
      sh.position.set(panelX, shellY);
      this._content.addChild(sh);
    } else {
      const fb = new PIXI.Graphics();
      fb.beginFill(0xFFFBF0);
      fb.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
      fb.endFill();
      this._content.addChild(fb);
    }

    const slotBottomNorm = SHELL_DAILY_PROGRESS_UV.v + SHELL_DAILY_PROGRESS_UV.uh;
    const headerEndY = shellTex
      ? shellY + shellDispH * slotBottomNorm + 16
      : panelY + 100;
    const listTopGap = 10;

    const hitPlate = new PIXI.Container();
    hitPlate.hitArea = new PIXI.Rectangle(panelX, panelY, panelW, panelH);
    hitPlate.eventMode = 'static';
    this._content.addChild(hitPlate);

    /** 底部周进度 + 轨下奖励图标 + 说明文案 */
    const footerH = 298;
    const footerTopGap = 16;
    const scrollAreaY = headerEndY + listTopGap;
    const scrollAreaH = panelH - (scrollAreaY - panelY) - footerH - footerTopGap;

    const taskRowH = TASK_ROW_H;
    const taskRowGap = 8;
    const listInsetX = 52;
    const listX = panelX + listInsetX;
    const listW = panelW - listInsetX * 2;
    const listInnerPad = 10;
    const rowDrawW = listW - listInnerPad * 2;
    const maxListViewportH = scrollAreaH - 56;
    const listViewportH = Math.min(maxListViewportH, taskRowH * 4 + taskRowGap * 3 + 20);
    const listViewportY = scrollAreaY + Math.floor((scrollAreaH - listViewportH) / 2);

    const title = new PIXI.Text('每日挑战', {
      fontSize: 22, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(cx, panelY + 14);
    this._content.addChild(title);

    const sub = new PIXI.Text('完成下列任务赢取奖励！', {
      fontSize: 14, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    sub.anchor.set(0.5, 0);
    sub.position.set(cx, panelY + 44);
    this._content.addChild(sub);

    const now = Date.now();
    this._dailyCountdownText = new PIXI.Text(
      `距下次刷新（05:00） ${formatHms(msUntilNextDailyResetAt5am(new Date(now)))}`,
      { fontSize: 12, fill: 0x5C6BC0, fontFamily: FONT_FAMILY },
    );
    this._dailyCountdownText.anchor.set(0.5, 0);
    const countdownY = shellTex
      ? shellY + shellDispH * slotBottomNorm + 6
      : panelY + 72;
    this._dailyCountdownText.position.set(cx, countdownY);
    this._content.addChild(this._dailyCountdownText);

    const closeBtn = new PIXI.Text('✕', {
      fontSize: 22, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    closeBtn.anchor.set(0.5, 0.5);
    closeBtn.position.set(panelX + panelW - 24, panelY + 28);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._content.addChild(closeBtn);

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRect(listX, listViewportY, listW, listViewportH);
    mask.endFill();
    this._content.addChild(mask);

    const scrollContainer = new PIXI.Container();
    scrollContainer.mask = mask;
    this._content.addChild(scrollContainer);

    const firstTaskY = listViewportY + 12;
    let contentBottom = firstTaskY;
    const tasks = QuestManager.dailyTasks;
    for (const q of tasks) {
      const def = QuestManager.getTemplate(q.templateId);
      if (!def) continue;
      contentBottom = this._drawTaskRow(listX + listInnerPad, contentBottom, rowDrawW, q, def, scrollContainer);
      contentBottom += taskRowGap;
    }

    const scrollSpan = contentBottom - firstTaskY - taskRowGap;
    const maxScroll = Math.max(0, scrollSpan - listViewportH);
    let scrollY = 0;
    scrollContainer.y = -scrollY;

    const onMove = (e: PIXI.FederatedPointerEvent) => {
      if (!isDragging) return;
      const cur = e.globalY / Game.scale;
      const delta = lastY - cur;
      lastY = cur;
      scrollY = Math.max(0, Math.min(maxScroll, scrollY + delta));
      scrollContainer.y = -scrollY;
    };
    let lastY = 0;
    let isDragging = false;

    hitPlate.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      const ly = e.globalY / Game.scale;
      const lx = e.globalX / Game.scale;
      if (
        ly >= listViewportY && ly <= listViewportY + listViewportH
        && lx >= listX && lx <= listX + listW
      ) {
        lastY = ly;
        isDragging = true;
      }
    });
    hitPlate.on('pointermove', onMove);
    hitPlate.on('pointerup', () => { isDragging = false; });
    hitPlate.on('pointerupoutside', () => { isDragging = false; });

    const footerTop = scrollAreaY + scrollAreaH + footerTopGap;
    this._drawWeeklyFooter(panelX, footerTop, panelW, footerH);

    if (this._isOpen) this._startCountdownTimer();
  }

  /** 壳图每日进度槽：各任务 current/target 截断后取平均 */
  private _dailyHeaderProgressFraction(): number {
    const tasks = QuestManager.dailyTasks;
    if (tasks.length === 0) return 0;
    let sum = 0;
    let n = 0;
    for (const q of tasks) {
      const def = QuestManager.getTemplate(q.templateId);
      if (!def) continue;
      sum += Math.min(1, q.current / def.target);
      n += 1;
    }
    return n > 0 ? sum / n : 0;
  }

  /**
   * 在已缩放贴图显示矩形内，按纹理 UV 画底轨 + 左对齐圆角填充（贴图叠在上层，透明槽透出进度）
   */
  private _addProgressInTextureSlot(
    dispX: number,
    dispY: number,
    dispW: number,
    dispH: number,
    uv: { readonly u: number; readonly v: number; readonly uw: number; readonly uh: number },
    progress: number,
    trackColor: number,
    trackAlpha: number,
    fillColor: number,
    nudgeX = 0,
    nudgeY = 0,
  ): void {
    const px = dispX + uv.u * dispW + nudgeX;
    const py = dispY + uv.v * dispH + nudgeY;
    const tw = uv.uw * dispW;
    const th = uv.uh * dispH;
    const r = th / 2;
    const gTrack = new PIXI.Graphics();
    gTrack.beginFill(trackColor, trackAlpha);
    gTrack.drawRoundedRect(px, py, tw, th, r);
    gTrack.endFill();
    this._content.addChild(gTrack);
    const p = Math.max(0, Math.min(1, progress));
    const fillW = tw * p;
    if (fillW > 0.5) {
      const rr = Math.min(r, fillW / 2);
      const gFill = new PIXI.Graphics();
      gFill.beginFill(fillColor, 1);
      gFill.drawRoundedRect(px, py, fillW, th, rr);
      gFill.endFill();
      this._content.addChild(gFill);
    }
  }

  private _drawTaskRow(
    x: number,
    y: number,
    w: number,
    quest: { templateId: string; current: number; claimed: boolean },
    def: DailyQuestTemplate,
    parent: PIXI.Container,
  ): number {
    const rowH = TASK_ROW_H;
    const isComplete = quest.current >= def.target;
    const isClaimed = quest.claimed;

    const rowTex = TextureCache.get('daily_challenge_task_row_textured_nb2')
      ?? TextureCache.get('checkin_milestone_panel')
      ?? TextureCache.get('daily_challenge_task_row_blank_nb2');
    if (rowTex) {
      const rowSpr = spriteTaskRowPanel(rowTex, x, y, w, rowH);
      rowSpr.tint = isClaimed ? 0xdddddd : isComplete ? 0xfff8e8 : 0xffffff;
      parent.addChild(rowSpr);
    } else {
      const inset = w * (1 - TASK_ROW_BG_WIDTH_FRAC) / 2;
      const bg = new PIXI.Graphics();
      bg.beginFill(isClaimed ? 0xECEFF1 : isComplete ? 0xFFF8E1 : 0xFFFFFF);
      bg.drawRoundedRect(x + inset, y, w - inset * 2, rowH, 12);
      bg.endFill();
      bg.lineStyle(1, 0xE0E0E0);
      bg.drawRoundedRect(x + inset, y, w - inset * 2, rowH, 12);
      parent.addChild(bg);
    }

    const check = new PIXI.Text(isComplete ? '✓' : ' ', {
      fontSize: 22, fill: isComplete ? 0x43A047 : 0xE0E0E0, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    check.position.set(x + 10, y + 28);
    parent.addChild(check);

    const desc = new PIXI.Text(QuestManager.describeTemplate(def), {
      fontSize: 15, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    desc.position.set(x + 40, y + 12);
    parent.addChild(desc);

    const barX = x + 40;
    const barY = y + 42;
    const barW = w * 0.42;
    const barH = 10;
    const progress = Math.min(quest.current / def.target, 1);

    const barBg = new PIXI.Graphics();
    barBg.beginFill(0xE0E0E0);
    barBg.drawRoundedRect(barX, barY, barW, barH, 5);
    barBg.endFill();
    parent.addChild(barBg);

    if (progress > 0) {
      const barFill = new PIXI.Graphics();
      barFill.beginFill(isComplete ? 0x4CAF50 : COLORS.BUTTON_PRIMARY);
      barFill.drawRoundedRect(barX, barY, barW * progress, barH, 5);
      barFill.endFill();
      parent.addChild(barFill);
    }

    const progT = new PIXI.Text(`${quest.current}/${def.target}`, {
      fontSize: 11, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    progT.position.set(barX + barW + 6, barY - 2);
    parent.addChild(progT);

    const pts = new PIXI.Text(`+${def.weeklyPoints} 分`, {
      fontSize: 13, fill: 0xC49000, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    pts.anchor.set(1, 0);
    pts.position.set(x + w - 12, y + 10);
    parent.addChild(pts);

    const rw = new PIXI.Text(rewardPreview(def.reward), {
      fontSize: 11, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    rw.anchor.set(1, 0);
    rw.position.set(x + w - 12, y + 32);
    parent.addChild(rw);

    const btnX = x + w - 96;
    const btnY = y + 52;
    if (isClaimed) {
      const t = new PIXI.Text('已领', { fontSize: 12, fill: 0x9E9E9E, fontFamily: FONT_FAMILY });
      t.position.set(btnX, btnY);
      parent.addChild(t);
    } else if (isComplete) {
      const btn = new PIXI.Graphics();
      btn.beginFill(0x4CAF50);
      btn.drawRoundedRect(btnX, btnY, 84, 28, 14);
      btn.endFill();
      parent.addChild(btn);

      const btnText = new PIXI.Text('领取', {
        fontSize: 14, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      btnText.anchor.set(0.5, 0.5);
      btnText.position.set(btnX + 42, btnY + 14);
      parent.addChild(btnText);

      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Rectangle(btnX, btnY, 84, 28);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        QuestManager.claimDailyTask(quest.templateId);
        this._refresh();
      });
      parent.addChild(hit);
    }

    return y + rowH;
  }

  private _drawWeeklyFooter(panelX: number, footerTop: number, panelW: number, footerH: number): void {
    const padX = 20;
    const wp = QuestManager.weeklyPoints;
    const maxT = WEEKLY_MILESTONES[WEEKLY_MILESTONES.length - 1].threshold;
    /** 底部区内「本周积分 / 小鸡条」整体再下移约 50（靠加高 footer + 自上而下排布） */
    const weeklyBlockDropY = 50;

    const barW = panelW - padX * 2;
    const barX = panelX + padX;

    const cap = new PIXI.Text(`本周积分 ${wp} / ${maxT}`, {
      fontSize: 13, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    cap.position.set(panelX + padX, footerTop + 6 + weeklyBlockDropY);
    this._content.addChild(cap);

    const countdownY = footerTop + footerH - 16;

    const railDecoTex = TextureCache.get('daily_challenge_weekly_rail_empty_nb2');
    const railTopPreferred = footerTop + 58 + weeklyBlockDropY;
    let railTop = railTopPreferred;
    let railH = 56;
    let railDrawX = barX;
    let railDrawW = barW;
    if (railDecoTex) {
      const railUniformShrink = 0.86;
      const sc = (barW / railDecoTex.width) * railUniformShrink;
      railH = railDecoTex.height * sc;
      railDrawW = railDecoTex.width * sc;
      railDrawX = barX + (barW - railDrawW) / 2;
      const railTopMax = countdownY - 10 - railH;
      railTop = Math.min(railTopPreferred, railTopMax);
      const weeklyRatio = maxT > 0 ? Math.min(1, wp / maxT) : 0;
      this._addProgressInTextureSlot(
        railDrawX,
        railTop,
        railDrawW,
        railH,
        WEEKLY_RAIL_PROGRESS_UV,
        weeklyRatio,
        0x5D4037,
        0.88,
        0xFFCA28,
        WEEKLY_RAIL_PROGRESS_NUDGE_X,
        WEEKLY_RAIL_PROGRESS_NUDGE_Y,
      );
      const deco = new PIXI.Sprite(railDecoTex);
      deco.scale.set(sc);
      deco.position.set(railDrawX, railTop);
      deco.alpha = 0.92;
      this._content.addChild(deco);
    }

    const uv = WEEKLY_RAIL_PROGRESS_UV;
    const trackPx = railDrawX + uv.u * railDrawW + WEEKLY_RAIL_PROGRESS_NUDGE_X;
    const trackPy = railTop + uv.v * railH + WEEKLY_RAIL_PROGRESS_NUDGE_Y;
    const trackW = uv.uw * railDrawW;
    const trackTh = uv.uh * railH;
    const dotY = trackPy + trackTh * 0.5;

    const mileSpanStart = trackPx + trackW * WEEKLY_MILESTONE_X_INSET_LEFT_FRAC;
    const mileSpanW = trackW * (1 - WEEKLY_MILESTONE_X_INSET_LEFT_FRAC - WEEKLY_MILESTONE_X_INSET_RIGHT_FRAC);

    const DOT_DISP = 24;
    const REWARD_ICON_DISP = 40;
    const rewardY = railTop + railH + 6 + REWARD_ICON_DISP * 0.5;

    const dotTex = TextureCache.get('daily_challenge_ui_F_dot');
    const claimed = QuestManager.weeklyMilestonesClaimed;
    for (const m of WEEKLY_MILESTONES) {
      const ratio = maxT > 0 ? m.threshold / maxT : 0;
      const cx = mileSpanStart + mileSpanW * ratio;
      const canClaim = wp >= m.threshold && !claimed.has(m.id);
      const done = claimed.has(m.id);

      if (dotTex) {
        const dot = new PIXI.Sprite(dotTex);
        dot.anchor.set(0.5);
        const k = DOT_DISP / Math.max(1, dotTex.width);
        dot.scale.set(k);
        dot.position.set(cx, dotY);
        this._content.addChild(dot);
      } else {
        const g = new PIXI.Graphics();
        g.beginFill(0xffc107);
        g.lineStyle(2, 0x8d6e63, 1);
        g.drawCircle(cx, dotY, DOT_DISP * 0.45);
        g.endFill();
        this._content.addChild(g);
      }

      const iconKey = weeklyMilestoneRewardTextureKey(m.reward);
      const rewardTex = iconKey ? TextureCache.get(iconKey) : undefined;
      if (rewardTex) {
        const sp = new PIXI.Sprite(rewardTex);
        sp.anchor.set(0.5);
        const rk = REWARD_ICON_DISP / Math.max(rewardTex.width, rewardTex.height);
        sp.scale.set(rk);
        sp.position.set(cx, rewardY);
        if (done) {
          sp.alpha = 0.45;
          sp.tint = 0xcccccc;
        }
        this._content.addChild(sp);
        if (done) {
          const ck = new PIXI.Text('✓', {
            fontSize: 22,
            fill: 0xffffff,
            fontFamily: FONT_FAMILY,
            fontWeight: 'bold',
            stroke: 0x2e7d32,
            strokeThickness: 3,
          });
          ck.anchor.set(0.5);
          ck.position.set(cx, rewardY);
          this._content.addChild(ck);
        }
      } else {
        const fallback = new PIXI.Text(rewardPreview(m.reward), {
          fontSize: 11,
          fill: COLORS.TEXT_DARK,
          fontFamily: FONT_FAMILY,
        });
        fallback.anchor.set(0.5, 0);
        fallback.position.set(cx, railTop + railH + 4);
        this._content.addChild(fallback);
      }

      if (canClaim) {
        const hitTop = Math.min(dotY - DOT_DISP * 0.6, rewardY - REWARD_ICON_DISP * 0.55);
        const hitH = rewardY + REWARD_ICON_DISP * 0.55 - hitTop + 8;
        const hit = new PIXI.Container();
        hit.hitArea = new PIXI.Rectangle(cx - 36, hitTop, 72, hitH);
        hit.eventMode = 'static';
        hit.cursor = 'pointer';
        hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
          e.stopPropagation();
          QuestManager.claimWeeklyMilestone(m.id);
          this._refresh();
        });
        this._content.addChild(hit);
      }
    }

    const now = Date.now();
    this._weeklyCountdownText = new PIXI.Text(
      `本周进度 ${formatWeekRemain(getNextWeekResetTimeMs(new Date(now)) - now)} 后重置`,
      { fontSize: 11, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY },
    );
    this._weeklyCountdownText.anchor.set(0.5, 0);
    this._weeklyCountdownText.position.set(panelX + panelW / 2, countdownY);
    this._content.addChild(this._weeklyCountdownText);
  }
}
