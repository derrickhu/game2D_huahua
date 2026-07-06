#!/usr/bin/env bash
# 鲜花摆件批次 10：NB2 → rembg → crop_trim → furniture/
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$WS/../game_assets/huahua"}"
RAW="$GA/assets/raw"
mkdir -p "$RAW"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
OUT="$WS/minigame/subpkg_deco/images/furniture"
STYLE_REF="$WS/minigame/subpkg_deco/images/furniture/greenhouse_pot_daisy.png"
mkdir -p "$OUT"

KEYS=(
  orn_flora_hanging_spider_plant
  orn_flora_wall_ivy_trellis
  orn_flora_fiddle_leaf_pot
  orn_flora_hyacinth_glass_vase
  orn_flora_wildflower_mason_jar
  orn_flora_blooming_cactus
  orn_flora_lavender_window_box
  orn_flora_cherry_branch_vase
  orn_flora_fern_terrarium
  orn_flora_hanging_petunia
)

export GEMINI_IMAGE_NO_PROXY="${GEMINI_IMAGE_NO_PROXY:-1}"
export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"

for k in "${KEYS[@]}"; do
  echo "=== $k ==="
  ok=0
  for attempt in 1 2 3 4 5 6; do
    python3 "$GEN" --prompt-file "$WS/docs/prompt/furniture_${k}_nb2_prompt.txt" \
      --output "$RAW/furniture_${k}_nb2.png" \
      --model gemini-3.1-flash-image-preview \
      --aspect-ratio 1:1 \
      --image "$STYLE_REF" && [ -s "$RAW/furniture_${k}_nb2.png" ] && ok=1 && break
    sleep 20
  done
  [ "$ok" = "1" ] || { echo "FAILED generate: $k"; exit 1; }
  tmp="$RAW/furniture_${k}_nobg.png"
  python3 "$REMBG" "$RAW/furniture_${k}_nb2.png" -o "$tmp" -m birefnet-general
  python3 "$CROP" "$tmp" -o "$OUT/${k}.png" --padding 4
  rm -f "$tmp"
  python3 "$WS/scripts/compress_furniture_deco_pngs.py" --force --max-side 171 "$OUT/${k}.png"
  sleep 6
done
echo "OK: raw under $RAW, game PNG under $OUT/"
