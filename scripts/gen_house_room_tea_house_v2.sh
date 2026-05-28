#!/usr/bin/env bash
# 茶香小院房壳 bg_room_tea_house_nb2：Cursor GenerateImage（布局锁蝴蝶 v11 + 图2 轻盈茶寮风）→ rembg → preview + house
# 不再使用 Gemini NB2。生图步骤在 Cursor 内用 GenerateImage 完成，本脚本仅负责归档 raw 与抠图入库。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${GAME_ASSETS_HUAHUA:-../game_assets/huahua}/assets/preview_house_room"
RAW_SRC="${1:-../game_assets/huahua/assets/raw/bg_room_tea_house_v2_raw.png}"
NAME="bg_room_tea_house_nb2"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
PREV="minigame/subpkg_deco/images/house/preview"
FINAL="minigame/subpkg_deco/images/house"

[[ -f "$RAW_SRC" ]] || { echo "missing raw $RAW_SRC — 请先用 Cursor GenerateImage 生成并归档到 game_assets/raw/" >&2; exit 1; }

mkdir -p "$OUT" "$PREV" "$FINAL" "$(dirname "$RAW_SRC")"

RAW="$OUT/${NAME}_raw.png"
NOBG="$OUT/${NAME}_nobg.png"
cp "$RAW_SRC" "$RAW"

echo "== rembg $NAME =="
python3 "$REMBG" "$RAW" -o "$NOBG" -m birefnet-general

cp "$NOBG" "$FINAL/${NAME}.png"
cp "$NOBG" "$PREV/${NAME}.png"
echo "-> $FINAL/${NAME}.png"
echo "-> $PREV/${NAME}.png"
echo "Done. Raw kept at $RAW"
