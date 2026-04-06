/**
 * 工具图标右下角叠加体力标 icon_energy
 */
import * as PIXI from 'pixi.js';
import { InteractType } from '@/config/ItemConfig';
import { TextureCache } from '@/utils/TextureCache';

/** 是否为棋盘上的「工具」物品（TOOL 交互类型，含 flower_wrap_4 等非 BUILDING 品类的工具） */
export function isBoardToolInteract(interactType: InteractType): boolean {
  return interactType === InteractType.TOOL;
}

export type ToolEnergyBadgeOptions = {
  /** 右下角内边距（距容器右/下边），默认略大以免贴格线、与主体留出空隙 */
  pad?: number;
  /** 图标最大边相对盒子短边的比例，默认约 1/3 格更易辨认 */
  maxSideFrac?: number;
};

/** 棋盘上可产出工具：体力标相对格（或拖拽幽灵内容盒）短边的比例 */
export const BOARD_PRODUCER_ENERGY_MAX_SIDE_FRAC = 0.42;

/**
 * 创建体力角标 Sprite（锚点已设为右下，position 应对齐容器右下角）
 */
export function createToolEnergySprite(
  boxW: number,
  boxH: number,
  opts?: ToolEnergyBadgeOptions,
): PIXI.Sprite | null {
  const tex = TextureCache.get('icon_energy');
  if (!tex) return null;
  const short = Math.min(boxW, boxH);
  const pad = opts?.pad ?? Math.max(7, short * 0.10);
  const frac = opts?.maxSideFrac ?? 0.34;
  const target = short * frac;
  const scale = target / Math.max(tex.width, tex.height);
  const sp = new PIXI.Sprite(tex);
  sp.scale.set(scale);
  sp.anchor.set(1, 1);
  sp.position.set(boxW - pad, boxH - pad);
  return sp;
}

/**
 * 将角标置于父节点最上层（便于盖在半透明 CD 等之上）
 */
export function bringToolEnergyToFront(parent: PIXI.Container, sprite: PIXI.Sprite | null): void {
  if (!sprite?.visible || !sprite.parent) return;
  parent.setChildIndex(sprite, parent.children.length - 1);
}
