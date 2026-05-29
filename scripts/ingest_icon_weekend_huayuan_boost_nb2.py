#!/usr/bin/env python3
"""周末活动顶栏图标入库：rembg 后 PNG → 仅去品红底（生图辅助色）→ 缩放入库。"""
from __future__ import annotations

import os
import sys

try:
    from PIL import Image
except ImportError:
    print("需要 Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TW, TH = 192, 192
PAD = 0.96


def strip_magenta(im: Image.Image) -> None:
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 235 and g < 40 and b > 235:
                px[x, y] = (0, 0, 0, 0)


def main() -> None:
    if len(sys.argv) < 2:
        print("用法: ingest_icon_weekend_huayuan_boost_nb2.py <抠图后RGBA.png>", file=sys.stderr)
        sys.exit(2)
    src_path = sys.argv[1]
    out_path = os.path.join(ROOT, "minigame", "images", "ui", "icon_weekend_huayuan_boost_nb2.png")
    im = Image.open(src_path).convert("RGBA")
    strip_magenta(im)
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    sw, sh = im.size
    scale = min(TW / sw, TH / sh) * PAD
    nw = max(1, int(sw * scale))
    nh = max(1, int(sh * scale))
    res = im.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (TW, TH), (0, 0, 0, 0))
    out.paste(res, ((TW - nw) // 2, (TH - nh) // 2), res)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    out.save(out_path, "PNG", optimize=True)
    print(f"Wrote {out_path} ({TW}×{TH})")


if __name__ == "__main__":
    main()
