#!/usr/bin/env python3
"""
仓库花篮整图：品红底抠图 + 去边（压品红）、轻微收缩 alpha 去毛边。
源图优先 game_assets，否则 minigame 现有 PNG。
输出：minigame/subpkg_panels/images/ui/warehouse_panel_bg.png
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:
    print("需要: pip install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "minigame/subpkg_panels/images/ui/warehouse_panel_bg.png"

CANDIDATES = [
    Path.home() / "rosa_games/game_assets/huahua/assets/warehouse_ui_nb2/for_review/warehouse_flower_basket_panel_nb2_v2_9x16.png",
    ROOT / "minigame/subpkg_panels/images/ui/warehouse_panel_bg.png",
]


def find_src() -> Path:
    for p in CANDIDATES:
        if p.is_file():
            return p
    raise FileNotFoundError("未找到源图，请把 v2 面板放到 game_assets 路径或 minigame")


def magenta_score(r: int, g: int, b: int) -> float:
    """越大越像品红底。"""
    return (r + b) * 0.5 - g


def main() -> None:
    src = find_src()
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size

    # 1) 初抠：偏品红 → 透明
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            ms = magenta_score(r, g, b)
            if ms > 130 and r > 160 and b > 160 and g < 120:
                px[x, y] = (r, g, b, 0)
            elif ms > 100 and r > 200 and b > 200 and g < 90:
                px[x, y] = (r, g, b, 0)

    # 2) 去 spill：仍不透明但带品红边的像素，往中性色压
    def despill(rr: int, gg: int, bb: int) -> tuple[int, int, int]:
        ms = magenta_score(rr, gg, bb)
        if ms < 35 or gg > 100:
            return rr, gg, bb
        t = min(0.55, (ms - 35) / 120.0)
        # 压低 R/B，略提 G，减少品红边
        rr = int(max(0, min(255, rr - (rr - gg) * t * 0.65)))
        bb = int(max(0, min(255, bb - (bb - gg) * t * 0.65)))
        gg = int(max(0, min(255, gg + (ms - 35) * 0.08 * t)))
        return rr, gg, bb

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            r2, g2, b2 = despill(r, g, b)
            px[x, y] = (r2, g2, b2, a)

    # 3) alpha 轻微收缩 1px 再柔化，去掉残留品红细丝
    a = im.split()[-1]
    a2 = a.filter(ImageFilter.MinFilter(3))  # 腐蚀
    a2 = a2.filter(ImageFilter.GaussianBlur(radius=0.6))
    im.putalpha(a2)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, "PNG")
    print(f"OK {src} -> {OUT} ({im.size})")


if __name__ == "__main__":
    main()
