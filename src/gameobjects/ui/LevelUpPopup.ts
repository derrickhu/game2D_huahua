/**
 * 升级弹窗 —— 正式升星：许愿池「恭喜获得」同款（散射光 + 彩带 + 网格 + 点击继续）。
 * 星级礼包「仅预览」：`flower_egg_reward_bg` + `item_info_title_ribbon` + 奖励图标网格 + 点遮罩关闭。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { AudioManager } from '@/core/AudioManager';
import { TweenManager, Ease } from '@/core/TweenManager';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS } from '@/config/ItemConfig';
import {
  getDecosUnlockedInLevelRange,
  getRoomStylesUnlockedInLevelRange,
  type DecoDef,
  DecoRarity,
} from '@/config/DecorationConfig';
import {
  getLevelUnlockDef,
  getLevelUnlocksInRange,
  type LevelUnlockDef,
} from '@/config/LevelUnlockConfig';
import { createLevelUnlockCard } from '@/gameobjects/ui/LevelUnlockCard';
import { TextureCache } from '@/utils/TextureCache';
import { RewardFlyCoordinator, type RewardFlyItem } from '@/core/RewardFlyCoordinator';
import {
  layoutObtainStyleRewardBlock,
  createItemObtainRewardCell,
  type ItemObtainEntry,
} from '@/gameobjects/ui/ItemObtainOverlay';

const LEVEL_UP_MASK_ALPHA = 0.62;

export interface LevelUpRewardPayload {
  huayuan: number;
  stamina: number;
  diamond: number;
  /** 许愿喷泉硬币（已入账，仅展示；无顶栏飞入） */
  flowerSignTickets?: number;
  /** 收纳盒物品（展示 + 关闭时飞入礼包后再发放） */
  rewardBoxItems?: Array<{ itemId: string; count: number }>;
}

export interface LevelUpPopupShowOptions {
  /** 左下礼包按钮中心（全局坐标），用于飞入动画 */
  rewardFlyTargetGlobal?: PIXI.Point;
  /** 飞入结束（或无动画）后写入收纳盒 */
  onGrantRewardBoxItems?: (entries: Array<{ itemId: string; count: number }>) => void;
  /** 仅预览礼包，关闭时不写入收纳盒、不播放飞入 */
  previewOnly?: boolean;
  /** 仅 preview 时用作面板标题；正式升级固定「恭喜升级」 */
  bannerTitle?: string;
  /** 非预览全屏祝贺时的标题，默认「恭喜升级」（如签到里程碑用「恭喜获得」） */
  celebrationTitle?: string;
  /** 淡出并从舞台移除完毕后回调（用于衔接后续弹窗，如花店「获得新家具」） */
  onFullyClosed?: () => void;
  /** 升级前的旧等级，用于计算本次解锁的家具范围 */
  previousLevel?: number;
}

export class LevelUpPopup extends PIXI.Container {
  private _dismissing = false;
  private _previewOnly = false;
  private _pendingBoxItems: Array<{ itemId: string; count: number }> = [];
  private _flySources: Array<{ x: number; y: number; texKey: string; count: number }> = [];
  private _rewardFlyTargetGlobal: PIXI.Point | null = null;
  private _onGrantRewardBoxItems: LevelUpPopupShowOptions['onGrantRewardBoxItems'];
  private _onFullyClosed: LevelUpPopupShowOptions['onFullyClosed'];
  /** 弹窗展示用（与已入账数值一致；确定后用于飞入顶栏特效） */
  private _showHuayuan = 0;
  private _showStamina = 0;
  private _showDiamond = 0;
  /** 延后注册 pointertap 关闭，避免连续 show 时旧定时器重复绑监听 */
  private _dismissPointerArmTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.zIndex = 8000;
    this.visible = false;
  }

  show(
    level: number,
    reward: LevelUpRewardPayload & { gold?: number },
    options?: LevelUpPopupShowOptions,
  ): void {
    this.visible = true;
    this._dismissing = false;
    this._previewOnly = options?.previewOnly ?? false;
    this.removeChildren();
    this._flySources = [];
    this._rewardFlyTargetGlobal = options?.rewardFlyTargetGlobal ?? null;
    this._onGrantRewardBoxItems = options?.onGrantRewardBoxItems;
    this._onFullyClosed = options?.onFullyClosed;

    const W = DESIGN_WIDTH;
    const H = Game.logicHeight;

    const huayuan = reward.huayuan > 0 ? reward.huayuan : (reward.gold ?? 0);
    const stamina = reward.stamina ?? 0;
    const diamond = reward.diamond ?? 0;
    const flowerSignTickets = Math.max(0, Math.floor(reward.flowerSignTickets ?? 0));
    const rewardBoxItems = reward.rewardBoxItems ?? [];
    this._pendingBoxItems = this._previewOnly ? [] : [...rewardBoxItems];
    this._showHuayuan = huayuan;
    this._showStamina = stamina;
    this._showDiamond = diamond;

    const obtainEntries: ItemObtainEntry[] = [];
    if (huayuan > 0) obtainEntries.push({ kind: 'direct_currency', currency: 'huayuan', amount: huayuan });
    if (stamina > 0) obtainEntries.push({ kind: 'direct_currency', currency: 'stamina', amount: stamina });
    if (diamond > 0) obtainEntries.push({ kind: 'direct_currency', currency: 'diamond', amount: diamond });
    if (flowerSignTickets > 0) {
      obtainEntries.push({ kind: 'direct_currency', currency: 'flowerSign', amount: flowerSignTickets });
    }
    for (const { itemId, count } of rewardBoxItems) {
      obtainEntries.push({ kind: 'board_item', itemId, count });
    }

    // 升星仪式：聚合本次跨越的 LevelUnlockDef（数据驱动；为空则不渲染卡片）
    const ceremonyDefs: LevelUnlockDef[] = this._previewOnly
      ? (level > 0 ? (getLevelUnlockDef(level) ? [getLevelUnlockDef(level)!] : []) : [])
      : (level > 0 ? getLevelUnlocksInRange(options?.previousLevel ?? (level - 1), level) : []);
    const ceremonySubtitle = ceremonyDefs.length > 0
      ? ceremonyDefs.map(d => d.ceremonyTitle).join(' · ')
      : null;

    const previewBaseTitle = options?.bannerTitle ?? `升至 ${level}星 · 礼包预览`;
    const previewTitle = this._previewOnly && ceremonySubtitle
      ? `${previewBaseTitle}\n仪式：${ceremonySubtitle}`
      : previewBaseTitle;
    const titleText = this._previewOnly
      ? previewTitle
      : (options?.celebrationTitle ?? (ceremonySubtitle ? `升星仪式 · ${ceremonySubtitle}` : '恭喜升级'));

    const mask = new PIXI.Graphics();
    mask.beginFill(0x000000, LEVEL_UP_MASK_ALPHA);
    mask.drawRect(0, 0, W, H);
    mask.endFill();
    mask.eventMode = 'none';
    this.addChild(mask);

    if (this._previewOnly) {
      this._flySources = [];
      this._layoutStarGiftPreviewBox(W, H, obtainEntries, titleText);
      this.eventMode = 'static';
      this.hitArea = new PIXI.Rectangle(0, 0, W, H);
      this.cursor = 'default';
      this.removeAllListeners('pointertap');
      if (this._dismissPointerArmTimer !== null) {
        clearTimeout(this._dismissPointerArmTimer);
        this._dismissPointerArmTimer = null;
      }
      this._dismissPointerArmTimer = setTimeout(() => {
        this._dismissPointerArmTimer = null;
        if (!this.visible || this._dismissing) return;
        mask.eventMode = 'static';
        mask.removeAllListeners('pointertap');
        mask.cursor = 'pointer';
        mask.on('pointertap', () => this._dismiss());
      }, 80);
    } else {
      const ribbonKey = TextureCache.get('pink_bar')?.width ? 'pink_bar' : 'merge_chain_ribbon';

      const content = new PIXI.Container();
      content.eventMode = 'none';
      this.addChild(content);

      const { boardItemSlots } = layoutObtainStyleRewardBlock(content, W, H, obtainEntries, {
        ribbonTexKey: ribbonKey,
        titleText,
      });

      this._flySources = boardItemSlots.map(s => {
        const def = ITEM_DEFS.get(s.itemId);
        return { x: s.cx, y: s.cy, texKey: def?.icon ?? s.itemId, count: s.count };
      });

      if (!this._previewOnly) {
        if (ceremonyDefs.length > 0) {
          this._appendOpenCardsSection(content, W, ceremonyDefs);
        }
        const prevLevel = options?.previousLevel ?? (level - 1);
        const unlockedDecos = getDecosUnlockedInLevelRange(prevLevel, level);
        const unlockedStyles = getRoomStylesUnlockedInLevelRange(prevLevel, level);
        if (unlockedDecos.length > 0 || unlockedStyles.length > 0) {
          this._appendUnlockSection(content, W, unlockedDecos, unlockedStyles);
        }
      }

      this.eventMode = 'static';
      this.hitArea = new PIXI.Rectangle(0, 0, W, H);
      this.cursor = 'pointer';
      this.removeAllListeners('pointertap');
      if (this._dismissPointerArmTimer !== null) {
        clearTimeout(this._dismissPointerArmTimer);
        this._dismissPointerArmTimer = null;
      }
      this._dismissPointerArmTimer = setTimeout(() => {
        this._dismissPointerArmTimer = null;
        if (!this.visible || this._dismissing) return;
        this.removeAllListeners('pointertap');
        this.on('pointertap', () => this._dismiss());
      }, 80);
    }

    if (!this._previewOnly) {
      AudioManager.play('ui_reward_fanfare');
    }

    this.alpha = 0;
    TweenManager.to({ target: this, props: { alpha: 1 }, duration: 0.35, ease: Ease.easeOutQuad });
  }

  /**
   * 升至下一星礼包预览：`flower_egg_reward_bg` 底板 + `item_info_title_ribbon` 标题（与棋盘信息条同源素材）。
   */
  private _layoutStarGiftPreviewBox(
    W: number,
    H: number,
    entries: ItemObtainEntry[],
    titleStr: string,
  ): void {
    const CELL = 72;
    const GAP = 16;
    const n = entries.length;
    const cols = n <= 0 ? 1 : Math.min(5, n);
    const rows = n <= 0 ? 1 : Math.ceil(n / cols);
    const gridW = cols * CELL + (cols - 1) * GAP;
    const gridH = rows * CELL + (rows - 1) * GAP;

    const bgTex = TextureCache.get('flower_egg_reward_bg');
    const ribTex = TextureCache.get('item_info_title_ribbon');

    const panelRoot = new PIXI.Container();
    panelRoot.position.set(W / 2, H / 2);
    panelRoot.eventMode = 'passive';
    panelRoot.interactiveChildren = true;

    let panelW = Math.min(W - 40, Math.max(300, gridW + 80));
    let panelH: number;
    let ribW = 0;
    let ribH = 0;

    if (bgTex && bgTex.width > 0) {
      if (ribTex && ribTex.width > 0) {
        ribW = Math.min(panelW - 28, 400);
        ribH = (ribW * ribTex.height) / ribTex.width;
      }
      const naturalH = (panelW * bgTex.height) / bgTex.width;
      const contentFloor = gridH + 56 + 48;
      panelH = Math.max(naturalH, (ribH > 0 ? ribH * 0.5 : 0) + contentFloor);
      panelH = Math.min(panelH, H - Game.safeTop - 48);
    } else {
      panelH = 52 + 36 + 14 + gridH + 52;
    }

    const hx = panelW / 2;
    const hy = panelH / 2;

    if (bgTex && bgTex.width > 0) {
      const bgSp = new PIXI.Sprite(bgTex);
      bgSp.anchor.set(0.5, 0.5);
      bgSp.position.set(0, 0);
      bgSp.width = panelW;
      bgSp.height = panelH;
      bgSp.eventMode = 'static';
      bgSp.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      panelRoot.addChild(bgSp);

      if (ribTex && ribTex.width > 0) {
        ribW = Math.min(panelW - 28, 400);
        ribH = (ribW * ribTex.height) / ribTex.width;
        const ribbon = new PIXI.Sprite(ribTex);
        ribbon.anchor.set(0.5, 1);
        const ribbonBottomY = -hy + 14;
        ribbon.position.set(0, ribbonBottomY);
        ribbon.width = ribW;
        ribbon.height = ribH;
        ribbon.eventMode = 'static';
        ribbon.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
        panelRoot.addChild(ribbon);

        const title = new PIXI.Text(titleStr, {
          fontSize: 18,
          fill: 0xffffff,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
          stroke: 0x6b1818,
          strokeThickness: 3.5,
          wordWrap: true,
          wordWrapWidth: ribW - 48,
          align: 'center',
        } as any);
        title.anchor.set(0.5, 0.5);
        title.position.set(0, ribbonBottomY - ribH * 0.48);
        title.eventMode = 'static';
        title.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
        panelRoot.addChild(title);
      } else {
        const title = new PIXI.Text(titleStr, {
          fontSize: 19,
          fill: COLORS.TEXT_DARK,
          fontFamily: FONT_FAMILY,
          fontWeight: 'bold',
          wordWrap: true,
          wordWrapWidth: panelW - 48,
          align: 'center',
        } as any);
        title.anchor.set(0.5, 0);
        title.position.set(0, -hy + 28);
        title.eventMode = 'static';
        title.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
        panelRoot.addChild(title);
      }
    } else {
      const px = -panelW / 2;
      const py = -panelH / 2;
      const panelBg = new PIXI.Graphics();
      panelBg.beginFill(0xfff8f0, 0.98);
      panelBg.drawRoundedRect(px, py, panelW, panelH, 22);
      panelBg.endFill();
      panelBg.lineStyle(3, 0xd2b48c, 0.55);
      panelBg.drawRoundedRect(px, py, panelW, panelH, 22);
      panelBg.eventMode = 'static';
      panelBg.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      panelRoot.addChild(panelBg);

      const title = new PIXI.Text(titleStr, {
        fontSize: 19,
        fill: COLORS.TEXT_DARK,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        wordWrap: true,
        wordWrapWidth: panelW - 40,
        align: 'center',
      } as any);
      title.anchor.set(0.5, 0);
      title.position.set(0, py + 26);
      title.eventMode = 'static';
      title.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
      panelRoot.addChild(title);
    }

    const gridTop =
      -hy + (ribH > 0 ? Math.max(ribH * 0.42 + 28, panelH * 0.2) : 72);
    const gridLeft = -gridW / 2;

    const cellScale = CELL / 96;
    if (n === 0) {
      const empty = new PIXI.Text('暂无奖励', {
        fontSize: 16,
        fill: COLORS.TEXT_LIGHT,
        fontFamily: FONT_FAMILY,
      });
      empty.anchor.set(0.5);
      empty.position.set(0, gridTop + gridH / 2);
      panelRoot.addChild(empty);
    } else {
      for (let i = 0; i < n; i++) {
        const cell = createItemObtainRewardCell(entries[i]!, { qtyFontSize: 26 });
        cell.scale.set(cellScale);
        const r = Math.floor(i / cols);
        const c = i % cols;
        cell.position.set(
          gridLeft + c * (CELL + GAP) + CELL / 2,
          gridTop + r * (CELL + GAP) + CELL / 2,
        );
        panelRoot.addChild(cell);
      }
    }

    const hint = new PIXI.Text('点击空白处关闭', {
      fontSize: 14,
      fill: COLORS.TEXT_LIGHT,
      fontFamily: FONT_FAMILY,
    });
    hint.anchor.set(0.5, 1);
    hint.position.set(0, hy - 16);
    hint.eventMode = 'static';
    hint.on('pointertap', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    panelRoot.addChild(hint);

    const closeBtn = new PIXI.Container();
    const cr = 16;
    const cbgClose = new PIXI.Graphics();
    cbgClose.beginFill(0xe57373, 0.95);
    cbgClose.drawCircle(0, 0, cr);
    cbgClose.endFill();
    cbgClose.lineStyle(2, 0xffffff, 0.92);
    const arm = 6;
    cbgClose.moveTo(-arm, -arm);
    cbgClose.lineTo(arm, arm);
    cbgClose.moveTo(arm, -arm);
    cbgClose.lineTo(-arm, arm);
    closeBtn.addChild(cbgClose);
    closeBtn.position.set(hx - 22, -hy + 26);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.hitArea = new PIXI.Circle(0, 0, cr + 10);
    closeBtn.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._dismiss();
    });
    panelRoot.addChild(closeBtn);

    this.addChild(panelRoot);
  }

  // ── 升星仪式 · 开放卡片区 ────────────────────────────

  private _appendOpenCardsSection(
    content: PIXI.Container,
    W: number,
    defs: LevelUnlockDef[],
  ): void {
    let hintNode: PIXI.Text | null = null;
    for (const child of content.children) {
      if (child instanceof PIXI.Text && (child as PIXI.Text).text === '点击继续') {
        hintNode = child as PIXI.Text;
        break;
      }
    }
    if (!hintNode) return;

    const allEntries = defs.flatMap(d => d.entries);
    if (allEntries.length === 0) return;

    const COLS = Math.min(3, allEntries.length);
    const COL_GAP = 8;
    const ROW_GAP = 8;
    const cardW = Math.floor(((W - 64) - (COLS - 1) * COL_GAP) / COLS);
    const startY = hintNode.y - 10;

    const divider = new PIXI.Graphics();
    divider.lineStyle(1, 0xDEC090, 0.35);
    divider.moveTo(W / 2 - 90, startY - 6);
    divider.lineTo(W / 2 + 90, startY - 6);
    divider.eventMode = 'none';
    content.addChild(divider);

    const ceremonyTitle = defs.length === 1
      ? `升星仪式 · ${defs[0]!.ceremonyTitle}`
      : '升星仪式 · 新内容开放';
    const header = new PIXI.Text(ceremonyTitle, {
      fontSize: 15,
      fill: 0xfff0c8,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x7a5c2e,
      strokeThickness: 2.5,
    });
    header.anchor.set(0.5, 0);
    header.position.set(W / 2, startY);
    header.eventMode = 'none';
    content.addChild(header);

    const gridTop = startY + 26;
    const gridLeft = (W - (COLS * cardW + (COLS - 1) * COL_GAP)) / 2;

    let curRow = 0;
    let rowMaxH = 0;
    let bottomY = gridTop;
    for (let i = 0; i < allEntries.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      if (row !== curRow) {
        bottomY += rowMaxH + ROW_GAP;
        rowMaxH = 0;
        curRow = row;
      }
      const { view, height } = createLevelUnlockCard(allEntries[i]!, {
        width: cardW,
        iconSize: 36,
        titleFontSize: 12,
        descFontSize: 10,
        padding: 6,
        maxHeight: 96,
      });
      view.position.set(gridLeft + col * (cardW + COL_GAP), bottomY);
      content.addChild(view);
      rowMaxH = Math.max(rowMaxH, height);
    }
    bottomY += rowMaxH;

    hintNode.position.y = bottomY + 14;
  }

  // ── 解锁家具展示区 ──────────────────────────────────

  private _appendUnlockSection(
    content: PIXI.Container,
    W: number,
    decos: DecoDef[],
    styles: { name: string }[],
  ): void {
    let hintNode: PIXI.Text | null = null;
    for (const child of content.children) {
      if (child instanceof PIXI.Text && (child as PIXI.Text).text === '点击继续') {
        hintNode = child as PIXI.Text;
        break;
      }
    }
    if (!hintNode) return;

    const COLS = 3;
    const MAX_SHOW = 9;
    const ICON_SIZE = 46;
    const CELL_W = 78;
    const CELL_H = 68;
    const COL_GAP = 6;
    const ROW_GAP = 4;
    const NAME_FONT = 11;

    const RARITY_ORDER: Record<string, number> = {
      [DecoRarity.LIMITED]: 0,
      [DecoRarity.RARE]: 1,
      [DecoRarity.FINE]: 2,
      [DecoRarity.COMMON]: 3,
    };
    const sorted = [...decos].sort(
      (a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9) || b.cost - a.cost,
    );

    const totalCount = sorted.length;
    const hasOverflow = totalCount > MAX_SHOW;
    const displayItems = hasOverflow ? sorted.slice(0, MAX_SHOW - 1) : sorted;

    const startY = hintNode.y - 10;

    const divider = new PIXI.Graphics();
    divider.lineStyle(1, 0xDEC090, 0.35);
    divider.moveTo(W / 2 - 90, startY - 6);
    divider.lineTo(W / 2 + 90, startY - 6);
    divider.eventMode = 'none';
    content.addChild(divider);

    const header = new PIXI.Text('解锁新家具', {
      fontSize: 15,
      fill: 0xfff0c8,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x7a5c2e,
      strokeThickness: 2.5,
    });
    header.anchor.set(0.5, 0);
    header.position.set(W / 2, startY);
    header.eventMode = 'none';
    content.addChild(header);

    if (styles.length > 0) {
      const styleNames = styles.map(s => s.name).join('、');
      const styleHint = new PIXI.Text(`新风格：${styleNames}`, {
        fontSize: 12,
        fill: 0xfff0c8,
        fontFamily: FONT_FAMILY,
        stroke: 0x5d4037,
        strokeThickness: 1.5,
      });
      styleHint.anchor.set(0.5, 0);
      styleHint.position.set(W / 2, startY + 20);
      styleHint.eventMode = 'none';
      content.addChild(styleHint);
    }

    const gridTop = startY + (styles.length > 0 ? 38 : 24);
    const gridW = COLS * CELL_W + (COLS - 1) * COL_GAP;
    const gridLeft = (W - gridW) / 2;

    const RARITY_BORDER_COLOR: Record<string, number> = {
      [DecoRarity.LIMITED]: 0xFF9800,
      [DecoRarity.RARE]: 0x64B5F6,
      [DecoRarity.FINE]: 0x81C784,
      [DecoRarity.COMMON]: 0xDEC090,
    };

    for (let i = 0; i < displayItems.length; i++) {
      const item = displayItems[i]!;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = gridLeft + col * (CELL_W + COL_GAP) + CELL_W / 2;
      const cellTop = gridTop + row * (CELL_H + ROW_GAP);

      const borderColor = RARITY_BORDER_COLOR[item.rarity] ?? 0xDEC090;
      const cellBg = new PIXI.Graphics();
      cellBg.beginFill(0x000000, 0.18);
      cellBg.drawRoundedRect(cx - CELL_W / 2, cellTop, CELL_W, CELL_H, 8);
      cellBg.endFill();
      cellBg.lineStyle(1, borderColor, 0.6);
      cellBg.drawRoundedRect(cx - CELL_W / 2, cellTop, CELL_W, CELL_H, 8);
      cellBg.eventMode = 'none';
      content.addChild(cellBg);

      const tex = TextureCache.get(item.icon);
      if (tex && tex.width > 0) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const scale = ICON_SIZE / Math.max(tex.width, tex.height);
        sp.scale.set(scale);
        sp.position.set(cx, cellTop + ICON_SIZE / 2 + 2);
        sp.eventMode = 'none';
        content.addChild(sp);
      }

      const name = new PIXI.Text(item.name, {
        fontSize: NAME_FONT,
        fill: 0xfff8e7,
        fontFamily: FONT_FAMILY,
        wordWrap: true,
        wordWrapWidth: CELL_W - 4,
        align: 'center',
      });
      name.anchor.set(0.5, 0);
      name.position.set(cx, cellTop + ICON_SIZE + 5);
      name.eventMode = 'none';
      content.addChild(name);
    }

    const displayRows = Math.ceil(displayItems.length / COLS);
    let bottomY = gridTop + displayRows * (CELL_H + ROW_GAP);

    if (hasOverflow) {
      const remaining = totalCount - displayItems.length;
      const overflow = new PIXI.Text(`等${remaining}件家具`, {
        fontSize: 13,
        fill: 0xdec8a0,
        fontFamily: FONT_FAMILY,
        fontWeight: 'bold',
        stroke: 0x5d4037,
        strokeThickness: 1.5,
      });
      overflow.anchor.set(0.5, 0);
      overflow.position.set(W / 2, bottomY + 2);
      overflow.eventMode = 'none';
      content.addChild(overflow);
      bottomY += 22;
    }

    hintNode.position.y = bottomY + 14;
  }

  private _dismiss(): void {
    if (this._dismissing) return;
    this._dismissing = true;

    const pending = this._pendingBoxItems;
    const preview = this._previewOnly;

    const finishClose = (): void => {
      this._fadeOutAndClose();
    };

    const grantBoxIfNeeded = (): void => {
      if (pending.length > 0 && !preview) {
        this._onGrantRewardBoxItems?.(pending);
      }
    };

    const tryBoxFly = (after: () => void): void => {
      if (
        !preview &&
        pending.length > 0 &&
        this._flySources.length > 0 &&
        this._rewardFlyTargetGlobal !== null &&
        this.parent
      ) {
        this._setPopupInteractive(false);
        this._playRewardFlyToBox(() => {
          grantBoxIfNeeded();
          after();
        });
      } else {
        grantBoxIfNeeded();
        after();
      }
    };

    const currencyItems: RewardFlyItem[] = [];
    if (!preview) {
      if (this._showHuayuan > 0) {
        currencyItems.push({ type: 'huayuan', textureKey: 'icon_huayuan', amount: this._showHuayuan });
      }
      if (this._showStamina > 0) {
        currencyItems.push({
          type: 'stamina',
          textureKey: 'stamina_chest_1',
          amount: this._showStamina,
        });
      }
      if (this._showDiamond > 0) {
        currencyItems.push({ type: 'diamond', textureKey: 'icon_gem', amount: this._showDiamond });
      }
    }

    const startGlobal = this.toGlobal(new PIXI.Point(DESIGN_WIDTH / 2, Game.logicHeight * 0.36));

    if (currencyItems.length > 0) {
      this._setPopupInteractive(false);
      RewardFlyCoordinator.playBatch(currencyItems, startGlobal, () => {
        tryBoxFly(finishClose);
      });
    } else {
      tryBoxFly(finishClose);
    }
  }

  private _setPopupInteractive(active: boolean): void {
    const mode: PIXI.EventMode = active ? 'static' : 'none';
    for (const c of this.children) {
      if ('eventMode' in c) (c as PIXI.Container).eventMode = mode;
    }
    this.eventMode = mode;
  }

  private _fadeOutAndClose(): void {
    TweenManager.cancelTarget(this);
    TweenManager.to({
      target: this,
      props: { alpha: 0 },
      duration: 0.28,
      ease: Ease.easeInQuad,
      onComplete: () => {
        const closedCb = this._onFullyClosed;
        if (this._dismissPointerArmTimer !== null) {
          clearTimeout(this._dismissPointerArmTimer);
          this._dismissPointerArmTimer = null;
        }
        this.removeAllListeners('pointertap');
        this.visible = false;
        this.removeChildren();
        this._dismissing = false;
        this._previewOnly = false;
        this._pendingBoxItems = [];
        this._flySources = [];
        this._rewardFlyTargetGlobal = null;
        this._onGrantRewardBoxItems = undefined;
        this._onFullyClosed = undefined;
        this._showHuayuan = 0;
        this._showStamina = 0;
        this._showDiamond = 0;
        closedCb?.();
      },
    });
  }

  private _playRewardFlyToBox(onArrived: () => void): void {
    if (this._flySources.length > 0) {
      AudioManager.play('customer_deliver', { bypassThrottle: true });
    }
    const parent = this.parent!;
    const endGlobal = this._rewardFlyTargetGlobal!;
    const endLocal = parent.toLocal(endGlobal);

    const flyLayer = new PIXI.Container();
    flyLayer.zIndex = 9500;
    parent.addChild(flyLayer);
    if ('sortableChildren' in parent) {
      (parent as PIXI.Container).sortableChildren = true;
      parent.sortChildren();
    }

    let remaining = this._flySources.length;
    const doneOne = (): void => {
      remaining--;
      if (remaining <= 0) {
        parent.removeChild(flyLayer);
        flyLayer.destroy({ children: true });
        onArrived();
      }
    };

    const baseIcon = 40;

    for (let i = 0; i < this._flySources.length; i++) {
      const src = this._flySources[i];
      const startGlobal = this.toGlobal(new PIXI.Point(src.x, src.y));
      const startLocal = parent.toLocal(startGlobal);

      const holder = new PIXI.Container();
      holder.position.set(startLocal.x, startLocal.y);
      flyLayer.addChild(holder);

      const tex = TextureCache.get(src.texKey);
      if (tex && tex.width > 0 && tex.height > 0) {
        const sp = new PIXI.Sprite(tex);
        sp.anchor.set(0.5);
        const k = baseIcon / Math.max(tex.width, tex.height);
        sp.scale.set(k);
        holder.addChild(sp);
      } else {
        const g = new PIXI.Graphics();
        g.beginFill(0x8d9b88);
        g.drawCircle(0, 0, baseIcon * 0.42);
        g.endFill();
        holder.addChild(g);
      }

      const o = { x: startLocal.x, y: startLocal.y, s: 1 };
      TweenManager.to({
        target: o,
        props: { x: endLocal.x, y: endLocal.y, s: 0.3 },
        duration: 0.52,
        delay: i * 0.075,
        ease: Ease.easeInQuad,
        onUpdate: () => {
          holder.position.set(o.x, o.y);
          holder.scale.set(o.s);
        },
        onComplete: () => {
          holder.destroy({ children: true });
          doneOne();
        },
      });
    }
  }
}
