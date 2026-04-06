/**
 * 升级弹窗 —— 正式升星：许愿池「恭喜获得」同款（散射光 + 彩带 + 网格 + 点击继续）。
 * 星级礼包「仅预览」：`flower_egg_reward_bg` + `item_info_title_ribbon` + 奖励图标网格 + 点遮罩关闭。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import { RewardFlyCoordinator, type RewardFlyItem } from '@/core/RewardFlyCoordinator';
import {
  layoutObtainStyleRewardBlock,
  createItemObtainRewardCell,
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
  /** 仅 preview 时用作面板标题；正式升级固定「恭喜升级」 */
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
  /** 延后注册 pointertap 关闭，避免连续 show 时旧定时器重复绑监听 */
  private _dismissPointerArmTimer: ReturnType<typeof setTimeout> | null = null;

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

    const titleText = this._previewOnly
      ? (options?.bannerTitle ?? `升至 ${level}星 · 礼包预览`)
      : '恭喜升级';

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, LEVEL_UP_MASK_ALPHA);
    mask.drawRect(0, 0, W, H);
    mask.endFill();
    mask.eventMode = 'none';
    this.addChild(mask);

    if (this._previewOnly) {
      this._flySources = [];
      this._layoutStarGiftPreviewBox(W, H, obtainEntries, titleText);
      this.eventMode = 'static';
      this.hitArea = new PIXI.Rectangle(0, 0, W, H);
      this.cursor = 'default';
      this.removeAllListeners('pointertap');
      if (this._dismissPointerArmTimer !== null) {
        clearTimeout(this._dismissPointerArmTimer);
        this._dismissPointerArmTimer = null;
      }
      this._dismissPointerArmTimer = setTimeout(() => {
        this._dismissPointerArmTimer = null;
        if (!this.visible || this._dismissing) return;
        mask.eventMode = 'static';
        mask.removeAllListeners('pointertap');
        mask.cursor = 'pointer';
        mask.on('pointertap', () => this._dismiss());
      }, 80);
    } else {
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
      if (this._dismissPointerArmTimer !== null) {
        clearTimeout(this._dismissPointerArmTimer);
        this._dismissPointerArmTimer = null;
      }
      this._dismissPointerArmTimer = setTimeout(() => {
        this._dismissPointerArmTimer = null;
        if (!this.visible || this._dismissing) return;
        this.removeAllListeners('pointertap');
        this.on('pointertap', () => this._dismiss());
      }, 80);
    }

    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.35, ease: Ease.easeOutQuad });
  }

  /**
   * 升至下一星礼包预览：`flower_egg_reward_bg` 底板 + `item_info_title_ribbon` 标题（与棋盘信息条同源素材）。
   */
  private _layoutStarGiftPreviewBox(
    W: number,
    H: number,
    entries: ItemObtainEntry[],
    titleStr: string,
  ): void {
    const CELL = 72;
    const GAP = 16;
    const n = entries.length;
    const cols = n <= 0 ? 1 : Math.min(5, n);
    const rows = n <= 0 ? 1 : Math.ceil(n / cols);
    const gridW = cols * CELL + (cols - 1) * GAP;
    const gridH = rows * CELL + (rows - 1) * GAP;

    const bgTex = TextureCache.get('flower_egg_reward_bg');
    const ribTex = TextureCache.get('item_info_title_ribbon');

    const panelRoot = new PIXI.Container();
    panelRoot.position.set(W / 2, H / 2);
    panelRoot.eventMode = 'passive';
    panelRoot.interactiveChildren = true;

    let panelW = Math.min(W - 40, Math.max(300, gridW + 80));
    let panelH: number;
    let ribW = 0;
    let ribH = 0;

    if (bgTex && bgTex.width > 0) {
      if (ribTex && ribTex.width > 0) {
        ribW = Math.min(panelW - 28, 400);
        ribH = (ribW * ribTex.height) / ribTex.width;
      }
      const naturalH = (panelW * bgTex.height) / bgTex.width;
      const contentFloor = gridH + 56 + 48;
      panelH = Math.max(naturalH, (ribH > 0 ? ribH * 0.5 : 0) + contentFloor);
      panelH = Math.min(panelH, H - Game.safeTop - 48);
    } else {
      panelH = 52 + 36 + 14 + gridH + 52;
    }

    const hx = panelW / 2;
    const hy = panelH / 2;

    if (bgTex && bgTex.width > 0) {
      const bgSp = new PIXI.Sprite(bgTex);
      bgSp.anchor.set(0.5, 0.5);
      bgSp.position.set(0, 0);
      bgSp.width = panelW;
      bgSp.height = panelH;
      bgSp.eventMode = 'static';
      bgSp.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      panelRoot.addChild(bgSp);

      if (ribTex && ribTex.width > 0) {
        ribW = Math.min(panelW - 28, 400);
        ribH = (ribW * ribTex.height) / ribTex.width;
        const ribbon = new PIXI.Sprite(ribTex);
        ribbon.anchor.set(0.5, 1);
        const ribbonBottomY = -hy + 14;
        ribbon.position.set(0, ribbonBottomY);
        ribbon.width = ribW;
        ribbon.height = ribH;
        ribbon.eventMode = 'static';
        ribbon.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
        panelRoot.addChild(ribbon);

        const title = new PIXI.Text(titleStr, {
          fontSize: 18,
          fill: 0xffffff,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
          stroke: 0x6b1818,
          strokeThickness: 3.5,
          wordWrap: true,
          wordWrapWidth: ribW - 48,
          align: 'center',
        } as any);
        title.anchor.set(0.5, 0.5);
        title.position.set(0, ribbonBottomY - ribH * 0.48);
        title.eventMode = 'static';
        title.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
        panelRoot.addChild(title);
      } else {
        const title = new PIXI.Text(titleStr, {
          fontSize: 19,
          fill: COLORS.TEXT_DARK,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
          wordWrap: true,
          wordWrapWidth: panelW - 48,
          align: 'center',
        } as any);
        title.anchor.set(0.5, 0);
        title.position.set(0, -hy + 28);
        title.eventMode = 'static';
        title.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
        panelRoot.addChild(title);
      }
    } else {
      const px = -panelW / 2;
      const py = -panelH / 2;
      const panelBg = new PIXI.Graphics();
      panelBg.beginFill(0xfff8f0, 0.98);
      panelBg.drawRoundedRect(px, py, panelW, panelH, 22);
      panelBg.endFill();
      panelBg.lineStyle(3, 0xd2b48c, 0.55);
      panelBg.drawRoundedRect(px, py, panelW, panelH, 22);
      panelBg.eventMode = 'static';
      panelBg.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      panelRoot.addChild(panelBg);

      const title = new PIXI.Text(titleStr, {
        fontSize: 19,
        fill: COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: panelW - 40,
        align: 'center',
      } as any);
      title.anchor.set(0.5, 0);
      title.position.set(0, py + 26);
      title.eventMode = 'static';
      title.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      panelRoot.addChild(title);
    }

    const gridTop =
      -hy + (ribH > 0 ? Math.max(ribH * 0.42 + 28, panelH * 0.2) : 72);
    const gridLeft = -gridW / 2;

    const cellScale = CELL / 96;
    if (n === 0) {
      const empty = new PIXI.Text('暂无奖励', {
        fontSize: 16,
        fill: COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
      });
      empty.anchor.set(0.5);
      empty.position.set(0, gridTop + gridH / 2);
      panelRoot.addChild(empty);
    } else {
      for (let i = 0; i < n; i++) {
        const cell = createItemObtainRewardCell(entries[i]!, { qtyFontSize: 26 });
        cell.scale.set(cellScale);
        const r = Math.floor(i / cols);
        const c = i % cols;
        cell.position.set(
          gridLeft + c * (CELL + GAP) + CELL / 2,
          gridTop + r * (CELL + GAP) + CELL / 2,
        );
        panelRoot.addChild(cell);
      }
    }

    const hint = new PIXI.Text('点击空白处关闭', {
      fontSize: 14,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    hint.anchor.set(0.5, 1);
    hint.position.set(0, hy - 16);
    hint.eventMode = 'static';
    hint.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    panelRoot.addChild(hint);

    const closeBtn = new PIXI.Container();
    const cr = 16;
    const cbgClose = new PIXI.Graphics();
    cbgClose.beginFill(0xe57373, 0.95);
    cbgClose.drawCircle(0, 0, cr);
    cbgClose.endFill();
    cbgClose.lineStyle(2, 0xffffff, 0.92);
    const arm = 6;
    cbgClose.moveTo(-arm, -arm);
    cbgClose.lineTo(arm, arm);
    cbgClose.moveTo(arm, -arm);
    cbgClose.lineTo(-arm, arm);
    closeBtn.addChild(cbgClose);
    closeBtn.position.set(hx - 22, -hy + 26);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.hitArea = new PIXI.Circle(0, 0, cr + 10);
    closeBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._dismiss();
    });
    panelRoot.addChild(closeBtn);

    this.addChild(panelRoot);
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
        if (this._dismissPointerArmTimer !== null) {
          clearTimeout(this._dismissPointerArmTimer);
          this._dismissPointerArmTimer = null;
        }
        this.removeAllListeners('pointertap');
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
