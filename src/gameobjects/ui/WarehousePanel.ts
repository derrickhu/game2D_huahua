/**
 * 仓库面板 - 居中弹出，花篮整图底 + 程序绘制格子
 *
 * 底图：warehouse_panel_bg（768×1376，与 NB2 v2 一致）
 * 标题 / 扩容 / 格子叠在紫色顶栏与奶油内区（坐标按纹理中心为原点微调）
 */
import * as PIXI from 'pixi.js';
import { EventBus } from '@/core/EventBus';
import { TweenManager, Ease } from '@/core/TweenManager';
import { Game } from '@/core/Game';
import { DESIGN_WIDTH, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, Category } from '@/config/ItemConfig';
import { WarehouseManager } from '@/managers/WarehouseManager';
import { BoardManager } from '@/managers/BoardManager';
import { CurrencyManager } from '@/managers/CurrencyManager';
import { TextureCache } from '@/utils/TextureCache';
import { createToolEnergySprite, isBoardToolCategory } from '@/utils/ToolEnergyBadge';
import { ToastMessage } from './ToastMessage';
import { ConfirmDialog } from './ConfirmDialog';

/** 与生成图一致，用于对齐 UI */
const TEX_W = 768;
const TEX_H = 1376;

const SLOT_SIZE = 64;
const SLOT_GAP = 10;
/** 奶油区内一行格子的最大宽度（纹理像素），超出则整体缩小 */
const SLOTS_ROW_MAX_W = 520;

/** 相对纹理中心（锚点 0.5）的像素偏移，可按美术微调 */
const TITLE_OFFSET_X = -268;
const TITLE_OFFSET_Y = -568;
const EXPAND_OFFSET_X = 248;
const EXPAND_OFFSET_Y = -568;
const SLOTS_OFFSET_Y = -98;

export class WarehousePanel extends PIXI.Container {
  private _overlay!: PIXI.Graphics;
  /** 整块弹窗内容，用于缩放动画 */
  private _content!: PIXI.Container;
  private _basketSprite!: PIXI.Sprite;
  private _titleText!: PIXI.Text;
  private _expandBtn!: PIXI.Container;
  private _expandText!: PIXI.Text;
  private _slotContainer!: PIXI.Container;
  private _isOpen = false;

  constructor() {
    super();
    this.visible = false;
    this._buildOverlay();
    this._buildContent();
    this._bindEvents();
  }

  private _buildOverlay(): void {
    this._overlay = new PIXI.Graphics();
    this._overlay.beginFill(0x000000, 0.5);
    this._overlay.drawRect(0, 0, DESIGN_WIDTH, Game.logicHeight);
    this._overlay.endFill();
    this._overlay.eventMode = 'static';
    this._overlay.on('pointerdown', () => this.close());
    this.addChild(this._overlay);
  }

  private _buildContent(): void {
    this._content = new PIXI.Container();
    this._content.position.set(DESIGN_WIDTH / 2, Game.logicHeight / 2);
    this._content.eventMode = 'static';

    // 透明区不响应花篮 Sprite 的点击时，仍拦截事件，避免点到遮罩层误关面板
    const tapBlock = new PIXI.Sprite(PIXI.Texture.WHITE);
    tapBlock.anchor.set(0.5);
    tapBlock.width = TEX_W;
    tapBlock.height = TEX_H;
    tapBlock.alpha = 0;
    tapBlock.eventMode = 'static';
    tapBlock.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._content.addChild(tapBlock);

    const tex = TextureCache.get('warehouse_panel_bg');
    this._basketSprite = new PIXI.Sprite(tex ?? PIXI.Texture.EMPTY);
    this._basketSprite.anchor.set(0.5);
    this._basketSprite.position.set(0, 0);
    this._basketSprite.eventMode = 'static';
    this._basketSprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._content.addChild(this._basketSprite);

    this._titleText = new PIXI.Text('', {
      fontSize: 26,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      dropShadow: true,
      dropShadowColor: 0x3d2b50,
      dropShadowBlur: 2,
      dropShadowDistance: 1,
    });
    this._titleText.anchor.set(0, 0.5);
    this._titleText.position.set(TITLE_OFFSET_X, TITLE_OFFSET_Y);
    this._titleText.eventMode = 'static';
    this._titleText.on('pointerdown', (e: PIXI.FederatedPointerEvent) => e.stopPropagation());
    this._content.addChild(this._titleText);

    this._expandBtn = new PIXI.Container();
    const btnBg = new PIXI.Graphics();
    btnBg.beginFill(0x9370DB, 0.92);
    btnBg.drawRoundedRect(-52, -18, 104, 36, 10);
    btnBg.endFill();
    btnBg.lineStyle(2, 0xffffff, 0.35);
    btnBg.drawRoundedRect(-52, -18, 104, 36, 10);
    this._expandBtn.addChild(btnBg);

    this._expandText = new PIXI.Text('', {
      fontSize: 15,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._expandText.anchor.set(0.5, 0.5);
    this._expandBtn.addChild(this._expandText);

    this._expandBtn.position.set(EXPAND_OFFSET_X, EXPAND_OFFSET_Y);
    this._expandBtn.eventMode = 'static';
    this._expandBtn.cursor = 'pointer';
    this._expandBtn.hitArea = new PIXI.Rectangle(-56, -22, 112, 44);
    this._expandBtn.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      this._onExpandTap();
    });
    this._content.addChild(this._expandBtn);

    this._slotContainer = new PIXI.Container();
    this._slotContainer.position.set(0, SLOTS_OFFSET_Y);
    this._content.addChild(this._slotContainer);

    this.addChild(this._content);
  }

  private _bindEvents(): void {
    EventBus.on('warehouse:changed', () => {
      if (this._isOpen) this._refreshSlots();
    });
  }

  open(): void {
    this._isOpen = true;
    this.visible = true;
    this._refreshSlots();

    const tw = this._basketSprite.texture?.width || TEX_W;
    const th = this._basketSprite.texture?.height || TEX_H;
    const s1 = Math.min((DESIGN_WIDTH - 36) / tw, (Game.logicHeight - 72) / th, 1);
    const s0 = s1 * 0.92;
    this._content.scale.set(s0);

    this._overlay.alpha = 0;
    this._content.alpha = 0;

    TweenManager.to({
      target: this._overlay,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._content,
      props: { alpha: 1 },
      duration: 0.28,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._content.scale,
      props: { x: s1, y: s1 },
      duration: 0.32,
      ease: Ease.easeOutBack,
    });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;

    const s0 = this._content.scale.x * 0.92;

    TweenManager.to({
      target: this._overlay,
      props: { alpha: 0 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._content,
      props: { alpha: 0 },
      duration: 0.22,
      ease: Ease.easeInQuad,
    });
    TweenManager.to({
      target: this._content.scale,
      props: { x: s0, y: s0 },
      duration: 0.22,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
      },
    });
  }

  get isOpen(): boolean { return this._isOpen; }

  private _refreshSlots(): void {
    while (this._slotContainer.children.length > 0) {
      const child = this._slotContainer.children[0];
      this._slotContainer.removeChild(child);
      child.destroy({ children: true });
    }

    const cap = WarehouseManager.capacity;
    const items = WarehouseManager.items;
    const totalW = cap * SLOT_SIZE + (cap - 1) * SLOT_GAP;
    const rowScale = Math.min(1, SLOTS_ROW_MAX_W / totalW);
    this._slotContainer.scale.set(rowScale);

    const startX = -totalW / 2;

    this._titleText.text = `🧺 仓库 ${WarehouseManager.usedSlots}/${cap}`;

    if (WarehouseManager.canExpand) {
      this._expandBtn.visible = true;
      this._expandText.text = `+扩容 💎${WarehouseManager.expandCost}`;
    } else {
      this._expandBtn.visible = false;
    }

    for (let i = 0; i < cap; i++) {
      const slot = this._createSlot(i, items[i] || null);
      slot.position.set(startX + i * (SLOT_SIZE + SLOT_GAP), 0);
      this._slotContainer.addChild(slot);
    }
  }

  private _createSlot(index: number, itemId: string | null): PIXI.Container {
    const slot = new PIXI.Container();

    const bg = new PIXI.Graphics();
    if (itemId) {
      bg.lineStyle(1.5, 0xD4C4B0);
      bg.beginFill(0xFFFEFC);
    } else {
      bg.lineStyle(1.5, 0xCCCCCC, 0.5);
      bg.beginFill(0xF5F0EA, 0.5);
    }
    bg.drawRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE, 8);
    bg.endFill();

    if (!itemId) {
      bg.lineStyle(1, 0xCCCCCC, 0.6);
      const d = 6;
      for (let x = d; x < SLOT_SIZE - d; x += 8) {
        bg.moveTo(x, d);
        bg.lineTo(Math.min(x + 4, SLOT_SIZE - d), d);
        bg.moveTo(x, SLOT_SIZE - d);
        bg.lineTo(Math.min(x + 4, SLOT_SIZE - d), SLOT_SIZE - d);
      }
      for (let y = d; y < SLOT_SIZE - d; y += 8) {
        bg.moveTo(d, y);
        bg.lineTo(d, Math.min(y + 4, SLOT_SIZE - d));
        bg.moveTo(SLOT_SIZE - d, y);
        bg.lineTo(SLOT_SIZE - d, Math.min(y + 4, SLOT_SIZE - d));
      }
    }
    slot.addChild(bg);

    if (itemId) {
      const def = ITEM_DEFS.get(itemId);
      if (def) {
        const iconSize = SLOT_SIZE - 16;
        const tex = TextureCache.get(def.icon);
        if (tex) {
          const sprite = new PIXI.Sprite(tex);
          const sc = Math.min(iconSize / tex.width, iconSize / tex.height);
          sprite.scale.set(sc);
          sprite.anchor.set(0.5, 0.5);
          sprite.position.set(SLOT_SIZE / 2, SLOT_SIZE / 2 - 4);
          slot.addChild(sprite);
          if (isBoardToolCategory(def.category)) {
            const energy = createToolEnergySprite(SLOT_SIZE, SLOT_SIZE, { maxSideFrac: 0.30, pad: 5 });
            if (energy) slot.addChild(energy);
          }
        } else {
          const circle = new PIXI.Graphics();
          circle.beginFill(this._getLineColor(def.line), 0.3);
          circle.drawCircle(SLOT_SIZE / 2, SLOT_SIZE / 2 - 4, iconSize / 2 - 2);
          circle.endFill();
          slot.addChild(circle);

          const emoji = new PIXI.Text(this._getCategoryEmoji(def.category), {
            fontSize: 16,
            fontFamily: FONT_FAMILY,
          });
          emoji.anchor.set(0.5, 0.5);
          emoji.position.set(SLOT_SIZE / 2, SLOT_SIZE / 2 - 6);
          slot.addChild(emoji);
        }

        const name = new PIXI.Text(
          def.name.length > 3 ? def.name.substring(0, 3) : def.name,
          { fontSize: 10, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY },
        );
        name.anchor.set(0.5, 1);
        name.position.set(SLOT_SIZE / 2, SLOT_SIZE - 2);
        slot.addChild(name);

        const lvBg = new PIXI.Graphics();
        lvBg.beginFill(this._getLineColor(def.line), 0.85);
        lvBg.drawCircle(0, 0, 8);
        lvBg.endFill();
        lvBg.position.set(SLOT_SIZE - 10, 10);
        slot.addChild(lvBg);

        const lv = new PIXI.Text(`${def.level}`, {
          fontSize: 10, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        });
        lv.anchor.set(0.5, 0.5);
        lv.position.set(SLOT_SIZE - 10, 10);
        slot.addChild(lv);
      }

      slot.eventMode = 'static';
      slot.cursor = 'pointer';
      slot.hitArea = new PIXI.Rectangle(0, 0, SLOT_SIZE, SLOT_SIZE);
      slot.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation();
        this._onSlotTap(index);
      });
    }

    return slot;
  }

  private _onSlotTap(index: number): void {
    const emptyCell = BoardManager.findEmptyOpenCell();
    if (emptyCell < 0) {
      ToastMessage.show('棋盘已满，请先合成或出售物品腾出空间');
      return;
    }

    const itemId = WarehouseManager.retrieveItem(index);
    if (itemId) {
      BoardManager.placeItem(emptyCell, itemId);
      ToastMessage.show('已取出到棋盘');
    }
  }

  private async _onExpandTap(): Promise<void> {
    if (!WarehouseManager.canExpand) return;
    const cost = WarehouseManager.expandCost;
    const newCap = WarehouseManager.capacity + 1;

    const confirmed = await ConfirmDialog.show(
      '扩容仓库',
      `消耗 ${cost} 💎钻石扩容仓库至 ${newCap} 格？\n当前钻石：${Math.floor(CurrencyManager.state.diamond)}`,
      `扩容（${cost}💎）`,
      '取消',
    );
    if (!confirmed) return;

    if (!WarehouseManager.expand()) {
      ToastMessage.show('钻石不足');
    }
  }

  private _getLineColor(line: string): number {
    const map: Record<string, number> = {
      fresh: COLORS.FLOWER_FRESH, bouquet: COLORS.FLOWER_BOUQUET,
      green: COLORS.FLOWER_GREEN, tea: COLORS.DRINK_TEA,
      cold: COLORS.DRINK_COLD, dessert: COLORS.DRINK_DESSERT,
    };
    return map[line] || 0x999999;
  }

  private _getCategoryEmoji(category: Category): string {
    switch (category) {
      case Category.FLOWER: return '🌸';
      case Category.DRINK: return '🍵';
      case Category.BUILDING: return '🏠';
      case Category.CHEST: return '📦';
      default: return '❓';
    }
  }
}
