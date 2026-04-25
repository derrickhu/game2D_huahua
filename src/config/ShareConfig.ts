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

export function createDefaultShare(level: number, collectedCount: number): SharePayload {
  return {
    title: `花花妙屋 Lv.${level}，合成鲜花开满屏！`,
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `invite=true&level=${level}`,
  };
}

export function createShopInviteShare(level: number): SharePayload {
  return {
    title: '帮我照看花店，一起把订单做爆！',
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `visit=true&level=${level}`,
  };
}

export function createUnlockCellShare(cellIndex: number): SharePayload {
  return {
    title: '我卡在这格了，快来帮我开路！',
    imageUrl: SHARE_IMAGES.unlock_cell,
    query: `unlock_cell=${cellIndex}`,
  };
}

export function createAffinityCardShare(card: AffinityCardDef): SharePayload {
  return {
    title: `${card.rarity} 友谊卡「${card.title}」到手，这张你有吗？`,
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `affinity_card=${card.id}&owner=${card.ownerTypeId}`,
  };
}

export function createWishLuckyShare(): SharePayload {
  return {
    title: '今天欧气不错，来许愿喷泉试试！',
    imageUrl: SHARE_IMAGES.decor_gameplay,
    query: 'wish_lucky=true',
  };
}

export function createFlowerCardShare(card: FlowerCard): SharePayload {
  return {
    title: `这张「${card.name}」花语送给你：${card.quote}`,
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `card=${card.id}`,
  };
}

export function createGiftStaminaShare(amount: number): SharePayload {
  return {
    title: `花花妙屋好友送你 ${amount} 点体力，快来领！`,
    imageUrl: SHARE_IMAGES.core_gameplay,
    query: `gift=stamina&amount=${amount}`,
  };
}
