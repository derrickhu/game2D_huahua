# 工具线图标 — 全局风格与五线主色

用于 **5 条工具链**（园艺/包装 6 级或 5 级，其余多为 5 级）棋盘图标的 AI 生成说明。

## 标准画风（v3 — 以 bake 线为唯一参考，已验证效果良好）

**参考源**：`minigame/subpkg_items/images/tools/bake/tool_bake_2.png`

**统一提示词前缀**（所有工具线图标 prompt 必须以此开头）：

> Cute small mobile game item icon, 3/4 top-down isometric view. Rounded chunky proportions, slightly chibi/compact. Soft smooth gradient shading with small bright highlight spots on surfaces. No hard black outlines — edges defined by color transitions and subtle darker-tone borders only. Warm cozy color palette with realistic material colors. Clean simple white background. No text, no labels, no UI elements. The item should look like a tiny desktop ornament.

**画风要点**：
- 小巧可爱手游图标，介于卡通与写实之间
- 圆润饱满 Q 版比例，所有棱角带圆倒角
- 无硬黑描边，边缘靠色彩明暗自然过渡
- 柔和渐变上色 + 小而亮的高光反射点
- 统一左上方柔光
- 多材质各有自色（木纹暖棕、搪瓷米白、金属银灰等）
- 3/4 俯视等距视角
- 物品像桌面小摆件

**生成参数**：模型 `gemini-2.5-flash-image` + `--image tool_bake_2.png` 风格参考 + 白色背景 + rembg 抠图 + trim 裁边

**详细规范**见 `.cursor/rules/tool-icon-art-style.mdc`

## 与花朵的区分（一句话）

花朵：**艳、软、轻、装饰感**；工具：**沉、实、材质、功能感**。

## 五线主色矩阵（每条线紧扣自己的主色，避免线间混色）

| 线 key (`tool_{key}_N`) | 中文链名 | 产出产品线 | 各级名称（配置） | 主色基调 |
|-------------------------|----------|------------|------------------|----------|
| `plant` | 园艺工具 | **同等级随机** 鲜花线 **或** 绿植线 | 铲子 → 水壶 → 育苗盘 → 简易温室 → 温室 → 高级温室 | **赭陶 + 板岩灰绿 + 深森绿 + 木柄/木基座**（饱和度低于花材） |
| `arrange` | 包装工具 | 包装中间品→花束 | 铁丝 / 铁丝剪刀 / 简易包装台 / 包装台 / 高级包装台 | 物品真实颜色（银灰金属、暖棕木质、彩色丝带等），不做强制主色约束；分级只加部件/复杂度 |
| `tea_set` | 茶具 | 茶饮线 | 茶包 / 茶叶罐 / 茶壶 / 茶台 / 高级茶台 | **白瓷与米白器皿 + 棕木茶台/木柄盖**（忌墨青主色、忌粉嫩） |
| `mixer` | 饮品器具 | 冷饮线 | 量杯 / 雪克杯 / 制冰机 / 冰箱 / 冰柜 | **透白 Frost + 天蓝**（忌品红反射、忌深灰压死） |
| `bake` | 烘焙工具 | 甜品线 | 擀面杖 / 烤箱 / 装裱台 | **焦糖棕、搪瓷米白、古铜把手** |

## 产出与代码对应

- 物品 ID：`tool_{line}_{1..N}`（`N` 因线而异），与 [src/config/ItemConfig.ts](../../src/config/ItemConfig.ts) 中 `TOOL_DATA` 一致。
- 纹理键与 `icon` 字段相同；路径约定：`minigame/images/tools/{line}/tool_{line}_{n}.png`（`tea_set` 目录名与 key 一致）。
- **种植线** 产出逻辑见 [src/config/BuildingConfig.ts](../../src/config/BuildingConfig.ts) 的 `produceLinesRandom`（`fresh` + `green`）。

## 单线 prompt 文件

每条线一个独立 txt（如 `tool_line_plant_nb2_prompt.txt`），在全局风格基础上写该线 **各级递进** 与 **该线锚点色**（种植线当前为 **6 列一行** 出图）。

## 试跑脚本（园艺线 `plant`）

- Prompt：`docs/prompt/tool_line_plant_nb2_prompt.txt`
- 生成 + 切列 + 抠图 + 写入主包：`python3 scripts/build_tool_plant_pilot.py`
- 仅对已有人工 sheet 切分：`python3 scripts/build_tool_plant_pilot.py --sheet /path/to.png`
- Sheet 备份目录：`game_assets/huahua/assets/tool_lines/for_review/`

## 包装工具线 `arrange`（花束上游）

- 设计说明：`docs/prompt/tool_arrange_bouquet_chain_art_design.md`
- 分卷 1:1：`docs/prompt/tool_arrange_{1..5}_nb2_prompt.txt`（铁丝 → … → 高级包装台）
- 整网备选：`docs/prompt/tool_line_arrange_nb2_prompt.txt`
- 构建（旧脚本路径以仓库内 `scripts/build_tool_arrange_pilot.py` 为准）：可按 5 张独立 NB2 出图再入库 `subpkg_items/images/tools/arrange/`

**包装中间品 `flower_wrap`**：`docs/prompt/flower_wrap_{1..4}_nb2_prompt.txt` — 丝带卷/丝带条/包装纸/花艺材料篮，使用统一标准画风（v3），物品真实颜色，L4 花艺材料篮更丰富精致。详见 `docs/prompt/tool_arrange_bouquet_chain_art_design.md`。

## 茶饮线 `tea_set`（茶具）

- Prompt：`docs/prompt/tool_line_tea_set_nb2_prompt.txt`（茶杯 / 茶壶 / 茶道台）
- 构建：`python3 scripts/build_tool_tea_set_pilot.py`（16:9 三列 **列内缩**（同花艺）、品红抠图、`trim` padding 8；默认模型 `gemini-2.5-flash-image`；16:9 失败则三张 1:1）
- 输出：`minigame/images/tools/tea_set/tool_tea_set_{1,2,3}.png`

## 冷饮线 `mixer`（饮品器具）

- Prompt：`docs/prompt/tool_line_mixer_nb2_prompt.txt`（量杯 / 搅拌杯 / 冷饮吧台）
- 构建：`python3 scripts/build_tool_mixer_pilot.py`（流程同上）
- 输出：`minigame/images/tools/mixer/tool_mixer_{1,2,3}.png`
