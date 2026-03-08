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

  // 2) 离屏 Canvas 2D 是否可用
  try {
    const c = _api ? _api.createCanvas() : document.createElement('canvas');
    c.width = 4; c.height = 4;
    const ctx = c.getContext('2d');
    console.log('[diag] offscreen canvas 2d:', !!ctx);
    if (ctx) {
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, 0, 4, 4);
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      console.log('[diag] pixel after fill:', pixel[0], pixel[1], pixel[2], pixel[3]);
    }
  } catch (e) { console.error('[diag] offscreen 2d 异常:', e); }

  // 3) HTMLCanvasElement instanceof 检查
  try {
    const c = _api ? _api.createCanvas() : document.createElement('canvas');
    const HCE = typeof HTMLCanvasElement !== 'undefined' ? HTMLCanvasElement : null;
    console.log('[diag] instanceof HTMLCanvasElement:', HCE ? (c instanceof HCE) : 'N/A',
      ', canvas.constructor.name:', c?.constructor?.name,
      ', HTMLCanvasElement.name:', HCE?.name || HCE);
  } catch (e) { console.error('[diag] instanceof 异常:', e); }

  // 4) 添加一个鲜红色测试矩形到 stage 最上层
  try {
    const g = new PIXI.Graphics();
    g.beginFill(0xFF0000);
    g.drawRect(0, 0, 150, 80);
    g.endFill();
    g.position.set(10, 10);
    Game.stage.addChild(g);
    console.log('[diag] 红色测试 Graphics 已加到 stage, children:', Game.stage.children.length);
  } catch (e) { console.error('[diag] test Graphics 异常:', e); }

  // 5) 添加一个红色大字到 stage
  try {
    const t = new PIXI.Text('DIAG', { fontSize: 48, fill: 0xFF0000 });
    t.position.set(10, 100);
    Game.stage.addChild(t);
    console.log('[diag] 测试 Text 已加到 stage');
  } catch (e) { console.error('[diag] test Text 异常:', e); }

  // 6) 事件交互测试：可点击的蓝色按钮
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

  // 7) WebGL 扩展检查
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
