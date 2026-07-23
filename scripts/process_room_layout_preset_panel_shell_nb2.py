#!/usr/bin/env python3
"""
布局预设面板壳：NB2 绿幕原图 → 四边洪水去绿 → 轻量绿边 despill → 入库。

用法（仓库根）:
  python3 scripts/process_room_layout_preset_panel_shell_nb2.py [raw.png]
"""
from __future__ import annotations

import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DEFAULT = os.path.join(
  REPO, "../game_assets/huahua/assets/raw/room_layout_preset_panel_shell_nb2.png"
)
OUT = os.path.join(
  REPO, "minigame/subpkg_panels/images/ui/room_layout_preset_panel_shell_nb2.png"
)

sys.path.insert(0, os.path.join(REPO, "scripts"))
from process_dressup_panel_shell_nb2 import (  # noqa: E402
  crop_alpha_bbox,
  despill_green_fringe,
  matte_green_screen,
)

import numpy as np
from PIL import Image

MAX_W = 560
PAD = 8


def main() -> int:
  src = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT)
  if not os.path.isfile(src):
    print(f"找不到原图: {src}", file=sys.stderr)
    return 1

  im = matte_green_screen(Image.open(src))
  arr = np.array(im, dtype=np.uint8)
  despill_green_fringe(arr)
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
