import type { AffinityCardDef } from '@/config/AffinityCardConfig';
import type { FlowerCard } from '@/managers/FlowerCardManager';

export type ShareScene =
  | 'core_gameplay'
  | 'decor_gameplay'
  | 'unlock_cell'
  | 'gift_stamina';

export interface SharePayload {
  title: string;
  imageUrl: string;
  query?: string;
}

const SHARE_IMAGE_ROOT = 'images/share';

export const SHARE_IMAGES: Record<Exclude<ShareScene, 'gift_stamina'>, string> = {
  core_gameplay: `${SHARE_IMAGE_ROOT}/share_core_gameplay.jpg`,
  decor_gameplay: `${SHARE_IMAGE_ROOT}/share_decor_gameplay.jpg`,
  unlock_cell: `${SHARE_IMAGE_ROOT}/share_unlock_cell.jpg`,
};

export function createDefaultShare(level: number, _collectedCount: number): SharePayload {
  return {
    title: '花花一合，停不下来！',
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `invite=true&level=${level}`,
  };
}

export function createShopInviteShare(level: number): SharePayload {
  return {
    title: '来我花店，越合越上头！',
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `visit=true&level=${level}`,
  };
}

export function createUnlockCellShare(cellIndex: number): SharePayload {
  return {
    title: '差一格，救救花店！',
    imageUrl: SHARE_IMAGES.unlock_cell,
    query: `unlock_cell=${cellIndex}`,
  };
}

export function createWarehouseSlotShare(slotIndex: number): SharePayload {
  return {
    title: '仓库爆了，速来救场！',
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `warehouse_slot=${slotIndex}`,
  };
}

export function createAffinityCardShare(card: AffinityCardDef): SharePayload {
  return {
    title: `抽到「${card.title}」了！`,
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `affinity_card=${card.id}&owner=${card.ownerTypeId}`,
  };
}

export function createWishLuckyShare(imageUrl?: string): SharePayload {
  return {
    title: imageUrl ? '我的十连许愿结果，欧气来了！' : '欧气来了，接住！',
    imageUrl: imageUrl ?? SHARE_IMAGES.core_gameplay,
    query: 'wish_lucky=true',
  };
}

export function createFlowerCardShare(card: FlowerCard): SharePayload {
  return {
    title: `送你一朵「${card.name}」`,
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `card=${card.id}`,
  };
}

export function createGiftStaminaShare(amount: number): SharePayload {
  return {
    title: `${amount} 点体力，拿去合！`,
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `gift=stamina&amount=${amount}`,
  };
}
