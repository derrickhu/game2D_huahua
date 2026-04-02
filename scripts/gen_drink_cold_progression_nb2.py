#!/usr/bin/env python3
"""
Batch-generate drink_cold Lv1–8 as separate 1:1 NB2 images with clear visual progression.
Outputs to game_assets (not the game repo). Requires network + Gemini API.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time

from huahua_paths import game_assets_dir

GEN = os.path.expanduser("~/.cursor/skills/gemini-image-gen/scripts/generate_images.py")
OUT_DIR = str(game_assets_dir() / "drink_cold_nb2/for_review/progression_1x1")
MODEL = "gemini-3.1-flash-image-preview"

SHARED = """
Game merge drink icon, ONE drink only, centered, flat solid #FF00FF magenta background ONLY.
Perfect SQUARE 1:1 canvas. NO text, NO Chinese, NO labels, NO UI, NO frames, NO tiles.
SHORT WIDE glassware: height of drink+glass roughly ≤ width — stout icon silhouette.

GLOBAL PROGRESSION RULE (critical):
This is level {n} of 8 in ONE merge chain. Higher levels MUST look MORE premium than lower:
more elaborate glass, richer/layered colors, MORE garnishes, fancier presentation.
Level 8 must look unmistakably more "legendary" than level 1 if compared side by side.

HARD EDGE FOR MATTING (highest priority — previous runs failed on this):
- Outside the colored outline of the drink, the VERY NEXT pixels must be SOLID #FF00FF only.
- FORBIDDEN around the whole subject: semi-transparent white band, light pink mist, feathered blur, soft glow, "aura", airbrush halo, faded rim between object and background, anti-alias that looks like a white/pale ring.
- The silhouette must be CRISP: opaque art, then immediate flat chroma — NO intermediate semi-opaque white or pale pixels touching the magenta.
- Do NOT simulate backlight or sticker glow around the cup.

ART STYLE: BOLD vivid SATURATED colors (match green plant / bouquet brightness) — NEVER dull muddy or brown-gray dominant; smooth gradients INSIDE shapes; prominent bright highlight spots on glass/liquid for juicy pop.
Internal highlights on glass = small TIGHT patches of pale ice-blue or pale mint, fully INSIDE the glass area (not touching outer silhouette edge). Avoid words that become outer effects: no "soft glow", no "ethereal edge", no "luminous outline".

OUTLINE RULE: HAIRLINE ultra-THIN colored line only — slightly darker than adjacent fill in SAME family (teal-green edge on green glass, blue-gray on clear glass). FORBIDDEN: thick stroke, heavy black or dark brown comic outline, wide dark border. NOT white, NOT #FFFFFF ring, NOT pale pink fringe outside that line.

NO WHITE STROKE / NO WHITE描边:
- Forbidden: white/pale halo outside the main dark outline, continuous white border, sticker white edge, outer semi-transparent ring.
- Allowed: filled whipped cream, white flower petals as separate solid shapes — highlights must not form a perimeter glow.

CHROMA-KEY SAFETY (applies to every drink — critical for matting):
- Background for generation is #FF00FF magenta. NEVER use that exact magenta, hot fuchsia, or neon #FF00FF ANYWHERE on the drink subject
  (glass, liquid, ice, highlights, reflections, rims). Those areas will be deleted by automated keying.
- Glass speculars = pale ice-blue or pale aqua TIGHT blobs fully inside glass — NOT #FFFFFF ring, NOT cream-colored feathering that reaches the outer edge.
- Glass body = cool gray #CFD8DC or pale blue-gray — NOT pink-purple that matches background.
- Pink liquids = coral / salmon / rose tones clearly different from #FF00FF.
- The drink must read as a closed "sticker" silhouette: NO magenta color visible INSIDE the outer outline of the glass+contents.
""".strip()

# Per-level: push "tier" explicitly so model differentiates
SUBJECTS: dict[int, str] = {
    1: """
LEVEL 1/8 — LOWEST tier, simplest everyday drink.
Short plain glass or small mason jar, pale yellow lemonade, ONE lemon wheel + ONE tiny white flower.
Minimal garnish, simplest glass shape, modest highlights — like basic street lemonade.
NOT fancy stemware, NOT layered liquid, NOT bar cocktail look.
""".strip(),
    2: """
LEVEL 2/8 — Still casual but CLEARLY nicer than level 1.
Wide short tumbler, orange-pink-red fruit iced drink with visible ice cubes, mixed berry + citrus chunks,
thin straw OK, small flower on rim. More color variety and ingredients than level 1, still "fruity iced tea" vibe.
""".strip(),
    3: """
LEVEL 3/8 — MID tier: nicer café sparkling drink.
Short WIDE faceted chunky tumbler. Mint-green fizzy liquid = SOLID toon paint with white bubble circles (bubbles are white/light mint shapes, not holes).
2–4 pastel petals (lavender, peach, butter yellow) on surface — petal colors must NOT be magenta or #FF00FF.

GLASS: cel-shaded OPAQUE-LOOKING walls — pale blue-gray (#B0BEC5) + soft pale-aqua specular blob on one side of the bowl (NOT a white rim stroke). The ENTIRE glass+liquid region contains ZERO pixels of background magenta;
if you "fake" transparency, use pale blue-gray fill instead of showing #FF00FF through glass.
""".strip(),
    4: """
LEVEL 4/8 — UPPER-MID: frozen / slush premium.
Short WIDE glass, smooth rose-pink frozen slush (#F48FB1–#EC407A), rounded dome top,
ONE rose petal on top. SMOOTH glass rim with soft gradient frost highlight — NO grainy sugar crust.
Clearly more "crafted dessert drink" than levels 1–3.
""".strip(),
    5: """
LEVEL 5/8 — HIGH tier starts: cocktail lounge presentation.
Wide shallow STEMMED coupe (squat bowl). TWO OPAQUE toon layers: vivid herb GREEN bottom + CORAL / SALMON top (#FF8A65 or #FFAB91) — NOT neon magenta #FF00FF.
Sharp horizontal boundary; both layers thick solid paint.

Large round topping = opaque sphere in off-white / very pale lavender — shading ONLY as a darker solid crescent on the bottom-right INSIDE the sphere (no blurred shadow leaking outside sphere edge). Tiny pale-yellow specular dot INSIDE top of sphere — NO cream halo around sphere silhouette.

Garnish: mint sprig + small pansy (purple+yellow petals only, no fuchsia matching #FF00FF).

GLASS bowl/stem/base: cool gray (#CFD8DC) + small pale-aqua highlight patch INSIDE bowl wall only. NO specular or light bleed touching the outer contour. NO white stroke around cup. NEVER #FF00FF inside silhouette.
Entire subject contains NO background magenta inside the outer drink outline.
""".strip(),
    6: """
LEVEL 6/8 — LUXURY dessert drink, more ornate than level 5.
Footed fluted milkshake / sundae glass (still squat/wide bowl), thick lavender-pink creamy shake,
GENEROUS whipped cream spread WIDE (not a thin tower), strawberry slice + small flower on cream, straw.
More toppings and richer creamy body than level 5.
""".strip(),
    7: """
LEVEL 7/8 — PRESTIGE fantasy drink, more magical than 5–6.
Short wide jar or premium rocks glass, DEEP indigo–violet liquid with soft INTERNAL nebula swirls
(stay inside liquid, not outer aura), starfruit slice + tiny white flower, glass looks crystal-clear and deep.
More mysterious and saturated than all previous levels.
""".strip(),
    8: """
LEVEL 8/8 — ULTIMATE legendary item, MOST ornate of the whole chain.
Curved hurricane or premium stemmed glass with thickest clearest glass walls,
INTERNAL aurora bands: mint-teal → electric blue → coral-pink (NOT pure #FF00FF chroma magenta),
wavy layers clearly INSIDE liquid. MAXIMUM garnish set: edible flower + thick lemon wheel + small accent fruit,
all COMPACT near rim. Richest highlights, most jewel-like colors — unmistakably top of merge line.
""".strip(),
}


def main() -> None:
    if not os.path.isfile(GEN):
        print("Missing generate_images.py at", GEN, file=sys.stderr)
        sys.exit(1)
    os.makedirs(OUT_DIR, exist_ok=True)
    for n in range(1, 9):
        prompt = SHARED.format(n=n) + "\n\n" + SUBJECTS[n]
        out = os.path.join(OUT_DIR, f"drink_cold_{n}_nb2_progression_1x1.png")
        cmd = [
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
        print(f"\n=== Level {n}/8 -> {out} ===", flush=True)
        r = subprocess.run(cmd)
        if r.returncode != 0:
            print("FAILED at level", n, file=sys.stderr)
            sys.exit(r.returncode)
        if n < 8:
            time.sleep(6)
    print("\nDone. Review images in:", OUT_DIR, flush=True)


if __name__ == "__main__":
    main()
