#!/usr/bin/env bash
# 清涟荷影店主 v2：白底 + 平面漫画风 → raw → rembg 入库
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RAW="${GAME_ASSETS_HUAHUA:-$ROOT/../game_assets/huahua}/assets/raw"
mkdir -p "$RAW"
GEN="${GEMINI_SCRIPT:-$HOME/.cursor/skills/gemini-image-gen/scripts/generate_images.py}"
CHIBI_REF="minigame/subpkg_chars/images/owner/chibi_default.png"

export GEMINI_IMAGE_SIZE="${GEMINI_IMAGE_SIZE:-1K}"

echo "== dual full-body (16:9 white) =="
python3 "$GEN" \
  --prompt-file docs/prompt/owner_outfit_qinglian_p1p2_dual_nb2_prompt.txt \
  --output "$RAW/owner_outfit_qinglian_dual_nb2.png" \
  --model gemini-3.1-flash-image-preview \
  --aspect-ratio 16:9

echo "== bust (9:16 white, ref chibi_default) =="
python3 "$GEN" \
  --prompt-file docs/prompt/owner_outfit_qinglian_p3_chibi_nb2_prompt.txt \
  --output "$RAW/owner_outfit_qinglian_p3.png" \
  --model gemini-3.1-flash-image-preview \
  --aspect-ratio 9:16 \
  --image "$CHIBI_REF"

echo "== split + rembg ingest =="
python3 scripts/gen_owner_outfit_qinglian_dual_sheet.py --skip-gen
PYTHONPATH=scripts python3 scripts/reprocess_owner_outfit_qinglian_sprites.py
echo "done: minigame/subpkg_chars/images/owner/full_outfit_qinglian*.png chibi_outfit_qinglian.png"
