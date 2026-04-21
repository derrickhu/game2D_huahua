/**
 * 离线收益 / 开店糖果面板（3 段式）
 *
 * 段位（自上而下）：
 *   1. 离线产出   - 离线时长 + 产出花束数 + 离线花愿
 *   2. 熟客留言   - 头像 + 「熟客 · LvX」+ 一句话留言（无熟客解锁时整段隐藏）
 *   3. 开店糖果   - 当日基础包（体力/花愿/钻石）+ 当日彩蛋 + 连签里程碑（如有）
 *
 * 任何一段为空时整段隐藏；至少一段非空才会被 IdleManager.calculateOfflineReward 弹出。
 * 「领取收益」点击后由 IdleManager.claimReward 统一入账，再 close。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { IdleManager, OfflineReward } from '@/managers/IdleManager';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';

const SECTION_GAP = 14;
const PANEL_W = 520;
const PANEL_PAD_X = 28;
const PANEL_PAD_TOP = 24;
const PANEL_PAD_BOTTOM = 24;
const BTN_W = 220;
const BTN_H = 50;
const BTN_TOP_GAP = 18;

export class OfflineRewardPanel extends PIXI.Container {
  private _bgMask!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _isOpen = false;
  private _reward: OfflineReward | null = null;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 6000;
    this._build();
  }

  show(reward: OfflineReward): void {
    if (this._isOpen) return;
    this._reward = reward;
    this._isOpen = true;
    this.visible = true;
    this._refresh();

    this.alpha = 0;
    this._content.scale.set(0.85);
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.28, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.scale, props: { x: 1, y: 1 }, duration: 0.32, ease: Ease.easeOutBack });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.18,
      onComplete: () => {
        this.visible = false;
        this._reward = null;
      },
    });
  }

  private _build(): void {
    const w = DESIGN_WIDTH;
    const h = Game.logicHeight;

    this._bgMask = new PIXI.Graphics();
    this._bgMask.beginFill(0x000000, 0.6);
    this._bgMask.drawRect(0, 0, w, h);
    this._bgMask.endFill();
    this._bgMask.eventMode = 'static';
    this.addChild(this._bgMask);

    this._content = new PIXI.Container();
    this.addChild(this._content);
  }

  private _refresh(): void {
    while (this._content.children.length > 0) {
      this._content.removeChild(this._content.children[0]);
    }
    if (!this._reward) return;

    const r = this._reward;

    // ---- 渲染各段，先把段容器算高 ----
    const sections: PIXI.Container[] = [];
    const sectionHeights: number[] = [];
    const innerW = PANEL_W - PANEL_PAD_X * 2;

    const offlineSec = this._buildOfflineSection(r, innerW);
    if (offlineSec) {
      sections.push(offlineSec);
      sectionHeights.push((offlineSec as any).__h ?? 0);
    }

    const noteSec = this._buildAffinityNoteSection(r, innerW);
    if (noteSec) {
      sections.push(noteSec);
      sectionHeights.push((noteSec as any).__h ?? 0);
    }

    const candySec = this._buildDailyCandySection(r, innerW);
    if (candySec) {
      sections.push(candySec);
      sectionHeights.push((candySec as any).__h ?? 0);
    }

    // 顶部标题区高度（标题 + 副标题）
    const headerH = 60;
    const sumSecH = sectionHeights.reduce((s, n) => s + n, 0);
    const sumGapH = Math.max(0, sections.length) * SECTION_GAP;
    const buttonZoneH = BTN_TOP_GAP + BTN_H;

    const panelH = Math.min(
      Game.logicHeight - 80,
      PANEL_PAD_TOP + headerH + sumSecH + sumGapH + buttonZoneH + PANEL_PAD_BOTTOM,
    );

    const cx = DESIGN_WIDTH / 2;
    const panelX = cx - PANEL_W / 2;
    const panelY = (Game.logicHeight - panelH) / 2;

    // 面板背景
    const bg = new PIXI.Graphics();
    bg.beginFill(0xfff8f0, 0.98);
    bg.drawRoundedRect(panelX, panelY, PANEL_W, panelH, 24);
    bg.endFill();
    bg.lineStyle(3, 0xe7c79b, 0.7);
    bg.drawRoundedRect(panelX, panelY, PANEL_W, panelH, 24);
    bg.eventMode = 'static';
    this._content.addChild(bg);

    // 标题
    const title = new PIXI.Text('开店啦 · 离线回礼', {
      fontSize: 24, fill: 0x9c4f2e, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    } as PIXI.TextStyle);
    title.anchor.set(0.5, 0);
    title.position.set(cx, panelY + 18);
    this._content.addChild(title);

    // 副标题：离线时长（无离线时显示「今日开店」）
    const subtitle = new PIXI.Text(
      r.offlineSeconds >= 60
        ? `离线时长：${this._formatDuration(r.offlineSeconds)}`
        : '今日首次开店',
      {
        fontSize: 14, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      } as PIXI.TextStyle,
    );
    subtitle.anchor.set(0.5, 0);
    subtitle.position.set(cx, panelY + 50);
    this._content.addChild(subtitle);

    // 段排版
    let cursorY = panelY + PANEL_PAD_TOP + headerH;
    const sectionLeft = panelX + PANEL_PAD_X;
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i]!;
      sec.position.set(sectionLeft, cursorY);
      this._content.addChild(sec);
      cursorY += sectionHeights[i]! + SECTION_GAP;
    }

    // 领取按钮
    const btnY = panelY + panelH - PANEL_PAD_BOTTOM - BTN_H;
    const btnX = cx - BTN_W / 2;
    const btnGfx = new PIXI.Graphics();
    btnGfx.beginFill(COLORS.BUTTON_PRIMARY);
    btnGfx.drawRoundedRect(btnX, btnY, BTN_W, BTN_H, 26);
    btnGfx.endFill();
    btnGfx.lineStyle(2, 0x9c4f2e, 0.4);
    btnGfx.drawRoundedRect(btnX, btnY, BTN_W, BTN_H, 26);
    this._content.addChild(btnGfx);

    const btnTxt = new PIXI.Text('领取', {
      fontSize: 19, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    } as PIXI.TextStyle);
    btnTxt.anchor.set(0.5);
    btnTxt.position.set(cx, btnY + BTN_H / 2);
    this._content.addChild(btnTxt);

    const hit = new PIXI.Container();
    hit.hitArea = new PIXI.Rectangle(btnX, btnY, BTN_W, BTN_H);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointertap', () => {
      IdleManager.claimReward();
      this.close();
    });
    this._content.addChild(hit);
  }

  // ============================================================
  // 段：离线产出
  // ============================================================
  private _buildOfflineSection(r: OfflineReward, innerW: number): PIXI.Container | null {
    if (r.offlineSeconds < 60 && r.producedItems.length === 0 && r.huayuanEarned <= 0) return null;

    const root = new PIXI.Container();
    let y = 0;
    y = this._appendSectionHeader(root, '离线产出', innerW, y);

    if (r.producedItems.length > 0) {
      const line = `花束产出 ×${r.producedItems.length}`;
      this._appendBulletLine(root, line, innerW, y);
      y += 22;

      const items = r.producedItems.slice(0, 3);
      const names = items.map(i => i.name).join('、');
      const extra = r.producedItems.length > 3 ? ` 等 ${r.producedItems.length} 件` : '';
      const detail = new PIXI.Text(`  ${names}${extra}`, {
        fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        wordWrap: true, wordWrapWidth: innerW - 16,
      } as PIXI.TextStyle);
      detail.position.set(8, y);
      root.addChild(detail);
      y += detail.height + 6;
    } else if (r.offlineSeconds >= 60) {
      const empty = new PIXI.Text('  暂无新产出（棋盘上无永久建筑或太久未开店）', {
        fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
        wordWrap: true, wordWrapWidth: innerW - 16,
      } as PIXI.TextStyle);
      empty.position.set(8, y);
      root.addChild(empty);
      y += 18;
    }

    if (r.huayuanEarned > 0) {
      this._appendBulletLine(root, `离线花愿 +${r.huayuanEarned}`, innerW, y);
      y += 22;
    }

    (root as any).__h = y + 4;
    return root;
  }

  // ============================================================
  // 段：熟客留言
  // ============================================================
  private _buildAffinityNoteSection(r: OfflineReward, innerW: number): PIXI.Container | null {
    const note = r.affinityNote;
    if (!note) return null;
    const root = new PIXI.Container();
    let y = 0;
    y = this._appendSectionHeader(root, '熟客留言', innerW, y);

    // 头像
    const tex = TextureCache.get(`customer_${note.typeId}`);
    let avatarRight = 8;
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0, 0);
      const targetH = 60;
      const k = targetH / tex.height;
      sp.scale.set(k);
      sp.position.set(8, y);
      root.addChild(sp);
      avatarRight = 8 + tex.width * k + 10;
    }

    const nameLine = new PIXI.Text(`${note.bondName} · Lv.${note.bondLevel}「${note.bondLabel}」`, {
      fontSize: 14, fill: 0x9c4f2e, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    } as PIXI.TextStyle);
    nameLine.position.set(avatarRight, y + 2);
    root.addChild(nameLine);

    const text = new PIXI.Text(note.text, {
      fontSize: 12, fill: 0x6f4a2e, fontFamily: FONT_FAMILY,
      wordWrap: true, wordWrapWidth: innerW - avatarRight - 8, lineHeight: 16,
    } as PIXI.TextStyle);
    text.position.set(avatarRight, y + 22);
    root.addChild(text);

    const sectionH = Math.max(60, Math.max(text.position.y + text.height, y + 60)) + 2;
    (root as any).__h = sectionH;
    return root;
  }

  // ============================================================
  // 段：开店糖果
  // ============================================================
  private _buildDailyCandySection(r: OfflineReward, innerW: number): PIXI.Container | null {
    const dc = r.dailyCandy;
    if (!dc) return null;

    const root = new PIXI.Container();
    let y = 0;
    y = this._appendSectionHeader(root, `开店糖果（连签 ${dc.consecutiveDays} 天）`, innerW, y);

    // 基础包
    const baseParts: string[] = [];
    if (dc.base.huayuan > 0) baseParts.push(`花愿+${dc.base.huayuan}`);
    if (dc.base.stamina > 0) baseParts.push(`体力+${dc.base.stamina}`);
    if (dc.base.diamond > 0) baseParts.push(`钻石+${dc.base.diamond}`);
    if (baseParts.length > 0) {
      this._appendBulletLine(root, `每日基础包 · ${baseParts.join(' / ')}`, innerW, y);
      y += 22;
    }

    // 随机彩蛋
    if (dc.bonus) {
      this._appendBulletLine(root, `今日彩蛋 · ${dc.bonus.label}`, innerW, y);
      y += 22;
    }

    // 连签里程碑
    if (dc.streakTier) {
      const t = dc.streakTier;
      const tierParts: string[] = [];
      if (t.huayuan) tierParts.push(`花愿+${t.huayuan}`);
      if (t.stamina) tierParts.push(`体力+${t.stamina}`);
      if (t.diamond) tierParts.push(`钻石+${t.diamond}`);
      if (t.flowerSignTickets) tierParts.push(`许愿币+${t.flowerSignTickets}`);
      if (t.blindBoxAffinityFurniture) tierParts.push('随机熟客主题家具盲盒');
      const summary = tierParts.length > 0 ? ` · ${tierParts.join(' / ')}` : '';
      const tierText = new PIXI.Text(`【${t.label}】${summary}`, {
        fontSize: 13, fill: 0xb14a00, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        wordWrap: true, wordWrapWidth: innerW - 16,
      } as PIXI.TextStyle);
      tierText.position.set(8, y);
      root.addChild(tierText);
      y += tierText.height + 4;
    }

    (root as any).__h = y + 4;
    return root;
  }

  // ============================================================
  // 工具
  // ============================================================
  private _appendSectionHeader(parent: PIXI.Container, title: string, innerW: number, y: number): number {
    const headerBg = new PIXI.Graphics();
    headerBg.beginFill(0xfde2c4, 0.85);
    headerBg.drawRoundedRect(0, y, innerW, 24, 12);
    headerBg.endFill();
    parent.addChild(headerBg);

    const t = new PIXI.Text(title, {
      fontSize: 14, fill: 0x9c4f2e, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    } as PIXI.TextStyle);
    t.anchor.set(0, 0.5);
    t.position.set(12, y + 12);
    parent.addChild(t);

    return y + 30;
  }

  private _appendBulletLine(parent: PIXI.Container, text: string, _innerW: number, y: number): void {
    const dot = new PIXI.Graphics();
    dot.beginFill(0xff8a4c);
    dot.drawCircle(12, y + 10, 4);
    dot.endFill();
    parent.addChild(dot);

    const t = new PIXI.Text(text, {
      fontSize: 13, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY,
    } as PIXI.TextStyle);
    t.position.set(22, y + 2);
    parent.addChild(t);
  }

  private _formatDuration(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h} 小时 ${m} 分`;
    return `${m} 分`;
  }
}
