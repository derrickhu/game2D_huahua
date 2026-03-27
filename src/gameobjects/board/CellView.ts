/**
 * 单格视图
 */
import * as PIXI from 'pixi.js';
import { BoardMetrics, COLORS } from '@/config/Constants';
import { CellState } from '@/config/BoardLayout';
import { TextureCache } from '@/utils/TextureCache';

export class CellView extends PIXI.Container {
  readonly cellIndex: number;

  private _bg: PIXI.Graphics;
  private _cornerBrackets: PIXI.Container | null = null;
  private _fogOverlay: PIXI.Container | null = null;
  private _keyIcon: PIXI.Container | null = null;
  private _state: CellState = CellState.OPEN;
  /** 该格物品已被客人订单锁定（已满足需求）→ 浅绿底 */
  private _orderReserved = false;
  /** 拖拽中：与拿起物品同 id 的其他已解锁格，提示可合成 */
  private _mergePartnerHint = false;

  constructor(cellIndex: number) {
    super();
    this.cellIndex = cellIndex;

    this._bg = new PIXI.Graphics();
    this.addChild(this._bg);

    this._redraw();
  }

  setState(state: CellState): void {
    if (this._state === state) return;
    this._state = state;
    this._redraw();
  }

  get cellState(): CellState {
    return this._state;
  }

  /**
   * 订单已占用该格且需求匹配完成：格底变绿（仅 OPEN / PEEK 可见格）
   */
  setOrderReserved(on: boolean): void {
    if (this._orderReserved === on) return;
    this._orderReserved = on;
    if (this._state === CellState.OPEN || this._state === CellState.PEEK) {
      this._paintCellBase();
    }
  }

  /** 拿起物品时高亮同品所在格（仅 OPEN/PEEK 有物品的底） */
  setMergePartnerHint(on: boolean): void {
    if (this._mergePartnerHint === on) return;
    this._mergePartnerHint = on;
    if (this._state === CellState.OPEN || this._state === CellState.PEEK) {
      this._paintCellBase();
    }
  }

  setHighlight(on: boolean): void {
    if (this._cornerBrackets) {
      this.removeChild(this._cornerBrackets);
      this._cornerBrackets.destroy();
      this._cornerBrackets = null;
    }
    if (on) {
      const cs = BoardMetrics.cellSize;
      const container = new PIXI.Container();
      const selTex = TextureCache.get('ui_cell_selection_corners');
      if (selTex) {
        const sp = new PIXI.Sprite(selTex);
        sp.width = cs;
        sp.height = cs;
        sp.position.set(0, 0);
        container.addChild(sp);
      } else {
        const len = cs * 0.30;
        const thick = 5;
        const color = 0xFFAA00;
        const off = -2;

        const drawCorner = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
          const g = new PIXI.Graphics();
          g.beginFill(color);
          const vx = Math.min(x1, x2), vy = Math.min(y1, y2);
          const vw = Math.abs(x2 - x1) || thick;
          const vh = Math.abs(y2 - y1) || thick;
          g.drawRoundedRect(vx, vy, vw, vh, 2);
          const hx = Math.min(x2, x3), hy = Math.min(y2, y3);
          const hw = Math.abs(x3 - x2) || thick;
          const hh = Math.abs(y3 - y2) || thick;
          g.drawRoundedRect(hx, hy, hw, hh, 2);
          g.endFill();
          container.addChild(g);
        };

        drawCorner(off, off + len, off, off, off + len, off);
        drawCorner(cs - off - thick, off + len, cs - off - thick, off, cs - off - len, off);
        drawCorner(off, cs - off - len, off, cs - off - thick, off + len, cs - off - thick);
        drawCorner(cs - off - thick, cs - off - len, cs - off - thick, cs - off - thick, cs - off - len, cs - off - thick);
      }

      this.addChild(container);
      this._cornerBrackets = container;
    }
  }

  private _paintCellBase(): void {
    const cs = BoardMetrics.cellSize;
    this._bg.clear();
    this._bg.beginFill(0xFFFBF5, 0.55);
    this._bg.drawRoundedRect(0, 0, cs, cs, 8);
    this._bg.endFill();

    const greenMatch =
      this._orderReserved &&
      (this._state === CellState.OPEN || this._state === CellState.PEEK);
    if (greenMatch) {
      this._bg.beginFill(
        COLORS.CELL_ORDER_MATCH_OVERLAY,
        COLORS.CELL_ORDER_MATCH_OVERLAY_ALPHA,
      );
      this._bg.drawRoundedRect(0, 0, cs, cs, 8);
      this._bg.endFill();
    }

    if (
      this._mergePartnerHint &&
      (this._state === CellState.OPEN || this._state === CellState.PEEK)
    ) {
      this._bg.beginFill(
        COLORS.CELL_MERGE_PARTNER_HINT,
        COLORS.CELL_MERGE_PARTNER_HINT_ALPHA,
      );
      this._bg.drawRoundedRect(0, 0, cs, cs, 8);
      this._bg.endFill();
    }
  }

  private _redraw(): void {
    const cs = BoardMetrics.cellSize;

    this._paintCellBase();

    if (this._fogOverlay) {
      this.removeChild(this._fogOverlay);
      this._fogOverlay.destroy({ children: true });
      this._fogOverlay = null;
    }
    if (this._keyIcon) {
      this.removeChild(this._keyIcon);
      this._keyIcon.destroy({ children: true });
      this._keyIcon = null;
    }

    if (this._state === CellState.FOG) {
      const lockTex = TextureCache.get('cell_locked');
      if (lockTex) {
        const sp = new PIXI.Sprite(lockTex);
        // 绸缎铺满整格
        const fitSize = cs * 1.0;
        const scale = Math.min(fitSize / lockTex.width, fitSize / lockTex.height);
        sp.scale.set(scale);
        sp.anchor.set(0.5, 0.5);
        sp.position.set(cs / 2, cs / 2);
        this._fogOverlay = sp;
      } else {
        const g = new PIXI.Graphics();
        g.beginFill(0xD8CCBE, 0.5);
        g.drawRoundedRect(4, 4, cs - 8, cs - 8, 6);
        g.endFill();
        this._fogOverlay = g;
      }
      this.addChild(this._fogOverlay);
    }

    if (this._state === CellState.KEY) {
      const keyTex = TextureCache.get('cell_key');
      if (keyTex) {
        const sp = new PIXI.Sprite(keyTex);
        const fitSize = cs * 1.0;
        const scale = Math.min(fitSize / keyTex.width, fitSize / keyTex.height);
        sp.scale.set(scale);
        sp.anchor.set(0.5, 0.5);
        sp.position.set(cs / 2, cs / 2);
        this._keyIcon = sp;
      } else {
        const fallback = new PIXI.Text('📤', { fontSize: 20 });
        fallback.anchor.set(0.5, 0.5);
        fallback.position.set(cs / 2, cs / 2);
        this._keyIcon = fallback;
      }
      this.addChild(this._keyIcon);
    }
  }
}
