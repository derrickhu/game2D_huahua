#!/usr/bin/env python3
"""月满中秋面板壳：NB2 绿幕原图 → 洪水去绿 → events 分包。"""
from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DEFAULT = os.path.join(REPO, ".tmp/mid_autumn/raw/mid_autumn_event_panel_shell_nb2.png")
OUT = os.path.join(
    REPO,
    "minigame/subpkg_events/images/mid_autumn_event/ui/mid_autumn_event_panel_shell_nb2.png",
)

sys.path.insert(0, os.path.join(REPO, "scripts"))
from process_dressup_panel_shell_nb2 import (  # noqa: E402
    crop_alpha_bbox,
    defringe_green_edge,
    matte_green_screen,
)

TARGET_W = 680
PAD = 8


def main() -> int:
    src = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT)
    if not os.path.isfile(src):
        print(f"找不到原图: {src}", file=sys.stderr)
        return 1

    im = matte_green_screen(Image.open(src))
    arr = np.array(im, dtype=np.uint8)
    defringe_green_edge(arr)
    im = crop_alpha_bbox(Image.fromarray(arr, "RGBA"), padding=PAD)

    if im.width != TARGET_W:
        ratio = TARGET_W / im.width
        im = im.resize(
            (TARGET_W, max(1, round(im.height * ratio))),
            Image.Resampling.LANCZOS,
        )

    arr = np.array(im, dtype=np.uint8)
    defringe_green_edge(arr)
    im = Image.fromarray(arr, "RGBA")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT, "PNG", optimize=True, compress_level=9)
    print(f"OK -> {OUT} {im.size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
