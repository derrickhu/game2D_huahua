# 花店装修面板 — 美术组件提示词与 NB2 出图说明

设计依据：花店装修抽屉面板原型（左侧分类、右侧家具网格、稀有度角标、状态按钮等）。  
出图模型：**NB2** = `gemini-3.1-flash-image-preview`。

## 路径约定

| 用途 | 路径 |
|------|------|
| 风格参考图（原型） | `docs/prompt/refs/house_renovation_panel_prototype.png` |
| 各组件提示词（仅正文，无 `#` 注释） | `docs/prompt/deco_panel_*_nb2_prompt.txt` |
| **预览出图（不入 minigame）** | `../game_assets/huahua/assets/preview_house_renovation_nb2/` |

## 组件清单与输出文件名

| 序号 | 组件说明 | 提示词文件 | 预览输出 PNG | 比例建议 |
|------|----------|------------|----------------|----------|
| 01 | 主面板底板（顶圆角、暖色木纹/米色） | `deco_panel_main_panel_nb2_prompt.txt` | `deco_panel_main_panel.png` | 16:9 或 4:3 |
| 02 | 顶部红色弧形标题条（留白给程序字） | `deco_panel_title_ribbon_nb2_prompt.txt` | `deco_panel_title_ribbon.png` | 16:9 |
| 03 | 右上角圆形关闭按钮 | `deco_panel_close_button_nb2_prompt.txt` | `deco_panel_close_button.png` | 1:1 |
| 04 | 左侧分类 Tab — 未选中 | `deco_panel_sidebar_tab_normal_nb2_prompt.txt` | `deco_panel_sidebar_tab_normal.png` | 1:1 |
| 05 | 左侧分类 Tab — 选中（橙色高亮） | `deco_panel_sidebar_tab_selected_nb2_prompt.txt` | `deco_panel_sidebar_tab_selected.png` | 1:1 |
| 06 | 家具格子卡片外框（圆角、投影） | `deco_panel_furniture_card_nb2_prompt.txt` | `deco_panel_furniture_card.png` | 4:3 |
| 07 | 稀有度角标条（灰/绿/蓝/红 四档一排，无文字） | `deco_panel_rarity_tags_sheet_nb2_prompt.txt` | `deco_panel_rarity_tags_sheet.png` | 16:9 |
| 08 | 「使用中」四角橙色装饰框 + 对勾感 | `deco_panel_equipped_corner_frame_nb2_prompt.txt` | `deco_panel_equipped_corner_frame.png` | 1:1 |
| 09 | 绿色圆角操作按钮（待使用等，无字） | `deco_panel_green_action_button_nb2_prompt.txt` | `deco_panel_green_action_button.png` | 16:9 |
| 10 | 锁定遮罩（金锁 + 暗角，无字） | `deco_panel_lock_overlay_nb2_prompt.txt` | `deco_panel_lock_overlay.png` | 1:1 |
| 11 | 整页界面参考（与策划稿一致布局） | `deco_panel_full_screen_reference_nb2_prompt.txt` | `deco_panel_full_screen_reference.png` | 9:16 |

## 批量生成命令（需本机代理与 API 可用）

在项目根目录执行（每条间隔约 5s 防限流）：

```bash
REF="docs/prompt/refs/house_renovation_panel_prototype.png"
OUT="../game_assets/huahua/assets/preview_house_renovation_nb2"
PY="$HOME/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
MODEL="gemini-3.1-flash-image-preview"

gen() {
  local name="$1" ratio="${2:-1:1}"
  python3 "$PY" --prompt-file "docs/prompt/${name}_nb2_prompt.txt" \
    --output "$OUT/${name}.png" --model "$MODEL" --aspect-ratio "$ratio" --image "$REF"
  sleep 5
}

gen deco_panel_main_panel 16:9
gen deco_panel_title_ribbon 16:9
gen deco_panel_close_button 1:1
gen deco_panel_sidebar_tab_normal 1:1
gen deco_panel_sidebar_tab_selected 1:1
gen deco_panel_furniture_card 4:3
gen deco_panel_rarity_tags_sheet 16:9
gen deco_panel_equipped_corner_frame 1:1
gen deco_panel_green_action_button 16:9
gen deco_panel_lock_overlay 1:1
gen deco_panel_full_screen_reference 9:16
```

说明：生成脚本使用 `--image` 附加原型图，便于 NB2 对齐配色与线稿风格；若某张过于贴整屏 UI，可去掉 `--image` 仅用语义提示词重跑单张。

## 入库游戏工程

当前阶段仅将 PNG 放在 `game_assets/.../preview_house_renovation_nb2/` 看效果；**不要**直接写入 `minigame/`。定稿后再按 `TextureCache` / `DecorationPanel` 拆图或九宫格方案接入。
