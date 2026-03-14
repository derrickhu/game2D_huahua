/**
 * 场景管理器 - 管理场景切换
 */
import * as PIXI from 'pixi.js';
import { Game } from './Game';

export interface Scene {
  readonly name: string;
  readonly container: PIXI.Container;
  onEnter?(): void;
  onExit?(): void;
  update?(dt: number): void;
}

class SceneManagerClass {
  private _scenes: Map<string, Scene> = new Map();
  private _currentScene: Scene | null = null;

  register(scene: Scene): void {
    this._scenes.set(scene.name, scene);
  }

  switchTo(name: string): void {
    console.log(`[SceneManager] switchTo("${name}") Game.uid=${(Game as any)._uid}, stage=${!!Game.stage}`);

    const nextScene = this._scenes.get(name);
    if (!nextScene) {
      console.error(`[SceneManager] 场景 "${name}" 未注册`);
      return;
    }

    if (!Game.stage) {
      console.error('[SceneManager] Game.stage 未初始化，无法切换场景。'
        + ' 请检查 Game.init() 是否在 switchTo() 之前被调用且执行成功。');
      return;
    }

    // 退出当前场景
    if (this._currentScene) {
      this._currentScene.onExit?.();
      Game.stage.removeChild(this._currentScene.container);
    }

    // 进入新场景
    this._currentScene = nextScene;
    Game.stage.addChild(nextScene.container);
    nextScene.onEnter?.();

    // 确保全局覆盖层（弹窗面板）始终在场景之上
    this._bringOverlayToFront();

    console.log(`[SceneManager] 切换到场景: ${name}`);
  }

  get current(): Scene | null {
    return this._currentScene;
  }

  /** 将 OverlayManager 的容器提升到 stage 最顶部 */
  private _bringOverlayToFront(): void {
    // 延迟导入避免循环依赖
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { OverlayManager } = require('./OverlayManager');
      OverlayManager.bringToFront();
    } catch (_) {
      // OverlayManager 尚未初始化，忽略
    }
  }
}

export const SceneManager = new SceneManagerClass();
