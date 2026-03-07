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
    const nextScene = this._scenes.get(name);
    if (!nextScene) {
      console.error(`[SceneManager] 场景 "${name}" 未注册`);
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

    console.log(`[SceneManager] 切换到场景: ${name}`);
  }

  get current(): Scene | null {
    return this._currentScene;
  }
}

export const SceneManager = new SceneManagerClass();
