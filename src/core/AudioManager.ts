/**
 * 音效管理器
 *
 * 引擎级模块，零业务依赖。
 * 微信/抖音小游戏环境下通过 InnerAudioContext 播放。
 * 首次播放需在用户交互（tap）回调中触发，否则可能被系统拦截。
 */

import { CdnAssetService } from '@/core/CdnAssetService';

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

export interface PlaySoundOptions {
  /** 播放速率（约 0.5～2）；用于合成音阶等 */
  playbackRate?: number;
  /** 为 true 时不做同名 50ms 节流（连续快速播放各一遍） */
  bypassThrottle?: boolean;
  /** 乘在注册音量上，0～1；连击变调时略压高音档可减轻刺耳感 */
  volumeScale?: number;
}

class AudioManagerClass {
  private _sounds: Map<string, SoundEntry> = new Map();
  private _bgm: any = null;
  private _soundMuted = false;
  private _musicMuted = false;
  private _bgmPending: { src: string; volume: number } | null = null;
  private _bgmRequestSeq = 0;
  /** 记录每个音效最后一次播放时间戳，用于节流 */
  private _lastPlayTime: Map<string, number> = new Map();

  register(name: string, src: string, volume = 1): void {
    this._sounds.set(name, { src, volume });
  }

  preload(srcs: readonly string[]): Promise<void> {
    return CdnAssetService.preloadPaths(srcs).catch(err => {
      console.warn(TAG, '音频预加载失败:', err);
    });
  }

  play(name: string, opts?: PlaySoundOptions): void {
    if (this._soundMuted || !_api) return;
    const entry = this._sounds.get(name);
    if (!entry) {
      console.warn(TAG, `音效 "${name}" 未注册`);
      return;
    }

    const now = Date.now();
    if (!opts?.bypassThrottle) {
      const last = this._lastPlayTime.get(name) || 0;
      if (now - last < THROTTLE_MS) return;
      this._lastPlayTime.set(name, now);
    }

    const rateRaw = opts?.playbackRate;
    const rate =
      rateRaw !== undefined && Number.isFinite(rateRaw)
        ? Math.min(2, Math.max(0.5, rateRaw))
        : 1;

    const scaleRaw = opts?.volumeScale;
    const volumeScale =
      scaleRaw !== undefined && Number.isFinite(scaleRaw)
        ? Math.min(1, Math.max(0, scaleRaw))
        : 1;

    void CdnAssetService.resolveOrDownload(entry.src)
      .then(src => this._playResolvedSound(name, src, entry.volume * volumeScale, opts, rate))
      .catch(err => {
        console.warn(TAG, `音效 "${name}" 资源未就绪:`, err?.message || err);
      });
  }

  private _playResolvedSound(
    name: string,
    src: string,
    volume: number,
    opts: PlaySoundOptions | undefined,
    rate: number,
  ): void {
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

      const applyPlaybackRate = (): void => {
        if (opts?.playbackRate === undefined) return;
        try {
          (audio as { playbackRate?: number }).playbackRate = rate;
        } catch (_) { /* 部分运行时不支持 */ }
      };

      const tryPlay = () => {
        if (done || started) return;
        started = true;
        try {
          // 微信 / 抖音 InnerAudioContext：倍速常在 src 赋值后、play 前写入才稳定生效（见官方社区反馈）
          applyPlaybackRate();
          audio.play();
        } catch (e) {
          console.warn(TAG, `音效 "${name}" play():`, e);
          cleanup();
        }
      };

      audio.volume = volume;
      audio.onError((err: any) => {
        console.warn(TAG, `音效 "${name}" 播放失败:`, err?.errMsg || err);
        cleanup();
      });
      audio.onEnded(() => cleanup());
      if (typeof audio.onCanplay === 'function') {
        audio.onCanplay(() => {
          applyPlaybackRate();
          tryPlay();
        });
      }
      // 先写倍速再设 src、设完 src 再写一遍：兼容部分基础库只在「src 已设」后接受 playbackRate
      applyPlaybackRate();
      audio.src = src;
      applyPlaybackRate();
      setTimeout(() => {
        applyPlaybackRate();
        tryPlay();
      }, typeof audio.onCanplay === 'function' ? 300 : 0);
    } catch (e) {
      console.warn(TAG, `音效 "${name}" 创建异常:`, e);
    }
  }

  playBGM(src: string, volume = 0.5, opts?: { loop?: boolean }): void {
    const seq = ++this._bgmRequestSeq;
    void CdnAssetService.resolveOrDownload(src)
      .then(resolvedSrc => this._playResolvedBGM(seq, src, resolvedSrc, volume, opts))
      .catch(err => {
        if (seq !== this._bgmRequestSeq) return;
        console.warn(TAG, `BGM "${src}" 资源未就绪:`, err?.message || err);
        this._bgmPending = { src, volume };
      });
  }

  private _playResolvedBGM(
    seq: number,
    originalSrc: string,
    resolvedSrc: string,
    volume = 0.5,
    opts?: { loop?: boolean },
  ): void {
    if (seq !== this._bgmRequestSeq) return;
    if (!_api) {
      console.warn(TAG, 'API 不可用，无法播放 BGM');
      return;
    }
    this.stopBGM();

    // 记录待播放信息，首次可能需要用户交互后才能真正播放
    this._bgmPending = { src: originalSrc, volume };

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

      this._bgm.loop = opts?.loop ?? true;
      this._bgm.volume = volume;
      this._bgm.onError((err: any) => {
        console.warn(TAG, `BGM "${originalSrc}" 播放失败:`, err?.errMsg || err);
        try {
          this._bgm?.destroy?.();
        } catch (_) { /* */ }
        this._bgm = null;
      });
      this._bgm.onPlay(() => {
        console.log(TAG, `BGM "${originalSrc}" 开始播放`);
        this._bgmPending = null;
      });

      const tryPlayBgm = () => {
        if (this._musicMuted || !this._bgm) return;
        try {
          this._bgm.play();
          console.log(TAG, `BGM "${originalSrc}" 尝试播放...`);
        } catch (e) {
          console.warn(TAG, `BGM play():`, e);
        }
      };

      if (typeof this._bgm.onCanplay === 'function') {
        this._bgm.onCanplay(() => tryPlayBgm());
      }
      console.log(TAG, `BGM "${originalSrc}" resolved src: ${resolvedSrc}`);
      this._bgm.src = resolvedSrc;
      if (!this._musicMuted) {
        setTimeout(tryPlayBgm, typeof this._bgm.onCanplay === 'function' ? 300 : 0);
      }
    } catch (e) {
      console.warn(TAG, `BGM "${originalSrc}" 创建异常:`, e);
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
      if (!this._musicMuted) {
        try { this._bgm.play(); } catch (_) {}
      }
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
    return this._musicMuted && this._soundMuted;
  }

  set muted(val: boolean) {
    this.setMuted(val);
  }

  get musicMuted(): boolean {
    return this._musicMuted;
  }

  set musicMuted(val: boolean) {
    this.setMusicMuted(val);
  }

  get soundMuted(): boolean {
    return this._soundMuted;
  }

  set soundMuted(val: boolean) {
    this.setSoundMuted(val);
  }

  setMuted(val: boolean): void {
    this.setMusicMuted(val);
    this.setSoundMuted(val);
  }

  setMusicMuted(val: boolean): void {
    this._musicMuted = val;
    if (this._bgm) {
      try {
        val ? this._bgm.pause() : this._bgm.play();
      } catch (_) {}
    }
  }

  setSoundMuted(val: boolean): void {
    this._soundMuted = val;
  }
}

export const AudioManager = new AudioManagerClass();
