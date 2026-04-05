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

function milestoneRewardEmoji(r: DailyChallengeReward): string {
  if (r.itemId) return '📦';
  if (r.stamina) return '💖';
  if (r.diamond) return '💎';
  if (r.huayuan) return '💰';
  return '🎁';
}

/** 瘦高壳图用 contain 会以高度为准、宽度变窄；按 panelW 缩放使粉框包住任务区 */
function spriteShellFitPanelWidth(tex: PIXI.Texture, panelX: number, panelY: number, panelW: number, panelH: number): PIXI.Sprite {
  const s = new PIXI.Sprite(tex);
  const sc = panelW / tex.width;
  s.scale.set(sc);
  const dispH = tex.height * sc;
  s.position.set(panelX, panelY + (panelH - dispH) / 2);
  return s;
}

/** 任务行黄条等比装入 maxW×maxH 并居中（禁止单独拉宽/压扁） */
function spriteTaskRowUniform(tex: PIXI.Texture, x: number, y: number, maxW: number, maxH: number): PIXI.Sprite {
  const s = new PIXI.Sprite(tex);
  const sc = Math.min(maxW / tex.width, maxH / tex.height);
  s.scale.set(sc);
  const dw = tex.width * sc;
  const dh = tex.height * sc;
  s.position.set(x + (maxW - dw) / 2, y + (maxH - dh) / 2);
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

    const hasSubheaderDeco = !!TextureCache.get('daily_challenge_subheader_empty_nb2');
    const headerEndY = panelY + (hasSubheaderDeco ? 112 : 92);
    /** 蓝板（B_mid_plate）整体下移，避免贴图顶缘与胶囊条（E_subheader）视觉重叠 */
    const midPlateTopGap = hasSubheaderDeco ? 32 : 12;

    const shellTex = TextureCache.get('daily_challenge_panel_shell_nb2');
    if (shellTex) {
      this._content.addChild(spriteShellFitPanelWidth(shellTex, panelX, panelY, panelW, panelH));
    } else {
      const fb = new PIXI.Graphics();
      fb.beginFill(0xFFFBF0);
      fb.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
      fb.endFill();
      this._content.addChild(fb);
    }

    const hitPlate = new PIXI.Container();
    hitPlate.hitArea = new PIXI.Rectangle(panelX, panelY, panelW, panelH);
    hitPlate.eventMode = 'static';
    this._content.addChild(hitPlate);

    /** 底部周进度 + 里程碑 + 说明文案（含等比周轨道贴图预留高度） */
    const footerH = 262;
    const footerTopGap = 16;
    const scrollAreaY = headerEndY + midPlateTopGap;
    const scrollAreaH = panelH - (scrollAreaY - panelY) - footerH - footerTopGap;

    /** 中间蓝板（B）：等比放大，不 mask（避免圆角被切）；整体略下移与顶部分开 */
    const platePadX = 4;
    const plateW = panelW - platePadX * 2;
    const midPlateDropY = 36;
    const areaTex = TextureCache.get('daily_challenge_task_area_nb2');
    if (areaTex) {
      const baseSc = Math.min(plateW / areaTex.width, scrollAreaH / areaTex.height);
      const dwBase = areaTex.width * baseSc;
      const targetExtraDisplayW = 140;
      const midPlateUniformBoost = Math.min(1.42, Math.max(1, 1 + targetExtraDisplayW / Math.max(1, dwBase)));
      const sc = baseSc * midPlateUniformBoost;
      const dw = areaTex.width * sc;
      const dh = areaTex.height * sc;
      const sx = panelX + platePadX + (plateW - dw) / 2;
      const sy = scrollAreaY + (scrollAreaH - dh) / 2 + midPlateDropY;
      const areaSp = new PIXI.Sprite(areaTex);
      areaSp.scale.set(sc);
      areaSp.position.set(sx, sy);
      this._content.addChild(areaSp);
    }

    const taskRowH = 74;
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

    const subheaderTex = TextureCache.get('daily_challenge_subheader_empty_nb2');
    if (subheaderTex) {
      const sh = new PIXI.Sprite(subheaderTex);
      const shW = Math.min(panelW - 48, subheaderTex.width * 0.82);
      const subheaderCapsuleShrink = 0.66;
      sh.scale.set((shW / subheaderTex.width) * subheaderCapsuleShrink);
      sh.anchor.set(0.5, 0);
      sh.position.set(cx, panelY + 52);
      this._content.addChild(sh);
    }

    const now = Date.now();
    this._dailyCountdownText = new PIXI.Text(
      `距下次刷新（05:00） ${formatHms(msUntilNextDailyResetAt5am(new Date(now)))}`,
      { fontSize: 12, fill: 0x5C6BC0, fontFamily: FONT_FAMILY },
    );
    this._dailyCountdownText.anchor.set(0.5, 0);
    this._dailyCountdownText.position.set(cx, panelY + (hasSubheaderDeco ? 86 : 66));
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

  private _drawTaskRow(
    x: number,
    y: number,
    w: number,
    quest: { templateId: string; current: number; claimed: boolean },
    def: DailyQuestTemplate,
    parent: PIXI.Container,
  ): number {
    const rowH = 74;
    const isComplete = quest.current >= def.target;
    const isClaimed = quest.claimed;

    const rowTex = TextureCache.get('daily_challenge_task_row_blank_nb2');
    if (rowTex) {
      const rowBg = spriteTaskRowUniform(rowTex, x, y, w, rowH);
      rowBg.tint = isClaimed ? 0xdddddd : isComplete ? 0xfff8e8 : 0xffffff;
      parent.addChild(rowBg);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(isClaimed ? 0xECEFF1 : isComplete ? 0xFFF8E1 : 0xFFFFFF);
      bg.drawRoundedRect(x, y, w, rowH, 12);
      bg.endFill();
      bg.lineStyle(1, 0xE0E0E0);
      bg.drawRoundedRect(x, y, w, rowH, 12);
      parent.addChild(bg);
    }

    const check = new PIXI.Text(isComplete ? '✓' : ' ', {
      fontSize: 22, fill: isComplete ? 0x43A047 : 0xE0E0E0, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    check.position.set(x + 10, y + 22);
    parent.addChild(check);

    const desc = new PIXI.Text(QuestManager.describeTemplate(def), {
      fontSize: 15, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    desc.position.set(x + 40, y + 10);
    parent.addChild(desc);

    const barX = x + 40;
    const barY = y + 36;
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
    pts.position.set(x + w - 12, y + 8);
    parent.addChild(pts);

    const rw = new PIXI.Text(rewardPreview(def.reward), {
      fontSize: 11, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    rw.anchor.set(1, 0);
    rw.position.set(x + w - 12, y + 28);
    parent.addChild(rw);

    const btnX = x + w - 96;
    const btnY = y + 44;
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
      const deco = new PIXI.Sprite(railDecoTex);
      deco.scale.set(sc);
      deco.position.set(railDrawX, railTop);
      deco.alpha = 0.92;
      this._content.addChild(deco);
    }

    const iconY = railTop + railH * 0.34;

    const claimed = QuestManager.weeklyMilestonesClaimed;
    for (const m of WEEKLY_MILESTONES) {
      const ratio = m.threshold / maxT;
      const cx = railDrawX + railDrawW * ratio;
      const canClaim = wp >= m.threshold && !claimed.has(m.id);
      const done = claimed.has(m.id);

      const emoji = new PIXI.Text(done ? '✓' : milestoneRewardEmoji(m.reward), {
        fontSize: done ? 16 : 14, fontFamily: FONT_FAMILY, fill: done ? 0x43A047 : COLORS.TEXT_DARK,
      });
      emoji.anchor.set(0.5, 0.5);
      emoji.position.set(cx, iconY);
      this._content.addChild(emoji);

      if (canClaim) {
        const hit = new PIXI.Container();
        hit.hitArea = new PIXI.Rectangle(cx - 22, iconY - 16, 44, 52);
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
