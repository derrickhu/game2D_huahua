#!/usr/bin/env python3
"""
deco_card_btn_4 原图为红按钮 + 浅奶油底：按色域抠除背景、裁透明边，写回 minigame。
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:
    print("需要: pip install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "minigame/subpkg_panels/images/ui/deco_card_btn_4.png"


def is_cream_bg(r: int, g: int, b: int, a: int) -> bool:
    if a < 16:
        return True
    # 近白高光（按钮玻璃高光）保留
    if r + g + b > 718:
        return False
    # 浅奶油底：高明度、偏暖、红蓝差不大
    if r > 210 and g > 198 and b > 168 and (r - b) < 100 and (g - b) > 15:
        return True
    return False


def main() -> None:
    if not PATH.is_file():
        print(f"MISSING {PATH}", file=sys.stderr)
        sys.exit(1)
    im = Image.open(PATH).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_cream_bg(r, g, b, a):
                px[x, y] = (r, g, b, 0)

    a = im.split()[-1]
    a2 = a.filter(ImageFilter.MinFilter(3))
    im.putalpha(a2)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.save(PATH, "PNG")
    print(f"OK {PATH} ({im.size})")


if __name__ == "__main__":
    main()
