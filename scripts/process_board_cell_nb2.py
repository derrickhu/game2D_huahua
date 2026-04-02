#!/usr/bin/env python3
"""Chroma #FF00FF → transparent for board cell NB2 PNGs, copy into minigame/images/ui/.

⚠️ 会**直接覆盖** minigame/images/ui/cell_{locked,peek,key}.png。
请先打开 game_assets/.../board_cell_nb2/for_review/ 人工确认，再运行本脚本。
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# 与工具线 pilot 共用抠图逻辑
sys.path.insert(0, str(Path(__file__).resolve().parent))
from chroma_magenta_nb2 import chroma_clean_path as chroma_clean  # noqa: E402
from huahua_paths import game_assets_dir, repo_root  # noqa: E402

ASSETS = game_assets_dir()
SRC_DIR = ASSETS / "board_cell_nb2/for_review"
DEST_DIR = repo_root() / "minigame/images/ui"

NAMES = ("cell_locked", "cell_peek", "cell_key")


def main() -> None:
    os.makedirs(DEST_DIR, exist_ok=True)
    for name in NAMES:
        src = os.path.join(SRC_DIR, f"{name}_nb2_1x1.png")
        if not os.path.isfile(src):
            raise SystemExit(f"Missing: {src} — run gen_board_cell_overlays_nb2.py first")
        im = chroma_clean(src)
        dest = os.path.join(DEST_DIR, f"{name}.png")
        im.save(dest, optimize=True)
        print("->", dest)


if __name__ == "__main__":
    main()
