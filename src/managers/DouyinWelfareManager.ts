/**
 * 抖音福利状态管理（侧边栏每日奖励 + 添加桌面一次性奖励）
 *
 * 独立 storage key，不并入主存档：这两项是平台行为记录，只对抖音端有意义，
 * 微信端永远读不到（key 本身也被 PlatformService 隔离到 huahua_tt_ 命名空间）。
 */
import { PersistService } from '@/core/PersistService';
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { SidebarService, localDateKey } from '@/core/SidebarService';
import { DesktopShortcutService } from '@/core/DesktopShortcutService';
import { CurrencyManager } from './CurrencyManager';
import { SaveManager } from './SaveManager';
import { DOUYIN_WELFARE, DOUYIN_WELFARE_STORAGE_KEY } from '@/config/DouyinWelfareConfig';

interface DouyinWelfareState {
  /** 上次领取侧边栏奖励的日期 YYYY-MM-DD */
  sidebarRewardDate: string;
  /** 是否已领过添加桌面奖励 */
  desktopRewardClaimed: boolean;
}

class DouyinWelfareManagerClass {
  private _state: DouyinWelfareState = {
    sidebarRewardDate: '',
    desktopRewardClaimed: false,
  };

  init(): void {
    if (!Platform.isDouyin) return;
    const raw = PersistService.readJSON<Partial<DouyinWelfareState>>(DOUYIN_WELFARE_STORAGE_KEY);
    this._state.sidebarRewardDate = typeof raw?.sidebarRewardDate === 'string' ? raw.sidebarRewardDate : '';
    this._state.desktopRewardClaimed = raw?.desktopRewardClaimed === true;
  }

  /** 抖音 + 宿主支持侧边栏时才展示入口 */
  get sidebarAvailable(): boolean {
    return SidebarService.isAvailable;
  }

  get desktopAvailable(): boolean {
    return DesktopShortcutService.isAvailable;
  }

  /** 是否有任一福利可展示（决定主界面入口是否出现） */
  get hasAnyEntry(): boolean {
    return this.sidebarAvailable || this.desktopAvailable;
  }

  get sidebarClaimedToday(): boolean {
    return this._state.sidebarRewardDate === localDateKey();
  }

  get desktopRewardClaimed(): boolean {
    return this._state.desktopRewardClaimed;
  }

  /** 有未领奖励 → 主界面入口打红点 */
  get hasRedDot(): boolean {
    if (this.sidebarAvailable && SidebarService.isFromSidebar() && !this.sidebarClaimedToday) return true;
    if (this.desktopAvailable && !this._state.desktopRewardClaimed && !DesktopShortcutService.alreadyAdded) return true;
    return false;
  }

  /**
   * 领取侧边栏复访奖励。必须是「本次确实从侧边栏卡片进入」且今日未领。
   * @returns 领取成功才返回 true
   */
  claimSidebarReward(): boolean {
    if (!this.sidebarAvailable) return false;
    if (!SidebarService.isFromSidebar()) return false;
    if (this.sidebarClaimedToday) return false;

    CurrencyManager.addDiamond(DOUYIN_WELFARE.sidebar.diamond);
    CurrencyManager.addStamina(DOUYIN_WELFARE.sidebar.stamina);
    this._state.sidebarRewardDate = localDateKey();
    this._save();
    SaveManager.save();
    EventBus.emit('douyinWelfare:changed');
    return true;
  }

  /** 添加桌面成功后发一次性奖励 */
  claimDesktopReward(): boolean {
    if (this._state.desktopRewardClaimed) return false;

    CurrencyManager.addDiamond(DOUYIN_WELFARE.desktop.diamond);
    this._state.desktopRewardClaimed = true;
    this._save();
    SaveManager.save();
    EventBus.emit('douyinWelfare:changed');
    return true;
  }

  private _save(): void {
    PersistService.writeJSON(DOUYIN_WELFARE_STORAGE_KEY, this._state);
  }
}

export const DouyinWelfareManager = new DouyinWelfareManagerClass();
