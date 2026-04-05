#!/usr/bin/env python3
"""
压缩 minigame/subpkg_panels/images/ui 下 PNG（全屏面板、条带等），控制分包体积。

默认只处理 daily_challenge*.png；与棋盘物品脚本类似：
- 最长边上限 MAX_SIDE（默认 1024，不足不放大）
- RGBA → 256 色 FASTOCTREE + Floyd–Steinberg，zlib 9 + optimize
- 中间文件写入系统临时目录（避免微信开发者工具缓存 ENOENT）

用法（仓库根）:
  python3 scripts/compress_subpkg_panels_ui_pngs.py
  python3 scripts/compress_subpkg_panels_ui_pngs.py --dry-run
  python3 scripts/compress_subpkg_panels_ui_pngs.py --all-ui --dry-run   # 整个 ui 目录
  python3 scripts/compress_subpkg_panels_ui_pngs.py --max-side 900 path/to/a.png
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
ROOT = REPO / "minigame" / "subpkg_panels" / "images" / "ui"


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
    old = path.stat().st_size
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

    fd, tmp = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        q.save(tmp, "PNG", optimize=True, compress_level=9)
        new = os.path.getsize(tmp)
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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-side", type=int, default=1024, help="最长边像素上限（默认 1024）")
    ap.add_argument("--colors", type=int, default=256)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--all-ui",
        action="store_true",
        help="处理 ui 目录下全部 PNG（默认仅 daily_challenge*.png）",
    )
    ap.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="可选：仅处理指定文件",
    )
    args = ap.parse_args()

    if args.paths:
        pngs = []
        for p in args.paths:
            p = p.resolve()
            if not p.is_file():
                print(f"Not a file: {p}", file=sys.stderr)
                return 1
            pngs.append(p)
    else:
        if not ROOT.is_dir():
            print(f"Not a directory: {ROOT}", file=sys.stderr)
            return 1
        pngs = sorted(p for p in ROOT.rglob("*.png") if p.is_file())
        if not args.all_ui:
            pngs = [p for p in pngs if p.name.startswith("daily_challenge")]

    total_old = sum(p.stat().st_size for p in pngs)
    changed = 0
    saved = 0

    for p in pngs:
        o, n, ch = compress_one(p, args.max_side, args.colors, args.dry_run)
        if ch:
            changed += 1
            saved += o - n
            rel = p.relative_to(REPO)
            pct = 100 * (1 - n / o)
            tag = "would shrink" if args.dry_run else "shrunk"
            print(f"{tag} {rel}: {o} -> {n} ({pct:.1f}% saved)")

    total_new = total_old - saved
    print(f"Files: {len(pngs)}")
    print(f"Updated: {changed}" + (" (dry-run)" if args.dry_run else ""))
    print(f"Total before: {total_old / 1024:.1f} KiB")
    print(f"Total after:  {total_new / 1024:.1f} KiB")
    print(f"Saved:        {saved / 1024:.1f} KiB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
