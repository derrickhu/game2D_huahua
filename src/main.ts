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

// 全局错误捕获——确保真机上所有异常可见
if (typeof GameGlobal !== 'undefined') {
  GameGlobal.onError = (msg: string) => {
    console.error('[GlobalError]', msg);
  };
  GameGlobal.onUnhandledRejection = (ev: any) => {
    console.error('[UnhandledRejection]', ev?.reason || ev);
  };
}

async function main(): Promise<void> {
  try {
    console.log('[main] 花语小筑启动中...');

    // 环境诊断
    console.log('[main] typeof document:', typeof document,
      ', typeof window:', typeof window,
      ', typeof setTimeout:', typeof setTimeout);

    // 获取主屏 canvas
    const canvas = (typeof GameGlobal !== 'undefined' && GameGlobal.canvas)
      || (typeof window !== 'undefined' && (window as any).canvas)
      || null;

    if (!canvas) {
      throw new Error('[main] 无法获取 canvas，请检查 pixi-adapter 是否正确加载');
    }

    console.log('[main] canvas 获取成功, width:', canvas.width, 'height:', canvas.height);

    // 初始化游戏
    Game.init(canvas);
    console.log('[main] Game.init 完成');

    // EventSystem 诊断
    try {
      const renderer = (Game as any).app?.renderer;
      const events = renderer?.events;
      console.log('[main] EventSystem:', !!events,
        'domElement:', !!events?.domElement,
        'supportsPointerEvents:', events?.supportsPointerEvents,
        'supportsTouchEvents:', events?.supportsTouchEvents);
    } catch (e) { console.warn('[main] EventSystem 诊断失败:', e); }

    // 根据实际屏幕动态计算棋盘尺寸
    computeBoardMetrics(Game.logicHeight);
    console.log('[main] BoardMetrics 计算完成, logicHeight:', Game.logicHeight);

    // 预加载图片纹理
    await TextureCache.preloadAll((loaded, total) => {
      console.log(`[main] 加载纹理: ${loaded}/${total}`);
    });

    // 初始化棋盘数据
    BoardManager.init();
    console.log('[main] BoardManager.init 完成');

    // 尝试加载存档
    const loaded = SaveManager.load();
    console.log('[main]', loaded ? '存档加载成功' : '无存档，使用默认数据');

    // 注册场景
    const mainScene = new MainScene();
    SceneManager.register(mainScene);
    console.log('[main] MainScene 已注册');

    // 进入主场景
    SceneManager.switchTo('main');

    console.log('[main] 花语小筑启动完成 ✿');
  } catch (e) {
    console.error('[main] 启动失败:', e);
  }
}

main();
