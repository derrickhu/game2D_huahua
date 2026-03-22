"""仅去掉接近 #FF00FF 的背景像素，不做 spill/fringe 削弱（避免吃掉雾面粉纸边缘）。"""
from __future__ import annotations

import numpy as np
from PIL import Image


def chroma_strict_magenta_bg(img: Image.Image) -> Image.Image:
    d = np.array(img.convert("RGBA"), dtype=np.uint8).copy()
    r, g, b = d[:, :, 0].astype(np.int16), d[:, :, 1].astype(np.int16), d[:, :, 2].astype(np.int16)
    # 比 chroma_magenta_nb2 更窄：只杀明显品红底
    strict = (r > 195) & (g < 105) & (b > 195) & ((r + b) > (g * 2 + 90))
    d[strict, 3] = 0
    return Image.fromarray(d)
