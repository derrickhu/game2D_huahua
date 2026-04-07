#!/usr/bin/env python3
"""
按 alpha 裁掉多余透明边（与 game-art-pipeline crop_trim 思路一致），再按全身规范 letterbox 回 197×384。

用于某套全身图周围留白明显大于其它套时，与其它 `full_*.png` 视觉占比对齐（不改变画风，只收紧画布利用率）。

用法（仓库根）:
  python3 scripts/retighten_owner_full_canvas.py minigame/subpkg_chars/images/owner/full_outfit_florist.png
  python3 scripts/retighten_owner_full_canvas.py --outfit florist
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import gen_owner_outfit_panels as gop  # noqa: E402

OWNER = ROOT / "minigame/subpkg_chars/images/owner"
ALPHA_TH = 16


def retighten_path(path: Path, pad: int) -> None:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    a = arr[:, :, 3]
    ys, xs = np.where(a > ALPHA_TH)
    if len(xs) == 0:
        print(f"[skip] no opaque pixels: {path}", flush=True)
        return
    h, w = a.shape
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(w, x1 + pad)
    y1 = min(h, y1 + pad)
    cropped = im.crop((x0, y0, x1, y1))
    out = gop.fit_resize_to_canvas(cropped, gop.FULL_W, gop.FULL_H)
    out.save(path, optimize=True)
    print(f"OK {path.name} crop {x1-x0}x{y1-y0} -> {gop.FULL_W}x{gop.FULL_H}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser(description="Tighten owner full-body sprite canvas by alpha trim + letterbox")
    ap.add_argument("paths", nargs="*", type=Path, help="PNG paths under minigame/.../owner/")
    ap.add_argument(
        "--outfit",
        metavar="ID",
        help="e.g. florist -> full_outfit_florist.png + eyesclosed",
    )
    ap.add_argument(
        "--pad",
        type=int,
        default=12,
        help="alpha 裁切后四边各留透明像素（默认 12，与 spring 等套纵向占比接近；改小则人物更大、留白更少）",
    )
    args = ap.parse_args()

    targets: list[Path] = []
    for p in args.paths:
        targets.append(p.resolve() if p.is_absolute() else (ROOT / p).resolve())

    if args.outfit:
        oid = args.outfit.strip()
        if oid == "default":
            targets.extend([OWNER / "full_default.png", OWNER / "full_default_eyesclosed.png"])
        else:
            suf = oid if oid.startswith("outfit_") else f"outfit_{oid}"
            targets.extend(
                [
                    OWNER / f"full_{suf}.png",
                    OWNER / f"full_{suf}_eyesclosed.png",
                ]
            )

    if not targets:
        ap.print_help()
        sys.exit(2)

    for p in targets:
        if not p.is_file():
            print(f"[missing] {p}", file=sys.stderr)
            sys.exit(1)
        retighten_path(p, max(0, args.pad))


if __name__ == "__main__":
    main()
