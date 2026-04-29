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
  dessert: { category: 'drink', label: '甜品', maxLevel: 8 },
};

const ORDER_TIERS = {
  C: {
    slotRange: [1, 2],
    pools: [
      { category: 'flower', lines: ['fresh'], levelRange: [1, 2] },
      { category: 'flower', lines: ['fresh'], levelRange: [2, 3] },
    ],
  },
  B: {
    slotRange: [2, 2],
    pools: [
      { category: 'flower', lines: ['fresh', 'bouquet'], levelRange: [2, 5] },
      { category: 'drink', lines: ['butterfly', 'cold'], levelRange: [2, 4] },
    ],
  },
  A: {
    slotRange: [2, 2],
    pools: [
      { category: 'flower', lines: ['fresh', 'bouquet', 'green'], levelRange: [4, 7] },
      { category: 'drink', lines: ['butterfly', 'cold', 'dessert'], levelRange: [3, 6] },
    ],
  },
  S: {
    slotRange: [2, 3],
    pools: [
      { category: 'flower', lines: ['bouquet', 'green'], levelRange: [6, 13] },
      { category: 'drink', lines: ['butterfly', 'cold', 'dessert'], levelRange: [5, 10] },
    ],
  },
};

const MULTI_SLOT_BONUS_RATE = 0.16;
const SINGLE_SLOT_MERGE_PARITY_FACTOR = 0.9;
const ITEM_SELL_RATIO = 0.15;

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

function orderReward(slots) {
  const sum = slots.reduce((acc, slot) => acc + price(slot.line, slot.level), 0);
  let base = Math.max(1, Math.round(sum * (1 + MULTI_SLOT_BONUS_RATE * (slots.length - 1))));
  if (slots.length === 1) {
    base = Math.max(base, singleSlotReward(slots[0].line, slots[0].level));
  }
  return base;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sampleTier(tier, count = 5000) {
  const def = ORDER_TIERS[tier];
  const values = [];
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
      const level = lo + Math.floor(Math.random() ** 1.4 * (hi - lo + 1));
      const key = `${line}:${level}`;
      if (used.has(key)) continue;
      used.add(key);
      slots.push({ line, level });
    }
    if (slots.length > 0) values.push(orderReward(slots));
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
  };
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
  console.log(`${tier}: min=${s.min}, p50=${s.p50}, p90=${s.p90}, max=${s.max}, avg=${s.avg}`);
}

validate();
if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log('\n[order-pricing] OK');
