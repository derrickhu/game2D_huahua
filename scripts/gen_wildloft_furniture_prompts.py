#!/usr/bin/env python3
"""野檐花居 20 件：写 NB2 提示词。地面件锁 ±30° 网格，墙饰锁已验收墙面角。"""
from __future__ import annotations

from pathlib import Path

WS = Path(__file__).resolve().parents[1]
PROMPT_DIR = WS / "docs" / "prompt"

FLOOR = (
    "Square 1:1 game furniture asset. One single prop centered, generous white margin on all sides.\n\n"
    "Cute kawaii 2.5D true isometric furniture for a flower-shop merge game. "
    "Camera from upper-left into the L-room corner (same family as the room shell). "
    "On-screen top-face edges and base edges must sit near ±30° from horizontal — "
    "match the attached iso grid and room wall-base / floor diamond, NOT 45° wall slant, NOT flat front view. "
    "Height edges stay vertical. Visible top surface plus front-right side, left and right top edges symmetrically angled. "
    "Use the attached grid ONLY for perspective; do not copy the gray demo cube. "
    "The finished picture background is empty pure white. "
    "Leave out every grid line, graph-paper mark, blue line, and the gray cube.\n\n"
    "Hand-painted mobile merge-game flower shop style. Soft caramel-brown outlines slightly thicker than a hairline, "
    "rounded chibi-friendly shapes, upper-left light, gentle volume, readable silhouette at small size. "
    "Palette: pale oak, cream plaster, sage, butter yellow, coral blossom, sea-glass aqua. "
    "Warm storybook flower-shop materials, inventive coastal wildflower silhouette.\n\n"
)

WALL = (
    "Single wall-decoration asset, centered, generous white margin.\n\n"
    "Cute kawaii hand-painted flower-shop wall decor. "
    "The whole object lies flat on one vertical back wall and is parallel to that wall plane. "
    "The top edge slopes gently downward toward the right, about 30 degrees, matching the attached accepted wall-art reference. "
    "Do not use a floor-furniture diamond top. Do not draw a front-facing poster. "
    "Do not copy the reference subject; copy only its wall angle. "
    "The finished picture background is empty pure white.\n\n"
    "Soft caramel-brown outlines, rounded shapes, upper-left light, high-key pastel, readable silhouette. "
    "Palette: pale oak, cream, sage, butter yellow, coral blossom, sea-glass aqua.\n\n"
)

SUFFIX = (
    "\nNo text, no numbers, no letters, no logo, no watermark, no people, no animal faces, "
    "no room, no walls, no floor plane, no drop-shadow strip.\n\n"
    "Background is pure solid white #FFFFFF."
)

ITEMS: list[dict[str, str]] = [
    {
        "id": "wildloft_reed_daybed",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a low daybed. The canopy is a half-moon woven reed shell, not a four-poster bed. "
            "Cream cushions, tiny butter-yellow and coral wildflowers tucked into the reed weave, short pale-oak legs."
        ),
    },
    {
        "id": "wildloft_shell_table",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a small round side table. The tabletop is one spiral mother-of-pearl shell in cream and blush. "
            "Three pale-oak legs. A tiny sea-glass cup holding one fern sits on the shell."
        ),
    },
    {
        "id": "wildloft_tidepool_globe",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a small tabletop glass sphere resting on a ring of smooth pale pebbles. "
            "Inside the sphere is a miniature tide pool of stylized flower-anemones in coral, aqua, and butter yellow, "
            "plus a tiny petal starfish. Feet are the pebble ring at the bottom."
        ),
    },
    {
        "id": "wildloft_drift_bench",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a two-seat bench. The seat is one wave-curved honey-oak driftwood plank. "
            "The low back is a reed rail with a strip of moss and coral blossoms. Feet are two smooth pebble clusters."
        ),
    },
    {
        "id": "wildloft_pebble_lamp",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a standing floor lamp. The stem is a stack of smooth cream and gray-green pebbles. "
            "The shade is an open clam shell of frosted cream glass with a warm painted glow. A small fern curls at the base."
        ),
    },
    {
        "id": "wildloft_sanddollar_rug",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a thin flat oval floor rug lying on the ground, almost no thickness. "
            "Cream field, a large sand-dollar radial pattern in sage and butter yellow, a border of tiny pebble dots. "
            "It is a rug, not a cushion and not a standing disc."
        ),
    },
    {
        "id": "wildloft_press_cabinet",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a tall narrow pale-oak cabinet with two glass doors. "
            "Inside, botanical press sheets show only colorful wildflower silhouettes, with a sage inner back. "
            "Rounded pastel knobs. No writing on the sheets."
        ),
    },
    {
        "id": "wildloft_fern_chair",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: an armchair whose back and hood are one giant unfurling fern frond in fresh green. "
            "The seat is a round moss-green cushion. Short pale-oak legs."
        ),
    },
    {
        "id": "wildloft_coral_rack",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a standing coat rack shaped like branching warm-coral and cream coral. "
            "Hooks are little shell cups. A straw sun hat and a sage linen scarf hang on two hooks."
        ),
    },
    {
        "id": "wildloft_seaglass_lamp",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a standing floor lamp with a twisted pale-oak vine pole. "
            "A cluster of sea-glass teardrops in aqua, honey, and blush hangs from the top like a glowing mobile. "
            "The pole stands on a small pebble foot."
        ),
    },
    {
        "id": "wildloft_window_seat",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a freestanding window-seat bench with a low back, sage and cream cushions, "
            "and a flower box on each arm overflowing with ferns, buttercups, and coral blooms. "
            "No window and no wall attached to it."
        ),
    },
    {
        "id": "wildloft_kelp_swag",
        "kind": "wall",
        "aspect": "4:3",
        "subject": (
            "Subject: a wall garland. A driftwood rod is the top edge and slopes down toward the right. "
            "From it hangs a swag of kelp-green ribbons, sage leaves, and butter-yellow wildflowers. "
            "The whole garland lies flat on the vertical wall."
        ),
    },
    {
        "id": "wildloft_mosaic_panel",
        "kind": "wall",
        "aspect": "1:1",
        "subject": (
            "Subject: a wall panel of irregular sea-glass tiles in aqua, cream, blush, and honey, "
            "forming one abstract flower. Thin pale-oak border. "
            "The top edge slopes down toward the right. The panel lies flat on the vertical wall."
        ),
    },
    {
        "id": "wildloft_oyster_stool",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a round stool. The seat is an open oyster-shell cushion in pearl cream with a soft pink interior. "
            "Three short coral-colored legs."
        ),
    },
    {
        "id": "wildloft_salt_lamp",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a small table lamp. A chunk of pale-pink salt crystal glows warm and sits in a shallow cream shell dish. "
            "The feet are the bottom of the dish."
        ),
    },
    {
        "id": "wildloft_rose_screen",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a freestanding three-panel folding screen in thin pale oak. "
            "Living climbing wild roses in coral, cream, and butter yellow grow across the panels as real vines and blossoms. "
            "Show the panels receding in isometric view. It stands on the floor."
        ),
    },
    {
        "id": "wildloft_shell_clock",
        "kind": "wall",
        "aspect": "1:1",
        "subject": (
            "Subject: a wall clock made of concentric cream and blush shells. "
            "Blank shell face with two simple petal-shaped hands and no numerals. "
            "Match the attached frame: the outer rim is a rounded parallelogram, taller than it is wide, "
            "top edge sloping down toward the right, whole clock lying flat on the vertical wall."
        ),
    },
    {
        "id": "wildloft_hammock_chair",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a freestanding hammock chair. Pale-oak A-frame stands on the floor. "
            "A woven reed pod is the seat. A trailing vine of coral and cream flowers wraps one leg. "
            "It is not hanging from a ceiling."
        ),
    },
    {
        "id": "wildloft_eave_box",
        "kind": "wall",
        "aspect": "4:3",
        "subject": (
            "Subject: a wall-mounted pale-oak flower box on a small bracket. "
            "It overflows with ferns, moss, butter-yellow blossoms, and coral wildflowers. "
            "The box top edge slopes down toward the right. The planter lies flat against the vertical wall."
        ),
    },
    {
        "id": "wildloft_pearl_table",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a showpiece tea table in pale oak with four curved legs. "
            "The tabletop holds a shallow round basin of still water, pearl-like beads, and one small water lily. "
            "No fountain spray."
        ),
    },
]


def main() -> None:
    PROMPT_DIR.mkdir(parents=True, exist_ok=True)
    if len(ITEMS) != 20:
        raise SystemExit(f"expected 20 items, got {len(ITEMS)}")
    ids = [it["id"] for it in ITEMS]
    if len(set(ids)) != 20:
        raise SystemExit("duplicate ids")
    for it in ITEMS:
        body = (WALL if it["kind"] == "wall" else FLOOR) + it["subject"] + SUFFIX
        path = PROMPT_DIR / f"furniture_{it['id']}_nb2_prompt.txt"
        path.write_text(body.strip() + "\n", encoding="utf-8")
        print(path.name)
    print(f"wrote {len(ITEMS)} prompts")


if __name__ == "__main__":
    main()
