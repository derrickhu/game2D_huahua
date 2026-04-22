---
name: 熟客友谊卡 + 图鉴系统
overview: 把当前「订单交付 +1/+2 Bond 累计」的纯数值熟客系统，重做成「订单交付 → 概率掉落分稀有度的友谊卡片 → 卡片自带积分推 Bond + 解锁微剧情 → 全卡收齐解锁图鉴成就」。保留 BondLevel 1~5 骨架与原有 milestone 奖励，所有改造**向后兼容**老存档。先做 1 位熟客（小诗）走通流程，再铺到 5 位。
todos:
  - id: balance-tune
    content: P0 调速 — BOND_THRESHOLDS 翻倍 + exclusiveOrderChanceByLevel 早期段下调，先把"45 分钟到顶"改掉
  - id: card-config
    content: 新建 src/config/AffinityCardConfig.ts — 卡片定义、稀有度枚举、掉落表、5 客人卡册数据
  - id: card-manager
    content: 新建 src/managers/AffinityCardManager.ts — 抽卡 / 收集 / 重复转碎片 / 保底 / 存档迁移 / GM
  - id: hook-deliver
    content: AffinityManager.onCustomerDelivered 接入 AffinityCardManager.rollCardDrop；卡片入账 + 同步 Bond 积分
  - id: drop-popup
    content: 新建 src/gameobjects/ui/AffinityCardDropPopup.ts — 抽卡翻牌动画（N/R/SR/SSR 四档差异化光效）
  - id: codex-panel
    content: 新建 src/gameobjects/ui/AffinityCodexPanel.ts — 5 客人 Tab + 卡片网格 + 已得/未得灰显 + 详情子页
  - id: profile-entry
    content: CustomerProfilePanel 增加「卡册」按钮入口；徽章显示 N/M 收集进度
  - id: shard-shop
    content: 「友谊点商店」— 重复卡转碎片、碎片换指定稀有度卡包 / Bond 直升道具
  - id: codex-achievement
    content: 单人全卡 → 专属称号 / 限定家具 / Lv5 buff +20%；5 人全收齐 → 总成就大徽章
  - id: art-pipeline
    content: 卡片立绘资源管线：N 用现有立绘 + 滤镜，R/SR 复用立绘 + 道具 + 色调，SSR 重画（每人 1~2 张），统一 NB2 prompts → birefnet
  - id: cloud-sync
    content: huahua_affinity_cards 加入 CloudConfig allowlist；与 huahua_affinity 同源迁移
  - id: gm-tools
    content: GMManager 新增「卡牌系统」分组：模拟掉卡 / 强发指定卡 / 一键全收 / 重置图鉴 / 切赛季
  - id: season-system
    content: 赛季框架 — SeasonConfig.ts 定义 S1~Sn 的客人池/起止时间/奖励；旧赛季客人订单照常但不掉卡；未集齐卡跨季转通用碎片
---

# 熟客友谊卡 + 图鉴系统

## 1. 设计决策摘要

| 项 | 决策 | 备注 |
|----|------|------|
| 是否保留 Bond 5 级 | **保留** | UI/玩家心智已建立；改的是"如何加 Bond 点" |
| Bond 点来源 | **不再每单 +1**，改为：**该熟客订单 → 概率掉卡 → 卡片自带积分推 Bond** | 同一笔交付：要么掉卡（积分计入），要么不掉（不加 Bond），保持 1:1 不重复发奖 |
| 卡片稀有度 | **N / R / SR / SSR** | 占比 70/22/7/1，积分 1/3/8/25 |
| 每位熟客卡数 | **12 张**（先期）| N×6 / R×3 / SR×2 / SSR×1，5 人共 60 张；空间预留扩到 15 张 |
| 重复卡 | 转 **「友谊点」**（碎片），可在熟客资料卡内的小商店换指定稀有度卡包或 Bond 直升 | 避免歪卡党彻底卡死 |
| 抽卡 UI | 翻牌特效 + 稀有度光环差异化（金/紫/蓝/灰白） | 复用 ItemObtainOverlay 部分组件 |
| 图鉴 UI | 5 客人 Tab + 6×2 卡格网格 + 详情子页 | 未得灰底剪影；得到后可点击看大图 + 文案 |
| 全卡奖励 | **Lv5 buff +10% → 全卡 +20%**；解锁专属称号 / 限定家具（独立于 Bond Lv4 的 5 件） | 全 5 人卡齐 → 总成就 + 大地图新建筑预留 |
| 美术成本 | N: 现有立绘 + 微表情滤镜；R/SR: 立绘 + 场景道具叠加（同一原画 + 不同合成）；**仅 SSR 重画**（5 张） | 总美术增量约 5 张精绘 + 60 张合成图，可控 |
| 文案量 | 每张卡 1~3 句微剧情，5×12=60 段，约 2 千字 | 单人 demo 走通后批量写 |
| 兼容老存档 | `huahua_affinity` 不动；新加 `huahua_affinity_cards`；老玩家进入时按当前 Bond 等级**回填**对应 N/R 卡（推断而非凭空发） | 见 §6 |
| 付费风险 | **卡包不卖**，仅免费掉落 + 活动派发 | 守住治愈调性 |

## 2. 数据 Schema（新文件）

### 2.1 `src/config/AffinityCardConfig.ts`

```ts
export type CardRarity = 'N' | 'R' | 'SR' | 'SSR';

/** 单张卡的积分（合并入 Bond 累计点） */
export const CARD_RARITY_POINTS: Record<CardRarity, number> = {
  N: 1, R: 3, SR: 8, SSR: 25,
};

/** 抽到时的稀有度概率分布 */
export const CARD_RARITY_DROP_WEIGHTS: Record<CardRarity, number> = {
  N: 70, R: 22, SR: 7, SSR: 1,
};

/** 一次"是否掉卡"的概率 */
export const CARD_DROP_BASE_CHANCE = 0.35;            // 普通单：35% 掉卡（1 张）
export const CARD_DROP_EXCLUSIVE_CHANCE = 0.85;       // 专属单：85% 掉卡（1~2 张）
export const CARD_DROP_EXCLUSIVE_BONUS_RARITY = 1;    // 专属单稀有度档位 +1

/** 重复卡转友谊点 */
export const SHARD_PER_DUP: Record<CardRarity, number> = {
  N: 1, R: 3, SR: 8, SSR: 25,
};

/** 友谊点商店物品定价（碎片成本） */
export const SHARD_SHOP = {
  /** 指定稀有度卡包（从该客人未得卡里抽，必出该稀有度） */
  guaranteedPack: { N: 5, R: 18, SR: 60, SSR: 220 } as Record<CardRarity, number>,
  /** Bond 直升 1 等的道具（仅 Lv1~4 使用） */
  bondPushItem: 100,
} as const;

/** 单卡定义 */
export interface AffinityCardDef {
  /** 主键，建议 `card_<typeId>_<idx>`，例 `card_student_01` */
  id: string;
  ownerTypeId: string;          // 'student' / 'worker' / ...
  rarity: CardRarity;
  title: string;                // 卡片名（4~10 字）
  /** 微剧情正文（1~3 句，120 字内）；详情页展示 */
  story: string;
  /** 卡面美术 key（TextureCache）；缺省 → fallback 到 customer_xxx + 滤镜 */
  artKey?: string;
  /** 解锁的额外内容（可选） */
  unlocks?: {
    /** 解锁该熟客的额外语录（CustomerView 偶发气泡） */
    quoteId?: string;
    /** SSR 专属：解锁限定家具 deco id */
    decoId?: string;
  };
}

/** 5 客人完整卡册（按解锁顺序排列） */
export const AFFINITY_CARDS: AffinityCardDef[] = [
  // ── 小诗 student ──
  { id: 'card_student_01', ownerTypeId: 'student', rarity: 'N',
    title: '放学路过', story: '小诗刚下数学课，脚步轻快地路过窗前。' },
  { id: 'card_student_02', ownerTypeId: 'student', rarity: 'N',
    title: '便利贴', story: '门把上贴了张便利贴：「老板，今天那束粉康乃馨真好看~」' },
  // ... 共 12 张
  { id: 'card_student_12', ownerTypeId: 'student', rarity: 'SSR',
    title: '毕业日的花束', story: '毕业日清晨，小诗推门进来定了 27 朵向日葵...',
    artKey: 'card_student_ssr_graduation',
    unlocks: { decoId: 'affinity_student_yearbook' } },
  // 其他 4 客人同理...
];
```

### 2.2 接入点配置

```ts
// AffinityConfig.ts 内追加（不改原有）
/** 老存档迁移：按当前 Bond 等级回填多少张该等级以下的 N/R 卡 */
export const LEGACY_BOND_TO_CARDS_MAP: Record<BondLevel, { N: number; R: number; SR: number }> = {
  1: { N: 1, R: 0, SR: 0 },
  2: { N: 3, R: 1, SR: 0 },
  3: { N: 5, R: 2, SR: 0 },
  4: { N: 6, R: 3, SR: 1 },  // 已发的 Lv4 主题家具不影响
  5: { N: 6, R: 3, SR: 2 },  // 留 SSR 给未来抽
};
```

## 3. Manager API（新文件）

### 3.1 `src/managers/AffinityCardManager.ts`

```ts
class AffinityCardManagerClass {
  init(): void;

  /** 由 AffinityManager.onCustomerDelivered 调用；不直接由 CustomerManager 调 */
  rollCardDrop(typeId: string, isExclusive: boolean): {
    droppedCards: AffinityCardDropResult[];     // 0~2 张
    addedBondPoints: number;                    // 卡片转换的 Bond 点（同步给 AffinityManager）
  };

  /** 是否拥有该卡 */
  has(cardId: string): boolean;
  /** 取一个客人的全卡（含未得，按稀有度排） */
  listCards(typeId: string): Array<AffinityCardDef & { obtained: boolean; obtainedAt?: number; dupCount: number }>;
  /** 收集进度（含/不含 SSR） */
  progress(typeId: string): { obtained: number; total: number; byRarity: Record<CardRarity, [number, number]> };
  /** 是否全卡收齐 */
  isComplete(typeId: string): boolean;

  /** 友谊点 */
  getShards(typeId: string): number;
  spendShards(typeId: string, amount: number): boolean;

  /** 商店：消耗碎片必出该稀有度 */
  redeemPack(typeId: string, rarity: CardRarity): AffinityCardDropResult | null;
  /** 商店：碎片换 Bond 直升 1 等 */
  redeemBondPush(typeId: string): boolean;

  /** GM */
  gmGrantCard(cardId: string): void;
  gmGrantAllForType(typeId: string): void;
  gmReset(): void;
}

interface AffinityCardDropResult {
  card: AffinityCardDef;
  isDuplicate: boolean;
  shardGain: number;          // 重复时 = SHARD_PER_DUP[rarity]，否则 0
  bondPoints: number;         // = CARD_RARITY_POINTS[rarity]，仅"非重复"时计入 Bond
}
```

### 3.2 关键算法

**抽卡流程**（每次该熟客订单交付）：

```
1. baseChance = isExclusive ? 0.85 : 0.35
2. 若 random ≥ baseChance → 不掉卡，return { dropped: [], bondPoints: 0 }
3. 决定稀有度：从 CARD_RARITY_DROP_WEIGHTS 加权随机
   - 若 isExclusive，先把档位 +1（N→R, R→SR, SR→SSR, SSR→SSR）
   - 保底：累计 30 次抽卡未出 SR/SSR → 强制升 SR；累计 100 次未出 SSR → 强制 SSR
4. 在该客人卡池中 [按 rarity 过滤]
   - 优先未得卡：均匀随机
   - 全部已得：标记 isDuplicate=true，随机选一张（积分按重复给碎片）
5. 专属单触发额外 30% 概率第二张卡（最多 2 张/单）
```

**Bond 积分同步**：

```
AffinityManager.onCustomerDelivered(typeId, opts):
  oldPoints = state.points
  cardResult = AffinityCardManager.rollCardDrop(typeId, opts.isExclusive)

  // 新规则：Bond 点 = 卡片积分总和（无卡 = 0 点）
  // 兼容旧规则：若 Card 系统未启用（dev flag off），fallback 回 +1/+2
  state.points = oldPoints + cardResult.addedBondPoints
  state.bond = bondLevelFromPoints(state.points)
  ...
```

## 4. UI 组件设计

### 4.1 `AffinityCardDropPopup`（抽卡翻牌动画）

- **触发**：`EventBus.on('affinityCard:dropped', ({ typeId, results }) => popup.show(...))`
- **形态**：全屏遮罩（黑 0.7）+ 居中翻牌
- **动效**：
  1. 卡背从远景飞入（0.3s + 旋转 360°）
  2. 翻面（scaleX: 1 → 0 → 1，midpoint 切贴图）
  3. 稀有度光环：N 灰白 / R 蓝 / SR 紫 / SSR 金 + 散射光（复用 ItemObtainOverlay 的 sunburst）
  4. SSR 额外粒子 / 屏闪
- **多张连抽**：依次播放，可点击跳过；最后显示"获得 / 重复（+N 友谊点）"汇总
- **关闭**：单击空白 → 飞向右上"图鉴"入口

### 4.2 `AffinityCodexPanel`（图鉴）

- **入口**：`MerchShop` 主场景挂"熟客图鉴"按钮（与"任务"按钮同列）
- **布局**：
  - 顶部 Tab：5 张客人头像（未解锁灰显 + 锁图标）+ 当前 Tab 进度条 `8 / 12`
  - 中部 6×2 卡片网格：未得显**剪影 + ?**；已得显小图 + 标题
  - 底部摘要：稀有度收集进度条 + 友谊点显示
  - 右上"友谊点商店"按钮 → 弹子页
- **卡片详情子页**（点击已得卡）：
  - 卡面大图 + 标题 + 稀有度徽章
  - 故事正文（PIXI.Text + 滚动）
  - 解锁日期 + 拥有数（含重复）
  - 关闭返回网格

### 4.3 `CustomerProfilePanel` 增量

- 在 Bond 进度条下方加"卡册收集 8/12"行 + "查看图鉴" 按钮
- 点击 → 直接跳转到 CodexPanel 并定位到该客人 Tab

### 4.4 `ShardShopPanel`（友谊点商店）

- 子面板（在 CodexPanel 内打开），四种购买项：
  - 指定 N 卡包（5 碎片）
  - 指定 R 卡包（18 碎片）
  - 指定 SR 卡包（60 碎片）
  - 指定 SSR 卡包（220 碎片）
  - Bond 直升 1 等（100 碎片，Lv1~4 限用）

## 5. 接入点 / 改动清单

| 文件 | 改动 |
|------|------|
| `src/config/AffinityConfig.ts` | 新增 `LEGACY_BOND_TO_CARDS_MAP`；保留 `BOND_THRESHOLDS`；可选调整 `BOND_GAIN_NORMAL/EXCLUSIVE` 为 0（让卡片成为唯一来源） |
| `src/config/AffinityCardConfig.ts` | **新文件**，60 张卡数据 |
| `src/managers/AffinityManager.ts` | `onCustomerDelivered` 改为先调 `AffinityCardManager.rollCardDrop`，用其返回的 `addedBondPoints` 替代固定 +1/+2；保留 GM 路径兼容 |
| `src/managers/AffinityCardManager.ts` | **新文件** |
| `src/scenes/MainScene.ts` | 注册 `AffinityCardManager.init()`；监听 `affinityCard:dropped` 弹 popup |
| `src/gameobjects/ui/AffinityCardDropPopup.ts` | **新文件** |
| `src/gameobjects/ui/AffinityCodexPanel.ts` | **新文件** |
| `src/gameobjects/ui/ShardShopPanel.ts` | **新文件**（小子页） |
| `src/gameobjects/ui/CustomerProfilePanel.ts` | 增"卡册收集"行 + 跳转按钮 |
| `src/gameobjects/MerchShopScene` 或 `src/gameobjects/ui/MainTopBar.ts` | 加"图鉴"入口 |
| `src/config/CloudConfig.ts` | allowlist 加 `huahua_affinity_cards` |
| `src/utils/TextureCache.ts` | 注册 60+ 张卡面 key（按 `card_<typeId>_<rarity>_<slot>` 命名） |
| `src/managers/GMManager.ts` | 新增「卡牌系统」分组：`gm_card_drop_simulate(typeId, n)` / `gm_card_grant_all(typeId)` / `gm_card_reset` |

## 6. 老存档迁移 / 兼容

**问题**：现有玩家可能 Bond 已到 Lv5，直接重置成 0 卡很伤。

**方案**：`AffinityCardManager.init()` 检测到 `huahua_affinity_cards` 不存在但 `huahua_affinity` 存在时：

```
对每位 unlocked 熟客：
  按其当前 Bond 等级查 LEGACY_BOND_TO_CARDS_MAP
  从该客人卡池中：
    - 随机选 N 张 N 卡（按表）→ 标记已得
    - 随机选 N 张 R 卡 → 标记已得
    - 选 SR/SSR：仅在 Bond=4/5 时给 1 张 SR
  写入 huahua_affinity_cards
  打日志：[AffinityCardMigration] 小诗 Bond5 → 6N/3R/2SR
```

**关键**：迁移**不补发**任何奖励（Bond Lv2~5 的 milestoneRewards 已发过）；迁移只是补"图鉴看起来不空"。

**反作用**：玩家不会感觉"系统更新被剥夺进度"，反而会有"咦我已经收集了不少"的小惊喜。

## 7. 数值平衡（预估）

**目标**：单熟客活跃 ~3 小时到 Bond Lv5（约 100~120 单交付）。

样本计算（小诗，玩家 L4 单熟客）：

```
20 分钟 ≈ 60 单中：
  专属单 6 单 × 0.85 = 5.1 张卡（中位 R 档）
  普通单 8 单（小诗占比） × 0.35 = 2.8 张卡（中位 N 档）
  → 8 张卡 / 20 分钟，平均稀有度按权重期望 ≈ 1×0.7 + 3×0.22 + 8×0.07 + 25×0.01 = 2.17 分/卡
  → 17.4 Bond 点 / 20 分钟

到 Lv5（55 点）：~63 分钟
```

**比"45 分钟到顶"略慢，但每张卡都有翻牌惊喜，体感差距巨大。**

如想再拉长（拉到 3 小时），把 `BOND_THRESHOLDS` 调到 `5/25/60/130/250`，或把 `CARD_DROP_BASE_CHANCE` 降到 0.25。

5 客人都解锁后（专属单分摊到 1/5）：约 5~7 小时 / 人到 Lv5，符合"长期收集"定位。

## 8. 美术资产规划

### 8.1 命名规范

```
minigame/subpkg_chars/images/affinity_cards/
  card_student_n_01.png       # N 卡：基础立绘 + 滤镜（青色调）
  card_student_n_02.png
  ...
  card_student_r_01.png       # R 卡：立绘 + 道具贴纸（如校园书包）
  card_student_sr_01.png      # SR 卡：场景化合成（教室 / 操场背景）
  card_student_ssr_01.png     # SSR 卡：重画原画（毕业日花束特写）
```

### 8.2 生产流水线

| 卡档 | 生产方式 | 单张工时 |
|------|----------|----------|
| N（30 张） | 现有 customer_<typeId>.png 套滤镜 / 微表情贴 + 圆角卡框 → 脚本批处理 | 10 分钟 |
| R（15 张） | 现有立绘 + 道具贴纸（NB2 单独生道具，rembg 后合成） | 25 分钟 |
| SR（10 张） | NB2 整张场景化生图（半身像 + 主题背景），rembg 后套卡框 | 1 小时 |
| SSR（5 张） | **专门精绘**，每位熟客 1 张，NB2 + 人工调整 + 高清留存 | 2 小时 |

**总美术工时**：约 5 + 25 + 10 + 10 = 50 小时（可分两周做）。

### 8.3 卡框样式

- 统一卡框（一张通用 PNG）+ 稀有度边色：N 灰、R 蓝、SR 紫、SSR 金 + 烫金描边
- 卡框生图 prompt：先做一张通用底框 nb2 → 在代码内染色

## 9. 分期实施

### P0 · 调速与脚手架（1~2 天）

1. 修改 `BOND_THRESHOLDS`（5/15/30/55 → 5/20/50/100/200）
2. `exclusiveOrderChanceByLevel` 早期 0.20 → 0.15
3. 把 `BOND_GAIN_NORMAL/EXCLUSIVE` 抽成可关闭的开关，准备让 Card 系统接管
4. **不影响线上**，纯数值

### P1 · 单熟客 demo（5~8 天）

1. AffinityCardConfig.ts 写完小诗 12 张卡（文案 + 稀有度）
2. AffinityCardManager 全量实现 + 单元测试覆盖关键路径
3. AffinityCardDropPopup（含 4 档动效）
4. AffinityCodexPanel（仅小诗 Tab；其余 Tab 灰显占位）
5. CustomerProfilePanel 增"卡册"行
6. 12 张小诗卡美术（其中 SSR 1 张精绘）
7. GM 工具
8. 老存档迁移（仅小诗）

**验收标准**：
- 玩家完成 100 单小诗交付能凑齐 ~10 张卡
- SSR 翻牌有"哇"的反馈
- 图鉴页能正确显示已得/未得 + 详情

### P2 · 铺量到 5 位（5~10 天）

1. 其他 4 位每人 12 张卡（48 张文案 + 美术）
2. CodexPanel 5 Tab 全开
3. ShardShopPanel
4. 全图鉴成就（单人 + 总成就）

### P3 · 后续运营（按需）

- 限定卡（春节、七夕、周年）
- 联动家具风格（新熟客解锁时同步出 12 张卡）
- 卡片置顶展示（CustomerView 头顶气泡里偶发显示已收藏的台词）

## 10. 已拍板决策（用户拍板，2026-04-22）

| Q | 决策 |
|---|------|
| Q1 Bond 积分来源 | **完全切换为卡片**（旧 +1/+2 留 fallback，默认禁用） |
| Q2 图鉴入口 | **MerchShop 顶栏新按钮"图鉴"**，与"任务"并列 |
| Q3 SSR 是否解锁限定家具 | **是** — 每位 1 张 SSR → 1 件赛季限定家具 |
| Q4 卡包外发 | **是** — 签到 7 日里程碑送 N 卡包，节日活动给 SR/SSR 卡包 |
| Q5 重复卡上限 | **改为赛季制**（见 §11） |

---

## 11. 赛季制（重要：替代"无限累积")

### 11.1 设计目标

- **稀缺感**：限时窗口内才能掉某客人的卡；过了赛季无论怎么打都得不到（除特殊复刻周）
- **完成动机**：满图鉴 = 大奖；没集齐 = 阶梯小奖（避免完全空手而归）
- **避免疲劳**：每季只 3~4 位新客人，文案/美术压力可控
- **新老玩家公平**：新进玩家可在当季内补齐当季所有卡；错过的赛季只能等"复刻周"

### 11.2 季度框架

```ts
// src/config/AffinitySeasonConfig.ts
export interface AffinitySeason {
  id: string;                          // 'S1' / 'S2' / ...
  name: string;                        // '初春繁花季' / '盛夏烟火季'
  startTs: number;                     // ms 时间戳；线上从 RemoteConfig 拉
  endTs: number;
  /** 本季新客人 typeIds（未来可加常驻位） */
  customerTypeIds: string[];
  /** 满图鉴大奖（永久解锁） */
  fullCollectionReward: {
    decoUnlockId: string;              // 季度限定家具大件
    title: string;                     // 永久称号
    portraitKey: string;               // 季度纪念立绘
    permanentBuff?: { type: 'global_huayuan_pct'; value: number };
  };
  /** 阶梯奖励（按收集数 / 总数百分比） */
  tieredRewards: Array<{
    threshold: number;                 // 0.25 / 0.50 / 0.75
    rewards: { huayuan?: number; diamond?: number; flowerSignTickets?: number };
  }>;
}

export const AFFINITY_SEASONS: AffinitySeason[] = [
  {
    id: 'S1', name: '初春繁花季',
    startTs: ..., endTs: ..., // 60 天
    customerTypeIds: ['student', 'worker', 'mom', 'youth'], // 首发 4 位
    fullCollectionReward: { ... },
    tieredRewards: [
      { threshold: 0.25, rewards: { huayuan: 500 } },
      { threshold: 0.50, rewards: { huayuan: 1000, diamond: 20 } },
      { threshold: 0.75, rewards: { huayuan: 2000, diamond: 50, flowerSignTickets: 5 } },
    ],
  },
  // S2 后续配
];
```

### 11.3 赛季切换行为

**当季内（赛季活跃）**：
- 该客人订单交付 → 正常掉卡
- 重复卡 → 转**赛季碎片**（仅本季商店可用）
- 满图鉴 → 立刻发奖 + 永久记录

**赛季结束（结算窗口 7 天）**：
- 该客人订单仍出现，但**完全不再掉卡**
- 弹"S1 结算"面板：显示完成度（X/Y）+ 阶梯奖励一次性发放
- 玩家可在结算窗口内最后一次用赛季碎片兑换（保底买卡）
- 结算窗口结束 → 未用完的赛季碎片**按 1:2 转通用碎片**（保留价值，避免完全归零）

**赛季结束后（永久状态）**：
- 该客人在 CodexPanel 显示"S1 已闭幕"标识 + 收藏完成度（永久可看）
- 未集齐卡：标记"残卷"，**不可再补**（除非复刻周）
- 已集齐卡的"满图鉴大奖"永久生效

### 11.4 复刻周（仅特殊节点）

- 周年庆 / 大版本前夕 开 1~2 周"复刻周"
- 旧赛季所有客人订单恢复掉卡（用通用碎片换）
- 复刻周也卖"限定 SSR 卡包"（用通用碎片，价格高）
- 平时无法补 → 错过的赛季是真的错过；复刻周给一次救济，但有代价

### 11.5 跨赛季客人处理细则

| 场景 | 行为 |
|------|------|
| S1 客人在 S2 期间 | 订单仍出现（保留世界感），但不掉卡，CodexPanel 锁定「S1 已闭幕」 |
| S1 客人 Bond 等级 | 维持，不重置；Lv5 +20% buff 永久 |
| S1 未用完的赛季碎片 | 结算窗口结束后 1:2 转通用碎片 |
| S1 未集齐卡 | 标"残卷"，可在复刻周补；CodexPanel 永久显示完成度 |
| 新玩家在 S2 进入游戏 | 看不到 S1 入口（除 CodexPanel 历史 Tab），S1 从未存在 |
| 新玩家在 S1 期间进入 | 当季所有客人随 L4-L7 解锁，正常追赶 |

### 11.6 通用碎片 vs 赛季碎片

```
赛季碎片：本季内重复卡产出，仅本季商店可用，赛季结束 1:2 转通用碎片
通用碎片：复刻周产出 / 跨季转化产出，永久通用，可在"通用商店"换 Bond 直升道具或复刻周卡包
```

### 11.7 首发赛季 S1 提案（已锁定）

| 项 | 值 |
|----|----|
| 名称 | 初春繁花季 |
| 周期 | **60 天**（startTs/endTs 走 RemoteConfig，本地兜底；切赛季 GM 必须有） |
| 客人 | **小诗 / 阿凯 / 林姐**（3 位）｜小景 + 小翼留作 S2 |
| 卡数 | 3 × 12 = **36 张**（N×6 / R×3 / SR×2 / SSR×1，每人） |
| 满图鉴大奖 | 限定家具「初春花园角」+ 永久称号"花花初心人" + 全局花愿 **+10%**（永久，纳入 §11.8 封顶） |
| 阶梯奖 | 25% / 50% / 75% 三档（huayuan / diamond / flowerSign） |
| 旧季行为 | S2 开始时这 3 位仍出现，但**不掉卡**；Bond Lv5 buff 永久保留 |
| 美术工时 | 约 30 小时（3 SSR 精绘 + 9 R/SR 合成 + 24 N 滤镜批处理） |

### 11.8 永久 buff 封顶规则（已锁定）

- 全部赛季满图鉴 buff 累加，**总上限 +30%**（封顶后再过赛季只给纪念称号 / 立绘，不再叠 buff）
- S1 +10% / S2 +10% / S3 +10% → 第 4 个赛季起 buff 不再叠加
- 若中途封顶，超出部分玩家收到一次性大额钻石补偿

### 11.9 复刻周机制（已锁定）

- **仅周年庆开复刻周**（每年 1~2 次，每次 1~2 周）
- 复刻周内：所有已结束赛季的客人订单恢复掉卡，使用**通用碎片**消费
- 复刻周限定 SSR 卡包：通用碎片大额（建议 500 碎片/SSR）
- 错过赛季的玩家有"年度补救机会"，但代价高，稀缺感不破

### 11.10 旧赛季客人行为（已锁定）

- 订单**仍出现**（保留世界感）
- 但**不掉卡**（CodexPanel 显示"已闭幕"标识）
- Bond Lv5 buff **永久保留**（已经获得的不再剥夺）
- 玩家可继续用其专属订单赚花愿、推动其他主线进度

---

## 12. 风险与回退策略

| 风险 | 缓解 |
|------|------|
| 美术工时超出预估 | P1 走通后视情况，可把 R/SR 改为"等比缩放 + 滤镜"过渡，先上线再补图 |
| 玩家觉得节奏更慢 | `CARD_DROP_BASE_CHANCE` 上调 + `BOND_THRESHOLDS` 下调，纯参数 |
| 重复卡焦虑 | 增加"已得卡灰显" 提示 + 商店保底（碎片必出指定档） + 赛季碎片转通用碎片救济 |
| 系统过重影响新玩家 | 玩家首次解锁 Affinity（L4）才"见到卡"；之前完全感受不到 |
| 旧存档玩家不爽 | 迁移自动回填，登入时弹"嗨，我们整理了你过去的回忆" 引导提示 |
| **赛季 FOMO 过重** | 提供 25/50/75% 阶梯奖（保底）+ 复刻周机制（救济）+ 残卷永久可见（情感留存） |
| **赛季时间线依赖远端** | startTs/endTs 优先从 RemoteConfig 拉，本地兜底；切赛季 GM 命令必须有 |
| **新玩家在赛季末进入** | 解锁该熟客后给"剩余 X 天"提示 + 当季 Onboarding 礼包（送 1 个 SR 卡包） |

回退：所有改动用 `AFFINITY_CARD_SYSTEM_ENABLED` 全局开关包住；线上发现重大问题可一键关掉，回到原 +1/+2 逻辑。赛季逻辑用 `AFFINITY_SEASON_ENABLED` 二级开关包；可单独关赛季只留卡片系统（退化为常驻图鉴）。
