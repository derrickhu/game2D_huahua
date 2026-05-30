#!/usr/bin/env python3
"""仅重处理清涟荷影全身睁眼/闭眼（不动半身）。"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import gen_owner_outfit_panels as gop  # noqa: E402
from huahua_paths import game_assets_dir  # noqa: E402

RAW = Path(game_assets_dir() / "raw")
OWNER = ROOT / "minigame/subpkg_chars/images/owner"
REMBG = Path.home() / ".cursor/skills/remove-background/scripts/rembg_single.py"
DUAL = RAW / "owner_outfit_qinglian_dual_nb2.png"


def rembg_im(path_in: Path) -> Image.Image:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        tmp = Path(tf.name)
    try:
        subprocess.run(
            [sys.executable, str(REMBG), str(path_in), "-o", str(tmp), "-m", "birefnet-general"],
            check=True,
        )
        return Image.open(tmp).convert("RGBA")
    finally:
        tmp.unlink(missing_ok=True)


def write_full(im: Image.Image, dest: Path, scale_ref: Path | None) -> None:
    out = gop.fit_resize_to_canvas(im, gop.FULL_W, gop.FULL_H)
    if scale_ref is not None and scale_ref.is_file():
        out = gop.match_owner_full_canvas_to_reference(out, scale_ref, height_boost=1.0)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "PNG")
    fw, fh = gop.measure_owner_full_bbox_frac(out, gop.FULL_W, gop.FULL_H)
    print(f"-> {dest} (bbox {fw:.3f}x{fh:.3f})")


def main() -> None:
    if not DUAL.is_file():
        raise SystemExit(f"missing {DUAL}")
    im = Image.open(DUAL).convert("RGBA")
    w, h = im.size
    mid = w // 2
    p1 = RAW / "owner_outfit_qinglian_p1.png"
    p2 = RAW / "owner_outfit_qinglian_p2.png"
    im.crop((0, 0, mid, h)).save(p1, "PNG")
    im.crop((mid, 0, w, h)).save(p2, "PNG")
    scale_ref = OWNER / "full_outfit_spring.png"
    write_full(rembg_im(p1), OWNER / "full_outfit_qinglian.png", scale_ref)
    write_full(rembg_im(p2), OWNER / "full_outfit_qinglian_eyesclosed.png", scale_ref)
    print("done (chibi untouched)")


if __name__ == "__main__":
    main()
