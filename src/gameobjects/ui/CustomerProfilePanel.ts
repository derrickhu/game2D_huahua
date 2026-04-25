/**
 * 熟客资料卡面板（V2）
 *
 * 由 CustomerView 头像 tap 触发；展示该熟客的人设 + 友谊图鉴进度 + 里程碑奖励，
 * 以及「查看图鉴」入口。Bond 等级与里程碑已退场，全部由 AffinityCardManager 接管。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { COLORS, DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';
import { createFlowerEggModalFrame } from '@/gameobjects/ui/FlowerEggModalFrame';
import { AffinityManager } from '@/managers/AffinityManager';
import { AffinityCardManager } from '@/managers/AffinityCardManager';
import {
  hasCardsForOwner,
  type CustomerMilestone,
  type CardReward,
} from '@/config/AffinityCardConfig';
import { DECO_MAP } from '@/config/DecorationConfig';
import {
  AFFINITY_MAP,
  AFFINITY_UNLOCK_LEVELS,
  type AffinityCustomerDef,
} from '@/config/AffinityConfig';

export class CustomerProfilePanel extends PIXI.Container {
  private _isOpen = false;
  private _frameRoot: PIXI.Container | null = null;
  private _currentTypeId: string | null = null;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 8500;
  }

  get isOpen(): boolean { return this._isOpen; }

  open(typeId: string): void {
    const def = AFFINITY_MAP.get(typeId);
    if (!def) {
      console.warn(`[CustomerProfilePanel] 未知熟客 typeId=${typeId}`);
      return;
    }
    if (this._isOpen) {
      this._build(def);
      return;
    }
    this._isOpen = true;
    this._currentTypeId = typeId;
    this.visible = true;
    this._build(def);
    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.18, ease: Ease.easeOutQuad });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._currentTypeId = null;
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.15,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
        this.removeChildren();
        this._frameRoot = null;
      },
    });
  }

  private _build(def: AffinityCustomerDef): void {
    this.removeChildren();
    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.45);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'static';
    overlay.on('pointerdown', () => this.close());
    this.addChild(overlay);

    const contentW = Math.min(W - 80, 320);
    const cardSystemReady = AffinityManager.isCardSystemUnlocked() && hasCardsForOwner(def.typeId);
    const milestones = cardSystemReady ? AffinityCardManager.milestonesOf(def.typeId) : [];
    const contentH = cardSystemReady ? Math.min(560, 260 + milestones.length * 64) : 320;

    const frame = createFlowerEggModalFrame({
      viewW: W,
      viewH: H,
      title: `熟客 · ${def.bondName}`,
      titleFontSize: 22,
      contentWidth: contentW,
      contentHeight: contentH,
      onCloseTap: () => this.close(),
    });
    this._frameRoot = frame.root;
    this.addChild(frame.root);

    this._populateContent(frame.contentMount, def, contentW);
  }

  private _populateContent(
    mount: PIXI.Container,
    def: AffinityCustomerDef,
    width: number,
  ): void {
    mount.removeChildren();
    const state = AffinityManager.getState(def.typeId);

    let y = 0;
    const portraitTex = TextureCache.get(`customer_${def.typeId}`);
    if (portraitTex && portraitTex.width > 0) {
      const sp = new PIXI.Sprite(portraitTex);
      sp.anchor.set(0.5, 0);
      const targetH = 110;
      const k = targetH / portraitTex.height;
      sp.scale.set(k);
      sp.position.set(width / 2, y);
      mount.addChild(sp);
      y += targetH + 6;
    } else {
      y += 6;
    }

    const persona = new PIXI.Text(def.persona, {
      fontSize: 13,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: width - 16,
      align: 'center',
      lineHeight: 18,
    } as PIXI.TextStyle);
    persona.anchor.set(0.5, 0);
    persona.position.set(width / 2, y);
    mount.addChild(persona);
    y += persona.height + 10;

    const cardSystemReady = AffinityManager.isCardSystemUnlocked() && hasCardsForOwner(def.typeId);

    const statusLine = new PIXI.Text(
      state.unlocked
        ? cardSystemReady
          ? '常客 · 已加入友谊图鉴'
          : hasCardsForOwner(def.typeId)
            ? `常客 · 图鉴 Lv.6 解锁`
            : '常客 · 本赛季暂无友谊图鉴'
        : `未解锁（${this._unlockHintFor(def.typeId)}）`,
      {
        fontSize: 14,
        fill: state.unlocked ? 0x9c4f2e : COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as PIXI.TextStyle,
    );
    statusLine.anchor.set(0.5, 0);
    statusLine.position.set(width / 2, y);
    mount.addChild(statusLine);
    y += 22;

    if (cardSystemReady) {
      const cardRow = this._buildCardCodexRow(def.typeId, width);
      cardRow.position.set(0, y);
      mount.addChild(cardRow);
      y += 56;

      const sectionTitle = new PIXI.Text('图鉴里程碑', {
        fontSize: 14,
        fill: 0x9c4f2e,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as PIXI.TextStyle);
      sectionTitle.anchor.set(0.5, 0);
      sectionTitle.position.set(width / 2, y);
      mount.addChild(sectionTitle);
      y += 20;

      const milestones = AffinityCardManager.milestonesOf(def.typeId);
      const stats = AffinityCardManager.progress(def.typeId);
      for (const m of milestones) {
        const row = this._buildMilestoneRow(width, m, stats.obtained);
        row.position.set(0, y);
        mount.addChild(row);
        y += (row as any).rowHeight ?? 56;
      }
    }
  }

  private _buildCardCodexRow(typeId: string, width: number): PIXI.Container {
    const c = new PIXI.Container();
    const padX = 10;
    const innerW = width - padX * 2;
    const rowH = 48;

    const bg = new PIXI.Graphics();
    bg.beginFill(0xfff8e7, 0.95);
    bg.lineStyle(2, 0xe6c79c, 1);
    bg.drawRoundedRect(padX, 0, innerW, rowH, 12);
    bg.endFill();
    c.addChild(bg);

    const stats = AffinityCardManager.progress(typeId);

    const title = new PIXI.Text('友谊图鉴', {
      fontSize: 14,
      fill: 0x9c4f2e,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    title.anchor.set(0, 0);
    title.position.set(padX + 12, 6);
    c.addChild(title);

    const sub = new PIXI.Text(`已收集 ${stats.obtained} / ${stats.total} 张`, {
      fontSize: 12,
      fill: 0x6f4a2e,
      fontFamily: FONT_FAMILY,
    } as PIXI.TextStyle);
    sub.anchor.set(0, 0);
    sub.position.set(padX + 12, 26);
    c.addChild(sub);

    const btnW = 90, btnH = 28;
    const btn = new PIXI.Container();
    const btnBg = new PIXI.Graphics();
    btnBg.beginFill(0xffb469, 1);
    btnBg.lineStyle(2, 0x9c4f2e, 0.8);
    btnBg.drawRoundedRect(0, 0, btnW, btnH, btnH / 2);
    btnBg.endFill();
    btn.addChild(btnBg);
    const btnTxt = new PIXI.Text('查看图鉴', {
      fontSize: 13,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    btnTxt.anchor.set(0.5);
    btnTxt.position.set(btnW / 2, btnH / 2);
    btn.addChild(btnTxt);
    btn.position.set(width - padX - 12 - btnW, (rowH - btnH) / 2);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', (e) => {
      e.stopPropagation();
      EventBus.emit('affinityCodex:open', typeId);
    });
    c.addChild(btn);

    return c;
  }

  private _unlockHintFor(typeId: string): string {
    if (!AFFINITY_MAP.has(typeId)) return '解锁等级未配置';
    const lv = AFFINITY_UNLOCK_LEVELS[typeId];
    return typeof lv === 'number' ? `Lv.${lv} 解锁` : '解锁等级未配置';
  }

  private _buildMilestoneRow(
    width: number,
    m: CustomerMilestone & { claimed: boolean },
    currentObtained: number,
  ): PIXI.Container {
    const row = new PIXI.Container();
    const padX = 10;
    const innerW = width - padX * 2;
    const rowH = 56;

    const reached = currentObtained >= m.threshold;
    const bg = new PIXI.Graphics();
    bg.beginFill(m.claimed ? 0xefe9d4 : reached ? 0xffe9bb : 0xf6efe3, 0.92);
    bg.lineStyle(1.5, m.claimed ? 0x4caf50 : reached ? 0xffb469 : 0xd9c8a8, 1);
    bg.drawRoundedRect(padX, 0, innerW, rowH, 10);
    bg.endFill();
    row.addChild(bg);

    const badge = new PIXI.Text(`${m.threshold}/12`, {
      fontSize: 12,
      fill: m.claimed ? 0x4caf50 : reached ? 0x9c4f2e : 0xb0a08c,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    badge.anchor.set(0, 0);
    badge.position.set(padX + 10, 6);
    row.addChild(badge);

    const title = new PIXI.Text(m.title, {
      fontSize: 13,
      fill: m.claimed || reached ? 0x4e342e : 0x8a6f4f,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    title.anchor.set(0, 0);
    title.position.set(padX + 56, 6);
    row.addChild(title);

    const summary = this._summarizeMilestone(m);
    const sub = new PIXI.Text(summary, {
      fontSize: 11,
      fill: m.claimed || reached ? 0x6f4a2e : 0xa6896a,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: innerW - 64,
    } as PIXI.TextStyle);
    sub.anchor.set(0, 0);
    sub.position.set(padX + 56, 24);
    row.addChild(sub);

    if (m.claimed) {
      const tag = new PIXI.Text('已领取', {
        fontSize: 11,
        fill: 0x4caf50,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as PIXI.TextStyle);
      tag.anchor.set(1, 0);
      tag.position.set(width - padX - 6, 6);
      row.addChild(tag);
    }
    (row as any).rowHeight = rowH + 6;
    return row;
  }

  private _summarizeMilestone(m: CustomerMilestone): string {
    const parts = this._summarizeReward(m.reward);
    if (m.decoUnlockId) {
      const deco = DECO_MAP.get(m.decoUnlockId);
      parts.push(deco ? `主题家具「${deco.name}」` : `主题家具：${m.decoUnlockId}`);
    }
    if (m.permanentHuayuanMult && m.permanentHuayuanMult > 1) {
      const pct = Math.round((m.permanentHuayuanMult - 1) * 100);
      parts.push(`订单永久 +${pct}% 花愿`);
    }
    return parts.length > 0 ? parts.join('  ') : '剧情解锁';
  }

  private _summarizeReward(r: CardReward): string[] {
    const parts: string[] = [];
    if (r.huayuan) parts.push(`花愿+${r.huayuan}`);
    if (r.diamond) parts.push(`钻石+${r.diamond}`);
    if (r.stamina) parts.push(`体力+${r.stamina}`);
    if (r.flowerSignTickets) parts.push(`许愿币+${r.flowerSignTickets}`);
    return parts;
  }

  get currentTypeId(): string | null {
    return this._currentTypeId;
  }
}
