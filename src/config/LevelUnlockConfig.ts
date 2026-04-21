/**
 * 升星仪式：每星级开放内容卡片表
 *
 * 数据驱动 LevelUpPopup 的「升星仪式 · 解锁卡片」段：
 *  - ceremonyTitle：本星级仪式名（叠在标题栏，弱化「恭喜升级」感）
 *  - entries：本星级新开放的内容（卡片区，配 icon + 描述）
 *
 * 仅做 UI 展示数据；具体玩法门控仍在各自 Config（如 MERGE_COMPANION_MIN_GLOBAL_LEVEL=3）；
 * AffinityManager.unlockForLevel(level) 已挂在 LevelManager 的 star:levelUp 链上独立处理。
 */

import { AFFINITY_MAP, AFFINITY_UNLOCK_LEVELS } from './AffinityConfig';

export type LevelUnlockEntryKind =
  | 'feature'        // 玩法功能解锁（花语泡泡 / 组合单 / 高阶宝箱等）
  | 'affinity'       // 熟客解锁
  | 'shop'           // 商店货架升档
  | 'map'            // 大地图入口
  | 'tool'           // 高阶工具线
  | 'cosmetic';      // 装修/换装类内容

export interface LevelUnlockEntry {
  kind: LevelUnlockEntryKind;
  /** 卡片标题（中文短句，10 字内最佳） */
  title: string;
  /** 卡片副文案（一句话讲清楚） */
  desc: string;
  /**
   * 卡片图标 TextureCache key；缺省时由 LevelUnlockCard 内回退到分类默认图标。
   * 优先复用现有素材：
   *  - feature 类：'icon_basket' / 'icon_book' / 'icon_chart'
   *  - affinity：customer_xxx
   *  - shop：'icon_shop_nb2'
   *  - map：'icon_world_map'（暂无则回退到 icon_chart）
   *  - tool / cosmetic：素材 key 或物品 itemId
   */
  iconKey?: string;
  /** 业务 payload（如该熟客 typeId / 工具 itemId / 商店 shelfId 等，方便 click 入口扩展） */
  payload?: string;
}

export interface LevelUnlockDef {
  level: number;
  ceremonyTitle: string;
  entries: LevelUnlockEntry[];
}

/**
 * 把已配置的「熟客解锁等级」自动转成 LevelUnlockEntry，避免两边维护。
 */
function affinityEntriesForLevel(level: number): LevelUnlockEntry[] {
  return Object.entries(AFFINITY_UNLOCK_LEVELS)
    .filter(([, lv]) => lv === level)
    .map(([typeId]) => {
      const def = AFFINITY_MAP.get(typeId);
      return {
        kind: 'affinity' as const,
        title: def ? `熟客 · ${def.bondName}` : `熟客 · ${typeId}`,
        desc: def
          ? `${def.persona}（订单 +Bond）`
          : '该等级解锁一位新熟客，订单互动可累积羁绊。',
        iconKey: `customer_${typeId}`,
        payload: typeId,
      };
    });
}

/** 主表：仅维护「玩法/商店/地图/工具/装修」类卡片，熟客自动并入。 */
const LEVEL_UNLOCK_BASE: Record<number, Omit<LevelUnlockDef, 'level'>> = {
  2: {
    ceremonyTitle: '初春萌芽',
    entries: [
      {
        kind: 'tool',
        title: '育苗盘 Lv.3',
        desc: '园艺线 Lv.3 工具到货，鲜花产线再升一档。',
        iconKey: 'tool_plant_3',
      },
    ],
  },
  3: {
    ceremonyTitle: '花语初绽',
    entries: [
      {
        kind: 'feature',
        title: '花语泡泡',
        desc: '合成时偶尔飘出花语泡泡，免费再得一份产物。',
        iconKey: 'ui_lvup_companion_bubble',
      },
      {
        kind: 'tool',
        title: '冷饮搅拌器 Lv.1/2',
        desc: '冷饮线工具开放，饮品订单接入。',
        iconKey: 'tool_mixer_1',
      },
      {
        kind: 'cosmetic',
        title: '绿植 Lv.6 礼包',
        desc: '高阶绿植样品送入收纳盒，可直接摆上棋盘。',
        iconKey: 'flower_green_6',
      },
    ],
  },
  4: {
    ceremonyTitle: '熟客初识',
    entries: [
      {
        kind: 'feature',
        title: '组合订单提速',
        desc: '订单池开放更高概率的组合单，奖励翻倍。',
        iconKey: 'ui_lvup_combo_boost',
      },
      {
        kind: 'tool',
        title: '园艺线 Lv.5 工具',
        desc: '园艺产线再次升档。',
        iconKey: 'tool_plant_5',
      },
    ],
  },
  5: {
    ceremonyTitle: '花艺花束',
    entries: [
      {
        kind: 'tool',
        title: '包装铁丝 Lv.1 ×2',
        desc: '花束线开张，订单需求会出现「花束」槽。',
        iconKey: 'tool_arrange_1',
      },
      {
        kind: 'feature',
        title: '高阶礼包',
        desc: '5 级开始每 5 级额外获得宝箱。',
        iconKey: 'ui_lvup_high_chest',
      },
    ],
  },
  6: {
    ceremonyTitle: '烘焙之光',
    entries: [
      {
        kind: 'tool',
        title: '擀面杖 Lv.1',
        desc: '烘焙线开张，新增甜品订单。',
        iconKey: 'tool_bake_1',
      },
    ],
  },
  7: {
    ceremonyTitle: '诗意常客',
    entries: [
      {
        kind: 'cosmetic',
        title: '花束 Lv.5 礼包',
        desc: '高阶花束 + 甜品 Lv.3 直送收纳盒。',
        iconKey: 'flower_bouquet_5',
      },
    ],
  },
  8: {
    ceremonyTitle: '夜赛初临',
    entries: [
      {
        kind: 'tool',
        title: '烘焙工具 Lv.1/2',
        desc: '甜品线产能再升一档。',
        iconKey: 'tool_bake_2',
      },
    ],
  },
  9: {
    ceremonyTitle: '盛景之夜',
    entries: [
      {
        kind: 'cosmetic',
        title: '甜品 Lv.6 / 花束 Lv.7',
        desc: '高阶产物礼包送入收纳盒。',
        iconKey: 'drink_dessert_6',
      },
    ],
  },
  10: {
    ceremonyTitle: '世界开门',
    entries: [
      {
        kind: 'map',
        title: '大地图开放',
        desc: '解锁世界地图入口，可拜访新场景与活动。',
        iconKey: 'ui_lvup_world_map',
      },
      {
        kind: 'feature',
        title: '蝴蝶捕虫网',
        desc: '蝴蝶饮品产线工具入库，许愿喷泉硬币 ×10。',
        iconKey: 'ui_lvup_butterfly_quest',
      },
    ],
  },
};

const LEVEL_UNLOCKS: Map<number, LevelUnlockDef> = (() => {
  const map = new Map<number, LevelUnlockDef>();
  const allLevels = new Set<number>([
    ...Object.keys(LEVEL_UNLOCK_BASE).map(s => Number(s)),
    ...Object.values(AFFINITY_UNLOCK_LEVELS),
  ]);
  for (const lvNum of allLevels) {
    const lv = Number(lvNum);
    if (!Number.isFinite(lv) || lv <= 0) continue;
    const base = LEVEL_UNLOCK_BASE[lv];
    const affinities = affinityEntriesForLevel(lv);
    const entries: LevelUnlockEntry[] = [
      ...affinities,
      ...(base?.entries ?? []),
    ];
    if (entries.length === 0) continue;
    map.set(lv, {
      level: lv,
      ceremonyTitle: base?.ceremonyTitle ?? `Lv.${lv} 升星仪式`,
      entries,
    });
  }
  return map;
})();

/** 取该升星等级的仪式数据；无配置返回 null（弹窗回退到默认「恭喜升级」） */
export function getLevelUnlockDef(level: number): LevelUnlockDef | null {
  return LEVEL_UNLOCKS.get(level) ?? null;
}

/** 多级跳跃时聚合多个等级的解锁卡片（保留各级 ceremonyTitle 用于副标题） */
export function getLevelUnlocksInRange(
  oldLevel: number,
  newLevel: number,
): LevelUnlockDef[] {
  const out: LevelUnlockDef[] = [];
  for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
    const def = LEVEL_UNLOCKS.get(lv);
    if (def) out.push(def);
  }
  return out;
}

/** 用于顶栏星级条预览：取「下一星」会开放的内容 */
export function getNextLevelUnlockPreview(currentLevel: number): LevelUnlockDef | null {
  return getLevelUnlockDef(currentLevel + 1);
}
