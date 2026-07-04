#!/usr/bin/env python3
"""NB2 UI 图标入库：去品红底 → alpha 裁边 → 缩放到 127×128 居中。"""
from __future__ import annotations

import os
import sys

try:
    from PIL import Image
except ImportError:
    print("需要 Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TW, TH = 127, 128
PAD = 0.88


def strip_magenta(im: Image.Image) -> None:
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 235 and g < 40 and b > 235:
                px[x, y] = (0, 0, 0, 0)


def main() -> None:
    if len(sys.argv) < 3:
        print("用法: ingest_ui_icon_nb2.py <抠图后RGBA.png> <输出文件名.png>", file=sys.stderr)
        sys.exit(2)
    src_path = sys.argv[1]
    out_name = sys.argv[2]
    out_path = os.path.join(ROOT, "minigame", "images", "ui", out_name)
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
