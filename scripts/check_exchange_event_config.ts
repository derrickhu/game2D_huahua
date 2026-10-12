/**
 * 兑换活动主题自检（`npm run check:exchange-event`）。
 *
 * 开新一期改完主题文件后跑一次：商品/分类/家具/图纸 id 是否都登记了，当期素材是否都在包里，
 * 已归档素材是否确实不在包里，每档获取规则的长度是否和产线等级数一致。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ITEM_DEFS, Category } from '../src/config/ItemConfig';
import { DECO_MAP } from '../src/config/DecorationConfig';
import { WORKSHOP_BLUEPRINT_MAP as BLUEPRINT_MAP } from '../src/config/FurnitureWorkshopConfig';
import {
  ACTIVE_EXCHANGE_SEASON_ID,
  EXCHANGE_ART_BY_SEASON,
} from '../src/config/events/exchange/ExchangeEventArtRegistry';
import {
  ACTIVE_EXCHANGE_THEME,
  PAST_EXCHANGE_THEMES,
  findPastExchangeTheme,
} from '../src/config/events/exchange/ExchangeEventRegistry';
import { SEASONAL_ITEM_LINES } from '../src/config/events/SeasonalItemRegistry';
import { CUSTOMER_TYPE_MAP } from '../src/config/CustomerConfig';
import { OUTFIT_MAP } from '../src/config/DressUpConfig';
import { resolveOrderProduct } from '../src/config/OrderProductConfig';
import {
  ACTIVE_WHEEL_SEASON_ID,
  WHEEL_ART_BY_SEASON,
  WHEEL_ASSETS_IN_PACKAGE,
} from '../src/config/events/wheel/WheelEventArtRegistry';
import {
  ACTIVE_WHEEL_THEME,
  PAST_WHEEL_THEMES,
  findPastWheelTheme,
} from '../src/config/events/wheel/WheelEventRegistry';

const root = process.cwd();
const minigame = join(root, 'minigame');
const theme = ACTIVE_EXCHANGE_THEME;

assert.equal(theme.seasonId, ACTIVE_EXCHANGE_SEASON_ID, 'ACTIVE 主题与 ACTIVE_EXCHANGE_SEASON_ID 不一致');
assert.equal(theme.art, EXCHANGE_ART_BY_SEASON[theme.seasonId], '主题 art 必须引用 *.art.ts 里的同一对象');
assert.ok(theme.startAt < theme.endAt, '活动开始时间必须早于结束时间');
assert.ok(theme.settleToHuayuanRate > 0, '结算汇率必须大于 0');

const seasonIds = [theme.seasonId, ...PAST_EXCHANGE_THEMES.map(t => t.seasonId)];
assert.equal(new Set(seasonIds).size, seasonIds.length, 'seasonId 重复');
assert.equal(findPastExchangeTheme(theme.seasonId), null, '当期不能同时出现在已下线列表里');

const categoryIds = new Set(theme.categories.map(c => c.id));
assert.equal(categoryIds.size, theme.categories.length, '分类 id 重复');
const productIds = new Set<string>();
for (const product of theme.products) {
  assert.ok(!productIds.has(product.id), `商品 id 重复：${product.id}`);
  productIds.add(product.id);
  assert.ok(categoryIds.has(product.categoryId), `商品 ${product.id} 的分类 ${product.categoryId} 未登记`);
  assert.ok(product.cost > 0 && product.stock > 0, `商品 ${product.id} 价格/库存必须大于 0`);
  const grant = product.grant;
  if (grant.kind === 'deco') {
    const deco = DECO_MAP.get(grant.decoId);
    assert.ok(deco, `商品 ${product.id} 的家具 ${grant.decoId} 未登记到 DecorationConfig`);
    assert.equal(deco!.starValue, 0, `活动家具 ${grant.decoId} starValue 必须为 0`);
  }
  if (grant.kind === 'blueprint') {
    assert.ok(BLUEPRINT_MAP.has(grant.blueprintId), `商品 ${product.id} 的图纸 ${grant.blueprintId} 未登记`);
  }
}
for (const category of theme.categories) {
  assert.ok(theme.products.some(p => p.categoryId === category.id), `分类 ${category.id} 没有商品`);
}

const ruleIds = new Set(theme.earnRules.map(r => r.id));
for (const id of theme.mixedRuleIds) assert.ok(ruleIds.has(id), `mixedRuleIds 引用了不存在的规则 ${id}`);
for (const rule of theme.earnRules) {
  if (rule.tier !== 'byLevel') continue;
  const maxLevel = Math.max(
    ...[...ITEM_DEFS.values()]
      .filter(def => def.category === rule.category && (!rule.line || def.line === rule.line))
      .map(def => def.level),
  );
  assert.equal(rule.rewards.length, maxLevel, `规则 ${rule.id} 奖励档数应等于产线等级数 ${maxLevel}`);
}
assert.ok(theme.earnRules.some(r => r.category === Category.DRINK || r.category === Category.FOOD), '至少要有一条订单获取规则');

const art = theme.art;
const allArt = { ...art.mainImages, ...art.eventImages };
for (const key of [art.entryIconKey, art.currencyIconKey, art.panelShellKey]) {
  assert.ok(allArt[key], `art key ${key} 没有在 mainImages/eventImages 里登记路径`);
}
for (const [key, rel] of Object.entries(allArt)) {
  assert.ok(existsSync(join(minigame, rel)), `当期素材缺文件：${key} -> minigame/${rel}`);
}

for (const past of PAST_EXCHANGE_THEMES) {
  const manifest = join(root, 'docs/events/archive', `${past.seasonId}.json`);
  if (!existsSync(manifest)) continue;
  const { files } = JSON.parse(readFileSync(manifest, 'utf8')) as { files: string[] };
  for (const rel of files) {
    if (rel.endsWith('/**')) continue;
    assert.ok(!existsSync(join(minigame, rel)), `已归档素材仍在包内：minigame/${rel}`);
  }
}

const SEASONAL_SURFACES = new Set(['produce', 'orders', 'shop', 'gacha', 'collection', 'bubbles']);
const seasonalKeys = new Set<string>();
for (const line of SEASONAL_ITEM_LINES) {
  const key = `${line.category}:${line.line}`;
  assert.ok(!seasonalKeys.has(key), `活动物品线重复：${key}`);
  seasonalKeys.add(key);
  assert.ok(line.startAt < line.endAt, `${line.seasonId} ${key} 开始时间必须早于结束时间`);
  assert.ok(line.eventName.length > 0, `${key} 缺少活动名`);
  assert.ok(line.surfaces.length > 0, `${key} 至少要开放一个入口`);
  for (const surface of line.surfaces) {
    assert.ok(SEASONAL_SURFACES.has(surface), `${key} 未知入口 ${surface}`);
  }
  const items = [...ITEM_DEFS.values()].filter(
    def => def.category === line.category && def.line === line.line,
  );
  assert.ok(items.length > 0, `活动物品线 ${key} 在 ITEM_DEFS 里没有物品`);
}

const wheel = ACTIVE_WHEEL_THEME;
assert.equal(wheel.seasonId, ACTIVE_WHEEL_SEASON_ID, 'ACTIVE 转盘主题与 ACTIVE_WHEEL_SEASON_ID 不一致');
assert.equal(wheel.art, WHEEL_ART_BY_SEASON[wheel.seasonId], '转盘主题 art 必须引用 *.art.ts 里的同一对象');
assert.ok(wheel.startAt < wheel.endAt, '转盘开始时间必须早于结束时间');
assert.ok(wheel.settleToHuayuanRate > 0, '转盘结算汇率必须大于 0');
assert.equal(findPastWheelTheme(wheel.seasonId), null, '当期转盘不能同时出现在已下线列表里');
assert.equal(wheel.spinCosts.length, wheel.rounds.length, 'spinCosts 必须和轮次数一样长');
const sliceCount = wheel.rounds[0]?.length ?? 0;
assert.ok(sliceCount > 0, '转盘至少要有一轮奖品');
const prizeIds = new Set<string>();
for (const round of wheel.rounds) {
  assert.equal(round.length, sliceCount, '每一轮的格子数必须相同');
  for (const prize of round) {
    assert.ok(!prizeIds.has(prize.id), `转盘奖品 id 重复：${prize.id}`);
    prizeIds.add(prize.id);
    assert.ok(prize.weight > 0, `奖品 ${prize.id} 权重必须大于 0`);
    const grant = prize.grant;
    if (grant.kind === 'deco') {
      const deco = DECO_MAP.get(grant.decoId);
      assert.ok(deco, `奖品 ${prize.id} 的家具 ${grant.decoId} 未登记`);
      assert.equal(deco!.starValue, 0, `活动家具 ${grant.decoId} starValue 必须为 0`);
    }
    if (grant.kind === 'blueprint') {
      assert.ok(BLUEPRINT_MAP.has(grant.blueprintId), `奖品 ${prize.id} 的图纸 ${grant.blueprintId} 未登记`);
    }
    if (grant.kind === 'rewardBoxItem') {
      assert.ok(ITEM_DEFS.has(grant.itemId), `奖品 ${prize.id} 的物品 ${grant.itemId} 未登记`);
    }
  }
}
for (const cost of wheel.spinCosts) assert.ok(cost > 0, '转盘花费必须大于 0');
assert.ok(wheel.orderEarn.bands.length > 0, '订单产出至少要有一档');
for (const band of wheel.orderEarn.bands) {
  assert.ok(band.minLevel >= 1 && band.amount > 0, '订单产出档位不合法');
}
const earnProduct = resolveOrderProduct(wheel.orderEarn.category as Category, wheel.orderEarn.line);
assert.ok(earnProduct, `订单产线 ${wheel.orderEarn.category}/${wheel.orderEarn.line} 没有对应订单商品`);
if (wheel.featuredCustomer) {
  assert.ok(CUSTOMER_TYPE_MAP.has(wheel.featuredCustomer.typeId), `专属客人 ${wheel.featuredCustomer.typeId} 未登记`);
  assert.ok(wheel.featuredCustomer.dailyCap > 0, '专属客人每日上限必须大于 0');
}
if (wheel.clearanceOutfitId) {
  assert.ok(OUTFIT_MAP.has(wheel.clearanceOutfitId), `通关套装 ${wheel.clearanceOutfitId} 未登记`);
}
for (const past of PAST_WHEEL_THEMES) {
  assert.ok(past.settleToHuayuanRate > 0, `已下线转盘 ${past.seasonId} 结算汇率必须大于 0`);
}
const wheelArt = { ...wheel.art.mainImages, ...wheel.art.eventImages };
for (const key of [
  wheel.art.entryIconKey,
  wheel.art.currencyIconKey,
  wheel.art.panelShellKey,
  wheel.art.wheelDiscKey,
  wheel.art.wheelPointerKey,
  wheel.art.wheelHubKey,
  wheel.art.wheelStandKey,
  wheel.art.spinButtonKey,
]) {
  assert.ok(wheelArt[key], `转盘 art key ${key} 没有登记路径`);
}
for (const [key, rel] of Object.entries(wheelArt)) {
  const present = existsSync(join(minigame, rel));
  if (WHEEL_ASSETS_IN_PACKAGE) {
    assert.ok(present, `当期转盘素材缺文件：${key} -> minigame/${rel}`);
  } else {
    assert.ok(!present, `转盘素材标记为未进包，但仍在包内：minigame/${rel}`);
  }
}

console.log(`[exchange-event] 当期 ${theme.name}（${theme.seasonId}）：${theme.products.length} 件商品，${theme.categories.length} 个分类`);
console.log(`[exchange-event] 当期转盘 ${wheel.name}（${wheel.seasonId}）：${wheel.rounds.length} 轮，素材${WHEEL_ASSETS_IN_PACKAGE ? '已进包' : '已归档'}`);
console.log(`[exchange-event] 活动物品线：${SEASONAL_ITEM_LINES.map(line => `${line.eventName}/${line.line}`).join('、') || '无'}`);
console.log(`[exchange-event] 已下线可结算：${[...PAST_EXCHANGE_THEMES.map(t => t.seasonId), ...PAST_WHEEL_THEMES.map(t => t.seasonId)].join('、') || '无'}`);
console.log('[exchange-event] OK');
