#!/usr/bin/env bash
# Lv10-20 30件家具批次：NB2 → rembg(birefnet-general) → crop_trim → furniture/ → compress
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
RAW_ROOT="${GAME_ASSETS_HUAHUA:-$REPO/../game_assets/huahua}/assets/raw"
mkdir -p "$RAW_ROOT"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
DEST="$REPO/minigame/subpkg_deco/images/furniture"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

IDS=(
  deco_lv10_table_zen_tea_low
  deco_lv10_orn_zen_cushion_pair
  deco_lv11_wallart_zen_ink_scroll
  deco_lv12_orn_mushroom_stool_pair
  deco_lv13_table_mushroom_round
  deco_lv14_shelf_mushroom_cottage
  deco_lv15_garden_mushroom_grove
  deco_lv13_table_french_pastry_counter
  deco_lv14_shelf_handbrew_coffee_bar
  deco_lv15_light_vintage_oven
  deco_lv16_orn_macaron_tower
  deco_lv15_shelf_antique_library
  deco_lv16_table_globe_writing_desk
  deco_lv17_orn_chesterfield_armchair
  deco_lv18_wallart_botanical_taxonomy
  deco_lv17_garden_aurora_mirror_pond
  deco_lv18_orn_aurora_crystal_orb
  deco_lv19_light_aurora_floor_lantern
  deco_lv18_orn_cloud_pouf_set
  deco_lv19_table_cloud_dessert_island
  deco_lv20_garden_cloud_swing
  deco_lv10_orn_kitten_bed
  deco_lv11_orn_cat_tower
  deco_lv11_light_phonograph_vintage
  deco_lv12_orn_pastel_postbox
  deco_lv13_orn_teddy_armchair
  deco_lv14_orn_carousel_music_box
  deco_lv15_light_terrarium_lamp
  deco_lv16_wallart_harbor_arch_window
  deco_lv20_orn_white_grand_piano
)

export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"

for id in "${IDS[@]}"; do
  PF="$REPO/docs/prompt/furniture_${id}_nb2_prompt.txt"
  if [[ ! -f "$PF" ]]; then
    echo "missing prompt: $PF" >&2
    exit 1
  fi
  RAW="$RAW_ROOT/${id}.png"
  echo "=== [${id}] NB2 ==="
  if ! python3 "$GEN" --prompt-file "$PF" --output "$RAW" \
       --model gemini-3.1-flash-image-preview --aspect-ratio 1:1; then
    echo "WARN: NB2 failed for $id, skipping" >&2
    continue
  fi
  echo "=== [${id}] rembg ==="
  if ! python3 "$REMBG" "$RAW" -o "$TMP/${id}_nobg.png" -m birefnet-general; then
    echo "WARN: rembg failed for $id, skipping" >&2
    continue
  fi
  echo "=== [${id}] crop_trim ==="
  python3 "$CROP" "$TMP/${id}_nobg.png" -o "$DEST/${id}.png" --padding 4
  sleep 3
done

echo "=== compress (max-side 171) ==="
python3 "$REPO/scripts/compress_furniture_deco_pngs.py" \
  $(for id in "${IDS[@]}"; do
      [[ -f "$DEST/${id}.png" ]] && echo "$DEST/${id}.png"
    done)
echo "Done."
