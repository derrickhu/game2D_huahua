#!/usr/bin/env python3
"""
墙饰倾角测量 / 微调。

墙饰（挂帘等）应对齐房壳后墙墙脚 ≈ ±30°。
推荐用「水平错切」(skew)：只改帘杆倾角，竖向褶皱保持竖直。
整图旋转会把竖线一起拧歪，仅作备选。

用法（仓库根）:
  python3 scripts/adjust_wallart_angle.py measure path/to.png

  # 错切到目标角（推荐）
  python3 scripts/adjust_wallart_angle.py skew path/to.png -o out.png --target 27.5

  # 相对再错切 delta 度
  python3 scripts/adjust_wallart_angle.py skew path/to.png -o out.png --delta 4.5

  # 整图旋转（竖线会歪，不推荐墙帘）
  python3 scripts/adjust_wallart_angle.py rotate path/to.png -o out.png --target 27.5

约定：angle = atan(dy/dx)，左高右低（杆向右下斜）时 angle > 0。
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image


def measure_top_edge_angle_deg(im: Image.Image, edge_frac: tuple[float, float] = (0.15, 0.85)) -> float:
    """Fit curtain-rod angle: top silhouette, keep upper band, RANSAC inliers."""
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


def skew_to_adjust_angle(im: Image.Image, *, delta_deg: float, base_angle: float) -> Image.Image:
    """Horizontal shear: change top-edge angle while keeping verticals vertical.

    Affine: x' = x, y' = y + k·x  with k = tan(target) - tan(base).
    """
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    target = base_angle + delta_deg
    k = math.tan(math.radians(target)) - math.tan(math.radians(base_angle))
    w, h = im.size
    # Corners after shear: (0,0),(w,0),(0,h),(w,h) → y += k*x
    ys = [0.0, k * w, float(h), float(h) + k * w]
    min_y = min(ys)
    max_y = max(ys)
    # Pillow AFFINE: maps output→input. We want out = (x, y + k*x - min_y)
    # so input = (x, y - k*x + min_y) → matrix (1,0,0, -k,1,min_y) in a,b,c,d,e,f
    # where x_in = a*x + b*y + c, y_in = d*x + e*y + f
    nh = max(1, int(math.ceil(max_y - min_y + 1e-6)))
    skewed = im.transform(
        (w, nh),
        Image.Transform.AFFINE,
        (1, 0, 0, -k, 1, min_y),
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )
    return trim_alpha(skewed, padding=4)


def rotate_to_adjust_angle(im: Image.Image, *, delta_deg: float) -> Image.Image:
    """delta_deg: desired change in measured top-edge angle (positive = steeper down-to-right)."""
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    rotated = im.rotate(-delta_deg, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))
    return trim_alpha(rotated, padding=4)


def cmd_measure(args: argparse.Namespace) -> None:
    im = Image.open(args.input).convert("RGBA")
    ang = measure_top_edge_angle_deg(im)
    print(f"{args.input}: top-edge angle = {ang:.2f}°  (size {im.size})")


def _resolve_delta(im: Image.Image, args: argparse.Namespace) -> tuple[float, float]:
    before = measure_top_edge_angle_deg(im)
    if args.target is not None:
        delta = float(args.target) - before
    else:
        delta = float(args.delta)
    return before, delta


def cmd_skew(args: argparse.Namespace) -> None:
    src = Path(args.input)
    im = Image.open(src).convert("RGBA")
    before, delta = _resolve_delta(im, args)
    out_im = skew_to_adjust_angle(im, delta_deg=delta, base_angle=before)
    after = measure_top_edge_angle_deg(out_im)
    out = Path(args.output) if args.output else src.with_name(src.stem + f"_skew{after:.1f}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out_im.save(out, optimize=True)
    print(f"skew  before={before:.2f}°  delta={delta:.2f}°  after={after:.2f}°")
    print(f"saved -> {out}  size={out_im.size}")


def cmd_rotate(args: argparse.Namespace) -> None:
    src = Path(args.input)
    im = Image.open(src).convert("RGBA")
    before, delta = _resolve_delta(im, args)
    out_im = rotate_to_adjust_angle(im, delta_deg=delta)
    after = measure_top_edge_angle_deg(out_im)
    out = Path(args.output) if args.output else src.with_name(src.stem + f"_a{after:.1f}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    out_im.save(out, optimize=True)
    print(f"rotate  before={before:.2f}°  delta={delta:.2f}°  after={after:.2f}°")
    print(f"saved -> {out}  size={out_im.size}")


def _add_target_delta(parser: argparse.ArgumentParser) -> None:
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--target", type=float, help="Target top-edge angle in degrees (e.g. 27.5)")
    g.add_argument("--delta", type=float, help="Add this many degrees to current angle")


def main() -> None:
    ap = argparse.ArgumentParser(description="Measure / fine-tune wallart top-edge angle")
    sub = ap.add_subparsers(dest="cmd", required=True)

    m = sub.add_parser("measure", help="Print top-edge angle in degrees")
    m.add_argument("input")
    m.set_defaults(func=cmd_measure)

    s = sub.add_parser("skew", help="Horizontal shear (keeps verticals; recommended for drapes)")
    s.add_argument("input")
    s.add_argument("-o", "--output", default=None)
    _add_target_delta(s)
    s.set_defaults(func=cmd_skew)

    r = sub.add_parser("rotate", help="Full-image rotate (tilts verticals; not recommended for drapes)")
    r.add_argument("input")
    r.add_argument("-o", "--output", default=None)
    _add_target_delta(r)
    r.set_defaults(func=cmd_rotate)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
