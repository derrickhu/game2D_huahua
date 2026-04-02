#!/usr/bin/env python3
"""
棋盘 / 客人相关 UI 素材 — NB2 品红底生图（与产品线 drink/flower 一致）。

输出到 game_assets（不进版本库游戏目录），审图后请运行：
  python3 scripts/process_board_ui_nb2.py

默认生图模型：gemini-3.1-flash-image-preview（质量更好）。
若宽幅 400/断连，可对 `board_ui_complete` 单独加：`--model gemini-2.5-flash-image`。
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time

GEN = os.path.expanduser("~/.cursor/skills/gemini-image-gen/scripts/generate_images.py")
MODEL = "gemini-3.1-flash-image-preview"
SLEEP = 6

from huahua_paths import game_assets_dir

ASSETS = game_assets_dir()
OUT_DIR = ASSETS / "board_ui_nb2/for_review/1x1"

SHARED = """
Game UI texture asset for a cozy flower-shop MERGE mobile game.
Flat solid #FF00FF magenta background ONLY (chroma key) — entire unused area must be exactly #FF00FF.
NO checkerboard, NO gray backdrop, NO gradient background outside the UI subject.

HARD EDGE FOR MATTING (highest priority):
- The pixel row outside the painted UI subject must be SOLID #FF00FF only.
- FORBIDDEN: semi-transparent pink fringe, soft glow bleeding into background, white halo around UI.
- Opaque cel / soft-3D game UI paint; crisp silhouette against chroma.

ART STYLE (match in-game item icons: juice box, order panel):
- BOLD vivid saturated colors — warm lemon yellow, lime green, soft bevel.
- Smooth gradients INSIDE UI shapes + bright highlight on top-left of each volume.
- HAIRLINE to medium-soft colored outline — NOT heavy black comic ink.
- Cute, polished casual merge-game UI — chunky rounded shapes.

FORBIDDEN on subject: screen-magenta #FF00FF, hot fuchsia that matches background.
NO text, NO Chinese, NO letters, NO numbers unless explicitly asked (complete button must be BLANK).
""".strip()


def run(which: str | None, model: str) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    if not os.path.isfile(GEN):
        print("Missing", GEN, file=sys.stderr)
        sys.exit(1)

    jobs: list[tuple[str, str, str]] = [
        (
            "board_ui_selection_nb2_1x1.png",
            "1:1",
            """
ONE square 1:1 overlay: FOUR separate bright lemon-golden YELLOW L-shaped corner brackets — one snug in each corner of the canvas only.
Center of the square stays completely empty flat #FF00FF magenta (chroma) — do NOT fill center with any color.
Chunky rounded L-brackets, soft 3D bevel, subtle warm glow on yellow, like "selected tile" in a merge game.
NO connecting frame lines between corners, NO icon in middle, NO text.
""".strip(),
        ),
        (
            "board_ui_order_badge_nb2_1x1.png",
            "1:1",
            """
ONLY a single CHECKMARK (tick) shape — NOTHING else.

CRITICAL: **NO** rounded square behind it, **NO** squircle panel, **NO** circle badge, **NO** green background block — **ONLY** the check stroke itself.

The checkmark is chunky, rounded ends, fresh lime / grass green with soft 3D bevel, darker green edge, light highlight on top-left of the stroke (merge-game UI style).
Rest of the 1:1 canvas = flat solid #FF00FF magenta only.

Subject ~25–40% of canvas height so there is generous chroma margin. NO text.
""".strip(),
        ),
        (
            "board_ui_complete_btn_nb2_16x9.png",
            "16:9",
            """
ONE horizontal pill / capsule BUTTON graphic only — wide rounded-rectangle ends.
Bright lime to apple green vertical gradient, puffy 3D, thin darker green edge, soft bottom shadow feel.
Absolutely BLANK — NO text, NO symbols, NO checkmark on the button body.
Subject centered with comfortable #FF00FF margin on all sides; aspect feel ~2.5:1 width:height for the green pill.
""".strip(),
        ),
    ]

    if which:
        jobs = [j for j in jobs if j[0].startswith(which)]
        if not jobs:
            print("Unknown --only", which, file=sys.stderr)
            sys.exit(1)

    for idx, (fname, ratio, body) in enumerate(jobs):
        prompt = SHARED + "\n\n" + body
        out = os.path.join(OUT_DIR, fname)
        print(f"\n=== board_ui -> {out} ===", flush=True)
        r = subprocess.run(
            [
                sys.executable,
                GEN,
                prompt,
                "-o",
                out,
                "--model",
                model,
                "--aspect-ratio",
                ratio,
            ]
        )
        if r.returncode != 0:
            sys.exit(r.returncode)
        if idx < len(jobs) - 1:
            time.sleep(SLEEP)
    print(f"\nDone board_ui NB2 raw -> {OUT_DIR}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--only",
        type=str,
        default=None,
        help="Prefix filter e.g. board_ui_selection / board_ui_order / board_ui_complete",
    )
    ap.add_argument(
        "--model",
        type=str,
        default=MODEL,
        help=f"Gemini image model (default: {MODEL})",
    )
    args = ap.parse_args()
    run(args.only, args.model)


if __name__ == "__main__":
    main()
