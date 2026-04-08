#!/usr/bin/env python3
"""
切 4×2 胶囊表图 → 每格 rembg (birefnet-general) → crop_trim（不旋转）。

输出仅写入 game_assets（默认 ../game_assets/huahua/assets/pill_buttons_4x2_processed/）。

用法（仓库根）:
  python3 scripts/process_pill_buttons_sheet_4x2.py
  python3 scripts/process_pill_buttons_sheet_4x2.py --sheet /path/to/sheet.png
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile

from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REMBG = os.path.expanduser("~/.cursor/skills/remove-background/scripts/rembg_single.py")
CROP_TRIM = os.path.expanduser("~/.cursor/skills/game-art-pipeline/scripts/crop_trim.py")

DEFAULT_SHEET = os.path.join(
    os.path.dirname(REPO_ROOT),
    "game_assets",
    "huahua",
    "assets",
    "raw",
    "pill_buttons_sheet_4x2_nb2.png",
)
DEFAULT_OUT = os.path.join(
    os.path.dirname(REPO_ROOT),
    "game_assets",
    "huahua",
    "assets",
    "pill_buttons_4x2_processed",
)

GRID_COLS = 4
GRID_ROWS = 2
CELL_INSET = 6


def axis_segments(total: int, count: int) -> list[tuple[int, int]]:
    base = total // count
    rem = total % count
    out: list[tuple[int, int]] = []
    pos = 0
    for i in range(count):
        sz = base + (1 if i < rem else 0)
        out.append((pos, sz))
        pos += sz
    assert pos == total, (pos, total)
    return out


def cell_bbox(im_w: int, im_h: int, row: int, col: int) -> tuple[int, int, int, int]:
    cols = axis_segments(im_w, GRID_COLS)
    rows = axis_segments(im_h, GRID_ROWS)
    x0, cw = cols[col]
    y0, rh = rows[row]
    x0i = min(x0 + CELL_INSET, x0 + cw - 1)
    y0i = min(y0 + CELL_INSET, y0 + rh - 1)
    x1i = max(x0i + 1, x0 + cw - CELL_INSET)
    y1i = max(y0i + 1, y0 + rh - CELL_INSET)
    return x0i, y0i, x1i, y1i


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", default=DEFAULT_SHEET, help="4×2 表图 PNG")
    ap.add_argument("-o", "--output-dir", default=DEFAULT_OUT, help="输出目录")
    ap.add_argument("--padding", type=int, default=4, help="crop_trim 透明边距")
    args = ap.parse_args()

    if not os.path.isfile(args.sheet):
        print("missing sheet:", args.sheet, file=sys.stderr)
        sys.exit(1)
    for script in (REMBG, CROP_TRIM):
        if not os.path.isfile(script):
            print("missing script:", script, file=sys.stderr)
            sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)

    im = Image.open(args.sheet).convert("RGBA")
    w, h = im.size
    print("sheet", args.sheet, w, h)

    with tempfile.TemporaryDirectory(prefix="huahua_pill_4x2_") as td:
        idx = 0
        for row in range(GRID_ROWS):
            for col in range(GRID_COLS):
                idx += 1
                x0, y0, x1, y1 = cell_bbox(w, h, row, col)
                cell = im.crop((x0, y0, x1, y1))
                raw_path = os.path.join(td, f"cell_{row}_{col}_raw.png")
                cell.save(raw_path, "PNG")

                nobg_path = os.path.join(td, f"cell_{row}_{col}_nobg.png")
                r = subprocess.run(
                    [sys.executable, REMBG, raw_path, "-o", nobg_path, "-m", "birefnet-general"],
                    check=False,
                )
                if r.returncode != 0 or not os.path.isfile(nobg_path):
                    print("rembg failed:", raw_path, file=sys.stderr)
                    sys.exit(r.returncode or 1)

                trimmed = os.path.join(td, f"cell_{row}_{col}_trim.png")
                r2 = subprocess.run(
                    [
                        sys.executable,
                        CROP_TRIM,
                        nobg_path,
                        "-o",
                        trimmed,
                        "--padding",
                        str(args.padding),
                    ],
                    check=False,
                )
                if r2.returncode != 0:
                    print("crop_trim failed:", nobg_path, file=sys.stderr)
                    sys.exit(r2.returncode)

                out_im = Image.open(trimmed).convert("RGBA")

                name = f"pill_btn_4x2_r{row + 1}c{col + 1}_idx{idx:02d}.png"
                final_path = os.path.join(args.output_dir, name)
                out_im.save(final_path, "PNG", optimize=True)
                print(final_path, out_im.size)

    print("done ->", args.output_dir)


if __name__ == "__main__":
    main()
