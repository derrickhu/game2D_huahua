#!/usr/bin/env bash
# 花田农舍 batch54 — rembg → split 家具 → 入库 minigame
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$WS/../game_assets/huahua"}"
RAW="$GA/assets/raw/flower_farm_house"
SPLIT="$GA/assets/split/flower_farm_house"
NOBG="$GA/assets/nobg/flower_farm_house"
FINAL="$GA/assets/final/flower_farm_house"
mkdir -p "$SPLIT" "$NOBG" "$FINAL"

REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"

rembg_one() {
  local in="$1" out="$2"
  echo "rembg: $in"
  python3 "$REMBG" "$in" -o "$out" -m birefnet-general
  python3 "$CROP" "$out" -o "$out" --padding 4
}

# --- 大地图 thumb ---
rembg_one "$RAW/worldmap_thumb_flower_farm_house_nb2.png" \
  "$FINAL/worldmap_thumb_flower_farm_house.png"
cp "$FINAL/worldmap_thumb_flower_farm_house.png" \
  "$WS/minigame/subpkg_panels/images/ui/worldmap_thumb_flower_farm_house.png"

# --- 房壳 ---
rembg_one "$RAW/house_bg_room_flower_farm_cottage_nb2.png" \
  "$FINAL/bg_room_flower_farm_cottage_nb2.png"
cp "$FINAL/bg_room_flower_farm_cottage_nb2.png" \
  "$WS/minigame/subpkg_deco/images/house/bg_room_flower_farm_cottage_nb2.png"

rembg_one "$RAW/house_bg_room_flower_farm_spring_vine_nb2.png" \
  "$FINAL/bg_room_flower_farm_spring_vine_nb2.png"
cp "$FINAL/bg_room_flower_farm_spring_vine_nb2.png" \
  "$WS/minigame/subpkg_deco/images/house/bg_room_flower_farm_spring_vine_nb2.png"

# --- 家具合图 split 4x2 → 7 件 ---
SHEET_RAW="$RAW/furniture_flower_farm_set_7sheet_nb2.png"
SHEET_NOBG="$NOBG/furniture_flower_farm_set_7sheet_nobg.png"
rembg_one "$SHEET_RAW" "$SHEET_NOBG"

python3 - <<PY
from pathlib import Path
from PIL import Image
import os

WS = Path("${WS}")
raw_nobg = Path("${SHEET_NOBG}")
split_dir = Path("${SPLIT}")
split_dir.mkdir(parents=True, exist_ok=True)

names = [
    "farm_vegetable_patch_rug",
    "farm_wooden_wheelbarrow",
    "farm_fruit_crate_stack",
    "farm_scarecrow",
    "farm_hen_coop",
    "farm_hay_bench",
    "farm_beehive_stand",
]

im = Image.open(raw_nobg).convert("RGBA")
cols, rows = 4, 2
fw, fh = im.width // cols, im.height // rows
idx = 0
for r in range(rows):
    for c in range(cols):
        if idx >= len(names):
            break
        cell = im.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh))
        alpha = cell.split()[3]
        bbox = alpha.getbbox()
        if bbox:
            x0, y0, x1, y1 = bbox
            pad = 4
            cell = cell.crop((
                max(0, x0 - pad), max(0, y0 - pad),
                min(cell.width, x1 + pad), min(cell.height, y1 + pad),
            ))
        out = split_dir / f"{names[idx]}.png"
        cell.save(out)
        print("split", out.name, cell.size)
        idx += 1
PY

FURN_OUT="$WS/minigame/subpkg_deco/images/furniture"
for id in farm_vegetable_patch_rug farm_wooden_wheelbarrow farm_fruit_crate_stack \
  farm_scarecrow farm_hen_coop farm_hay_bench farm_beehive_stand; do
  cp "$SPLIT/${id}.png" "$FURN_OUT/${id}.png"
done

python3 "$WS/scripts/compress_furniture_deco_pngs.py" --force \
  "$FURN_OUT/farm_vegetable_patch_rug.png" \
  "$FURN_OUT/farm_wooden_wheelbarrow.png" \
  "$FURN_OUT/farm_fruit_crate_stack.png" \
  "$FURN_OUT/farm_scarecrow.png" \
  "$FURN_OUT/farm_hen_coop.png" \
  "$FURN_OUT/farm_hay_bench.png" \
  "$FURN_OUT/farm_beehive_stand.png"

echo "Assets shipped. Run: npm run check:deco-textures"
