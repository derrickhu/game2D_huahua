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

  // ---- 新家具素材 furniture/ (35张, 已扣底) ----
  // 花架
  shelf_wood:    'images/furniture/shelf_wood.png',
  shelf_step:    'images/furniture/shelf_step.png',
  shelf_long:    'images/furniture/shelf_long.png',
  shelf_iron:    'images/furniture/shelf_iron.png',
  shelf_glass:   'images/furniture/shelf_glass.png',
  shelf_spring:  'images/furniture/shelf_spring.png',
  // 桌台
  table_counter: 'images/furniture/table_counter.png',
  table_drawer:  'images/furniture/table_drawer.png',
  table_work:    'images/furniture/table_work.png',
  table_marble:  'images/furniture/table_marble.png',
  table_autumn:  'images/furniture/table_autumn.png',
  // 灯具
  light_desk:    'images/furniture/light_desk.png',
  light_floor:   'images/furniture/light_floor.png',
  light_pendant: 'images/furniture/light_pendant.png',
  light_crystal: 'images/furniture/light_crystal.png',
  light_summer:  'images/furniture/light_summer.png',
  // 摆件
  orn_pot:       'images/furniture/orn_pot.png',
  orn_vase:      'images/furniture/orn_vase.png',
  orn_fountain:  'images/furniture/orn_fountain.png',
  orn_candle:    'images/furniture/orn_candle.png',
  orn_clock:     'images/furniture/orn_clock.png',
  orn_fireplace: 'images/furniture/orn_fireplace.png',
  orn_pumpkin:   'images/furniture/orn_pumpkin.png',
  orn_christmas: 'images/furniture/orn_christmas.png',
  // 墙饰
  wallart_plant:  'images/furniture/wallart_plant.png',
  wallart_frame:  'images/furniture/wallart_frame.png',
  wallart_wreath: 'images/furniture/wallart_wreath.png',
  wallart_relief: 'images/furniture/wallart_relief.png',
  wallart_spring: 'images/furniture/wallart_spring.png',
  wallart_winter: 'images/furniture/wallart_winter.png',
  // 庭院
  garden_flowerbed: 'images/furniture/garden_flowerbed.png',
  garden_arbor:     'images/furniture/garden_arbor.png',
  garden_arch:      'images/furniture/garden_arch.png',
  garden_zen:       'images/furniture/garden_zen.png',
  garden_summer:    'images/furniture/garden_summer.png',

  // ---- 房间背景 ----
  bg_room_default: 'images/house/bg_room_default.png',
  bg_room_white:   'images/house/bg_room_white.png',
  bg_room_vintage: 'images/house/bg_room_vintage.png',
  bg_room_spring:  'images/house/bg_room_spring.png',
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
