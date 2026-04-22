/**
 * 友谊卡图鉴面板
 *
 * 入口：CustomerProfilePanel「卡册行」按钮 / GMManager / TopBar 后续接入。
 *
 * 视觉：
 *  - 复用 createFlowerEggModalFrame 同源外框（与 BondUpPopup / CustomerProfilePanel 一致）
 *  - 顶部三个客人头像 Tab（Lv 未解锁的 Tab 灰色禁用）
 *  - 中央卡片网格 3 列：未得卡灰色背 + 「???」；已得卡彩色稀有度边 + 标题
 *  - 卡片点击：全屏放大查看（复用 AffinityCardDropPopup 单卡视觉，但禁掉翻牌）
 *  - 底部统计条：N x/x · R x/x · SR x/x · SSR x/x · 友谊点 x
 *
 * 关闭：右上 X / 遮罩点击
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { COLORS, DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';
import { createFlowerEggModalFrame } from '@/gameobjects/ui/FlowerEggModalFrame';
import { AffinityCardManager } from '@/managers/AffinityCardManager';
import { AffinityManager } from '@/managers/AffinityManager';
import {
  AFFINITY_CARDS,
  CARD_RARITIES,
  CARD_RARITY_COLOR,
  CARD_RARITY_LABEL,
  type AffinityCardDef,
  type CardRarity,
} from '@/config/AffinityCardConfig';

const TAB_TYPE_IDS_S1: string[] = ['student', 'worker', 'mom'];
const TAB_LABEL: Record<string, string> = {
  student: '小诗', worker: '阿凯', mom: '林姐',
};

export class AffinityCodexPanel extends PIXI.Container {
  private _isOpen = false;
  private _activeTypeId: string | null = null;
  private _frameRoot: PIXI.Container | null = null;
  private _detailLayer: PIXI.Container | null = null;

  constructor() {
    super();
    this.zIndex = 8400;
    this.visible = false;

    EventBus.on('affinityCard:dropped', () => {
      // 弹窗开着且当前 tab 与该客人匹配时刷新
      if (this._isOpen) this._build();
    });
  }

  get isOpen(): boolean { return this._isOpen; }

  /** 默认进入 S1 第一位有解锁的客人 tab；可指定 typeId */
  open(typeId?: string): void {
    this._activeTypeId = this._pickInitialTab(typeId);
    if (this._isOpen) {
      this._build();
      return;
    }
    this._isOpen = true;
    this.visible = true;
    this._build();
    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.18, ease: Ease.easeOutQuad });
  }

  private _pickInitialTab(prefer?: string): string {
    if (prefer && this._typeIdHasCards(prefer)) return prefer;
    for (const t of TAB_TYPE_IDS_S1) {
      const st = AffinityManager.getState(t);
      if (st.unlocked && this._typeIdHasCards(t)) return t;
    }
    return TAB_TYPE_IDS_S1[0]!;
  }

  private _typeIdHasCards(typeId: string): boolean {
    return AFFINITY_CARDS.some(c => c.ownerTypeId === typeId);
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.15,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this.removeChildren();
        this._frameRoot = null;
        this._detailLayer = null;
      },
    });
  }

  private _build(): void {
    this.removeChildren();
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.55);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    overlay.on('pointerdown', () => {
      if (this._detailLayer) this._closeDetail();
      else this.close();
    });
    this.addChild(overlay);

    const contentW = Math.min(W - 60, 360);
    const contentH = Math.min(H - 220, 540);

    const seasonName = '初春繁花季 · S1'; // 赛季制 P2 接入后从 SeasonConfig 取
    const frame = createFlowerEggModalFrame({
      viewW: W,
      viewH: H,
      title: `友谊图鉴 · ${seasonName}`,
      titleFontSize: 20,
      contentWidth: contentW,
      contentHeight: contentH,
      onCloseTap: () => this.close(),
    });
    this._frameRoot = frame.root;
    this.addChild(frame.root);

    this._populate(frame.contentMount, contentW, contentH);
  }

  private _populate(mount: PIXI.Container, width: number, height: number): void {
    mount.removeChildren();
    let y = 0;

    // ── Tab 行 ──
    const tabRow = this._buildTabRow(width);
    tabRow.position.set(0, y);
    mount.addChild(tabRow);
    y += 64;

    if (!this._activeTypeId) return;
    const typeId = this._activeTypeId;

    // ── 进度统计条 ──
    const stats = AffinityCardManager.progress(typeId);
    const shards = AffinityCardManager.getShards(typeId);
    const summary = this._buildSummary(width, stats, shards);
    summary.position.set(0, y);
    mount.addChild(summary);
    y += 28;

    // ── 卡片网格 ──
    const gridTop = y;
    const gridH = height - y - 8;
    const grid = this._buildGrid(width, gridH, typeId);
    grid.position.set(0, gridTop);
    mount.addChild(grid);
  }

  private _buildTabRow(width: number): PIXI.Container {
    const row = new PIXI.Container();
    const n = TAB_TYPE_IDS_S1.length;
    const slotW = Math.min(80, (width - 16) / n);
    const slotH = 60;
    const startX = (width - slotW * n) / 2;
    for (let i = 0; i < n; i++) {
      const tid = TAB_TYPE_IDS_S1[i]!;
      const tab = this._buildTab(tid, slotW, slotH);
      tab.position.set(startX + slotW * i, 0);
      row.addChild(tab);
    }
    return row;
  }

  private _buildTab(typeId: string, w: number, h: number): PIXI.Container {
    const c = new PIXI.Container();
    const isActive = typeId === this._activeTypeId;
    const st = AffinityManager.getState(typeId);
    const enabled = st.unlocked && this._typeIdHasCards(typeId);

    const bg = new PIXI.Graphics();
    if (isActive) {
      bg.beginFill(0xfff3c4, 1);
      bg.lineStyle(2, 0xb8860b, 1);
    } else if (enabled) {
      bg.beginFill(0xfff8e7, 0.8);
      bg.lineStyle(1, 0xd9c08a, 0.8);
    } else {
      bg.beginFill(0xeeeeee, 0.7);
      bg.lineStyle(1, 0xbbbbbb, 0.6);
    }
    bg.drawRoundedRect(2, 2, w - 4, h - 4, 12);
    bg.endFill();
    c.addChild(bg);

    const tex = TextureCache.get(`customer_${typeId}`);
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5, 0);
      const targetH = h - 22;
      const k = targetH / tex.height;
      sp.scale.set(k);
      sp.position.set(w / 2, 4);
      sp.alpha = enabled ? 1 : 0.45;
      c.addChild(sp);
    }
    const label = new PIXI.Text(TAB_LABEL[typeId] ?? typeId, {
      fontSize: 12,
      fill: enabled ? 0x4a2f10 : 0x999999,
      fontFamily: FONT_FAMILY,
      fontWeight: isActive ? 'bold' : 'normal',
    } as PIXI.TextStyle);
    label.anchor.set(0.5, 1);
    label.position.set(w / 2, h - 4);
    c.addChild(label);

    if (enabled) {
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.on('pointertap', () => {
        if (typeId !== this._activeTypeId) {
          this._activeTypeId = typeId;
          this._build();
        }
      });
    }
    return c;
  }

  private _buildSummary(
    width: number,
    stats: ReturnType<typeof AffinityCardManager.progress>,
    shards: number,
  ): PIXI.Container {
    const c = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0xfff8e7, 0.95);
    bg.lineStyle(1, 0xe6c79c, 0.9);
    bg.drawRoundedRect(0, 0, width, 24, 12);
    bg.endFill();
    c.addChild(bg);

    const parts: string[] = [];
    for (const r of CARD_RARITIES) {
      const [obtained, total] = stats.byRarity[r];
      parts.push(`${r} ${obtained}/${total}`);
    }
    const rarityTxt = new PIXI.Text(parts.join('  ·  '), {
      fontSize: 12,
      fill: 0x6b4a1c,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    rarityTxt.anchor.set(0, 0.5);
    rarityTxt.position.set(10, 12);
    c.addChild(rarityTxt);

    // 右侧：友谊点图标 + 数字
    const shardTex = TextureCache.get('affinity_shard_icon');
    let cursorRight = width - 10;
    const shardLabel = new PIXI.Text(`${shards}`, {
      fontSize: 12,
      fill: 0x9c4f2e,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    shardLabel.anchor.set(1, 0.5);
    shardLabel.position.set(cursorRight, 12);
    c.addChild(shardLabel);
    cursorRight -= shardLabel.width + 4;
    if (shardTex && shardTex.width > 0) {
      const sp = new PIXI.Sprite(shardTex);
      sp.anchor.set(1, 0.5);
      const k = 18 / Math.max(shardTex.width, shardTex.height);
      sp.scale.set(k);
      sp.position.set(cursorRight, 12);
      c.addChild(sp);
    } else {
      const fallback = new PIXI.Text('友谊点', {
        fontSize: 11, fill: 0x9c4f2e, fontFamily: FONT_FAMILY,
      } as PIXI.TextStyle);
      fallback.anchor.set(1, 0.5);
      fallback.position.set(cursorRight, 12);
      c.addChild(fallback);
    }
    return c;
  }

  private _buildGrid(width: number, height: number, typeId: string): PIXI.Container {
    const wrap = new PIXI.Container();
    const cards = AffinityCardManager.listCards(typeId);
    const COLS = 3;
    const COL_GAP = 8;
    const ROW_GAP = 10;
    const cellW = Math.floor((width - COL_GAP * (COLS - 1)) / COLS);
    const cellH = Math.floor(cellW * 1.45);

    const inner = new PIXI.Container();
    let row = 0;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]!;
      const r = Math.floor(i / COLS);
      const col = i % COLS;
      const cell = this._buildGridCell(c, cellW, cellH);
      cell.position.set(col * (cellW + COL_GAP), r * (cellH + ROW_GAP));
      inner.addChild(cell);
      row = r;
    }
    const totalH = (row + 1) * cellH + row * ROW_GAP;

    // 简单滚动：网格高超出可视高时，加一个垂直拖动
    if (totalH > height) {
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff);
      mask.drawRect(0, 0, width, height);
      mask.endFill();
      wrap.addChild(mask);
      inner.mask = mask;
      wrap.addChild(inner);

      let dragging = false;
      let lastY = 0;
      let velocity = 0;
      const minY = Math.min(0, height - totalH);
      wrap.eventMode = 'static';
      wrap.hitArea = new PIXI.Rectangle(0, 0, width, height);
      wrap.on('pointerdown', (e) => {
        dragging = true;
        lastY = e.global.y;
        velocity = 0;
      });
      wrap.on('pointermove', (e) => {
        if (!dragging) return;
        const dy = e.global.y - lastY;
        lastY = e.global.y;
        velocity = dy;
        inner.y = Math.max(minY, Math.min(0, inner.y + dy));
      });
      const stop = (): void => { dragging = false; };
      wrap.on('pointerup', stop);
      wrap.on('pointerupoutside', stop);
      wrap.on('pointercancel', stop);
    } else {
      wrap.addChild(inner);
    }

    return wrap;
  }

  private _buildGridCell(
    cardEntry: AffinityCardDef & { obtained: boolean; obtainedAt?: number; dupCount: number },
    w: number,
    h: number,
  ): PIXI.Container {
    const c = new PIXI.Container();
    const obtained = cardEntry.obtained;
    const tint = CARD_RARITY_COLOR[cardEntry.rarity];

    const bg = new PIXI.Graphics();
    if (obtained) {
      bg.beginFill(0xfff8e7, 1);
      bg.lineStyle(2, tint, 1);
    } else {
      bg.beginFill(0xeeeeee, 0.8);
      bg.lineStyle(2, 0xbbbbbb, 0.6);
    }
    bg.drawRoundedRect(0, 0, w, h, 10);
    bg.endFill();
    c.addChild(bg);

    if (obtained) {
      // 立绘缩略
      const portraitMaskH = h * 0.55;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff);
      mask.drawRoundedRect(4, 4, w - 8, portraitMaskH, 8);
      mask.endFill();
      c.addChild(mask);

      const tex = TextureCache.get(cardEntry.artKey ?? `customer_${cardEntry.ownerTypeId}`);
      if (tex && tex.width > 0) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const targetH = portraitMaskH * 1.1;
        const k = targetH / tex.height;
        sp.scale.set(k);
        sp.position.set(w / 2, 4 + portraitMaskH / 2);
        sp.mask = mask;
        c.addChild(sp);
      }
      // 稀有度小块
      const rChip = new PIXI.Graphics();
      const rcW = 26, rcH = 14;
      rChip.beginFill(tint, 1);
      rChip.drawRoundedRect(0, 0, rcW, rcH, 7);
      rChip.endFill();
      const rTxt = new PIXI.Text(cardEntry.rarity, {
        fontSize: 10, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      } as PIXI.TextStyle);
      rTxt.anchor.set(0.5);
      rTxt.position.set(rcW / 2, rcH / 2);
      rChip.addChild(rTxt);
      rChip.position.set(6, 6);
      c.addChild(rChip);
      // 标题
      const title = new PIXI.Text(cardEntry.title, {
        fontSize: 12, fill: 0x4a2f10, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        wordWrap: true, wordWrapWidth: w - 10, align: 'center',
      } as PIXI.TextStyle);
      title.anchor.set(0.5, 0);
      title.position.set(w / 2, 4 + portraitMaskH + 6);
      c.addChild(title);
      // 重复角标
      if (cardEntry.dupCount > 0) {
        const dup = new PIXI.Text(`x${cardEntry.dupCount + 1}`, {
          fontSize: 10, fill: 0x8a5a00, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        } as PIXI.TextStyle);
        dup.anchor.set(1, 0);
        dup.position.set(w - 6, 6);
        c.addChild(dup);
      }
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.on('pointertap', (e) => {
        e.stopPropagation();
        this._openCardDetail(cardEntry);
      });
    } else {
      const q = new PIXI.Text('???', {
        fontSize: 28, fill: 0x999999, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      } as PIXI.TextStyle);
      q.anchor.set(0.5);
      q.position.set(w / 2, h / 2 - 8);
      c.addChild(q);
      const r = new PIXI.Text(`${cardEntry.rarity} · ${CARD_RARITY_LABEL[cardEntry.rarity]}`, {
        fontSize: 11, fill: 0x999999, fontFamily: FONT_FAMILY,
      } as PIXI.TextStyle);
      r.anchor.set(0.5);
      r.position.set(w / 2, h - 14);
      c.addChild(r);
    }
    return c;
  }

  private _openCardDetail(card: AffinityCardDef): void {
    if (this._detailLayer) {
      this._detailLayer.destroy({ children: true });
      this._detailLayer = null;
    }
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;
    const layer = new PIXI.Container();
    const dim = new PIXI.Graphics();
    dim.beginFill(0x000000, 0.65);
    dim.drawRect(0, 0, W, H);
    dim.endFill();
    dim.eventMode = 'static';
    dim.on('pointertap', () => this._closeDetail());
    layer.addChild(dim);

    const tint = CARD_RARITY_COLOR[card.rarity];
    const cw = 280, ch = 380;
    const cx = W / 2, cy = H / 2;
    const cardC = new PIXI.Container();
    cardC.position.set(cx, cy);

    const halo = new PIXI.Graphics();
    if (card.rarity === 'SR' || card.rarity === 'SSR') {
      halo.beginFill(tint, card.rarity === 'SSR' ? 0.7 : 0.5);
      halo.drawRoundedRect(-cw / 2 - 12, -ch / 2 - 12, cw + 24, ch + 24, 22);
      halo.endFill();
      cardC.addChild(halo);
    }
    const bg = new PIXI.Graphics();
    bg.beginFill(0xfff8e7, 1);
    bg.lineStyle(4, tint, 1);
    bg.drawRoundedRect(-cw / 2, -ch / 2, cw, ch, 18);
    bg.endFill();
    cardC.addChild(bg);

    const portraitMaskH = ch * 0.55;
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRoundedRect(-cw / 2 + 10, -ch / 2 + 10, cw - 20, portraitMaskH, 14);
    mask.endFill();
    cardC.addChild(mask);

    const tex = TextureCache.get(card.artKey ?? `customer_${card.ownerTypeId}`);
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const k = (portraitMaskH * 1.15) / tex.height;
      sp.scale.set(k);
      sp.position.set(0, -ch / 2 + 10 + portraitMaskH / 2);
      sp.mask = mask;
      cardC.addChild(sp);
    }

    const chip = new PIXI.Graphics();
    chip.beginFill(tint, 0.95);
    chip.drawRoundedRect(0, 0, 64, 22, 11);
    chip.endFill();
    const chipTxt = new PIXI.Text(`${card.rarity} · ${CARD_RARITY_LABEL[card.rarity]}`, {
      fontSize: 12, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    } as PIXI.TextStyle);
    chipTxt.anchor.set(0.5);
    chipTxt.position.set(32, 11);
    chip.addChild(chipTxt);
    chip.position.set(-cw / 2 + 14, -ch / 2 + 14);
    cardC.addChild(chip);

    const title = new PIXI.Text(card.title, {
      fontSize: 22, fill: 0x4a2f10, fontFamily: FONT_FAMILY, fontWeight: 'bold', align: 'center',
    } as PIXI.TextStyle);
    title.anchor.set(0.5, 0);
    title.position.set(0, -ch / 2 + portraitMaskH + 16);
    cardC.addChild(title);

    const story = new PIXI.Text(card.story, {
      fontSize: 13, fill: 0x6b4a1c, fontFamily: FONT_FAMILY,
      wordWrap: true, wordWrapWidth: cw - 36, align: 'center', lineHeight: 18,
    } as PIXI.TextStyle);
    story.anchor.set(0.5, 0);
    story.position.set(0, -ch / 2 + portraitMaskH + 16 + title.height + 8);
    cardC.addChild(story);

    layer.addChild(cardC);

    // 提示
    const hint = new PIXI.Text('点击空白处关闭', {
      fontSize: 12, fill: 0xffffff, fontFamily: FONT_FAMILY,
    } as PIXI.TextStyle);
    hint.anchor.set(0.5);
    hint.position.set(W / 2, cy + ch / 2 + 28);
    layer.addChild(hint);

    layer.zIndex = 9999;
    this._detailLayer = layer;
    this.addChild(layer);
    void COLORS;
  }

  private _closeDetail(): void {
    if (!this._detailLayer) return;
    this._detailLayer.destroy({ children: true });
    this._detailLayer = null;
    void this._frameRoot;
  }
}
