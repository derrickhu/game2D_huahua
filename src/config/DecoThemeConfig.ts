/**
 * 跨场景装修主题线（购买面板「主题」Tab 下的主题名）。
 *
 * 加一个新主题：在 DECO_THEME_SETS 追加 `{ id, name }`，
 * 家具 `decorationPanelTab` 仍写 `'qinglian'`（才会进「主题」Tab），并写 `themeSetId` 为这里的 id。
 * 没写 themeSetId、且 decorationPanelTab 为 qinglian 的旧家具，归入「清涟荷影」。
 */
export const DECO_THEME_QINGLIAN = {
  tabId: 'qinglian' as const,
  name: '清涟荷影',
  trayTextureKey: 'furniture_tray_tab_qinglian_idle',
  newbieGiftQuestId: 'qinglian_newbie_gift_claimed',
} as const;

export type DecoThemeTabId = typeof DECO_THEME_QINGLIAN.tabId;

export interface DecoThemeSet {
  id: string;
  name: string;
}

export const DECO_THEME_SETS: readonly DecoThemeSet[] = [
  { id: 'qinglian', name: '清涟荷影' },
];

export function decoThemeSetId(deco: {
  themeSetId?: string;
  decorationPanelTab?: string;
}): string | null {
  if (deco.themeSetId) return deco.themeSetId;
  if (deco.decorationPanelTab === 'qinglian') return 'qinglian';
  return null;
}
