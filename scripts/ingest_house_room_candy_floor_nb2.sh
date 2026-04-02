#!/usr/bin/env bash
# 糖果花坊：仅换地板（NB2 + rembg），参考当前 bg_room_candy_nb2.png
# 仓库根执行
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REF="minigame/subpkg_deco/images/house/bg_room_candy_nb2.png"
OUT="${GAME_ASSETS_HUAHUA:-../game_assets/huahua}/assets/preview_house_room"
PY="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
M="gemini-3.1-flash-image-preview"
PR="docs/prompt/house_bg_room_candy_nb2_floor_only_prompt.txt"
NAME="bg_room_candy_nb2"

[[ -f "$REF" ]] || { echo "missing $REF" >&2; exit 1; }
[[ -f "$PY" ]] || { echo "missing $PY" >&2; exit 1; }
[[ -f "$REMBG" ]] || { echo "missing $REMBG" >&2; exit 1; }

mkdir -p "$OUT" "minigame/subpkg_deco/images/house/preview"

RAW="$OUT/${NAME}_floor_raw.png"
NOBG="$OUT/${NAME}_floor_nobg.png"

echo "== NB2 floor-only (ref: current candy shell) =="
GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}" python3 "$PY" \
  --prompt-file "$PR" \
  -o "$RAW" \
  --model "$M" \
  --aspect-ratio 1:1 \
  --image "$REF"

echo "== rembg =="
python3 "$REMBG" "$RAW" -o "$NOBG" -m birefnet-general

cp "$NOBG" "minigame/subpkg_deco/images/house/${NAME}.png"
cp "$NOBG" "minigame/subpkg_deco/images/house/preview/${NAME}.png"
echo "-> minigame/subpkg_deco/images/house/${NAME}.png"
