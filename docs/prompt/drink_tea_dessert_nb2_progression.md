# 茶饮线 / 甜品线 — NB2 单图 1:1（与冷饮线同一套经验）

## 共用规则（见 `scripts/gen_drink_tea_dessert_nb2.py`）

- 模型：`gemini-3.1-flash-image-preview`，`--aspect-ratio 1:1`
- 底：`#FF00FF` 纯品红；**主体内部禁止出现与抠图同色品红**
- **硬边抠图**：轮廓外紧邻即品红，禁止半透明白/粉光晕、柔化外发光
- **无白描边**：外轮廓线为深一点的同色系线，高光只在形体**内部** tight patch
- **无文字**
- **Lv1→Lv8** 杯具/器皿/装饰复杂度递增（与冷饮 progression 相同思路）

### 已根据反馈加强（描边粗深、颜色发闷）

- **明亮度**：与绿植线/花束线/冷饮线对齐 — 高饱和、鲜亮、顶光高光点；禁止整体发灰、发褐、脏色。
- **描边**：**极细发线级**（hairline），与填充色**同色相**只略深一档；**禁止**粗黑边、深褐勾线、厚重漫画轮廓。

### 茶饮线专项

- **Lv1**：**细长**玻璃杯装**热水/清水**（冲泡基底，高大于宽），与 Lv2+ 花茶杯同一赛璐璐玻璃画法；详见 `docs/prompt/drink_tea_1_nb2_prompt.txt`。
- **不要热气**：全等级 `TEA_GLOBAL` 禁止蒸汽/烟/上升水汽（抠图与图标清爽）。
- **杯壁不透品红**：禁止写实透明玻璃把 `#FF00FF` 透进茶汤；用赛璐璐不透明/磨砂玻璃或杯内白底 + 不透明琥珀茶汤。
- **Lv4**：与 Lv5 同源的**装饰玻璃杯**（短矮、无茶碟），**禁止茶杯/瓷杯**；**茶包**为主角，花只做点缀；**杯高须低于 Lv5**。
- **Lv5**：比 4 **更高/更修长**的杯型 + **散花茶汤**（无茶包），花材更丰富。
- **Lv5–7（历史说明）**：不按「手冲/茶壶」字面；统一为一杯花茶，靠杯与花递进。
- **Lv7 出图**：盖碗/杯外轮廓**禁止最外圈奶白描边或羽化白晕**，最外缘应为有色线（薄荷/金等）后紧邻纯品红，便于抠图无白边。

### 甜品线专项（`DESSERT_GLOBAL`，与茶饮踩坑对齐）

- **Lv1 / Lv2**：**多枚小饼干叠放**（外轮廓金/琥珀细线，**禁止**玫粉描边以免抠图白边）；**仅 2 枚马卡龙、错落叠放**（禁止三根直塔），单块小、留边；**不要盘子**。

- **玻璃蛋糕杯（Lv4）**：杯内需**横向分层**（海绵 / 奶油或果酱 / 海绵 / 顶霜），海绵带轻微孔隙质感；**禁止**整杯单一匀色慕斯糊。
- **玻璃器皿**：赛璐璐**不透明/磨砂**杯壁，**禁止**写实透明导致品红透进甜品；分层仍透过杯壁可读。
- **白奶油 / 瓷盘 / 多层蛋糕**：最外轮廓**禁止奶白「贴纸描边」或羽化白晕**；外缘用略深的同色系（黄奶油、腮红粉、暖灰盘沿）后**紧贴**纯品红。
- **无热气、无文字**（蛋糕装饰牌仅空白造型）。
- **抠图后处理**：甜品 Lv4–8 进包时走与茶饮类似的**浅外缘 defringe**（见 `process_drink_tea_dessert_nb2.py`）。
- **Lv6**：**Lv5 花瓣蛋糕切片的进阶版**，**仅两块**三角切片 + **一只**盘子，禁止散点浆果/小蛋糕/塔派把画面堆满；构图留白、高级西点感。
- **Lv5 / Lv6 重抠**：切片+椭圆盘易出白边/盘沿断裂；原画提示里已强调**完整盘沿、禁止整圈粗深描边**；若默认 `birefnet-general-lite` 不理想，可对单级使用 `--model birefnet-general`：`python3 scripts/process_drink_tea_dessert_nb2.py --line dessert --levels 5,6 --model birefnet-general`。

## 输出目录（仓库外）

- 茶饮：`game_assets/.../drink_tea_nb2/for_review/1x1/drink_tea_{1..8}_nb2_1x1.png`
- 甜品：`game_assets/.../drink_dessert_nb2/for_review/1x1/drink_dessert_{1..8}_nb2_1x1.png`

## 生成命令

```bash
# 仅生成原图（品红底）
python3 huahua/scripts/gen_drink_tea_dessert_nb2.py

# 仅茶饮 或 仅甜品
python3 huahua/scripts/gen_drink_tea_dessert_nb2.py --line tea
python3 huahua/scripts/gen_drink_tea_dessert_nb2.py --line dessert

# 抠图并进游戏（确认画面后）
python3 huahua/scripts/process_drink_tea_dessert_nb2.py
```
