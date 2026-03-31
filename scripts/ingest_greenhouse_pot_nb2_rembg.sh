#!/usr/bin/env bash
# 将 game_assets raw 中的 furniture_greenhouse_pot_*_nb2.png 抠图、裁边、缩放到 MAX_SIDE 写入 minigame 家具目录。
set -euo pipefail
RAW="${RAW:-/Users/huyi/rosa_games/game_assets/huahua/assets/raw}"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/minigame/subpkg_deco/images/furniture"
MAX="${MAX_SIDE:-171}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for f in "$RAW"/furniture_greenhouse_pot_*_nb2.png; do
  [[ -f "$f" ]] || continue
  base="$(basename "$f" _nb2.png)"
  key="${base#furniture_}"
  echo "=== $key ==="
  python3 "$REMBG" "$f" -o "$TMP/nobg.png" -m birefnet-general
  python3 "$CROP" "$TMP/nobg.png" -o "$TMP/trim.png" --padding 4
  python3 - "$TMP/trim.png" "$OUT/${key}.png" "$MAX" << 'PY'
import sys
from pathlib import Path
from PIL import Image
src, dst, mx = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
im = Image.open(src).convert("RGBA")
w, h = im.size
s = min(mx / w, mx / h, 1.0)
if s < 1.0:
    im = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.Resampling.LANCZOS)
dst.parent.mkdir(parents=True, exist_ok=True)
im.save(dst, format="PNG", optimize=True, compress_level=9)
print(dst, im.size, dst.stat().st_size // 1024, "KB")
PY
done
echo "Done -> $OUT"
