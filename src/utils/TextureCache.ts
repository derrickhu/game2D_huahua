/**
 * 纹理缓存 - 管理图片加载和 PIXI.Texture 缓存
 * 支持微信小游戏分包加载：
 *   - 主包：花朵等核心小图（images/）
 *   - 分包 deco：家具 + 房间背景 + 旧 room 素材（subpkg_deco/images/）
 */
import * as PIXI from 'pixi.js';

// ================================================================
// 主包资源（随主包一起下载，无需等待分包）
// ================================================================
const MAIN_IMAGE_MAP: Record<string, string> = {
  // ---- 日常花系 (6张, 128x128 RGBA) ----
  flower_daily_1: 'images/flowers/daisy.png',
  flower_daily_2: 'images/flowers/sunflower.png',
  flower_daily_3: 'images/flowers/carnation.png',
  flower_daily_4: 'images/flowers/babysbreath_bouquet.png',
  flower_daily_5: 'images/flowers/mixed_bouquet.png',
  flower_daily_6: 'images/flowers/giftbox_bouquet.png',
};

// ================================================================
// 分包资源（需先 loadSubpackage('deco') 后才可访问）
// ================================================================
const DECO_IMAGE_MAP: Record<string, string> = {
  // ---- 花店建筑场景 ----
  house_shop: 'subpkg_deco/images/house/shop.png',
  house_bg:   'subpkg_deco/images/house/bg.png',

  // ---- 装修家具素材 room_items (36张) ----
  ...buildRoomMap('room', 36),

  // ---- 装修家具素材 room2_items (36张) ----
  ...buildRoomMap('room2', 36),

  // ---- 新家具素材 furniture/ (35张, 已扣底) ----
  // 花架
  shelf_wood:    'subpkg_deco/images/furniture/shelf_wood.png',
  shelf_step:    'subpkg_deco/images/furniture/shelf_step.png',
  shelf_long:    'subpkg_deco/images/furniture/shelf_long.png',
  shelf_iron:    'subpkg_deco/images/furniture/shelf_iron.png',
  shelf_glass:   'subpkg_deco/images/furniture/shelf_glass.png',
  shelf_spring:  'subpkg_deco/images/furniture/shelf_spring.png',
  // 桌台
  table_counter: 'subpkg_deco/images/furniture/table_counter.png',
  table_drawer:  'subpkg_deco/images/furniture/table_drawer.png',
  table_work:    'subpkg_deco/images/furniture/table_work.png',
  table_marble:  'subpkg_deco/images/furniture/table_marble.png',
  table_autumn:  'subpkg_deco/images/furniture/table_autumn.png',
  // 灯具
  light_desk:    'subpkg_deco/images/furniture/light_desk.png',
  light_floor:   'subpkg_deco/images/furniture/light_floor.png',
  light_pendant: 'subpkg_deco/images/furniture/light_pendant.png',
  light_crystal: 'subpkg_deco/images/furniture/light_crystal.png',
  light_summer:  'subpkg_deco/images/furniture/light_summer.png',
  // 摆件
  orn_pot:       'subpkg_deco/images/furniture/orn_pot.png',
  orn_vase:      'subpkg_deco/images/furniture/orn_vase.png',
  orn_fountain:  'subpkg_deco/images/furniture/orn_fountain.png',
  orn_candle:    'subpkg_deco/images/furniture/orn_candle.png',
  orn_clock:     'subpkg_deco/images/furniture/orn_clock.png',
  orn_fireplace: 'subpkg_deco/images/furniture/orn_fireplace.png',
  orn_pumpkin:   'subpkg_deco/images/furniture/orn_pumpkin.png',
  orn_christmas: 'subpkg_deco/images/furniture/orn_christmas.png',
  // 墙饰
  wallart_plant:  'subpkg_deco/images/furniture/wallart_plant.png',
  wallart_frame:  'subpkg_deco/images/furniture/wallart_frame.png',
  wallart_wreath: 'subpkg_deco/images/furniture/wallart_wreath.png',
  wallart_relief: 'subpkg_deco/images/furniture/wallart_relief.png',
  wallart_spring: 'subpkg_deco/images/furniture/wallart_spring.png',
  wallart_winter: 'subpkg_deco/images/furniture/wallart_winter.png',
  // 庭院
  garden_flowerbed: 'subpkg_deco/images/furniture/garden_flowerbed.png',
  garden_arbor:     'subpkg_deco/images/furniture/garden_arbor.png',
  garden_arch:      'subpkg_deco/images/furniture/garden_arch.png',
  garden_zen:       'subpkg_deco/images/furniture/garden_zen.png',
  garden_summer:    'subpkg_deco/images/furniture/garden_summer.png',

  // ---- 房间背景 ----
  bg_room_default: 'subpkg_deco/images/house/bg_room_default.png',
  bg_room_white:   'subpkg_deco/images/house/bg_room_white.png',
  bg_room_vintage: 'subpkg_deco/images/house/bg_room_vintage.png',
  bg_room_spring:  'subpkg_deco/images/house/bg_room_spring.png',
};

/** 合并后的完整映射（用于统一查询） */
const IMAGE_MAP: Record<string, string> = {
  ...MAIN_IMAGE_MAP,
  ...DECO_IMAGE_MAP,
};

/** 生成装修家具图片映射（旧 room 素材，已移到分包） */
function buildRoomMap(prefix: string, count: number): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 1; i <= count; i++) {
    const key = `${prefix}_${String(i).padStart(2, '0')}`;
    map[key] = `subpkg_deco/images/room/${key}.png`;
  }
  return map;
}


class TextureCacheClass {
  private _cache = new Map<string, PIXI.Texture>();
  private _loading = new Set<string>();
  private _failed = new Set<string>();
  private _decoLoaded = false;

  /**
   * 预加载主包图片（花朵等核心资源）
   * 在游戏启动时调用，不依赖分包
   */
  preloadMain(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const keys = Object.keys(MAIN_IMAGE_MAP);
    let loaded = 0;
    const total = keys.length;

    const promises = keys.map(key =>
      this._loadTexture(key, MAIN_IMAGE_MAP[key]).then(() => {
        loaded++;
        onProgress?.(loaded, total);
      }).catch(err => {
        console.warn(`[TextureCache] 主包加载失败: ${key}`, err);
        loaded++;
        onProgress?.(loaded, total);
      })
    );

    return Promise.all(promises).then(() => {
      console.log(`[TextureCache] 主包预加载完成: ${this._cache.size}/${total} 张纹理`);
    });
  }

  /**
   * 加载 deco 分包，然后预加载分包中的图片
   * 在进入花店场景前调用
   */
  loadDecoSubpackage(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (this._decoLoaded) {
      return this._preloadDecoImages(onProgress);
    }

    return new Promise<void>((resolve, reject) => {
      const platform = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
      if (!platform || !platform.loadSubpackage) {
        // 非微信环境，直接加载（开发模式）
        console.log('[TextureCache] 非微信环境，直接加载分包资源');
        this._decoLoaded = true;
        this._preloadDecoImages(onProgress).then(resolve).catch(reject);
        return;
      }

      console.log('[TextureCache] 开始加载 deco 分包...');
      const task = platform.loadSubpackage({
        name: 'deco',
        success: () => {
          console.log('[TextureCache] deco 分包加载成功');
          this._decoLoaded = true;
          this._preloadDecoImages(onProgress).then(resolve).catch(reject);
        },
        fail: (err: any) => {
          console.error('[TextureCache] deco 分包加载失败', err);
          reject(err);
        },
      });

      // 分包下载进度
      if (task && task.onProgressUpdate) {
        task.onProgressUpdate((res: any) => {
          console.log(`[TextureCache] 分包下载: ${res.progress}% (${res.totalBytesWritten}/${res.totalBytesExpectedToWrite})`);
        });
      }
    });
  }

  /**
   * 兼容旧接口：预加载所有资源（先加载主包，再加载分包）
   */
  preloadAll(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const totalKeys = Object.keys(IMAGE_MAP).length;
    let globalLoaded = 0;

    const wrapProgress = () => {
      globalLoaded++;
      onProgress?.(globalLoaded, totalKeys);
    };

    return this.preloadMain(() => wrapProgress())
      .then(() => this.loadDecoSubpackage(() => wrapProgress()))
      .then(() => {
        console.log(`[TextureCache] 全部预加载完成: ${this._cache.size}/${totalKeys} 张纹理`);
      });
  }

  /** 获取已缓存的纹理 */
  get(key: string): PIXI.Texture | null {
    return this._cache.get(key) || null;
  }

  /** 分包资源是否已加载 */
  get isDecoLoaded(): boolean {
    return this._decoLoaded;
  }

  /** 预加载分包中的图片 */
  private _preloadDecoImages(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const keys = Object.keys(DECO_IMAGE_MAP);
    let loaded = 0;
    const total = keys.length;

    const promises = keys.map(key =>
      this._loadTexture(key, DECO_IMAGE_MAP[key]).then(() => {
        loaded++;
        onProgress?.(loaded, total);
      }).catch(err => {
        console.warn(`[TextureCache] 分包加载失败: ${key}`, err);
        loaded++;
        onProgress?.(loaded, total);
      })
    );

    return Promise.all(promises).then(() => {
      console.log(`[TextureCache] 分包图片预加载完成: ${loaded}/${total}`);
    });
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
