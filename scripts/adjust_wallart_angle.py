#!/usr/bin/env python3
"""
墙饰倾角测量 / 微调：按顶边（帘杆）相对水平线的角度旋转 PNG。

墙饰（挂帘等）应对齐房壳后墙墙脚 ≈ ±30°（左高右低为负角，如 -27°）。
生图后若某色偏平，可用本脚本对齐到目标角，比反复 NB2 更稳。

用法（仓库根）:
  # 测量
  python3 scripts/adjust_wallart_angle.py measure path/to.png

  # 旋到目标角（度，相对水平；帘杆左高右低用负值，如 -27.5）
  python3 scripts/adjust_wallart_angle.py rotate path/to.png -o out.png --target -27.5

  # 相对再转 delta 度（正=顺时针，图像 y 向下时正角使左端升高…见下方约定）
  python3 scripts/adjust_wallart_angle.py rotate path/to.png -o out.png --delta 4.5

约定：angle = atan(dy/dx)，左高右低（杆向右下斜）时 angle > 0（与房壳墙脚测量一致）。
旋转：Pillow rotate 正角度为逆时针；为增大「向右下斜」倾角，对图像做负向 rotate。
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image


def measure_top_edge_angle_deg(im: Image.Image, edge_frac: tuple[float, float] = (0.15, 0.85)) -> float:
    """Fit curtain-rod angle: top silhouette, keep upper band, RANSAC inliers.

    Plain polyfit on full top edge is noisy for drapes (valance / rose clusters
    poke above the rod). Prefer the dominant straight segment in the top ~18% band.
    """
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    arr = np.array(im)
    a = arr[:, :, 3] > 40
    pts: list[tuple[float, float]] = []
    for x in range(im.width):
        col = np.where(a[:, x])[0]
        if len(col) == 0:
            continue
        pts.append((float(x), float(col.min())))
    if len(pts) < 8:
        raise ValueError("not enough opaque pixels to measure top edge")
    pts_a = np.array(pts, dtype=np.float64)
    y0, y1 = float(pts_a[:, 1].min()), float(pts_a[:, 1].max())
    band = y0 + 0.18 * max(1.0, y1 - y0)
    band_pts = pts_a[pts_a[:, 1] <= band]
    if len(band_pts) < 10:
        band_pts = pts_a
    best: tuple[int, np.ndarray] | None = None
    rng = np.random.default_rng(0)
    for _ in range(400):
        i, j = rng.choice(len(band_pts), 2, replace=False)
        x1, y1_ = band_pts[i]
        x2, y2_ = band_pts[j]
        if abs(x2 - x1) < 20:
            continue
        m = (y2_ - y1_) / (x2 - x1)
        b = y1_ - m * x1
        dist = np.abs(band_pts[:, 1] - (m * band_pts[:, 0] + b))
        inl = dist < 3.0
        score = int(inl.sum())
        if best is None or score > best[0]:
            best = (score, inl)
    assert best is not None
    inl_pts = band_pts[best[1]]
    if len(inl_pts) < 4:
        lo = int(len(pts_a) * edge_frac[0])
        hi = max(lo + 4, int(len(pts_a) * edge_frac[1]))
        m, _ = np.polyfit(pts_a[lo:hi, 0], pts_a[lo:hi, 1], 1)
    else:
        m, _ = np.polyfit(inl_pts[:, 0], inl_pts[:, 1], 1)
    return float(np.degrees(np.arctan(m)))


def trim_alpha(im: Image.Image, padding: int = 4) -> Image.Image:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    bbox = im.split()[3].getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(im.width, x1 + padding)
    y1 = min(im.height, y1 + padding)
    return im.crop((x0, y0, x1, y1))


def rotate_to_adjust_angle(im: Image.Image, *, delta_deg: float) -> Image.Image:
    """delta_deg: desired change in measured top-edge angle (positive = steeper down-to-right)."""
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    # Measured angle increases when image is rotated clockwise in screen space
    # (y-down). Pillow rotate(positive) = counter-clockwise → use -delta.
    rotated = im.rotate(-delta_deg, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
    return trim_alpha(rotated, padding=4)


def cmd_measure(args: argparse.Namespace) -> None:
    im = Image.open(args.input).convert("RGBA")
    ang = measure_top_edge_angle_deg(im)
    print(f"{args.input}: top-edge angle = {ang:.2f}°  (size {im.size})")


def cmd_rotate(args: argparse.Namespace) -> None:
    src = Path(args.input)
    im = Image.open(src).convert("RGBA")
    before = measure_top_edge_angle_deg(im)
    if args.target is not None:
        delta = float(args.target) - before
    else:
        delta = float(args.delta)
    out_im = rotate_to_adjust_angle(im, delta_deg=delta)
    after = measure_top_edge_angle_deg(out_im)
    out = Path(args.output) if args.output else src.with_name(src.stem + f"_a{after:.1f}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out_im.save(out, optimize=True)
    print(f"before={before:.2f}°  delta={delta:.2f}°  after={after:.2f}°")
    print(f"saved -> {out}  size={out_im.size}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Measure / fine-tune wallart top-edge angle")
    sub = ap.add_subparsers(dest="cmd", required=True)

    m = sub.add_parser("measure", help="Print top-edge angle in degrees")
    m.add_argument("input")
    m.set_defaults(func=cmd_measure)

    r = sub.add_parser("rotate", help="Rotate so top-edge angle changes by delta or hits --target")
    r.add_argument("input")
    r.add_argument("-o", "--output", default=None)
    g = r.add_mutually_exclusive_group(required=True)
    g.add_argument("--target", type=float, help="Target top-edge angle in degrees (e.g. 27.5)")
    g.add_argument("--delta", type=float, help="Add this many degrees to current angle")
    r.set_defaults(func=cmd_rotate)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
