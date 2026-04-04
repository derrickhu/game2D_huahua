# 花店装修面板 — NB2 拆件

## 参考图（已定稿整屏原型）

默认路径：

默认参考：`../game_assets/huahua/assets/ui_prototypes/decoration_panel_bottom_sheet_prototype_nb2_portrait.png`（竖版，与 9:16 手游画幅一致）。横版整页稿仍可作美术备份：`decoration_panel_bottom_sheet_prototype_nb2.png`。勿用 `house_renovation_panel_prototype_nb2.png` 占位文本。

拆件生成时将该图作为参考图传入（脚本默认已指向本文件）。**具体英文拆件段落**在仓库 `scripts/gen_deco_panel_ui_nb2.py` 的 `SHARED` / `BODY_*` 中，已与 `decoration_panel_bottom_sheet_prototype_nb2_prompt.txt` 的桃杏珊瑚底栏、去厚重金框、避免大绿块等要求对齐。

## 输出目录

`../game_assets/huahua/assets/deco_panel_ui_nb2/for_review/`

- 背景：**品红 `#FF00FF`** 便于抠图；提示词内要求主体外纯品红。
- **无任何可读文字**（中英数字），游戏里用 Pixi 叠字。

## 拆件清单

| 文件 | 比例 | 内容 |
|------|------|------|
| `deco_nb2_main_panel_blank_9x16.png` | 9:16 | **空白大面板**：白底抠图；顶栏纯色立体；**左轨极窄 ~8–11%**（平涂无按钮）；**右侧家具区 ~89–92%** 宽；无字；头图无屋顶剪影 |
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
python3 scripts/gen_deco_panel_ui_nb2.py --only deco_nb2_main_panel_blank
python3 scripts/gen_deco_panel_ui_nb2.py --only deco_nb2_bottom
python3 scripts/gen_deco_panel_ui_nb2.py --only deco_nb2_icon_
```

## 入库游戏底图（空白大面板）

大面板 NB2：**除面板外整图纯色 `#FFFFFF`**（白底比品红更好抠，避免啃桃色头图）。禁止草地/屋顶/模糊截图。

默认：`rembg`（`birefnet-general`）→ `crop_trim` → 白边 despill：

```bash
python3 scripts/build_decoration_panel_bg_nb2.py
```

兜底：`--chroma-white`（白底软色键）；旧品红稿：`--chroma`。输出：`minigame/subpkg_panels/images/ui/decoration_panel_bg_nb2.png`。

## 拼层建议（实现时）

1. 底：模糊花店场景或纯色底。  
2. `bottom_sheet`：横向铺满屏宽；右侧洞上叠 `furniture_card_blank` 九宫格/列表。  
3. `header_ribbon` + 程序叠「花店装修」「已收集」。  
4. `close_btn` 右上角。  
5. 左侧：`tab_inactive` / `tab_selected` + 七个 `icon_*` 与槽位对齐。  
6. `divider` 置于标题区与内容区之间（按需）。
