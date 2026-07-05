#!/usr/bin/env python3
"""2×2 工坊染料合图 → rembg → 裁边 → 127×128 UI 图标入库。"""
from __future__ import annotations

import os
import subprocess
import sys

try:
    from PIL import Image
except ImportError:
    print("需要 Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REMBG = os.path.expanduser("~/.cursor/skills/remove-background/scripts/rembg_single.py")
CROP = os.path.expanduser("~/.cursor/skills/game-art-pipeline/scripts/crop_trim.py")
INGEST = os.path.join(ROOT, "scripts", "ingest_ui_icon_nb2.py")
TW, TH = 127, 128
PAD = 0.88

CELLS: list[tuple[str, int, int]] = [
    ("icon_workshop_dye_pink.png", 0, 0),
    ("icon_workshop_dye_yellow.png", 1, 0),
    ("icon_workshop_dye_blue.png", 0, 1),
    ("icon_workshop_dye_green.png", 1, 1),
]


def _run(cmd: list[str]) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def _letterbox(im: Image.Image) -> Image.Image:
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    sw, sh = im.size
    scale = min(TW / sw, TH / sh) * PAD
    nw = max(1, int(sw * scale))
    nh = max(1, int(sh * scale))
    res = im.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (TW, TH), (0, 0, 0, 0))
    out.paste(res, ((TW - nw) // 2, (TH - nh) // 2), res)
    return out


def main() -> None:
    if len(sys.argv) < 2:
        print("用法: process_workshop_dye_icon_sheet_nb2.py <合图.png> [输出目录]", file=sys.stderr)
        sys.exit(2)

    src = os.path.abspath(sys.argv[1])
    out_dir = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.join(ROOT, "minigame", "images", "ui")
    tmp = os.path.join(ROOT, ".tmp", "workshop_dye_sheet")
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)

    sheet = Image.open(src).convert("RGBA")
    w, h = sheet.size
    cw, ch = w // 2, h // 2

    for fname, col, row in CELLS:
        x0, y0 = col * cw, row * ch
        cell = sheet.crop((x0, y0, x0 + cw, y0 + ch))
        split_path = os.path.join(tmp, f"split_{fname}")
        nobg_path = os.path.join(tmp, f"nobg_{fname}")
        trim_path = os.path.join(tmp, f"trim_{fname}")
        cell.save(split_path, "PNG")

        _run(["python3", REMBG, split_path, "-o", nobg_path, "-m", "birefnet-general"])
        _run(["python3", CROP, nobg_path, "-o", trim_path, "--padding", "4"])

        final = _letterbox(Image.open(trim_path).convert("RGBA"))
        out_path = os.path.join(out_dir, fname)
        final.save(out_path, "PNG", optimize=True)
        print(f"Wrote {out_path} ({TW}×{TH})", flush=True)


if __name__ == "__main__":
    main()
