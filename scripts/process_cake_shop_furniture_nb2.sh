#!/usr/bin/env bash
# 蛋糕房 cake_shop 专属家具 20 件：NB2 → rembg(birefnet-general) → crop_trim → cake/ → compress
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
RAW_ROOT="${GAME_ASSETS_HUAHUA:-$REPO/../game_assets/huahua}/assets/raw"
mkdir -p "$RAW_ROOT"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
DEST="$REPO/minigame/subpkg_deco/images/cake"
mkdir -p "$DEST"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

IDS=(
  cake_shelf_layered_display
  cake_shelf_baking_pantry
  cake_shelf_chilled_cabinet
  cake_shelf_fondant_flowers
  cake_table_workstation
  cake_table_register_counter
  cake_table_round_dessert
  cake_table_gift_wrap
  cake_table_dessert_island
  cake_light_pink_double_oven
  cake_light_stand_mixer
  cake_light_pendant_macaron
  cake_light_chocolate_fountain
  cake_orn_strawberry_stool_pair
  cake_orn_wedding_cake_centerpiece
  cake_orn_donut_cushion_pair
  cake_orn_teddy_baker
  cake_wallart_menu_chalkboard
  cake_wallart_lollipop_clock
  cake_garden_strawberry_arch
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

echo "=== compress (max-side 171, force) ==="
python3 "$REPO/scripts/compress_furniture_deco_pngs.py" --force \
  $(for id in "${IDS[@]}"; do
      [[ -f "$DEST/${id}.png" ]] && echo "$DEST/${id}.png"
    done)
echo "Done."
