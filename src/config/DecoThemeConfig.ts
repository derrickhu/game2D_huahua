/**
 * 跨场景装修主题线（与 flower_room 场景专属 Tab 并列）
 */
export const DECO_THEME_QINGLIAN = {
  tabId: 'qinglian' as const,
  name: '清涟荷影',
  trayTextureKey: 'furniture_tray_tab_qinglian_idle',
  newbieGiftQuestId: 'qinglian_newbie_gift_claimed',
} as const;

export type DecoThemeTabId = typeof DECO_THEME_QINGLIAN.tabId;
