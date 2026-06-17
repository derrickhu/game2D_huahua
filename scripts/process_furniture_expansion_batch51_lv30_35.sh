#!/usr/bin/env bash
# batch51 Lv30-35 古风/民俗/奇匠 15 件 → rembg → crop_trim → furniture → compress（max-side 171）
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
GA="${GAME_ASSETS_HUAHUA:-$REPO/../game_assets/huahua}"
RAW="$GA/assets/raw/furniture_expansion_batch51"
SPLIT="$GA/assets/split/furniture_expansion_batch51_lv30_35"
OUT="$REPO/minigame/subpkg_deco/images/furniture"
MAX_SIDE="${MAX_SIDE:-171}"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"

mkdir -p "$SPLIT" "$OUT"

IDS=(
  ancient_brush_mountain
  ancient_inkstone_desk
  ancient_scroll_rack
  ancient_dressing_case
  folk_kite_wall
  folk_lion_head_stand
  ancient_landscape_screen
  folk_dragon_bench
  ancient_master_chair
  ancient_bronze_ding
  ancient_phoenix_rug
  ancient_jade_bi_stand
  whimsy_geode_table
  folk_pole_lantern
  ancient_stone_lantern
)

process_one() {
  local id="$1"
  local src="$RAW/${id}_nb2.png"
  [[ -f "$src" ]] || { echo "MISSING $src" >&2; return 1; }
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

echo "Done: ${#IDS[@]} batch51 Lv30-35 furniture @ max-side=$MAX_SIDE"
