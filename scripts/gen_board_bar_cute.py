#!/usr/bin/env python3
"""
棋盘上下装饰横条：与工程 COLORS 对齐的暖奶油 + 轻薄荷调（贴近棋盘 tint 0xD8EDCE / CELL_OPEN），
多层高光 + 腹面 + 重暗部 + 暖褐收边；避免灰紫粉「发污、不正」。
输出 minigame/images/ui/board_bar.png；高度须与 src/config/Constants.ts 的 BOARD_BAR_HEIGHT 一致。
"""
from __future__ import annotations

import math
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
# 与 Constants.BOARD_BAR_HEIGHT 一致（加高便于腹面 + 重暗部 + 底投影）
H = 36

# 与 src/config/Constants.ts COLORS 呼应（RGB）
# BG 0xFFF5EE、CELL_OPEN 0xE8F0E4、CELL_BORDER 0xD4C4B0、TEXT_DARK 暖褐系
SPECULAR = (255, 255, 252)
HIGHLIGHT = (255, 247, 236)  # 顶受光面
FACE_TOP = (248, 242, 232)
FACE_MID = (236, 238, 226)  # 略提 G，接薄荷格底
FACE_LOW = (222, 215, 200)
SHADOW = (188, 170, 152)  # 暖灰褐，非冷紫
DEEP = (154, 132, 116)
RIM_BOTTOM = (118, 98, 82)
# 细金边（与 UI GOLD 0xFFD700 同系，压低饱和）
ACCENT_GOLD = (232, 196, 120)


def lerp(a: float, b: float, t: float) -> float:
    return a * (1 - t) + b * t


def lerp_rgb(c0: tuple[int, int, int], c1: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        int(lerp(c0[0], c1[0], t)),
        int(lerp(c0[1], c1[1], t)),
        int(lerp(c0[2], c1[2], t)),
    )


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    t = clamp01((x - edge0) / max(edge1 - edge0, 1e-6))
    return t * t * (3 - 2 * t)


def main() -> None:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()

    for y in range(H):
        ty = y / max(H - 1, 1)
        # 分段纵向：顶光 → 腹面 → 重暗部 → 底（立体感拉满）
        if ty < 0.08:
            base = lerp_rgb(SPECULAR, HIGHLIGHT, ty / 0.08)
        elif ty < 0.22:
            base = lerp_rgb(HIGHLIGHT, FACE_TOP, (ty - 0.08) / 0.14)
        elif ty < 0.55:
            base = lerp_rgb(FACE_TOP, FACE_MID, (ty - 0.22) / 0.33)
        elif ty < 0.78:
            base = lerp_rgb(FACE_MID, FACE_LOW, (ty - 0.55) / 0.23)
        else:
            base = lerp_rgb(FACE_LOW, SHADOW, (ty - 0.78) / 0.22)

        for x in range(W):
            r, g, b = base

            # 上沿后方的「凹槽」暗带（约 y 6~9）
            groove = math.exp(-((y - 7.5) ** 2) / 4.5)
            r = int(r * (1 - 0.12 * groove))
            g = int(g * (1 - 0.12 * groove))
            b = int(b * (1 - 0.11 * groove))

            # 腹面弱反光带（模拟圆角鼓面）
            belly = math.exp(-((y - 16) ** 2) / 38)
            r = min(255, int(r + belly * 14))
            g = min(255, int(g + belly * 16))
            b = min(255, int(b + belly * 12))

            # 靠底二次压暗（加厚「厚度」）
            foot = smoothstep(0.62, 1.0, ty) ** 1.6
            dr = lerp(r, DEEP[0], foot * 0.42)
            dg = lerp(g, DEEP[1], foot * 0.42)
            db = lerp(b, DEEP[2], foot * 0.42)
            r, g, b = int(dr), int(dg), int(db)

            # 极轻纹理（短划，像漆木/搪瓷，不做大波点）
            streak = ((x // 6 + y // 4) % 3 == 0) and (8 < y < H - 10)
            if streak:
                r = int(r * 0.97)
                g = int(g * 0.98)
                b = int(b * 0.99)

            # 左右内收阴影（立面）
            edge = min(x, W - 1 - x)
            if edge < 3:
                f = (3 - edge) / 3.0
                r = int(lerp(r, DEEP[0], f * 0.22))
                g = int(lerp(g, DEEP[1], f * 0.22))
                b = int(lerp(b, DEEP[2], f * 0.22))

            px[x, y] = (r, g, b, 255)

    # 顶缘镜面高光（1~2px）
    for y in range(min(3, H)):
        k = 1.0 - y * 0.28
        for x in range(W):
            r, g, b, a = px[x, y]
            r = min(255, int(lerp(r, SPECULAR[0], 0.35 * k)))
            g = min(255, int(lerp(g, SPECULAR[1], 0.35 * k)))
            b = min(255, int(lerp(b, SPECULAR[2], 0.35 * k)))
            px[x, y] = (r, g, b, a)

    # 金饰细线（y≈4，低对比）
    gy = 4
    if gy < H:
        for x in range(W):
            r, g, b, a = px[x, gy]
            px[x, gy] = (
                int(lerp(r, ACCENT_GOLD[0], 0.28)),
                int(lerp(g, ACCENT_GOLD[1], 0.28)),
                int(lerp(b, ACCENT_GOLD[2], 0.22)),
                a,
            )

    # 底缘投影带（透明尾巴压在棋盘/底栏上）
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            dist_bottom = H - 1 - y
            if dist_bottom <= 5:
                t = (5 - dist_bottom) / 5.0
                br, bg, bb = RIM_BOTTOM
                r = int(lerp(r, br, 0.25 + 0.45 * t))
                g = int(lerp(g, bg, 0.25 + 0.45 * t))
                b = int(lerp(b, bb, 0.25 + 0.45 * t))
                if dist_bottom == 0:
                    a = 185
                elif dist_bottom == 1:
                    a = 220
                elif dist_bottom == 2:
                    a = 245
                px[x, y] = (r, g, b, a)

    dr = ImageDraw.Draw(img)
    # 外轮廓：顶亮线 + 底褐线（加粗 1px 可读性）
    for x in range(W):
        r1, g1, b1, a1 = img.getpixel((x, 0))
        dr.point((x, 0), (min(255, r1 + 18), min(255, g1 + 18), min(255, b1 + 14), min(255, a1 + 15)))
    for x in range(W):
        r1, g1, b1, a1 = img.getpixel((x, H - 1))
        dr.point(
            (x, H - 1),
            (
                int(lerp(r1, RIM_BOTTOM[0], 0.65)),
                int(lerp(g1, RIM_BOTTOM[1], 0.65)),
                int(lerp(b1, RIM_BOTTOM[2], 0.65)),
                min(255, a1 + 25),
            ),
        )

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} ({W}×{H})")


if __name__ == "__main__":
    main()
