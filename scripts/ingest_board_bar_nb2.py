#!/usr/bin/env python3
"""
将 NB2 出的 16:9 横条原图裁成棋盘装饰条：取垂直方向「非留白」中心带，缩放到 750×BOARD_BAR_HEIGHT。
用法：
  python3 scripts/ingest_board_bar_nb2.py minigame/images/ui/board_bar_nb2_raw.png
默认写出 minigame/images/ui/board_bar.png
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


def is_content_pixel(r: int, g: int, b: int, a: int) -> bool:
    if a < 28:
        return False
    return r + g + b < 735  # 非近白


def find_content_band(im: Image.Image) -> tuple[int, int]:
    w, h = im.size
    px = im.load()
    row_score = []
    step = max(1, w // 120)
    for y in range(h):
        hit = 0
        for x in range(0, w, step):
            r, g, b, a = px[x, y]
            if is_content_pixel(r, g, b, a):
                hit += 1
        row_score.append(hit)
    if max(row_score) == 0:
        ch = max(24, int(h * 0.12))
        t = (h - ch) // 2
        return t, t + ch
    threshold = max(2, int(max(row_score) * 0.15))
    ys = [y for y, s in enumerate(row_score) if s >= threshold]
    y0, y1 = ys[0], ys[-1] + 1
    pad = max(4, (y1 - y0) // 8)
    y0 = max(0, y0 - pad)
    y1 = min(h, y1 + pad)
    return y0, y1


def main() -> None:
    if len(sys.argv) < 2:
        print("用法: ingest_board_bar_nb2.py <NB2原图.png> [输出路径]", file=sys.stderr)
        sys.exit(2)
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT
    im = Image.open(src).convert("RGBA")
    y0, y1 = find_content_band(im)
    crop = im.crop((0, y0, im.width, y1))
    crop = crop.resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    crop.save(out, "PNG", optimize=True)
    print(f"Wrote {out} ({TARGET_W}×{TARGET_H}) from band y={y0}..{y1}")


if __name__ == "__main__":
    main()
