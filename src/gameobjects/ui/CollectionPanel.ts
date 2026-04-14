/**
 * 图鉴面板 — 16 页扁平翻页式物品网格（参考四季物语）
 *
 * 壳体由 NB2 生成的笔记本风格贴图覆盖，内含：
 * - 金色标题栏（文字叠加）
 * - 金色进度条轨道（代码绘制填充）
 * - 红色关闭按钮（hitArea）
 * - 绿色左右翻页箭头（hitArea）
 *
 * 每页展示一条产品线的全部物品（按 level 排序），4 列网格。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { CollectionManager, CollectionCategory } from '@/managers/CollectionManager';
import { Category, type ItemDef, ITEM_DEFS } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import { RewardFlyCoordinator } from '@/core/RewardFlyCoordinator';
import { DESIGN_WIDTH, FONT_FAMILY, COLORS } from '@/config/Constants';

interface CollectionPage {
  collectionCat: CollectionCategory;
  itemCategory: Category;
  line: string;
  title: string;
}

const COLLECTION_PAGES: CollectionPage[] = [
  { collectionCat: CollectionCategory.FLOWER, itemCategory: Category.FLOWER, line: 'fresh',         title: '鲜花' },
  { collectionCat: CollectionCategory.FLOWER, itemCategory: Category.FLOWER, line: 'bouquet',       title: '花束' },
  { collectionCat: CollectionCategory.FLOWER, itemCategory: Category.FLOWER, line: 'green',         title: '绿植' },
  { collectionCat: CollectionCategory.FLOWER, itemCategory: Category.FLOWER, line: 'wrap',          title: '包装' },
  { collectionCat: CollectionCategory.DRINK,  itemCategory: Category.DRINK,  line: 'butterfly',     title: '蝴蝶' },
  { collectionCat: CollectionCategory.DRINK,  itemCategory: Category.DRINK,  line: 'cold',          title: '冷饮' },
  { collectionCat: CollectionCategory.DRINK,  itemCategory: Category.DRINK,  line: 'dessert',       title: '甜品' },
  { collectionCat: CollectionCategory.BUILDING, itemCategory: Category.BUILDING, line: 'plant',       title: '种植工具' },
  { collectionCat: CollectionCategory.BUILDING, itemCategory: Category.BUILDING, line: 'arrange',     title: '包装工具' },
  { collectionCat: CollectionCategory.BUILDING, itemCategory: Category.BUILDING, line: 'butterfly_net', title: '捕虫网' },
  { collectionCat: CollectionCategory.BUILDING, itemCategory: Category.BUILDING, line: 'mixer',       title: '饮品工具' },
  { collectionCat: CollectionCategory.BUILDING, itemCategory: Category.BUILDING, line: 'bake',        title: '烘焙工具' },
  { collectionCat: CollectionCategory.CHEST,  itemCategory: Category.CHEST,  line: 'chest',         title: '宝箱' },
  { collectionCat: CollectionCategory.CHEST,  itemCategory: Category.CHEST,  line: 'hongbao',       title: '红包' },
  { collectionCat: CollectionCategory.CHEST,  itemCategory: Category.CHEST,  line: 'diamond_bag',   title: '钻石袋' },
  { collectionCat: CollectionCategory.CHEST,  itemCategory: Category.CHEST,  line: 'stamina_chest', title: '体力箱' },
];

const GRID_COLS = 4;
const GRID_GAP_X = 4;
const GRID_GAP_Y = 2;

/**
 * 壳体图原始像素坐标（384×688 PNG）。
 * 运行时按 shellScale 缩放后映射到设计分辨率。
 */
const SHELL = {
  W: 384, H: 688,
  BANNER_CENTER_Y: 86,
  BAR_Y: 132, BAR_H: 32, BAR_X_LEFT: 80, BAR_X_RIGHT: 319,
  CLOSE_CX: 339, CLOSE_CY: 95, CLOSE_R: 22,
  LEFT_CX: 29, LEFT_CY: 374, ARROW_R: 28,
  RIGHT_CX: 354, RIGHT_CY: 345,
  CONTENT_TOP: 175,
  CONTENT_BOTTOM: 600,
};

export class CollectionPanel extends PIXI.Container {
  private _bg!: PIXI.Graphics;
  private _content!: PIXI.Container;
  private _scrollContainer!: PIXI.Container;
  private _isOpen = false;
  private _pageIndex = 0;
  private _scrollY = 0;
  private _maxScrollY = 0;

  constructor() {
    super();
    this.visible = false;
    this.zIndex = 5000;
    this._build();
    this._bindEvents();
  }

  get isOpen(): boolean { return this._isOpen; }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.visible = true;
    this._pageIndex = 0;
    this._scrollY = 0;
    this._refresh();

    this._bg.alpha = 0;
    this._content.alpha = 0;
    this._content.scale.set(0.85);
    TweenManager.to({ target: this._bg, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content, props: { alpha: 1 }, duration: 0.2, ease: Ease.easeOutQuad });
    TweenManager.to({ target: this._content.scale, props: { x: 1, y: 1 }, duration: 0.3, ease: Ease.easeOutBack });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    TweenManager.to({ target: this._bg, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad });
    TweenManager.to({
      target: this._content, props: { alpha: 0 }, duration: 0.15, ease: Ease.easeInQuad,
      onComplete: () => { this.visible = false; this.alpha = 1; },
    });
    TweenManager.to({ target: this._content.scale, props: { x: 0.9, y: 0.9 }, duration: 0.15, ease: Ease.easeInQuad });
  }

  private _bindEvents(): void {
    EventBus.on('panel:openCollection', () => this.open());
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

  /** 壳体图缩放系数与偏移 — 尽量填满屏幕，整体下移避开顶栏 */
  private _shellLayout() {
    const maxW = DESIGN_WIDTH - 16;
    const maxH = Game.logicHeight - 40;
    const scale = Math.min(maxW / SHELL.W, maxH / SHELL.H);
    const cx = DESIGN_WIDTH / 2;
    const cy = Game.logicHeight / 2 + 30;
    const ox = cx - (SHELL.W / 2) * scale;
    const oy = cy - (SHELL.H / 2) * scale;
    return { scale, cx, cy, ox, oy, panelW: SHELL.W * scale, panelH: SHELL.H * scale };
  }

  /** 壳体图像素坐标 → 设计分辨率坐标 */
  private _s2d(px: number, py: number): { x: number; y: number } {
    const { scale, ox, oy } = this._shellLayout();
    return { x: ox + px * scale, y: oy + py * scale };
  }

  private _refresh(): void {
    while (this._content.children.length > 0) {
      const child = this._content.children[0];
      this._content.removeChild(child);
      child.destroy({ children: true });
    }

    this._content.pivot.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._content.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);

    const layout = this._shellLayout();

    // NB2 壳体背景
    const shellTex = TextureCache.get('collection_panel_shell_nb2');
    if (shellTex) {
      const shell = new PIXI.Sprite(shellTex);
      shell.scale.set(layout.scale);
      shell.anchor.set(0.5, 0.5);
      shell.position.set(layout.cx, layout.cy);
      shell.eventMode = 'static';
      this._content.addChild(shell);
    } else {
      const bg = new PIXI.Graphics();
      bg.beginFill(0xFFFBF0);
      bg.drawRoundedRect(layout.ox, layout.oy, layout.panelW, layout.panelH, 20);
      bg.endFill();
      bg.eventMode = 'static';
      this._content.addChild(bg);
    }

    const page = COLLECTION_PAGES[this._pageIndex];
    const items = CollectionManager.getItemsForLine(page.itemCategory, page.line);
    const discoveredCount = CollectionManager.getLineDiscoveredCount(page.collectionCat, page.itemCategory, page.line);
    const totalCount = items.length;
    const progress = totalCount > 0 ? discoveredCount / totalCount : 0;

    // 标题（放在金色标题栏上，与家具面板同族描边样式）
    const bannerPos = this._s2d(SHELL.W / 2, SHELL.BANNER_CENTER_Y);
    const titleText = new PIXI.Text(page.title, {
      fontSize: 26,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x7a4530,
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: 0x5a2d10,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    } as any);
    titleText.anchor.set(0.5, 0.5);
    titleText.position.set(bannerPos.x, bannerPos.y);
    this._content.addChild(titleText);

    // 进度条（覆盖在壳体的进度条轨道上）
    const barLeft = this._s2d(SHELL.BAR_X_LEFT + 4, SHELL.BAR_Y + 4);
    const barRight = this._s2d(SHELL.BAR_X_RIGHT - 4, SHELL.BAR_Y + SHELL.BAR_H - 4);
    const barW = barRight.x - barLeft.x;
    const barH = barRight.y - barLeft.y;

    if (progress > 0) {
      const fillW = Math.max(barH, barW * Math.min(progress, 1));
      const barFill = new PIXI.Graphics();
      barFill.beginFill(0xFFCC33);
      barFill.drawRoundedRect(barLeft.x, barLeft.y, fillW, barH, barH / 2);
      barFill.endFill();
      this._content.addChild(barFill);

      const barShine = new PIXI.Graphics();
      barShine.beginFill(0xFFDD66, 0.5);
      barShine.drawRoundedRect(barLeft.x + 2, barLeft.y + 1, fillW - 4, barH / 2 - 1, (barH / 2) / 2);
      barShine.endFill();
      this._content.addChild(barShine);
    }

    // 进度数字（居中在进度条上）
    const barCenterX = (barLeft.x + barRight.x) / 2;
    const barCenterY = (barLeft.y + barRight.y) / 2;
    const countLabel = new PIXI.Text(`${discoveredCount}/${totalCount}`, {
      fontSize: 16, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      stroke: 0x996600, strokeThickness: 3,
    });
    countLabel.anchor.set(0.5, 0.5);
    countLabel.position.set(barCenterX, barCenterY);
    this._content.addChild(countLabel);

    // 宝箱固定区域高度（壳体底部预留）
    const chestZoneH = layout.scale * 90;

    // 滚动区域（壳体内的粉色边框内侧，底部留出宝箱区）
    const scrollTop = this._s2d(0, SHELL.CONTENT_TOP + 12);
    const scrollBottom = this._s2d(0, SHELL.CONTENT_BOTTOM);
    const scrollLeft = this._s2d(68, 0);
    const scrollRight = this._s2d(SHELL.W - 44, 0);
    const scrollAreaY = scrollTop.y;
    const scrollAreaH = scrollBottom.y - scrollTop.y - chestZoneH;
    const scrollAreaX = scrollLeft.x;
    const scrollAreaW = scrollRight.x - scrollLeft.x;

    const scrollMask = new PIXI.Graphics();
    scrollMask.beginFill(0xFFFFFF);
    scrollMask.drawRect(scrollAreaX, scrollAreaY, scrollAreaW, scrollAreaH);
    scrollMask.endFill();
    this._content.addChild(scrollMask);

    this._scrollContainer = new PIXI.Container();
    this._scrollContainer.mask = scrollMask;
    this._content.addChild(this._scrollContainer);

    // 物品网格 — 格子大小从可用宽度自动计算
    const gridPadX = 8;
    const availW = scrollAreaW - gridPadX * 2;
    const cellSize = Math.floor((availW - (GRID_COLS - 1) * GRID_GAP_X) / GRID_COLS);
    const cellStep = cellSize + GRID_GAP_X;
    const rowStep = cellSize + 18 + GRID_GAP_Y;
    const gridTotalW = GRID_COLS * cellSize + (GRID_COLS - 1) * GRID_GAP_X;
    const gridStartX = scrollAreaX + (scrollAreaW - gridTotalW) / 2;
    const gridY = scrollAreaY + 6;

    for (let i = 0; i < items.length; i++) {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const cellX = gridStartX + col * cellStep;
      const cellY = gridY + row * rowStep;

      this._drawItemCell(cellX, cellY, cellSize, items[i], page.collectionCat);
    }

    const totalRows = Math.ceil(items.length / GRID_COLS);
    const contentHeight = totalRows * rowStep + 10;
    this._maxScrollY = Math.max(0, contentHeight - scrollAreaH);
    this._scrollY = 0;
    this._scrollContainer.y = 0;

    // 滚动交互
    this._setupScrollInteraction(scrollAreaX, scrollAreaW, scrollAreaY, scrollAreaH);

    // 固定宝箱（位于滚动区域下方、壳体内底部）
    const chestFixedY = scrollAreaY + scrollAreaH + 54;
    this._drawRewardChest(layout.cx, chestFixedY, progress, cellSize);

    // 页码
    const pagePos = this._s2d(SHELL.W / 2, SHELL.CONTENT_BOTTOM - 2);
    const pageText = new PIXI.Text(`${this._pageIndex + 1}/${COLLECTION_PAGES.length}`, {
      fontSize: 16, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    });
    pageText.anchor.set(0.5, 0.5);
    pageText.position.set(pagePos.x, pagePos.y);
    this._content.addChild(pageText);

    // hitArea：关闭按钮（壳体图上的红色 X）
    this._addHitCircle(SHELL.CLOSE_CX, SHELL.CLOSE_CY, SHELL.CLOSE_R + 8, () => this.close());

    // hitArea：左翻页（壳体图上的绿色左箭头）
    if (this._pageIndex > 0) {
      this._addHitCircle(SHELL.LEFT_CX, SHELL.LEFT_CY, SHELL.ARROW_R + 10, () => {
        this._pageIndex--;
        this._scrollY = 0;
        this._refresh();
      });
    }

    // hitArea：右翻页（壳体图上的绿色右箭头）
    if (this._pageIndex < COLLECTION_PAGES.length - 1) {
      this._addHitCircle(SHELL.RIGHT_CX, SHELL.RIGHT_CY, SHELL.ARROW_R + 10, () => {
        this._pageIndex++;
        this._scrollY = 0;
        this._refresh();
      });
    }
  }

  /** 在壳体图坐标位置创建圆形 hitArea */
  private _addHitCircle(shellPx: number, shellPy: number, shellRadius: number, onClick: () => void): void {
    const pos = this._s2d(shellPx, shellPy);
    const { scale } = this._shellLayout();
    const r = shellRadius * scale;

    const hit = new PIXI.Container();
    hit.position.set(pos.x, pos.y);
    hit.hitArea = new PIXI.Circle(0, 0, r);
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onClick();
    });
    this._content.addChild(hit);
  }

  private _drawItemCell(x: number, y: number, size: number, def: ItemDef, collectionCat: CollectionCategory): void {
    const discovered = CollectionManager.isDiscovered(collectionCat, def.id);
    const cx = x + size / 2;
    const cy = y + size / 2;
    // 占位卡贴图有内边距，已解锁底板内缩保持视觉一致
    const inset = Math.round(size * 0.08);
    const cardSize = size - inset * 2;

    if (discovered) {
      const cardBg = new PIXI.Graphics();
      cardBg.beginFill(0xE8F4FF, 0.7);
      cardBg.drawRoundedRect(x + inset, y + inset, cardSize, cardSize, 10);
      cardBg.endFill();
      cardBg.lineStyle(1.5, 0xC0D8F0, 0.6);
      cardBg.drawRoundedRect(x + inset, y + inset, cardSize, cardSize, 10);
      this._scrollContainer.addChild(cardBg);

      const tex = TextureCache.get(def.icon);
      if (tex) {
        const sprite = new PIXI.Sprite(tex);
        const iconArea = cardSize - 12;
        const sc = Math.min(iconArea / sprite.texture.width, iconArea / sprite.texture.height);
        sprite.scale.set(sc);
        sprite.anchor.set(0.5, 0.5);
        sprite.position.set(cx, cy);
        this._scrollContainer.addChild(sprite);
      }

      const nameText = new PIXI.Text(def.name, {
        fontSize: 12, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      });
      nameText.anchor.set(0.5, 0);
      nameText.position.set(cx, y + inset + cardSize + 3);
      this._scrollContainer.addChild(nameText);
    } else {
      const placeholderTex = TextureCache.get('collection_item_placeholder_nb2');
      if (placeholderTex) {
        const sprite = new PIXI.Sprite(placeholderTex);
        const sc = Math.min(size / sprite.texture.width, size / sprite.texture.height);
        sprite.scale.set(sc);
        sprite.anchor.set(0.5, 0.5);
        sprite.position.set(cx, cy);
        this._scrollContainer.addChild(sprite);
      } else {
        const cardBg = new PIXI.Graphics();
        cardBg.beginFill(0xBBDDFF, 0.5);
        cardBg.drawRoundedRect(x + inset, y + inset, cardSize, cardSize, 10);
        cardBg.endFill();
        this._scrollContainer.addChild(cardBg);
      }

      const qText = new PIXI.Text('???', {
        fontSize: 12, fill: COLORS.TEXT_LIGHT, fontFamily: FONT_FAMILY,
      });
      qText.anchor.set(0.5, 0);
      qText.position.set(cx, y + inset + cardSize + 3);
      this._scrollContainer.addChild(qText);
    }
  }

  private _drawRewardChest(cx: number, y: number, progress: number, cellSize: number): void {
    const isFull = progress >= 1;
    const claimed = CollectionManager.isPageRewardClaimed(this._pageIndex);
    const chestSize = Math.round(cellSize * 0.9);

    const container = new PIXI.Container();
    container.position.set(cx, y);
    this._content.addChild(container);

    // 底座光圈
    const glow = new PIXI.Graphics();
    glow.beginFill(isFull && !claimed ? 0xFFD700 : 0xCCCCCC, isFull && !claimed ? 0.25 : 0.1);
    glow.drawEllipse(0, chestSize * 0.4, chestSize * 0.6, chestSize * 0.15);
    glow.endFill();
    container.addChild(glow);

    let spriteBottomY = chestSize * 0.55;
    const chestTex = TextureCache.get('stamina_chest_3');
    if (chestTex) {
      const sprite = new PIXI.Sprite(chestTex);
      const sc = Math.min(chestSize / sprite.texture.width, chestSize / sprite.texture.height);
      sprite.scale.set(sc);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(0, chestSize * 0.15);
      container.addChild(sprite);
      const halfH = (sprite.texture.height * sc) / 2;
      spriteBottomY = sprite.position.y + halfH;

      if (!isFull || claimed) {
        sprite.alpha = 0.35;
      }
    }

    let labelStr: string;
    let labelFill: number;
    if (claimed) {
      labelStr = '已领取';
      labelFill = 0x999999;
    } else if (isFull) {
      labelStr = '点击领取奖励';
      labelFill = 0xCC6600;
    } else {
      labelStr = '收集满可领取';
      labelFill = 0x999999;
    }
    const label = new PIXI.Text(labelStr, {
      fontSize: 13,
      fill: labelFill,
      fontFamily: FONT_FAMILY,
      fontWeight: isFull && !claimed ? 'bold' : 'normal',
    });
    label.anchor.set(0.5, 0);
    const labelGap = 8;
    label.position.set(0, spriteBottomY + labelGap);
    container.addChild(label);

    // 可领取时添加点击交互
    if (isFull && !claimed) {
      container.eventMode = 'static';
      container.cursor = 'pointer';
      const hitPad = 8;
      const hitH = spriteBottomY + labelGap + label.height + hitPad;
      container.hitArea = new PIXI.Rectangle(-chestSize / 2 - hitPad, -hitPad, chestSize + hitPad * 2, hitH + hitPad);
      container.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._claimPageReward(container);
      });
    }
  }

  /** 每页奖励物品 id（体力箱最高级） */
  private static readonly PAGE_REWARD_ITEM_ID = 'stamina_chest_3';

  private _claimPageReward(chestContainer: PIXI.Container): void {
    if (CollectionManager.isPageRewardClaimed(this._pageIndex)) return;
    CollectionManager.claimPageReward(this._pageIndex);

    const rewardId = CollectionPanel.PAGE_REWARD_ITEM_ID;
    const def = ITEM_DEFS.get(rewardId);
    if (!def) { this._refresh(); return; }

    const startGlobal = chestContainer.toGlobal(new PIXI.Point(0, 0));
    RewardFlyCoordinator.playBatch(
      [{
        type: 'rewardBox',
        textureKey: def.icon,
        amount: 1,
        itemId: rewardId,
      }],
      startGlobal,
      () => { this._refresh(); },
    );
  }

  private _setupScrollInteraction(areaX: number, areaW: number, areaY: number, areaH: number): void {
    let lastTouchY = 0;
    let isDragging = false;

    const hitArea = new PIXI.Container();
    hitArea.hitArea = new PIXI.Rectangle(areaX, areaY, areaW, areaH);
    hitArea.eventMode = 'static';

    hitArea.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      lastTouchY = e.globalY / Game.scale;
      isDragging = true;
    });
    hitArea.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!isDragging) return;
      const curTouchY = e.globalY / Game.scale;
      const delta = lastTouchY - curTouchY;
      lastTouchY = curTouchY;
      this._scrollY = Math.max(0, Math.min(this._maxScrollY, this._scrollY + delta));
      this._scrollContainer.y = -this._scrollY;
    });
    hitArea.on('pointerup', () => { isDragging = false; });
    hitArea.on('pointerupoutside', () => { isDragging = false; });

    this._content.addChild(hitArea);
  }
}
