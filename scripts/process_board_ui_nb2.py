#!/usr/bin/env python3
"""
board_ui NB2 原稿 → rembg（BiRefNet **general** 完整版）→ 品红晕边清理 → crop_trim
→ for_review/processed + minigame/images/ui/

之前版本仅用 NumPy 品红抠图，容易在绿/黄边缘残留粉品红锯齿边；现与鲜花线一致用 rembg 主抠 + 后处理去 chroma 渗色。

前置：python3 scripts/gen_board_ui_nb2.py
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

from huahua_paths import game_assets_dir, repo_root

ASSETS = game_assets_dir()
RAW_DIR = ASSETS / "board_ui_nb2/for_review/1x1"
PROCESSED_DIR = ASSETS / "board_ui_nb2/for_review/processed"
OUT_GAME = repo_root() / "minigame/images/ui"
REMBG = os.path.expanduser("~/.cursor/skills/remove-background/scripts/rembg_batch.py")
TRIM = os.path.expanduser("~/.cursor/skills/game-art-pipeline/scripts/crop_trim.py")

# 默认 birefnet-general（全项目抠图统一）；仅本地试跑可加 --model birefnet-general-lite 加速
DEFAULT_REMBG_MODEL = "birefnet-general"

OUTPUT_NAMES = {
    "board_ui_selection_nb2_1x1.png": "ui_cell_selection_corners.png",
    "board_ui_order_badge_nb2_1x1.png": "ui_order_check_badge.png",
    "board_ui_complete_btn_nb2_16x9.png": "ui_complete_btn.png",
}


def chroma_clean_rgba(path: str) -> None:
    """去掉仍残留在 RGBA 上的品红/粉品红（含半透明边）。"""
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
    """透明邻域旁的品红渗色 1px 剥除。"""
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
        mag = (
            (r > 160)
            & (g < 145)
            & (b > 130)
            & ((r + b) > (g * 1.85))
        )
        kill = border & mag
        d[kill, 3] = 0
        a = d[:, :, 3]
    Image.fromarray(np.clip(d, 0, 255).astype(np.uint8)).save(path)


def postprocess_nobg(dir_path: str) -> None:
    for fname in sorted(os.listdir(dir_path)):
        if not fname.lower().endswith(".png"):
            continue
        fp = os.path.join(dir_path, fname)
        chroma_clean_rgba(fp)
        chroma_halo_neighbors(fp)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--no-copy-game",
        action="store_true",
        help="Only write to for_review/processed, do not copy to minigame/",
    )
    ap.add_argument("--padding", type=int, default=4, help="crop_trim padding")
    ap.add_argument(
        "--model",
        default=DEFAULT_REMBG_MODEL,
        help="rembg model (default: birefnet-general)",
    )
    args = ap.parse_args()

    tmp = "/tmp/nb2_process_board_ui"
    raw_sub = f"{tmp}/raw"
    nobg = f"{tmp}/nobg"
    final = f"{tmp}/final"
    for d in (raw_sub, nobg, final):
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d, exist_ok=True)

    os.makedirs(PROCESSED_DIR, exist_ok=True)
    if not args.no_copy_game:
        os.makedirs(OUT_GAME, exist_ok=True)

    idx = 0
    for raw_name, _game_name in OUTPUT_NAMES.items():
        src = os.path.join(RAW_DIR, raw_name)
        if not os.path.isfile(src):
            print("Missing raw:", src, file=sys.stderr)
            sys.exit(1)
        idx += 1
        shutil.copy2(src, os.path.join(raw_sub, f"{idx}.png"))

    print(f"Rembg model: {args.model}", flush=True)
    subprocess.run(
        [sys.executable, REMBG, raw_sub, "-o", nobg, "-m", args.model],
        check=True,
    )
    postprocess_nobg(nobg)

    subprocess.run(
        [sys.executable, TRIM, nobg, "-o", final, "--padding", str(args.padding)],
        check=True,
    )

    for i, (_, game_name) in enumerate(OUTPUT_NAMES.items(), start=1):
        fp = os.path.join(final, f"{i}.png")
        if not os.path.isfile(fp):
            print("Missing trimmed:", fp, file=sys.stderr)
            sys.exit(1)
        review = os.path.join(PROCESSED_DIR, game_name)
        shutil.copy2(fp, review)
        print("->", review)
        if not args.no_copy_game:
            dest = os.path.join(OUT_GAME, game_name)
            shutil.copy2(fp, dest)
            print("   (game)", dest)

    print("\nDone board_ui process (rembg + chroma fringe + trim).", flush=True)


if __name__ == "__main__":
    main()
