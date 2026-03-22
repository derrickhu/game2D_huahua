/**
 * 物品视图 - 在格子中显示物品图标和等级
 */
import * as PIXI from 'pixi.js';
import { BoardMetrics, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, Category, FlowerLine, DrinkLine } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';
import {
  bringToolEnergyToFront,
  createToolEnergySprite,
  isBoardToolCategory,
} from '@/utils/ToolEnergyBadge';

/** 格子内物品最大边长占格子的比例（其余为边距） */
const ITEM_CELL_FILL = 0.72;
/** 花束线资源留白多，在格子里单独放大，边距更小 */
const BOUQUET_CELL_FILL = 0.9;

export class ItemView extends PIXI.Container {
  private _iconBg: PIXI.Graphics;
  private _iconSprite: PIXI.Sprite | null = null;
  private _nameText: PIXI.Text;
  private _levelText: PIXI.Text;
  private _levelBg: PIXI.Graphics;
  private _cdOverlay: PIXI.Graphics;
  private _cdText: PIXI.Text;
  private _usesText: PIXI.Text;
  private _lockBorder: PIXI.Graphics;
  /** 工具右下角体力标 */
  private _toolEnergySprite: PIXI.Sprite | null = null;

  private _itemId: string = '';

  constructor() {
    super();
    const cs = BoardMetrics.cellSize;

    // 图标占位背景（无纹理时的 fallback）
    this._iconBg = new PIXI.Graphics();
    this.addChild(this._iconBg);

    // 物品名字（fallback 时显示）
    this._nameText = new PIXI.Text('', {
      fontSize: 11,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: cs - 8,
      align: 'center',
    });
    this._nameText.anchor.set(0.5, 1);
    this._nameText.position.set(cs / 2, cs - 2);
    this.addChild(this._nameText);

    // 等级徽章背景
    this._levelBg = new PIXI.Graphics();
    this.addChild(this._levelBg);

    // 等级文字
    this._levelText = new PIXI.Text('', {
      fontSize: 10,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._levelText.anchor.set(0.5, 0.5);
    this.addChild(this._levelText);

    // CD 冷却遮罩
    this._cdOverlay = new PIXI.Graphics();
    this._cdOverlay.visible = false;
    this.addChild(this._cdOverlay);

    // CD 倒计时文字
    this._cdText = new PIXI.Text('', {
      fontSize: 14,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 2,
    });
    this._cdText.anchor.set(0.5, 0.5);
    this._cdText.position.set(cs / 2, cs / 2);
    this._cdText.visible = false;
    this.addChild(this._cdText);

    // 客人锁定边框
    this._lockBorder = new PIXI.Graphics();
    this._lockBorder.visible = false;
    this.addChild(this._lockBorder);

    // 消耗型剩余次数（左下角）
    this._usesText = new PIXI.Text('', {
      fontSize: 10,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 2,
    });
    this._usesText.anchor.set(0, 1);
    this._usesText.position.set(4, cs - 2);
    this._usesText.visible = false;
    this.addChild(this._usesText);
  }

  setItem(itemId: string | null): void {
    if (!itemId) {
      this.visible = false;
      this._itemId = '';
      this._hideToolEnergy();
      return;
    }

    const def = ITEM_DEFS.get(itemId);
    if (!def) {
      this.visible = false;
      this._hideToolEnergy();
      return;
    }

    this._itemId = itemId;
    this.visible = true;
    const cs = BoardMetrics.cellSize;

    const lineColor = this._getLineColor(def.line);

    // 清理旧 sprite
    if (this._iconSprite) {
      this.removeChild(this._iconSprite);
      this._iconSprite.destroy();
      this._iconSprite = null;
    }

    const texture = TextureCache.get(def.icon);
    if (texture) {
      // 有纹理：显示图片
      this._iconBg.clear();
      this._nameText.visible = false;

      this._iconSprite = new PIXI.Sprite(texture);
      const fill =
        def.line === FlowerLine.BOUQUET ? BOUQUET_CELL_FILL : ITEM_CELL_FILL;
      const maxSize = cs * fill;
      const scaleX = maxSize / texture.width;
      const scaleY = maxSize / texture.height;
      const s = Math.min(scaleX, scaleY);
      this._iconSprite.scale.set(s);
      this._iconSprite.anchor.set(0.5, 0.5);
      this._iconSprite.position.set(cs / 2, cs / 2);
      this.addChildAt(this._iconSprite, 1);
    } else {
      // 无纹理 fallback：柔和的图标占位
      this._iconBg.clear();

      // 柔和的圆形背景
      const iconColor = this._getIconColor(def.category, def.line);
      const cx = cs / 2;
      const cy = cs / 2 - 4;
      const radius = cs * 0.28;

      this._iconBg.beginFill(iconColor, 0.15);
      this._iconBg.drawRoundedRect(4, 4, cs - 8, cs - 8, 8);
      this._iconBg.endFill();
      this._iconBg.beginFill(iconColor, 0.3);
      this._iconBg.drawCircle(cx, cy, radius);
      this._iconBg.endFill();

      // 品类 emoji
      const emoji = this._getCategoryEmoji(def.category);
      this._nameText.visible = true;
      this._nameText.text = emoji + (def.name.length > 3 ? def.name.substring(0, 3) : def.name);
    }

    this._syncToolEnergy(def.category);

    this._levelBg.clear();
    this._levelBg.visible = false;
    this._levelText.text = '';
    this._levelText.visible = false;
  }

  get itemId(): string {
    return this._itemId;
  }

  /** 显示/隐藏客人锁定标记（金色闪烁边框） */
  setLocked(locked: boolean): void {
    const cs = BoardMetrics.cellSize;
    this._lockBorder.clear();
    if (locked) {
      this._lockBorder.visible = true;
      this._lockBorder.lineStyle(2.5, COLORS.GOLD, 0.85);
      this._lockBorder.drawRoundedRect(1, 1, cs - 2, cs - 2, 8);
    } else {
      this._lockBorder.visible = false;
    }
    bringToolEnergyToFront(this, this._toolEnergySprite);
  }

  /** 显示/隐藏消耗型剩余次数 */
  setUsesLeft(uses: number): void {
    if (uses <= 0) {
      this._usesText.visible = false;
      return;
    }
    this._usesText.text = `×${uses}`;
    this._usesText.visible = true;
    bringToolEnergyToFront(this, this._toolEnergySprite);
  }

  /** 显示/隐藏 CD 冷却遮罩 */
  setCooldown(remaining: number, total: number): void {
    const cs = BoardMetrics.cellSize;
    if (remaining <= 0) {
      this._cdOverlay.visible = false;
      this._cdText.visible = false;
      return;
    }

    this._cdOverlay.visible = true;
    this._cdText.visible = true;

    this._cdOverlay.clear();
    this._cdOverlay.beginFill(0x000000, 0.4);
    this._cdOverlay.drawRoundedRect(0, 0, cs, cs, 8);
    this._cdOverlay.endFill();

    // 进度条（底部）
    const progress = 1 - remaining / total;
    const barHeight = 4;
    this._cdOverlay.beginFill(0x4CAF50, 0.8);
    this._cdOverlay.drawRoundedRect(4, cs - barHeight - 2, (cs - 8) * progress, barHeight, 2);
    this._cdOverlay.endFill();

    this._cdText.text = `${Math.ceil(remaining)}s`;
    bringToolEnergyToFront(this, this._toolEnergySprite);
  }

  private _hideToolEnergy(): void {
    if (this._toolEnergySprite) {
      this.removeChild(this._toolEnergySprite);
      this._toolEnergySprite.destroy();
      this._toolEnergySprite = null;
    }
  }

  private _syncToolEnergy(category: Category): void {
    this._hideToolEnergy();
    if (!isBoardToolCategory(category)) return;
    const sp = createToolEnergySprite(BoardMetrics.cellSize, BoardMetrics.cellSize);
    if (!sp) return;
    this._toolEnergySprite = sp;
    this.addChild(sp);
    bringToolEnergyToFront(this, sp);
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

  private _getIconColor(category: Category, line: string): number {
    switch (category) {
      case Category.FLOWER: return this._getLineColor(line);
      case Category.DRINK: return this._getLineColor(line);
      case Category.BUILDING: return 0x8B4513;
      case Category.CHEST: return 0xDAA520;
      default: return 0xCCCCCC;
    }
  }

  private _getLineColor(line: string): number {
    switch (line) {
      case FlowerLine.FRESH: return COLORS.FLOWER_FRESH;
      case FlowerLine.BOUQUET: return COLORS.FLOWER_BOUQUET;
      case FlowerLine.GREEN: return COLORS.FLOWER_GREEN;
      case DrinkLine.TEA: return COLORS.DRINK_TEA;
      case DrinkLine.COLD: return COLORS.DRINK_COLD;
      case DrinkLine.DESSERT: return COLORS.DRINK_DESSERT;
      default: return 0x999999;
    }
  }
}
