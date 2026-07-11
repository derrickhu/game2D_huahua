import type { DecoDef } from '@/config/DecorationConfig';

export type FurnitureFacing4 = 'front_right' | 'back_right' | 'back_left' | 'front_left';

export interface FurnitureInteractionStateDef {
  /** 单图状态；不支持四角度时使用。 */
  texture?: string;
  /** 四角度/两面家具的正面资源（独立 key 或合图帧）。 */
  frontTexture?: string;
  /** 四角度/两面家具的背面资源。 */
  backTexture?: string;
}

export interface FurnitureInteractionDef {
  type: 'toggle' | 'cycle';
  defaultState: string;
  /** 工坊预览 / 图鉴等 UI 展示的交互说明 */
  hint?: string;
  states: Record<string, FurnitureInteractionStateDef>;
}

/**
 * 同一家具族的 PNG 合图（雪碧图）布局。
 * - 列 0/1 默认为 front/back（fourFacing 四向旋转）
 * - 多配色：每种配色占一行（row 0 = 默认色，row 1 = 分色…）
 * - 可交互：每种交互态可占一行，或在列方向扩展（见 states 内 front/back 列）
 */
export interface FurnitureAtlasSpec {
  /** TextureCache 中整张合图的 key */
  sheetKey: string;
  columns: number;
  rows: number;
  /** 本 deco 配色/变体所在行（0-based） */
  row?: number;
  /** 正面列（默认 0） */
  frontCol?: number;
  /** 背面列（默认 1） */
  backCol?: number;
}

export interface FurnitureRenderDef {
  decoId: string;
  /** single=旧单图；twoSided=正/背两图；fourFacing=正/背+水平翻转组成四角度。 */
  renderMode: 'single' | 'twoSided' | 'fourFacing';
  /** 优先：单 PNG 合图（含正/背、多色、多交互态） */
  atlas?: FurnitureAtlasSpec;
  /** 无 atlas 时的独立贴图 key（兼容旧资源） */
  frontTexture?: string;
  backTexture?: string;
  defaultFacing?: FurnitureFacing4;
  interaction?: FurnitureInteractionDef;
}

export interface FurnitureResolvedTexture {
  textureKey: string;
  flipped: boolean;
}

export interface FurnitureAtlasFrameRef {
  sheetKey: string;
  col: number;
  row: number;
  columns: number;
  rows: number;
}

export const FURNITURE_RENDER_DEFS: FurnitureRenderDef[] = [
  {
    decoId: 'workshop_puffy_petal_sofa',
    renderMode: 'fourFacing',
    atlas: {
      sheetKey: 'workshop_puffy_petal_sofa_sheet',
      columns: 2,
      rows: 1,
      row: 0,
      frontCol: 0,
      backCol: 1,
    },
    defaultFacing: 'front_right',
  },
  {
    decoId: 'workshop_plush_green_sofa',
    renderMode: 'single',
    atlas: {
      sheetKey: 'workshop_plush_sofa_sheet',
      columns: 1,
      rows: 3,
      row: 0,
    },
  },
  {
    decoId: 'workshop_plush_sofa_sakura',
    renderMode: 'single',
    atlas: {
      sheetKey: 'workshop_plush_sofa_sheet',
      columns: 1,
      rows: 3,
      row: 1,
    },
  },
  {
    decoId: 'workshop_plush_sofa_blue',
    renderMode: 'single',
    atlas: {
      sheetKey: 'workshop_plush_sofa_sheet',
      columns: 1,
      rows: 3,
      row: 2,
    },
  },
  {
    decoId: 'workshop_rose_cascade_drape',
    renderMode: 'single',
    atlas: {
      sheetKey: 'workshop_rose_cascade_drape_sheet',
      columns: 1,
      rows: 3,
      row: 0,
    },
  },
  {
    decoId: 'workshop_rose_cascade_drape_moon',
    renderMode: 'single',
    atlas: {
      sheetKey: 'workshop_rose_cascade_drape_sheet',
      columns: 1,
      rows: 3,
      row: 1,
    },
  },
  {
    decoId: 'workshop_rose_cascade_drape_honey',
    renderMode: 'single',
    atlas: {
      sheetKey: 'workshop_rose_cascade_drape_sheet',
      columns: 1,
      rows: 3,
      row: 2,
    },
  },
  {
    decoId: 'workshop_giant_rose_bouquet',
    renderMode: 'single',
    atlas: {
      sheetKey: 'workshop_giant_rose_bouquet_sheet',
      columns: 2,
      rows: 1,
      row: 0,
      frontCol: 0,
    },
    interaction: {
      type: 'toggle',
      defaultState: 'bud',
      hint: '放入房间后单击切换含苞与盛放',
      states: {
        bud: {},
        bloom: {},
      },
    },
  },
  {
    decoId: 'workshop_pastel_tv_cabinet',
    renderMode: 'fourFacing',
    atlas: {
      sheetKey: 'workshop_pastel_tv_cabinet_sheet',
      columns: 2,
      rows: 1,
      row: 0,
      frontCol: 0,
      backCol: 1,
    },
    defaultFacing: 'front_right',
  },
  {
    decoId: 'workshop_summer_dining_chair',
    renderMode: 'fourFacing',
    atlas: {
      sheetKey: 'workshop_summer_dining_chair_sheet',
      columns: 2,
      rows: 1,
      row: 0,
      frontCol: 0,
      backCol: 1,
    },
    defaultFacing: 'front_right',
  },
];

export const FURNITURE_RENDER_MAP = new Map(FURNITURE_RENDER_DEFS.map(def => [def.decoId, def]));

/** 合图子帧缓存 key（TextureCache 内使用） */
export function furnitureAtlasFrameKey(sheetKey: string, col: number, row: number): string {
  return `${sheetKey}#${col},${row}`;
}

export function resolveFurnitureAtlasFrame(
  spec: FurnitureAtlasSpec,
  col: number,
  row: number,
): FurnitureAtlasFrameRef {
  return {
    sheetKey: spec.sheetKey,
    col,
    row,
    columns: spec.columns,
    rows: spec.rows,
  };
}

function atlasFrontCol(spec: FurnitureAtlasSpec): number {
  return spec.frontCol ?? 0;
}

function atlasBackCol(spec: FurnitureAtlasSpec): number {
  return spec.backCol ?? 1;
}

function atlasRow(spec: FurnitureAtlasSpec): number {
  return spec.row ?? 0;
}

/** 装修卡片 / 托盘预览：默认正面帧 */
export function getFurnitureDisplayFrameRef(decoId: string): FurnitureAtlasFrameRef | null {
  const def = FURNITURE_RENDER_MAP.get(decoId);
  if (!def?.atlas) return null;
  const row = atlasRow(def.atlas);
  let col = atlasFrontCol(def.atlas);
  if (def.interaction) {
    const keys = Object.keys(def.interaction.states);
    const idx = keys.indexOf(def.interaction.defaultState);
    if (idx >= 0) col = idx;
  }
  return resolveFurnitureAtlasFrame(def.atlas, col, row);
}

/** icon key → 合图正面帧（供 TextureCache 别名解析） */
export function buildFurnitureIconAliasMap(): Map<string, FurnitureAtlasFrameRef> {
  const map = new Map<string, FurnitureAtlasFrameRef>();
  for (const def of FURNITURE_RENDER_DEFS) {
    if (!def.atlas) continue;
    const ref = getFurnitureDisplayFrameRef(def.decoId);
    if (ref) map.set(def.decoId, ref);
  }
  return map;
}

/** 预加载：合图家具只需 sheetKey；旧资源仍预载 front/back */
export function collectFurniturePreloadKeys(decoId: string, fallbackIcon: string): string[] {
  const def = FURNITURE_RENDER_MAP.get(decoId);
  if (def?.atlas) return [def.atlas.sheetKey];
  const keys = new Set<string>([fallbackIcon]);
  if (def?.frontTexture) keys.add(def.frontTexture);
  if (def?.backTexture) keys.add(def.backTexture);
  if (def?.interaction) {
    for (const st of Object.values(def.interaction.states)) {
      if (st.texture) keys.add(st.texture);
      if (st.frontTexture) keys.add(st.frontTexture);
      if (st.backTexture) keys.add(st.backTexture);
    }
  }
  return [...keys];
}

export function isFourFacingFurniture(decoId: string): boolean {
  return FURNITURE_RENDER_MAP.get(decoId)?.renderMode === 'fourFacing';
}

export function nextFurnitureFacing(facing: FurnitureFacing4 | undefined): FurnitureFacing4 {
  switch (facing) {
    case 'front_right': return 'back_right';
    case 'back_right': return 'back_left';
    case 'back_left': return 'front_left';
    case 'front_left': return 'front_right';
    default: return 'front_right';
  }
}

export function nextInteractionState(def: FurnitureInteractionDef, current: string | undefined): string {
  const keys = Object.keys(def.states);
  if (keys.length === 0) return def.defaultState;
  const cur = current && def.states[current] ? current : def.defaultState;
  const idx = keys.indexOf(cur);
  return keys[(idx + 1) % keys.length] ?? def.defaultState;
}

export function resolveFurnitureTexture(
  decoId: string,
  fallbackTextureKey: string,
  opts?: {
    facing?: FurnitureFacing4;
    interactionState?: string;
    flipped?: boolean;
  },
): FurnitureResolvedTexture {
  const def = FURNITURE_RENDER_MAP.get(decoId);
  if (!def) return { textureKey: fallbackTextureKey, flipped: !!opts?.flipped };

  const interactionState = opts?.interactionState && def.interaction?.states[opts.interactionState]
    ? opts.interactionState
    : def.interaction?.defaultState;
  const stateDef = interactionState ? def.interaction?.states[interactionState] : undefined;

  if (def.renderMode === 'single') {
    if (def.atlas) {
      const row = atlasRow(def.atlas);
      let col = atlasFrontCol(def.atlas);
      if (def.interaction && interactionState) {
        const keys = Object.keys(def.interaction.states);
        const idx = keys.indexOf(interactionState);
        if (idx >= 0) col = idx;
      }
      return {
        textureKey: furnitureAtlasFrameKey(def.atlas.sheetKey, col, row),
        flipped: !!opts?.flipped,
      };
    }
    return {
      textureKey: stateDef?.texture ?? def.frontTexture ?? fallbackTextureKey,
      flipped: !!opts?.flipped,
    };
  }

  const facing = opts?.facing ?? def.defaultFacing ?? 'front_right';
  const useBack = facing === 'back_right' || facing === 'back_left';
  const flipForFacing = facing === 'front_left' || facing === 'back_left';

  if (def.atlas) {
    const row = atlasRow(def.atlas);
    const col = useBack ? atlasBackCol(def.atlas) : atlasFrontCol(def.atlas);
    return {
      textureKey: furnitureAtlasFrameKey(def.atlas.sheetKey, col, row),
      flipped: flipForFacing,
    };
  }

  const textureKey = useBack
    ? (stateDef?.backTexture ?? def.backTexture ?? stateDef?.frontTexture ?? def.frontTexture ?? fallbackTextureKey)
    : (stateDef?.frontTexture ?? def.frontTexture ?? stateDef?.texture ?? fallbackTextureKey);

  return { textureKey, flipped: flipForFacing };
}

/** 文档 / 校验：deco.icon 若走合图，实际 PNG 为 atlas.sheetKey */
export function resolveDecoIconStorageKey(deco: Pick<DecoDef, 'id' | 'icon'>): string {
  const def = FURNITURE_RENDER_MAP.get(deco.id);
  if (def?.atlas) return def.atlas.sheetKey;
  return deco.icon;
}
