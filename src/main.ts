import Phaser from 'phaser';
import { gameConfig } from './config/GameConfig';

// 品类数据注册（side-effect import，确保 registerCategory 在启动时执行）
import './data/FlowerData';
import './data/DrinkData';

new Phaser.Game(gameConfig);
