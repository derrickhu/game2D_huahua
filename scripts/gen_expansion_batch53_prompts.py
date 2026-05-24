#!/usr/bin/env python3
"""Batch 53: 20 ethereal guofeng furniture — new palettes/themes, more categories."""
from __future__ import annotations

import json
from pathlib import Path

WS = Path(__file__).resolve().parents[1]
PROMPT_DIR = WS / "docs" / "prompt"
CATALOG_MD = WS / "docs" / "furniture_expansion_batch53_catalog.md"
MANIFEST_JSON = WS / "docs" / "furniture_expansion_batch53_manifest.json"

STYLE_PREFIX = (
    "Square game asset 1:1. Single furniture prop centered with generous margin.\n\n"
    "Ethereal fairy-like Chinese guofeng furniture, airy dreamy xianxia mood, NOT heavy dark wood. "
    "Cute kawaii 2.5D isometric view from upper-left about 45 degrees, hand-painted mobile merge-game style. "
    "Light sandalwood or pale painted wood frames, soft pastel dream palette, translucent silk or frosted glass accents, "
    "delicate gold or silver filigree hints, gentle glow feeling, soft brown outlines, rounded chibi-friendly shapes, "
    "readable silhouette at small grid size."
)

STYLE_SUFFIX = (
    "\n\nAvoid dark mahogany, cinnabar lacquer, heavy imperial mood, photoreal. "
    "No text, no labels, no numbers, no watermark, no characters, no room shell. "
    "No ceiling-hanging lamp, no pendant light, no chandelier, no chain-suspended fixture.\n\n"
    "Background pure solid white #FFFFFF only for cutout."
)

ITEMS: list[dict] = [
    # ── 秋枫暖梦套：珊瑚橙 / 琥珀 / 浅枫红 ──
    {
        "id": "xianqi_maple_round_table",
        "name": "枫影圆几",
        "set": "秋枫暖梦套",
        "slot": "table",
        "scene": "tea_house",
        "level": 20,
        "cost": 760,
        "star": 3,
        "rarity": "fine",
        "palette": "pale birch wood round table, coral maple leaf inlay on top, amber tea cup pair",
        "subject": "A round low tea table in pale birch wood with coral-orange maple leaf inlay on the surface, two small amber tea cups, warm autumn fairy mood.",
    },
    {
        "id": "xianqi_maple_folding_chair",
        "name": "折扇游椅",
        "set": "秋枫暖梦套",
        "slot": "ornament",
        "scene": "tea_house",
        "level": 21,
        "cost": 680,
        "star": 3,
        "rarity": "fine",
        "palette": "light wood folding chair shaped like an open folding fan back, peach cushion, gold fan ribs",
        "subject": "A single lounge chair whose backrest mimics an open folding fan silhouette in pale wood with gold ribs, peach silk seat cushion, elegant portable seating.",
    },
    {
        "id": "xianqi_maple_incense_stand",
        "name": "香云几",
        "set": "秋枫暖梦套",
        "slot": "ornament",
        "scene": "tea_house",
        "level": 19,
        "cost": 620,
        "star": 2,
        "rarity": "common",
        "palette": "tiered pale wood incense stand, celadon burner, soft orange smoke curl",
        "subject": "A small tiered offering stand with celadon incense burner on top and gentle pastel smoke curl, maple-leaf motif carved on legs.",
    },
    {
        "id": "xianqi_maple_landscape_screen",
        "name": "秋山屏风",
        "set": "秋枫暖梦套",
        "slot": "wallart",
        "scene": "garden_villa",
        "level": 22,
        "cost": 920,
        "star": 4,
        "rarity": "fine",
        "palette": "four-panel screen, amber and coral maple mountain silk painting, cream wood frame",
        "subject": "A four-panel folding screen wall-art prop in isometric wall angle, silk panels painted with misty autumn maple mountains in coral and amber pastels, no calligraphy.",
    },
    {
        "id": "xianqi_maple_tier_shelf",
        "name": "果篮层架",
        "set": "秋枫暖梦套",
        "slot": "shelf",
        "scene": "flower_shop",
        "level": 20,
        "cost": 840,
        "star": 3,
        "rarity": "fine",
        "palette": "three-tier pale wood shelf, woven baskets with persimmon and pear, maple garland trim",
        "subject": "A three-tier display shelf with wicker baskets holding cute stylized persimmons and pears, maple leaf garland on top rail, harvest fairy pantry mood.",
    },
    # ── 寒梅雪境套：雪白 / 淡蓝 / 梅粉 ──
    {
        "id": "xianqi_plum_canopy_bed",
        "name": "寒梅纱床",
        "set": "寒梅雪境套",
        "slot": "ornament",
        "scene": "garden_villa",
        "level": 24,
        "cost": 1420,
        "star": 6,
        "rarity": "rare",
        "palette": "white-washed wood bed frame, icy blue and plum pink silk canopy, snowflake embroidery",
        "subject": "A fairy canopy bed with white-painted slender wood posts, layered icy-blue and plum-pink translucent silk curtains, subtle snowflake and plum blossom embroidery, winter dream bedroom.",
    },
    {
        "id": "xianqi_plum_wardrobe",
        "name": "雪白轻柜",
        "set": "寒梅雪境套",
        "slot": "shelf",
        "scene": "garden_villa",
        "level": 23,
        "cost": 1150,
        "star": 5,
        "rarity": "rare",
        "palette": "white lacquer-look wardrobe, silver plum branch inlay, pale blue handles",
        "subject": "A tall wardrobe in soft white painted wood with silver plum blossom branch inlay and pale blue cloud handles, airy winter boudoir storage not dark wood.",
    },
    {
        "id": "xianqi_plum_snow_basin",
        "name": "雪梅水钵",
        "set": "寒梅雪境套",
        "slot": "garden",
        "scene": "tea_house",
        "level": 22,
        "cost": 880,
        "star": 4,
        "rarity": "fine",
        "palette": "white stone basin, floating plum petals, pale blue water, silver rim",
        "subject": "A small stone water basin with pale blue water and floating pink plum petals, silver rim accent, serene winter garden water feature on ground.",
    },
    {
        "id": "xianqi_plum_snow_window",
        "name": "梅枝雪窗",
        "set": "寒梅雪境套",
        "slot": "wallart",
        "scene": "tea_house",
        "level": 21,
        "cost": 780,
        "star": 3,
        "rarity": "fine",
        "palette": "round moon window frame in white wood, plum branch and soft snow dots on frosted glass",
        "subject": "A round moon-gate window wall prop in isometric wall angle, white wood frame, frosted glass with plum branch and gentle snow motif, no text.",
    },
    {
        "id": "xianqi_plum_padded_stool",
        "name": "暖绒绣墩",
        "set": "寒梅雪境套",
        "slot": "ornament",
        "scene": "tea_house",
        "level": 20,
        "cost": 560,
        "star": 2,
        "rarity": "common",
        "palette": "round drum stool, plum pink velvet top, white wood base, silver tassel",
        "subject": "A round padded drum stool xiangdu in plum pink velvet on white wood base with small silver tassel, cozy winter seating.",
    },
    # ── 鎏金游鳞套：浅金 / 青碧 / 锦鲤橙 ──
    {
        "id": "xianqi_koi_stream_bridge",
        "name": "游鳞小桥",
        "set": "鎏金游鳞套",
        "slot": "garden",
        "scene": "garden_villa",
        "level": 25,
        "cost": 1280,
        "star": 5,
        "rarity": "rare",
        "palette": "pale jade-green stone bridge, gold rail inlay, orange koi shape under arch",
        "subject": "A short garden bridge with jade-green stone and soft gold rail inlay, simplified orange koi visible in water under the arch, twilight pond crossing accent.",
    },
    {
        "id": "xianqi_koi_pond_tea_table",
        "name": "临池茶台",
        "set": "鎏金游鳞套",
        "slot": "table",
        "scene": "garden_villa",
        "level": 24,
        "cost": 1080,
        "star": 4,
        "rarity": "fine",
        "palette": "low tea table beside miniature pond inset, gold-trim celadon tea set, teal water",
        "subject": "A low tea table integrated with a small side pond pool showing two cute koi, celadon tea set with gold trim on tabletop, waterside leisure table.",
    },
    {
        "id": "xianqi_koi_scale_cabinet",
        "name": "鱼鳞圆柜",
        "set": "鎏金游鳞套",
        "slot": "shelf",
        "scene": "garden_villa",
        "level": 23,
        "cost": 980,
        "star": 4,
        "rarity": "fine",
        "palette": "round drum cabinet, teal and gold fish-scale pattern doors, pale wood top",
        "subject": "A round drum-shaped storage cabinet with teal and soft gold fish-scale pattern on doors, compact decorative storage, fairy pavilion mood.",
    },
    {
        "id": "xianqi_koi_twin_stone_seat",
        "name": "双鲤石凳",
        "set": "鎏金游鳞套",
        "slot": "ornament",
        "scene": "garden_villa",
        "level": 22,
        "cost": 720,
        "star": 3,
        "rarity": "fine",
        "palette": "two pale stone stools with koi carving, teal cushion pads",
        "subject": "Two matching stone garden stools as one prop group, each carved with koi motif, soft teal cushion pads on top, pond-side seating pair.",
    },
    {
        "id": "xianqi_koi_wall_fountain",
        "name": "壁泉游鳞",
        "set": "鎏金游鳞套",
        "slot": "wallart",
        "scene": "garden_villa",
        "level": 24,
        "cost": 860,
        "star": 4,
        "rarity": "fine",
        "palette": "wall-mounted jade fountain panel, gold koi relief, trickling water stream",
        "subject": "A wall-mounted decorative water fountain panel in isometric wall angle, jade-green stone with gold koi relief and gentle water trickle, not a hanging lamp.",
    },
    # ── 竹烟兰月套：竹青 / 雾灰 / 幽兰紫 ──
    {
        "id": "xianqi_bamboo_mist_daybed",
        "name": "竹影卧榻",
        "set": "竹烟兰月套",
        "slot": "ornament",
        "scene": "butterfly_house",
        "level": 19,
        "cost": 1040,
        "star": 4,
        "rarity": "fine",
        "palette": "bamboo frame daybed, sage green silk mat, mist-gray sheer curtain at one end",
        "subject": "A bamboo-framed daybed couch with sage green silk mat and one end draped in mist-gray sheer curtain, morning bamboo pavilion lounge.",
    },
    {
        "id": "xianqi_bamboo_joint_desk",
        "name": "竹节书案",
        "set": "竹烟兰月套",
        "slot": "table",
        "scene": "butterfly_house",
        "level": 18,
        "cost": 800,
        "star": 3,
        "rarity": "fine",
        "palette": "bamboo segment legs desk, pale green paper scroll, jade paperweight",
        "subject": "A writing desk with bamboo-joint carved legs and pale top, rolled green-tinted paper and jade paperweight, misty bamboo study table.",
    },
    {
        "id": "xianqi_bamboo_book_tower",
        "name": "竹筒书塔",
        "set": "竹烟兰月套",
        "slot": "shelf",
        "scene": "butterfly_house",
        "level": 19,
        "cost": 900,
        "star": 4,
        "rarity": "fine",
        "palette": "stacked bamboo tube shelves spiraling up, blank cream books, orchid sprig on top",
        "subject": "A whimsical spiral bookshelf built from bamboo tubes stacked at angles, blank cream books inside tubes, tiny orchid sprig on top tier.",
    },
    {
        "id": "xianqi_bamboo_mist_fence",
        "name": "翠竹篱段",
        "set": "竹烟兰月套",
        "slot": "garden",
        "scene": "butterfly_house",
        "level": 18,
        "cost": 640,
        "star": 2,
        "rarity": "common",
        "palette": "fresh green bamboo fence segment, morning mist ribbon tied, small stone base",
        "subject": "A short bamboo garden fence segment with pale mist-gray ribbon tied on posts, fresh green stalks, outdoor fairy garden border.",
    },
    {
        "id": "xianqi_orchid_pavilion_mirror",
        "name": "兰月妆镜台",
        "set": "竹烟兰月套",
        "slot": "table",
        "scene": "garden_villa",
        "level": 21,
        "cost": 960,
        "star": 4,
        "rarity": "fine",
        "palette": "pale lavender wood vanity, orchid purple silk panel, round silver mirror, moon motif base",
        "subject": "A dressing vanity table in pale lavender-tinted wood with orchid purple silk back panel, round silver mirror, moon crescent carved on base, dreamy orchid pavilion boudoir.",
    },
]

RARITY_CN = {"common": "普通", "fine": "精良", "rare": "稀有", "limited": "限定"}
SLOT_CN = {
    "shelf": "花架", "table": "桌台", "light": "家电",
    "ornament": "摆件", "wallart": "墙饰", "garden": "庭院",
}
SCENE_CN = {
    "butterfly_house": "蝴蝶小屋", "tea_house": "茶香小院",
    "garden_villa": "花园别墅", "forest_treehouse": "橡树小屋", "flower_shop": "花店",
}


def build_prompt(item: dict) -> str:
    return (
        f"{STYLE_PREFIX}\n\n"
        f"Color and materials: {item['palette']}.\n\n"
        f"Subject: {item['subject']}\n"
        f"{STYLE_SUFFIX}"
    )


def write_catalog() -> None:
    lines = [
        "# 扩展家具批次 53 — 仙气梦幻古风（20 件 · 新配色主题）",
        "",
        "延续批次 52 画风：浅木 pastel、绢屏纱幔、仙气轻盈；本批换 **4 套全新配色与主题**，品类更杂。",
        "",
        "**不含悬吊式吊灯。** 未写入 DecorationConfig。",
        "",
        "原图：`../game_assets/huahua/assets/raw/furniture_expansion_batch53/`",
        "",
        "## 套装一览（4 套 × 5 件）",
        "",
    ]
    sets: dict[str, list[dict]] = {}
    for it in ITEMS:
        sets.setdefault(it["set"], []).append(it)
    for set_name, members in sets.items():
        lines += [f"### {set_name}", "",
                  "| id | 名称 | 槽位 | 场景 | 等级 | 花愿 | 星星 | 稀有度 |",
                  "|---|---|---|---|---:|---:|---:|---|"]
        for it in members:
            lines.append(
                f"| `{it['id']}` | {it['name']} | {SLOT_CN[it['slot']]} | {SCENE_CN[it['scene']]} | "
                f"{it['level']} | {it['cost']} | {it['star']} | {RARITY_CN[it['rarity']]} |"
            )
        lines.append("")
    slot_counts: dict[str, int] = {}
    for it in ITEMS:
        slot_counts[it["slot"]] = slot_counts.get(it["slot"], 0) + 1
    lines += [
        "## 汇总", "",
        f"- 合计：**{len(ITEMS)}** 件",
        f"- 花愿：**{min(i['cost'] for i in ITEMS)} – {max(i['cost'] for i in ITEMS)}**",
        f"- 槽位分布：{', '.join(f'{SLOT_CN[k]}×{v}' for k, v in sorted(slot_counts.items()))}",
        "",
    ]
    CATALOG_MD.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    assert len(ITEMS) == 20
    assert not [i for i in ITEMS if i["slot"] == "light"]
    PROMPT_DIR.mkdir(parents=True, exist_ok=True)
    for it in ITEMS:
        (PROMPT_DIR / f"furniture_{it['id']}_nb2_prompt.txt").write_text(
            build_prompt(it), encoding="utf-8"
        )
    MANIFEST_JSON.write_text(json.dumps(ITEMS, ensure_ascii=False, indent=2), encoding="utf-8")
    write_catalog()
    print(f"Wrote {len(ITEMS)} prompts; catalog={CATALOG_MD}")


if __name__ == "__main__":
    main()
