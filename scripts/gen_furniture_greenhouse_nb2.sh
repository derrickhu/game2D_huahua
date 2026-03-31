#!/usr/bin/env bash
# NB2 花房主题家具 13 件：生图 → rembg → crop_trim → 写入 minigame/subpkg_deco/images/furniture/
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
RAW="${GAME_ASSETS_HUAHUA:-/Users/huyi/rosa_games/game_assets/huahua}/assets/raw"
mkdir -p "$RAW"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
OUT="$WS/minigame/subpkg_deco/images/furniture"
mkdir -p "$OUT"

KEYS=(
  wallart_greenhouse_chalkboard
  orn_greenhouse_cart
  garden_flower_stall
  greenhouse_pot_sprout
  greenhouse_pot_bud
  greenhouse_pot_daisy
  greenhouse_pot_sunflower
  greenhouse_pot_carnation
  greenhouse_pot_rose
  greenhouse_pot_lily
  greenhouse_pot_hydrangea
  greenhouse_pot_orchid
  greenhouse_pot_peony_gold
)

export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"

for k in "${KEYS[@]}"; do
  echo "=== $k ==="
  ok=0
  for attempt in 1 2 3 4 5 6; do
    python3 "$GEN" --prompt-file "$WS/docs/prompt/furniture_${k}_nb2_prompt.txt" \
      --output "$RAW/furniture_${k}_nb2.png" \
      --model gemini-3.1-flash-image-preview \
      --aspect-ratio 1:1 && [ -s "$RAW/furniture_${k}_nb2.png" ] && ok=1 && break
    sleep 20
  done
  [ "$ok" = "1" ] || { echo "FAILED generate: $k"; exit 1; }
  tmp="$RAW/furniture_${k}_nobg.png"
  python3 "$REMBG" "$RAW/furniture_${k}_nb2.png" -o "$tmp" -m birefnet-general
  python3 "$CROP" "$tmp" -o "$OUT/${k}.png" --padding 4
  rm -f "$tmp"
  sleep 6
done
echo "OK: raw under $RAW, game PNG under $OUT/"
