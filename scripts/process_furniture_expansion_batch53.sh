#!/usr/bin/env bash
# batch53 原图 → rembg → crop_trim → furniture → compress（max-side 171，与 Lv10-20 家具一致）
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
GA="${GAME_ASSETS_HUAHUA:-$REPO/../game_assets/huahua}"
RAW="$GA/assets/raw/furniture_expansion_batch53"
SPLIT="$GA/assets/split/furniture_expansion_batch53"
OUT="$REPO/minigame/subpkg_deco/images/furniture"
MAX_SIDE="${MAX_SIDE:-171}"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"

mkdir -p "$SPLIT" "$OUT"

IDS=(
  xianqi_maple_round_table
  xianqi_maple_folding_chair
  xianqi_maple_incense_stand
  xianqi_maple_landscape_screen
  xianqi_maple_tier_shelf
  xianqi_plum_canopy_bed
  xianqi_plum_wardrobe
  xianqi_plum_snow_basin
  xianqi_plum_snow_window
  xianqi_plum_padded_stool
  xianqi_koi_stream_bridge
  xianqi_koi_pond_tea_table
  xianqi_koi_scale_cabinet
  xianqi_koi_twin_stone_seat
  xianqi_koi_wall_fountain
  xianqi_bamboo_mist_daybed
  xianqi_bamboo_joint_desk
  xianqi_bamboo_book_tower
  xianqi_bamboo_mist_fence
  xianqi_orchid_pavilion_mirror
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

echo "Done: ${#IDS[@]} batch53 furniture @ max-side=$MAX_SIDE"
