#!/usr/bin/env python3
"""
过渡用：程序绘制铜色挂锁（透明底）。
正式：python3 scripts/gen_warehouse_ui_nb2.py --only warehouse_nb2_slot_lock
     python3 scripts/matte_warehouse_slot_lock.py
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("需要: pip install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "minigame/images/ui/warehouse_slot_lock.png"
SIZE = 512
S = 4  # 超采样


def main() -> None:
    w = h = SIZE * S
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    cx, cy = w // 2, h // 2

    body_w = int(w * 0.36)
    body_h = int(h * 0.30)
    body_y0 = cy - int(h * 0.02)
    body_x0 = cx - body_w // 2
    rad = int(min(body_w, body_h) * 0.22)

    # 锁身渐变条
    n = 28
    for i in range(n):
        t = i / (n - 1)
        y0 = body_y0 + int(body_h * i / n)
        y1 = body_y0 + int(body_h * (i + 1) / n) + 1
        r = int(120 + 85 * (1 - t))
        g = int(75 + 75 * (1 - t * 0.7))
        b = int(38 + 45 * (1 - t))
        rr = rad if i == 0 else (rad if i == n - 1 else 0)
        dr.rounded_rectangle([body_x0, y0, body_x0 + body_w, y1], radius=rr, fill=(r, g, b, 255))

    dr.rounded_rectangle(
        [body_x0, body_y0, body_x0 + body_w, body_y0 + body_h],
        radius=rad,
        outline=(88, 55, 28, 255),
        width=max(3, w // 80),
    )

    # 锁梁（粗弧 + 两柱）
    arch_w = int(body_w * 0.78)
    arch_h = int(h * 0.20)
    arch_top = body_y0 - arch_h + int(h * 0.02)
    ax0, ax1 = cx - arch_w // 2, cx + arch_w // 2
    lw = max(5, w // 55)
    # 上半圆环
    dr.arc([ax0, arch_top, ax1, arch_top + arch_h * 2], 180, 360, fill=(175, 125, 60, 255), width=lw)
    # 左柱
    dr.rectangle([ax0 - lw // 2, arch_top + arch_h - lw // 2, ax0 + lw // 2, body_y0 + lw], fill=(165, 115, 55, 255))
    # 右柱
    dr.rectangle([ax1 - lw // 2, arch_top + arch_h - lw // 2, ax1 + lw // 2, body_y0 + lw], fill=(165, 115, 55, 255))

    # 钥匙孔
    kh = int(body_h * 0.34)
    kx, ky = cx, body_y0 + int(body_h * 0.38)
    dr.ellipse([kx - kh // 5, ky - kh // 3, kx + kh // 5, ky + kh // 8], fill=(40, 26, 14, 250))
    dr.rectangle([kx - kh // 9, ky, kx + kh // 9, ky + kh // 2], fill=(40, 26, 14, 250))

    # 高光
    gl = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl)
    gd.ellipse(
        [body_x0 + body_w // 10, body_y0 + body_h // 8, body_x0 + body_w * 2 // 5, body_y0 + body_h * 2 // 5],
        fill=(255, 240, 200, 100),
    )
    im.alpha_composite(gl)

    im = im.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, "PNG")
    print(f"OK -> {OUT}")


if __name__ == "__main__":
    main()
