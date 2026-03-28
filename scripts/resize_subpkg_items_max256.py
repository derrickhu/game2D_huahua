#!/usr/bin/env python3
"""
将 subpkg_items 内棋盘物品 PNG 统一为与鲜花/饮品已压图一致：最长边 ≤256，等比缩放，透明底保留。
仅处理 max(w,h) > 256 的文件；已达标的不动。
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

MAX_SIDE = 256
ROOT = Path(__file__).resolve().parents[1] / "minigame/subpkg_items/images"
OXIPNG = Path("/opt/homebrew/bin/oxipng")


def process(path: Path) -> bool:
    im = Image.open(path)
    w, h = im.size
    m = max(w, h)
    if m <= MAX_SIDE:
        return False
    scale = MAX_SIDE / m
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    rgba = im.convert("RGBA")
    out = rgba.resize((nw, nh), Image.Resampling.LANCZOS)
    out.save(path, optimize=True, compress_level=9)
    return True


def main() -> None:
    if not ROOT.is_dir():
        print(f"Missing: {ROOT}", file=sys.stderr)
        sys.exit(1)
    changed: list[Path] = []
    for p in sorted(ROOT.rglob("*.png")):
        if not p.is_file():
            continue
        try:
            if process(p):
                changed.append(p)
                print(f"resize {p.relative_to(ROOT)} -> {Image.open(p).size}")
        except Exception as e:
            print(f"FAIL {p}: {e}", file=sys.stderr)
            sys.exit(1)

    if OXIPNG.is_file() and changed:
        subprocess.run(
            [str(OXIPNG), "-o", "4", "--strip", "safe", "--quiet"]
            + [str(p) for p in changed],
            check=False,
        )
    print(f"Done. Resized {len(changed)} file(s).")


if __name__ == "__main__":
    main()
