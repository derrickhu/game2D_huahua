import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainScene } from '../scenes/MainScene';
import { UIScene } from '../scenes/UIScene';
import { GAME_WIDTH, GAME_HEIGHT } from './Constants';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#FFF8F0',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
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
