#!/usr/bin/env python3
"""
红包线图标后处理：白底 NB2 / 工具线规范生图 → rembg（birefnet-general）透明 PNG
→ 按内容裁切 → 等比缩放 → 居中落到 256×256（与宝箱脚本同逻辑，与工具线展示规格一致）。

生图：见 .cursor/rules/tool-icon-art-style.mdc（`--image` 参考 `tool_bake_2.png`，`--prompt-file`，白底后 rembg）。原图建议：
  .../game_assets/huahua/assets/raw/hongbao_{1..4}_nb2.png

用法：python3 scripts/process_hongbao_icons.py
"""
from __future__ import annotations

import os
from io import BytesIO

from PIL import Image

RAW_DIR = "/Users/huyi/rosa_games/game_assets/huahua/assets/raw"
OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "minigame/subpkg_items/images/hongbao",
)
TARGET = 256
INNER_MAX = 244
CROP_PAD = 6


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
    for idx in range(1, 5):
        raw_path = os.path.join(RAW_DIR, f"hongbao_{idx}_nb2.png")
        if not os.path.isfile(raw_path):
            print("skip missing", raw_path)
            continue
        im = rembg_cutout(raw_path)
        out = trim_and_square_canvas(
            im,
            inner_max=INNER_MAX,
            target=TARGET,
            crop_pad=CROP_PAD,
        )
        out_path = os.path.join(OUT_DIR, f"hongbao_{idx}.png")
        out.save(out_path, "PNG", compress_level=3, optimize=False)
        print(f"hongbao_{idx}: wrote {out_path}")


if __name__ == "__main__":
    main()
