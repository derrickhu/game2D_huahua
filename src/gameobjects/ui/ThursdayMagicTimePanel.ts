/**
 * 周四「魔法时间」：双框选择工具，展示附魔前后概率，看广告后附魔该工具实例。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { OverlayManager } from '@/core/OverlayManager';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { AdManager, AdScene, type AdFailReason } from '@/managers/AdManager';
import {
  ThursdayMagicTimeManager,
  type MagicToolOption,
} from '@/managers/ThursdayMagicTimeManager';
import { AudioManager } from '@/core/AudioManager';

const Z = 11220;
const PANEL_W = 710;
const PANEL_H = 900;
const BOX_W = 258;
const TOOL_CELL = 106;
const BUTTON_W = 270;
const BUTTON_H = 86;

export class ThursdayMagicTimePanel extends PIXI.Container {
  private _isOpen = false;
  private _opening = false;
  private _bg!: PIXI.Graphics;
  private _root!: PIXI.Container;
  private _panelShell!: PIXI.Container;
  private _leftBox!: PIXI.Container;
  private _rightBox!: PIXI.Container;
  private _intro!: PIXI.Container;
  private _picker!: PIXI.Container;
  private _button!: PIXI.Container;
  private _buttonText!: PIXI.Text;
  private _selected: MagicToolOption | null = null;
  private _adRequesting = false;
  private _pickerPage = 0;
  private _selectHintPulseTarget: PIXI.Container | null = null;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = Z;
    this.sortableChildren = true;
    this._build();
    EventBus.on('panel:openThursdayMagicTime', () => this.open());
    EventBus.on('thursdayMagicTime:changed', () => {
      if (this._isOpen) this._refresh();
    });
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    if (!ThursdayMagicTimeManager.isAvailableToday()) {
      ToastMessage.show('魔法时间仅每周四开启');
      return;
    }
    this._opening = true;
    void TextureCache.preloadPanelAssets('thursdayMagicTime').finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    ThursdayMagicTimeManager.markPromoShown();
    OverlayManager.bringToFront();
    this.visible = true;
    this._selected = null;
    this._drawPanelShell();
    this._refresh();
    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
  }

  close(): void {
    this._opening = false;
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.16,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this.alpha = 1;
        this._picker.visible = false;
        this._root.hitArea = this._panelHitArea(false);
        this._clearSelectHintPulse();
      },
    });
  }

  private _build(): void {
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.55);
    this._bg.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.zIndex = 0;
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    this._root = new PIXI.Container();
    this._root.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._root.zIndex = 2;
    this._root.sortableChildren = true;
    this._root.eventMode = 'static';
    this._root.hitArea = this._panelHitArea(false);
    this._root.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._root);

    this._panelShell = new PIXI.Container();
    this._root.addChild(this._panelShell);
    this._drawPanelShell();

    const closeHint = new PIXI.Text('点击任意空白处关闭面板', {
      fontSize: 20,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x5d4037,
      strokeThickness: 4,
    } as PIXI.TextStyle);
    closeHint.anchor.set(0.5);
    closeHint.zIndex = 1;
    closeHint.position.set(DESIGN_WIDTH / 2, Game.logicHeight - 30);
    this.addChild(closeHint);

    this._leftBox = new PIXI.Container();
    this._leftBox.position.set(-PANEL_W / 2 + 102, -92);
    this._root.addChild(this._leftBox);

    this._rightBox = new PIXI.Container();
    this._rightBox.position.set(PANEL_W / 2 - 102 - BOX_W, -92);
    this._root.addChild(this._rightBox);

    this._intro = new PIXI.Container();
    this._intro.position.set(-217, 105);
    this._root.addChild(this._intro);

    const arrow = new PIXI.Graphics();
    arrow.beginFill(0x9b5de5);
    arrow.drawRoundedRect(-30, -8, 42, 16, 8);
    arrow.moveTo(12, -22);
    arrow.lineTo(42, 0);
    arrow.lineTo(12, 22);
    arrow.lineTo(12, -22);
    arrow.endFill();
    arrow.lineStyle(3, 0xffffff, 0.75);
    arrow.drawRoundedRect(-30, -8, 42, 16, 8);
    arrow.moveTo(12, -22);
    arrow.lineTo(42, 0);
    arrow.lineTo(12, 22);
    arrow.position.set(0, -18);
    this._root.addChild(arrow);

    this._button = new PIXI.Container();
    this._button.position.set(-BUTTON_W / 2, PANEL_H / 2 - 171);
    this._button.eventMode = 'static';
    this._button.cursor = 'pointer';
    this._button.hitArea = new PIXI.Rectangle(0, 0, BUTTON_W, BUTTON_H);
    this._button.on('pointertap', () => this._onEnchantTap());
    this._root.addChild(this._button);

    this._buttonText = new PIXI.Text('', {
      fontSize: 28,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x4a2d64,
      strokeThickness: 4,
    } as PIXI.TextStyle);
    this._buttonText.anchor.set(0.5);
    this._buttonText.position.set(BUTTON_W / 2, BUTTON_H / 2);
    this._button.addChild(this._buttonText);

    this._picker = new PIXI.Container();
    this._picker.position.set(-PANEL_W / 2 + 102, 82);
    this._picker.zIndex = 20;
    this._picker.visible = false;
    this._picker.eventMode = 'static';
    this._picker.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._root.addChild(this._picker);
  }

  private _drawPanelShell(): void {
    this._panelShell.removeChildren();
    const tex = TextureCache.get('thursday_magic_time_panel_shell_nb2');
    if (tex) {
      const shell = new PIXI.Sprite(tex);
      shell.anchor.set(0.5);
      shell.width = PANEL_W;
      shell.height = PANEL_H;
      this._panelShell.addChild(shell);
      return;
    }

    const panel = new PIXI.Graphics();
    panel.beginFill(0xfef8ec, 1);
    panel.lineStyle(10, 0xd7b3ff, 1);
    panel.drawRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 42);
    panel.endFill();
    panel.lineStyle(4, 0xffc0d6, 1);
    panel.drawRoundedRect(-PANEL_W / 2 + 14, -PANEL_H / 2 + 14, PANEL_W - 28, PANEL_H - 28, 34);
    this._panelShell.addChild(panel);

    const title = new PIXI.Text('魔法时间', {
      fontSize: 48,
      fill: 0x8a43c6,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 8,
    } as PIXI.TextStyle);
    title.anchor.set(0.5);
    title.position.set(0, -PANEL_H / 2 + 78);
    this._panelShell.addChild(title);
  }

  private _panelHitArea(includePicker: boolean): PIXI.Rectangle {
    return new PIXI.Rectangle(
      -PANEL_W / 2,
      -PANEL_H / 2,
      PANEL_W,
      PANEL_H + (includePicker ? 90 : 0),
    );
  }

  private _refresh(): void {
    if (this._selected) {
      this._selected = ThursdayMagicTimeManager.getToolOptionByItemId(this._selected.itemId);
    }
    this._drawToolBox(this._leftBox, '当前工具', this._selected, false);
    this._drawToolBox(this._rightBox, '附魔后', this._selected, true);
    this._drawIntro();
    this._drawButton();
    if (this._picker.visible) this._drawPicker();
  }

  private _drawToolBox(
    root: PIXI.Container,
    title: string,
    option: MagicToolOption | null,
    magic: boolean,
  ): void {
    if (root === this._leftBox) this._clearSelectHintPulse();
    root.removeAllListeners('pointertap');
    root.eventMode = 'passive';
    root.cursor = 'default';
    root.removeChildren();

    const titleText = new PIXI.Text(title, {
      fontSize: 24,
      fill: magic ? 0x7b3db5 : 0x6d4c41,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    titleText.anchor.set(0.5);
    titleText.position.set(BOX_W / 2, 15);
    root.addChild(titleText);

    const cellX = (BOX_W - TOOL_CELL) / 2;
    const cellY = 39;
    const cell = new PIXI.Graphics();
    cell.beginFill(magic ? 0xf6e9ff : 0xfffbf0, 0.96);
    cell.lineStyle(4, magic ? 0xb26cff : 0xe1cda9);
    cell.drawRoundedRect(cellX, cellY, TOOL_CELL, TOOL_CELL, 16);
    cell.endFill();
    cell.lineStyle(2, 0xffffff, 0.85);
    cell.drawRoundedRect(cellX + 7, cellY + 7, TOOL_CELL - 14, TOOL_CELL - 14, 12);
    root.addChild(cell);

    if (!option) {
      if (magic) return;

      const hintPulse = new PIXI.Container();
      hintPulse.position.set(BOX_W / 2, cellY + TOOL_CELL / 2);
      root.addChild(hintPulse);

      const empty = new PIXI.Text('点击选择\n棋盘上的工具', {
        fontSize: 17,
        fill: 0x9a7b68,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        align: 'center',
        wordWrap: true,
        wordWrapWidth: TOOL_CELL - 18,
      });
      empty.anchor.set(0.5);
      hintPulse.addChild(empty);
      this._startSelectHintPulse(hintPulse);
      root.eventMode = 'static';
      root.cursor = 'pointer';
      root.hitArea = new PIXI.Rectangle(0, 0, BOX_W, cellY + TOOL_CELL + 20);
      root.on('pointertap', () => this._togglePicker());
      return;
    }

    const def = ITEM_DEFS.get(option.itemId);
    const tex = def ? TextureCache.get(def.icon) : null;
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const scale = 70 / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.position.set(BOX_W / 2, cellY + TOOL_CELL / 2);
      root.addChild(sp);
    }
    const energy = TextureCache.get(magic ? 'icon_energy_magic' : 'icon_energy');
    if (energy) {
      const e = new PIXI.Sprite(energy);
      e.anchor.set(1, 1);
      e.width = 32;
      e.height = 32;
      e.position.set(cellX + TOOL_CELL - 8, cellY + TOOL_CELL - 8);
      root.addChild(e);
    }

    const countLabel = option.count > 1 ? ` ×${option.count}` : '';
    const name = new PIXI.Text(`${option.name} Lv.${option.level}${countLabel}`, {
      fontSize: 18,
      fill: 0x5d4037,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: BOX_W,
    });
    name.anchor.set(0.5, 0);
    name.position.set(BOX_W / 2, cellY + TOOL_CELL + 10);
    root.addChild(name);

    const outcomes = magic ? option.magicOutcomes : option.baseOutcomes;
    this._drawOutcomeList(root, outcomes, 52, cellY + TOOL_CELL + 56);

    if (!magic) {
      root.eventMode = 'static';
      root.cursor = 'pointer';
      root.hitArea = new PIXI.Rectangle(0, 0, BOX_W, 292);
      root.on('pointertap', () => this._togglePicker());
    }
  }

  private _clearSelectHintPulse(): void {
    if (!this._selectHintPulseTarget) return;
    TweenManager.cancelTarget(this._selectHintPulseTarget);
    this._selectHintPulseTarget = null;
  }

  private _startSelectHintPulse(target: PIXI.Container): void {
    this._clearSelectHintPulse();
    this._selectHintPulseTarget = target;

    const pulseOut = (): void => {
      if (this._selectHintPulseTarget !== target || !target.parent) return;
      TweenManager.to({
        target,
        props: { alpha: 0.52 },
        duration: 0.62,
        ease: Ease.easeInOutQuad,
        onComplete: pulseIn,
      });
    };
    const pulseIn = (): void => {
      if (this._selectHintPulseTarget !== target || !target.parent) return;
      TweenManager.to({
        target,
        props: { alpha: 1 },
        duration: 0.62,
        ease: Ease.easeInOutQuad,
        onComplete: pulseOut,
      });
    };

    target.alpha = 1;
    pulseOut();
  }

  private _drawOutcomeList(root: PIXI.Container, outcomes: MagicToolOption['baseOutcomes'], x: number, y: number): void {
    const list = outcomes.slice(0, 4);
    if (outcomes.length > 4) {
      const rest = outcomes.slice(4).reduce((s, o) => s + o.percent, 0);
      if (rest > 0) list.push({ itemId: '', percent: Math.round(rest * 10) / 10 });
    }
    list.forEach((o, i) => {
      const xx = x + (i % 2) * 104;
      const yy = y + Math.floor(i / 2) * 32;
      if (o.itemId) {
        const def = ITEM_DEFS.get(o.itemId);
        const tex = def ? TextureCache.get(def.icon) : null;
        if (tex) {
          const sp = new PIXI.Sprite(tex);
          sp.anchor.set(0.5);
          const scale = 24 / Math.max(tex.width, tex.height);
          sp.scale.set(scale);
          sp.position.set(xx + 13, yy + 14);
          root.addChild(sp);
        }
      }
      const label = new PIXI.Text(o.itemId ? `${o.percent}%` : `其它${o.percent}%`, {
        fontSize: 16,
        fill: 0x5d4037,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      label.position.set(xx + 29, yy + 5);
      root.addChild(label);
    });
  }

  private _drawIntro(): void {
    this._intro.removeChildren();
    this._intro.visible = !this._selected;
    if (!this._intro.visible) return;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xfffbf0, 0.9);
    bg.lineStyle(3, 0xd7b3ff, 0.9);
    bg.drawRoundedRect(-18, -12, 462, 120, 18);
    bg.endFill();
    bg.lineStyle(2, 0xffffff, 0.75);
    bg.drawRoundedRect(-10, -4, 446, 104, 14);
    this._intro.addChild(bg);

    const lines = [
      '每次点击工具：消耗 2 体力',
      '产出在原结果上提高 1 级',
      '仅今日有效，活动结束自动恢复',
    ];

    lines.forEach((text, i) => {
      const y = i * 34;
      const dot = new PIXI.Graphics();
      dot.beginFill(i === 0 ? 0x9b5de5 : i === 1 ? 0xffb300 : 0x7e57c2);
      dot.drawCircle(12, y + 17, 7);
      dot.endFill();
      this._intro.addChild(dot);

      const label = new PIXI.Text(text, {
        fontSize: 20,
        fill: 0x6d4c41,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      label.position.set(32, y + 6);
      this._intro.addChild(label);
    });
  }

  private _togglePicker(): void {
    this._picker.visible = !this._picker.visible;
    this._root.hitArea = this._panelHitArea(this._picker.visible);
    if (this._picker.visible) {
      this._pickerPage = 0;
      this._drawPicker();
    }
  }

  private _drawPicker(): void {
    this._picker.removeChildren();
    const opts = ThursdayMagicTimeManager.listEnchantableTools();
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(opts.length / pageSize));
    this._pickerPage = Math.max(0, Math.min(this._pickerPage, totalPages - 1));
    const pageItems = opts.slice(this._pickerPage * pageSize, this._pickerPage * pageSize + pageSize);
    const h = Math.min(352, Math.max(92, pageItems.length * 58 + (totalPages > 1 ? 70 : 28)));
    this._picker.hitArea = new PIXI.Rectangle(0, 0, 558, h);
    const bg = new PIXI.Graphics();
    bg.beginFill(0xfffbf0, 0.98);
    bg.lineStyle(3, 0xd7b3ff);
    bg.drawRoundedRect(0, 0, 558, h, 18);
    bg.endFill();
    bg.eventMode = 'static';
    bg.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._picker.addChild(bg);
    if (opts.length === 0) {
      const t = new PIXI.Text('棋盘上暂无可附魔的生产工具', {
        fontSize: 22,
        fill: 0x8d6e63,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      t.anchor.set(0.5);
      t.position.set(279, h / 2);
      this._picker.addChild(t);
      return;
    }
    pageItems.forEach((o, i) => {
      const row = new PIXI.Container();
      row.position.set(12, 14 + i * 58);
      row.eventMode = 'static';
      row.cursor = 'pointer';
      row.hitArea = new PIXI.Rectangle(0, 0, 534, 52);
      const rb = new PIXI.Graphics();
      rb.beginFill(i % 2 === 0 ? 0xffffff : 0xf7edff, 0.92);
      rb.drawRoundedRect(0, 0, 534, 52, 14);
      rb.endFill();
      row.addChild(rb);
      const def = ITEM_DEFS.get(o.itemId);
      const tex = def ? TextureCache.get(def.icon) : null;
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        sp.scale.set(36 / Math.max(tex.width, tex.height));
        sp.position.set(28, 26);
        row.addChild(sp);
      }
      const countText = o.count > 1 ? `  ·  同类 ${o.count} 个` : '';
      const txt = new PIXI.Text(`${o.name} Lv.${o.level}${countText}`, {
        fontSize: 20,
        fill: 0x5d4037,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      txt.position.set(58, 14);
      row.addChild(txt);
      row.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._selected = o;
        this._picker.visible = false;
        this._root.hitArea = this._panelHitArea(false);
        this._refresh();
      });
      this._picker.addChild(row);
    });
    if (totalPages > 1) {
      const label = new PIXI.Text(`${this._pickerPage + 1}/${totalPages}`, {
        fontSize: 18,
        fill: 0x6d4c41,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      });
      label.anchor.set(0.5);
      label.position.set(279, h - 26);
      this._picker.addChild(label);
      this._addPageButton('上一页', 160, h - 44, () => {
        this._pickerPage = Math.max(0, this._pickerPage - 1);
        this._drawPicker();
      }, this._pickerPage > 0);
      this._addPageButton('下一页', 330, h - 44, () => {
        this._pickerPage = Math.min(totalPages - 1, this._pickerPage + 1);
        this._drawPicker();
      }, this._pickerPage < totalPages - 1);
    }
  }

  private _addPageButton(label: string, x: number, y: number, onTap: () => void, enabled: boolean): void {
    const btn = new PIXI.Container();
    btn.position.set(x, y);
    btn.eventMode = 'static';
    btn.cursor = enabled ? 'pointer' : 'default';
    btn.hitArea = new PIXI.Rectangle(0, 0, 84, 36);
    const bg = new PIXI.Graphics();
    bg.beginFill(enabled ? 0xb26cff : 0xd6c8de, 0.95);
    bg.drawRoundedRect(0, 0, 84, 36, 16);
    bg.endFill();
    btn.addChild(bg);
    const t = new PIXI.Text(label, {
      fontSize: 17,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    t.anchor.set(0.5);
    t.position.set(42, 18);
    btn.addChild(t);
    btn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      if (enabled) onTap();
    });
    this._picker.addChild(btn);
  }

  private _drawButton(): void {
    this._button.removeChildren();
    this._button.addChild(this._buttonText);
    const enabled = !!this._selected && !this._adRequesting;
    const bg = new PIXI.Graphics();
    bg.beginFill(enabled ? 0x9b5de5 : 0xbdbdbd);
    bg.drawRoundedRect(0, 0, BUTTON_W, BUTTON_H, 36);
    bg.endFill();
    this._button.addChildAt(bg, 0);
    this._buttonText.text = this._selected ? (this._adRequesting ? '广告请求中...' : '看广告附魔 0/1') : '请先选择工具';
    this._button.alpha = 1;
  }

  private _onEnchantTap(): void {
    if (!this._selected || this._adRequesting) return;
    const selectedItemId = this._selected.itemId;
    if (!ThursdayMagicTimeManager.getToolOptionByItemId(selectedItemId)) {
      ToastMessage.show('该工具已不可附魔，请重新选择');
      this._selected = null;
      this._refresh();
      return;
    }
    this._adRequesting = true;
    this._drawButton();
    AdManager.showRewardedAd(AdScene.THURSDAY_MAGIC_TIME, (success, reason?: AdFailReason) => {
      this._adRequesting = false;
      if (!success) {
        ToastMessage.show(
          reason === 'skipped' ? '需要看完广告才能附魔' : '广告暂不可用，请稍后再试',
        );
        this._drawButton();
        return;
      }
      const selected = this._selected;
      if (ThursdayMagicTimeManager.enchantToolGroup(selectedItemId)) {
        AudioManager.play('purchase_tap');
        if (selected) this._showEnchantSuccess(selected);
        this._selected = null;
      } else {
        ToastMessage.show('附魔失败，请重新选择工具');
      }
      this._refresh();
    });
  }

  private _showEnchantSuccess(option: MagicToolOption): void {
    const popup = new PIXI.Container();
    popup.zIndex = 50;
    popup.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2 - 90);
    this.addChild(popup);

    const cardW = DESIGN_WIDTH;
    const cardH = 265;
    const titleH = 58;

    const card = new PIXI.Graphics();
    card.beginFill(0xfffbf0, 0.97);
    card.drawRect(-cardW / 2, -cardH / 2, cardW, cardH);
    card.endFill();
    card.lineStyle(5, 0xb26cff, 0.95);
    card.moveTo(-cardW / 2, -cardH / 2);
    card.lineTo(cardW / 2, -cardH / 2);
    card.moveTo(-cardW / 2, cardH / 2);
    card.lineTo(cardW / 2, cardH / 2);
    popup.addChild(card);

    const titleBar = new PIXI.Graphics();
    titleBar.beginFill(0x9b5de5, 0.98);
    titleBar.drawRect(-cardW / 2, -cardH / 2, cardW, titleH);
    titleBar.endFill();
    popup.addChild(titleBar);

    const title = new PIXI.Text(`${option.name}附魔成功`, {
      fontSize: 30,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x5b2a91,
      strokeThickness: 4,
    } as PIXI.TextStyle);
    title.anchor.set(0.5);
    title.position.set(0, -cardH / 2 + titleH / 2 - 1);
    popup.addChild(title);

    const glow = new PIXI.Graphics();
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16;
      const inner = 36;
      const outer = i % 2 === 0 ? 96 : 78;
      glow.lineStyle(i % 2 === 0 ? 7 : 4, i % 2 === 0 ? 0xffd54f : 0xb26cff, i % 2 === 0 ? 0.48 : 0.35);
      glow.moveTo(Math.cos(a) * inner, 18 + Math.sin(a) * inner);
      glow.lineTo(Math.cos(a) * outer, 18 + Math.sin(a) * outer);
    }
    glow.beginFill(0xfff3b0, 0.62);
    for (const [x, y, r] of [[-74, -12, 6], [78, 2, 5], [-55, 66, 4], [58, 70, 4]] as const) {
      this._drawSparkle(glow, x, y, r);
    }
    glow.endFill();
    popup.addChild(glow);

    const def = ITEM_DEFS.get(option.itemId);
    const tex = def ? TextureCache.get(def.icon) : null;
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const scale = 120 / Math.max(tex.width, tex.height);
      sp.scale.set(scale);
      sp.position.set(0, 22);
      popup.addChild(sp);
    }

    const energy = TextureCache.get('icon_energy_magic');
    if (energy) {
      const badge = new PIXI.Sprite(energy);
      badge.anchor.set(1, 1);
      badge.width = 48;
      badge.height = 48;
      badge.position.set(70, 78);
      popup.addChild(badge);
    }

    const expire = new PIXI.Text('下日0点失效', {
      fontSize: 20,
      fill: 0x7b5b4a,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    expire.anchor.set(0.5);
    expire.position.set(0, 122);
    popup.addChild(expire);

    popup.alpha = 0;
    TweenManager.to({
      target: popup,
      props: { alpha: 1 },
      duration: 0.16,
      ease: Ease.easeOutQuad,
    });
    setTimeout(() => {
      TweenManager.to({
        target: popup,
        props: { alpha: 0 },
        duration: 0.18,
        ease: Ease.easeInQuad,
        onComplete: () => popup.parent?.removeChild(popup),
      });
    }, 2200);
  }

  private _drawSparkle(g: PIXI.Graphics, x: number, y: number, r: number): void {
    const inner = Math.max(2, r * 0.45);
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / 10;
      const rr = i % 2 === 0 ? r : inner;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  }
}
