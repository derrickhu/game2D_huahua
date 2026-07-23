import * as PIXI from 'pixi.js';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { SettingsManager } from '@/managers/SettingsManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { TextureCache } from '@/utils/TextureCache';

const PANEL_W = 360;
/** 壳图 520×703 比例 */
const PANEL_ASPECT = 703 / 520;
const PANEL_H = Math.round(PANEL_W * PANEL_ASPECT);

/** 壳图关闭钮中心（相对面板左上，归一化） */
const CLOSE_NX = 0.9;
const CLOSE_NY = 0.075;
const CLOSE_R = 28;
/** 标题中心 Y（相对面板顶） */
const TITLE_NY = 0.075;
/** 内容区顶边 / 底边（相对面板高） */
const CONTENT_TOP_NY = 0.18;
const CONTENT_BOTTOM_NY = 0.93;

/** 壳内奶油区约 280 宽，行卡需留边距避免裁切 */
const ROW_W = 276;
const ROW_H = 78;
const ROW_HALF_W = ROW_W / 2;
const ROW_HALF_H = ROW_H / 2;

export class SettingsPanel extends PIXI.Container {
  private _isOpen = false;
  private _panel!: PIXI.Container;
  private _shellSprite: PIXI.Sprite | null = null;
  private _fallbackBg: PIXI.Container | null = null;
  private _titleText!: PIXI.Text;
  private _closeHit!: PIXI.Container;
  private _musicToggle!: PIXI.Container;
  private _soundToggle!: PIXI.Container;
  private _dimOverlay!: PIXI.Graphics;

  constructor() {
    super();
    this.visible = false;
    this.eventMode = 'none';
    this.zIndex = 9300;
    this._build();
  }

  show(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this.eventMode = 'static';
    this.alpha = 0;
    this._panel.scale.set(0.92);
    void TextureCache.preloadKeys(['settings_panel_shell_nb2']).finally(() => {
      if (!this._isOpen) return;
      this._applyShell();
    });
    this._refresh();

    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.16,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._panel.scale,
      props: { x: 1, y: 1 },
      duration: 0.24,
      ease: Ease.easeOutBack,
    });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.eventMode = 'none';
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.14,
      ease: Ease.easeOutQuad,
      onComplete: () => {
        if (!this._isOpen) this.visible = false;
      },
    });
  }

  /** 视口变化时保持遮罩铺满、面板居中。 */
  relayout(): void {
    const h = Game.logicHeight;
    this._dimOverlay.clear();
    this._dimOverlay.beginFill(0x2b1d16, 0.38);
    this._dimOverlay.drawRect(0, 0, DESIGN_WIDTH, h);
    this._dimOverlay.endFill();
    this._panel.position.set(DESIGN_WIDTH / 2, h / 2);
  }

  private _build(): void {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x2b1d16, 0.38);
    overlay.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    overlay.endFill();
    overlay.eventMode = 'static';
    overlay.on('pointerdown', () => this.close());
    this._dimOverlay = overlay;
    this.addChild(overlay);

    this._panel = new PIXI.Container();
    this._panel.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._panel.eventMode = 'static';
    this._panel.hitArea = new PIXI.RoundedRectangle(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 28);
    this._panel.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._panel);

    this._applyShell();

    this._titleText = new PIXI.Text('设置', {
      fontSize: 32,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xb86f24,
      strokeThickness: 4,
    });
    this._titleText.anchor.set(0.5);
    this._titleText.position.set(0, -PANEL_H / 2 + PANEL_H * TITLE_NY);
    this._panel.addChild(this._titleText);

    this._closeHit = new PIXI.Container();
    this._closeHit.eventMode = 'static';
    this._closeHit.cursor = 'pointer';
    this._closeHit.position.set(
      -PANEL_W / 2 + PANEL_W * CLOSE_NX,
      -PANEL_H / 2 + PANEL_H * CLOSE_NY,
    );
    this._closeHit.hitArea = new PIXI.Circle(0, 0, CLOSE_R);
    this._closeHit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._panel.addChild(this._closeHit);

    const contentTop = -PANEL_H / 2 + PANEL_H * CONTENT_TOP_NY;
    const contentBottom = -PANEL_H / 2 + PANEL_H * CONTENT_BOTTOM_NY;
    const contentMid = (contentTop + contentBottom) / 2;
    const rowGap = 36;
    const musicY = contentMid - (ROW_H + rowGap) / 2;
    const soundY = contentMid + (ROW_H + rowGap) / 2;

    this._musicToggle = this._createToggleRow('音乐', '背景音乐开关', musicY, () => {
      SettingsManager.setMusicEnabled(!SettingsManager.musicEnabled);
      this._refresh();
      ToastMessage.show(SettingsManager.musicEnabled ? '音乐已开启' : '音乐已关闭');
    });
    this._panel.addChild(this._musicToggle);

    this._soundToggle = this._createToggleRow('音效', '点击、合成等奖励音效', soundY, () => {
      SettingsManager.setSoundEnabled(!SettingsManager.soundEnabled);
      this._refresh();
      ToastMessage.show(SettingsManager.soundEnabled ? '音效已开启' : '音效已关闭');
    });
    this._panel.addChild(this._soundToggle);
  }

  private _applyShell(): void {
    const tex = TextureCache.get('settings_panel_shell_nb2');
    if (tex?.width) {
      if (!this._shellSprite) {
        this._shellSprite = new PIXI.Sprite(tex);
        this._shellSprite.anchor.set(0.5);
        this._panel.addChildAt(this._shellSprite, 0);
      } else {
        this._shellSprite.texture = tex;
      }
      this._shellSprite.width = PANEL_W;
      this._shellSprite.height = PANEL_H;
      this._shellSprite.visible = true;
      if (this._fallbackBg) {
        this._fallbackBg.visible = false;
      }
      return;
    }

    if (this._shellSprite) this._shellSprite.visible = false;
    if (this._fallbackBg) {
      this._fallbackBg.visible = true;
      return;
    }

    const fallback = new PIXI.Container();
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x6e4a35, 0.22);
    shadow.drawRoundedRect(-PANEL_W / 2 + 3, -PANEL_H / 2 + 5, PANEL_W, PANEL_H, 28);
    shadow.endFill();
    fallback.addChild(shadow);

    const bg = new PIXI.Graphics();
    bg.beginFill(0xfffbf2, 1);
    bg.drawRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 28);
    bg.endFill();
    bg.lineStyle(5, 0xd9c0ff, 1);
    bg.drawRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 28);
    bg.lineStyle(2, 0xffc7d9, 1);
    bg.drawRoundedRect(-PANEL_W / 2 + 6, -PANEL_H / 2 + 6, PANEL_W - 12, PANEL_H - 12, 23);
    fallback.addChild(bg);

    const titleBg = new PIXI.Graphics();
    titleBg.beginFill(0xffcf67, 1);
    titleBg.drawRoundedRect(-86, -PANEL_H / 2 - 8, 172, 46, 20);
    titleBg.endFill();
    titleBg.lineStyle(3, 0xe7a63f, 1);
    titleBg.drawRoundedRect(-86, -PANEL_H / 2 - 8, 172, 46, 20);
    fallback.addChild(titleBg);

    const closeBtn = this._createFallbackCloseButton();
    closeBtn.position.set(PANEL_W / 2 - 28, -PANEL_H / 2 + 28);
    fallback.addChild(closeBtn);

    this._panel.addChildAt(fallback, 0);
    this._fallbackBg = fallback;
  }

  private _createToggleRow(title: string, desc: string, y: number, onTap: () => void): PIXI.Container {
    const row = new PIXI.Container();
    row.position.set(0, y);

    const bg = new PIXI.Graphics();
    bg.beginFill(0xffffff, 0.78);
    bg.drawRoundedRect(-ROW_HALF_W, -ROW_HALF_H, ROW_W, ROW_H, 24);
    bg.endFill();
    bg.lineStyle(2, 0xf3d8b4, 0.9);
    bg.drawRoundedRect(-ROW_HALF_W, -ROW_HALF_H, ROW_W, ROW_H, 24);
    row.addChild(bg);

    const titleText = new PIXI.Text(title, {
      fontSize: 26,
      fill: 0x6d5142,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    titleText.anchor.set(0, 0.5);
    titleText.position.set(-ROW_HALF_W + 18, -12);
    row.addChild(titleText);

    const descText = new PIXI.Text(desc, {
      fontSize: 15,
      fill: 0xa78a75,
      fontFamily: FONT_FAMILY,
    });
    descText.anchor.set(0, 0.5);
    descText.position.set(-ROW_HALF_W + 18, 16);
    row.addChild(descText);

    row.eventMode = 'static';
    row.cursor = 'pointer';
    row.hitArea = new PIXI.RoundedRectangle(-ROW_HALF_W, -ROW_HALF_H, ROW_W, ROW_H, 24);
    row.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onTap();
    });
    return row;
  }

  private _createFallbackCloseButton(): PIXI.Container {
    const btn = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0xef6b6b, 1);
    bg.drawCircle(0, 0, 18);
    bg.endFill();
    bg.lineStyle(2.5, 0xffffff, 0.95);
    bg.drawCircle(0, 0, 18);
    bg.lineStyle(3, 0xffffff, 1);
    bg.moveTo(-6, -6);
    bg.lineTo(6, 6);
    bg.moveTo(6, -6);
    bg.lineTo(-6, 6);
    btn.addChild(bg);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.Circle(0, 0, 28);
    btn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    return btn;
  }

  private _refresh(): void {
    this._drawToggle(this._musicToggle, SettingsManager.musicEnabled);
    this._drawToggle(this._soundToggle, SettingsManager.soundEnabled);
  }

  private _drawToggle(row: PIXI.Container, enabled: boolean): void {
    const old = row.getChildByName('toggleArt');
    if (old) old.destroy({ children: true });

    const art = new PIXI.Container();
    art.name = 'toggleArt';
    art.eventMode = 'none';
    art.position.set(ROW_HALF_W - 48, 0);
    const track = new PIXI.Graphics();
    track.beginFill(enabled ? 0x8bd36e : 0xd8c8bd, 1);
    track.drawRoundedRect(-40, -20, 80, 40, 20);
    track.endFill();
    track.lineStyle(2.5, enabled ? 0x5ca845 : 0xb7a397, 0.9);
    track.drawRoundedRect(-40, -20, 80, 40, 20);
    art.addChild(track);

    const knob = new PIXI.Graphics();
    knob.beginFill(0xffffff, 1);
    knob.drawCircle(enabled ? 18 : -18, 0, 16);
    knob.endFill();
    knob.lineStyle(1.8, 0xe4d8cf, 1);
    knob.drawCircle(enabled ? 18 : -18, 0, 16);
    art.addChild(knob);

    const label = new PIXI.Text(enabled ? '开' : '关', {
      fontSize: 15,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5);
    label.position.set(enabled ? -14 : 14, 0);
    art.addChild(label);
    row.addChild(art);
  }
}
