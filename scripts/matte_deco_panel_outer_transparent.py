#!/usr/bin/env python3
"""
花店装修面板底图：圆角外透明（不靠 rembg，避免掏空奶油内底）。

对 RGB 原图从「画布外缘」上所有近白像素做多源 flood fill，仅在这些像素上扩散，
遇到金边/奶油色即停止，得到圆角外透明、内实心的 PNG。
"""
from __future__ import annotations

import argparse
from collections import deque

import numpy as np
from PIL import Image


def matte_outer_transparent(
    rgb: np.ndarray,
    *,
    white_floor: int = 249,
) -> np.ndarray:
    """rgb uint8 (H,W,3) -> rgba (H,W,4)"""
    h, w = rgb.shape[:2]
    near_white = (
        (rgb[:, :, 0] >= white_floor)
        & (rgb[:, :, 1] >= white_floor)
        & (rgb[:, :, 2] >= white_floor)
    )
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if near_white[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if near_white[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((x, y))

    while q:
        x, y = q.popleft()
        for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx] and near_white[ny, nx]:
                visited[ny, nx] = True
                q.append((nx, ny))

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = rgb
    rgba[:, :, 3] = 255
    rgba[visited, 3] = 0
    return rgba


def _dilate_4(t: np.ndarray) -> np.ndarray:
    """4 邻域膨胀（bool）。"""
    up = np.zeros_like(t, dtype=bool)
    up[1:, :] = t[:-1, :]
    down = np.zeros_like(t, dtype=bool)
    down[:-1, :] = t[1:, :]
    left = np.zeros_like(t, dtype=bool)
    left[:, 1:] = t[:, :-1]
    right = np.zeros_like(t, dtype=bool)
    right[:, :-1] = t[:, 1:]
    return t | up | down | left | right


def peel_light_halo(
    rgba: np.ndarray,
    *,
    iterations: int = 4,
    min_rgb: int = 242,
) -> None:
    """
    去掉紧贴透明区的浅色晕边（如 255,255,243），不向奶油内底渗透。
    min_rgb：三通道最小值 >= 该值才视为可剥除的浅色。
    """
    if iterations <= 0:
        return
    a = rgba[:, :, 3]
    rgb = rgba[:, :, :3]
    light = np.min(rgb, axis=2) >= min_rgb
    for _ in range(iterations):
        transparent = a == 0
        touch = _dilate_4(transparent)
        peel = light & touch & (a > 0)
        a[peel] = 0


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("input", help="RGB/RGBA PNG（如 deco_panel_popup_frame_nb2.png）")
    p.add_argument("-o", "--output", required=True, help="输出 PNG")
    p.add_argument(
        "--white-floor",
        type=int,
        default=249,
        help="R,G,B 均 >= 该值视为可透出的「外底」像素（默认 249）",
    )
    p.add_argument(
        "--peel",
        type=int,
        default=4,
        help="浅色晕边剥离迭代次数（0 关闭；默认 4）",
    )
    p.add_argument(
        "--peel-min-rgb",
        type=int,
        default=242,
        help="剥离时三通道最小值下限（默认 242）",
    )
    p.add_argument(
        "--crop-alpha",
        action="store_true",
        help="按非透明区域 getbbox 裁边，去掉多余透明画布",
    )
    args = p.parse_args()

    im = Image.open(args.input).convert("RGB")
    rgb = np.array(im)
    rgba = matte_outer_transparent(rgb, white_floor=args.white_floor)
    peel_light_halo(
        rgba,
        iterations=args.peel,
        min_rgb=args.peel_min_rgb,
    )
    out = Image.fromarray(rgba)
    if args.crop_alpha:
        bbox = out.getbbox()
        if bbox:
            out = out.crop(bbox)
    out.save(args.output, optimize=True)
    print(f"saved {args.output} size={out.size}", flush=True)


if __name__ == "__main__":
    main()
