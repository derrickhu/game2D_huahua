/**
 * 花语故事弹窗 - 展示熟客花语故事
 *
 * 全屏沉浸式阅读体验，配合温暖的视觉风格
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { StoryChapter } from '@/managers/RegularCustomerManager';
import { CUSTOMER_TYPES } from '@/config/CustomerConfig';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';

const POPUP_W = 560;
const POPUP_H = 480;

export class StoryPopup extends PIXI.Container {
  constructor() {
    super();
    this.visible = false;
  }

  /** 显示故事弹窗 */
  show(typeId: string, _chapterIndex: number, chapter: StoryChapter): void {
    this.removeChildren();
    this.visible = true;

    const type = CUSTOMER_TYPES.find(t => t.id === typeId);
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    // 全屏遮罩
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.6);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    this.addChild(overlay);

    const px = (W - POPUP_W) / 2;
    const py = (H - POPUP_H) / 2;

    // 面板背景（温暖的羊皮纸感）
    const bg = new PIXI.Graphics();
    bg.beginFill(0xFFF8E7, 0.98);
    bg.drawRoundedRect(px, py, POPUP_W, POPUP_H, 20);
    bg.endFill();

    // 外边框（金色）
    bg.lineStyle(3, 0xE0C080, 0.6);
    bg.drawRoundedRect(px, py, POPUP_W, POPUP_H, 20);

    // 内边框
    bg.lineStyle(1, 0xE0C080, 0.3);
    bg.drawRoundedRect(px + 10, py + 10, POPUP_W - 20, POPUP_H - 20, 14);
    bg.eventMode = 'static';
    this.addChild(bg);

    // 装饰花朵（顶部）
    const flowerDeco = new PIXI.Text('🌸', { fontSize: 28 });
    flowerDeco.anchor.set(0.5, 0.5);
    flowerDeco.position.set(W / 2, py + 4);
    this.addChild(flowerDeco);

    // 客人信息
    if (type) {
      const customerInfo = new PIXI.Text(`${type.emoji} ${type.name}的故事`, {
        fontSize: 13,
        fill: COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
      });
      customerInfo.anchor.set(0.5, 0);
      customerInfo.position.set(W / 2, py + 22);
      this.addChild(customerInfo);
    }

    // 章节标题
    const title = new PIXI.Text(`「${chapter.title}」`, {
      fontSize: 22,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    title.anchor.set(0.5, 0);
    title.position.set(W / 2, py + 46);
    this.addChild(title);

    // 分割装饰线
    const divider = new PIXI.Graphics();
    divider.beginFill(0xE0C080, 0.4);
    divider.drawRect(px + 60, py + 80, POPUP_W - 120, 1);
    divider.endFill();
    this.addChild(divider);

    // 故事正文
    const content = new PIXI.Text(chapter.content, {
      fontSize: 16,
      fill: 0x5D4037,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: POPUP_W - 80,
      lineHeight: 30,
      align: 'left',
    });
    content.position.set(px + 40, py + 96);
    this.addChild(content);

    // 奖励区域
    const rewardBg = new PIXI.Graphics();
    rewardBg.beginFill(0xFFF3E0, 0.8);
    rewardBg.drawRoundedRect(px + 40, py + POPUP_H - 110, POPUP_W - 80, 36, 8);
    rewardBg.endFill();
    this.addChild(rewardBg);

    const rewardText = new PIXI.Text(`🎁 故事奖励：${chapter.rewardDesc}`, {
      fontSize: 13,
      fill: 0xE65100,
      fontFamily: FONT_FAMILY,
    });
    rewardText.anchor.set(0.5, 0.5);
    rewardText.position.set(W / 2, py + POPUP_H - 92);
    this.addChild(rewardText);

    // 关闭按钮
    const closeBtn = new PIXI.Container();
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';

    const closeBg = new PIXI.Graphics();
    closeBg.beginFill(COLORS.BUTTON_PRIMARY);
    closeBg.drawRoundedRect(0, 0, 140, 42, 12);
    closeBg.endFill();
    closeBtn.addChild(closeBg);

    const closeTxt = new PIXI.Text('💝 记住了', {
      fontSize: 16,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    closeTxt.anchor.set(0.5, 0.5);
    closeTxt.position.set(70, 21);
    closeBtn.addChild(closeTxt);

    closeBtn.position.set(W / 2 - 70, py + POPUP_H - 58);
    closeBtn.on('pointerdown', () => this._close());
    this.addChild(closeBtn);

    // 入场动画
    this.alpha = 0;
    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.3,
      ease: Ease.easeOutQuad,
    });
  }

  private _close(): void {
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.2,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this.removeChildren();
      },
    });
  }
}
