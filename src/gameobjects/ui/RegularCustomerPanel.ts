/**
 * 熟客档案面板 - 展示所有可养成客人的好感度和花语故事
 *
 * 布局：
 * - 左侧：客人列表（头像+名字+好感度等级）
 * - 右侧：选中客人的详细信息（好感度进度+故事章节+对话）
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import {
  RegularCustomerManager,
  FavorLevel,
  FAVOR_LEVEL_NAMES,
  FAVOR_LEVEL_COLORS,
  StoryChapter,
} from '@/managers/RegularCustomerManager';
import { CUSTOMER_TYPES } from '@/config/CustomerConfig';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { ToastMessage } from './ToastMessage';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';

const PANEL_W = 680;
const PANEL_H = 560;
const LIST_W = 180;

export class RegularCustomerPanel extends PIXI.Container {
  private _content!: PIXI.Container;
  private _listContainer!: PIXI.Container;
  private _detailContainer!: PIXI.Container;
  private _selectedTypeId: string | null = null;
  private _isOpen = false;

  constructor() {
    super();
    this.visible = false;
    this._build();
    this._bindEvents();
  }

  get isOpen(): boolean { return this._isOpen; }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._refreshList();

    // 默认选中第一个有互动的客人
    const regulars = RegularCustomerManager.getAllRegulars();
    if (regulars.length > 0) {
      this._selectCustomer(regulars[0].typeId);
    } else {
      // 选中第一个可养成客人
      const first = CUSTOMER_TYPES.find(t => t.isRegular);
      if (first) this._selectCustomer(first.id);
    }

    this.alpha = 0;
    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;

    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.15,
      ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; },
    });
  }

  // ====== 构建 ======

  private _build(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    // 全屏遮罩
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.5);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    overlay.on('pointerdown', () => this.close());
    this.addChild(overlay);

    // 面板
    this._content = new PIXI.Container();
    const px = (W - PANEL_W) / 2;
    const py = (H - PANEL_H) / 2;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFFDF8, 0.97);
    bg.drawRoundedRect(px, py, PANEL_W, PANEL_H, 20);
    bg.endFill();
    bg.lineStyle(2, COLORS.CELL_BORDER, 0.4);
    bg.drawRoundedRect(px, py, PANEL_W, PANEL_H, 20);
    bg.eventMode = 'static';
    this._content.addChild(bg);

    // 标题
    const title = new PIXI.Text('💝 熟客档案', {
      fontSize: 22,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(W / 2, py + 16);
    this._content.addChild(title);

    // 关闭按钮
    const closeBtn = new PIXI.Text('✕', {
      fontSize: 22,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    closeBtn.anchor.set(0.5, 0.5);
    closeBtn.position.set(px + PANEL_W - 24, py + 24);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointerdown', () => this.close());
    this._content.addChild(closeBtn);

    // 分割线
    const divY = py + 50;
    const divider = new PIXI.Graphics();
    divider.beginFill(COLORS.CELL_BORDER, 0.3);
    divider.drawRect(px + 14, divY, PANEL_W - 28, 1);
    divider.endFill();
    this._content.addChild(divider);

    // 左侧列表区域
    this._listContainer = new PIXI.Container();
    this._listContainer.position.set(px + 10, divY + 10);
    this._content.addChild(this._listContainer);

    // 左右分割竖线
    const vDivider = new PIXI.Graphics();
    vDivider.beginFill(COLORS.CELL_BORDER, 0.2);
    vDivider.drawRect(px + LIST_W + 10, divY + 10, 1, PANEL_H - 70);
    vDivider.endFill();
    this._content.addChild(vDivider);

    // 右侧详情区域
    this._detailContainer = new PIXI.Container();
    this._detailContainer.position.set(px + LIST_W + 22, divY + 10);
    this._content.addChild(this._detailContainer);

    this.addChild(this._content);
  }

  private _bindEvents(): void {
    EventBus.on('regular:favorLevelUp', () => {
      if (this._isOpen) this._refreshAll();
    });
  }

  // ====== 列表 ======

  private _refreshList(): void {
    this._listContainer.removeChildren();

    const regularTypes = CUSTOMER_TYPES.filter(t => t.isRegular);
    let y = 0;

    for (const type of regularTypes) {
      const data = RegularCustomerManager.getData(type.id);
      const isSelected = type.id === this._selectedTypeId;

      // 行背景
      const rowBg = new PIXI.Graphics();
      if (isSelected) {
        rowBg.beginFill(COLORS.BUTTON_PRIMARY, 0.15);
      } else {
        rowBg.beginFill(0x000000, 0.001);
      }
      rowBg.drawRoundedRect(0, y, LIST_W, 52, 8);
      rowBg.endFill();
      rowBg.eventMode = 'static';
      rowBg.cursor = 'pointer';
      rowBg.on('pointerdown', () => this._selectCustomer(type.id));
      this._listContainer.addChild(rowBg);

      // emoji 头像
      const emoji = new PIXI.Text(type.emoji, { fontSize: 22 });
      emoji.anchor.set(0.5, 0.5);
      emoji.position.set(22, y + 26);
      this._listContainer.addChild(emoji);

      // 名字
      const name = new PIXI.Text(type.name, {
        fontSize: 13,
        fill: COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
        fontWeight: isSelected ? 'bold' : 'normal',
      });
      name.anchor.set(0, 0.5);
      name.position.set(44, y + 18);
      this._listContainer.addChild(name);

      // 好感度标签
      const favorColor = FAVOR_LEVEL_COLORS[data.favorLevel];
      const favorName = FAVOR_LEVEL_NAMES[data.favorLevel];

      if (data.visitCount > 0) {
        const badge = new PIXI.Graphics();
        badge.beginFill(favorColor, 0.2);
        badge.drawRoundedRect(44, y + 30, 60, 16, 4);
        badge.endFill();
        this._listContainer.addChild(badge);

        const favorText = new PIXI.Text(favorName, {
          fontSize: 9,
          fill: favorColor,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
        });
        favorText.anchor.set(0.5, 0.5);
        favorText.position.set(74, y + 38);
        this._listContainer.addChild(favorText);
      } else {
        const noVisit = new PIXI.Text('未来访', {
          fontSize: 9,
          fill: 0xCCCCCC,
          fontFamily: FONT_FAMILY,
        });
        noVisit.position.set(44, y + 32);
        this._listContainer.addChild(noVisit);
      }

      // 有未读故事红点
      const unlockable = RegularCustomerManager.getUnlockableStory(type.id);
      if (unlockable) {
        const dot = new PIXI.Graphics();
        dot.beginFill(0xFF3333);
        dot.drawCircle(LIST_W - 12, y + 16, 5);
        dot.endFill();
        this._listContainer.addChild(dot);
      }

      y += 56;
    }
  }

  private _selectCustomer(typeId: string): void {
    this._selectedTypeId = typeId;
    this._refreshList();
    this._refreshDetail();
  }

  // ====== 详情 ======

  private _refreshDetail(): void {
    this._detailContainer.removeChildren();
    if (!this._selectedTypeId) return;

    const typeId = this._selectedTypeId;
    const type = CUSTOMER_TYPES.find(t => t.id === typeId);
    if (!type) return;

    const data = RegularCustomerManager.getData(typeId);
    const detailW = PANEL_W - LIST_W - 46;
    let y = 0;

    // 头像 + 名字
    const header = new PIXI.Container();
    const emoji = new PIXI.Text(type.emoji, { fontSize: 36 });
    emoji.anchor.set(0.5, 0.5);
    emoji.position.set(26, 22);
    header.addChild(emoji);

    const nameText = new PIXI.Text(type.name, {
      fontSize: 20,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    nameText.position.set(54, 4);
    header.addChild(nameText);

    // 来店次数
    const visitText = new PIXI.Text(`来店 ${data.visitCount} 次`, {
      fontSize: 12,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    visitText.position.set(54, 28);
    header.addChild(visitText);

    this._detailContainer.addChild(header);
    y += 52;

    // 好感度进度条
    const favorColor = FAVOR_LEVEL_COLORS[data.favorLevel];
    const favorName = FAVOR_LEVEL_NAMES[data.favorLevel];
    const progress = RegularCustomerManager.getFavorProgress(typeId);
    const toNext = RegularCustomerManager.getFavorToNextLevel(typeId);

    // 好感等级标签
    const levelBadge = new PIXI.Graphics();
    levelBadge.beginFill(favorColor, 0.15);
    levelBadge.drawRoundedRect(0, y, 80, 24, 6);
    levelBadge.endFill();
    this._detailContainer.addChild(levelBadge);

    const levelText = new PIXI.Text(`💝 ${favorName}`, {
      fontSize: 12,
      fill: favorColor,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    levelText.anchor.set(0.5, 0.5);
    levelText.position.set(40, y + 12);
    this._detailContainer.addChild(levelText);

    // 进度条
    const barW = detailW - 100;
    const barH = 10;
    const barX = 90;
    const barY = y + 7;

    const barBg = new PIXI.Graphics();
    barBg.beginFill(0x000000, 0.08);
    barBg.drawRoundedRect(barX, barY, barW, barH, 5);
    barBg.endFill();
    this._detailContainer.addChild(barBg);

    if (progress > 0) {
      const barFill = new PIXI.Graphics();
      barFill.beginFill(favorColor, 0.8);
      barFill.drawRoundedRect(barX, barY, Math.max(6, barW * progress), barH, 5);
      barFill.endFill();
      this._detailContainer.addChild(barFill);
    }

    // 进度文字
    if (data.favorLevel < FavorLevel.BESTIE) {
      const progressText = new PIXI.Text(`还需 ${toNext} 好感`, {
        fontSize: 9,
        fill: COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
      });
      progressText.anchor.set(1, 0);
      progressText.position.set(barX + barW, barY + barH + 2);
      this._detailContainer.addChild(progressText);
    } else {
      const maxText = new PIXI.Text('已满好感 ✨', {
        fontSize: 9,
        fill: favorColor,
        fontFamily: FONT_FAMILY,
      });
      maxText.anchor.set(1, 0);
      maxText.position.set(barX + barW, barY + barH + 2);
      this._detailContainer.addChild(maxText);
    }

    y += 42;

    // 奖励加成
    const bonus = RegularCustomerManager.getRewardBonus(typeId);
    if (bonus > 0) {
      const bonusText = new PIXI.Text(`📈 订单奖励加成 +${Math.round(bonus * 100)}%`, {
        fontSize: 12,
        fill: 0xFF9800,
        fontFamily: FONT_FAMILY,
      });
      bonusText.position.set(0, y);
      this._detailContainer.addChild(bonusText);
      y += 22;
    }

    y += 8;

    // 花语故事线
    const storyTitle = new PIXI.Text('📖 花语故事', {
      fontSize: 15,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    storyTitle.position.set(0, y);
    this._detailContainer.addChild(storyTitle);
    y += 26;

    const chapters = RegularCustomerManager.getStoryChapters(typeId);
    if (chapters.length === 0) {
      const noStory = new PIXI.Text('暂无故事线', {
        fontSize: 12,
        fill: 0xCCCCCC,
        fontFamily: FONT_FAMILY,
      });
      noStory.position.set(0, y);
      this._detailContainer.addChild(noStory);
    } else {
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        const isUnlocked = data.unlockedStoryChapters.includes(i);
        const canUnlock = !isUnlocked && data.favorLevel >= chapter.requiredLevel;
        const isLocked = !isUnlocked && !canUnlock;

        this._buildStoryRow(typeId, i, chapter, isUnlocked, canUnlock, isLocked, 0, y, detailW);
        y += 58;
      }
    }
  }

  /** 构建单个故事章节行 */
  private _buildStoryRow(
    typeId: string,
    index: number,
    chapter: StoryChapter,
    isUnlocked: boolean,
    canUnlock: boolean,
    isLocked: boolean,
    x: number, y: number,
    w: number,
  ): void {
    const rowH = 52;

    // 背景
    const bg = new PIXI.Graphics();
    if (canUnlock) {
      bg.beginFill(0xFFF3E0);
    } else if (isUnlocked) {
      bg.beginFill(0xF3E5F5, 0.5);
    } else {
      bg.beginFill(0xF5F5F5, 0.5);
    }
    bg.drawRoundedRect(x, y, w, rowH, 8);
    bg.endFill();
    this._detailContainer.addChild(bg);

    // 章节编号
    const numText = new PIXI.Text(`${index + 1}`, {
      fontSize: 14,
      fill: isLocked ? 0xCCCCCC : COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    numText.anchor.set(0.5, 0.5);
    numText.position.set(x + 18, y + rowH / 2);
    this._detailContainer.addChild(numText);

    // 标题
    const titleText = new PIXI.Text(
      isLocked ? '???' : chapter.title,
      {
        fontSize: 13,
        fill: isLocked ? 0xCCCCCC : COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
        fontWeight: isUnlocked ? 'bold' : 'normal',
      },
    );
    titleText.position.set(x + 36, y + 6);
    this._detailContainer.addChild(titleText);

    // 条件/状态
    if (isLocked) {
      const lockText = new PIXI.Text(
        `🔒 需要好感度「${FAVOR_LEVEL_NAMES[chapter.requiredLevel]}」`,
        { fontSize: 10, fill: 0xBBBBBB, fontFamily: FONT_FAMILY },
      );
      lockText.position.set(x + 36, y + 26);
      this._detailContainer.addChild(lockText);
    } else if (canUnlock) {
      // 可解锁按钮
      const btn = new PIXI.Container();
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const btnBg = new PIXI.Graphics();
      btnBg.beginFill(0xFF9800);
      btnBg.drawRoundedRect(0, 0, 80, 22, 6);
      btnBg.endFill();
      btn.addChild(btnBg);

      const btnTxt = new PIXI.Text('✨ 阅读', {
        fontSize: 11,
        fill: 0xFFFFFF,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      btnTxt.anchor.set(0.5, 0.5);
      btnTxt.position.set(40, 11);
      btn.addChild(btnTxt);

      btn.position.set(x + 36, y + 26);
      btn.on('pointerdown', () => this._onReadStory(typeId, index, chapter));
      this._detailContainer.addChild(btn);
    } else if (isUnlocked) {
      // 奖励信息
      const rewardText = new PIXI.Text(`🎁 ${chapter.rewardDesc}`, {
        fontSize: 10,
        fill: 0x9C27B0,
        fontFamily: FONT_FAMILY,
      });
      rewardText.position.set(x + 36, y + 26);
      this._detailContainer.addChild(rewardText);

      // 再次阅读按钮
      const rereadBtn = new PIXI.Text('📖 重读', {
        fontSize: 10,
        fill: COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
      });
      rereadBtn.position.set(x + w - 50, y + 28);
      rereadBtn.eventMode = 'static';
      rereadBtn.cursor = 'pointer';
      rereadBtn.on('pointerdown', () => {
        EventBus.emit('regular:showStory', typeId, index, chapter);
      });
      this._detailContainer.addChild(rereadBtn);
    }
  }

  /** 阅读故事并解锁 */
  private _onReadStory(typeId: string, index: number, chapter: StoryChapter): void {
    RegularCustomerManager.unlockStory(typeId, index);

    // 发放奖励
    this._grantStoryReward(chapter.rewardDesc);

    // 显示故事内容
    EventBus.emit('regular:showStory', typeId, index, chapter);

    // 刷新面板
    this._refreshAll();
  }

  /** 根据奖励描述发放奖励 */
  private _grantStoryReward(desc: string): void {
    // 简单解析奖励描述
    const goldMatch = desc.match(/金币\s*[×x]\s*(\d+)/i);
    const diamondMatch = desc.match(/钻石\s*[×x]\s*(\d+)/i);
    const huayuanMatch = desc.match(/花愿\s*[×x]\s*(\d+)/i);
    const hualuMatch = desc.match(/花露\s*[×x]\s*(\d+)/i);
    const staminaMatch = desc.match(/体力\s*[×x]\s*(\d+)/i);

    if (goldMatch) CurrencyManager.addGold(parseInt(goldMatch[1]));
    if (diamondMatch) CurrencyManager.addDiamond(parseInt(diamondMatch[1]));
    if (huayuanMatch) CurrencyManager.addHuayuan(parseInt(huayuanMatch[1]));
    if (hualuMatch) CurrencyManager.addHualu(parseInt(hualuMatch[1]));
    if (staminaMatch) CurrencyManager.addStamina(parseInt(staminaMatch[1]));

    ToastMessage.show(`🎁 故事奖励已领取：${desc}`);
  }

  private _refreshAll(): void {
    this._refreshList();
    this._refreshDetail();
  }
}
