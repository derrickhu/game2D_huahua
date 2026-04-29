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

/** 蝴蝶小屋进入所需星级；大地图可先开放，但该房屋仍保持 10 级门槛 */
export const BUTTERFLY_HOUSE_UNLOCK_LEVEL = 10;

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
    unlockLevel: WORLD_MAP_UNLOCK_LEVEL,
    popupEvent: 'panel:openFlowerSignGacha',
  },
  {
    id: 'timed_event',
    type: 'gacha',
    label: '限时活动',
    /** 左下沿路空地（喜庆入口占位，点击打开活动面板） */
    x: 310,
    y: 1120,
    thumbKey: 'worldmap_thumb_timed_event',
    thumbSize: 300,
    unlockLevel: 1,
    popupEvent: 'panel:openEvent',
    useLiveMapThumb: false,
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
    type: 'locked',
    label: '蛋糕房',
    /** 下方偏中右圆形空地（与花坊同缩略图边长，坐标可再微调） */
    x: 1130,
    y: 570,
    thumbKey: 'worldmap_thumb_cake_shop',
    thumbSize: 320,
    unlockLevel: 20,
    useLiveMapThumb: false,
  },
  {
    id: 'garden_villa',
    type: 'locked',
    label: '花园别墅',
    x: 2020,
    y: 560,
    thumbKey: 'icon_build',
    thumbSize: 160,
    unlockLevel: 15,
  },
];
