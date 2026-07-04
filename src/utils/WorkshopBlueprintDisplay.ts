import * as PIXI from 'pixi.js';
import { FONT_FAMILY } from '@/config/Constants';
import { DECO_MAP } from '@/config/DecorationConfig';
import {
  getWorkshopBlueprintFeatureLabels,
  type WorkshopBlueprintDef,
} from '@/config/FurnitureWorkshopConfig';
import { TextureCache } from '@/utils/TextureCache';

export const WORKSHOP_BLUEPRINT_SCROLL_KEY = 'workshop_blueprint_generic';
/** 与花间珠匣进度条未解锁首饰剪影一致 */
export const WORKSHOP_BLUEPRINT_SILHOUETTE_TINT = 0x17110f;

/** 空白图纸卷轴 + 对应家具黑色剪影（运行时合成，无需单独剪影资源） */
export function appendWorkshopBlueprintIcon(
  parent: PIXI.Container,
  outputDecoId: string,
  centerX: number,
  centerY: number,
  boxSize: number,
): void {
  const scrollTex = TextureCache.get(WORKSHOP_BLUEPRINT_SCROLL_KEY);
  if (scrollTex?.width) {
    const scroll = new PIXI.Sprite(scrollTex);
    scroll.anchor.set(0.5);
    scroll.scale.set(Math.min(boxSize / scrollTex.width, boxSize / scrollTex.height));
    scroll.position.set(centerX, centerY);
    parent.addChild(scroll);
  }

  const furnKey = DECO_MAP.get(outputDecoId)?.icon;
  if (!furnKey) return;
  const furnTex = TextureCache.get(furnKey);
  if (!furnTex?.width) return;

  const sil = new PIXI.Sprite(furnTex);
  sil.anchor.set(0.5);
  const silFit = boxSize * 0.38;
  sil.scale.set(Math.min(silFit / furnTex.width, silFit / furnTex.height));
  sil.position.set(centerX, centerY + boxSize * 0.02);
  sil.tint = WORKSHOP_BLUEPRINT_SILHOUETTE_TINT;
  sil.alpha = 0.92;
  parent.addChild(sil);
}

const FEATURE_TAG_STYLE: Record<string, { bg: number; border: number; text: number }> = {
  '可染色': { bg: 0xffeef5, border: 0xf48fb1, text: 0xc2185b },
  '四面旋转': { bg: 0xe8f5e9, border: 0x81c784, text: 0x388e3c },
  '可交互': { bg: 0xe3f2fd, border: 0x64b5f6, text: 0x1976d2 },
};

export interface WorkshopFeatureTagOptions {
  fontSize?: number;
  layout?: 'horizontal' | 'vertical';
  gap?: number;
  maxWidth?: number;
  /** x 为左缘（默认）或右缘（right 时标签组右对齐到 x） */
  align?: 'left' | 'right';
}

function makeFeatureTagPill(label: string, fontSize: number): PIXI.Container {
  const style = FEATURE_TAG_STYLE[label] ?? { bg: 0xf5f5f5, border: 0xbdbdbd, text: 0x616161 };
  const txt = new PIXI.Text(label, {
    fontFamily: FONT_FAMILY,
    fontSize,
    fill: style.text,
    fontWeight: '800',
  });
  const padX = 7;
  const padY = 3;
  const w = txt.width + padX * 2;
  const h = txt.height + padY * 2;
  const pill = new PIXI.Container();
  const bg = new PIXI.Graphics();
  bg.beginFill(style.bg, 0.96);
  bg.lineStyle(1.2, style.border, 0.92);
  bg.drawRoundedRect(0, 0, w, h, h / 2);
  bg.endFill();
  pill.addChild(bg);
  txt.position.set(padX, padY);
  pill.addChild(txt);
  return pill;
}

/** 在父容器上绘制工坊图纸能力标签；无能力时不添加子节点 */
export function appendWorkshopBlueprintFeatureTags(
  parent: PIXI.Container,
  blueprint: WorkshopBlueprintDef,
  x: number,
  y: number,
  opts?: WorkshopFeatureTagOptions,
): PIXI.Container | null {
  const labels = getWorkshopBlueprintFeatureLabels(blueprint);
  if (labels.length === 0) return null;

  const fontSize = opts?.fontSize ?? 13;
  const gap = opts?.gap ?? 5;
  const layout = opts?.layout ?? 'horizontal';
  const maxWidth = opts?.maxWidth;
  const align = opts?.align ?? 'left';

  const wrap = new PIXI.Container();

  let cursorX = 0;
  let cursorY = 0;
  let rowH = 0;
  const pills: PIXI.Container[] = [];

  for (const label of labels) {
    const pill = makeFeatureTagPill(label, fontSize);
    if (layout === 'horizontal' && maxWidth && cursorX > 0 && cursorX + pill.width > maxWidth) {
      cursorX = 0;
      cursorY += rowH + gap;
      rowH = 0;
    }
    pill.position.set(cursorX, cursorY);
    wrap.addChild(pill);
    pills.push(pill);
    if (layout === 'vertical') {
      cursorY += pill.height + gap;
    } else {
      cursorX += pill.width + gap;
      rowH = Math.max(rowH, pill.height);
    }
  }

  let wrapW = 0;
  let wrapH = 0;
  if (layout === 'vertical') {
    wrapW = pills.reduce((m, p) => Math.max(m, p.width), 0);
    wrapH = pills.reduce((s, p, i) => s + p.height + (i > 0 ? gap : 0), 0);
    if (align === 'right') {
      for (const pill of pills) pill.x = wrapW - pill.width;
    }
  } else {
    wrapW = cursorX > 0 ? cursorX - gap : 0;
    wrapH = rowH;
  }

  const posX = align === 'right' ? x - wrapW : x;
  wrap.position.set(posX, y);
  parent.addChild(wrap);
  return wrap;
}
