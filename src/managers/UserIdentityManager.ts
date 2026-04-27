import { BackendService } from '@/core/BackendService';

export interface UserIdentityState {
  id: string;
  platform: string;
  loading: boolean;
  error?: string;
}

class UserIdentityManagerClass {
  private _state: UserIdentityState = {
    id: '',
    platform: '',
    loading: false,
  };
  private _loadingPromise: Promise<void> | null = null;

  init(): UserIdentityState {
    this._syncFromBackendCache();
    return { ...this._state };
  }

  get id(): string {
    return this.init().id;
  }

  get state(): UserIdentityState {
    return { ...this.init() };
  }

  async refreshFromBackend(): Promise<void> {
    if (this._loadingPromise) return this._loadingPromise;

    this._state = { ...this._state, loading: true, error: undefined };
    this._loadingPromise = (async () => {
      try {
        const token = await BackendService.ensureToken();
        this._state = {
          id: token.userId || BackendService.userId || '',
          platform: token.platform || BackendService.platform || '',
          loading: false,
        };
      } catch (e) {
        console.warn('[UserIdentity] 获取后端 userId 失败:', e);
        this._state = {
          ...this._state,
          loading: false,
          error: 'FETCH_FAILED',
        };
      } finally {
        this._loadingPromise = null;
      }
    })();

    return this._loadingPromise;
  }

  private _syncFromBackendCache(): void {
    const cachedId = BackendService.userId;
    if (cachedId) {
      this._state = {
        id: cachedId,
        platform: BackendService.platform,
        loading: false,
      };
    }
  }
}

export const UserIdentityManager = new UserIdentityManagerClass();
