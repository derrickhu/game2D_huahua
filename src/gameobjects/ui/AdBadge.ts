import * as PIXI from 'pixi.js';
import { FONT_FAMILY } from '@/config/Constants';

export function createAdIcon(size = 22): PIXI.Container {
  const root = new PIXI.Container();
  const w = size * 1.25;
  const h = size * 0.82;
  const bg = new PIXI.Graphics();
  bg.beginFill(0xffffff, 0.95);
  bg.lineStyle(Math.max(1.2, size * 0.07), 0x5b7fc8, 0.95);
  bg.drawRoundedRect(-w / 2, -h / 2, w, h, h * 0.22);
  bg.endFill();
  root.addChild(bg);

  const play = new PIXI.Graphics();
  play.beginFill(0x5b7fc8, 1);
  play.moveTo(-size * 0.12, -size * 0.22);
  play.lineTo(size * 0.24, 0);
  play.lineTo(-size * 0.12, size * 0.22);
  play.closePath();
  play.endFill();
  root.addChild(play);
  return root;
}

export function createFreeAdBadge(
  fontSize = 16,
  fill = 0xffffff,
  stroke = 0x333333,
  label = '免费',
): PIXI.Container {
  const root = new PIXI.Container();
  const text = new PIXI.Text(label, {
    fontSize,
    fill,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    stroke,
    strokeThickness: Math.max(2, Math.round(fontSize * 0.16)),
  } as any);
  text.anchor.set(0, 0.5);
  const icon = createAdIcon(Math.max(16, Math.round(fontSize * 1.2)));
  const gap = Math.max(4, Math.round(fontSize * 0.24));
  text.position.set(0, 0);
  icon.position.set(text.width + gap + icon.width / 2, 0);
  root.addChild(text, icon);
  const b = root.getLocalBounds();
  root.pivot.set(b.x + b.width / 2, b.y + b.height / 2);
  return root;
}
