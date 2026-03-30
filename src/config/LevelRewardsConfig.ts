/**
 * 特定等级的额外奖励（与 LevelManager 基础体力/钻石/宝箱叠加；不发花愿）
 *
 * rewardBoxItems：发放进奖励收纳盒，由玩家手动取出到棋盘。
 */
export interface LevelRewardBoxEntry {
  itemId: string;
  count: number;
}

export interface LevelExtraRewardsDef {
  rewardBoxItems?: LevelRewardBoxEntry[];
}

/** 按「升至该等级」触发（即 LevelManager 在 setLevel 之后取当前 level 查表） */
const LEVEL_EXTRA: Record<number, LevelExtraRewardsDef> = {
  /** 园艺线 Lv.3 工具「育苗盘」 */
  2: {
    rewardBoxItems: [{ itemId: 'tool_plant_3', count: 1 }],
  },
  /** 绿植线 6 级 */
  3: {
    rewardBoxItems: [{ itemId: 'flower_green_6', count: 1 }],
  },
  /** 冷饮线 Lv.1、Lv.2 搅拌器具（量杯、雪克杯） */
  4: {
    rewardBoxItems: [
      { itemId: 'tool_mixer_1', count: 1 },
      { itemId: 'tool_mixer_2', count: 1 },
    ],
  },
  /** 包装线 Lv.1「铁丝」×2（花束线前置） */
  5: {
    rewardBoxItems: [{ itemId: 'tool_arrange_1', count: 2 }],
  },
  /** 花艺线 Lv.2 工具「铁丝剪刀」 */
  6: {
    rewardBoxItems: [{ itemId: 'tool_arrange_2', count: 1 }],
  },
  /** 花束 5 级 + 甜品线 3 级 */
  7: {
    rewardBoxItems: [
      { itemId: 'flower_bouquet_5', count: 1 },
      { itemId: 'drink_dessert_3', count: 1 },
    ],
  },
  /** 烘焙线 Lv.1、Lv.2（擀面杖、打蛋器） */
  8: {
    rewardBoxItems: [
      { itemId: 'tool_bake_1', count: 1 },
      { itemId: 'tool_bake_2', count: 1 },
    ],
  },
  /** 甜品 6 级 + 花束 7 级 */
  9: {
    rewardBoxItems: [
      { itemId: 'drink_dessert_6', count: 1 },
      { itemId: 'flower_bouquet_7', count: 1 },
    ],
  },
  /** 幸运金币×1（收纳盒取出后可拖至合成链物品上随机升/降一级） */
  10: {
    rewardBoxItems: [{ itemId: 'lucky_coin_1', count: 1 }],
  },
};

/** 5、10、15、20 级：铜宝箱；25 级起每 5 级：银宝箱 */
function chestRewardForLevel(level: number): LevelRewardBoxEntry[] {
  if (level <= 0 || level % 5 !== 0) return [];
  if (level <= 20) return [{ itemId: 'chest_1', count: 1 }];
  return [{ itemId: 'chest_2', count: 1 }];
}

export function getLevelExtraRewards(level: number): LevelExtraRewardsDef {
  const explicit = LEVEL_EXTRA[level];
  const fromChest = chestRewardForLevel(level);
  const merged: LevelRewardBoxEntry[] = [
    ...(explicit?.rewardBoxItems ?? []),
    ...fromChest,
  ];
  if (merged.length === 0) return {};
  return { rewardBoxItems: merged };
}
