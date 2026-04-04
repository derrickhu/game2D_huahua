#!/usr/bin/env python3
"""
花店装修面板 UI — NB2 拆件；大面板空白壳用**纯白底**便于 rembg，小件仍用品红底。

参考图默认：game_assets/.../ui_prototypes/decoration_panel_bottom_sheet_prototype_nb2_portrait.png
（竖版、与游戏 9:16 画幅比例一致；横版旧稿见 decoration_panel_bottom_sheet_prototype_nb2.png。）
输出：game_assets/huahua/assets/deco_panel_ui_nb2/for_review/

大面板底图：`#FFFFFF` 外圈 + rembg — 立体可爱标题 + 身区按装修参考：左窄象牙带、右大暖 parchment/浅杏区（无痕交界），右侧平面、无凹槽内阴影；不画按钮/筛选/格子/家具。
其余拆件：品红底；无文字，游戏里叠字。
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time

GEN = os.path.expanduser("~/.cursor/skills/gemini-image-gen/scripts/generate_images.py")
MODEL = "gemini-3.1-flash-image-preview"
SLEEP = 8

from huahua_paths import game_assets_dir

ASSETS = game_assets_dir()
OUT_DIR = ASSETS / "deco_panel_ui_nb2/for_review"

DEFAULT_REF = str(ASSETS / "ui_prototypes/decoration_panel_bottom_sheet_prototype_nb2_portrait.png")

SHARED = """
REFERENCE IMAGE: the PROVIDED mockup is the portrait decoration bottom sheet (decoration_panel_bottom_sheet_prototype_nb2_portrait) — full-bleed bottom sheet (~lower half), NO heavy yellow double-gold frame. Palette: juicy peach-to-apricot / soft coral-pink header; accents in **milky blush pink** or **soft strawberry-cream** — **NO champagne gold**, **NO metallic yellow rim** on the main sheet. Main body warm ivory with faint peach tint; optional accents pastel only. Cozy merge-game pseudo-3D: soft diffuse shadow, inner highlights, recessed content well. IMPORTANT: avoid large sage / mint / olive green UI fields — do not echo renovation grass.

Match that mockup's saturation, warmth, and bevel language.

Draw ONLY the isolated asset below — not the full screen.

CHROMA: The separate “main panel blank” asset uses pure white #FFFFFF matting (see its block). All other small icons/buttons in this batch: flat #FF00FF outside the subject.

NO text (any language), NO numbers, NO watermark, NO callout circles. If the reference shows red rectangles or annotation boxes, IGNORE them — do not draw red boxes. Soft 3D, colored outlines, top-left highlights.
""".strip()

# 大面板空白壳单独用此段，避免与 SHARED 里「参考整屏原型 / 香槟金边」等描述冲突
SHARED_MAIN_PANEL_BLANK = """
GLOBAL — THIS ASSET ONLY:
Cute kawaii merge-game mobile UI: warm SATURATED soft pastels (juicy peach, strawberry-milk pink, apricot blush, warm cream — keep chroma sweet, NOT washed-out gray-beige, NOT desaturated dead UI). Stereoscopic but soft: smooth gradients, satin highlights, pillow/bevel language, diffuse shadows — cozy pseudo-3D like hit merge games, NOT flat Material slabs, NOT photoreal metal.

EMPTY SHELL: The game adds ALL text, sidebar pills, filter chips, and item cards later. Your image must be ONLY the background plate — large flat color regions plus lighting. NO drawn buttons, pills, tabs, filter bar, chip row under the title, grids, squares, sample icons, stars, prices, glyphs, watermarks, house/couch icons. NO inner inset frames, NO recessed “slot” panels with inner shadow, NO horizontal divider lines or hairlines on the body, NO extra top-left title bubbles (title is only the main salmon band).

NO gold, NO yellow chrome, NO metallic rim lines anywhere on this panel. Edge under title band = soft shadow + color blend only. Title salmon band: top corners must be heavily rounded (large radius bubble look), never a flat strip with only slight corner rounding.

MATTING: Every pixel outside the rounded panel = solid #FFFFFF. Zero peach/pink/coral spill into the outer margin — the white surround must stay perfectly neutral. Tight clean silhouette (1–2px AA only); no smoky gradient leaking into white. All shadows and 3D lighting stay INSIDE the panel shape only.
""".strip()


BODY_MAIN_PANEL_BLANK = """
ASSET: Portrait 9:16 empty flower-shop DECORATION bottom sheet — same cute merge-game look as the shipped furniture panel reference, but stripped to a clean plate: keep the outer rounded card + stereo salmon header; the body is only soft flat color fields. Full-bleed left/right/bottom; rounded top corners.

(1) TOP TITLE ZONE ONLY — full-width stereo cute header with SUPER-ROUNDED BUBBLY top geometry (the ONLY title chrome):
About 11–13% of canvas height. Salmon-peach / apricot pillow bar spanning full width. CRITICAL SHAPE: the header top-left and top-right corners MUST use a VERY LARGE border radius — deep smooth arcs, bubble-like capsule-cap cute (soft vertical card: orange top looks rounded and plump, NOT a stiff near-rectangle with tiny corner nibs). Maximum cute rounding on the top two corners; forbid “square strip with small rounded corners”. Top outer edge continuously curved and friendly like plush mobile bottom-sheet headers. Juicy gradient, white satin highlight along the top curve, soft shadow where salmon meets cream — volumetric, candy-like. No text. Do NOT add any extra title widget on the cream area (no small top-left pill bubble, no badge, no secondary title capsule).

(2) MAIN BODY BELOW HEADER — two soft flat color zones (like reference left rail + right block), no decoration:
LEFT RAIL ~9–11% width: warm ivory or soft warm gray-cream. Must be flat — no pills, no faux buttons, no floating shapes.

RIGHT BLOCK: warm parchment / light tan-cream, slightly deeper than the rail. Must be one continuous flat fill from the boundary to the panel’s inner right and bottom — no “picture frame”, no second nested rounded rectangle, no inner mat.

BOUNDARY between rail and block: smooth color step only — zero vertical stroke, zero groove.

(3) STRICT FORBIDDEN — the model keeps drawing these by mistake; do NOT include any of them:
- Any pill, capsule, lozenge, bubble, or chip shape anywhere on the body.
- Any inner inset panel, sunken tray, large recessed rectangle with inner shadow or inner highlight rim.
- Any horizontal rule, divider line, hairline, thin brown stroke, or “footer strip” separated by a line.
- Any double-border frame around a central content hole; any card-slot grid hints.
- Any extra 3D bevel loops inside the body (save stereo for the header + gentle whole-panel edge only).

(4) Whole panel: only the outer big rounded silhouette may have a whisper of edge depth; the interior body stays visually flat pastel fields.

(5) No grids, furniture, stars, prices, text, icons.

Quality bar: reads like the reference sheet with clutter removed — cute header, boring-clean flat body.
""".strip()


BODY_HEADER_RIBBON = """
ASSET: ONLY the header title strip from the same bottom sheet — wide band with ONE solid warm peach-coral or apricot fill (no horizontal gradient). Soft 3D pillow volume, lighter highlight along top inner edge, ONE thin warm champagne-gold hairline rim (single stroke), tiny shadow underneath separating from body.

Blank center — no text. No close button attached, no house icon, no roof or scene shapes.

Flat #FF00FF around the strip. Strip occupies ~35–50% of canvas height centered horizontally.
""".strip()


BODY_CLOSE_BTN = """
ASSET: ONLY the small circular CLOSE button matching the mockup — glossy coral-red or warm red disk (not neon), modest rim, decorative white X from two soft 3D bars (not typography).

~50–60% of canvas height centered. Nothing else. Background #FF00FF.
""".strip()


BODY_FURNITURE_CARD_BLANK = """
ASSET: ONE empty furniture item card template — portrait rounded rectangle, modest embossed lift, soft shadow under card, tiny white specular strip on top edge (cozy shop card).

Top-left: small blank rounded pill or tag for future rarity tint — absolutely no letters.

Center: large empty warm ivory / pale peach area for item art — blank or extremely subtle paper texture only.

Bottom: reserved empty strip for future price / status — no glyphs.

No lock, no checkmark, no furniture illustration. Single card only, centered with generous #FF00FF margin.
""".strip()


BODY_TAB_SELECTED = """
ASSET: ONE horizontal rounded pill — SELECTED tab background only: vibrant coral / warm orange / peach gradient with glossy highlight, pillow bevel — blank, no icons, no text. Do NOT use mint, teal, or sage green as the main fill.

~70% of canvas width centered, ~35–45% of canvas height. #FF00FF elsewhere.
""".strip()


BODY_TAB_INACTIVE = """
ASSET: ONE horizontal rounded pill — INACTIVE tab background: pale warm gray or light beige, subtle warm border, slight inner shadow, blank — no icons, no text.

Same proportions as selected tab. #FF00FF elsewhere.
""".strip()


BODY_DIVIDER = """
ASSET: ONE thin horizontal decorative divider — warm rose-taupe or soft champagne line, subtle emboss, optional tiny center dot ornament — NO text.

Spans ~85% of canvas width, vertically centered. Rest #FF00FF.
""".strip()


def _icon_body(subject: str) -> str:
    return f"""
ASSET: ONE small category icon ONLY — {subject}

Cute merge-game hand-painted icon style, soft 3D, warm outlines, bold readable silhouette at small size; accents compatible with peach-coral-cream UI (avoid mint/sage dominance). Centered, ~55–65% of canvas height. Flat #FF00FF background. NO text, NO label, NO circle plate unless the icon needs a soft colored backing squircle.

NO other UI chrome.
""".strip()


JOBS: list[tuple[str, str, str]] = [
    ("deco_nb2_main_panel_blank_9x16.png", "9:16", BODY_MAIN_PANEL_BLANK),
    ("deco_nb2_header_ribbon_16x9.png", "16:9", BODY_HEADER_RIBBON),
    ("deco_nb2_close_btn_1x1.png", "1:1", BODY_CLOSE_BTN),
    ("deco_nb2_furniture_card_blank_3x4.png", "3:4", BODY_FURNITURE_CARD_BLANK),
    ("deco_nb2_tab_selected_1x1.png", "1:1", BODY_TAB_SELECTED),
    ("deco_nb2_tab_inactive_1x1.png", "1:1", BODY_TAB_INACTIVE),
    ("deco_nb2_divider_16x9.png", "16:9", BODY_DIVIDER),
    ("deco_nb2_icon_room_1x1.png", "1:1", _icon_body("tiny cozy HOUSE / shop silhouette — room style category.")),
    ("deco_nb2_icon_shelf_1x1.png", "1:1", _icon_body("wooden FLOWER STAND / tiered plant shelf — shelf category.")),
    ("deco_nb2_icon_table_1x1.png", "1:1", _icon_body("small wooden COUNTER or TABLE — table category.")),
    ("deco_nb2_icon_light_1x1.png", "1:1", _icon_body("cute TABLE LAMP or hanging light — lighting category.")),
    ("deco_nb2_icon_ornament_1x1.png", "1:1", _icon_body("decorative VASE or potted ornament — decor category.")),
    ("deco_nb2_icon_wall_1x1.png", "1:1", _icon_body("empty PICTURE FRAME or wall plaque — wall decor category.")),
    ("deco_nb2_icon_garden_1x1.png", "1:1", _icon_body("small TREE sprout or garden arch — courtyard category.")),
]


def _ref_for_api(ref_path: str, max_side: int, cache_dir: str) -> str:
    """Shrink reference PNG to reduce base64 payload (avoids REST 400 on large multipart)."""
    os.makedirs(cache_dir, exist_ok=True)
    out = os.path.join(cache_dir, f"_ref_cache_{max_side}.png")
    try:
        st_src = os.stat(ref_path).st_mtime
        if os.path.isfile(out) and os.stat(out).st_mtime >= st_src:
            return out
        r = subprocess.run(
            ["sips", "-Z", str(max_side), ref_path, "--out", out],
            capture_output=True,
            text=True,
        )
        if r.returncode == 0 and os.path.isfile(out):
            print(f"  ref cache ({max_side}px): {out}", flush=True)
            return out
    except OSError as e:
        print("  sips resize skipped:", e, flush=True)
    return ref_path


def run_one(
    fname: str,
    ratio: str,
    body: str,
    model: str,
    ref_path: str,
    ref_max_side: int,
    use_ref: bool,
    fallback_model: str,
) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    if not os.path.isfile(GEN):
        print("Missing", GEN, file=sys.stderr)
        sys.exit(1)
    if use_ref and not os.path.isfile(ref_path):
        print("Reference not found:", ref_path, file=sys.stderr)
        sys.exit(1)

    if use_ref:
        api_ref = (
            _ref_for_api(ref_path, ref_max_side, OUT_DIR)
            if ref_max_side > 0
            else ref_path
        )
    else:
        api_ref = ref_path

    if fname == "deco_nb2_main_panel_blank_9x16.png":
        prompt = SHARED_MAIN_PANEL_BLANK + "\n\n" + body
    else:
        prompt = SHARED + "\n\n" + body
    out = os.path.join(OUT_DIR, fname)
    print(f"\n=== deco_panel_ui -> {out} ===", flush=True)
    print(f"  reference: {api_ref if use_ref else '(none)'}", flush=True)
    cmd = [
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
    if use_ref:
        cmd.extend(["-i", api_ref])

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        r = subprocess.run(cmd)
        if r.returncode == 0:
            return
        print(f"  FAILED (attempt {attempt}/{max_attempts})", flush=True)
        if attempt < max_attempts:
            wait = 60 * attempt
            print(f"  retrying in {wait}s...", flush=True)
            time.sleep(wait)

    if fallback_model and fallback_model != model:
        print(f"  fallback model: {fallback_model}", flush=True)
        cmd_fb = list(cmd)
        try:
            mi = cmd_fb.index("--model")
            cmd_fb[mi + 1] = fallback_model
        except ValueError:
            pass
        r = subprocess.run(cmd_fb)
        if r.returncode == 0:
            return

    raise RuntimeError(f"Image gen failed for {fname}")


def main() -> None:
    ap = argparse.ArgumentParser(description="NB2 split assets for flower shop decoration panel (chroma #FF00FF).")
    ap.add_argument(
        "--only",
        type=str,
        default=None,
        help="Prefix filter e.g. deco_nb2_bottom / deco_nb2_icon_room / deco_nb2_furniture",
    )
    ap.add_argument("--model", type=str, default=MODEL, help="Gemini image model (default NB2)")
    ap.add_argument(
        "--fallback-model",
        type=str,
        default="gemini-2.5-flash-image",
        help="After primary model exhausts retries, try this once (empty string to disable)",
    )
    ap.add_argument(
        "--ref",
        type=str,
        default=None,
        help=f"Reference full mockup PNG (default: {DEFAULT_REF})",
    )
    ap.add_argument("--sleep", type=float, default=SLEEP, help="Seconds between API calls")
    ap.add_argument(
        "--ref-max-side",
        type=int,
        default=512,
        help="Resize reference image so longest edge <= this (0 = use full-size ref; smaller avoids API 400)",
    )
    ap.add_argument(
        "--no-ref",
        action="store_true",
        help="Do not pass reference image (style-only; worse match)",
    )
    args = ap.parse_args()

    ref_path = args.ref or DEFAULT_REF
    use_ref = not args.no_ref
    ref_max = 0 if args.no_ref else args.ref_max_side
    jobs = list(JOBS)
    if args.only:
        jobs = [j for j in jobs if j[0].startswith(args.only)]
        if not jobs:
            print("Unknown --only prefix:", args.only, file=sys.stderr)
            sys.exit(1)

    failed: list[str] = []
    for idx, (fname, ratio, body) in enumerate(jobs):
        try:
            run_one(
                fname,
                ratio,
                body,
                args.model,
                ref_path=ref_path,
                ref_max_side=ref_max,
                use_ref=use_ref,
                fallback_model=(args.fallback_model or "").strip(),
            )
        except RuntimeError:
            failed.append(fname)
            print(f"  SKIP (will list at end): {fname}", flush=True)
        if idx < len(jobs) - 1:
            time.sleep(args.sleep)
    print(f"\nDone deco_panel_ui NB2 -> {OUT_DIR}", flush=True)
    if failed:
        print("FAILED files (re-run with --only prefix):", ", ".join(failed), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
