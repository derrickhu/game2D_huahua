/**
 * 成长之路配置自检（`npm run check:growth-quest`）。
 *
 * 放在构建期脚本而不是游戏运行时：`assertGrowthRewardsValid()` 是会抛错的硬校验，
 * 挂进 `init()` 万一线上配置有问题会直接白屏，改表时在本地/CI 跑一次更安全。
 *
 * 核心守的是工具奖励铁律：**只允许 1 级、每次只给 1 个、一章内只发 1 次**。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GROWTH_BALANCE_BASELINE,
  GROWTH_CHAPTERS,
  GrowthMetric,
  assertGrowthRewardsValid,
  getGrowthChapter,
  getGrowthTask,
  growthChapterIndex,
  isCounterMetric,
} from '../src/config/GrowthQuestConfig';
import { ITEM_DEFS, InteractType } from '../src/config/ItemConfig';
import { WORKSHOP_RESOURCE_MAP } from '../src/config/FurnitureWorkshopConfig';

assertGrowthRewardsValid();
console.log('[growth] assertGrowthRewardsValid 通过');

assert.ok(GROWTH_CHAPTERS.length > 0, '章节表不能为空');
assert.equal(
  GROWTH_BALANCE_BASELINE.length,
  GROWTH_CHAPTERS.length,
  '每章都要有一条数值基准，否则 assertGrowthRewardsValid 的卡关校验会被跳过',
);

// 索引函数与配置表必须自洽，面板/挂件全靠它们查任务
for (const chapter of GROWTH_CHAPTERS) {
  assert.equal(getGrowthChapter(chapter.id)?.id, chapter.id, `章节索引: ${chapter.id}`);
  assert.ok(growthChapterIndex(chapter.id) >= 0, `章节序号: ${chapter.id}`);
  assert.ok(chapter.title.length > 0, `${chapter.id}: 缺章节标题`);
  assert.ok(chapter.subtitle.length > 0, `${chapter.id}: 缺章节副标题`);
  assert.ok(chapter.chapterRewardLabel.length > 0, `${chapter.id}: 缺章节大奖名`);
  for (const task of chapter.tasks) {
    assert.equal(getGrowthTask(task.id)?.id, task.id, `任务索引: ${task.id}`);
    assert.ok(task.title.length > 0, `${task.id}: 缺任务标题`);
  }
}

// 目标等级须随章节单调递增，否则「当前章」推进会卡住
let prevLevel = 0;
for (const b of GROWTH_BALANCE_BASELINE) {
  assert.ok(
    b.targetLevel > prevLevel,
    `数值基准的目标星级必须递增：${b.chapterId} 的 ${b.targetLevel} 不大于前一章的 ${prevLevel}`,
  );
  prevLevel = b.targetLevel;
}

// 工具铁律复检：只发 1 级、每次 1 个、一章一次。顺带打印供人眼扫。
let toolRewardCount = 0;
for (const chapter of GROWTH_CHAPTERS) {
  const slots = [
    ...chapter.tasks.map(t => ({ where: t.id, reward: t.reward })),
    { where: `${chapter.id}-大奖`, reward: chapter.chapterReward },
  ];
  const toolSlots: string[] = [];
  for (const { where, reward } of slots) {
    for (const { itemId, count } of reward.items ?? []) {
      const def = ITEM_DEFS.get(itemId);
      if (def?.interactType !== InteractType.TOOL) continue;
      assert.equal(def.level, 1, `工具奖励必须是 1 级：${where} 的 ${itemId} 是 ${def.level} 级`);
      assert.equal(count, 1, `工具奖励每次只能给 1 个：${where} 的 ${itemId} 给了 ${count} 个`);
      toolSlots.push(`${where}:${itemId}`);
      toolRewardCount += count;
    }
  }
  assert.ok(
    toolSlots.length <= 1,
    `一章内只能发 1 次工具：${chapter.id} 有 ${toolSlots.length} 处（${toolSlots.join('、')}）`,
  );
  console.log(`[growth]   ${chapter.id} 工具补给: ${toolSlots[0] ?? '无'}`);
}
console.log(`[growth] 工具奖励共 ${toolRewardCount} 个：全部 1 级、每次 1 个、每章不超过 1 次`);

// 累计型指标无法追溯历史，配置里若把它当「已拥有数量」用会让老玩家进度归零
for (const chapter of GROWTH_CHAPTERS) {
  for (const task of chapter.tasks) {
    if (task.metric !== GrowthMetric.ItemDiscovered) continue;
    assert.ok(!isCounterMetric(task.metric), `${task.id}: itemDiscovered 必须是快照型`);
    assert.equal(task.target, 1, `${task.id}: itemDiscovered 的 target 只能是 1`);
  }
}

/**
 * 面板/挂件里每个奖励都要画图标，key 打错只会静默画不出来（fallback 成文字），线上很难发现。
 * `TextureCache` 依赖 PIXI 无法在 node 里 import，所以按源码文本抽 key 做静态比对。
 */
// bundle 输出在 /tmp，`__dirname` 不指向仓库；与 check_responsive_layout 一致用 cwd
const textureCacheSrc = readFileSync(
  join(process.cwd(), 'src', 'utils', 'TextureCache.ts'),
  'utf8',
);
const registeredKeys = new Set<string>();
for (const m of textureCacheSrc.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*'[^']*\.png'/gm)) {
  registeredKeys.add(m[1]);
}
for (const m of textureCacheSrc.matchAll(/^\s*'([A-Za-z_][A-Za-z0-9_]*)'\s*:\s*'[^']*\.png'/gm)) {
  registeredKeys.add(m[1]);
}
assert.ok(registeredKeys.size > 100, `TextureCache key 抽取失败，只找到 ${registeredKeys.size} 个`);

const growthIconKeys = new Set<string>([
  'growth_panel_shell_nb2',
  'icon_growth',
  'deco_card_btn_3',
  'ui_order_check_badge',
  'workshop_blueprint_generic',
  'icon_energy',
  'icon_gem',
  'icon_huayuan',
  'icon_flower_sign_coin',
]);
for (const chapter of GROWTH_CHAPTERS) {
  for (const r of [...chapter.tasks.map(t => t.reward), chapter.chapterReward]) {
    for (const { itemId } of r.items ?? []) {
      const icon = ITEM_DEFS.get(itemId)?.icon;
      assert.ok(icon, `奖励物品 ${itemId} 缺 icon`);
      growthIconKeys.add(icon);
    }
    for (const { materialId } of r.workshopMaterials ?? []) {
      const icon = WORKSHOP_RESOURCE_MAP.get(materialId)?.icon;
      assert.ok(icon, `工坊材料 ${materialId} 未在 WORKSHOP_RESOURCE_BAR 注册，图标取不到`);
      growthIconKeys.add(icon);
    }
  }
}
for (const key of growthIconKeys) {
  assert.ok(registeredKeys.has(key), `成长面板要用的纹理 key 未在 TextureCache 注册: ${key}`);
}
console.log(`[growth] ${growthIconKeys.size} 个图标 key 均已在 TextureCache 注册`);

const totalTasks = GROWTH_CHAPTERS.reduce((n, c) => n + c.tasks.length, 0);
console.log(`[growth] 校验通过：${GROWTH_CHAPTERS.length} 章 / ${totalTasks} 条任务`);
