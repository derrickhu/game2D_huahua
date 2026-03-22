#!/usr/bin/env python3
"""
棋盘格 UI 生成入口（默认**不进包**）。

主流程（礼盒原图 → Gemini → 仅 for_review）：
  python3 scripts/gen_board_cell_from_gift_source_nb2.py

可选：从拼图网格裁切（不经 AI 画盒）：
  python3 scripts/build_board_cells_from_user_grid.py

进 minigame（**会覆盖** images/ui，需人工确认 for_review 后再跑）：
  python3 scripts/process_board_cell_nb2.py

或一条命令生成并部署（慎用）：
  python3 scripts/gen_board_cell_from_gift_source_nb2.py --deploy
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent


def main() -> None:
    gift = _ROOT / "gen_board_cell_from_gift_source_nb2.py"
    r = subprocess.run([sys.executable, str(gift)])
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()