#!/usr/bin/env bash
# 花田农舍 · 拾光田园套 v2 — 单件 rembg → crop → compress → 入库
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$WS/../game_assets/huahua"}"
RAW="$GA/assets/raw/flower_farm_house/furniture_v2"
FINAL="$GA/assets/final/flower_farm_house/furniture_v2"
FURN_OUT="$WS/minigame/subpkg_deco/images/furniture"
mkdir -p "$FINAL" "$FURN_OUT"

REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"

IDS=(
  farm_vegetable_patch_rug
  farm_garden_tool_stand
  farm_fruit_crate_stack
  farm_scarecrow
  farm_hen_coop
  farm_melon_trellis
  farm_hay_bench
  farm_beehive_stand
  farm_fu_sticker_wall
  farm_ivy_wall
)

OUT_LIST=()
for id in "${IDS[@]}"; do
  src="$RAW/${id}_nb2.png"
  if [[ ! -s "$src" ]]; then
    echo "missing raw: $src" >&2
    exit 1
  fi
  out="$FINAL/${id}.png"
  echo "rembg: $id"
  python3 "$REMBG" "$src" -o "$out" -m birefnet-general
  python3 "$CROP" "$out" -o "$out" --padding 4
  cp "$out" "$FURN_OUT/${id}.png"
  OUT_LIST+=("$FURN_OUT/${id}.png")
done

python3 "$WS/scripts/compress_furniture_deco_pngs.py" --force "${OUT_LIST[@]}"

echo "Assets shipped. Run: npm run check:deco-textures"
