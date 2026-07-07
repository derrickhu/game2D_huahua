/**
 * 分部件换装 — 叠层合成器
 *
 * 思路：所有部件坐标基于标准画布（DRESSUP_CANVAS_W/H），基础身体铺满画布，
 * 部件 Sprite 以画布坐标叠放。场景端**不**直接挂多层容器，而是在换装变更时
 * 合成一次 RenderTexture（睁眼/闭眼两张），后续与旧整套图完全同构：
 *   - ShopScene 全身：单 Sprite 换 texture + 眨眼双图切换
 *   - MainScene 半身：全身合成图按 DRESSUP_BUST_CROP 裁切出 bust texture
 *
 * 性能：仅换装时合成（2 次离屏 draw call），运行时零逐帧开销；
 * 常驻显存 = 2 张 394×768 RT（约 2.4 MB），上一代 RT 延迟到下次合成时销毁，
 * 避免场景 Sprite 在同一帧内引用已销毁纹理。
 */
import * as PIXI from 'pixi.js';
import { Game } from '@/core/Game';
import { TextureCache } from '@/utils/TextureCache';
import { DressUpManager } from '@/managers/DressUpManager';
import {
  DRESSUP_BODY_TEXTURE_KEY,
  DRESSUP_BODY_BLINK_TEXTURE_KEY,
  DRESSUP_BODY_Z,
  DRESSUP_BUST_CROP,
  DRESSUP_CANVAS_H,
  DRESSUP_CANVAS_W,
  DRESSUP_SLOT_Z,
  getItemPlacement,
} from '@/config/DressUpItemConfig';
import type { DressUpItem } from '@/config/DressUpItemConfig';

export interface ComposedAvatarTextures {
  /** 全身（睁眼） */
  full: PIXI.Texture;
  /** 全身（闭眼，眨眼用；闭眼身体图缺失时与 full 相同） */
  fullBlink: PIXI.Texture;
  /** 半身（全身图上裁切，MainScene 用） */
  bust: PIXI.Texture;
}

/**
 * 组装叠层容器（预览 / 合成共用）。
 * @param blink 用闭眼版基础身体
 * @returns 纹理未就绪时返回 null
 */
export function buildAvatarLayers(blink: boolean): PIXI.Container | null {
  const bodyKey = blink ? DRESSUP_BODY_BLINK_TEXTURE_KEY : DRESSUP_BODY_TEXTURE_KEY;
  let bodyTex = TextureCache.get(bodyKey);
  if (blink && !bodyTex?.width) bodyTex = TextureCache.get(DRESSUP_BODY_TEXTURE_KEY);
  if (!bodyTex?.width) return null;

  const root = new PIXI.Container();
  root.sortableChildren = true;

  const body = new PIXI.Sprite(bodyTex);
  // 基础身体按标准画布拉伸铺满（入库时即为标准画布比例，此处仅防像素级偏差）
  body.width = DRESSUP_CANVAS_W;
  body.height = DRESSUP_CANVAS_H;
  body.zIndex = DRESSUP_BODY_Z;
  root.addChild(body);

  for (const item of DressUpManager.getEquippedItemDefs()) {
    const sp = buildItemSprite(item);
    if (sp) root.addChild(sp);
  }
  root.sortChildren();
  return root;
}

/** 单个部件 Sprite（画布坐标 + GM 覆盖），纹理未就绪返回 null */
export function buildItemSprite(item: DressUpItem): PIXI.Sprite | null {
  const tex = TextureCache.get(item.textureKey);
  if (!tex?.width) return null;
  const sp = new PIXI.Sprite(tex);
  sp.anchor.set(0.5, 0.5);
  const p = getItemPlacement(item);
  sp.position.set(p.x, p.y);
  sp.scale.set(p.scale);
  sp.zIndex = DRESSUP_SLOT_Z[item.slot];
  return sp;
}

class OwnerAvatarServiceClass {
  private _composed: ComposedAvatarTextures | null = null;
  /** 上一代 RT：延迟销毁，防场景 Sprite 在换装同帧引用已销毁纹理 */
  private _retired: PIXI.RenderTexture[] = [];
  private _rts: PIXI.RenderTexture[] = [];
  private _composedKey = '';

  /** 自定义模式下取合成纹理；纹理未就绪 / 非 custom 模式返回 null（场景回退旧整套图） */
  getComposed(): ComposedAvatarTextures | null {
    if (DressUpManager.mode !== 'custom') return null;
    if (!this._texturesReady()) return null;
    const key = this._equipKey();
    if (this._composed && key === this._composedKey) return this._composed;
    const next = this._compose();
    if (!next) return null;
    this._composed = next;
    this._composedKey = key;
    return next;
  }

  /** 基础身体 + 全部已穿部件纹理是否都已加载（避免缓存半成品合成） */
  private _texturesReady(): boolean {
    if (!TextureCache.get(DRESSUP_BODY_TEXTURE_KEY)?.width) return false;
    for (const item of DressUpManager.getEquippedItemDefs()) {
      if (!TextureCache.get(item.textureKey)?.width) return false;
    }
    return true;
  }

  /** GM 对齐工具改运行时偏移后强制重合成 */
  invalidate(): void {
    this._composedKey = '';
  }

  private _equipKey(): string {
    const items = DressUpManager.getEquippedItemDefs();
    return items.map(i => {
      const p = getItemPlacement(i);
      return `${i.id}@${p.x},${p.y},${p.scale}`;
    }).join('|');
  }

  private _compose(): ComposedAvatarTextures | null {
    const renderer = Game.app?.renderer;
    if (!renderer) return null;

    const openLayers = buildAvatarLayers(false);
    if (!openLayers) return null;

    // 上上代此刻已无人引用，安全销毁
    for (const rt of this._retired) rt.destroy(true);
    this._retired = this._rts;
    this._rts = [];

    const renderToRT = (layers: PIXI.Container): PIXI.RenderTexture => {
      const rt = PIXI.RenderTexture.create({
        width: DRESSUP_CANVAS_W,
        height: DRESSUP_CANVAS_H,
        resolution: 1,
      });
      renderer.render(layers, { renderTexture: rt });
      layers.destroy({ children: true });
      this._rts.push(rt);
      return rt;
    };

    const fullRt = renderToRT(openLayers);
    const blinkLayers = buildAvatarLayers(true);
    const blinkRt = blinkLayers ? renderToRT(blinkLayers) : null;

    const c = DRESSUP_BUST_CROP;
    const bust = new PIXI.Texture(
      fullRt.baseTexture,
      new PIXI.Rectangle(c.x, c.y, c.w, c.h),
    );

    return {
      full: fullRt,
      fullBlink: blinkRt ?? fullRt,
      bust,
    };
  }
}

export const OwnerAvatarService = new OwnerAvatarServiceClass();
