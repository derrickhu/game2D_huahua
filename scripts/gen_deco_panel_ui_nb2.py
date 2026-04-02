#!/usr/bin/env python3
"""
花店装修面板 UI — NB2 拆件（品红底），参考已定稿的整屏原型 PNG。

参考图默认：game_assets/.../ui_prototypes/house_renovation_panel_prototype_nb2.png
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

DEFAULT_REF = str(ASSETS / "ui_prototypes/house_renovation_panel_prototype_nb2.png")

SHARED = """
REFERENCE IMAGE (small preview): same flower-shop DECORATION PANEL style — cream bottom sheet, golden bevel, salmon/mint accents, merge-game 3D UI. Match its colors, saturation, bevels, outline quality.

Draw ONLY the isolated asset below — not the full screen.

CHROMA: flat #FF00FF outside the subject. Crisp edge for matting. No #FF00FF inside shapes except a magenta "hole" if the prompt says so.

NO text (any language), NO numbers, NO watermark. Soft 3D, colored outlines, top-left highlights.
""".strip()


BODY_BOTTOM_SHEET = """
ASSET: Bottom decoration panel chrome for portrait mobile game — ONE horizontal plate only.

Shape: wide rounded rectangle filling the canvas width; ONLY the top-left and top-right corners are strongly rounded; bottom edge can be flat (flush to screen bottom) or slightly rounded — like a bottom sheet drawer.

Visual: thick golden-yellow beveled outer frame with glossy highlight; inner fill warm cream / ivory. LEFT zone ~18% width: vertical cream band with subtle inner shadow (empty category rail — no icons, no pills drawn). RIGHT zone ~82%: the main content area must be a SINGLE flat rectangular HOLE filled with solid #FF00FF — this is where the furniture card grid will be composited in code. The hole has rounded inner corners matching the panel.

NO furniture cards, NO grid lines, NO icons, NO ribbon, NO close button — panel body only. If a thin header ribbon area is visible at top of this crop, leave it blank cream or omit; prefer this asset to be ONLY the large sheet below any ribbon.

Subject should occupy most of the frame; margins outside the panel silhouette = #FF00FF.
""".strip()


BODY_HEADER_RIBBON = """
ASSET: ONLY a decorative salmon / coral-red folded ribbon banner (title bar) — 3D soft volume, gradient, shadow underneath, cute merge-game style.

Blank center — no text. Ends may fold behind. No house icon, no close button attached.

Flat #FF00FF around the ribbon. Ribbon occupies ~40–55% of canvas height centered.
""".strip()


BODY_CLOSE_BTN = """
ASSET: ONLY the small circular CLOSE button — chunky red glossy circle, thick rim, decorative white X made of two soft 3D bars (not typography).

~50–60% of canvas height centered. Nothing else. Background #FF00FF.
""".strip()


BODY_FURNITURE_CARD_BLANK = """
ASSET: ONE empty furniture item card template — portrait rounded rectangle, soft inner recessed well for future item art.

Top-left: small blank rounded "pill" or tag shape (for rarity color overlay) — absolutely no letters.

Center: large empty light area (cream / very pale gray) for item illustration — leave blank or extremely subtle paper texture only.

Bottom: reserved empty strip for future price / status text — no glyphs.

Soft drop shadow under card. No lock, no checkmark, no furniture drawing. Single card only, centered with generous #FF00FF margin.
""".strip()


BODY_TAB_SELECTED = """
ASSET: ONE horizontal rounded "pill" or capsule — SELECTED tab background only: vibrant coral-orange OR saturated mint-teal gradient, glossy highlight, blank — no icons, no text.

~70% of canvas width centered, ~35–45% of canvas height. #FF00FF elsewhere.
""".strip()


BODY_TAB_INACTIVE = """
ASSET: ONE horizontal rounded "pill" — INACTIVE tab background: pale beige / cream, subtle border, blank — no icons, no text.

Same proportions as selected tab. #FF00FF elsewhere.
""".strip()


BODY_DIVIDER = """
ASSET: ONE thin horizontal decorative divider line — warm tan / gold, subtle emboss, optional tiny center diamond or dot ornament — NO text.

Spans ~85% of canvas width, vertically centered. Height of line very small. Rest #FF00FF.
""".strip()


def _icon_body(subject: str) -> str:
    return f"""
ASSET: ONE small category icon ONLY — {subject}

Cute merge-game hand-painted icon style, soft 3D, colored outline, bold readable silhouette at small size. Centered, ~55–65% of canvas height. Flat #FF00FF background. NO text, NO label, NO circle plate unless the icon itself needs a soft colored backing squircle.

NO other UI chrome.
""".strip()


JOBS: list[tuple[str, str, str]] = [
    ("deco_nb2_bottom_sheet_16x9.png", "16:9", BODY_BOTTOM_SHEET),
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
