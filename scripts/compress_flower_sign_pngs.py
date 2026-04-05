#!/usr/bin/env python3
"""
许愿池 / 大地图喷泉相关 PNG 压体积（Pillow，与 items 脚本同思路）。

- 全屏立绘 flower_sign_gacha_scene_nb2：保持分辨率（已与设计宽接近），256 色 FASTOCTREE + Floyd–Steinberg
- 大地图双帧 thumb：最长边 288（屏上约 150px，2× 余量），再 256 色量化
- 主包 icon_flower_sign_coin：最长边 128，256 色量化

写入前用系统临时文件，避免微信开发者工具缓存 minigame 内 tmp 路径。

用法（仓库根）:
  python3 scripts/compress_flower_sign_pngs.py
  python3 scripts/compress_flower_sign_pngs.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]

# (相对 REPO, max_side: 0 表示不缩放只量化)
TARGETS: list[tuple[str, int]] = [
    ("minigame/subpkg_panels/images/ui/flower_sign_gacha_scene_nb2.png", 0),
    ("minigame/subpkg_panels/images/ui/worldmap_thumb_wishing_fountain_1.png", 288),
    ("minigame/subpkg_panels/images/ui/worldmap_thumb_wishing_fountain_2.png", 288),
    ("minigame/images/ui/icon_flower_sign_coin.png", 128),
]


def shrink_max_side(im: Image.Image, max_side: int) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    m = max(w, h)
    if m <= max_side:
        return im
    s = max_side / m
    nw = max(1, int(round(w * s)))
    nh = max(1, int(round(h * s)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def compress_one(rel: str, max_side: int, colors: int, dry_run: bool) -> bool:
    path = REPO / rel
    if not path.is_file():
        print(f"SKIP missing: {rel}", file=sys.stderr)
        return False
    old = path.stat().st_size
    try:
        im = Image.open(path)
        im.load()
    except Exception as e:
        print(f"SKIP open {rel}: {e}", file=sys.stderr)
        return False

    if max_side > 0:
        im = shrink_max_side(im, max_side)
    else:
        im = im.convert("RGBA")

    q = im.quantize(
        colors=colors,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.FLOYDSTEINBERG,
    )

    fd, tmp = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        q.save(tmp, "PNG", optimize=True, compress_level=9)
        new = os.path.getsize(tmp)
        if new >= old:
            os.unlink(tmp)
            print(f"SKIP {rel}: output not smaller ({old // 1024}KB)")
            return False
        if dry_run:
            os.unlink(tmp)
            print(f"[dry-run] {rel}: {old // 1024}KB -> {new // 1024}KB")
            return True
        shutil.move(tmp, str(path))
        print(f"OK {rel}: {old // 1024}KB -> {new // 1024}KB")
        return True
    except Exception as e:
        if os.path.exists(tmp):
            os.unlink(tmp)
        print(f"SKIP save {rel}: {e}", file=sys.stderr)
        return False


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--colors", type=int, default=256)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    ok_n = 0
    for rel, mx in TARGETS:
        if compress_one(rel, mx, args.colors, args.dry_run):
            ok_n += 1
    if args.dry_run:
        print(f"[dry-run] would update {ok_n} file(s)")
    elif ok_n:
        print(f"Done: {ok_n} file(s)")


if __name__ == "__main__":
    main()
