/**
 * 星级配置
 *
 * 星星 ⭐ = 购买家具/换装后累积的评分（只增不减，不可消费）
 * 星级 = 游戏等级，由当前场景的累积星星决定
 *
 * 每个场景有独立的星星计数和星级阈值表。
 * 当前版本仅实现花店场景（满星十星）。
 */

export interface SceneStarProgress {
  sceneId: string;
  star: number;
  starLevel: number;
  completed: boolean;
}

export interface StarLevelThreshold {
  level: number;
  starRequired: number;
  label: string;
}

export interface StarMilestoneDef {
  star: number;
  rewards: MilestoneReward[];
}

export interface MilestoneReward {
  type: 'stamina' | 'diamond' | 'chest' | 'item';
  amount: number;
  itemId?: string;
}

export interface SceneDef {
  sceneId: string;
  name: string;
  maxStarLevel: number;
  thresholds: StarLevelThreshold[];
  milestones: StarMilestoneDef[];
}

const FLOWER_SHOP_THRESHOLDS: StarLevelThreshold[] = [
  { level: 1,  starRequired: 0,   label: '一星' },
  { level: 2,  starRequired: 5,   label: '二星' },
  { level: 3,  starRequired: 12,  label: '三星' },
  { level: 4,  starRequired: 22,  label: '四星' },
  { level: 5,  starRequired: 35,  label: '五星' },
  { level: 6,  starRequired: 50,  label: '六星' },
  { level: 7,  starRequired: 70,  label: '七星' },
  { level: 8,  starRequired: 95,  label: '八星' },
  { level: 9,  starRequired: 125, label: '九星' },
  { level: 10, starRequired: 160, label: '十星' },
];

const FLOWER_SHOP_MILESTONES: StarMilestoneDef[] = [
  { star: 5,   rewards: [{ type: 'stamina', amount: 20 }] },
  { star: 10,  rewards: [{ type: 'chest', amount: 1, itemId: 'chest_1' }] },
  { star: 20,  rewards: [{ type: 'diamond', amount: 5 }, { type: 'chest', amount: 1, itemId: 'chest_2' }] },
  { star: 35,  rewards: [{ type: 'stamina', amount: 30 }, { type: 'chest', amount: 1, itemId: 'chest_2' }] },
  { star: 50,  rewards: [{ type: 'diamond', amount: 10 }] },
  { star: 70,  rewards: [{ type: 'chest', amount: 1, itemId: 'chest_4' }] },
  { star: 95,  rewards: [{ type: 'diamond', amount: 10 }, { type: 'stamina', amount: 40 }] },
  { star: 125, rewards: [{ type: 'chest', amount: 1, itemId: 'chest_4' }, { type: 'diamond', amount: 15 }] },
  { star: 160, rewards: [{ type: 'diamond', amount: 20 }, { type: 'stamina', amount: 50 }] },
];

const TEA_HOUSE_THRESHOLDS: StarLevelThreshold[] = [
  { level: 1,  starRequired: 0,   label: '一星' },
  { level: 2,  starRequired: 8,   label: '二星' },
  { level: 3,  starRequired: 18,  label: '三星' },
  { level: 4,  starRequired: 30,  label: '四星' },
  { level: 5,  starRequired: 45,  label: '五星' },
  { level: 6,  starRequired: 65,  label: '六星' },
  { level: 7,  starRequired: 90,  label: '七星' },
  { level: 8,  starRequired: 120, label: '八星' },
];

const TEA_HOUSE_MILESTONES: StarMilestoneDef[] = [
  { star: 8,   rewards: [{ type: 'stamina', amount: 25 }] },
  { star: 18,  rewards: [{ type: 'chest', amount: 1, itemId: 'chest_1' }] },
  { star: 30,  rewards: [{ type: 'diamond', amount: 8 }, { type: 'chest', amount: 1, itemId: 'chest_2' }] },
  { star: 45,  rewards: [{ type: 'stamina', amount: 35 }, { type: 'diamond', amount: 10 }] },
  { star: 65,  rewards: [{ type: 'chest', amount: 1, itemId: 'chest_3' }] },
  { star: 90,  rewards: [{ type: 'diamond', amount: 15 }, { type: 'stamina', amount: 45 }] },
  { star: 120, rewards: [{ type: 'diamond', amount: 25 }, { type: 'chest', amount: 1, itemId: 'chest_4' }] },
];

export const SCENE_DEFS: SceneDef[] = [
  {
    sceneId: 'flower_shop',
    name: '花店',
    maxStarLevel: 10,
    thresholds: FLOWER_SHOP_THRESHOLDS,
    milestones: FLOWER_SHOP_MILESTONES,
  },
  {
    sceneId: 'tea_house',
    name: '茶屋',
    maxStarLevel: 8,
    thresholds: TEA_HOUSE_THRESHOLDS,
    milestones: TEA_HOUSE_MILESTONES,
  },
];

export const SCENE_MAP = new Map<string, SceneDef>(
  SCENE_DEFS.map(s => [s.sceneId, s])
);

export const DEFAULT_SCENE_ID = 'flower_shop';

/** 根据累积星星计算当前星级 */
export function getStarLevel(sceneId: string, star: number): number {
  const scene = SCENE_MAP.get(sceneId);
  if (!scene) return 1;
  let level = 1;
  for (const t of scene.thresholds) {
    if (star >= t.starRequired) level = t.level;
    else break;
  }
  return level;
}

/** 获取当前星级的标签（一星、二星...） */
export function getStarLevelLabel(sceneId: string, starLevel: number): string {
  const scene = SCENE_MAP.get(sceneId);
  if (!scene) return '一星';
  const t = scene.thresholds.find(t => t.level === starLevel);
  return t?.label ?? '一星';
}

/** 获取下一星级所需星星数，满星返回 -1 */
export function getNextLevelStarRequired(sceneId: string, currentLevel: number): number {
  const scene = SCENE_MAP.get(sceneId);
  if (!scene) return -1;
  const next = scene.thresholds.find(t => t.level === currentLevel + 1);
  return next?.starRequired ?? -1;
}

/** 判断是否已满星 */
export function isSceneCompleted(sceneId: string, starLevel: number): boolean {
  const scene = SCENE_MAP.get(sceneId);
  if (!scene) return false;
  return starLevel >= scene.maxStarLevel;
}

/** 获取场景满星时的星星数 */
export function getMaxStar(sceneId: string): number {
  const scene = SCENE_MAP.get(sceneId);
  if (!scene) return 0;
  const last = scene.thresholds[scene.thresholds.length - 1];
  return last?.starRequired ?? 0;
}

/**
 * 全局游戏等级 = 已完成场景数 × 满星级数 + 当前场景星级
 * 用于订单档位权重等全局门控
 */
export function getGlobalLevel(sceneProgresses: SceneStarProgress[]): number {
  let total = 0;
  for (const sp of sceneProgresses) {
    const scene = SCENE_MAP.get(sp.sceneId);
    if (!scene) continue;
    if (sp.completed) {
      total += scene.maxStarLevel;
    } else {
      total += sp.starLevel;
    }
  }
  return Math.max(1, total);
}

/** 升星奖励（不含花愿，防止短路循环） */
export interface StarLevelUpReward {
  stamina: number;
  diamond: number;
  rewardBoxItems: Array<{ itemId: string; count: number }>;
}

export function buildStarLevelUpReward(newLevel: number): StarLevelUpReward {
  let diamond = 10;
  if (newLevel === 5 || newLevel === 10) diamond += 10;

  return {
    stamina: 20,
    diamond,
    rewardBoxItems: newLevel % 5 === 0
      ? [{ itemId: newLevel >= 8 ? 'chest_2' : 'chest_1', count: 1 }]
      : [],
  };
}
