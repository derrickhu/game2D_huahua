/**
 * 花店房间 2.5D 深度排序（_roomContainer.sortChildren）
 *
 * 须满足：脚点 Y 越大（越靠屏幕下/近景）越靠前；后放家具的 zLayer 仅作同深度微调，
 * 不得压过 Y（旧版 zLayer*1000 会导致「后面的」家具盖住前面的人物）。
 *
 * 「台面小物」额外 aux：与 zLayer、stackTie 之和必须 &lt; ROOM_DEPTH_Y_MULT，
 * 否则会出现 y 较小者反而盖住 y+1 行的错误遮挡。
 */

import {
  DecoSlot,
  getDepthSortTypeLift,
  getDepthSortFeetYFudge,
  type DecoDef,
} from '@/config/DecorationConfig';

/** 每条「floor(y) 台阶」的间隔，须大于同 Y 下 zLayer + stackTie + aux 的最大和 */
export const ROOM_DEPTH_Y_MULT = 2000;

/** 同 floor(y) 时后放家具略靠前（与 RoomLayoutManager.addFurniture 的 zLayer 递增配合） */
const Z_LAYER_WEIGHT = 40;

const Z_LAYER_CLAMP = 8;
/** 贴地地毯层：高于房壳 (zIndex 0)，低于任意 Y 排序家具 (minY≈280 → 560000+) */
export const ROOM_DEPTH_FLOOR_MAT_BASE = 1;

const STACK_TIE_CLAMP = 999;

/** typeLift+manual 与 zLayer、tie 叠加后的上限（保证不跨过一个整数 y 台阶） */
export const ROOM_DEPTH_AUX_MAX =
  ROOM_DEPTH_Y_MULT - 1 - Z_LAYER_CLAMP * Z_LAYER_WEIGHT - STACK_TIE_CLAMP;

/**
 * 同 floor(y) 一层内：店主须恒高于任意家具后缀（aux+zLayer*40+stackTie 理论上可达 1999），
 * 否则会出现地毯等盖住人物腿部穿模。
 */
const OWNER_FRONT_BIAS = ROOM_DEPTH_Y_MULT - 1;

/** 家具在同一 floor(y) 下的 z 后缀上限，须比 OWNER_FRONT_BIAS 至少小 1 */
const FURNITURE_Z_SUFFIX_MAX = OWNER_FRONT_BIAS - 1;

/** 顶面可摆：小物脚点相对立柜顶面的容差（设计坐标 px） */
const TOP_SURFACE_Y_SLACK = 36;
/** 顶面可摆：水平方向半宽容差（无 sprite 宽时用） */
const TOP_SURFACE_X_FALLBACK = 70;

export function roomDepthZForFurniture(
  feetY: number,
  zLayer: number,
  stackTie: number,
  auxSortBoost = 0,
): number {
  const zc = Math.min(Math.max(zLayer, 0), Z_LAYER_CLAMP);
  const tie = Math.min(Math.max(stackTie, 0), STACK_TIE_CLAMP);
  const aux = Math.min(Math.max(auxSortBoost, 0), ROOM_DEPTH_AUX_MAX);
  const suffix = aux + zc * Z_LAYER_WEIGHT + tie;
  const clamped = Math.min(suffix, FURNITURE_Z_SUFFIX_MAX);
  return Math.floor(feetY) * ROOM_DEPTH_Y_MULT + clamped;
}

/** 贴地地毯 / 地垫：固定底层，重叠时不压过其它家具 */
export function roomDepthZForFloorMat(stackTie: number): number {
  const tie = Math.min(Math.max(stackTie, 0), STACK_TIE_CLAMP);
  return ROOM_DEPTH_FLOOR_MAT_BASE + tie;
}

/** 按装饰类型与手动前移累加计算完整深度键（ShopScene / FurnitureDragSystem 使用） */
export function roomDepthZForPlacement(
  feetY: number,
  zLayer: number,
  stackTie: number,
  deco: DecoDef,
  depthManualBias?: number,
  /** 高大家电顶面可摆：额外抬高排序用脚点（仅小物） */
  topSurfaceFeetBoost = 0,
): number {
  if (deco.depthSortFloorMat) {
    return roomDepthZForFloorMat(stackTie);
  }
  const typeLift = getDepthSortTypeLift(deco);
  const manual = Math.min(
    Math.max(depthManualBias ?? 0, 0),
    ROOM_DEPTH_AUX_MAX,
  );
  const aux = Math.min(ROOM_DEPTH_AUX_MAX, typeLift + manual);
  const sortFeetY = feetY + getDepthSortFeetYFudge(deco) + Math.max(0, topSurfaceFeetBoost);
  return roomDepthZForFurniture(sortFeetY, zLayer, stackTie, aux);
}

export function roomDepthZForOwner(feetY: number): number {
  return Math.floor(feetY) * ROOM_DEPTH_Y_MULT + OWNER_FRONT_BIAS;
}

/** 是否为可摆上台面/顶面的小物（蜡烛、花瓶、小家电等） */
export function isDepthSortSurfaceItem(deco: DecoDef): boolean {
  if (deco.depthSortFloorMat) return false;
  if (deco.slot === DecoSlot.WALLART || deco.slot === DecoSlot.GARDEN) return false;
  if (deco.slot === DecoSlot.TABLE || deco.slot === DecoSlot.SHELF) return false;
  if (deco.depthSortTopSurfaceHost) return false;
  const ds = deco.defaultScale ?? 1;
  if (deco.slot === DecoSlot.ORNAMENT) {
    if (deco.decorationPanelTab === 'furniture' && ds > 0.92) return false;
    if ((deco.decorationPanelTab === 'flower_room' || deco.decorationPanelTab === 'qinglian') && ds > 0.92) {
      return false;
    }
    return true;
  }
  if (deco.slot === DecoSlot.LIGHT) {
    return ds < 0.98;
  }
  return false;
}

export interface DepthSortPeer {
  decoId: string;
  x: number;
  y: number;
  deco: DecoDef;
  /** 脚点以上的显示高度（设计坐标）；缺省时用 defaultScale 粗估 */
  heightAboveFeet?: number;
  /** 水平半宽（设计坐标）；缺省时用 fallback */
  halfWidth?: number;
}

/**
 * 若小物脚点落在某「顶面可摆」立柜顶面附近，返回应加到排序脚点上的 boost，
 * 使小物压过该立柜（否则脚点 y 远小于立柜会被整机挡住）。
 */
export function getTopSurfaceFeetBoost(
  item: DepthSortPeer,
  peers: DepthSortPeer[],
): number {
  if (!isDepthSortSurfaceItem(item.deco)) return 0;

  let best = 0;
  for (const host of peers) {
    if (host.decoId === item.decoId) continue;
    if (!host.deco.depthSortTopSurfaceHost) continue;

    const hostH =
      host.heightAboveFeet ??
      Math.max(80, Math.round(130 * (host.deco.defaultScale ?? 1) * 0.9 * 0.8));
    const hostHalfW = host.halfWidth ?? TOP_SURFACE_X_FALLBACK;
    const topY = host.y - hostH;

    // 小物脚点应在顶面附近（略上/略下都允许）
    if (item.y < topY - TOP_SURFACE_Y_SLACK) continue;
    if (item.y > topY + TOP_SURFACE_Y_SLACK * 1.6) continue;
    if (Math.abs(item.x - host.x) > hostHalfW + 24) continue;

    // 抬到略高于立柜脚点，保证整档压过立柜
    const boost = host.y - item.y + 8;
    if (boost > best) best = boost;
  }
  return best;
}
