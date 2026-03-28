#!/usr/bin/env python3
"""
店主 full_/chibi_ 在 rembg 之后的品红渗色清理。

生图背景为 #FF00FF，rembg 在半透明抗锯齿边里常会留下粉/品红 RGB，视觉上像「品红边」。
本脚本在仍可见的半透明像素上检测品红倾向并将 alpha 压到 0（与 board_ui 管线思路一致）。

用法:
  python3 scripts/owner_sprite_post_rembg.py path/to/a.png [more.png ...]
"""
from __future__ import annotations

import sys

import numpy as np
from PIL import Image


def chroma_ff00ff_fringe_clean(path: str) -> None:
    img = Image.open(path).convert("RGBA")
    d = np.array(img, dtype=np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    vis = a > 6
    strict = vis & (r > 185) & (g < 135) & (b > 180)
    pink = vis & (r > 195) & (g < 105) & (b > 70) & (b < 245) & (r > g + 80)
    soft = vis & (r >= 160) & (b >= 158) & (g <= 158) & ((r + b) >= (g * 1.95))
    # 品红底 #FF00FF：G 极低、R/B 双高，rembg 半透明边常见
    spill = vis & (r >= 150) & (b >= 150) & (g <= 100) & ((r + b) > (g * 2.4))
    m = strict | pink | soft | spill
    d[m, 3] = 0
    Image.fromarray(np.clip(d, 0, 255).astype(np.uint8)).save(path, optimize=True)


def main() -> None:
    if len(sys.argv) < 2:
        print("用法: owner_sprite_post_rembg.py <png> [png ...]", file=sys.stderr)
        sys.exit(2)
    for p in sys.argv[1:]:
        chroma_ff00ff_fringe_clean(p)
        print(p, flush=True)


if __name__ == "__main__":
    main()
