/**
 * 友谊卡 — 共享的视图构造器（弹窗 / 图鉴大图查看 / 网格小图）
 *
 * 设计要点：
 *  - 卡面顶部预留 LARGE_ART_SIZE × LARGE_ART_SIZE 的方形区，用于完整展示 384×384 原图，
 *    不再用横长方形 mask 把人物身子切掉
 *  - 信息区（标题、故事、稀有度、奖励/收入图鉴 chip）统一放在 art 下方
 *  - SR / SSR 在外圈加发光与厚阴影，强化"惊喜感"
 *  - reveal 模式（掉卡弹窗）/ codex 模式（图鉴大图查看）共用同一张卡，仅底部 chip 不同
 *
 * 网格小图（codex grid 缩略）由 `buildAffinityCardThumb()` 提供，同样把方形 art 当主视觉。
 */
import * as PIXI from 'pixi.js';
import { FONT_FAMILY } from '@/config/Constants';
import { TextureCache } from '@/utils/TextureCache';
import {
  CARD_RARITY_COLOR,
  CARD_RARITY_LABEL,
  type AffinityCardDef,
  type CardRarity,
  type CardReward,
} from '@/config/AffinityCardConfig';

// ─── 大卡片（弹窗 / 详情）尺寸常量 ───────────────────────────────────────────────
export const LARGE_CARD_W = 380;
export const LARGE_CARD_H = 560;
export const LARGE_ART_SIZE = 360;
const LARGE_ART_PAD = (LARGE_CARD_W - LARGE_ART_SIZE) / 2; // 10
const LARGE_INFO_TOP = LARGE_ART_PAD + LARGE_ART_SIZE + 8; // 378

// ─── 网格缩略卡（codex grid）──────────────────────────────────────────────────
/** 卡片底部胶囊条整体高度（含上下空隙） */
const THUMB_TITLE_BAND = 44;
const THUMB_PAD = 4;

/** 稀有度 → 底部胶囊主色（饱和度温和的 pastel，区别于 _buildRarityChip 的色板） */
const RARITY_CAPSULE_COLOR: Record<CardRarity, number> = {
  N:   0x9ec96a,
  R:   0x6abef0,
  SR:  0xc78aff,
  SSR: 0xffc94c,
};
const RARITY_CAPSULE_STROKE: Record<CardRarity, number> = {
  N:   0x6f9a3d,
  R:   0x2f86c4,
  SR:  0x8a4ec0,
  SSR: 0xc88a3e,
};

export interface BuildLargeCardOpts {
  /** reveal: 掉卡弹窗（带"收入图鉴 / 重复 → +奖励" chip） */
  /** codex:  图鉴大图查看（不带 chip，仅信息） */
  mode: 'reveal' | 'codex';
  /** reveal 模式专用：是否为重复卡 */
  isDuplicate?: boolean;
  /** reveal 模式专用：重复卡奖励 */
  duplicateReward?: CardReward;
  /** codex 模式专用：拥有数（>1 显示 ×N） */
  ownedCount?: number;
}

/** 构造 380×560 大卡片正面，原点为 (0,0) 在卡片左上角 */
export function buildLargeAffinityCardFront(
  card: AffinityCardDef,
  opts: BuildLargeCardOpts,
): PIXI.Container {
  const root = new PIXI.Container();
  const tint = CARD_RARITY_COLOR[card.rarity];

  // 厚柔影 / 光环（SR/SSR）
  if (card.rarity === 'SR' || card.rarity === 'SSR') {
    const haloAlpha = card.rarity === 'SSR' ? 0.65 : 0.42;
    const haloPad = card.rarity === 'SSR' ? 18 : 12;
    const halo = new PIXI.Graphics();
    halo.beginFill(tint, haloAlpha);
    halo.drawRoundedRect(-haloPad, -haloPad, LARGE_CARD_W + haloPad * 2, LARGE_CARD_H + haloPad * 2, 28);
    halo.endFill();
    root.addChild(halo);
  } else {
    // 普通卡：浅淡阴影
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.18);
    shadow.drawRoundedRect(-4, -4, LARGE_CARD_W + 8, LARGE_CARD_H + 8, 22);
    shadow.endFill();
    root.addChild(shadow);
  }

  // 卡面底
  const bg = new PIXI.Graphics();
  bg.beginFill(0xfff8e7, 1);
  bg.lineStyle(5, tint, 1);
  bg.drawRoundedRect(0, 0, LARGE_CARD_W, LARGE_CARD_H, 22);
  bg.endFill();
  root.addChild(bg);

  // ─── art 区：完整方形显示 ───────────────────────────────────────────────────
  const artMask = new PIXI.Graphics();
  artMask.beginFill(0xffffff);
  artMask.drawRoundedRect(LARGE_ART_PAD, LARGE_ART_PAD, LARGE_ART_SIZE, LARGE_ART_SIZE, 16);
  artMask.endFill();
  root.addChild(artMask);

  const artKey = card.artKey ?? `customer_${card.ownerTypeId}`;
  const tex = TextureCache.get(artKey);
  if (tex && tex.width > 0) {
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5);
    // 等比 contain：取较小的 scale，让 384×384 完整显示在 360×360 内
    const k = LARGE_ART_SIZE / Math.max(tex.width, tex.height);
    sp.scale.set(k);
    sp.position.set(LARGE_CARD_W / 2, LARGE_ART_PAD + LARGE_ART_SIZE / 2);
    sp.mask = artMask;
    root.addChild(sp);
  } else {
    // fallback：浅米色底
    const fb = new PIXI.Graphics();
    fb.beginFill(0xf3e7c8, 1);
    fb.drawRoundedRect(LARGE_ART_PAD, LARGE_ART_PAD, LARGE_ART_SIZE, LARGE_ART_SIZE, 16);
    fb.endFill();
    root.addChild(fb);
  }

  // codex 模式：右上角拥有数 ×N（>1 才显示）
  if (opts.mode === 'codex' && (opts.ownedCount ?? 0) > 1) {
    const cnt = new PIXI.Text(`×${opts.ownedCount}`, {
      fontSize: 16,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0x4a2f10,
      strokeThickness: 4,
    } as PIXI.TextStyle);
    cnt.anchor.set(1, 0);
    cnt.position.set(LARGE_CARD_W - LARGE_ART_PAD - 10, LARGE_ART_PAD + 6);
    root.addChild(cnt);
  }

  // ─── 信息区（art 下方）──────────────────────────────────────────────────
  const rarityChip = _buildRarityChip(card.rarity, true);
  const title = new PIXI.Text(card.title, {
    fontSize: 25,
    fill: 0x4a2f10,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    align: 'left',
    wordWrap: true,
    wordWrapWidth: LARGE_CARD_W - 96,
    breakWords: true,
  } as PIXI.TextStyle);
  title.anchor.set(0, 0);

  const titleRow = new PIXI.Container();
  rarityChip.position.set(0, 4);
  titleRow.addChild(rarityChip);
  title.position.set(rarityChip.width + 10, 0);
  titleRow.addChild(title);
  titleRow.position.set((LARGE_CARD_W - titleRow.width) / 2, LARGE_INFO_TOP + 2);
  root.addChild(titleRow);

  // 中文没有单词分隔 → 必须 breakWords:true，否则 wordWrapWidth 对中文完全无效
  const story = new PIXI.Text(card.story, {
    fontSize: 17,
    fill: 0x6b4a1c,
    fontFamily: FONT_FAMILY,
    wordWrap: true,
    wordWrapWidth: LARGE_CARD_W - 52,
    breakWords: true,
    align: 'center',
    lineHeight: 24,
  } as PIXI.TextStyle);
  story.anchor.set(0.5, 0);
  story.position.set(LARGE_CARD_W / 2, titleRow.y + Math.max(title.height, rarityChip.height) + 18);
  root.addChild(story);

  // ─── reveal 模式：底部 chip ─────────────────────────────────────────────
  if (opts.mode === 'reveal') {
    if (opts.isDuplicate) {
      const dupChip = _buildDuplicateRewardChip(opts.duplicateReward, LARGE_CARD_W - 24);
      dupChip.position.set((LARGE_CARD_W - dupChip.width) / 2, LARGE_CARD_H - 38 - 14);
      root.addChild(dupChip);
    } else {
      const obW = 130, obH = 34;
      const obtainChip = new PIXI.Graphics();
      obtainChip.beginFill(tint, 0.95);
      obtainChip.drawRoundedRect(0, 0, obW, obH, obH / 2);
      obtainChip.endFill();
      const obTxt = new PIXI.Text('收入图鉴', {
        fontSize: 14, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
      } as PIXI.TextStyle);
      obTxt.anchor.set(0.5);
      obTxt.position.set(obW / 2, obH / 2);
      obtainChip.addChild(obTxt);
      obtainChip.position.set((LARGE_CARD_W - obW) / 2, LARGE_CARD_H - obH - 14);
      root.addChild(obtainChip);
    }
  }

  return root;
}

/** 大卡片"卡背"（翻牌前），同尺寸；优先用美术资源 affinity_card_back_default */
export function buildLargeAffinityCardBack(rarity: CardRarity): PIXI.Container {
  const root = new PIXI.Container();
  const tint = CARD_RARITY_COLOR[rarity];

  // 阴影
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x000000, 0.22);
  shadow.drawRoundedRect(-4, -4, LARGE_CARD_W + 8, LARGE_CARD_H + 8, 22);
  shadow.endFill();
  root.addChild(shadow);

  const backTex = TextureCache.get('affinity_card_back_default');
  if (backTex && backTex.width > 0) {
    const sp = new PIXI.Sprite(backTex);
    sp.anchor.set(0.5);
    const k = Math.max(LARGE_CARD_W / backTex.width, LARGE_CARD_H / backTex.height);
    sp.scale.set(k);
    sp.position.set(LARGE_CARD_W / 2, LARGE_CARD_H / 2);
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRoundedRect(0, 0, LARGE_CARD_W, LARGE_CARD_H, 22);
    mask.endFill();
    sp.mask = mask;
    root.addChild(mask);
    root.addChild(sp);
    const border = new PIXI.Graphics();
    border.lineStyle(5, tint, 1);
    border.drawRoundedRect(0, 0, LARGE_CARD_W, LARGE_CARD_H, 22);
    root.addChild(border);
  } else {
    const back = new PIXI.Graphics();
    back.beginFill(0x4a2f10, 1);
    back.lineStyle(5, tint, 1);
    back.drawRoundedRect(0, 0, LARGE_CARD_W, LARGE_CARD_H, 22);
    back.endFill();
    back.lineStyle(2, tint, 0.45);
    back.drawRoundedRect(12, 12, LARGE_CARD_W - 24, LARGE_CARD_H - 24, 16);
    root.addChild(back);
    const center = new PIXI.Graphics();
    center.beginFill(tint, 0.9);
    center.drawCircle(LARGE_CARD_W / 2, LARGE_CARD_H / 2, 36);
    center.endFill();
    center.beginFill(0x4a2f10, 1);
    center.drawCircle(LARGE_CARD_W / 2, LARGE_CARD_H / 2, 18);
    center.endFill();
    root.addChild(center);
  }

  return root;
}

/** 网格缩略卡（codex grid 单格）。w 自适应，h = w + THUMB_TITLE_BAND
 *  视觉：方形 art + 底部一体化稀有度胶囊条（左侧稀有度字母徽章，右侧卡名）
 */
export function buildAffinityCardThumb(
  card: AffinityCardDef & { obtained: boolean; dupCount: number },
  w: number,
): PIXI.Container {
  const c = new PIXI.Container();
  const h = w + THUMB_TITLE_BAND;
  const capsuleColor = card.obtained ? RARITY_CAPSULE_COLOR[card.rarity] : 0xc4c4c4;
  const capsuleStroke = card.obtained ? RARITY_CAPSULE_STROKE[card.rarity] : 0x9a9a9a;

  // 背板（白底带柔光投影感 + 稀有度淡边）
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x000000, 0.08);
  shadow.drawRoundedRect(1, 3, w, h, 14);
  shadow.endFill();
  c.addChild(shadow);

  const bg = new PIXI.Graphics();
  if (card.obtained) {
    bg.beginFill(0xffffff, 1);
    bg.lineStyle(2, capsuleStroke, 0.7);
  } else {
    bg.beginFill(0xeeeeee, 0.85);
    bg.lineStyle(2, 0xbbbbbb, 0.6);
  }
  bg.drawRoundedRect(0, 0, w, h, 14);
  bg.endFill();
  c.addChild(bg);

  if (card.obtained) {
    // 方形 art 区（圆角）
    const artW = w - THUMB_PAD * 2;
    const artMask = new PIXI.Graphics();
    artMask.beginFill(0xffffff);
    artMask.drawRoundedRect(THUMB_PAD, THUMB_PAD, artW, artW, 10);
    artMask.endFill();
    c.addChild(artMask);

    const artKey = card.artKey ?? `customer_${card.ownerTypeId}`;
    const tex = TextureCache.get(artKey);
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5);
      const k = artW / Math.max(tex.width, tex.height);
      sp.scale.set(k);
      sp.position.set(w / 2, THUMB_PAD + artW / 2);
      sp.mask = artMask;
      c.addChild(sp);
    }

    // 拥有数 ×N（右上角小标，金底）
    if (card.dupCount > 0) {
      const dup = new PIXI.Text(`×${card.dupCount + 1}`, {
        fontSize: 12, fill: 0xffffff, fontFamily: FONT_FAMILY, fontWeight: 'bold',
        stroke: 0x4a2f10, strokeThickness: 3,
      } as PIXI.TextStyle);
      dup.anchor.set(1, 0);
      dup.position.set(w - THUMB_PAD - 4, THUMB_PAD + 4);
      c.addChild(dup);
    }
  } else {
    // 未得：卡背 + ???
    const backTex = TextureCache.get('affinity_card_back_default');
    const artW = w - THUMB_PAD * 2;
    if (backTex && backTex.width > 0) {
      const sp = new PIXI.Sprite(backTex);
      sp.anchor.set(0.5);
      const k = artW / Math.max(backTex.width, backTex.height);
      sp.scale.set(k);
      sp.position.set(w / 2, THUMB_PAD + artW / 2);
      sp.alpha = 0.45;
      const mask = new PIXI.Graphics();
      mask.beginFill(0xffffff);
      mask.drawRoundedRect(THUMB_PAD, THUMB_PAD, artW, artW, 10);
      mask.endFill();
      c.addChild(mask);
      sp.mask = mask;
      c.addChild(sp);
    }
    const q = new PIXI.Text('?', {
      fontSize: Math.round(artW * 0.55),
      fill: 0xb6b6b6,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
      stroke: 0xffffff,
      strokeThickness: 3,
    } as PIXI.TextStyle);
    q.anchor.set(0.5);
    q.position.set(w / 2, THUMB_PAD + artW / 2);
    c.addChild(q);
  }

  // ── 底部稀有度胶囊条（图鉴关键视觉）──
  const capH = 26;
  const capW = w - THUMB_PAD * 2;
  const capX = THUMB_PAD;
  const capY = THUMB_PAD + (w - THUMB_PAD * 2) + 8;
  const capsule = new PIXI.Graphics();
  capsule.beginFill(capsuleColor, 1);
  capsule.lineStyle(1.5, capsuleStroke, 0.85);
  capsule.drawRoundedRect(capX, capY, capW, capH, capH / 2);
  capsule.endFill();
  // 上半光泽
  const sheen = new PIXI.Graphics();
  sheen.beginFill(0xffffff, 0.32);
  sheen.drawRoundedRect(capX + 2, capY + 2, capW - 4, capH / 2 - 1, capH / 2 - 1);
  sheen.endFill();
  c.addChild(capsule);
  c.addChild(sheen);

  // 胶囊内左侧：白色圆角小徽章 + 稀有度字母（N / R / SR / SSR）
  const badgeText = card.rarity;
  const badgeFontSize = badgeText.length >= 3 ? 10 : 12;
  const badgeH = capH - 8;
  const badgeW = badgeText.length >= 3 ? 30 : 22;
  const badgeX = capX + 5;
  const badgeY = capY + (capH - badgeH) / 2;
  const badge = new PIXI.Graphics();
  badge.beginFill(0xffffff, 1);
  badge.lineStyle(1, capsuleStroke, 0.9);
  badge.drawRoundedRect(badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  badge.endFill();
  c.addChild(badge);
  const badgeTxt = new PIXI.Text(badgeText, {
    fontSize: badgeFontSize,
    fill: capsuleStroke,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
  } as PIXI.TextStyle);
  badgeTxt.anchor.set(0.5);
  badgeTxt.position.set(badgeX + badgeW / 2, badgeY + badgeH / 2);
  c.addChild(badgeTxt);

  // 胶囊内右侧：卡名（已得）/ 锁定提示（未得）
  const titleStr = card.obtained ? card.title : '???';
  const titleX = badgeX + badgeW + 6;
  const titleAvailW = capX + capW - titleX - 8;
  const title = new PIXI.Text(titleStr, {
    fontSize: 13,
    fill: 0xffffff,
    fontFamily: FONT_FAMILY,
    fontWeight: 'bold',
    stroke: capsuleStroke,
    strokeThickness: 2.5,
    wordWrap: false,
    breakWords: true,
  } as PIXI.TextStyle);
  title.anchor.set(0, 0.5);
  // 字宽过长时整体缩放
  if (title.width > titleAvailW && titleAvailW > 0) {
    title.scale.set(titleAvailW / title.width);
  }
  title.position.set(titleX, capY + capH / 2);
  c.addChild(title);

  return c;
}

export function thumbHeightFor(width: number): number {
  return width + THUMB_TITLE_BAND;
}

// ─── helpers ───────────────────────────────────────────────────────────
function _buildRarityChip(rarity: CardRarity, small = false): PIXI.Container {
  const c = new PIXI.Container();
  const tint = CARD_RARITY_COLOR[rarity];
  const w = small ? 36 : 70;
  const h = small ? 16 : 24;
  const bg = new PIXI.Graphics();
  bg.beginFill(tint, 0.96);
  bg.drawRoundedRect(0, 0, w, h, h / 2);
  bg.endFill();
  c.addChild(bg);
  const txt = new PIXI.Text(
    small ? rarity : `${rarity} · ${CARD_RARITY_LABEL[rarity]}`,
    {
      fontSize: small ? 11 : 13,
      fill: 0xffffff,
      fontFamily: FONT_FAMILY,
      fontWeight: 'bold',
    } as PIXI.TextStyle,
  );
  txt.anchor.set(0.5);
  txt.position.set(w / 2, h / 2);
  c.addChild(txt);
  return c;
}

/** 重复卡底部 chip：胶囊内「重复 →」+ 若干 [icon + 数字] 组合，自动居中 */
function _buildDuplicateRewardChip(
  reward: CardReward | undefined,
  maxWidth: number,
): PIXI.Container {
  const c = new PIXI.Container();
  const H = 38;
  const padX = 14;
  const gap = 10;
  const iconSize = 22;

  const label = new PIXI.Text('重复 →', {
    fontSize: 14, fill: 0x8a5a00, fontFamily: FONT_FAMILY, fontWeight: 'bold',
  } as PIXI.TextStyle);
  label.anchor.set(0, 0.5);

  // 构造每个奖励的 [icon + "+数字"] 容器
  const parts: Array<{ view: PIXI.Container; width: number }> = [];
  const pushItem = (iconKey: string, label: number, tint: number): void => {
    const view = new PIXI.Container();
    const tex = TextureCache.get(iconKey);
    let iconW = iconSize;
    if (tex && tex.width > 0) {
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0, 0.5);
      const k = iconSize / Math.max(tex.width, tex.height);
      sp.scale.set(k);
      sp.position.set(0, 0);
      view.addChild(sp);
      iconW = Math.ceil(tex.width * k);
    } else {
      const circ = new PIXI.Graphics();
      circ.beginFill(tint, 1);
      circ.drawCircle(iconSize / 2, 0, iconSize / 2);
      circ.endFill();
      view.addChild(circ);
    }
    const t = new PIXI.Text(`+${label}`, {
      fontSize: 14, fill: 0x6a3b00, fontFamily: FONT_FAMILY, fontWeight: 'bold',
    } as PIXI.TextStyle);
    t.anchor.set(0, 0.5);
    t.position.set(iconW + 3, 0);
    view.addChild(t);
    parts.push({ view, width: iconW + 3 + Math.ceil(t.width) });
  };

  if (reward) {
    if (reward.huayuan) pushItem('icon_huayuan', reward.huayuan, 0x7ed957);
    if (reward.diamond) pushItem('icon_gem', reward.diamond, 0xff8ac9);
    if (reward.stamina) pushItem('icon_energy', reward.stamina, 0xffb84d);
    if (reward.flowerSignTickets) pushItem('icon_flower_sign_coin', reward.flowerSignTickets, 0xa78bfa);
  }

  // 计算总宽
  const partsTotal = parts.reduce((s, p) => s + p.width, 0) + Math.max(0, parts.length - 1) * gap;
  let contentW = Math.ceil(label.width) + gap + partsTotal;
  let W = Math.min(maxWidth, contentW + padX * 2);

  // 若超出最大宽：把 gap 收紧
  let usedGap = gap;
  if (contentW + padX * 2 > maxWidth) {
    usedGap = Math.max(4, Math.floor(gap * (maxWidth - padX * 2 - Math.ceil(label.width) - 6) / Math.max(1, partsTotal)));
    const tight = parts.reduce((s, p) => s + p.width, 0) + Math.max(0, parts.length - 1) * usedGap;
    contentW = Math.ceil(label.width) + usedGap + tight;
    W = Math.min(maxWidth, contentW + padX * 2);
  }

  // bg 胶囊
  const bg = new PIXI.Graphics();
  bg.beginFill(0xfff3c4, 0.96);
  bg.lineStyle(2, 0xb8860b, 1);
  bg.drawRoundedRect(0, 0, W, H, H / 2);
  bg.endFill();
  c.addChild(bg);

  // 内容居中
  const innerLeft = (W - contentW) / 2;
  label.position.set(innerLeft, H / 2);
  c.addChild(label);

  let x = innerLeft + Math.ceil(label.width) + usedGap;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    p.view.position.set(x, H / 2);
    c.addChild(p.view);
    x += p.width + usedGap;
  }

  return c;
}

/** 工具：把卡牌 CardReward 转成飞入粒子条目（供 RewardFlyCoordinator.playBatch 用） */
export function rewardToFlyItems(reward: CardReward | undefined): Array<{
  type: string; textureKey: string; amount: number; grantOnArrive?: boolean;
}> {
  if (!reward) return [];
  const items: Array<{ type: string; textureKey: string; amount: number; grantOnArrive?: boolean }> = [];
  if (reward.huayuan) items.push({ type: 'huayuan', textureKey: 'icon_huayuan', amount: reward.huayuan });
  if (reward.diamond) items.push({ type: 'diamond', textureKey: 'icon_gem', amount: reward.diamond });
  if (reward.stamina) items.push({ type: 'stamina', textureKey: 'icon_energy', amount: reward.stamina });
  if (reward.flowerSignTickets) items.push({
    type: 'flowerSignTicket', textureKey: 'icon_flower_sign_coin', amount: reward.flowerSignTickets,
  });
  return items;
}
