/**
 * 熟客资料卡面板
 *
 * 由 CustomerView 头像 tap 触发；展示该熟客的人设、当前 Bond 等级、累计点数 + 下一档进度，
 * 以及 5 档里程碑的「已发放」与「待解锁」概要（与 LevelUpPopup 仪式段同源 LevelUnlockCard 视觉）。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { COLORS, DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';
import { createFlowerEggModalFrame } from '@/gameobjects/ui/FlowerEggModalFrame';
import { AffinityManager } from '@/managers/AffinityManager';
import { DECO_MAP } from '@/config/DecorationConfig';
import {
  AFFINITY_MAP,
  AFFINITY_UNLOCK_LEVELS,
  BOND_THRESHOLDS,
  getBondLevelLabel,
  type AffinityCustomerDef,
  type AffinityMilestoneReward,
  type BondLevel,
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
      // 已开 → 切换到点击的另一位熟客
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
    const contentH = 380;

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
    // 头像
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

    // 人设
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

    // Bond 等级 + 进度
    const bondLine = new PIXI.Text(
      state.unlocked
        ? `当前 Bond · Lv.${state.bond}「${getBondLevelLabel(state.bond)}」`
        : `未解锁（${this._unlockHintFor(def.typeId)}）`,
      {
        fontSize: 14,
        fill: state.unlocked ? 0x9c4f2e : COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as PIXI.TextStyle,
    );
    bondLine.anchor.set(0.5, 0);
    bondLine.position.set(width / 2, y);
    mount.addChild(bondLine);
    y += 22;

    if (state.unlocked) {
      const nextBond = (state.bond < 5 ? (state.bond + 1) : 5) as BondLevel;
      const cur = state.points;
      const nextThreshold = BOND_THRESHOLDS[nextBond];
      const prevThreshold = BOND_THRESHOLDS[state.bond];
      const labelText = state.bond >= 5
        ? `已达「知己」累计 ${cur} 点`
        : `${cur} / ${nextThreshold} 点 → Lv.${nextBond}「${getBondLevelLabel(nextBond)}」`;
      const ptsText = new PIXI.Text(labelText, {
        fontSize: 12,
        fill: 0x6f4a2e,
        fontFamily: FONT_FAMILY,
      } as PIXI.TextStyle);
      ptsText.anchor.set(0.5, 0);
      ptsText.position.set(width / 2, y);
      mount.addChild(ptsText);
      y += 16;

      // 进度条
      const barW = width - 32;
      const barH = 8;
      const barX = (width - barW) / 2;
      const bg = new PIXI.Graphics();
      bg.beginFill(0xfbe5d6, 0.95);
      bg.drawRoundedRect(barX, y, barW, barH, 4);
      bg.endFill();
      mount.addChild(bg);
      const range = Math.max(1, nextThreshold - prevThreshold);
      const filled = state.bond >= 5 ? barW : Math.max(0, Math.min(1, (cur - prevThreshold) / range)) * barW;
      const fg = new PIXI.Graphics();
      fg.beginFill(0xffb469);
      fg.drawRoundedRect(barX, y, filled, barH, 4);
      fg.endFill();
      mount.addChild(fg);
      y += barH + 12;
    } else {
      y += 4;
    }

    // 里程碑列表
    const sectionTitle = new PIXI.Text('Bond 里程碑', {
      fontSize: 14,
      fill: 0x9c4f2e,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    sectionTitle.anchor.set(0.5, 0);
    sectionTitle.position.set(width / 2, y);
    mount.addChild(sectionTitle);
    y += 20;

    for (let lv = 1 as BondLevel; lv <= 5; lv = (lv + 1) as BondLevel) {
      const reward = def.milestones[lv];
      const claimed = state.unlocked && state.bond >= lv;
      const row = this._buildMilestoneRow(width, lv, reward, claimed);
      row.position.set(0, y);
      mount.addChild(row);
      y += (row as any).rowHeight ?? 26;
    }
  }

  private _unlockHintFor(typeId: string): string {
    if (!AFFINITY_MAP.has(typeId)) return '解锁等级未配置';
    const lv = AFFINITY_UNLOCK_LEVELS[typeId];
    return typeof lv === 'number' ? `Lv.${lv} 解锁` : '解锁等级未配置';
  }

  private _buildMilestoneRow(
    width: number,
    bondLv: BondLevel,
    reward: AffinityMilestoneReward,
    claimed: boolean,
  ): PIXI.Container {
    const row = new PIXI.Container();
    const padX = 10;
    const innerW = width - padX * 2;

    const badge = new PIXI.Text(`Lv.${bondLv}`, {
      fontSize: 12,
      fill: claimed ? 0x4caf50 : 0xb0a08c,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    badge.anchor.set(0, 0);
    badge.position.set(padX, 2);
    row.addChild(badge);

    const title = new PIXI.Text(reward.title, {
      fontSize: 13,
      fill: claimed ? 0x4e342e : 0x8a6f4f,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    title.anchor.set(0, 0);
    title.position.set(padX + 38, 0);
    row.addChild(title);

    const rewardSummary = this._summarizeReward(reward);
    const rewardLine = new PIXI.Text(rewardSummary, {
      fontSize: 11,
      fill: claimed ? 0x6f4a2e : 0xa6896a,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: innerW - 38,
    } as PIXI.TextStyle);
    rewardLine.anchor.set(0, 0);
    rewardLine.position.set(padX + 38, 17);
    row.addChild(rewardLine);

    const desc = new PIXI.Text(reward.desc, {
      fontSize: 11,
      fill: claimed ? 0x6f4a2e : 0xa6896a,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: innerW - 38,
    } as PIXI.TextStyle);
    desc.anchor.set(0, 0);
    desc.position.set(padX + 38, 17 + rewardLine.height + 2);
    row.addChild(desc);

    const rowH = 17 + rewardLine.height + 2 + desc.height + 8;
    (row as any).rowHeight = rowH;

    if (claimed) {
      const tag = new PIXI.Text('已发放', {
        fontSize: 11,
        fill: 0x4caf50,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as PIXI.TextStyle);
      tag.anchor.set(1, 0);
      tag.position.set(width - padX, 2);
      row.addChild(tag);
    }
    return row;
  }

  private _summarizeReward(r: AffinityMilestoneReward): string {
    const parts: string[] = [];
    if (r.huayuan) parts.push(`花愿+${r.huayuan}`);
    if (r.diamond) parts.push(`钻石+${r.diamond}`);
    if (r.stamina) parts.push(`体力+${r.stamina}`);
    if (r.flowerSignTickets) parts.push(`许愿币+${r.flowerSignTickets}`);
    if (r.decoUnlockId) {
      const deco = DECO_MAP.get(r.decoUnlockId);
      parts.push(deco ? `主题家具「${deco.name}」` : `主题家具：${r.decoUnlockId}`);
    }
    return parts.length > 0 ? parts.join('  ') : '剧情/角色解锁';
  }

  /** 当前面板正在展示的熟客 typeId（无则 null） */
  get currentTypeId(): string | null {
    return this._currentTypeId;
  }
}
