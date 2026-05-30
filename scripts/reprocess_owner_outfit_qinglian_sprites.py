#!/usr/bin/env python3
"""从 raw 重处理清涟荷影店主三张图：白底 rembg → letterbox（不 vintage 裁切、不品红 post）。"""
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
MODEL = "birefnet-general"
USE_POST_REMBG = False


def rembg_to(path_in: Path, path_out: Path) -> Image.Image:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        tmp = Path(tf.name)
    try:
        subprocess.run(
            [sys.executable, str(REMBG), str(path_in), "-o", str(tmp), "-m", MODEL],
            check=True,
        )
        im = Image.open(tmp).convert("RGBA")
        im.save(path_out, "PNG")
        return im
    finally:
        tmp.unlink(missing_ok=True)


def write_full(im: Image.Image, dest: Path) -> None:
    out = gop.fit_resize_to_canvas(im, gop.FULL_W, gop.FULL_H)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "PNG")
    print(f"full -> {dest} ({gop.FULL_W}x{gop.FULL_H})")


def write_chibi(im: Image.Image, dest: Path) -> None:
    out = gop.alpha_trim_then_fit_canvas(im, gop.CHIBI_W, gop.CHIBI_H, pad=20)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "PNG")
    print(f"chibi -> {dest} ({gop.CHIBI_W}x{gop.CHIBI_H})")


def main() -> None:
    dual = RAW / "owner_outfit_qinglian_dual_nb2.png"
    p1 = RAW / "owner_outfit_qinglian_p1.png"
    p2 = RAW / "owner_outfit_qinglian_p2.png"
    p3 = RAW / "owner_outfit_qinglian_p3.png"
    if dual.is_file():
        im = Image.open(dual).convert("RGBA")
        w, h = im.size
        mid = w // 2
        im.crop((0, 0, mid, h)).save(p1, "PNG")
        im.crop((mid, 0, w, h)).save(p2, "PNG")
        print(f"split {dual.name} -> {p1.name}, {p2.name}")
    for p in (p1, p2, p3):
        if not p.is_file():
            raise SystemExit(f"missing raw: {p}")

    print("== full open ==")
    write_full(rembg_to(p1, RAW / "_tmp_qinglian_p1_cut.png"), OWNER / "full_outfit_qinglian.png")
    print("== full closed ==")
    write_full(rembg_to(p2, RAW / "_tmp_qinglian_p2_cut.png"), OWNER / "full_outfit_qinglian_eyesclosed.png")
    print("== chibi ==")
    write_chibi(rembg_to(p3, RAW / "_tmp_qinglian_p3_cut.png"), OWNER / "chibi_outfit_qinglian.png")
    print("done")


if __name__ == "__main__":
    main()
