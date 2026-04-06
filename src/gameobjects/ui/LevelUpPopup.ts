/**
 * 升级弹窗 —— 与许愿池「恭喜获得」同款布局（散射光 + 彩带标题 + 网格 + 点击继续）；
 * 标题条默认 `pink_bar` +「恭喜升级」；关闭时仍走货币飞顶栏 / 收纳物飞礼包再入库。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import { RewardFlyCoordinator, type RewardFlyItem } from '@/core/RewardFlyCoordinator';
import {
  layoutObtainStyleRewardBlock,
  type ItemObtainEntry,
} from '@/gameobjects/ui/ItemObtainOverlay';

const LEVEL_UP_MASK_ALPHA = 0.62;

export interface LevelUpRewardPayload {
  huayuan: number;
  stamina: number;
  diamond: number;
  /** 收纳盒物品（展示 + 关闭时飞入礼包后再发放） */
  rewardBoxItems?: Array<{ itemId: string; count: number }>;
}

export interface LevelUpPopupShowOptions {
  /** 左下礼包按钮中心（全局坐标），用于飞入动画 */
  rewardFlyTargetGlobal?: PIXI.Point;
  /** 飞入结束（或无动画）后写入收纳盒 */
  onGrantRewardBoxItems?: (entries: Array<{ itemId: string; count: number }>) => void;
  /** 仅预览礼包，关闭时不写入收纳盒、不播放飞入 */
  previewOnly?: boolean;
  /** 仅 preview 时用作彩带标题；正式升级固定「恭喜升级」 */
  bannerTitle?: string;
  /** 淡出并从舞台移除完毕后回调（用于衔接后续弹窗，如花店「获得新家具」） */
  onFullyClosed?: () => void;
}

export class LevelUpPopup extends PIXI.Container {
  private _dismissing = false;
  private _previewOnly = false;
  private _pendingBoxItems: Array<{ itemId: string; count: number }> = [];
  private _flySources: Array<{ x: number; y: number; texKey: string; count: number }> = [];
  private _rewardFlyTargetGlobal: PIXI.Point | null = null;
  private _onGrantRewardBoxItems: LevelUpPopupShowOptions['onGrantRewardBoxItems'];
  private _onFullyClosed: LevelUpPopupShowOptions['onFullyClosed'];
  /** 弹窗展示用（与已入账数值一致；确定后用于飞入顶栏特效） */
  private _showHuayuan = 0;
  private _showStamina = 0;
  private _showDiamond = 0;

  constructor() {
    super();
    this.zIndex = 8000;
    this.visible = false;
  }

  show(
    level: number,
    reward: LevelUpRewardPayload & { gold?: number },
    options?: LevelUpPopupShowOptions,
  ): void {
    this.visible = true;
    this._dismissing = false;
    this._previewOnly = options?.previewOnly ?? false;
    this.removeChildren();
    this._flySources = [];
    this._rewardFlyTargetGlobal = options?.rewardFlyTargetGlobal ?? null;
    this._onGrantRewardBoxItems = options?.onGrantRewardBoxItems;
    this._onFullyClosed = options?.onFullyClosed;

    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    const huayuan = reward.huayuan > 0 ? reward.huayuan : (reward.gold ?? 0);
    const stamina = reward.stamina ?? 0;
    const diamond = reward.diamond ?? 0;
    const rewardBoxItems = reward.rewardBoxItems ?? [];
    this._pendingBoxItems = this._previewOnly ? [] : [...rewardBoxItems];
    this._showHuayuan = huayuan;
    this._showStamina = stamina;
    this._showDiamond = diamond;

    const obtainEntries: ItemObtainEntry[] = [];
    if (huayuan > 0) obtainEntries.push({ kind: 'direct_currency', currency: 'huayuan', amount: huayuan });
    if (stamina > 0) obtainEntries.push({ kind: 'direct_currency', currency: 'stamina', amount: stamina });
    if (diamond > 0) obtainEntries.push({ kind: 'direct_currency', currency: 'diamond', amount: diamond });
    for (const { itemId, count } of rewardBoxItems) {
      obtainEntries.push({ kind: 'board_item', itemId, count });
    }

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, LEVEL_UP_MASK_ALPHA);
    mask.drawRect(0, 0, W, H);
    mask.endFill();
    mask.eventMode = 'none';
    this.addChild(mask);

    const titleText = this._previewOnly
      ? (options?.bannerTitle ?? `升至 ${level}星 · 礼包预览`)
      : '恭喜升级';

    const ribbonKey = TextureCache.get('pink_bar')?.width ? 'pink_bar' : 'merge_chain_ribbon';

    const content = new PIXI.Container();
    content.eventMode = 'none';
    this.addChild(content);

    const { boardItemSlots } = layoutObtainStyleRewardBlock(content, W, H, obtainEntries, {
      ribbonTexKey: ribbonKey,
      titleText,
    });

    this._flySources = boardItemSlots.map(s => {
      const def = ITEM_DEFS.get(s.itemId);
      return { x: s.cx, y: s.cy, texKey: def?.icon ?? s.itemId, count: s.count };
    });

    this.eventMode = 'static';
    this.hitArea = new PIXI.Rectangle(0, 0, W, H);
    this.cursor = 'pointer';
    this.removeAllListeners('pointertap');
    this.on('pointertap', () => this._dismiss());

    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.35, ease: Ease.easeOutQuad });
  }

  private _dismiss(): void {
    if (this._dismissing) return;
    this._dismissing = true;

    const pending = this._pendingBoxItems;
    const preview = this._previewOnly;

    const finishClose = (): void => {
      this._fadeOutAndClose();
    };

    const grantBoxIfNeeded = (): void => {
      if (pending.length > 0 && !preview) {
        this._onGrantRewardBoxItems?.(pending);
      }
    };

    const tryBoxFly = (after: () => void): void => {
      if (
        !preview &&
        pending.length > 0 &&
        this._flySources.length > 0 &&
        this._rewardFlyTargetGlobal !== null &&
        this.parent
      ) {
        this._setPopupInteractive(false);
        this._playRewardFlyToBox(() => {
          grantBoxIfNeeded();
          after();
        });
      } else {
        grantBoxIfNeeded();
        after();
      }
    };

    const currencyItems: RewardFlyItem[] = [];
    if (!preview) {
      if (this._showHuayuan > 0) {
        currencyItems.push({ type: 'huayuan', textureKey: 'icon_huayuan', amount: this._showHuayuan });
      }
      if (this._showStamina > 0) {
        currencyItems.push({
          type: 'stamina',
          textureKey: 'stamina_chest_1',
          amount: this._showStamina,
        });
      }
      if (this._showDiamond > 0) {
        currencyItems.push({ type: 'diamond', textureKey: 'icon_gem', amount: this._showDiamond });
      }
    }

    const startGlobal = this.toGlobal(new PIXI.Point(DESIGN_WIDTH / 2, Game.logicHeight * 0.36));

    if (currencyItems.length > 0) {
      this._setPopupInteractive(false);
      RewardFlyCoordinator.playBatch(currencyItems, startGlobal, () => {
        tryBoxFly(finishClose);
      });
    } else {
      tryBoxFly(finishClose);
    }
  }

  private _setPopupInteractive(active: boolean): void {
    const mode: PIXI.EventMode = active ? 'static' : 'none';
    for (const c of this.children) {
      if ('eventMode' in c) (c as PIXI.Container).eventMode = mode;
    }
    this.eventMode = mode;
  }

  private _fadeOutAndClose(): void {
    TweenManager.cancelTarget(this);
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.28,
      ease: Ease.easeInQuad,
      onComplete: () => {
        const closedCb = this._onFullyClosed;
        this.visible = false;
        this.removeChildren();
        this._dismissing = false;
        this._previewOnly = false;
        this._pendingBoxItems = [];
        this._flySources = [];
        this._rewardFlyTargetGlobal = null;
        this._onGrantRewardBoxItems = undefined;
        this._onFullyClosed = undefined;
        this._showHuayuan = 0;
        this._showStamina = 0;
        this._showDiamond = 0;
        closedCb?.();
      },
    });
  }

  private _playRewardFlyToBox(onArrived: () => void): void {
    const parent = this.parent!;
    const endGlobal = this._rewardFlyTargetGlobal!;
    const endLocal = parent.toLocal(endGlobal);

    const flyLayer = new PIXI.Container();
    flyLayer.zIndex = 9500;
    parent.addChild(flyLayer);
    if ('sortableChildren' in parent) {
      (parent as PIXI.Container).sortableChildren = true;
      parent.sortChildren();
    }

    let remaining = this._flySources.length;
    const doneOne = (): void => {
      remaining--;
      if (remaining <= 0) {
        parent.removeChild(flyLayer);
        flyLayer.destroy({ children: true });
        onArrived();
      }
    };

    const baseIcon = 40;

    for (let i = 0; i < this._flySources.length; i++) {
      const src = this._flySources[i];
      const startGlobal = this.toGlobal(new PIXI.Point(src.x, src.y));
      const startLocal = parent.toLocal(startGlobal);

      const holder = new PIXI.Container();
      holder.position.set(startLocal.x, startLocal.y);
      flyLayer.addChild(holder);

      const tex = TextureCache.get(src.texKey);
      if (tex && tex.width > 0 && tex.height > 0) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const k = baseIcon / Math.max(tex.width, tex.height);
        sp.scale.set(k);
        holder.addChild(sp);
      } else {
        const g = new PIXI.Graphics();
        g.beginFill(0x8d9b88);
        g.drawCircle(0, 0, baseIcon * 0.42);
        g.endFill();
        holder.addChild(g);
      }

      const o = { x: startLocal.x, y: startLocal.y, s: 1 };
      TweenManager.to({
        target: o,
        props: { x: endLocal.x, y: endLocal.y, s: 0.3 },
        duration: 0.52,
        delay: i * 0.075,
        ease: Ease.easeInQuad,
        onUpdate: () => {
          holder.position.set(o.x, o.y);
          holder.scale.set(o.s);
        },
        onComplete: () => {
          holder.destroy({ children: true });
          doneOne();
        },
      });
    }
  }
}
