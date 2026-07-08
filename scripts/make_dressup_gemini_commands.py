#!/usr/bin/env python3
"""
生成一套分层换装的 Gemini/NB2 命令与拆层 prompt。

固定流程：
1. 先用 body_base.png 生成整套穿好的 design 图。
2. 再用 design 图，让 Gemini 对每个槽位做「原位拆层」。
3. 拆出的每张图必须仍是 9:16 全画布、部件保持穿在身上的位置。
4. 后续用 process_dressup_outfit_layers.py 抠底、统一到 432×768、导出 layer + thumb。

用法（仓库根）：
  python3 scripts/make_dressup_gemini_commands.py default_v2

生成：
  docs/prompt/dressup_default_v2_extract_<layer>_nb2_prompt.txt
  .tmp/dressup_default_v2_gemini_commands.sh

注意：本脚本只写 prompt 和命令，不直接访问 Gemini。
"""
from __future__ import annotations

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROMPT_DIR = ROOT / "docs/prompt"
COMMAND_DIR = ROOT / ".tmp"

DESIGN_TEMPLATE = PROMPT_DIR / "dressup_outfit_design_v2_nb2_prompt.txt"
EXTRACT_TEMPLATE = PROMPT_DIR / "dressup_outfit_extract_layer_v2_nb2_prompt.txt"

LAYERS = {
    "hair_bob_brown": "the complete warm light brown chin-length bob hair wig with bangs and the small pink flower hair clip; keep it exactly on the head position from Image 2",
    "top_pink_puff": "the light pink puff-sleeve blouse plus white pinafore apron with two pockets; keep it exactly wrapped around torso and sleeves from Image 2",
    "bottom_denim_skirt": "the dusty blue knee-length A-line skirt only; keep it exactly on the waist and legs from Image 2",
    "shoes_white_flats": "the white Mary Jane flats only, already worn on the feet; preserve the exact foot angle and position from Image 2",
    "makeup_blush_pink": "only the subtle rosy blush and tiny cheek sparkle overlay; keep cheek positions from Image 2",
    "acc_pearl_necklace": "only the short pearl necklace with tiny pink heart pendant; keep it exactly on upper chest from Image 2",
    "acc_star_earrings": "only the small golden star earrings; keep both earrings exactly on the ear positions from Image 2",
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("outfit_id", help="如 default_v2 / spring_rose")
    ap.add_argument("--body", default="../game_assets/huahua/assets/raw/dressup/body_base.png")
    ap.add_argument("--design-prompt", default=str(DESIGN_TEMPLATE.relative_to(ROOT)))
    args = ap.parse_args()

    outfit_id = args.outfit_id
    raw_dir = f"../game_assets/huahua/assets/raw/dressup/{outfit_id}"
    design_path = f"{raw_dir}/{outfit_id}_design.png"

    COMMAND_DIR.mkdir(parents=True, exist_ok=True)
    commands = [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "mkdir -p ../game_assets/huahua/assets/raw/dressup/%s" % outfit_id,
        "",
        "# 1) 整套穿好设计图：必须先验收这张，再拆层",
        "GEMINI_IMAGE_NO_PROXY=1 python3 ~/.cursor/skills/gemini-image-gen/scripts/generate_images.py \\",
        f"  --prompt-file {args.design_prompt} \\",
        f"  --image {args.body} \\",
        f"  --output {design_path} \\",
        "  --model gemini-3.1-flash-image-preview \\",
        "  --aspect-ratio 9:16 --image-size 1K",
        "",
        "# 2) 原位拆层：每个 layer 都只用整套 design 图作为参考，保持原位擦除其它层",
    ]

    template = EXTRACT_TEMPLATE.read_text(encoding="utf-8")
    for layer, desc in LAYERS.items():
        prompt = template.replace("<REPLACE_WITH_LAYER_NAME_AND_DESCRIPTION>", desc)
        prompt_path = PROMPT_DIR / f"dressup_{outfit_id}_extract_{layer}_nb2_prompt.txt"
        prompt_path.write_text(prompt, encoding="utf-8")
        out = f"{raw_dir}/{layer}.png"
        commands += [
            "",
            f"# {layer}",
            "GEMINI_IMAGE_NO_PROXY=1 python3 ~/.cursor/skills/gemini-image-gen/scripts/generate_images.py \\",
            f"  --prompt-file docs/prompt/{prompt_path.name} \\",
            f"  --image {design_path} \\",
            f"  --output {out} \\",
            "  --model gemini-3.1-flash-image-preview \\",
            "  --aspect-ratio 9:16 --image-size 1K",
            "sleep 5",
        ]

    commands += [
        "",
        "# 3) 抠底 + 入库处理",
        f"python3 scripts/process_dressup_outfit_layers.py {outfit_id}",
    ]

    cmd_path = COMMAND_DIR / f"dressup_{outfit_id}_gemini_commands.sh"
    cmd_path.write_text("\n".join(commands) + "\n", encoding="utf-8")
    print(f"wrote prompts for {len(LAYERS)} layers")
    print(f"commands: {cmd_path}")


if __name__ == "__main__":
    main()
