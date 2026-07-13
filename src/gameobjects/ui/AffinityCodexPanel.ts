import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';
import { AffinityCardManager } from '@/managers/AffinityCardManager';
import {
  AFFINITY_CARDS,
  CURRENT_SEASON,
  getCustomerMilestones,
  type AffinityCardDef,
  type CardReward,
} from '@/config/AffinityCardConfig';
import { AFFINITY_MAP } from '@/config/AffinityConfig';
import {
  LARGE_CARD_H,
  LARGE_CARD_W,
  buildAffinityCardThumb,
  buildLargeAffinityCardFront,
  thumbHeightFor,
} from './AffinityCardArt';

const SEASON_TYPE_IDS: string[] = CURRENT_SEASON.ownerTypeIds;

type ViewMode = 'overview' | 'detail';

interface ShellSpec {
  W: number;
  H: number;
}

const OVERVIEW_SHELL: ShellSpec = { W: 680, H: 1075 };
const DETAIL_SHELL: ShellSpec = { W: 680, H: 1211 };

/** v3 初春详情壳（680×1217）：烘焙返回钮 + 紧凑 info inset + 大卡片区 */
const DETAIL_LAYOUT = {
  TITLE_Y_FRAC: 0.082,
  TITLE_Y_NUDGE_PX: 6,
  CLOSE_CX_PX: 640,
  CLOSE_CY_PX: 44,
  CLOSE_HIT_R_PX: 38,
  BACK_CX_PX: 80,
  BACK_CY_PX: 67,
  BACK_HIT_W_PX: 108,
  BACK_HIT_H_PX: 48,
  INFO_X_FRAC: 0.088,
  INFO_Y_FRAC: 0.148,
  INFO_W_FRAC: 0.824,
  INFO_H_FRAC: 0.228,
  GRID_X_FRAC: 0.102,
  GRID_Y_FRAC: 0.382,
  GRID_W_FRAC: 0.796,
  GRID_H_FRAC: 0.458,
  GRID_INSET_X_PX: 14,
  GRID_INSET_Y_PX: 12,
  ARROW_Y_FRAC: 0.608,
  ARROW_INSET_X_PX: 26,
};

/** v3 初春主题壳（680×1075）：顶/底樱花插画 + 大奖励 inset + 净 cream 中区 */
const OVERVIEW_LAYOUT = {
  TITLE_Y_FRAC: 0.085,
  TITLE_Y_NUDGE_PX: 8,
  CLOSE_CX_PX: 640,
  CLOSE_CY_PX: 44,
  CLOSE_HIT_R_PX: 38,
  BANNER_X_FRAC: 0.088,
  BANNER_Y_FRAC: 0.155,
  BANNER_W_FRAC: 0.824,
  BANNER_H_FRAC: 0.30,
  CIRCLE_CX_FRAC: [0.24, 0.5, 0.76] as const,
  CIRCLE_CY_FRAC: 0.545,
  CIRCLE_SIZE_FRAC: 0.20,
  BOTTOM_HINT_Y_FRAC: 0.78,
};

/** 壳体顶边距 safeTop 的额外留白，避开微信胶囊/关闭钮 */
const CODEX_PANEL_TOP_PAD = 58;
const CODEX_PANEL_BOTTOM_PAD = 28;

function computeScaledShellLayout(spec: ShellSpec): {
  scale: number;
  shellW: number;
  shellH: number;
  cx: number;
  cy: number;
  ox: number;
  oy: number;
} {
  const W = DESIGN_WIDTH;
  const H = Game.logicHeight;
  const minTop = Game.safeTop + CODEX_PANEL_TOP_PAD;
  const bottom = H - CODEX_PANEL_BOTTOM_PAD;
  const availH = Math.max(300, bottom - minTop);
  const availW = W - 24;
  const scaleByW = availW / spec.W;
  const scaleByH = availH / spec.H;
  const scale = Math.min(scaleByW, scaleByH);
  const shellW = spec.W * scale;
  const shellH = spec.H * scale;
  const cx = W / 2;
  const cy = minTop + availH / 2;
  return { scale, shellW, shellH, cx, cy, ox: cx - shellW / 2, oy: cy - shellH / 2 };
}

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

export class AffinityCodexPanel extends PIXI.Container {
  private _isOpen = false;
  private _assetUnsub: (() => void) | null = null;
  private _view: ViewMode = 'overview';
  private _detailTypeId: string | null = null;
  private _bg!: PIXI.Graphics;
  private _root!: PIXI.Container;
  private _detailLayer: PIXI.Container | null = null;
  private _detailCard: AffinityCardDef | null = null;

  // ── grid 滚动（canvas 级 pointermove，和 QuestPanel 同套路，微信小游戏更稳） ──
  private _gridContent: PIXI.Container | null = null;
  private _gridScrollY = 0;
  private _gridMaxScroll = 0;
  private _gridListening = false;
  private _gridLastY = 0;
  private _gridDownY = 0;
  private _gridMoved = false;
  private static readonly GRID_DRAG_THRESHOLD = 6;

  private readonly _onGridCanvasMove = (ev: PointerEvent): void => {
    if (!this._isOpen || !this._gridListening || !this._gridContent) return;
    const cur = nativeClientToDesignY(ev.clientY);
    if (!this._gridMoved && Math.abs(cur - this._gridDownY) > AffinityCodexPanel.GRID_DRAG_THRESHOLD) {
      this._gridMoved = true;
    }
    const delta = this._gridLastY - cur;
    this._gridLastY = cur;
    if (this._gridMoved) {
      this._gridScrollY = Math.max(
        0,
        Math.min(this._gridMaxScroll, this._gridScrollY + delta),
      );
      this._gridContent.y = -this._gridScrollY;
    }
  };

  private readonly _onGridCanvasUp = (): void => {
    this._finishGridCanvasScroll();
  };

  constructor() {
    super();
    this.zIndex = 8400;
    this.visible = false;

    this._bg = new PIXI.Graphics();
    this.addChild(this._bg);
    this._root = new PIXI.Container();
    this._root.sortableChildren = true;
    this.addChild(this._root);

    EventBus.on('affinityCard:dropped', () => {
      if (this._isOpen) this._refresh();
    });
  }

  get isOpen(): boolean { return this._isOpen; }

  relayout(): void {
    if (!this.visible) return;
    const detailCard = this._detailCard;
    if (this._detailLayer) this._closeCardDetail();
    this._refresh();
    if (detailCard) this._openCardDetail(detailCard);
  }

  /**
   * @param typeId 不传 → 打开赛季总览；传了 → 直接进入该客人的图鉴页
   */
  open(typeId?: string): void {
    if (typeId && this._typeIdHasCards(typeId)) {
      this._view = 'detail';
      this._detailTypeId = typeId;
    } else {
      this._view = 'overview';
      this._detailTypeId = null;
    }
    if (this._isOpen) {
      this._refresh();
      return;
    }
    this._isOpen = true;
    this.visible = true;
    this._assetUnsub = TextureCache.onAssetGroupLoaded('affinity', () => {
      if (this._isOpen) this._refresh();
    });
    this._refresh();
    this.alpha = 0;
    this._root.scale.set(0.92);
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.18, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._root.scale, props: { x: 1, y: 1 }, duration: 0.24, ease: Ease.easeOutBack });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._assetUnsub?.();
    this._assetUnsub = null;
    this._finishGridCanvasScroll();
    if (this._detailLayer) this._closeCardDetail();
    TweenManager.to({
      target: this, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this._root.removeChildren();
      },
    });
  }

  private _backToOverview(): void {
    this._view = 'overview';
    this._detailTypeId = null;
    this._refresh();
  }

  private _enterDetail(typeId: string): void {
    if (!this._typeIdHasCards(typeId)) return;
    this._view = 'detail';
    this._detailTypeId = typeId;
    this._refresh();
  }

  private _typeIdHasCards(typeId: string): boolean {
    return AFFINITY_CARDS.some(c => c.ownerTypeId === typeId);
  }

  private _refresh(): void {
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    // 重建会销毁旧 _gridContent
    this._finishGridCanvasScroll();
    this._gridContent = null;
    this._gridScrollY = 0;
    this._gridMaxScroll = 0;
    this._gridMoved = false;

    this._bg.clear();
    this._bg.beginFill(0x000000, 0.55);
    this._bg.drawRect(0, 0, W, H);
    this._bg.endFill();
    this._bg.eventMode = 'static';
    this._bg.removeAllListeners();
    this._bg.on('pointerdown', () => {
      if (this._detailLayer) { this._closeCardDetail(); return; }
      if (this._view === 'detail') { this._backToOverview(); return; }
      this.close();
    });

    this._root.removeChildren();
    if (this._view === 'overview') {
      this._buildOverviewScreen();
    } else {
      this._buildDetailScreen();
    }
  }

  private _buildOverviewScreen(): void {
    const layout = computeScaledShellLayout(OVERVIEW_SHELL);
    const sxFrac = (frac: number) => layout.ox + frac * layout.shellW;
    const syFrac = (frac: number) => layout.oy + frac * layout.shellH;
    const ptFrac = (xf: number, yf: number): PIXI.Point =>
      new PIXI.Point(sxFrac(xf), syFrac(yf));
    const ptPx = (px: number, py: number): PIXI.Point =>
      new PIXI.Point(layout.ox + px * layout.scale, layout.oy + py * layout.scale);

    const shellTex = TextureCache.get('affinity_codex_overview_shell_nb2');
    if (shellTex && shellTex.width > 0) {
      const sp = new PIXI.Sprite(shellTex);
      sp.anchor.set(0.5);
      sp.position.set(layout.cx, layout.cy);
      sp.scale.set(layout.scale);
      this._root.addChild(sp);
    } else {
      this._addFallbackShell(layout);
    }

    const title = new PIXI.Text(`友谊图鉴 · ${CURRENT_SEASON.tag}`, {
      fontSize: Math.max(28, Math.round(34 * layout.scale)),
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: '900',
      stroke: 0xc46848,
      strokeThickness: 5,
    } as PIXI.TextStyle);
    title.anchor.set(0.5);
    title.position.copyFrom(ptFrac(0.5, OVERVIEW_LAYOUT.TITLE_Y_FRAC));
    title.position.y += OVERVIEW_LAYOUT.TITLE_Y_NUDGE_PX * layout.scale;
    this._root.addChild(title);

    this._addCloseHit(
      ptPx(OVERVIEW_LAYOUT.CLOSE_CX_PX, OVERVIEW_LAYOUT.CLOSE_CY_PX),
      OVERVIEW_LAYOUT.CLOSE_HIT_R_PX * layout.scale,
    );

    const bannerW = OVERVIEW_LAYOUT.BANNER_W_FRAC * layout.shellW;
    const bannerH = OVERVIEW_LAYOUT.BANNER_H_FRAC * layout.shellH;
    const banner = this._buildOverviewRewardBlock(bannerW, bannerH);
    banner.position.copyFrom(ptFrac(OVERVIEW_LAYOUT.BANNER_X_FRAC, OVERVIEW_LAYOUT.BANNER_Y_FRAC));
    this._root.addChild(banner);

    const circleSize = OVERVIEW_LAYOUT.CIRCLE_SIZE_FRAC * layout.shellW;
    for (let i = 0; i < SEASON_TYPE_IDS.length; i++) {
      const typeId = SEASON_TYPE_IDS[i]!;
      const entry = this._buildOverviewNode(typeId, circleSize);
      entry.position.set(
        sxFrac(OVERVIEW_LAYOUT.CIRCLE_CX_FRAC[i]!),
        syFrac(OVERVIEW_LAYOUT.CIRCLE_CY_FRAC),
      );
      this._root.addChild(entry);
    }

    if (CURRENT_SEASON.tagline) {
      const tagline = new PIXI.Text(CURRENT_SEASON.tagline, {
        fontSize: Math.max(13, Math.round(15 * layout.scale)),
        fill: 0x9a6d45,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: layout.shellW * 0.82,
        breakWords: true,
        align: 'center',
      } as PIXI.TextStyle);
      tagline.anchor.set(0.5);
      tagline.position.copyFrom(ptFrac(0.5, OVERVIEW_LAYOUT.BOTTOM_HINT_Y_FRAC));
      this._root.addChild(tagline);
    }
  }

  private _totalSeasonProgress(): { obtained: number; total: number } {
    let obtained = 0, total = 0;
    for (const tid of SEASON_TYPE_IDS) {
      const p = AffinityCardManager.progress(tid);
      obtained += p.obtained;
      total += p.total;
    }
    return { obtained, total };
  }

  /** 总览奖励区：直接绘制在壳体 inset 上，不再贴 banner 小图 */
  private _buildOverviewRewardBlock(width: number, height: number): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'none';
    const padX = Math.max(8, Math.round(width * 0.04));
    const innerW = width - padX * 2;

    const head = new PIXI.Text('完成全图鉴可赢取：', {
      fontSize: Math.max(16, Math.round(width * 0.042)),
      fill: 0xa15b3d,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    head.anchor.set(0.5, 0);
    const headY = Math.round(height * 0.08);
    head.position.set(width / 2, headY);
    c.addChild(head);

    const iconDisp = Math.min(68, Math.max(50, Math.round(width * 0.19)));
    const rewardGap = Math.max(22, Math.round(width * 0.05));
    const rewards = this._grandRewardChipList(CURRENT_SEASON.grandReward);
    const rewardRow = this._buildDetailRewardIconRow(rewards, innerW, iconDisp, rewardGap);

    const total = this._totalSeasonProgress();
    const progW = Math.min(innerW, Math.round(width * 0.88));
    const prog = this._buildOverviewProgressPill(progW, total.obtained, total.total);
    const progY = Math.round(height * 0.74);
    prog.position.set(Math.round((width - progW) / 2), progY);
    c.addChild(prog);

    const midTop = headY + head.height + Math.round(height * 0.05);
    const midBottom = progY - Math.round(height * 0.02);
    rewardRow.position.set(
      Math.round((width - rewardRow.width) / 2),
      Math.round((midTop + midBottom - rewardRow.height) / 2),
    );
    c.addChild(rewardRow);

    return c;
  }

  private _beginGridCanvasScroll(e: PIXI.FederatedPointerEvent): void {
    if (!this._isOpen || !this._gridContent || this._gridListening) return;
    if (this._gridMaxScroll <= 0) return;
    this._gridListening = true;
    this._gridMoved = false;
    this._gridScrollY = -this._gridContent.y;
    this._gridDownY = this._gridLastY = federatedPointerToDesignY(e);
    this._gridContent.cursor = 'grabbing';
    e.stopPropagation();
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.addEventListener) {
      canvas.addEventListener('pointermove', this._onGridCanvasMove);
      canvas.addEventListener('pointerup', this._onGridCanvasUp);
      canvas.addEventListener('pointercancel', this._onGridCanvasUp);
    }
  }

  private _finishGridCanvasScroll(): void {
    if (!this._gridListening) return;
    const canvas = Game.app.view as unknown as HTMLCanvasElement | undefined;
    if (canvas?.removeEventListener) {
      canvas.removeEventListener('pointermove', this._onGridCanvasMove);
      canvas.removeEventListener('pointerup', this._onGridCanvasUp);
      canvas.removeEventListener('pointercancel', this._onGridCanvasUp);
    }
    this._gridListening = false;
    if (this._gridContent) this._gridContent.cursor = 'grab';
  }

  private _buildOverviewNode(typeId: string, size: number): PIXI.Container {
    const c = new PIXI.Container();
    const enabled = this._typeIdHasCards(typeId);
    const p = AffinityCardManager.progress(typeId);
    const cm = AFFINITY_MAP.get(typeId);
    const name = cm?.bondName ?? typeId;
    const portrait = this._buildPortraitDisc(typeId, size, enabled);
    c.addChild(portrait);

    const nameText = new PIXI.Text(name, {
      fontSize: Math.round(size * 0.16),
      fill: enabled ? 0x8d5a27 : 0x979797,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfffcf3,
      strokeThickness: 4,
    } as PIXI.TextStyle);
    nameText.anchor.set(0.5, 0);
    nameText.position.set(0, size * 0.64);
    c.addChild(nameText);

    const pill = this._buildPurpleProgressPill(size * 0.86, p.obtained, p.total);
    pill.position.set(-pill.width / 2, size * 0.92);
    c.addChild(pill);

    if (enabled) {
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._enterDetail(typeId);
      });
    }
    return c;
  }

  private _buildDetailScreen(): void {
    const typeId = this._detailTypeId;
    if (!typeId) { this._backToOverview(); return; }
    const layout = computeScaledShellLayout(DETAIL_SHELL);
    const sxFrac = (frac: number) => layout.ox + frac * layout.shellW;
    const syFrac = (frac: number) => layout.oy + frac * layout.shellH;
    const ptFrac = (xf: number, yf: number): PIXI.Point =>
      new PIXI.Point(sxFrac(xf), syFrac(yf));
    const ptPx = (px: number, py: number): PIXI.Point =>
      new PIXI.Point(layout.ox + px * layout.scale, layout.oy + py * layout.scale);

    const shellTex = TextureCache.get('affinity_codex_detail_shell_nb2');
    if (shellTex && shellTex.width > 0) {
      const sp = new PIXI.Sprite(shellTex);
      sp.anchor.set(0.5);
      sp.position.set(layout.cx, layout.cy);
      sp.scale.set(layout.scale);
      sp.eventMode = 'none';
      this._root.addChild(sp);
    } else {
      this._addFallbackShell(layout);
    }

    const titleStr = AFFINITY_MAP.get(typeId)?.bondName ?? '友谊图鉴';
    const title = new PIXI.Text(titleStr, {
      fontSize: Math.max(26, Math.round(32 * layout.scale)),
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: '900',
      stroke: 0xc46848,
      strokeThickness: 5,
    } as PIXI.TextStyle);
    title.anchor.set(0.5);
    title.eventMode = 'none';
    title.position.copyFrom(ptFrac(0.5, DETAIL_LAYOUT.TITLE_Y_FRAC));
    title.position.y += DETAIL_LAYOUT.TITLE_Y_NUDGE_PX * layout.scale;
    this._root.addChild(title);

    const infoW = DETAIL_LAYOUT.INFO_W_FRAC * layout.shellW;
    const infoH = DETAIL_LAYOUT.INFO_H_FRAC * layout.shellH;
    const info = this._buildDetailInfoBlock(typeId, infoW, infoH);
    info.position.copyFrom(ptFrac(DETAIL_LAYOUT.INFO_X_FRAC, DETAIL_LAYOUT.INFO_Y_FRAC));
    this._root.addChild(info);

    const gridOuterW = DETAIL_LAYOUT.GRID_W_FRAC * layout.shellW;
    const gridOuterH = DETAIL_LAYOUT.GRID_H_FRAC * layout.shellH;
    const gridPadX = DETAIL_LAYOUT.GRID_INSET_X_PX * layout.scale;
    const gridPadY = DETAIL_LAYOUT.GRID_INSET_Y_PX * layout.scale;
    const grid = this._buildGrid(
      Math.max(120, gridOuterW - gridPadX * 2),
      Math.max(100, gridOuterH - gridPadY * 2),
      typeId,
    );
    grid.position.set(
      sxFrac(DETAIL_LAYOUT.GRID_X_FRAC) + gridPadX,
      syFrac(DETAIL_LAYOUT.GRID_Y_FRAC) + gridPadY,
    );
    this._root.addChild(grid);

    const idx = SEASON_TYPE_IDS.indexOf(typeId);
    if (idx >= 0 && SEASON_TYPE_IDS.length > 1) {
      const prev = SEASON_TYPE_IDS[(idx - 1 + SEASON_TYPE_IDS.length) % SEASON_TYPE_IDS.length]!;
      const next = SEASON_TYPE_IDS[(idx + 1) % SEASON_TYPE_IDS.length]!;
      const leftArrow = this._buildPageArrow('left', prev);
      const rightArrow = this._buildPageArrow('right', next);
      leftArrow.position.set(
        layout.ox + DETAIL_LAYOUT.ARROW_INSET_X_PX * layout.scale,
        syFrac(DETAIL_LAYOUT.ARROW_Y_FRAC),
      );
      rightArrow.position.set(
        layout.ox + layout.shellW - DETAIL_LAYOUT.ARROW_INSET_X_PX * layout.scale,
        syFrac(DETAIL_LAYOUT.ARROW_Y_FRAC),
      );
      this._root.addChild(leftArrow);
      this._root.addChild(rightArrow);
    }

    // 顶栏热区最后添加，避免被内容层遮挡
    this._addCloseHit(
      ptPx(DETAIL_LAYOUT.CLOSE_CX_PX, DETAIL_LAYOUT.CLOSE_CY_PX),
      DETAIL_LAYOUT.CLOSE_HIT_R_PX * layout.scale,
    );
    this._addBackHitArea(
      ptPx(DETAIL_LAYOUT.BACK_CX_PX, DETAIL_LAYOUT.BACK_CY_PX),
      DETAIL_LAYOUT.BACK_HIT_W_PX * layout.scale,
      DETAIL_LAYOUT.BACK_HIT_H_PX * layout.scale,
    );
  }

  private _milestoneChipList(m: { reward: CardReward; decoUnlockId?: string }): RewardChip[] {
    const list: RewardChip[] = this._cardRewardToChips(m.reward);
    if (m.decoUnlockId) {
      const deco = TextureCache.get(m.decoUnlockId);
      list.push({ icon: deco && deco.width > 0 ? m.decoUnlockId : '', label: '专属家具', kind: 'deco' });
    }
    return list;
  }

  private _grandRewardChipList(g: SeasonGrand): RewardChip[] {
    const list: RewardChip[] = this._cardRewardToChips(g);
    if (g.decoUnlockId) {
      const deco = TextureCache.get(g.decoUnlockId);
      list.push({ icon: deco && deco.width > 0 ? g.decoUnlockId : '', label: '专属家具', kind: 'deco' });
    }
    return list;
  }

  private _cardRewardToChips(r: CardReward): RewardChip[] {
    const out: RewardChip[] = [];
    if (r.huayuan)            out.push({ icon: 'icon_huayuan',          label: `${r.huayuan}`,           kind: 'huayuan' });
    if (r.diamond)            out.push({ icon: 'icon_gem',              label: `${r.diamond}`,           kind: 'diamond' });
    if (r.stamina)            out.push({ icon: 'icon_energy',           label: `${r.stamina}`,           kind: 'stamina' });
    if (r.flowerSignTickets)  out.push({ icon: 'icon_flower_sign_coin', label: `${r.flowerSignTickets}`, kind: 'ticket' });
    return out;
  }

  /** 详情 info 区：直接绘制在壳体 inset 上，不再贴 header 小图 */
  private _buildDetailInfoBlock(typeId: string, width: number, height: number): PIXI.Container {
    const c = new PIXI.Container();
    c.eventMode = 'none';
    const padX = Math.max(6, Math.round(width * 0.03));
    const topPad = Math.round(height * 0.08);
    const rewardTop = topPad;

    const portraitD = Math.min(height * 0.46, width * 0.26);
    const portraitCy = topPad + portraitD / 2 + 6;
    const portrait = this._buildHeaderPortrait(typeId, portraitD);
    portrait.position.set(padX + portraitD / 2, portraitCy);
    c.addChild(portrait);

    const p = AffinityCardManager.progress(typeId);
    const progW = Math.round(portraitD * 0.9);
    const progH = Math.max(15, Math.round(height * 0.085));
    const progress = this._buildPurpleProgressPill(progW, p.obtained, p.total, progH);
    progress.position.set(
      padX + Math.round((portraitD - progW) / 2),
      topPad + portraitD + Math.round(height * 0.035),
    );
    c.addChild(progress);

    const rewardLeft = padX + portraitD + Math.round(width * 0.045);
    const rewardW = width - rewardLeft - padX;

    const head = new PIXI.Text('完成该系列以赢得：', {
      fontSize: Math.max(14, Math.round(width * 0.038)),
      fill: 0xa25d45,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    head.anchor.set(0, 0);
    head.position.set(rewardLeft, rewardTop);
    c.addChild(head);

    const milestones = getCustomerMilestones(typeId);
    const fullMilestone = milestones[milestones.length - 1];
    const iconDisp = Math.min(
      76,
      Math.max(54, Math.round(Math.min(rewardW * 0.27, height * 0.38))),
    );
    const rewardGap = Math.max(16, Math.round(width * 0.042));

    if (fullMilestone) {
      const chips = this._milestoneChipList(fullMilestone);
      const row = this._buildDetailRewardIconRow(chips, rewardW, iconDisp, rewardGap);
      row.position.set(rewardLeft, head.y + head.height + Math.round(height * 0.05));
      c.addChild(row);

      if (fullMilestone.permanentHuayuanMult && fullMilestone.permanentHuayuanMult > 1) {
        const bonusChip = this._buildPermanentHuayuanBonusChip(
          fullMilestone.permanentHuayuanMult,
          AffinityCardManager.huayuanMultFor(typeId) > 1,
          rewardW,
        );
        bonusChip.position.set(rewardLeft, row.y + row.height + Math.round(height * 0.055));
        c.addChild(bonusChip);
      }
    }

    return c;
  }

  private _buildPageArrow(dir: 'left' | 'right', toTypeId: string): PIXI.Container {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    g.beginFill(0xffd257, 0.98);
    g.lineStyle(2, 0xd28d20, 1);
    g.drawRoundedRect(-20, -28, 40, 56, 20);
    g.endFill();
    c.addChild(g);
    c.addChild(this._buildDrawnArrowIcon(dir, 22, 0x8a541e, 0xfff0bb));
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._enterDetail(toTypeId);
    });
    return c;
  }

  private _addFallbackShell(layout: {
    shellW: number; shellH: number; ox: number; oy: number;
  }): void {
    const fb = new PIXI.Graphics();
    fb.beginFill(0xfff4de, 1);
    fb.lineStyle(4, 0xe6b96b, 1);
    fb.drawRoundedRect(layout.ox, layout.oy, layout.shellW, layout.shellH, 28);
    fb.endFill();
    this._root.addChild(fb);
  }

  private _addCloseHit(center: PIXI.Point, r: number): void {
    const hit = new PIXI.Graphics();
    hit.beginFill(0xffffff, 0.001);
    hit.drawCircle(0, 0, r + 6);
    hit.endFill();
    hit.position.copyFrom(center);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.zIndex = 20;
    hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    hit.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._root.addChild(hit);
  }

  /** 壳体已烘焙「返回」视觉，此处仅透明热区 */
  private _addBackHitArea(center: PIXI.Point, w: number, h: number): void {
    const hit = new PIXI.Graphics();
    hit.beginFill(0xffffff, 0.001);
    hit.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    hit.endFill();
    hit.position.copyFrom(center);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.zIndex = 20;
    const onBack = (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._backToOverview();
    };
    hit.on('pointerdown', onBack);
    hit.on('pointertap', onBack);
    this._root.addChild(hit);
  }

  private _buildDrawnArrowIcon(
    dir: 'left' | 'right',
    size: number,
    fill: number,
    outline: number,
  ): PIXI.Container {
    const c = new PIXI.Container();
    const sign = dir === 'left' ? -1 : 1;
    const headH = size * 0.42;
    const shaftH = size * 0.22;
    const tipX = sign * size * 0.42;
    const neckX = -sign * size * 0.02;
    const tailX = -sign * size * 0.42;

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x7a3f16, 0.18);
    shadow.drawRoundedRect(
      Math.min(neckX, tailX),
      -shaftH / 2 + size * 0.08,
      Math.abs(tailX - neckX),
      shaftH,
      shaftH / 2,
    );
    shadow.drawPolygon([
      tipX,
      size * 0.08,
      neckX,
      -headH + size * 0.08,
      neckX,
      headH + size * 0.08,
    ]);
    shadow.endFill();
    c.addChild(shadow);

    const icon = new PIXI.Graphics();
    icon.lineStyle(Math.max(2, Math.round(size * 0.08)), outline, 0.95);
    icon.beginFill(fill, 1);
    icon.drawRoundedRect(
      Math.min(neckX, tailX),
      -shaftH / 2,
      Math.abs(tailX - neckX),
      shaftH,
      shaftH / 2,
    );
    icon.drawPolygon([
      tipX,
      0,
      neckX,
      -headH,
      neckX,
      headH,
    ]);
    icon.endFill();
    c.addChild(icon);

    return c;
  }

  private _buildPortraitDisc(typeId: string, size: number, enabled: boolean): PIXI.Container {
    const c = new PIXI.Container();
    const ring = new PIXI.Graphics();
    ring.beginFill(enabled ? 0xfff9ee : 0xf0f0f0, enabled ? 0.01 : 0.3);
    ring.lineStyle(2, enabled ? 0xe6bb7d : 0xc6c6c6, 0.7);
    ring.drawCircle(0, 0, size / 2);
    ring.endFill();
    c.addChild(ring);

    const tex = TextureCache.get(`customer_${typeId}`);
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5, 0.18);
      const target = size * 1.06;
      const k = target / Math.max(tex.width, tex.height);
      sp.scale.set(k);
      sp.position.set(size * 0.04, -size * 0.07 - 15);
      sp.alpha = enabled ? 1 : 0.45;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff);
      mask.drawCircle(0, 0, size / 2 - 4);
      mask.endFill();
      c.addChild(mask);
      sp.mask = mask;
      c.addChild(sp);
    }
    return c;
  }

  private _buildHeaderPortrait(typeId: string, size: number): PIXI.Container {
    const c = new PIXI.Container();
    const tex = TextureCache.get(`customer_${typeId}`);
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5, 0.18);
      const target = size * 1.04;
      const k = target / Math.max(tex.width, tex.height);
      sp.scale.set(k);
      sp.position.set(size * 0.045, -size * 0.07 - 15);
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff);
      mask.drawCircle(0, 0, size / 2 - 5);
      mask.endFill();
      c.addChild(mask);
      sp.mask = mask;
      c.addChild(sp);
    }
    return c;
  }

  private _buildPurpleProgressPill(
    width: number,
    cur: number,
    total: number,
    heightPx?: number,
  ): PIXI.Container {
    const c = new PIXI.Container();
    const H = heightPx ?? Math.max(20, Math.round(width * 0.075));
    const ratio = total > 0 ? Math.max(0, Math.min(1, cur / total)) : 0;

    const track = new PIXI.Graphics();
    track.beginFill(0x9a4d7b, 1);
    track.lineStyle(2, 0xffffff, 0.72);
    track.drawRoundedRect(0, 0, width, H, H / 2);
    track.endFill();
    c.addChild(track);

    if (ratio > 0) {
      const fillW = Math.max(H, Math.floor(width * ratio));
      const fill = new PIXI.Graphics();
      fill.beginFill(0x72df49, 1);
      fill.lineStyle(1.5, 0xffffff, 0.45);
      fill.drawRoundedRect(2, 2, fillW - 4, H - 4, (H - 4) / 2);
      fill.endFill();
      c.addChild(fill);
    }

    const text = new PIXI.Text(`${cur}/${total}`, {
      fontSize: Math.max(10, Math.round(H * 0.62)),
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x7a3f61,
      strokeThickness: 3,
    } as PIXI.TextStyle);
    text.anchor.set(0.5);
    text.position.set(width / 2, H / 2);
    c.addChild(text);
    return c;
  }

  private _buildOverviewProgressPill(width: number, cur: number, total: number): PIXI.Container {
    const c = new PIXI.Container();
    const H = Math.max(30, Math.round(width * 0.094));
    const ratio = total > 0 ? Math.max(0, Math.min(1, cur / total)) : 0;

    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x6d3d62, 0.14);
    shadow.drawRoundedRect(0, 2, width, H, H / 2);
    shadow.endFill();
    c.addChild(shadow);

    const track = new PIXI.Graphics();
    track.beginFill(0x9a4d7b, 1);
    track.lineStyle(2.5, 0xfff7ea, 0.92);
    track.drawRoundedRect(0, 0, width, H, H / 2);
    track.endFill();
    c.addChild(track);

    if (ratio > 0) {
      const fillW = Math.max(H, Math.floor(width * ratio));
      const fill = new PIXI.Graphics();
      fill.beginFill(0x6ce04d, 1);
      fill.lineStyle(2, 0xffffff, 0.55);
      fill.drawRoundedRect(3, 3, Math.max(0, fillW - 6), H - 6, (H - 6) / 2);
      fill.endFill();
      c.addChild(fill);
    }

    const text = new PIXI.Text(`${cur}/${total}`, {
      fontSize: Math.max(15, Math.round(H * 0.56)),
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x7a3f61,
      strokeThickness: 4,
    } as PIXI.TextStyle);
    text.anchor.set(0.5);
    text.position.set(width / 2, H / 2);
    c.addChild(text);
    return c;
  }

  private _buildRewardChipsRow(chips: RewardChip[], maxWidth: number): PIXI.Container {
    const c = new PIXI.Container();
    const gap = 8;
    let x = 0;
    for (const chip of chips) {
      const view = this._buildRewardChip(chip);
      view.position.set(x, 0);
      c.addChild(view);
      x += view.width + gap;
      if (x > maxWidth - 20) break;
    }
    return c;
  }

  private _buildDetailRewardIconRow(
    chips: RewardChip[], maxWidth: number, iconDisp: number, minGap = 8,
  ): PIXI.Container {
    const c = new PIXI.Container();
    const gap = Math.max(minGap, Math.round(iconDisp * 0.12));
    let x = 0;
    for (const chip of chips) {
      const item = this._buildDetailRewardIconItem(chip, iconDisp);
      if (x > 0 && x + item.width > maxWidth) break;
      item.position.set(x, 0);
      c.addChild(item);
      x += item.width + gap;
    }
    return c;
  }

  private _buildDetailRewardIconItem(chip: RewardChip, iconDisp: number): PIXI.Container {
    const c = new PIXI.Container();
    const labelText = chip.kind === 'deco' ? '专属家具' : chip.label;
    const label = new PIXI.Text(labelText, {
      fontSize: Math.max(12, Math.round(iconDisp * 0.24)),
      fill: 0x8c5a33,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfff6e8,
      strokeThickness: Math.max(2, Math.round(iconDisp * 0.04)),
      align: 'center',
    } as PIXI.TextStyle);
    const itemW = Math.max(iconDisp, Math.ceil(label.width));
    const iconLeft = (itemW - iconDisp) / 2;
    const iconWrap = new PIXI.Container();
    iconWrap.position.set(iconLeft, 0);
    c.addChild(iconWrap);

    const tex = TextureCache.get(chip.icon);
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const k = iconDisp / Math.max(tex.width, tex.height);
      sp.scale.set(k);
      sp.position.set(iconDisp / 2, iconDisp / 2);
      iconWrap.addChild(sp);
    } else {
      const fallback = new PIXI.Graphics();
      const fallbackColor =
        chip.kind === 'huayuan' ? 0x7ed957 :
        chip.kind === 'diamond' ? 0xff8ac9 :
        chip.kind === 'stamina' ? 0xffb84d :
        chip.kind === 'ticket' ? 0xa78bfa :
        chip.kind === 'deco' ? 0xc88a3e : 0xc0c0c0;
      fallback.beginFill(fallbackColor, 1);
      fallback.drawRoundedRect(0, 0, iconDisp, iconDisp, Math.max(10, iconDisp * 0.22));
      fallback.endFill();
      iconWrap.addChild(fallback);
    }

    label.anchor.set(0.5, 0);
    label.position.set(itemW / 2, iconDisp + Math.max(3, Math.round(iconDisp * 0.08)));
    c.addChild(label);
    return c;
  }

  /** 永久花愿加成 — 单行胶囊 */
  private _buildPermanentHuayuanBonusChip(
    mult: number,
    active: boolean,
    maxWidth: number,
  ): PIXI.Container {
    const c = new PIXI.Container();
    const pct = Math.round((mult - 1) * 100);
    const H = Math.max(32, Math.round(maxWidth * 0.115));
    const padX = 10;
    const iconSize = Math.round(H * 0.7);
    const gap = 7;

    const label = new PIXI.Text(`永久订单花愿 +${pct}%`, {
      fontSize: Math.max(12, Math.round(H * 0.4)),
      fill: active ? 0x8a4a18 : 0x9a8878,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: active ? 0xfff8e8 : 0xfff6ef,
      strokeThickness: Math.max(2, Math.round(H * 0.05)),
    } as PIXI.TextStyle);
    label.anchor.set(0, 0.5);

    const innerW = iconSize + gap + label.width;
    const W = Math.min(maxWidth, innerW + padX * 2);

    const bg = new PIXI.Graphics();
    bg.beginFill(active ? 0xfff4d6 : 0xf8efe6, 1);
    bg.lineStyle(2, active ? 0xf0b84a : 0xd8c4a8, 1);
    bg.drawRoundedRect(0, 0, W, H, H / 2);
    bg.endFill();
    if (active) {
      bg.beginFill(0xffffff, 0.32);
      bg.drawRoundedRect(2, 2, W - 4, Math.max(6, Math.round(H * 0.34)), Math.max(3, H / 2 - 2));
      bg.endFill();
    }
    c.addChild(bg);

    const iconWrap = new PIXI.Container();
    iconWrap.position.set(padX, (H - iconSize) / 2);
    c.addChild(iconWrap);
    const tex = TextureCache.get('icon_huayuan');
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const k = iconSize / Math.max(tex.width, tex.height);
      sp.scale.set(k);
      sp.position.set(iconSize / 2, iconSize / 2);
      iconWrap.addChild(sp);
    } else {
      const fb = new PIXI.Graphics();
      fb.beginFill(0x7ed957, 1);
      fb.drawRoundedRect(0, 0, iconSize, iconSize, iconSize * 0.22);
      fb.endFill();
      iconWrap.addChild(fb);
    }

    label.position.set(padX + iconSize + gap, H / 2);
    c.addChild(label);

    if (active) {
      const star = new PIXI.Text('★', {
        fontSize: Math.max(9, Math.round(H * 0.24)),
        fill: 0xffd257,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as PIXI.TextStyle);
      star.anchor.set(1, 0);
      star.position.set(W - 5, 2);
      c.addChild(star);
    }

    return c;
  }

  private _buildRewardChip(chip: RewardChip): PIXI.Container {
    const c = new PIXI.Container();
    const H = 26;
    const padX = 7;
    const iconSize = 16;

    const labelText = new PIXI.Text(chip.label, {
      fontSize: 11, fill: 0x4a2f10, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    } as PIXI.TextStyle);
    const W = padX + iconSize + 4 + Math.ceil(labelText.width) + padX;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xfff8e7, 1);
    bg.lineStyle(1.5, 0xd9c08a, 1);
    bg.drawRoundedRect(0, 0, W, H, H / 2);
    bg.endFill();
    c.addChild(bg);

    const tex = TextureCache.get(chip.icon);
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0, 0.5);
      const k = iconSize / Math.max(tex.width, tex.height);
      sp.scale.set(k);
      sp.position.set(padX, H / 2);
      c.addChild(sp);
    } else {
      const circ = new PIXI.Graphics();
      const fallbackColor =
        chip.kind === 'huayuan' ? 0x7ed957 :
        chip.kind === 'diamond' ? 0xff8ac9 :
        chip.kind === 'stamina' ? 0xffb84d :
        chip.kind === 'ticket'  ? 0xa78bfa :
        chip.kind === 'deco'    ? 0xc88a3e :
        chip.kind === 'title'   ? 0x6c8eef : 0xc0c0c0;
      circ.beginFill(fallbackColor, 1);
      circ.drawCircle(padX + iconSize / 2, H / 2, iconSize / 2);
      circ.endFill();
      c.addChild(circ);
    }

    labelText.position.set(padX + iconSize + 4, (H - labelText.height) / 2);
    c.addChild(labelText);
    return c;
  }

  private _fmtRemain(ms: number): string {
    const totalMin = Math.floor(ms / 60000);
    const days = Math.floor(totalMin / (60 * 24));
    if (days >= 2) return `${days} 天`;
    const hours = Math.floor(totalMin / 60);
    if (hours >= 2) return `${hours} 时`;
    const mins = totalMin % 60;
    return `${hours}时${mins.toString().padStart(2, '0')}分`;
  }

  /**
   * 2 列 × N 行网格，每格用方形 art 主视觉（thumb），垂直拖拽滚动。
   *
   * 滚动实现要点（PIXI v7）：
   *  - 视口（wrap）开 `eventMode='static'` + 全覆盖 hitArea，保证手指按在卡片间隙也能拖动。
   *  - 用 `globalpointermove` 而非 `pointermove`：手指拖出网格区域仍能继续收到事件，避免半路掉线。
   *  - thumb 自身仍可 `pointertap` 打开详情；通过阈值 `_gridMoved` 区分"点击 vs 拖动"。
   */
  private _buildGrid(width: number, height: number, typeId: string): PIXI.Container {
    const wrap = new PIXI.Container();
    const cards = AffinityCardManager.listCards(typeId);
    const COLS = 2;
    const COL_GAP = 18;
    const ROW_GAP = 22;
    const cellW = Math.floor((width - COL_GAP * (COLS - 1)) / COLS);
    const cellH = thumbHeightFor(cellW);

    const totalRows = Math.ceil(cards.length / COLS);
    const innerH = totalRows * cellH + Math.max(0, totalRows - 1) * ROW_GAP;
    const visibleH = Math.max(60, height);
    const maxScroll = Math.max(0, innerH - visibleH);

    // 滚动 mask（仅约束可视范围）
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRect(0, 0, width, visibleH);
    mask.endFill();
    wrap.addChild(mask);

    // 外层仅负责 mask；真正监听 pointerdown 的是 scrollContent（与 QuestPanel 一致）
    const scrollOuter = new PIXI.Container();
    scrollOuter.mask = mask;
    wrap.addChild(scrollOuter);

    const scrollContent = new PIXI.Container();
    scrollContent.eventMode = 'static';
    scrollContent.cursor = maxScroll > 0 ? 'grab' : 'default';
    scrollOuter.addChild(scrollContent);

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]!;
      const r = Math.floor(i / COLS);
      const col = i % COLS;
      const thumb = buildAffinityCardThumb(card, cellW);
      thumb.position.set(col * (cellW + COL_GAP), r * (cellH + ROW_GAP));
      thumb.eventMode = 'static';
      thumb.cursor = card.obtained ? 'pointer' : 'default';
      if (card.obtained) {
        thumb.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
          // 拖动产生的 tap 不应触发详情（globalpointermove 里会设置 _gridMoved）
          if (this._gridMoved) {
            e.stopImmediatePropagation();
            return;
          }
          e.stopPropagation();
          this._openCardDetail(card);
        });
      }
      scrollContent.addChild(thumb);
    }

    this._gridContent = scrollContent;
    this._gridScrollY = 0;
    this._gridMaxScroll = maxScroll;
    scrollContent.y = 0;

    if (maxScroll > 0) {
      scrollContent.hitArea = new PIXI.Rectangle(0, 0, width, Math.max(visibleH, innerH));
      scrollContent.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        this._beginGridCanvasScroll(e);
      });

      // 底部"还可下滑"提示小条
      const hintBar = new PIXI.Graphics();
      hintBar.beginFill(0x000000, 0.18);
      hintBar.drawRoundedRect(width / 2 - 22, visibleH - 8, 44, 4, 2);
      hintBar.endFill();
      wrap.addChild(hintBar);
    }

    return wrap;
  }

  // ============================================================
  // 卡片放大查看
  // ============================================================

  private _computeCodexCardDetailLayout(): {
    scale: number; cx: number; cy: number; cardW: number; cardH: number;
    hintY: number;
  } {
    const layout = computeScaledShellLayout(DETAIL_SHELL);
    const marginX = layout.shellW * 0.035;
    const availW = layout.shellW - marginX * 2;

    // 从 info 区中部到底部（进度条已移至头像下，右侧奖励可占满高度）
    const cardZoneTop = layout.oy + layout.shellH * (
      DETAIL_LAYOUT.INFO_Y_FRAC + DETAIL_LAYOUT.INFO_H_FRAC * 0.62
    );
    const cardZoneBottom = layout.oy + layout.shellH * (
      DETAIL_LAYOUT.GRID_Y_FRAC + DETAIL_LAYOUT.GRID_H_FRAC - 0.012
    );
    const hintReserve = 36;
    const availH = Math.max(140, cardZoneBottom - cardZoneTop - hintReserve);

    const scale = Math.min(availW / LARGE_CARD_W, availH / LARGE_CARD_H, 2.28);
    const cardW = LARGE_CARD_W * scale;
    const cardH = LARGE_CARD_H * scale;
    const cx = layout.cx;
    const cy = cardZoneTop + availH / 2;
    const hintY = cardZoneTop + availH + Math.max(14, hintReserve * 0.55);

    return { scale, cx, cy, cardW, cardH, hintY };
  }

  private _openCardDetail(card: AffinityCardDef): void {
    if (this._detailLayer) {
      this._detailLayer.destroy({ children: true });
      this._detailLayer = null;
    }
    this._detailCard = card;
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;
    const layer = new PIXI.Container();
    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.7);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    dim.on('pointertap', () => this._closeCardDetail());
    layer.addChild(dim);

    // 拥有数：找出该卡的当前重复数
    const owned = AffinityCardManager.listCards(card.ownerTypeId)
      .find(e => e.id === card.id);
    const ownedCount = owned && owned.obtained ? (owned.dupCount + 1) : 1;

    const front = buildLargeAffinityCardFront(card, {
      mode: 'codex',
      ownedCount,
    });
    const cardLayout = this._computeCodexCardDetailLayout();
    front.scale.set(cardLayout.scale);
    front.position.set(
      cardLayout.cx - cardLayout.cardW / 2,
      cardLayout.cy - cardLayout.cardH / 2,
    );
    layer.addChild(front);

    const hint = new PIXI.Text('点击空白处关闭', {
      fontSize: Math.max(18, Math.round(16 + cardLayout.scale * 5)),
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x3a2030,
      strokeThickness: 4,
    } as PIXI.TextStyle);
    hint.anchor.set(0.5);
    hint.position.set(cardLayout.cx, cardLayout.hintY);
    layer.addChild(hint);

    layer.zIndex = 9999;
    this._detailLayer = layer;
    this.addChild(layer);
  }

  private _closeCardDetail(): void {
    if (!this._detailLayer) return;
    this._detailLayer.destroy({ children: true });
    this._detailLayer = null;
    this._detailCard = null;
  }
}

interface RewardChip {
  icon: string;
  label: string;
  kind: 'huayuan' | 'diamond' | 'stamina' | 'ticket' | 'deco';
}

interface SeasonGrand extends CardReward {
  decoUnlockId?: string;
}
