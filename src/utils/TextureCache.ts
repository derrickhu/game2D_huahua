/**
 * 纹理缓存 - 管理图片加载和 PIXI.Texture 缓存
 * 在微信小游戏中通过 wx.createImage() 加载本地图片
 */
import * as PIXI from 'pixi.js';

/** 图片资源映射：icon key → 文件路径（相对于 minigame/ 根目录） */
const IMAGE_MAP: Record<string, string> = {
  // ---- 日常花系 (6张, 128x128 RGBA) ----
  flower_daily_1: 'images/flowers/daisy.png',
  flower_daily_2: 'images/flowers/sunflower.png',
  flower_daily_3: 'images/flowers/carnation.png',
  flower_daily_4: 'images/flowers/babysbreath_bouquet.png',
  flower_daily_5: 'images/flowers/mixed_bouquet.png',
  flower_daily_6: 'images/flowers/giftbox_bouquet.png',

  // ---- 花店建筑场景 ----
  house_shop: 'images/house/shop.png',    // 花店2.5D建筑 (512x512)
  house_bg: 'images/house/bg.png',        // 花店背景 (750xAuto)

  // ---- 装修家具素材 room_items (36张, ~100-160px) ----
  ...buildRoomMap('room', 36),

  // ---- 装修家具素材 room2_items (36张, ~100-170px) ----
  ...buildRoomMap('room2', 36),
};

/** 生成装修家具图片映射 */
function buildRoomMap(prefix: string, count: number): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 1; i <= count; i++) {
    const key = `${prefix}_${String(i).padStart(2, '0')}`;
    map[key] = `images/room/${key}.png`;
  }
  return map;
}


class TextureCacheClass {
  private _cache = new Map<string, PIXI.Texture>();
  private _loading = new Set<string>();
  private _failed = new Set<string>();

  /** 预加载所有已知图片资源 */
  preloadAll(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const keys = Object.keys(IMAGE_MAP);
    let loaded = 0;
    const total = keys.length;

    const promises = keys.map(key =>
      this._loadTexture(key, IMAGE_MAP[key]).then(() => {
        loaded++;
        onProgress?.(loaded, total);
      }).catch(err => {
        console.warn(`[TextureCache] 加载失败: ${key}`, err);
        loaded++;
        onProgress?.(loaded, total);
      })
    );

    return Promise.all(promises).then(() => {
      console.log(`[TextureCache] 预加载完成: ${this._cache.size}/${total} 张纹理`);
    });
  }

  /** 获取已缓存的纹理 */
  get(key: string): PIXI.Texture | null {
    return this._cache.get(key) || null;
  }

  /** 加载单张纹理 */
  private _loadTexture(key: string, path: string): Promise<void> {
    if (this._cache.has(key)) return Promise.resolve();
    if (this._loading.has(key)) return Promise.resolve();
    if (this._failed.has(key)) return Promise.resolve();

    this._loading.add(key);

    return new Promise<void>((resolve) => {
      try {
        // 在微信小游戏中使用平台 API 创建图片
        const platform = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
        if (!platform) {
          this._failed.add(key);
          this._loading.delete(key);
          resolve();
          return;
        }

        const img = platform.createImage();
        img.onload = () => {
          try {
            const baseTexture = PIXI.BaseTexture.from(img as any);
            const texture = new PIXI.Texture(baseTexture);
            this._cache.set(key, texture);
          } catch (e) {
            console.warn(`[TextureCache] 创建纹理失败: ${key}`, e);
            this._failed.add(key);
          }
          this._loading.delete(key);
          resolve();
        };
        img.onerror = (err: any) => {
          console.warn(`[TextureCache] 图片加载失败: ${key} (${path})`, err);
          this._failed.add(key);
          this._loading.delete(key);
          resolve();
        };
        img.src = path;
      } catch (e) {
        console.warn(`[TextureCache] 加载异常: ${key}`, e);
        this._failed.add(key);
        this._loading.delete(key);
        resolve();
      }
    });
  }
}

export const TextureCache = new TextureCacheClass();
