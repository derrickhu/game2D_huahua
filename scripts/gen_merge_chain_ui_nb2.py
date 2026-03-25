#!/usr/bin/env python3
"""
合成线面板 UI 拆件 — NB2 品红底生图（标题彩带 + 主面板卡）。

输出：~/rosa_games/game_assets/huahua/assets/merge_chain_ui_nb2/for_review/
入库：python3 scripts/matte_merge_chain_ui.py

默认模型：gemini-3.1-flash-image-preview（NB2）
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

ASSETS = "/Users/huyi/rosa_games/game_assets/huahua/assets"
OUT_DIR = f"{ASSETS}/merge_chain_ui_nb2/for_review"

SHARED = """
Game UI texture asset for a cozy flower-shop MERGE mobile game (merge chain / synthesis line popup).
Flat solid #FF00FF magenta background ONLY outside the painted subject (chroma key).
NO checkerboard, NO gray backdrop.

HARD EDGE FOR MATTING: crisp silhouette against chroma; opaque cel / soft-3D merge-game paint.

ART STYLE: bold saturated colors, soft gradients INSIDE shapes, highlight top-left on volumes.
Hairline to medium-soft COLORED outlines — NOT heavy black comic ink.

FORBIDDEN on subject: chroma #FF00FF inside painted UI shapes.
NO readable text — NO Chinese, NO English, NO numbers, NO icons, NO item sprites, NO arrows, NO grids of cells.
""".strip()

BODY_RIBBON = """
ONLY a horizontal TITLE RIBBON / banner — the upper chrome of a merge-chain info panel. Nothing else.

Shape: wide ribbon with gentle upward curve; 3D folded tapered ends that tuck slightly behind the main ribbon body (like gift-wrap ribbon).
Colors: soft peach (#FFA07A) to coral (#FF7F50) gradient along the ribbon, soft specular highlight on top edge, subtle shadow in folds.
Center area is a smooth blank band for title text overlay later.

The ribbon should occupy roughly the middle 38% of the canvas height, centered vertically — large equal margins of flat #FF00FF above and below.
Side margins #FF00FF too — ribbon does NOT touch image edges; leave chroma padding left and right.

NO close button, NO X, NO text, NO icons.
""".strip()

BODY_PANEL = """
ONLY one large MAIN PANEL card body for a merge-chain popup — lower component below a title ribbon. Nothing else.

Shape: tall rounded rectangle with VERY large corner radius (smooth fillet), vertical composition.
Fill: pale cream / warm ivory interior (#FFF9E1 to #FFF8E8), subtle soft inner glow or very light inset shading (slightly concave card feel) — NO item grid, NO slots drawn, NO arrows.

Border: one clean continuous stroke — vibrant gold / honey yellow (#FFD700 to #FFC107) following the outer rounded perimeter, medium thickness, crisp merge-game UI polish.

The card fills most of the frame with modest #FF00FF margin on all sides (chroma). Top edge is open/simple — another layer (ribbon) will overlap in game.

NO ribbon in this asset. NO title text. NO chain items. NO "sources" section art — program draws content inside.
""".strip()

JOBS: list[tuple[str, str, str]] = [
    ("merge_chain_ribbon_nb2_1x1.png", "1:1", BODY_RIBBON),
    ("merge_chain_panel_nb2_3x4.png", "3:4", BODY_PANEL),
]


def run_one(fname: str, ratio: str, body: str, model: str, ref: str | None) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    if not os.path.isfile(GEN):
        print("Missing", GEN, file=sys.stderr)
        sys.exit(1)
    prompt = SHARED + "\n\n" + body
    out = os.path.join(OUT_DIR, fname)
    print(f"\n=== merge_chain_ui -> {out} ===", flush=True)
    cmd = [sys.executable, GEN, prompt, "-o", out, "--model", model, "--aspect-ratio", ratio]
    if ref:
        cmd.extend(["-i", ref])
        print(f"  reference: {ref}", flush=True)
    r = subprocess.run(cmd)
    if r.returncode != 0:
        sys.exit(r.returncode)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--only",
        type=str,
        default=None,
        help="Prefix: merge_chain_ribbon / merge_chain_panel",
    )
    ap.add_argument("--model", type=str, default=MODEL)
    ap.add_argument(
        "--ref",
        type=str,
        default=None,
        help="Optional reference PNG (applies to each job if set)",
    )
    args = ap.parse_args()

    jobs = JOBS
    if args.only:
        jobs = [j for j in JOBS if j[0].startswith(args.only)]
        if not jobs:
            print("Unknown --only", args.only, file=sys.stderr)
            sys.exit(1)

    for idx, (fname, ratio, body) in enumerate(jobs):
        run_one(fname, ratio, body, args.model, args.ref)
        if idx < len(jobs) - 1:
            time.sleep(SLEEP)
    print(f"\nDone merge_chain_ui NB2 -> {OUT_DIR}", flush=True)


if __name__ == "__main__":
    main()
