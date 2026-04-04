#!/usr/bin/env bash
# NB2 原图 → rembg 抠图 → 缩放入库 board_bar.png（须在仓库根执行）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMBG="${REMBG:-$HOME/.cursor/skills/remove-background/scripts/rembg_single.py}"
RAW="${1:-$ROOT/minigame/images/ui/board_bar_nb2_raw.png}"
NOBG="${2:-$ROOT/minigame/images/ui/board_bar_nb2_nobg.png}"

if [[ ! -f "$REMBG" ]]; then
  echo "未找到 rembg_single.py: $REMBG" >&2
  exit 1
fi
if [[ ! -f "$RAW" ]]; then
  echo "未找到原图: $RAW" >&2
  exit 1
fi

python3 "$REMBG" "$RAW" -o "$NOBG" -m birefnet-general
python3 "$ROOT/scripts/ingest_board_bar_nb2.py" "$NOBG"
