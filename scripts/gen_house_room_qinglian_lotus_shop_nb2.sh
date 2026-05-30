#!/usr/bin/env bash
# 清涟荷影花坊房壳 bg_room_qinglian_lotus_shop_nb2
# 布局锁 bg_room_default_soft_nb2（画布 bbox）；风格/结构锁当前成品（仅左墙去窗时改 REF）
# 仓库根执行：NB2 → rembg birefnet-general → align → minigame/subpkg_deco/images/house/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LAYOUT_REF="minigame/subpkg_deco/images/house/bg_room_default_soft_nb2.png"
REF="minigame/subpkg_deco/images/house/bg_room_qinglian_lotus_shop_nb2.png"
OUT="${GAME_ASSETS_HUAHUA:-../game_assets/huahua}/assets/raw"
PREV="${GAME_ASSETS_HUAHUA:-../game_assets/huahua}/assets/preview_house_room"
PR="docs/prompt/house_bg_room_qinglian_lotus_shop_nb2_prompt.txt"
PY="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
M="gemini-3.1-flash-image-preview"
NAME="bg_room_qinglian_lotus_shop_nb2"
FINAL="minigame/subpkg_deco/images/house"

for f in "$LAYOUT_REF" "$REF" "$PR" "$PY" "$REMBG"; do
  [[ -f "$f" ]] || { echo "missing $f" >&2; exit 1; }
done

mkdir -p "$OUT" "$PREV" "$FINAL/preview"

RAW="$OUT/${NAME}_nb2.png"
NOBG="$OUT/${NAME}_nobg.png"

echo "== NB2 $NAME (style ref: current qinglian shell, left wall no window) =="
GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}" python3 "$PY" \
  --prompt-file "$PR" \
  -o "$RAW" \
  --model "$M" \
  --aspect-ratio 1:1 \
  --image-size 1K \
  --image "$REF"

echo "== rembg $NAME =="
python3 "$REMBG" "$RAW" -o "$NOBG" -m birefnet-general

ALIGNED="$OUT/${NAME}_aligned.png"
echo "== align canvas to $REF bbox =="
python3 scripts/align_house_room_to_ref.py "$NOBG" "$LAYOUT_REF" -o "$ALIGNED"

cp "$ALIGNED" "$FINAL/${NAME}.png"
cp "$ALIGNED" "$FINAL/preview/${NAME}.png"
cp "$ALIGNED" "$PREV/${NAME}.png"
echo "-> $FINAL/${NAME}.png"
echo "Raw kept at $RAW"
