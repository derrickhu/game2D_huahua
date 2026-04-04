#!/usr/bin/env python3
"""
棋盘上下装饰横条：无横向装饰渐变；单一色相、分阶实色纵带（搪瓷/漆木条感）+
顶高光带、左右立面、底收边与软投影。高度须与 Constants.BOARD_BAR_HEIGHT 一致。
"""
from __future__ import annotations

import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("需要 Pillow: pip install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "minigame", "images", "ui", "board_bar.png")

W = 750
H = 22

# 马卡龙草莓粉：每带为纯填色，只在 y 上台阶变亮暗（色相一致）
BAND_SPEC = (255, 248, 250)  # 顶受光刃
BAND_LIP = (255, 218, 228)  # 上斜面
BAND_FACE = (248, 158, 182)  # 主立面（实色）
BAND_CORE = (236, 128, 158)  # 腹下
BAND_SHADOW = (218, 102, 132)  # 底厚
BAND_RIM = (188, 78, 104)  # 最底描边（同系加深，不发灰紫）

# y 分带边界 [上含下不含)，与 H=22 对齐
BAND_EDGES = [
    (0, 2, BAND_SPEC),
    (2, 4, BAND_LIP),
    (4, 13, BAND_FACE),
    (13, 18, BAND_CORE),
    (18, 21, BAND_SHADOW),
    (21, 22, BAND_RIM),
]


def lerp(a: float, b: float, t: float) -> float:
    return a * (1 - t) + b * t


def color_at_row(y: int) -> tuple[int, int, int]:
    for y0, y1, rgb in BAND_EDGES:
        if y0 <= y < y1:
            return rgb
    return BAND_RIM


def hash2(x: int, y: int) -> int:
    """确定性微噪，哑光漆颗粒（±极小，不糊成色带）。"""
    return ((x * 374761393 + y * 668265263) & 0xFFFFFFFF) % 7


def main() -> None:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()

    for y in range(H):
        base = color_at_row(y)
        for x in range(W):
            r, g, b = base
            n = hash2(x, y) - 3
            r = max(0, min(255, r + n))
            g = max(0, min(255, g + n))
            b = max(0, min(255, b + n))

            edge = min(x, W - 1 - x)
            if edge == 0:
                r, g, b = int(r * 0.88), int(g * 0.88), int(b * 0.89)
            elif edge == 1:
                r, g, b = int(r * 0.94), int(g * 0.94), int(b * 0.95)

            px[x, y] = (r, g, b, 255)

    # 顶缘 1px 锐利高光（实体棱边）
    for x in range(W):
        r, g, b, a = px[x, 0]
        px[x, 0] = (
            min(255, int(lerp(r, 255, 0.55))),
            min(255, int(lerp(g, 255, 0.5))),
            min(255, int(lerp(b, 255, 0.52))),
            a,
        )

    # 底缘：最后两行略压暗 + 末行透明叠影
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            dist = H - 1 - y
            if dist == 0:
                r = int(lerp(r, BAND_RIM[0], 0.35))
                g = int(lerp(g, BAND_RIM[1], 0.35))
                b = int(lerp(b, BAND_RIM[2], 0.35))
                a = 200
            elif dist == 1:
                r = int(lerp(r, BAND_RIM[0], 0.18))
                g = int(lerp(g, BAND_RIM[1], 0.18))
                b = int(lerp(b, BAND_RIM[2], 0.18))
                a = 242
            px[x, y] = (r, g, b, a)

    dr = ImageDraw.Draw(img)
    for x in range(W):
        r1, g1, b1, a1 = img.getpixel((x, H - 1))
        dr.point(
            (x, H - 1),
            (
                max(0, r1 - 8),
                max(0, g1 - 6),
                max(0, b1 - 6),
                min(255, a1 + 15),
            ),
        )

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} ({W}×{H})")


if __name__ == "__main__":
    main()
