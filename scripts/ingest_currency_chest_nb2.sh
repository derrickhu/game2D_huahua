#!/usr/bin/env bash
# 钻石袋 / 体力宝箱：NB2 原图（白底）→ rembg birefnet-general → crop_trim → 写入 subpkg_items，再于仓库根跑 compress_subpkg_items_pngs.py
# 生图（仓库根）：钻石袋用 minigame/images/ui/icon_gem.png 作参考；体力箱用 icon_energy.png
#   GEMINI_IMAGE_REST_ONLY=1 HTTPS_PROXY=http://127.0.0.1:7897 python3 ~/.cursor/skills/gemini-image-gen/scripts/generate_images.py \
#     --prompt-file docs/prompt/diamond_bag_1_nb2_prompt.txt \
#     --output ../game_assets/huahua/assets/raw/diamond_bag_1_nb2.png \
#     --model gemini-2.5-flash-image \
#     --image minigame/images/ui/icon_gem.png
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
RAW="$(python3 -c "import sys; sys.path.insert(0,'scripts'); import huahua_paths; print(huahua_paths.game_assets_dir()/'raw')")"

ingest() {
  local name="$1"
  local subdir="$2"
  local src="${RAW}/${name}_nb2.png"
  local tmp="${TMPDIR:-/tmp}/${name}_nobg.png"
  local outdir="minigame/subpkg_items/images/${subdir}"
  mkdir -p "$outdir"
  if [[ ! -f "$src" ]]; then
    echo "skip missing $src"
    return 0
  fi
  python3 "$REMBG" "$src" -o "$tmp" -m birefnet-general
  python3 "$CROP" "$tmp" -o "${outdir}/${name}.png" --padding 4
  echo "wrote ${outdir}/${name}.png"
}

ingest diamond_bag_1 diamond_bag
ingest diamond_bag_2 diamond_bag
ingest diamond_bag_3 diamond_bag
ingest stamina_chest_1 stamina_chest
ingest stamina_chest_2 stamina_chest
ingest stamina_chest_3 stamina_chest

python3 scripts/compress_subpkg_items_pngs.py
echo "done"
