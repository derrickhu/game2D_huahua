import type { AffinityCardDef } from '@/config/AffinityCardConfig';
import type { FlowerCard } from '@/managers/FlowerCardManager';

export type ShareScene =
  | 'core_gameplay'
  | 'decor_gameplay'
  | 'unlock_cell';

export interface SharePayload {
  title: string;
  imageUrl: string;
  /** 抖音分享文案（desc）；微信忽略 */
  desc?: string;
  /**
   * 抖音分享素材模板 ID（运营后台审核通过后填写）。
   * 抖音 30.9+ 会忽略代码 imageUrl，改走后台「分享配置」或本 templateId。
   */
  templateId?: string;
  query?: string;
}

/**
 * 分享图放主包 `images/share/`（勿放 subpkg_items：抖音/未加载分包时 imageUrl 会失效）。
 * 旧路径副本仍留在 subpkg_items/images/share/ 作备份。
 */
const SHARE_IMAGE_ROOT = 'images/share';

export const SHARE_IMAGES: Record<ShareScene, string> = {
  core_gameplay: `${SHARE_IMAGE_ROOT}/share_core_gameplay.jpg`,
  decor_gameplay: `${SHARE_IMAGE_ROOT}/share_decor_gameplay.jpg`,
  unlock_cell: `${SHARE_IMAGE_ROOT}/share_unlock_cell.jpg`,
};

/**
 * 抖音运营后台「分享配置 / 分享素材」审核通过后的 templateId。
 * 未配置时仍传 title/desc/imageUrl（旧客户端与端内优先级可用）。
 */
export const DOUYIN_SHARE_TEMPLATE_IDS: Partial<Record<ShareScene | 'default', string>> = {
  // default: '',
  // unlock_cell: '',
};

function douyinTemplateId(scene: ShareScene | 'default'): string | undefined {
  const id = DOUYIN_SHARE_TEMPLATE_IDS[scene] || DOUYIN_SHARE_TEMPLATE_IDS.default;
  return id && String(id).trim() ? String(id).trim() : undefined;
}

export function createDefaultShare(level: number, _collectedCount: number): SharePayload {
  return {
    title: '花花一合，停不下来！',
    desc: '合合花花开店，越玩越上瘾～',
    imageUrl: SHARE_IMAGES.core_gameplay,
    templateId: douyinTemplateId('core_gameplay'),
    query: `invite=true&level=${level}`,
  };
}

export function createShopInviteShare(level: number): SharePayload {
  return {
    title: '来我花店，越合越上头！',
    desc: '来我的花花妙屋逛逛吧！',
    imageUrl: SHARE_IMAGES.core_gameplay,
    templateId: douyinTemplateId('core_gameplay'),
    query: `visit=true&level=${level}`,
  };
}

export function createUnlockCellShare(cellIndex: number): SharePayload {
  return {
    title: '差一格，救救花店！',
    desc: '帮我转发解锁格子，花店就差你这一下！',
    imageUrl: SHARE_IMAGES.unlock_cell,
    templateId: douyinTemplateId('unlock_cell'),
    query: `unlock_cell=${cellIndex}`,
  };
}

export function createWarehouseSlotShare(slotIndex: number): SharePayload {
  return {
    title: '仓库爆了，速来救场！',
    desc: '帮我转发扩一下仓库格子！',
    imageUrl: SHARE_IMAGES.core_gameplay,
    templateId: douyinTemplateId('core_gameplay'),
    query: `warehouse_slot=${slotIndex}`,
  };
}

export function createAffinityCardShare(card: AffinityCardDef, imageUrl?: string): SharePayload {
  return {
    title: `抽到「${card.title}」了！`,
    desc: '花花妙屋羁绊卡，来看看我的好运！',
    imageUrl: imageUrl ?? SHARE_IMAGES.core_gameplay,
    templateId: douyinTemplateId('default'),
    query: `affinity_card=${card.id}&owner=${card.ownerTypeId}`,
  };
}

export function createWishLuckyShare(imageUrl?: string): SharePayload {
  return {
    title: imageUrl ? '我的十连许愿结果，欧气来了！' : '欧气来了，接住！',
    desc: '花花妙屋许愿十连，欧气分享给你！',
    imageUrl: imageUrl ?? SHARE_IMAGES.core_gameplay,
    templateId: douyinTemplateId('default'),
    query: 'wish_lucky=true',
  };
}

export function createFlowerCardShare(card: FlowerCard): SharePayload {
  return {
    title: `送你一朵「${card.name}」`,
    desc: '花花妙屋花卡，送给你一朵小花～',
    imageUrl: SHARE_IMAGES.core_gameplay,
    templateId: douyinTemplateId('default'),
    query: `card=${card.id}`,
  };
}
