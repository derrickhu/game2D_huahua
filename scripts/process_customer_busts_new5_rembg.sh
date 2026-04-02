#!/usr/bin/env bash
# 从 2×4 客人表切 5 张（索引 0,1,2,3,5），仅用 rembg birefnet-general 抠图（禁止颜色键）。
# 依赖：~/.cursor/skills/remove-background 与 game-art-pipeline
set -euo pipefail
SKILL="${SKILL:-$HOME/.cursor/skills}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$ROOT/../game_assets/huahua"}"
WORK="$GA/assets"
GRID="${1:-$WORK/raw/customer_busts_new5_grid_user.png}"
SPLIT="$WORK/split/customer_rembg_birefnet"
NOBG="$WORK/nobg/customer_rembg_birefnet"
FINAL="$WORK/final/customer_rembg_birefnet"
OUT_GAME="$ROOT/minigame/subpkg_chars/images/customer"

mkdir -p "$SPLIT" "$NOBG" "$FINAL"
python3 "$SKILL/game-art-pipeline/scripts/split_grid.py" "$GRID" 4 2 -o "$SPLIT" \
  --pick 0,1,2,3,5 --names couple,birthday,blogger,noble,collector --margin 4
python3 "$SKILL/remove-background/scripts/rembg_batch.py" "$SPLIT" -o "$NOBG" -m birefnet-general
python3 "$SKILL/game-art-pipeline/scripts/crop_trim.py" "$NOBG" -o "$FINAL" --padding 4
python3 - "$FINAL" "$OUT_GAME" << 'PY'
import os, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
H, WMAX = 256, 240
for name in ["couple", "birthday", "blogger", "noble", "collector"]:
    im = Image.open(os.path.join(src, f"{name}.png")).convert("RGBA")
    w, h = im.size
    nw = max(1, int(round(w * H / h)))
    nh = H
    if nw > WMAX:
        nh = max(1, int(round(h * WMAX / w)))
        nw = WMAX
    out = im.resize((nw, nh), Image.Resampling.LANCZOS)
    out.save(os.path.join(dst, f"{name}.png"))
    print(name, out.size)
PY
echo "Done -> $OUT_GAME"
