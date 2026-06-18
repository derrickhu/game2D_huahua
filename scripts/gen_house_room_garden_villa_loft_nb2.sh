#!/usr/bin/env bash
# NB2 花园别墅现代错层空壳：参考图锁错层+共享垂直墙+侧边窄楼梯
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REF="${GAME_ASSETS_HUAHUA:-../game_assets/huahua}/assets/raw/garden_villa_modern_layout_ref.png"
SHELL_REF="minigame/subpkg_deco/images/house/bg_room_tea_house_xianqi_two_story_nb2.png"
OUT="${GAME_ASSETS_HUAHUA:-../game_assets/huahua}/assets/preview_house_room"
PR="docs/prompt"
PY="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
M="gemini-3.1-flash-image-preview"
NAME="bg_room_garden_villa_loft_nb2"
PROMPT="house_bg_room_garden_villa_loft_nb2_prompt.txt"
PREV="minigame/subpkg_deco/images/house/preview"
FINAL="minigame/subpkg_deco/images/house"

for f in "$REF" "$PY" "$REMBG" "$PR/$PROMPT"; do
  [[ -f "$f" ]] || { echo "missing $f" >&2; exit 1; }
done

mkdir -p "$OUT" "$PREV" "$FINAL"
cp "$REF" "${OUT}/${NAME}_layout_ref.png"

raw="$OUT/${NAME}_raw.png"
nobg="$OUT/${NAME}_nobg.png"

echo "== NB2 $NAME (ref: staggered villa layout) =="
GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}" python3 "$PY" \
  --prompt-file "$PR/$PROMPT" \
  -o "$raw" \
  --model "$M" \
  --aspect-ratio 1:1 \
  --image-size 1K \
  --image "$REF"

echo "== rembg $NAME =="
python3 "$REMBG" "$raw" -o "$nobg" -m birefnet-general
cp "$nobg" "$FINAL/${NAME}.png"
cp "$nobg" "$PREV/${NAME}.png"
echo "-> $FINAL/${NAME}.png"
echo "Done. Raw: $raw"
