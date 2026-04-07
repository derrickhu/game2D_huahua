#!/usr/bin/env python3
"""
将已有 197×384 全身图按 `full_outfit_vintage_eyesclosed.png` 的 **alpha 纵向占比** 放大并重排（与 `match_owner_full_canvas_to_reference` 一致）。

用于 NB2/rembg 后人物在画布中仍显小的套系，无需重跑生图。

用法（仓库根）:
  python3 scripts/apply_owner_full_match_vintage_scale.py \\
    minigame/subpkg_chars/images/owner/full_outfit_queen.png \\
    minigame/subpkg_chars/images/owner/full_outfit_queen_eyesclosed.png

可选环境变量 OWNER_FULL_SCALE_REF 指向其它参考 PNG（须同为 197×384）。
OWNER_FULL_SCALE_HEIGHT_BOOST 或 --boost 可在参考纵向占比上再放大（默认 1.0）。
加 --no-post 可跳过 owner_sprite_post_rembg.py。
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import gen_owner_outfit_panels as gop  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description="Match owner full-body scale to vintage reference")
    ap.add_argument("pngs", nargs="+", type=Path, help="full_*.png paths")
    ap.add_argument("--no-post", action="store_true", help="Skip owner_sprite_post_rembg.py")
    ap.add_argument(
        "--boost",
        type=float,
        default=None,
        metavar="F",
        help="纵向体量系数（默认读 env OWNER_FULL_SCALE_HEIGHT_BOOST，否则 1.0）",
    )
    args = ap.parse_args()

    ref = Path(os.environ.get("OWNER_FULL_SCALE_REF", str(gop.DEFAULT_OWNER_FULL_SCALE_REF)))
    if not ref.is_file():
        print(f"Missing reference: {ref}", file=sys.stderr)
        sys.exit(1)

    post = ROOT / "scripts/owner_sprite_post_rembg.py"
    env_boost = os.environ.get("OWNER_FULL_SCALE_HEIGHT_BOOST")
    height_boost = (
        float(args.boost)
        if args.boost is not None
        else (float(env_boost) if env_boost is not None and env_boost.strip() != "" else 1.0)
    )
    height_boost = max(1.0, height_boost)
    for p in args.pngs:
        path = (ROOT / p).resolve() if not p.is_absolute() else p
        if not path.is_file():
            print(f"Missing: {path}", file=sys.stderr)
            sys.exit(1)
        im = Image.open(path).convert("RGBA")
        out = gop.match_owner_full_canvas_to_reference(im, ref, height_boost=height_boost)
        out.save(path, optimize=True)
        print(
            f"OK {path.relative_to(ROOT)} (height_boost={height_boost})",
            flush=True,
        )
        if not args.no_post:
            subprocess.run([sys.executable, str(post), str(path)], check=True)


if __name__ == "__main__":
    main()
