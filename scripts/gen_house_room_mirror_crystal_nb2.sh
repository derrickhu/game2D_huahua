#!/usr/bin/env bash
# NB2 生成「花境小筑」bg_room_bloom_nb2 +「复古花坊」bg_room_confetti_nb2 → rembg → 写入 minigame/house
# 布局锁 bg_room_default；抠图规范 birefnet-general（与 remove-background-game-art.mdc 一致）
# 仓库根执行。RAW → GAME_ASSETS preview_house_room；成品带透明底写入 minigame
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REF="minigame/subpkg_deco/images/house/bg_room_default.png"
OUT="${GAME_ASSETS_HUAHUA:-../game_assets/huahua}/assets/preview_house_room"
PR="docs/prompt"
PY="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
M="gemini-3.1-flash-image-preview"
PREV="minigame/subpkg_deco/images/house/preview"
FINAL="minigame/subpkg_deco/images/house"

if [[ ! -f "$REF" ]]; then
  echo "missing $REF" >&2
  exit 1
fi
if [[ ! -f "$PY" ]]; then
  echo "missing gemini script: $PY" >&2
  exit 1
fi
if [[ ! -f "$REMBG" ]]; then
  echo "missing rembg_single.py: $REMBG" >&2
  exit 1
fi

mkdir -p "$OUT" "$PREV" "$FINAL"

run_pipeline() {
  local name="$1" pfile="$2"
  local raw="$OUT/${name}_raw.png"
  local nobg="$OUT/${name}_nobg.png"
  echo "== NB2 $name =="
  GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}" python3 "$PY" \
    --prompt-file "$PR/$pfile" \
    -o "$raw" \
    --model "$M" \
    --aspect-ratio 1:1 \
    --image "$REF"
  echo "== rembg $name (same canvas size, transparent outside) =="
  python3 "$REMBG" "$raw" -o "$nobg" -m birefnet-general
  cp "$nobg" "$FINAL/${name}.png"
  cp "$nobg" "$PREV/${name}.png"
  echo "-> $FINAL/${name}.png"
}

run_pipeline bg_room_bloom_nb2 house_bg_room_bloom_parade_nb2_prompt.txt
sleep 12
run_pipeline bg_room_confetti_nb2 house_bg_room_confetti_cottage_nb2_prompt.txt

echo "Done. Raw NB2 (white bg) kept as *_raw.png under $OUT for re-cut if needed."
