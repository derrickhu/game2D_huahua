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

export type MapNodeType = 'current_house' | 'house' | 'popup_shop' | 'locked';

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
  /** type=popup_shop 时：弹出面板事件 */
  popupEvent?: string;
  /** type=popup_shop 时：商店 ID */
  shopId?: string;
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
export const WORLD_MAP_UNLOCK_LEVEL = 10;

/** 大地图「当前店铺」实时缩略图：截取最长边像素（略小于节点 thumbSize，省显存） */
export const LIVE_HOUSE_THUMB_CAPTURE_MAX = 270;

export const MAP_NODES: MapNodeDef[] = [
  {
    id: 'flower_shop',
    type: 'current_house',
    label: '花语小筑',
    x: 320,
    y: 455,
    thumbKey: 'worldmap_thumb_flower_shop',
    thumbSize: 320,
    unlockLevel: 1,
    targetSceneId: 'flower_shop',
  },
  {
    id: 'flower_market',
    type: 'popup_shop',
    label: '花市',
    x: 520,
    y: 460,
    thumbKey: 'worldmap_thumb_flower_market',
    thumbSize: 150,
    unlockLevel: 10,
    popupEvent: 'worldmap:openShop',
    shopId: 'flower_market',
  },
  {
    id: 'tea_house',
    type: 'house',
    label: '茶屋',
    x: 1120,
    y: 620,
    thumbKey: 'worldmap_thumb_tea_house',
    thumbSize: 170,
    unlockLevel: 10,
    targetSceneId: 'tea_house',
  },
  {
    id: 'tool_shop',
    type: 'popup_shop',
    label: '工具铺',
    x: 1580,
    y: 400,
    thumbKey: 'worldmap_thumb_tool_shop',
    thumbSize: 140,
    unlockLevel: 10,
    popupEvent: 'worldmap:openShop',
    shopId: 'tool_shop',
  },
  {
    id: 'garden_villa',
    type: 'locked',
    label: '花园别墅',
    x: 2020,
    y: 560,
    thumbKey: 'worldmap_thumb_garden_villa',
    thumbSize: 160,
    unlockLevel: 15,
  },
];
