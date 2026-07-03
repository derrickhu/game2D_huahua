/**
 * 各装修场景的房壳缩放、家具/店主显示、编辑视图缩放与可摆放区域。
 * 花园别墅等大空间壳：默认缩小人物与家具，编辑模式可缩小视野总览、放大后精调摆放。
 */
import { DEFAULT_SCENE_ID } from '@/config/StarLevelConfig';

export interface SceneRenovationProfile {
  /** 场景外景底图 TextureCache key；不填则使用通用 house_bg */
  backgroundTexture?: string;
  /** 房壳相对通用公式的额外倍率（叠在 ShopScene 基础 fit 公式上） */
  buildingScaleMultiplier: number;
  /** 叠在 SHOP_FURNITURE_DISPLAY_SCALE_MULTIPLIER 上 */
  furnitureDisplayScaleMultiplier: number;
  /** 叠在 SHOP_OWNER_DISPLAY_SCALE_MULTIPLIER 上 */
  ownerDisplayScaleMultiplier: number;
  /** 新放入家具的 placement.scale 相对 defaultScale 的乘数 */
  placementScaleMultiplier: number;
  /** 编辑模式视图缩放下限（<1 可缩小总览大房壳） */
  editViewScaleMin: number;
  editViewScaleMax: number;
  /** 进入编辑模式时的默认视图缩放 */
  editViewScaleDefault: number;
  /** 浏览（非编辑）模式下整个房间容器的缩放：<1 可在进店时显示房壳全景，人物/家具随之等比缩小 */
  browseViewScale: number;
  layoutBounds?: {
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
  };
}

const DEFAULT_PROFILE: SceneRenovationProfile = {
  buildingScaleMultiplier: 1,
  furnitureDisplayScaleMultiplier: 1,
  ownerDisplayScaleMultiplier: 1,
  placementScaleMultiplier: 1,
  editViewScaleMin: 1,
  editViewScaleMax: 2,
  editViewScaleDefault: 1,
  browseViewScale: 1,
};

const SCENE_OVERRIDES: Record<string, Partial<SceneRenovationProfile>> = {
  flower_shop: { buildingScaleMultiplier: 1.1 },
  butterfly_house: { buildingScaleMultiplier: 1.3 },
  tea_house: { buildingScaleMultiplier: 1.4 },
  forest_treehouse: { buildingScaleMultiplier: 1.4 },
  dream_cloud_house: {
    backgroundTexture: 'house_bg_dream_cloud_sky_nb2',
    buildingScaleMultiplier: 1.2,
  },
  garden_villa: {
    buildingScaleMultiplier: 1.88,
    // 之前缩得太狠，家具/人物显得过小；上调让其在大房间里比例更合理（尤其家具）
    furnitureDisplayScaleMultiplier: 0.95,
    ownerDisplayScaleMultiplier: 0.78,
    placementScaleMultiplier: 0.95,
    // 进店即看房壳全景且尽量占满画面，编辑时再放大局部精摆
    browseViewScale: 0.58,
    editViewScaleMin: 0.45,
    editViewScaleMax: 2.6,
    editViewScaleDefault: 0.58,
    layoutBounds: { minX: 18, maxX: 732, minY: 200 },
  },
};

export function getSceneRenovationProfile(sceneId: string = DEFAULT_SCENE_ID): SceneRenovationProfile {
  const override = SCENE_OVERRIDES[sceneId];
  if (!override) return { ...DEFAULT_PROFILE };
  return { ...DEFAULT_PROFILE, ...override };
}

export function getSceneBuildingScaleMultiplier(sceneId: string): number {
  return getSceneRenovationProfile(sceneId).buildingScaleMultiplier;
}

export function getSceneFurnitureDisplayScaleMultiplier(sceneId: string): number {
  return getSceneRenovationProfile(sceneId).furnitureDisplayScaleMultiplier;
}

export function getSceneOwnerDisplayScaleMultiplier(sceneId: string): number {
  return getSceneRenovationProfile(sceneId).ownerDisplayScaleMultiplier;
}

export function getScenePlacementScaleMultiplier(sceneId: string): number {
  return getSceneRenovationProfile(sceneId).placementScaleMultiplier;
}
