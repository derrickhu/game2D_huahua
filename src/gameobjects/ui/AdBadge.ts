import * as PIXI from 'pixi.js';
import { FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';

const AD_ICON_TEX_KEY = 'icon_ad_reward_nb2';

/** 激励视频入口统一图标（NB2 纹理）；纹理未就绪时回退为矢量占位 */
export function createAdIcon(size = 22): PIXI.Container {
  const tex = TextureCache.get(AD_ICON_TEX_KEY);
  if (tex?.width) {
    const spr = new PIXI.Sprite(tex);
    spr.anchor.set(0.5);
    const ref = Math.max(tex.width, tex.height);
    const target = size * 1.15;
    spr.scale.set(target / ref);
    return spr;
  }

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
  /** 指定广告图标基准尺寸；不传则按 `fontSize` 比例推算 */
  iconSize?: number,
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
  const iconPx =
    typeof iconSize === 'number' && iconSize > 0
      ? iconSize
      : Math.max(16, Math.round(fontSize * 1.2));
  const icon = createAdIcon(iconPx);
  const gap = Math.max(4, Math.round(fontSize * 0.24));
  text.position.set(0, 0);
  icon.position.set(text.width + gap + icon.width / 2, 0);
  root.addChild(text, icon);
  const b = root.getLocalBounds();
  root.pivot.set(b.x + b.width / 2, b.y + b.height / 2);
  return root;
}
