/**
 * 经分埋点 SDK 接入胶水层（@gp/analytics-sdk）。
 *
 * 设计要点：
 * - SDK 不依赖任何宿主平台 API（wx / tt / fetch），所有平台调用都通过 PlatformService 适配后注入
 * - 上报地址走与 huahua-api 相同的 CloudBase HTTP 访问服务网关（rosa-env-d7grf78r5dbd37323），
 *   不锁 AppID，不需要走 wx.cloud
 * - app_version 由 vite `define` 从 package.json 注入，避免硬编码导致版本无法区分
 *
 * 标准启动顺序（务必照此顺序，详见经分 SDK README「Session 边界」一节）：
 *   initAnalytics()                       // 进游戏一开始
 *   await CloudSyncManager.awaitStartupSync()
 *   setAnalyticsUserId(BackendService.userId)  // 拿到 openid 后，SDK 内部会自动 track LOGIN + flush
 *   analytics.track(SESSION_START, ...)   // 这一步才打 session_start，避免 user_id='' 与登录后 user_id=xxx 双计数
 */

import { Analytics, EVENT_NAMES, type DeviceInfo, type PlatformName } from '@gp/analytics-sdk';

import { BACKEND_BASE_URL, GAME_KEY } from '@/config/CloudConfig';
import { EventBus } from '@/core/EventBus';
import { Platform } from '@/core/PlatformService';
import { TutorialStep, TutorialManager } from '@/managers/TutorialManager';

export { EVENT_NAMES };
export const analytics = Analytics;

/**
 * 与 hot-pot / cai-zhu 共用同一套 CloudBase HTTP 访问服务（多游戏 game_key 区分）。
 * 路径写法是 `<env>.service.tcloudbase.com/<云函数名>/<path>`，不是云函数 HTTP 触发器的 *.app.tcloudbase.com 格式。
 */
const ENDPOINT = `${BACKEND_BASE_URL}/analytics-ingest/track`;

let inited = false;

/** 在 main.ts 启动尽早调用一次。把 PlatformService 当 Adapter 注入给 SDK。 */
export function initAnalytics(opts?: { endpoint?: string; userId?: string; debug?: boolean }): void {
  if (inited) return;

  const platformName = mapPlatform();
  const deviceInfo = buildDeviceInfo();
  const endpoint = opts?.endpoint || ENDPOINT;
  const debug = opts?.debug ?? true;

  // 开发者工具联调：合成事件全量上报，便于原始事件流验证（线上仍走 SDK 默认 10% 采样）
  const samplingRules: Record<string, number> = {
    stamina_change: 0.1,
    ticket_change: 0.1,
    wish_change: 0.1,
  };
  if (Platform.isDevtools) {
    samplingRules.merge_success = 1.0;
  }

  console.log(
    `[analytics] init endpoint=${endpoint}, gameKey=${GAME_KEY}, platform=${platformName}, debug=${debug}, devtools=${Platform.isDevtools}`,
  );

  Analytics.init({
    endpoint,
    gameKey: GAME_KEY,
    appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
    platform: platformName,
    deviceInfo,
    initialUserId: opts?.userId,
    transport: { request: Platform.request.bind(Platform) },
    storage: {
      get: Platform.getStorageSync.bind(Platform),
      set: Platform.setStorageSync.bind(Platform),
      remove: Platform.removeStorageSync.bind(Platform),
    },
    lifecycle: { onHide: Platform.onHide.bind(Platform) },
    samplingRules,
    debug,
  });

  inited = true;

  if (Platform.isDevtools) {
    console.info(
      '[analytics] 开发者工具内 wx.request 可能报 request:fail（域名/网络限制），属经分上报通道，不影响玩法；真机 + 合法域名配置后应正常。',
    );
  }
}

/**
 * 业务登录拿到 openid（CloudBase userId）后调用。
 * SDK 内部会在首次设值时自动 track LOGIN 事件并立即 flush，给后端做 anonymous_id ↔ user_id 归一锚点；
 * 业务**不需要**手工 track LOGIN。
 */
export function setAnalyticsUserId(userId: string): void {
  if (!inited) return;
  console.log(`[analytics] setUserId ${userId ? 'ok' : 'empty'}`);
  Analytics.setUserId(userId || '');
}

function mapPlatform(): PlatformName {
  if (Platform.isWechat) return 'wechat';
  if (Platform.isDouyin) return 'douyin';
  return 'h5';
}

/**
 * 订阅 TutorialManager 的 EventBus 事件，转成经分 tutorial_step 漏斗。
 *
 * step_id 取 enum 名小写（如 'STORY_INTRO' → 'tutorial_story_intro'），与版本无关：
 * 即便后续追加新步骤、enum 值变化，只要枚举名稳定，dashboard 漏斗就不会错位。
 *
 * 这里只关心"步骤完成"，跳过场景由 status 字段区分（当前花花 TutorialManager 没有 skip 行为，
 * 全部是 done；如果未来加跳过功能，再扩展事件即可）。
 */
function buildTutorialStepId(step: TutorialStep): string {
  const enumName = TutorialStep[step] as unknown as string | undefined;
  if (!enumName) return `tutorial_step_${step}`;
  return `tutorial_${enumName.toLowerCase()}`;
}

let tutorialAnalyticsAttached = false;

export function attachTutorialAnalytics(): void {
  if (tutorialAnalyticsAttached) return;
  tutorialAnalyticsAttached = true;

  let lastStepStartedAt = Date.now();
  let lastStep: TutorialStep | null = null;

  EventBus.on('tutorial:stepChanged', (step: TutorialStep) => {
    const now = Date.now();
    // step 首次切换时 lastStep=null，没有"上一步耗时"可上报，跳过这条 done。
    if (lastStep !== null && lastStep !== step) {
      analytics.track(EVENT_NAMES.TUTORIAL_STEP, {
        step_id: buildTutorialStepId(lastStep),
        step_index: Number(lastStep),
        status: 'done',
        duration_ms: Math.max(0, now - lastStepStartedAt),
      });
    }
    lastStep = step;
    lastStepStartedAt = now;
  });

  EventBus.on('tutorial:completed', () => {
    const now = Date.now();
    if (lastStep !== null) {
      analytics.track(EVENT_NAMES.TUTORIAL_STEP, {
        step_id: buildTutorialStepId(lastStep),
        step_index: Number(lastStep),
        status: 'done',
        duration_ms: Math.max(0, now - lastStepStartedAt),
      });
    }
    analytics.track(EVENT_NAMES.TUTORIAL_STEP, {
      step_id: 'tutorial_completed',
      step_index: Number(TutorialStep.COMPLETED),
      status: 'done',
      duration_ms: 0,
    });
    lastStep = null;
  });
}

/**
 * 启动期一次性 attach 教程进度埋点。如果用户启动游戏时教程已完成，TutorialManager.start() 会
 * 直接置 _step=COMPLETED 不再 emit stepChanged，这种情况自然就不会上报，符合预期。
 */
export function setupTutorialAnalytics(): void {
  // 只 attach 一次，但 main.ts 可能在多次冷启动里都调，attached flag 保护即可。
  // 引入 TutorialManager 是为了保证它被早期 import / 完成模块初始化（避免循环引用）。
  void TutorialManager;
  attachTutorialAnalytics();
}

/**
 * 玩法事件 attach：订阅业务 EventBus 事件，转发到经分 analytics.track。
 *
 * 设计原则：
 * - 全部走 EventBus 订阅，业务代码（Manager / View）零改动；唯一例外是 FlowerSignGachaManager
 *   抽奖事件——它没 emit EventBus，需要在 Manager 内部直接 track（见 FlowerSignGachaManager.ts）
 * - 每条 track 都做防御式取字段，emit 端 payload 缺字段时不抛错（EventBus 不强类型）
 * - 字段名遵循 SDK SOP：snake_case，扁平 key/value，避免嵌套
 * - 高频事件（merge_success）已在 SDK init 时降到 10% 采样
 */
let gameplayAnalyticsAttached = false;

export function attachGameplayAnalytics(): void {
  if (gameplayAnalyticsAttached) return;
  gameplayAnalyticsAttached = true;

  // ============== 合成 ==============
  EventBus.on(
    'board:merged',
    (
      srcIndex: number,
      dstIndex: number,
      resultId: string,
      resultCellIndex: number,
      isPeekMerge: boolean,
    ) => {
      analytics.track(EVENT_NAMES.MERGE_SUCCESS, {
        result_id: String(resultId || ''),
        src_cell: Number(srcIndex) || 0,
        dst_cell: Number(dstIndex) || 0,
        result_cell: Number(resultCellIndex) || 0,
        is_peek_merge: !!isPeekMerge,
      });
    },
  );

  // ============== 订单 ==============
  // 订单生命周期 4 件套：spawn → deliver / expire / ditch
  // tier 字段是订单档位字符串（如 "T1"/"T2"/"timed"），后端按它分组就能看各档转化
  EventBus.on('customer:arrived', (customer: any) => {
    analytics.track(EVENT_NAMES.ORDER_SPAWN, {
      tier: String(customer?.tier ?? ''),
      order_type: String(customer?.orderType ?? ''),
      order_kind: String(customer?.orderKind ?? ''),
      slot_count: Number(customer?.slots?.length ?? 0),
      huayuan_reward: Number(customer?.huayuanReward ?? 0),
      customer_type_id: String(customer?.typeId ?? ''),
      has_diamond_reward: Number(customer?.diamondReward ?? 0) > 0,
    });
  });

  EventBus.on('customer:delivered', (_uid: number, customer: any) => {
    analytics.track(EVENT_NAMES.ORDER_DELIVER, {
      tier: String(customer?.tier ?? ''),
      order_type: String(customer?.orderType ?? ''),
      order_kind: String(customer?.orderKind ?? ''),
      slot_count: Number(customer?.slots?.length ?? 0),
      huayuan_reward: Number(customer?.huayuanReward ?? 0),
      diamond_reward: Number(customer?.diamondReward ?? 0),
      customer_type_id: String(customer?.typeId ?? ''),
    });
  });

  EventBus.on('customer:expired', (_uid: number, customer: any) => {
    analytics.track(EVENT_NAMES.ORDER_EXPIRE, {
      tier: String(customer?.tier ?? ''),
      order_type: String(customer?.orderType ?? ''),
      slot_count: Number(customer?.slots?.length ?? 0),
      customer_type_id: String(customer?.typeId ?? ''),
    });
  });

  EventBus.on('customer:ditched', (_uid: number, customer: any) => {
    analytics.track(EVENT_NAMES.ORDER_DITCH, {
      tier: String(customer?.tier ?? ''),
      order_type: String(customer?.orderType ?? ''),
      slot_count: Number(customer?.slots?.length ?? 0),
      customer_type_id: String(customer?.typeId ?? ''),
    });
  });

  // ============== 经济流转 ==============
  // 装饰购买：DecorationManager.unlock() 已 emit decoration:unlocked，payload 含 cost/starValue。
  // 不在 currency:changed 上做"通用 currency_change"，因为该事件没 reason 字段；
  // 改为按 reason 拆成专用事件（decoration_purchase / dressup_unlock / order_deliver / idle_reward_claim ...），
  // 后端聚合时按 event_name 分组就能拆出花愿入账/出账渠道。
  EventBus.on('decoration:unlocked', (decoId: string, deco: any) => {
    analytics.track(EVENT_NAMES.DECORATION_PURCHASE, {
      purchase_kind: 'deco',
      deco_id: String(decoId ?? ''),
      huayuan_cost: Number(deco?.cost ?? 0),
      star_value: Number(deco?.starValue ?? 0),
    });
  });

  EventBus.on('decoration:roomStyleUnlocked', (styleId: string, style?: any) => {
    analytics.track(EVENT_NAMES.DECORATION_PURCHASE, {
      purchase_kind: 'room_style',
      style_id: String(styleId ?? ''),
      huayuan_cost: Number(style?.cost ?? 0),
      star_value: Number(style?.starValue ?? 0),
    });
  });

  EventBus.on('dressup:unlocked', (outfitId: string, def?: any) => {
    analytics.track(EVENT_NAMES.DRESSUP_UNLOCK, {
      outfit_id: String(outfitId ?? ''),
      huayuan_cost: Number(def?.huayuanCost ?? 0),
    });
  });

  EventBus.on('star:levelUp', (newLevel: number, oldLevel: number) => {
    analytics.track(EVENT_NAMES.STAR_LEVEL_UP, {
      new_level: Number(newLevel) || 0,
      old_level: Number(oldLevel) || 0,
    });
  });

  EventBus.on('idle:claimed', (reward: any) => {
    analytics.track(EVENT_NAMES.IDLE_REWARD_CLAIM, {
      huayuan: Number(reward?.huayuan ?? 0),
      diamond: Number(reward?.diamond ?? 0),
      stamina: Number(reward?.stamina ?? 0),
      flower_sign_tickets: Number(reward?.flowerSignTickets ?? 0),
      has_reward_box_item: !!reward?.rewardBoxItem,
    });
  });

  EventBus.on('stamina:bought', (amount: number, price: number, count: number) => {
    analytics.track(EVENT_NAMES.STAMINA_BUY, {
      stamina_amount: Number(amount) || 0,
      diamond_cost: Number(price) || 0,
      daily_count: Number(count) || 0,
    });
  });

  EventBus.on('stamina:adRecovered', (amount: number, count: number) => {
    analytics.track(EVENT_NAMES.STAMINA_AD_RECOVER, {
      stamina_amount: Number(amount) || 0,
      daily_count: Number(count) || 0,
    });
  });

  // ============== 留存玩法 ==============
  EventBus.on('quest:claimed', (templateId: string) => {
    analytics.track(EVENT_NAMES.DAILY_QUEST_CLAIM, {
      template_id: String(templateId ?? ''),
    });
  });

  EventBus.on('quest:weeklyMilestoneClaimed', (milestoneId: string) => {
    analytics.track(EVENT_NAMES.WEEKLY_MILESTONE_CLAIM, {
      milestone_id: String(milestoneId ?? ''),
    });
  });

  EventBus.on('checkin:signed', (reward: any, streakBonus: number) => {
    analytics.track(EVENT_NAMES.CHECKIN_SIGN, {
      huayuan: Number(reward?.huayuan ?? 0),
      diamond: Number(reward?.diamond ?? 0),
      stamina: Number(reward?.stamina ?? 0),
      streak_bonus_diamond: Number(streakBonus) || 0,
    });
  });

  EventBus.on('affinityCard:dropped', (typeId: string, results: any[]) => {
    const cards = Array.isArray(results) ? results : [];
    const dupCount = cards.filter((r) => r?.isDuplicate).length;
    analytics.track(EVENT_NAMES.AFFINITY_CARD_DROP, {
      customer_type_id: String(typeId ?? ''),
      card_count: cards.length,
      duplicate_count: dupCount,
      first_card_id: String(cards[0]?.card?.id ?? ''),
    });
  });

  EventBus.on('collection:discovered', (category: string, itemId: string) => {
    analytics.track(EVENT_NAMES.COLLECTION_DISCOVER, {
      category: String(category ?? ''),
      item_id: String(itemId ?? ''),
    });
  });

  EventBus.on('merchShop:purchased', (shelfIndex: number, slot: any, viaAd: boolean) => {
    analytics.track(EVENT_NAMES.MERCH_SHOP_PURCHASE, {
      shelf_index: Number(shelfIndex) || 0,
      item_id: String(slot?.itemId ?? ''),
      price_type: String(slot?.priceType ?? ''),
      price_amount: Number(slot?.priceAmount ?? 0),
      via_ad: !!viaAd,
    });
  });

  EventBus.on('popupShop:purchased', (shopId: string, item: any) => {
    analytics.track(EVENT_NAMES.POPUP_SHOP_PURCHASE, {
      shop_id: String(shopId ?? ''),
      item_id: String(item?.id ?? ''),
      item_type: String(item?.type ?? ''),
      cost_huayuan: Number(item?.costHuayuan ?? 0),
      cost_diamond: Number(item?.costDiamond ?? 0),
      grant_amount: Number(item?.amount ?? 0),
      grant_item_id: String(item?.itemId ?? ''),
    });
  });

  EventBus.on('newbieGiftPack:claimed', () => {
    analytics.track(EVENT_NAMES.NEWBIE_GIFT_CLAIM, {
      pack_id: 'qinglian_newbie_gift',
    });
  });
}

/**
 * 启动期 attach 玩法埋点。EventBus 监听器是单游戏生命周期内有效的（页面/小游戏关闭就清空），
 * 与 setupTutorialAnalytics 一样靠 attached flag 防止重复注册。
 */
export function setupGameplayAnalytics(): void {
  attachGameplayAnalytics();
}

function buildDeviceInfo(): DeviceInfo {
  const sys = Platform.getSystemInfoSync() || {};
  return {
    brand: String(sys.brand || sys.deviceBrand || ''),
    model: String(sys.model || sys.deviceModel || ''),
    system: String(sys.system || sys.platform || ''),
    sdkVersion: String(sys.SDKVersion || sys.sdkVersion || ''),
    screenWidth: Number(sys.screenWidth) || 0,
    screenHeight: Number(sys.screenHeight) || 0,
    network: 'unknown',
  };
}
