#!/usr/bin/env bash
# 从 furniture_expansion_batch52 原图重跑清涟家具：rembg → crop → 入库（默认最长边 512，避免 171 放大发糊）
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
GA="${GAME_ASSETS_HUAHUA:-$REPO/../game_assets/huahua}"
RAW_BATCH="$GA/assets/raw/furniture_expansion_batch52"
SPLIT="$GA/assets/split/qinglian_furniture_reprocess"
OUT="$REPO/minigame/subpkg_deco/images/furniture"
MAX_SIDE="${MAX_SIDE:-512}"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"

mkdir -p "$SPLIT" "$OUT"

# xianqi raw 基名 → 游戏内 qinglian_* 文件名（无 .png）
PAIRS=(
  "xianqi_wisteria_vanity:qinglian_wisteria_vanity"
  "xianqi_lotus_canopy_bed:qinglian_lotus_canopy_bed"
  "xianqi_silk_daybed:qinglian_silk_daybed"
  "xianqi_cherry_wardrobe:qinglian_cherry_wardrobe"
  "xianqi_wisteria_arch:qinglian_wisteria_arch"
  "xianqi_cloud_book_desk:qinglian_cloud_book_desk"
  "xianqi_peony_screen:qinglian_peony_screen"
  "xianqi_moon_shelf:qinglian_moon_shelf"
  "xianqi_bamboo_window:qinglian_bamboo_window"
  "xianqi_guqin_stand:qinglian_guqin_stand"
  "xianqi_lotus_pond_table:qinglian_lotus_pond_table"
  "xianqi_lotus_screen:qinglian_lotus_screen"
  "xianqi_lotus_candelabra:qinglian_lotus_lamp"
  "xianqi_pink_scholar_rock:qinglian_scholar_rock"
  "xianqi_koi_bench:qinglian_koi_bench"
  "xianqi_lantern_frame:qinglian_lantern_frame"
  "xianqi_ribbon_canopy:qinglian_ribbon_canopy"
  "xianqi_cloud_rug:qinglian_cloud_rug"
  "xianqi_tea_shelf:qinglian_tea_shelf"
  "xianqi_blossom_cart:qinglian_flower_cart"
)

process_one() {
  local xianqi="$1" out_id="$2"
  local src="$RAW_BATCH/${xianqi}_nb2.png"
  [[ -f "$src" ]] || { echo "MISSING $src" >&2; return 1; }
  echo "==> $out_id  (from ${xianqi}_nb2.png, max-side $MAX_SIDE)"
  python3 "$REMBG" "$src" -o "$SPLIT/${out_id}_cut.png" -m birefnet-general
  python3 "$CROP" "$SPLIT/${out_id}_cut.png" -o "$SPLIT/${out_id}_trim.png" --padding 4
  cp "$SPLIT/${out_id}_trim.png" "$OUT/${out_id}.png"
}

for entry in "${PAIRS[@]}"; do
  process_one "${entry%%:*}" "${entry##*:}"
done

OUT_LIST=()
for entry in "${PAIRS[@]}"; do
  OUT_LIST+=("$OUT/${entry##*:}.png")
done
python3 scripts/compress_furniture_deco_pngs.py --max-side "$MAX_SIDE" --force "${OUT_LIST[@]}"

echo "Done: ${#PAIRS[@]} qinglian furniture @ max-side=$MAX_SIDE"
