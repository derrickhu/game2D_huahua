export const FRUIT_CUT_UPDATE_GRANT_LEVEL = 11;
export const FRUIT_CUT_UPDATE_GRANT_ID = 'fruit_cut_line_v1';
export const FRUIT_CUT_UPDATE_GRANT_STORAGE_KEY = 'huahua_feature_grants';

export const FRUIT_CUT_UPDATE_GRANT_ITEMS: readonly { itemId: string; count: number }[] = [
  { itemId: 'tool_farm_1', count: 2 },
  { itemId: 'tool_farm_2', count: 1 },
  { itemId: 'tool_fruit_cut_1', count: 1 },
] as const;
