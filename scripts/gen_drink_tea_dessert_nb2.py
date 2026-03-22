#!/usr/bin/env python3
"""
Generate drink_tea / drink_dessert Lv1–8 as separate 1:1 NB2 images.
Same prompt discipline as gen_drink_cold_progression_nb2.py (hard edge, chroma-safe, no halo).

Outputs under game_assets (not the game repo).
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

SHARED = """
Game merge item icon, ONE single object only, centered, flat solid #FF00FF magenta background ONLY.
Perfect SQUARE 1:1 canvas. NO text, NO Chinese, NO labels, NO UI, NO frames, NO tiles.
Category: {category_title}. This is level {n} of 8 — must look CLEARLY lower or higher tier than other levels when compared (progression).

HARD EDGE FOR MATTING (highest priority):
- Outside the colored outline, the VERY NEXT pixels must be SOLID #FF00FF only.
- FORBIDDEN: semi-transparent white/pale ring, feathered glow, soft aura, airbrush halo between object and background.
- Opaque cel-game art; crisp silhouette then immediate chroma.

ART STYLE — MUST match brightness of "green plant line" + "cold drink line" in this project (many users said new gens looked too dark):
- BOLD VIVID SATURATED colors — tea liquids bright amber/gold/jade; pastries bright butter-yellow, strawberry, lavender icing — NEVER muddy, NEVER gray-brown cast, NEVER desaturated "dusty" look.
- SMOOTH GRADIENT shading inside each shape + prominent BRIGHT highlight spots (cream/white) on glossy areas — juicy merge-game icon pop.
- Warm lighting from top-left; colors feel FRESH and LIT, not heavy.

LINE / 描边 — thin and LIGHT (users reported thick dark outlines):
- HAIRLINE outline ONLY: ultra-THIN stroke, 1px-feel, subtle. FORBIDDEN: thick black contour, heavy dark brown line, bold comic ink, wide dark purple border.
- Outline color = ONE small step darker than the LOCAL fill in the SAME hue family (e.g. mint fill → slightly deeper mint edge; peach icing → slightly deeper peach edge). NOT neutral dark gray/black around whole object.
- Prefer: very soft edge defined by shading contrast; if there is a line at all it must be delicate and colored, not a dark frame.

Internal highlights = small TIGHT patches (pale mint, ice-blue, cream) fully INSIDE surfaces — never feathering to outer edge.

NO WHITE STROKE around silhouette: no sticker backlight, no outer luminous rim.

CHROMA-KEY SAFETY:
- NEVER use #FF00FF, hot fuchsia, or screen magenta ON the subject (food, liquid, steam painted as pink-purple that matches background).
- Pink/red foods = coral, rose, strawberry red — clearly different from #FF00FF.

DEFAULT composition: subject fits comfortably in square with padding; **Level 1 tea is an exception** (see level text — slender tea bag).
NO outer glow outside silhouette.
""".strip()

# All tea icons: user asked no visible steam (hard to cut, clutters icon)
TEA_GLOBAL = """
TEA LINE — ALWAYS (every level):
- It is always a FLOWER TEA beverage in a drinking vessel. Do NOT switch to unrelated props as the main subject.
- ABSOLUTELY NO steam, NO vapor, NO smoke wisps, NO hot-air curls above the cup — tea reads fresh but with ZERO rising steam.

GLASS / CUP WALLS — NO chroma #FF00FF bleeding through (user reported pink tint on tea):
- FORBIDDEN: photoreal transparent glass where background magenta shows through and tints the liquid pink.
- REQUIRED: cel-shaded OPAQUE or frosted "glass" — walls = pale blue-gray (#B0BEC5) / milky white with specular highlights drawn INSIDE the wall shape only; OR paint the cup interior behind tea as solid WHITE / pale cream fill so tea is layered on top as opaque amber paint.
- Tea liquid = SOLID warm amber/gold gradient INSIDE the liquid area — not see-through to background.
""".strip()

# 甜品线：与茶饮/冷饮同一套抠图纪律（白边、品红透底、发闷色）
DESSERT_GLOBAL = """
DESSERT LINE — ALWAYS (every level):
- ONE readable merge icon: flower-themed pastry / cake / plated dessert; progression must be obvious vs other levels.
- Levels 1–2 SPECIAL: Lv1 = **stack of several small cookies**; Lv2 = **exactly 2 macarons, staggered / offset** (not a tall vertical tower of three). Still ONE merge prop; pieces **small**; **clear padding**; NO plate / tray / doily unless a later level explicitly needs dishware.

GLASS / CUP / JAR (any level that uses a vessel — e.g. mousse in glass):
- FORBIDDEN: photoreal clear glass where #FF00FF shows through and tints filling pink-purple.
- REQUIRED: cel-shaded OPAQUE or frosted glass — pale blue-gray / milky wall with specular highlights drawn INSIDE the wall only; dessert filling = SOLID opaque pastel (lavender mousse, etc.), not see-through to background.

ANTI–WHITE-EDGE (matting — do NOT repeat tea/cake user issues):
- NO outer white, cream, or pale-gray STROKE as the OUTERMOST layer around the whole silhouette; NO "sticker backlight" rim, NO semi-transparent pale halo or airbrush glow into #FF00FF.
- White frosting / plate / macaron: brightest cream lives ONE step INWARD; the TRUE outer silhouette = a clean slightly deeper hue in the SAME family (butter yellow, blush pink, soft lilac, warm gray-beige plate rim) then IMMEDIATE solid #FF00FF — same HARD EDGE as SHARED.

COLOR / LINE (same fixes as tea line feedback):
- BRIGHT saturated bakery colors — NEVER muddy, dusty, or gray-brown overall; hairline colored outline only, NO thick black frame around food.

NO steam, NO vapor, NO smoke wisps (not a hot drink).

NO text, NO letters, NO logo on cake "banner" shapes — decorative blank shapes only if mentioned.
""".strip()

TEA_SUBJECTS: dict[int, str] = {
    1: """
LEVEL 1/8 — simplest: herbal tea BAG — **smallest tier; must look modest in a 1:1 cell.**

**Shape:** **SLENDER and TALL** rectangular sachet (like a classic vertical tea bag), **NOT** a wide squat pillow — aspect about **taller than wide** (~1.25–1.6 : 1 height:width).

**Scale:** whole prop (bag + string loop + small tag) only **~45–55%** of frame width AND height — **large empty #FF00FF padding** so it does not dominate the grid like a max-level item.

LIGHT warm tan / cream kraft (#E8D5C4 feel) — bright NOT dark cardboard. Thin string + **small** tag with simple flower **silhouette** (no text). Hairline outline only. HARD EDGE per SHARED.
""".strip(),
    2: """
LEVEL 2/8 — jasmine tea. Short ceramic tea cup (squat), pale green-gold tea, 3–4 white jasmine buds floating on surface.
Slightly nicer than tea bag; still everyday tea cup.
""".strip(),
    3: """
LEVEL 3/8 — mid tier flower tea. Refined glass cup (can be double-wall short tumbler), warm amber-red tea, rose petals + small rosebud and a few green sepals
floating on surface — prettier than level 2, still one modest cup. NO steam.
""".strip(),
    4: """
LEVEL 4/8 — same GLASS CUP family as level 5 (early progression: decorative drinking glass), but MUST stay SHORTER / squatter / less ornate than level 5 — user explicitly wants GLASS, NOT teacup / NOT porcelain cup / NO saucer / NO gaiwan vibe.
- CUP: ONE short decorative GLASS only — e.g. squat faceted glass tumbler, short waisted glass, or compact double-wall glass tumbler with subtle facet cuts or slim gold rim band (flat paint). Material reads as glass (cool cel highlights), NOT ceramic.
- Silhouette: wider and shorter than level 5's taller slender glass; still clearly nicer than level 3's plain modest tumbler (more facets / rim detail OK) but NO tea-party porcelain shapes.
- HERO = TEA BAG steeping: pretty string + decorative paper tag at rim, sachet in rich golden-amber OPAQUE cel tea (no magenta bleed). 1–2 tiny accents (petal, mint leaf) OK — NOT loose-flower explosion (that's level 5).
- Opaque cel "glass" walls / white interior per TEA_GLOBAL — no real transparency to background. NO steam.
""".strip(),
    5: """
LEVEL 5/8 — Cup must be VISUALLY TALLER or more elegant / slender than level 4's squat mug: e.g. faceted tall glass teacup with handle, OR waisted decorative glass, OR refined tall porcelain cup — clearly higher silhouette than 4.
NO tea bag — loose flower tea: golden-amber opaque tea with MANY floating petals and blooms (rose, jasmine-like, etc.), artful arrangement.
Gold rim accent OK as flat paint. Same opaque-glass / no-magenta-bleed rules as TEA_GLOBAL. NO steam.
""".strip(),
    6: """
LEVEL 6/8 — still ONLY tea in a drinking cup/bowl (NOT a teapot as hero). Premium thin porcelain tea BOWL on matching saucer OR elegant flared tea cup,
deep rich amber tea, LAVISH floating bouquet effect — several flower types (rose, small daisy-like blooms, herb sprig) clearly visible, harmonious colors.
Cup/saucer more refined silhouette than 5. NO steam.
""".strip(),
    7: """
LEVEL 7/8 — peak cup tea before ultimate level. Most exquisite lidded gaiwan slightly ajar OR twin-layer luxury cup showing ornate exterior pattern,
saucer with tiny accent bloom; tea dark golden with MAXIMUM floral elegance inside — like a master floral tea, still readable as one beverage icon.
Clearly more precious than 6. NO steam.

ANTI–WHITE-EDGE (matting — highest priority for this level):
- NO outer white, cream, or pale-gray STROKE or "sticker rim" around the whole silhouette.
- NO off-white decorative band as the OUTERMOST layer — if you paint a cream rim on porcelain, keep it ONE step INWARD from the true outer edge; the TRUE silhouette edge must be a clean colored line (mint / gold / teal) then IMMEDIATE solid #FF00FF.
- NO semi-transparent pale halo, airbrush glow, or feathered light fringe between subject and background — same HARD EDGE rule as SHARED.
""".strip(),
    8: """
LEVEL 8/8 — imperial collection tea. Most ornate: stacked gaiwan OR luxury tea caddy with gold-trim PAINT (flat metallic yellow-gold shapes, NOT glowing),
silky cloth napkin fold beside, small bloom — ultimate prestige, clearly richest of the line.
""".strip(),
}

DESSERT_SUBJECTS: dict[int, str] = {
    1: """
LEVEL 1/8 — petal shortbread **STACK / PILE** (one merge icon = several cookies, NOT one giant cookie filling the frame).
- **3–4 SMALL** round flower-pressed shortbreads in a casual vertical stack or slightly offset pile (clear overlap between pieces).
- Each cookie **individually small**; the whole cluster uses roughly **55–70% of the shorter canvas side** max — generous #FF00FF margin — user said a single huge cookie looks too big in-game.
- Bright golden-butter (#FFE082 feel), simple pressed flower indent on each; sunny, NOT gray biscuit.
- **NO plate, NO tray, NO mat** — only the cookie stack (floating group / cookies touching each other only).
- Hairline edge in slightly deeper gold / warm amber only per SHARED.

ANTI–WHITE-EDGE (user got white halo after matting — regenerate with clean edge):
- FORBIDDEN: hot pink / fuchsia / magenta-tinted outer stroke on cookies (reads wrong vs #FF00FF and causes cutout fringes).
- TRUE outer silhouette = slightly **deeper butter-gold or warm brown-gold** hairline, then **immediate** solid #FF00FF — NO pale ring, NO milky glow, NO white sticker rim outside the gold edge.
""".strip(),
    2: """
LEVEL 2/8 — flower macaron pair, **STAGGERED** layout (one merge icon = **EXACTLY 2** macarons — user said 3 stacked is too tall).

COMPOSITION (critical):
- **ONLY TWO** macarons total — NOT three, NOT a vertical tower.
- **错落摆放**: place them **off-axis** — e.g. one slightly forward-left and lower, the second upper-right with partial overlap; OR one leaning on the other at a slight angle; silhouette should be **wider and shorter** than a straight column, NOT a tall skinny stack.
- Pastel pink & lavender shells (can differ per macaron), cream filling visible; **ONE** tiny buttercream flower (+ small leaves) on the **upper / front** macaron only.
- Visible padding around the pair — must NOT dominate the entire square.
- **NO plate, NO dish, NO doily.**
- Hairline colored outline only; NO thick dark ring; NO white outer halo per SHARED / DESSERT_GLOBAL.
""".strip(),
    3: """
LEVEL 3/8 — flower cupcake. Cupcake in paper liner, tall swirl frosting piped like a rose, maybe one sugar pearl.
More volume and celebration than macaron.
""".strip(),
    4: """
LEVEL 4/8 — LAYERED mini cake IN A GLASS (jar / wide tumbler / verrine) — must read as CAKE, NOT a single smooth mousse or pudding puddle.
- INTERIOR (visible through the cup wall): clear HORIZONTAL STRATA — at least 3 readable bands, e.g. (bottom→top) golden-butter SPONGE / crumb base with subtle porous cel texture,
  pale cream or blush jam layer, second sponge or cake layer, then smooth pastel frosting cap (lavender-pink or rose) on top. Each band a DIFFERENT hue/value so layers read instantly.
- SPONGE layers: tiny soft pores / crumb specks in cel style — visibly "cakey"; cream layers smoother; NO one solid uniform fill from bottom to top.
- TOP: thin mint leaf + small edible flower / petals on the frosting — same garnish vibe as before.
- Glass = cel OPAQUE / frosted per DESSERT_GLOBAL — zero magenta show-through; you still SEE the layer stripes through the wall. Outer silhouette = cool gray-blue glass edge, NOT a white ring.
""".strip(),
    5: """
LEVEL 5/8 — petal cake slice. Tall triangular slice on small round plate, visible sponge + cream layers, petal garnish, fork optional (simple).
Clearly more "bakery slice" than cupcake.
Plate rim = opaque pastel ceramic (warm ivory / blush) with colored outer edge touching #FF00FF — NOT a pale glowing white dish rim.

MATTING-SAFE OUTLINE (critical — users got white halos after cut):
- FORBIDDEN: thick dark brown / black / deep purple OUTLINE tracing the whole cake slice — that becomes a white fringe when matted.
- REQUIRED: HAIRLINE edge only, colored ONE step darker than LOCAL fill (butter yellow edge on sponge, blush on cream) — same rule as SHARED.
- NO extra white or pale gray pixels between subject and #FF00FF; crisp silhouette then flat magenta.
""".strip(),
    6: """
LEVEL 6/8 — HIGH-END version of level 5's **petal cake slice** — NOT a busy dessert spread. User said Lv6 felt too messy; keep the icon **clean**.

SUBJECT (strict):
- **EXACTLY TWO** triangular cake slices — and NOTHING else that reads as a third dessert (NO mini round cake, NO center tart/macaron, NO fourth hidden wedge).
- Both slices sit on **ONE** small elegant plate (round or soft oval), same petal-cake DNA as Lv5: visible sponge + cream layers, floral/petal garnish — but **clearly fancier** than Lv5 (richer frosting, finer gold or pearl accent, more delicate sugar flower or petals — still readable merge icon).
- **Minimal extras**: at most ONE tiny berry cluster or TWO loose petals total if needed for color — **FORBIDDEN** scattered strawberries/blueberries everywhere, cream border rings, crowded garnish.

COMPOSITION:
- Calm layout: e.g. two slices slightly overlapping or side-by-side on plate; generous #FF00FF margin — plate + cakes use only part of frame, NOT edge-to-edge clutter.

PLATE SILHOUETTE (matting):
- Plate rim = ONE complete smooth closed curve — NO gaps, NO missing chunks on bottom, NO gray smudge touching outer edge — same rules as before.

MATTING-SAFE OUTLINE:
- FORBIDDEN thick dark contour; HAIRLINE colored edges per SHARED only.
""".strip(),
    7: """
LEVEL 7/8 — whole round flower cake. Single-tier round cake (3/4 view), smooth frosting, ring of roses on top, ribbon band — party centerpiece.
More grand than platter of pieces.
Frosting: outer cake silhouette = slightly deeper buttercream / blush pink edge, NOT a white sticker outline; sugar roses use saturated pink/coral — never #FF00FF on petals.
""".strip(),
    8: """
LEVEL 8/8 — two-tier floral cake. TWO stacked tiers, ornate piped borders, multiple sugar flowers, small decorative plaque shape (NO text, NO letters) — ultimate legendary dessert.
Most layers, most decoration, most saturated "premium bakery" look.
Same anti-white-outer-edge as DESSERT_GLOBAL: colored cake/frosting edge meets #FF00FF directly — no milky outer aura.
""".strip(),
}


def run_line(line: str, levels: list[int] | None = None) -> None:
    if line == "tea":
        category = "FLOWER TEA drink line (茶饮)"
        out_dir = f"{ASSETS}/drink_tea_nb2/for_review/1x1"
        prefix = "drink_tea"
        subjects = TEA_SUBJECTS
    elif line == "dessert":
        category = "FLOWER DESSERT pastry line (甜品)"
        out_dir = f"{ASSETS}/drink_dessert_nb2/for_review/1x1"
        prefix = "drink_dessert"
        subjects = DESSERT_SUBJECTS
    else:
        raise SystemExit(f"unknown line: {line}")

    os.makedirs(out_dir, exist_ok=True)
    if not os.path.isfile(GEN):
        print("Missing", GEN, file=sys.stderr)
        sys.exit(1)

    level_list = levels if levels is not None else list(range(1, 9))
    for idx, n in enumerate(level_list):
        if line == "tea":
            mid = TEA_GLOBAL + "\n\n"
        elif line == "dessert":
            mid = DESSERT_GLOBAL + "\n\n"
        else:
            mid = ""
        prompt = SHARED.format(category_title=category, n=n) + "\n\n" + mid + subjects[n]
        out = os.path.join(out_dir, f"{prefix}_{n}_nb2_1x1.png")
        print(f"\n=== {line} {n}/8 -> {out} ===", flush=True)
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
    print(f"\nDone {line}: {out_dir}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--line",
        choices=("tea", "dessert", "all"),
        default="all",
        help="Which line to generate (default: both)",
    )
    ap.add_argument(
        "--levels",
        type=str,
        default=None,
        help="Comma-separated levels 1-8 only (e.g. 4). Default: all levels.",
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
            if v < 1 or v > 8:
                raise SystemExit("--levels must be 1-8")
            levels.append(v)
        levels = sorted(set(levels))
    if args.line in ("tea", "all"):
        run_line("tea", levels=levels)
        if args.line == "all":
            time.sleep(SLEEP)
    if args.line in ("dessert", "all"):
        run_line("dessert", levels=levels)


if __name__ == "__main__":
    main()
