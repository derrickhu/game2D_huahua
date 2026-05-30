import {
  CRYSTAL_BALL_ITEM_ID,
  GOLDEN_SCISSORS_ITEM_ID,
  LUCKY_COIN_ITEM_ID,
} from '@/config/ItemConfig';
import { DECO_THEME_QINGLIAN } from '@/config/DecoThemeConfig';

export const NEWBIE_GIFT_PACK_ADS_REQUIRED = 2;

/** 宣传页按钮上方主文案（第一行前缀 + 高亮后缀） */
export function getNewbieGiftCtaRulePrefix(): string {
  return `看${NEWBIE_GIFT_PACK_ADS_REQUIRED}次广告 · 10件豪礼`;
}

export const NEWBIE_GIFT_CTA_RULE_HIGHLIGHT = '永久拥有';

export const NEWBIE_GIFT_PACK_QUEST_ID = DECO_THEME_QINGLIAN.newbieGiftQuestId;

export const NEWBIE_GIFT_PACK_ROOM_STYLE_ID = 'style_qinglian_lotus_shop_nb2';

export const QINGLIAN_NEWBIE_DECO_IDS = [
  'qinglian_flower_cart',
  'qinglian_cloud_rug',
  'qinglian_koi_bench',
  'qinglian_lotus_screen',
  'qinglian_lotus_lamp',
  'qinglian_lotus_pond_table',
] as const;

export interface NewbieGiftBoardGrant {
  itemId: string;
  count: number;
  textureKey: string;
  label: string;
}

export const NEWBIE_GIFT_PACK_BOARD_GRANTS: readonly NewbieGiftBoardGrant[] = [
  { itemId: LUCKY_COIN_ITEM_ID, count: 3, textureKey: 'icon_coin', label: '幸运金币' },
  { itemId: CRYSTAL_BALL_ITEM_ID, count: 3, textureKey: 'icon_crystal_ball', label: '万能水晶' },
  { itemId: GOLDEN_SCISSORS_ITEM_ID, count: 3, textureKey: 'icon_golden_scissors', label: '金剪刀' },
];

export interface NewbieGiftPreviewItem {
  textureKey: string;
  label: string;
  amount?: number;
}

export function getNewbieGiftDecoPreviewItems(): NewbieGiftPreviewItem[] {
  return [
    { textureKey: 'bg_room_qinglian_lotus_shop_nb2', label: '清涟荷影花坊' },
    { textureKey: 'qinglian_flower_cart', label: '帷帘花车' },
    { textureKey: 'qinglian_cloud_rug', label: '祥云地毯' },
    { textureKey: 'qinglian_koi_bench', label: '锦鲤曲榻' },
    { textureKey: 'qinglian_lotus_screen', label: '荷梦屏风' },
    { textureKey: 'qinglian_lotus_lamp', label: '莲光立灯' },
    { textureKey: 'qinglian_lotus_pond_table', label: '清池茶案' },
  ];
}

export function getNewbieGiftBoardPreviewItems(): NewbieGiftPreviewItem[] {
  return NEWBIE_GIFT_PACK_BOARD_GRANTS.map(g => ({
    textureKey: g.textureKey,
    label: g.label,
    amount: g.count,
  }));
}

/** @deprecated 使用分区函数 getNewbieGiftDecoPreviewItems / getNewbieGiftBoardPreviewItems */
export function getNewbieGiftPackPreviewItems(): NewbieGiftPreviewItem[] {
  return [...getNewbieGiftDecoPreviewItems(), ...getNewbieGiftBoardPreviewItems()];
}
