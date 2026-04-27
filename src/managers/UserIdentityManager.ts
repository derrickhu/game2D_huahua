import { USER_IDENTITY_KEY } from '@/config/CloudConfig';
import { BackendService } from '@/core/BackendService';
import { PersistService } from '@/core/PersistService';
import { Platform } from '@/core/PlatformService';
import { CloudSyncManager } from '@/managers/CloudSyncManager';

export interface UserIdentityState {
  id: string;
  createdAt: number;
  platform: string;
  backendUserId?: string;
  lastRegisteredAt?: number;
}

class UserIdentityManagerClass {
  private _state: UserIdentityState | null = null;
  private _registering: Promise<void> | null = null;

  init(): UserIdentityState {
    if (this._state) return this._state;

    const saved = PersistService.readJSON<Partial<UserIdentityState>>(USER_IDENTITY_KEY);
    if (saved?.id && typeof saved.id === 'string') {
      this._state = {
        id: saved.id,
        createdAt: typeof saved.createdAt === 'number' ? saved.createdAt : Date.now(),
        platform: typeof saved.platform === 'string' && saved.platform ? saved.platform : Platform.name,
        backendUserId: typeof saved.backendUserId === 'string' ? saved.backendUserId : undefined,
        lastRegisteredAt: typeof saved.lastRegisteredAt === 'number' ? saved.lastRegisteredAt : undefined,
      };
    } else {
      this._state = {
        id: this._generateDisplayId(),
        createdAt: Date.now(),
        platform: Platform.name,
      };
      this._save();
    }

    void this.registerToBackend();
    return this._state;
  }

  get id(): string {
    return this.init().id;
  }

  get state(): UserIdentityState {
    return { ...this.init() };
  }

  async registerToBackend(): Promise<void> {
    this.init();
    if (this._registering) return this._registering;

    this._registering = (async () => {
      try {
        const token = await BackendService.ensureToken();
        if (!this._state) return;
        const backendUserId = token.userId || BackendService.userId || '';
        const next: UserIdentityState = {
          ...this._state,
          platform: token.platform || this._state.platform,
          backendUserId: backendUserId || this._state.backendUserId,
          lastRegisteredAt: Date.now(),
        };
        this._state = next;
        this._save();
        void CloudSyncManager.flushNow('user-identity-register');
      } catch (e) {
        console.warn('[UserIdentity] 后端登记失败，保留本地 ID:', e);
      } finally {
        this._registering = null;
      }
    })();

    return this._registering;
  }

  private _save(): void {
    if (!this._state) return;
    PersistService.writeJSON(USER_IDENTITY_KEY, this._state);
  }

  private _generateDisplayId(): string {
    const time = Date.now().toString(36).toUpperCase();
    const rand = this._randomBase36(6).toUpperCase();
    return `HH-${time}-${rand}`;
  }

  private _randomBase36(length: number): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const bytes = new Uint8Array(length);
    const cryptoObj = (globalThis as any).crypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      cryptoObj.getRandomValues(bytes);
    } else {
      for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    let out = '';
    for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
    return out;
  }
}

export const UserIdentityManager = new UserIdentityManagerClass();
