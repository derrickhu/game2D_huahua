#!/usr/bin/env bash
# 茶香小院 — 双层茶楼 cutaway 房壳（参考传统二层客栈剖面）→ rembg → preview + house
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REF="${REF:-/Users/rosa/.cursor/projects/Users-rosa-rosa-games-game2D-huahua/assets/bcbcc72b727bf87964b7a71d81690379-b60a15e5-a454-4312-8b0f-324caa6b237b.png}"
OUT="${GAME_ASSETS_HUAHUA:-../game_assets/huahua}/assets/preview_house_room"
PR="docs/prompt/house_bg_room_tea_house_two_story_nb2_prompt.txt"
NAME="bg_room_tea_house_two_story_nb2"
PY="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
M="gemini-3.1-flash-image-preview"
PREV="minigame/subpkg_deco/images/house/preview"
FINAL="minigame/subpkg_deco/images/house"

[[ -f "$REF" ]] || { echo "missing ref $REF" >&2; exit 1; }
[[ -f "$PR" ]] || { echo "missing prompt $PR" >&2; exit 1; }

mkdir -p "$OUT" "$PREV" "$FINAL"

RAW="$OUT/${NAME}_raw.png"
NOBG="$OUT/${NAME}_nobg.png"

echo "== NB2 $NAME (ref: two-story tea inn cutaway) =="
ok=0
for attempt in 1 2 3 4 5 6; do
  if GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}" python3 "$PY" \
    --prompt-file "$PR" \
    -o "$RAW" \
    --model "$M" \
    --aspect-ratio 1:1 \
    --image-size 1K \
    --image "$REF" && [[ -s "$RAW" ]]; then
    ok=1
    break
  fi
  echo "  retry $attempt..."
  sleep 25
done
[[ "$ok" = "1" ]] || { echo "NB2 failed" >&2; exit 1; }

echo "== rembg $NAME =="
python3 "$REMBG" "$RAW" -o "$NOBG" -m birefnet-general

cp "$NOBG" "$FINAL/${NAME}.png"
cp "$NOBG" "$PREV/${NAME}.png"
echo "-> $FINAL/${NAME}.png"
echo "-> $PREV/${NAME}.png"
echo "Done. Raw: $RAW"
