#!/usr/bin/env python3
"""
茶饮工具线（tea_set）：Gemini 1×3 sheet（16:9）→ 切三列（列内缩，防串列）→ 品红抠图 → trim → minigame/images/tools/tea_set/

前置：docs/prompt/tool_line_tea_set_nb2_prompt.txt

用法：
  python3 scripts/build_tool_tea_set_pilot.py
  python3 scripts/build_tool_tea_set_pilot.py --sheet path/to.png
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

from huahua_paths import game_assets_dir

_REPO = Path(__file__).resolve().parent.parent
GEN = os.path.expanduser("~/.cursor/skills/gemini-image-gen/scripts/generate_images.py")
# 3.1 预览版易 503/400 时可改用 gemini-2.5-flash-image（与 generate_images 默认一致）
MODEL = "gemini-2.5-flash-image"
PROMPT_FILE = _REPO / "docs" / "prompt" / "tool_line_tea_set_nb2_prompt.txt"
ASSETS = game_assets_dir()
REVIEW_DIR = ASSETS / "tool_lines" / "for_review"
SHEET_OUT = REVIEW_DIR / "tool_tea_set_sheet_16x9.png"
DEST_DIR = _REPO / "minigame" / "images" / "tools" / "tea_set"
PREFIX = "tool_tea_set"

sys.path.insert(0, str(_REPO / "scripts"))
from chroma_magenta_nb2 import chroma_clean_image  # noqa: E402
from image_trim import DEFAULT_TRIM_PADDING, trim_rgba_padding  # noqa: E402

_TRIM_PAD = max(DEFAULT_TRIM_PADDING, 8)


def _to_square_icon(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    side = max(w, h)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - w) // 2
    oy = (side - h) // 2
    sq.paste(im, (ox, oy), im)
    return sq


def split_sheet(sheet_path: Path) -> list[Image.Image]:
    """列内缩（与花艺线一致）。注意：勿对单行 16:9 整图做「半高裁剪」，否则会切掉道具下半。"""
    im = Image.open(sheet_path).convert("RGBA")
    w, h = im.size
    cw = w // 3
    shave_px = max(4, cw // 64)
    cols: list[Image.Image] = []
    for i in range(3):
        left = i * cw
        right = (i + 1) * cw if i < 2 else w
        if i > 0:
            left += shave_px
        if i < 2:
            right -= shave_px
        if right <= left + 8:
            left, right = i * cw, (i + 1) * cw if i < 2 else w
        crop = im.crop((left, 0, right, h))
        cols.append(_to_square_icon(crop))
    return cols


def run_generate() -> None:
    if not PROMPT_FILE.is_file():
        sys.exit(f"Missing prompt: {PROMPT_FILE}")
    if not os.path.isfile(GEN):
        sys.exit(f"Missing {GEN}")
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(
        [
            sys.executable,
            GEN,
            "--prompt-file",
            str(PROMPT_FILE),
            "-o",
            str(SHEET_OUT),
            "--model",
            MODEL,
            "--aspect-ratio",
            "16:9",
        ]
    )
    if r.returncode == 0:
        print("sheet ->", SHEET_OUT)
        return
    print("16:9 sheet failed, fallback: three 1:1 icons...", flush=True)
    _generate_three_squares()


def _generate_three_squares() -> None:
    prompts = [
        "1:1 merge-game icon. Small dark celadon ceramic teacup on walnut saucer, ink blue-green glaze, muted. Subject fills 88-92 percent of BOTH width and height, even margins, chunky silhouette. Heavy hand-painted 2D. Background ONLY flat #FF00FF. ZERO text or numbers.",
        "1:1 merge-game icon. Matching dark stoneware teapot, rounded body, wood knob, same blue-green ceramic family as gongfu tea. Large in square, 88-92 percent both axes. Heavy 2D. Background ONLY flat #FF00FF. ZERO text.",
        "Cute hand-painted 2D merge game icon 1x1. Compact gongfu tea tray: dark walnut board, bamboo mat strip, small cup and teapot silhouettes. Wide isometric view, object very large in frame, small even margins. Single flat magenta background, no gradient. No text or labels.",
    ]
    paths: list[Path] = []
    for idx, prompt in enumerate(prompts, start=1):
        pout = REVIEW_DIR / f"{PREFIX}_{idx}_raw.png"
        r = subprocess.run(
            [
                sys.executable,
                GEN,
                prompt,
                "-o",
                str(pout),
                "--model",
                MODEL,
                "--aspect-ratio",
                "1:1",
            ]
        )
        if r.returncode != 0:
            sys.exit(r.returncode)
        paths.append(pout)
        print("raw ->", pout, flush=True)
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    for idx, pout in enumerate(paths, start=1):
        raw = Image.open(pout)
        cleaned = trim_rgba_padding(chroma_clean_image(raw), padding=_TRIM_PAD)
        out = DEST_DIR / f"{PREFIX}_{idx}.png"
        cleaned.save(out, optimize=True)
        print("->", out, raw.size, "->", cleaned.size, flush=True)
    sys.exit(0)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", help="已有 sheet PNG，只切分+抠图")
    args = ap.parse_args()

    sheet = Path(args.sheet) if args.sheet else SHEET_OUT
    if not args.sheet:
        run_generate()
    if not sheet.is_file():
        sys.exit(f"Missing sheet: {sheet}")

    cols = split_sheet(sheet)
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    for i, crop in enumerate(cols, start=1):
        cleaned = trim_rgba_padding(chroma_clean_image(crop), padding=_TRIM_PAD)
        out = DEST_DIR / f"{PREFIX}_{i}.png"
        cleaned.save(out, optimize=True)
        print("->", out, crop.size, "->", cleaned.size)


if __name__ == "__main__":
    main()
