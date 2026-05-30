#!/usr/bin/env python3
"""珍珠花珠帘：白底原图 → rembg → crop → 入库（默认不做 halo 后处理，易损细节）。"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GA = Path(__import__("os").environ.get("GAME_ASSETS_HUAHUA", str(ROOT.parent / "game_assets" / "huahua")))
RAW = GA / "assets/raw/furniture_promo_pearl_bead_curtain_nb2.png"
SPLIT = GA / "assets/split/promo_ad_furniture"
OUT = ROOT / "minigame/subpkg_deco/images/furniture/promo_pearl_bead_curtain.png"
REMBG = Path.home() / ".cursor/skills/remove-background/scripts/rembg_single.py"
CROP = Path.home() / ".cursor/skills/game-art-pipeline/scripts/crop_trim.py"
DEFAULT_MODEL = "birefnet-general"


def defringe_pale_outer_edge(path: Path) -> None:
    """浅色珍珠/白花外沿贴透明处去灰白渣（与鲜花线一致）。"""
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
    edge = (a >= 24) & (neigh_min <= 28)
    kill = edge & (lum >= 158) & (sat <= 105)
    d[kill, 3] = 0
    Image.fromarray(np.clip(d, 0, 255).astype(np.uint8)).save(path)


def scrub_grey_gap_speckles(rgba_arr: np.ndarray) -> None:
    """珠串缝隙里 rembg 残留的深灰/黑半透明点。"""
    d = rgba_arr.astype(np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    lum = (r + g + b) / 3.0
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    ap = np.pad(a, ((1, 1), (1, 1)), mode="constant", constant_values=0.0)
    h, w = a.shape
    neigh_trans = (
        (ap[0:h, 0:w] < 12)
        | (ap[0:h, 2 : w + 2] < 12)
        | (ap[2 : h + 2, 0:w] < 12)
        | (ap[2 : h + 2, 2 : w + 2] < 12)
    )
    speck = (a > 6) & (a < 200) & (lum < 95) & (sat < 55) & neigh_trans
    rgba_arr[speck, 3] = 0


def post_rembg(path: Path) -> None:
    sys.path.insert(0, str(ROOT / "scripts"))
    from chroma_magenta_nb2 import (  # noqa: E402
        crush_rembg_white_halo,
        despill_white_fringe,
        scrub_dark_semi_transparent,
    )

    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    scrub_grey_gap_speckles(arr)
    scrub_dark_semi_transparent(arr)
    crush_rembg_white_halo(arr, lum_min=228.0, sat_max=52.0, alpha_scale=0.35, alpha_cap=18.0)
    despill_white_fringe(arr, lum_thresh=230.0, sat_max=42.0, strength=0.65)
    Image.fromarray(arr, "RGBA").save(path)
    defringe_pale_outer_edge(path)
    # 第二轮：珠串缝隙里残留的浅灰半透明
    img2 = Image.open(path).convert("RGBA")
    arr2 = np.array(img2)
    crush_rembg_white_halo(arr2, lum_min=240.0, sat_max=38.0, alpha_scale=0.25, alpha_cap=12.0)
    scrub_grey_gap_speckles(arr2)
    scrub_dark_semi_transparent(arr2)
    Image.fromarray(arr2, "RGBA").save(path)
    defringe_pale_outer_edge(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("-m", "--model", default=DEFAULT_MODEL, choices=[
        "birefnet-general", "birefnet-general-lite", "isnet-anime", "u2net",
    ])
    ap.add_argument("--post", action="store_true", help="启用压白晕后处理（默认关闭）")
    ap.add_argument("--from-trim", type=Path, help="直接入库已有 trim PNG（跳过 rembg）")
    args = ap.parse_args()

    if not RAW.is_file() and not args.from_trim:
        print(f"missing raw: {RAW}", file=sys.stderr)
        return 1
    SPLIT.mkdir(parents=True, exist_ok=True)

    if args.from_trim:
        trim = args.from_trim.resolve()
        if not trim.is_file():
            print(f"missing trim: {trim}", file=sys.stderr)
            return 1
    else:
        cut = SPLIT / f"promo_pearl_bead_curtain_{args.model}_cut.png"
        trim = SPLIT / f"promo_pearl_bead_curtain_{args.model}_trim.png"
        print(f"== rembg {args.model} ==")
        subprocess.run(
            [sys.executable, str(REMBG), str(RAW), "-o", str(cut), "-m", args.model],
            check=True,
        )
        if args.post:
            post_rembg(cut)
        subprocess.run(
            [sys.executable, str(CROP), str(cut), "-o", str(trim), "--padding", "4"],
            check=True,
        )
        if args.post:
            post_rembg(trim)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(trim, OUT)
    subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/compress_furniture_deco_pngs.py"),
            "--max-side",
            "512",
            "--force",
            str(OUT),
        ],
        check=True,
        cwd=ROOT,
    )
    im = Image.open(OUT)
    print(f"OK {OUT.name} {im.size} max={max(im.size)} {OUT.stat().st_size // 1024}K")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
