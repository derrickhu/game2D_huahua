import * as PIXI from 'pixi.js';
import { COLORS, FONT_FAMILY } from '@/config/Constants';
import {
  WORKSHOP_BLUEPRINT_DEFS,
  WORKSHOP_CRAFT_CATEGORY_TABS,
  getBlueprintCraftCategory,
  getBlueprintDiamondCost,
  getBlueprintDisplayName,
  isBlueprintDiamondPurchasable,
  type WorkshopBlueprintDef,
  type WorkshopCraftCategoryFilter,
} from '@/config/FurnitureWorkshopConfig';
import { FurnitureWorkshopManager } from '@/managers/FurnitureWorkshopManager';
import { ToastMessage } from '@/gameobjects/ui/ToastMessage';
import { TextureCache } from '@/utils/TextureCache';
import { appendWorkshopBlueprintIcon, appendWorkshopBlueprintFeatureTags } from '@/utils/WorkshopBlueprintDisplay';
import { FurnitureWorkshopBlueprintPreviewPopup } from '@/gameobjects/ui/FurnitureWorkshopBlueprintPreviewPopup';

/** 与工坊壳体内缘对齐，占满 Tab 行～内容底（设计稿壳图 px） */
const WORKSHOP_SHELL_W = 680;
const WORKSHOP_SHELL_H = 1238;
const SHOP_HPAD_FRAC = 0.038;
/** 顶边：与工坊分类 Tab 行顶对齐（略覆盖嵌套感） */
export const SHOP_PAGE_TOP_FRAC = 0.278 + 25 / WORKSHOP_SHELL_H;
const SHOP_PAGE_BOTTOM_FRAC = 0.858 + 48 / WORKSHOP_SHELL_H;

const POP_W = Math.round(WORKSHOP_SHELL_W * (1 - SHOP_HPAD_FRAC * 2));
const POP_H = Math.round((SHOP_PAGE_BOTTOM_FRAC - SHOP_PAGE_TOP_FRAC) * WORKSHOP_SHELL_H);
const SHOP_ROW_H = 92;
const SHOP_ROW_GAP = 10;
const LIST_PAD = 20;
const TAB_ROW_Y = 58;
const TAB_ROW_H = 32;
const TAB_GAP = 6;
const LIST_TOP = TAB_ROW_Y + TAB_ROW_H + 10;
const PAGER_H = 44;
const CONTENT_BOTTOM = POP_H - 16;
const LIST_VIEWPORT_H = CONTENT_BOTTOM - LIST_TOP - PAGER_H;
const ROWS_PER_PAGE = Math.max(
  1,
  Math.floor((LIST_VIEWPORT_H + SHOP_ROW_GAP) / (SHOP_ROW_H + SHOP_ROW_GAP)),
);

/** 与主工坊面板（薰衣草紫壳）区分：暖蜜金外框 + 奶油内底 */
const SHOP_THEME = {
  FRAME: 0xf2c56d,
  CONTENT: 0xfffbf3,
  TITLE_STROKE: 0xa87328,
  SHADOW: 0x4a3210,
} as const;

function textStyle(base: Partial<PIXI.ITextStyle>): PIXI.ITextStyle {
  return { fontFamily: FONT_FAMILY, fill: COLORS.TEXT_DARK, ...base } as PIXI.ITextStyle;
}

function resolveBlueprintPreviewDecoId(blueprint: WorkshopBlueprintDef): string {
  return blueprint.colorOptions[0]?.outputDecoId ?? blueprint.outputDecoId;
}

function sortShopBlueprints(blueprints: WorkshopBlueprintDef[]): WorkshopBlueprintDef[] {
  return [...blueprints].sort((a, b) => {
    const aOwned = FurnitureWorkshopManager.hasBlueprint(a.id);
    const bOwned = FurnitureWorkshopManager.hasBlueprint(b.id);
    if (aOwned !== bOwned) return aOwned ? 1 : -1;
    return 0;
  });
}

function filterShopBlueprintsByCategory(
  blueprints: WorkshopBlueprintDef[],
  category: WorkshopCraftCategoryFilter,
): WorkshopBlueprintDef[] {
  if (category === 'all') return blueprints;
  return blueprints.filter(b => getBlueprintCraftCategory(b) === category);
}

function collectShopBlueprints(category: WorkshopCraftCategoryFilter): WorkshopBlueprintDef[] {
  const base = sortShopBlueprints(
    WORKSHOP_BLUEPRINT_DEFS.filter(
      b => isBlueprintDiamondPurchasable(b.id) || FurnitureWorkshopManager.hasBlueprint(b.id),
    ),
  );
  return filterShopBlueprintsByCategory(base, category);
}

export class FurnitureWorkshopShopPopup extends PIXI.Container {
  private _card!: PIXI.Container;
  private _categoryTabRow!: PIXI.Container;
  private _listContent!: PIXI.Container;
  private _pagerRow!: PIXI.Container;
  private _previewPopup!: FurnitureWorkshopBlueprintPreviewPopup;
  private _categoryFilter: WorkshopCraftCategoryFilter = 'all';
  private _pageIndex = 0;
  private _onClose: (() => void) | null = null;
  private _onChanged: (() => void) | null = null;

  constructor() {
    super();
    this.visible = false;
    this.eventMode = 'none';
    this.zIndex = 55;
    this._build();
  }

  open(onClose?: () => void, onChanged?: () => void): void {
    this._onClose = onClose ?? null;
    this._onChanged = onChanged ?? null;
    this._categoryFilter = 'all';
    this._pageIndex = 0;
    this.eventMode = 'static';
    this.visible = true;
    this._refresh();
  }

  close(): void {
    this._previewPopup.close();
    this.visible = false;
    this.eventMode = 'none';
    this._onClose?.();
    this._onClose = null;
    this._onChanged = null;
  }

  refresh(): void {
    if (this.visible) this._refresh();
  }

  private _build(): void {
    /** 半透明遮罩：弱化下层工坊列表，突出独立页面感 */
    const blocker = new PIXI.Graphics();
    blocker.beginFill(0x000000, 0.24);
    blocker.drawRect(-480, -480, 960, 1600);
    blocker.endFill();
    blocker.eventMode = 'static';
    blocker.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this.addChild(blocker);

    this._card = new PIXI.Container();
    this._card.position.set(-POP_W / 2, 0);
    this._card.eventMode = 'static';
    this._card.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());

    const shadow = new PIXI.Graphics();
    shadow.beginFill(SHOP_THEME.SHADOW, 0.16);
    shadow.drawRoundedRect(6, 10, POP_W, POP_H, 28);
    shadow.endFill();
    this._card.addChild(shadow);

    this.addChild(this._card);

    const bg = new PIXI.Graphics();
    bg.beginFill(SHOP_THEME.FRAME, 1);
    bg.drawRoundedRect(0, 0, POP_W, POP_H, 28);
    bg.endFill();
    bg.lineStyle(3, 0xffffff, 0.55);
    bg.drawRoundedRect(2, 2, POP_W - 4, POP_H - 4, 26);
    bg.beginFill(SHOP_THEME.CONTENT, 1);
    bg.drawRoundedRect(16, 56, POP_W - 32, POP_H - 72, 22);
    bg.endFill();
    this._card.addChild(bg);

    const title = new PIXI.Text('图纸商店', textStyle({
      fontSize: 32,
      fill: 0xffffff,
      fontWeight: '900',
      stroke: SHOP_THEME.TITLE_STROKE,
      strokeThickness: 4,
    }));
    title.anchor.set(0.5, 0);
    title.position.set(POP_W / 2, 14);
    this._card.addChild(title);

    const closeBtn = this._makeButton('×', 0xe85d75, 48, 48, () => this.close());
    closeBtn.position.set(POP_W - 36, 36);
    this._card.addChild(closeBtn);

    this._categoryTabRow = new PIXI.Container();
    this._categoryTabRow.position.set(LIST_PAD, TAB_ROW_Y);
    this._card.addChild(this._categoryTabRow);

    this._listContent = new PIXI.Container();
    this._listContent.position.set(LIST_PAD, LIST_TOP);
    this._card.addChild(this._listContent);

    this._pagerRow = new PIXI.Container();
    this._pagerRow.position.set(LIST_PAD, CONTENT_BOTTOM - PAGER_H);
    this._card.addChild(this._pagerRow);

    this._previewPopup = new FurnitureWorkshopBlueprintPreviewPopup();
    this._previewPopup.position.set(0, POP_H / 2);
    this.addChild(this._previewPopup);
  }

  private _refresh(): void {
    this._rebuildCategoryTabs();
    this._refreshList();
  }

  private _rebuildCategoryTabs(): void {
    this._categoryTabRow.removeChildren();
    const rowW = POP_W - LIST_PAD * 2;
    const tabCount = WORKSHOP_CRAFT_CATEGORY_TABS.length;
    const tabW = Math.floor((rowW - TAB_GAP * (tabCount - 1)) / tabCount);

    WORKSHOP_CRAFT_CATEGORY_TABS.forEach((def, i) => {
      const selected = this._categoryFilter === def.id;
      const tab = new PIXI.Container();
      tab.position.set(i * (tabW + TAB_GAP), 0);

      const bg = new PIXI.Graphics();
      bg.beginFill(selected ? 0xc4a8e8 : 0xe8dcff, 1);
      bg.drawRoundedRect(0, 0, tabW, TAB_ROW_H, TAB_ROW_H / 2);
      bg.endFill();
      if (selected) {
        bg.lineStyle(2, 0xffffff, 0.75);
        bg.drawRoundedRect(1, 1, tabW - 2, TAB_ROW_H - 2, TAB_ROW_H / 2 - 1);
      }
      tab.addChild(bg);

      const txt = new PIXI.Text(def.label, textStyle({
        fontSize: 16,
        fill: selected ? 0xffffff : 0x7a579b,
        fontWeight: '900',
      }));
      txt.anchor.set(0.5);
      txt.position.set(tabW / 2, TAB_ROW_H / 2);
      tab.addChild(txt);

      tab.eventMode = 'static';
      tab.cursor = 'pointer';
      tab.hitArea = new PIXI.Rectangle(0, 0, tabW, TAB_ROW_H);
      tab.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        if (this._categoryFilter === def.id) return;
        this._categoryFilter = def.id;
        this._pageIndex = 0;
        this._refreshList();
      });

      this._categoryTabRow.addChild(tab);
    });
  }

  private _refreshList(): void {
    this._listContent.removeChildren();
    this._pagerRow.removeChildren();
    const listW = POP_W - LIST_PAD * 2;

    const shopBlueprints = collectShopBlueprints(this._categoryFilter);
    if (shopBlueprints.length === 0) {
      this._renderEmpty(listW, '该分类暂无可购图纸', '切换其他分类，或等待后续版本上架。');
      this._rebuildPager(0);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(shopBlueprints.length / ROWS_PER_PAGE));
    if (this._pageIndex >= totalPages) this._pageIndex = totalPages - 1;
    if (this._pageIndex < 0) this._pageIndex = 0;

    const start = this._pageIndex * ROWS_PER_PAGE;
    const pageItems = shopBlueprints.slice(start, start + ROWS_PER_PAGE);

    let y = 0;
    for (const blueprint of pageItems) {
      const row = this._createShopRow(blueprint, listW);
      row.y = y;
      this._listContent.addChild(row);
      y += SHOP_ROW_H + SHOP_ROW_GAP;
    }

    this._rebuildPager(totalPages);
  }

  private _rebuildPager(totalPages: number): void {
    this._pagerRow.removeChildren();
    const listW = POP_W - LIST_PAD * 2;

    if (totalPages <= 1) return;

    const canPrev = this._pageIndex > 0;
    const canNext = this._pageIndex < totalPages - 1;

    const prevBtn = this._makePagerButton('上一页', canPrev, () => {
      if (this._pageIndex <= 0) return;
      this._pageIndex -= 1;
      this._refreshList();
    });
    prevBtn.position.set(64, PAGER_H / 2);
    this._pagerRow.addChild(prevBtn);

    const pageTxt = new PIXI.Text(`${this._pageIndex + 1} / ${totalPages}`, textStyle({
      fontSize: 18,
      fill: 0x735f52,
      fontWeight: '900',
    }));
    pageTxt.anchor.set(0.5);
    pageTxt.position.set(listW / 2, PAGER_H / 2);
    this._pagerRow.addChild(pageTxt);

    const nextBtn = this._makePagerButton('下一页', canNext, () => {
      if (this._pageIndex >= totalPages - 1) return;
      this._pageIndex += 1;
      this._refreshList();
    });
    nextBtn.position.set(listW - 64, PAGER_H / 2);
    this._pagerRow.addChild(nextBtn);
  }

  private _makePagerButton(label: string, enabled: boolean, onTap: () => void): PIXI.Container {
    const btn = new PIXI.Container();
    const w = 108;
    const h = 34;
    const bg = new PIXI.Graphics();
    bg.beginFill(enabled ? 0xc4a8e8 : 0xd8d0e8, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.endFill();
    if (enabled) {
      bg.lineStyle(2, 0xffffff, 0.7);
      bg.drawRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, h / 2 - 1);
    }
    btn.addChild(bg);

    const txt = new PIXI.Text(label, textStyle({
      fontSize: 16,
      fill: enabled ? 0xffffff : 0x9a8fb0,
      fontWeight: '900',
    }));
    txt.anchor.set(0.5);
    btn.addChild(txt);

    btn.eventMode = 'static';
    btn.cursor = enabled ? 'pointer' : 'default';
    btn.alpha = enabled ? 1 : 0.72;
    if (enabled) {
      btn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        onTap();
      });
    }
    return btn;
  }

  private _renderEmpty(listW: number, titleText: string, bodyText: string): void {
    const box = new PIXI.Graphics();
    box.beginFill(0xffffff, 0.92);
    box.drawRoundedRect(0, 8, listW, Math.min(200, LIST_VIEWPORT_H - 16), 20);
    box.endFill();
    this._listContent.addChild(box);

    const title = new PIXI.Text(titleText, textStyle({ fontSize: 24, fontWeight: '900', fill: SHOP_THEME.TITLE_STROKE }));
    title.anchor.set(0.5, 0);
    title.position.set(listW / 2, 36);
    this._listContent.addChild(title);

    const body = new PIXI.Text(bodyText, textStyle({
      fontSize: 18,
      fill: 0x735f52,
      lineHeight: 28,
      align: 'center',
      wordWrap: true,
      wordWrapWidth: listW - 64,
    }));
    body.anchor.set(0.5, 0);
    body.position.set(listW / 2, 78);
    this._listContent.addChild(body);
  }

  private _createShopRow(blueprint: WorkshopBlueprintDef, rowW: number): PIXI.Container {
    const root = new PIXI.Container();
    const owned = FurnitureWorkshopManager.hasBlueprint(blueprint.id);
    const previewDecoId = resolveBlueprintPreviewDecoId(blueprint);
    const displayName = getBlueprintDisplayName(blueprint);
    const diamondCost = getBlueprintDiamondCost(blueprint.id);
    const purchaseCheck = owned ? null : FurnitureWorkshopManager.canPurchaseBlueprint(blueprint.id);

    const bg = new PIXI.Graphics();
    bg.beginFill(0xffffff, 0.96);
    bg.drawRoundedRect(0, 0, rowW, SHOP_ROW_H, 16);
    bg.endFill();
    bg.lineStyle(2, owned ? 0x77c878 : 0xe8c98d, 0.9);
    bg.drawRoundedRect(1, 1, rowW - 2, SHOP_ROW_H - 2, 15);
    root.addChild(bg);

    const iconBox = new PIXI.Container();
    iconBox.position.set(52, SHOP_ROW_H / 2);
    appendWorkshopBlueprintIcon(iconBox, previewDecoId, 0, 0, 56);
    root.addChild(iconBox);

    const actionX = rowW - 78;
    const buyBtnHalfW = 66;
    const tagRight = actionX - buyBtnHalfW - 10;
    const nameMaxW = Math.max(72, tagRight - 96 - 10);

    const name = new PIXI.Text(displayName, textStyle({
      fontSize: 22,
      fill: 0x5c4938,
      fontWeight: '900',
      wordWrap: true,
      wordWrapWidth: nameMaxW,
    }));
    name.anchor.set(0, 0.5);
    name.position.set(96, SHOP_ROW_H / 2 - 10);
    root.addChild(name);

    const sub = new PIXI.Text(
      owned ? '已拥有图纸' : (blueprint.sourceText || '钻石购买'),
      textStyle({ fontSize: 16, fill: 0x9a8478, fontWeight: '700' }),
    );
    sub.anchor.set(0, 0.5);
    sub.position.set(96, SHOP_ROW_H / 2 + 16);
    root.addChild(sub);

    const previewHitW = Math.max(104, tagRight - 8);
    const previewHit = new PIXI.Container();
    previewHit.eventMode = 'static';
    previewHit.cursor = 'pointer';
    previewHit.hitArea = new PIXI.Rectangle(0, 0, previewHitW, SHOP_ROW_H);
    previewHit.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._previewPopup.open(blueprint);
    });
    root.addChild(previewHit);

    appendWorkshopBlueprintFeatureTags(root, blueprint, tagRight, SHOP_ROW_H / 2 - 12, {
      fontSize: 12,
      layout: 'vertical',
      align: 'right',
      gap: 4,
    });

    if (owned) {
      const badge = new PIXI.Text('已购买', textStyle({ fontSize: 18, fill: 0x58934b, fontWeight: '900' }));
      badge.anchor.set(0.5);
      badge.position.set(actionX, SHOP_ROW_H / 2);
      root.addChild(badge);
    } else if (diamondCost && purchaseCheck) {
      const canBuy = purchaseCheck.ok;
      const btn = this._createDiamondBuyButton(
        diamondCost,
        canBuy,
        canBuy ? 0x7eb8ff : 0xb9aaa4,
        132,
        44,
        () => {
          const result = FurnitureWorkshopManager.purchaseBlueprint(blueprint.id);
          if (result.ok) {
            ToastMessage.show('图纸购买成功');
            this._refresh();
            this._onChanged?.();
          } else {
            ToastMessage.show(this._purchaseReasonText(result.reason));
          }
        },
      );
      btn.position.set(actionX, SHOP_ROW_H / 2);
      root.addChild(btn);
    } else {
      const badge = new PIXI.Text('活动获得', textStyle({ fontSize: 17, fill: 0x9a7ab8, fontWeight: '900' }));
      badge.anchor.set(0.5);
      badge.position.set(actionX, SHOP_ROW_H / 2);
      root.addChild(badge);
    }

    return root;
  }

  private _purchaseReasonText(reason: string | undefined): string {
    switch (reason) {
      case 'already_owned': return '已拥有该图纸';
      case 'not_purchasable': return '该图纸不可钻石购买';
      case 'not_enough_diamond': return '钻石不足';
      default: return '暂时无法购买';
    }
  }

  private _makeButton(label: string, color: number, w: number, h: number, onTap: () => void): PIXI.Container {
    const btn = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(color, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.endFill();
    bg.lineStyle(3, 0xffffff, 0.85);
    bg.drawRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, h / 2 - 2);
    btn.addChild(bg);

    const txt = new PIXI.Text(label, textStyle({
      fontSize: label === '×' ? 34 : 21,
      fill: 0xffffff,
      fontWeight: '900',
    }));
    txt.anchor.set(0.5);
    txt.y = label === '×' ? -2 : 0;
    btn.addChild(txt);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onTap();
    });
    return btn;
  }

  private _createDiamondBuyButton(
    cost: number,
    canBuy: boolean,
    color: number,
    w: number,
    h: number,
    onTap: () => void,
  ): PIXI.Container {
    const btn = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(color, 1);
    bg.drawRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.endFill();
    bg.lineStyle(3, 0xffffff, 0.85);
    bg.drawRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, h / 2 - 2);
    btn.addChild(bg);

    const labelStyle = textStyle({ fontSize: 20, fill: 0xffffff, fontWeight: '900' });
    const costText = new PIXI.Text(String(cost), labelStyle);
    costText.anchor.set(0, 0.5);

    const gemSize = 22;
    const gemTex = TextureCache.get('icon_gem');
    const gem = new PIXI.Sprite(gemTex ?? PIXI.Texture.EMPTY);
    gem.anchor.set(0.5, 0.5);
    if (gemTex?.width) gem.scale.set(gemSize / Math.max(gemTex.width, gemTex.height));

    const actionText = new PIXI.Text(canBuy ? '购买' : '不足', labelStyle);
    actionText.anchor.set(0, 0.5);

    const gap = 3;
    const totalW = costText.width + gap + gemSize + gap + actionText.width;
    let x = -totalW / 2;
    costText.position.set(x, 0);
    x += costText.width + gap;
    gem.position.set(x + gemSize / 2, 0);
    x += gemSize + gap;
    actionText.position.set(x, 0);

    const row = new PIXI.Container();
    row.addChild(costText, gem, actionText);
    btn.addChild(row);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      onTap();
    });
    return btn;
  }
}
