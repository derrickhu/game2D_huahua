#!/usr/bin/env python3
"""
Remove residual chroma-key magenta (#FF00FF-like) from RGBA PNGs after rembg.
Typical cause: thin horizontal band or fringe left from NB2 key color.
"""
from __future__ import annotations

import argparse
from PIL import Image


def is_key_magenta(r: int, g: int, b: int) -> bool:
    return r >= 230 and b >= 230 and g <= 55


def is_bottom_purple_fringe(r: int, g: int, b: int, a: int) -> bool:
    """NB2 / rembg 底缘常见：偏品红紫、R/B 高、G 明显低。"""
    if a < 120:
        return False
    if r < 75 or b < 75:
        return False
    if g >= min(r, b) - 12:
        return False
    if g >= 145:
        return False
    return (r + b) > g * 2 + 80


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="Input PNG path")
    ap.add_argument("-o", "--output", help="Output path (default: overwrite input)")
    ap.add_argument(
        "--bottom-rows",
        type=int,
        default=0,
        help="If >0, only in the last N rows apply purple-fringe removal (safer for art)",
    )
    args = ap.parse_args()
    path = args.input
    out = args.output or path

    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    n = 0
    y0 = 0
    if args.bottom_rows > 0:
        y0 = max(0, h - args.bottom_rows)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            kill = is_key_magenta(r, g, b)
            if not kill and y >= y0:
                kill = is_bottom_purple_fringe(r, g, b, a)
            if kill:
                px[x, y] = (0, 0, 0, 0)
                n += 1
    im.save(out, optimize=True)
    print(f"{out}  size={w}x{h}  cleared_pixels={n}")


if __name__ == "__main__":
    main()
