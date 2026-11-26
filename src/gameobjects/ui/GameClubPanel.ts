/**
 * 微信游戏圈专属福利面板 V4
 *
 * 视觉与交互结构：
 *   - 底壳：`game_club_panel_shell_nb2`（9:16 手绘花坊外框 + 云牌「花友游戏圈」，不再重复堆叠顶部进圈入口栏）
 *   - 所有卡片均为手绘贴图九宫格（gc_gift_banner / gc_task_card(_ready) / gc_reward_slot / gc_tag_*）
 *   - 按钮统一游戏标准 deco_card_btn 系：
 *       · 已达标待领：绿色 `deco_card_btn_3`「领取」+ 红点
 *       · 未完成任务：珊瑚粉 `gc_btn_go_nb2` / 暖橙 `deco_card_btn_2`「去完成」，真机按视口裁剪叠挂透明 `wx.createGameClubButton` 点击直接跳进微信游戏圈
 *       · 已领完状态：暖米灰 `gc_btn_disabled_nb2`「今日已领」/ 绿勾「已领取」
 */

import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { OverlayManager } from '@/core/OverlayManager';
import { Platform } from '@/core/PlatformService';
import { TweenManager, Ease } from '@/core/TweenManager';
import { AudioManager } from '@/core/AudioManager';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { GAME_CLUB_DAILY_SIGN_REWARD, type GameClubRewardSpec } from '@/config/GameClubConfig';
import { GameClubManager, type GameClubTaskView } from '@/managers/GameClubManager';
import { TextureCache } from '@/utils/TextureCache';
import { attachCanvasMoveUp, eventClientPoint, type TouchCanvasLike } from '@/utils/canvasInteraction';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { ItemObtainOverlay, type ItemObtainEntry } from './ItemObtainOverlay';
import { ToastMessage } from './ToastMessage';

const PANEL_Z = 11320;
const FALLBACK_SHELL_W = 680;
const FALLBACK_SHELL_H = 1217;

/** 按 `game_club_panel_shell_nb2.png` (680×1217) 实测归一化锚点 */
const CLOSE_NX = 0.924;
const CLOSE_NY = 0.045;
const CLOSE_R = 50;

/** 壳内暖象牙留白井（避开顶部丝带与底部茶杯花苞/礼盒提灯） */
const CONTENT_NX = 0.100;
const CONTENT_NY = 0.294;
const CONTENT_NW = 0.800;
const CONTENT_NH = 0.500;

const DAILY_STRIP_H = 80;
const AUTH_TIP_H = 34;

const TASK_ROW_H = 122;
const TASK_ROW_GAP = 9;
const LIST_TAP_SLOP = 12;

interface NativeJumpTarget {
  node: PIXI.Container;
  w: number;
  h: number;
  clipToViewport: boolean;
}

/** 按钮统一使用游戏既有 deco_card_btn 风格（粉色/灰色为同款新绘） */
type PillVariant = 'go' | 'claim' | 'orange' | 'disabled';

const PILL_TEX: Record<PillVariant, string> = {
  go: 'gc_btn_go_nb2',
  claim: 'deco_card_btn_3',
  orange: 'deco_card_btn_2',
  disabled: 'gc_btn_disabled_nb2',
};

const PILL_STROKE: Record<PillVariant, number> = {
  go: 0xb23f55,
  claim: 0x2e8a5c,
  orange: 0xb85a12,
  disabled: 0x8a7a6a,
};

const PILL_FALLBACK: Record<PillVariant, number> = {
  go: 0xf0798c,
  claim: 0x6fd39a,
  orange: 0xf7a548,
  disabled: 0xcdbfae,
};

interface RewardSlotItem {
  texKey: string;
  qtyText: string;
}

function buildRewardSlots(reward: GameClubRewardSpec): RewardSlotItem[] {
  const out: RewardSlotItem[] = [];
  for (const it of reward.items ?? []) {
    const def = ITEM_DEFS.get(it.itemId);
    if (!def) continue;
    out.push({ texKey: def.icon, qtyText: `x${it.count}` });
  }
  if (reward.diamond && reward.diamond > 0) out.push({ texKey: 'icon_gem', qtyText: `x${reward.diamond}` });
  if (reward.flowerSign && reward.flowerSign > 0) out.push({ texKey: 'icon_flower_sign_coin', qtyText: `x${reward.flowerSign}` });
  if (reward.stamina && reward.stamina > 0) out.push({ texKey: 'icon_energy', qtyText: `x${reward.stamina}` });
  if (reward.huayuan && reward.huayuan > 0) out.push({ texKey: 'icon_huayuan', qtyText: `x${reward.huayuan}` });
  return out;
}

/**
 * 手绘贴图九宫格：边框按贴图像素给出，k 为贴图→显示的缩放（让描边/角花保持原比例不被拉变形）。
 * 贴图未加载时退化为淡米色圆角块。
 */
function nineSlice(
  key: string,
  w: number,
  h: number,
  l: number,
  t: number,
  r: number,
  b: number,
  k: number,
): PIXI.Container {
  const tex = TextureCache.get(key);
  if (tex?.width) {
    const plane = new PIXI.NineSlicePlane(tex, l, t, r, b);
    plane.width = w / k;
    plane.height = h / k;
    plane.scale.set(k);
    return plane;
  }
  const g = new PIXI.Graphics();
  g.lineStyle(2, 0xe2b9a0, 1);
  g.beginFill(0xfff8ee, 1);
  g.drawRoundedRect(0, 0, w, h, 16);
  g.endFill();
  return g;
}

function createPillButton(variant: PillVariant, label: string, w: number, h: number, fontSize = 19): PIXI.Container {
  const wrap = new PIXI.Container();
  const tex = TextureCache.get(PILL_TEX[variant]);
  if (tex?.width) {
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    sp.width = w;
    sp.height = h;
    wrap.addChild(sp);
  } else {
    const g = new PIXI.Graphics();
    g.beginFill(PILL_FALLBACK[variant], 1);
    g.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.endFill();
    wrap.addChild(g);
  }
  const txt = new PIXI.Text(label, {
    fontSize,
    fill: 0xffffff,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    stroke: PILL_STROKE[variant],
    strokeThickness: 3.5,
  } as PIXI.TextStyle);
  txt.anchor.set(0.5);
  txt.position.set(0, -2);
  wrap.addChild(txt);
  return wrap;
}

function addRedDot(target: PIXI.Container, x: number, y: number): void {
  const dot = new PIXI.Graphics();
  dot.lineStyle(2, 0xffffff, 1);
  dot.beginFill(0xff3b30, 1);
  dot.drawCircle(x, y, 7);
  dot.endFill();
  target.addChild(dot);
}

export class GameClubPanel extends PIXI.Container {
  private _isOpen = false;
  private _opening = false;
  private _obtainShowing = false;

  private _bg!: PIXI.Graphics;
  private _root!: PIXI.Container;
  private _shellSprite!: PIXI.Sprite;
  private _fallbackFrame!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _closeHit!: PIXI.Container;

  private _shellW = FALLBACK_SHELL_W;
  private _shellH = FALLBACK_SHELL_H;
  private _areaW = 544;
  private _areaH = 608;

  private _jumpTargets: NativeJumpTarget[] = [];
  private _nativeClubBtns: any[] = [];

  private _listViewport: PIXI.Container | null = null;
  private _listContent: PIXI.Container | null = null;
  private _listViewH = 520;
  private _scrollY = 0;
  private _maxScrollY = 0;
  private _scrollDragging = false;
  private _scrollMoved = false;
  private _scrollStartDesignY = 0;
  private _scrollStartOffset = 0;
  private _detachCanvasScroll: (() => void) | null = null;

  private _texUnsub: (() => void) | null = null;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = PANEL_Z;
    this.sortableChildren = true;

    this._build();

    EventBus.on('panel:openGameClub', () => this.open());
    EventBus.on('gameClub:changed', () => {
      if (this._isOpen) this._refresh();
    });

    this._texUnsub = TextureCache.onKeysLoaded(
      [
        'game_club_panel_shell_nb2',
        'gc_task_card_nb2',
        'gc_task_card_ready_nb2',
        'gc_header_card_nb2',
        'gc_gift_banner_nb2',
        'gc_reward_slot_nb2',
        'gc_tag_daily_nb2',
        'gc_tag_milestone_nb2',
        'gc_btn_disabled_nb2',
        'gc_btn_go_nb2',
        'deco_card_btn_2',
        'deco_card_btn_3',
        'warehouse_slot_lock',
        'ui_order_check_badge',
        'owner_chibi_default',
        'stamina_chest_1',
        'stamina_chest_2',
        'diamond_bag_1',
        'chest_1',
        'chest_2',
      ],
      () => {
        if (this._isOpen) {
          this._layoutShell();
          this._refresh();
        }
      },
    );
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  override destroy(options?: PIXI.IDestroyOptions | boolean): void {
    this._texUnsub?.();
    this._texUnsub = null;
    this._detachScrollListeners();
    this._destroyNativeClubButtons();
    super.destroy(options);
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    if (!GameClubManager.isEntryVisible) return;

    this._opening = true;
    void TextureCache.preloadPanelAssets('gameClub').finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    GameClubManager.setPanelOpen(true);
    this._scrollY = 0;

    OverlayManager.bringToFront();
    this.visible = true;
    this._layoutShell();
    this._refresh();
    this._attachScrollListeners();

    void GameClubManager.syncFromWechat('panel-open');

    this.alpha = 0;
    this._root.scale.set(0.94);
    TweenManager.to({
      target: this,
      props: { alpha: 1 },
      duration: 0.18,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._root.scale,
      props: { x: 1, y: 1 },
      duration: 0.22,
      ease: Ease.easeOutBack,
      onComplete: () => {
        if (this._isOpen) this._syncNativeClubButtons();
      },
    });
  }

  close(): void {
    this._opening = false;
    if (!this._isOpen) return;
    this._isOpen = false;
    GameClubManager.setPanelOpen(false);
    this._hideNativeClubButtons();
    this._detachScrollListeners();

    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.16,
      ease: Ease.easeInQuad,
      onComplete: () => {
        if (!this._isOpen) {
          this.visible = false;
          this.alpha = 1;
        }
      },
    });
  }

  relayout(): void {
    if (!this._bg) return;
    this._layoutShell();
    if (this._isOpen) {
      this._refresh();
    }
  }

  // ═══════════════ 骨架与壳体定位（与 ExchangeEventPanel 同构） ═══════════════

  private _build(): void {
    this._bg = new PIXI.Graphics();
    this._bg.eventMode = 'static';
    this._bg.on('pointertap', () => this.close());
    this.addChild(this._bg);

    this._root = new PIXI.Container();
    this._root.sortableChildren = true;
    this._root.eventMode = 'static';
    this._root.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(this._root);

    this._fallbackFrame = new PIXI.Graphics();
    this._fallbackFrame.zIndex = 0;
    this._root.addChild(this._fallbackFrame);

    this._shellSprite = new PIXI.Sprite();
    this._shellSprite.anchor.set(0.5);
    this._shellSprite.eventMode = 'none';
    this._shellSprite.zIndex = 1;
    this._root.addChild(this._shellSprite);

    this._content = new PIXI.Container();
    this._content.zIndex = 2;
    this._root.addChild(this._content);

    // 关闭热区独立挂在面板根节点，保证最高优先级可点
    this._closeHit = new PIXI.Container();
    this._closeHit.zIndex = 200;
    this._closeHit.eventMode = 'static';
    this._closeHit.cursor = 'pointer';
    const onClose = (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.play('button_click');
      this.close();
    };
    this._closeHit.on('pointerdown', onClose);
    this._closeHit.on('pointertap', onClose);
    this.addChild(this._closeHit);

    this._layoutShell();
  }

  private _layoutShell(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    this._bg.clear();
    this._bg.beginFill(0x1e1318, 0.58);
    this._bg.drawRect(0, 0, W, H);
    this._bg.endFill();
    this._bg.hitArea = new PIXI.Rectangle(0, 0, W, H);

    const centerY = Game.safeTop + (H - Game.safeTop - Game.safeBottom) / 2;
    this._root.position.set(W / 2, centerY);

    const tex = TextureCache.get('game_club_panel_shell_nb2');
    const maxW = W * 0.95;
    const maxH = (H - Game.safeTop - Game.safeBottom) * 0.94;

    if (tex && tex.width > 1) {
      this._shellSprite.texture = tex;
      this._shellSprite.visible = true;
      this._fallbackFrame.visible = false;
      const scale = Math.min(maxW / tex.width, maxH / tex.height);
      this._shellSprite.scale.set(scale);
      this._shellW = tex.width * scale;
      this._shellH = tex.height * scale;
    } else {
      this._shellSprite.visible = false;
      this._fallbackFrame.visible = true;
      const scale = Math.min(maxW / FALLBACK_SHELL_W, maxH / FALLBACK_SHELL_H);
      this._shellW = FALLBACK_SHELL_W * scale;
      this._shellH = FALLBACK_SHELL_H * scale;
      this._drawFallbackShell(this._shellW, this._shellH);
    }

    this._root.hitArea = new PIXI.RoundedRectangle(
      -this._shellW / 2,
      -this._shellH / 2,
      this._shellW,
      this._shellH,
      36,
    );

    const contentLeft = -this._shellW / 2 + this._shellW * CONTENT_NX;
    const contentTop = -this._shellH / 2 + this._shellH * CONTENT_NY;
    this._content.position.set(contentLeft, contentTop);
    this._areaW = this._shellW * CONTENT_NW;
    this._areaH = this._shellH * CONTENT_NH;

    const closeX = W / 2 - this._shellW / 2 + this._shellW * CLOSE_NX;
    const closeY = centerY - this._shellH / 2 + this._shellH * CLOSE_NY;
    this._closeHit.position.set(closeX, closeY);
    this._closeHit.hitArea = new PIXI.Circle(0, 0, CLOSE_R);
  }

  private _drawFallbackShell(w: number, h: number): void {
    const g = this._fallbackFrame;
    g.clear();
    g.lineStyle(4, 0xd8a868, 1);
    g.beginFill(0xf3d4b0, 1);
    g.drawRoundedRect(-w / 2, -h / 2, w, h, 38);
    g.endFill();
    g.beginFill(0xfff9ee, 1);
    g.drawRoundedRect(-w / 2 + 18, -h / 2 + h * 0.26, w - 36, h * 0.62, 24);
    g.endFill();

    const cx = w / 2 - w * (1 - CLOSE_NX);
    const cy = -h / 2 + h * CLOSE_NY;
    g.lineStyle(3, 0xfff3e0, 1);
    g.beginFill(0xd95852, 1);
    g.drawCircle(cx, cy, 28);
    g.endFill();
  }

  // ═══════════════ 内容重绘 ═══════════════

  private _refresh(): void {
    this._content.removeChildren();
    this._jumpTargets = [];

    this._drawDailySignCard(0);

    let listTop = DAILY_STRIP_H + 10;
    if (GameClubManager.isAuthDenied) {
      this._drawAuthDeniedBar(DAILY_STRIP_H + 6);
      listTop = DAILY_STRIP_H + 6 + AUTH_TIP_H + 8;
    }

    this._listViewH = Math.max(220, this._areaH - listTop);

    const viewport = new PIXI.Container();
    viewport.position.set(0, listTop);
    viewport.eventMode = 'static';
    viewport.hitArea = new PIXI.Rectangle(0, 0, this._areaW, this._listViewH);
    viewport.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._scrollDragging = true;
      this._scrollMoved = false;
      this._scrollStartDesignY = Game.federatedToDesign(e).y;
      this._scrollStartOffset = this._scrollY;
    });
    viewport.on('wheel' as any, (e: any) => {
      e.stopPropagation?.();
      this._scrollY += Math.sign(e.deltaY || 0) * 52;
      this._clampScroll();
    });

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff, 1);
    mask.drawRoundedRect(0, 0, this._areaW, this._listViewH, 16);
    mask.endFill();
    viewport.addChild(mask);

    const listContent = new PIXI.Container();
    listContent.mask = mask;
    viewport.addChild(listContent);

    this._content.addChild(viewport);
    this._listViewport = viewport;
    this._listContent = listContent;

    const tasks = GameClubManager.getTaskViews();
    let y = 0;
    for (const view of tasks) {
      const card = this._createTaskCard(view);
      card.position.set(0, y);
      listContent.addChild(card);
      y += TASK_ROW_H + TASK_ROW_GAP;
    }

    const totalH = Math.max(0, y - TASK_ROW_GAP + 6);
    this._maxScrollY = Math.max(0, totalH - this._listViewH);
    this._clampScroll();
  }

  /** 仅当玩家拒绝过游戏圈数据授权时展示一行紧凑引导条，平时不占空间 */
  private _drawAuthDeniedBar(topY: number): void {
    const bar = new PIXI.Container();
    bar.position.set(0, topY);
    bar.eventMode = 'static';
    bar.cursor = 'pointer';

    const bg = new PIXI.Graphics();
    bg.lineStyle(1.5, 0xe5b199, 0.95);
    bg.beginFill(0xfff1ea, 0.96);
    bg.drawRoundedRect(4, 0, this._areaW - 8, AUTH_TIP_H, AUTH_TIP_H / 2);
    bg.endFill();
    bar.addChild(bg);

    const tip = new PIXI.Text('未开启游戏圈数据权限 · 点此开启后自动统计点赞/评论进度 >', {
      fontSize: 14,
      fill: 0xb8432e,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    tip.anchor.set(0.5);
    tip.position.set(this._areaW / 2, AUTH_TIP_H / 2);
    bar.addChild(tip);

    bar.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      AudioManager.play('button_click');
      void GameClubManager.openAuthSettingAndSync().then((ok) => {
        ToastMessage.show(ok ? '游戏圈数据已同步！' : '开启游戏圈数据授权后即可自动统计任务');
      });
    });

    this._content.addChild(bar);
  }

  /** 1) 每日逛圈礼包：手绘杏色丝带横幅（未完成点击直接进圈，进圈返回后变绿色「领取」） */
  private _drawDailySignCard(topY: number): void {
    const card = new PIXI.Container();
    card.position.set(0, topY);

    // 横幅 600×189：左侧礼盒+飘带约 210px、右侧飘带约 70px；只做横向拉伸
    const k = DAILY_STRIP_H / 189;
    card.addChild(nineSlice('gc_gift_banner_nb2', this._areaW, DAILY_STRIP_H, 210, 94, 70, 94, k));

    const textX = 196 * k + 4;
    const title = new PIXI.Text('每日逛圈礼包', {
      fontSize: 19,
      fill: 0x7a3b16,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    title.anchor.set(0, 0.5);
    title.position.set(textX, DAILY_STRIP_H / 2 - 13);
    card.addChild(title);

    let rx = textX;
    const rcy = DAILY_STRIP_H / 2 + 14;
    for (const slot of buildRewardSlots(GAME_CLUB_DAILY_SIGN_REWARD)) {
      const tex = TextureCache.get(slot.texKey);
      if (tex?.width) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        sp.scale.set(Math.min(24 / tex.width, 24 / tex.height));
        sp.position.set(rx + 11, rcy);
        card.addChild(sp);
      }
      const q = new PIXI.Text(slot.qtyText, {
        fontSize: 14,
        fill: 0x8a4a22,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as PIXI.TextStyle);
      q.anchor.set(0, 0.5);
      q.position.set(rx + 24, rcy);
      card.addChild(q);
      rx += 24 + q.width + 10;
    }

    const claimed = GameClubManager.dailySignClaimedToday;
    const canClaim = GameClubManager.canClaimDailySign;
    const variant: PillVariant = claimed ? 'disabled' : canClaim ? 'claim' : 'orange';
    const label = claimed ? '今日已领' : canClaim ? '领取' : '去完成';
    const btnW = 126;
    const btnH = 50;
    const btn = createPillButton(variant, label, btnW, btnH, 19);
    btn.position.set(this._areaW - 70 * k - btnW / 2 - 4, DAILY_STRIP_H / 2 - 2);
    if (canClaim) addRedDot(btn, btnW / 2 - 8, -btnH / 2 + 8);
    if (!claimed) {
      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      btn.hitArea = new PIXI.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);
      btn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        AudioManager.play('button_click');
        if (canClaim) {
          const entries = GameClubManager.claimDailySign();
          if (entries && entries.length > 0) this._presentObtainRewards(entries);
        } else {
          this._handleFallbackJumpTap();
        }
      });
      if (!canClaim) {
        this._jumpTargets.push({ node: btn, w: btnW, h: btnH, clipToViewport: false });
      }
    }
    card.addChild(btn);
    this._content.addChild(card);
  }

  /** 3) 任务卡：手绘羊皮卡（可领态换暖杏金卡）+ 丝带标签 + 手绘奖励格 + 游戏标准按钮 */
  private _createTaskCard(view: GameClubTaskView): PIXI.Container {
    const row = new PIXI.Container();
    const isLocked = view.status === 'locked';
    const isClaimable = view.status === 'claimable';
    const isClaimed = view.status === 'claimed';

    // 卡片贴图 600×~290：圆角+双线描边约 44px，左上玫瑰约 70px
    const k = 0.42;
    const bg = nineSlice(
      isClaimable ? 'gc_task_card_ready_nb2' : 'gc_task_card_nb2',
      this._areaW,
      TASK_ROW_H,
      70, 60, 48, 48,
      k,
    );
    if (isLocked || isClaimed) bg.tint = 0xe6ddd3;
    row.addChild(bg);

    // 丝带标签
    const isNewbie = view.def.id === 'join_club';
    const tagKey = view.def.cycle === 'daily' ? 'gc_tag_daily_nb2' : 'gc_tag_milestone_nb2';
    const tagW = 64;
    const tagH = 25;
    const tagX = 30;
    const tagY = 13;
    const tagTex = TextureCache.get(tagKey);
    if (tagTex?.width) {
      const sp = new PIXI.Sprite(tagTex);
      sp.width = tagW;
      sp.height = tagH;
      sp.position.set(tagX, tagY);
      if (isLocked || isClaimed) sp.tint = 0xcfc6bd;
      row.addChild(sp);
    }
    const tagTxt = new PIXI.Text(isNewbie ? '新人礼' : view.def.cycle === 'daily' ? '每日' : '累计', {
      fontSize: 13,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: view.def.cycle === 'daily' ? 0xb2443e : 0xa0661a,
      strokeThickness: 2.5,
    } as PIXI.TextStyle);
    tagTxt.anchor.set(0.5);
    tagTxt.position.set(tagX + tagW / 2 - 4, tagY + tagH / 2);
    row.addChild(tagTxt);

    const title = new PIXI.Text(view.def.title, {
      fontSize: 20,
      fill: isLocked ? 0x8c7b6c : 0x5e3a24,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    title.anchor.set(0, 0.5);
    title.position.set(tagX + tagW + 8, tagY + tagH / 2);
    row.addChild(title);

    const done = view.progress >= view.target;
    const prog = new PIXI.Text(`${view.progress}/${view.target}`, {
      fontSize: 17,
      fill: isLocked ? 0x9c8b7d : done ? 0x3d8f45 : 0xd0573a,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    prog.anchor.set(0, 0.5);
    prog.position.set(title.x + title.width + 8, tagY + tagH / 2);
    row.addChild(prog);

    // 手绘奖励格
    const slotSize = 56;
    const slotGap = 8;
    const slotX = 26;
    const slotY = 46;
    buildRewardSlots(view.def.reward).slice(0, 4).forEach((slot, i) => {
      const box = new PIXI.Container();
      box.position.set(slotX + i * (slotSize + slotGap), slotY);
      const frameTex = TextureCache.get('gc_reward_slot_nb2');
      if (frameTex?.width) {
        const f = new PIXI.Sprite(frameTex);
        f.width = slotSize;
        f.height = slotSize;
        if (isLocked || isClaimed) f.tint = 0xe0d8cf;
        box.addChild(f);
      }
      const tex = TextureCache.get(slot.texKey);
      if (tex?.width) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        sp.scale.set(Math.min(38 / tex.width, 38 / tex.height));
        sp.position.set(slotSize / 2, slotSize / 2 - 3);
        if (isLocked || isClaimed) sp.alpha = 0.6;
        box.addChild(sp);
      }
      const qty = new PIXI.Text(slot.qtyText, {
        fontSize: 14,
        fill: 0xffffff,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0x6a4630,
        strokeThickness: 3,
      } as PIXI.TextStyle);
      qty.anchor.set(1, 1);
      qty.position.set(slotSize - 4, slotSize - 2);
      box.addChild(qty);
      row.addChild(box);
    });

    const rightCX = this._areaW - 84;
    const midY = slotY + slotSize / 2;
    if (isLocked) {
      const wrap = new PIXI.Container();
      wrap.position.set(rightCX, midY);
      const lockTex = TextureCache.get('warehouse_slot_lock');
      if (lockTex?.width) {
        const sp = new PIXI.Sprite(lockTex);
        sp.anchor.set(0.5);
        sp.scale.set(Math.min(34 / lockTex.width, 34 / lockTex.height));
        sp.position.set(0, -12);
        wrap.addChild(sp);
      }
      const t = new PIXI.Text('完成上一档解锁', {
        fontSize: 14,
        fill: 0x8c7866,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as PIXI.TextStyle);
      t.anchor.set(0.5);
      t.position.set(0, 16);
      wrap.addChild(t);
      row.addChild(wrap);
    } else if (isClaimed) {
      const wrap = new PIXI.Container();
      wrap.position.set(rightCX, midY);
      const checkTex = TextureCache.get('ui_order_check_badge');
      if (checkTex?.width) {
        const sp = new PIXI.Sprite(checkTex);
        sp.anchor.set(0.5);
        sp.scale.set(Math.min(36 / checkTex.width, 36 / checkTex.height));
        sp.position.set(0, -10);
        wrap.addChild(sp);
      }
      const t = new PIXI.Text('已领取', {
        fontSize: 15,
        fill: 0x5f9150,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as PIXI.TextStyle);
      t.anchor.set(0.5);
      t.position.set(0, 18);
      wrap.addChild(t);
      row.addChild(wrap);
    } else {
      const btnW = 128;
      const btnH = 50;
      const actionBtn = createPillButton(isClaimable ? 'claim' : 'go', isClaimable ? '领取' : '去完成', btnW, btnH, 19);
      actionBtn.position.set(rightCX, midY);
      actionBtn.eventMode = 'static';
      actionBtn.cursor = 'pointer';
      actionBtn.hitArea = new PIXI.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);
      if (isClaimable) addRedDot(actionBtn, btnW / 2 - 8, -btnH / 2 + 8);
      actionBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        if (this._scrollMoved) return;
        e.stopPropagation();
        AudioManager.play('button_click');
        if (isClaimable) {
          const entries = GameClubManager.claimTask(view.def.id);
          if (entries && entries.length > 0) this._presentObtainRewards(entries);
          return;
        }
        this._handleFallbackJumpTap(view.def.id);
      });
      if (!isClaimable) {
        this._jumpTargets.push({ node: actionBtn, w: btnW, h: btnH, clipToViewport: true });
      }
      row.addChild(actionBtn);
    }

    return row;
  }

  /**
   * H5 / 开发者工具下原生 GameClubButton 不会拦截点击时的兜底处理：
   * 真机上「去完成」已被透明原生 `wx.createGameClubButton` 覆盖，玩家点击会直接进入微信游戏圈。
   */
  private _handleFallbackJumpTap(taskId?: string): void {
    GameClubManager.markClubJumpTriggered();
    if (Platform.isWechat) {
      void GameClubManager.syncFromWechat('jump-btn').then((ok) => {
        if (taskId && GameClubManager.getTaskViews().find((t) => t.def.id === taskId)?.status === 'claimable') {
          ToastMessage.show('任务已达标，点击「领取」收下奖励吧！');
        } else if (!ok && GameClubManager.isAuthDenied) {
          ToastMessage.show('请先点击上方提示条开启游戏圈数据权限');
        } else if (this._nativeClubBtns.length === 0) {
          ToastMessage.show('开发工具暂不支持拉起原生游戏圈，已模拟进圈访问');
        }
      });
    } else {
      ToastMessage.show('开发预览：已模拟跳转游戏圈（微信真机点击直接进入游戏圈）');
    }
  }

  private _presentObtainRewards(entries: ItemObtainEntry[]): void {
    this._obtainShowing = true;
    this._hideNativeClubButtons();
    ItemObtainOverlay.show(entries, () => {
      this._obtainShowing = false;
      if (this._isOpen) this._syncNativeClubButtons();
    });
  }

  // ═══════════════ 列表滚动 ═══════════════

  private _attachScrollListeners(): void {
    if (this._detachCanvasScroll) return;
    const canvas = Game.app.view as TouchCanvasLike;
    this._detachCanvasScroll = attachCanvasMoveUp(canvas, {
      onMove: (ev) => {
        if (!this._scrollDragging) return;
        const curY = Game.clientToDesign(0, eventClientPoint(ev).y).y;
        const dy = curY - this._scrollStartDesignY;
        if (!this._scrollMoved && Math.abs(dy) > LIST_TAP_SLOP) {
          this._scrollMoved = true;
        }
        if (this._scrollMoved) {
          this._scrollY = this._scrollStartOffset - dy;
          this._clampScroll();
        }
      },
      onUp: () => {
        const wasMoved = this._scrollMoved;
        this._scrollDragging = false;
        if (wasMoved) {
          setTimeout(() => {
            this._scrollMoved = false;
            if (this._isOpen) this._syncNativeClubButtons();
          }, 0);
        }
      },
      onCancel: () => {
        this._scrollDragging = false;
        this._scrollMoved = false;
        if (this._isOpen) this._syncNativeClubButtons();
      },
    });
  }

  private _detachScrollListeners(): void {
    this._scrollDragging = false;
    this._scrollMoved = false;
    this._detachCanvasScroll?.();
    this._detachCanvasScroll = null;
  }

  private _clampScroll(): void {
    if (this._scrollY < 0) this._scrollY = 0;
    if (this._scrollY > this._maxScrollY) this._scrollY = this._maxScrollY;
    if (this._listContent) {
      this._listContent.y = -this._scrollY;
    }
    this._syncNativeClubButtons();
  }

  // ═══════════════ 微信原生透明 GameClubButton 池（每个「去完成」点击直达游戏圈） ═══════════════

  private _acquireNativeClubButton(
    index: number,
    rect: { left: number; top: number; width: number; height: number },
  ): any {
    const existing = this._nativeClubBtns[index];
    if (existing) return existing;

    const btn = Platform.createGameClubButton({
      type: 'text',
      text: '',
      style: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        backgroundColor: 'rgba(0,0,0,0.01)',
        color: 'rgba(0,0,0,0)',
        borderColor: 'rgba(0,0,0,0)',
        borderWidth: 0,
        borderRadius: Math.round(Math.min(rect.width, rect.height) / 2),
        lineHeight: rect.height,
        fontSize: 1,
      },
    });
    if (!btn) return null;
    try {
      btn.onTap?.(() => {
        AudioManager.play('button_click');
        GameClubManager.markClubJumpTriggered();
      });
      btn.hide?.();
    } catch (_) {}
    this._nativeClubBtns[index] = btn;
    return btn;
  }

  private _syncNativeClubButtons(): void {
    if (!Platform.isWechat) return;
    if (!this._isOpen || this._obtainShowing) {
      this._hideNativeClubButtons();
      return;
    }

    try {
      this.updateTransform();
    } catch (_) {}

    const dpr = Game.dpr || 1;
    let vpTopPx = -1e9;
    let vpBottomPx = 1e9;
    if (this._listViewport && !this._listViewport.destroyed) {
      const vpTL = this._listViewport.toGlobal(new PIXI.Point(0, 0));
      const vpBR = this._listViewport.toGlobal(new PIXI.Point(this._areaW, this._listViewH));
      vpTopPx = vpTL.y / dpr;
      vpBottomPx = vpBR.y / dpr;
    }

    let usedCount = 0;
    for (const target of this._jumpTargets) {
      if (target.clipToViewport && this._scrollMoved) continue;
      if (!target.node || target.node.destroyed || !target.node.worldVisible) continue;

      const hw = target.w / 2;
      const hh = target.h / 2;
      const tl = target.node.toGlobal(new PIXI.Point(-hw, -hh));
      const br = target.node.toGlobal(new PIXI.Point(hw, hh));

      const left = tl.x / dpr;
      let top = tl.y / dpr;
      const width = (br.x - tl.x) / dpr;
      let bottom = br.y / dpr;

      if (target.clipToViewport) {
        top = Math.max(top, vpTopPx);
        bottom = Math.min(bottom, vpBottomPx);
      }

      const height = bottom - top;
      if (width < 16 || height < 18) continue;

      const rect = {
        left: Math.round(left),
        top: Math.round(top),
        width: Math.round(width),
        height: Math.round(height),
      };
      const btn = this._acquireNativeClubButton(usedCount, rect);
      if (!btn) break;

      try {
        if (btn.style) {
          Object.assign(btn.style, {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            borderRadius: Math.round(Math.min(rect.width, rect.height) / 2),
            lineHeight: rect.height,
          });
        }
        btn.show?.();
      } catch (e) {
        console.warn('[GameClubPanel] sync native jump button failed:', e);
      }
      usedCount += 1;
    }

    for (let i = usedCount; i < this._nativeClubBtns.length; i++) {
      try {
        this._nativeClubBtns[i]?.hide?.();
      } catch (_) {}
    }
  }

  private _hideNativeClubButtons(): void {
    for (const btn of this._nativeClubBtns) {
      try {
        btn?.hide?.();
      } catch (_) {}
    }
  }

  private _destroyNativeClubButtons(): void {
    for (const btn of this._nativeClubBtns) {
      try {
        btn?.destroy?.();
      } catch (_) {}
    }
    this._nativeClubBtns = [];
  }
}
