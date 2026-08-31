# 月满中秋（2026）活动规格

限时活动：烤箱附加月饼产线 → 月饼订单产「玉兔灯」→ 转盘抽奖。活动专属客人「嫦娥」每天最多出现 2 次。

## 时间与标识

| 项 | 值 |
|---|---|
| 赛季 ID | `mid_autumn_2026` |
| 活动名 | 月满中秋 |
| 货币 | 玉兔灯 |
| 窗口 | 2026-08-14 00:00 ～ 2026-10-08 23:59（设备本地时区） |
| 结束后 | 剩余玉兔灯 1:1 结算为花愿 |

验收可用 GM「打开月满中秋」强制开启，不写进正式时间。

## 烤箱附加产线

活动进行中，已有烘焙工具（`ToolLine.BAKE`，小烤箱及以上）每次点击产出：

- **55%** 原甜品线
- **45%** 新月饼线 `DrinkLine.MOONCAKE`

活动结束后烤箱只出甜品。棋盘上剩余月饼仍可合成、交付已生成订单或出售。

不新增工具。玩家只要棋盘上有可产出烤箱，就会解锁月饼订单。

## 月饼合成线（8 级）

| 等级 | itemId | 名称 |
|---|---|---|
| 1 | `drink_mooncake_1` | 莲蓉小月饼 |
| 2 | `drink_mooncake_2` | 豆沙月饼 |
| 3 | `drink_mooncake_3` | 五仁月饼 |
| 4 | `drink_mooncake_4` | 蛋黄月饼 |
| 5 | `drink_mooncake_5` | 冰皮桂花月饼 |
| 6 | `drink_mooncake_6` | 鲜肉月饼 |
| 7 | `drink_mooncake_7` | 流心奶黄月饼 |
| 8 | `drink_mooncake_8` | 团圆大月饼 |

产出等级仍走烘焙工具原表，再按月饼满级 8 封顶。L8 需合成。

图标：单独圆月饼，不带盘子；各级靠皮、馅、花纹和体量区分，末级明显更大。

## 订单与玉兔灯

普通单 / 组合单**不出月饼**。月饼只出现在嫦娥专属单。

嫦娥单按最高月饼等级发玉兔灯：L1–L4 给 2 盏，L5–L8 给 4 盏。交付后飞向顶栏中秋入口。

## 专属客人：嫦娥

活动进行中、棋盘有可产出烤箱时，有概率刷出嫦娥（`chang_e`）：

- 每天最多 **4** 次，队列中同时最多 1 位
- 订单只能是 **A 或 S**
- **必含月饼**，一单可以有多个月饼
- A 单月饼 **L1–L4**，S 单月饼 **L5–L8**（不受烤箱等级限制，有可产出烤箱即可出 S）
- 其余槽走对应档普通池（花 / 饮品 / 果切）
- 花愿比同档其他订单多 **20%**
- 玉兔灯：A 单 2 盏，S 单 4 盏（按最高月饼等级）

GM「刷客人：嫦娥」可立刻验收。

## 转盘

- 三轮花费：**4 / 6 / 8** 玉兔灯
- **3 轮**，每轮 8 格；抽中的格子变灰，本轮不再抽到
- 一轮 8 格抽完后换下一轮，奖品逐轮加码
- 第 1 轮：体力×100 / 花愿×5000 / 钻石 / 工坊材料 / 粉色染料 / 幸运金币 / **月饼礼盒**
- 第 2 轮：体力×200 / 花愿×10000 / 黄色染料 / **万能水晶** / **团圆餐桌** / **玉兔玩偶**
- 第 3 轮：体力×300 / 花愿×20000 / 蓝色染料 / **金剪刀** / **月纱长窗**工坊图纸（不可钻石购买；制作后可单击切换半透遮月 / 纱帘拉开）
- 活动家具抽中后直接拥有，不花花愿、不增加星星
- 三轮全部抽完后不能再抽；红点：余额足够抽一次且尚未抽完

## 入口

顶栏、店铺全景活动列、花店右侧活动钮。面板：`MidAutumnEventPanel`（壳体 + 分层转盘：木纹盘面 / 金指针 / 玉兔中心 / 底座）。

## 资源

| 资源 | 路径 |
|---|---|
| 月饼图标 | `minigame/subpkg_items/images/drinks/mooncake/drink_mooncake_1..8.png` |
| 嫦娥胸像 | `minigame/subpkg_chars/images/customer/chang_e.png` |
| 入口 / 货币 | 主包 `images/ui/icon_mid_autumn_event_nb2.png`、`icon_mid_autumn_lantern.png` |
| 面板壳 | `minigame/subpkg_events/images/mid_autumn_event/ui/mid_autumn_event_panel_shell_nb2.png` |
| 转盘分层 | 同目录 `mid_autumn_wheel_{disc,pointer,hub,stand,spin_btn}_nb2.png` |
| 活动家具 | `minigame/subpkg_deco/images/furniture/event_mid_autumn_mooncake_gift_box.png`、`event_mid_autumn_reunion_dining_table.png`、`event_mid_autumn_jade_rabbit_doll.png` |
| 月纱长窗 | `minigame/subpkg_deco/images/furniture/workshop_moon_sheer_window_sheet.png`（半透遮月 / 纱帘拉开） |
