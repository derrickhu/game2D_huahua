import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/Constants';
import { registerItemTexture } from '../data/ItemData';

// 物品图片资源清单（id → 小游戏 images/ 目录下的文件名）
const ITEM_ASSETS: Array<{ id: string; file: string }> = [
  { id: 'daily_1', file: 'flower_daily_1.png' },
  { id: 'daily_2', file: 'flower_daily_2.png' },
  { id: 'daily_3', file: 'flower_daily_3.png' },
  { id: 'daily_4', file: 'flower_daily_4.png' },
  { id: 'daily_5', file: 'flower_daily_5.png' },
  { id: 'daily_6', file: 'flower_daily_6.png' },
];

/**
 * 用微信 wx.createImage() 加载本地图片，返回 Promise
 */
function wxLoadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = (wx as any).createImage() as HTMLImageElement;
    img.onload = () => resolve(img);
    img.onerror = (err: any) => {
      console.error(`[PreloadScene] Failed to load image: ${src}`, err);
      reject(err);
    };
    img.src = src;
  });
}

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  create(): void {
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '🌸 花语小筑 🌸\n加载中...', {
      fontSize: '32px',
      fontFamily: 'Arial',
      color: '#5A4A3A',
      align: 'center',
    }).setOrigin(0.5);

    // 用微信 API 加载所有图片
    const promises = ITEM_ASSETS.map(async (asset) => {
      try {
        const img = await wxLoadImage(`images/${asset.file}`);
        this.textures.addImage(asset.id, img);
        registerItemTexture(asset.id, asset.id);
        console.log(`[PreloadScene] Loaded: ${asset.id}`);
      } catch (e) {
        console.warn(`[PreloadScene] Skipped: ${asset.id}`);
      }
    });

    Promise.all(promises).then(() => {
      text.destroy();
      this.scene.launch('UIScene');
      this.scene.start('MainScene');
    });
  }
}
