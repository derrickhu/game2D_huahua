# 金秋丰收（2026）活动规格

限时兑换活动：甜品 / 果切订单产「枫叶」→ 在活动页兑换秋日补给、工坊材料和金秋家具。玩法框架与清凉一夏相同（通用兑换框架），只换了主题配置和素材。

主题配置：`src/config/events/exchange/themes/goldenAutumn2026.ts`（素材 key 在同目录 `goldenAutumn2026.art.ts`）。

## 时间与标识

| 项 | 值 |
|---|---|
| 赛季 ID | `golden_autumn_2026` |
| 活动名 | 金秋丰收 |
| 货币 | 枫叶 |
| 窗口 | 2026-10-15 00:00 ～ 2026-11-30 23:59（设备本地时区） |
| 结束后 | 剩余枫叶 1:1 结算为花愿 |

验收可用 GM「打开当前兑换活动（金秋丰收）」强制开启，不写进正式时间；「活动货币 +500 / +2000」「重置当前兑换活动」同组。

## 订单与枫叶

活动进行中，含以下物品的订单在客人卡上显示枫叶徽章，交付后飞向顶栏金秋入口：

- **甜品线**（`DrinkLine.DESSERT`，10 级）：按等级给 1 / 2 / 2 / 3 / 4 / 5 / 6 / 7 / 8 / 10
- **果切**（各果切线 L1–L3，按全局档位）：1 / 2 / 2 / 3 / 3 / 3 / 4 / 4 / 5 / 6 / 7 / 8 / 9 / 11 / 12
- 同一单**同时**含甜品和果切：总数 ×1.35

不新增物品、工具或客人。

## 兑换商店

每件限购 1 次；一个分类全部买完后可领分类奖励。

| 分类 | 商品 | 分类奖励 |
|---|---|---|
| 秋日补给 | 体力 400（120）/ 600（168）、花愿 2 万（96）/ 3 万（132）、钻石 15（48）/ 50（144） | 体力 300 + 钻石 30 |
| 工坊妙材 | 工坊材料 15（132）/ 30（240）、粉 / 黄 / 蓝 / 绿染料各 3（369） | 工坊材料 12 |
| 金秋珍藏 | 枫红拱窗图纸 348、枫叶落地灯 210、南瓜丰收推车 260、秋日格纹餐桌 280、栗子小烤炉 180 | 钻石 30 + 花愿 30000 |

价格和数量以主题配置为准。

## 活动家具

都是 `DecoRarity.LIMITED`、`cost: 0`、`starValue: 0`（防止摆放→拆除刷星），兑换后直接拥有。

| decoId | 名称 | 槽位 | defaultScale | 备注 |
|---|---|---|---|---|
| `event_golden_autumn_maple_floor_lamp` | 枫叶落地灯 | LIGHT | 1.35 | 落地大件 |
| `event_golden_autumn_pumpkin_cart` | 南瓜丰收推车 | ORNAMENT | 1.2 | 落地大件 |
| `event_golden_autumn_plaid_dining_table` | 秋日格纹餐桌 | TABLE | 1.28 | 落地大件 |
| `event_golden_autumn_chestnut_stove` | 栗子小烤炉 | ORNAMENT | 0.62 | 台面小物，显式 `depthSortFeetYFudge: 95` / `depthSortYLift: 140` |
| `workshop_maple_arch_window` | 枫红拱窗 | WALLART | 1.98 | 工坊专属；图纸 `blueprint_workshop_maple_arch_window`，材料 12、花愿 11200 |

## 素材

| 用途 | 路径（相对 `minigame/`） |
|---|---|
| 入口图标（主包） | `images/ui/icon_golden_autumn_event_nb2.png` |
| 货币图标（主包） | `images/ui/icon_golden_autumn_maple.png` |
| 面板壳（events 分包） | `subpkg_events/images/golden_autumn_event/ui/golden_autumn_event_panel_shell_nb2.png` |
| 家具（deco 分包） | `subpkg_deco/images/furniture/event_golden_autumn_*.png`、`workshop_maple_arch_window.png` |

- 提示词：`docs/prompt/golden_autumn_*_nb2_prompt.txt`、`docs/prompt/furniture_*golden_autumn*_nb2_prompt.txt`
- 原图：`../game_assets/huahua/assets/raw/golden_autumn/`（rembg 中间图在 `cut/`）
- 面板壳处理：`python3 scripts/process_golden_autumn_event_panel_shell_nb2.py`（绿幕洪水去底，680 宽）
- 图标 / 家具：rembg `birefnet-general` → 按 alpha 裁边 → 图标 128、家具最长边 256、拱窗高 380；主包图标再做 256 色量化
- 推广：`../game_assets/huahua/推广/金秋丰收/`（横版 1280×720、游戏圈 900×506）

## 入口

顶栏、店铺全景活动列、花店右侧活动钮（标签「金秋」）。面板：`ExchangeEventPanel`（壳体 + 程序化商品区，内容区 / 关闭钮位置见主题 `layout`）。

## 下线

活动结束后入口自动隐藏，剩余枫叶读档时 1:1 结算为花愿。下一期上线时按 `docs/events/README.md` 归档本期素材。
