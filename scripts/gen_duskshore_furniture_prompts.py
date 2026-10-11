#!/usr/bin/env python3
"""40–43 级暮岸家具 + 汐岸阁楼专属：写 NB2 提示词。"""
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
    "Palette: pale oak, cream, dusk lilac, sage, butter yellow, coral, sea-glass aqua. "
    "Warm storybook flower-shop materials.\n\n"
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
    "Palette: pale oak, cream, dusk lilac, sage, butter yellow, coral, sea-glass aqua.\n\n"
)

SUFFIX = (
    "\nNo text, no numbers, no letters, no logo, no watermark, no people, no animal faces, "
    "no room, no walls, no floor plane, no drop-shadow strip.\n\n"
    "Background is pure solid white #FFFFFF."
)

ITEMS: list[dict[str, str]] = [
    {
        "id": "duskshore_star_cabinet",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a tall narrow pale-oak display cabinet. The arched crown is inlaid with tiny star-shaped shells. "
            "Glass doors show folded cream linens and one coral blossom on a shelf. Rounded sage knobs. Four short legs."
        ),
    },
    {
        "id": "duskshore_dusk_lamp",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a standing floor lamp. A twisted pale-oak post rises from a pebble foot. "
            "The shade is a dusk-lilac paper lantern shaped like a closed tulip, with a warm painted glow and a sprig of sage leaves."
        ),
    },
    {
        "id": "duskshore_bell_swag",
        "kind": "wall",
        "aspect": "4:3",
        "subject": (
            "Subject: a wall swag. A pale-oak rod slopes down toward the right. "
            "From it hang tiny shell bells, sage ribbons, and butter-yellow blossoms. The whole swag lies flat on the vertical wall."
        ),
    },
    {
        "id": "duskshore_float_table",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a low tea table in pale oak with curved legs. "
            "The tabletop is a shallow tray of still water holding three tiny glowing paper lanterns and one water lily. No fountain spray."
        ),
    },
    {
        "id": "duskshore_anemone_seat",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a round pouf seat. The cushion is a stylized sea anemone of soft coral and cream petals. "
            "The base is a low ring of pale pebbles. It sits on the floor."
        ),
    },
    {
        "id": "duskshore_bottle_charm",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a small tabletop charm. A sea-glass bottle lies in a tiny oak cradle, corked, with a rolled cream note that has no writing. "
            "A coral ribbon is tied at the neck. Feet are the cradle bottom."
        ),
    },
    {
        "id": "duskshore_vine_sofa",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a two-seat sofa. The frame is pale oak wrapped in living sage vines. "
            "Seat and back cushions are cream and dusk lilac. A few butter-yellow blossoms sit in the vine. Short oak legs."
        ),
    },
    {
        "id": "duskshore_firefly_lamp",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a small table lamp. A chunk of warm honey crystal glows inside a cage of thin oak twigs. "
            "It sits in a shallow cream shell dish. Feet are the dish bottom."
        ),
    },
    {
        "id": "duskshore_plank_shelf",
        "kind": "wall",
        "aspect": "4:3",
        "subject": (
            "Subject: a wall shelf made of one boat-wood plank. The plank top slopes down toward the right. "
            "On it sit a tiny fern, a sea-glass cup, and one coral shell. The shelf lies flat against the vertical wall."
        ),
    },
    {
        "id": "duskshore_tide_bed",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a low platform bed. The headboard is a wave of pale oak. "
            "Bedding is cream with a dusk-lilac throw and one coral cushion. A fern trails over one corner. Short legs."
        ),
    },
    {
        "id": "duskshore_coral_mirror",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a standing floor mirror. The frame is branching cream and coral, like soft coral twigs. "
            "The mirror glass is a tall rounded oval with a pale reflection of sky, no text. It stands on a small pebble foot."
        ),
    },
    {
        "id": "duskshore_compass",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a small tabletop compass. A round cream shell case holds a sage needle and a tiny star, with no letters and no numerals. "
            "It rests on a low oak stand. Feet are the stand bottom."
        ),
    },
    {
        "id": "tideloft_step_cushion",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a two-step floor cushion made for a short wooden stair. "
            "Two stacked pale-oak treads with cream pads, moss along the side, and tiny coral blossoms on the upper tread. It sits on the floor."
        ),
    },
    {
        "id": "tideloft_nest_lamp",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a standing floor lamp for a loft eave. A pale-oak post holds a woven reed nest. "
            "Inside the nest a warm cream lantern glows, with ferns and butter-yellow flowers around the rim. Pebble foot."
        ),
    },
    {
        "id": "tideloft_rail_seat",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a low loft-rail seat. A short pale-oak bench with a cream bolster, built as if it leans on a balcony rail. "
            "Sage vines and one coral bloom wrap one end. Short legs."
        ),
    },
    {
        "id": "tideloft_niche",
        "kind": "wall",
        "aspect": "1:1",
        "subject": (
            "Subject: a small wall niche. A rounded pale-oak alcove slopes down toward the right and lies flat on the vertical wall. "
            "Inside sit a tiny fern, a sea-glass cup, and one shell. No letters."
        ),
    },
    {
        "id": "tideloft_basket_table",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a tea table whose top is a shallow woven reed basket set into a pale-oak frame. "
            "Inside the basket are folded cream linen and a sprig of wildflowers. Four short oak legs."
        ),
    },
    {
        "id": "tideloft_moss_rug",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a thin flat oval floor rug, almost no thickness. "
            "Cream field with a soft moss-green center and a border of tiny fern leaves and pebble dots. It lies on the ground, not a cushion."
        ),
    },
    {
        "id": "tideloft_short_daybed",
        "kind": "floor",
        "aspect": "1:1",
        "subject": (
            "Subject: a short loft daybed, lower and deeper than a sofa. "
            "Pale-oak frame, cream mattress, dusk-lilac throw, and a canopy of only two fern fronds. It is not a four-poster bed."
        ),
    },
    {
        "id": "tideloft_fern_panel",
        "kind": "wall",
        "aspect": "1:1",
        "subject": (
            "Subject: a wall panel of pressed ferns in a thin pale-oak frame. "
            "The frame is a rounded parallelogram, taller than wide, top edge sloping down toward the right, lying flat on the vertical wall. "
            "Fern silhouettes only, no writing."
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
