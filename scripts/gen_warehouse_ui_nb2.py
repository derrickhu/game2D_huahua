#!/usr/bin/env python3
"""
仓库弹窗 — 花篮 UI 拆件 NB2 品红底生图（与 board_ui_nb2 同目录体系）。

输出：game_assets/huahua/assets/warehouse_ui_nb2/for_review/
- 每张子图单独生成，便于 rembg/品红抠图后拼接。
- 中间内容面板：纯色、无格子（格子在程序里画，类似棋盘）。

可选整图原型（旧）：--only full

默认模型：gemini-3.1-flash-image-preview
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
OUT_DIR = f"{ASSETS}/warehouse_ui_nb2/for_review"

SHARED = """
Game UI texture asset for a cozy flower-shop MERGE mobile game (warehouse / storage popup).
Flat solid #FF00FF magenta background ONLY (chroma key) — every pixel outside THIS ASSET'S subject must be exactly #FF00FF.
NO checkerboard, NO gray backdrop, NO gradient outside subject.

HARD EDGE FOR MATTING:
- Crisp silhouette against chroma; no semi-transparent fringe into magenta.
- Opaque cel / soft-3D merge-game paint.

ART STYLE (match project board UI / order panel):
- BOLD saturated colors, soft gradients INSIDE shapes, highlight top-left on volumes.
- Hairline to medium-soft COLORED outlines — NOT heavy black comic ink.
- Cute polished casual merge-game UI.

FORBIDDEN on painted subject: chroma #FF00FF inside UI shapes (except where prompt explicitly asks for a magenta "window hole").
NO readable text — NO Chinese, NO English, NO numbers (blank areas for overlay).
""".strip()

# 旧：单张整屏原型（可选 --only full / --with-full-panel）
BODY_FULL_PANEL = """
ONE vertical mobile-game POPUP UI frame shaped like an OPEN WICKER / RATTAN FLOWER BASKET (cozy flower shop merge game).

OUTER SILHOUETTE: Large woven basket forms the left, right, and bottom edges — braided rim with pink roses, white baby's breath, green leaves; optional peach-coral satin bow. Basket cradles inner content.

INNER CONTENT PANEL: Big warm cream rounded card with subtle light floral watermark; EMPTY grid about 5x4 with VERY faint cell guides (legacy full mock only).

TOP: Lavender title tab BLANK. Top-right small circular close BLANK red circle.

VIP: Golden-orange banner — hex placeholder left, green pill right BLANK.

INSTRUCTION strip BLANK. Large lime-green organize pill BLANK. Bottom segmented orange + terracotta BLANK.

ART: Bold saturated merge-game UI, soft 3D, colored outlines. No #FF00FF on subject except unused outer BG.

BACKGROUND: Every pixel outside the painted UI must be flat solid #FF00FF ONLY.
""".strip()

# 参考图简化版整屏（去掉关闭钮、黄条、格线、底绿钮与底部分段条）
BODY_PANEL_V2_FROM_REF = """
The REFERENCE IMAGE is attached. It is the same cozy merge-game warehouse UI: wicker flower basket frame, magenta chroma background, lavender header, cream center, lavender footer strip, floral decorations and peach bows.

TASK: Regenerate ONE new image in the SAME art style, colors, lighting, wicker texture, and composition — but apply these edits:

REMOVE completely (do not paint):
- The top-right circular close button (red / wooden ring with X).
- The entire golden-yellow horizontal VIP bar directly under the purple header (including the hexagonal gold frame on the left AND the small green pill button on the right).
- Inside the large cream panel: ALL grid lines, ALL cell outlines, ALL rounded-square tile slots, ALL inner shadows that suggest cells — the center must be ONE flat, uniform warm cream / ivory surface (same rounded outer rectangle as reference), solid fill, no pattern that reads as a grid. Optional extremely subtle paper noise only.
- The large glossy lime-green pill button on the wicker base below the cream panel.
- The bottom horizontal bar that is orange on the left and dark red on the right (progress / segmented control).

KEEP as in reference:
- Full wicker basket frame, handle, braided edges, pink roses, white small flowers, green leaves, peach ribbon bows.
- Top lavender / purple rounded header bar (blank, no text).
- The thin lavender / purple strip directly below the cream panel (instruction/footer bar) — keep it above where the green button was.
- Solid flat #FF00FF magenta everywhere outside the UI silhouette (chroma key).

NO new UI elements. NO text anywhere. Same bold saturated merge-game polish as reference.
""".strip()

JOBS: list[tuple[str, str, str]] = [
    (
        "warehouse_nb2_close_btn_1x1.png",
        "1:1",
        """
ONLY the small circular CLOSE control — nothing else.

Design: chunky wooden / wicker-textured thick ring (warm brown) around a recessed red circular center.
Center: bold decorative white "X" made of two soft 3D bars crossing (merge-game icon style) — NOT typography, just a chunky X shape.
Soft specular highlight on wood ring top-left.
Subject ~55% of canvas height, centered; generous #FF00FF margin on all sides.
NO other UI, NO basket, NO panel.
""".strip(),
    ),
    (
        "warehouse_nb2_slot_lock_1x1.png",
        "1:1",
        """
ONLY one cute PADLOCK icon — inventory "locked warehouse slot" symbol. Nothing else.

Design:
- Warm antique BRASS / BRONZE metal padlock, soft 3D merge-game volumes, light specular highlight top-left on shackle and body.
- Closed rounded U-shaped shackle + chunky rounded rectangular body below.
- Small decorative KEYHOLE shape on the body (simple silhouette, not text).
- Hairline to medium-soft COLORED outlines (warm brown / gold), NOT heavy black comic ink.

FORBIDDEN: NO blue box, NO isometric crate, NO treasure chest, NO satin ribbon sheet, NO fog tile, NO grid, NO UI chrome.
Subject ~52% of canvas height, centered; generous flat #FF00FF margin on all sides.
NO readable text, NO numbers, NO Chinese, NO English.
""".strip(),
    ),
    (
        "warehouse_nb2_title_tab_16x9.png",
        "16:9",
        """
ONLY one horizontal LAVENDER / soft purple rounded TITLE TAB banner — wide pill with slightly scalloped or domed top edge.

Flat blank center for title overlay later. Soft 3D bevel, light highlight top edge.
NO text. NO close button. NO basket.
Wide strip ~35% of canvas height, centered horizontally; #FF00FF above and below strip.
""".strip(),
    ),
    (
        "warehouse_nb2_vip_bar_16x9.png",
        "16:9",
        """
ONLY one horizontal VIP strip — golden yellow to warm orange gradient, rounded rectangle, soft 3D merge-game bar.

LEFT: embossed golden HEXAGON frame / medal outline (empty center, no icon inside).
RIGHT: small bright lime-green glossy PILL button (blank, no text), same style as merge-game UI.
Single isolated strip; generous #FF00FF margin top and bottom. NO basket, NO grid, NO title tab.
""".strip(),
    ),
    (
        "warehouse_nb2_inner_panel_1x1.png",
        "1:1",
        """
ONLY one INNER CONTENT PANEL for a warehouse grid — this will sit BEHIND programmatic cell lines (like the game board).

CRITICAL — MUST FOLLOW:
- Fill is ONE uniform flat warm cream / ivory color (#FFF8F0 to #FFFAF3) across the whole rounded rectangle.
- Absolutely NO grid lines, NO cells, NO squares, NO tile pattern, NO faint dividers, NO embossed grid, NO table lines.
- Optional: extremely subtle paper noise barely visible; NO floral watermark, NO stars, NO decorative pattern that reads as a grid.

Large soft-rounded rectangle ~80% of canvas width and height, centered; even #FF00FF margin around it.
Soft gentle outer shadow or thin warm border on the cream shape is OK; interior must read as SOLID clean fill.
NO buttons, NO basket, NO flowers on this asset.
""".strip(),
    ),
    (
        "warehouse_nb2_instruction_strip_16x9.png",
        "16:9",
        """
ONLY one horizontal soft purple-pink translucent INSTRUCTION strip — wide low rounded rectangle, frosted glass feel, completely BLANK.

Soft 3D merge-game UI. NO text. NO grid. NO basket.
Strip ~22% of canvas height, centered; #FF00FF above and below.
""".strip(),
    ),
    (
        "warehouse_nb2_organize_btn_16x9.png",
        "16:9",
        """
ONLY the large bottom PRIMARY action: wide LIME / apple-green glossy pill button (blank) sitting in a warm BROWN WOODEN recessed tray / frame (carved slot).

Green pill has strong glassy highlight on upper half (merge-game candy button). Wood frame wraps bottom and sides of the pill slightly.
NO text on green pill. NO grid. NO basket body, NO toggle segments.
Subject centered; comfortable #FF00FF margin.
""".strip(),
    ),
    (
        "warehouse_nb2_bottom_toggle_16x9.png",
        "16:9",
        """
ONLY the bottom SEGMENTED TOGGLE bar: two adjacent rounded capsules — LEFT warm orange (selected glow), RIGHT dark brick-red / terracotta — both completely BLANK (no text).

Soft 3D merge-game segmented control. Slight gap or seam between segments OK.
NO green organize button, NO wood tray, NO basket.
Wide bar ~25% canvas height, centered; #FF00FF margin.
""".strip(),
    ),
    (
        "warehouse_nb2_basket_frame_9x16.png",
        "9:16",
        """
WICKER / RATTAN FLOWER BASKET window FRAME only — for compositing over a separate inner panel.

CRITICAL COMPOSITING HOLE:
- The CENTER must be a large perfect RECTANGLE of flat solid #FF00FF ONLY (same chroma as background) — this is the "window" where the code will place the cream panel + drawn grid.
- The basket forms ONLY: woven rim, side walls, bottom curve, top handle, braided texture; corners decorated with pink roses, baby's breath, green leaves; large soft pink satin ribbon bows at lower left and lower right corners (optional).
- Do NOT paint any cream panel, grid, or UI bars inside the hole — ONLY #FF00FF in that central rectangle (full transparency target).

The magenta hole should occupy roughly 55–65% of canvas width and 50–58% of canvas height, centered horizontally, slightly above vertical center (room for bottom buttons drawn separately).

NO text anywhere. NO close button on this asset (separate asset). NO VIP bar inside hole.
Outer margin: basket weave and flowers are opaque; beyond basket edge = #FF00FF.
""".strip(),
    ),
]


def _default_ref_path() -> str | None:
    candidates = [
        os.path.join(OUT_DIR, "warehouse_flower_basket_panel_nb2_9x16.png"),
        os.path.expanduser(
            "~/.cursor/projects/Users-huyi-rosa-games-huahua/assets/"
            "warehouse_flower_basket_panel_nb2_9x16-a98348f9-4980-4420-9669-0ff3aca638cd.png"
        ),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    return None


def run_one(
    fname: str,
    ratio: str,
    body: str,
    model: str,
    ref_path: str | None = None,
) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    if not os.path.isfile(GEN):
        print("Missing", GEN, file=sys.stderr)
        sys.exit(1)

    prompt = SHARED + "\n\n" + body
    out = os.path.join(OUT_DIR, fname)
    print(f"\n=== warehouse_ui -> {out} ===", flush=True)
    if ref_path:
        print(f"  reference: {ref_path}", flush=True)
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
    if ref_path:
        cmd.extend(["-i", ref_path])
    r = subprocess.run(cmd)
    if r.returncode != 0:
        sys.exit(r.returncode)


def run_panel_v2(model: str, ref_path: str | None) -> None:
    ref = ref_path or _default_ref_path()
    if not ref or not os.path.isfile(ref):
        print(
            "panel-v2 needs a reference PNG. Place warehouse_flower_basket_panel_nb2_9x16.png in:\n  "
            + OUT_DIR
            + "\n or pass:  --ref /path/to/reference.png",
            file=sys.stderr,
        )
        sys.exit(1)
    run_one(
        "warehouse_flower_basket_panel_nb2_v2_9x16.png",
        "9:16",
        BODY_PANEL_V2_FROM_REF,
        model,
        ref_path=ref,
    )
    print(f"\nDone panel v2 -> {OUT_DIR}/warehouse_flower_basket_panel_nb2_v2_9x16.png", flush=True)


def run(which: str | None, model: str, include_full: bool) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    if not os.path.isfile(GEN):
        print("Missing", GEN, file=sys.stderr)
        sys.exit(1)

    jobs = list(JOBS)
    if include_full:
        jobs.insert(
            0,
            (
                "warehouse_flower_basket_panel_nb2_9x16.png",
                "9:16",
                BODY_FULL_PANEL,
            ),
        )

    if which:
        if which == "full":
            jobs = [
                (
                    "warehouse_flower_basket_panel_nb2_9x16.png",
                    "9:16",
                    BODY_FULL_PANEL,
                )
            ]
        else:
            jobs = [j for j in jobs if j[0].startswith(which)]
            if not jobs:
                print("Unknown --only", which, file=sys.stderr)
                print("Try prefix: warehouse_nb2_close / warehouse_nb2_slot_lock / warehouse_nb2_title / warehouse_nb2_vip / warehouse_nb2_inner / warehouse_nb2_instruction / warehouse_nb2_organize / warehouse_nb2_bottom_toggle / warehouse_nb2_basket / full", file=sys.stderr)
                sys.exit(1)

    for idx, (fname, ratio, body) in enumerate(jobs):
        run_one(fname, ratio, body, model, ref_path=None)
        if idx < len(jobs) - 1:
            time.sleep(SLEEP)
    print(f"\nDone warehouse_ui NB2 -> {OUT_DIR}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--only",
        type=str,
        default=None,
        help="Prefix e.g. warehouse_nb2_close / warehouse_nb2_inner / full",
    )
    ap.add_argument(
        "--with-full-panel",
        action="store_true",
        help="Also generate legacy single 9:16 full mock (first in queue)",
    )
    ap.add_argument(
        "--model",
        type=str,
        default=MODEL,
        help=f"Gemini image model (default: {MODEL} = NB2)",
    )
    ap.add_argument(
        "--panel-v2",
        action="store_true",
        help="Generate simplified full panel from reference (removes close, VIP bar, grid, bottom buttons). Uses default NB2 model; pass --ref if needed.",
    )
    ap.add_argument(
        "--ref",
        type=str,
        default=None,
        help="Reference PNG for --panel-v2 (default: warehouse_flower_basket_panel_nb2_9x16.png in for_review)",
    )
    args = ap.parse_args()
    if args.panel_v2:
        run_panel_v2(args.model, args.ref)
        return
    run(args.only, args.model, args.with_full_panel)


if __name__ == "__main__":
    main()
