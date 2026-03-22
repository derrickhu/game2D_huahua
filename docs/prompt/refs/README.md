# 棋盘格 / 礼盒参考图

## 礼盒原图（生成锁定/转发/半锁的主输入）

- **`board_cell_gift_source.png`**  
  游戏礼盒 **透明底原图**（奶油盒 + 珊瑚丝带 + 蝴蝶结 + 雏菊贴）。  
  **更新时只覆盖此文件**，不要用聊天截图；生成脚本固定读这个路径。  
  流水线：`scripts/gen_board_cell_from_gift_source_nb2.py` → 仅写入 `game_assets/.../board_cell_nb2/for_review/` → 你确认后再 `scripts/process_board_cell_nb2.py` 进包。

## 其它

- **`cell_peek_ribbon_layout_ref.png`** — 半锁：**横向宽带 + 正中蝴蝶结** 示意；生成时**去掉**自上垂下的弯臂，**淡蓝** + **`#FF00FF` 底**，**不要**画红框/示意线。  
- **`cell_peek_ribbon_layout_mockup.png`** — 旧示意，可选。  
- **`board_cell_user_approved_grid.png`** — 拼图示意网格；`build_board_cells_from_user_grid.py` 可从中裁切（与上图生图二选一）。  
- **`board_cell_gift_box_reference.png`** — 旧暖色参考，历史保留；主流程以 `board_cell_gift_source.png` 为准。
