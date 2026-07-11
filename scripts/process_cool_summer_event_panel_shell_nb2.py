#!/usr/bin/env python3
"""清凉一夏面板壳：NB2 绿幕原图 → 洪水去绿 → 绿边清理 → events 分包。"""
from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DEFAULT = os.path.join(
    REPO, "../game_assets/huahua/assets/raw/cool_summer_event_panel_shell_nb2.png"
)
OUT = os.path.join(
    REPO,
    "minigame/subpkg_events/images/cool_summer_event/ui/cool_summer_event_panel_shell.png",
)

sys.path.insert(0, os.path.join(REPO, "scripts"))
from process_dressup_panel_shell_nb2 import (  # noqa: E402
    crop_alpha_bbox,
    defringe_green_edge,
    matte_green_screen,
)

MAX_W = 680
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

    if im.width > MAX_W:
        ratio = MAX_W / im.width
        im = im.resize(
            (MAX_W, max(1, round(im.height * ratio))),
            Image.Resampling.LANCZOS,
        )

    arr = np.array(im, dtype=np.uint8)
    defringe_green_edge(arr)
    im = Image.fromarray(arr, "RGBA")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT, "PNG", optimize=True)
    print(f"OK -> {OUT} {im.size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
