#!/usr/bin/env python3
"""
NB2 原稿（品红底）→ rembg birefnet-general → 品红晕边清理 → crop_trim
→ minigame/subpkg_panels/images/ui/special_consumable_*.png

前置：已将原图存于 ../game_assets/huahua/assets/raw/（相对仓库根，或见 GAME_ASSETS_HUAHUA）
  - special_consumable_panel_bg_nb2.png
  - special_consumable_use_btn_nb2.png

用法（仓库根）:
  python3 scripts/process_special_consumable_ui_nb2.py
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter

from huahua_paths import game_assets_dir

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = str(game_assets_dir() / "raw")
OUT = os.path.join(REPO, "minigame/subpkg_panels/images/ui")
REMBG = os.path.expanduser("~/.cursor/skills/remove-background/scripts/rembg_single.py")
TRIM = os.path.expanduser("~/.cursor/skills/game-art-pipeline/scripts/crop_trim.py")

PAIRS = [
    ("special_consumable_panel_bg_nb2.png", "special_consumable_panel_bg.png"),
    ("special_consumable_use_btn_nb2.png", "special_consumable_use_btn.png"),
]


def chroma_clean_rgba(path: str) -> None:
    img = Image.open(path).convert("RGBA")
    d = np.array(img, dtype=np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    vis = a > 6
    strict = vis & (r > 190) & (g < 130) & (b > 185)
    pink = vis & (r > 200) & (g < 100) & (b > 75) & (b < 240) & (r > g + 85)
    soft = vis & (r >= 165) & (b >= 165) & (g <= 155) & ((r + b) >= (g * 2.0))
    m = strict | pink | soft
    d[m, 3] = 0
    Image.fromarray(np.clip(d, 0, 255).astype(np.uint8)).save(path)


def chroma_halo_neighbors(path: str, iterations: int = 2) -> None:
    img = Image.open(path).convert("RGBA")
    d = np.array(img, dtype=np.float32)
    h, w = d.shape[:2]
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    for _ in range(iterations):
        ap = np.pad(a, ((1, 1), (1, 1)), mode="constant", constant_values=0.0)
        neigh_min = np.minimum.reduce(
            [
                ap[0:h, 0:w],
                ap[0:h, 1 : w + 1],
                ap[0:h, 2 : w + 2],
                ap[1 : h + 1, 0:w],
                ap[1 : h + 1, 2 : w + 2],
                ap[2 : h + 2, 0:w],
                ap[2 : h + 2, 1 : w + 1],
                ap[2 : h + 2, 2 : w + 2],
            ]
        )
        border = (a > 20) & (neigh_min < 28)
        mag = (r > 160) & (g < 145) & (b > 130) & ((r + b) > (g * 1.85))
        kill = border & mag
        d[kill, 3] = 0
        a = d[:, :, 3]
    Image.fromarray(np.clip(d, 0, 255).astype(np.uint8)).save(path)


def main() -> None:
    tmp = "/tmp/special_consumable_ui_nb2"
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    for raw_name, out_name in PAIRS:
        src = os.path.join(RAW, raw_name)
        if not os.path.isfile(src):
            print(f"SKIP missing raw: {src}", file=sys.stderr)
            continue
        nobg = os.path.join(tmp, "nobg_" + out_name)
        final = os.path.join(tmp, "final_" + out_name)
        dst = os.path.join(OUT, out_name)
        subprocess.run(
            [sys.executable, REMBG, src, "-o", nobg, "-m", "birefnet-general"],
            check=False,
        )
        if not os.path.isfile(nobg):
            print(f"FAIL rembg: {raw_name}", file=sys.stderr)
            continue
        shutil.copy2(nobg, final)
        chroma_clean_rgba(final)
        chroma_halo_neighbors(final)
        subprocess.run(
            [sys.executable, TRIM, final, "-o", dst, "--padding", "4"],
            check=False,
        )
        if os.path.isfile(dst):
            print(f"OK -> {dst}")
        else:
            shutil.copy2(final, dst)
            print(f"OK (no trim) -> {dst}")


if __name__ == "__main__":
    main()
