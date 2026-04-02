# 花店装修 — 弹出框面板底图（NB2，与原型一致）

生成**完整长方形**竖版壳体：约 **2:3（宽:高）**、**细黄边**、**米白内底**、圆角、无字无按钮，供游戏内再拼图。

| 项目 | 路径 |
|------|------|
| 提示词（仅正文） | `docs/prompt/deco_panel_popup_frame_nb2_prompt.txt` |
| 推荐输出（仓库外） | `../game_assets/huahua/assets/raw/deco_panel_popup_frame_proto_nb2.png` |

历史文件：`deco_panel_popup_frame_nb2.png`（厚边）、`deco_panel_popup_frame_thin_nb2.png`（旧细边 9:16）可保留对比。

## 生成命令

脚本支持的竖版比例中与 **2:3** 最接近为 **`3:4`**（略宽于纯 2:3，可在提示词中约束画幅）。若你本地 API 支持 `2:3` 可自行替换 `--aspect-ratio`。

```bash
mkdir -p ../game_assets/huahua/assets/raw

python3 ~/.cursor/skills/gemini-image-gen/scripts/generate_images.py \
  --prompt-file "docs/prompt/deco_panel_popup_frame_nb2_prompt.txt" \
  --output "../game_assets/huahua/assets/raw/deco_panel_popup_frame_proto_nb2.png" \
  --model gemini-3.1-flash-image-preview \
  --aspect-ratio 3:4
```

可选：`9:16` 更细长手机全屏感，但比例会偏离 2:3。
