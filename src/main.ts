/**
 * 花语小筑 - 游戏入口
 */
// unsafe-eval patch 必须最先导入，在 new PIXI.Application() 之前执行
import '@/core/pixiUnsafeEvalPatch';
import { Game } from '@/core/Game';
import { SceneManager } from '@/core/SceneManager';
import { BoardManager } from '@/managers/BoardManager';
import { SaveManager } from '@/managers/SaveManager';
import { IdleManager } from '@/managers/IdleManager';
import { TextureCache } from '@/utils/TextureCache';
import { MainScene } from '@/scenes/MainScene';
import { ShopScene } from '@/scenes/ShopScene';
import { computeBoardMetrics } from '@/config/Constants';
import { FUNC_BAR_HEIGHT } from '@/gameobjects/ui/FloatingMenu';

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

const BUILD_TIME = '__BUILD_' + new Date().toISOString().slice(0, 19) + '__';

async function main(): Promise<void> {
  try {
    console.log('[main] 花语小筑启动中... BUILD:', BUILD_TIME);

    // 注意：不再在启动时无条件清除存档！
    // 旧存档的兼容性由 SaveManager 的指纹校验负责处理

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
    // topReserved = safeTop + TopBar(60) + gap(8) + ShopArea(220) + gap(6)
    // FloatingMenu 现在是悬浮按钮组（FUNC_BAR_HEIGHT=0），不再占用独立行空间
    const topReserved = Game.safeTop + 60 + 8 + 220 + 2 + FUNC_BAR_HEIGHT + 4;
    computeBoardMetrics(Game.logicHeight, topReserved);
    console.log(`[main] BoardMetrics 计算完成, logicHeight:${Game.logicHeight}, safeTop:${Game.safeTop}, topReserved:${topReserved}`);

    // 预加载图片纹理
    await TextureCache.preloadAll((loaded, total) => {
      console.log(`[main] 加载纹理: ${loaded}/${total}`);
    });

    // 初始化棋盘数据
    BoardManager.init();
    console.log('[main] BoardManager.init 完成');

    // 尝试加载存档（开发阶段已在启动时清除，此处应返回 false）
    const loaded = SaveManager.load();
    console.log('[main]', loaded ? '存档加载成功' : '无存档，使用默认数据');

    // 再次确认棋盘状态
    const cells = BoardManager.cells;
    const hasItems = cells.some(c => c.itemId !== null);
    const hasFog = cells.some(c => c.state !== 'open');
    console.log(`[main] 棋盘确认: cells=${cells.length}, hasItems=${hasItems}, hasFog=${hasFog}`);

    // 注册场景
    const mainScene = new MainScene();
    const shopScene = new ShopScene();
    SceneManager.register(mainScene);
    SceneManager.register(shopScene);
    console.log('[main] MainScene + ShopScene 已注册');

    // 进入主场景
    SceneManager.switchTo('main');

    // 监听小游戏生命周期：退到后台时保存状态
    const _apiMain: any = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
    if (_apiMain) {
      _apiMain.onHide?.(() => {
        console.log('[main] 游戏退到后台，保存状态');
        IdleManager.onHide();
        SaveManager.save();
      });
      _apiMain.onShow?.(() => {
        console.log('[main] 游戏回到前台');
      });
    }

    console.log('[main] 花语小筑启动完成 ✿ BUILD:', BUILD_TIME);
  } catch (e) {
    console.error('[main] 启动失败:', e);
  }
}

main();
