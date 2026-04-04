#!/usr/bin/env python3
"""
花店装修面板 UI — NB2 拆件（品红底），参考已定稿的整屏原型 PNG。

参考图默认：game_assets/.../ui_prototypes/decoration_panel_bottom_sheet_prototype_nb2_portrait.png
（竖版、与游戏 9:16 画幅比例一致；横版旧稿见 decoration_panel_bottom_sheet_prototype_nb2.png。）
输出：game_assets/huahua/assets/deco_panel_ui_nb2/for_review/

每张子图单独生成，便于品红抠图 / rembg 后拼层；无文字，游戏里叠字。
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
REFERENCE IMAGE: the PROVIDED mockup is the portrait decoration bottom sheet (decoration_panel_bottom_sheet_prototype_nb2_portrait) — full-bleed bottom sheet (~lower half), NO heavy yellow double-gold frame. Palette: juicy peach-to-apricot / soft coral-pink header strip with ONE thin warm champagne-gold hairline rim (single stroke, refined); main body warm ivory with a faint peach or blush tint (sunlit, not muddy gray-cream); hairline dividers in warm rose-taupe (not cold gray). Cozy merge-game pseudo-3D: soft upward diffuse shadow on the blurred scene, top inner highlight on the sheet, content well slightly recessed, tab pills pillow-bevel. IMPORTANT: avoid large sage / mint / olive green UI fields — do not echo renovation grass.

Match that mockup's saturation, warmth, and bevel language.

Draw ONLY the isolated asset below — not the full screen.

CHROMA: For small isolated icons/buttons: flat #FF00FF outside the subject. For the full 9:16 main panel blank asset: NO magenta void — use a short soft blurred flower-shop strip at the top if needed, then the panel full width; crisp edges only where the panel meets the scene.

NO text (any language), NO numbers, NO watermark, NO callout circles. If the reference shows red rectangles or annotation boxes, IGNORE them — do not draw red boxes. Soft 3D, colored outlines, top-left highlights.
""".strip()


BODY_MAIN_PANEL_BLANK = """
ASSET: ONE complete EMPTY shell of the flower-shop DECORATION bottom sheet — portrait mobile framing, aspect ratio 9:16, matching the REFERENCE image layout, color, corner radii, and proportions (panel ~lower two-thirds feel, full width, no side margins on the sheet).

Include ONLY structural chrome; everything interactive or content is stripped:

• TOP: wide header band — juicy peach-to-coral or apricot soft gradient, gentle 3D pillow volume, ONE thin warm champagne-gold hairline along the top edge (single stroke). Header must be completely blank — NO Chinese/English title, NO circular close button, NO icons.

• MAIN BODY: warm cream / pale ivory with faint peach tint; soft inner highlight along top lip of body, subtle upward diffuse shadow separating from blurred scene if a thin upper strip of background exists (~8–12% of height max).

• LEFT column ~20–25% of panel width: plain vertical zone (cream/peach-ivory). NO pill tabs, NO stacked buttons, NO text, NO icons — only empty space where tabs would sit.

• RIGHT area ~75–80%: ONE large inset rounded rectangle (slightly darker warm tan / beige than body) — the recessed grid viewport. Interior must be perfectly empty: NO furniture thumbnails, NO cards, NO stars, NO green CTAs, NO grid slot drawings, NO placeholder photos.

• FORBIDDEN: progress bar, “已收集” row, any numbers, any labels, red markup rectangles from the reference, watermarks.

• NO heavy yellow double-gold outer frame. Rounded top corners of the whole sheet (~large radius); bottom edge straight and flush to bottom of canvas.

Output is a clean UI illustration ready for engineers to overlay text and icons in code. Do NOT fill the viewport with chroma #FF00FF unless you must; prefer real beige/tan empty inset.
""".strip()


BODY_HEADER_RIBBON = """
ASSET: ONLY the header title strip from the same bottom sheet — wide peach-to-apricot or soft coral-pink gradient band, soft 3D pillow volume, lighter highlight along top, ONE thin warm champagne-gold hairline rim (single stroke), tiny shadow underneath separating from body.

Blank center — no text. No close button attached, no house icon.

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
