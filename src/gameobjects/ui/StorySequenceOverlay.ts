/**
 * StorySequenceOverlay — 开场故事插画全屏序列
 *
 * 展示 3-4 张故事插画 + 文案，玩家点击翻页。
 * zIndex 9000，在教程遮罩之上。
 * 结束后 emit 'tutorial:storyDone' 并自毁。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';

export interface StoryPage {
  /** TextureCache key for the illustration */
  textureKey: string;
  /** Story text shown at the bottom */
  text: string;
}

const DEFAULT_PAGES: StoryPage[] = [
  {
    textureKey: 'tutorial_story_1',
    text: '小镇边上有一家小花店，是奶奶一手打理起来的。\n小时候，这里是我最喜欢的地方。',
  },
  {
    textureKey: 'tutorial_story_2',
    text: '"小花，奶奶老了，花店快开不下去了。\n你愿意回来看看吗？"',
  },
  {
    textureKey: 'tutorial_story_3',
    text: '我决定回来。推开门的那一刻，\n熟悉的花香扑面而来——\n花店还在，只是需要有人重新照料。',
  },
  {
    textureKey: 'tutorial_story_4',
    text: '从今天起，我要让这家花店重新热闹起来！',
  },
];

export class StorySequenceOverlay extends PIXI.Container {
  private _pages: StoryPage[];
  private _currentPage = 0;
  private _pageContainer!: PIXI.Container;
  private _textContainer!: PIXI.Container;
  private _tapLayer!: PIXI.Graphics;
  private _skipBtn!: PIXI.Container;
  private _pageIndicator!: PIXI.Container;
  private _transitioning = false;
  private _onDone: () => void;

  constructor(onDone: () => void, pages?: StoryPage[]) {
    super();
    this._onDone = onDone;
    this._pages = pages || DEFAULT_PAGES;
    this.zIndex = 9000;
    this.eventMode = 'static';
    this._build();
    this._showPage(0);
  }

  private _build(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    // Full-screen black background (pure visual)
    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 1);
    bg.drawRect(0, 0, W, H);
    bg.endFill();
    bg.eventMode = 'none';
    this.addChild(bg);

    // Page container (holds illustration) — 不参与事件
    this._pageContainer = new PIXI.Container();
    this._pageContainer.eventMode = 'none';
    this.addChild(this._pageContainer);

    // Text container (bottom gradient + text) — 不参与事件
    this._textContainer = new PIXI.Container();
    this._textContainer.eventMode = 'none';
    this.addChild(this._textContainer);

    // 全屏透明点击层（在视觉元素之上、按钮之下）
    this._tapLayer = new PIXI.Graphics();
    this._tapLayer.beginFill(0x000000, 0.001);
    this._tapLayer.drawRect(0, 0, W, H);
    this._tapLayer.endFill();
    this._tapLayer.eventMode = 'static';
    this._tapLayer.on('pointertap', () => this._advance());
    this._tapLayer.on('pointerdown', () => this._advance());
    this.addChild(this._tapLayer);

    // Page indicator dots (pure visual)
    this._pageIndicator = new PIXI.Container();
    this._pageIndicator.eventMode = 'none';
    this._buildPageIndicator();
    this.addChild(this._pageIndicator);

    // Skip button (top-right) — 在 tapLayer 之上，能正常拦截事件
    this._skipBtn = this._buildSkipButton();
    this.addChild(this._skipBtn);
  }

  private _buildPageIndicator(): void {
    const total = this._pages.length;
    const dotR = 6;
    const gap = 18;
    const totalW = total * dotR * 2 + (total - 1) * gap;
    const startX = (DESIGN_WIDTH - totalW) / 2 + dotR;
    const y = Game.logicHeight - 50;

    for (let i = 0; i < total; i++) {
      const dot = new PIXI.Graphics();
      dot.beginFill(0xFFFFFF, i === 0 ? 1 : 0.4);
      dot.drawCircle(0, 0, dotR);
      dot.endFill();
      dot.position.set(startX + i * (dotR * 2 + gap), y);
      dot.name = `dot_${i}`;
      this._pageIndicator.addChild(dot);
    }
  }

  private _updatePageIndicator(idx: number): void {
    for (let i = 0; i < this._pages.length; i++) {
      const dot = this._pageIndicator.getChildByName(`dot_${i}`) as PIXI.Graphics;
      if (dot) dot.alpha = i === idx ? 1 : 0.4;
    }
  }

  private _buildSkipButton(): PIXI.Container {
    const container = new PIXI.Container();
    const W = 96;
    const H = 42;
    const x = DESIGN_WIDTH - W - 20;
    const y = Game.safeTop + 16;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.35);
    bg.drawRoundedRect(0, 0, W, H, H / 2);
    bg.endFill();
    container.addChild(bg);

    const label = new PIXI.Text('跳过 >>', {
      fontSize: 17,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5, 0.5);
    label.position.set(W / 2, H / 2);
    container.addChild(label);

    container.position.set(x, y);
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._finish();
    });
    container.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._finish();
    });

    return container;
  }

  private _showPage(idx: number): void {
    const page = this._pages[idx];
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    // Clear previous
    this._pageContainer.removeChildren();
    this._textContainer.removeChildren();

    // Illustration
    const tex = TextureCache.get(page.textureKey);
    if (tex) {
      const sprite = new PIXI.Sprite(tex);
      const scale = Math.max(W / tex.width, H / tex.height);
      sprite.scale.set(scale);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(W / 2, H / 2);
      this._pageContainer.addChild(sprite);
    } else {
      // Fallback: pastel gradient
      const fallback = new PIXI.Graphics();
      const colors = [0xF8E8F0, 0xE8F0E4, 0xFFF5EE, 0xE0E8F8];
      fallback.beginFill(colors[idx % colors.length]);
      fallback.drawRect(0, 0, W, H);
      fallback.endFill();
      this._pageContainer.addChild(fallback);

      // Decorative flower emoji
      const decoText = new PIXI.Text('', {
        fontSize: 80,
        fontFamily: FONT_FAMILY,
      });
      decoText.anchor.set(0.5, 0.5);
      decoText.position.set(W / 2, H * 0.35);
      this._pageContainer.addChild(decoText);
    }

    // Bottom gradient overlay for text readability
    const gradH = 320;
    const gradBg = new PIXI.Graphics();
    gradBg.beginFill(0x000000, 0.6);
    gradBg.drawRect(0, H - gradH, W, gradH);
    gradBg.endFill();
    this._textContainer.addChild(gradBg);

    // Story text
    const storyText = new PIXI.Text(page.text, {
      fontSize: 26,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: W - 80,
      lineHeight: 40,
      align: 'center',
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowAlpha: 0.5,
      dropShadowBlur: 4,
      dropShadowDistance: 0,
    });
    storyText.anchor.set(0.5, 0);
    storyText.position.set(W / 2, H - gradH + 36);
    this._textContainer.addChild(storyText);

    // On last page, show action button
    const isLast = idx === this._pages.length - 1;
    if (isLast) {
      const btnW = 280;
      const btnH = 56;
      const btnX = (W - btnW) / 2;
      const btnY = H - 130;

      const btn = new PIXI.Graphics();
      btn.beginFill(0xFF8C69);
      btn.drawRoundedRect(btnX, btnY, btnW, btnH, btnH / 2);
      btn.endFill();
      this._textContainer.addChild(btn);

      const btnLabel = new PIXI.Text('开始打理花店', {
        fontSize: 22,
        fill: 0xFFFFFF,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      btnLabel.anchor.set(0.5, 0.5);
      btnLabel.position.set(btnX + btnW / 2, btnY + btnH / 2);
      this._textContainer.addChild(btnLabel);

      // 最后一页按钮需要独立交互层（挂在 overlay 上，而非 eventMode=none 的 textContainer 下）
      const lastBtnHit = new PIXI.Container();
      lastBtnHit.hitArea = new PIXI.Rectangle(btnX, btnY, btnW, btnH);
      lastBtnHit.eventMode = 'static';
      lastBtnHit.cursor = 'pointer';
      lastBtnHit.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._finish();
      });
      lastBtnHit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._finish();
      });
      this.addChild(lastBtnHit);
    } else {
      // Tap hint
      const hint = new PIXI.Text('轻触继续 >', {
        fontSize: 18,
        fill: 0xFFFFFF,
        fontFamily: FONT_FAMILY,
      });
      hint.anchor.set(0.5, 0.5);
      hint.alpha = 0.7;
      hint.position.set(W / 2, H - 90);
      this._textContainer.addChild(hint);

      // Breathing animation on hint
      const breathe = (): void => {
        TweenManager.to({
          target: hint,
          props: { alpha: 0.3 },
          duration: 0.8,
          ease: Ease.easeInOutQuad,
          onComplete: () => {
            TweenManager.to({
              target: hint,
              props: { alpha: 0.6 },
              duration: 0.8,
              ease: Ease.easeInOutQuad,
              onComplete: breathe,
            });
          },
        });
      };
      breathe();
    }

    this._updatePageIndicator(idx);

    // Fade in
    this._pageContainer.alpha = 0;
    this._textContainer.alpha = 0;
    TweenManager.to({
      target: this._pageContainer,
      props: { alpha: 1 },
      duration: 0.4,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._textContainer,
      props: { alpha: 1 },
      duration: 0.4,
      delay: 0.15,
      ease: Ease.easeOutQuad,
    });
  }

  private _advance(): void {
    if (this._transitioning) return;

    if (this._currentPage >= this._pages.length - 1) {
      return; // Last page has explicit button
    }

    this._transitioning = true;
    const nextIdx = this._currentPage + 1;

    // Fade out current
    TweenManager.to({
      target: this._pageContainer,
      props: { alpha: 0 },
      duration: 0.25,
      ease: Ease.easeInQuad,
    });
    TweenManager.to({
      target: this._textContainer,
      props: { alpha: 0 },
      duration: 0.25,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this._currentPage = nextIdx;
        this._showPage(nextIdx);
        this._transitioning = false;
      },
    });
  }

  private _finish(): void {
    if (this._transitioning) return;
    this._transitioning = true;

    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.4,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this._onDone();
        if (this.parent) this.parent.removeChild(this);
        this.destroy({ children: true });
      },
    });
  }
}
