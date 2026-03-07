/**
 * 花语小筑 - 游戏入口
 */
import { Game } from '@/core/Game';
import { SceneManager } from '@/core/SceneManager';
import { BoardManager } from '@/managers/BoardManager';
import { SaveManager } from '@/managers/SaveManager';
import { TextureCache } from '@/utils/TextureCache';
import { MainScene } from '@/scenes/MainScene';
import { computeBoardMetrics } from '@/config/Constants';

declare const canvas: any;

async function main(): Promise<void> {
  try {
    console.log('[main] 花语小筑启动中...');

    // 初始化游戏
    Game.init(canvas);

    // 根据实际屏幕动态计算棋盘尺寸
    computeBoardMetrics(Game.logicHeight);

    // 预加载图片纹理
    await TextureCache.preloadAll((loaded, total) => {
      console.log(`[main] 加载纹理: ${loaded}/${total}`);
    });

    // 初始化棋盘数据
    BoardManager.init();

    // 尝试加载存档
    const loaded = SaveManager.load();
    if (loaded) {
      console.log('[main] 存档加载成功');
    } else {
      console.log('[main] 无存档，使用默认数据');
    }

    // 注册场景
    const mainScene = new MainScene();
    SceneManager.register(mainScene);

    // 进入主场景
    SceneManager.switchTo('main');

    console.log('[main] 花语小筑启动完成 ✿');
  } catch (e) {
    console.error('[main] 启动失败:', e);
  }
}

main();
