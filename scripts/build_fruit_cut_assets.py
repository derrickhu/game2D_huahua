#!/usr/bin/env python3
"""
果切线美术入库：白底合图 → gutter 切格 → rembg → trim → 写入 subpkg_items → compress

用法（仓库根）：
  python3 scripts/build_fruit_cut_assets.py --sheet farm ../game_assets/huahua/assets/raw/tool_line_farm_nb2.png
  python3 scripts/build_fruit_cut_assets.py --sheet fruit_cut ../game_assets/huahua/assets/raw/tool_line_fruit_cut_nb2.png
  python3 scripts/build_fruit_cut_assets.py --sheet whole ../game_assets/huahua/assets/raw/food_whole_fruits_nb2.png
  python3 scripts/build_fruit_cut_assets.py --sheet cut_strawberry ../game_assets/huahua/assets/raw/food_cut_strawberry_line_nb2.png
  python3 scripts/build_fruit_cut_assets.py --all   # 处理 raw/ 下全部约定文件名
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from PIL import Image

from huahua_paths import game_assets_dir, repo_root

_REPO = repo_root()
_ASSETS = game_assets_dir()
_RAW = _ASSETS / "raw"
_SPLIT = _ASSETS / "split"
_NOBG = _ASSETS / "nobg"
_FINAL = _ASSETS / "final"
_ITEMS = _REPO / "minigame" / "subpkg_items" / "images"

REMBG = Path.home() / ".cursor/skills/remove-background/scripts/rembg_single.py"
CROP = Path.home() / ".cursor/skills/game-art-pipeline/scripts/crop_trim.py"
GUTTER = _REPO / "scripts" / "split_sheet_row_by_gutter.py"
COMPRESS = _REPO / "scripts" / "compress_subpkg_items_pngs.py"

SHEETS: dict[str, dict] = {
    "farm": {
        "raw": "tool_line_farm_nb2.png",
        "n": 4,
        "grid": (2, 2),
        "rembg": "birefnet-general",
        "padding": 4,
        "square_icon": True,
        "outputs": [
            ("tool_farm_1", _ITEMS / "tools/farm/tool_farm_1.png"),
            ("tool_farm_2", _ITEMS / "tools/farm/tool_farm_2.png"),
            ("tool_farm_3", _ITEMS / "tools/farm/tool_farm_3.png"),
            ("tool_farm_4", _ITEMS / "tools/farm/tool_farm_4.png"),
        ],
    },
    "fruit_cut": {
        "raw": "tool_line_fruit_cut_nb2.png",
        "n": 4,
        "rembg": "birefnet-general",
        "padding": 4,
        "outputs": [
            ("tool_fruit_cut_1", _ITEMS / "tools/fruit_cut/tool_fruit_cut_1.png"),
            ("tool_fruit_cut_2", _ITEMS / "tools/fruit_cut/tool_fruit_cut_2.png"),
            ("tool_fruit_cut_3", _ITEMS / "tools/fruit_cut/tool_fruit_cut_3.png"),
            ("tool_fruit_cut_4", _ITEMS / "tools/fruit_cut/tool_fruit_cut_4.png"),
        ],
    },
    "whole": {
        "raw": "food_whole_fruits_nb2.png",
        "n": 4,
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_fruit_strawberry_1", _ITEMS / "food/whole/food_fruit_strawberry_1.png"),
            ("food_fruit_watermelon_1", _ITEMS / "food/whole/food_fruit_watermelon_1.png"),
            ("food_fruit_pineapple_1", _ITEMS / "food/whole/food_fruit_pineapple_1.png"),
            ("food_fruit_grape_1", _ITEMS / "food/whole/food_fruit_grape_1.png"),
        ],
    },
    "cut_strawberry": {
        "raw": "food_cut_strawberry_line_nb2.png",
        "n": 3,
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_cut_strawberry_1", _ITEMS / "food/cut/food_cut_strawberry_1.png"),
            ("food_cut_strawberry_2", _ITEMS / "food/cut/food_cut_strawberry_2.png"),
            ("food_cut_strawberry_3", _ITEMS / "food/cut/food_cut_strawberry_3.png"),
        ],
    },
    "cut_watermelon": {
        "raw": "food_cut_watermelon_line_nb2.png",
        "n": 3,
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_cut_watermelon_1", _ITEMS / "food/cut/food_cut_watermelon_1.png"),
            ("food_cut_watermelon_2", _ITEMS / "food/cut/food_cut_watermelon_2.png"),
            ("food_cut_watermelon_3", _ITEMS / "food/cut/food_cut_watermelon_3.png"),
        ],
    },
    "cut_pineapple": {
        "raw": "food_cut_pineapple_line_nb2.png",
        "n": 3,
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_cut_pineapple_1", _ITEMS / "food/cut/food_cut_pineapple_1.png"),
            ("food_cut_pineapple_2", _ITEMS / "food/cut/food_cut_pineapple_2.png"),
            ("food_cut_pineapple_3", _ITEMS / "food/cut/food_cut_pineapple_3.png"),
        ],
    },
    "cut_grape": {
        "raw": "food_cut_grape_line_nb2.png",
        "n": 3,
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_cut_grape_1", _ITEMS / "food/cut/food_cut_grape_1.png"),
            ("food_cut_grape_2", _ITEMS / "food/cut/food_cut_grape_2.png"),
            ("food_cut_grape_3", _ITEMS / "food/cut/food_cut_grape_3.png"),
        ],
    },
}


def _run(cmd: list[str]) -> None:
    r = subprocess.run(cmd)
    if r.returncode != 0:
        sys.exit(r.returncode)


def _to_square_icon(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    side = max(w, h)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return sq


def _split_row_equal(sheet_path: Path, index: int, n: int, out_path: Path, *, margin: int = 4) -> None:
    im = Image.open(sheet_path).convert("RGBA")
    w, h = im.size
    cw = w // n
    left = index * cw + margin
    right = (index + 1) * cw - margin if index < n - 1 else w - margin
    crop = im.crop((left, 0, right, h))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(out_path, optimize=True)
    print(f"split {sheet_path.name} idx{index} -> {out_path} ({crop.size})")


def _split_grid_equal(
    sheet_path: Path,
    index: int,
    cols: int,
    rows: int,
    out_path: Path,
    *,
    margin: int = 8,
) -> None:
    im = Image.open(sheet_path).convert("RGBA")
    w, h = im.size
    cw, ch = w // cols, h // rows
    col = index % cols
    row = index // cols
    left = col * cw + margin
    top = row * ch + margin
    right = (col + 1) * cw - margin if col < cols - 1 else w - margin
    bottom = (row + 1) * ch - margin if row < rows - 1 else h - margin
    crop = im.crop((left, top, right, bottom))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(out_path, optimize=True)
    print(f"split {sheet_path.name} grid{col},{row} -> {out_path} ({crop.size})")


def process_sheet(key: str, sheet_path: Path | None = None) -> None:
    cfg = SHEETS[key]
    raw_path = sheet_path or (_RAW / cfg["raw"])
    if not raw_path.is_file():
        sys.exit(f"Missing sheet: {raw_path}")

    _SPLIT.mkdir(parents=True, exist_ok=True)
    _NOBG.mkdir(parents=True, exist_ok=True)
    _FINAL.mkdir(parents=True, exist_ok=True)

    names_and_dests = cfg["outputs"]
    n = cfg["n"]
    grid = cfg.get("grid")
    square_icon = cfg.get("square_icon", False)

    for i, (stem, dest) in enumerate(names_and_dests):
        split_out = _SPLIT / f"{stem}.png"
        nobg_out = _NOBG / f"{stem}.png"
        final_out = _FINAL / f"{stem}.png"
        dest.parent.mkdir(parents=True, exist_ok=True)

        if grid:
            cols, rows = grid
            _split_grid_equal(raw_path, i, cols, rows, split_out)
        else:
            _split_row_equal(raw_path, i, n, split_out)
        _run([
            sys.executable, str(REMBG), str(split_out),
            "-o", str(nobg_out),
            "-m", cfg["rembg"],
        ])
        _run([
            sys.executable, str(CROP), str(nobg_out),
            "-o", str(final_out),
            "--padding", str(cfg["padding"]),
        ])
        out_im = Image.open(final_out).convert("RGBA")
        if square_icon:
            out_im = _to_square_icon(out_im)
        out_im.save(dest, optimize=True)
        print(f"-> {dest}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", choices=list(SHEETS.keys()))
    ap.add_argument("path", nargs="?", help="override sheet png path")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--compress", action="store_true", help="run compress_subpkg_items_pngs.py after")
    args = ap.parse_args()

    if args.all:
        for key in SHEETS:
            process_sheet(key)
    elif args.sheet:
        p = Path(args.path).resolve() if args.path else None
        process_sheet(args.sheet, p)
    else:
        ap.print_help()
        sys.exit(1)

    if args.all or args.compress:
        _run([sys.executable, str(COMPRESS)])
        print("compressed subpkg_items")


if __name__ == "__main__":
    main()
