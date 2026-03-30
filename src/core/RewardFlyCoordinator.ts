/**
 * 全场景统一奖励飞入：粒子挂在 Overlay 上，起点/终点用全局坐标换算。
 * 当前场景通过 setBindings 注册顶栏货币与棋盘类奖励落点。
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { OverlayManager } from '@/core/OverlayManager';
import { TextureCache } from '@/utils/TextureCache';
import { TweenManager, Ease } from '@/core/TweenManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';

export type RewardFlyItem = {
  type: string;
  textureKey: string;
  amount: number;
  itemId?: string;
};

export interface BoardPieceFlyPlan {
  textureKey: string;
  endGlobal: PIXI.IPointData;
  onLand: () => void;
}

export interface RewardFlyBindings {
  /** 货币类（gold/huayuan/diamond/stamina 等） */
  getCurrencyTarget(type: string): { endGlobal: PIXI.IPointData; onArrived: () => void } | null;
  /** 每个棋盘奖励碎片的飞行计划；overflow 由协调器 Toast */
  planBoardPieces(pieces: { itemId: string; textureKey: string }[]): {
    plans: BoardPieceFlyPlan[];
    overflowCount: number;
  };
}

export interface CheckInPanelLike {
  contentToGlobal(local: { x: number; y: number }): PIXI.Point;
  close(): void;
}

class RewardFlyCoordinatorClass {
  private _bindings: RewardFlyBindings | null = null;
  private _checkInPanel: CheckInPanelLike | null = null;
  private _eventsBound = false;

  setBindings(bindings: RewardFlyBindings | null): void {
    this._bindings = bindings;
  }

  setCheckInPanel(panel: CheckInPanelLike | null): void {
    this._checkInPanel = panel;
  }

  /** 在创建 CheckInPanel 后调用一次，注册 EventBus */
  initCheckInFlyListeners(): void {
    if (this._eventsBound) return;
    this._eventsBound = true;

    EventBus.on('checkin:flyReward', (payload: {
      items: RewardFlyItem[];
      autoClosePanel?: boolean;
    }, sourcePos: { x: number; y: number }) => {
      const panel = this._checkInPanel;
      if (!panel) return;
      const startGlobal = panel.contentToGlobal(sourcePos);
      this.playBatch(
        payload.items,
        startGlobal,
        payload.autoClosePanel ? () => { panel.close(); } : undefined,
      );
    });

    EventBus.on('checkin:flyMilestone', (ms: { items: RewardFlyItem[] }, sourcePos: { x: number; y: number }) => {
      const panel = this._checkInPanel;
      if (!panel) return;
      const startGlobal = panel.contentToGlobal(sourcePos);
      this.playBatch(ms.items, startGlobal);
    });
  }

  private _flyLayer(): PIXI.Container {
    return OverlayManager.container;
  }

  private _globalToLayerLocal(g: PIXI.IPointData): PIXI.Point {
    return this._flyLayer().toLocal(new PIXI.Point(g.x, g.y));
  }

  /**
   * 与旧 MainScene._playRewardFly 一致，坐标为 flyLayer 局部坐标
   */
  playRewardFlyLayerLocal(
    texKey: string,
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    amount: number,
    onAllArrived: () => void,
    initialDelay = 0,
  ): void {
    const tex = TextureCache.get(texKey);
    const COUNT = Math.min(Math.max(3, Math.ceil(amount / 5)), 8);
    const ICON_SIZE = 28;
    const FLY_DURATION = 0.5;
    const STAGGER = 0.04;
    let arrived = 0;
    const parent = this._flyLayer();

    for (let i = 0; i < COUNT; i++) {
      const icon = tex
        ? new PIXI.Sprite(tex)
        : new PIXI.Text('🌸', { fontSize: 20 });

      icon.anchor.set(0.5);

      let targetScale = 1;
      if (icon instanceof PIXI.Sprite && tex) {
        targetScale = ICON_SIZE / Math.max(tex.width, tex.height);
      }

      const randX = (Math.random() - 0.5) * 60;
      const randY = (Math.random() - 0.5) * 40;
      icon.position.set(sx + randX, sy + randY);
      icon.alpha = 0;
      icon.scale.set(targetScale * 0.3);

      parent.addChild(icon);

      const delay = initialDelay + i * STAGGER;

      TweenManager.to({
        target: icon,
        props: { alpha: 1 },
        duration: 0.12,
        delay,
      });
      TweenManager.to({
        target: icon.scale,
        props: { x: targetScale, y: targetScale },
        duration: 0.2,
        delay,
        ease: Ease.easeOutBack,
        onComplete: () => {
          const cpx = (icon.x + ex) / 2 + (Math.random() - 0.5) * 80;
          const cpy = Math.min(icon.y, ey) - 30 - Math.random() * 40;
          const startX = icon.x;
          const startY = icon.y;
          const progress = { t: 0 };

          TweenManager.to({
            target: progress,
            props: { t: 1 },
            duration: FLY_DURATION,
            ease: Ease.easeInQuad,
            onUpdate: () => {
              const t = progress.t;
              const mt = 1 - t;
              icon.x = mt * mt * startX + 2 * mt * t * cpx + t * t * ex;
              icon.y = mt * mt * startY + 2 * mt * t * cpy + t * t * ey;
              icon.scale.set(targetScale * (1 - t * 0.5));
              icon.alpha = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
            },
            onComplete: () => {
              icon.destroy();
              arrived++;
              if (arrived === COUNT) {
                onAllArrived();
              }
            },
          });
        },
      });
    }
  }

  /** 起点、终点均为舞台全局坐标 */
  playRewardFlyGlobal(
    texKey: string,
    startGlobal: PIXI.IPointData,
    endGlobal: PIXI.IPointData,
    amount: number,
    onAllArrived: () => void,
    initialDelay = 0,
  ): void {
    const sl = this._globalToLayerLocal(startGlobal);
    const el = this._globalToLayerLocal(endGlobal);
    this.playRewardFlyLayerLocal(texKey, sl.x, sl.y, el.x, el.y, amount, onAllArrived, initialDelay);
  }

  playBatch(
    items: RewardFlyItem[],
    startGlobal: PIXI.IPointData,
    onAllComplete?: () => void,
  ): void {
    const bindings = this._bindings;
    if (!bindings) {
      onAllComplete?.();
      return;
    }

    const sl = this._globalToLayerLocal(startGlobal);

    const currencyItems = items.filter(i => i.type !== 'board');
    const boardPieces: { itemId: string; textureKey: string }[] = [];
    for (const i of items) {
      if (i.type !== 'board' || !i.itemId) continue;
      const n = Math.max(0, Math.floor(i.amount));
      for (let k = 0; k < n; k++) {
        boardPieces.push({ itemId: i.itemId, textureKey: i.textureKey });
      }
    }

    const { plans, overflowCount } = bindings.planBoardPieces(boardPieces);
    if (overflowCount > 0) {
      ToastMessage.show('棋盘空位不足，部分物品未能发放');
    }

    let remaining = 0;
    const doneOne = (): void => {
      remaining--;
      if (remaining <= 0) onAllComplete?.();
    };

    if (currencyItems.length === 0 && plans.length === 0) {
      onAllComplete?.();
      return;
    }

    let delayIdx = 0;
    currencyItems.forEach(item => {
      const t = bindings.getCurrencyTarget(item.type);
      if (!t) return;
      remaining++;
      const d = delayIdx * 0.08;
      delayIdx++;
      const el = this._globalToLayerLocal(t.endGlobal);
      this.playRewardFlyLayerLocal(
        item.textureKey,
        sl.x,
        sl.y,
        el.x,
        el.y,
        item.amount,
        () => {
          t.onArrived();
          doneOne();
        },
        d,
      );
    });

    plans.forEach(p => {
      remaining++;
      const d = delayIdx * 0.08;
      delayIdx++;
      const el = this._globalToLayerLocal(p.endGlobal);
      this.playRewardFlyLayerLocal(
        p.textureKey,
        sl.x,
        sl.y,
        el.x,
        el.y,
        1,
        () => {
          p.onLand();
          doneOne();
        },
        d,
      );
    });

    if (remaining <= 0) onAllComplete?.();
  }
}

export const RewardFlyCoordinator = new RewardFlyCoordinatorClass();
