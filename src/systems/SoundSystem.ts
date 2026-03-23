/**
 * 音效系统
 *
 * 自动注册音效资源，监听 EventBus 事件并播放对应音效。
 * 当 minigame/audio/ 目录下没有对应文件时，播放静默失败（不影响游戏）。
 *
 * 使用方式：在 MainScene.onEnter 中调用 SoundSystem.init() 即可。
 */
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

    // 首次交互恢复 BGM + 全局按钮点击音效
    // 通过 canvas 原生 pointerup 事件 + renderer EventSystem hitTest
    // 判断点击目标是否是 cursor='pointer' 的按钮，只有是的时候才播放。
    const canvas = Game.app?.view as HTMLCanvasElement | undefined;
    if (canvas) {
      let _firstTouch = true;
      canvas.addEventListener('pointerup', (nativeEvt: PointerEvent) => {
        // 首次交互恢复 BGM（自动播放策略拦截后的重试）
        if (_firstTouch) {
          _firstTouch = false;
          AudioManager.resumeOnInteraction();
        }

        // 通过 renderer EventSystem 做 hitTest，找到 PixiJS 层的点击目标
        try {
          const renderer = Game.app?.renderer as any;
          const evtSys = renderer?.events;
          if (!evtSys) return;

          // 将原生坐标映射到 PixiJS 内部坐标
          const globalPos = { x: 0, y: 0 };
          evtSys.mapPositionToPoint(globalPos, nativeEvt.clientX, nativeEvt.clientY);

          // hitTest: 从 stage 向下查找命中的最上层交互元素
          const hitTarget = evtSys.rootBoundary?.hitTest?.(globalPos.x, globalPos.y);
          if (!hitTarget) return;

          // 沿命中目标向上查找，看是否有 cursor='pointer' 的节点（即按钮）
          let node = hitTarget;
          while (node) {
            if (node.cursor === 'pointer') {
              AudioManager.play('button_click');
              return;
            }
            node = node.parent;
          }
        } catch (_) {
          // hitTest 失败不影响游戏
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
