/**
 * 音效管理器
 */

declare const wx: any;
declare const tt: any;

const _api = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;

interface SoundEntry {
  src: string;
  volume: number;
}

class AudioManagerClass {
  private _sounds: Map<string, SoundEntry> = new Map();
  private _bgm: any = null;
  private _muted = false;

  register(name: string, src: string, volume = 1): void {
    this._sounds.set(name, { src, volume });
  }

  play(name: string): void {
    if (this._muted || !_api) return;
    const entry = this._sounds.get(name);
    if (!entry) return;

    const audio = _api.createInnerAudioContext();
    audio.src = entry.src;
    audio.volume = entry.volume;
    audio.onEnded(() => audio.destroy());
    audio.play();
  }

  playBGM(src: string, volume = 0.5): void {
    if (!_api) return;
    this.stopBGM();

    this._bgm = _api.createInnerAudioContext();
    this._bgm.src = src;
    this._bgm.loop = true;
    this._bgm.volume = volume;
    if (!this._muted) this._bgm.play();
  }

  stopBGM(): void {
    if (this._bgm) {
      this._bgm.stop();
      this._bgm.destroy();
      this._bgm = null;
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  set muted(val: boolean) {
    this._muted = val;
    if (this._bgm) {
      val ? this._bgm.pause() : this._bgm.play();
    }
  }
}

export const AudioManager = new AudioManagerClass();
