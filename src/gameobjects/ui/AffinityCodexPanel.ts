import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';
import { AffinityCardManager } from '@/managers/AffinityCardManager';
import { AffinityManager } from '@/managers/AffinityManager';
import {
  AFFINITY_CARDS,
  CURRENT_SEASON,
  getCustomerMilestones,
  type AffinityCardDef,
  type CardReward,
} from '@/config/AffinityCardConfig';
import { AFFINITY_MAP, AFFINITY_UNLOCK_LEVELS } from '@/config/AffinityConfig';
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

const OVERVIEW_SHELL: ShellSpec = { W: 761, H: 1343 };
const DETAIL_SHELL: ShellSpec = { W: 697, H: 1281 };

const OVERVIEW_LAYOUT = {
  TITLE_CX: 380.5,
  TITLE_CY: 158,
  CLOSE_CX: 685,
  CLOSE_CY: 74,
  CLOSE_R: 48,
  BANNER_X: 79,
  BANNER_Y: 258,
  BANNER_W: 603,
  CIRCLE_CX: [170, 380.5, 591],
  CIRCLE_CY: 664,
  CIRCLE_SIZE: 145,
  PILL_Y: 733,
  BOTTOM_HINT_Y: 1224,
};

const DETAIL_LAYOUT = {
  TITLE_CX: 348.5,
  TITLE_CY: 83,
  BACK_CX: 79,
  BACK_CY: 84,
  BACK_R: 34,
  CLOSE_CX: 620,
  CLOSE_CY: 79,
  CLOSE_R: 46,
  HEADER_X: 74,
  HEADER_Y: 300,
  HEADER_W: 548,
  GRID_X: 72,
  GRID_Y: 640,
  GRID_W: 554,
  GRID_H: 470,
};

const OVERVIEW_BANNER_ASSET = {
  W: 1252,
  H: 671,
  TITLE_Y: 359,
  REWARD_Y: 382,
  PROGRESS_X: 242,
  PROGRESS_Y: 516,
  PROGRESS_W: 768,
};

const DETAIL_HEADER_ASSET = {
  W: 1289,
  H: 706,
  PORTRAIT_CX: 352,
  PORTRAIT_CY: 269,
  PORTRAIT_R: 187,
  REWARD_BOX_X: 658,
  REWARD_BOX_Y: 90,
  REWARD_BOX_W: 470,
  REWARD_BOX_H: 178,
  PROGRESS_X: 86,
  PROGRESS_Y: 504,
  PROGRESS_W: 1090,
  TICKET_CX: 245,
  TICKET_CY: 634,
};

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
  const top = Game.safeTop + 16;
  const bottom = H - 24;
  const availH = Math.max(300, bottom - top);
  const availW = W - 24;
  const scaleByW = availW / spec.W;
  const scaleByH = availH / spec.H;
  const scale = Math.min(scaleByW, scaleByH);
  const shellW = spec.W * scale;
  const shellH = spec.H * scale;
  const cx = W / 2;
  const cy = top + shellH / 2;
  return { scale, shellW, shellH, cx, cy, ox: cx - shellW / 2, oy: cy - shellH / 2 };
}

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

export class AffinityCodexPanel extends PIXI.Container {
  private _isOpen = false;
  private _assetUnsub: (() => void) | null = null;
  private _view: ViewMode = 'overview';
  private _detailTypeId: string | null = null;
  private _bg!: PIXI.Graphics;
  private _root!: PIXI.Container;
  private _detailLayer: PIXI.Container | null = null;

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
    this.addChild(this._root);

    EventBus.on('affinityCard:dropped', () => {
      if (this._isOpen) this._refresh();
    });
  }

  get isOpen(): boolean { return this._isOpen; }

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
    const pt = (x: number, y: number): PIXI.Point =>
      new PIXI.Point(layout.ox + x * layout.scale, layout.oy + y * layout.scale);

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
      fontSize: 30,
      fill: 0x6a3b00,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfff6e6,
      strokeThickness: 5,
    } as PIXI.TextStyle);
    title.anchor.set(0.5);
    const titlePos = pt(OVERVIEW_LAYOUT.TITLE_CX, OVERVIEW_LAYOUT.TITLE_CY);
    title.position.copyFrom(titlePos);
    this._root.addChild(title);

    this._addCloseHit(
      pt(OVERVIEW_LAYOUT.CLOSE_CX, OVERVIEW_LAYOUT.CLOSE_CY),
      OVERVIEW_LAYOUT.CLOSE_R * layout.scale,
    );

    const banner = this._buildOverviewBanner(OVERVIEW_LAYOUT.BANNER_W * layout.scale);
    const bannerPos = pt(OVERVIEW_LAYOUT.BANNER_X, OVERVIEW_LAYOUT.BANNER_Y);
    banner.position.copyFrom(bannerPos);
    this._root.addChild(banner);

    for (let i = 0; i < SEASON_TYPE_IDS.length; i++) {
      const typeId = SEASON_TYPE_IDS[i]!;
      const entry = this._buildOverviewNode(typeId, OVERVIEW_LAYOUT.CIRCLE_SIZE * layout.scale);
      entry.position.set(
        layout.ox + OVERVIEW_LAYOUT.CIRCLE_CX[i]! * layout.scale,
        layout.oy + OVERVIEW_LAYOUT.CIRCLE_CY * layout.scale,
      );
      this._root.addChild(entry);
    }

    if (CURRENT_SEASON.tagline) {
      const tagline = new PIXI.Text(CURRENT_SEASON.tagline, {
        fontSize: 15,
        fill: 0x9a6d45,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: 560 * layout.scale,
        breakWords: true,
        align: 'center',
      } as PIXI.TextStyle);
      tagline.anchor.set(0.5);
      const p = pt(OVERVIEW_LAYOUT.TITLE_CX, OVERVIEW_LAYOUT.BOTTOM_HINT_Y);
      tagline.position.copyFrom(p);
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

  private _buildOverviewBanner(width: number): PIXI.Container {
    const c = new PIXI.Container();
    const tex = TextureCache.get('affinity_codex_overview_banner_nb2');
    const scale = tex && tex.width > 0 ? width / tex.width : 1;
    const H = tex && tex.width > 0 ? tex.height * scale : width * 0.54;
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.scale.set(scale);
      c.addChild(sp);
    } else {
      const fb = new PIXI.Graphics();
      fb.beginFill(0xfff2de, 1);
      fb.lineStyle(2, 0xe7bb84, 1);
      fb.drawRoundedRect(0, 0, width, H, 24);
      fb.endFill();
      c.addChild(fb);
    }

    const remainMs = Math.max(0, CURRENT_SEASON.endAt - Date.now());
    const remainTxt = remainMs > 0 ? this._fmtRemain(remainMs) : '已结束';
    const timeChip = new PIXI.Graphics();
    timeChip.beginFill(0xfff4d7, 0.94);
    timeChip.lineStyle(1.5, 0xf0c37a, 1);
    timeChip.drawRoundedRect(0, 0, 136, 28, 14);
    timeChip.endFill();
    const timeTxt = new PIXI.Text(`赛季剩 ${remainTxt}`, {
      fontSize: 13,
      fill: 0xa56d1f,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    timeTxt.anchor.set(0.5);
    timeTxt.position.set(68, 14);
    timeChip.addChild(timeTxt);
    timeChip.position.set((width - 136) / 2, 18);
    c.addChild(timeChip);

    const rewardsInline = new PIXI.Container();
    const head = new PIXI.Text('完成全图鉴可赢取：', {
      fontSize: 21,
      fill: 0xa15b3d,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    head.anchor.set(0, 0);
    rewardsInline.addChild(head);

    const rewards = this._grandRewardChipList(CURRENT_SEASON.grandReward);
    const rewardRow = this._buildDetailRewardIconRow(rewards, width - 24, 52 * scale);
    rewardRow.position.set(head.width + 14 * scale, -2 * scale);
    rewardsInline.addChild(rewardRow);
    rewardsInline.position.set(
      (width - rewardsInline.width) / 2 - 10 * scale,
      OVERVIEW_BANNER_ASSET.TITLE_Y * scale,
    );
    c.addChild(rewardsInline);

    const total = this._totalSeasonProgress();
    const prog = this._buildOverviewProgressPill(
      OVERVIEW_BANNER_ASSET.PROGRESS_W * scale,
      total.obtained,
      total.total,
    );
    prog.position.set(
      OVERVIEW_BANNER_ASSET.PROGRESS_X * scale,
      OVERVIEW_BANNER_ASSET.PROGRESS_Y * scale,
    );
    c.addChild(prog);

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
    const st = AffinityManager.getState(typeId);
    const enabled = st.unlocked && this._typeIdHasCards(typeId);
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

    const pill = enabled
      ? this._buildPurpleProgressPill(size * 0.86, p.obtained, p.total)
      : this._buildLockPill(size * 0.86, `Lv.${AFFINITY_UNLOCK_LEVELS[typeId] ?? '-'}`);
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
    const pt = (x: number, y: number): PIXI.Point =>
      new PIXI.Point(layout.ox + x * layout.scale, layout.oy + y * layout.scale);

    const shellTex = TextureCache.get('affinity_codex_detail_shell_nb2');
    if (shellTex && shellTex.width > 0) {
      const sp = new PIXI.Sprite(shellTex);
      sp.anchor.set(0.5);
      sp.position.set(layout.cx, layout.cy);
      sp.scale.set(layout.scale);
      this._root.addChild(sp);
    } else {
      this._addFallbackShell(layout);
    }

    const titleStr = AFFINITY_MAP.get(typeId)?.bondName ?? '友谊图鉴';
    const title = new PIXI.Text(titleStr, {
      fontSize: 34,
      fill: 0x6a3b00,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfff6e6,
      strokeThickness: 5,
    } as PIXI.TextStyle);
    title.anchor.set(0.5);
    title.position.copyFrom(pt(DETAIL_LAYOUT.TITLE_CX, DETAIL_LAYOUT.TITLE_CY));
    this._root.addChild(title);

    this._addCloseHit(
      pt(DETAIL_LAYOUT.CLOSE_CX, DETAIL_LAYOUT.CLOSE_CY),
      DETAIL_LAYOUT.CLOSE_R * layout.scale,
    );
    this._addBackHit(
      pt(DETAIL_LAYOUT.BACK_CX, DETAIL_LAYOUT.BACK_CY),
      DETAIL_LAYOUT.BACK_R * layout.scale,
    );

    const header = this._buildDetailHeader(typeId, DETAIL_LAYOUT.HEADER_W * layout.scale);
    header.position.copyFrom(pt(DETAIL_LAYOUT.HEADER_X, DETAIL_LAYOUT.HEADER_Y));
    this._root.addChild(header);

    const grid = this._buildGrid(
      DETAIL_LAYOUT.GRID_W * layout.scale,
      DETAIL_LAYOUT.GRID_H * layout.scale,
      typeId,
    );
    grid.position.copyFrom(pt(DETAIL_LAYOUT.GRID_X, DETAIL_LAYOUT.GRID_Y));
    this._root.addChild(grid);

    const idx = SEASON_TYPE_IDS.indexOf(typeId);
    if (idx >= 0 && SEASON_TYPE_IDS.length > 1) {
      const prev = SEASON_TYPE_IDS[(idx - 1 + SEASON_TYPE_IDS.length) % SEASON_TYPE_IDS.length]!;
      const next = SEASON_TYPE_IDS[(idx + 1) % SEASON_TYPE_IDS.length]!;
      const leftArrow = this._buildPageArrow('left', prev);
      const rightArrow = this._buildPageArrow('right', next);
      leftArrow.position.set(layout.ox + 24 * layout.scale, layout.oy + 906 * layout.scale);
      rightArrow.position.set(layout.ox + 673 * layout.scale, layout.oy + 906 * layout.scale);
      this._root.addChild(leftArrow);
      this._root.addChild(rightArrow);
    }
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

  private _buildDetailHeader(typeId: string, width: number): PIXI.Container {
    const c = new PIXI.Container();
    const tex = TextureCache.get('affinity_codex_detail_header_nb2');
    const scale = tex && tex.width > 0 ? width / tex.width : 1;
    const H = tex && tex.width > 0 ? tex.height * scale : width * 0.55;
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.scale.set(scale);
      c.addChild(sp);
    } else {
      const fb = new PIXI.Graphics();
      fb.beginFill(0xfff6e8, 1);
      fb.lineStyle(2, 0xe6bc89, 1);
      fb.drawRoundedRect(0, 0, width, H, 22);
      fb.endFill();
      c.addChild(fb);
    }

    const portrait = this._buildHeaderPortrait(typeId, DETAIL_HEADER_ASSET.PORTRAIT_R * 2 * scale);
    portrait.position.set(
      DETAIL_HEADER_ASSET.PORTRAIT_CX * scale,
      DETAIL_HEADER_ASSET.PORTRAIT_CY * scale,
    );
    c.addChild(portrait);

    const head = new PIXI.Text('完成该系列以赢得：', {
      fontSize: 24 * scale,
      fill: 0xa25d45,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    head.anchor.set(0.5, 0);
    head.position.set(
      (DETAIL_HEADER_ASSET.REWARD_BOX_X + DETAIL_HEADER_ASSET.REWARD_BOX_W / 2) * scale,
      (DETAIL_HEADER_ASSET.REWARD_BOX_Y + 20) * scale,
    );
    c.addChild(head);

    const milestones = getCustomerMilestones(typeId);
    const fullMilestone = milestones[milestones.length - 1];
    if (fullMilestone) {
      const chips = this._milestoneChipList(fullMilestone);
      const rowMaxW = DETAIL_HEADER_ASSET.REWARD_BOX_W * scale - 24;
      const row = this._buildDetailRewardIconRow(chips, rowMaxW, 72 * scale);
      if (row.width > rowMaxW && row.width > 0) {
        const s = rowMaxW / row.width;
        row.scale.set(s);
      }
      row.position.set(
        DETAIL_HEADER_ASSET.REWARD_BOX_X * scale + (rowMaxW - row.width * row.scale.x) / 2,
        (DETAIL_HEADER_ASSET.REWARD_BOX_Y + 76) * scale,
      );
      c.addChild(row);

      if (fullMilestone.permanentHuayuanMult && fullMilestone.permanentHuayuanMult > 1) {
        const bonusRow = this._buildDetailPermanentBonusRow(
          fullMilestone.permanentHuayuanMult,
          AffinityCardManager.huayuanMultFor(typeId) > 1,
          DETAIL_HEADER_ASSET.REWARD_BOX_W * scale + 120 * scale,
          26 * scale,
        );
        bonusRow.position.set(
          (DETAIL_HEADER_ASSET.REWARD_BOX_X + DETAIL_HEADER_ASSET.REWARD_BOX_W / 2) * scale,
          (DETAIL_HEADER_ASSET.REWARD_BOX_Y + 248) * scale,
        );
        c.addChild(bonusRow);
      }
    }

    const p = AffinityCardManager.progress(typeId);
    const progress = this._buildPurpleProgressPill(DETAIL_HEADER_ASSET.PROGRESS_W * scale, p.obtained, p.total);
    progress.position.set(
      DETAIL_HEADER_ASSET.PROGRESS_X * scale,
      DETAIL_HEADER_ASSET.PROGRESS_Y * scale,
    );
    c.addChild(progress);

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
    hit.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this.close();
    });
    this._root.addChild(hit);
  }

  private _addBackHit(center: PIXI.Point, r: number): void {
    const buttonW = Math.max(62, r * 2.18);
    const buttonH = Math.max(36, r * 1.26);
    const radius = buttonH / 2;
    const plate = new PIXI.Graphics();
    plate.beginFill(0xfff4d7, 0.98);
    plate.lineStyle(Math.max(2, r * 0.07), 0xe0a95c, 1);
    plate.drawRoundedRect(-buttonW / 2, -buttonH / 2, buttonW, buttonH, radius);
    plate.endFill();
    plate.position.copyFrom(center);
    this._root.addChild(plate);

    const label = new PIXI.Text('返回', {
      fontSize: Math.max(18, Math.round(r * 0.58)),
      fill: 0x9a6326,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfff8df,
      strokeThickness: Math.max(2, Math.round(r * 0.08)),
    } as PIXI.TextStyle);
    label.anchor.set(0.5);
    label.position.copyFrom(center);
    this._root.addChild(label);

    const hit = new PIXI.Graphics();
    hit.beginFill(0xffffff, 0.001);
    hit.drawRoundedRect(-buttonW / 2 - 6, -buttonH / 2 - 6, buttonW + 12, buttonH + 12, radius + 6);
    hit.endFill();
    hit.position.copyFrom(center);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._backToOverview();
    });
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

  private _buildPurpleProgressPill(width: number, cur: number, total: number): PIXI.Container {
    const c = new PIXI.Container();
    const H = Math.max(20, Math.round(width * 0.075));
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
      fontSize: Math.max(12, Math.round(H * 0.65)),
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

  private _buildLockPill(width: number, label: string): PIXI.Container {
    const c = new PIXI.Container();
    const H = Math.max(20, Math.round(width * 0.075));
    const bg = new PIXI.Graphics();
    bg.beginFill(0xe6d4c2, 1);
    bg.lineStyle(2, 0xffffff, 0.72);
    bg.drawRoundedRect(0, 0, width, H, H / 2);
    bg.endFill();
    c.addChild(bg);
    const text = new PIXI.Text(label, {
      fontSize: Math.max(12, Math.round(H * 0.58)),
      fill: 0x8d7d70,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
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

  private _buildDetailRewardIconRow(chips: RewardChip[], maxWidth: number, iconDisp: number): PIXI.Container {
    const c = new PIXI.Container();
    const gap = Math.max(8, Math.round(iconDisp * 0.12));
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

  private _buildDetailPermanentBonusRow(
    mult: number,
    active: boolean,
    maxWidth: number,
    fontSize: number,
  ): PIXI.Container {
    const c = new PIXI.Container();
    const pct = Math.round((mult - 1) * 100);
    const text = new PIXI.Text(`永久订单花愿 +${pct}%`, {
      fontSize,
      fill: active ? 0xb06432 : 0xc09a7c,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xfffaef,
      strokeThickness: Math.max(2, Math.round(fontSize * 0.14)),
    } as PIXI.TextStyle);
    text.anchor.set(0, 0.5);
    text.position.set(0, 0);
    c.addChild(text);

    if (active) {
      const badgeTex = TextureCache.get('ui_order_check_badge');
      if (badgeTex) {
        const badge = new PIXI.Sprite(badgeTex);
        const side = Math.max(22, Math.round(fontSize * 1.15));
        const s = side / Math.max(badgeTex.width, badgeTex.height);
        badge.scale.set(s);
        badge.anchor.set(0, 0.5);
        badge.position.set(text.width + 8, 0);
        c.addChild(badge);
      }
    }

    if (c.width > maxWidth && c.width > 0) {
      const s = maxWidth / c.width;
      c.scale.set(s);
    }
    c.pivot.set(c.width / 2, 0);
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
   * 3 列 × N 行网格，每格用方形 art 主视觉（thumb），垂直拖拽滚动。
   *
   * 滚动实现要点（PIXI v7）：
   *  - 视口（wrap）开 `eventMode='static'` + 全覆盖 hitArea，保证手指按在卡片间隙也能拖动。
   *  - 用 `globalpointermove` 而非 `pointermove`：手指拖出网格区域仍能继续收到事件，避免半路掉线。
   *  - thumb 自身仍可 `pointertap` 打开详情；通过阈值 `_gridMoved` 区分"点击 vs 拖动"。
   */
  private _buildGrid(width: number, height: number, typeId: string): PIXI.Container {
    const wrap = new PIXI.Container();
    const cards = AffinityCardManager.listCards(typeId);
    const COLS = 3;
    const COL_GAP = 14;
    const ROW_GAP = 14;
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

  private _openCardDetail(card: AffinityCardDef): void {
    if (this._detailLayer) {
      this._detailLayer.destroy({ children: true });
      this._detailLayer = null;
    }
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
    front.position.set((W - LARGE_CARD_W) / 2, (H - LARGE_CARD_H) / 2 - 10);
    layer.addChild(front);

    const hint = new PIXI.Text('点击空白处关闭', {
      fontSize: 13, fill: 0xffffff, fontFamily: FONT_FAMILY,
    } as PIXI.TextStyle);
    hint.anchor.set(0.5);
    hint.position.set(W / 2, (H - LARGE_CARD_H) / 2 - 10 + LARGE_CARD_H + 22);
    layer.addChild(hint);

    layer.zIndex = 9999;
    this._detailLayer = layer;
    this.addChild(layer);
  }

  private _closeCardDetail(): void {
    if (!this._detailLayer) return;
    this._detailLayer.destroy({ children: true });
    this._detailLayer = null;
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
