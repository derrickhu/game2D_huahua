/**
 * 货币物品在格子内的多图标簇（与棋盘 ItemView 一致：L1×1、L2×2 斜排、L3 四枚 2×2）
 */
import * as PIXI from 'pixi.js';
import { Category, type ItemDef } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';

const ITEM_CELL_FILL = 0.72;

export function createCurrencyIconCluster(def: ItemDef, cs: number): PIXI.Container | null {
  if (def.category !== Category.CURRENCY) return null;
  const texture = TextureCache.get(def.icon);
  if (!texture) return null;

  const container = new PIXI.Container();
  const count = def.level === 1 ? 1 : def.level === 2 ? 2 : 4;

  if (count === 1) {
    const sp = new PIXI.Sprite(texture);
    const maxSize = cs * ITEM_CELL_FILL;
    const s = maxSize / Math.max(texture.width, texture.height);
    sp.scale.set(s);
    sp.anchor.set(0.5, 0.5);
    sp.position.set(cs / 2, cs / 2);
    container.addChild(sp);
  } else if (count === 2) {
    const iconSize = cs * 0.48;
    const s = iconSize / Math.max(texture.width, texture.height);
    const off = cs * 0.16;
    for (const [ox, oy] of [[-off, off], [off, -off]]) {
      const sp = new PIXI.Sprite(texture);
      sp.scale.set(s);
      sp.anchor.set(0.5, 0.5);
      sp.position.set(cs / 2 + ox, cs / 2 + oy);
      container.addChild(sp);
    }
  } else {
    const iconSize = cs * 0.38;
    const s = iconSize / Math.max(texture.width, texture.height);
    const gap = cs * 0.14;
    const positions = [
      [-gap, -gap], [gap, -gap],
      [-gap, gap], [gap, gap],
    ];
    for (const [ox, oy] of positions) {
      const sp = new PIXI.Sprite(texture);
      sp.scale.set(s);
      sp.anchor.set(0.5, 0.5);
      sp.position.set(cs / 2 + ox, cs / 2 + oy);
      container.addChild(sp);
    }
  }

  return container;
}
