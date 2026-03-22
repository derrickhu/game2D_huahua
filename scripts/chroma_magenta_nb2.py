"""Shared #FF00FF chroma-key + spill cleanup for NB2 game assets (numpy + PIL)."""
from __future__ import annotations

import numpy as np
from PIL import Image


def chroma_clean_image(img: Image.Image) -> Image.Image:
    """Return RGBA image with magenta keyed to transparent."""
    d = np.array(img.convert("RGBA"), dtype=np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]

    magenta_like = ((r + b) / 2.0 - g) > 38.0
    hard_key = (r > 185) & (g < 118) & (b > 185) & ((r + b) > (g * 2.0 + 80))
    legacy = (r > 205) & (g < 102) & (b > 205)
    kill = (a > 0) & (magenta_like | hard_key | legacy)
    d[kill, 3] = 0.0

    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    tint = (r + b) / 2.0 - g
    edge_factor = np.clip(1.0 - np.maximum(tint - 28.0, 0.0) / 95.0, 0.0, 1.0)
    d[:, :, 3] = np.clip(a * edge_factor, 0.0, 255.0)

    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    active = a > 8
    excess = np.minimum(r, b) - g
    excess = np.maximum(excess - 12.0, 0.0)
    sub = 0.65 * excess
    d[:, :, 0] = np.where(active, np.clip(r - sub, 0, 255), r)
    d[:, :, 2] = np.where(active, np.clip(b - sub, 0, 255), b)

    a = d[:, :, 3]
    h, w = a.shape
    ap = np.pad(a, 1, mode="constant", constant_values=0.0)
    local_min = np.full((h, w), 255.0, dtype=np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            sl = ap[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w]
            local_min = np.minimum(local_min, sl)
    fringe = (a > 12) & (local_min < 8) & (((d[:, :, 0] + d[:, :, 2]) / 2.0 - d[:, :, 1]) > 18)
    d[fringe, 3] = 0.0

    return Image.fromarray(np.clip(d, 0, 255).astype(np.uint8))


def chroma_clean_path(path: str) -> Image.Image:
    return chroma_clean_image(Image.open(path))
