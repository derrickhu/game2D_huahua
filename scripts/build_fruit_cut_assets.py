#!/usr/bin/env python3
"""
果切线美术入库：白底合图 → gutter 切格 → rembg → trim → 写入 subpkg_items → compress

用法（仓库根）：
  python3 scripts/build_fruit_cut_assets.py --sheet farm ../game_assets/huahua/assets/raw/tool_line_farm_v8_nb2.png
  python3 scripts/build_fruit_cut_assets.py --sheet fruit_cut ../game_assets/huahua/assets/raw/tool_line_fruit_cut_nb2.png
  python3 scripts/build_fruit_cut_assets.py --sheet whole_v4 ../game_assets/huahua/assets/raw/food_whole_fruits_v4_nb2.png
  python3 scripts/build_fruit_cut_assets.py --sheet avocado_line_v6 ../game_assets/huahua/assets/raw/food_avocado_line_v6_nb2.png
  python3 scripts/build_fruit_cut_assets.py --sheet dragonfruit_cut_v6 ../game_assets/huahua/assets/raw/food_dragonfruit_cut_v6_nb2.png
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
        "raw": "tool_line_farm_v8_nb2.png",
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
        "raw": "tool_line_fruit_cut_v5_nb2.png",
        "n": 3,
        "grid": (2, 2),
        "grid_indices": [1, 2, 3],
        "rembg": "birefnet-general",
        "padding": 4,
        "square_icon": True,
        "outputs": [
            ("tool_fruit_cut_1", _ITEMS / "tools/fruit_cut/tool_fruit_cut_1.png"),
            ("tool_fruit_cut_2", _ITEMS / "tools/fruit_cut/tool_fruit_cut_2.png"),
            ("tool_fruit_cut_3", _ITEMS / "tools/fruit_cut/tool_fruit_cut_3.png"),
        ],
    },
    "whole": {
        "raw": "food_whole_fruits_nb2.png",
        "n": 4,
        "grid": (2, 2),
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_fruit_1", _ITEMS / "food/whole/food_fruit_1.png"),
            ("food_fruit_4", _ITEMS / "food/whole/food_fruit_4.png"),
            ("food_fruit_2", _ITEMS / "food/whole/food_fruit_2.png"),
            ("food_fruit_3", _ITEMS / "food/whole/food_fruit_3.png"),
        ],
    },
    "whole_v4": {
        "raw": "food_whole_fruits_v4_nb2.png",
        "n": 3,
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_fruit_1", _ITEMS / "food/whole/food_fruit_1.png"),
            ("food_fruit_2", _ITEMS / "food/whole/food_fruit_2.png"),
            ("food_fruit_3", _ITEMS / "food/whole/food_fruit_3.png"),
        ],
    },
    "avocado_line_v6": {
        "raw": "food_avocado_line_v6_nb2.png",
        "n": 4,
        "grid": (2, 2),
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_fruit_1", _ITEMS / "food/whole/food_fruit_1.png"),
            ("food_cut_avocado_1", _ITEMS / "food/cut/food_cut_avocado_1.png"),
            ("food_cut_avocado_2", _ITEMS / "food/cut/food_cut_avocado_2.png"),
            ("food_cut_avocado_3", _ITEMS / "food/cut/food_cut_avocado_3.png"),
        ],
    },
    "avocado_line": {
        "raw": "food_avocado_line_v4_nb2.png",
        "n": 4,
        "grid": (2, 2),
        "grid_indices": [0, 1, 2, 3],
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_fruit_1", _ITEMS / "food/whole/food_fruit_1.png"),
            ("food_cut_avocado_1", _ITEMS / "food/cut/food_cut_avocado_1.png"),
            ("food_cut_avocado_2", _ITEMS / "food/cut/food_cut_avocado_2.png"),
            ("food_cut_avocado_3", _ITEMS / "food/cut/food_cut_avocado_3.png"),
        ],
    },
    "dragonfruit_cut_v6": {
        "raw": "food_dragonfruit_cut_v6_nb2.png",
        "n": 3,
        "top_row_only": True,
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_cut_dragonfruit_1", _ITEMS / "food/cut/food_cut_dragonfruit_1.png"),
            ("food_cut_dragonfruit_2", _ITEMS / "food/cut/food_cut_dragonfruit_2.png"),
            ("food_cut_dragonfruit_3", _ITEMS / "food/cut/food_cut_dragonfruit_3.png"),
        ],
    },
    "dragonfruit_line": {
        "raw": "food_dragonfruit_line_v4_nb2.png",
        "n": 4,
        "grid": (2, 2),
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_fruit_3", _ITEMS / "food/whole/food_fruit_3.png"),
            ("food_cut_dragonfruit_1", _ITEMS / "food/cut/food_cut_dragonfruit_1.png"),
            ("food_cut_dragonfruit_2", _ITEMS / "food/cut/food_cut_dragonfruit_2.png"),
            ("food_cut_dragonfruit_3", _ITEMS / "food/cut/food_cut_dragonfruit_3.png"),
        ],
    },
    "cut_avocado": {
        "raw": "food_cut_avocado_line_nb2.png",
        "n": 3,
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_cut_avocado_1", _ITEMS / "food/cut/food_cut_avocado_1.png"),
            ("food_cut_avocado_2", _ITEMS / "food/cut/food_cut_avocado_2.png"),
            ("food_cut_avocado_3", _ITEMS / "food/cut/food_cut_avocado_3.png"),
        ],
    },
    "cut_watermelon": {
        "raw": "food_cut_watermelon_line_nb2.png",
        "n": 3,
        "grid": (2, 2),
        "grid_indices": [0, 1, 3],
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
        "grid": (2, 2),
        "grid_indices": [0, 1, 3],
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_cut_pineapple_1", _ITEMS / "food/cut/food_cut_pineapple_1.png"),
            ("food_cut_pineapple_2", _ITEMS / "food/cut/food_cut_pineapple_2.png"),
            ("food_cut_pineapple_3", _ITEMS / "food/cut/food_cut_pineapple_3.png"),
        ],
    },
    "cut_dragonfruit": {
        "raw": "food_cut_dragonfruit_line_nb2.png",
        "n": 3,
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_cut_dragonfruit_1", _ITEMS / "food/cut/food_cut_dragonfruit_1.png"),
            ("food_cut_dragonfruit_2", _ITEMS / "food/cut/food_cut_dragonfruit_2.png"),
            ("food_cut_dragonfruit_3", _ITEMS / "food/cut/food_cut_dragonfruit_3.png"),
        ],
    },
    "orange_whole": {
        "raw": "food_fruit_5_orange_v3_nb2.png",
        "n": 1,
        "rembg": "birefnet-general",
        "padding": 8,
        "outputs": [
            ("food_fruit_5", _ITEMS / "food/whole/food_fruit_5.png"),
        ],
    },
    "cut_orange": {
        "raw": "food_cut_orange_line_v2_nb2.png",
        "n": 3,
        "rembg": "isnet-anime",
        "padding": 8,
        "outputs": [
            ("food_cut_orange_1", _ITEMS / "food/cut/food_cut_orange_1.png"),
            ("food_cut_orange_2", _ITEMS / "food/cut/food_cut_orange_2.png"),
            ("food_cut_orange_3", _ITEMS / "food/cut/food_cut_orange_3.png"),
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


def _split_row_equal(
    sheet_path: Path,
    index: int,
    n: int,
    out_path: Path,
    *,
    margin: int = 4,
    top_row_only: bool = False,
) -> None:
    im = Image.open(sheet_path).convert("RGBA")
    w, h = im.size
    if top_row_only:
        h = h // 2
        im = im.crop((0, 0, w, h))
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
            grid_indices = cfg.get("grid_indices")
            gi = grid_indices[i] if grid_indices else i
            _split_grid_equal(raw_path, gi, cols, rows, split_out)
        else:
            _split_row_equal(
                raw_path,
                i,
                n,
                split_out,
                margin=10 if cfg.get("top_row_only") else 4,
                top_row_only=cfg.get("top_row_only", False),
            )
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
