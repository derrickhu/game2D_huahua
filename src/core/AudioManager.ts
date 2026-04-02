/**
 * 音效管理器
 *
 * 引擎级模块，零业务依赖。
 * 微信/抖音小游戏环境下通过 InnerAudioContext 播放。
 * 首次播放需在用户交互（tap）回调中触发，否则可能被系统拦截。
 */

declare const wx: any;
declare const tt: any;

const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
const TAG = '[AudioManager]';

/** 同名音效最小播放间隔（毫秒），防止快速连击创建大量 AudioContext */
const THROTTLE_MS = 50;

interface SoundEntry {
  src: string;
  volume: number;
}

class AudioManagerClass {
  private _sounds: Map<string, SoundEntry> = new Map();
  private _bgm: any = null;
  private _muted = false;
  private _bgmPending: { src: string; volume: number } | null = null;
  /** 记录每个音效最后一次播放时间戳，用于节流 */
  private _lastPlayTime: Map<string, number> = new Map();

  register(name: string, src: string, volume = 1): void {
    this._sounds.set(name, { src, volume });
  }

  play(name: string): void {
    if (this._muted || !_api) return;
    const entry = this._sounds.get(name);
    if (!entry) {
      console.warn(TAG, `音效 "${name}" 未注册`);
      return;
    }

    // 节流：同名音效在 THROTTLE_MS 内不重复播放
    const now = Date.now();
    const last = this._lastPlayTime.get(name) || 0;
    if (now - last < THROTTLE_MS) return;
    this._lastPlayTime.set(name, now);

    try {
      const create = _api.createInnerAudioContext;
      if (typeof create !== 'function') return;
      const audio = create.call(_api);
      if (!audio || typeof audio.play !== 'function') return;

      let done = false;
      let started = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        try {
          audio.destroy();
        } catch (_) { /* */ }
      };

      const tryPlay = () => {
        if (done || started) return;
        started = true;
        try {
          audio.play();
        } catch (e) {
          console.warn(TAG, `音效 "${name}" play():`, e);
          cleanup();
        }
      };

      audio.volume = entry.volume;
      audio.onError((err: any) => {
        console.warn(TAG, `音效 "${name}" 播放失败:`, err?.errMsg || err);
        cleanup();
      });
      audio.onEnded(() => cleanup());
      if (typeof audio.onCanplay === 'function') {
        audio.onCanplay(() => tryPlay());
      }
      audio.src = entry.src;
      if (typeof audio.onCanplay !== 'function') {
        setTimeout(tryPlay, 0);
      }
    } catch (e) {
      console.warn(TAG, `音效 "${name}" 创建异常:`, e);
    }
  }

  playBGM(src: string, volume = 0.5): void {
    if (!_api) {
      console.warn(TAG, 'API 不可用，无法播放 BGM');
      return;
    }
    this.stopBGM();

    // 记录待播放信息，首次可能需要用户交互后才能真正播放
    this._bgmPending = { src, volume };

    try {
      const create = _api.createInnerAudioContext;
      if (typeof create !== 'function') {
        console.warn(TAG, 'createInnerAudioContext 不可用');
        return;
      }
      this._bgm = create.call(_api);
      if (!this._bgm || typeof this._bgm.play !== 'function') {
        this._bgm = null;
        return;
      }

      this._bgm.loop = true;
      this._bgm.volume = volume;
      this._bgm.onError((err: any) => {
        console.warn(TAG, `BGM "${src}" 播放失败:`, err?.errMsg || err);
        try {
          this._bgm?.destroy?.();
        } catch (_) { /* */ }
        this._bgm = null;
      });
      this._bgm.onPlay(() => {
        console.log(TAG, `BGM "${src}" 开始播放`);
        this._bgmPending = null;
      });

      const tryPlayBgm = () => {
        if (this._muted || !this._bgm) return;
        try {
          this._bgm.play();
          console.log(TAG, `BGM "${src}" 尝试播放...`);
        } catch (e) {
          console.warn(TAG, `BGM play():`, e);
        }
      };

      if (typeof this._bgm.onCanplay === 'function') {
        this._bgm.onCanplay(() => tryPlayBgm());
      }
      this._bgm.src = src;
      if (typeof this._bgm.onCanplay !== 'function' && !this._muted) {
        setTimeout(tryPlayBgm, 0);
      }
    } catch (e) {
      console.warn(TAG, `BGM "${src}" 创建异常:`, e);
      this._bgm = null;
    }
  }

  /**
   * 在用户首次交互时调用，确保被自动播放策略拦截的 BGM 能恢复播放
   */
  resumeOnInteraction(): void {
    if (this._bgmPending && !this._bgm) {
      console.log(TAG, '用户交互后重试 BGM...');
      this.playBGM(this._bgmPending.src, this._bgmPending.volume);
      return;
    }
    if (this._bgm && this._bgmPending) {
      console.log(TAG, '用户交互后恢复 BGM...');
      try { this._bgm.play(); } catch (_) {}
      this._bgmPending = null;
    }
  }

  stopBGM(): void {
    if (this._bgm) {
      try {
        this._bgm.stop();
        this._bgm.destroy();
      } catch (_) {}
      this._bgm = null;
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  set muted(val: boolean) {
    this._muted = val;
    if (this._bgm) {
      try {
        val ? this._bgm.pause() : this._bgm.play();
      } catch (_) {}
    }
  }
}

export const AudioManager = new AudioManagerClass();
