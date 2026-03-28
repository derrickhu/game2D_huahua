/**
 * 特定等级的额外奖励（与 LevelManager 基础花愿/体力/钻石叠加）
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
  3: {
    rewardBoxItems: [
      { itemId: 'tool_mixer_1', count: 1 },
      { itemId: 'tool_mixer_2', count: 1 },
    ],
  },
  /** 花艺线 Lv.2 工具「铁丝剪刀」 */
  6: {
    rewardBoxItems: [{ itemId: 'tool_arrange_2', count: 1 }],
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
