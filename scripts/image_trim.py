"""按 alpha 内容 bbox 裁掉透明边（与物品线 game-art-pipeline/crop_trim.py 逻辑一致）。"""
from __future__ import annotations

from PIL import Image

# 与 process_flower_fresh_nb2 / process_drink_tea_dessert_nb2 中 crop_trim --padding 一致
DEFAULT_TRIM_PADDING = 4


def trim_rgba_padding(img: Image.Image, *, padding: int = DEFAULT_TRIM_PADDING) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    bbox = img.getbbox()
    if not bbox:
        return img
    x1 = max(0, bbox[0] - padding)
    y1 = max(0, bbox[1] - padding)
    x2 = min(img.width, bbox[2] + padding)
    y2 = min(img.height, bbox[3] + padding)
    return img.crop((x1, y1, x2, y2))
