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
          ? `${def.persona}登场，订单互动可提升 Bond。`
          : '新熟客登场，订单互动可提升 Bond。',
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
        desc: '合成偶遇花语泡泡，额外掉落一份奖励。',
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
        desc: '组合订单出现更频繁，完成奖励更丰厚。',
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
        desc: '每逢 5 级可额外领取一份高阶宝箱。',
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
        desc: '世界地图入口开启，前往新场景与活动。',
        iconKey: 'ui_lvup_world_map',
      },
    ],
  },
  11: {
    ceremonyTitle: '蝶屋小憩',
    entries: [
      {
        kind: 'feature',
        title: '进阶挑战',
        desc: '每日挑战升为进阶档，任务池与周轨奖励更丰富。',
        iconKey: 'icon_chart',
      },
      {
        kind: 'cosmetic',
        title: '藤编休闲椅',
        desc: '蝴蝶小屋解锁首件休闲家具，阅读角开始成形。',
        iconKey: 'butterfly_house_wicker_chair',
      },
    ],
  },
  12: {
    ceremonyTitle: '湖窗手札',
    entries: [
      {
        kind: 'cosmetic',
        title: '观蝶书写桌',
        desc: '蝴蝶小屋添置记录桌，观察笔记有了专属角落。',
        iconKey: 'butterfly_house_writing_desk',
      },
      {
        kind: 'cosmetic',
        title: '圆窗湖雾景',
        desc: '花店新增圆窗景框，把远湖晨雾收入室内。',
        iconKey: 'wallart_window_lake_round',
      },
    ],
  },
  13: {
    ceremonyTitle: '蝶影陈列',
    entries: [
      {
        kind: 'cosmetic',
        title: '观蝶玻璃柜',
        desc: '蝴蝶小屋陈列位开放，收藏感与展示感进一步加强。',
        iconKey: 'butterfly_house_display_case',
      },
    ],
  },
  14: {
    ceremonyTitle: '温室会客',
    entries: [
      {
        kind: 'cosmetic',
        title: '蝶翼双人沙发',
        desc: '蝴蝶小屋会客角成型，空间氛围更完整。',
        iconKey: 'butterfly_house_sofa',
      },
    ],
  },
  15: {
    ceremonyTitle: '远景初现',
    entries: [
      {
        kind: 'feature',
        title: '别墅预告',
        desc: '大地图尽头出现花园别墅地标，等待后续版本开放。',
        iconKey: 'icon_build',
      },
      {
        kind: 'feature',
        title: '铜宝箱补给',
        desc: '本次五级里程碑额外附赠铜宝箱 1 份。',
        iconKey: 'chest_1',
      },
    ],
  },
  20: {
    ceremonyTitle: '新店传闻',
    entries: [
      {
        kind: 'feature',
        title: '完全挑战',
        desc: '每日挑战进入完全版，周轨与全勤奖励再升一档。',
        iconKey: 'icon_chart',
      },
      {
        kind: 'feature',
        title: '蛋糕房预告',
        desc: '大地图出现蛋糕房地标，等待后续版本开放经营。',
        iconKey: 'worldmap_thumb_cake_shop',
      },
      {
        kind: 'feature',
        title: '铜宝箱补给',
        desc: '本次五级里程碑额外附赠铜宝箱 1 份。',
        iconKey: 'chest_1',
      },
    ],
  },
  25: {
    ceremonyTitle: '银阶远航',
    entries: [
      {
        kind: 'feature',
        title: '银宝箱补给',
        desc: '25级起每逢5级升级额外附赠银宝箱 1 份。',
        iconKey: 'chest_2',
      },
    ],
  },
  30: {
    ceremonyTitle: '主题藏馆',
    entries: [
      {
        kind: 'feature',
        title: '银宝箱补给',
        desc: '本次五级里程碑额外附赠银宝箱 1 份。',
        iconKey: 'chest_2',
      },
    ],
  },
  35: {
    ceremonyTitle: '花境深藏',
    entries: [
      {
        kind: 'feature',
        title: '银宝箱补给',
        desc: '本次五级里程碑额外附赠银宝箱 1 份。',
        iconKey: 'chest_2',
      },
    ],
  },
  40: {
    ceremonyTitle: '大师花坊',
    entries: [
      {
        kind: 'feature',
        title: '银宝箱补给',
        desc: '本次五级里程碑额外附赠银宝箱 1 份。',
        iconKey: 'chest_2',
      },
    ],
  },
  45: {
    ceremonyTitle: '珍藏殿堂',
    entries: [
      {
        kind: 'feature',
        title: '银宝箱补给',
        desc: '本次五级里程碑额外附赠银宝箱 1 份。',
        iconKey: 'chest_2',
      },
    ],
  },
  50: {
    ceremonyTitle: '传承花境',
    entries: [
      {
        kind: 'feature',
        title: '银宝箱补给',
        desc: '本次五级里程碑额外附赠银宝箱 1 份。',
        iconKey: 'chest_2',
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
