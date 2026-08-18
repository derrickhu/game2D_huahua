/**
 * 成长之路面板：章节头（标题 + 进度条）+ 任务列表（可滚动）+ 底部章节大奖卡。
 *
 * 结构与 `QuestPanel` 同构：`open()` / `close()` / `relayout()`，挂在 `OverlayManager.container`。
 * 内容全部由代码叠在 `growth_panel_shell_nb2` 壳图上，壳图只提供外框、金标题牌、
 * 章节条底板与底部粉色大奖卡底板（分区比例见 `SHELL_*_FRAC`）。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { GrowthQuestManager, type GrowthChapterView, type GrowthTaskView } from '@/managers/GrowthQuestManager';
import { GROWTH_CHAPTERS, type GrowthReward } from '@/config/GrowthQuestConfig';
import { ITEM_DEFS } from '@/config/ItemConfig';
import { WORKSHOP_RESOURCE_MAP, getWorkshopMaterialDisplayName } from '@/config/FurnitureWorkshopConfig';
import { TextureCache } from '@/utils/TextureCache';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { ItemObtainOverlay, type ItemObtainEntry } from './ItemObtainOverlay';

/**
 * 壳图分区（占壳图显示高度的比例），由 `growth_panel_shell_nb2.png` 像素实测得出。
 * 换壳图时必须重测这几个数，否则文字会压到装饰上。
 */
/** 金色标题牌中心（牌面是下弯拱形，取值比纯几何中心略低才落在厚实处） */
const SHELL_TITLE_CY_FRAC = 0.070;
/** 章节条（奶油内嵌板）上下边界 */
const SHELL_CHAPTER_TOP_FRAC = 0.167;
const SHELL_CHAPTER_BOTTOM_FRAC = 0.277;
/** 中部奶油列表区上下边界 */
const SHELL_LIST_TOP_FRAC = 0.290;
const SHELL_LIST_BOTTOM_FRAC = 0.740;
/** 底部粉色大奖卡上下边界 */
const SHELL_GRAND_TOP_FRAC = 0.775;
const SHELL_GRAND_BOTTOM_FRAC = 0.950;

const TASK_ROW_H = 118;
const TASK_ROW_GAP = 10;
/** 手势累计位移超过此值（设计像素）即判为滚动，不再触发行内 tap */
const LIST_TAP_SLOP = 12;

const TEXT_DARK = 0x6b5644;
const TEXT_MUTED = 0x9a86b8;
const CHAPTER_PURPLE = 0x7a5aa8;
const ROW_FILL = 0xfffaf2;
const ROW_LINE = 0xecd9ea;
const ROW_SHADOW = 0x9b8ab8;
const BAR_TRACK_FILL = 0xfff7fb;
const BAR_TRACK_LINE = 0xe4cfe0;
const BAR_FILL = 0x7ed957;
const BAR_FILL_DONE = 0xffc247;
const CLAIM_GREEN = 0x63c74d;
const GOTO_BLUE = 0x71b7f0;

function textStyle(base: Partial<PIXI.ITextStyle>): PIXI.ITextStyle {
  return { fontFamily: FONT_FAMILY, fill: TEXT_DARK, ...base } as PIXI.ITextStyle;
}

/** 与 QuestPanel 一致：微信小游戏上 stage 级 pointermove 常丢，滚动改绑 canvas */
function nativeClientToDesignY(clientY: number): number {
  return Game.clientToDesign(0, clientY).y;
}

function federatedPointerToDesignY(e: PIXI.FederatedPointerEvent): number {
  const n = e.nativeEvent as PointerEvent | MouseEvent | undefined;
  if (n != null && typeof (n as PointerEvent).clientY === 'number') {
    return nativeClientToDesignY((n as PointerEvent).clientY);
  }
  return Game.globalToDesign(e.global.x, e.global.y).y;
}

interface RewardChip {
  textureKey: string;
  /** 显示在图标下方；棋盘物品用 `×N`，直加货币用纯数字 */
  qtyText: string;
  fallbackLabel: string;
}

function workshopMaterialIcon(materialId: string): string {
  return WORKSHOP_RESOURCE_MAP.get(materialId)?.icon ?? 'icon_workshop_material';
}

/** 奖励 → 图标 chip 列表（面板展示用；顺序：物品 → 工坊材料 → 图纸 → 货币） */
function growthRewardChips(r: GrowthReward): RewardChip[] {
  const chips: RewardChip[] = [];
  for (const { itemId, count } of r.items ?? []) {
    const def = ITEM_DEFS.get(itemId);
    if (!def) continue;
    chips.push({ textureKey: def.icon, qtyText: `×${count}`, fallbackLabel: def.name });
  }
  for (const { materialId, count } of r.workshopMaterials ?? []) {
    chips.push({
      textureKey: workshopMaterialIcon(materialId),
      qtyText: `×${count}`,
      fallbackLabel: getWorkshopMaterialDisplayName(materialId),
    });
  }
  if (r.blueprintId) {
    chips.push({ textureKey: 'workshop_blueprint_generic', qtyText: '×1', fallbackLabel: '图纸' });
  }
  if (r.stamina) chips.push({ textureKey: 'icon_energy', qtyText: `${r.stamina}`, fallbackLabel: '体力' });
  if (r.diamond) chips.push({ textureKey: 'icon_gem', qtyText: `${r.diamond}`, fallbackLabel: '钻石' });
  if (r.huayuan) chips.push({ textureKey: 'icon_huayuan', qtyText: `${r.huayuan}`, fallbackLabel: '花愿' });
  if (r.flowerSignTickets) {
    chips.push({
      textureKey: 'icon_flower_sign_coin',
      qtyText: `${r.flowerSignTickets}`,
      fallbackLabel: '许愿硬币',
    });
  }
  return chips;
}

/** 多份奖励合并成一份，用于一键领取的合并展示 */
function mergeGrowthRewards(rewards: ReadonlyArray<GrowthReward>): GrowthReward {
  const itemMap = new Map<string, number>();
  const materialMap = new Map<string, number>();
  let hy = 0, di = 0, st = 0, fs = 0;
  let blueprintId: string | undefined;
  for (const r of rewards) {
    hy += r.huayuan ?? 0;
    di += r.diamond ?? 0;
    st += r.stamina ?? 0;
    fs += r.flowerSignTickets ?? 0;
    for (const { itemId, count } of r.items ?? []) {
      itemMap.set(itemId, (itemMap.get(itemId) ?? 0) + count);
    }
    for (const { materialId, count } of r.workshopMaterials ?? []) {
      materialMap.set(materialId, (materialMap.get(materialId) ?? 0) + count);
    }
    // 一次领取里最多只会有一张图纸（只有 g3_level_6 送图纸）
    if (r.blueprintId) blueprintId = r.blueprintId;
  }
  const merged: GrowthReward = {};
  if (hy > 0) merged.huayuan = hy;
  if (di > 0) merged.diamond = di;
  if (st > 0) merged.stamina = st;
  if (fs > 0) merged.flowerSignTickets = fs;
  if (itemMap.size > 0) merged.items = [...itemMap].map(([itemId, count]) => ({ itemId, count }));
  if (materialMap.size > 0) {
    merged.workshopMaterials = [...materialMap].map(([materialId, count]) => ({ materialId, count }));
  }
  if (blueprintId) merged.blueprintId = blueprintId;
  return merged;
}

/** 章节大奖用 `ItemObtainOverlay` 展示，需转成它的 entry 结构 */
function growthRewardToObtainEntries(r: GrowthReward): ItemObtainEntry[] {
  const entries: ItemObtainEntry[] = [];
  for (const { itemId, count } of r.items ?? []) {
    if (ITEM_DEFS.has(itemId)) entries.push({ kind: 'board_item', itemId, count });
  }
  for (const { materialId, count } of r.workshopMaterials ?? []) {
    entries.push({
      kind: 'workshop_material',
      materialId,
      count,
      label: getWorkshopMaterialDisplayName(materialId),
    });
  }
  if (r.blueprintId) {
    entries.push({ kind: 'unlock_icon', iconKey: 'workshop_blueprint_generic', label: '新图纸' });
  }
  if (r.stamina) entries.push({ kind: 'direct_currency', currency: 'stamina', amount: r.stamina });
  if (r.diamond) entries.push({ kind: 'direct_currency', currency: 'diamond', amount: r.diamond });
  if (r.huayuan) entries.push({ kind: 'direct_currency', currency: 'huayuan', amount: r.huayuan });
  if (r.flowerSignTickets) {
    entries.push({ kind: 'direct_currency', currency: 'flowerSign', amount: r.flowerSignTickets });
  }
  return entries;
}

export class GrowthQuestPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _isOpen = false;
  private _opening = false;
  private _assetUnsub: (() => void) | null = null;
  private _updatedRefreshRaf: number | null = null;

  /** 当前展示的章节；默认跟随 Manager 的当前章，玩家可左右翻看已完成章节 */
  private _viewChapterId: string | null = null;

  private _listContent: PIXI.Container | null = null;
  /** 领奖会整页重建，须记住滚动位置避免跳回顶部 */
  private _listScrollY = 0;
  private _listMaxScroll = 0;
  private _listListening = false;
  private _listLastY = 0;
  /** 列表视口顶部 y（滚动时 `inner.y = _listTop - _listScrollY`） */
  private _listTop = 0;
  private _bobTargets: PIXI.Container[] = [];
  private _breatheTargets: PIXI.ObservablePoint[] = [];
  /**
   * 本次手势累计拖动距离。任务行整行都是「前往」热区，若不判定拖动，
   * 滚列表松手就会误跳转到别的功能页 —— 超过 `LIST_TAP_SLOP` 即视为滚动，吞掉这次 tap。
   */
  private _listDragDistance = 0;

  private readonly _onListMove = (ev: PointerEvent): void => {
    if (!this._isOpen || !this._listListening || !this._listContent) return;
    const cur = nativeClientToDesignY(ev.clientY);
    const delta = this._listLastY - cur;
    this._listLastY = cur;
    this._listDragDistance += Math.abs(delta);
    this._listScrollY = Math.max(0, Math.min(this._listMaxScroll, this._listScrollY + delta));
    this._listContent.y = this._listTop - this._listScrollY;
  };

  private readonly _onListUp = (): void => {
    this._finishListScroll();
  };

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
    EventBus.on('growth:updated', () => {
      if (!this._isOpen || this._updatedRefreshRaf !== null) return;
      this._updatedRefreshRaf = requestAnimationFrame(() => {
        this._updatedRefreshRaf = null;
        if (this._isOpen) this._refresh();
      });
    });
  }

  open(): void {
    if (this._isOpen || this._opening) return;
    this._opening = true;
    // 每次打开都跳回当前章，避免上次翻看历史章节的状态残留
    this._viewChapterId = null;
    this._listScrollY = 0;
    void TextureCache.preloadPanelAssets('growth').finally(() => {
      this._opening = false;
      this._openReady();
    });
  }

  private _openReady(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this.alpha = 1;
    this._assetUnsub = TextureCache.onAssetGroupLoaded('growth', () => {
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
  }

  close(): void {
    this._opening = false;
    if (!this._isOpen) return;
    this._isOpen = false;
    this._assetUnsub?.();
    this._assetUnsub = null;
    this._finishListScroll();
    this._cancelBobs();

    TweenManager.cancelTarget(this._bg);
    TweenManager.cancelTarget(this._content);
    TweenManager.cancelTarget(this._content.scale);

    TweenManager.to({ target: this._bg, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad });
    TweenManager.to({
      target: this._content, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; this.alpha = 1; },
    });
    TweenManager.to({
      target: this._content.scale, props: { x: 0.9, y: 0.9 }, duration: 0.15, ease: Ease.easeInQuad,
    });
  }

  relayout(): void {
    if (!this.visible) return;
    this._bg.clear();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    this._bg.endFill();
    this._refresh();
  }

  private _build(): void {
    this._bg = new PIXI.Graphics();
    this._bg.beginFill(0x000000, 0.5);
    this._bg.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.on('pointerdown', () => this.close());
    this.addChild(this._bg);

    this._content = new PIXI.Container();
    this.addChild(this._content);
  }

  private _cancelBobs(): void {
    for (const t of this._bobTargets) TweenManager.cancelTarget(t);
    for (const s of this._breatheTargets) TweenManager.cancelTarget(s);
    this._bobTargets = [];
    this._breatheTargets = [];
  }

  /**
   * 可领取提示动画。`TweenManager` 没有 yoyo/repeat，用 onComplete 互相回调形成循环
   * （与 `QuestPanel._startDailyRewardClaimAnim` 同一套写法）。
   */
  private _startBob(target: PIXI.Container, baseY: number, amplitude: number): void {
    TweenManager.cancelTarget(target);
    target.y = baseY;
    const down = (): void => {
      TweenManager.to({
        target, props: { y: baseY + amplitude }, duration: 0.26,
        ease: Ease.easeOutQuad, onComplete: up,
      });
    };
    const up = (): void => {
      TweenManager.to({
        target, props: { y: baseY }, duration: 0.3,
        ease: Ease.easeInQuad, onComplete: down,
      });
    };
    down();
    this._bobTargets.push(target);
  }

  /** 呼吸缩放循环；`scale` 与 `y` 是不同 target，须分别 cancel，故单独收集 */
  private _startBreathe(scale: PIXI.ObservablePoint, maxScale: number): void {
    TweenManager.cancelTarget(scale);
    scale.x = scale.y = 1;
    const out = (): void => {
      TweenManager.to({
        target: scale, props: { x: 1, y: 1 }, duration: 0.52,
        ease: Ease.easeInOutQuad, onComplete: shrinkIn,
      });
    };
    const shrinkIn = (): void => {
      TweenManager.to({
        target: scale, props: { x: maxScale, y: maxScale }, duration: 0.52,
        ease: Ease.easeInOutQuad, onComplete: out,
      });
    };
    shrinkIn();
    this._breatheTargets.push(scale);
  }

  private _finishListScroll(): void {
    if (!this._listListening) return;
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.removeEventListener) {
      canvas.removeEventListener('pointermove', this._onListMove);
      canvas.removeEventListener('pointerup', this._onListUp);
      canvas.removeEventListener('pointercancel', this._onListUp);
    }
    this._listListening = false;
    if (this._listContent) this._listContent.cursor = 'grab';
  }

  private _beginListScroll(e: PIXI.FederatedPointerEvent): void {
    if (!this._isOpen || !this._listContent || this._listListening) return;
    // 先归零：列表短到不能滚时也要清掉上一次手势的残留距离，否则 tap 会被一直吞掉
    this._listDragDistance = 0;
    if (this._listMaxScroll <= 0) return;
    this._listListening = true;
    this._listScrollY = this._listTop - this._listContent.y;
    this._listLastY = federatedPointerToDesignY(e);
    this._listContent.cursor = 'grabbing';
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.addEventListener) {
      canvas.addEventListener('pointermove', this._onListMove);
      canvas.addEventListener('pointerup', this._onListUp);
      canvas.addEventListener('pointercancel', this._onListUp);
    }
  }

  // ═══════════════ 绘制 ═══════════════

  private _refresh(): void {
    this._finishListScroll();
    this._cancelBobs();
    const preservedScrollY = Math.max(0, this._listScrollY);
    this._listContent = null;

    // 须先摘 mask，否则蒙版对象被 destroy 后带 mask 的容器下一帧 updateTransform 会报 null
    for (const child of this._content.children) {
      const c = child as PIXI.Container;
      if (c.mask) c.mask = null;
    }
    while (this._content.children.length > 0) {
      const child = this._content.children[0];
      this._content.removeChild(child);
      child.destroy({ children: true });
    }

    this._content.pivot.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._content.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);

    const cx = DESIGN_WIDTH / 2;
    const panelW = DESIGN_WIDTH - 12;
    const panelH = Math.min(Game.logicHeight - 12, 1140);
    const panelX = cx - panelW / 2;
    const panelY = (Game.logicHeight - panelH) / 2;

    const shellTex = TextureCache.get('growth_panel_shell_nb2');
    let shellY = panelY;
    let shellH = panelH;
    if (shellTex) {
      const sc = panelW / shellTex.width;
      shellH = shellTex.height * sc;
      shellY = panelY + (panelH - shellH) / 2;
      const sh = new PIXI.Sprite(shellTex);
      sh.scale.set(sc);
      sh.position.set(panelX, shellY);
      this._content.addChild(sh);
    } else {
      const fb = new PIXI.Graphics();
      fb.beginFill(0xfffbf0);
      fb.drawRoundedRect(panelX, panelY, panelW, panelH, 20);
      fb.endFill();
      this._content.addChild(fb);
    }

    const view = this._resolveView();
    this._drawTitle(cx, shellY + shellH * SHELL_TITLE_CY_FRAC);

    if (!view) {
      this._drawCloseHit(panelX, panelW, shellY);
      return;
    }

    this._drawChapterBanner(
      view,
      cx,
      panelW,
      shellY + shellH * SHELL_CHAPTER_TOP_FRAC,
      shellH * (SHELL_CHAPTER_BOTTOM_FRAC - SHELL_CHAPTER_TOP_FRAC),
    );
    this._drawTaskList(
      view,
      cx,
      panelW,
      shellY + shellH * SHELL_LIST_TOP_FRAC,
      shellH * (SHELL_LIST_BOTTOM_FRAC - SHELL_LIST_TOP_FRAC),
      preservedScrollY,
    );
    this._drawGrandReward(
      view,
      cx,
      panelW,
      shellY + shellH * SHELL_GRAND_TOP_FRAC,
      shellH * (SHELL_GRAND_BOTTOM_FRAC - SHELL_GRAND_TOP_FRAC),
    );

    // 关闭热区最后加，避免被内容盖住
    this._drawCloseHit(panelX, panelW, shellY);
  }

  /** 要显示哪一章：玩家翻看过则用翻看的，否则跟随 Manager 当前章 */
  private _resolveView(): GrowthChapterView | null {
    if (this._viewChapterId) {
      const v = GrowthQuestManager.getChapterView(this._viewChapterId);
      if (v) return v;
      this._viewChapterId = null;
    }
    return GrowthQuestManager.getCurrentChapterView();
  }

  private _drawTitle(cx: number, cy: number): void {
    const t = new PIXI.Text('成长之路', textStyle({
      fontSize: 40,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0xb5762a,
      strokeThickness: 6,
      dropShadow: true,
      dropShadowColor: 0x8a5418,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    }));
    t.anchor.set(0.5);
    t.position.set(cx, cy);
    this._content.addChild(t);
  }

  private _drawCloseHit(panelX: number, panelW: number, shellY: number): void {
    // 壳图自带关闭钮，这里只补一个不可见热区（略大，便于点到）
    const hit = new PIXI.Graphics();
    hit.beginFill(0xffffff, 0.001);
    hit.drawCircle(panelX + panelW - 40, shellY + 34, 46);
    hit.endFill();
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._content.addChild(hit);
  }

  private _drawChapterBanner(
    view: GrowthChapterView,
    cx: number,
    panelW: number,
    top: number,
    h: number,
  ): void {
    const innerW = panelW * 0.74;
    // 壳图章节条左端有一枝花藤装饰，文字须让开，否则压在藤上
    const left = cx - innerW / 2 + 46;
    const right = cx + innerW / 2;
    const nameCY = top + h * 0.24;

    const name = new PIXI.Text(`第${view.index + 1}章 · ${view.def.title}`, textStyle({
      fontSize: 27,
      fontWeight: 'bold',
      fill: CHAPTER_PURPLE,
    }));
    name.anchor.set(0, 0.5);
    name.position.set(left, nameCY);
    this._content.addChild(name);

    const frac = new PIXI.Text(`${view.completedCount}/${view.totalCount}`, textStyle({
      fontSize: 25,
      fontWeight: 'bold',
      fill: view.completedCount >= view.totalCount ? 0xe8952f : TEXT_MUTED,
    }));
    frac.anchor.set(1, 0.5);
    frac.position.set(right - 8, nameCY);
    this._content.addChild(frac);

    // 副标题夹在章节名与进度条之间，三行都落在章节条底板内
    const sub = new PIXI.Text(view.def.subtitle, textStyle({ fontSize: 19, fill: TEXT_MUTED }));
    sub.anchor.set(0, 0.5);
    sub.position.set(left, top + h * 0.5);
    this._content.addChild(sub);

    const barW = right - left - 8;
    const barH = 20;
    const barY = top + h * 0.74;
    const pct = view.totalCount > 0 ? view.completedCount / view.totalCount : 0;
    this._content.addChild(this._makeProgressBar(
      left, barY, barW, barH, pct,
      view.completedCount >= view.totalCount ? BAR_FILL_DONE : BAR_FILL,
    ));

    this._drawChapterNav(view, cx, panelW, nameCY);
  }

  /** 已完成的章节可以左右翻看（右箭头只在还有已解锁的下一章时出现） */
  private _drawChapterNav(view: GrowthChapterView, cx: number, panelW: number, cy: number): void {
    const edge = panelW * 0.5 - 30;
    const mk = (dx: number, label: string, targetIdx: number): void => {
      const target = GROWTH_CHAPTERS[targetIdx];
      if (!target || !GrowthQuestManager.isChapterUnlocked(target.id)) return;
      const t = new PIXI.Text(label, textStyle({ fontSize: 34, fontWeight: 'bold', fill: 0xbba5d6 }));
      t.anchor.set(0.5);
      t.position.set(cx + dx * edge, cy);
      t.eventMode = 'static';
      t.cursor = 'pointer';
      t.hitArea = new PIXI.Rectangle(-26, -26, 52, 52);
      t.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._viewChapterId = target.id;
        this._listScrollY = 0;
        this._refresh();
      });
      this._content.addChild(t);
    };
    mk(-1, '‹', view.index - 1);
    mk(1, '›', view.index + 1);
  }

  private _makeProgressBar(
    x: number, y: number, w: number, h: number, pct: number, fill: number,
  ): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const r = h / 2;
    g.beginFill(ROW_SHADOW, 0.12);
    g.drawRoundedRect(x, y + 2, w, h, r);
    g.endFill();
    g.lineStyle(2, BAR_TRACK_LINE, 0.9);
    g.beginFill(BAR_TRACK_FILL);
    g.drawRoundedRect(x, y, w, h, r);
    g.endFill();
    const p = Math.max(0, Math.min(1, pct));
    if (p > 0) {
      g.lineStyle(0);
      g.beginFill(fill);
      g.drawRoundedRect(x + 2, y + 2, Math.max(h - 4, (w - 4) * p), h - 4, (h - 4) / 2);
      g.endFill();
    }
    return g;
  }

  private _drawTaskList(
    view: GrowthChapterView,
    cx: number,
    panelW: number,
    top: number,
    viewportH: number,
    preservedScrollY: number,
  ): void {
    const listW = panelW * 0.8;
    const listX = cx - listW / 2;

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRect(listX - 6, top, listW + 12, viewportH);
    mask.endFill();
    this._content.addChild(mask);

    const outer = new PIXI.Container();
    outer.mask = mask;
    this._content.addChild(outer);

    // 行按「视口顶为原点」的相对坐标画，滚动只改 inner.y，不掺 top 偏移
    const inner = new PIXI.Container();
    inner.eventMode = 'static';
    inner.cursor = 'grab';
    inner.position.set(0, top);
    outer.addChild(inner);

    let y = 0;
    for (const task of view.tasks) {
      inner.addChild(this._makeTaskRow(task, listX, y, listW, view.chapterRewardClaimed));
      y += TASK_ROW_H + TASK_ROW_GAP;
    }
    const contentH = Math.max(0, y - TASK_ROW_GAP);

    this._listContent = inner;
    this._listMaxScroll = Math.max(0, contentH - viewportH);
    this._listScrollY = Math.min(preservedScrollY, this._listMaxScroll);
    this._listTop = top;
    inner.y = top - this._listScrollY;

    inner.on('pointerdown', (e: PIXI.FederatedPointerEvent) => this._beginListScroll(e));
    inner.on('wheel', (e: PIXI.FederatedWheelEvent) => {
      if (this._listMaxScroll <= 0) return;
      this._listScrollY = Math.max(0, Math.min(this._listMaxScroll, this._listScrollY + e.deltaY * 0.35));
      inner.y = this._listTop - this._listScrollY;
      e.stopPropagation();
    });
  }

  private _makeTaskRow(
    task: GrowthTaskView,
    x: number,
    y: number,
    w: number,
    chapterDone: boolean,
  ): PIXI.Container {
    const row = new PIXI.Container();
    const h = TASK_ROW_H;
    // 行内静态元素一律不抢指针，否则会挡住底板热区与列表拖拽（同 QuestPanel 的做法）
    const passive = <T extends PIXI.Container>(o: T): T => {
      o.eventMode = 'none';
      return o;
    };

    const plate = new PIXI.Graphics();
    plate.beginFill(ROW_SHADOW, 0.14);
    plate.drawRoundedRect(x + 3, y + 4, w, h, 20);
    plate.endFill();
    plate.lineStyle(2.5, ROW_LINE, 0.95);
    plate.beginFill(ROW_FILL, 0.98);
    plate.drawRoundedRect(x, y, w, h, 20);
    plate.endFill();
    row.addChild(plate);

    const pad = 20;
    const rewardZoneW = 130;
    const textW = w - pad * 2 - rewardZoneW;

    const title = new PIXI.Text(task.def.title, textStyle({
      fontSize: 25,
      fontWeight: 'bold',
      fill: task.claimed ? TEXT_MUTED : TEXT_DARK,
      wordWrap: true,
      wordWrapWidth: textW,
    }));
    title.anchor.set(0, 0);
    title.position.set(x + pad, y + 16);
    row.addChild(passive(title));

    if (task.lockedByLevel) {
      const lock = new PIXI.Text(`${task.def.requireLevel} 星后开启`, textStyle({
        fontSize: 21, fill: 0xc0a8d8, fontWeight: 'bold',
      }));
      lock.anchor.set(0, 0.5);
      lock.position.set(x + pad, y + h - 32);
      row.addChild(passive(lock));
    } else {
      const barW = textW - 74;
      const barY = y + h - 42;
      row.addChild(passive(this._makeProgressBar(
        x + pad, barY, barW, 20,
        task.target > 0 ? task.current / task.target : 0,
        task.completed ? BAR_FILL_DONE : BAR_FILL,
      )));
      const prog = new PIXI.Text(`${task.current}/${task.target}`, textStyle({
        fontSize: 20,
        fill: task.completed ? 0xe8952f : TEXT_MUTED,
        fontWeight: 'bold',
      }));
      prog.anchor.set(0, 0.5);
      prog.position.set(x + pad + barW + 10, barY + 10);
      row.addChild(prog);
    }

    row.addChild(this._makeTaskRewardZone(task, x + w - pad - rewardZoneW / 2, y + h / 2, rewardZoneW));

    // 未达标且配了跳转的任务：整行可点，直接把玩家送到对应功能
    if (!task.completed && !task.claimed && task.def.gotoEvent && !task.lockedByLevel) {
      plate.eventMode = 'static';
      plate.cursor = 'pointer';
      plate.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (this._listDragDistance > LIST_TAP_SLOP) return;
        const evt = task.def.gotoEvent!;
        this.close();
        EventBus.emit(evt);
      });
      const chevron = new PIXI.Text('›', textStyle({ fontSize: 30, fill: GOTO_BLUE, fontWeight: 'bold' }));
      chevron.anchor.set(0.5);
      chevron.position.set(x + w - 12, y + h / 2);
      row.addChild(passive(chevron));
    }

    if (chapterDone && !task.claimed) plate.alpha = 0.75;
    return row;
  }

  /** 行尾：奖励图标 + 数量；可领时图标上下跳且可点领取，已领打灰勾 */
  private _makeTaskRewardZone(
    task: GrowthTaskView,
    cx: number,
    cy: number,
    zoneW: number,
  ): PIXI.Container {
    const zone = new PIXI.Container();
    const chips = growthRewardChips(task.def.reward);
    const shown = chips.slice(0, 2);
    const iconD = shown.length > 1 ? 46 : 58;
    const gap = 6;
    const totalW = shown.length * iconD + (shown.length - 1) * gap;

    const bob = new PIXI.Container();
    zone.addChild(bob);

    shown.forEach((chip, i) => {
      const ix = cx - totalW / 2 + i * (iconD + gap) + iconD / 2;
      const tex = TextureCache.get(chip.textureKey);
      let node: PIXI.Container;
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        const sc = iconD / Math.max(tex.width, tex.height);
        sp.scale.set(sc);
        sp.anchor.set(0.5);
        node = sp;
      } else {
        const t = new PIXI.Text(chip.fallbackLabel, textStyle({ fontSize: 16, fill: TEXT_MUTED }));
        t.anchor.set(0.5);
        node = t;
      }
      node.position.set(ix, cy - 8);
      if (task.claimed) {
        node.alpha = 0.5;
        (node as PIXI.Sprite).tint = 0xcccccc;
      }
      bob.addChild(node);

      const qty = new PIXI.Text(chip.qtyText, textStyle({
        fontSize: 18,
        fontWeight: 'bold',
        fill: task.claimed ? 0xbbbbbb : TEXT_DARK,
      }));
      qty.anchor.set(0.5, 0);
      qty.position.set(ix, cy - 8 + iconD / 2 + 2);
      bob.addChild(qty);
    });

    if (chips.length > shown.length) {
      const more = new PIXI.Text(`+${chips.length - shown.length}`, textStyle({
        fontSize: 17, fill: TEXT_MUTED, fontWeight: 'bold',
      }));
      more.anchor.set(0.5);
      more.position.set(cx + zoneW / 2 - 6, cy - 8);
      zone.addChild(more);
    }

    if (task.claimable) {
      // 可领取：奖励图标上下跳 + 点击领取，与每日挑战一致
      bob.eventMode = 'static';
      bob.cursor = 'pointer';
      bob.hitArea = new PIXI.Rectangle(cx - zoneW / 2, cy - 42, zoneW, 84);
      bob.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (this._listDragDistance > LIST_TAP_SLOP) return;
        this._claimTask(task);
      });
      this._startBob(bob, bob.y, 6);
    } else if (task.claimed) {
      const badgeTex = TextureCache.get('ui_order_check_badge');
      if (badgeTex) {
        const sp = new PIXI.Sprite(badgeTex);
        sp.anchor.set(0.5);
        sp.scale.set(30 / Math.max(badgeTex.width, badgeTex.height));
        sp.position.set(cx + zoneW / 2 - 10, cy - 28);
        zone.addChild(sp);
      } else {
        const t = new PIXI.Text('✓', textStyle({ fontSize: 26, fill: CLAIM_GREEN, fontWeight: 'bold' }));
        t.anchor.set(0.5);
        t.position.set(cx + zoneW / 2 - 10, cy - 28);
        zone.addChild(t);
      }
    }

    return zone;
  }

  private _claimTask(task: GrowthTaskView): void {
    const reward = GrowthQuestManager.claimTask(task.def.id);
    if (!reward) return;
    this._presentClaimed([reward], false);
  }

  /**
   * 领奖后的统一表现：**一律**用 `ItemObtainOverlay` 把本次全部奖励列出来。
   *
   * 刻意不做飞入粒子分支 —— 飞入撑不住全部奖励类型（工坊材料、图纸在顶栏没有落点会被丢弃），
   * 清章时又会被全屏弹层盖掉。统一走弹层后，改奖励内容不用再管表现层能不能承载。
   */
  private _presentClaimed(
    rewards: ReadonlyArray<GrowthReward>,
    chapterCleared: boolean,
  ): void {
    const entries = growthRewardToObtainEntries(mergeGrowthRewards(rewards));
    const done = (): void => {
      if (chapterCleared) {
        // 清章后自动跳到新开的章节，玩家不用手动翻
        this._viewChapterId = null;
        this._listScrollY = 0;
      }
      if (this._isOpen) this._refresh();
    };
    if (entries.length > 0) ItemObtainOverlay.show(entries, done);
    else done();
  }

  private _drawGrandReward(
    view: GrowthChapterView,
    cx: number,
    panelW: number,
    top: number,
    h: number,
  ): void {
    const innerW = panelW * 0.78;
    const left = cx - innerW / 2;

    const label = new PIXI.Text(`章节大奖 · ${view.def.chapterRewardLabel}`, textStyle({
      fontSize: 24,
      fontWeight: 'bold',
      fill: 0xa15d7a,
    }));
    label.anchor.set(0, 0.5);
    // 壳图粉卡顶边是扇贝波浪，标题再往下压一点才不压在波峰上
    label.position.set(left + 6, top + 38);
    this._content.addChild(label);

    const chips = growthRewardChips(view.def.chapterReward);
    const iconD = 54;
    const gap = 12;
    const iconsCY = top + h * 0.62;
    const btnW = 150;
    const iconsAreaLeft = left + 6;
    const iconsAreaW = innerW - btnW - 30;
    const totalW = Math.min(iconsAreaW, chips.length * iconD + (chips.length - 1) * gap);
    const step = chips.length > 1 ? (totalW - iconD) / (chips.length - 1) : 0;
    // 奖励数量不定（1～4 个），在按钮左侧的空档内居中，避免全挤在左边留大片空白
    const iconsStartX = iconsAreaLeft + Math.max(0, (iconsAreaW - totalW) / 2);

    const dim = !view.chapterRewardClaimable && !view.chapterRewardClaimed;
    chips.forEach((chip, i) => {
      const ix = iconsStartX + iconD / 2 + i * step;
      const tex = TextureCache.get(chip.textureKey);
      let node: PIXI.Container;
      if (tex) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        sp.scale.set(iconD / Math.max(tex.width, tex.height));
        node = sp;
      } else {
        const t = new PIXI.Text(chip.fallbackLabel, textStyle({ fontSize: 15, fill: TEXT_MUTED }));
        t.anchor.set(0.5);
        node = t;
      }
      node.position.set(ix, iconsCY);
      if (view.chapterRewardClaimed) {
        node.alpha = 0.45;
        (node as PIXI.Sprite).tint = 0xcccccc;
      } else if (dim) {
        node.alpha = 0.72;
      }
      this._content.addChild(node);

      const qty = new PIXI.Text(chip.qtyText, textStyle({
        fontSize: 17,
        fontWeight: 'bold',
        fill: view.chapterRewardClaimed ? 0xbbbbbb : TEXT_DARK,
      }));
      qty.anchor.set(0.5, 0);
      qty.position.set(ix, iconsCY + iconD / 2);
      this._content.addChild(qty);
    });

    this._drawGrandButton(view, cx + innerW / 2 - btnW / 2, iconsCY, btnW);
  }

  private _drawGrandButton(view: GrowthChapterView, cx: number, cy: number, w: number): void {
    const claimable = view.chapterRewardClaimable;
    const claimed = view.chapterRewardClaimed;
    const anyTaskClaimable = view.tasks.some(t => t.claimable);

    let label: string;
    let enabled: boolean;
    if (claimed) {
      label = '已领取';
      enabled = false;
    } else if (claimable) {
      label = '领取大奖';
      enabled = true;
    } else if (anyTaskClaimable) {
      label = '一键领取';
      enabled = true;
    } else {
      label = `${view.completedCount}/${view.totalCount}`;
      enabled = false;
    }

    const btn = new PIXI.Container();
    btn.position.set(cx, cy);

    const h = 58;
    const g = new PIXI.Graphics();
    const tex = enabled ? TextureCache.get('deco_card_btn_3') : null;
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      sp.scale.set(w / tex.width);
      btn.addChild(sp);
    } else {
      g.beginFill(ROW_SHADOW, 0.16);
      g.drawRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, h / 2);
      g.endFill();
      g.beginFill(enabled ? CLAIM_GREEN : 0xd8cbe4);
      g.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      g.endFill();
      btn.addChild(g);
    }

    const t = new PIXI.Text(label, textStyle({
      fontSize: 25,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: enabled ? 0x3f7d34 : 0x9d8fb0,
      strokeThickness: 4,
    }));
    t.anchor.set(0.5);
    btn.addChild(t);

    if (enabled) {
      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      btn.hitArea = new PIXI.Rectangle(-w / 2, -h / 2 - 6, w, h + 12);
      btn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._claimAll();
      });
      this._startBreathe(btn.scale, 1.06);
    } else {
      btn.alpha = claimed ? 0.6 : 0.85;
    }

    this._content.addChild(btn);
  }

  /**
   * 一键领取：领本章所有可领任务，凑满 6/6 时 Manager 会连章节大奖一起发。
   * 任务奖励与章节大奖合并成一个弹层展示，见 `_presentClaimed`。
   */
  private _claimAll(): void {
    const chapterBefore = GrowthQuestManager.currentChapter?.id ?? null;
    const granted = GrowthQuestManager.claimAllPending();
    if (granted.length === 0) return;

    const chapterCleared = chapterBefore !== null
      && GrowthQuestManager.currentChapter?.id !== chapterBefore;
    this._presentClaimed(granted, chapterCleared);
  }
}
