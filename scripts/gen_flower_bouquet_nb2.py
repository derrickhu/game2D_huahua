#!/usr/bin/env python3
"""
Generate flower_bouquet Lv1–10 as separate 1:1 NB2 images (magenta key).
Same discipline as gen_flower_fresh_nb2.py / gen_drink_tea_dessert_nb2.py:
hard chroma edge, vivid saturation, hairline colored outlines, no white halo.

Outputs under game_assets only — run process_flower_bouquet_nb2.py for cutout;
default process does NOT copy into minigame (use --copy-to-game when approved).
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time

GEN = os.path.expanduser("~/.cursor/skills/gemini-image-gen/scripts/generate_images.py")
MODEL = "gemini-2.5-flash-image"
SLEEP = 6

ASSETS = "/Users/huyi/rosa_games/game_assets/huahua/assets"
OUT_DIR = f"{ASSETS}/flower_bouquet_nb2/for_review/1x1"
PREFIX = "flower_bouquet"

SHARED = """
Game merge item icon, ONE single isolated flower BOUQUET / arrangement prop only, centered, flat solid #FF00FF magenta background ONLY.
Perfect SQUARE 1:1 canvas. NO text, NO Chinese, NO labels, NO UI, NO frames, NO tiles, NO grid.
Category: {category_title}. This is level {n} of 10 in a merge chain — must read CLEARLY lower or higher tier than other levels (strong progression).

HARD EDGE FOR MATTING (highest priority — same as fresh flower / drink lines):
- Outside the colored outline, the VERY NEXT pixels must be SOLID #FF00FF only.
- FORBIDDEN: semi-transparent white/pale ring, feathered glow, soft aura, airbrush halo between subject and background.
- Opaque cel-game art; crisp silhouette then immediate chroma.
- NO drop shadow or soft gray blob past the subject edge onto the background.

ART STYLE — MUST match "fresh flower line" + "cold drink line" in this project:
- BOLD VIVID SATURATED flower and wrap colors — NEVER muddy, NEVER dusty gray-brown overall.
- SMOOTH gradients inside each petal / paper fold + prominent BRIGHT highlight spots (cream/white) on glossy petals — juicy merge-game icon pop.
- Warm lighting from top-left; fresh and lit, not heavy.
- Wrapping paper / box: clean cel gradients and simple folds — NOT photoreal crepe noise.

LINE / 描边:
- HAIRLINE outline ONLY (1px-feel), colored ONE step darker than LOCAL fill in SAME hue family.
- FORBIDDEN: thick black frame, heavy dark brown ring, bold comic ink around whole bouquet.

Internal highlights = small TIGHT patches fully INSIDE surfaces — never feathering to outer silhouette.

NO WHITE STROKE around outer silhouette: no sticker rim, no milky outer band.

CHROMA-KEY SAFETY:
- NEVER paint #FF00FF, hot screen fuchsia, or chroma-matching magenta ON flowers or ribbons.
- Pinks on blooms = coral, rose, raspberry (#EC407A family) — clearly NOT the flat background magenta.

COMPOSITION — **FILL THE 1:1 GRID CELL (critical):**
- The whole bouquet / box / basket must **DOMINATE the square** like other merge icons in this game — **NOT** a small prop floating in a sea of magenta.
- Target: subject silhouette spans roughly **~78–92%** of canvas **width** AND **height** (whichever is tighter), leaving only a **thin even rim** of solid #FF00FF — same visual weight as icons that "fill the cell".
- **FORBIDDEN:** tiny centered icon with large empty background; excessive padding; "postage stamp" scale.
- Progression = **richness / volume / flower count / wrap tier**, NOT "smaller drawing in early levels" — Lv1 is still **big in frame**, just simpler flowers than Lv10.
- Readable merge icon, slightly "3D toy / cel" feel.
NO outer glow; NO floating sparkle particles outside silhouette; NO lens flare.
""".strip()

BOUQUET_GLOBAL = """
FLOWER BOUQUET LINE — every level:
- ONE cohesive prop: wrapped bouquet, OR gift box of flowers, OR basket arrangement — as specified per level.
- **SCALE:** follow each level's percentage — always **large in the 1:1 canvas** per SHARED (fill the board cell).
- Flower heads must match the **same glossy highlighted cel style** as the game's single-stem fresh flowers (bright petals, white highlight arcs, vivid greens).
- Stems may be partially hidden by wrap; bouquet stands as ONE unit, not scattered loose stems across the canvas.
- NO text, NO logos on tags; decorative blank ribbons only.

GIFT BOX / BASKET (when used):
- Opaque painted surfaces — no real transparency showing #FF00FF through walls.
- Warm ivory, gold ribbon, wicker brown = cel colors with highlights INSIDE the shape.
""".strip()

# Progression aligned with docs/prompt/bouquet_line_v3 + v5 vivid flower language
SUBJECTS: dict[int, str] = {
    1: """
LEVEL 1/10 — 一小捧散花 (loose bunch) — **simplest tier in the chain, but still MUST fill the 1:1 cell.**

3–4 mixed wildflowers (e.g. white daisy with golden center, small pink bloom, small yellow bloom) held with **thin green twine** — **NO wrapping paper yet.** Flowers can be simpler than high tiers, but draw the **whole bunch LARGE**.

**GAPS / CHROMA:** tight gaps between petals, stems, and leaves must be filled with **deep green shadow**, **stem green**, or **paper-tint** — **NEVER** leave flat **#FF00FF** or screen-magenta **visible between flowers** (causes bad matting).

**SCALE:** entire bunch **~76–84%** of frame width AND height — **thin #FF00FF rim only** (almost edge-to-edge). **FORBIDDEN:** tiny cluster in the middle.

Petals: vivid with white highlight spots per SHARED. Hairline edges. HARD EDGE to #FF00FF.
""".strip(),
    2: """
LEVEL 2/10 — 迷你牛皮纸花束 (kraft wrap bouquet).

**4–5** bright rose-pink blooms wrapped in **warm beige kraft paper** (#D7CCC8), **twine bow** at bottom. Glossy petals.

**SCALE:** whole prop **~80–88%** of frame width AND height — fills the square; thin magenta margin. HARD EDGE per SHARED.
""".strip(),
    3: """
LEVEL 3/10 — 郁金香花束 (tulip bouquet).

**5–6 tulips** — **vivid scarlet red** + **sunny yellow** — **crisp white** wrap + **emerald green satin** bow. Bold glossy cups.

**SCALE:** **~82–90%** of frame — nearly full cell, fuller composition than Lv2. HARD EDGE per SHARED.
""".strip(),
    4: """
LEVEL 4/10 — 玫瑰满天星 (roses + baby's breath).

**5–6 coral-pink roses** (spiral layers) + **white baby's breath**; **blush pink** paper + **pink satin** bow. NOT #FF00FF pinks.

**SCALE:** **~83–91%** of frame — big, lush read. HARD EDGE per SHARED.
""".strip(),
    5: """
LEVEL 5/10 — 田园混搭花束 (country mix).

**Big golden sunflower**, **white daisies**, **purple accents**, **green foliage**; **two-tone** wrap (**cream + sage green**) + **cream ribbon**.

**SCALE:** **~84–92%** of frame — abundant and **cell-filling**. HARD EDGE per SHARED.
""".strip(),
    6: """
LEVEL 6/10 — 精美花盒 (elegant flower gift box).

**Square ivory box**, lid **ajar**, **red and pink roses** visible inside. **Gold satin ribbon** bow (#FFD54F cel gold).

**SCALE:** box + ribbon **~85–92%** of frame — dominant, almost touches edges with small even margin. HARD EDGE per SHARED.
""".strip(),
    7: """
LEVEL 7/10 — 红玫瑰大花束 (grand red rose bouquet).

**Many** **crimson red roses** (12+), **warm gold** wrap + **wide gold satin** ribbon. Lush spirals.

**SCALE:** **~86–93%** of frame — **maximum impact**, barely inset from square edges. HARD EDGE per SHARED.
""".strip(),
    8: """
LEVEL 8/10 — 花艺礼篮 (flower gift basket).

**Wicker basket** + handle, **overflowing**: **pink roses**, **blue-lavender hydrangeas**, **white accents**, **lush greens**. Warm brown wicker.

**SCALE:** **~87–93%** of frame — basket and blooms fill the cell. HARD EDGE per SHARED.
""".strip(),
    9: """
LEVEL 9/10 — 鎏金花束 (gilded luxury bouquet).

**Peach-pink peonies** + **cream roses**; **wine/burgundy** wrap, **gold foil** edges + **thick gold** bow.

**SCALE:** **~88–94%** of frame — opulent and **nearly full-bleed** in the icon. HARD EDGE per SHARED.
""".strip(),
    10: """
LEVEL 10/10 — 传说花束 (legendary grand bouquet).

**Spectacular** mix: pink, lavender, sky blue, peach, cream blooms — **pearl-white / ivory** wrap + **soft gold** ribbon. **Grand cascade** silhouette, ultimate tier.

**SCALE:** **~90–95%** of frame — **largest / fullest** in the line, **minimal** magenta border (still a hair of solid #FF00FF for matting). **NO** floating particles. HARD EDGE per SHARED.
""".strip(),
}


def run(levels: list[int] | None) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    if not os.path.isfile(GEN):
        print("Missing", GEN, file=sys.stderr)
        sys.exit(1)

    category = "FLOWER BOUQUET merge line (花束线 progression)"
    level_list = levels if levels is not None else list(range(1, 11))

    for idx, n in enumerate(level_list):
        if n not in SUBJECTS:
            print("Unknown level:", n, file=sys.stderr)
            sys.exit(1)
        prompt = (
            SHARED.format(category_title=category, n=n)
            + "\n\n"
            + BOUQUET_GLOBAL
            + "\n\n"
            + SUBJECTS[n]
        )
        out = os.path.join(OUT_DIR, f"{PREFIX}_{n}_nb2_1x1.png")
        print(f"\n=== flower_bouquet {n}/10 -> {out} ===", flush=True)
        r = subprocess.run(
            [
                sys.executable,
                GEN,
                prompt,
                "-o",
                out,
                "--model",
                MODEL,
                "--aspect-ratio",
                "1:1",
            ]
        )
        if r.returncode != 0:
            sys.exit(r.returncode)
        if idx < len(level_list) - 1:
            time.sleep(SLEEP)
    print(f"\nDone flower_bouquet: {OUT_DIR}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--levels",
        type=str,
        default=None,
        help="Comma-separated levels 1-10 only (e.g. 3,4). Default: all.",
    )
    args = ap.parse_args()
    levels: list[int] | None = None
    if args.levels:
        levels = []
        for part in args.levels.split(","):
            part = part.strip()
            if not part:
                continue
            v = int(part)
            if v < 1 or v > 10:
                raise SystemExit("--levels must be 1-10")
            levels.append(v)
        levels = sorted(set(levels))
    run(levels)


if __name__ == "__main__":
    main()
