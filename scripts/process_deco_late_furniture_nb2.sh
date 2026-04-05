#!/usr/bin/env bash
# NB2 生图 → rembg → crop_trim → furniture 目录 → compress_furniture_deco_pngs（单件顺序执行）
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
  deco_late_lv7_table_01
  deco_late_lv7_wall_01
  deco_late_lv8_garden_01
  deco_late_lv8_shelf_01
  deco_late_lv8_light_01
  deco_late_lv9_orn_furn_01
  deco_late_lv9_wall_01
  deco_late_lv9_table_01
  deco_late_lv9_garden_01
  deco_late_lv10_shelf_01
  deco_late_lv10_orn_01
  deco_late_lv10_pachira_01
)

export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"

for id in "${IDS[@]}"; do
  PF="$REPO/docs/prompt/furniture_${id}_nb2_prompt.txt"
  if [[ ! -f "$PF" ]]; then
    echo "missing prompt: $PF" >&2
    exit 1
  fi
  RAW="$RAW_ROOT/${id}.png"
  echo "=== NB2 $id ==="
  python3 "$GEN" --prompt-file "$PF" --output "$RAW" \
    --model gemini-3.1-flash-image-preview --aspect-ratio 1:1
  echo "=== rembg $id ==="
  python3 "$REMBG" "$RAW" -o "$TMP/nobg.png" -m birefnet-general
  echo "=== crop_trim $id ==="
  python3 "$CROP" "$TMP/nobg.png" -o "$DEST/${id}.png" --padding 4
  sleep 5
done

echo "=== compress (max-side 171) ==="
python3 "$REPO/scripts/compress_furniture_deco_pngs.py" \
  $(for id in "${IDS[@]}"; do echo "$DEST/${id}.png"; done)
echo "Done."
