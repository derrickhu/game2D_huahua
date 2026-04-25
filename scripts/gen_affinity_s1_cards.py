#!/usr/bin/env python3
"""友谊卡 S1 单张生图脚本 — 篮球队长「小翼」/ 大明星「曜辰」各 12 张。

每张独立 1:1 NB2 出图，参考小诗卡的精度（384×384），落盘到：
  - 原图：../game_assets/huahua/assets/raw/affinity_cards/card_<type>_<idx>.png
  - 入库：minigame/subpkg_chars/images/affinity_cards/card_<type>_<idx>.png

生成完成后会自动等比缩放到 384 并写入工程目录。

使用方法（在仓库根执行）：
  python3 scripts/gen_affinity_s1_cards.py            # 生成 athlete + celebrity 全部 24 张
  python3 scripts/gen_affinity_s1_cards.py athlete    # 仅生成篮球队长 12 张
  python3 scripts/gen_affinity_s1_cards.py celebrity  # 仅生成大明星 12 张
  python3 scripts/gen_affinity_s1_cards.py celebrity 10,11,12   # 仅重生大明星指定卡

依赖：
  - gemini-image-gen skill（~/.cursor/skills/gemini-image-gen/scripts/generate_images.py）
  - 本机 7890 端口的 HTTPS 代理（已在 env 里写死）
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
ASSETS_RAW = REPO_ROOT.parent / "game_assets" / "huahua" / "assets" / "raw" / "affinity_cards"
DEST_DIR = REPO_ROOT / "minigame" / "subpkg_chars" / "images" / "affinity_cards"
GEN_SCRIPT = Path.home() / ".cursor" / "skills" / "gemini-image-gen" / "scripts" / "generate_images.py"
REF_DIR = REPO_ROOT / "minigame" / "subpkg_chars" / "images" / "customer"

# ---------------------------------------------------------------------------
# 通用风格 & 角色锚点
# ---------------------------------------------------------------------------

# 与小诗卡（card_student_*.png）保持同款笔触：柔和水彩风 anime、暖光、bloom、
# 大眼软线稿、笔刷高光、单张方形、无文字无边框无水印，质感、构图、留白都对齐。
STYLE_BASE = (
    "Single square 1:1 illustration in soft watercolor anime style, "
    "dreamy shoujo mobile-game card art, painterly textures with brushed highlights, "
    "warm pastel color palette, gentle bloom and warm rim light, "
    "expressive large anime eyes with soft highlights, thin clean brown line art, "
    "rich storybook composition with foreground subject, midground props and atmospheric background, "
    "polished collectible-card illustration quality, depth of field bokeh, "
    "very high detail level, painterly fabric folds and skin shading. "
    "Match the established friendship-card art direction of this project's existing cards. "
    "Compose as ONE single complete illustration filling the whole square; "
    "no grid, no panel split, no border decoration, no UI frame, no rarity badge. "
    "NO TEXT anywhere, no letters, no numbers, no captions, no logo, no watermark, no signature."
)

# 篮球队长：参考 customer_athlete.png 的脸型/发色/穿搭
CHAR_ATHLETE = (
    "Hero character: a very handsome high-school basketball team captain, "
    "short messy dark brown hair with soft fringe, healthy light-tan skin, "
    "bright lively warm-brown eyes, athletic lean build, charming confident smile, "
    "appealing star-of-the-team aura, blue-and-white varsity / jersey / warm-up styling, "
    "must look noticeably more handsome and cool than a generic sports boy. "
    "Same character across all twelve cards, consistent face."
)

# 大明星：参考 customer_celebrity.png 的金发卷发、琥珀眼、白衣气质
CHAR_CELEBRITY = (
    "Hero character: a stunning young male superstar singer at the height of his fame, "
    "glossy voluminous golden-blond curls framing the face, luminous amber eyes with sparkling highlights, "
    "fair smooth skin with a hint of blush, elegant slim graceful build, dazzling idol smile, "
    "obvious top-star aura, stylish high-fashion outfits in cream / white / champagne / black silks, "
    "delicate chain or earring accents, must look breathtakingly handsome and atmospheric. "
    "Same character across all twelve cards, consistent face."
)

# 稀有度气氛锚（前期日常 -> 后期高光）
RARITY_VIBE = {
    "N":   "Atmosphere: bright everyday charming moment, simple but pretty, soft daylight or warm street light.",
    "R":   "Atmosphere: more cinematic, richer props, warmer storytelling, stronger character connection.",
    "SR":  "Atmosphere: dramatic cinematic lighting, emotional payoff, beautiful color contrast, clearly an upgrade in visual impact.",
    "SSR": "Atmosphere: ultimate highlight scene, breathtaking lighting, sparkles / petals / spotlights, hero pose, must feel like the most stunning card in the whole set.",
}


def _card(idx: int, rarity: str, scene: str) -> dict:
    return {"idx": idx, "rarity": rarity, "scene": scene}


ATHLETE_CARDS = [
    _card(1, "N",
          "Scene: after basketball practice, the captain stands just outside a cozy pastel flower-shop window, "
          "a basketball tucked under one arm, warm sunset street light catching his fringe, "
          "he turns toward viewer and gives a charming relaxed smile."),
    _card(2, "N",
          "Scene: inside the flower shop, a clean white towel resting on his shoulder, "
          "cold drink left on the counter, he carefully selects a small bouquet for his coach, "
          "soft warm interior light, vases and ribbons around him."),
    _card(3, "N",
          "Scene: empty school basketball gym bleachers at dusk, painted purple-orange sky behind, "
          "he stands a few steps higher and waves toward the distant glowing flower shop, "
          "warm wind in his hair, sporty silhouette."),
    _card(4, "N",
          "Scene: pre-game encouragement, he holds a bright sunflower bouquet with both hands, "
          "determined eyes, soft sunlight streaming behind him, simple wooden flower-shop interior, "
          "captain aura, very handsome close-mid shot."),
    _card(5, "N",
          "Scene: a few teammates around him in the flower shop laughing and teasing, "
          "but he stays the visual focus in the foreground, slightly bashful yet composed, "
          "holding his payment phone forward, charming leader vibe."),
    _card(6, "N",
          "Scene: after rain and extra practice, slightly wet hair and damp varsity jacket, "
          "he steps into the shop with a stubborn warm smile asking for a 'never give up' bouquet, "
          "rainy reflections on the wooden floor, cool wet street outside."),
    _card(7, "R",
          "Scene: a beautiful trophy display case at home, golden cup, hanging medals, "
          "team flag and pennants, with a centered blue-and-white bouquet in the middle shelf, "
          "warm interior glow, more polished and sentimental composition. Character may be small or absent."),
    _card(8, "R",
          "Scene: locker room with open lockers, sports bags and basketball, "
          "he prepares a fresh green-and-white bouquet for an injured younger teammate, "
          "calm warm caring captain expression, soft side light from a high window."),
    _card(9, "R",
          "Scene: an old retiring coach holds a signed worn team jersey and a delicate bouquet together, "
          "the captain stands slightly behind smiling warmly, nostalgic gym hallway light, "
          "memorabilia photos faintly on the wall."),
    _card(10, "SR",
           "Scene: finals eve, cinematic empty indoor gym at night, polished wooden court reflecting overhead spotlights, "
           "he sits on the floor wrapping wrist tape while watching a bouquet ribbon being tied, "
           "quiet tense pre-match atmosphere, dramatic warm cool light contrast."),
    _card(11, "SR",
           "Scene: right after the final whistle, packed arena bleachers cheering in the background, "
           "bright stadium lights, he runs toward the viewer sweaty and glowing with a huge relieved smile, "
           "receives a celebration bouquet, confetti starting to fall, triumphant emotional payoff."),
    _card(12, "SSR",
           "Scene: ultimate championship night MVP moment, packed indoor basketball arena, "
           "giant scoreboard glowing in the background, golden confetti and ribbons raining down, "
           "single heroic spotlight on him at center court, he holds a championship trophy in one hand "
           "and a gorgeous championship bouquet in the other, arms slightly raised, "
           "stunning handsome face full of star-athlete aura, breathtaking cinematic key-art quality."),
]

CELEBRITY_CARDS = [
    _card(1, "N",
          "Scene: outside the cozy flower shop at dusk, the superstar wears a stylish sunglasses + white mask "
          "+ cream coat, half-turning back toward the viewer with smiling eyes, "
          "warm storefront window glow lighting one side of his face, secret-celebrity charm."),
    _card(2, "N",
          "Scene: by an open black nanny-van door at night, glittering city lights softly bokeh in background, "
          "he stands at the curb holding a wrapped bouquet up to check its colors, "
          "elegant pre-show mood, stylish outfit, gentle backstage warmth."),
    _card(3, "N",
          "Scene: rehearsal break sitting on the edge of a stage, dim auditorium behind, "
          "soft golden side light dusting his lashes, holds a bouquet and a cold drink, "
          "relaxed but magnetic look, casual stylish black-and-white outfit."),
    _card(4, "N",
          "Scene: in a dressing room with classic vanity mirror and warm bulbs, "
          "he leans in to arrange flowers into a small crystal vase beside makeup brushes, "
          "thoughtful calm expression, refined romantic beauty, soft mirror reflections."),
    _card(5, "N",
          "Scene: late-night recording studio, single warm desk lamp glowing on the mixing console, "
          "studio microphone and instruments faintly bokeh in background, he is seated at the desk wearing studio headphones already on his head, "
          "both hands resting gently on a bouquet of white lilies and champagne roses placed on the desk in front of him, "
          "head tilted slightly down with a soft tender smile, eyes half-closed listening, "
          "dreamy moody music atmosphere. IMPORTANT anatomy: exactly two hands total, both arms clearly visible from the shoulders, no extra hand or arm anywhere."),
    _card(6, "N",
          "Scene: just after the show, still in stage makeup with subtle sparkle on cheeks, "
          "he holds a large bouquet against his chest and looks back over the shoulder at the viewer from side stage, "
          "dark backstage with tiny twinkling lights and lingering smoke."),
    _card(7, "R",
          "Scene: a luxurious backstage fan-support flower wall covered in elegant bouquets, "
          "but his favorite bouquet from the flower shop stands centered on a podium and is highlighted by light, "
          "he stands beside it with a tender appreciative look, glamorous and affectionate."),
    _card(8, "R",
          "Scene: celebration party after his successful opening concert, "
          "soft luxurious chandelier lights and champagne glasses around, "
          "he raises a champagne-rose bouquet toward the viewer with a confident charming smile, "
          "stylish formal outfit, star afterglow."),
    _card(9, "R",
          "Scene: backstage close moment, he tucks a signed glossy stage photo into the bouquet wrapping with both hands, "
          "tender focused look, romantic celebrity-keepsake feeling, soft amber backstage light, "
          "stage gear and microphone case hint in background."),
    _card(10, "SR",
           "Scene: empty grand theater rehearsal at night, only a single column of top spotlights cutting through darkness, "
           "he stands alone center stage with a microphone, a white-and-gold bouquet placed at his feet, "
           "hauntingly beautiful silent stage, dramatic cinematic SR atmosphere."),
    _card(11, "SR",
           "Scene: one minute before encore, intense side-stage moment, "
           "he brushes a loose curl back from his forehead and accepts a single perfect rose, "
           "eyes deeply focused and bright, intimate pre-performance electricity, "
           "dim reddish stage glow leaking from beyond the curtain."),
    _card(12, "SSR",
           "Scene: ultimate concert climax, packed sea of fan light-sticks stretching to infinity, "
           "soft pink-white petals drifting through the air, brilliant key spotlight on the superstar at center stage, "
           "he sings powerfully into the microphone with one hand reaching outward, "
           "a breathtaking bouquet integrated into the scene (held, on the floor, or being thrown), "
           "stunning handsome face full of starlight, unforgettable idol stage hero shot, "
           "key-art-grade cinematic illustration."),
]

CARDS_BY_TYPE = {
    "athlete": (CHAR_ATHLETE, ATHLETE_CARDS, REF_DIR / "athlete.png"),
    "celebrity": (CHAR_CELEBRITY, CELEBRITY_CARDS, REF_DIR / "celebrity.png"),
}


def build_prompt(char_block: str, card: dict) -> str:
    return (
        f"{STYLE_BASE}\n\n{char_block}\n\n"
        f"{RARITY_VIBE[card['rarity']]}\n\n{card['scene']}\n\n"
        "Final reminder: ONE single square illustration, no UI, no border, no text, no rarity tag."
    )


def run_one(type_id: str, card: dict, char_block: str, ref: Path) -> bool:
    idx = card["idx"]
    raw_path = ASSETS_RAW / f"card_{type_id}_{idx:02d}.png"
    raw_path.parent.mkdir(parents=True, exist_ok=True)

    prompt = build_prompt(char_block, card)
    prompt_file = ASSETS_RAW / f"_prompt_{type_id}_{idx:02d}.txt"
    prompt_file.write_text(prompt, encoding="utf-8")

    cmd = [
        "python3", str(GEN_SCRIPT),
        "--prompt-file", str(prompt_file),
        "--output", str(raw_path),
        "--model", "gemini-3.1-flash-image-preview",
        "--aspect-ratio", "1:1",
        "--image-size", "1K",
    ]
    if ref.exists():
        cmd += ["--image", str(ref)]

    env = os.environ.copy()
    env.setdefault("HTTPS_PROXY", "http://127.0.0.1:7890")
    env.setdefault("HTTP_PROXY", "http://127.0.0.1:7890")
    env.setdefault("ALL_PROXY", "http://127.0.0.1:7890")
    env["GEMINI_IMAGE_FORCE_PROXY"] = "1"
    env["GEMINI_IMAGE_USE_REQUESTS"] = "1"

    print(f"[gen] {type_id} #{idx:02d} ({card['rarity']}) -> {raw_path.name}", flush=True)
    proc = subprocess.run(cmd, env=env, capture_output=True, text=True)
    ok = proc.returncode == 0 and raw_path.exists() and raw_path.stat().st_size > 5000
    if not ok:
        print(proc.stdout)
        print(proc.stderr, file=sys.stderr)
        return False

    deliver(type_id, idx, raw_path)
    return True


def deliver(type_id: str, idx: int, raw_path: Path) -> None:
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    dst = DEST_DIR / f"card_{type_id}_{idx:02d}.png"
    img = Image.open(raw_path).convert("RGBA")
    side = min(img.width, img.height)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    img = img.crop((left, top, left + side, top + side))
    img = img.resize((384, 384), Image.LANCZOS)
    img.save(dst, optimize=True)
    print(f"[deliver] {dst.relative_to(REPO_ROOT)} ({dst.stat().st_size // 1024} KB)")


def parse_indices(arg: str) -> list[int]:
    return [int(x) for x in arg.split(",") if x.strip()]


def main(argv: list[str]) -> int:
    target_types = list(CARDS_BY_TYPE.keys())
    only_indices: list[int] | None = None
    if len(argv) >= 2:
        target_types = [argv[1]]
    if len(argv) >= 3:
        only_indices = parse_indices(argv[2])

    if not GEN_SCRIPT.exists():
        print(f"找不到 gemini-image-gen 脚本: {GEN_SCRIPT}", file=sys.stderr)
        return 1

    fails: list[tuple[str, int]] = []
    for type_id in target_types:
        char_block, cards, ref = CARDS_BY_TYPE[type_id]
        for card in cards:
            if only_indices and card["idx"] not in only_indices:
                continue
            ok = False
            for attempt in range(2):
                if run_one(type_id, card, char_block, ref):
                    ok = True
                    break
                print(f"  ! retry {type_id} #{card['idx']:02d} (attempt {attempt + 1})")
                time.sleep(3)
            if not ok:
                fails.append((type_id, card["idx"]))
            time.sleep(1)

    if fails:
        print("\n以下卡未生成成功，请手动重跑：", file=sys.stderr)
        for t, i in fails:
            print(f"  - {t} #{i:02d}", file=sys.stderr)
        return 2
    print("\n全部完成。")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
