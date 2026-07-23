/**
 * 装修布局预设弹层。
 * 壳图：room_layout_preset_panel_shell_nb2；中间三槽由程序绘制。
 * mode=save：点空槽保存 / 点已占槽覆盖；mode=apply：点已占槽应用。
 */
import * as PIXI from 'pixi.js';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DECO_MAP, ROOM_STYLE_MAP } from '@/config/DecorationConfig';
import { ConfirmDialog } from '@/gameobjects/ui/ConfirmDialog';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { createFreeAdBadge } from '@/gameobjects/ui/AdBadge';
import { AdManager, AdScene } from '@/managers/AdManager';
import {
  ROOM_LAYOUT_PRESET_SLOT_COUNT,
  RoomLayoutPresetManager,
  type RoomLayoutPresetSlot,
} from '@/managers/RoomLayoutPresetManager';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import { TextureCache } from '@/utils/TextureCache';

export type RoomLayoutPresetPanelMode = 'save' | 'apply';

/** 与初版程序绘制尺寸一致，勿跟超高 9:16 壳图比例拉长 */
const PANEL_W = 560;
const PANEL_H = 620;

/** 内容整体下移，避开壳顶圆角与关闭钮 */
const TITLE_Y = -PANEL_H / 2 + 72;
const HINT_Y = -PANEL_H / 2 + 108;
const CLOSE_NX = 0.91;
const CLOSE_NY = 0.07;
const CLOSE_R = 28;
/** 三槽紧贴说明文字下方 */
const SLOTS_TOP_Y = -PANEL_H / 2 + 148;

const SLOT_W = 480;
const SLOT_H = 128;
const SLOT_GAP = 14;

export class RoomLayoutPresetPanel extends PIXI.Container {
  private _isOpen = false;
  private _mode: RoomLayoutPresetPanelMode = 'save';
  private _panel!: PIXI.Container;
  private _dimOverlay!: PIXI.Graphics;
  private _shellSprite: PIXI.Sprite | null = null;
  private _fallbackBg: PIXI.Container | null = null;
  private _titleText!: PIXI.Text;
  private _hintText!: PIXI.Text;
  private _closeHit!: PIXI.Container;
  private _slotsLayer!: PIXI.Container;
  private _onApplied: (() => void) | null = null;

  constructor() {
    super();
    this.visible = false;
    this.eventMode = 'none';
    this.zIndex = 9800;
    this._build();
  }

  /** 应用预设后由 ShopScene 刷新家具 Sprite */
  setOnApplied(cb: (() => void) | null): void {
    this._onApplied = cb;
  }

  show(mode: RoomLayoutPresetPanelMode): void {
    RoomLayoutPresetManager.init();
    this._mode = mode;
    if (this._isOpen) {
      this._refresh();
      return;
    }
    this._isOpen = true;
    this.visible = true;
    this.eventMode = 'static';
    this.alpha = 0;
    this._panel.scale.set(0.92);
    this.relayout();
    void TextureCache.preloadKeys(['room_layout_preset_panel_shell_nb2']).finally(() => {
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

  get isOpen(): boolean {
    return this._isOpen;
  }

  relayout(): void {
    const h = Game.logicHeight;
    this._dimOverlay.clear();
    this._dimOverlay.beginFill(0x2b1d16, 0.42);
    this._dimOverlay.drawRect(0, 0, DESIGN_WIDTH, h);
    this._dimOverlay.endFill();
    this._panel.position.set(DESIGN_WIDTH / 2, h / 2);
  }

  private _build(): void {
    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x2b1d16, 0.42);
    overlay.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    overlay.endFill();
    overlay.eventMode = 'static';
    overlay.on('pointertap', () => this.close());
    this._dimOverlay = overlay;
    this.addChild(overlay);

    this._panel = new PIXI.Container();
    this._panel.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._panel.eventMode = 'static';
    this._panel.hitArea = new PIXI.RoundedRectangle(
      -PANEL_W / 2,
      -PANEL_H / 2,
      PANEL_W,
      PANEL_H,
      32,
    );
    this._panel.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._panel);

    this._applyShell();

    this._titleText = new PIXI.Text('布局预设', {
      fontSize: 30,
      fill: 0x6d5142,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfff6ee,
      strokeThickness: 3,
    });
    this._titleText.anchor.set(0.5);
    this._titleText.position.set(0, TITLE_Y);
    this._panel.addChild(this._titleText);

    this._hintText = new PIXI.Text('', {
      fontSize: 17,
      fill: 0x9a7f6e,
      fontFamily: FONT_FAMILY,
      align: 'center',
    });
    this._hintText.anchor.set(0.5, 0);
    this._hintText.position.set(0, HINT_Y);
    this._panel.addChild(this._hintText);

    this._closeHit = new PIXI.Container();
    this._closeHit.eventMode = 'static';
    this._closeHit.cursor = 'pointer';
    this._closeHit.position.set(
      -PANEL_W / 2 + PANEL_W * CLOSE_NX,
      -PANEL_H / 2 + PANEL_H * CLOSE_NY,
    );
    this._closeHit.hitArea = new PIXI.Circle(0, 0, CLOSE_R);
    this._closeHit.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._panel.addChild(this._closeHit);

    this._slotsLayer = new PIXI.Container();
    this._panel.addChild(this._slotsLayer);
  }

  private _applyShell(): void {
    const tex = TextureCache.get('room_layout_preset_panel_shell_nb2');
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
      if (this._fallbackBg) this._fallbackBg.visible = false;
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
    shadow.drawRoundedRect(-PANEL_W / 2 + 4, -PANEL_H / 2 + 6, PANEL_W, PANEL_H, 32);
    shadow.endFill();
    fallback.addChild(shadow);

    const outer = new PIXI.Graphics();
    outer.beginFill(0xffd6e2, 1);
    outer.lineStyle(3, 0xc48a8a, 0.85);
    outer.drawRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 32);
    outer.endFill();
    fallback.addChild(outer);

    const inner = new PIXI.Graphics();
    inner.beginFill(0xfff8f2, 1);
    inner.drawRoundedRect(
      -PANEL_W / 2 + 10,
      -PANEL_H / 2 + 10,
      PANEL_W - 20,
      PANEL_H - 20,
      26,
    );
    inner.endFill();
    fallback.addChild(inner);

    const closeVisual = new PIXI.Graphics();
    closeVisual.beginFill(0xe85d5d, 1);
    closeVisual.lineStyle(3, 0xffffff, 0.95);
    closeVisual.drawCircle(0, 0, 22);
    closeVisual.endFill();
    closeVisual.lineStyle(4, 0xffffff, 1);
    closeVisual.moveTo(-8, -8);
    closeVisual.lineTo(8, 8);
    closeVisual.moveTo(8, -8);
    closeVisual.lineTo(-8, 8);
    closeVisual.position.set(PANEL_W / 2 - 36, -PANEL_H / 2 + 36);
    fallback.addChild(closeVisual);

    this._panel.addChildAt(fallback, 0);
    this._fallbackBg = fallback;
  }

  private _refresh(): void {
    this._titleText.text = this._mode === 'save' ? '保存预设' : '显示预设';
    this._hintText.text =
      this._mode === 'save'
        ? '选择空位保存当前摆放；已有内容可覆盖'
        : '选择一套预设应用到当前房间';

    this._slotsLayer.removeChildren().forEach(c => c.destroy({ children: true }));

    const startY = SLOTS_TOP_Y + SLOT_H / 2;
    const slots = RoomLayoutPresetManager.getSlots();
    for (let i = 0; i < ROOM_LAYOUT_PRESET_SLOT_COUNT; i++) {
      const card = this._createSlotCard(i, slots[i] ?? null);
      card.position.set(0, startY + i * (SLOT_H + SLOT_GAP));
      this._slotsLayer.addChild(card);
    }
  }

  private _createSlotCard(index: number, slot: RoomLayoutPresetSlot | null): PIXI.Container {
    const root = new PIXI.Container();
    const unlocked = RoomLayoutPresetManager.isSlotUnlocked(index);

    const bg = new PIXI.Graphics();
    bg.beginFill(unlocked ? 0xfffaf4 : 0xe8e0d8, 0.96);
    bg.lineStyle(3, unlocked ? 0xe8c9a0 : 0xb8aea4, 1);
    bg.drawRoundedRect(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H, 18);
    bg.endFill();
    root.addChild(bg);

    const label = new PIXI.Text(`预设 ${index + 1}`, {
      fontSize: 22,
      fill: 0x5c4a3d,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    label.anchor.set(0, 0.5);
    label.position.set(-SLOT_W / 2 + 18, -SLOT_H / 2 + 26);
    root.addChild(label);

    if (!unlocked) {
      const lockTex = TextureCache.get('warehouse_slot_lock') ?? TextureCache.get('cell_locked');
      if (lockTex?.width) {
        const lock = new PIXI.Sprite(lockTex);
        lock.anchor.set(0.5);
        lock.position.set(0, 8);
        const s = 48 / Math.max(lockTex.width, lockTex.height);
        lock.scale.set(s);
        root.addChild(lock);
      } else {
        const lockTxt = new PIXI.Text('🔒', { fontSize: 36 });
        lockTxt.anchor.set(0.5);
        lockTxt.position.set(0, 8);
        root.addChild(lockTxt);
      }
      const badge = createFreeAdBadge(15, 0xffffff, 0x333333, '看广告解锁', 18);
      badge.position.set(-badge.width / 2, SLOT_H / 2 - 32);
      root.addChild(badge);

      root.eventMode = 'static';
      root.cursor = 'pointer';
      root.hitArea = new PIXI.Rectangle(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H);
      root.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        void this._onLockedSlotTap();
      });
      return root;
    }

    if (!slot) {
      const empty = new PIXI.Text(this._mode === 'save' ? '点击保存到此空位' : '空', {
        fontSize: 20,
        fill: 0xa09080,
        fontFamily: FONT_FAMILY,
      });
      empty.anchor.set(0.5);
      empty.position.set(0, 10);
      root.addChild(empty);

      if (this._mode === 'save') {
        root.eventMode = 'static';
        root.cursor = 'pointer';
        root.hitArea = new PIXI.Rectangle(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H);
        root.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
          e.stopPropagation();
          void this._onSaveToSlot(index, false);
        });
      }
      return root;
    }

    this._addPreviewIcons(root, slot);
    const styleName = slot.roomStyleId
      ? (ROOM_STYLE_MAP.get(slot.roomStyleId)?.name ?? '房壳')
      : null;
    const countTxt = new PIXI.Text(
      styleName
        ? `${slot.placements.length} 件 · ${styleName}`
        : `${slot.placements.length} 件家具`,
      {
        fontSize: 16,
        fill: 0x7a6558,
        fontFamily: FONT_FAMILY,
      },
    );
    countTxt.anchor.set(0, 0.5);
    countTxt.position.set(-SLOT_W / 2 + 18, SLOT_H / 2 - 26);
    root.addChild(countTxt);

    const actionHint = new PIXI.Text(this._mode === 'save' ? '点击覆盖' : '点击应用', {
      fontSize: 16,
      fill: this._mode === 'save' ? 0xc48a3a : 0x4a9a5a,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    actionHint.anchor.set(1, 0.5);
    actionHint.position.set(SLOT_W / 2 - 18, SLOT_H / 2 - 26);
    root.addChild(actionHint);

    const delBtn = this._makeDeleteBtn(() => {
      void this._onDeleteSlot(index);
    });
    delBtn.position.set(SLOT_W / 2 - 42, -SLOT_H / 2 + 26);
    root.addChild(delBtn);

    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new PIXI.Rectangle(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H);
    root.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      if (this._mode === 'save') {
        void this._onSaveToSlot(index, true);
      } else {
        void this._onApplySlot(index);
      }
    });
    return root;
  }

  private _addPreviewIcons(root: PIXI.Container, slot: RoomLayoutPresetSlot): void {
    const ids: string[] = [];
    for (const p of slot.placements) {
      if (!ids.includes(p.decoId)) ids.push(p.decoId);
      if (ids.length >= 5) break;
    }
    const startX = -SLOT_W / 2 + 110;
    ids.forEach((decoId, i) => {
      const deco = DECO_MAP.get(decoId);
      const tex = deco ? TextureCache.get(deco.icon) : null;
      const cell = new PIXI.Container();
      cell.position.set(startX + i * 54, 4);
      const plate = new PIXI.Graphics();
      plate.beginFill(0xffffff, 0.92);
      plate.lineStyle(2, 0xe8d4c0, 1);
      plate.drawRoundedRect(-22, -22, 44, 44, 10);
      plate.endFill();
      cell.addChild(plate);
      if (tex?.width) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const s = 36 / Math.max(tex.width, tex.height);
        sp.scale.set(s);
        cell.addChild(sp);
      }
      root.addChild(cell);
    });
  }

  /** 程序绘制删除按钮（红底圆角胶囊 + 白字「删除」） */
  private _makeDeleteBtn(onTap: () => void): PIXI.Container {
    const wrap = new PIXI.Container();
    wrap.eventMode = 'static';
    wrap.cursor = 'pointer';

    const btnW = 64;
    const btnH = 30;
    const g = new PIXI.Graphics();
    g.beginFill(0xe85d5d, 1);
    g.lineStyle(2, 0xffffff, 0.95);
    g.drawRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);
    g.endFill();
    wrap.addChild(g);

    const label = new PIXI.Text('删除', {
      fontSize: 16,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xa03030,
      strokeThickness: 2,
    });
    label.anchor.set(0.5);
    wrap.addChild(label);

    wrap.hitArea = new PIXI.Rectangle(-btnW / 2 - 4, -btnH / 2 - 4, btnW + 8, btnH + 8);
    wrap.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onTap();
    });
    return wrap;
  }

  private async _onLockedSlotTap(): Promise<void> {
    const ok = await ConfirmDialog.show(
      '解锁预设空位',
      '观看一段广告即可解锁第 3 个布局预设空位。',
      '免费解锁',
      '取消',
    );
    if (!ok) return;
    AdManager.showRewardedAd(AdScene.ROOM_LAYOUT_PRESET_SLOT3, (success) => {
      if (!success) {
        ToastMessage.show('广告未看完，未解锁');
        return;
      }
      if (RoomLayoutPresetManager.unlockSlot3()) {
        ToastMessage.show('第 3 预设空位已解锁');
        this._refresh();
      }
    });
  }

  private async _onSaveToSlot(index: number, overwrite: boolean): Promise<void> {
    if (RoomLayoutManager.count <= 0) {
      ToastMessage.show('房间内没有家具');
      return;
    }
    if (overwrite) {
      const ok = await ConfirmDialog.show(
        '覆盖预设',
        `用当前房间摆放覆盖「预设 ${index + 1}」？`,
        '覆盖',
        '取消',
      );
      if (!ok) return;
    }
    if (RoomLayoutPresetManager.saveCurrentLayoutToSlot(index)) {
      ToastMessage.show(`已保存到预设 ${index + 1}`);
      this._refresh();
    } else {
      ToastMessage.show('保存失败');
    }
  }

  private async _onApplySlot(index: number): Promise<void> {
    const ok = await ConfirmDialog.show(
      '应用预设',
      `应用「预设 ${index + 1}」将替换当前房间摆放与房壳风格。\n家具仍保留，可从托盘再拖入。`,
      '应用',
      '取消',
    );
    if (!ok) return;
    const result = RoomLayoutPresetManager.applySlotToCurrentRoom(index);
    if (!result) {
      ToastMessage.show('此预设为空');
      return;
    }
    this._onApplied?.();
    const parts: string[] = [`已应用预设 ${index + 1}`];
    if (result.skipped > 0) {
      parts.push(`${result.skipped} 件未摆上`);
    }
    const slot = RoomLayoutPresetManager.getSlot(index);
    if (slot?.roomStyleId && !result.roomStyleApplied) {
      parts.push('房壳未解锁未切换');
    }
    ToastMessage.show(parts.join('，'));
    this.close();
  }

  private async _onDeleteSlot(index: number): Promise<void> {
    const ok = await ConfirmDialog.show(
      '删除预设',
      `确定删除「预设 ${index + 1}」？不影响当前房间摆放。`,
      '删除',
      '取消',
    );
    if (!ok) return;
    if (RoomLayoutPresetManager.clearSlot(index)) {
      ToastMessage.show('预设已删除');
      this._refresh();
    }
  }
}
