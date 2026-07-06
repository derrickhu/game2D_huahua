#!/usr/bin/env bash
# 三件墙饰重绘：等距墙面平行透视 → rembg → crop → 171
# wallart_lace_curtain / wallart_rose_swag_drape / deco_late_lv7_wall_01
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$WS/../game_assets/huahua"}"
RAW="$GA/assets/raw/wallart_regen"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
OUT="$WS/minigame/subpkg_deco/images/furniture"
REF_CURTAIN="$WS/minigame/subpkg_deco/images/furniture/deco_lv20_wall_moon_sheer_curtain.png"
REF_FRAME="$WS/minigame/subpkg_deco/images/furniture/wallart_frame.png"
mkdir -p "$RAW" "$OUT"

export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"
export GEMINI_IMAGE_NO_PROXY="${GEMINI_IMAGE_NO_PROXY:-1}"
unset HTTPS_PROXY https_proxy HTTP_PROXY http_proxy 2>/dev/null || true
MODEL="${GEMINI_WALLART_MODEL:-gemini-2.5-flash-image}"

gen_one() {
  local key="$1" ar="$2" ref="$3"
  local pf="$WS/docs/prompt/${key}_isometric_nb2_prompt.txt"
  local raw_out="$RAW/${key}_isometric_nb2.png"
  echo "=== $key (aspect $ar) ==="
  [ -f "$pf" ] || { echo "missing prompt $pf"; exit 1; }
  local ok=0
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    python3 "$GEN" --prompt-file "$pf" \
      --output "$raw_out" \
      --model "$MODEL" \
      --aspect-ratio "$ar" \
      --image "$ref" && [ -s "$raw_out" ] && ok=1 && break
    sleep 35
  done
  [ "$ok" = "1" ] || { echo "FAILED generate: $key"; exit 1; }
  local tmp="$RAW/${key}_nobg.png"
  python3 "$REMBG" "$raw_out" -o "$tmp" -m birefnet-general
  python3 "$CROP" "$tmp" -o "$OUT/${key}.png" --padding 4
  rm -f "$tmp"
  python3 "$WS/scripts/compress_furniture_deco_pngs.py" --force --max-side 171 "$OUT/${key}.png"
  sleep 8
}

gen_one wallart_lace_curtain 3:4 "$REF_CURTAIN"
gen_one wallart_rose_swag_drape 3:4 "$REF_CURTAIN"
gen_one deco_late_lv7_wall_01 4:3 "$REF_FRAME"

echo "OK: $OUT/{wallart_lace_curtain,wallart_rose_swag_drape,deco_late_lv7_wall_01}.png"
