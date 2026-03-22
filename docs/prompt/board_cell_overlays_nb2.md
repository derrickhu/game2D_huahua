# 棋盘格锁定 / 半锁 / 转发

## 礼盒原图（必须放进仓库）

路径：**`docs/prompt/refs/board_cell_gift_source.png`**（透明底 PNG，不要用聊天缩略图替代）。

含义：

| 资源 | 规则 |
|------|------|
| **cell_locked** | 基于原图：去掉所有丝带/蝴蝶结，箱体改为**浅蓝**，保留雏菊贴与透视。 |
| **cell_key** | 与锁定**同一张**（由锁定图生图）：**仅加**右下角青绿圆形分享角标。 |
| **cell_peek** | **仅**一条**横向**宽丝带（上三分之一）+ **正中**蝴蝶结；**不要**两角弯下来的臂、不要 U 形。丝带更粗、蝴蝶结更大；**淡蓝**，底 **`#FF00FF`**，无盒子；参考图里的红框不要画进成图。 |

## 命令（默认不进包）

```bash
# 1) Gemini 生成三图 → 仅 for_review
python3 scripts/gen_board_cell_from_gift_source_nb2.py

# 2) 你本地看图确认后，再色键并进 minigame
python3 scripts/process_board_cell_nb2.py
```

一键生成并覆盖游戏资源（慎用）：

```bash
python3 scripts/gen_board_cell_from_gift_source_nb2.py --deploy
```

兼容入口（等同只跑步骤 1）：

```bash
python3 scripts/gen_board_cell_overlays_nb2.py
```

## 产出路径

- 预览：`game_assets/huahua/assets/board_cell_nb2/for_review/cell_*_nb2_1x1.png`
- 进包后：`minigame/images/ui/cell_locked.png` 等

## 代码

- `CellView` / `BoardView` 缩放仍为 **1.0 × 格宽**。
