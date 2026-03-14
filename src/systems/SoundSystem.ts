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
  }

  /** 根据季节播放对应 BGM */
  playSeasonBGM(season: string): void {
    const bgmName = `bgm_${season}`;
    const bgm = BGM_DEFS.find(b => b.name === bgmName);
    if (bgm) {
      AudioManager.playBGM(bgm.src, bgm.volume);
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
