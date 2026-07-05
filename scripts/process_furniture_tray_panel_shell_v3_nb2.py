#!/usr/bin/env python3
"""v3 薄粉边双纹底栏壳：绿幕 → 透明 PNG。用法: python3 scripts/process_furniture_tray_panel_shell_v3_nb2.py [raw.png]"""
from __future__ import annotations

import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(REPO, "../game_assets/huahua/assets/raw/furniture_tray_panel_shell_v3_thin_pink_nb2.png")
OUT = os.path.join(REPO, "minigame/subpkg_panels/images/ui/furniture_tray_panel_shell_v3_thin_pink_nb2.png")
PREVIEW = os.path.join(
    REPO, "../game_assets/huahua/assets/ui_prototypes/furniture_tray_panel_shell_v3_thin_pink_final.png"
)

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else RAW
    # 复用 v2 处理逻辑，临时改输出路径
    proc = os.path.join(REPO, "scripts/process_furniture_tray_panel_shell_v2_nb2.py")
    # 内联调用 main 逻辑并覆盖 OUT
    sys.path.insert(0, os.path.join(REPO, "scripts"))
    from process_furniture_workshop_panel_shell_nb2 import (  # noqa: PLC0415
        PAD,
        crop_alpha_bbox,
        despill_green_fringe,
        matte_green_screen,
    )
    import numpy as np
    from PIL import Image

    src = os.path.abspath(src)
    if not os.path.isfile(src):
        print(f"找不到原图: {src}", file=sys.stderr)
        raise SystemExit(1)

    im = matte_green_screen(Image.open(src))
    arr = np.array(im, dtype=np.uint8)
    despill_green_fringe(arr, strength=0.5)
    im = Image.fromarray(arr, "RGBA")
    im = crop_alpha_bbox(im, padding=PAD)
    if im.width > 750:
        ratio = 750 / im.width
        im = im.resize((750, max(1, round(im.height * ratio))), Image.Resampling.LANCZOS)

    for out_path in (OUT, PREVIEW):
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        im.save(out_path, "PNG", optimize=True)
        print(f"OK -> {out_path} {im.size}")
