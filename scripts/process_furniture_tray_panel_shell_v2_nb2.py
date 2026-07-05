#!/usr/bin/env python3
"""
装修编辑托盘底栏壳 v2（flat bottom sheet）：NB2 绿幕原图 → 四边洪水去绿 → despill → 入库。

用法（仓库根）:
  python3 scripts/process_furniture_tray_panel_shell_v2_nb2.py [raw.png]
"""
from __future__ import annotations

import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DEFAULT = os.path.join(
    REPO, "../game_assets/huahua/assets/raw/furniture_tray_panel_shell_v2_flat_nb2.png"
)
OUT = os.path.join(
    REPO, "minigame/subpkg_panels/images/ui/furniture_tray_panel_shell_v2_flat_nb2.png"
)
PREVIEW = os.path.join(
    REPO, "../game_assets/huahua/assets/ui_prototypes/furniture_tray_panel_shell_v2_flat_final.png"
)
MAX_W = 750


def main() -> int:
    sys.path.insert(0, os.path.join(REPO, "scripts"))
    from process_furniture_workshop_panel_shell_nb2 import (  # noqa: PLC0415
        PAD,
        crop_alpha_bbox,
        despill_green_fringe,
        matte_green_screen,
    )

    import numpy as np
    from PIL import Image

    src = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT)
    if not os.path.isfile(src):
        print(f"找不到原图: {src}", file=sys.stderr)
        return 1

    im = matte_green_screen(Image.open(src))
    arr = np.array(im, dtype=np.uint8)
    despill_green_fringe(arr, strength=0.5)
    im = Image.fromarray(arr, "RGBA")
    im = crop_alpha_bbox(im, padding=PAD)

    if im.width > MAX_W:
        ratio = MAX_W / im.width
        im = im.resize((MAX_W, max(1, round(im.height * ratio))), Image.Resampling.LANCZOS)

    for out_path in (OUT, PREVIEW):
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        im.save(out_path, "PNG", optimize=True)
        print(f"OK -> {out_path} {im.size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
