#!/usr/bin/env python3
"""
从 NB2 白底合图中按「行内白缝」切出单个图标（避免等分网格切掉左右）。

典型：5×2 花束/鲜花 progression 表（如 bouquet_line_rework_highsat_nb2_v2.png）。

用法（仓库根）：
  python3 scripts/split_sheet_row_by_gutter.py \\
    ../game_assets/huahua/assets/raw/bouquet_line_rework_highsat_nb2_v2.png \\
    --row 0 --index 4 \\
    -o ../game_assets/huahua/assets/split/flower_bouquet_5.png \\
    --hpad 32 --vpad 16
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def detect_row_icons(
    arr: np.ndarray,
    *,
    row_idx: int = 0,
    n_icons: int = 5,
    white_thresh: int = 248,
    gutter_smooth: int = 15,
    gutter_white: float = 0.88,
    min_icon_width: int = 80,
) -> list[tuple[int, int]]:
    h_full, w_full = arr.shape[:2]
    row_h = h_full // 2
    y0, y1 = row_idx * row_h, (row_idx + 1) * row_h
    row = arr[y0:y1]
    white = (
        (row[:, :, 0] > white_thresh)
        & (row[:, :, 1] > white_thresh)
        & (row[:, :, 2] > white_thresh)
    )
    col_white = white.mean(axis=0)
    sm = np.convolve(col_white, np.ones(gutter_smooth) / gutter_smooth, mode="same")

    gutters: list[list[int]] = []
    in_g = False
    for x in range(w_full):
        if sm[x] > gutter_white:
            if not in_g:
                gutters.append([x, x])
                in_g = True
            else:
                gutters[-1][1] = x
        else:
            in_g = False

    icons: list[tuple[int, int]] = []
    prev = 0
    for g in gutters:
        if g[0] - prev > min_icon_width:
            icons.append((prev, g[0] - 1))
        prev = g[1] + 1
    if w_full - prev > min_icon_width:
        icons.append((prev, w_full - 1))

    if len(icons) < n_icons:
        raise SystemExit(
            f"expected {n_icons} icons in row {row_idx}, detected {len(icons)}: {icons}"
        )
    return icons[:n_icons]


def crop_icon(
    img: Image.Image,
    arr: np.ndarray,
    *,
    row_idx: int,
    icon_index: int,
    n_icons: int,
    hpad: int,
    vpad: int,
) -> tuple[Image.Image, tuple[int, int, int, int]]:
    icons = detect_row_icons(arr, row_idx=row_idx, n_icons=n_icons)
    gx1, gx2 = icons[icon_index]
    row_h = img.height // 2
    row = arr[row_idx * row_h : (row_idx + 1) * row_h]
    sub = row[:, gx1 : gx2 + 1]
    ys, xs = np.where(np.any(sub < 245, axis=2))
    if len(xs) == 0:
        raise SystemExit(f"no foreground in cell row={row_idx} index={icon_index}")

    box = (
        max(0, gx1 + int(xs.min()) - hpad),
        max(0, int(ys.min()) - vpad),
        min(img.width, gx1 + int(xs.max()) + hpad + 1),
        min(row_h, int(ys.max()) + vpad + 1),
    )
    return img.crop(box), box


def main() -> None:
    ap = argparse.ArgumentParser(description="Split one icon from a white-gutter NB2 sheet row")
    ap.add_argument("input", type=Path, help="Sheet PNG path")
    ap.add_argument("-o", "--output", type=Path, required=True, help="Output crop PNG")
    ap.add_argument("--row", type=int, default=0, choices=(0, 1), help="Row index (0=top)")
    ap.add_argument("--index", type=int, required=True, help="Icon index in row, 0-based left-to-right")
    ap.add_argument("--icons", type=int, default=5, help="Icons per row (default 5)")
    ap.add_argument("--hpad", type=int, default=32, help="Extra pixels left/right of content")
    ap.add_argument("--vpad", type=int, default=16, help="Extra pixels top/bottom of content")
    args = ap.parse_args()

    img = Image.open(args.input).convert("RGB")
    arr = np.array(img)
    crop, box = crop_icon(
        img,
        arr,
        row_idx=args.row,
        icon_index=args.index,
        n_icons=args.icons,
        hpad=args.hpad,
        vpad=args.vpad,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    crop.save(args.output, optimize=True)
    print(f"{args.input.name} row{args.row} idx{args.index} -> {args.output}")
    print(f"  box={box} size={crop.size}")


if __name__ == "__main__":
    main()
