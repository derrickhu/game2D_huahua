#!/usr/bin/env bash
# batch51 茶香小院专属 10 件 → rembg → crop_trim → furniture → compress（max-side 171）
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
GA="${GAME_ASSETS_HUAHUA:-$REPO/../game_assets/huahua}"
RAW="$GA/assets/raw/furniture_expansion_batch51"
SPLIT="$GA/assets/split/furniture_expansion_batch51_tea_house"
OUT="$REPO/minigame/subpkg_deco/images/furniture"
MAX_SIDE="${MAX_SIDE:-171}"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"

mkdir -p "$SPLIT" "$OUT"

IDS=(
  gucha_water_jar
  jiangnan_lattice_window
  gucha_charcoal_brazier
  jiangnan_rattan_daybed
  gucha_tea_boat
  jiangnan_willow_cart
  gucha_tea_chest
  xianxia_herb_rack
  jiangnan_blue_cabinet
  xianxia_meditation_platform
)

process_one() {
  local id="$1"
  local src="$RAW/${id}_nb2.png"
  [[ -f "$src" ]] || { echo "MISSING $src" >&2; return 1; }
  echo "==> $id"
  python3 "$REMBG" "$src" -o "$SPLIT/${id}_cut.png" -m birefnet-general
  python3 "$CROP" "$SPLIT/${id}_cut.png" -o "$OUT/${id}.png" --padding 4
}

for id in "${IDS[@]}"; do
  process_one "$id"
done

OUT_LIST=()
for id in "${IDS[@]}"; do
  OUT_LIST+=("$OUT/${id}.png")
done
python3 scripts/compress_furniture_deco_pngs.py --max-side "$MAX_SIDE" --force "${OUT_LIST[@]}"

echo "Done: ${#IDS[@]} tea_house batch51 furniture @ max-side=$MAX_SIDE"
