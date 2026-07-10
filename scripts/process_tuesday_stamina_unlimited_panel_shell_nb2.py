#!/usr/bin/env python3
"""
周二「体力无限」活动壳：品红幕去底入库（勿 rembg）。

用法（仓库根）:
  python3 scripts/process_tuesday_stamina_unlimited_panel_shell_nb2.py [raw.png]
"""
from __future__ import annotations

import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DEFAULT = os.path.join(
    REPO, "../game_assets/huahua/assets/raw/tuesday_stamina_unlimited_panel_shell_nb2.png"
)
OUT = os.path.join(
    REPO, "minigame/subpkg_panels/images/ui/tuesday_stamina_unlimited_panel_shell_nb2.png"
)

sys.path.insert(0, os.path.join(REPO, "scripts"))
from process_dressup_panel_shell_nb2 import (  # noqa: E402
    crop_alpha_bbox,
)

import numpy as np
from PIL import Image

MAX_W = 680
PAD = 8


def matte_magenta_screen(im: Image.Image) -> Image.Image:
    """Flood remove chroma magenta background from image edges."""
    rgba = im.convert("RGBA")
    arr = np.array(rgba, dtype=np.uint8)
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3].astype(np.int16)
    magenta = (
        (rgb[:, :, 0] > 170)
        & (rgb[:, :, 2] > 170)
        & (rgb[:, :, 1] < 120)
        & ((rgb[:, :, 0] + rgb[:, :, 2] - 2 * rgb[:, :, 1]) > 260)
    )

    seen = np.zeros((h, w), dtype=bool)
    stack: list[tuple[int, int]] = []
    for x in range(w):
        if magenta[0, x]:
            stack.append((0, x))
        if magenta[h - 1, x]:
            stack.append((h - 1, x))
    for y in range(h):
        if magenta[y, 0]:
            stack.append((y, 0))
        if magenta[y, w - 1]:
            stack.append((y, w - 1))

    while stack:
        y, x = stack.pop()
        if y < 0 or y >= h or x < 0 or x >= w or seen[y, x] or not magenta[y, x]:
            continue
        seen[y, x] = True
        stack.extend(((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)))

    arr[seen, 3] = 0
    return Image.fromarray(arr, "RGBA")


def main() -> int:
    src = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT)
    if not os.path.isfile(src):
        print(f"找不到原图: {src}", file=sys.stderr)
        return 1

    im = matte_magenta_screen(Image.open(src))
    arr = np.array(im, dtype=np.uint8)
    # The generated panel contains mint/green UI elements; only use a light generic edge cleanup,
    # not green-screen despill, to avoid shifting the panel palette.
    im = Image.fromarray(arr, "RGBA")
    im = crop_alpha_bbox(im, padding=PAD)

    if im.width > MAX_W:
        ratio = MAX_W / im.width
        im = im.resize((MAX_W, max(1, round(im.height * ratio))), Image.Resampling.LANCZOS)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT, "PNG", optimize=True)
    print(f"OK -> {OUT} {im.size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
