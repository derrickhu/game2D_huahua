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


def find_row_split_y(arr: np.ndarray, white_thresh: int = 248) -> int:
    """在 38%~62% 高度范围内寻找最白水平缝作为上下两行分界线，防止跨中线削顶。"""
    h_full = arr.shape[0]
    lo, hi = int(h_full * 0.38), int(h_full * 0.62)
    if hi <= lo:
        return h_full // 2
    band = arr[lo:hi]
    white = (
        (band[:, :, 0] > white_thresh)
        & (band[:, :, 1] > white_thresh)
        & (band[:, :, 2] > white_thresh)
    )
    row_white = white.mean(axis=1)
    sm = np.convolve(row_white, np.ones(9) / 9, mode="same")
    return lo + int(np.argmax(sm))


def row_y_bounds(arr: np.ndarray, row_idx: int, white_thresh: int = 248) -> tuple[int, int]:
    split_y = find_row_split_y(arr, white_thresh=white_thresh)
    return (0, split_y) if row_idx == 0 else (split_y, arr.shape[0])


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
    _, w_full = arr.shape[:2]
    y0, y1 = row_y_bounds(arr, row_idx, white_thresh=white_thresh)
    row = arr[y0:y1]
    white = (
        (row[:, :, 0] > white_thresh)
        & (row[:, :, 1] > white_thresh)
        & (row[:, :, 2] > white_thresh)
    )
    col_white = white.mean(axis=0)

    # 优先使用 100% 纯白列缝的中点切格，避免壶嘴/把手等细端被平滑阈值误当白缝切掉
    pure_runs: list[list[int]] = []
    in_pure = False
    for x in range(w_full):
        if col_white[x] >= 0.998:
            if not in_pure:
                pure_runs.append([x, x])
                in_pure = True
            else:
                pure_runs[-1][1] = x
        else:
            in_pure = False
    pure_icons: list[tuple[int, int]] = []
    prev_cut = 0
    for g0, g1 in pure_runs:
        if g0 - prev_cut > min_icon_width:
            mid = (g0 + g1) // 2 if g1 < w_full - 1 else w_full - 1
            pure_icons.append((prev_cut, mid))
            prev_cut = (g0 + g1) // 2 + 1
        elif g0 == 0:
            prev_cut = max(0, g1 - 4)
    if w_full - prev_cut > min_icon_width:
        pure_icons.append((prev_cut, w_full - 1))
    if len(pure_icons) == n_icons:
        return pure_icons

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
    y0, y1 = row_y_bounds(arr, row_idx)
    row = arr[y0:y1]
    sub = row[:, gx1 : gx2 + 1]
    ys, xs = np.where(np.any(sub < 245, axis=2))
    if len(xs) == 0:
        raise SystemExit(f"no foreground in cell row={row_idx} index={icon_index}")

    box = (
        max(gx1, gx1 + int(xs.min()) - hpad),
        max(y0, y0 + int(ys.min()) - vpad),
        min(gx2 + 1, gx1 + int(xs.max()) + hpad + 1),
        min(y1, y0 + int(ys.max()) + vpad + 1),
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
