#!/usr/bin/env python3
"""
将 **已用 rembg 抠图** 的横条 PNG（透明底）缩放为游戏用 board_bar：
按 alpha 取内容包围盒 → 裁切 → 横向拉满 TARGET_W、纵向 TARGET_H。

抠图勿用本脚本代替：须先执行 remove-background 技能的 rembg（默认 birefnet-general）。

用法：
  python3 ~/.cursor/skills/remove-background/scripts/rembg_single.py \\
    minigame/images/ui/board_bar_nb2_raw.png -o minigame/images/ui/board_bar_nb2_nobg.png -m birefnet-general
  python3 scripts/ingest_board_bar_nb2.py minigame/images/ui/board_bar_nb2_nobg.png

或一键：scripts/board_bar_from_nb2.sh
"""
from __future__ import annotations

import os
import sys

try:
    from PIL import Image
except ImportError:
    print("需要 Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_OUT = os.path.join(ROOT, "minigame", "images", "ui", "board_bar.png")
TARGET_W = 750
TARGET_H = 22
ALPHA_THRESHOLD = 16


def alpha_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    w, h = im.size
    px = im.load()
    min_x, min_y = w, h
    max_x, max_y = -1, -1
    for y in range(h):
        for x in range(w):
            a = px[x, y][3]
            if a > ALPHA_THRESHOLD:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x < 0:
        return 0, 0, w, h
    pad = 2
    return (
        max(0, min_x - pad),
        max(0, min_y - pad),
        min(w, max_x + 1 + pad),
        min(h, max_y + 1 + pad),
    )


def main() -> None:
    if len(sys.argv) < 2:
        print("用法: ingest_board_bar_nb2.py <rembg抠图后RGBA.png> [输出路径]", file=sys.stderr)
        sys.exit(2)
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT
    im = Image.open(src).convert("RGBA")
    x0, y0, x1, y1 = alpha_bbox(im)
    crop = im.crop((x0, y0, x1, y1))
    crop = crop.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    crop.save(out, "PNG", optimize=True)
    print(f"Wrote {out} ({TARGET_W}×{TARGET_H}) alpha-bbox=({x0},{y0})-({x1},{y1})")


if __name__ == "__main__":
    main()
