/**
 * 升星仪式 · 单张「解锁卡片」组件
 *
 * 用途：升级弹窗里的「升星仪式 · 解锁内容」格子；与 LevelUpPopup._appendUnlockSection 的家具卡片视觉同源
 * （奶白描边 + 半透深底 + icon + 标题 + 一行描述）。本组件不含交互；点击/二级面板由父级处理。
 *
 * 设计要点：
 *  - 单一公开 createLevelUnlockCard(entry, opts) 返回 PIXI.Container，宽 = opts.width，高自适应
 *  - 找不到 iconKey 时按 entry.kind 回退到默认 icon（避免空白）
 */
import * as PIXI from 'pixi.js';
import { COLORS, FONT_FAMILY } from '@/config/Constants';
import type { LevelUnlockEntry, LevelUnlockEntryKind } from '@/config/LevelUnlockConfig';
import { TextureCache } from '@/utils/TextureCache';

const KIND_BORDER_COLOR: Record<LevelUnlockEntryKind, number> = {
  feature:  0xF2A93C,
  affinity: 0xE48BA3,
  shop:     0x6FB3F2,
  map:      0x5FBE92,
  tool:     0xC79A55,
  cosmetic: 0xA086D8,
};

const KIND_BG_TINT: Record<LevelUnlockEntryKind, number> = {
  feature:  0xFFE9C2,
  affinity: 0xFFE0E6,
  shop:     0xDEEEFE,
  map:      0xD8F1E2,
  tool:     0xFFEFD2,
  cosmetic: 0xEAE0FF,
};

const KIND_DEFAULT_ICON: Record<LevelUnlockEntryKind, string> = {
  feature:  'ui_lvup_companion_bubble',
  affinity: 'ui_lvup_affinity_badge',
  shop:     'icon_shop_nb2',
  map:      'ui_lvup_world_map',
  tool:     'icon_basket',
  cosmetic: 'icon_book',
};

const KIND_PILL_LABEL: Record<LevelUnlockEntryKind, string> = {
  feature: '新功能',
  affinity: '新熟客',
  shop: '商店升级',
  map: '地图开放',
  tool: '新工具',
  cosmetic: '新内容',
};

function drawSparkle(
  g: PIXI.Graphics,
  cx: number,
  cy: number,
  size: number,
  color: number,
  alpha: number,
): void {
  const h = size / 2;
  g.beginFill(color, alpha);
  g.moveTo(cx, cy - h);
  g.lineTo(cx + h * 0.55, cy);
  g.lineTo(cx, cy + h);
  g.lineTo(cx - h * 0.55, cy);
  g.closePath();
  g.endFill();
}

export interface LevelUnlockCardOptions {
  /** 卡片宽度（高度按内容自适应） */
  width: number;
  /** 图标显示尺寸（最长边像素） */
  iconSize?: number;
  /** 卡片高度上限；不传则按内容自然高度 */
  maxHeight?: number;
  /** 标题字号 */
  titleFontSize?: number;
  /** 描述字号 */
  descFontSize?: number;
  /** 内边距（上下左右） */
  padding?: number;
}

export interface LevelUnlockCardResult {
  view: PIXI.Container;
  width: number;
  height: number;
}

export function createLevelUnlockCard(
  entry: LevelUnlockEntry,
  opts: LevelUnlockCardOptions,
): LevelUnlockCardResult {
  const W = Math.max(80, Math.floor(opts.width));
  const padding = Math.max(4, opts.padding ?? 8);
  const ICON = Math.max(24, Math.min(opts.iconSize ?? 44, 64));
  const TITLE = Math.max(11, Math.min(opts.titleFontSize ?? 13, 16));
  const DESC = Math.max(9, Math.min(opts.descFontSize ?? 11, 14));

  const root = new PIXI.Container();
  root.eventMode = 'none';

  const pillText = KIND_PILL_LABEL[entry.kind] ?? '已解锁';
  const pill = new PIXI.Text(pillText, {
    fontSize: Math.max(10, TITLE - 4),
    fill: 0xffffff,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    letterSpacing: 1,
  } as any);
  pill.anchor.set(0.5, 0);

  // 标题（深棕字 + 更明确层级）
  const title = new PIXI.Text(entry.title ?? '', {
    fontSize: TITLE,
    fill: 0x4a2f10,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    wordWrap: true,
    wordWrapWidth: W - padding * 2 - 12,
    align: 'center',
  } as any);
  title.anchor.set(0.5, 0);

  // 描述
  const desc = new PIXI.Text(entry.desc ?? '', {
    fontSize: DESC,
    fill: 0x7a5a33,
    fontFamily: FONT_FAMILY,
    wordWrap: true,
    wordWrapWidth: W - padding * 2 - 12,
    align: 'center',
    lineHeight: DESC + 5,
  } as any);
  desc.anchor.set(0.5, 0);

  // 图标
  const iconKey = entry.iconKey || KIND_DEFAULT_ICON[entry.kind];
  const fallbackIconKey = KIND_DEFAULT_ICON[entry.kind];
  const iconHolder = new PIXI.Container();
  let textureUnsub: (() => void) | null = null;
  const drawIcon = (): boolean => {
    iconHolder.removeChildren();
    const tex = TextureCache.get(iconKey) ?? TextureCache.get(fallbackIconKey);
    if (!tex || tex.width <= 0) return false;
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    const k = ICON / Math.max(tex.width, tex.height);
    sp.scale.set(k);
    iconHolder.addChild(sp);
    return true;
  };
  if (!drawIcon()) {
    // 兜底色块
    const g = new PIXI.Graphics();
    g.beginFill(0xb89a6c, 0.55);
    g.drawCircle(0, 0, ICON * 0.42);
    g.endFill();
    iconHolder.addChild(g);
    textureUnsub = TextureCache.onKeysLoaded(
      iconKey === fallbackIconKey ? [iconKey] : [iconKey, fallbackIconKey],
      () => {
        if (drawIcon()) {
          textureUnsub?.();
          textureUnsub = null;
        }
      },
    );
  }

  // 计算高度
  const pillH = Math.max(24, Math.round((TITLE - 4) * 1.9));
  const pillY = padding;
  const iconYTop = pillY + pillH + 10;
  const titleY = iconYTop + ICON + 10;
  // 临时设位以拿到自然 height
  title.position.set(W / 2, titleY);
  const descY = titleY + title.height + 6;
  desc.position.set(W / 2, descY);
  let H = Math.ceil(descY + desc.height + padding + 4);
  if (typeof opts.maxHeight === 'number') H = Math.min(H, Math.max(40, opts.maxHeight));

  // 背景（更像一张独立奖励卡，弱高光 + 内描边）
  const bg = new PIXI.Graphics();
  bg.beginFill(0xfff8ea, 0.98);
  bg.drawRoundedRect(0, 0, W, H, 14);
  bg.endFill();
  bg.lineStyle(2, KIND_BORDER_COLOR[entry.kind] ?? 0xC79A55, 0.95);
  bg.drawRoundedRect(0, 0, W, H, 14);
  bg.lineStyle(1.2, 0xffffff, 0.55);
  bg.drawRoundedRect(4, 4, W - 8, H - 8, 11);
  bg.eventMode = 'none';
  root.addChild(bg);

  const glow = new PIXI.Graphics();
  glow.beginFill(KIND_BG_TINT[entry.kind] ?? 0xFFF1D6, 0.9);
  glow.drawCircle(W / 2, iconYTop + ICON / 2, ICON * 0.48);
  glow.endFill();
  glow.lineStyle(2, KIND_BORDER_COLOR[entry.kind] ?? 0xC79A55, 0.35);
  glow.drawCircle(W / 2, iconYTop + ICON / 2, ICON * 0.48);
  glow.beginFill(0xffffff, 0.28);
  glow.drawCircle(W / 2 - ICON * 0.18, iconYTop + ICON * 0.32, ICON * 0.18);
  glow.endFill();
  root.addChild(glow);

  const sparkle = new PIXI.Graphics();
  const scx = W / 2;
  const scy = iconYTop + ICON / 2;
  drawSparkle(sparkle, scx - ICON * 0.44, scy - ICON * 0.22, ICON * 0.26, 0xffffff, 0.9);
  drawSparkle(sparkle, scx + ICON * 0.42, scy - ICON * 0.3, ICON * 0.2, 0xfff6cf, 0.78);
  drawSparkle(sparkle, scx + ICON * 0.3, scy + ICON * 0.34, ICON * 0.16, 0xffffff, 0.68);
  sparkle.lineStyle(1.2, 0xffffff, 0.55);
  sparkle.moveTo(scx - ICON * 0.53, scy - ICON * 0.22 - ICON * 0.08);
  sparkle.lineTo(scx - ICON * 0.53, scy - ICON * 0.22 + ICON * 0.08);
  sparkle.moveTo(scx - ICON * 0.53 - ICON * 0.08, scy - ICON * 0.22);
  sparkle.lineTo(scx - ICON * 0.53 + ICON * 0.08, scy - ICON * 0.22);
  root.addChild(sparkle);

  const pillBgW = Math.min(W - padding * 2, Math.max(84, pill.width + 24));
  const pillBg = new PIXI.Graphics();
  pillBg.beginFill(KIND_BORDER_COLOR[entry.kind] ?? 0xC79A55, 0.92);
  pillBg.drawRoundedRect((W - pillBgW) / 2, pillY, pillBgW, pillH, Math.floor(pillH / 2));
  pillBg.endFill();
  pillBg.beginFill(0xffffff, 0.16);
  pillBg.drawRoundedRect((W - pillBgW) / 2 + 3, pillY + 3, pillBgW - 6, Math.max(8, pillH * 0.42), Math.floor((pillH - 6) / 2));
  pillBg.endFill();
  root.addChild(pillBg);

  pill.position.set(W / 2, pillY + Math.max(3, Math.floor((pillH - pill.height) / 2) - 1));
  root.addChild(pill);

  iconHolder.position.set(W / 2, iconYTop + ICON / 2);
  root.addChild(iconHolder);
  root.addChild(title);
  root.addChild(desc);

  // dim TEXT_DARK 占位避免 unused 引用
  void COLORS;

  const destroyRoot = root.destroy.bind(root);
  root.destroy = ((options?: boolean | PIXI.IDestroyOptions) => {
    textureUnsub?.();
    textureUnsub = null;
    destroyRoot(options as any);
  }) as typeof root.destroy;

  return { view: root, width: W, height: H };
}
