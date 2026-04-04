# 园艺线 `plant` 工具图 — 出图说明（7 级）

命名与递进：**铲子 → 水壶 → 育苗盘 → 育苗仓 → 简易温室 → 温室 → 高级温室**。棋盘 `tool_plant_1`…`tool_plant_7` 与之一一对应。

## 画风

统一遵守 **`.cursor/rules/tool-icon-art-style.mdc`**：提示词以英文标准前缀开头，白底出图 → **`birefnet-general` rembg** → **`crop_trim.py --padding 4`** → 写入 `minigame/subpkg_items/images/tools/plant/` → 仓库根 **`python3 scripts/compress_subpkg_items_pngs.py`**。

风格参考图：`minigame/subpkg_items/images/tools/bake/tool_bake_2.png`（`--image` 传入）。

## 提示词与 RAW

- 单张：`docs/prompt/tool_plant_{1..7}_nb2_prompt.txt`
- 原图（默认仓库外）：`../game_assets/huahua/assets/raw/tool_plant_{n}_nb2.png`（可用环境变量 `GAME_ASSETS_HUAHUA` 改根目录）

## 育苗仓（L4）原图命名（避免与 L7 生成冲突）

请把定稿 **育苗仓 / 生态舱** NB2 保存为：

`../game_assets/huahua/assets/raw/tool_plant_4_nursery_nb2.png`

`regen_tool_plant_nb2.sh all` 会 **先生成 L4 再跑 1–3、5–7**，因此不要用 `tool_plant_7_nb2.png` 兼作育苗仓（否则重跑 `all` 时会被 L7「高级温室」覆盖）。若仅有旧文件名，可设环境变量 `TOOL_PLANT_L4_RAW=/path/to/生态舱.png`。

## 一键脚本（推荐）

在仓库根执行：

```bash
chmod +x scripts/regen_tool_plant_nb2.sh
./scripts/regen_tool_plant_nb2.sh all
```

- 会对 **1–3、5–7** 调用 Gemini 生成，对 **L4** 使用上述 `tool_plant_7_nb2.png` 抠图。
- 仅补抠 L4：`./scripts/regen_tool_plant_nb2.sh 4only`
- 仅补生成缺失 RAW：`./scripts/regen_tool_plant_nb2.sh gen-missing`

模型默认 `gemini-3.1-flash-image-preview`，可设 `GEMINI_PLANT_MODEL` 覆盖。

## 备选：整网横条

`tool_line_plant_nb2_prompt.txt` 仍为历史 **1×6** 条带说明；当前以 **7×1:1 单独生成** 为准。
