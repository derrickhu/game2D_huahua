#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$ROOT/../game_assets/huahua"}"
REF="$ROOT/docs/prompt/refs/house_renovation_panel_prototype.png"
OUT="$GA/assets/preview_house_renovation_nb2"
PY="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
MODEL="gemini-3.1-flash-image-preview"

mkdir -p "$OUT"

gen() {
  local name="$1"
  local ratio="${2:-1:1}"
  echo "=== $name ($ratio) ==="
  python3 "$PY" \
    --prompt-file "$ROOT/docs/prompt/${name}_nb2_prompt.txt" \
    --output "$OUT/${name}.png" \
    --model "$MODEL" \
    --aspect-ratio "$ratio" \
    --image "$REF"
  sleep 5
}

gen deco_panel_main_panel 16:9
gen deco_panel_title_ribbon 16:9
gen deco_panel_close_button 1:1
gen deco_panel_sidebar_tab_normal 1:1
gen deco_panel_sidebar_tab_selected 1:1
gen deco_panel_furniture_card 4:3
gen deco_panel_rarity_tags_sheet 16:9
gen deco_panel_equipped_corner_frame 1:1
gen deco_panel_green_action_button 16:9
gen deco_panel_lock_overlay 1:1
gen deco_panel_full_screen_reference 9:16

echo "Done -> $OUT"
