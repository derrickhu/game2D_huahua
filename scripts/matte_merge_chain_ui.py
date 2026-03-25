#!/usr/bin/env python3
"""
合成线 UI 拆件：品红抠图 + 去边；可选 alpha 裁剪缩小留白。
读 merge_chain_ui_nb2/for_review/，写入 minigame/images/ui/
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
REVIEW = Path.home() / "rosa_games/game_assets/huahua/assets/merge_chain_ui_nb2/for_review"
OUT_DIR = ROOT / "minigame/images/ui"

PAIRS = [
    ("merge_chain_ribbon_nb2_1x1.png", "merge_chain_ribbon.png", True),
    ("merge_chain_panel_nb2_3x4.png", "merge_chain_panel.png", False),
]


def magenta_score(r: int, g: int, b: int) -> float:
    return (r + b) * 0.5 - g


def process_pixels(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            ms = magenta_score(r, g, b)
            if ms > 130 and r > 160 and b > 160 and g < 120:
                px[x, y] = (r, g, b, 0)
            elif ms > 100 and r > 200 and b > 200 and g < 90:
                px[x, y] = (r, g, b, 0)

    def despill(rr: int, gg: int, bb: int) -> tuple[int, int, int]:
        ms = magenta_score(rr, gg, bb)
        if ms < 35 or gg > 100:
            return rr, gg, bb
        t = min(0.5, (ms - 35) / 120.0)
        rr = int(max(0, min(255, rr - (rr - gg) * t * 0.6)))
        bb = int(max(0, min(255, bb - (bb - gg) * t * 0.6)))
        gg = int(max(0, min(255, gg + (ms - 35) * 0.07 * t)))
        return rr, gg, bb

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            r2, g2, b2 = despill(r, g, b)
            px[x, y] = (r2, g2, b2, a)

    a = im.split()[-1]
    a2 = a.filter(ImageFilter.MinFilter(3))
    a2 = a2.filter(ImageFilter.GaussianBlur(radius=0.45))
    im.putalpha(a2)
    return im


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for src_name, dst_name, trim in PAIRS:
        src = REVIEW / src_name
        if not src.is_file():
            print(f"SKIP missing: {src}", file=sys.stderr)
            continue
        im = Image.open(src)
        im = process_pixels(im)
        if trim:
            bbox = im.getbbox()
            if bbox:
                im = im.crop(bbox)
        dst = OUT_DIR / dst_name
        im.save(dst, "PNG")
        print(f"OK {src.name} -> {dst} ({im.size})")


if __name__ == "__main__":
    main()
