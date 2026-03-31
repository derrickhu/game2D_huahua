#!/usr/bin/env python3
"""
将 minigame/subpkg_items/images 下棋盘物品 PNG 压到与「金币」同级体量：
- 最长边限制 MAX_SIDE（默认 128，与 special_lucky_coin 一致）
- RGBA → 256 色 FASTOCTREE + Floyd–Steinberg 抖动，再 zlib 9 + optimize

项目规范：.cursor/rules/board-item-png-spec.mdc（棋盘格物品入库前须跑本脚本）

跳过：special/special_lucky_coin.png（已为 P 模式小图，避免二次量化失真）

用法（仓库根）:
  python3 scripts/compress_subpkg_items_pngs.py
  python3 scripts/compress_subpkg_items_pngs.py --dry-run
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
ROOT = REPO / "minigame" / "subpkg_items" / "images"
SKIP_NAMES = frozenset({"special_lucky_coin.png"})


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


def compress_one(path: Path, max_side: int, colors: int, dry_run: bool) -> tuple[int, int, bool]:
    """(old_bytes, new_bytes, would_change)."""
    old = path.stat().st_size
    if path.name in SKIP_NAMES and "special" in path.parts:
        return old, old, False

    try:
        im = Image.open(path)
        im.load()
    except Exception as e:
        print(f"SKIP open {path.relative_to(REPO)}: {e}", file=sys.stderr)
        return old, old, False

    im = shrink_max_side(im, max_side)
    q = im.quantize(
        colors=colors,
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.FLOYDSTEINBERG,
    )

    # 必须写入系统临时目录，勿写在 path.parent：否则微信开发者工具会扫到 tmp*.png 并缓存路径，文件被替换后报 ENOENT
    fd, tmp = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        q.save(tmp, "PNG", optimize=True, compress_level=9)
        new = os.path.getsize(tmp)
        if new >= old and max(im.size) <= max_side:
            os.unlink(tmp)
            return old, old, False
        if new >= old:
            os.unlink(tmp)
            return old, old, False
        if not dry_run:
            shutil.move(tmp, str(path))
            tmp = ""
        else:
            os.unlink(tmp)
            tmp = ""
        return old, new, True
    except Exception as e:
        if tmp and os.path.exists(tmp):
            os.unlink(tmp)
        print(f"SKIP save {path.relative_to(REPO)}: {e}", file=sys.stderr)
        return old, old, False


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-side", type=int, default=128)
    ap.add_argument("--colors", type=int, default=256)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not ROOT.is_dir():
        print(f"Not a directory: {ROOT}", file=sys.stderr)
        sys.exit(1)

    pngs = sorted(p for p in ROOT.rglob("*.png") if p.is_file())
    total_old = sum(p.stat().st_size for p in pngs)
    changed = 0
    saved = 0

    for p in pngs:
        o, n, ch = compress_one(p, args.max_side, args.colors, args.dry_run)
        if ch:
            changed += 1
            saved += o - n
            rel = p.relative_to(REPO)
            if args.dry_run:
                print(f"would shrink {rel}: {o} -> {n} ({100 * (1 - n / o):.1f}% saved)")

    total_new = total_old - saved
    print(f"Files: {len(pngs)}")
    print(f"Updated: {changed}" + (" (dry-run)" if args.dry_run else ""))
    print(f"Total before: {total_old / 1024:.1f} KiB")
    print(f"Total after:  {total_new / 1024:.1f} KiB")
    print(f"Saved:        {saved / 1024:.1f} KiB")


if __name__ == "__main__":
    main()
