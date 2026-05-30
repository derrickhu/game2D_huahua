#!/usr/bin/env python3
"""清涟荷影新手礼包底栏图标入库：rembg → 品红清理 → 192×192 透明 PNG。"""
from __future__ import annotations

import os
import subprocess
import sys

try:
    from PIL import Image
except ImportError:
    print("需要 Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "..", "game_assets", "huahua", "assets", "raw")
SRC_DEFAULT = os.path.join(RAW, "newbie_gift_qinglian_entry_icon_v3_nb2.png")
REMBG = os.path.expanduser("~/.cursor/skills/remove-background/scripts/rembg_single.py")
OUT = os.path.join(ROOT, "minigame", "images", "ui", "icon_newbie_gift_qinglian.png")
TW, TH = 192, 192
PAD = 0.94


def strip_magenta(im: Image.Image) -> None:
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 235 and g < 40 and b > 235:
                px[x, y] = (0, 0, 0, 0)


def main() -> None:
    src = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    src = os.path.abspath(src)
    if not os.path.isfile(src):
        print(f"找不到: {src}", file=sys.stderr)
        sys.exit(2)

    base, _ = os.path.splitext(src)
    nobg = base + "_nobg.png"
    subprocess.check_call([sys.executable, REMBG, src, "-o", nobg, "-m", "birefnet-general"])

    im = Image.open(nobg).convert("RGBA")
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
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} ({TW}×{TH})")


if __name__ == "__main__":
    main()
