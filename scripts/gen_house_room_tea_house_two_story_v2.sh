#!/usr/bin/env bash
# 茶香小院双层房壳：在蝴蝶仙气 L 壳上最小改动加二层（视角与家具一致）→ rembg → crop → 入库
# Cursor GenerateImage（参考 bg_room_butterfly_house_xianqi_nb2 单图）→ 本脚本抠图入库
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${GAME_ASSETS_HUAHUA:-../game_assets/huahua}/assets/preview_house_room"
RAW_SRC="${1:-../game_assets/huahua/assets/raw/bg_room_tea_house_two_story_v6_raw.png}"
NAME="bg_room_tea_house_xianqi_compact_vertical_two_story_nb2"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
PREV="minigame/subpkg_deco/images/house/preview"
FINAL="minigame/subpkg_deco/images/house"

[[ -f "$RAW_SRC" ]] || { echo "missing raw $RAW_SRC" >&2; exit 1; }

mkdir -p "$OUT" "$PREV" "$FINAL" "$(dirname "$RAW_SRC")"

RAW="$OUT/${NAME}_raw.png"
NOBG="$OUT/${NAME}_nobg.png"
cp "$RAW_SRC" "$RAW"

echo "== rembg $NAME =="
python3 "$REMBG" "$RAW" -o "$NOBG" -m birefnet-general

cp "$NOBG" "$FINAL/${NAME}.png"
cp "$NOBG" "$PREV/${NAME}.png"
for f in "$FINAL/${NAME}.png" "$PREV/${NAME}.png"; do
  tmp="${f}.tmp.png"
  python3 "$CROP" "$f" -o "$tmp" --padding 4
  mv "$tmp" "$f"
done
echo "-> $FINAL/${NAME}.png"
echo "-> $PREV/${NAME}.png"
echo "Done. Prompt: docs/prompt/house_bg_room_tea_house_two_story_v6_prompt.txt"
