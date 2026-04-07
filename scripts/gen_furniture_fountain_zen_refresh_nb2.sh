#!/usr/bin/env bash
# 迷你喷泉 / 花园喷泉 / 日式枯山水 — NB2 重绘（对齐花房盆栽线：轻线稿、无方格地台）→ rembg → crop_trim → 最长边归一
# 断点续跑: ONLY_KEYS="garden_zen" ./scripts/gen_furniture_fountain_zen_refresh_nb2.sh
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$WS/../game_assets/huahua"}"
RAW="$GA/assets/raw"
mkdir -p "$RAW"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
OUT="$WS/minigame/subpkg_deco/images/furniture"
mkdir -p "$OUT"

export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"
MODEL="${GEMINI_IMAGE_MODEL:-gemini-3.1-flash-image-preview}"

ALL_KEYS=(orn_fountain garden_summer garden_zen)
if [[ -n "${ONLY_KEYS:-}" ]]; then
  read -r -a KEYS <<< "${ONLY_KEYS}"
else
  KEYS=("${ALL_KEYS[@]}")
fi

for k in "${KEYS[@]}"; do
  pf="$WS/docs/prompt/furniture_${k}_nb2_prompt.txt"
  raw_out="$RAW/furniture_${k}_nb2.png"
  echo "=== $k ==="
  [ -f "$pf" ] || { echo "missing prompt $pf"; exit 1; }
  ok=0
  for attempt in 1 2 3 4 5 6 7 8; do
    python3 "$GEN" --prompt-file "$pf" \
      --output "$raw_out" \
      --model "$MODEL" \
      --aspect-ratio 1:1 && [ -s "$raw_out" ] && ok=1 && break
    sleep 30
  done
  [ "$ok" = "1" ] || { echo "FAILED generate: $k"; exit 1; }
  tmp="$RAW/furniture_${k}_nobg.png"
  python3 "$REMBG" "$raw_out" -o "$tmp" -m birefnet-general
  python3 "$CROP" "$tmp" -o "$OUT/${k}.png" --padding 4
  rm -f "$tmp"
  python3 "$WS/scripts/compress_furniture_deco_pngs.py" --force --max-side 171 "$OUT/${k}.png"
  sleep 8
done
echo "OK: raw under $RAW, game PNG under $OUT/"
