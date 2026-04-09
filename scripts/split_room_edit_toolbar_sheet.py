#!/usr/bin/env python3
"""
将房间编辑工具栏 3×2 合图切成 6 张独立 PNG（透明底），写入 minigame/subpkg_panels/images/ui/。

用法（仓库根）：
  python3 scripts/split_room_edit_toolbar_sheet.py [合图路径]
  python3 scripts/split_room_edit_toolbar_sheet.py --remove-source   # 切完后删除合图

顺序：左→右、上→下 = 放大、缩小、翻转、置前、置后、移除。
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from PIL import Image

_REPO = Path(__file__).resolve().parents[1]
OUT_DIR = _REPO / "minigame/subpkg_panels/images/ui"


def _assets_raw_dir() -> Path:
    env = os.environ.get("GAME_ASSETS_HUAHUA", "").strip()
    if env:
        return Path(env).expanduser().resolve() / "assets" / "raw"
    return (_REPO.parent / "game_assets" / "huahua" / "assets" / "raw").resolve()


def default_sheet_path() -> Path:
    name = "room_edit_toolbar_icons_3x2_nb2.png"
    raw = _assets_raw_dir() / name
    if raw.is_file():
        return raw
    return _REPO / "minigame/subpkg_panels/images/ui" / name

STEMS = (
    "room_edit_toolbar_zoom_in",
    "room_edit_toolbar_zoom_out",
    "room_edit_toolbar_flip",
    "room_edit_toolbar_layer_up",
    "room_edit_toolbar_layer_down",
    "room_edit_toolbar_remove",
)


def split_sizes(total: int, n: int) -> list[int]:
    base = total // n
    rem = total % n
    return [base + (1 if i < rem else 0) for i in range(n)]


def trim_rgba(img: Image.Image, padding: int = 2) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    bbox = img.getbbox()
    if not bbox:
        return img
    x1 = max(0, bbox[0] - padding)
    y1 = max(0, bbox[1] - padding)
    x2 = min(img.width, bbox[2] + padding)
    y2 = min(img.height, bbox[3] + padding)
    return img.crop((x1, y1, x2, y2))


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("sheet", nargs="?", type=Path, default=None, help="3×2 合图 PNG（默认 raw 或 minigame 下的合图）")
    p.add_argument("--remove-source", action="store_true", help="成功后删除合图")
    args = p.parse_args()
    sheet = (args.sheet or default_sheet_path()).resolve()
    if not sheet.is_file():
        print("Missing sheet:", sheet, file=sys.stderr)
        sys.exit(1)

    img = Image.open(sheet).convert("RGBA")
    w, h = img.size
    col_w = split_sizes(w, 3)
    row_h = split_sizes(h, 2)
    x_offs = [0]
    for cw in col_w[:-1]:
        x_offs.append(x_offs[-1] + cw)
    y_offs = [0]
    for rh in row_h[:-1]:
        y_offs.append(y_offs[-1] + rh)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    idx = 0
    for row in range(2):
        for col in range(3):
            x0 = x_offs[col]
            y0 = y_offs[row]
            cw = col_w[col]
            rh = row_h[row]
            cell = img.crop((x0, y0, x0 + cw, y0 + rh))
            cell = trim_rgba(cell, padding=2)
            out = OUT_DIR / f"{STEMS[idx]}.png"
            cell.save(out, "PNG", optimize=True)
            print(f"{idx + 1}/6 {out.name} {cell.size}", flush=True)
            idx += 1

    if args.remove_source:
        sheet.unlink(missing_ok=True)
        print("Removed", sheet.name, flush=True)


if __name__ == "__main__":
    main()
