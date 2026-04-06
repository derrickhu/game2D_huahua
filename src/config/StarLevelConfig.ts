/**
 * 星级配置
 *
 * 星星 ⭐ = 购买家具/换装后累积的评分（只增不减，不可消费）
 * 顶栏「等级 + 进度条」使用**全局**累计星与**全局**星级曲线（与当前装修哪间房无关）。
 *
 * 各场景的 thresholds / milestones 仍保留，供将来「单房间成就」等扩展；进度条与 LevelManager 只用全局表。
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

const BUTTERFLY_HOUSE_THRESHOLDS: StarLevelThreshold[] = [
  { level: 1,  starRequired: 0,   label: '一星' },
  { level: 2,  starRequired: 8,   label: '二星' },
  { level: 3,  starRequired: 18,  label: '三星' },
  { level: 4,  starRequired: 30,  label: '四星' },
  { level: 5,  starRequired: 45,  label: '五星' },
  { level: 6,  starRequired: 65,  label: '六星' },
  { level: 7,  starRequired: 90,  label: '七星' },
  { level: 8,  starRequired: 120, label: '八星' },
];

const BUTTERFLY_HOUSE_MILESTONES: StarMilestoneDef[] = [
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
    sceneId: 'butterfly_house',
    name: '蝴蝶小屋',
    maxStarLevel: 8,
    thresholds: BUTTERFLY_HOUSE_THRESHOLDS,
    milestones: BUTTERFLY_HOUSE_MILESTONES,
  },
];

export const SCENE_MAP = new Map<string, SceneDef>(
  SCENE_DEFS.map(s => [s.sceneId, s])
);

export const DEFAULT_SCENE_ID = 'flower_shop';

// ---------------------------------------------------------------------------
// 全局星级（顶栏进度条、globalLevel、解锁门控）
// ---------------------------------------------------------------------------

/** 升到该星级所需的累计星星下限（L1=0，L2=5，…，L10=160；L11 起公式延伸，无硬顶） */
export function getGlobalStarRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= 10) {
    return FLOWER_SHOP_THRESHOLDS[level - 1].starRequired;
  }
  let s = 160;
  for (let L = 11; L <= level; L++) {
    s += 40 + (L - 11) * 5;
  }
  return s;
}

const CN_DIGIT = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 2～99 的中文数字 + 「星」，用于全局星级标签 */
function globalStarLabelCn(level: number): string {
  if (level <= 10) {
    return FLOWER_SHOP_THRESHOLDS[level - 1]?.label ?? '一星';
  }
  if (level < 20) {
    const u = level % 10;
    return u === 0 ? '十星' : `十${CN_DIGIT[u]}星`;
  }
  if (level < 100) {
    const t = Math.floor(level / 10);
    const u = level % 10;
    const head = `${CN_DIGIT[t]}十`;
    const tail = u === 0 ? '' : CN_DIGIT[u];
    return `${head}${tail}星`;
  }
  return `${level}星`;
}

/** 根据全局累计星星计算当前全局星级 */
export function getGlobalStarLevel(star: number): number {
  const n = Math.max(0, Math.floor(star));
  let level = 1;
  for (let L = 2; ; L++) {
    const need = getGlobalStarRequiredForLevel(L);
    if (n < need) break;
    level = L;
    if (L > 50000) break;
  }
  return level;
}

export function getGlobalStarLevelLabel(level: number): string {
  const lv = Math.max(1, Math.floor(level));
  return globalStarLabelCn(lv);
}

/** 下一星级所需累计星；全局无满级，始终有下一档 */
export function getGlobalNextLevelStarRequired(currentLevel: number): number {
  return getGlobalStarRequiredForLevel(currentLevel + 1);
}

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
 * 由存档里的场景进度推断全局门控等级（与 `CurrencyManager.state.level` 一致时应相同）。
 * 兼容旧档：取各场景记录中星星的最大值，再套全局星级曲线。
 */
export function getGlobalLevel(sceneProgresses: SceneStarProgress[]): number {
  if (!sceneProgresses.length) return 1;
  const mergedStar = Math.max(0, ...sceneProgresses.map(sp => sp.star ?? 0));
  return Math.max(1, getGlobalStarLevel(mergedStar));
}

/** 升星奖励（不含花愿，防止短路循环） */
export interface StarLevelUpReward {
  stamina: number;
  diamond: number;
  rewardBoxItems: Array<{ itemId: string; count: number }>;
}

export function buildStarLevelUpReward(newLevel: number): StarLevelUpReward {
  let diamond = 10;
  if (newLevel > 0 && newLevel % 5 === 0) diamond += 10;

  const rewardBoxItems: Array<{ itemId: string; count: number }> = [
    { itemId: 'stamina_chest_1', count: 1 },
  ];
  if (newLevel % 5 === 0) {
    rewardBoxItems.push({ itemId: newLevel >= 8 ? 'chest_2' : 'chest_1', count: 1 });
  }

  return {
    stamina: 0,
    diamond,
    rewardBoxItems,
  };
}
