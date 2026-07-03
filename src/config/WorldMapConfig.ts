/**
 * 大地图配置
 *
 * 定义地图上的建筑节点：类型、坐标、缩略图、解锁条件、交互行为。
 *
 * 底图为 **单独 9:16 竖幅** 横向拼接：`WORLD_MAP_CONTENT_W` = N × DESIGN_WIDTH，
 * 高与 `WORLD_MAP_CONTENT_H`（= DESIGN_HEIGHT，与 750 宽构成 9:16）一致。
 * 运行时 Sprite 高取 `Game.logicHeight`，节点 y 按比例映射。
 */

import { DESIGN_WIDTH, DESIGN_HEIGHT } from '@/config/Constants';

export type MapNodeType = 'current_house' | 'house' | 'popup_shop' | 'locked' | 'gacha';

export interface MapNodeDef {
  id: string;
  type: MapNodeType;
  label: string;
  /** 节点中心 x（地图内容坐标） */
  x: number;
  /** 节点中心 y（地图内容坐标） */
  y: number;
  /** TextureCache key — 建筑缩略图 */
  thumbKey: string;
  /** 缩略图显示尺寸（最长边） */
  thumbSize?: number;
  /** 解锁所需全局等级（globalLevel），不满足则降级为 locked */
  unlockLevel: number;
  /** type=house 时：对应装修场景 sceneId */
  targetSceneId?: string;
  /**
   * 支线房屋：需花愿一次性购买解锁后才能进入（如梦云小屋）。
   * 设置后，达到 unlockLevel 也仅显示为可购买；点击弹出确认，扣花愿并写入已购记录后方可进入。
   */
  purchaseCost?: number;
  /** type=popup_shop / gacha 时：EventBus 事件名 */
  popupEvent?: string;
  /** type=popup_shop 时：商店 ID */
  shopId?: string;
  /**
   * 为 false 时大地图该节点始终用静态 thumbKey，不用花店实时截图（RenderTexture）。
   * 默认 true：与当前 sceneId 匹配的 house / current_house 仍可显示实时缩略图。
   */
  useLiveMapThumb?: boolean;
  /**
   * 未满足 unlockLevel 时节点容器 alpha；未设则用 `MAP_NODE_UNMET_UNLOCK_ALPHA`（全图统一）。
   */
  unmetUnlockAlpha?: number;
}

/** 横向由几屏 9:16 宽度拼接（默认 3 屏 ≈ 2250 设计 px） */
export const WORLD_MAP_PANEL_COUNT = 3;

/** 地图总宽（设计 px）= 单屏宽 × 屏数 */
export const WORLD_MAP_CONTENT_W = DESIGN_WIDTH * WORLD_MAP_PANEL_COUNT;

/**
 * 地图逻辑高度（设计 px），与 DESIGN_WIDTH 构成标准 9:16 参考竖幅。
 * 资源 PNG 建议 **WORLD_MAP_CONTENT_W × WORLD_MAP_CONTENT_H**（如 2250×1334）。
 */
export const WORLD_MAP_CONTENT_H = DESIGN_HEIGHT;

/**
 * 大地图解锁所需星级（花店星级 = CurrencyManager.state.level）
 */
export const WORLD_MAP_UNLOCK_LEVEL = 8;

/**
 * 许愿喷泉解锁星级 — 比大地图入口更早开放（玩家在花店主页已能直接进入许愿）。
 * 大地图开放（Lv.8）后该节点仍可见且共享同一开放门槛。
 */
export const WISHING_FOUNTAIN_UNLOCK_LEVEL = 3;

/** 蝴蝶小屋进入所需星级；与大地图同在 8 级开放 */
export const BUTTERFLY_HOUSE_UNLOCK_LEVEL = 8;

/** 茶香小院进入所需综合等级（与 LevelUnlockConfig 25 级仪式一致） */
export const TEA_HOUSE_UNLOCK_LEVEL = 25;

/** 橡树小屋进入所需综合等级（与 LevelUnlockConfig 35 级仪式一致） */
export const FOREST_TREEHOUSE_UNLOCK_LEVEL = 35;

/** 花园别墅进入所需综合等级（与 LevelUnlockConfig 40 级仪式一致） */
export const GARDEN_VILLA_UNLOCK_LEVEL = 40;

/** 梦云小屋（支线）开放综合等级：20 级起可在大地图花愿购买解锁 */
export const DREAM_CLOUD_HOUSE_UNLOCK_LEVEL = 20;

/** 梦云小屋购买解锁所需花愿 */
export const DREAM_CLOUD_HOUSE_PURCHASE_COST = 150000;

/** 大地图「当前店铺」实时缩略图：截取最长边像素（略小于节点 thumbSize，省显存） */
export const LIVE_HOUSE_THUMB_CAPTURE_MAX = 160;

/** 未解锁建筑节点整体透明度（统一；名称与小锁同乘该 alpha） */
export const MAP_NODE_UNMET_UNLOCK_ALPHA = 0.68;

export const MAP_NODES: MapNodeDef[] = [
  {
    id: 'flower_shop',
    type: 'current_house',
    label: '花坊',
    /** 相对原 (320,455) 略向右下，再累计左移对齐底图 */
    x: 242,
    y: 512,
    thumbKey: 'worldmap_house_flower_shop',
    thumbSize: 320,
    useLiveMapThumb: false,
    unlockLevel: 1,
    targetSceneId: 'flower_shop',
  },
  {
    id: 'wishing_fountain',
    type: 'gacha',
    label: '许愿喷泉',
    /** 相对原 (570,648) 左移 300、下移 50 */
    x: 270,
    y: 698,
    thumbKey: 'worldmap_thumb_wishing_fountain_1',
    thumbSize: 150,
    /** 与花店主页「许愿」入口共享同一门槛，玩家在大地图开放前就能从花店主页直达许愿。 */
    unlockLevel: WISHING_FOUNTAIN_UNLOCK_LEVEL,
    popupEvent: 'panel:openFlowerSignGacha',
  },
  {
    id: 'butterfly_house',
    type: 'house',
    label: '蝴蝶小屋',
    /** 下方左侧圆形空地（与花坊同缩略图边长，坐标可再微调） */
    x: 600,
    y: 840,
    thumbKey: 'worldmap_thumb_butterfly_house',
    thumbSize: 320,
    unlockLevel: BUTTERFLY_HOUSE_UNLOCK_LEVEL,
    useLiveMapThumb: false,
    targetSceneId: 'butterfly_house',
  },
  {
    id: 'cake_shop',
    type: 'house',
    label: '蛋糕房',
    /** 下方偏中右圆形空地（与花坊同缩略图边长，坐标可再微调） */
    x: 1130,
    y: 570,
    thumbKey: 'worldmap_thumb_cake_shop',
    thumbSize: 320,
    unlockLevel: 15,
    useLiveMapThumb: false,
    targetSceneId: 'cake_shop',
  },
  {
    id: 'tea_house',
    type: 'house',
    label: '茶香小院',
    /** 中右草地圆地 */
    x: 1540,
    y: 780,
    thumbKey: 'worldmap_thumb_tea_house',
    thumbSize: 320,
    unlockLevel: TEA_HOUSE_UNLOCK_LEVEL,
    useLiveMapThumb: false,
    targetSceneId: 'tea_house',
  },
  {
    id: 'garden_villa',
    type: 'house',
    label: '花园别墅',
    /** 远右上圆形草地 */
    x: 2020,
    y: 430,
    thumbKey: 'worldmap_thumb_garden_villa',
    thumbSize: 320,
    unlockLevel: GARDEN_VILLA_UNLOCK_LEVEL,
    useLiveMapThumb: false,
    targetSceneId: 'garden_villa',
  },
  {
    id: 'forest_treehouse',
    type: 'house',
    label: '橡树小屋',
    /** 右下圆形草地（放大缩略图，更突出） */
    x: 1980,
    y: 900,
    thumbKey: 'worldmap_thumb_forest_treehouse',
    thumbSize: 480,
    unlockLevel: FOREST_TREEHOUSE_UNLOCK_LEVEL,
    useLiveMapThumb: false,
    targetSceneId: 'forest_treehouse',
  },
  {
    id: 'dream_cloud_house',
    type: 'house',
    label: '梦云小屋',
    /** 左下沿路圆形空地（原限时活动占位处） */
    x: 310,
    y: 1120,
    thumbKey: 'worldmap_thumb_dream_cloud_house',
    thumbSize: 340,
    unlockLevel: DREAM_CLOUD_HOUSE_UNLOCK_LEVEL,
    purchaseCost: DREAM_CLOUD_HOUSE_PURCHASE_COST,
    useLiveMapThumb: false,
    targetSceneId: 'dream_cloud_house',
  },
];
