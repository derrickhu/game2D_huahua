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

  // 标题（深棕字 + 弱 stroke，置于奶金暖底上）
  const title = new PIXI.Text(entry.title ?? '', {
    fontSize: TITLE,
    fill: 0x4a2f10,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    wordWrap: true,
    wordWrapWidth: W - padding * 2,
    align: 'center',
  } as any);
  title.anchor.set(0.5, 0);

  // 描述
  const desc = new PIXI.Text(entry.desc ?? '', {
    fontSize: DESC,
    fill: 0x6b4a1c,
    fontFamily: FONT_FAMILY,
    wordWrap: true,
    wordWrapWidth: W - padding * 2,
    align: 'center',
    lineHeight: DESC + 3,
  } as any);
  desc.anchor.set(0.5, 0);

  // 图标
  const iconKey = entry.iconKey || KIND_DEFAULT_ICON[entry.kind];
  const iconHolder = new PIXI.Container();
  let tex = TextureCache.get(iconKey);
  if (!tex || !tex.width) tex = TextureCache.get(KIND_DEFAULT_ICON[entry.kind]);
  if (tex && tex.width > 0) {
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    const k = ICON / Math.max(tex.width, tex.height);
    sp.scale.set(k);
    iconHolder.addChild(sp);
  } else {
    // 兜底色块
    const g = new PIXI.Graphics();
    g.beginFill(0xb89a6c, 0.55);
    g.drawCircle(0, 0, ICON * 0.42);
    g.endFill();
    iconHolder.addChild(g);
  }

  // 计算高度
  const iconYTop = padding;
  const titleY = iconYTop + ICON + 4;
  // 临时设位以拿到自然 height
  title.position.set(W / 2, titleY);
  const descY = titleY + title.height + 2;
  desc.position.set(W / 2, descY);
  let H = Math.ceil(descY + desc.height + padding);
  if (typeof opts.maxHeight === 'number') H = Math.min(H, Math.max(40, opts.maxHeight));

  // 背景（暖色奶金分类底 + 同色系实线描边，与「解锁新家具」格视觉同源）
  const bg = new PIXI.Graphics();
  bg.beginFill(KIND_BG_TINT[entry.kind] ?? 0xFFF1D6, 0.95);
  bg.drawRoundedRect(0, 0, W, H, 14);
  bg.endFill();
  bg.lineStyle(2, KIND_BORDER_COLOR[entry.kind] ?? 0xC79A55, 0.95);
  bg.drawRoundedRect(0, 0, W, H, 14);
  bg.eventMode = 'none';
  root.addChild(bg);

  iconHolder.position.set(W / 2, iconYTop + ICON / 2);
  root.addChild(iconHolder);
  root.addChild(title);
  root.addChild(desc);

  // dim TEXT_DARK 占位避免 unused 引用
  void COLORS;

  return { view: root, width: W, height: H };
}
