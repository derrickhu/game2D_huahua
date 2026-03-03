import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainScene } from '../scenes/MainScene';
import { UIScene } from '../scenes/UIScene';
import { GAME_WIDTH, GAME_HEIGHT } from './Constants';
import { isWxMiniGame, getWxCanvas, getSystemInfo } from '../utils/platform';

function createGameConfig(): Phaser.Types.Core.GameConfig {
  const baseConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.CANVAS,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#FFF8F0',
    scene: [
      BootScene,
      PreloadScene,
      MainScene,
      UIScene,
    ],
    render: {
      pixelArt: false,
      antialias: true,
      roundPixels: true,
    },
  };

  if (isWxMiniGame()) {
    const wxCanvas = getWxCanvas();
    baseConfig.canvas = wxCanvas;

    // 微信小游戏：canvas.width/height 设为与屏幕等比的物理像素
    // 这样 750:GAME_HEIGHT 的内容画在 canvas 上，
    // canvas 被微信全屏渲染到屏幕，比例完全一致，不会变形
    const sysInfo = getSystemInfo();
    if (wxCanvas) {
      wxCanvas.width = Math.round(sysInfo.width * sysInfo.pixelRatio);
      wxCanvas.height = Math.round(sysInfo.height * sysInfo.pixelRatio);
      console.log('[GameConfig] wx canvas size:', wxCanvas.width, 'x', wxCanvas.height,
        'game:', GAME_WIDTH, 'x', GAME_HEIGHT);
    }
  } else {
    // 浏览器环境
    baseConfig.parent = 'game-container';
    baseConfig.scale = {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    };
  }

  return baseConfig;
}

export const gameConfig = createGameConfig();
