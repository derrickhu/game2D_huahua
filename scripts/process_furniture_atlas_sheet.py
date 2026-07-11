#!/usr/bin/env python3
"""
家具雪碧图合图：按格 trim + 缩放，再拼成等尺寸帧。

避免 compress_furniture_deco_pngs 对整张 sheet 缩到 171 导致每格过小。

工坊家具（workshopExclusive）：每格 `--max-side 342`（手机清晰度标杆见 `workshop_plush_sofa_sheet`）。普通 Lv 家具默认 171。

四向旋转（fourFacing）正/背：推荐分生后再 --compose，并加
  --match-height --bottom-align --width-ratio-max 1.08
见 `.cursor/rules/furniture-deco-art-spec.mdc`「四向旋转」节。

用法（仓库根）:
  # 从已有 2 列合图重建（正/背）
  python3 scripts/process_furniture_atlas_sheet.py \\
    --input .tmp/workshop_puffy_petal_sofa_sheet_nobg.png \\
    --columns 2 --rows 1 \\
    -o minigame/subpkg_deco/images/furniture/workshop_puffy_petal_sofa_sheet.png

  # 四向：分生正面+背面后拼合（推荐）
  python3 scripts/process_furniture_atlas_sheet.py \\
    --compose .../chair_front.png --compose .../chair_back.png \\
    --columns 2 --rows 1 --max-side 171 \\
    --match-height --bottom-align --width-ratio-max 1.08 \\
    -o minigame/subpkg_deco/images/furniture/workshop_summer_dining_chair_sheet.png

  # 从多张单件拼成 1 列 × N 行（多配色）
  python3 scripts/process_furniture_atlas_sheet.py \\
    --compose minigame/.../workshop_plush_green_sofa.png \\
    --compose minigame/.../workshop_plush_sofa_sakura.png \\
    --columns 1 --rows 2 \\
    -o minigame/subpkg_deco/images/furniture/workshop_plush_sofa_sheet.png
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]


def trim_alpha(im: Image.Image, padding: int = 4) -> Image.Image:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    alpha = im.split()[3]
    bbox = alpha.getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(im.width, x1 + padding)
    y1 = min(im.height, y1 + padding)
    return im.crop((x0, y0, x1, y1))


def fit_max_side(im: Image.Image, max_side: int) -> Image.Image:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    w, h = im.size
    scale = min(max_side / w, max_side / h, 1.0)
    if scale >= 1.0:
        return im
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def fit_height(im: Image.Image, target_h: int) -> Image.Image:
    """Scale so content height == target_h (may upscale or downscale)."""
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    w, h = im.size
    if h <= 0:
        return im
    scale = target_h / h
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    if (nw, nh) == (w, h):
        return im
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def split_grid(im: Image.Image, columns: int, rows: int) -> list[Image.Image]:
    fw = im.width // columns
    fh = im.height // rows
    cells: list[Image.Image] = []
    for r in range(rows):
        for c in range(columns):
            cells.append(im.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)))
    return cells


def _cap_width_ratio(frames: list[Image.Image], width_ratio_max: float, target_h: int) -> list[Image.Image]:
    """Keep each frame width within width_ratio_max of the first (front) frame."""
    if width_ratio_max <= 0 or len(frames) < 2:
        return frames
    ref_w = frames[0].width
    if ref_w <= 0:
        return frames
    out: list[Image.Image] = [frames[0]]
    for frame in frames[1:]:
        max_w = max(1, int(round(ref_w * width_ratio_max)))
        min_w = max(1, int(round(ref_w / width_ratio_max)))
        if frame.width > max_w:
            scale = max_w / frame.width
            nw = max_w
            nh = max(1, int(round(frame.height * scale)))
            frame = frame.resize((nw, nh), Image.Resampling.LANCZOS)
            frame = fit_height(frame, target_h)
        elif frame.width < min_w:
            scale = min_w / frame.width
            nw = min_w
            nh = max(1, int(round(frame.height * scale)))
            frame = frame.resize((nw, nh), Image.Resampling.LANCZOS)
            frame = fit_height(frame, target_h)
        out.append(frame)
    return out


def compose_sheet(
    cells: list[Image.Image],
    *,
    columns: int,
    rows: int,
    max_side: int,
    padding: int,
    match_height: bool = False,
    bottom_align: bool = False,
    width_ratio_max: float = 0.0,
) -> Image.Image:
    expected = columns * rows
    if len(cells) != expected:
        raise ValueError(f"need {expected} cells, got {len(cells)}")

    trimmed = [trim_alpha(cell, padding) for cell in cells]

    if match_height:
        # Unify on content height; cap by max_side so tall props still fit.
        raw_h = max(im.height for im in trimmed)
        target_h = min(max_side, raw_h) if raw_h > 0 else max_side
        frames = [fit_height(im, target_h) for im in trimmed]
        if width_ratio_max > 0:
            frames = _cap_width_ratio(frames, width_ratio_max, target_h)
            # Re-sync height after width caps
            frames = [fit_height(im, target_h) for im in frames]
    else:
        frames = [fit_max_side(im, max_side) for im in trimmed]

    frame_w = max(f.width for f in frames)
    frame_h = max(f.height for f in frames)

    sheet = Image.new("RGBA", (columns * frame_w, rows * frame_h), (0, 0, 0, 0))
    for idx, frame in enumerate(frames):
        col = idx % columns
        row = idx // columns
        canvas = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
        x = (frame_w - frame.width) // 2
        y = (frame_h - frame.height) if bottom_align else (frame_h - frame.height) // 2
        canvas.paste(frame, (x, y), frame)
        sheet.paste(canvas, (col * frame_w, row * frame_h))
    return sheet


def main() -> int:
    ap = argparse.ArgumentParser(description="Build furniture atlas with per-cell max-side scaling")
    ap.add_argument("--input", "-i", type=Path, help="Existing sheet PNG to split then rebuild")
    ap.add_argument(
        "--compose",
        action="append",
        type=Path,
        default=[],
        help="Single PNG paths in row-major order (use with --columns/--rows)",
    )
    ap.add_argument("--columns", type=int, default=2)
    ap.add_argument("--rows", type=int, default=1)
    ap.add_argument("--max-side", type=int, default=171, help="Max longest side per cell/frame")
    ap.add_argument("--padding", type=int, default=4)
    ap.add_argument(
        "--match-height",
        action="store_true",
        help="Scale every cell to the same content height (fourFacing front/back)",
    )
    ap.add_argument(
        "--bottom-align",
        action="store_true",
        help="Align feet to shared baseline inside each frame",
    )
    ap.add_argument(
        "--width-ratio-max",
        type=float,
        default=0.0,
        help="With --match-height: cap each cell width vs first cell (e.g. 1.08). 0=off",
    )
    ap.add_argument("-o", "--output", type=Path, required=True)
    args = ap.parse_args()

    if args.input and args.compose:
        ap.error("use either --input or --compose, not both")
    if not args.input and not args.compose:
        ap.error("need --input or at least one --compose")
    if args.width_ratio_max and not args.match_height:
        ap.error("--width-ratio-max requires --match-height")

    if args.input:
        im = Image.open(args.input)
        im.load()
        cells = split_grid(im, args.columns, args.rows)
    else:
        cells = []
        for p in args.compose:
            im = Image.open(p)
            im.load()
            cells.append(im)

    sheet = compose_sheet(
        cells,
        columns=args.columns,
        rows=args.rows,
        max_side=args.max_side,
        padding=args.padding,
        match_height=args.match_height,
        bottom_align=args.bottom_align,
        width_ratio_max=args.width_ratio_max,
    )

    out = args.output if args.output.is_absolute() else REPO / args.output
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, format="PNG", optimize=True, compress_level=9)
    fw = sheet.width // args.columns
    fh = sheet.height // args.rows
    print(
        f"saved {out.relative_to(REPO) if out.is_relative_to(REPO) else out}: "
        f"{sheet.width}x{sheet.height} ({args.columns}x{args.rows}, frame ~{fw}x{fh})"
        + (" match-height" if args.match_height else "")
        + (" bottom-align" if args.bottom_align else "")
        + (f" width-ratio-max={args.width_ratio_max}" if args.width_ratio_max else "")
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
