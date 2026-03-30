#!/usr/bin/env python3
"""
仓库 NB2 关闭钮：品红底抠图 + 压边 + 轻微柔化。
源：game_assets for_review 或 minigame 当前文件（可为误扩展名的 JPG）。
输出：minigame/subpkg_panels/images/ui/warehouse_close_btn.png
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
OUT = ROOT / "minigame/subpkg_panels/images/ui/warehouse_close_btn.png"

CANDIDATES = [
    Path.home()
    / "rosa_games/game_assets/huahua/assets/warehouse_ui_nb2/for_review/warehouse_nb2_close_btn_1x1.png",
    ROOT / "minigame/subpkg_panels/images/ui/warehouse_close_btn.png",
]


def find_src() -> Path:
    for p in CANDIDATES:
        if p.is_file():
            return p
    raise FileNotFoundError("未找到 warehouse_nb2_close_btn 源图")


def magenta_score(r: int, g: int, b: int) -> float:
    return (r + b) * 0.5 - g


def process(im: Image.Image) -> Image.Image:
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

    # 小图标：腐蚀略轻，避免吃掉木圈细线
    a = im.split()[-1]
    a2 = a.filter(ImageFilter.MinFilter(3))
    a2 = a2.filter(ImageFilter.GaussianBlur(radius=0.45))
    im.putalpha(a2)
    return im


def main() -> None:
    src = find_src()
    im = Image.open(src)
    im = process(im)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, "PNG")
    print(f"OK {src} -> {OUT} ({im.size})")


if __name__ == "__main__":
    main()
