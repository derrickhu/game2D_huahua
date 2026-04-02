#!/usr/bin/env python3
"""
Rembg + trim + chroma cleanup for flower_bouquet NB2 raw PNGs.

Default: writes to game_assets/.../flower_bouquet_nb2/for_review/processed/
         (does NOT touch minigame — use --copy-to-game after art approval).

Run after for_review/1x1 outputs from gen_flower_bouquet_nb2.py.
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
OUT_GAME = repo_root() / "minigame/images/flowers/bouquet"
RAW_DIR = ASSETS / "flower_bouquet_nb2/for_review/1x1"
PROCESSED_DIR = ASSETS / "flower_bouquet_nb2/for_review/processed"
PREFIX = "flower_bouquet"
REMBG = os.path.expanduser("~/.cursor/skills/remove-background/scripts/rembg_batch.py")
TRIM = os.path.expanduser("~/.cursor/skills/game-art-pipeline/scripts/crop_trim.py")


def _is_screen_magenta(
    r: np.ndarray,
    g: np.ndarray,
    b: np.ndarray,
    *,
    strict: bool,
) -> np.ndarray:
    """
    Detect #FF00FF chroma-key leftovers (including inside gaps between petals).
    strict=False uses wider tolerance + "high R&B, suppressed G" for anti-aliased fringes.
    """
    if strict:
        return (r > 200) & (g < 115) & (b > 200)
    return (r >= 170) & (b >= 170) & (g <= 150) & ((r + b) >= (g * 2.05))


def chroma_clean(path: str) -> None:
    img = Image.open(path).convert("RGBA")
    d = np.array(img, dtype=np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    vis = a > 12

    # Pass 1–2: obvious + softer magenta inside opaque regions (rembg keeps gaps as "fg")
    for strict in (True, False):
        m = _is_screen_magenta(r, g, b, strict=strict) & vis
        d[m, 3] = 0

    a = d[:, :, 3]
    vis = a > 12
    h, w = d.shape[:2]

    # Pass 3: 1px halo — neighbor is now transparent but this pixel is still magenta-tinted
    for _ in range(2):
        ap = np.pad(a, ((1, 1), (1, 1)), mode="constant", constant_values=0.0)
        neigh_max = np.maximum.reduce(
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
        border = vis & (neigh_max < 20)
        halo = border & _is_screen_magenta(r, g, b, strict=False)
        d[halo, 3] = 0
        a = d[:, :, 3]
        vis = a > 12

    Image.fromarray(np.clip(d, 0, 255).astype(np.uint8)).save(path)


def defringe_pale_outer_edge(
    path: str,
    *,
    lum_min: float = 165.0,
    sat_max: float = 95.0,
    neighbor_alpha_max: float = 32.0,
    self_alpha_min: float = 40.0,
) -> None:
    img = Image.open(path).convert("RGBA")
    d = np.array(img, dtype=np.float32)
    h, w = d.shape[:2]
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
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
    edge = (a >= self_alpha_min) & (neigh_min <= neighbor_alpha_max)
    kill = edge & (lum >= lum_min) & (sat <= sat_max)
    d[kill, 3] = 0
    Image.fromarray(np.clip(d, 0, 255).astype(np.uint8)).save(path)


def process(
    model: str,
    levels: list[int] | None,
    *,
    copy_to_game: bool,
) -> None:
    level_list = levels if levels is not None else list(range(1, 11))
    tmp = "/tmp/nb2_process_flower_bouquet"
    raw_sub = f"{tmp}/raw"
    nobg = f"{tmp}/nobg"
    final = f"{tmp}/final"
    for d in (raw_sub, nobg, final):
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d, exist_ok=True)

    for n in level_list:
        src = os.path.join(RAW_DIR, f"{PREFIX}_{n}_nb2_1x1.png")
        if not os.path.isfile(src):
            print("Missing:", src, file=sys.stderr)
            sys.exit(1)
        shutil.copy(src, os.path.join(raw_sub, f"{n}.png"))

    subprocess.run([sys.executable, REMBG, raw_sub, "-o", nobg, "-m", model], check=True)
    subprocess.run([sys.executable, TRIM, nobg, "-o", final, "--padding", "4"], check=True)

    os.makedirs(PROCESSED_DIR, exist_ok=True)
    if copy_to_game:
        os.makedirs(OUT_GAME, exist_ok=True)

    # White paper, daisies, baby's breath, ivory box — reduce pale halos
    defringe_levels = {1, 2, 3, 4, 5, 6, 8, 10}

    for n in level_list:
        fp = os.path.join(final, f"{n}.png")
        chroma_clean(fp)
        if n in defringe_levels:
            defringe_pale_outer_edge(fp)
        review_dest = os.path.join(PROCESSED_DIR, f"{PREFIX}_{n}.png")
        shutil.copy2(fp, review_dest)
        print("->", review_dest)
        if copy_to_game:
            game_dest = os.path.join(OUT_GAME, f"{PREFIX}_{n}.png")
            shutil.copy2(fp, game_dest)
            print("   (game)", game_dest)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--levels",
        type=str,
        default=None,
        help="Comma-separated 1-10 (e.g. 5). Default: all.",
    )
    ap.add_argument(
        "--model",
        default="birefnet-general",
        help="rembg model（默认与全项目规范一致）",
    )
    ap.add_argument(
        "--copy-to-game",
        action="store_true",
        help="Also copy to minigame/images/flowers/bouquet/ (default: review folder only).",
    )
    args = ap.parse_args()
    levels: list[int] | None = None
    if args.levels:
        levels = []
        for part in args.levels.split(","):
            part = part.strip()
            if not part:
                continue
            v = int(part)
            if v < 1 or v > 10:
                raise SystemExit("--levels must be 1-10")
            levels.append(v)
        levels = sorted(set(levels))
    process(args.model, levels, copy_to_game=args.copy_to_game)


if __name__ == "__main__":
    main()
