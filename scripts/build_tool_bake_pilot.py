#!/usr/bin/env python3
"""
烘焙工具线（bake）：Gemini 1×3 sheet（16:9）→ 切三列 → 品红抠图 → minigame/images/tools/bake/

前置：docs/prompt/tool_line_bake_nb2_prompt.txt

用法：
  python3 scripts/build_tool_bake_pilot.py
  python3 scripts/build_tool_bake_pilot.py --sheet path/to.png
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

_REPO = Path(__file__).resolve().parent.parent
GEN = os.path.expanduser("~/.cursor/skills/gemini-image-gen/scripts/generate_images.py")
MODEL = "gemini-3.1-flash-image-preview"
PROMPT_FILE = _REPO / "docs" / "prompt" / "tool_line_bake_nb2_prompt.txt"
ASSETS = Path("/Users/huyi/rosa_games/game_assets/huahua/assets")
REVIEW_DIR = ASSETS / "tool_lines" / "for_review"
SHEET_OUT = REVIEW_DIR / "tool_bake_sheet_16x9.png"
DEST_DIR = _REPO / "minigame" / "images" / "tools" / "bake"

sys.path.insert(0, str(_REPO / "scripts"))
from chroma_magenta_nb2 import chroma_clean_image  # noqa: E402
from image_trim import trim_rgba_padding  # noqa: E402


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
    im = Image.open(sheet_path).convert("RGBA")
    w, h = im.size
    cw = w // 3
    cols: list[Image.Image] = []
    for i in range(3):
        left = i * cw
        right = (i + 1) * cw if i < 2 else w
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
        "Cute merge-game item icon 1:1. Wooden rolling pin, light caramel wood, short handles, slight wear. Heavy hand-painted 2D shading, muted colors. Background ONLY solid #FF00FF magenta. No text. Icon fills 78% of frame, centered.",
        "Cute merge-game item icon 1:1. Small cream enamel oven, bronze handle, soft warm glow in window. Heavy 2D, cozy bakery. Background ONLY solid #FF00FF. No text. Centered, 78% frame.",
        "Cute merge-game item icon 1:1. Cake finishing station: compact counter, rotating turntable, 2 muted piping bags. Heavy 2D shading. Background ONLY solid #FF00FF. No text. Largest props, 78% frame.",
    ]
    paths: list[Path] = []
    for idx, prompt in enumerate(prompts, start=1):
        pout = REVIEW_DIR / f"tool_bake_{idx}_raw.png"
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
        cleaned = trim_rgba_padding(chroma_clean_image(raw))
        out = DEST_DIR / f"tool_bake_{idx}.png"
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
        cleaned = trim_rgba_padding(chroma_clean_image(crop))
        out = DEST_DIR / f"tool_bake_{i}.png"
        cleaned.save(out, optimize=True)
        print("->", out, crop.size, "->", cleaned.size)


if __name__ == "__main__":
    main()
