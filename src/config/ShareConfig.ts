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
 * 微信分享图：放在 items 分包（与历史上线路径一致，不占主包 4MB 限额）。
 * 抖音 30.9+ 忽略代码 imageUrl，必须传开放平台「分享配置」审核通过的 templateId。
 */
const SHARE_IMAGE_ROOT = 'subpkg_items/images/share';

export const SHARE_IMAGES: Record<ShareScene, string> = {
  core_gameplay: `${SHARE_IMAGE_ROOT}/share_core_gameplay.jpg`,
  decor_gameplay: `${SHARE_IMAGE_ROOT}/share_decor_gameplay.jpg`,
  unlock_cell: `${SHARE_IMAGE_ROOT}/share_unlock_cell.jpg`,
};

/** 抖音开放平台已审核的分享模板。装修图尚未配置，故不填 decor_gameplay。 */
export const DOUYIN_SHARE_TEMPLATE_IDS: Partial<Record<ShareScene, string>> = {
  unlock_cell: '6igk9567d1bj137haf',
  core_gameplay: '1ei991rtssllxqprjk',
};

function withSceneTemplate(scene: ShareScene, payload: SharePayload): SharePayload {
  const templateId = DOUYIN_SHARE_TEMPLATE_IDS[scene];
  return templateId ? { ...payload, templateId } : payload;
}

export function createDefaultShare(level: number, _collectedCount: number): SharePayload {
  return withSceneTemplate('core_gameplay', {
    title: '花花一合，停不下来！',
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `invite=true&level=${level}`,
  });
}

export function createShopInviteShare(level: number): SharePayload {
  return withSceneTemplate('core_gameplay', {
    title: '来我花店，越合越上头！',
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `visit=true&level=${level}`,
  });
}

export function createUnlockCellShare(cellIndex: number): SharePayload {
  return withSceneTemplate('unlock_cell', {
    title: '差一格，救救花店！',
    imageUrl: SHARE_IMAGES.unlock_cell,
    query: `unlock_cell=${cellIndex}`,
  });
}

export function createWarehouseSlotShare(slotIndex: number): SharePayload {
  return withSceneTemplate('core_gameplay', {
    title: '仓库爆了，速来救场！',
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `warehouse_slot=${slotIndex}`,
  });
}

export function createAffinityCardShare(card: AffinityCardDef, imageUrl?: string): SharePayload {
  return withSceneTemplate('core_gameplay', {
    title: `抽到「${card.title}」了！`,
    imageUrl: imageUrl ?? SHARE_IMAGES.core_gameplay,
    query: `affinity_card=${card.id}&owner=${card.ownerTypeId}`,
  });
}

export function createWishLuckyShare(imageUrl?: string): SharePayload {
  return withSceneTemplate('core_gameplay', {
    title: imageUrl ? '我的十连许愿结果，欧气来了！' : '欧气来了，接住！',
    imageUrl: imageUrl ?? SHARE_IMAGES.core_gameplay,
    query: 'wish_lucky=true',
  });
}

export function createFlowerCardShare(card: FlowerCard): SharePayload {
  return withSceneTemplate('core_gameplay', {
    title: `送你一朵「${card.name}」`,
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `card=${card.id}`,
  });
}
