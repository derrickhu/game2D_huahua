/**
 * 音效系统
 *
 * 自动注册音效资源，监听 EventBus 事件并播放对应音效。
 * 当 minigame/audio/ 目录下没有对应文件时，播放静默失败（不影响游戏）。
 *
 * 使用方式：在 MainScene.onEnter 中调用 SoundSystem.init() 即可。
 */
import * as PIXI from 'pixi.js';
import { AudioManager } from '@/core/AudioManager';
import { EventBus } from '@/core/EventBus';
import { Game } from '@/core/Game';
import { SOUND_DEFS, BGM_DEFS } from '@/config/AudioConfig';

class SoundSystemClass {
  private _inited = false;

  init(): void {
    if (this._inited) return;
    this._inited = true;

    // 注册所有音效
    for (const def of SOUND_DEFS) {
      AudioManager.register(def.name, def.src, def.volume);
    }

    console.log(`[SoundSystem] 注册 ${SOUND_DEFS.length} 个音效, ${BGM_DEFS.length} 个 BGM`);

    // ---- 绑定事件 → 音效 ----

    // 合成成功
    EventBus.on('board:merged', () => {
      AudioManager.play('merge_success');
    });

    // 连击
    EventBus.on('combo:hit', (count: number) => {
      if (count >= 3) {
        AudioManager.play('merge_combo');
      }
    });

    // 狂热模式
    EventBus.on('combo:frenzy', () => {
      AudioManager.play('merge_frenzy');
    });

    // 建筑点击
    EventBus.on('building:tapped', () => {
      AudioManager.play('tap_building');
    });

    // 客人到达
    EventBus.on('customer:arrived', () => {
      AudioManager.play('customer_arrive');
    });

    // 订单交付
    EventBus.on('customer:delivered', () => {
      AudioManager.play('customer_deliver');
    });

    // 格子解锁
    EventBus.on('board:cellUnlocked', () => {
      AudioManager.play('cell_unlock');
    });

    // 升级
    EventBus.on('level:up', () => {
      AudioManager.play('level_up');
    });

    // 签到
    EventBus.on('checkin:signed', () => {
      AudioManager.play('checkin');
    });

    // 成就解锁
    EventBus.on('achievement:unlocked', () => {
      AudioManager.play('achievement');
    });

    // ---- 首次交互恢复 BGM ----
    const canvas = Game.app?.view as HTMLCanvasElement | undefined;
    if (canvas) {
      let _firstTouch = true;
      canvas.addEventListener('pointerdown', () => {
        if (_firstTouch) {
          _firstTouch = false;
          AudioManager.resumeOnInteraction();
        }
      });
    }

    // ---- 全局按钮点击音效 ----
    // 利用 PixiJS 事件冒泡机制：在 stage 上监听 pointerdown，
    // e.target 就是实际命中的元素（在按钮回调修改场景树之前就已确定）。
    // 这样完全不受"按钮回调打开面板遮罩 → hitTest 命中遮罩"的时序影响。
    //
    // 关键：stage.eventMode 必须设为 'static' 而非 'passive'！
    // 根据 PixiJS 官方文档（v7+）：
    //   - passive：自身不触发事件，不参与事件冒泡处理链，.on() 回调不会被调用
    //   - static：触发事件并参与 hitTest，能接收子对象冒泡上来的事件
    // 参考：https://github.com/pixijs/pixijs/discussions/10388
    const stage = Game.app?.stage;
    if (stage) {
      stage.eventMode = 'static';
      stage.hitArea = new PIXI.Rectangle(
        0, 0,
        Game.screenWidth * Game.dpr,
        Game.screenHeight * Game.dpr,
      );
      stage.on('pointerdown', (e: any) => {
        try {
          let node = e.target;
          while (node && node !== stage) {
            if (node.cursor === 'pointer') {
              AudioManager.play('button_click');
              return;
            }
            node = node.parent;
          }
        } catch (_) {
          // 静默失败
        }
      });
    }

    // 尝试自动播放主 BGM（可能因自动播放策略被拦截，首次交互时会重试）
    this.playMainBGM();
  }

  /** 播放主玩法 BGM */
  playMainBGM(): void {
    const bgm = BGM_DEFS.find(b => b.name === 'bgm_main');
    if (bgm) {
      AudioManager.playBGM(bgm.src, bgm.volume);
    }
  }

  /** 播放花语剧情 BGM */
  playStoryBGM(): void {
    const bgm = BGM_DEFS.find(b => b.name === 'bgm_story');
    if (bgm) {
      AudioManager.playBGM(bgm.src, bgm.volume);
    } else {
      this.playMainBGM();
    }
  }

  /** 停止 BGM */
  stopBGM(): void {
    AudioManager.stopBGM();
  }

  /** 静音切换 */
  toggleMute(): boolean {
    AudioManager.muted = !AudioManager.muted;
    return AudioManager.muted;
  }

  get isMuted(): boolean {
    return AudioManager.muted;
  }
}

export const SoundSystem = new SoundSystemClass();
