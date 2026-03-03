import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // 直接进入预加载场景（占位图模式无需加载外部资源）
    this.scene.start('PreloadScene');
  }
}
