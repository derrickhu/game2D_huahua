import * as PIXI from 'pixi.js';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { SettingsManager } from '@/managers/SettingsManager';
import { UserIdentityManager } from '@/managers/UserIdentityManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { Platform } from '@/core/PlatformService';

const PANEL_W = 340;
const PANEL_H = 410;

export class SettingsPanel extends PIXI.Container {
  private _isOpen = false;
  private _panel!: PIXI.Container;
  private _musicToggle!: PIXI.Container;
  private _soundToggle!: PIXI.Container;
  private _uidText!: PIXI.Text;

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
    this._refresh();
    void UserIdentityManager.refreshFromBackend().then(() => {
      if (this._isOpen) this._refresh();
    });

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

  private _build(): void {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x2b1d16, 0.38);
    overlay.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    overlay.endFill();
    overlay.eventMode = 'static';
    overlay.on('pointerdown', () => this.close());
    this.addChild(overlay);

    this._panel = new PIXI.Container();
    this._panel.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._panel.eventMode = 'static';
    this._panel.hitArea = new PIXI.RoundedRectangle(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 28);
    this._panel.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._panel);

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x6e4a35, 0.22);
    shadow.drawRoundedRect(-PANEL_W / 2 + 3, -PANEL_H / 2 + 5, PANEL_W, PANEL_H, 28);
    shadow.endFill();
    this._panel.addChild(shadow);

    const bg = new PIXI.Graphics();
    bg.beginFill(0xfffbf2, 1);
    bg.drawRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 28);
    bg.endFill();
    bg.lineStyle(5, 0xd9c0ff, 1);
    bg.drawRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 28);
    bg.lineStyle(2, 0xffc7d9, 1);
    bg.drawRoundedRect(-PANEL_W / 2 + 6, -PANEL_H / 2 + 6, PANEL_W - 12, PANEL_H - 12, 23);
    this._panel.addChild(bg);

    const titleBg = new PIXI.Graphics();
    titleBg.beginFill(0xffcf67, 1);
    titleBg.drawRoundedRect(-86, -PANEL_H / 2 - 15, 172, 46, 20);
    titleBg.endFill();
    titleBg.lineStyle(3, 0xe7a63f, 1);
    titleBg.drawRoundedRect(-86, -PANEL_H / 2 - 15, 172, 46, 20);
    this._panel.addChild(titleBg);

    const title = new PIXI.Text('设置', {
      fontSize: 24,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xb86f24,
      strokeThickness: 3,
    });
    title.anchor.set(0.5);
    title.position.set(0, -PANEL_H / 2 + 9);
    this._panel.addChild(title);

    const closeBtn = this._createCloseButton();
    closeBtn.position.set(PANEL_W / 2 - 28, -PANEL_H / 2 + 25);
    this._panel.addChild(closeBtn);

    this._musicToggle = this._createToggleRow('音乐', '背景音乐开关', -78, () => {
      SettingsManager.setMusicEnabled(!SettingsManager.musicEnabled);
      this._refresh();
      ToastMessage.show(SettingsManager.musicEnabled ? '音乐已开启' : '音乐已关闭');
    });
    this._panel.addChild(this._musicToggle);

    this._soundToggle = this._createToggleRow('音效', '点击、合成等奖励音效', -8, () => {
      SettingsManager.setSoundEnabled(!SettingsManager.soundEnabled);
      this._refresh();
      ToastMessage.show(SettingsManager.soundEnabled ? '音效已开启' : '音效已关闭');
    });
    this._panel.addChild(this._soundToggle);

    const uidBox = new PIXI.Graphics();
    uidBox.beginFill(0xffffff, 0.88);
    uidBox.drawRoundedRect(-142, 68, 284, 112, 18);
    uidBox.endFill();
    uidBox.lineStyle(2, 0xf0d4ab, 1);
    uidBox.drawRoundedRect(-142, 68, 284, 112, 18);
    this._panel.addChild(uidBox);

    const uidTitle = new PIXI.Text('游戏用户ID', {
      fontSize: 16,
      fill: 0x8b6650,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    uidTitle.anchor.set(0, 0.5);
    uidTitle.position.set(-118, 91);
    this._panel.addChild(uidTitle);

    const copyUidBtn = this._createCopyUidButton();
    copyUidBtn.position.set(108, 91);
    this._panel.addChild(copyUidBtn);

    this._uidText = new PIXI.Text('', {
      fontSize: 14,
      fill: 0x5e4637,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      letterSpacing: 1,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: 248,
      breakWords: true,
    });
    this._uidText.anchor.set(0.5);
    this._uidText.position.set(0, 121);
    this._panel.addChild(this._uidText);

    const hint = new PIXI.Text('联系客服或反馈问题时，可附上此 userId', {
      fontSize: 14,
      fill: 0x9b7b63,
      fontFamily: FONT_FAMILY,
    });
    hint.anchor.set(0.5);
    hint.position.set(0, 158);
    this._panel.addChild(hint);
  }

  private _createToggleRow(title: string, desc: string, y: number, onTap: () => void): PIXI.Container {
    const row = new PIXI.Container();
    row.position.set(0, y);

    const bg = new PIXI.Graphics();
    bg.beginFill(0xffffff, 0.78);
    bg.drawRoundedRect(-142, -27, 284, 54, 18);
    bg.endFill();
    bg.lineStyle(2, 0xf3d8b4, 0.9);
    bg.drawRoundedRect(-142, -27, 284, 54, 18);
    row.addChild(bg);

    const titleText = new PIXI.Text(title, {
      fontSize: 18,
      fill: 0x6d5142,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    titleText.anchor.set(0, 0.5);
    titleText.position.set(-118, -8);
    row.addChild(titleText);

    const descText = new PIXI.Text(desc, {
      fontSize: 12,
      fill: 0xa78a75,
      fontFamily: FONT_FAMILY,
    });
    descText.anchor.set(0, 0.5);
    descText.position.set(-118, 12);
    row.addChild(descText);

    row.eventMode = 'static';
    row.cursor = 'pointer';
    row.hitArea = new PIXI.RoundedRectangle(-142, -27, 284, 54, 18);
    row.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onTap();
    });
    return row;
  }

  private _createCopyUidButton(): PIXI.Container {
    const btn = new PIXI.Container();
    const padX = 10;
    const padY = 6;
    const label = new PIXI.Text('复制', {
      fontSize: 14,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5);
    const w = label.width + padX * 2;
    const h = label.height + padY * 2;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xd4a574, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, 10);
    bg.endFill();
    bg.lineStyle(2, 0xb8885a, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, 10);
    btn.addChild(bg);
    btn.addChild(label);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.Rectangle(-w / 2, -h / 2, w, h);
    btn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      const id = UserIdentityManager.state.id;
      if (!id || UserIdentityManager.state.loading) {
        ToastMessage.show('用户ID 获取中或暂不可用');
        return;
      }
      Platform.setClipboardData(id);
      ToastMessage.show('已复制到剪贴板');
    });
    return btn;
  }

  private _createCloseButton(): PIXI.Container {
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
    const identity = UserIdentityManager.state;
    this._uidText.text = identity.id || (identity.loading ? '获取中...' : '暂未获取');
  }

  private _drawToggle(row: PIXI.Container, enabled: boolean): void {
    const old = row.getChildByName('toggleArt');
    if (old) old.destroy({ children: true });

    const art = new PIXI.Container();
    art.name = 'toggleArt';
    art.eventMode = 'none';
    art.position.set(92, 0);
    const track = new PIXI.Graphics();
    track.beginFill(enabled ? 0x8bd36e : 0xd8c8bd, 1);
    track.drawRoundedRect(-29, -15, 58, 30, 15);
    track.endFill();
    track.lineStyle(2, enabled ? 0x5ca845 : 0xb7a397, 0.9);
    track.drawRoundedRect(-29, -15, 58, 30, 15);
    art.addChild(track);

    const knob = new PIXI.Graphics();
    knob.beginFill(0xffffff, 1);
    knob.drawCircle(enabled ? 14 : -14, 0, 12);
    knob.endFill();
    knob.lineStyle(1.5, 0xe4d8cf, 1);
    knob.drawCircle(enabled ? 14 : -14, 0, 12);
    art.addChild(knob);

    const label = new PIXI.Text(enabled ? '开' : '关', {
      fontSize: 11,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0.5);
    label.position.set(enabled ? -11 : 11, 0);
    art.addChild(label);
    row.addChild(art);
  }
}
