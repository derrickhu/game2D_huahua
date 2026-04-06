#!/usr/bin/env python3
"""
生成每日挑战任务行底图：暖金渐变 + 内高光/底影 + 紫粉外框与金褐内描边（与壳图 pastel kawaii 一致）。
输出 RGBA 透明底，供 QuestPanel 拉伸使用。
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--output", type=Path, required=True)
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=220)
    args = ap.parse_args()

    W, H = args.width, args.height
    mx0, my0 = int(W * 0.048), int(H * 0.16)
    mx1, my1 = W - mx0, H - my0
    mr = max(8, (my1 - my0) // 2)

    grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gp = grad.load()
    for y in range(H):
        t = y / max(1, H - 1)
        r = int(lerp(255, 245, t))
        g = int(lerp(248, 220, t))
        b = int(lerp(215, 165, t))
        for x in range(W):
            gp[x, y] = (r, g, b, 255)

    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([mx0, my0, mx1, my1], radius=mr, fill=255)

    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.paste(grad, (0, 0), mask)

    gloss = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gloss)
    gy0 = my0 + max(3, mr // 8)
    gy1 = my0 + max(10, mr // 3)
    gd.rounded_rectangle([mx0 + 6, gy0, mx1 - 6, gy1], radius=max(4, mr // 5), fill=(255, 252, 235, 115))
    gloss = gloss.filter(ImageFilter.GaussianBlur(radius=1.2))
    out = Image.alpha_composite(out, gloss)

    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    sy0 = my1 - max(12, mr // 2)
    sy1 = my1 - 4
    sd.rounded_rectangle([mx0 + 8, sy0, mx1 - 8, sy1], radius=max(6, mr // 4), fill=(120, 85, 40, 55))
    shade = shade.filter(ImageFilter.GaussianBlur(radius=2.0))
    out = Image.alpha_composite(out, shade)

    bd = ImageDraw.Draw(out)
    outer = (178, 158, 210, 255)
    inner = (196, 145, 72, 255)
    bd.rounded_rectangle([mx0, my0, mx1, my1], radius=mr, outline=outer, width=4)
    bd.rounded_rectangle([mx0 + 3, my0 + 3, mx1 - 3, my1 - 3], radius=max(4, mr - 3), outline=inner, width=2)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.save(args.output, "PNG", optimize=True)
    print(f"Wrote {args.output} ({W}x{H})", flush=True)


if __name__ == "__main__":
    main()
