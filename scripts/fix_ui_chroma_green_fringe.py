#!/usr/bin/env python3
"""
去除绿幕抠图残留的绿边 / 绿渗色（RGBA PNG）。
策略：剔除半透明带绿倾向的杂边 + 将 G 通道向 max(R,B) 收敛（不伤正常黄条主体）。
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def fix_fringe(arr: np.ndarray) -> np.ndarray:
    a = arr.astype(np.float32)
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    mb = np.maximum(r, b)
    h = a.shape[0]

    # 1) 明显绿幕半透明渣：整体偏绿且 alpha 低 → 直接透明
    keyish = (al < 110) & (g > mb + 12) & (g > 40)
    al = np.where(keyish, 0, al)

    # 2) 半透明边缘：G 明显高于 R/B 的渗色 → 压 G 或降 alpha
    edge = (al > 0) & (al < 240) & (g > mb + 18)
    g = np.where(edge, mb + (g - mb) * 0.28, g)

    # 3) 不透明区域温和 despill：仅当 G 为通道最大值且比次大值高出较多
    hi = np.maximum.reduce([r, g, b])
    second = np.sort(np.stack([r, g, b], axis=-1), axis=-1)[..., 1]
    spill = (al >= 200) & (g == hi) & (g > second + 22) & (g > r) & (g > b)
    tgt = np.maximum(r, b)
    g = np.where(spill, tgt + (g - tgt) * 0.45, g)

    # 4) 图像最下缘常见绿幕残留条：R/B 很低、G 虚高 → 拉回暖黄并略抬 R/B
    band = np.zeros_like(al, dtype=bool)
    band[max(0, h - 28) : h, :] = True
    grim = band & (al > 40) & (g > r + 22) & (g > b + 18)
    r = np.where(grim, np.minimum(255, r + (g - r) * 0.5 + 8), r)
    b = np.where(grim, np.minimum(255, b + (g - b) * 0.35 + 4), b)
    g = np.where(grim, np.minimum(g, np.maximum(r, b) * 1.05 + 28), g)

    out = np.stack([r, g, b, al], axis=-1)
    return np.clip(np.round(out), 0, 255).astype(np.uint8)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", type=Path)
    ap.add_argument("-o", "--output", type=Path, default=None)
    args = ap.parse_args()
    out = args.output or args.path
    im = Image.open(args.path).convert("RGBA")
    fixed = fix_fringe(np.array(im))
    Image.fromarray(fixed, "RGBA").save(out, "PNG", optimize=True)
    print(f"Wrote {out}", flush=True)


if __name__ == "__main__":
    main()
