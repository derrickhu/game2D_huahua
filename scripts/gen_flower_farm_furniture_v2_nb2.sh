#!/usr/bin/env bash
# 花田农舍 · 拾光田园套 v2 — 10 件家具单件 NB2 生图
# 用法: ./scripts/gen_flower_farm_furniture_v2_nb2.sh
# 断点: ONLY_ID=farm_melon_trellis ./scripts/gen_flower_farm_furniture_v2_nb2.sh
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$WS/../game_assets/huahua"}"
RAW="$GA/assets/raw/flower_farm_house/furniture_v2"
mkdir -p "$RAW"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REF="$WS/minigame/subpkg_deco/images/house/bg_room_flower_farm_courtyard_sunny_nb2.png"

export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"
export GEMINI_IMAGE_NO_PROXY="${GEMINI_IMAGE_NO_PROXY:-1}"
MODEL="${GEMINI_IMAGE_MODEL:-gemini-3.1-flash-image-preview}"
SLEEP_OK="${SLEEP_OK:-8}"

IDS=(
  farm_vegetable_patch_rug
  farm_garden_tool_stand
  farm_fruit_crate_stack
  farm_scarecrow
  farm_hen_coop
  farm_melon_trellis
  farm_hay_bench
  farm_beehive_stand
  farm_fu_sticker_wall
  farm_ivy_wall
)

for id in "${IDS[@]}"; do
  if [[ -n "${ONLY_ID:-}" && "$ONLY_ID" != "$id" ]]; then
    continue
  fi
  out="$RAW/${id}_nb2.png"
  pf="$WS/docs/prompt/furniture_${id}_nb2_prompt.txt"
  if [[ "${SKIP_EXISTING:-}" == "1" && -s "$out" ]]; then
    echo "skip existing: $out"
    continue
  fi
  echo "=== [$id] -> $out ==="
  python3 "$GEN" \
    --prompt-file "$pf" \
    --image "$REF" \
    --output "$out" \
    --model "$MODEL" \
    --aspect-ratio 1:1 \
    --image-size 1K
  sleep "$SLEEP_OK"
done

echo "Done. Raw outputs in $RAW"
