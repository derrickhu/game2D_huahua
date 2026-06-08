import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'src/config/OrderHuayuanConfig.ts');
const configText = fs.readFileSync(configPath, 'utf8');

const LINE_META = {
  fresh: { category: 'flower', label: '鲜花', maxLevel: 13 },
  bouquet: { category: 'flower', label: '花束', maxLevel: 10 },
  green: { category: 'flower', label: '绿植', maxLevel: 13 },
  butterfly: { category: 'drink', label: '蝴蝶', maxLevel: 10 },
  cold: { category: 'drink', label: '冷饮', maxLevel: 8 },
  dessert: { category: 'drink', label: '甜品', maxLevel: 10 },
};
const ORDER_DIFFICULTY_REFERENCE_LEVEL = 13;

const ORDER_TIERS = {
  C: {
    slotRange: [1, 2],
    pools: [
      { category: 'flower', lines: ['fresh', 'green'], levelRange: [1, 2] },
      { category: 'flower', lines: ['fresh', 'green'], levelRange: [2, 3] },
    ],
  },
  B: {
    slotRange: [2, 2],
    pools: [
      { category: 'flower', lines: ['fresh', 'bouquet', 'green'], levelRange: [2, 5] },
      { category: 'drink', lines: ['butterfly', 'cold'], levelRange: [2, 4] },
    ],
  },
  A: {
    slotRange: [2, 3],
    pools: [
      { category: 'flower', lines: ['fresh', 'bouquet', 'green'], levelRange: [4, 7] },
      { category: 'drink', lines: ['butterfly', 'cold', 'dessert'], levelRange: [3, 6] },
    ],
  },
  S: {
    slotRange: [2, 3],
    pools: [
      { category: 'flower', lines: ['fresh', 'bouquet', 'green'], levelRange: [6, 13] },
      { category: 'drink', lines: ['butterfly', 'cold', 'dessert'], levelRange: [5, 10] },
    ],
  },
};

const MULTI_SLOT_BONUS_RATE = 0.10;
const SINGLE_SLOT_MERGE_PARITY_FACTOR = 0.9;
const ITEM_SELL_RATIO = 0.15;
const ORDER_TIER_HUAYUAN_MULT = {
  C: 1,
  B: 1.1,
  A: 1.75,
  S: 2.5,
};
const ORDER_ITEM_LEVEL_PICK_EXPONENT = 1.12;
const ORDER_ASPIRATIONAL_LEVEL_BONUS_CHANCE = 0.14;
const CHALLENGE_ORDER_HUAYUAN_MULT = 1.06;

function extractCurves() {
  const curves = {};
  const re = /^\s*(fresh|bouquet|green|butterfly|cold|dessert):\s*\{\s*base:\s*([0-9.]+),\s*growth:\s*([0-9.]+)\s*\}/gm;
  let match;
  while ((match = re.exec(configText)) !== null) {
    curves[match[1]] = {
      base: Number(match[2]),
      growth: Number(match[3]),
    };
  }
  return curves;
}

const curves = extractCurves();

function fail(message) {
  console.error(`[order-pricing] ${message}`);
  process.exitCode = 1;
}

function price(line, level) {
  const curve = curves[line];
  if (!curve) throw new Error(`missing curve: ${line}`);
  return Math.max(1, Math.round(curve.base * curve.growth ** (level - 1)));
}

function sellPrice(orderHuayuan) {
  if (!Number.isFinite(orderHuayuan) || orderHuayuan < 1) return 0;
  const raw = Math.floor(orderHuayuan * ITEM_SELL_RATIO);
  return Math.min(orderHuayuan, Math.max(1, raw));
}

function singleSlotReward(line, level) {
  const base = price(line, level);
  if (level <= 1) return base;
  const floor = Math.round(SINGLE_SLOT_MERGE_PARITY_FACTOR * 2 * price(line, level - 1));
  return Math.max(base, floor);
}

function computeContentTier(slots) {
  const norms = slots
    .filter(slot => LINE_META[slot.line])
    .sort((a, b) => `${a.line}:${a.level}`.localeCompare(`${b.line}:${b.level}`))
    .map(slot => orderItemDifficulty(slot));
  if (norms.length === 0) return 'C';
  const maxNorm = Math.max(...norms);
  const avgNorm = norms.reduce((a, b) => a + b, 0) / norms.length;
  const slotBonus = norms.length >= 3 ? 0.06 : norms.length >= 2 ? 0.03 : 0;
  const score = Math.min(1, 0.45 * maxNorm + 0.55 * avgNorm + slotBonus);
  if (score < 0.3) return 'C';
  if (score < 0.48) return 'B';
  if (score < 0.68) return 'A';
  return 'S';
}

function orderReward(slots) {
  const sum = slots.reduce((acc, slot) => acc + price(slot.line, slot.level), 0);
  let base = Math.max(1, Math.round(sum * (1 + MULTI_SLOT_BONUS_RATE * (slots.length - 1))));
  if (slots.length === 1) {
    base = Math.max(base, singleSlotReward(slots[0].line, slots[0].level));
  }
  return Math.max(1, Math.round(base * ORDER_TIER_HUAYUAN_MULT[computeContentTier(slots)]));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function effectiveMaxLevel(toolLevel, maxItemLevel) {
  if (toolLevel <= 0) return 0;
  return Math.min(toolLevel * 2 - 1, maxItemLevel);
}

function orderLevelDifficulty(level) {
  if (!Number.isFinite(level) || level <= 0) return 0;
  return clamp(Math.floor(level) / ORDER_DIFFICULTY_REFERENCE_LEVEL, 0, 1);
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function orderItemDifficulty(slot) {
  const absolute = orderLevelDifficulty(slot.level);
  const maxLevel = LINE_META[slot.line]?.maxLevel ?? 0;
  if (!Number.isFinite(maxLevel) || maxLevel <= 1) return absolute;
  const relative = clamp(Math.floor(slot.level) / maxLevel, 0, 1);
  const lateLineBonus = 0.14 * smoothstep(0.65, 1, relative);
  return clamp(absolute + lateLineBonus, 0, 1);
}

function linePower(toolLevel, line) {
  return orderLevelDifficulty(effectiveMaxLevel(toolLevel, ORDER_DIFFICULTY_REFERENCE_LEVEL));
}

function toolPower(lines) {
  const powers = [];
  if (lines.maxPlantToolLevel > 0) {
    powers.push(linePower(lines.maxPlantToolLevel, 'fresh'));
    if (lines.hasGreen) powers.push(linePower(lines.maxPlantToolLevel, 'green'));
  }
  if (lines.hasBouquet) {
    powers.push(linePower(Math.max(lines.maxArrangeToolLevel, lines.maxPlantToolLevel), 'bouquet'));
  }
  for (const line of ['butterfly', 'cold', 'dessert']) {
    const toolLevel = lines.drinkToolMaxByLine[line] ?? 0;
    if (toolLevel > 0) powers.push(linePower(toolLevel, line));
  }
  if (powers.length === 0) return 0;
  return powers.reduce((a, b) => a + b, 0) / powers.length;
}

function getOrderTierWeights(playerLevel, lines) {
  const maxTool = Math.max(lines.maxPlantToolLevel, lines.maxArrangeToolLevel, lines.maxDrinkToolLevel);
  const hasAnyProducer = maxTool >= 1;
  if (playerLevel <= 3) {
    if (playerLevel === 1) {
      if (!hasAnyProducer) return { C: 100, B: 0, A: 0, S: 0 };
      if (maxTool >= 3 || lines.hasBouquet || lines.hasDrink) return { C: 62, B: 38, A: 0, S: 0 };
      if (maxTool >= 2) return { C: 58, B: 42, A: 0, S: 0 };
      return { C: 65, B: 35, A: 0, S: 0 };
    }
    if (playerLevel === 2) {
      if (!hasAnyProducer) return { C: 100, B: 0, A: 0, S: 0 };
      if (maxTool >= 3 || lines.hasBouquet || lines.hasDrink) return { C: 42, B: 38, A: 20, S: 0 };
      if (maxTool >= 2) return { C: 45, B: 40, A: 15, S: 0 };
      return { C: 50, B: 35, A: 15, S: 0 };
    }
    if (lines.hasBouquet || lines.hasDrink) return { C: 15, B: 48, A: 37, S: 0 };
    if (maxTool >= 4) return { C: 25, B: 48, A: 27, S: 0 };
    return { C: 35, B: 50, A: 15, S: 0 };
  }
  if (playerLevel === 4) {
    if (lines.hasBouquet || lines.hasDrink) return { C: 15, B: 42, A: 37, S: 6 };
    if (maxTool >= 4) return { C: 22, B: 45, A: 27, S: 6 };
    return { C: 35, B: 45, A: 14, S: 6 };
  }

  const levelScore = clamp((playerLevel - 4) / 12, 0, 1);
  const toolScore = toolPower(lines);
  const lineScore = clamp(lines.unlockedLineCount / 5, 0, 1);
  const highOrderScore = clamp(0.55 * toolScore + 0.25 * levelScore + 0.2 * lineScore, 0, 1);
  const levelTail = Math.max(0, playerLevel - 6);
  return {
    C: Math.round(clamp(18 - 16 * highOrderScore - 0.6 * levelTail, 1, 14)),
    B: Math.round(clamp(44 - 28 * highOrderScore - 0.6 * levelTail, 10, 36)),
    A: Math.round(clamp(30 + 30 * highOrderScore + 0.8 * levelTail, 34, 64)),
    S: Math.round(clamp(3 + 20 * highOrderScore + 0.9 * levelTail, 5, 30)),
  };
}

function pickTierByWeight(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [tier, w] of entries) {
    r -= w;
    if (r <= 0) return tier;
  }
  return entries[entries.length - 1][0];
}

function tierPickExponent(tier) {
  if (tier === 'S') return 0.58;
  if (tier === 'A') return 0.82;
  if (tier === 'B') return 1.02;
  return ORDER_ITEM_LEVEL_PICK_EXPONENT;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sampleTier(tier, count = 5000) {
  const def = ORDER_TIERS[tier];
  const values = [];
  const contentTierCounts = { C: 0, B: 0, A: 0, S: 0 };
  for (let i = 0; i < count; i++) {
    const [minSlots, maxSlots] = def.slotRange;
    const slotCount = minSlots + Math.floor(Math.random() * (maxSlots - minSlots + 1));
    const used = new Set();
    const slots = [];
    for (let s = 0; s < slotCount; s++) {
      const pool = pick(def.pools);
      const line = pick(pool.lines);
      const maxLevel = LINE_META[line].maxLevel;
      const [loRaw, hiRaw] = pool.levelRange;
      const lo = Math.min(loRaw, maxLevel);
      const hi = Math.min(hiRaw, maxLevel);
      const level = lo + Math.floor(Math.random() ** tierPickExponent(tier) * (hi - lo + 1));
      const key = `${line}:${level}`;
      if (used.has(key)) continue;
      used.add(key);
      slots.push({ line, level });
    }
    if (slots.length > 0) {
      contentTierCounts[computeContentTier(slots)]++;
      values.push(orderReward(slots));
    }
  }
  values.sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const at = p => values[Math.min(values.length - 1, Math.floor(values.length * p))];
  return {
    min: values[0],
    p50: at(0.5),
    p90: at(0.9),
    max: values[values.length - 1],
    avg: Math.round(sum / values.length),
    contentTierCounts,
  };
}

function scenarioToolCap(lines, line) {
  if (line === 'fresh' || line === 'green') return effectiveMaxLevel(lines.maxPlantToolLevel, LINE_META[line].maxLevel);
  if (line === 'bouquet') {
    return effectiveMaxLevel(Math.max(lines.maxArrangeToolLevel, lines.maxPlantToolLevel), LINE_META[line].maxLevel);
  }
  return effectiveMaxLevel(lines.drinkToolMaxByLine[line] ?? 0, LINE_META[line].maxLevel);
}

function eligibleLines(poolLines, lines) {
  return poolLines.filter(line => {
    if (line === 'fresh') return lines.maxPlantToolLevel > 0;
    if (line === 'green') return lines.hasGreen;
    if (line === 'bouquet') return lines.hasBouquet;
    return (lines.drinkToolMaxByLine[line] ?? 0) > 0;
  });
}

function pickScenarioLevel(tier, loRaw, hiRaw, line, lines) {
  const cap = scenarioToolCap(lines, line);
  const aspirationalBonus = tier === 'S' ? 0.18 : tier === 'A' ? 0.08 : tier === 'B' ? 0.02 : 0;
  const aspirational = cap > 0 && Math.random() < ORDER_ASPIRATIONAL_LEVEL_BONUS_CHANCE + aspirationalBonus;
  const hi = Math.min(hiRaw, cap + (aspirational ? 1 : 0), LINE_META[line].maxLevel);
  const lo = Math.min(loRaw, hi);
  return lo + Math.floor(Math.random() ** tierPickExponent(tier) * (hi - lo + 1));
}

function generateScenarioSlots(tier, lines) {
  const def = ORDER_TIERS[tier];
  const [minSlots, maxSlots] = def.slotRange;
  const slotCount = minSlots + Math.floor(Math.random() * (maxSlots - minSlots + 1));
  const used = new Set();
  const slots = [];
  for (let s = 0; s < slotCount; s++) {
    let pool = pick(def.pools);
    let linePool = eligibleLines(pool.lines, lines);
    if (linePool.length === 0 && pool.category === 'drink') {
      const fallbackLines = tier === 'S'
        ? ['fresh', ...(lines.hasBouquet ? ['bouquet'] : []), ...(lines.hasGreen ? ['green'] : [])]
        : ['fresh', ...(lines.hasBouquet ? ['bouquet'] : []), ...(lines.hasGreen ? ['green'] : [])];
      pool = { category: 'flower', lines: fallbackLines, levelRange: tier === 'S' ? [6, 13] : tier === 'A' ? [4, 7] : [2, 5] };
      linePool = eligibleLines(pool.lines, lines);
    }
    if (linePool.length === 0) continue;
    const line = pick(linePool);
    const level = pickScenarioLevel(tier, pool.levelRange[0], pool.levelRange[1], line, lines);
    const key = `${line}:${level}`;
    if (used.has(key)) continue;
    used.add(key);
    slots.push({ line, level });
  }
  return slots;
}

function simulateScenario(label, playerLevel, lines, count = 20000) {
  const weights = getOrderTierWeights(playerLevel, lines);
  const templateCounts = { C: 0, B: 0, A: 0, S: 0 };
  const contentTierCounts = { C: 0, B: 0, A: 0, S: 0 };
  const rewardsByContent = { C: [], B: [], A: [], S: [] };
  for (let i = 0; i < count; i++) {
    const tier = pickTierByWeight(weights);
    templateCounts[tier]++;
    const slots = generateScenarioSlots(tier, lines);
    if (slots.length === 0) continue;
    const contentTier = computeContentTier(slots);
    contentTierCounts[contentTier]++;
    rewardsByContent[contentTier].push(orderReward(slots));
  }

  console.log(`\n场景模拟：${label}`);
  console.log(`weights=${JSON.stringify(weights)} template=${JSON.stringify(templateCounts)} content=${JSON.stringify(contentTierCounts)}`);
  for (const tier of ['C', 'B', 'A', 'S']) {
    const values = rewardsByContent[tier].sort((a, b) => a - b);
    if (values.length === 0) continue;
    const at = p => values[Math.min(values.length - 1, Math.floor(values.length * p))];
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    console.log(`${tier}: n=${values.length}, p50=${at(0.5)}, p90=${at(0.9)}, avg=${avg}, min=${values[0]}, max=${values[values.length - 1]}`);
  }

  const visibleSRate = contentTierCounts.S / Math.max(1, Object.values(contentTierCounts).reduce((a, b) => a + b, 0));
  const aValues = rewardsByContent.A.sort((a, b) => a - b);
  if (label.includes('Lv10 高工具') && visibleSRate < 0.12) {
    fail(`Lv10 高工具 S 可见比例过低：${(visibleSRate * 100).toFixed(1)}%`);
  }
  if (label.includes('Lv10 高工具') && visibleSRate > 0.26) {
    fail(`Lv10 高工具 S 可见比例过高：${(visibleSRate * 100).toFixed(1)}%`);
  }
  if (label.includes('Lv10 高工具') && aValues.length > 0 && aValues[Math.floor(aValues.length * 0.5)] < 350) {
    fail('Lv10 高工具 A 档 p50 仍偏低');
  }
}

function printPriceTable() {
  console.log('订单单品价格表');
  for (const [line, meta] of Object.entries(LINE_META)) {
    const values = [];
    for (let lv = 1; lv <= meta.maxLevel; lv++) {
      values.push(price(line, lv));
    }
    console.log(`${meta.label.padEnd(2)} ${line.padEnd(9)}: ${values.join(', ')}`);
  }
}

function validate() {
  for (const line of Object.keys(LINE_META)) {
    if (!curves[line]) fail(`缺少 ${line} 定价曲线`);
  }

  for (const [line, meta] of Object.entries(LINE_META)) {
    let prev = 0;
    for (let lv = 1; lv <= meta.maxLevel; lv++) {
      const value = price(line, lv);
      if (value <= prev) fail(`${line} L${lv} 未严格高于上一等级`);
      const sell = sellPrice(value);
      if (sell >= value) fail(`${line} L${lv} 出售价不应达到订单价`);
      if (lv > 1 && singleSlotReward(line, lv) < Math.round(1.8 * price(line, lv - 1))) {
        fail(`${line} L${lv} 单槽保底低于合成软保底`);
      }
      prev = value;
    }
  }

  for (let lv = 1; lv <= 8; lv++) {
    const flowerValues = new Set(['fresh', 'bouquet', 'green'].map(line => price(line, lv)));
    const drinkValues = new Set(['butterfly', 'cold', 'dessert'].map(line => price(line, lv)));
    if (flowerValues.size === 1) fail(`花系 L${lv} 仍然全线同价`);
    if (drinkValues.size === 1) fail(`饮品 L${lv} 仍然全线同价`);
  }
}

printPriceTable();
console.log('\n模板档订单奖励抽样');
for (const tier of Object.keys(ORDER_TIERS)) {
  const s = sampleTier(tier);
  const counts = Object.entries(s.contentTierCounts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}:${n}`)
    .join(' ');
  console.log(`${tier}: min=${s.min}, p50=${s.p50}, p90=${s.p90}, max=${s.max}, avg=${s.avg} | content ${counts}`);
}

simulateScenario('Lv6 中级工具：plant5 arrange4 蝴蝶4', 6, {
  hasBouquet: true,
  hasGreen: true,
  hasDrink: true,
  maxPlantToolLevel: 5,
  maxArrangeToolLevel: 4,
  maxDrinkToolLevel: 4,
  drinkToolMaxByLine: { butterfly: 4 },
  unlockedLineCount: 3,
});

simulateScenario('Lv10 高工具：plant7 arrange5 三饮品5', 10, {
  hasBouquet: true,
  hasGreen: true,
  hasDrink: true,
  maxPlantToolLevel: 7,
  maxArrangeToolLevel: 5,
  maxDrinkToolLevel: 5,
  drinkToolMaxByLine: { butterfly: 5, cold: 5, dessert: 5 },
  unlockedLineCount: 5,
});

simulateScenario('Lv10 低工具：plant4 arrange3', 10, {
  hasBouquet: true,
  hasGreen: true,
  hasDrink: false,
  maxPlantToolLevel: 4,
  maxArrangeToolLevel: 3,
  maxDrinkToolLevel: 0,
  drinkToolMaxByLine: {},
  unlockedLineCount: 2,
});

validate();
if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log('\n[order-pricing] OK');
