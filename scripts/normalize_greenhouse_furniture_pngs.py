#!/usr/bin/env python3
"""
Align greenhouse / 花房批次家具 PNG with room 格贴图源，并统一缩放到与常见家具图标一致（最长边 MAX_SIDE）。

- 自 room/ 覆盖：room_26→orn_greenhouse_cart、room_27→garden_flower_stall（软木板 / 浇水壶花铲 / 地毯 / 衣帽架 / 花车 格图）
- 盆栽线成品以 raw 的 furniture_greenhouse_pot_*_nb2 经 rembg 入库为准，勿再用 room 格覆盖 sprout/bud/daisy
- 其余 greenhouse_pot_* 与 wallart_greenhouse_chalkboard：仅缩放优化（不替换源图）
- 空白/64×64 占位：用棋盘鲜花 icon 临时顶替（见 PLACEHOLDER_FRESH），便于后续 NB2 覆盖

用法：仓库根目录
  python3 scripts/normalize_greenhouse_furniture_pngs.py
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ROOM = ROOT / "minigame/subpkg_deco/images/room"
FURN = ROOT / "minigame/subpkg_deco/images/furniture"
FRESH = ROOT / "minigame/subpkg_items/images/flowers/fresh"

MAX_SIDE = 171

ROOM_TO_FURN = [
    ("room_26.png", "orn_greenhouse_cart.png"),
    ("room_27.png", "garden_flower_stall.png"),
    ("room_30.png", "orn_greenhouse_rug.png"),
    ("room_32.png", "orn_greenhouse_coat_rack.png"),
    ("room_07.png", "orn_greenhouse_flower_cart.png"),
]

PLACEHOLDER_FRESH = {
    # 仅当文件仍为空白占位时，用棋盘鲜花顶替（正式图已由 NB2+rembg 写入则走缩放分支）
    "greenhouse_pot_orchid.png": "flower_fresh_8.png",
    "greenhouse_pot_peony_gold.png": "flower_fresh_10.png",
}

OTHER_GREENHOUSE = [
    "wallart_greenhouse_chalkboard.png",
    "greenhouse_pot_sunflower.png",
    "greenhouse_pot_carnation.png",
    "greenhouse_pot_rose.png",
    "greenhouse_vase_tulip.png",
    "greenhouse_vase_peony.png",
    "greenhouse_vase_lotus.png",
]


def is_broken_placeholder(path: Path) -> bool:
    if not path.exists():
        return True
    if path.stat().st_size < 200:
        return True
    with Image.open(path) as im:
        w, h = im.size
    return w <= 64 and h <= 64


def fit_max_rgba(im: Image.Image, max_side: int) -> Image.Image:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    w, h = im.size
    scale = min(max_side / w, max_side / h)
    if scale >= 1.0:
        return im
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def save_optimized_png(im: Image.Image, path: Path) -> None:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, format="PNG", optimize=True, compress_level=9)


def main() -> int:
    if not ROOM.is_dir() or not FURN.is_dir():
        print("Expected minigame/subpkg_deco paths missing", file=sys.stderr)
        return 1

    for room_name, furn_name in ROOM_TO_FURN:
        src = ROOM / room_name
        dst = FURN / furn_name
        if not src.exists():
            print(f"skip missing {src}", file=sys.stderr)
            continue
        shutil.copy2(src, dst)
        with Image.open(dst) as im:
            out = fit_max_rgba(im, MAX_SIDE)
        save_optimized_png(out, dst)
        print(f"aligned+scaled {furn_name} <- {room_name} -> {out.size}")

    for furn_name, fresh_name in PLACEHOLDER_FRESH.items():
        dst = FURN / furn_name
        src = FRESH / fresh_name
        if not src.exists():
            print(f"skip placeholder {furn_name}: missing {src}", file=sys.stderr)
            continue
        if is_broken_placeholder(dst):
            with Image.open(src) as im:
                out = fit_max_rgba(im, MAX_SIDE)
            save_optimized_png(out, dst)
            print(f"placeholder {furn_name} <- {fresh_name} -> {out.size}")
        else:
            with Image.open(dst) as im:
                out = fit_max_rgba(im, MAX_SIDE)
            save_optimized_png(out, dst)
            print(f"scaled {furn_name} -> {out.size}")

    for name in OTHER_GREENHOUSE:
        path = FURN / name
        if not path.exists():
            continue
        with Image.open(path) as im:
            out = fit_max_rgba(im, MAX_SIDE)
        save_optimized_png(out, path)
        print(f"scaled {name} -> {out.size}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
