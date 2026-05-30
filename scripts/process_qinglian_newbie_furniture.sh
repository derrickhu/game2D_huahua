#!/usr/bin/env bash
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$HOME/.cursor/projects/Users-rosa-rosa-games-game2D-huahua/assets"
RAW="$REPO/../game_assets/huahua/assets/raw"
SPLIT="$REPO/../game_assets/huahua/assets/split"
OUT="$REPO/minigame/subpkg_deco/images/furniture"
REMBG="python3 /Users/rosa/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="python3 /Users/rosa/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
mkdir -p "$RAW" "$SPLIT" "$OUT"
process() { local src="$1" id="$2"; echo "==> $id"; cp "$src" "$RAW/${id}_nb2.png"; $REMBG "$RAW/${id}_nb2.png" -o "$SPLIT/${id}.png" -m birefnet-general; $CROP "$SPLIT/${id}.png" -o "$SPLIT/${id}_trim.png" --padding 4; cp "$SPLIT/${id}_trim.png" "$OUT/${id}.png"; }
process "$ASSETS/3a27b348-49de-49ad-b714-e07239b2654a-27fa5c13-1002-40fd-8cf0-0843dd92cabb.png" qinglian_flower_cart
process "$ASSETS/8c0fd32c-8397-49f5-bcee-0823247f00b1-e9925581-2417-46e1-9d7d-ffa79a1824ac.png" qinglian_cloud_rug
process "$ASSETS/c0e2d5ba-79d5-492f-8d81-6d8e29a3b2f6-ea2b187e-4f72-4e16-bb24-eb2349ed74ea.png" qinglian_koi_bench
process "$ASSETS/f87e6c4d-daa4-451c-9121-a606901a7e01-a4480f41-f383-4f17-bf1f-252def490afa.png" qinglian_lotus_screen
process "$ASSETS/00296f30-6803-4058-b6e8-d33f27cceef4-68a92000-3d8b-4da0-85a3-626c345b4f29.png" qinglian_lotus_lamp
process "$ASSETS/1fc329c8-104f-4b1e-929c-596e1e1db689-519abaf0-4c17-4fcc-a834-70557eb7ee7c.png" qinglian_lotus_pond_table
cd "$REPO" && python3 scripts/compress_furniture_deco_pngs.py --max-side "${MAX_SIDE:-512}" --force minigame/subpkg_deco/images/furniture/qinglian_*.png
