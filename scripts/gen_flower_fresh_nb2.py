#!/usr/bin/env python3
"""
Generate flower_fresh Lv1–10 as separate 1:1 NB2 images (magenta key).
Same discipline as gen_drink_tea_dessert_nb2.py: hard edge, vivid saturation, chroma-safe, no white halo.

Outputs under game_assets only — no minigame copy (run separate process when ready).
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time

from huahua_paths import game_assets_dir

GEN = os.path.expanduser("~/.cursor/skills/gemini-image-gen/scripts/generate_images.py")
MODEL = "gemini-2.5-flash-image"
SLEEP = 6

ASSETS = game_assets_dir()
OUT_DIR = ASSETS / "flower_fresh_nb2/for_review/1x1"
PREFIX = "flower_fresh"

SHARED = """
Game merge item icon, ONE single isolated flower / plant prop only, centered, flat solid #FF00FF magenta background ONLY.
Perfect SQUARE 1:1 canvas. NO text, NO Chinese, NO labels, NO UI, NO frames, NO tiles, NO grid.
Category: {category_title}. This is level {n} of 10 in a merge chain — must read CLEARLY lower or higher tier than other levels (strong progression).

HARD EDGE FOR MATTING (highest priority — same as drink / dessert lines):
- Outside the colored outline, the VERY NEXT pixels must be SOLID #FF00FF only.
- FORBIDDEN: semi-transparent white/pale ring, feathered glow, soft aura, airbrush halo between subject and background.
- Opaque cel-game art; crisp silhouette then immediate chroma.
- NO drop shadow or soft gray blob that bleeds past the subject edge onto the background.

ART STYLE — match "green plant line" + "cold drink line" + "dessert line" brightness:
- BOLD VIVID SATURATED petal and leaf colors — NEVER muddy, NEVER dusty gray-brown overall.
- SMOOTH gradients inside shapes + prominent BRIGHT highlight spots on petals/leaves/pots — juicy merge-game icon pop.
- Warm lighting from top-left; fresh and lit, not heavy.

LINE / 描边:
- HAIRLINE outline ONLY (1px-feel), colored ONE step darker than LOCAL fill in SAME hue family.
- FORBIDDEN: thick black frame, heavy dark brown ring, bold comic ink around whole bloom.

Internal highlights = small TIGHT patches fully INSIDE surfaces — never feathering to outer silhouette.

NO WHITE STROKE around outer silhouette: no sticker rim, no milky outer band.

CHROMA-KEY SAFETY:
- NEVER paint #FF00FF, hot screen fuchsia, or chroma-matching magenta ON petals, lips, or accents.
- Pinks / magentas on flowers = deep rose, coral, raspberry, orchid purple-red (#AD1457, #C2185B) — clearly NOT the flat background magenta.

COMPOSITION:
- Chunky readable game icon (slightly "3D toy / cel" feel), not botanical photo realism.
- Subject ~65–78% of frame with comfortable padding; avoid ultra-tall skinny composition.
NO outer glow, NO sparkles outside silhouette.
""".strip()

FRESH_GLOBAL = """
FRESH FLOWER LINE — every level:
- One cohesive prop (seed+pot, two buds only, potted sprout, or cut flower bloom with short stem as needed). Stay on-theme for merge progression.
- **Level 2 has NO pot and NO large leaves** — one stem forks into two **small** buds; see level text.

POTS / SOIL (when present):
- Warm terracotta, cream ceramic, or small soil mound — opaque cel colors; NO gray smudge halo at pot edge.

STEMS / LEAVES:
- Vivid healthy greens (#66BB6A, #43A047, #2E7D32 family), same hairline darker-green edge — not black.

NO water droplets spray, NO busy particle field — keep silhouette clean for future matting.
""".strip()

# Lv1–6 names align with in-game 花种子→玫瑰; Lv7–10 follow v4 sheet progression (百合/绣球/兰花/牡丹系)
SUBJECTS: dict[int, str] = {
    1: """
LEVEL 1/10 — 花种子 (SEED) — **smallest merge tier, must look small on the board.**

Show **2 or 3 SMALL round seeds** (each much smaller than a “hero” icon seed), warm brown–tan gradient (bright NOT mud).
Each seed has a **tiny** bright lime sprout with **1–2 baby leaves** — cute but **miniature**.

Arrange seeds in a **loose cluster** (slight triangle or gentle arc), **not** one giant seed filling the canvas.

**SCALE (critical):** entire cluster (all seeds + sprouts together) only **~42–52%** of the icon width AND height — **generous #FF00FF margin** on all sides so it reads as a humble Lv1 item in a 1:1 cell.

Optional **very small** shared soil nub or tiny terracotta chip under the group — keep minimal.

Hairline warm-brown edge on seeds, green on sprouts. HARD EDGE to #FF00FF per SHARED.
""".strip(),
    2: """
LEVEL 2/10 — 花苞 (BUD). **NO pot, NO soil, NO big leaves.**

STRUCTURE (user request):
- **ONE main green stem** that splits into **two short side branches** (a simple Y-fork or two tiny lateral twigs) — each branch ends in **ONE small closed bud** (two buds total, but they share one plant stem, not two separate floating buds).
- Buds must be **noticeably SMALL** relative to the canvas (~1/3 to 1/2 the size you would paint for a "hero" bloom) — user said previous pair was too big; leave **generous #FF00FF padding** around the whole prop.
- **Stem a bit longer** than stubby nubs: visible main stem below the fork (~15–22% of icon height), then the fork, then small buds — reads as a tiny branching sprig.

Bud look: tight pink–peach / rose closed petals (NOT #FF00FF); hairline darker-pink edge; optional tiny sepal at each bud base. Cel highlights, vivid but delicate.

**Forbidden**: terracotta pot, soil, large leaves, two unrelated parallel stems with no shared base.
""".strip(),
    3: """
LEVEL 3/10 — 小雏菊 (DAISY). Big round golden-yellow puffy center dome, 8 chunky rounded white–cream petals around it; short green stem nub.
Bright, friendly, clearly more "flower" than Lv2 bud. Thin gold edge on center, soft warm-gray or cream edge on petals if needed.
""".strip(),
    4: """
LEVEL 4/10 — 向日葵 (SUNFLOWER). Large dark brown round center disk, ring of chunky golden-yellow petals; one thick green leaf at bottom.
Sunny, iconic, more impressive than daisy. NO black outline — dark brown / dark gold edges only.
""".strip(),
    5: """
LEVEL 5/10 — 康乃馨 (CARNATION) — must read as a **real florist carnation**, NOT a rose / lily / sunflower.

CARNATION SHAPE:
- **Frilled / zigzag petal edges** — dense overlapping pink ruffles forming a **soft globe or short drum** (clove-pink look).
- **Green tubular calyx** under the bloom + **visible stem** + **1–2 narrow leaves**.

VOLUME & LIGHT (user said prior art felt flat / stiff / wrong style — fix this):
- Match the **same juicy cel merge-icon language** as Lv3–4 in this line: **smooth gradients + large bright highlight blobs** on outward-facing ruffle tips (top-left light) + **deeper rose shadow in the valleys** between layers so the head feels **round, puffy, and 3D**, NOT a flat pink coin or stiff clipart mandala.
- **Overlapping petals** must show **clear depth steps** (each tier slightly darker where tucked under the one above).

ORGANIC / NOT DEAD-SYMMETRIC:
- **Slight natural asymmetry**: bloom tilted **~15–25°** (gentle 3/4), or stem leans a few degrees; leaves at **different angles / heights** — **FORBIDDEN** perfect front-on kaleidoscope symmetry, ruler-straight vertical stem with mirror leaves, or "emoji circle flower" rigidity.

FORBIDDEN: rose spiral, lily star, sunflower disk, thin uniform shadows only.

Colors: vivid pink (#F8BBD0 → #EC407A), hairline darker-pink edge; stem/calyx vivid green with white highlight specks per SHARED.
""".strip(),
    6: """
LEVEL 6/10 — 玫瑰 (ROSE). Classic rose from slightly above — clear **SPIRAL / pinwheel** of 3–4 concentric smooth petal layers, deep red gradient (#EF5350 → #B71C1C).

**STEM IS REQUIRED (user reported missing):**
- A **visible green stem** must extend **downward below the bloom** for a noticeable length (~18–28% of total icon height) — NOT a head that ends flush with two leaves on the magenta with **no stem segment**.
- Two dark green leaves: attach along the stem or just under the head, but the **stem continues past them** toward bottom of frame.

Must differ from Lv5: rose = smooth rounded petals in spiral, NOT frilly zigzag carnation mass. Dark red / brown-red hairline edge on petals only.
""".strip(),
    7: """
LEVEL 7/10 — 多头百合 (multi-head LILY) — **short stem; OPEN flower = main hero; bud = clearly secondary.**

STRUCTURE:
- **ONE short green stem** — user: stem was too long — keep stem **stubby**: visible stem+below-bloom segment only **~10–18%** of total icon height (leaves sit **close under** the open bloom, **NOT** a tall pole).
- **Head A — OPEN lily (PRIMARY, dominates frame):** classic **6 long pointed petals**; white → soft blush pink; **golden stamens** at center. This bloom must be the **largest shape** and sit in the **center / upper-center** — **~65–78%** of the plant's **silhouette area** (petals fill the square).
- **Head B — bud (SECONDARY):** **smaller** closed bud (**~30–45%** the visual size of the open head), placed **peripheral** — e.g. **lower side**, **tucked near a leaf**, or **slightly behind** — reads as accent, **NOT** competing with the open flower.

**BUD ORIENTATION:** tip **up or gently outward** — **FORBIDDEN** drooping bud toward bottom edge.

**LEAVES:** **1–2 slim leaves** max near the **short** stem base — **small** relative to the open bloom so they **do not** steal focus.

**FILL THE 1:1 CELL:** whole plant **~82–90%** — but **petal mass** of the **open lily** is the clear focal mass.

Very distinct from rose / carnation. Hairline soft-pink on petals, darker green on stem. HARD EDGE per SHARED.
""".strip(),
    8: """
LEVEL 8/10 — 绣球 (HYDRANGEA). Big round ball of many small clustered florets — fluffy blue–periwinkle sphere (#90CAF9 → #5C6BC0) with bumpy readable texture.
Two chunky green leaves at bottom. Premium tier, fuller than lily. Dark blue hairline edge.
""".strip(),
    9: """
LEVEL 9/10 — 蝴蝶兰 (Phalaenopsis, "moth orchid") — **real shape + flowers are 90% of the icon.**

REFERENCE (botanical — follow this read):
- Flowers look like a **moth in flight**: **3 sepals + 2 true petals** spread **wide and flat**; **petals broader** than sepals; center has a short **column**; the **labellum (lip)** is the showy modified petal — often **3-lobed**, contrasting color, slightly **forward** — NOT a generic 5-petal daisy.
- Blooms along a **short arching spike**; can face slightly different directions.

COUNT (flexible — user OK with one OR several):
- **1, 2, OR 3 open blooms** on the same short stem — **NOT 4+.** If **one** flower: make it **extra large** to fill the frame. If **2–3**: **one hero largest**, others smaller, **overlapping depth**.

STEM / LEAVES:
- **NO basal leaf rosette** — **FORBIDDEN** thick leaf pile at bottom. Prefer **only** thin green **stem / pedicels**; stem is **minimal** connector.
- **Optional:** at most **one tiny** leaf hint or none.

COLOR: sepals/petals purple–violet (#CE93D8 → #7B1FA2); **lip** deeper rose-wine **#AD1457 family — NOT #FF00FF**; yellow/cream accents on lip throat OK; white highlight spots per SHARED.

**FILL THE 1:1 CELL:** combined bloom silhouettes **~88–95%** of frame — **petals are the subject**, thin #FF00FF rim.

Silhouette must read **Phalaenopsis / 蝴蝶兰**, not generic purple flower. Dark purple / wine hairline. HARD EDGE per SHARED.
""".strip(),
    10: """
LEVEL 10/10 — 华贵牡丹 / 金色牡丹 (PEONY prestige). Large luxurious many-petal bloom: rich gold–amber–deep orange gradient (#FFD54F → #F57C00 → #E65100), layered round petals in 3–4 rings.
Biggest, most ornate bloom of the line; two dark green leaves at base. Dark gold / burnt orange hairline edge.
NO sparkles outside silhouette; NO text; NO screen-magenta petals.
""".strip(),
}


def run(levels: list[int] | None) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    if not os.path.isfile(GEN):
        print("Missing", GEN, file=sys.stderr)
        sys.exit(1)

    category = "FRESH CUT FLOWER merge line (鲜花线 progression)"
    level_list = levels if levels is not None else list(range(1, 11))

    for idx, n in enumerate(level_list):
        if n not in SUBJECTS:
            print("Unknown level:", n, file=sys.stderr)
            sys.exit(1)
        prompt = (
            SHARED.format(category_title=category, n=n)
            + "\n\n"
            + FRESH_GLOBAL
            + "\n\n"
            + SUBJECTS[n]
        )
        out = os.path.join(OUT_DIR, f"{PREFIX}_{n}_nb2_1x1.png")
        print(f"\n=== flower_fresh {n}/10 -> {out} ===", flush=True)
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
    print(f"\nDone flower_fresh: {OUT_DIR}", flush=True)


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
