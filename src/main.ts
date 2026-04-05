/**
 * 花花妙屋 - 游戏入口
 */
// unsafe-eval patch 必须最先导入，在 new PIXI.Application() 之前执行
import '@/core/pixiUnsafeEvalPatch';
import { Game } from '@/core/Game';
import { SceneManager } from '@/core/SceneManager';
import { BoardManager } from '@/managers/BoardManager';
import { MergeCompanionManager } from '@/managers/MergeCompanionManager';
import { BuildingManager } from '@/managers/BuildingManager';
import { SaveManager } from '@/managers/SaveManager';
import { MerchShopManager } from '@/managers/MerchShopManager';
import { IdleManager } from '@/managers/IdleManager';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import { LevelManager } from '@/managers/LevelManager';
import { TextureCache } from '@/utils/TextureCache';
import { MainScene } from '@/scenes/MainScene';
import { ShopScene } from '@/scenes/ShopScene';
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

const BUILD_TIME = '__BUILD_' + new Date().toISOString().slice(0, 19) + '__';

async function main(): Promise<void> {
  try {
    console.log('[main] 花花妙屋启动中... BUILD:', BUILD_TIME);

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

    // topReserved = safeTop + TopBar(60) + gap(4) + ShopArea(250)；与 SHOP_HEIGHT 一致（全景遮罩可高于此，略压棋盘顶边）
    const topReserved = Game.safeTop + 60 + 4 + MainScene.SHOP_HEIGHT;
    computeBoardMetrics(Game.logicHeight, topReserved);
    console.log(`[main] BoardMetrics 计算完成, logicHeight:${Game.logicHeight}, safeTop:${Game.safeTop}, topReserved:${topReserved}`);

    // 预加载图片纹理（主包 → items 分包 → deco 分包）
    await TextureCache.preloadAll((loaded, total) => {
      console.log(`[main] 加载纹理: ${loaded}/${total}`);
    });

    // 先等 audio 分包就绪再进主场景，避免 InnerAudioContext 在文件未落地时解码报错
    const _apiAudio: any = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
    await new Promise<void>((resolve) => {
      if (!_apiAudio?.loadSubpackage) {
        resolve();
        return;
      }
      _apiAudio.loadSubpackage({
        name: 'audio',
        success: () => {
          console.log('[main] audio 分包加载成功');
          resolve();
        },
        fail: (err: any) => {
          console.warn('[main] audio 分包加载失败:', err);
          resolve();
        },
      });
    });

    // 初始化棋盘数据
    BoardManager.init();
    console.log('[main] BoardManager.init 完成');

    MergeCompanionManager.init();

    // 尝试加载存档（开发阶段已在启动时清除，此处应返回 false）
    const loaded = SaveManager.load();
    if (!loaded) {
      BuildingManager.reset();
      MerchShopManager.init();
      MerchShopManager.bootstrapFresh();
    }
    console.log('[main]', loaded ? '存档加载成功' : '无存档，使用默认数据');

    // 星级升档奖励须在首帧 addStar 前就绪（不依赖 MainScene 是否已构建）
    LevelManager.init();

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
        // 立即刷写装饰布局（防止防抖 timer 未触发导致位置丢失）
        RoomLayoutManager.saveNow();
      });
      _apiMain.onShow?.(() => {
        console.log('[main] 游戏回到前台');
        if (MerchShopManager.ensureUpToDate()) {
          SaveManager.save();
        }
      });
    }

    console.log('[main] 花花妙屋启动完成 ✿ BUILD:', BUILD_TIME);
  } catch (e) {
    console.error('[main] 启动失败:', e);
  }
}

main();
