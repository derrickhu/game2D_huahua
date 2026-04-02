# 花店装修面板 — NB2 拆件

## 参考图（已定稿整屏原型）

默认路径：

`../game_assets/huahua/assets/ui_prototypes/house_renovation_panel_prototype_nb2.png`

拆件生成时将该图作为 `--image` 传入，保证配色、体积感、描边与整图一致。

## 输出目录

`../game_assets/huahua/assets/deco_panel_ui_nb2/for_review/`

- 背景：**品红 `#FF00FF`** 便于抠图；提示词内要求主体外纯品红。
- **无任何可读文字**（中英数字），游戏里用 Pixi 叠字。

## 拆件清单

| 文件 | 比例 | 内容 |
|------|------|------|
| `deco_nb2_bottom_sheet_16x9.png` | 16:9 | 底部大面板：金边奶油底、左侧留白轨、右侧 **品红洞**（格子区程序拼） |
| `deco_nb2_header_ribbon_16x9.png` | 16:9 | 鲑红丝带标题条（空白） |
| `deco_nb2_close_btn_1x1.png` | 1:1 | 红底白叉关闭钮 |
| `deco_nb2_furniture_card_blank_3x4.png` | 3:4 | 空白家具卡模板（稀有角标位留白） |
| `deco_nb2_tab_selected_1x1.png` | 1:1 | 选中 Tab 胶囊底（无图标无字） |
| `deco_nb2_tab_inactive_1x1.png` | 1:1 | 未选中 Tab 胶囊底 |
| `deco_nb2_divider_16x9.png` | 16:9 | 顶部分割细线装饰 |
| `deco_nb2_icon_room_1x1.png` | 1:1 | 房间风格 — 小房子图标 |
| `deco_nb2_icon_shelf_1x1.png` | 1:1 | 花架 |
| `deco_nb2_icon_table_1x1.png` | 1:1 | 桌台 |
| `deco_nb2_icon_light_1x1.png` | 1:1 | 灯具 |
| `deco_nb2_icon_ornament_1x1.png` | 1:1 | 摆件 |
| `deco_nb2_icon_wall_1x1.png` | 1:1 | 墙饰 |
| `deco_nb2_icon_garden_1x1.png` | 1:1 | 庭院 |

## 生成命令

依赖：`~/.cursor/skills/gemini-image-gen/scripts/generate_images.py`，模型默认 **NB2**（`gemini-3.1-flash-image-preview`）。

```bash
# 在仓库根目录执行

# 全部拆件（每张间隔约 8s，总耗时较长）
python3 scripts/gen_deco_panel_ui_nb2.py

# 指定参考图（可选）
python3 scripts/gen_deco_panel_ui_nb2.py --ref /path/to/house_renovation_panel_prototype_nb2.png

# 参考图默认缩到最长边 512px 再请求 API，减轻体积、降低 REST 400；原图很大时可改：
python3 scripts/gen_deco_panel_ui_nb2.py --ref-max-side 384

# 不传参考（仅文生图，风格对齐较弱）
python3 scripts/gen_deco_panel_ui_nb2.py --no-ref

# 只生成某一类（前缀匹配）
python3 scripts/gen_deco_panel_ui_nb2.py --only deco_nb2_bottom
python3 scripts/gen_deco_panel_ui_nb2.py --only deco_nb2_icon_
```

## 拼层建议（实现时）

1. 底：模糊花店场景或纯色底。  
2. `bottom_sheet`：横向铺满屏宽；右侧洞上叠 `furniture_card_blank` 九宫格/列表。  
3. `header_ribbon` + 程序叠「花店装修」「已收集」。  
4. `close_btn` 右上角。  
5. 左侧：`tab_inactive` / `tab_selected` + 七个 `icon_*` 与槽位对齐。  
6. `divider` 置于标题区与内容区之间（按需）。
