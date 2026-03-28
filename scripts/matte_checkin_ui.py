#!/usr/bin/env python3
"""
签到 UI NB2 原图：品红抠图 + 去边；横幅裁 alpha 外沿；里程碑礼包 2×2 切分为 4 张。
读 ~/rosa_games/game_assets/huahua/assets/raw/checkin_*_nb2.png
写入 minigame/images/ui/
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:
    print("需要: pip install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
RAW = Path.home() / "rosa_games/game_assets/huahua/assets/raw"
OUT_DIR = ROOT / "minigame/images/ui"

# (源文件名, 输出名, 是否 alpha 裁边)
PAIRS: list[tuple[str, str, bool]] = [
    ("checkin_title_banner_floral_nb2.png", "checkin_title_banner.png", True),
    ("checkin_milestone_frame_nb2.png", "checkin_milestone_panel.png", True),
    ("checkin_progress_track_nb2.png", "checkin_progress_track.png", True),
    ("checkin_card_future_nb2.png", "checkin_card_future.png", True),
    ("checkin_card_today_nb2.png", "checkin_card_today.png", True),
    ("checkin_card_signed_nb2.png", "checkin_card_signed.png", True),
    ("checkin_card_day7_nb2.png", "checkin_card_day7.png", True),
]


def magenta_score(r: int, g: int, b: int) -> float:
    return (r + b) * 0.5 - g


def process_pixels(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            ms = magenta_score(r, g, b)
            if ms > 130 and r > 160 and b > 160 and g < 120:
                px[x, y] = (r, g, b, 0)
            elif ms > 100 and r > 200 and b > 200 and g < 90:
                px[x, y] = (r, g, b, 0)

    def despill(rr: int, gg: int, bb: int) -> tuple[int, int, int]:
        ms = magenta_score(rr, gg, bb)
        if ms < 35 or gg > 100:
            return rr, gg, bb
        t = min(0.5, (ms - 35) / 120.0)
        rr = int(max(0, min(255, rr - (rr - gg) * t * 0.6)))
        bb = int(max(0, min(255, bb - (bb - gg) * t * 0.6)))
        gg = int(max(0, min(255, gg + (ms - 35) * 0.07 * t)))
        return rr, gg, bb

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            r2, g2, b2 = despill(r, g, b)
            px[x, y] = (r2, g2, b2, a)

    a = im.split()[-1]
    a2 = a.filter(ImageFilter.MinFilter(3))
    a2 = a2.filter(ImageFilter.GaussianBlur(radius=0.45))
    im.putalpha(a2)
    return im


def trim_alpha(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    if bbox:
        return im.crop(bbox)
    return im


def split_milestone_gifts(src: Path, out_dir: Path) -> None:
    if not src.is_file():
        print(f"SKIP gifts missing: {src}", file=sys.stderr)
        return
    im = Image.open(src)
    im = process_pixels(im)
    im = trim_alpha(im)
    w, h = im.size
    hw, hh = w // 2, h // 2
    quads = [
        (0, 0, hw, hh),
        (hw, 0, w, hh),
        (0, hh, hw, h),
        (hw, hh, w, h),
    ]
    for i, box in enumerate(quads, start=1):
        part = im.crop(box)
        part = trim_alpha(part)
        dst = out_dir / f"checkin_milestone_gift_{i}.png"
        part.save(dst, "PNG")
        print(f"OK split gift {i} -> {dst} ({part.size})")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for src_name, dst_name, trim in PAIRS:
        src = RAW / src_name
        if not src.is_file():
            print(f"SKIP missing: {src}", file=sys.stderr)
            continue
        im = Image.open(src)
        im = process_pixels(im)
        if trim:
            im = trim_alpha(im)
        dst = OUT_DIR / dst_name
        im.save(dst, "PNG")
        print(f"OK {src_name} -> {dst} ({im.size})")

    split_milestone_gifts(RAW / "checkin_gift_milestones_nb2.png", OUT_DIR)


if __name__ == "__main__":
    main()
