# 合成页底部「物品信息」条 — 拆件美术（参考图2）

## 输出目录（不入游戏仓库）

`/Users/huyi/rosa_games/game_assets/huahua/assets/merge_item_info_ui_nb2/`

| 提示词文件 | 建议输出 PNG | 比例 | 用途 |
|-----------|----------------|------|------|
| `merge_item_info_panel_nb2_prompt.txt` | `panel_cream_nb2.png` | 16:9 | 底部长条信息面板本体 |
| `merge_item_info_ribbon_nb2_prompt.txt` | `title_ribbon_coral_nb2.png` | 1:1 | 左上标题燕尾彩带（游戏内叠字） |
| `merge_item_info_exclaim_badge_nb2_prompt.txt` | `badge_exclaim_coral_nb2.png` | 1:1 | 彩带右侧圆形感叹号标 |
| `merge_item_info_btn_merge_line_nb2_prompt.txt` | `btn_merge_line_blue_nb2.png` | 1:1 | 「合成线」类按钮底板 |
| `merge_item_info_btn_sell_nb2_prompt.txt` | `btn_sell_lime_nb2.png` | 1:1 | 「出售」类按钮底板（图2 亮绿） |
| `merge_item_info_sheet_nb2_prompt.txt` | `ui_parts_sheet_nb2.png` | 16:9 | 一图多零件，便于切图 |

## 模型与命令

模型：**NB2** = `gemini-3.1-flash-image-preview`

```bash
OUT="/Users/huyi/rosa_games/game_assets/huahua/assets/merge_item_info_ui_nb2"
mkdir -p "$OUT"
WS="/Users/huyi/rosa_games/huahua"
GEN="$HOME/.cursor/skills/gemini-image-gen/scripts/generate_images.py"

python3 "$GEN" --prompt-file "$WS/docs/prompt/merge_item_info_panel_nb2_prompt.txt" \
  --output "$OUT/panel_cream_nb2.png" --model gemini-3.1-flash-image-preview --aspect-ratio 16:9
sleep 5
python3 "$GEN" --prompt-file "$WS/docs/prompt/merge_item_info_ribbon_nb2_prompt.txt" \
  --output "$OUT/title_ribbon_coral_nb2.png" --model gemini-3.1-flash-image-preview --aspect-ratio 1:1
sleep 5
python3 "$GEN" --prompt-file "$WS/docs/prompt/merge_item_info_exclaim_badge_nb2_prompt.txt" \
  --output "$OUT/badge_exclaim_coral_nb2.png" --model gemini-3.1-flash-image-preview --aspect-ratio 1:1
sleep 5
python3 "$GEN" --prompt-file "$WS/docs/prompt/merge_item_info_btn_merge_line_nb2_prompt.txt" \
  --output "$OUT/btn_merge_line_blue_nb2.png" --model gemini-3.1-flash-image-preview --aspect-ratio 1:1
sleep 5
python3 "$GEN" --prompt-file "$WS/docs/prompt/merge_item_info_btn_sell_nb2_prompt.txt" \
  --output "$OUT/btn_sell_lime_nb2.png" --model gemini-3.1-flash-image-preview --aspect-ratio 1:1
sleep 5
python3 "$GEN" --prompt-file "$WS/docs/prompt/merge_item_info_sheet_nb2_prompt.txt" \
  --output "$OUT/ui_parts_sheet_nb2.png" --model gemini-3.1-flash-image-preview --aspect-ratio 16:9
```

抠图：品红底图可用 chroma key；白底可用 alpha 提取。拆件后按 `ItemInfoBar` 尺寸再缩放。
