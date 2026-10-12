# 限时活动：兑换框架与素材归档

清凉一夏、金秋丰收这类「订单产货币 → 活动页兑换」的活动共用一套代码，每期只换**主题配置 + 素材**。

## 代码结构

| 文件 | 作用 |
|---|---|
| `src/config/events/exchange/ExchangeEventTheme.ts` | 主题类型：时间、获取规则、分类与商品、素材、文案、配色、面板布局 |
| `src/config/events/exchange/themes/<id>.ts` | 每期一个主题文件 |
| `src/config/events/exchange/themes/<id>.art.ts` | 该期素材 key → 路径（无依赖，TextureCache 会直接读） |
| `src/config/events/exchange/ExchangeEventArtRegistry.ts` | **`ACTIVE_EXCHANGE_SEASON_ID`：当期开关，只改这一行** |
| `src/config/events/exchange/ExchangeEventRegistry.ts` | 登记所有主题；非当期的自动进入「已下线」列表，用于旧存档结算 |
| `src/managers/ExchangeEventManager.ts` / `src/gameobjects/ui/ExchangeEventPanel.ts` | 通用逻辑与面板，不含任何一期的文案或 key |
| `src/config/events/SeasonalItemRegistry.ts` | 限时棋盘物品线：活动期内开放登记的入口，到期换成花愿 |

存档字段为 `exchangeEvent`（带 `seasonId`）。读档发现是上一期且货币未结算时，按上一期的汇率换成花愿，再以当期空状态开始。旧版 `coolSummerEvent` 字段只读不写。

## 开新一期

1. **复制主题**：`themes/goldenAutumn2026.ts` + `.art.ts` 复制改名，改 `seasonId`、时间、货币名、获取规则、商品、文案、配色。
2. **登记**：`.art.ts` 加进 `EXCHANGE_ART_BY_SEASON`；主题加进 `ALL_EXCHANGE_THEMES`。
3. **出素材**（NB2，流程见 `game-art-asset-flow.mdc`）：入口图标、货币图标（主包 `images/ui/`，128px，量化）；面板壳（`subpkg_events/images/<id>/ui/`，绿幕，复制 `process_golden_autumn_event_panel_shell_nb2.py` 改路径）；活动家具登记 `DecorationConfig`（`starValue: 0`）、图纸登记 `FurnitureWorkshopConfig`、贴图登记 `TextureCache` 的 `DECO_IMAGE_MAP`。
4. **量面板布局**：按新壳体实测奶油区和关闭钮，填主题 `layout`。
5. **切当期**：改 `ACTIVE_EXCHANGE_SEASON_ID`。
6. **归档上一期**：写 `docs/events/archive/<上一期>.json`，跑 `python3 scripts/event_assets.py archive <上一期>`。
7. **验收**：`npm run check:exchange-event`、`npm run check:assets`、`npm run check:deco-textures`、`npm run build`；GM「打开当前兑换活动」走一遍入口、面板、订单徽章、飞货币、购买、分类领奖、红点。
8. 写 `docs/events/<id>.md`（格式参照 `golden_autumn_2026.md`）。

本期如果新增棋盘合成物品（类似中秋月饼），在主题里加 `seasonalItems`：`category`、`line`、`surfaces`。时间用主题自己的开始和结束。`surfaces` 只写活动期内允许出现的入口：`produce` 产出、`orders` 订单、`shop` 商店、`gacha` 许愿喷泉、`collection` 图鉴、`bubbles` 花语泡泡。没写上的入口，活动期内也不出现。到期后入口全部关闭，棋盘、仓库、收纳盒、花语泡泡和宝箱队列里剩下的按订单花愿换成花愿，并弹一次提示。转盘主题同样写 `seasonalItems`，登记时会一起收进 `SeasonalItemRegistry`。

## 素材归档 / 复刻

下线活动的入口、货币、面板壳不进游戏包，存放在仓库外：

```
../game_assets/huahua/archive/events/<seasonId>/
  minigame/...            与包内相同的相对路径
  manifest.lock.json      文件清单 + sha256
```

清单在 `docs/events/archive/<seasonId>.json`（`files` 相对 `minigame/`，支持 `dir/**`）。

```bash
python3 scripts/event_assets.py status  cool_summer_2026
python3 scripts/event_assets.py archive cool_summer_2026 [--dry-run]   # 复制 → 校验 → 删包内
python3 scripts/event_assets.py restore cool_summer_2026 [--dry-run]   # 拷回 minigame/
```

**复刻兑换类活动**（如清凉一夏）：`restore` → 主题里改新时间 → 改 `ACTIVE_EXCHANGE_SEASON_ID`。素材 key 跟着主题自动登记，不用改 TextureCache。

**复刻转盘活动**（如月满中秋）：`restore <seasonId>` → 主题里改新时间 → 改 `ACTIVE_WHEEL_SEASON_ID` → 把 `WHEEL_ASSETS_IN_PACKAGE` 改成 `true`。素材未进包时这个开关保持 `false`，入口和转盘图只登记在 `ARCHIVED_IMAGE_MAP`，启动时不会去加载缺文件。

活动家具、店主套装、物品图**不归档**：玩家已经拥有，删了会显示不出来。

## 已归档

| seasonId | 名称 | 类型 | 清单 |
|---|---|---|---|
| `cool_summer_2026` | 清凉一夏 | 兑换 | `archive/cool_summer_2026.json` |
| `mid_autumn_2026` | 月满中秋 | 转盘 | `archive/mid_autumn_2026.json` |

## 转盘框架

月满中秋这类「订单产货币 → 转盘抽奖」的活动共用一套代码，每期只换主题配置和素材。

| 文件 | 作用 |
|---|---|
| `src/config/events/wheel/WheelEventTheme.ts` | 主题类型：时间、花费、奖品、订单产出、烤箱附加产线、专属客人、文案、配色、布局 |
| `src/config/events/wheel/themes/<id>.ts` | 每期一个主题文件 |
| `src/config/events/wheel/themes/<id>.art.ts` | 该期素材 key → 路径（无物品配置依赖，TextureCache 会直接读） |
| `src/config/events/wheel/WheelEventArtRegistry.ts` | **`ACTIVE_WHEEL_SEASON_ID`：当期开关。`WHEEL_ASSETS_IN_PACKAGE`：素材是否已进包** |
| `src/config/events/wheel/WheelEventRegistry.ts` | 登记所有主题；非当期的进入已下线列表，用于旧存档结算 |
| `src/managers/WheelEventManager.ts` / `src/gameobjects/ui/WheelEventPanel.ts` | 通用逻辑与面板 |

存档字段为 `wheelEvent`（带 `seasonId`）。旧档 `midAutumnEvent` 只读不写。读到上一期且货币未结算时，按那一期的汇率换成花愿。客人身上的 `midAutumnLanternReward` 和订单类型 `midAutumnChangE` 仍可读，新订单写成 `wheelFeatured`。

开新一期：复制 `themes/midAutumn2026.ts` 和 `.art.ts`，改 `seasonId`、时间、货币、`spinCosts`、`rounds`、`orderEarn`、`produceBonus`、`featuredCustomer`、`seasonalItems`、文案和配色。登记进 `WHEEL_ART_BY_SEASON` 和 `ALL_WHEEL_THEMES`，再改 `ACTIVE_WHEEL_SEASON_ID`。素材进 `minigame` 后把 `WHEEL_ASSETS_IN_PACKAGE` 改成 `true`。GM 用「打开当前转盘活动」。验收仍跑 `npm run check:exchange-event`（里面一并检查转盘主题）。
