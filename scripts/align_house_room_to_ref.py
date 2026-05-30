#!/usr/bin/env python3
"""将 rembg 后的房壳 PNG 对齐到参考 bg_room 的画布与内容 bbox（默认 1024²）。"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def align_room_shell(src_path: Path, ref_path: Path, out_path: Path) -> None:
    ref = Image.open(ref_path).convert("RGBA")
    src = Image.open(src_path).convert("RGBA")

    ref_bbox = ref.getbbox()
    if not ref_bbox:
        raise ValueError(f"reference has no opaque content: {ref_path}")
    rx0, ry0, rx1, ry1 = ref_bbox
    rw, rh = rx1 - rx0, ry1 - ry0

    src_bbox = src.getbbox()
    if not src_bbox:
        raise ValueError(f"source has no opaque content: {src_path}")
    cropped = src.crop(src_bbox)

    # 精确贴合参考内容区，保证与 bg_room_default_soft_nb2 同尺度同位置
    resized = cropped.resize((rw, rh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", ref.size, (0, 0, 0, 0))
    canvas.paste(resized, (rx0, ry0), resized)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, optimize=True)


def main() -> None:
    ap = argparse.ArgumentParser(description="Align house room shell PNG to reference canvas bbox")
    ap.add_argument("src", type=Path, help="rembg output PNG")
    ap.add_argument("ref", type=Path, help="layout reference bg_room PNG")
    ap.add_argument("-o", "--output", type=Path, required=True)
    args = ap.parse_args()
    align_room_shell(args.src, args.ref, args.output)
    out = args.output
    im = Image.open(out)
    bbox = im.getbbox()
    print(f"Wrote {out} canvas={im.size} content_bbox={bbox}")


if __name__ == "__main__":
    main()
