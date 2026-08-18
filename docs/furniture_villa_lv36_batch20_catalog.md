# 花园别墅家具补齐 + 奶油厨餐通用套（原 20 件批次）

像素：最长边 512（主题套装档）

## 放置意图

| 意图 | 件 |
|------|-----|
| B 地毯 | `villa_salon_rose_rug`（`depthSortFloorMat` + `depthSortYLift: 0`） |
| A 台面小物 | `villa_moon_bedside_lamp`（显式 depth 补偿） |
| C 地面大件 | 其余 |

## A. 法式玫瑰沙龙（客厅 · 7 · 花园别墅专属）

适用：`allowedSceneIds: ['garden_villa']` + `decorationPanelTab: 'flower_room'`  
解锁：**Lv36–38**（不低于别墅开放等级 36）

| id | 名称 | 槽位 | 稀有 | 花愿 | 星 | Lv |
|---|---|---|---|---:|---:|---:|
| `villa_salon_curved_sofa` | 弧形玫瑰沙发 | ORNAMENT | RARE | 52000 | 8 | 36 |
| `villa_salon_marble_tea` | 玫瑰花座茶几 | TABLE | FINE | 42000 | 7 | 36 |
| `villa_salon_armchair` | 金钉丝绒单椅 | ORNAMENT | FINE | 38600 | 6 | 36 |
| `villa_salon_floor_lamp` | 玫瑰花柱落地灯 | LIGHT | FINE | 39500 | 6 | 36 |
| `villa_salon_rose_rug` | 玫瑰花瓣圆毯 | ORNAMENT | FINE | 35800 | 6 | 37 |
| `villa_salon_console` | 玫瑰玄关柜 | SHELF | RARE | 55500 | 8 | 37 |
| `villa_salon_crystal_chandelier` | 水晶落地烛台 | LIGHT | LIMITED | 98000 | 12 | 38 |

## B. 奶油轻奢厨餐（6 · 通用场景）

适用：各装修房可买可摆；家具进「家具」Tab；**冰箱 / 烤箱灶** 为 `DecoSlot.LIGHT`（面板「家电」）  
解锁：**Lv35–37**

| id | 名称 | 槽位 | 面板 | 稀有 | 花愿 | 星 | Lv |
|---|---|---|---|---|---:|---:|---:|
| `villa_kitchen_island` | 奶油中岛橱柜 | TABLE | 家具 | RARE | 58000 | 8 | 35 |
| `villa_kitchen_fridge` | 高柜双门冰箱 | LIGHT | 家电 | RARE | 54000 | 8 | 35 |
| `villa_dining_long_table` | 橡木长餐桌 | TABLE | 家具 | RARE | 56000 | 8 | 36 |
| `villa_dining_chair_pair` | 高背丝绒餐椅 | ORNAMENT | 家具 | FINE | 41200 | 6 | 36 |
| `villa_kitchen_pendant` | 奶油双炉烤箱灶 | LIGHT | 家电 | FINE | 43800 | 7 | 37 |
| `villa_kitchen_sideboard` | 餐边收纳柜 | SHELF | 家具 | RARE | 52500 | 8 | 37 |

## C. 月光丝绒卧室（7 · 花园别墅专属）

适用：`allowedSceneIds: ['garden_villa']` + `decorationPanelTab: 'flower_room'`  
解锁：**Lv36–38**

| id | 名称 | 槽位 | 稀有 | 花愿 | 星 | Lv |
|---|---|---|---|---:|---:|---:|
| `villa_moon_nightstand` | 月纹床头柜 | TABLE | FINE | 38800 | 7 | 36 |
| `villa_moon_bedside_lamp` | 月华水晶球灯 | LIGHT | FINE | 39200 | 6 | 37 |
| `villa_moon_floor_mirror` | 拱形全身镜 | ORNAMENT | FINE | 40800 | 7 | 37 |
| `villa_moon_wardrobe` | 高挑丝绒衣柜 | SHELF | RARE | 62000 | 9 | 38 |
| `villa_moon_vanity` | 星光好莱坞妆台 | TABLE | RARE | 58500 | 8 | 38 |
| `villa_moon_canopy_bed` | 丝绒靠背大床 | ORNAMENT | LIMITED | 128000 | 14 | 38 |
| `villa_pearl_grand_piano` | 珍珠白贵妃榻 | ORNAMENT | LIMITED | 150000 | 15 | 38 |

## 资产路径

- Prompt：`docs/prompt/furniture_<id>_nb2_prompt.txt`
- 原图：`../game_assets/huahua/assets/raw/furniture_<id>_nb2.png`
- 入库：`minigame/subpkg_deco/images/furniture/<id>.png`
