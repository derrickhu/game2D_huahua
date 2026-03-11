/**
 * 仓库面板 - 从底部上滑弹出，展示仓库格子
 *
 * 布局：
 * ┌──────────────────────────────┐
 * │   仓库 X/Y       [+扩容]     │
 * │ [格1] [格2] [格3] [格4] ...  │
 * └──────────────────────────────┘
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
import { ToastMessage } from './ToastMessage';
import { ConfirmDialog } from './ConfirmDialog';

const PANEL_HEIGHT = 200;
const SLOT_SIZE = 64;
const SLOT_GAP = 10;
const SLOTS_Y = 80;

export class WarehousePanel extends PIXI.Container {
  private _overlay!: PIXI.Graphics;
  private _panel!: PIXI.Container;
  private _panelBg!: PIXI.Graphics;
  private _titleText!: PIXI.Text;
  private _expandBtn!: PIXI.Container;
  private _expandText!: PIXI.Text;
  private _slotContainer!: PIXI.Container;
  private _isOpen = false;

  constructor() {
    super();
    this.visible = false;
    this._buildOverlay();
    this._buildPanel();
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

  private _buildPanel(): void {
    this._panel = new PIXI.Container();
    this._panel.position.set(0, Game.logicHeight - PANEL_HEIGHT);

    // 面板背景
    this._panelBg = new PIXI.Graphics();
    this._panelBg.beginFill(0xFFF8F0);
    this._panelBg.drawRoundedRect(0, 0, DESIGN_WIDTH, PANEL_HEIGHT + 40, 20);
    this._panelBg.endFill();
    // 拖拽把手
    this._panelBg.beginFill(0xE8D5C0);
    this._panelBg.drawRoundedRect(DESIGN_WIDTH / 2 - 30, 8, 60, 4, 2);
    this._panelBg.endFill();
    this._panelBg.eventMode = 'static';
    this._panel.addChild(this._panelBg);

    // 标题
    this._titleText = new PIXI.Text('', {
      fontSize: 17,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._titleText.anchor.set(0, 0.5);
    this._titleText.position.set(30, 40);
    this._panel.addChild(this._titleText);

    // 扩容按钮
    this._expandBtn = new PIXI.Container();
    const btnBg = new PIXI.Graphics();
    btnBg.beginFill(0x9370DB);
    btnBg.drawRoundedRect(-45, -16, 90, 32, 8);
    btnBg.endFill();
    this._expandBtn.addChild(btnBg);

    this._expandText = new PIXI.Text('', {
      fontSize: 13,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._expandText.anchor.set(0.5, 0.5);
    this._expandBtn.addChild(this._expandText);

    this._expandBtn.position.set(DESIGN_WIDTH - 80, 40);
    this._expandBtn.eventMode = 'static';
    this._expandBtn.cursor = 'pointer';
    this._expandBtn.hitArea = new PIXI.Rectangle(-50, -20, 100, 40);
    this._expandBtn.on('pointerdown', () => this._onExpandTap());
    this._panel.addChild(this._expandBtn);

    // 格子容器
    this._slotContainer = new PIXI.Container();
    this._slotContainer.position.set(0, SLOTS_Y);
    this._panel.addChild(this._slotContainer);

    this.addChild(this._panel);
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

    this._overlay.alpha = 0;
    this._panel.position.y = Game.logicHeight;
    TweenManager.to({
      target: this._overlay,
      props: { alpha: 1 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._panel.position,
      props: { y: Game.logicHeight - PANEL_HEIGHT },
      duration: 0.3,
      ease: Ease.easeOutBack,
    });
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;

    TweenManager.to({
      target: this._overlay,
      props: { alpha: 0 },
      duration: 0.2,
      ease: Ease.easeOutQuad,
    });
    TweenManager.to({
      target: this._panel.position,
      props: { y: Game.logicHeight },
      duration: 0.25,
      ease: Ease.easeInQuad,
      onComplete: () => {
        this.visible = false;
      },
    });
  }

  get isOpen(): boolean { return this._isOpen; }

  private _refreshSlots(): void {
    // 清理旧格子
    while (this._slotContainer.children.length > 0) {
      const child = this._slotContainer.children[0];
      this._slotContainer.removeChild(child);
      child.destroy({ children: true });
    }

    const cap = WarehouseManager.capacity;
    const items = WarehouseManager.items;
    const totalW = cap * SLOT_SIZE + (cap - 1) * SLOT_GAP;
    const startX = (DESIGN_WIDTH - totalW) / 2;

    // 标题
    this._titleText.text = `🧺 仓库 ${WarehouseManager.usedSlots}/${cap}`;

    // 扩容按钮
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

    // 格子背景
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

    // 空格虚线边框
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
        // 物品图标
        const iconSize = SLOT_SIZE - 16;
        const tex = TextureCache.get(def.icon);
        if (tex) {
          const sprite = new PIXI.Sprite(tex);
          const s = Math.min(iconSize / tex.width, iconSize / tex.height);
          sprite.scale.set(s);
          sprite.anchor.set(0.5, 0.5);
          sprite.position.set(SLOT_SIZE / 2, SLOT_SIZE / 2 - 4);
          slot.addChild(sprite);
        } else {
          // Fallback
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

        // 短名
        const name = new PIXI.Text(
          def.name.length > 3 ? def.name.substring(0, 3) : def.name,
          { fontSize: 10, fill: COLORS.TEXT_DARK, fontFamily: FONT_FAMILY },
        );
        name.anchor.set(0.5, 1);
        name.position.set(SLOT_SIZE / 2, SLOT_SIZE - 2);
        slot.addChild(name);

        // 等级
        const lvBg = new PIXI.Graphics();
        lvBg.beginFill(this._getLineColor(def.line), 0.85);
        lvBg.drawCircle(0, 0, 8);
        lvBg.endFill();
        lvBg.position.set(SLOT_SIZE - 10, 10);
        slot.addChild(lvBg);

        const lv = new PIXI.Text(`${def.level}`, {
          fontSize: 10, fill: 0xFFFFFF, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        });
        lv.anchor.set(0.5, 0.5);
        lv.position.set(SLOT_SIZE - 10, 10);
        slot.addChild(lv);
      }

      // 点击取出
      slot.eventMode = 'static';
      slot.cursor = 'pointer';
      slot.hitArea = new PIXI.Rectangle(0, 0, SLOT_SIZE, SLOT_SIZE);
      slot.on('pointerdown', () => this._onSlotTap(index));
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
      ToastMessage.show(`已取出到棋盘`);
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
      daily: COLORS.FLOWER_DAILY, romantic: COLORS.FLOWER_ROMANTIC,
      luxury: COLORS.FLOWER_LUXURY, tea: COLORS.DRINK_TEA,
      cold: COLORS.DRINK_COLD, dessert: COLORS.DRINK_DESSERT,
    };
    return map[line] || 0x999999;
  }

  private _getCategoryEmoji(category: Category): string {
    switch (category) {
      case Category.FLOWER: return '🌸';
      case Category.DRINK: return '🍵';
      case Category.BUILDING_MAT: return '🧱';
      case Category.CHEST: return '📦';
      default: return '❓';
    }
  }
}
