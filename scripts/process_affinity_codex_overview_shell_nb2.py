#!/usr/bin/env python3
"""
友谊图鉴总览面板壳：NB2 绿幕原图 → 四边洪水去绿 → 轻量绿边 despill → 入库。

UI 整页壳体勿用 rembg。

用法（仓库根）:
  python3 scripts/process_affinity_codex_overview_shell_nb2.py [raw.png]
"""
from __future__ import annotations

import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DEFAULT = os.path.join(
    REPO, "../game_assets/huahua/assets/raw/affinity_codex_overview_shell_v2_flat_nb2.png"
)
OUT = os.path.join(
    REPO, "minigame/subpkg_panels/images/ui/affinity_codex_overview_shell_nb2.png"
)

# 复用换装壳绿幕管线（逻辑一致）
sys.path.insert(0, os.path.join(REPO, "scripts"))
from process_dressup_panel_shell_nb2 import (  # noqa: E402
    crop_alpha_bbox,
    defringe_green_edge,
    matte_green_screen,
)

import numpy as np
from PIL import Image

MAX_W = 680
PAD = 8


def main() -> int:
    src = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT)
    if not os.path.isfile(src):
        print(f"找不到原图: {src}", file=sys.stderr)
        return 1

    im = matte_green_screen(Image.open(src))
    arr = np.array(im, dtype=np.uint8)
    defringe_green_edge(arr)
    im = Image.fromarray(arr, "RGBA")
    im = crop_alpha_bbox(im, padding=PAD)

    if im.width > MAX_W:
        ratio = MAX_W / im.width
        im = im.resize((MAX_W, max(1, round(im.height * ratio))), Image.Resampling.LANCZOS)

    arr = np.array(im, dtype=np.uint8)
    defringe_green_edge(arr)
    im = Image.fromarray(arr, "RGBA")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT, "PNG", optimize=True)
    print(f"OK -> {OUT} {im.size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
