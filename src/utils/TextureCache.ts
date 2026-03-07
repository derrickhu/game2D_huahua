/**
 * 纹理缓存 - 管理图片加载和 PIXI.Texture 缓存
 * 在微信小游戏中通过 wx.createImage() 加载本地图片
 */
import * as PIXI from 'pixi.js';

/** 图片资源映射：icon key → 文件路径（相对于 minigame/ 根目录） */
const IMAGE_MAP: Record<string, string> = {
  // 日常花系 (已有图片)
  flower_daily_1: 'images/flower_daily_1.png',
  flower_daily_2: 'images/flower_daily_2.png',
  flower_daily_3: 'images/flower_daily_3.png',
  flower_daily_4: 'images/flower_daily_4.png',
  flower_daily_5: 'images/flower_daily_5.png',
  flower_daily_6: 'images/flower_daily_6.png',
};

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
