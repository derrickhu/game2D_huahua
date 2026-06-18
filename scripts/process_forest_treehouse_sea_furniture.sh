#!/usr/bin/env bash
# 橡树小屋航海风专属 4 件 → 归档 raw → rembg → crop_trim → compress
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
GA="${GAME_ASSETS_HUAHUA:-$REPO/../game_assets/huahua}"
CURSOR_ASSETS="/Users/rosa/.cursor/projects/Users-rosa-rosa-games-game2D-huahua/assets"
RAW="$GA/assets/raw/forest_treehouse_sea"
SPLIT="$GA/assets/split/forest_treehouse_sea"
OUT="$REPO/minigame/subpkg_deco/images/furniture"
MAX_SIDE="${MAX_SIDE:-171}"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"

mkdir -p "$RAW" "$SPLIT" "$OUT"

copy_raw() {
  local id="$1"
  local src="$2"
  [[ -f "$src" ]] || { echo "MISSING $src" >&2; exit 1; }
  cp "$src" "$RAW/${id}_nb2.png"
}

copy_raw sea_wheel_wall "$CURSOR_ASSETS/sea_wheel_wall_nb2-37ae7a7a-af95-4f88-a52e-090495abe61b.png"
copy_raw sea_anchor_bench "$CURSOR_ASSETS/sea_anchor_bench_nb2-30aa1baf-8d41-4ccb-a68d-1ac071a01204.png"
copy_raw sea_treasure_chest "$CURSOR_ASSETS/sea_treasure_chest_nb2-a5563402-a3c1-4075-9f09-8d2205f27db9.png"
copy_raw sea_coral_cabinet "$CURSOR_ASSETS/sea_coral_cabinet_nb2-aab66275-e045-4cd3-b9f9-7bcd8a57e439.png"

IDS=(
  sea_wheel_wall
  sea_anchor_bench
  sea_treasure_chest
  sea_coral_cabinet
)

process_one() {
  local id="$1"
  local src="$RAW/${id}_nb2.png"
  echo "==> $id"
  python3 "$REMBG" "$src" -o "$SPLIT/${id}_cut.png" -m birefnet-general
  python3 "$CROP" "$SPLIT/${id}_cut.png" -o "$OUT/${id}.png" --padding 4
}

for id in "${IDS[@]}"; do
  process_one "$id"
done

OUT_LIST=()
for id in "${IDS[@]}"; do
  OUT_LIST+=("$OUT/${id}.png")
done
python3 scripts/compress_furniture_deco_pngs.py --max-side "$MAX_SIDE" --force "${OUT_LIST[@]}"

echo "Done: ${#IDS[@]} forest_treehouse sea furniture @ max-side=$MAX_SIDE"
