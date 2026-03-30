#!/usr/bin/env python3
"""
将 3 列横排店主形象表拆成游戏用 PNG，并缩放到与默认资源一致尺寸。
生成图使用品红 FF00FF 底时，拆图后自动抠成透明（与 NB2 品红抠图流程一致）。

用法: python3 scripts/split_owner_outfit_sheet.py <outfit_id> <sheet.png> [输出目录]
例: python3 scripts/split_owner_outfit_sheet.py outfit_florist raw/owner_outfit_florist_sheet.png
可选环境变量: CHROMA_OFF=1 跳过品红去底
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import math

from PIL import Image

FULL_W, FULL_H = 197, 384
CHIBI_W, CHIBI_H = 249, 384


def chroma_ff00ff_to_alpha(
    im: Image.Image,
    hard_dist: float = 52.0,
    soft_band: float = 36.0,
) -> Image.Image:
    """品红 #FF00FF 去底：硬阈值内全透明，外侧一条软边过渡，减少锯齿且不误伤粉裙。"""
    im = im.convert("RGBA")
    out: list[tuple[int, int, int, int]] = []
    for r, g, b, a in im.getdata():
        d = math.sqrt((r - 255) ** 2 + (g - 0) ** 2 + (b - 255) ** 2)
        if d <= hard_dist:
            out.append((0, 0, 0, 0))
        elif d <= hard_dist + soft_band:
            na = int(255 * (d - hard_dist) / soft_band)
            out.append((r, g, b, max(0, min(255, na))))
        else:
            out.append((r, g, b, a))
    out_im = Image.new("RGBA", im.size)
    out_im.putdata(out)
    return out_im


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: split_owner_outfit_sheet.py <outfit_id> <sheet.png> [out_dir]", file=sys.stderr)
        sys.exit(1)
    outfit_id = sys.argv[1]
    src = Path(sys.argv[2])
    root = Path(__file__).resolve().parents[1]
    out_dir = Path(sys.argv[3]) if len(sys.argv) > 3 else root / "minigame/subpkg_chars/images/owner"
    out_dir.mkdir(parents=True, exist_ok=True)
    chroma_off = os.environ.get("CHROMA_OFF", "").strip() in ("1", "true", "yes")

    im = Image.open(src).convert("RGBA")
    w, h = im.size
    base = w // 3
    rem = w - base * 3
    x0 = 0
    slices: list[tuple[int, int]] = []
    for i in range(3):
        wi = base + (1 if i < rem else 0)
        slices.append((x0, x0 + wi))
        x0 += wi
    print(f"[split] sheet {w}x{h} -> column widths: {[b - a for a, b in slices]}", flush=True)

    targets = [
        (f"full_{outfit_id}.png", FULL_W, FULL_H),
        (f"full_{outfit_id}_eyesclosed.png", FULL_W, FULL_H),
        (f"chibi_{outfit_id}.png", CHIBI_W, CHIBI_H),
    ]
    for i, (name, tw, th) in enumerate(targets):
        xa, xb = slices[i]
        box = (xa, 0, xb, h)
        crop = im.crop(box)
        crop = crop.resize((tw, th), Image.Resampling.LANCZOS)
        if not chroma_off:
            crop = chroma_ff00ff_to_alpha(crop)
        out_path = out_dir / name
        crop.save(out_path, "PNG")
        print(f"Wrote {out_path} ({tw}x{th}){' no-chroma' if chroma_off else ' chroma->alpha'}")


if __name__ == "__main__":
    main()
