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
      // 图片留 6px 内边距，居中显示
      const padding = 6;
      const maxSize = cs - padding * 2;
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

    // 等级徽章（右上角小圆点）
    const badgeX = cs - 10;
    const badgeY = 10;
    this._levelBg.clear();
    this._levelBg.beginFill(lineColor, 0.85);
    this._levelBg.drawCircle(0, 0, 8);
    this._levelBg.endFill();
    this._levelBg.position.set(badgeX, badgeY);

    this._levelText.text = `${def.level}`;
    this._levelText.position.set(badgeX, badgeY);
  }

  get itemId(): string {
    return this._itemId;
  }

  private _getCategoryEmoji(category: Category): string {
    switch (category) {
      case Category.FLOWER: return '🌸';
      case Category.DRINK: return '🍵';
      case Category.BUILDING_MAT: return '🧱';
      case Category.BUILDING: return '🏠';
      case Category.CHEST: return '📦';
      default: return '❓';
    }
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
