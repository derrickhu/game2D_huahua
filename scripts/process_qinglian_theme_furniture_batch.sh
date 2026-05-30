#!/usr/bin/env bash
# 清涟荷影主题扩展家具 14 件：raw 归档 → rembg → crop → furniture/ → compress
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
ASSETS="$HOME/.cursor/projects/Users-rosa-rosa-games-game2D-huahua/assets"
RAW="${GAME_ASSETS_HUAHUA:-../game_assets/huahua}/assets/raw"
SPLIT="${GAME_ASSETS_HUAHUA:-../game_assets/huahua}/assets/split"
OUT="minigame/subpkg_deco/images/furniture"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
mkdir -p "$RAW" "$SPLIT" "$OUT"

process() {
  local src="$1" id="$2"
  echo "==> $id"
  cp "$src" "$RAW/${id}_nb2.png"
  python3 "$REMBG" "$RAW/${id}_nb2.png" -o "$SPLIT/${id}.png" -m birefnet-general
  python3 "$CROP" "$SPLIT/${id}.png" -o "$SPLIT/${id}_trim.png" --padding 4
  cp "$SPLIT/${id}_trim.png" "$OUT/${id}.png"
}

process "$ASSETS/xianqi_tea_shelf_nb2-3307d1c2-64eb-425b-a9d7-9dc5b4b576ad.png" qinglian_tea_shelf
process "$ASSETS/xianqi_lantern_frame_nb2-7dcdcab3-fa39-45a8-903a-b2e56393b6a7.png" qinglian_lantern_frame
process "$ASSETS/xianqi_pink_scholar_rock_nb2-7cc51ee1-db2b-4c8d-9edf-84b477ab62c0.png" qinglian_scholar_rock
process "$ASSETS/xianqi_guqin_stand_nb2-bb0dbc7f-ff50-4163-8f56-9a024381a7d6.png" qinglian_guqin_stand
process "$ASSETS/xianqi_bamboo_window_nb2-1171e363-e469-435d-9b05-b11351062206.png" qinglian_bamboo_window
process "$ASSETS/xianqi_moon_shelf_nb2-98c9e843-97bb-4bd9-8aa1-4f2fa1260da8.png" qinglian_moon_shelf
process "$ASSETS/xianqi_peony_screen_nb2-4ecec76c-f88e-48e4-a873-d79d71b2c5ea.png" qinglian_peony_screen
process "$ASSETS/xianqi_cloud_book_desk_nb2-67938aa9-9ce2-4b1a-9e4e-90d8bd92f610.png" qinglian_cloud_book_desk
process "$ASSETS/xianqi_cherry_wardrobe_nb2-bb67644c-4006-4384-9928-9b9033dba6fb.png" qinglian_cherry_wardrobe
process "$ASSETS/xianqi_silk_daybed_nb2-9f96e290-723e-4549-8c3a-9316d463acf4.png" qinglian_silk_daybed
process "$ASSETS/xianqi_lotus_canopy_bed_nb2-505e94a3-2e8f-4cb3-a450-ff9ef76d3a1f.png" qinglian_lotus_canopy_bed
process "$ASSETS/xianqi_wisteria_vanity_nb2-e9660436-a3b0-4a33-9150-b27ac5b386f1.png" qinglian_wisteria_vanity
process "$ASSETS/xianqi_wisteria_arch_nb2-aa92c7fd-decf-440c-b5fc-e9079462b756.png" qinglian_wisteria_arch
process "$ASSETS/xianqi_ribbon_canopy_nb2-86a64f19-ed1f-45f7-8881-bd8a7dc72100.png" qinglian_ribbon_canopy

python3 scripts/compress_furniture_deco_pngs.py --force "$OUT"/qinglian_tea_shelf.png "$OUT"/qinglian_lantern_frame.png "$OUT"/qinglian_scholar_rock.png "$OUT"/qinglian_guqin_stand.png "$OUT"/qinglian_bamboo_window.png "$OUT"/qinglian_moon_shelf.png "$OUT"/qinglian_peony_screen.png "$OUT"/qinglian_cloud_book_desk.png "$OUT"/qinglian_cherry_wardrobe.png "$OUT"/qinglian_silk_daybed.png "$OUT"/qinglian_lotus_canopy_bed.png "$OUT"/qinglian_wisteria_vanity.png "$OUT"/qinglian_wisteria_arch.png "$OUT"/qinglian_ribbon_canopy.png
echo "Done 14 qinglian theme furniture PNGs."
