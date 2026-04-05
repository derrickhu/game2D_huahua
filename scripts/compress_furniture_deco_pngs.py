#!/usr/bin/env python3
"""
将 minigame/subpkg_deco/images/furniture 下 PNG 与现有家具体量对齐：
- 最长边不超过 MAX_SIDE（默认 171，与 normalize_greenhouse_furniture_pngs.py 一致）
- RGBA + LANCZOS 缩小（不量化调色板，避免装修大图色带）
- zlib compress_level=9 + optimize；默认仅当缩小了分辨率或新文件更小才覆盖；加 --force 则凡成功写出即覆盖（保证全量过一遍规范）

用法（仓库根）:
  python3 scripts/compress_furniture_deco_pngs.py
  python3 scripts/compress_furniture_deco_pngs.py --force
  python3 scripts/compress_furniture_deco_pngs.py --dry-run
  python3 scripts/compress_furniture_deco_pngs.py --max-side 171 path/to/one.png
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
DEFAULT_ROOT = REPO / "minigame" / "subpkg_deco" / "images" / "furniture"


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


def process_one(
    path: Path, max_side: int, dry_run: bool, force: bool
) -> tuple[int, int, bool, str]:
    """(old_bytes, new_bytes, changed, note)."""
    old = path.stat().st_size
    try:
        im = Image.open(path)
        im.load()
    except Exception as e:
        return old, old, False, f"SKIP open: {e}"

    out = fit_max_rgba(im, max_side)
    resized = out.size != im.size

    fd, tmp = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        out.save(tmp, format="PNG", optimize=True, compress_level=9)
        new = os.path.getsize(tmp)
        # 强制模式：凡可写出且不长胖则覆盖（解决「已 171 边长但从未 zlib 优化」被跳过）
        write = resized or (new < old) or (force and new <= old)
        if write:
            if not dry_run:
                shutil.move(tmp, str(path))
                tmp = ""
            else:
                os.unlink(tmp)
                tmp = ""
            if resized:
                reason = "resized"
            elif force and new == old:
                reason = "force-same"
            elif force:
                reason = "force-optimize"
            else:
                reason = "optimized"
            return old, new, True, reason
        os.unlink(tmp)
        tmp = ""
        return old, old, False, ""
    except Exception as e:
        if tmp and os.path.exists(tmp):
            os.unlink(tmp)
        return old, old, False, f"SKIP save: {e}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-side", type=int, default=171)
    ap.add_argument(
        "--force",
        action="store_true",
        help="凡能写出即覆盖（仍遵守 max-side），避免已达标但未重编码的 PNG 被跳过",
    )
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="可选：仅处理这些 PNG（否则处理 furniture 目录下全部）",
    )
    args = ap.parse_args()

    if args.paths:
        pngs = [p.resolve() for p in args.paths if p.suffix.lower() == ".png"]
        for p in pngs:
            if not p.is_file():
                print(f"missing {p}", file=sys.stderr)
                return 1
    else:
        if not DEFAULT_ROOT.is_dir():
            print(f"Not a directory: {DEFAULT_ROOT}", file=sys.stderr)
            return 1
        pngs = sorted(p for p in DEFAULT_ROOT.glob("*.png") if p.is_file())

    total_old = 0
    total_new = 0
    changed = 0
    for p in pngs:
        o, n, ch, note = process_one(p, args.max_side, args.dry_run, args.force)
        total_old += o
        total_new += n if ch else o
        if ch:
            changed += 1
            try:
                rel = p.relative_to(REPO)
            except ValueError:
                rel = p
            tag = "[dry-run] " if args.dry_run else ""
            print(f"{tag}{rel}: {o} -> {n} bytes ({note})")

    print(
        f"furniture_pngs: {len(pngs)} files, {changed} changed, "
        f"{total_old} -> {total_new} bytes (saved {total_old - total_new})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
