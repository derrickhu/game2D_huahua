import { Analytics, EVENT_NAMES, type EventParamValue } from '@gp/analytics-sdk';

import { GAME_KEY } from '@/config/CloudConfig';
import { Platform } from '@/core/PlatformService';

interface LaunchTouchpoint {
  touch_id: string;
  touch_ts: number;
  source: 'launch' | 'show' | 'manual';
  platform: string;
  launch_scene: string;
  query: Record<string, string>;
  query_keys: string[];
  referrer_app_id: string;
  referrer_info_json: string;
  provider: string;
  channel: string;
  campaign_id: string;
  adgroup_id: string;
  creative_id: string;
  click_id: string;
  gdt_vid: string;
  match_source: string;
}

interface StoredAttribution {
  first?: LaunchTouchpoint;
  latest?: LaunchTouchpoint;
  resolved_user_id?: string;
  updated_at: number;
}

const STORAGE_KEY = `${GAME_KEY}_attribution_v1`;
const MAX_RAW_JSON_LEN = 1200;

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

function truncate(value: string, max = MAX_RAW_JSON_LEN): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function readString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeQuery(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) continue;
    out[normalizedKey] = readString(value);
  }
  return out;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = readString(value);
    if (text) return text;
  }
  return '';
}

function randomTouchId(): string {
  return `attr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function inferProvider(query: Record<string, string>, referrerAppId: string): string {
  const source = firstNonEmpty(query.utm_source, query.source, query.channel);
  if (source) return source;
  if (query.gdt_vid || query.click_id || query.clickid || query.cb || query.weixinadinfo) return 'tencent_ads';
  if (query.invite || query.visit || query.gift) return 'share';
  if (referrerAppId) return 'referrer_app';
  return 'unknown';
}

function inferMatchSource(query: Record<string, string>): string {
  if (query.gdt_vid) return 'gdt_vid';
  if (query.click_id || query.clickid) return 'click_id';
  if (query.cb) return 'cb';
  if (query.weixinadinfo) return 'weixinadinfo';
  if (query.campaign_id || query.adgroup_id || query.creative_id) return 'campaign_params';
  if (query.utm_campaign || query.utm_content) return 'utm';
  return 'none';
}

function toCommonParams(touch?: LaunchTouchpoint): Record<string, EventParamValue> {
  if (!touch) return {};
  return {
    attr_provider: touch.provider,
    attr_channel: touch.channel,
    attr_campaign_id: touch.campaign_id,
    attr_adgroup_id: touch.adgroup_id,
    attr_creative_id: touch.creative_id,
    attr_click_id: touch.click_id,
    attr_gdt_vid: touch.gdt_vid,
    attr_launch_scene: touch.launch_scene,
    attr_match_source: touch.match_source,
  };
}

class AttributionManagerClass {
  private inited = false;
  private store: StoredAttribution = { updated_at: 0 };

  init(): void {
    if (this.inited) return;
    this.inited = true;
    this.store = this.readStore();

    const launchOptions = Platform.getLaunchOptionsSync?.() || Platform.getEnterOptionsSync?.();
    this.captureOptions('launch', launchOptions);
    Platform.onShow((options) => this.captureOptions('show', options));
    this.applyCommonParams();
  }

  sessionParams(): Record<string, EventParamValue> {
    const first = this.store.first;
    const latest = this.store.latest;
    return {
      attribution_first_provider: first?.provider || 'unknown',
      attribution_first_match_source: first?.match_source || 'none',
      attribution_first_launch_scene: first?.launch_scene || '',
      attribution_latest_provider: latest?.provider || 'unknown',
      attribution_latest_match_source: latest?.match_source || 'none',
      attribution_latest_launch_scene: latest?.launch_scene || '',
      attribution_has_click_id: !!(latest?.click_id || latest?.gdt_vid),
    };
  }

  bindUser(userId: string): void {
    const normalized = readString(userId);
    if (!normalized || this.store.resolved_user_id === normalized) return;
    this.store.resolved_user_id = normalized;
    this.persist();
    const first = this.store.first;
    Analytics.track(EVENT_NAMES.ATTRIBUTION_RESOLVED, {
      resolved_user_id: normalized,
      provider: first?.provider || 'unknown',
      channel: first?.channel || '',
      campaign_id: first?.campaign_id || '',
      adgroup_id: first?.adgroup_id || '',
      creative_id: first?.creative_id || '',
      click_id_present: !!(first?.click_id || first?.gdt_vid),
      match_source: first?.match_source || 'none',
      rule: 'client_first_touch',
    });
  }

  private captureOptions(source: LaunchTouchpoint['source'], options: unknown): void {
    const touch = this.buildTouchpoint(source, options);
    if (!touch) return;

    const hasUsefulSignal =
      touch.provider !== 'unknown' ||
      touch.launch_scene ||
      touch.query_keys.length > 0 ||
      touch.referrer_app_id;

    if (!hasUsefulSignal) return;

    if (!this.store.first) {
      this.store.first = touch;
    }
    this.store.latest = touch;
    this.persist();
    this.applyCommonParams();
    this.trackTouchpoint(touch, !this.store.first || this.store.first.touch_id === touch.touch_id);
  }

  private buildTouchpoint(source: LaunchTouchpoint['source'], options: unknown): LaunchTouchpoint | null {
    if (!options || typeof options !== 'object') {
      return null;
    }
    const record = options as Record<string, unknown>;
    const query = normalizeQuery(record.query);
    const referrerInfo = record.referrerInfo && typeof record.referrerInfo === 'object'
      ? record.referrerInfo as Record<string, unknown>
      : {};
    const extraData = referrerInfo.extraData && typeof referrerInfo.extraData === 'object'
      ? referrerInfo.extraData as Record<string, unknown>
      : {};
    const mergedQuery = {
      ...normalizeQuery(extraData),
      ...query,
    };
    const referrerAppId = readString(referrerInfo.appId);
    const provider = inferProvider(mergedQuery, referrerAppId);
    const matchSource = inferMatchSource(mergedQuery);
    const clickId = firstNonEmpty(
      mergedQuery.click_id,
      mergedQuery.clickid,
      mergedQuery.clickId,
      mergedQuery.cb,
      mergedQuery.callback,
    );

    return {
      touch_id: randomTouchId(),
      touch_ts: Date.now(),
      source,
      platform: Platform.name,
      launch_scene: readString(record.scene),
      query: mergedQuery,
      query_keys: Object.keys(mergedQuery).sort(),
      referrer_app_id: referrerAppId,
      referrer_info_json: truncate(safeJson(referrerInfo)),
      provider,
      channel: firstNonEmpty(mergedQuery.channel, mergedQuery.utm_source, provider),
      campaign_id: firstNonEmpty(mergedQuery.campaign_id, mergedQuery.campaign, mergedQuery.utm_campaign),
      adgroup_id: firstNonEmpty(mergedQuery.adgroup_id, mergedQuery.ad_group_id, mergedQuery.adset_id),
      creative_id: firstNonEmpty(mergedQuery.creative_id, mergedQuery.ad_id, mergedQuery.utm_content),
      click_id: clickId,
      gdt_vid: firstNonEmpty(mergedQuery.gdt_vid, mergedQuery.qz_gdt),
      match_source: matchSource,
    };
  }

  private trackTouchpoint(touch: LaunchTouchpoint, isFirstTouch: boolean): void {
    Analytics.track(EVENT_NAMES.ATTRIBUTION_TOUCHPOINT, {
      touch_id: touch.touch_id,
      touch_source: touch.source,
      is_first_touch: isFirstTouch,
      provider: touch.provider,
      channel: touch.channel,
      campaign_id: touch.campaign_id,
      adgroup_id: touch.adgroup_id,
      creative_id: touch.creative_id,
      click_id: touch.click_id,
      gdt_vid: touch.gdt_vid,
      match_source: touch.match_source,
      launch_scene: touch.launch_scene,
      query_keys: touch.query_keys.join(','),
      launch_query_json: truncate(safeJson(touch.query)),
      referrer_app_id: touch.referrer_app_id,
      referrer_info_json: touch.referrer_info_json,
    });
  }

  private applyCommonParams(): void {
    Analytics.setCommonParams(toCommonParams(this.store.first || this.store.latest));
  }

  private readStore(): StoredAttribution {
    const raw = Platform.getStorageSync(STORAGE_KEY);
    if (!raw) return { updated_at: 0 };
    try {
      const parsed = JSON.parse(raw) as StoredAttribution;
      return parsed && typeof parsed === 'object' ? parsed : { updated_at: 0 };
    } catch {
      return { updated_at: 0 };
    }
  }

  private persist(): void {
    this.store.updated_at = Date.now();
    Platform.setStorageAsync(STORAGE_KEY, safeJson(this.store));
  }
}

export const AttributionManager = new AttributionManagerClass();
