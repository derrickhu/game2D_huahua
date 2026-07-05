#!/usr/bin/env bash
# 花田农舍 batch54 — NB2 生图 → game_assets raw
# 用法: ./scripts/gen_flower_farm_house_nb2.sh
# 断点: ONLY_STEP=thumb ./scripts/gen_flower_farm_house_nb2.sh
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$WS/../game_assets/huahua"}"
RAW="$GA/assets/raw/flower_farm_house"
mkdir -p "$RAW"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"

export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"
export GEMINI_IMAGE_NO_PROXY="${GEMINI_IMAGE_NO_PROXY:-1}"
MODEL="${GEMINI_IMAGE_MODEL:-gemini-3.1-flash-image-preview}"
SLEEP_OK="${SLEEP_OK:-8}"

REF_TEA="$WS/minigame/subpkg_deco/images/house/bg_room_tea_house_xianqi_two_story_nb2.png"

run_gen() {
  local step="$1"
  local pf="$2"
  local out="$3"
  shift 3
  if [[ -n "${ONLY_STEP:-}" && "$ONLY_STEP" != "$step" ]]; then
    return 0
  fi
  if [[ "${SKIP_EXISTING:-}" == "1" && -s "$out" ]]; then
    echo "skip existing: $out"
    return 0
  fi
  echo "=== [$step] -> $out ==="
  python3 "$GEN" \
    --prompt-file "$pf" \
    --output "$out" \
    --model "$MODEL" \
    --aspect-ratio 1:1 \
    "$@"
  sleep "$SLEEP_OK"
}

run_gen thumb \
  "$WS/docs/prompt/worldmap_thumb_flower_farm_house_nb2_prompt.txt" \
  "$RAW/worldmap_thumb_flower_farm_house_nb2.png"

run_gen cottage \
  "$WS/docs/prompt/house_bg_room_flower_farm_cottage_nb2_prompt.txt" \
  "$RAW/house_bg_room_flower_farm_cottage_nb2.png" \
  --image "$REF_TEA"

COTTAGE="$RAW/house_bg_room_flower_farm_cottage_nb2.png"
if [[ ! -s "$COTTAGE" ]]; then
  echo "missing cottage shell for spring/furniture refs: $COTTAGE" >&2
  exit 1
fi

run_gen spring_vine \
  "$WS/docs/prompt/house_bg_room_flower_farm_spring_vine_nb2_prompt.txt" \
  "$RAW/house_bg_room_flower_farm_spring_vine_nb2.png" \
  --image "$COTTAGE"

run_gen furniture_sheet \
  "$WS/docs/prompt/furniture_flower_farm_set_7sheet_nb2_prompt.txt" \
  "$RAW/furniture_flower_farm_set_7sheet_nb2.png" \
  --image "$COTTAGE"

echo "Done. Raw outputs in $RAW"
