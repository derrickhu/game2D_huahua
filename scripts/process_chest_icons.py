#!/usr/bin/env python3
"""
宝箱图标后处理：品红底抠图（NB2 原图）或 rembg（无品红底的兜底图）→ 按内容裁切 → 等比缩放 → 居中落到 256×256 透明画布。
用法：python3 scripts/process_chest_icons.py
"""
from __future__ import annotations

import os
from io import BytesIO

from PIL import Image

from huahua_paths import game_assets_dir

RAW_DIR = str(game_assets_dir() / "raw")
OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "minigame/subpkg_items/images/chest",
)
TARGET = 256
INNER_MAX = 244
CROP_PAD = 6


def chroma_magenta_rgba(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 175 and b > 175 and g < 95:
                px[x, y] = (0, 0, 0, 0)
    return im


def rembg_cutout(path: str) -> Image.Image:
    from rembg import remove

    with open(path, "rb") as f:
        data = remove(f.read())
    return Image.open(BytesIO(data)).convert("RGBA")


def trim_and_square_canvas(
    im: Image.Image,
    *,
    inner_max: int,
    target: int,
    crop_pad: int,
) -> Image.Image:
    alpha = im.split()[3]
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("empty alpha after matting")
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - crop_pad)
    y0 = max(0, y0 - crop_pad)
    x1 = min(im.width, x1 + crop_pad)
    y1 = min(im.height, y1 + crop_pad)
    im = im.crop((x0, y0, x1, y1))

    w, h = im.size
    scale = min(inner_max / w, inner_max / h)
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    if nw != w or nh != h:
        im = im.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    ox = (target - nw) // 2
    oy = (target - nh) // 2
    canvas.paste(im, (ox, oy), im)
    return canvas


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    specs = [
        (1, "magenta"),
        (2, "magenta"),
        (3, "magenta"),
        (4, "magenta"),
        (5, "rembg"),
    ]
    for idx, mode in specs:
        raw_path = os.path.join(RAW_DIR, f"chest_{idx}.png")
        if not os.path.isfile(raw_path):
            print("skip missing", raw_path)
            continue
        if mode == "magenta":
            base = Image.open(raw_path).convert("RGB")
            im = chroma_magenta_rgba(base)
        else:
            im = rembg_cutout(raw_path)

        out = trim_and_square_canvas(
            im,
            inner_max=INNER_MAX,
            target=TARGET,
            crop_pad=CROP_PAD,
        )
        out_path = os.path.join(OUT_DIR, f"chest_{idx}.png")
        out.save(out_path, "PNG", compress_level=3, optimize=False)
        a = out.split()[3]
        bb = a.getbbox()
        print(f"chest_{idx}: wrote {out_path} content_in_canvas={bb}")


if __name__ == "__main__":
    main()
