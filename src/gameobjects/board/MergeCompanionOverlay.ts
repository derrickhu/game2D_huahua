/**
 * 合成伴生物：漂浮「花语泡泡」
 * 主视觉用 panels 分包 NB2 贴图（实心粉玻璃气泡，见 docs/prompt/merge_companion_flower_bubble_nb2_v2_prompt.txt）；缺图时矢量回退。
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { BoardMetrics, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import {
  MergeCompanionManager,
  type MergeCompanionFloatBubble,
} from '@/managers/MergeCompanionManager';

const MERGE_BUBBLE_FRAME_TEX = 'merge_companion_flower_bubble';
/** 略透明，粉泡作底衬（物品改到上层后仍可保留一点雾感） */
const MERGE_BUBBLE_FRAME_ALPHA = 0.58;

/** 物品图标叠在气泡之上时的透明度（略透与粉泡融合） */
const MERGE_BUBBLE_ITEM_ICON_ALPHA = 0.88;

/** 与棋子格对齐的视觉比例 */
function _bubbleRadiusPx(): number {
  const cs = BoardMetrics.cellSize;
  return Math.max(44, cs * 0.52);
}

function _formatRemainSec(remainSec: number): string {
  const left = Math.max(0, Math.ceil(remainSec));
  const mm = Math.floor(left / 60);
  const ss = left % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

/** TextureCache 未加载到贴图时的矢量回退（实心粉泡 + 边沿 + 高光） */
function _drawBubbleBodyVectorFallback(container: PIXI.Container, R: number): void {
  container.removeChildren().forEach(ch => ch.destroy({ children: true }));

  for (let i = 3; i >= 1; i--) {
    const g = new PIXI.Graphics();
    const rr = R + i * 2.2;
    const a = 0.02 + (4 - i) * 0.015;
    g.beginFill(0xff6eb4, a);
    g.drawCircle(0, 0, rr);
    g.endFill();
    container.addChild(g);
  }

  const core = new PIXI.Graphics();
  core.beginFill(0xff8cc8, 0.5);
  core.drawCircle(0, 0, R * 0.98);
  core.endFill();
  core.beginFill(0xffb3d9, 0.36);
  core.drawCircle(0, 0, R * 0.82);
  core.endFill();
  core.beginFill(0xffd6ea, 0.26);
  core.drawCircle(0, 0, R * 0.58);
  core.endFill();
  container.addChild(core);

  const shadow = new PIXI.Graphics();
  shadow.beginFill(0xad1457, 0.09);
  shadow.drawCircle(2.5, 4.5, R * 0.94);
  shadow.endFill();
  container.addChild(shadow);

  const rim = new PIXI.Graphics();
  rim.lineStyle(2.6, 0xffffff, 0.58);
  rim.drawCircle(0, 0, R - 1.1);
  rim.lineStyle(3.2, 0xff79b0, 0.38);
  rim.drawCircle(0, 0, R + 0.85);
  container.addChild(rim);

  const sheen = new PIXI.Graphics();
  sheen.lineStyle(2.5, 0xffffff, 0.52);
  sheen.arc(0, 0, R - 2.8, Math.PI * 0.98, Math.PI * 1.88, false);
  container.addChild(sheen);

  const hi = new PIXI.Graphics();
  hi.beginFill(0xffffff, 0.48);
  hi.drawEllipse(-R * 0.34, -R * 0.36, R * 0.5, R * 0.3);
  hi.endFill();
  hi.beginFill(0xffffff, 0.16);
  hi.drawEllipse(R * 0.3, R * 0.28, R * 0.26, R * 0.17);
  hi.endFill();
  container.addChild(hi);
}

function _buildBubbleBody(container: PIXI.Container, R: number): void {
  const frameTex = TextureCache.get(MERGE_BUBBLE_FRAME_TEX);
  if (frameTex && frameTex.width > 0 && frameTex.height > 0) {
    container.removeChildren().forEach(ch => ch.destroy({ children: true }));
    const sp = new PIXI.Sprite(frameTex);
    const targetD = 2 * R * 1.08;
    const sc = targetD / Math.max(frameTex.width, frameTex.height);
    sp.scale.set(sc);
    sp.anchor.set(0.5, 0.5);
    sp.position.set(0, 0);
    sp.alpha = MERGE_BUBBLE_FRAME_ALPHA;
    container.addChild(sp);
    return;
  }
  _drawBubbleBodyVectorFallback(container, R);
}

/**
 * 与棋盘上花语泡泡同结构的跟手幽灵（泡在下、物品在上），供 BoardView 拖拽时使用。
 * @param expireRemainingSec 若有则显示底部倒计时条（无解锁钮）
 */
export function createMergeBubbleDragReplica(
  payloadItemId: string,
  expireRemainingSec?: number,
): PIXI.Container {
  const root = new PIXI.Container();
  root.sortableChildren = true;
  const R = _bubbleRadiusPx();

  const shadow = new PIXI.Graphics();
  shadow.zIndex = -1;
  shadow.beginFill(0x000000, 0.11);
  shadow.drawEllipse(0, R * 0.44, R * 0.38, R * 0.11);
  shadow.endFill();
  root.addChild(shadow);

  const bodyRoot = new PIXI.Container();
  bodyRoot.zIndex = 0;
  _buildBubbleBody(bodyRoot, R);
  root.addChild(bodyRoot);

  const def = ITEM_DEFS.get(payloadItemId);
  const tex = def && TextureCache.get(def.icon);
  if (tex && def) {
    const sp = new PIXI.Sprite(tex);
    const maxS = R * 1.28;
    const sc = maxS / Math.max(tex.width, tex.height);
    sp.scale.set(sc);
    sp.anchor.set(0.5, 0.5);
    sp.position.set(0, 0);
    sp.alpha = MERGE_BUBBLE_ITEM_ICON_ALPHA;
    sp.zIndex = 1;
    root.addChild(sp);
  }

  if (expireRemainingSec !== undefined && Number.isFinite(expireRemainingSec)) {
    const hud = new PIXI.Container();
    hud.zIndex = 2;
    hud.position.set(0, R * 0.58);
    const label = new PIXI.Text(_formatRemainSec(expireRemainingSec), {
      fontSize: 14,
      fill: 0x004d40,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 2,
    });
    label.anchor.set(0.5, 0.5);
    const cw = Math.max(label.width + 16, 48);
    const ch = 22;
    const bg = new PIXI.Graphics();
    bg.lineStyle(1, 0xffffff, 0.5);
    bg.beginFill(0xfffdf7, 0.94);
    bg.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, ch / 2);
    bg.endFill();
    hud.addChild(bg, label);
    root.addChild(hud);
  }

  return root;
}

class BubbleWidget {
  readonly root: PIXI.Container;
  private _bubble: MergeCompanionFloatBubble;
  private _bodyRoot: PIXI.Container;
  private _icon: PIXI.Sprite | null = null;
  private _hudRoot: PIXI.Container;
  private _countBg: PIXI.Graphics;
  private _countLabel: PIXI.Text;
  private _lastHudText = '';

  constructor(b: MergeCompanionFloatBubble) {
    this._bubble = b;
    this.root = new PIXI.Container();
    this.root.eventMode = 'static';
    this.root.cursor = 'pointer';
    this.root.sortableChildren = true;

    const R = _bubbleRadiusPx();

    this._bodyRoot = new PIXI.Container();
    this._bodyRoot.zIndex = 0;
    _buildBubbleBody(this._bodyRoot, R);
    this.root.addChild(this._bodyRoot);

    const def = ITEM_DEFS.get(b.payloadItemId);
    const tex = def && TextureCache.get(def.icon);
    if (tex && def) {
      const sp = new PIXI.Sprite(tex);
      const maxS = R * 1.28;
      const sc = maxS / Math.max(tex.width, tex.height);
      sp.scale.set(sc);
      sp.anchor.set(0.5, 0.5);
      sp.position.set(0, 0);
      sp.alpha = MERGE_BUBBLE_ITEM_ICON_ALPHA;
      sp.zIndex = 1;
      this.root.addChild(sp);
      this._icon = sp;
    }

    this._hudRoot = new PIXI.Container();
    this._hudRoot.zIndex = 2;

    const countRow = new PIXI.Container();
    countRow.position.set(0, R * 0.62);
    this._countBg = new PIXI.Graphics();
    this._countLabel = new PIXI.Text('', {
      fontSize: 15,
      fill: 0x004d40,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 2,
    });
    this._countLabel.anchor.set(0.5, 0.5);
    countRow.addChild(this._countBg, this._countLabel);
    this._hudRoot.addChild(countRow);

    this.root.addChild(this._hudRoot);
    this.refreshHudFromManager();

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
  }

  updateData(b: MergeCompanionFloatBubble): void {
    this._bubble = b;
    this._layout();
    const R = _bubbleRadiusPx();
    _buildBubbleBody(this._bodyRoot, R);
    if (this._icon && ITEM_DEFS.has(b.payloadItemId)) {
      const def = ITEM_DEFS.get(b.payloadItemId)!;
      const itex = TextureCache.get(def.icon);
      if (itex) {
        this._icon.texture = itex;
        const maxS = R * 1.28;
        const sc = maxS / Math.max(itex.width, itex.height);
        this._icon.scale.set(sc);
        this._icon.alpha = MERGE_BUBBLE_ITEM_ICON_ALPHA;
      }
    }
    this.refreshHudFromManager();
  }

  refreshHudFromManager(): void {
    const b = MergeCompanionManager.getFloatBubble(this._bubble.id);
    if (!b) return;
    this._bubble = b;
    const t = _formatRemainSec(b.expireRemainingSec);
    if (t === this._lastHudText) return;
    this._lastHudText = t;
    this._countLabel.text = t;
    const cw = Math.max(this._countLabel.width + 18, 52);
    const ch = 24;
    this._countBg.clear();
    this._countBg.lineStyle(1.2, 0xffffff, 0.55);
    this._countBg.beginFill(0xfffdf7, 0.94);
    this._countBg.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, ch / 2);
    this._countBg.endFill();
  }

  private _layout(): void {
    this.root.position.set(this._bubble.boardX, this._bubble.boardY);
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

  /** 主循环刷新棋盘泡泡上的倒计时 */
  refreshBubbleHuds(): void {
    for (const w of this._widgets.values()) {
      w.refreshHudFromManager();
    }
  }

  sync(): void {
    const list = MergeCompanionManager.getFloatBubbles();
    const ids = new Set(list.map(b => b.id));

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
        w = new BubbleWidget(b);
        this._widgets.set(b.id, w);
        this.addChild(w.root);
        w.root.zIndex = 10;
      } else {
        w.updateData(b);
      }
    }
  }
}
