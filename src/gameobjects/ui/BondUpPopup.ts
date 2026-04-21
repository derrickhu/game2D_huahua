/**
 * 熟客升档弹窗（Bond Up）
 *
 * 触发：AffinityManager 在 onCustomerDelivered 升级里程碑时 emit `affinity:bondUp`。
 *   payload: (typeId, oldBond, newBond, reward: AffinityMilestoneReward, def: AffinityCustomerDef)
 *
 * 视觉：复用 `flower_egg_reward_bg` + `item_info_title_ribbon` 同框（与 CustomerProfilePanel 同源），
 *      展示熟客头像、升档文案、本次发放奖励摘要。点击遮罩或右上 X 关闭。
 *
 * 队列：同一帧多档跳跃（GM 一次性加点）会触发多个 bondUp，按顺序排队播放。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TweenManager, Ease } from '@/core/TweenManager';
import { AudioManager } from '@/core/AudioManager';
import { COLORS, DESIGN_WIDTH, FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';
import { createFlowerEggModalFrame } from '@/gameobjects/ui/FlowerEggModalFrame';
import {
  getBondLevelLabel,
  type AffinityCustomerDef,
  type AffinityMilestoneReward,
  type BondLevel,
} from '@/config/AffinityConfig';
import { DECO_MAP } from '@/config/DecorationConfig';

interface BondUpEntry {
  typeId: string;
  oldBond: BondLevel;
  newBond: BondLevel;
  reward: AffinityMilestoneReward;
  def: AffinityCustomerDef;
}

export class BondUpPopup extends PIXI.Container {
  private _isOpen = false;
  private _queue: BondUpEntry[] = [];
  private _dismissArmTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.zIndex = 8200;
    this.visible = false;
  }

  get isOpen(): boolean { return this._isOpen; }

  enqueue(entry: BondUpEntry): void {
    this._queue.push(entry);
    if (!this._isOpen) {
      this._showNext();
    }
  }

  private _showNext(): void {
    const next = this._queue.shift();
    if (!next) {
      this._isOpen = false;
      this.visible = false;
      this.removeChildren();
      return;
    }
    this._isOpen = true;
    this.visible = true;
    this._build(next);
  }

  private _build(entry: BondUpEntry): void {
    this.removeChildren();
    if (this._dismissArmTimer !== null) {
      clearTimeout(this._dismissArmTimer);
      this._dismissArmTimer = null;
    }

    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    const overlay = new PIXI.Graphics();
    overlay.beginFill(0x000000, 0.55);
    overlay.drawRect(0, 0, W, H);
    overlay.endFill();
    overlay.eventMode = 'none';
    this.addChild(overlay);

    const contentW = Math.min(W - 80, 320);
    const contentH = 320;

    const frame = createFlowerEggModalFrame({
      viewW: W,
      viewH: H,
      title: `Bond Up · Lv.${entry.newBond}「${getBondLevelLabel(entry.newBond)}」`,
      titleFontSize: 20,
      contentWidth: contentW,
      contentHeight: contentH,
      onCloseTap: () => this._dismiss(),
    });
    this.addChild(frame.root);
    this._populate(frame.contentMount, entry, contentW);

    AudioManager.play('ui_reward_fanfare');

    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.25, ease: Ease.easeOutQuad });

    // 防误触：80ms 后才允许遮罩点击关闭
    this.eventMode = 'static';
    this.hitArea = new PIXI.Rectangle(0, 0, W, H);
    this.removeAllListeners('pointertap');
    this._dismissArmTimer = setTimeout(() => {
      this._dismissArmTimer = null;
      if (!this._isOpen) return;
      overlay.eventMode = 'static';
      overlay.cursor = 'pointer';
      overlay.removeAllListeners('pointertap');
      overlay.on('pointertap', () => this._dismiss());
    }, 120);
  }

  private _populate(
    mount: PIXI.Container,
    entry: BondUpEntry,
    width: number,
  ): void {
    mount.removeChildren();
    let y = 0;

    // 头像
    const portraitTex = TextureCache.get(`customer_${entry.typeId}`);
    if (portraitTex && portraitTex.width > 0) {
      const sp = new PIXI.Sprite(portraitTex);
      sp.anchor.set(0.5, 0);
      const targetH = 120;
      const k = targetH / portraitTex.height;
      sp.scale.set(k);
      sp.position.set(width / 2, y);
      mount.addChild(sp);
      y += targetH + 8;
    } else {
      y += 8;
    }

    // 名字 + 升档
    const nameLine = new PIXI.Text(`${entry.def.bondName}`, {
      fontSize: 18,
      fill: 0x9c4f2e,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle);
    nameLine.anchor.set(0.5, 0);
    nameLine.position.set(width / 2, y);
    mount.addChild(nameLine);
    y += 22;

    const bondLine = new PIXI.Text(
      `Bond Lv.${entry.oldBond} → Lv.${entry.newBond}「${getBondLevelLabel(entry.newBond)}」`,
      {
        fontSize: 14,
        fill: 0x6f4a2e,
        fontFamily: FONT_FAMILY,
      } as PIXI.TextStyle,
    );
    bondLine.anchor.set(0.5, 0);
    bondLine.position.set(width / 2, y);
    mount.addChild(bondLine);
    y += 22;

    // 里程碑标题
    const titleLine = new PIXI.Text(entry.reward.title, {
      fontSize: 15,
      fill: 0x4e342e,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      wordWrap: true,
      wordWrapWidth: width - 16,
      align: 'center',
    } as PIXI.TextStyle);
    titleLine.anchor.set(0.5, 0);
    titleLine.position.set(width / 2, y);
    mount.addChild(titleLine);
    y += titleLine.height + 6;

    // 描述
    const descLine = new PIXI.Text(entry.reward.desc, {
      fontSize: 12,
      fill: 0x6f4a2e,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: width - 32,
      align: 'center',
      lineHeight: 16,
    } as PIXI.TextStyle);
    descLine.anchor.set(0.5, 0);
    descLine.position.set(width / 2, y);
    mount.addChild(descLine);
    y += descLine.height + 10;

    // 奖励摘要胶囊
    const rewards = this._summaryItems(entry.reward);
    if (rewards.length > 0) {
      const capsule = this._buildRewardCapsule(rewards, width - 24);
      capsule.position.set((width - capsule.width) / 2, y);
      mount.addChild(capsule);
    }
  }

  private _summaryItems(r: AffinityMilestoneReward): Array<{ icon?: string; label: string }> {
    const arr: Array<{ icon?: string; label: string }> = [];
    if (r.huayuan) arr.push({ icon: 'icon_huayuan', label: `+${r.huayuan}` });
    if (r.diamond) arr.push({ icon: 'icon_gem', label: `+${r.diamond}` });
    if (r.stamina) arr.push({ icon: 'icon_energy', label: `+${r.stamina}` });
    if (r.flowerSignTickets) arr.push({ icon: 'icon_flower_sign_coin', label: `+${r.flowerSignTickets}` });
    if (r.decoUnlockId) {
      const deco = DECO_MAP.get(r.decoUnlockId);
      arr.push({ icon: r.decoUnlockId, label: deco ? `主题家具「${deco.name}」` : `主题家具：${r.decoUnlockId}` });
    }
    return arr;
  }

  private _buildRewardCapsule(
    items: Array<{ icon?: string; label: string }>,
    maxW: number,
  ): PIXI.Container {
    const padX = 12;
    const padY = 8;
    const itemGap = 14;
    const iconSize = 22;

    const innerNodes: PIXI.Container[] = [];
    let totalW = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      const wrap = new PIXI.Container();
      let curX = 0;
      const tex = it.icon ? TextureCache.get(it.icon) : null;
      if (tex && tex.width > 0) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0, 0.5);
        const k = iconSize / Math.max(tex.width, tex.height);
        sp.scale.set(k);
        sp.position.set(0, iconSize / 2);
        wrap.addChild(sp);
        curX += iconSize + 4;
      }
      const txt = new PIXI.Text(it.label, {
        fontSize: 14,
        fill: 0x6f4a2e,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
      } as PIXI.TextStyle);
      txt.anchor.set(0, 0.5);
      txt.position.set(curX, iconSize / 2);
      wrap.addChild(txt);
      innerNodes.push(wrap);
      const wrapW = curX + txt.width;
      totalW += wrapW + (i > 0 ? itemGap : 0);
      (wrap as any).__w = wrapW;
    }

    const capsuleW = Math.min(maxW, totalW + padX * 2);
    const capsuleH = iconSize + padY * 2;
    const root = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0xfff3e0, 0.95);
    bg.lineStyle(2, 0xe6c79c, 0.8);
    bg.drawRoundedRect(0, 0, capsuleW, capsuleH, capsuleH / 2);
    bg.endFill();
    root.addChild(bg);

    let cursorX = padX;
    for (let i = 0; i < innerNodes.length; i++) {
      const node = innerNodes[i]!;
      node.position.set(cursorX, padY);
      root.addChild(node);
      cursorX += ((node as any).__w ?? node.width) + itemGap;
    }
    return root;
  }

  private _dismiss(): void {
    if (!this._isOpen) return;
    if (this._dismissArmTimer !== null) {
      clearTimeout(this._dismissArmTimer);
      this._dismissArmTimer = null;
    }
    this._isOpen = false;
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.18,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.removeChildren();
        // 队列里还有 → 继续下一档
        if (this._queue.length > 0) {
          this._showNext();
        } else {
          this.visible = false;
        }
      },
    });
  }
}
