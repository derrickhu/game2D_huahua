# 园艺线 `plant` 工具图 — 出图方式说明

## 推荐：6 张独立 1:1（当前默认）

棋盘格为 **1:1**，工具图标应 **尽量占满格子**。整网 **1×6 横条** 容易比例不均，故改为 **每张单独生成**，比例 **`--aspect-ratio 1:1`**，模型 **`gemini-3.1-flash-image-preview`（NB2）**。

- 提示词：`docs/prompt/tool_plant_{1..6}_nb2_prompt.txt`
- 原图输出目录（**仓库外**）：`../game_assets/huahua/assets/raw/tool_plant_{1..6}.png`

入库到游戏工程时（路径以 `TextureCache` / `subpkg_items` 为准）：

```bash
cp "../game_assets/huahua/assets/raw/tool_plant_1.png" \
  "minigame/subpkg_items/images/tools/plant/tool_plant_1.png"
# … 对 2–6 重复
```

（如需抠图、缩放，可在拷贝前用既有脚本处理。）

## 备选：整网横条

`tool_line_plant_nb2_prompt.txt` 仍为 **1 行 × 6 列** 条带说明，适合需要 **一张 sheet 再切图** 的流程；若切格后占满度不理想，请以 **6×1:1 单独生成** 为准。
