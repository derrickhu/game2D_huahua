#!/usr/bin/env python3
"""将家具 RGBA 缩放到最长边 = max_side（可放大或缩小），LANCZOS，zlib 9。"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]


def fit_max_rgba(im: Image.Image, max_side: int) -> Image.Image:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    w, h = im.size
    scale = min(max_side / w, max_side / h)
    if abs(scale - 1.0) < 1e-6:
        return im
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-side", type=int, default=342)
    ap.add_argument("paths", nargs="+")
    args = ap.parse_args()

    for raw in args.paths:
        path = Path(raw)
        if not path.is_file():
            print(f"SKIP missing: {path}", file=sys.stderr)
            continue
        im = Image.open(path)
        im.load()
        out = fit_max_rgba(im, args.max_side)
        old = path.stat().st_size
        fd, tmp = tempfile.mkstemp(suffix=".png")
        os.close(fd)
        try:
            out.save(tmp, format="PNG", optimize=True, compress_level=9)
            new = os.path.getsize(tmp)
            shutil.move(tmp, str(path))
            print(f"{path}: {im.size} -> {out.size}, {old} -> {new} bytes")
        finally:
            if os.path.isfile(tmp):
                os.unlink(tmp)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
