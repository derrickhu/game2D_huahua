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

console.log(`[exchange-event] 当期 ${theme.name}（${theme.seasonId}）：${theme.products.length} 件商品，${theme.categories.length} 个分类`);
console.log(`[exchange-event] 已下线可结算：${PAST_EXCHANGE_THEMES.map(t => t.seasonId).join('、') || '无'}`);
console.log('[exchange-event] OK');
