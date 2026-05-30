#!/usr/bin/env python3
"""
珍珠花珠帘：对同一白底原图用 rembg 全部模型各抠一版（仅 crop，不做 halo 后处理），便于肉眼选模。

输出：../game_assets/huahua/assets/preview_pearl_bead_curtain_rembg/
  - promo_pearl_bead_curtain_<model>_cut.png   (512 抠图)
  - promo_pearl_bead_curtain_<model>_trim.png  (裁透明边)
  - compare_sheet.png                          (四格对比，灰底棋盘格)
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
GA = Path(__import__("os").environ.get("GAME_ASSETS_HUAHUA", str(ROOT.parent / "game_assets" / "huahua")))
RAW = GA / "assets/raw/furniture_promo_pearl_bead_curtain_nb2.png"
PREVIEW = GA / "assets/preview_pearl_bead_curtain_rembg"
REMBG = Path.home() / ".cursor/skills/remove-background/scripts/rembg_single.py"
CROP = Path.home() / ".cursor/skills/game-art-pipeline/scripts/crop_trim.py"

MODELS = [
    "birefnet-general",
    "birefnet-general-lite",
    "isnet-anime",
    "u2net",
]


def checkerboard(size: tuple[int, int], cell: int = 16) -> Image.Image:
    w, h = size
    bg = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(bg)
    c1, c2 = (200, 200, 200), (140, 140, 140)
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            draw.rectangle([x, y, x + cell - 1, y + cell - 1], fill=c1 if ((x // cell) + (y // cell)) % 2 == 0 else c2)
    return bg


def paste_rgba_on_checker(im: Image.Image, canvas: Image.Image, xy: tuple[int, int]) -> None:
    im = im.convert("RGBA")
    layer = checkerboard(im.size)
    layer.paste(im, (0, 0), im)
    canvas.paste(layer, xy)


def build_sheet(trim_paths: list[tuple[str, Path]]) -> Path:
    pad = 24
    label_h = 28
    imgs = [(name, Image.open(p).convert("RGBA")) for name, p in trim_paths]
    max_w = max(im.size[0] for _, im in imgs)
    max_h = max(im.size[1] for _, im in imgs)
    cols, rows = 2, 2
    cw = max_w + pad * 2
    ch = max_h + pad * 2 + label_h
    sheet = Image.new("RGB", (cw * cols, ch * rows), (90, 90, 90))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 18)
    except OSError:
        font = ImageFont.load_default()
    for i, (name, im) in enumerate(imgs):
        col, row = i % cols, i // cols
        ox = col * cw + pad + (max_w - im.size[0]) // 2
        oy = row * ch + pad + label_h + (max_h - im.size[1]) // 2
        paste_rgba_on_checker(im, sheet, (ox, oy))
        draw.text((col * cw + pad, row * ch + 6), name, fill=(255, 255, 255), font=font)
    out = PREVIEW / "compare_sheet.png"
    sheet.save(out, optimize=True)
    return out


def main() -> int:
    if not RAW.is_file():
        print(f"missing raw: {RAW}", file=sys.stderr)
        return 1
    PREVIEW.mkdir(parents=True, exist_ok=True)
    trim_paths: list[tuple[str, Path]] = []

    for model in MODELS:
        cut = PREVIEW / f"promo_pearl_bead_curtain_{model}_cut.png"
        trim = PREVIEW / f"promo_pearl_bead_curtain_{model}_trim.png"
        print(f"== {model} ==")
        subprocess.run(
            [sys.executable, str(REMBG), str(RAW), "-o", str(cut), "-m", model],
            check=True,
        )
        subprocess.run(
            [sys.executable, str(CROP), str(cut), "-o", str(trim), "--padding", "4"],
            check=True,
        )
        im = Image.open(trim)
        print(f"   -> {trim.name} {im.size} {trim.stat().st_size // 1024}K")
        trim_paths.append((model, trim))

    sheet = build_sheet(trim_paths)
    print(f"\n对比图: {sheet}")
    print("请打开 preview 目录选模型名，再告知入库。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
