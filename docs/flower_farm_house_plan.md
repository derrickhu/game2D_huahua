# 花田农舍 — 30 级支线房屋详细规划

> 版本：v0.1 · 2026-07-05  
> 状态：**已实施**（batch54 · Lv30 支线）  
> 定位：大地图 **Lv30 花愿购买支线**，填补茶香小院（25）与橡树小屋（35）之间的内容空档；对标梦云小屋模式，**纯装修向、无新玩法**。

---

## 1. 项目概述

### 1.1 一句话定位

**「从花店走出去，亲手收一筐果、晒一院光」** —— 朴素温暖的田园院落，与茶香之「雅」、橡树之「童话仙」、梦云之「梦幻卧室」形成第三气质：**拾光农趣**。

### 1.2 设计目标

| 目标 | 说明 |
|------|------|
| 填坑 | Lv30 里程碑目前仅有银宝箱；新增大地图节点 + 升级仪式条目 |
| 差异化 | 全项目唯一 **田园 / 收成 / 半户外** 主题房屋 |
| 轻量化 | 资产与配置量 **≤ 梦云小屋**（梦云：2 壳 + 10 家具；本房：**2 壳 + 7 家具**） |
| 低耦合 | **不**新增种植/养殖玩法、不新 Scene、不新面板；复用 `ShopScene` + `purchaseCost` 支线逻辑 |
| IP 延续 | 与棋盘 **农田工具线**（`tool_farm_*`）、整果收集意象呼应，仅文案与视觉联动 |

### 1.3 明确非目标（Scope Out）

- ❌ 可交互农场 sim（浇水、生长、收获循环）
- ❌ 动物 AI / 动画系统（鸡、羊仅 **静态摆件**）
- ❌ 新分包或独立场景类
- ❌ 家具工坊新配方线（首版不上）
- ❌ 与茶香小院抢戏的「江南 / 古风」元素

---

## 2. 命名与标识

| 项 | 值 |
|----|-----|
| 中文名（玩家可见） | **花田农舍** |
| `sceneId` | `flower_farm_house` |
| 装修 Tab 名 | 随 `SCENE_MAP` 自动显示「花田农舍」 |
| 内部批次代号 | `batch54_flower_farm` |
| 默认房壳 id | `style_flower_farm_cottage_nb2` |
| 换色房壳 id | `style_flower_farm_spring_vine_nb2` |

备选曾用名（不采用）：青畦小院、拾光牧场、温室花棚（后者可作为 **换色壳副标题** 文案，主品牌仍用「花田农舍」）。

---

## 3. 解锁与经济

### 3.1 等级门控

| 参数 | 值 | 对齐参考 |
|------|-----|----------|
| 大地图可见 / 可购买等级 | **30** | 梦云 Lv20；茶香 Lv25 |
| 房屋内星级上限 | **8 星** | 同梦云 / 茶香 / 橡树 |
| 星级阈值表 | 复制 `DREAM_CLOUD_HOUSE_THRESHOLDS` | `StarLevelConfig.ts` |
| 里程碑奖励 | 复制 `DREAM_CLOUD_HOUSE_MILESTONES` | 同上 |

### 3.2 花愿购买

| 参数 | 值 | 理由 |
|------|-----|------|
| `purchaseCost` | **180,000** | 梦云 150,000；晚 10 级、略涨 20% |
| 购买流程 | 现有 `WorldMapPanel._promptPurchaseHouse` | 无需改 UI |
| 存档字段 | `CurrencyManager.purchasedHouses` 追加 `flower_farm_house` | 已有机制 |

### 3.3 Lv30 升级仪式（`LevelUnlockConfig`）

在现有 `30` 级条目上 **追加**（保留银宝箱）：

```typescript
{
  kind: 'map',
  title: '花田农舍开放',
  desc: '大地图茶香与橡树之间的田园空地可花愿解锁，青畦果筐与暖巢鸡舍等你布置。',
  iconKey: 'worldmap_thumb_flower_farm_house',
}
```

`ceremonyTitle` 建议由「进阶花境」改为 **「花田拾光」**（或保留原 ceremonyTitle 仅追加 map 条目——二选一，推荐改标题更有仪式感）。

---

## 4. 大地图节点

### 4.1 位置

| 参数 | 建议值 | 说明 |
|------|--------|------|
| `id` | `flower_farm_house` | |
| `x` | **1760** | 茶香 `(1540,780)` 与橡树 `(1980,900)` 之间 |
| `y` | **920** | 对齐截图红框：中下方圆形草地，小径与树篱旁 |
| `thumbSize` | **340** | 与梦云同级，小于橡树 480 |
| `type` | `house` | |
| `purchaseCost` | `180000` | |
| `useLiveMapThumb` | `false` | 与支线房一致 |

> 坐标可在底图合成后 **±40px 微调**；原则：不挡路径、与茶香/橡树形成三角视觉。

### 4.2 缩略图美术方向

- **外形**：单层暖木农舍 + 矮红/陶瓦坡顶 + 白色木栅栏围一小片菜畦；烟囱轻烟（可选）。
- **气质**：pastel 手绘、与现有 map house 同 **isometric-lite 俯前角**；**不要** 写实 barn、不要工业风。
- **识别点**：栅栏 + 菜行 + 小风车或谷仓门其一即可；**禁止** 文字招牌。
- **Prompt 文件**：`docs/prompt/worldmap_thumb_flower_farm_house_nb2_prompt.txt`
- **输出路径**：`../game_assets/huahua/assets/raw/worldmap_thumb_flower_farm_house_nb2.png` → 抠图后 `minigame/subpkg_panels/images/ui/worldmap_thumb_flower_farm_house.png`

---

## 5. 房壳设计

### 5.1 结构策略（轻量化核心）

| 对比项 | 梦云小屋 | 花田农舍 |
|--------|----------|----------|
| 层数 | 双层 cutaway + 云梯 | **单层 cutaway**，可选极小阁楼窗洞（不单独做二楼平台） |
| 外景底图 | 专属天空 `house_bg_dream_cloud_sky_nb2` | **通用草地** `house_bg`（不新增 JPG 外景，减资产） |
| 换色壳 | 1 个（Lv22） | 1 个（Lv32） |
| 房壳 scale | `buildingScaleMultiplier: 1.2` | **1.25**（略大，方便摆「菜毯 + 栅栏」） |

### 5.2 默认壳「暖木农舍」

- **视角**：upper-left ~45° cutaway，与 `house_bg_room_dream_cloud_two_story_nb2` / 茶寮壳 **同布局语法**（后墙 + 右墙、正面敞开）。
- **地面**：浅麦色木地板或压土砖，**宽阔平整**，便于放地毯类菜畦。
- **结构**：裸露暖木梁、奶油石灰墙；右墙开 **方格木窗**，窗外暗示淡绿田野（非全景）。
- **檐口**：浅陶红 / 暖褐小坡顶檐条，**不封顶**，露出摆放区。
- **细节**：门廊处 2–3 级木台阶、墙角小陶罐；**禁止** 室内预置家具。
- **Prompt**：`docs/prompt/house_bg_room_flower_farm_cottage_nb2_prompt.txt`
- **入库**：`minigame/subpkg_deco/images/house/bg_room_flower_farm_cottage_nb2.png`

### 5.3 换色壳「青藤春棚」（Lv32 解锁）

- 同结构，墙面爬 **浅绿常春藤 + 小黄花**；地面略偏 mint；檐口换 **浅灰绿木瓦**。
- 名称：**青藤春棚**；花愿 **72,000**；`starValue: 8`
- **Prompt**：`docs/prompt/house_bg_room_flower_farm_spring_vine_nb2_prompt.txt`

---

## 6. 专属家具（7 件 · Lv30–33）

**套装名：拾光田园套**  
生图：**单件单 prompt 优先**（见 `furniture-deco-art-spec.mdc` 批量节）；若风格统一也可 **4×2 白底合图**（8 格用 7 格，留 1 空）。

经济参考梦云（Lv20–24 花愿 22k–65k）：本房 Lv30+ 略上调 **约 +15%**。

| # | id | 中文名 | 槽位 | 解锁等级 | 花愿 | 星星 | 稀有度 | defaultScale | 深度 / 备注 |
|---|-----|--------|------|---------:|-----:|-----:|--------|-------------:|-------------|
| 1 | `farm_vegetable_patch_rug` | 青畦菜毯 | ORNAMENT | 30 | 28,200 | 6 | 精良 | 1.55 | **`depthSortFloorMat: true`, `depthSortYLift: 0`** — 俯视菜行纹理 |
| 2 | `farm_wooden_wheelbarrow` | 木轮手推车 | ORNAMENT | 30 | 26,800 | 6 | 精良 | 1.05 | 地面大件；筐内放 **花店风格化蔬果**（非写实） |
| 3 | `farm_fruit_crate_stack` | 丰收果筐堆 | SHELF | 30 | 31,400 | 6 | 精良 | 1.22 | 木筐堆叠苹果/葡萄/柑橘；呼应 merge 果线 |
| 4 | `farm_scarecrow` | 稻草守卫 | ORNAMENT | 31 | 24,600 | 6 | 精良 | 1.35 | **标志性单品**；草帽、碎花围巾、软萌脸 |
| 5 | `farm_hen_coop` | 暖巢鸡舍 | ORNAMENT | 31 | 29,800 | 7 | 稀有 | 1.18 | 静态：1–2 只 Q 版鸡；**无动画** |
| 6 | `farm_hay_bench` | 干草长凳 | ORNAMENT | 32 | 22,400 | 5 | 精良 | 1.12 | 木框 + 干草垫；休憩角 |
| 7 | `farm_beehive_stand` | 蜜意蜂箱 | ORNAMENT | 33 | 27,200 | 6 | 精良 | 0.88 | 台面/地面均可；小蜜蜂 **静态点缀**（勿画成虫群） |

**刻意不做（减重复 / 减重）**

- 完整「可走进鸡舍」大场景、拖拉机、水车大型动效
- 与茶香 **柳编花车** 同构的第二种花车
- 吊灯 / 壁灯（项目惯例难摆）
- 地窖坛罐架（并入果筐堆即可）

### 6.1 放置验收要点

1. **青畦菜毯** 与任意地面家具重叠时恒在最底层。  
2. **木轮手推车 / 稻草人** 在编辑模式不与房壳穿模。  
3. **蜂箱** 若 scale < 0.92 且需摆台面：评估后 **显式** `depthSortFeetYFudge`（默认按地面摆）。

---

## 7. 主题差异化矩阵

| 房屋 | 等级 | 气质 | 核心意象 |
|------|------|------|----------|
| 梦云小屋 | 20（购） | 梦幻卧室 | 云、月、星 |
| 茶香小院 | 25 | 东方雅趣 | 茶、花窗、江南 |
| **花田农舍** | **30（购）** | **田园拾光** | **菜畦、果筐、鸡舍、干草** |
| 橡树小屋 | 35 | 童话森林 | 树洞、苔藓、航海 |
| 花园别墅 | 40 | 西式洋房 | 玫瑰、露台 |

与 **棋盘农田工具** 的联动仅体现在：图鉴 / 收藏文案可互提「果田工具在花店，收成摆件在农舍」——**无需代码耦合**。

---

## 8. 工程接入清单

执行阶段按顺序勾选（对标梦云已有改动点）：

### 8.1 配置

- [ ] `src/config/WorldMapConfig.ts` — 常量 + `MAP_NODES` 新节点  
- [ ] `src/config/StarLevelConfig.ts` — `SCENE_DEFS` 追加 `flower_farm_house`  
- [ ] `src/config/LevelUnlockConfig.ts` — Lv30 仪式 map 条目  
- [ ] `src/config/SceneRenovationConfig.ts` — `flower_farm_house: { buildingScaleMultiplier: 1.25 }`  
- [ ] `src/config/DecorationConfig.ts` — 2 个 `ROOM_STYLES` + 7 个 `DECO_DEFS`（`allowedSceneIds: ['flower_farm_house']`）  

### 8.2 资源映射

- [ ] `src/utils/TextureCache.ts` — thumb、2 壳、7 家具 icon；`preloadPanelAssets('worldmap')` 列表追加 thumb key  
- [ ] `src/gameobjects/ui/WorldMapPanel.ts` — `preloadKeysForScene` switch 追加 case  

### 8.3 可选

- [ ] `src/managers/GMManager.ts` — GM 跳级命令注释补「30 级花田农舍」  
- [ ] `npm run check:deco-textures` — 入库前强制通过  

### 8.4 无需改动（已支持）

- `ShopScene` / `SceneManager` — 同房装修场景  
- `CurrencyManager.purchaseHouse` / `isHousePurchased`  
- `DecorationManager.getDefaultRoomStyleIdForScene` — 自动取 cost=0 默认壳  
- `RoomLayoutManager` — 新 scene 空布局即可  

---

## 9. 资产生产管线

### 9.1 文件一览

| 类型 | 数量 | 路径模式 |
|------|------|----------|
| NB2 prompt | 11 | `docs/prompt/*flower_farm*` |
| 原图 raw | 11 | `../game_assets/huahua/assets/raw/` |
| 大地图 thumb | 1 | `subpkg_panels/images/ui/` |
| 房壳 | 2 | `subpkg_deco/images/house/` |
| 家具 PNG | 7 | `subpkg_deco/images/furniture/` |

### 9.2 推荐执行顺序

```
Phase A — 概念验证（1–2 天）
  1. 大地图 thumb 试稿 + 默认房壳试稿（各 1–2 轮 NB2）
  2. 用户确认气质后再批量家具

Phase B — 房壳入库（1 天）
  3. 默认壳 rembg birefnet-general → crop_trim → compress
  4. 换色壳同上

Phase C — 家具入库（2 天）
  5. 7 件单图或 4×2 合图 → split（若合图）→ rembg → crop_trim
  6. python3 scripts/compress_furniture_deco_pngs.py --force <paths>
  7. npm run check:deco-textures

Phase D — 工程配置（0.5 天）
  8. 按 §8 写入 TS 配置
  9. 真机：大地图购买 → 进入 → 摆家具 → 存档重进

Phase E — 大地图底图（可选，与程序并行）
  10. 若静态 worldmap_bg 需补农舍占位：在 `game_assets` 改底图或仅依赖 thumb 叠加（当前其它 house 亦为 thumb 叠加，**首版可不改底图**）
```

### 9.3 抠图与压缩规范

- 房壳 / 家具 / thumb（UI 建筑）：**`birefnet-general`** + `crop_trim --padding 4`  
- 家具最长边：**≤ 171px**（`compress_furniture_deco_pngs.py`）  
- 房壳：**不强制 171**，按现有 house 壳惯例  

---

## 10. Prompt 文件清单（待撰写）

| 文件 | 用途 |
|------|------|
| `worldmap_thumb_flower_farm_house_nb2_prompt.txt` | 大地图节点 |
| `house_bg_room_flower_farm_cottage_nb2_prompt.txt` | 默认房壳 |
| `house_bg_room_flower_farm_spring_vine_nb2_prompt.txt` | 换色房壳 |
| `furniture_farm_vegetable_patch_rug_nb2_prompt.txt` | 菜毯 |
| `furniture_farm_wooden_wheelbarrow_nb2_prompt.txt` | 手推车 |
| `furniture_farm_fruit_crate_stack_nb2_prompt.txt` | 果筐堆 |
| `furniture_farm_scarecrow_nb2_prompt.txt` | 稻草人 |
| `furniture_farm_hen_coop_nb2_prompt.txt` | 鸡舍 |
| `furniture_farm_hay_bench_nb2_prompt.txt` | 干草凳 |
| `furniture_farm_beehive_stand_nb2_prompt.txt` | 蜂箱 |

可选合图：`furniture_flower_farm_set_7sheet_nb2_prompt.txt`（4×2，仅当单件风格已锁定时使用）。

---

## 11. 验收标准

### 11.1 美术

- [ ] 大地图 thumb 在 **340px** 下可辨：栅栏 / 农舍 / 菜地至少 2 项  
- [ ] 房壳与花店现有壳 **视角一致**，默认壳室内可用面积 ≥ 茶寮壳 80%  
- [ ] 7 件家具 pastel 统一、**软棕线稿**，无写实照片风  
- [ ] 与茶香 **零视觉撞款**（无月洞门、博古架、青花）  

### 11.2 功能

- [ ] Lv29：节点可见但锁定；Lv30：显示花愿价签，可购买  
- [ ] 花愿不足 / 取消购买：Toast 正确  
- [ ] 购买后：`purchasedHouses` 持久化，再次点击直接进入  
- [ ] 装修面板左侧 Tab 显示「花田农舍」，仅本 scene 可见 7 件  
- [ ] Lv30 升级仪式出现 map 条目且 icon 正确  

### 11.3 性能

- [ ] 新增 PNG 总体积与梦云支线同量级（粗估 **< 800KB** deco + **< 200KB** panels thumb）  
- [ ] `check:deco-textures` 零缺失  

---

## 12. 风险与规避

| 风险 | 规避 |
|------|------|
| 被误解为「要玩农场」 | 购买确认文案写「解锁装修场景」，仪式 desc 强调「布置」 |
| 动物摆件引发动画预期 | 名称避用「牧场」；鸡舍描述写「静态观景点」 |
| 与 merge 果线重复 | 果筐做 **场景专属 scale/造型**，不用棋盘 item 图标直接贴 |
| 大地图坐标偏移 | thumb 先透明底叠加 PS 对齐后再定 `x/y` |
| Lv30 茶香家具与农舍同时解锁 | **有意为之**：茶香收尾 1 件（蒲团云台 Lv30）+ 农舍开启，层级不同（主屋 vs 支线） |

---

## 13. 后续扩展（非首版）

以下 **不在 v0.1** 范围，留作数据验证后迭代：

- 第 3 件换色壳「秋收金麦」（Lv34）  
- 家具工坊：干草包、铁艺浇水壶配方  
- 与 `tool_farm_4` 联动的 **限定 quest 赠予** 1 件（`starValue: 0`）  
- 大地图静态底图补画农舍地基  

---

## 14. 工作量粗估

| 阶段 | 人天 |
|------|------|
| Prompt + NB2 生图迭代 | 2–3 |
| 抠图 / 压缩 / 验收 | 1 |
| 工程配置 + 自测 | 0.5 |
| **合计** | **约 3.5–4.5 人天** |

---

## 附录 A：`DecorationConfig` 登记草稿

```typescript
// ROOM_STYLES
{ id: 'style_flower_farm_cottage_nb2', name: '暖木农舍', cost: 0, starValue: 0, rarity: DecoRarity.COMMON,
  bgTexture: 'bg_room_flower_farm_cottage_nb2', desc: '花田农舍默认壳：单层暖木 cutaway、麦色地坪与方格木窗',
  allowedSceneIds: ['flower_farm_house'] },
{ id: 'style_flower_farm_spring_vine_nb2', name: '青藤春棚', cost: 72000, starValue: 8, rarity: DecoRarity.FINE,
  bgTexture: 'bg_room_flower_farm_spring_vine_nb2', desc: '春日换色壳：常春藤爬墙、浅绿木瓦与 mint  spring 氛围',
  unlockRequirement: { level: 32 }, allowedSceneIds: ['flower_farm_house'] },

// DECO_DEFS — 见 §6 表；decorationPanelTab: 'flower_room'；allowedSceneIds: ['flower_farm_house']
```

## 附录 B：`WorldMapConfig` 节点草稿

```typescript
export const FLOWER_FARM_HOUSE_UNLOCK_LEVEL = 30;
export const FLOWER_FARM_HOUSE_PURCHASE_COST = 180000;

// MAP_NODES 追加：
{
  id: 'flower_farm_house',
  type: 'house',
  label: '花田农舍',
  x: 1760,
  y: 920,
  thumbKey: 'worldmap_thumb_flower_farm_house',
  thumbSize: 340,
  unlockLevel: FLOWER_FARM_HOUSE_UNLOCK_LEVEL,
  purchaseCost: FLOWER_FARM_HOUSE_PURCHASE_COST,
  useLiveMapThumb: false,
  targetSceneId: 'flower_farm_house',
},
```

---

**下一步建议**：先过一遍 §6 家具清单与 §5 房壳结构 → 确认后进入 **Phase A** 撰写 thumb + 默认壳 prompt 并出试稿图。
