#!/usr/bin/env python3
"""
花艺工具线（arrange）：Gemini 1×3 sheet（16:9）→ 切三列 → 品红抠图 → minigame/images/tools/arrange/

前置：docs/prompt/tool_line_arrange_nb2_prompt.txt

用法：
  python3 scripts/build_tool_arrange_pilot.py
  python3 scripts/build_tool_arrange_pilot.py --sheet path/to.png
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
PROMPT_FILE = _REPO / "docs" / "prompt" / "tool_line_arrange_nb2_prompt.txt"
ASSETS = Path("/Users/huyi/rosa_games/game_assets/huahua/assets")
REVIEW_DIR = ASSETS / "tool_lines" / "for_review"
SHEET_OUT = REVIEW_DIR / "tool_arrange_sheet_16x9.png"
DEST_DIR = _REPO / "minigame" / "images" / "tools" / "arrange"

sys.path.insert(0, str(_REPO / "scripts"))
from chroma_magenta_nb2 import chroma_clean_image  # noqa: E402
from image_trim import DEFAULT_TRIM_PADDING, trim_rgba_padding  # noqa: E402

# 比物品线略大，避免裁掉手绘边缘的抗锯齿；仍紧贴 getbbox
_ARRANGE_TRIM_PAD = max(DEFAULT_TRIM_PADDING, 8)


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
    """三等分列；左右各内缩 shave_px，减少邻列物体/文字串进本列。"""
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


# 宽图 API 偶发 400 时用三张 1:1 分别生成（prompt 缩短）
def _generate_three_squares() -> None:
    prompts = [
        "1:1 merge-game icon. Antique copper floral shears, dark wood handles, slightly open. FILL square: subject ~88–93% of BOTH width and height, equal margins; angle diagonally corner-to-corner OR slightly horizontal — NOT a tiny thin diagonal sliver. Heavy 2D, muted. Background ONLY flat #FF00FF. ZERO text.",
        "1:1 merge-game icon. Two SHORTER fatter florist paper rolls (kraft + muted blush), twine bows, grouped tight to fill the square ~88–93% on both axes — NOT one long skinny diagonal. Heavy 2D. Background ONLY flat #FF00FF. ZERO text.",
        "Cute hand-painted 2D merge game icon 1x1. Florist work table: dark wood cabinet, wide gray stone countertop, wooden ribbon dowel with three pastel ribbon rolls behind table, small gray foam block with picks on counter. Isometric wide view, object very large in frame with small even margins. Single flat magenta background only, no gradient. No text.",
    ]
    paths: list[Path] = []
    for idx, prompt in enumerate(prompts, start=1):
        pout = REVIEW_DIR / f"tool_arrange_{idx}_raw.png"
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
    # 合成伪 sheet 供 main 统一走 split（此处直接写最终文件更简单）
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    for idx, pout in enumerate(paths, start=1):
        raw = Image.open(pout)
        cleaned = trim_rgba_padding(chroma_clean_image(raw), padding=_ARRANGE_TRIM_PAD)
        out = DEST_DIR / f"tool_arrange_{idx}.png"
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
        # 三张 1:1 fallback 已在 run_generate 内写完并 exit(0)
    if not sheet.is_file():
        sys.exit(f"Missing sheet: {sheet}")

    cols = split_sheet(sheet)
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    for i, crop in enumerate(cols, start=1):
        cleaned = trim_rgba_padding(chroma_clean_image(crop), padding=_ARRANGE_TRIM_PAD)
        out = DEST_DIR / f"tool_arrange_{i}.png"
        cleaned.save(out, optimize=True)
        print("->", out, crop.size, "->", cleaned.size)


if __name__ == "__main__":
    main()
