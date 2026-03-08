/**
 * 花语小筑 - 游戏入口
 */
// unsafe-eval patch 必须最先导入，在 new PIXI.Application() 之前执行
import '@/core/pixiUnsafeEvalPatch';
import * as PIXI from 'pixi.js';
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

    // ======== 真机渲染诊断 ========
    _runRenderDiag();

    // 检查纹理上传 patch 是否在工作
    try {
      const testText = new PIXI.Text('测试', { fontSize: 16, fill: 0xFF0000 });
      testText.position.set(170, 100);
      Game.stage.addChild(testText);
      console.log('[main] 测试 Text 已创建，texture valid:', testText.texture?.valid,
        'baseTexture valid:', testText.texture?.baseTexture?.valid,
        'w:', testText.texture?.width, 'h:', testText.texture?.height);
    } catch (e) { console.error('[main] 测试 Text 创建失败:', e); }

    console.log('[main] 花语小筑启动完成 ✿');
  } catch (e) {
    console.error('[main] 启动失败:', e);
  }
}

/** 渲染管线诊断 —— 定位 Graphics / Text 真机不渲染的根因 */
function _runRenderDiag(): void {
  const _api: any = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

  // 1) Texture.WHITE 状态
  try {
    const wt = PIXI.Texture.WHITE;
    const bt = wt?.baseTexture;
    console.log('[diag] Texture.WHITE valid:', wt?.valid,
      'baseW:', bt?.width, 'baseH:', bt?.height,
      'realW:', bt?.realWidth, 'realH:', bt?.realHeight,
      'resource:', bt?.resource?.constructor?.name);
  } catch (e) { console.error('[diag] Texture.WHITE 异常:', e); }

  // 2) createCanvas() 2D 能力测试
  try {
    const c1 = _api ? _api.createCanvas() : document.createElement('canvas');
    c1.width = 4; c1.height = 4;
    const ctx1 = c1.getContext('2d');
    let px1 = [0, 0, 0, 0];
    if (ctx1) {
      ctx1.fillStyle = '#FF0000';
      ctx1.fillRect(0, 0, 4, 4);
      try { px1 = Array.from(ctx1.getImageData(0, 0, 1, 1).data); } catch (_) {}
    }
    console.log('[diag] createCanvas 2D:', !!ctx1,
      'pixel:', px1[0], px1[1], px1[2], px1[3],
      'toTempFile:', typeof c1.toTempFilePathSync);
  } catch (e) { console.error('[diag] createCanvas 2d 异常:', e); }

  // 3) createOffscreenCanvas({ type:'2d' }) 能力测试
  try {
    if (_api && typeof _api.createOffscreenCanvas === 'function') {
      const c2 = _api.createOffscreenCanvas({ type: '2d', width: 4, height: 4 });
      const ctx2 = c2.getContext('2d');
      let px2 = [0, 0, 0, 0];
      if (ctx2) {
        ctx2.fillStyle = '#00FF00';
        ctx2.fillRect(0, 0, 4, 4);
        try { px2 = Array.from(ctx2.getImageData(0, 0, 1, 1).data); } catch (_) {}
      }
      console.log('[diag] createOffscreenCanvas 2D:', !!ctx2,
        'pixel:', px2[0], px2[1], px2[2], px2[3],
        'toTempFile:', typeof c2.toTempFilePathSync);
    } else {
      console.log('[diag] createOffscreenCanvas 不可用');
    }
  } catch (e) { console.error('[diag] createOffscreenCanvas 异常:', e); }

  // 4) ADAPTER.createCanvas 综合测试（PixiJS 实际使用的路径）
  try {
    const _settings = (PIXI as any).settings;
    if (_settings && _settings.ADAPTER) {
      const ac = _settings.ADAPTER.createCanvas(8, 8);
      const actx = ac.getContext('2d');
      let apx = [0, 0, 0, 0];
      if (actx) {
        actx.fillStyle = '#0000FF';
        actx.fillRect(0, 0, 8, 8);
        actx.fillStyle = '#FFFFFF';
        actx.font = '8px sans-serif';
        actx.fillText('A', 0, 7);
        try { apx = Array.from(actx.getImageData(0, 0, 1, 1).data); } catch (_) {}
      }
      console.log('[diag] ADAPTER.createCanvas 2D:', !!actx,
        'pixel:', apx[0], apx[1], apx[2], apx[3],
        'constructor:', ac?.constructor?.name);
    } else {
      console.warn('[diag] PIXI.settings.ADAPTER 未设置');
    }
  } catch (e) { console.error('[diag] ADAPTER canvas 异常:', e); }

  // 5) 添加一个鲜红色测试矩形到 stage 最上层
  try {
    const g = new PIXI.Graphics();
    g.beginFill(0xFF0000);
    g.drawRect(0, 0, 150, 80);
    g.endFill();
    g.position.set(10, 10);
    Game.stage.addChild(g);
    console.log('[diag] 红色测试 Graphics 已加到 stage, children:', Game.stage.children.length);
  } catch (e) { console.error('[diag] test Graphics 异常:', e); }

  // 6) 添加一个红色大字到 stage
  try {
    const t = new PIXI.Text('DIAG', { fontSize: 48, fill: 0xFF0000 });
    t.position.set(10, 100);
    Game.stage.addChild(t);
    console.log('[diag] 测试 Text 已加到 stage');
  } catch (e) { console.error('[diag] test Text 异常:', e); }

  // 7) 事件交互测试：可点击的蓝色按钮
  try {
    const btn = new PIXI.Graphics();
    btn.beginFill(0x0066FF);
    btn.drawRoundedRect(0, 0, 200, 60, 12);
    btn.endFill();
    btn.position.set(200, 10);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.hitArea = new PIXI.Rectangle(0, 0, 200, 60);
    let tapCount = 0;
    btn.on('pointerdown', () => {
      tapCount++;
      console.log('[diag] 按钮被点击! #' + tapCount);
    });
    Game.stage.addChild(btn);
    console.log('[diag] 交互测试按钮已添加（蓝色矩形）');
  } catch (e) { console.error('[diag] 交互测试异常:', e); }

  // 8) WebGL 扩展检查
  try {
    const renderer = (Game as any).app?.renderer;
    const gl = renderer?.gl;
    if (gl) {
      const ext32 = gl.getExtension('OES_element_index_uint');
      console.log('[diag] OES_element_index_uint:', !!ext32);
      console.log('[diag] MAX_TEXTURE_SIZE:', gl.getParameter(gl.MAX_TEXTURE_SIZE));
      console.log('[diag] renderer type:', renderer.type, '(1=WebGL,2=Canvas)');
    }
  } catch (e) { console.error('[diag] WebGL 诊断异常:', e); }
}

main();
