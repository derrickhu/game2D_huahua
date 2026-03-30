#!/usr/bin/env bash
# NB2 生成 10 件扩展家具 + rembg 入库（需在可访问 Gemini 的环境执行，建议 GEMINI_IMAGE_REST_ONLY=1）
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
RAW="${GAME_ASSETS_HUAHUA:-/Users/huyi/rosa_games/game_assets/huahua}/assets/raw"
mkdir -p "$RAW"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
OUT="$WS/minigame/subpkg_deco/images/furniture"
KEYS=(
  shelf_terracotta orn_window_garden orn_awaken_bucket table_wrap_station
  orn_floral_chest wallart_lace_curtain garden_wood_trough orn_pastel_bench
  light_plant_strip table_rattan_twoset
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
  python3 "$REMBG" "$RAW/furniture_${k}_nb2.png" -o "$OUT/${k}.png" -m birefnet-general
  sleep 6
done
echo "OK: raw under $RAW, game PNG under $OUT/furniture/"
