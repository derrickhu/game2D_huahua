/**
 * 物品视图 - 在格子中显示物品图标和等级
 */
import * as PIXI from 'pixi.js';
import { CELL_SIZE, COLORS, FONT_FAMILY } from '@/config/Constants';
import { ITEM_DEFS, Category, FlowerLine, DrinkLine } from '@/config/ItemConfig';

export class ItemView extends PIXI.Container {
  private _iconBg: PIXI.Graphics;
  private _nameText: PIXI.Text;
  private _levelText: PIXI.Text;
  private _levelBg: PIXI.Graphics;
  private _lineIndicator: PIXI.Graphics;

  private _itemId: string = '';

  constructor() {
    super();

    this._iconBg = new PIXI.Graphics();
    this.addChild(this._iconBg);

    this._lineIndicator = new PIXI.Graphics();
    this.addChild(this._lineIndicator);

    this._nameText = new PIXI.Text('', {
      fontSize: 14,
      fill: COLORS.TEXT_DARK,
      fontFamily: FONT_FAMILY,
      wordWrap: true,
      wordWrapWidth: CELL_SIZE - 12,
      align: 'center',
    });
    this._nameText.anchor.set(0.5, 0);
    this._nameText.position.set(CELL_SIZE / 2, 8);
    this.addChild(this._nameText);

    // 等级背景圆点（复用，避免每次 setItem 创建新对象）
    this._levelBg = new PIXI.Graphics();
    this._levelBg.position.set(CELL_SIZE - 14, CELL_SIZE - 14);
    this.addChild(this._levelBg);

    this._levelText = new PIXI.Text('', {
      fontSize: 12,
      fill: 0xFFFFFF,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    });
    this._levelText.anchor.set(0.5, 0.5);
    this._levelText.position.set(CELL_SIZE - 14, CELL_SIZE - 14);
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

    // 物品图标背景（用颜色区分品类）
    this._iconBg.clear();
    const iconColor = this._getIconColor(def.category, def.line);
    this._iconBg.beginFill(iconColor, 0.3);
    this._iconBg.drawRoundedRect(6, 6, CELL_SIZE - 12, CELL_SIZE - 12, 6);
    this._iconBg.endFill();

    // 花系/饮品线色标条
    this._lineIndicator.clear();
    const lineColor = this._getLineColor(def.line);
    this._lineIndicator.beginFill(lineColor);
    this._lineIndicator.drawRoundedRect(6, CELL_SIZE - 24, CELL_SIZE - 12, 4, 2);
    this._lineIndicator.endFill();

    // 名称（短名）
    const shortName = def.name.length > 4 ? def.name.substring(0, 4) : def.name;
    this._nameText.text = shortName;

    // 等级角标（复用 _levelBg，不每次创建新 Graphics）
    this._levelBg.clear();
    this._levelBg.beginFill(lineColor, 0.9);
    this._levelBg.drawCircle(0, 0, 11);
    this._levelBg.endFill();

    this._levelText.text = `Lv${def.level}`;
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
