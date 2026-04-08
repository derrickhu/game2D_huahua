#!/usr/bin/env python3
"""
从 NB2 输出的 512×512、4×5 格装修托盘 Tab 图标表切图 → rembg → crop_trim。

格内为「横扁」胶囊（列宽 > 行高），共 4 列 × 5 行。
有内容的格子（仅 idle 单态 7 个，与游戏内一致）：
  (0,0)-(0,3) flower_room, furniture, appliance, ornament
  (1,0)-(1,2) wallart, garden, room_styles — (1,3) 空
  其余格跳过（若表内仍含 selected 行，填图时可留空，脚本不裁）。

512÷4=128 列宽；512÷5 余 2 → 行高 103+103+102+102+102。

用法（仓库根）：
  python3 scripts/process_furniture_tray_tab_sheet.py \\
    --sheet ../game_assets/huahua/assets/raw/deco_tab_icons_sheet_4x5_flat_nb2.png

依赖：rembg birefnet-general；~/.cursor/skills/remove-background、game-art-pipeline 脚本路径。
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from typing import List, Tuple

from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(REPO_ROOT, "minigame", "subpkg_panels", "images", "ui")
REMBG = os.path.expanduser("~/.cursor/skills/remove-background/scripts/rembg_single.py")
CROP_TRIM = os.path.expanduser("~/.cursor/skills/game-art-pipeline/scripts/crop_trim.py")

GRID_COLS = 4
GRID_ROWS = 5

# (row, col), slug, suffix — 仅 idle；输出 furniture_tray_tab_{slug}_idle.png
SLOTS: List[Tuple[Tuple[int, int], str, str]] = [
    ((0, 0), "flower_room", "idle"),
    ((0, 1), "furniture", "idle"),
    ((0, 2), "appliance", "idle"),
    ((0, 3), "ornament", "idle"),
    ((1, 0), "wallart", "idle"),
    ((1, 1), "garden", "idle"),
    ((1, 2), "room_styles", "idle"),
]


def axis_segments(total: int, count: int) -> List[Tuple[int, int]]:
    base = total // count
    rem = total % count
    out: List[Tuple[int, int]] = []
    pos = 0
    for i in range(count):
        sz = base + (1 if i < rem else 0)
        out.append((pos, sz))
        pos += sz
    assert pos == total, (pos, total)
    return out


def cell_bbox(
    im_w: int,
    im_h: int,
    row: int,
    col: int,
) -> Tuple[int, int, int, int]:
    cols = axis_segments(im_w, GRID_COLS)
    rows = axis_segments(im_h, GRID_ROWS)
    x0, cw = cols[col]
    y0, rh = rows[row]
    return x0, y0, x0 + cw, y0 + rh


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--sheet",
        default=os.path.join(
            os.path.dirname(REPO_ROOT),
            "game_assets",
            "huahua",
            "assets",
            "raw",
            "deco_tab_icons_sheet_4x5_flat_nb2.png",
        ),
        help="4×5 原图表 PNG（512×512）",
    )
    ap.add_argument("--padding", type=int, default=4, help="crop_trim 透明边距")
    args = ap.parse_args()

    if not os.path.isfile(args.sheet):
        print("missing sheet:", args.sheet, file=sys.stderr)
        sys.exit(1)
    for script in (REMBG, CROP_TRIM):
        if not os.path.isfile(script):
            print("missing script:", script, file=sys.stderr)
            sys.exit(1)

    im = Image.open(args.sheet).convert("RGBA")
    w, h = im.size
    if w != 512 or h != 512:
        print(f"warn: expected 512×512, got {w}×{h}", file=sys.stderr)

    os.makedirs(OUT_DIR, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="huahua_tray_tabs_") as td:
        for (row, col), slug, suffix in SLOTS:
            x0, y0, x1, y1 = cell_bbox(w, h, row, col)
            cell = im.crop((x0, y0, x1, y1))
            raw_path = os.path.join(td, f"cell_{row}_{col}_{slug}_{suffix}.png")
            cell.save(raw_path, "PNG")

            nobg_path = os.path.join(td, f"cell_{row}_{col}_{slug}_{suffix}_nobg.png")
            r = subprocess.run(
                [sys.executable, REMBG, raw_path, "-o", nobg_path, "-m", "birefnet-general"],
                check=False,
            )
            if r.returncode != 0 or not os.path.isfile(nobg_path):
                print("rembg failed:", raw_path, file=sys.stderr)
                sys.exit(r.returncode or 1)

            final_name = f"furniture_tray_tab_{slug}_{suffix}.png"
            final_path = os.path.join(OUT_DIR, final_name)
            r2 = subprocess.run(
                [
                    sys.executable,
                    CROP_TRIM,
                    nobg_path,
                    "-o",
                    final_path,
                    "--padding",
                    str(args.padding),
                ],
                check=False,
            )
            if r2.returncode != 0:
                print("crop_trim failed:", nobg_path, file=sys.stderr)
                sys.exit(r2.returncode)

            print(final_path, Image.open(final_path).size)

    print("done ->", OUT_DIR)


if __name__ == "__main__":
    main()
