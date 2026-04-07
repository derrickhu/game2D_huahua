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
    """
    只清 #FF00FF 渗到 alpha 边的品红，不误伤紫/粉裙装（其 G 常 100～180，旧版 soft/spill 会误判）。
    仅在半透明带处理；强品红条带要求 R、B 高且 G 极低。
    """
    img = Image.open(path).convert("RGBA")
    d = np.array(img, dtype=np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    vis = a > 6
    fringe = vis & (a < 252)
    near_ff00ff = fringe & (r >= 228) & (g <= 50) & (b >= 228)
    magenta_edge = fringe & (r >= 200) & (g <= 55) & (b >= 200) & ((r - g) > 120) & ((b - g) > 120)
    m = near_ff00ff | magenta_edge
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
