# 工具线图标 — 全局风格与五线主色

用于 **5 条工具链 × 每链 3 级（共 15 个棋盘图标）** 的 AI 生成说明。与 **花朵/饮品产品图**区分：工具偏 **厚重、低饱和、材质可读**，避免艳丽抢镜。

## 全局风格（必须）

- **品类**：休闲 merge 花店手游中的 **工具 / 器具 / 小型场景**，不是在售鲜花或成品饮料蛋糕。
- **画法**：2D 手绘 + **明确体积**；顶侧柔光；**阴影比花材略重**；软描边（略深于固有色，**不要死黑硬线**）。
- **材质**：根据物体写清 — 陶釉、铸铁、拉丝金属、实木、磨砂玻璃、搪瓷、塑料等，**哑光或半哑光为主**，少高光轰炸。
- **占比**：每个图标约占其 **格子 75–80%**，居中，四周留少量边。
- **背景**：整张素材非透明流程时，使用 **纯品红 `#FF00FF`** 铺满非物体像素（与现有花/饮品 chroma 一致）。
- **禁止**：任何 **文字、数字、标签、Logo**；不要把工具画成 **高饱和粉紫艳红**（像花瓣主色）；避免 **整圈彩虹渐变**；避免与 **产品线商品**（花束杯、蛋糕杯）混淆成「产品主体」。

## 与花朵的区分（一句话）

花朵：**艳、软、轻、装饰感**；工具：**沉、实、材质、功能感**。

## 五线主色矩阵（每条线紧扣自己的主色，避免线间混色）

| 线 key (`tool_{key}_N`) | 中文链名 | 产出产品线 | 三级名称（配置） | 主色基调 |
|-------------------------|----------|------------|------------------|----------|
| `plant` | 园艺工具 | **同等级随机** 鲜花线 **或** 绿植线 | 小花铲 / 浇水壶 / 小温室 | **赭陶 + 板岩灰绿 + 深森绿 + 木柄/木基座** |
| `arrange` | 花艺工具 | 花束线 | 花剪 / 包装纸 / 扎花台 | **铜与古铜、深酒红衬布、浅灰台面、牛皮包装纸色** |
| `tea_set` | 茶具 | 茶饮线 | 茶杯 / 茶壶 / 茶道台 | **墨青、深青瓷、胡桃木**（忌粉嫩茶具） |
| `mixer` | 饮品器具 | 冷饮线 | 量杯 / 搅拌杯 / 冷饮吧台 | **钢蓝、雾面玻璃、深灰台面** |
| `bake` | 烘焙工具 | 甜品线 | 擀面杖 / 烤箱 / 装裱台 | **焦糖棕、搪瓷米白、古铜把手** |

## 产出与代码对应

- 物品 ID：`tool_{line}_{1..3}`，与 [src/config/ItemConfig.ts](../../src/config/ItemConfig.ts) 中 `TOOL_DATA` 一致。
- 纹理键与 `icon` 字段相同；路径约定：`minigame/images/tools/{line}/tool_{line}_{n}.png`（`tea_set` 目录名与 key 一致）。
- **种植线** 产出逻辑见 [src/config/BuildingConfig.ts](../../src/config/BuildingConfig.ts) 的 `produceLinesRandom`（`fresh` + `green`）。

## 单线 prompt 文件

每条线一个独立 txt（如 `tool_line_plant_nb2_prompt.txt`），在全局风格基础上只写该线 **3 级递进** 与 **该线锚点色**。

## 试跑脚本（园艺线 `plant`）

- Prompt：`docs/prompt/tool_line_plant_nb2_prompt.txt`
- 生成 + 切列 + 抠图 + 写入主包：`python3 scripts/build_tool_plant_pilot.py`
- 仅对已有人工 sheet 切分：`python3 scripts/build_tool_plant_pilot.py --sheet /path/to.png`
- Sheet 备份目录：`game_assets/huahua/assets/tool_lines/for_review/`

## 花艺线 `arrange`

- Prompt：`docs/prompt/tool_line_arrange_nb2_prompt.txt`（花剪 / 包装纸 / 扎花台）
- 构建：`python3 scripts/build_tool_arrange_pilot.py`（16:9 失败时会自动改为三张 1:1）
- 输出：`minigame/images/tools/arrange/tool_arrange_{1,2,3}.png`

## 茶饮线 `tea_set`（茶具）

- Prompt：`docs/prompt/tool_line_tea_set_nb2_prompt.txt`（茶杯 / 茶壶 / 茶道台）
- 构建：`python3 scripts/build_tool_tea_set_pilot.py`（16:9 三列 **列内缩**（同花艺）、品红抠图、`trim` padding 8；默认模型 `gemini-2.5-flash-image`；16:9 失败则三张 1:1）
- 输出：`minigame/images/tools/tea_set/tool_tea_set_{1,2,3}.png`

## 冷饮线 `mixer`（饮品器具）

- Prompt：`docs/prompt/tool_line_mixer_nb2_prompt.txt`（量杯 / 搅拌杯 / 冷饮吧台）
- 构建：`python3 scripts/build_tool_mixer_pilot.py`（流程同上）
- 输出：`minigame/images/tools/mixer/tool_mixer_{1,2,3}.png`
