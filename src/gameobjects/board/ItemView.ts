/**
 * 物品视图 - 在格子中显示物品图标和等级
 */
import * as PIXI from 'pixi.js';
import { BoardMetrics, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, Category, FlowerLine, DrinkLine } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';

export class ItemView extends PIXI.Container {
  private _iconBg: PIXI.Graphics;
  private _iconSprite: PIXI.Sprite | null = null;
  private _nameText: PIXI.Text;
  private _levelText: PIXI.Text;
  private _levelBg: PIXI.Graphics;

  private _itemId: string = '';

  constructor() {
    super();
    const cs = BoardMetrics.cellSize;

    this._iconBg = new PIXI.Graphics();
    this.addChild(this._iconBg);

    this._nameText = new PIXI.Text('', {
      fontSize: 13,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: cs - 8,
      align: 'center',
    });
    this._nameText.anchor.set(0.5, 1);
    this._nameText.position.set(cs / 2, cs - 4);
    this.addChild(this._nameText);

    this._levelBg = new PIXI.Graphics();
    this._levelBg.position.set(cs - 14, 14);
    this.addChild(this._levelBg);

    this._levelText = new PIXI.Text('', {
      fontSize: 11,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._levelText.anchor.set(0.5, 0.5);
    this._levelText.position.set(cs - 14, 14);
    this.addChild(this._levelText);
  }

  setItem(itemId: string | null): void {
    if (!itemId) {
      this.visible = false;
      this._itemId = '';
      return;
    }

    const def = ITEM_DEFS.get(itemId);
    if (!def) {
      this.visible = false;
      return;
    }

    this._itemId = itemId;
    this.visible = true;
    const cs = BoardMetrics.cellSize;

    const lineColor = this._getLineColor(def.line);
    const iconColor = this._getIconColor(def.category, def.line);

    if (this._iconSprite) {
      this.removeChild(this._iconSprite);
      this._iconSprite.destroy();
      this._iconSprite = null;
    }

    const texture = TextureCache.get(def.icon);
    if (texture) {
      this._iconBg.clear();
      this._nameText.visible = false;

      this._iconSprite = new PIXI.Sprite(texture);
      const padding = 4;
      const maxSize = cs - padding * 2;
      const scale = Math.min(maxSize / texture.width, maxSize / texture.height);
      this._iconSprite.scale.set(scale);
      this._iconSprite.anchor.set(0.5, 0.5);
      this._iconSprite.position.set(cs / 2, cs / 2);
      this.addChildAt(this._iconSprite, 1);
    } else {
      this._iconBg.clear();
      this._iconBg.beginFill(iconColor, 0.35);
      this._iconBg.drawRoundedRect(6, 4, cs - 12, cs - 22, 6);
      this._iconBg.endFill();
      this._iconBg.beginFill(iconColor, 0.15);
      this._iconBg.drawCircle(cs / 2, cs / 2 - 8, 22);
      this._iconBg.endFill();

      this._nameText.visible = true;
      const shortName = def.name.length > 4 ? def.name.substring(0, 4) : def.name;
      this._nameText.text = shortName;
    }

    this._levelBg.clear();
    this._levelBg.beginFill(lineColor, 0.9);
    this._levelBg.drawCircle(0, 0, 10);
    this._levelBg.endFill();

    this._levelText.text = `${def.level}`;
  }

  get itemId(): string {
    return this._itemId;
  }

  private _getIconColor(category: Category, line: string): number {
    switch (category) {
      case Category.FLOWER: return this._getLineColor(line);
      case Category.DRINK: return this._getLineColor(line);
      case Category.BUILDING_MAT: return 0xB8860B;
      case Category.BUILDING: return 0x8B4513;
      case Category.CHEST: return 0xDAA520;
      default: return 0xCCCCCC;
    }
  }

  private _getLineColor(line: string): number {
    switch (line) {
      case FlowerLine.DAILY: return COLORS.FLOWER_DAILY;
      case FlowerLine.ROMANTIC: return COLORS.FLOWER_ROMANTIC;
      case FlowerLine.LUXURY: return COLORS.FLOWER_LUXURY;
      case DrinkLine.TEA: return COLORS.DRINK_TEA;
      case DrinkLine.COLD: return COLORS.DRINK_COLD;
      case DrinkLine.DESSERT: return COLORS.DRINK_DESSERT;
      default: return 0x999999;
    }
  }
}
