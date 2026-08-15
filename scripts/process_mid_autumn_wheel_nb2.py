#!/usr/bin/env python3
"""中秋转盘分层件：绿幕原图 → 洪水去绿 → events 分包。"""
from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, "scripts"))
from process_dressup_panel_shell_nb2 import (  # noqa: E402
    crop_alpha_bbox,
    defringe_green_edge,
    matte_green_screen,
)

RAW_DIR = os.path.join(REPO, ".tmp/mid_autumn/raw")
SPLIT_DIR = os.path.join(REPO, ".tmp/mid_autumn/split_wheel")
OUT_DIR = os.path.join(REPO, "minigame/subpkg_events/images/mid_autumn_event/ui")
PAD = 8


def finish(im: Image.Image, out_name: str, max_side: int) -> None:
    im = matte_green_screen(im)
    arr = np.array(im, dtype=np.uint8)
    defringe_green_edge(arr)
    im = crop_alpha_bbox(Image.fromarray(arr, "RGBA"), padding=PAD)
    side = max(im.size)
    if side > max_side:
        ratio = max_side / side
        im = im.resize(
            (max(1, round(im.width * ratio)), max(1, round(im.height * ratio))),
            Image.Resampling.LANCZOS,
        )
        arr = np.array(im, dtype=np.uint8)
        defringe_green_edge(arr)
        im = Image.fromarray(arr, "RGBA")
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, out_name)
    im.save(out, "PNG", optimize=True, compress_level=9)
    print(f"OK -> {out} {im.size}")


def main() -> int:
    disc = os.path.join(RAW_DIR, "mid_autumn_wheel_disc_nb2.png")
    if not os.path.isfile(disc):
        print(f"找不到盘面: {disc}", file=sys.stderr)
        return 1
    finish(Image.open(disc), "mid_autumn_wheel_disc_nb2.png", 640)

    from pathlib import Path
    split = Path(SPLIT_DIR)
    names = [
        ("mid_autumn_wheel_pointer_nb2.png", 280),
        ("mid_autumn_wheel_hub_nb2.png", 280),
        ("mid_autumn_wheel_stand_nb2.png", 420),
        ("mid_autumn_wheel_spin_btn_nb2.png", 420),
    ]
    for name, max_side in names:
        src = split / name.replace("_nb2.png", ".png")
        if not src.is_file():
            src = split / name
        if not src.is_file():
            print(f"找不到零件: {src}", file=sys.stderr)
            return 1
        finish(Image.open(src), name, max_side)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
