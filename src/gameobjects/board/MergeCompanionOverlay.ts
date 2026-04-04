/**
 * 合成伴生物：漂浮气泡（棋盘内任意悬浮位置，可遮挡下方格子；点选后底栏说明解锁）
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { BoardMetrics, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import {
  MergeCompanionManager,
  type MergeCompanionFloatBubble,
} from '@/managers/MergeCompanionManager';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ToastMessage } from '../ui/ToastMessage';

function _fmtCountdown(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

class BubbleWidget {
  readonly root: PIXI.Container;
  private _bubble: MergeCompanionFloatBubble;
  private _timerText: PIXI.Text;
  private _tapHint: PIXI.Text;
  private _dragHint: PIXI.Text;
  private _dismissText: PIXI.Text | null = null;
  private _icon: PIXI.Sprite | null = null;
  private _selRing: PIXI.Graphics;
  private _busy = false;
  private readonly _onSync: () => void;

  constructor(b: MergeCompanionFloatBubble, onSync: () => void) {
    this._bubble = b;
    this._onSync = onSync;
    this.root = new PIXI.Container();
    this.root.eventMode = 'static';
    this.root.cursor = 'pointer';

    const cs = BoardMetrics.cellSize;
    const R = Math.max(26, cs * 0.36);

    this._selRing = new PIXI.Graphics();
    this._selRing.visible = false;
    this.root.addChild(this._selRing);

    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 0.42);
    g.lineStyle(2.5, 0xa8d4f0, 0.95);
    g.drawCircle(0, 0, R);
    g.endFill();
    this.root.addChild(g);

    const def = ITEM_DEFS.get(b.payloadItemId);
    const tex = def && TextureCache.get(def.icon);
    if (tex && def) {
      const sp = new PIXI.Sprite(tex);
      const maxS = R * 1.25;
      const sc = maxS / Math.max(tex.width, tex.height);
      sp.scale.set(sc);
      sp.anchor.set(0.5, 0.5);
      sp.position.set(0, -R * 0.08);
      this.root.addChild(sp);
      this._icon = sp;
    }

    this._timerText = new PIXI.Text(_fmtCountdown((b.expireAt - Date.now()) / 1000), {
      fontSize: 11,
      fill: 0x2a4a5c,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._timerText.anchor.set(0.5, 0.5);
    this._timerText.position.set(0, R * 0.52);
    this.root.addChild(this._timerText);

    this._tapHint = new PIXI.Text('点选 · 解锁说明', {
      fontSize: 8,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
    });
    this._tapHint.anchor.set(0.5, 0.5);
    this._tapHint.position.set(0, R * 0.72);
    this.root.addChild(this._tapHint);

    this._dragHint = new PIXI.Text('按住拖动换位置', {
      fontSize: 8,
      fill: 0x4a6a8a,
      fontFamily: FONT_FAMILY,
    });
    this._dragHint.anchor.set(0.5, 0.5);
    this._dragHint.position.set(0, R * 0.9);
    this.root.addChild(this._dragHint);

    if (b.dismissEnabled && b.dismissHuayuanAmount > 0) {
      const dt = new PIXI.Text(`换 ${b.dismissHuayuanAmount} 花愿`, {
        fontSize: 9,
        fill: 0x6a8a6a,
        fontFamily: FONT_FAMILY,
      });
      dt.anchor.set(0.5, 0.5);
      dt.position.set(0, R * 1.22);
      dt.eventMode = 'static';
      dt.cursor = 'pointer';
      dt.on('pointerdown', e => e.stopPropagation());
      dt.on('pointertap', e => {
        e.stopPropagation();
        void this._onDismissTap();
      });
      this.root.addChild(dt);
      this._dismissText = dt;
    }

    this.root.on('pointerdown', e => {
      e.stopPropagation();
      const ne = e.nativeEvent as PointerEvent & { touches?: TouchList };
      let cx = ne?.clientX ?? 0;
      let cy = ne?.clientY ?? 0;
      const t = ne?.touches?.[0];
      if (t) {
        cx = t.clientX;
        cy = t.clientY;
      }
      EventBus.emit('mergeCompanion:bubblePointerDown', b.id, cx, cy);
    });

    this._layout();
    this._drawSelRing(R, false);
  }

  setSelected(selected: boolean): void {
    const cs = BoardMetrics.cellSize;
    const R = Math.max(26, cs * 0.36);
    this._drawSelRing(R, selected);
  }

  private _drawSelRing(R: number, on: boolean): void {
    this._selRing.visible = on;
    this._selRing.clear();
    if (!on) return;
    this._selRing.lineStyle(3, 0xffc107, 0.95);
    this._selRing.drawCircle(0, 0, R + 6);
  }

  updateData(b: MergeCompanionFloatBubble): void {
    this._bubble = b;
    if (this._dismissText && b.dismissEnabled && b.dismissHuayuanAmount > 0) {
      this._dismissText.text = `换 ${b.dismissHuayuanAmount} 花愿`;
    }
    this._layout();
  }

  refreshTimer(): void {
    const left = Math.max(0, (this._bubble.expireAt - Date.now()) / 1000);
    this._timerText.text = _fmtCountdown(left);
  }

  private _layout(): void {
    this.root.position.set(this._bubble.boardX, this._bubble.boardY);
  }

  private async _onDismissTap(): Promise<void> {
    if (this._busy) return;
    const b = this._bubble;
    if (!b.dismissEnabled || b.dismissHuayuanAmount <= 0) return;
    this._busy = true;
    try {
      const ok = await ConfirmDialog.show(
        '移除气泡',
        `移除后获得 ${b.dismissHuayuanAmount} 花愿，不会得到气泡内物品。`,
        '确认',
        '取消',
      );
      if (!ok) return;
      if (!MergeCompanionManager.dismissBubbleForHuayuan(b.id)) {
        ToastMessage.show('无法移除');
      } else {
        ToastMessage.show(`+${b.dismissHuayuanAmount} 花愿`);
      }
      this._onSync();
    } finally {
      this._busy = false;
    }
  }
}

export class MergeCompanionOverlay extends PIXI.Container {
  private readonly _widgets = new Map<string, BubbleWidget>();

  constructor() {
    super();
    this.eventMode = 'static';
    this.sortableChildren = true;
    EventBus.on('mergeCompanion:changed', () => this.sync());
    EventBus.on('mergeCompanion:bubbleDeselect', () => this.sync());
    EventBus.on('mergeCompanion:bubbleSelected', () => this.sync());
  }

  setDraggingBubbleId(id: string | null): void {
    for (const [bid, w] of this._widgets) {
      w.root.alpha = id !== null && bid === id ? 0.2 : 1;
    }
  }

  sync(): void {
    const list = MergeCompanionManager.getFloatBubbles();
    const ids = new Set(list.map(b => b.id));
    const sel = MergeCompanionManager.getSelectedBubbleId();

    for (const [id, w] of this._widgets) {
      if (!ids.has(id)) {
        this.removeChild(w.root);
        w.root.destroy({ children: true });
        this._widgets.delete(id);
      }
    }

    for (const b of list) {
      let w = this._widgets.get(b.id);
      if (!w) {
        w = new BubbleWidget(b, () => this.sync());
        this._widgets.set(b.id, w);
        this.addChild(w.root);
        w.root.zIndex = 10;
      } else {
        w.updateData(b);
      }
      w.setSelected(b.id === sel);
    }
  }

  tickTimers(): void {
    for (const w of this._widgets.values()) {
      w.refreshTimer();
    }
  }
}
