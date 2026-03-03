import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/Constants';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  create(): void {
    // 显示加载文本（占位模式无需实际加载资源）
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '🌸 花语小筑 🌸\n加载中...', {
      fontSize: '32px',
      fontFamily: 'Arial',
      color: '#5A4A3A',
      align: 'center',
    }).setOrigin(0.5);

    // 模拟短暂加载延迟
    this.time.delayedCall(500, () => {
      text.destroy();
      // 启动常驻UI场景
      this.scene.launch('UIScene');
      // 启动主场景
      this.scene.start('MainScene');
    });
  }
}
