/**
 * 每日挑战 + 周积分进度条
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { EventBus } from '@/core/EventBus';
import { RewardFlyCoordinator, type RewardFlyItem } from '@/core/RewardFlyCoordinator';
import { QuestManager } from '@/managers/QuestManager';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';
import type { DailyChallengeReward, DailyQuestTemplate } from '@/config/DailyChallengeConfig';
import { getDailyChallengeTierById } from '@/config/DailyChallengeTierConfig';
import {
  getNextWeekResetTimeMs,
  msUntilNextDailyResetAt5am,
} from '@/utils/WeeklyCycle';

/**
 * 任务行布局参考尺寸（旧版列表宽下的行高）；实际行高按 `rowDrawW / TASK_ROW_REF_ROW_W` 等比缩放。
 * 参考宽与旧 `listInsetX=52`、`listInnerPad=10` 时一致，保证窄列下行内元素同步缩小。
 */
const TASK_ROW_LAYOUT_REF_H = 168;
const TASK_ROW_REF_ROW_W = (DESIGN_WIDTH - 12) - 52 * 2 - 10 * 2;

/**
 * 任务行底图：优先 `daily_challenge_ui_C_task_row_textured_nb2`（金渐变质感条），
 * 否则签到条 / 纯色条。在框内 **等比** 缩放；`TASK_ROW_BG_UNIFORM_SCALE` 为整体倍率（仍单 scale，不拉扁原图）。
 */
const TASK_ROW_BG_WIDTH_FRAC = 0.97;
const TASK_ROW_BG_HEIGHT_FRAC = 0.99;
/** 略大于 1：黄条整体更长更宽；略超列表宽时由居中裁在 mask 内可接受 */
const TASK_ROW_BG_UNIFORM_SCALE = 1.14;
/** 黄条贴底留白（相对行高），标题区与胶囊顶拉开距离 */
const TASK_ROW_BG_PAD_BOTTOM_FRAC = 0.045;
/** 标题与迷你进度条相对行左内边界的额外右移（设计像素，随 `layoutS` 缩放） */
const TASK_ROW_TITLE_BAR_NUDGE_X = 30;
/** 完成勾画在整段标题（含图标）之后的间距 */
const TASK_ROW_CHECK_AFTER_TITLE_GAP = 8;
/** 行尾任务奖励图标的显示边长（设计像素，随 `layoutS` 缩放） */
const TASK_ROW_REWARD_ICON_DISP = 58;
/** 图标中心相对「右缘贴齐」再向左移，使大图叠到进度条彩色段上 */
const TASK_ROW_REWARD_ICON_PULL_LEFT = 14;
/** 进度条右端越过奖励图左缘、伸入图标下的像素（设计像素）；配合 `TASK_ROW_BAR_TAIL_SHORTEN` 略缩短条长 */
const TASK_ROW_BAR_TAIL_OVERLAP = 20;
/** 在「贴图标左缘」基础上再把条右端左移的像素（设计像素），给大图标让位后由重叠盖住视觉 */
const TASK_ROW_BAR_TAIL_SHORTEN = 5;
/** 「+x积分」相对行右内边界的左移（设计像素） */
const TASK_ROW_PTS_NUDGE_LEFT = 18;

/** 每日总进度条（叠在壳图粉区）：相对壳图显示顶部的位置、宽度占比 */
const DAILY_HEADER_PROGRESS_FROM_SHELL_TOP_FRAC = 0.188;
/** 顶栏**单独**进度条宽度（短于下方任务列表，避免顶轨过满） */
const DAILY_HEADER_TOP_BAR_W_FRAC = 0.56;
/** 任务列表与迷你条等内容区列宽（与顶栏解耦） */
const DAILY_HEADER_PROGRESS_W_FRAC = 0.7;
const DAILY_HEADER_PROGRESS_H = 38;
/** 顶栏「当日全部任务达成」额外奖图标边长（设计像素） */
const DAILY_HEADER_ALL_DONE_BONUS_ICON = 56;
/** 该图标锚在进度条右端内侧，避免与壳体裁切冲突 */
const DAILY_HEADER_ALL_DONE_BONUS_PAD_RIGHT = 12;
/** 相对原右缘锚点再向右移（设计像素），与进度条尾拉开 */
const DAILY_HEADER_ALL_DONE_BONUS_NUDGE_X = 40;
/** 图标下方数量字号（设计像素），大于周里程碑以突出全日奖 */
const DAILY_HEADER_ALL_DONE_BONUS_QTY_FONT = 20;
/** 顶栏进度条 + 倒计时 + 任务列表（含 mask 截断顶）整体下移，避开壳图标题区装饰、降低黄条裁切高度 */
const DAILY_CHALLENGE_CONTENT_NUDGE_Y = 52;
/**
 * 顶栏区底边（`headerEndY`）与任务列表 mask 顶之间的留白。
 * 增大则黄条整体下移、不占用 `barY`/顶进度条；须与 `_refresh` 内 `footerH` 对减，避免列表可视高度被吃掉。
 */
const DAILY_QUEST_LIST_TOP_GAP = 24;
/** 顶栏米色胶囊内倒计时字号（偏小，图标单独放大） */
const DAILY_COUNTDOWN_FONT_SIZE = 20;
/** 秒表图标显示高度（设计像素），明显大于旁侧文字行高 */
const DAILY_COUNTDOWN_ICON_TARGET_H = 40;
/** 倒计时文字中心相对「顶栏进度条顶边」的上移（设计像素），落在壳图米色槽内 */
const DAILY_HEADER_COUNTDOWN_CENTER_OFFSET_ABOVE_BAR = 30;
/** 秒表图标与倒计时文案间距（设计像素） */
const DAILY_COUNTDOWN_ICON_TEXT_GAP = 12;
/** 「领取全部」：`deco_card_btn_3` 显示宽度上限（放大） */
const QUEST_CLAIM_ALL_BTN_MAX_W = 132;
/** 与顶栏进度条同宽的内容区右缘内缩（锚点右中对齐，避免贴到壳图外） */
const QUEST_CLAIM_ALL_FROM_CONTENT_RIGHT = 18;
/** 相对「右缘锚点」再右移（设计像素） */
const QUEST_CLAIM_ALL_OFFSET_X = 20;
/** 相对倒计时行中心纵移（设计像素，负为向上） */
const QUEST_CLAIM_ALL_NUDGE_Y = -70;
/**
 * 壳图自带关闭钮；不可见热区略放大并偏左上，便于点到（勿被领取按钮等盖住，须最后 addChild）。
 */
const QUEST_PANEL_CLOSE_HIT_R = 46;
/** 热区中心相对「面板右内缘、顶内缘」参考点 (panelW-24, panelY+28) 的偏移 */
const QUEST_PANEL_CLOSE_HIT_NUDGE_X = -16;
const QUEST_PANEL_CLOSE_HIT_NUDGE_Y = -22;
/** 周轨下方「本周进度…后重置」 */
const WEEKLY_COUNTDOWN_FONT_SIZE = 19;
/** 周轨上方「本周积分」 */
const WEEKLY_CAP_FONT_SIZE = 19;
/** 轨与图标行、图标与底部文案的留白 */
const WEEKLY_RAIL_TO_ICONS_GAP = 6;
const WEEKLY_ICONS_TO_COUNTDOWN_GAP = 14;
const WEEKLY_REWARD_ICON_DISP = 40;
/** 周里程碑图标与下方数量字间距（设计像素） */
const WEEKLY_MILESTONE_QTY_GAP = 4;
/** 周里程碑图标下数量字号（设计像素） */
const WEEKLY_MILESTONE_QTY_FONT = 15;

/**
 * 每日挑战进度条：**顶栏**与**黄任务卡内迷你条**与 **TopBar 体力条**同色（`COLORS.STAMINA_BAR_FILL`）；任务条扁平；**仅周轨**槽内填充 = 黄（`QUEST_PROG_WEEKLY_FILL`）。
 */
const QUEST_PROG_SHADOW = 0x9b8ab8;
const QUEST_PROG_SHADOW_ALPHA = 0.14;
const QUEST_PROG_TRACK_FILL = 0xfff7fb;
const QUEST_PROG_TRACK_LINE = 0xe8d0e8;
const QUEST_PROG_TRACK_LINE_ALPHA = 0.85;
/** 黄任务卡内迷你条：浅轨 + 扁平填充（= 体力条绿） */
const QUEST_PROG_TASK_ROW_TRACK_FILL = 0xfff8f6;
const QUEST_PROG_TASK_ROW_TRACK_LINE = 0xc5e1b2;
const QUEST_PROG_TASK_ROW_FILL = COLORS.STAMINA_BAR_FILL;
/** 顶栏：略深草绿底 + 与体力条同色的上半带 */
const QUEST_PROG_DAILY_FILL_BASE = 0x689f38;
const QUEST_PROG_DAILY_FILL_HI = COLORS.STAMINA_BAR_FILL;
const QUEST_PROG_DAILY_FILL_HI_ALPHA = 0.98;
/** 顶栏 / 任务条草绿填充上白字描边（与 TopBar 加号深绿同系） */
const QUEST_PROG_DAILY_LABEL_STROKE = 0x2e7d32;
/** 周轨 UV 槽内底层 + **仅周进度**黄色填充 */
const QUEST_PROG_WEEKLY_SLOT_BG = 0xede6f2;
/** 周轨 UV 槽内浅底不透明度（仅槽位 Graphics，不再叠整轨宽垫底） */
const QUEST_PROG_WEEKLY_SLOT_BG_ALPHA = 1;
const QUEST_PROG_WEEKLY_FILL = 0xffc94a;
/** 周轨槽内进度条左右各外扩（设计像素），减轻小鸡端盖处露底 */
const WEEKLY_RAIL_PROGRESS_FILL_OUTSET_X = 5;

/** 与 `MerchShopPanel` / `DecorationPanel` 顶栏标题一致：34 白字、赭描边、浅投影 */
/** 任务行内除可点击领奖区外不抢指针，便于列表拖拽滚动 */
function questRowNoPointerCapture(o: PIXI.Container | PIXI.Sprite | PIXI.Graphics | PIXI.Text): void {
  o.eventMode = 'none';
}

/**
 * 已领取：在奖励图标**右下角**叠 `ui_order_check_badge`（`iconHalf` 为图标显示半宽/半高，与 Sprite 中心对齐坐标系一致）。
 */
function addRewardClaimCheckOverlay(
  parent: PIXI.Container,
  sidePx: number,
  iconHalf: number,
): void {
  const badgeTex = TextureCache.get('ui_order_check_badge');
  if (!badgeTex) return;
  const s = Math.max(22, sidePx);
  const bs = s / Math.max(badgeTex.width, badgeTex.height);
  const badge = new PIXI.Sprite(badgeTex);
  badge.scale.set(bs);
  badge.anchor.set(1, 1);
  const inset = Math.max(1, Math.min(5, Math.round(iconHalf * 0.1)));
  badge.position.set(iconHalf - inset, iconHalf - inset);
  questRowNoPointerCapture(badge);
  parent.addChild(badge);
}

function questPanelChromeTitleStyle(fontSize: number): Record<string, unknown> {
  return {
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    fontSize,
    fill: 0xffffff,
    stroke: 0x7a4530,
    strokeThickness: Math.max(4, Math.round(5 * Math.min(1.12, fontSize / 34))),
    dropShadow: true,
    dropShadowColor: 0x5a2d10,
    dropShadowBlur: 2,
    dropShadowDistance: 1,
  };
}

/**
 * 周轨「本周积分 / 本周进度」说明：暖棕字、无描边，极轻投影便于粉底上辨认。
 */
function questPanelMutedCaptionStyle(fontSize: number): Record<string, unknown> {
  return {
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    fontSize,
    fill: 0x5d4037,
    dropShadow: true,
    dropShadowColor: 0x3e2723,
    dropShadowAlpha: 0.18,
    dropShadowBlur: 1,
    dropShadowDistance: 1,
  };
}

/**
 * 米色胶囊条内倒计时：暖棕字（与「本周积分」说明同系），比纯黑更柔和。
 */
function questPanelCapsuleCountdownStyle(fontSize: number): Record<string, unknown> {
  return {
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    fontSize,
    fill: 0x6d4c41,
    dropShadow: true,
    dropShadowColor: 0x5d4037,
    dropShadowAlpha: 0.2,
    dropShadowBlur: 1,
    dropShadowDistance: 1,
  };
}

/**
 * 周轨道（D_weekly_rail）透明槽内程序进度条：UV 相对轨道 Sprite 显示矩形（0~1）。
 */
const WEEKLY_RAIL_PROGRESS_UV = {
  u: 150 / 1248,
  v: 84 / 214,
  uw: 947 / 1248,
  uh: 46 / 214,
} as const;

const WEEKLY_RAIL_PROGRESS_NUDGE_X = 0;
const WEEKLY_RAIL_PROGRESS_NUDGE_Y = 0;

/** 里程碑黄点映射在透明轨上的水平内缩（占轨宽比例），避免端点压住两侧小鸡 */
const WEEKLY_MILESTONE_X_INSET_LEFT_FRAC = 0.02;
const WEEKLY_MILESTONE_X_INSET_RIGHT_FRAC = 0.07;

function formatHms(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(n => (n < 10 ? `0${n}` : String(n))).join(':');
}

function formatWeekRemain(ms: number): string {
  if (ms <= 0) return '即将刷新';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}天${h}小时`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}小时${m}分`;
}

/** 与 Merch / 装修面板一致：微信小游戏上 stage 级 pointermove 常丢，滚动改绑 canvas */
function nativeClientToDesignY(clientY: number): number {
  return (clientY * Game.designHeight) / Game.screenHeight;
}

function federatedPointerToDesignY(e: PIXI.FederatedPointerEvent): number {
  const n = e.nativeEvent as PointerEvent | MouseEvent | undefined;
  if (n != null && typeof (n as PointerEvent).clientY === 'number') {
    return nativeClientToDesignY((n as PointerEvent).clientY);
  }
  return e.global.y / Game.scale;
}

function rewardPreview(r: DailyChallengeReward): string {
  const parts: string[] = [];
  if (r.stamina) parts.push(`体力+${r.stamina}`);
  if (r.diamond) parts.push(`${r.diamond}`);
  if (r.huayuan) parts.push(`花愿+${r.huayuan}`);
  if (r.flowerSignTickets) parts.push(`许愿硬币+${r.flowerSignTickets}`);
  if (r.itemId) parts.push(`道具×${r.itemCount ?? 1}`);
  return parts.join(' ');
}

/**
 * 与 ItemObtainOverlay 一致：棋盘物品 ×N（含 ×1）；体力/花愿/钻石等直加货币仅数字（无 ×）。
 */
function dailyQuestRewardQtyText(r: DailyChallengeReward): string | null {
  if (r.itemId) return `×${r.itemCount ?? 1}`;
  if (r.diamond) return String(r.diamond);
  if (r.stamina) return String(r.stamina);
  if (r.huayuan) return String(r.huayuan);
  if (r.flowerSignTickets) return String(r.flowerSignTickets);
  return null;
}

/** 领取后飞入动效：`QuestManager` 已即时到账，道具类 `grantOnArrive: false` 避免重复入库 */
function questChallengeRewardToFlyItems(r: DailyChallengeReward): RewardFlyItem[] {
  const items: RewardFlyItem[] = [];
  if (r.huayuan) items.push({ type: 'huayuan', textureKey: 'icon_huayuan', amount: r.huayuan });
  if (r.diamond) items.push({ type: 'diamond', textureKey: 'icon_gem', amount: r.diamond });
  if (r.stamina) items.push({ type: 'stamina', textureKey: 'icon_energy', amount: r.stamina });
  if (r.flowerSignTickets) {
    items.push({
      type: 'flowerSignTicket',
      textureKey: 'icon_flower_sign_coin',
      amount: r.flowerSignTickets,
    });
  }
  if (r.itemId && ITEM_DEFS.has(r.itemId)) {
    const cnt = Math.max(1, Math.floor(r.itemCount ?? 1));
    const def = ITEM_DEFS.get(r.itemId)!;
    items.push({
      type: 'rewardBox',
      textureKey: def.icon,
      amount: cnt,
      itemId: r.itemId,
      grantOnArrive: false,
    });
  }
  return items;
}

/** 多条奖励合并为一组飞入粒子（一键领取） */
function mergeChallengeRewardsToFlyItems(rewards: DailyChallengeReward[]): RewardFlyItem[] {
  let hy = 0;
  let di = 0;
  let st = 0;
  let fs = 0;
  const itemMap = new Map<string, number>();
  for (const r of rewards) {
    hy += r.huayuan ?? 0;
    di += r.diamond ?? 0;
    st += r.stamina ?? 0;
    fs += r.flowerSignTickets ?? 0;
    if (r.itemId && r.itemCount) {
      itemMap.set(r.itemId, (itemMap.get(r.itemId) ?? 0) + r.itemCount);
    }
  }
  const merged: DailyChallengeReward = {};
  if (hy > 0) merged.huayuan = hy;
  if (di > 0) merged.diamond = di;
  if (st > 0) merged.stamina = st;
  if (fs > 0) merged.flowerSignTickets = fs;
  const items = questChallengeRewardToFlyItems(merged);
  for (const [itemId, count] of itemMap) {
    if (!ITEM_DEFS.has(itemId) || count <= 0) continue;
    const def = ITEM_DEFS.get(itemId)!;
    items.push({
      type: 'rewardBox',
      textureKey: def.icon,
      amount: count,
      itemId,
      grantOnArrive: false,
    });
  }
  return items;
}

/** 周里程碑奖励 → 主包/物品分包纹理 key（与 TextureCache 一致） */
function weeklyMilestoneRewardTextureKey(r: DailyChallengeReward): string | undefined {
  if (r.itemId) return r.itemId;
  if (r.diamond) return 'icon_gem';
  if (r.stamina) return 'icon_energy';
  if (r.huayuan) return 'icon_huayuan';
  if (r.flowerSignTickets) return 'icon_flower_sign_coin';
  return undefined;
}

/**
 * 任务行底图：等比缩放后 **水平居中、靠行底对齐**（避免垂直居中时胶囊顶贴任务文案）。
 * 禁止单独拉宽/压扁。
 */
function spriteTaskRowPanel(tex: PIXI.Texture, x: number, y: number, rowW: number, rowH: number): PIXI.Sprite {
  const s = new PIXI.Sprite(tex);
  const bw = rowW * TASK_ROW_BG_WIDTH_FRAC;
  const bh = rowH * TASK_ROW_BG_HEIGHT_FRAC;
  const sc = Math.min(bw / tex.width, bh / tex.height) * TASK_ROW_BG_UNIFORM_SCALE;
  s.scale.set(sc);
  const dw = tex.width * sc;
  const dh = tex.height * sc;
  const padB = Math.max(4, Math.round(rowH * TASK_ROW_BG_PAD_BOTTOM_FRAC));
  let sprY = y + rowH - dh - padB;
  if (sprY < y) sprY = y;
  s.position.set(x + (rowW - dw) / 2, sprY);
  return s;
}

export class QuestPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _isOpen = false;
  private _opening = false;
  private _countdownTimer: ReturnType<typeof setInterval> | null = null;
  private _dailyCountdownText: PIXI.Text | null = null;
  /** 与秒表图标同一容器，秒数变化时需重算水平居中 */
  private _dailyCountdownRow: PIXI.Container | null = null;
  private _dailyCountdownStopwatch: PIXI.Sprite | null = null;
  private _weeklyCountdownText: PIXI.Text | null = null;
  /** 全日完成额外奖：可领时上下跳 + scale 呼吸，刷新/关闭前 cancel */
  private _dailyAllCompleteBonusBobRoot: PIXI.Container | null = null;
  private _dailyAllCompleteBonusBreatheScale: { x: number; y: number } | null = null;

  /** 任务列表：canvas 跟手滚动（与 MerchShopPanel 一致） */
  private _questListCanvasListening = false;
  private _questListCanvasLastY = 0;
  private _questListCanvasScrollY = 0;
  private _questListCanvasMaxScroll = 0;
  private _questListCanvasContent: PIXI.Container | null = null;

  /**
   * 领取奖励时在 pointerdown 栈内会 emit `quest:updated`；若立刻 `_refresh` 会 destroy 当前命中节点，
   * Pixi 仍在处理本次指针事件，`updateTransform` 会读到 null；且领取回调里 `toGlobal` 需在树仍存在时执行。
   */
  private _questUpdatedRefreshRaf: number | null = null;
  private _assetUnsub: (() => void) | null = null;

  private readonly _onQuestListCanvasMove = (ev: PointerEvent): void => {
    if (!this._isOpen || !this._questListCanvasListening || !this._questListCanvasContent) return;
    const cur = nativeClientToDesignY(ev.clientY);
    const delta = this._questListCanvasLastY - cur;
    this._questListCanvasLastY = cur;
    this._questListCanvasScrollY = Math.max(
      0,
      Math.min(this._questListCanvasMaxScroll, this._questListCanvasScrollY + delta),
    );
    this._questListCanvasContent.y = -this._questListCanvasScrollY;
  };

  private readonly _onQuestListCanvasUp = (): void => {
    this._finishQuestListCanvasScroll();
  };

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
    EventBus.on('quest:updated', () => {
      if (!this._isOpen) return;
      if (this._questUpdatedRefreshRaf !== null) return;
      this._questUpdatedRefreshRaf = requestAnimationFrame(() => {
        this._questUpdatedRefreshRaf = null;
        if (this._isOpen) this._refresh();
      });
    });
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    this._opening = true;
    void TextureCache.preloadPanelAssets('quest').finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this.alpha = 1;
    this._assetUnsub = TextureCache.onAssetGroupLoaded('quest', () => {
      if (this._isOpen) this._refresh();
    });
    this._refresh();

    TweenManager.cancelTarget(this._bg);
    TweenManager.cancelTarget(this._content);
    TweenManager.cancelTarget(this._content.scale);

    this.position.set(0, 0);
    this.scale.set(1, 1);

    this._bg.alpha = 0;
    this._content.alpha = 0;
    this._content.scale.set(0.85);
    TweenManager.to({ target: this._bg, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.scale, props: { x: 1, y: 1 }, duration: 0.3, ease: Ease.easeOutBack });

    this._startCountdownTimer();
  }

  close(): void {
    this._opening = false;
    if (!this._isOpen) return;
    this._isOpen = false;
    this._assetUnsub?.();
    this._assetUnsub = null;
    this._stopCountdownTimer();
    this._finishQuestListCanvasScroll();
    if (this._dailyAllCompleteBonusBobRoot) {
      TweenManager.cancelTarget(this._dailyAllCompleteBonusBobRoot);
      this._dailyAllCompleteBonusBobRoot = null;
    }
    if (this._dailyAllCompleteBonusBreatheScale) {
      TweenManager.cancelTarget(this._dailyAllCompleteBonusBreatheScale);
      this._dailyAllCompleteBonusBreatheScale = null;
    }

    TweenManager.cancelTarget(this._bg);
    TweenManager.cancelTarget(this._content);
    TweenManager.cancelTarget(this._content.scale);

    TweenManager.to({
      target: this._bg, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
    });
    TweenManager.to({
      target: this._content, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; this.alpha = 1; },
    });
    TweenManager.to({
      target: this._content.scale, props: { x: 0.9, y: 0.9 }, duration: 0.15, ease: Ease.easeInQuad,
    });
  }

  private _startCountdownTimer(): void {
    this._stopCountdownTimer();
    this._countdownTimer = setInterval(() => this._tickCountdowns(), 1000);
  }

  private _stopCountdownTimer(): void {
    if (this._countdownTimer !== null) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
  }

  /** 秒表 + 文案整体居中；时间在走字时宽度会变，须每秒重算 */
  private _layoutDailyCountdownRow(): void {
    const row = this._dailyCountdownRow;
    const sw = this._dailyCountdownStopwatch;
    const t = this._dailyCountdownText;
    if (!row || !sw || !t) return;
    const gap = DAILY_COUNTDOWN_ICON_TEXT_GAP;
    const tw = t.width;
    const iw = sw.width;
    const totalW = iw + gap + tw;
    sw.position.set(-totalW * 0.5, 0);
    t.position.set(-totalW * 0.5 + iw + gap, 0);
  }

  private _tickCountdowns(): void {
    const now = Date.now();
    if (this._dailyCountdownText) {
      this._dailyCountdownText.text = `距下次刷新（05:00） ${formatHms(msUntilNextDailyResetAt5am(new Date(now)))}`;
      this._layoutDailyCountdownRow();
    }
    if (this._weeklyCountdownText) {
      const left = getNextWeekResetTimeMs(new Date(now)) - now;
      this._weeklyCountdownText.text = `本周进度 ${formatWeekRemain(left)} 后重置`;
    }
  }

  private _finishQuestListCanvasScroll(): void {
    if (!this._questListCanvasListening) return;
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.removeEventListener) {
      canvas.removeEventListener('pointermove', this._onQuestListCanvasMove);
      canvas.removeEventListener('pointerup', this._onQuestListCanvasUp);
      canvas.removeEventListener('pointercancel', this._onQuestListCanvasUp);
    }
    this._questListCanvasListening = false;
    if (this._questListCanvasContent) this._questListCanvasContent.cursor = 'grab';
  }

  private _beginQuestListCanvasScroll(e: PIXI.FederatedPointerEvent): void {
    if (!this._isOpen || !this._questListCanvasContent || this._questListCanvasListening) return;
    if (this._questListCanvasMaxScroll <= 0) return;
    this._questListCanvasListening = true;
    this._questListCanvasScrollY = -this._questListCanvasContent.y;
    this._questListCanvasLastY = federatedPointerToDesignY(e);
    this._questListCanvasContent.cursor = 'grabbing';
    e.stopPropagation();
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.addEventListener) {
      canvas.addEventListener('pointermove', this._onQuestListCanvasMove);
      canvas.addEventListener('pointerup', this._onQuestListCanvasUp);
      canvas.addEventListener('pointercancel', this._onQuestListCanvasUp);
    }
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, w, h);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointerdown', () => this.close());
    this.addChild(this._bg);

    this._content = new PIXI.Container();
    this.addChild(this._content);
  }

  private _refresh(): void {
    this._stopCountdownTimer();
    this._finishQuestListCanvasScroll();
    /** 领奖等会触发整页重建，须保留列表纵向滚动，避免跳回顶部 */
    const preservedQuestListScrollY = Math.max(0, this._questListCanvasScrollY);
    this._questListCanvasContent = null;

    if (this._dailyAllCompleteBonusBobRoot) {
      TweenManager.cancelTarget(this._dailyAllCompleteBonusBobRoot);
      this._dailyAllCompleteBonusBobRoot = null;
    }
    if (this._dailyAllCompleteBonusBreatheScale) {
      TweenManager.cancelTarget(this._dailyAllCompleteBonusBreatheScale);
      this._dailyAllCompleteBonusBreatheScale = null;
    }

    /** 须先摘掉 mask，否则会先 destroy 蒙版对象而带 mask 的 Container 仍引用之，下一帧 updateTransform 报 null */
    for (const child of this._content.children) {
      const c = child as PIXI.Container;
      if (c.mask) c.mask = null;
    }
    while (this._content.children.length > 0) {
      const child = this._content.children[0];
      this._content.removeChild(child);
      child.destroy({ children: true });
    }

    this._dailyCountdownText = null;
    this._dailyCountdownRow = null;
    this._dailyCountdownStopwatch = null;
    this._weeklyCountdownText = null;

    this._content.pivot.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._content.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);

    const cx = DESIGN_WIDTH / 2;
    const panelW = DESIGN_WIDTH - 12;
    /** 略增高面板底缘，为任务列表多留纵向空间（mask 底边可更贴近周进度区） */
    const panelH = Math.min(Game.logicHeight - 12, 1140);
    const panelX = cx - panelW / 2;
    const panelY = (Game.logicHeight - panelH) / 2;

    const shellTex = TextureCache.get('daily_challenge_panel_shell_nb2');
    let shellY = panelY;
    let shellDispH = panelH;
    if (shellTex) {
      const shellSc = panelW / shellTex.width;
      shellDispH = shellTex.height * shellSc;
      shellY = panelY + (panelH - shellDispH) / 2;
      const sh = new PIXI.Sprite(shellTex);
      sh.scale.set(shellSc);
      sh.position.set(panelX, shellY);
      this._content.addChild(sh);
    } else {
      const fb = new PIXI.Graphics();
      fb.beginFill(0xFFFBF0);
      fb.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
      fb.endFill();
      this._content.addChild(fb);
    }

    const headerBarW = panelW * DAILY_HEADER_TOP_BAR_W_FRAC;
    const barH = DAILY_HEADER_PROGRESS_H;
    const barY = (shellTex
      ? shellY + shellDispH * DAILY_HEADER_PROGRESS_FROM_SHELL_TOP_FRAC
      : panelY + 62) + DAILY_CHALLENGE_CONTENT_NUDGE_Y;
    const barX = cx - headerBarW / 2;
    const barBottom = barY + barH;
    /** 倒计时已移到进度条上方胶囊内，顶栏底留白可收紧 */
    const headerEndY = barBottom + 10;
    const listTopGap = DAILY_QUEST_LIST_TOP_GAP;

    /**
     * 底部周进度 + 轨下奖励图标 + 说明文案。
     * 须 ≥ 周轨缩放高度（~100px）+ 图标行 + 底部文案带；过小则 `railTopMax` 把轨顶整体上推，底部大块粉区空窗。
     * 与 `DAILY_QUEST_LIST_TOP_GAP` 联动：列表下移所让出的纵向尽量从底部区挤，少动顶栏。
     */
    /** 略减以抬高列表 mask 底边（截断线下移）；周区仍由 `railTopMax` 贴底排布 */
    const footerH = 256;
    /** 任务区与周进度区之间粉空白 */
    const footerTopGap = 0;
    const scrollAreaY = headerEndY + listTopGap;
    const scrollAreaH = panelH - (scrollAreaY - panelY) - footerH - footerTopGap;

    const taskRowGap = 8;
    /** 与顶栏每日总进度条同宽，保证黄条任务卡与上下轨视觉列对齐 */
    const listW = panelW * DAILY_HEADER_PROGRESS_W_FRAC;
    const listX = cx - listW / 2;
    const listInnerPad = 10;
    const rowDrawW = listW - listInnerPad * 2;
    const taskRowH = Math.max(
      118,
      Math.round(TASK_ROW_LAYOUT_REF_H * (rowDrawW / TASK_ROW_REF_ROW_W)),
    );
    /** 占满头尾之间的任务区（不再限 4 行），减少与周进度条之间的空白 */
    const listAreaPadTop = 3;
    const listAreaPadBottom = 0;
    const maxListViewportH = Math.max(140, scrollAreaH - listAreaPadTop - listAreaPadBottom);
    const listViewportH = maxListViewportH;
    const listViewportY = scrollAreaY + listAreaPadTop;

    const title = new PIXI.Text('每日挑战', questPanelChromeTitleStyle(34) as any);
    title.anchor.set(0.5, 0.5);
    if (shellTex) {
      title.position.set(cx, shellY + shellDispH * 0.076);
    } else {
      title.position.set(cx, panelY + 32);
    }
    this._content.addChild(title);

    const now = Date.now();
    const countdownCy = barY - DAILY_HEADER_COUNTDOWN_CENTER_OFFSET_ABOVE_BAR;
    const cdText = new PIXI.Text(
      `距下次刷新（05:00） ${formatHms(msUntilNextDailyResetAt5am(new Date(now)))}`,
      questPanelCapsuleCountdownStyle(DAILY_COUNTDOWN_FONT_SIZE) as any,
    );
    this._dailyCountdownText = cdText;
    cdText.anchor.set(0, 0.5);

    const swTex = TextureCache.get('daily_challenge_countdown_stopwatch_nb2');
    if (swTex) {
      const sw = new PIXI.Sprite(swTex);
      const targetH = DAILY_COUNTDOWN_ICON_TARGET_H;
      const sc = targetH / Math.max(swTex.width, swTex.height);
      sw.scale.set(sc);
      sw.anchor.set(0, 0.5);
      questRowNoPointerCapture(sw);
      const gap = DAILY_COUNTDOWN_ICON_TEXT_GAP;
      const tw = cdText.width;
      const iw = sw.width;
      const totalW = iw + gap + tw;
      const row = new PIXI.Container();
      row.position.set(cx, countdownCy);
      sw.position.set(-totalW * 0.5, 0);
      cdText.position.set(-totalW * 0.5 + iw + gap, 0);
      questRowNoPointerCapture(cdText);
      row.addChild(sw);
      row.addChild(cdText);
      this._dailyCountdownRow = row;
      this._dailyCountdownStopwatch = sw;
      this._layoutDailyCountdownRow();
      this._content.addChild(row);
    } else {
      cdText.anchor.set(0.5, 0.5);
      cdText.position.set(cx, countdownCy);
      this._content.addChild(cdText);
    }

    const headerProgFrac = this._dailyHeaderProgressFraction();
    this._drawDailyHeaderProgressBar(barX, barY, headerBarW, barH, headerProgFrac);

    const { done: dailyDone, total: dailyTotal } = this._dailyHeaderTaskCounts();
    const headerProgBright = headerProgFrac >= 0.5;
    const headerProgFs = Math.max(17, Math.round(barH * 0.48));
    const dailyProgressLabel = new PIXI.Text(
      dailyTotal > 0 ? `${dailyDone}/${dailyTotal}` : '0/0',
      {
        fontSize: headerProgFs,
        fill: headerProgBright ? 0xffffff : 0x6b5a72,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        ...(headerProgBright
          ? { stroke: QUEST_PROG_DAILY_LABEL_STROKE, strokeThickness: Math.max(2, Math.round(2.2 * (headerProgFs / 20))) }
          : {}),
      } as any,
    );
    dailyProgressLabel.anchor.set(0.5, 0.5);
    dailyProgressLabel.position.set(cx, barY + barH * 0.5);
    questRowNoPointerCapture(dailyProgressLabel);
    this._content.addChild(dailyProgressLabel);

    const closeHit = new PIXI.Container();
    closeHit.position.set(
      panelX + panelW - 24 + QUEST_PANEL_CLOSE_HIT_NUDGE_X,
      panelY + 28 + QUEST_PANEL_CLOSE_HIT_NUDGE_Y,
    );
    closeHit.hitArea = new PIXI.Circle(0, 0, QUEST_PANEL_CLOSE_HIT_R);
    closeHit.eventMode = 'static';
    closeHit.cursor = 'pointer';
    closeHit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });

    const canClaimAny = QuestManager.hasClaimableQuest;
    let questClaimAllWrap: PIXI.Container | null = null;
    if (canClaimAny) {
      const claimWrap = new PIXI.Container();
      questClaimAllWrap = claimWrap;
      claimWrap.position.set(
        barX + headerBarW - QUEST_CLAIM_ALL_FROM_CONTENT_RIGHT + QUEST_CLAIM_ALL_OFFSET_X,
        countdownCy + QUEST_CLAIM_ALL_NUDGE_Y,
      );
      const labelFs = Math.max(15, Math.round(16 * (QUEST_CLAIM_ALL_BTN_MAX_W / 132)));
      const label = new PIXI.Text('领取全部', {
        fontSize: labelFs,
        fill: 0x0f2818,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as any);
      label.anchor.set(0.5);

      const claimBtnTex = TextureCache.get('deco_card_btn_3');
      let flyCenterX = 0;
      if (claimBtnTex) {
        const bw = claimBtnTex.width;
        const bh = claimBtnTex.height;
        const sc = QUEST_CLAIM_ALL_BTN_MAX_W / bw;
        const bg = new PIXI.Sprite(claimBtnTex);
        bg.scale.set(sc);
        bg.anchor.set(1, 0.5);
        bg.position.set(0, 0);
        label.position.set(-bg.width * 0.5, Math.round(-bh * sc * 0.02));
        claimWrap.addChild(bg);
        flyCenterX = -bg.width * 0.5;
        const halfH = bg.height * 0.5;
        claimWrap.hitArea = new PIXI.Rectangle(-bg.width, -halfH, bg.width, halfH * 2);
      } else {
        const padX = 12;
        const padY = 6;
        const w = label.width + padX * 2;
        const h = label.height + padY * 2;
        const fb = new PIXI.Graphics();
        fb.lineStyle(2, 0x2d5a3d, 1);
        fb.beginFill(0x7cb88a);
        fb.drawRoundedRect(-w, -h * 0.5, w, h, 10);
        fb.endFill();
        claimWrap.addChild(fb);
        label.position.set(-w * 0.5, 0);
        flyCenterX = -w * 0.5;
        claimWrap.hitArea = new PIXI.Rectangle(-w, -h * 0.5, w, h);
      }

      claimWrap.addChild(label);

      claimWrap.eventMode = 'static';
      claimWrap.cursor = 'pointer';
      claimWrap.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        const granted = QuestManager.claimAllPendingRewards();
        if (granted.length === 0) return;
        const flyItems = mergeChallengeRewardsToFlyItems(granted);
        if (flyItems.length > 0) {
          const startGlobal = claimWrap.toGlobal(new PIXI.Point(flyCenterX, 0));
          RewardFlyCoordinator.playBatch(flyItems, startGlobal);
        }
      });
      this._content.addChild(claimWrap);
    }

    /** 盖在顶栏可点控件之上，避免领取区等挡住关闭 */
    this._content.addChild(closeHit);

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRect(listX, listViewportY, listW, listViewportH);
    mask.endFill();
    this._content.addChild(mask);

    /** 外层仅负责 mask；滚动位移在内层。跟手滚动在 `scrollContent` 上 pointerdown + canvas 级 move（微信小游戏上可靠）。 */
    const scrollOuter = new PIXI.Container();
    scrollOuter.mask = mask;
    this._content.addChild(scrollOuter);

    const scrollContent = new PIXI.Container();
    scrollContent.eventMode = 'static';
    scrollContent.cursor = 'grab';
    scrollOuter.addChild(scrollContent);

    const firstTaskY = listViewportY + 6;
    let contentBottom = firstTaskY;
    const tasks = QuestManager.dailyTasks;
    for (const q of tasks) {
      const def = QuestManager.getTemplate(q.templateId);
      if (!def) continue;
      contentBottom = this._drawTaskRow(
        listX + listInnerPad,
        contentBottom,
        rowDrawW,
        taskRowH,
        q,
        def,
        scrollContent,
      );
      contentBottom += taskRowGap;
    }

    const scrollSpan = contentBottom - firstTaskY - taskRowGap;
    const maxScroll = Math.max(0, scrollSpan - listViewportH);

    this._questListCanvasMaxScroll = maxScroll;
    this._questListCanvasScrollY = Math.min(preservedQuestListScrollY, maxScroll);
    this._questListCanvasContent = scrollContent;
    scrollContent.y = -this._questListCanvasScrollY;

    const contentHitH = Math.max(taskRowH, scrollSpan);
    scrollContent.hitArea = new PIXI.Rectangle(listX + listInnerPad, firstTaskY, rowDrawW, contentHitH);
    scrollContent.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      this._beginQuestListCanvasScroll(e);
    });

    const applyQuestListScrollDelta = (dy: number): void => {
      this._questListCanvasScrollY = Math.max(
        0,
        Math.min(maxScroll, this._questListCanvasScrollY + dy),
      );
      scrollContent.y = -this._questListCanvasScrollY;
    };

    scrollContent.on('wheel', (e: PIXI.FederatedWheelEvent) => {
      if (maxScroll <= 0) return;
      applyQuestListScrollDelta(e.deltaY * 0.35);
      e.stopPropagation();
    });

    const footerTop = scrollAreaY + scrollAreaH + footerTopGap;
    this._drawWeeklyFooter(panelX, footerTop, panelW, footerH);

    /** 全日完成奖图标压在进度条/列表/周区之上；再把领取全部与关闭热区提到最前，避免误挡交互 */
    this._drawDailyAllCompleteBonusHeader(
      barX,
      barY,
      headerBarW,
      barH,
      dailyDone,
      dailyTotal,
    );
    if (questClaimAllWrap) this._content.addChild(questClaimAllWrap);
    this._content.addChild(closeHit);

    if (this._isOpen) this._startCountdownTimer();
  }

  /**
   * 每日总进度条（叠在壳图粉区米色槽位上）：阴影 + 浅底轨 + 草绿填充（体力条同色）+ 顶高光。
   * 位置由 `DAILY_HEADER_PROGRESS_*` / `DAILY_HEADER_TOP_BAR_W_FRAC` 控制。
   */
  private _drawDailyHeaderProgressBar(
    barX: number,
    barY: number,
    barW: number,
    barH: number,
    progress: number,
  ): void {
    const r = barH / 2;
    const p = Math.max(0, Math.min(1, progress));
    const inset = 3;

    const shadow = new PIXI.Graphics();
    shadow.beginFill(QUEST_PROG_SHADOW, QUEST_PROG_SHADOW_ALPHA);
    shadow.drawRoundedRect(barX + 2, barY + 3, barW, barH, r);
    shadow.endFill();
    this._content.addChild(shadow);

    const track = new PIXI.Graphics();
    track.lineStyle(2, QUEST_PROG_TRACK_LINE, QUEST_PROG_TRACK_LINE_ALPHA);
    track.beginFill(QUEST_PROG_TRACK_FILL, 0.98);
    track.drawRoundedRect(barX, barY, barW, barH, r);
    track.endFill();
    this._content.addChild(track);

    const rim = new PIXI.Graphics();
    rim.lineStyle(1, 0xffffff, 0.55);
    rim.drawRoundedRect(barX + inset, barY + 2, barW - inset * 2, barH * 0.42, Math.max(4, r - inset));
    this._content.addChild(rim);

    const innerW = barW - inset * 2;
    const innerH = barH - inset * 2;
    const ir = Math.max(6, r - inset);
    if (p > 0.004 && innerW * p > 8) {
      const fw = Math.max(0, innerW * p - 1);
      const fill = new PIXI.Graphics();
      fill.beginFill(QUEST_PROG_DAILY_FILL_BASE);
      fill.drawRoundedRect(barX + inset, barY + inset, fw, innerH, ir);
      fill.endFill();
      this._content.addChild(fill);

      const hi = new PIXI.Graphics();
      hi.beginFill(QUEST_PROG_DAILY_FILL_HI, QUEST_PROG_DAILY_FILL_HI_ALPHA);
      hi.drawRoundedRect(
        barX + inset,
        barY + inset,
        fw,
        Math.max(2, innerH * 0.5),
        Math.min(ir, Math.max(3, Math.floor(innerH * 0.25))),
      );
      hi.endFill();
      this._content.addChild(hi);

      const gloss = new PIXI.Graphics();
      gloss.beginFill(0xffffff, 0.22);
      gloss.drawRoundedRect(barX + inset + 2, barY + inset + 2, Math.max(0, fw - 4), innerH * 0.34, 5);
      gloss.endFill();
      this._content.addChild(gloss);
    }
  }

  /** 每日总进度：各任务 current/target 截断后取平均 */
  private _dailyHeaderProgressFraction(): number {
    const tasks = QuestManager.dailyTasks;
    if (tasks.length === 0) return 0;
    let sum = 0;
    let n = 0;
    for (const q of tasks) {
      const def = QuestManager.getTemplate(q.templateId);
      if (!def) continue;
      sum += Math.min(1, q.current / def.target);
      n += 1;
    }
    return n > 0 ? sum / n : 0;
  }

  /** 顶栏「x/y」：已完成目标的任务数 / 有效任务总数 */
  private _dailyHeaderTaskCounts(): { done: number; total: number } {
    const tasks = QuestManager.dailyTasks;
    let total = 0;
    let done = 0;
    for (const q of tasks) {
      const def = QuestManager.getTemplate(q.templateId);
      if (!def) continue;
      total += 1;
      if (q.current >= def.target) done += 1;
    }
    return { done, total };
  }

  /**
   * 顶栏每日进度条右端：当日全部任务达成后可领的额外奖（与 `DailyChallengeTierConfig.dailyAllCompleteBonus` 一致）。
   */
  private _drawDailyAllCompleteBonusHeader(
    barX: number,
    barY: number,
    barW: number,
    barH: number,
    dailyDone: number,
    dailyTotal: number,
  ): void {
    const tier = getDailyChallengeTierById(QuestManager.challengeTierId);
    const bonus = tier.dailyAllCompleteBonus;
    if (!bonus) return;

    const iconKey = weeklyMilestoneRewardTextureKey(bonus);
    const iconTex = iconKey ? TextureCache.get(iconKey) : undefined;
    if (!iconTex) return;

    const allObjectivesDone = dailyTotal > 0 && dailyDone >= dailyTotal;
    const bonusClaimed = QuestManager.dailyAllCompleteBonusClaimed;
    const canClaim = allObjectivesDone && !bonusClaimed;

    const disp = DAILY_HEADER_ALL_DONE_BONUS_ICON;
    const cx =
      barX +
      barW -
      DAILY_HEADER_ALL_DONE_BONUS_PAD_RIGHT -
      disp * 0.5 +
      DAILY_HEADER_ALL_DONE_BONUS_NUDGE_X;
    const cy = barY + barH * 0.5;

    const bonusRoot = new PIXI.Container();
    bonusRoot.position.set(cx, cy);

    const pulse = new PIXI.Container();
    bonusRoot.addChild(pulse);

    const icon = new PIXI.Sprite(iconTex);
    icon.anchor.set(0.5);
    const ik = disp / Math.max(iconTex.width, iconTex.height);
    icon.scale.set(ik);
    icon.position.set(0, 0);
    if (bonusClaimed) {
      icon.alpha = 0.5;
      icon.tint = 0xcccccc;
    }
    questRowNoPointerCapture(icon);
    pulse.addChild(icon);

    const qtyStr = dailyQuestRewardQtyText(bonus);
    let qtyH = 0;
    if (qtyStr != null && qtyStr !== '') {
      const qtyFs = DAILY_HEADER_ALL_DONE_BONUS_QTY_FONT;
      qtyH = Math.ceil(qtyFs * 1.28);
      const ct = new PIXI.Text(qtyStr, {
        fontSize: qtyFs,
        fill: 0xfff8e1,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0x3e2723,
        strokeThickness: 3,
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowAlpha: 0.45,
        dropShadowBlur: 2,
        dropShadowDistance: 1,
      } as any);
      ct.anchor.set(0.5, 0);
      ct.position.set(0, disp * 0.5 + WEEKLY_MILESTONE_QTY_GAP);
      if (bonusClaimed) ct.alpha = 0.55;
      questRowNoPointerCapture(ct);
      pulse.addChild(ct);
    }

    if (bonusClaimed) {
      const iconHalf = disp * 0.5;
      addRewardClaimCheckOverlay(pulse, 30, iconHalf);
    }

    const hitHalfW = Math.max(28, Math.round(disp * 0.55));
    const hitTop = -disp * 0.5 - 4;
    const hitH =
      disp + (qtyStr != null && qtyStr !== '' ? WEEKLY_MILESTONE_QTY_GAP + qtyH : 0) + 8;
    bonusRoot.hitArea = new PIXI.Rectangle(-hitHalfW, hitTop, hitHalfW * 2, hitH);

    if (canClaim) {
      bonusRoot.eventMode = 'static';
      bonusRoot.cursor = 'pointer';
      bonusRoot.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        const ok = QuestManager.claimDailyAllCompleteBonus();
        if (!ok) return;
        const flyItems = questChallengeRewardToFlyItems(bonus);
        if (flyItems.length > 0) {
          const startGlobal = bonusRoot.toGlobal(new PIXI.Point(0, 0));
          RewardFlyCoordinator.playBatch(flyItems, startGlobal);
        }
      });
      this._dailyAllCompleteBonusBobRoot = bonusRoot;
      this._dailyAllCompleteBonusBreatheScale = pulse.scale;
      this._startDailyRewardClaimAnim(bonusRoot, cy, 6, pulse.scale);
    } else {
      questRowNoPointerCapture(bonusRoot);
    }

    this._content.addChild(bonusRoot);
  }

  /**
   * 任务标题：花愿 / 钻石类用主包图标替换「花愿」「钻石」字样；其余仍用文案。
   * 返回容器左上角为 (0,0)，由调用方设置 `position`；便于在标题后接对勾。
   */
  private _buildDailyTaskTitleRow(def: DailyQuestTemplate, descFs: number): PIXI.Container {
    const sty = {
      fontSize: descFs,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as const;
    const row = new PIXI.Container();
    let cursorX = 0;
    const iconH = Math.round(descFs * 1.08);
    const iconY = Math.max(0, Math.round(descFs * 0.08));

    const appendText = (str: string): void => {
      const t = new PIXI.Text(str, sty as any);
      t.position.set(cursorX, 0);
      questRowNoPointerCapture(t);
      row.addChild(t);
      cursorX += Math.ceil(t.width);
    };

    const appendIcon = (texKey: string, fallbackLabel: string): void => {
      const tex = TextureCache.get(texKey);
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        const sc = iconH / Math.max(tex.width, tex.height);
        sp.scale.set(sc);
        sp.anchor.set(0, 0);
        sp.position.set(cursorX, iconY);
        questRowNoPointerCapture(sp);
        row.addChild(sp);
        cursorX += Math.ceil(sp.width);
      } else {
        appendText(fallbackLabel);
      }
    };

    if (def.kind === 'huayuan') {
      appendText(`收集 ${def.target} `);
      appendIcon('icon_huayuan', '花愿');
    } else if (def.kind === 'diamond') {
      appendText(`消耗 ${def.target} `);
      appendIcon('icon_gem', '钻石');
    } else {
      const t = new PIXI.Text(QuestManager.describeTemplate(def), sty as any);
      questRowNoPointerCapture(t);
      row.addChild(t);
    }

    return row;
  }

  /**
   * 黄任务卡内迷你进度条：**扁平**单色填充 + 浅轨细线（无阴影层、无双色填充、无白高光）。
   */
  private _drawQuestTaskProgressBar(
    parent: PIXI.Container,
    barX: number,
    barY: number,
    barW: number,
    barH: number,
    progress: number,
  ): void {
    const r = barH / 2;
    const p = Math.max(0, Math.min(1, progress));
    const inset = 2;

    const track = new PIXI.Graphics();
    track.beginFill(QUEST_PROG_TASK_ROW_TRACK_FILL, 1);
    track.drawRoundedRect(barX, barY, barW, barH, r);
    track.endFill();
    track.lineStyle(1, QUEST_PROG_TASK_ROW_TRACK_LINE, 0.88);
    track.drawRoundedRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1, Math.max(1, r - 1));
    questRowNoPointerCapture(track);
    parent.addChild(track);

    const innerW = barW - inset * 2;
    const innerH = barH - inset * 2;
    const ir = Math.max(5, r - inset);
    if (p > 0.002 && innerW * p > 5) {
      const fw = Math.max(0, innerW * p - 0.5);
      const fill = new PIXI.Graphics();
      fill.beginFill(QUEST_PROG_TASK_ROW_FILL, 1);
      fill.drawRoundedRect(barX + inset, barY + inset, fw, innerH, ir);
      fill.endFill();
      questRowNoPointerCapture(fill);
      parent.addChild(fill);
    }
  }

  private _addProgressInTextureSlot(
    dispX: number,
    dispY: number,
    dispW: number,
    dispH: number,
    uv: { readonly u: number; readonly v: number; readonly uw: number; readonly uh: number },
    progress: number,
    trackColor: number,
    trackAlpha: number,
    fillColor: number,
    nudgeX = 0,
    nudgeY = 0,
    slotBleedX = 0,
  ): void {
    const px = dispX + uv.u * dispW + nudgeX - slotBleedX;
    const py = dispY + uv.v * dispH + nudgeY;
    const tw = uv.uw * dispW + slotBleedX * 2;
    const th = uv.uh * dispH;
    const r = th / 2;
    const gTrack = new PIXI.Graphics();
    gTrack.beginFill(trackColor, trackAlpha);
    gTrack.drawRoundedRect(px, py, tw, th, r);
    gTrack.endFill();
    this._content.addChild(gTrack);
    const p = Math.max(0, Math.min(1, progress));
    const fillW = tw * p;
    if (fillW > 0.5) {
      const rr = Math.min(r, fillW / 2);
      const gFill = new PIXI.Graphics();
      gFill.beginFill(fillColor, 1);
      gFill.drawRoundedRect(px, py, fillW, th, rr);
      gFill.endFill();
      this._content.addChild(gFill);
    }
  }

  /**
   * 可领时：`root` 上下轻跳；`breatheScale` 上做 scale 呼吸（须与 root 分开 cancel）。
   */
  private _startDailyRewardClaimAnim(
    root: PIXI.Container,
    baseY: number,
    amplitude: number,
    breatheScale: { x: number; y: number },
  ): void {
    TweenManager.cancelTarget(root);
    TweenManager.cancelTarget(breatheScale);
    root.y = baseY;
    breatheScale.x = breatheScale.y = 1;
    const down = (): void => {
      TweenManager.to({
        target: root,
        props: { y: baseY + amplitude },
        duration: 0.26,
        ease: Ease.easeOutQuad,
        onComplete: up,
      });
    };
    const up = (): void => {
      TweenManager.to({
        target: root,
        props: { y: baseY },
        duration: 0.3,
        ease: Ease.easeInQuad,
        onComplete: down,
      });
    };
    const breatheOut = (): void => {
      TweenManager.to({
        target: breatheScale,
        props: { x: 1, y: 1 },
        duration: 0.52,
        ease: Ease.easeInOutQuad,
        onComplete: breatheIn,
      });
    };
    const breatheIn = (): void => {
      TweenManager.to({
        target: breatheScale,
        props: { x: 1.08, y: 1.08 },
        duration: 0.52,
        ease: Ease.easeInOutQuad,
        onComplete: breatheOut,
      });
    };
    down();
    breatheIn();
  }

  private _drawTaskRow(
    x: number,
    y: number,
    w: number,
    rowH: number,
    quest: { templateId: string; current: number; claimed: boolean },
    def: DailyQuestTemplate,
    parent: PIXI.Container,
  ): number {
    const isComplete = quest.current >= def.target;
    const isClaimed = quest.claimed;
    const layoutS = rowH / TASK_ROW_LAYOUT_REF_H;

    const rowTex = TextureCache.get('daily_challenge_task_row_textured_nb2')
      ?? TextureCache.get('checkin_milestone_panel');
    if (rowTex) {
      const rowSpr = spriteTaskRowPanel(rowTex, x, y, w, rowH);
      /** 已领不再整行灰化，用对勾角标区分 */
      rowSpr.tint = isComplete ? 0xfff8e8 : 0xffffff;
      questRowNoPointerCapture(rowSpr);
      parent.addChild(rowSpr);
    } else {
      const inset = w * (1 - TASK_ROW_BG_WIDTH_FRAC) / 2;
      const rr = Math.max(8, Math.round(12 * layoutS));
      const bg = new PIXI.Graphics();
      bg.beginFill(isComplete ? 0xFFF8E1 : 0xFFFFFF);
      bg.drawRoundedRect(x + inset, y, w - inset * 2, rowH, rr);
      bg.endFill();
      bg.lineStyle(1, 0xE0E0E0);
      bg.drawRoundedRect(x + inset, y, w - inset * 2, rowH, rr);
      questRowNoPointerCapture(bg);
      parent.addChild(bg);
    }

    const padL = Math.round(8 * layoutS);
    const padR = Math.round(18 * layoutS);
    const descFs = Math.max(22, Math.round(28 * layoutS));
    const ptsFs = Math.max(22, Math.round(26 * layoutS));
    const ptsNudgeLeft = Math.round(TASK_ROW_PTS_NUDGE_LEFT * layoutS);
    const progress = Math.min(quest.current / def.target, 1);

    const titleLineH = Math.ceil(descFs * 1.22);
    /** 标题基线与迷你进度条顶之间的留白（含额外 5 设计像素，避免贴太紧） */
    const gapTitleBar = Math.round(6 * layoutS) + Math.round(5 * layoutS);
    const barH = Math.max(26, Math.round(30 * layoutS));
    const rewardIconDisp = Math.round(TASK_ROW_REWARD_ICON_DISP * layoutS);
    /** 叠在图标右下角（与周里程碑「图标下居中」区分，避免行内错位） */
    const rewardQtyFs = Math.max(21, Math.round(26 * layoutS));
    const barRowH = Math.max(barH, rewardIconDisp + 2);
    const edgeSafe = Math.round(3 * layoutS);

    const blockH = titleLineH + gapTitleBar + barRowH;
    const blockTop = y + (rowH - blockH) / 2;
    const titleTopY = blockTop;
    const barY = blockTop + titleLineH + gapTitleBar;
    const titleMidY = titleTopY + titleLineH * 0.5;

    const badgeSide = Math.min(40, Math.max(28, Math.round(32 * layoutS)));
    const titleLead = Math.round(6 * layoutS);
    const titleBarNudgeX = Math.round(TASK_ROW_TITLE_BAR_NUDGE_X * layoutS);
    const titleStartX = x + padL + titleLead + titleBarNudgeX;

    const titleRow = this._buildDailyTaskTitleRow(def, descFs);
    titleRow.position.set(titleStartX, titleTopY);
    parent.addChild(titleRow);

    if (isComplete) {
      const badgeTex = TextureCache.get('ui_order_check_badge');
      if (badgeTex) {
        const lb = titleRow.getLocalBounds();
        const titleW = Math.max(1, lb.width);
        const gapAfterTitle = Math.round(TASK_ROW_CHECK_AFTER_TITLE_GAP * layoutS);
        const bs = badgeSide / Math.max(badgeTex.width, badgeTex.height);
        const badge = new PIXI.Sprite(badgeTex);
        badge.scale.set(bs);
        badge.anchor.set(0, 0.5);
        badge.position.set(titleStartX + titleW + gapAfterTitle, titleMidY);
        questRowNoPointerCapture(badge);
        parent.addChild(badge);
      }
    }

    const pts = new PIXI.Text(`+${def.weeklyPoints}积分`, {
      fontSize: ptsFs,
      fill: 0xc49000,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    pts.anchor.set(1, 0.5);
    pts.position.set(x + w - padR - ptsNudgeLeft, titleMidY);
    questRowNoPointerCapture(pts);
    parent.addChild(pts);

    const barX = x + padL + titleBarNudgeX;
    const iconPullLeft = Math.round(TASK_ROW_REWARD_ICON_PULL_LEFT * layoutS);
    const iconCx =
      x + w - padR - edgeSafe - rewardIconDisp * 0.5 - iconPullLeft;
    const iconLeft = iconCx - rewardIconDisp * 0.5;
    const barTailOverlap = Math.round(TASK_ROW_BAR_TAIL_OVERLAP * layoutS);
    const barTailShorten = Math.round(TASK_ROW_BAR_TAIL_SHORTEN * layoutS);
    /** 略短于「贴齐图标左缘」，右端仍略伸入图标下，大图标后绘盖住条尾 */
    const barRight = iconLeft - barTailShorten + barTailOverlap;
    const barSpan = Math.max(96, barRight - barX);
    const barW = barSpan;

    this._drawQuestTaskProgressBar(parent, barX, barY, barW, barH, progress);

    const progFs = Math.max(17, Math.round(21 * layoutS));
    const progOnFill = progress >= 0.5;
    const progT = new PIXI.Text(`${quest.current}/${def.target}`, {
      fontSize: progFs,
      fill: progOnFill ? 0xffffff : 0x6b5a72,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      ...(progOnFill
        ? { stroke: QUEST_PROG_DAILY_LABEL_STROKE, strokeThickness: Math.max(2, Math.round(2.2 * layoutS)) }
        : {}),
    } as any);
    progT.anchor.set(0.5, 0.5);
    progT.position.set(barX + barW * 0.5, barY + barH * 0.5);
    questRowNoPointerCapture(progT);
    parent.addChild(progT);

    const iconKey = weeklyMilestoneRewardTextureKey(def.reward);
    const iconTex = iconKey ? TextureCache.get(iconKey) : undefined;
    const rewardRootY = barY + barRowH * 0.5;

    if (iconTex) {
      const qtyStr = dailyQuestRewardQtyText(def.reward);
      const rewardRoot = new PIXI.Container();
      rewardRoot.position.set(iconCx, rewardRootY);
      parent.addChild(rewardRoot);

      const pulse = new PIXI.Container();
      rewardRoot.addChild(pulse);

      const icon = new PIXI.Sprite(iconTex);
      icon.anchor.set(0.5);
      const ik = rewardIconDisp / Math.max(iconTex.width, iconTex.height);
      icon.scale.set(ik);
      icon.position.set(0, 0);
      if (isClaimed) {
        icon.alpha = 0.5;
        icon.tint = 0xcccccc;
      }
      questRowNoPointerCapture(icon);
      pulse.addChild(icon);

      if (qtyStr != null && qtyStr !== '') {
        const inset = Math.max(2, Math.round(3 * layoutS));
        const half = rewardIconDisp * 0.5;
        const claimQtyNudge = isClaimed ? Math.round(12 * layoutS) : 0;
        const ct = new PIXI.Text(qtyStr, {
          fontSize: rewardQtyFs,
          fill: 0xfff8e1,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
          stroke: 0x3e2723,
          strokeThickness: Math.max(3, Math.round(3.5 * layoutS)),
          dropShadow: true,
          dropShadowColor: 0x000000,
          dropShadowAlpha: 0.5,
          dropShadowBlur: 2,
          dropShadowDistance: 1,
        } as any);
        ct.anchor.set(1, 1);
        ct.position.set(half - inset - claimQtyNudge, half - inset - claimQtyNudge);
        if (isClaimed) ct.alpha = 0.55;
        questRowNoPointerCapture(ct);
        pulse.addChild(ct);
      }

      if (isClaimed) {
        const iconHalf = rewardIconDisp * 0.5;
        const checkSide = Math.min(42, Math.max(28, Math.round(32 * layoutS)));
        addRewardClaimCheckOverlay(pulse, checkSide, iconHalf);
      }

      const canClaimReward = isComplete && !isClaimed;
      const hitPadX = Math.max(22, Math.round(14 * layoutS));
      const hitTop = -rewardIconDisp * 0.5 - 4;
      const hitH = rewardIconDisp + 8;
      rewardRoot.hitArea = new PIXI.Rectangle(-hitPadX, hitTop, hitPadX * 2, hitH);

      if (canClaimReward) {
        rewardRoot.eventMode = 'static';
        rewardRoot.cursor = 'pointer';
        rewardRoot.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
          e.stopPropagation();
          const reward = def.reward;
          const ok = QuestManager.claimDailyTask(quest.templateId);
          if (!ok) return;
          const flyItems = questChallengeRewardToFlyItems(reward);
          if (flyItems.length > 0) {
            const startGlobal = rewardRoot.toGlobal(new PIXI.Point(0, 0));
            RewardFlyCoordinator.playBatch(flyItems, startGlobal);
          }
        });
        this._startDailyRewardClaimAnim(
          rewardRoot,
          rewardRootY,
          Math.max(4, Math.round(6 * layoutS)),
          pulse.scale,
        );
      } else {
        questRowNoPointerCapture(rewardRoot);
      }
    } else {
      const rw = new PIXI.Text(rewardPreview(def.reward), {
        fontSize: Math.max(11, Math.round(13 * layoutS)),
        fill: COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
      });
      rw.anchor.set(0.5, 0.5);
      rw.position.set(iconCx, barY + barRowH * 0.5);
      questRowNoPointerCapture(rw);
      parent.addChild(rw);
    }

    return y + rowH;
  }

  private _drawWeeklyFooter(panelX: number, footerTop: number, panelW: number, footerH: number): void {
    const padX = 20;
    const wp = QuestManager.weeklyPoints;
    const weekMilestones = QuestManager.weeklyMilestoneDefs;
    const maxT =
      weekMilestones.length > 0 ? weekMilestones[weekMilestones.length - 1].threshold : 1;

    const barW = panelW - padX * 2;
    const barX = panelX + padX;

    /** 底部为「图标行 + 倒计时文案 + 底边距」预留，避免用倒计时 Y 反推轨顶把条整体上推后与图标争同一带 */
    const weeklyFooterBottomPad = 10;
    const weeklyCountdownBand = WEEKLY_COUNTDOWN_FONT_SIZE + weeklyFooterBottomPad;
    const weeklyQtyH = Math.ceil(WEEKLY_MILESTONE_QTY_FONT * 1.28);
    const weeklyIconBand =
      WEEKLY_RAIL_TO_ICONS_GAP +
      WEEKLY_REWARD_ICON_DISP +
      WEEKLY_MILESTONE_QTY_GAP +
      weeklyQtyH;

    const railDecoTex = TextureCache.get('daily_challenge_weekly_rail_empty_nb2');
    let railH = 56;
    let railDrawX = barX;
    let railDrawW = barW;
    let railDecoScale = 1;
    if (railDecoTex) {
      /** 略缩小轨整体，减轻「粗重」感，与上方细胶囊条更协调 */
      const railUniformShrink = 0.8;
      railDecoScale = (barW / railDecoTex.width) * railUniformShrink;
      railH = railDecoTex.height * railDecoScale;
      railDrawW = railDecoTex.width * railDecoScale;
      railDrawX = barX + (barW - railDrawW) / 2;
    }
    /** 周轨顶：在 footer 内尽量靠下，保证「本周积分」、轨、里程碑与底部文案都落在粉区内可见 */
    const railTopMax =
      footerTop + footerH - weeklyCountdownBand - weeklyIconBand - railH - WEEKLY_ICONS_TO_COUNTDOWN_GAP;
    const railTop = railTopMax;

    if (railDecoTex) {
      const weeklyRatio = maxT > 0 ? Math.min(1, wp / maxT) : 0;

      this._addProgressInTextureSlot(
        railDrawX,
        railTop,
        railDrawW,
        railH,
        WEEKLY_RAIL_PROGRESS_UV,
        weeklyRatio,
        QUEST_PROG_WEEKLY_SLOT_BG,
        QUEST_PROG_WEEKLY_SLOT_BG_ALPHA,
        QUEST_PROG_WEEKLY_FILL,
        WEEKLY_RAIL_PROGRESS_NUDGE_X,
        WEEKLY_RAIL_PROGRESS_NUDGE_Y,
        WEEKLY_RAIL_PROGRESS_FILL_OUTSET_X,
      );
      const deco = new PIXI.Sprite(railDecoTex);
      deco.scale.set(railDecoScale);
      deco.position.set(railDrawX, railTop);
      deco.alpha = 0.97;
      this._content.addChild(deco);
    }

    const cap = new PIXI.Text(
      `本周积分 ${wp} / ${maxT}`,
      questPanelMutedCaptionStyle(WEEKLY_CAP_FONT_SIZE) as any,
    );
    cap.anchor.set(0, 1);
    cap.position.set(railDrawX + 6, railTop - 6);
    this._content.addChild(cap);

    const uv = WEEKLY_RAIL_PROGRESS_UV;
    const trackPx = railDrawX + uv.u * railDrawW + WEEKLY_RAIL_PROGRESS_NUDGE_X;
    const trackPy = railTop + uv.v * railH + WEEKLY_RAIL_PROGRESS_NUDGE_Y;
    const trackW = uv.uw * railDrawW;
    const trackTh = uv.uh * railH;
    const dotY = trackPy + trackTh * 0.5;

    const mileSpanStart = trackPx + trackW * WEEKLY_MILESTONE_X_INSET_LEFT_FRAC;
    const mileSpanW = trackW * (1 - WEEKLY_MILESTONE_X_INSET_LEFT_FRAC - WEEKLY_MILESTONE_X_INSET_RIGHT_FRAC);

    const DOT_DISP = 24;
    const REWARD_ICON_DISP = WEEKLY_REWARD_ICON_DISP;
    const rewardY = railTop + railH + WEEKLY_RAIL_TO_ICONS_GAP + REWARD_ICON_DISP * 0.5;

    const dotTex = TextureCache.get('daily_challenge_ui_F_dot');
    const claimed = QuestManager.weeklyMilestonesClaimed;
    for (const m of weekMilestones) {
      const ratio = maxT > 0 ? m.threshold / maxT : 0;
      const cx = mileSpanStart + mileSpanW * ratio;
      const canClaim = wp >= m.threshold && !claimed.has(m.id);
      const done = claimed.has(m.id);

      if (dotTex) {
        const dot = new PIXI.Sprite(dotTex);
        dot.anchor.set(0.5);
        const k = DOT_DISP / Math.max(1, dotTex.width);
        dot.scale.set(k);
        dot.position.set(cx, dotY);
        this._content.addChild(dot);
      } else {
        const g = new PIXI.Graphics();
        g.beginFill(0xffe8b8);
        g.lineStyle(2, QUEST_PROG_TRACK_LINE, 0.9);
        g.drawCircle(cx, dotY, DOT_DISP * 0.45);
        g.endFill();
        this._content.addChild(g);
      }

      const iconKey = weeklyMilestoneRewardTextureKey(m.reward);
      const rewardTex = iconKey ? TextureCache.get(iconKey) : undefined;
      if (rewardTex) {
        const mileRoot = new PIXI.Container();
        mileRoot.position.set(cx, rewardY);
        this._content.addChild(mileRoot);

        const pulse = new PIXI.Container();
        mileRoot.addChild(pulse);

        const sp = new PIXI.Sprite(rewardTex);
        sp.anchor.set(0.5);
        const rk = REWARD_ICON_DISP / Math.max(rewardTex.width, rewardTex.height);
        sp.scale.set(rk);
        sp.position.set(0, 0);
        if (done) {
          sp.alpha = 0.5;
          sp.tint = 0xcccccc;
        } else {
          sp.alpha = 1;
          sp.tint = 0xffffff;
        }
        pulse.addChild(sp);

        const wQtyStr = dailyQuestRewardQtyText(m.reward);
        if (wQtyStr != null && wQtyStr !== '') {
          const wq = new PIXI.Text(wQtyStr, {
            fontSize: WEEKLY_MILESTONE_QTY_FONT,
            fill: 0xfff8e1,
            fontFamily: FONT_FAMILY,
            fontWeight: 'bold',
            stroke: 0x3e2723,
            strokeThickness: 2.5,
            dropShadow: true,
            dropShadowColor: 0x000000,
            dropShadowAlpha: 0.45,
            dropShadowBlur: 2,
            dropShadowDistance: 1,
          } as any);
          wq.anchor.set(0.5, 0);
          wq.position.set(0, REWARD_ICON_DISP * 0.5 + WEEKLY_MILESTONE_QTY_GAP);
          wq.eventMode = 'none';
          if (done) wq.alpha = 0.55;
          pulse.addChild(wq);
        }

        if (done) {
          const wh = REWARD_ICON_DISP * 0.5;
          const wCheck = Math.min(34, Math.max(24, Math.round(REWARD_ICON_DISP * 0.78)));
          addRewardClaimCheckOverlay(pulse, wCheck, wh);
        }

        const hitHalfW = Math.max(28, Math.round(REWARD_ICON_DISP * 0.55));
        const hitTop = -REWARD_ICON_DISP * 0.5 - 2;
        const hitH = REWARD_ICON_DISP + WEEKLY_MILESTONE_QTY_GAP + weeklyQtyH + 8;
        mileRoot.hitArea = new PIXI.Rectangle(-hitHalfW, hitTop, hitHalfW * 2, hitH);

        if (canClaim) {
          mileRoot.eventMode = 'static';
          mileRoot.cursor = 'pointer';
          mileRoot.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            e.stopPropagation();
            const reward = m.reward;
            const ok = QuestManager.claimWeeklyMilestone(m.id);
            if (!ok) return;
            const flyItems = questChallengeRewardToFlyItems(reward);
            if (flyItems.length > 0) {
              const startGlobal = mileRoot.toGlobal(new PIXI.Point(0, 0));
              RewardFlyCoordinator.playBatch(flyItems, startGlobal);
            }
          });
          this._startDailyRewardClaimAnim(mileRoot, rewardY, 5, pulse.scale);
        } else {
          mileRoot.eventMode = 'none';
        }
      } else {
        const fallback = new PIXI.Text(rewardPreview(m.reward), {
          fontSize: 11,
          fill: COLORS.TEXT_DARK,
          fontFamily: FONT_FAMILY,
        });
        fallback.anchor.set(0.5, 0);
        fallback.position.set(cx, railTop + railH + 4);
        this._content.addChild(fallback);
      }
    }

    const iconRowBottom =
      railTop +
      railH +
      WEEKLY_RAIL_TO_ICONS_GAP +
      REWARD_ICON_DISP +
      WEEKLY_MILESTONE_QTY_GAP +
      weeklyQtyH;
    const weeklyCountdownY = iconRowBottom + WEEKLY_ICONS_TO_COUNTDOWN_GAP;

    const now = Date.now();
    this._weeklyCountdownText = new PIXI.Text(
      `本周进度 ${formatWeekRemain(getNextWeekResetTimeMs(new Date(now)) - now)} 后重置`,
      questPanelMutedCaptionStyle(WEEKLY_COUNTDOWN_FONT_SIZE) as any,
    );
    this._weeklyCountdownText.anchor.set(0.5, 0);
    this._weeklyCountdownText.position.set(panelX + panelW / 2, weeklyCountdownY);
    this._content.addChild(this._weeklyCountdownText);
  }
}
