/**
 * 花花妙屋 - 游戏入口
 */
// unsafe-eval patch 必须最先导入，在 new PIXI.Application() 之前执行
import '@/core/pixiUnsafeEvalPatch';
import {
  analytics,
  EVENT_NAMES,
  initAnalytics,
  setAnalyticsUserId,
  setupTutorialAnalytics,
  setupGameplayAnalytics,
} from '@/analytics';
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
import { CloudSyncManager } from '@/managers/CloudSyncManager';
import { TutorialManager } from '@/managers/TutorialManager';
import { DecorationManager } from '@/managers/DecorationManager';
import { RoomLayoutManager } from '@/managers/RoomLayoutManager';
import { UserIdentityManager } from '@/managers/UserIdentityManager';
import { PersistService, type CloudImportInfo } from '@/core/PersistService';
import { Platform } from '@/core/PlatformService';
import { EventBus } from '@/core/EventBus';
import { CdnAssetService } from '@/core/CdnAssetService';
import { TextureCache } from '@/utils/TextureCache';
import { LoadingScreenOverlay } from '@/gameobjects/ui/LoadingScreenOverlay';
import { MainScene } from '@/scenes/MainScene';
import { ShopScene } from '@/scenes/ShopScene';
import { computeBoardMetrics } from '@/config/Constants';
declare const GameGlobal: any;

// 全局错误捕获——确保真机上所有异常可见，并按经分 SOP 上报 app_error。
//
// 时序提醒：本块在 main() 之前同步执行，那时 SDK 还没 init，analytics.track 会被 SDK 内部
// 的"未初始化即丢弃"分支吞掉（不会抛错），属于预期行为。也即：仅 init 之后捕获到的错误才会上报。
// 想覆盖更早的启动期异常，得把 initAnalytics() 也搬到模块顶部，但那样 PlatformService 还没 ready，
// 风险更大；当前选择"漏掉极少数 init 前异常"换稳定性。
if (typeof GameGlobal !== 'undefined') {
  GameGlobal.onError = (msg: string) => {
    console.error('[GlobalError]', msg);
    try {
      analytics.track(EVENT_NAMES.APP_ERROR, {
        err_code: 0,
        err_msg: String(msg || '').slice(0, 500),
        source: 'global_on_error',
      });
    } catch (_) {
      // 埋点失败不能影响业务
    }
  };
  GameGlobal.onUnhandledRejection = (ev: any) => {
    console.error('[UnhandledRejection]', ev?.reason || ev);
    try {
      const reason = ev?.reason;
      const errMsg = reason instanceof Error
        ? `${reason.name}: ${reason.message}`
        : String(reason ?? ev ?? 'unknown');
      const stack = reason instanceof Error ? String(reason.stack || '') : '';
      analytics.track(EVENT_NAMES.APP_ERROR, {
        err_code: 0,
        err_msg: errMsg.slice(0, 500),
        // stack 可能很大，裁剪到 1KB 避免单事件膨胀拖慢上报
        stack: stack ? stack.slice(0, 1000) : '',
        source: 'unhandled_rejection',
      });
    } catch (_) {
      // 同上：埋点失败不能影响业务
    }
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

    // 经分埋点 SDK：在最早的时机初始化即可，此时 SDK 还没拿到 user_id，
    // 入队事件先用 anonymous_id 兜底；登录拿到 openid 后再调 setAnalyticsUserId 触发 LOGIN + flush。
    // 注意：不要在这里立刻 track session_start！必须等 setAnalyticsUserId 之后再打，
    // 否则 user_id='' 与登录后 user_id=xxx 会被算成两个不同 uk，DAU 翻倍。
    initAnalytics();
    // 在 TutorialManager.start() 之前就 attach EventBus 监听，避免错过首步的 stepChanged。
    setupTutorialAnalytics();
    // 玩法事件订阅同样要早 attach，避免错过 board:initialized 之类的早期事件。
    // BoardManager.init / CustomerManager.start 都在 main() 后段才执行，所以现在 attach 不会漏单。
    setupGameplayAnalytics();

    // EventSystem 诊断
    try {
      const renderer = (Game as any).app?.renderer;
      const events = renderer?.events;
      console.log('[main] EventSystem:', !!events,
        'domElement:', !!events?.domElement,
        'supportsPointerEvents:', events?.supportsPointerEvents,
        'supportsTouchEvents:', events?.supportsTouchEvents);
    } catch (e) { console.warn('[main] EventSystem 诊断失败:', e); }

    // topReserved = safeTop + TopBar(60) + gap(4) + ShopArea(250)；与 MainScene.SHOP_HEIGHT 一致（全景视口可更高，略压棋盘顶边）
    const topReserved = Game.safeTop + 60 + 4 + MainScene.SHOP_HEIGHT;
    computeBoardMetrics(Game.logicHeight, topReserved);
    console.log(`[main] BoardMetrics 计算完成, logicHeight:${Game.logicHeight}, safeTop:${Game.safeTop}, topReserved:${topReserved}`);

    Game.stage.sortableChildren = true;
    const loadingOverlay = new LoadingScreenOverlay();
    Game.stage.addChild(loadingOverlay);
    let initialSaveLoaded = false;
    let runtimeReadyForCloudReload = false;
    let pendingCloudReloadInfo: CloudImportInfo | null = null;
    const handleCloudSaveReload = (info: CloudImportInfo): void => {
      console.warn(
        `[main] 云端核心存档已覆盖本地，准备重载/重启 reason=${info.reason}, updatedAt=${info.updatedAt}`,
      );
      Platform.showToast('已恢复云端存档，正在刷新', 'none');

      // 小游戏里重启最稳：能避免各业务 Manager 已绑定的旧内存状态继续写回。
      if (Platform.restartMiniProgram()) return;

      if (SaveManager.reloadFromStorage(`cloud-import:${info.reason}`)) {
        EventBus.emit('cloud:saveReloaded', info);
      }
    };
    PersistService.subscribeCloudImport((info) => {
      if (info.changedKeys.includes('huahua_tutorial')) {
        TutorialManager.reloadFromStorage();
      }
      if (info.changedKeys.includes('huahua_decoration')) {
        DecorationManager.reloadFromStorage();
      }
      if (info.changedKeys.includes('huahua_room_layout')) {
        RoomLayoutManager.reloadFromStorage();
      }
      if (info.changedKeys.includes('huahua_save')) {
        if (initialSaveLoaded) {
          TutorialManager.ensureCompletedIfVeteranSave(true);
        }
      }
      if (!info.changedKeys.includes('huahua_save')) return;
      if (!initialSaveLoaded) {
        // 启动读档前发生的云端导入会被 SaveManager.load() 直接读到，不需要重启。
        return;
      }
      if (!runtimeReadyForCloudReload) {
        pendingCloudReloadInfo = info;
        return;
      }
      handleCloudSaveReload(info);
    });

    await TextureCache.preloadLoadingSplash();
    loadingOverlay.applySplashTexture();
    loadingOverlay.applyTitleTexture();
    await CdnAssetService.fetchManifest();

    // 启动只阻塞关键资源：主包 UI / 新手故事 / 默认头像 + items 分包。
    // 其它 CDN 大资源进入游戏后后台预热或按需懒加载，避免新号首进因全量 CDN 下载卡住或空白。
    await TextureCache.preloadCritical((loaded, total) => {
      const ratio = total > 0 ? loaded / total : 1;
      loadingOverlay.setProgress(0.05 + ratio * 0.45);
    });
    await TextureCache.loadItemsSubpackage((loaded, total) => {
      const ratio = total > 0 ? loaded / total : 1;
      loadingOverlay.setProgress(0.5 + ratio * 0.45);
    });
    loadingOverlay.setProgress(1);

    // 先等 audio 分包就绪再进主场景，避免 InnerAudioContext 在文件未落地时解码报错
    const _apiAudio: any = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
    await new Promise<void>((resolve) => {
      if (CdnAssetService.isCdnPath('subpkg_audio/bgm_main.mp3')) {
        console.log('[main] audio 已 CDN 化，跳过 audio 分包加载');
        resolve();
        return;
      }
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

    // 勿在此处移除 Loading：其后仍有棋盘初始化、云同步、MainScene 首帧构建等，
    // 过早销毁会只剩 renderer 底色 0xFFF5EE，表现为「白屏一闪」。见下方 switchTo 之后。

    // 初始化棋盘数据
    BoardManager.init();
    console.log('[main] BoardManager.init 完成');

    MergeCompanionManager.init();

    const startupSync = await CloudSyncManager.awaitStartupSync();
    console.log(`[main] 云同步启动结果: ${startupSync.status}, reason=${startupSync.reason}`);

    // 拿到 openid 后第一时间通知 SDK：内部会自动 track LOGIN 并立即 flush，
    // 给后端做 anonymous_id ↔ user_id 归一锚点；本地登录失败（cacheOnly）时 userId 为空，仍要兜底打 session_start。
    if (CloudSyncManager.userId) {
      setAnalyticsUserId(CloudSyncManager.userId);
    }
    analytics.track(EVENT_NAMES.SESSION_START, {
      entry: 'main',
      with_user_id: !!CloudSyncManager.userId,
      cloud_sync_status: startupSync.status,
    });
    void analytics.flush('startup-session-start');

    // 尝试加载存档（开发阶段已在启动时清除，此处应返回 false）
    const loaded = SaveManager.load();
    initialSaveLoaded = true;
    TutorialManager.ensureCompletedIfVeteranSave(loaded);
    if (!loaded) {
      BuildingManager.reset();
      MerchShopManager.init();
      MerchShopManager.bootstrapFresh();
    }
    console.log('[main]', loaded ? '存档加载成功' : '无存档，使用默认数据');
    UserIdentityManager.init();

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

    // 进入主场景（首帧 UI 已挂到 stage 后再撤掉 Loading，避免中间空窗期浅底色「白屏」）
    SceneManager.switchTo('main');
    Game.stage.removeChild(loadingOverlay);
    loadingOverlay.destroy({ children: true });
    void TextureCache.preloadSceneWarmup('shop');
    setTimeout(() => {
      void TextureCache.preloadPanelAssets('checkin');
      void TextureCache.preloadPanelAssets('quest');
      void TextureCache.preloadSceneWarmup('deco');
      void TextureCache.preloadSceneWarmup('worldmap');
    }, 1500);
    setTimeout(() => {
      void TextureCache.preloadPanelAssets('warehouse');
      void TextureCache.preloadPanelAssets('mergeChain');
      void TextureCache.preloadPanelAssets('collection');
      void TextureCache.preloadPanelAssets('affinity');
      void TextureCache.preloadPanelAssets('dressup');
      void TextureCache.preloadPanelAssets('merchShop');
      void TextureCache.preloadPanelAssets('flowerSignGacha');
    }, 3500);
    runtimeReadyForCloudReload = true;
    if (pendingCloudReloadInfo) {
      const info = pendingCloudReloadInfo;
      pendingCloudReloadInfo = null;
      handleCloudSaveReload(info);
    }

    // 监听小游戏生命周期：退到后台时保存状态
    const _apiMain: any = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
    if (_apiMain) {
      let lastHideAt = 0;
      _apiMain.onHide?.(() => {
        console.log('[main] 游戏退到后台，保存状态');
        IdleManager.onHide();
        SaveManager.save();
        // 立即刷写装饰布局（防止防抖 timer 未触发导致位置丢失）
        RoomLayoutManager.saveNow();
        void CloudSyncManager.flushNow('app-hide');
        // 经分 onHide 标准事件：reason 用 app-hide 与 hot-pot 对齐，便于跨游戏比较异常退出比例。
        analytics.track(EVENT_NAMES.SESSION_END, { reason: 'app-hide' });
        lastHideAt = Date.now();
      });
      _apiMain.onShow?.(() => {
        console.log('[main] 游戏回到前台');
        if (MerchShopManager.ensureUpToDate()) {
          SaveManager.save();
        }
        // 经分 app_show：业务侧自定义打，**不**重置 session_id（session = 一次冷启动）。
        // 携带 background_ms 便于 dashboard 看「后台多久回来」分布；首次启动 lastHideAt=0 就跳过。
        if (lastHideAt > 0) {
          analytics.track(EVENT_NAMES.APP_SHOW, {
            from_background: true,
            background_ms: Date.now() - lastHideAt,
          });
        }
      });
    }

    console.log('[main] 花花妙屋启动完成 BUILD:', BUILD_TIME);
  } catch (e: any) {
    const errMsg = (e && (e.message || e.errMsg)) || '';
    let raw = '';
    try { raw = JSON.stringify(e, Object.getOwnPropertyNames(e || {})); } catch (_) { raw = String(e); }
    console.error(`[main] 启动失败: errMsg=${errMsg} raw=${raw}`, e);
    // 启动失败是定位"白屏 / 进不来"问题的关键归因。SDK 已 init 才会真上报，否则会被吞，符合预期。
    try {
      analytics.track(EVENT_NAMES.APP_ERROR, {
        err_code: 0,
        err_msg: String(errMsg || raw || 'main_boot_failed').slice(0, 500),
        stack: e instanceof Error ? String(e.stack || '').slice(0, 1000) : '',
        source: 'main_boot_failed',
      });
    } catch (_) {
      // 同上：埋点失败不能影响业务
    }
  }
}

main();
