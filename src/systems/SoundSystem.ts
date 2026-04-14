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
import { SceneManager } from '@/core/SceneManager';

/** 连续两次合成间隔超过此时长则变音档位从第 1 档重新计（略放宽，避免动画间隙导致永远停在第 1 档） */
const MERGE_COMBO_GAP_MS = 2400;
/** 连续合成：倍速升幅收窄 + 高档略压音量，减轻「又尖又吵」 */
const MERGE_SUCCESS_PLAYBACK_RATES: readonly number[] = [1.0, 1.05, 1.1, 1.14, 1.18];
const MERGE_SUCCESS_VOLUME_SCALE: readonly number[] = [1.0, 0.97, 0.93, 0.9, 0.86];

class SoundSystemClass {
  private _inited = false;
  private _mergeComboIndex = 0;
  private _mergeLastTimeMs = 0;

  init(): void {
    if (this._inited) return;
    this._inited = true;

    // 注册所有音效
    for (const def of SOUND_DEFS) {
      AudioManager.register(def.name, def.src, def.volume);
    }

    console.log(`[SoundSystem] 注册 ${SOUND_DEFS.length} 个音效, ${BGM_DEFS.length} 个 BGM`);

    // ---- 绑定事件 → 音效 ----

    EventBus.on('board:merged', () => {
      const now = Date.now();
      if (now - this._mergeLastTimeMs > MERGE_COMBO_GAP_MS) {
        this._mergeComboIndex = 0;
      }
      this._mergeLastTimeMs = now;
      const step = Math.min(this._mergeComboIndex, MERGE_SUCCESS_PLAYBACK_RATES.length - 1);
      const rate = MERGE_SUCCESS_PLAYBACK_RATES[step];
      const volSc = MERGE_SUCCESS_VOLUME_SCALE[step];
      AudioManager.play('merge_success', {
        bypassThrottle: true,
        playbackRate: rate,
        volumeScale: volSc,
      });
      this._mergeComboIndex = Math.min(this._mergeComboIndex + 1, MERGE_SUCCESS_PLAYBACK_RATES.length);
    });

    // 建筑产出（点击建筑成功产出时）
    EventBus.on('building:produced', () => {
      AudioManager.play('tap_building');
    });

    // 客人到达
    EventBus.on('customer:arrived', () => {
      AudioManager.play('customer_arrive');
    });

    // 格子解锁
    EventBus.on('board:cellUnlocked', () => {
      AudioManager.play('cell_unlock');
    });

    // 客人「完成」音效由 MainScene（订单起点一次）与 RewardFlyCoordinator（其它飞入）统一播 customer_deliver

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

    // ---- 全局按钮点击音效（默认 `button_click` = `subpkg_audio/button_click.mp3`，源 `game_assets/huahua/bgm/按钮通用.mp3`）----
    // 沿命中链向上找 `cursor === 'pointer'` 即播；未设 pointer 的交互区不会自动播（需在控件上设 cursor 或单独 play）。
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

  /** 花店 / 装修全屏场景 BGM */
  playShopBGM(): void {
    const bgm = BGM_DEFS.find(b => b.name === 'bgm_shop');
    if (bgm) {
      AudioManager.playBGM(bgm.src, bgm.volume);
    } else {
      this.playMainBGM();
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

  /** 新手引导开场四格插画：源 `新手.mp3` 首 10s，循环至故事结束 */
  playTutorialStoryIntroBGM(): void {
    const bgm = BGM_DEFS.find(b => b.name === 'bgm_tutorial_story_intro');
    if (bgm) {
      AudioManager.playBGM(bgm.src, bgm.volume, { loop: true });
    }
  }

  /** 大地图全屏页：与 `playTutorialStoryIntroBGM` 同一段音乐 */
  playWorldMapBGM(): void {
    this.playTutorialStoryIntroBGM();
  }

  /** 关闭大地图后按当前场景恢复 BGM（主玩法 / 花店） */
  resumeSceneBGMAfterWorldMap(): void {
    const n = SceneManager.current?.name;
    if (n === 'shop') this.playShopBGM();
    else this.playMainBGM();
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
