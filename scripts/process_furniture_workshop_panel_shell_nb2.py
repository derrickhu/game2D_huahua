#!/usr/bin/env python3
"""
家具工坊面板壳：NB2 绿幕原图 → 四边洪水去绿（保留完整外圈紫框）→ 轻量绿边 despill → 入库。

UI 整页壳体勿用 rembg 缩 alpha：会把外圈紫框当背景吃掉。
绿幕仅在外围，洪水抠图即可；只做颜色去绿，不侵蚀透明边。

用法（仓库根）:
  python3 scripts/process_furniture_workshop_panel_shell_nb2.py [raw.png]
"""
from __future__ import annotations

import os
import sys
from collections import deque

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DEFAULT = os.path.join(REPO, ".tmp/ui_prototypes/furniture_workshop_panel_shell_v6_nb2.png")
OUT = os.path.join(REPO, "minigame/subpkg_panels/images/ui/furniture_workshop_panel_shell_nb2.png")
MAX_W = 680
PAD = 8


def _dilate_bool_4(m: np.ndarray, iterations: int = 1) -> np.ndarray:
    out = m
    for _ in range(max(0, iterations)):
        h, w = out.shape
        up = np.zeros_like(out, dtype=bool)
        up[1:, :] = out[:-1, :]
        down = np.zeros_like(out, dtype=bool)
        down[:-1, :] = out[1:, :]
        left = np.zeros_like(out, dtype=bool)
        left[:, 1:] = out[:, :-1]
        right = np.zeros_like(out, dtype=bool)
        right[:, :-1] = out[:, 1:]
        out = out | up | down | left | right
    return out


def is_green_screen(rgb: np.ndarray, *, dist_cutoff: float = 72.0) -> np.ndarray:
    """绿幕像素判定：仅用于从画布边缘 flood，勿扩大以免吃进紫框。"""
    r = rgb[:, :, 0]
    g = rgb[:, :, 1]
    b = rgb[:, :, 2]
    t = np.array([0.0, 255.0, 0.0], dtype=np.float32)
    dist = np.linalg.norm(rgb.astype(np.float32) - t, axis=-1)
    void = dist < dist_cutoff
    void |= (g > 205) & (r < 88) & (b < 88)
    return void


def exterior_green_flood_mask(rgb: np.ndarray, *, dilate_void: int = 1) -> np.ndarray:
    """从四边 flood 的绿幕区域（True=应透明）。"""
    h, w = rgb.shape[:2]
    void = is_green_screen(rgb)
    if dilate_void > 0:
        void = _dilate_bool_4(void, dilate_void)
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if void[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if void[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and void[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((nx, ny))
    return visited


def matte_green_screen(img: Image.Image) -> Image.Image:
    rgb = np.array(img.convert("RGB"), dtype=np.uint8)
    exterior = exterior_green_flood_mask(rgb)
    rgba = np.zeros((rgb.shape[0], rgb.shape[1], 4), dtype=np.uint8)
    rgba[:, :, :3] = rgb
    rgba[:, :, 3] = np.where(exterior, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def despill_green_fringe(rgba: np.ndarray, *, strength: float = 0.55) -> None:
    """只改 RGB 去绿，不动 alpha。"""
    d = rgba.astype(np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    active = a > 0
    excess = g - np.maximum(r, b)
    excess = np.maximum(excess - 8.0, 0.0)
    sub = strength * excess
    d[:, :, 1] = np.where(active, np.clip(g - sub, 0, 255), g)
    rgba[:, :, 1] = np.clip(d[:, :, 1], 0, 255).astype(np.uint8)


def crop_alpha_bbox(im: Image.Image, padding: int = PAD) -> Image.Image:
    rgba = np.array(im.convert("RGBA"), dtype=np.uint8)
    a = rgba[:, :, 3]
    ys, xs = np.where(a > 0)
    if len(xs) == 0:
        return im
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    w, h = rgba.shape[1], rgba.shape[0]
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(w, x1 + padding)
    y1 = min(h, y1 + padding)
    return im.crop((x0, y0, x1, y1))


def main() -> int:
    src = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT)
    if not os.path.isfile(src):
        print(f"找不到原图: {src}", file=sys.stderr)
        return 1

    im = matte_green_screen(Image.open(src))
    arr = np.array(im, dtype=np.uint8)
    despill_green_fringe(arr, strength=0.5)
    im = Image.fromarray(arr, "RGBA")
    im = crop_alpha_bbox(im, padding=PAD)

    if im.width > MAX_W:
        ratio = MAX_W / im.width
        im = im.resize((MAX_W, max(1, round(im.height * ratio))), Image.Resampling.LANCZOS)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT, "PNG", optimize=True)
    print(f"OK -> {OUT} {im.size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
