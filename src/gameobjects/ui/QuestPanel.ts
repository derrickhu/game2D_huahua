/**
 * 每日任务 + 成就面板
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { QuestManager } from '@/managers/QuestManager';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

type TabType = 'quest' | 'achievement';

export class QuestPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _isOpen = false;
  private _activeTab: TabType = 'quest';

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
  }

  open(): void {
    console.log(`[QuestPanel] open() called, _isOpen=${this._isOpen}, visible=${this.visible}, parent=${!!this.parent}, parentVisible=${this.parent?.visible}`);
    if (this._isOpen) {
      console.warn('[QuestPanel] open() 提前返回: _isOpen=true');
      return;
    }
    this._isOpen = true;
    this.visible = true;
    this.alpha = 1;
    this._activeTab = 'quest';
    this._refresh();
    console.log(`[QuestPanel] open() 状态设置完成, visible=${this.visible}, worldVisible=${this.worldVisible}, parent=${this.parent?.constructor?.name}, parentParent=${this.parent?.parent?.constructor?.name}`);

    // 取消之前可能残留的关闭动画
    TweenManager.cancelTarget(this._bg);
    TweenManager.cancelTarget(this._content);
    TweenManager.cancelTarget(this._content.scale);

    // 确保面板自身 transform 干净
    this.position.set(0, 0);
    this.scale.set(1, 1);

    // 弹出动画：遮罩淡入 + 面板从缩小弹出
    this._bg.alpha = 0;
    this._content.alpha = 0;
    this._content.scale.set(0.85);
    TweenManager.to({ target: this._bg, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.scale, props: { x: 1, y: 1 }, duration: 0.3, ease: Ease.easeOutBack });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;

    // 取消之前的开启动画
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

    // 面板内容容器
    this._content = new PIXI.Container();
    this.addChild(this._content);
  }

  private _refresh(): void {
    while (this._content.children.length > 0) {
      this._content.removeChild(this._content.children[0]);
    }

    // 设置 _content 的 pivot 和 position 用于缩放动画居中
    this._content.pivot.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._content.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);

    const cx = DESIGN_WIDTH / 2;
    const panelW = Math.min(620, DESIGN_WIDTH - 40);
    const panelH = 560;
    const panelX = cx - panelW / 2;
    const panelY = Game.logicHeight / 2 - panelH / 2;

    // 面板背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFBF0);
    bg.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
    bg.endFill();
    bg.eventMode = 'static';
    this._content.addChild(bg);

    // Tab 按钮
    const tabY = panelY + 12;
    this._drawTab('📋 每日任务', panelX + 20, tabY, 160, 'quest');
    this._drawTab('🏆 成就', panelX + 190, tabY, 120, 'achievement');

    // 关闭按钮
    const closeBtn = new PIXI.Text('✕', {
      fontSize: 22, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    closeBtn.anchor.set(0.5, 0.5);
    closeBtn.position.set(panelX + panelW - 24, panelY + 24);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.close());
    this._content.addChild(closeBtn);

    // 内容区
    const contentY = tabY + 48;
    if (this._activeTab === 'quest') {
      this._drawQuestTab(panelX, contentY, panelW, panelH - (contentY - panelY) - 12);
    } else {
      this._drawAchievementTab(panelX, contentY, panelW, panelH - (contentY - panelY) - 12);
    }
  }

  private _drawTab(label: string, x: number, y: number, w: number, tab: TabType): void {
    const isActive = this._activeTab === tab;
    const g = new PIXI.Graphics();
    g.beginFill(isActive ? COLORS.BUTTON_PRIMARY : 0xEEEEEE);
    g.drawRoundedRect(x, y, w, 36, 18);
    g.endFill();
    this._content.addChild(g);

    const text = new PIXI.Text(label, {
      fontSize: 15, fill: isActive ? 0xFFFFFF : COLORS.TEXT_DARK, fontFamily: FONT_FAMILY,
      fontWeight: isActive ? 'bold' : 'normal',
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(x + w / 2, y + 18);
    this._content.addChild(text);

    const hit = new PIXI.Container();
    hit.hitArea = new PIXI.Rectangle(x, y, w, 36);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointerdown', () => {
      this._activeTab = tab;
      this._refresh();
    });
    this._content.addChild(hit);
  }

  // ====== 每日任务 Tab ======

  private _drawQuestTab(panelX: number, startY: number, panelW: number, _height: number): void {
    const quests = QuestManager.dailyQuests;
    const cx = panelX + panelW / 2;
    let y = startY + 10;

    if (quests.length === 0) {
      const noTask = new PIXI.Text('暂无每日任务', {
        fontSize: 16, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      });
      noTask.anchor.set(0.5, 0);
      noTask.position.set(cx, y);
      this._content.addChild(noTask);
      return;
    }

    for (const quest of quests) {
      const def = QuestManager.getQuestDef(quest.defId);
      if (!def) continue;

      this._drawQuestRow(panelX + 20, y, panelW - 40, quest, def);
      y += 90;
    }
  }

  private _drawQuestRow(x: number, y: number, w: number, quest: any, def: any): void {
    const isComplete = quest.current >= def.target;
    const isClaimed = quest.claimed;

    // 行背景
    const bg = new PIXI.Graphics();
    bg.beginFill(isClaimed ? 0xF0F0F0 : isComplete ? 0xFFF3E0 : 0xFFFFFF);
    bg.drawRoundedRect(x, y, w, 78, 12);
    bg.endFill();
    bg.lineStyle(1, 0xEEEEEE);
    bg.drawRoundedRect(x, y, w, 78, 12);
    this._content.addChild(bg);

    // 任务名
    const name = new PIXI.Text(def.name, {
      fontSize: 16, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    name.position.set(x + 14, y + 10);
    this._content.addChild(name);

    // 描述
    const desc = new PIXI.Text(def.desc, {
      fontSize: 13, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    desc.position.set(x + 14, y + 32);
    this._content.addChild(desc);

    // 进度条
    const barX = x + 14;
    const barY = y + 54;
    const barW = w * 0.5;
    const barH = 12;
    const progress = Math.min(quest.current / def.target, 1);

    const barBg = new PIXI.Graphics();
    barBg.beginFill(0xE0E0E0);
    barBg.drawRoundedRect(barX, barY, barW, barH, 6);
    barBg.endFill();
    this._content.addChild(barBg);

    if (progress > 0) {
      const barFill = new PIXI.Graphics();
      barFill.beginFill(isComplete ? 0x4CAF50 : COLORS.BUTTON_PRIMARY);
      barFill.drawRoundedRect(barX, barY, barW * progress, barH, 6);
      barFill.endFill();
      this._content.addChild(barFill);
    }

    const progressText = new PIXI.Text(`${quest.current}/${def.target}`, {
      fontSize: 11, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    progressText.position.set(barX + barW + 8, barY - 1);
    this._content.addChild(progressText);

    // 奖励/领取按钮
    const btnX = x + w - 100;
    const btnY = y + 20;

    if (isClaimed) {
      const claimedText = new PIXI.Text('✅ 已领取', {
        fontSize: 14, fill: 0x9E9E9E, fontFamily: FONT_FAMILY,
      });
      claimedText.position.set(btnX, btnY + 10);
      this._content.addChild(claimedText);
    } else if (isComplete) {
      const btn = new PIXI.Graphics();
      btn.beginFill(0x4CAF50);
      btn.drawRoundedRect(btnX, btnY, 88, 36, 18);
      btn.endFill();
      this._content.addChild(btn);

      const btnText = new PIXI.Text('领取', {
        fontSize: 16, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      btnText.anchor.set(0.5, 0.5);
      btnText.position.set(btnX + 44, btnY + 18);
      this._content.addChild(btnText);

      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Rectangle(btnX, btnY, 88, 36);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointerdown', () => {
        QuestManager.claimQuest(quest.defId);
        this._refresh();
      });
      this._content.addChild(hit);
    } else {
      // 显示奖励预览
      const rewardParts: string[] = [];
      if (def.reward.gold) rewardParts.push(`💰${def.reward.gold}`);
      if (def.reward.stamina) rewardParts.push(`💖${def.reward.stamina}`);
      if (def.reward.diamond) rewardParts.push(`💎${def.reward.diamond}`);
      const rewardText = new PIXI.Text(rewardParts.join(' '), {
        fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      });
      rewardText.position.set(btnX, btnY + 10);
      this._content.addChild(rewardText);
    }
  }

  // ====== 成就 Tab ======

  private _drawAchievementTab(panelX: number, startY: number, panelW: number, _height: number): void {
    const achievements = QuestManager.achievements;
    let y = startY + 10;

    for (const ach of achievements) {
      const def = QuestManager.getAchievementDef(ach.defId);
      if (!def) continue;

      this._drawAchievementRow(panelX + 20, y, panelW - 40, ach, def);
      y += 84;
    }
  }

  private _drawAchievementRow(x: number, y: number, w: number, ach: any, def: any): void {
    const nextTier = ach.claimedTier + 1;
    const hasNextTier = nextTier < def.tiers.length;
    const nextTarget = hasNextTier ? def.tiers[nextTier].target : def.tiers[def.tiers.length - 1].target;
    const progress = Math.min(ach.current / nextTarget, 1);
    const canClaim = hasNextTier && ach.current >= nextTarget;

    // 背景
    const bg = new PIXI.Graphics();
    bg.beginFill(canClaim ? 0xFFF3E0 : 0xFFFFFF);
    bg.drawRoundedRect(x, y, w, 72, 12);
    bg.endFill();
    bg.lineStyle(1, 0xEEEEEE);
    bg.drawRoundedRect(x, y, w, 72, 12);
    this._content.addChild(bg);

    // 图标
    const icon = new PIXI.Text(def.icon, { fontSize: 26, fontFamily: FONT_FAMILY });
    icon.position.set(x + 14, y + 12);
    this._content.addChild(icon);

    // 名称 + 描述
    const name = new PIXI.Text(`${def.name} (${ach.claimedTier + 1}/${def.tiers.length})`, {
      fontSize: 15, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    name.position.set(x + 52, y + 10);
    this._content.addChild(name);

    const desc = new PIXI.Text(`${def.desc}: ${ach.current}/${nextTarget}`, {
      fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
    });
    desc.position.set(x + 52, y + 32);
    this._content.addChild(desc);

    // 进度条
    const barX = x + 52;
    const barY = y + 52;
    const barW = w * 0.45;
    const barH = 10;
    const barBg = new PIXI.Graphics();
    barBg.beginFill(0xE0E0E0);
    barBg.drawRoundedRect(barX, barY, barW, barH, 5);
    barBg.endFill();
    this._content.addChild(barBg);

    if (progress > 0) {
      const fill = new PIXI.Graphics();
      fill.beginFill(canClaim ? 0x4CAF50 : 0x2196F3);
      fill.drawRoundedRect(barX, barY, barW * progress, barH, 5);
      fill.endFill();
      this._content.addChild(fill);
    }

    // 领取按钮
    if (canClaim) {
      const btnX = x + w - 90;
      const btnY = y + 18;
      const btn = new PIXI.Graphics();
      btn.beginFill(0x4CAF50);
      btn.drawRoundedRect(btnX, btnY, 76, 34, 17);
      btn.endFill();
      this._content.addChild(btn);

      const btnText = new PIXI.Text('领取', {
        fontSize: 15, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      btnText.anchor.set(0.5, 0.5);
      btnText.position.set(btnX + 38, btnY + 17);
      this._content.addChild(btnText);

      const hit = new PIXI.Container();
      hit.hitArea = new PIXI.Rectangle(btnX, btnY, 76, 34);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointerdown', () => {
        QuestManager.claimAchievement(ach.defId, nextTier);
        this._refresh();
      });
      this._content.addChild(hit);
    }
  }
}
