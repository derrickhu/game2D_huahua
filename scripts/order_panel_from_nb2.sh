#!/usr/bin/env bash
# NB2 原图（白底）→ rembg → 裁透明边 → 缩放入库 order_panel_satin_nb2.png
# 提示词须与 board_bar 同源：docs/prompt/order_panel_nb2_match_board_bar_style.txt
# 须在仓库根执行；NB2 走本机 HTTPS_PROXY（与 gemini-image-gen 技能一致）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEN="${GEN:-$HOME/.cursor/skills/gemini-image-gen/scripts/generate_images.py}"
REMBG="${REMBG:-$HOME/.cursor/skills/remove-background/scripts/rembg_single.py}"
CROP="${CROP:-$HOME/.cursor/skills/game-art-pipeline/scripts/crop_trim.py}"
PROMPT="$ROOT/docs/prompt/order_panel_nb2_match_board_bar_style.txt"
RAW="${1:-$ROOT/../game_assets/huahua/assets/raw/order_panel_nb2_match_board_bar_raw.png}"
NOBG="${2:-$ROOT/../game_assets/huahua/assets/raw/order_panel_nb2_match_board_bar_nobg.png}"
TRIM="${3:-$ROOT/../game_assets/huahua/assets/raw/order_panel_nb2_match_board_bar_trim.png}"
OUT_UI="$ROOT/minigame/images/ui/order_panel_satin_nb2.png"

if [[ ! -f "$GEN" ]]; then
  echo "未找到 generate_images.py: $GEN" >&2
  exit 1
fi
if [[ ! -f "$PROMPT" ]]; then
  echo "未找到提示词: $PROMPT" >&2
  exit 1
fi

mkdir -p "$(dirname "$RAW")"
echo "=== NB2 (gemini-3.1-flash-image-preview, 16:9) ==="
python3 "$GEN" \
  --prompt-file "$PROMPT" \
  --output "$RAW" \
  --model gemini-3.1-flash-image-preview \
  --aspect-ratio 16:9

if [[ ! -f "$REMBG" ]]; then
  echo "未找到 rembg_single.py: $REMBG" >&2
  exit 1
fi
echo "=== rembg birefnet-general ==="
python3 "$REMBG" "$RAW" -o "$NOBG" -m birefnet-general

if [[ ! -f "$CROP" ]]; then
  echo "未找到 crop_trim.py: $CROP" >&2
  exit 1
fi
echo "=== crop_trim --padding 4 ==="
python3 "$CROP" "$NOBG" -o "$TRIM" --padding 4

echo "=== resize max width 640 → $OUT_UI ==="
python3 - <<PY
from PIL import Image
from pathlib import Path
src = Path("$TRIM")
dst = Path("$OUT_UI")
im = Image.open(src).convert("RGBA")
w, h = im.size
max_w = 640
if w > max_w:
    nh = max(1, int(round(h * (max_w / w))))
    im = im.resize((max_w, nh), Image.Resampling.LANCZOS)
im.save(dst, "PNG", optimize=True, compress_level=9)
print(dst, im.size, dst.stat().st_size, "bytes")
PY

echo "完成: $OUT_UI（TextureCache order_panel 已指向此文件）"
