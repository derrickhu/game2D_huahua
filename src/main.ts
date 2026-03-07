/**
 * 花语小筑 - 游戏入口
 */
// unsafe-eval patch 必须最先导入，在 new PIXI.Application() 之前执行
import '@/core/pixiUnsafeEvalPatch';
import { Game } from '@/core/Game';
import { SceneManager } from '@/core/SceneManager';
import { BoardManager } from '@/managers/BoardManager';
import { SaveManager } from '@/managers/SaveManager';
import { TextureCache } from '@/utils/TextureCache';
import { MainScene } from '@/scenes/MainScene';
import { computeBoardMetrics } from '@/config/Constants';

declare const GameGlobal: any;

async function main(): Promise<void> {
  try {
    console.log('[main] 花语小筑启动中...');

    // 获取主屏 canvas（pixi-adapter 已挂载到 GameGlobal.canvas）
    const canvas = (typeof GameGlobal !== 'undefined' && GameGlobal.canvas)
      || (typeof window !== 'undefined' && (window as any).canvas)
      || null;

    if (!canvas) {
      throw new Error('[main] 无法获取 canvas，请检查 pixi-adapter 是否正确加载');
    }

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

    // 诊断：确认 Game 实例一致性
    console.log(`[main] switchTo 前: Game.uid=${(Game as any)._uid}, stage=${!!Game.stage}, ticker=${!!Game.ticker}`);

    // 进入主场景
    SceneManager.switchTo('main');

    console.log('[main] 花语小筑启动完成 ✿');
  } catch (e) {
    console.error('[main] 启动失败:', e);
  }
}

main();
