/**
 * 花店房间 2.5D 深度排序（_roomContainer.sortChildren）
 *
 * 须满足：脚点 Y 越大（越靠屏幕下/近景）越靠前；后放家具的 zLayer 仅作同深度微调，
 * 不得压过 Y（旧版 zLayer*1000 会导致「后面的」家具盖住前面的人物）。
 *
 * 「台面小物」额外 aux：与 zLayer、stackTie 之和必须 &lt; ROOM_DEPTH_Y_MULT，
 * 否则会出现 y 较小者反而盖住 y+1 行的错误遮挡。
 */

import { getDepthSortTypeLift, getDepthSortFeetYFudge, type DecoDef } from '@/config/DecorationConfig';

/** 每条「floor(y) 台阶」的间隔，须大于同 Y 下 zLayer + stackTie + aux 的最大和 */
export const ROOM_DEPTH_Y_MULT = 2000;

/** 同 floor(y) 时后放家具略靠前（与 RoomLayoutManager.addFurniture 的 zLayer 递增配合） */
const Z_LAYER_WEIGHT = 40;

const Z_LAYER_CLAMP = 8;
const STACK_TIE_CLAMP = 999;

/** typeLift+manual 与 zLayer、tie 叠加后的上限（保证不跨过一个整数 y 台阶） */
export const ROOM_DEPTH_AUX_MAX =
  ROOM_DEPTH_Y_MULT - 1 - Z_LAYER_CLAMP * Z_LAYER_WEIGHT - STACK_TIE_CLAMP;

/** 店主相对同 floor(y) 的家具靠前；须 > max(zLayer)*40 + max(stackTie)（约 1319） */
const OWNER_FRONT_BIAS = 1500;

export function roomDepthZForFurniture(
  feetY: number,
  zLayer: number,
  stackTie: number,
  auxSortBoost = 0,
): number {
  const zc = Math.min(Math.max(zLayer, 0), Z_LAYER_CLAMP);
  const tie = Math.min(Math.max(stackTie, 0), STACK_TIE_CLAMP);
  const aux = Math.min(Math.max(auxSortBoost, 0), ROOM_DEPTH_AUX_MAX);
  return Math.floor(feetY) * ROOM_DEPTH_Y_MULT + aux + zc * Z_LAYER_WEIGHT + tie;
}

/** 按装饰类型与手动前移累加计算完整深度键（ShopScene / FurnitureDragSystem 使用） */
export function roomDepthZForPlacement(
  feetY: number,
  zLayer: number,
  stackTie: number,
  deco: DecoDef,
  depthManualBias?: number,
): number {
  const typeLift = getDepthSortTypeLift(deco);
  const manual = Math.min(
    Math.max(depthManualBias ?? 0, 0),
    ROOM_DEPTH_AUX_MAX,
  );
  const aux = Math.min(ROOM_DEPTH_AUX_MAX, typeLift + manual);
  const sortFeetY = feetY + getDepthSortFeetYFudge(deco);
  return roomDepthZForFurniture(sortFeetY, zLayer, stackTie, aux);
}

export function roomDepthZForOwner(feetY: number): number {
  return Math.floor(feetY) * ROOM_DEPTH_Y_MULT + OWNER_FRONT_BIAS;
}
