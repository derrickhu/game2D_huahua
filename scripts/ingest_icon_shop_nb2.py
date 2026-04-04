#!/usr/bin/env python3
"""
NB2 花店商店图标入库：抠图后 PNG → 去品红底 → alpha 裁边 → 缩放到 127×128。
默认写出 minigame/images/ui/icon_shop_nb2.png（勿覆盖 icon_enter_house.png 进屋图）。
前置：已生成 ../game_assets/huahua/assets/raw/icon_shop_nb2.png 且已 rembg 为 NOBG（或传入 rembg 输出路径）。

用法:
  python3 scripts/ingest_icon_shop_nb2.py minigame/images/ui/icon_shop_nb2_nobg.png
"""
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
    if len(sys.argv) < 2:
        print("用法: ingest_icon_shop_nb2.py <抠图后RGBA.png>", file=sys.stderr)
        sys.exit(2)
    src_path = sys.argv[1]
    out_path = os.path.join(ROOT, "minigame", "images", "ui", "icon_shop_nb2.png")
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
