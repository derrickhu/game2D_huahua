import { USER_SETTINGS_KEY } from '@/config/CloudConfig';
import { AudioManager } from '@/core/AudioManager';
import { PersistService } from '@/core/PersistService';

export interface GameSettingsState {
  musicEnabled: boolean;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: GameSettingsState = {
  musicEnabled: true,
  soundEnabled: true,
};

class SettingsManagerClass {
  private _state: GameSettingsState = { ...DEFAULT_SETTINGS };
  private _loaded = false;

  init(): void {
    if (this._loaded) return;
    this._loaded = true;
    const saved = PersistService.readJSON<Partial<GameSettingsState>>(USER_SETTINGS_KEY);
    this._state = {
      musicEnabled: typeof saved?.musicEnabled === 'boolean' ? saved.musicEnabled : DEFAULT_SETTINGS.musicEnabled,
      soundEnabled: typeof saved?.soundEnabled === 'boolean' ? saved.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    };
    this.applyAudioPrefs();
  }

  get state(): GameSettingsState {
    this.init();
    return { ...this._state };
  }

  get musicEnabled(): boolean {
    this.init();
    return this._state.musicEnabled;
  }

  get soundEnabled(): boolean {
    this.init();
    return this._state.soundEnabled;
  }

  setMusicEnabled(enabled: boolean): void {
    this.init();
    if (this._state.musicEnabled === enabled) return;
    this._state.musicEnabled = enabled;
    this._save();
    this.applyAudioPrefs();
  }

  setSoundEnabled(enabled: boolean): void {
    this.init();
    if (this._state.soundEnabled === enabled) return;
    this._state.soundEnabled = enabled;
    this._save();
    this.applyAudioPrefs();
  }

  applyAudioPrefs(): void {
    AudioManager.setMusicMuted(!this._state.musicEnabled);
    AudioManager.setSoundMuted(!this._state.soundEnabled);
  }

  private _save(): void {
    PersistService.writeJSON(USER_SETTINGS_KEY, this._state);
  }
}

export const SettingsManager = new SettingsManagerClass();
