/**
 * 装修 / 房间风格 / 换装卡：条件未达成时的统一占位（方框 + 浅问号 + 名称行小锁）
 */
import * as PIXI from 'pixi.js';
import { FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';

const GOLD_LINE = 0xe8c078;

export function addMysteryCardPlaceholder(
  parent: PIXI.Container,
  cw: number,
  cardBaseW: number,
  maxBox: number,
): void {
  const side = Math.round(maxBox * 0.88);
  const half = side * 0.5;
  const rr = Math.max(5, Math.round((7 * cw) / cardBaseW));
  const g = new PIXI.Graphics();
  g.lineStyle(2.2, GOLD_LINE, 0.9);
  g.beginFill(0xfff5f0, 0.96);
  g.drawRoundedRect(-half, -half, side, side, rr);
  g.endFill();
  parent.addChild(g);

  const qFont = Math.max(30, Math.round((54 * cw) / cardBaseW));
  const q = new PIXI.Text('?', {
    fontFamily: FONT_FAMILY,
    fontSize: qFont,
    fontWeight: 'bold',
    fill: 0xc24a8f,
  });
  q.anchor.set(0.5, 0.5);
  q.alpha = 0.38;
  parent.addChild(q);
}

/** 名称右侧小锁（warehouse_slot_lock / cell_locked / emoji） */
export function createSmallNameLockIcon(cw: number, cardBaseW: number): PIXI.Container {
  const lockTex = TextureCache.get('warehouse_slot_lock') ?? TextureCache.get('cell_locked');
  const lockSize = Math.max(14, Math.round((20 * cw) / cardBaseW));
  const wrap = new PIXI.Container();
  if (lockTex?.width) {
    const sp = new PIXI.Sprite(lockTex);
    const sc = Math.min(lockSize / lockTex.width, lockSize / lockTex.height);
    sp.scale.set(sc);
    sp.anchor.set(0, 0.5);
    wrap.addChild(sp);
    return wrap;
  }
  const t = new PIXI.Text('🔒', { fontSize: Math.min(18, lockSize + 4), fontFamily: FONT_FAMILY });
  t.anchor.set(0, 0.5);
  wrap.addChild(t);
  return wrap;
}
