#!/usr/bin/env python3
"""
周末宣传面板入库：仅用 rembg（默认 birefnet-general）抠图，禁止色键/白边阈值后处理。
用法:
  python3 scripts/process_weekend_huayuan_boost_panel.py [raw.png] [--model birefnet-general|isnet-anime]
"""
from __future__ import annotations

import argparse
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
OUT = os.path.join(ROOT, "minigame", "subpkg_panels", "images", "ui", "weekend_huayuan_boost_promo_panel_nb2.png")
SRC_DEFAULT = os.path.join(RAW, "weekend_huayuan_boost_promo_panel_v8_nb2.png")
REMBG = os.path.expanduser("~/.cursor/skills/remove-background/scripts/rembg_single.py")
MAX_W = 600
PAD = 8


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("src", nargs="?", default=SRC_DEFAULT)
    parser.add_argument("--model", "-m", default="birefnet-general")
    parser.add_argument("--force", action="store_true", help="强制重新 rembg")
    args = parser.parse_args()
    src = os.path.abspath(args.src)
    if not os.path.isfile(src):
        print(f"找不到: {src}", file=sys.stderr)
        sys.exit(2)

    base, _ = os.path.splitext(src)
    nobg_out = base + "_nobg.png"
    if args.force or not os.path.isfile(nobg_out) or os.path.getmtime(nobg_out) < os.path.getmtime(src):
        subprocess.check_call(
            [sys.executable, REMBG, src, "-o", nobg_out, "-m", args.model],
        )
        print(f"rembg ({args.model}) -> {nobg_out}")

    im = Image.open(nobg_out).convert("RGBA")
    bb = im.getbbox()
    if not bb:
        raise SystemExit("抠图后无内容")
    w, h = im.size
    bb = (
        max(0, bb[0] - PAD),
        max(0, bb[1] - PAD),
        min(w, bb[2] + PAD),
        min(h, bb[3] + PAD),
    )
    im = im.crop(bb)
    if im.width > MAX_W:
        r = MAX_W / im.width
        im = im.resize((MAX_W, int(im.height * r)), Image.Resampling.LANCZOS)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} {im.size} (model={args.model})")


if __name__ == "__main__":
    main()
