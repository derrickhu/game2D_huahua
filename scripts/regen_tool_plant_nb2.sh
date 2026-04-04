#!/usr/bin/env bash
# 园艺工具 plant 线 1–7：NB2 生图 → rembg → crop_trim → 写入 subpkg_items → 全目录压缩
# 依赖：gemini-image-gen、remove-background skill、game-art-pipeline crop_trim、仓库根 compress_subpkg_items_pngs.py
# L4（育苗仓）：若已有生态舱原图，可跳过生成，仅用 RAW_L4 走抠图分支。

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="${GAME_ASSETS_HUAHUA:-$ROOT/../game_assets/huahua}/assets/raw"
PLANT_DIR="$ROOT/minigame/subpkg_items/images/tools/plant"
REF_IMG="$ROOT/minigame/subpkg_items/images/tools/bake/tool_bake_2.png"
GEN="$HOME/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="$HOME/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="$HOME/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
MODEL="${GEMINI_PLANT_MODEL:-gemini-3.1-flash-image-preview}"
# 育苗仓定稿请单独保存，避免与 L7 生成文件名冲突
RAW_L4="${TOOL_PLANT_L4_RAW:-$RAW/tool_plant_4_nursery_nb2.png}"
RAW_L4_FALLBACK="$RAW/tool_plant_7_nb2.png"

mkdir -p "$RAW" "$PLANT_DIR"

gen_one() {
  local n="$1"
  echo "=== generate tool_plant_$n ==="
  GEMINI_IMAGE_REST_ONLY=1 python3 "$GEN" \
    --prompt-file "$ROOT/docs/prompt/tool_plant_${n}_nb2_prompt.txt" \
    --output "$RAW/tool_plant_${n}_nb2.png" \
    --model "$MODEL" \
    --image "$REF_IMG" \
    --aspect-ratio 1:1
}

finish_one() {
  local n="$1"
  local src="$2"
  local tmp="$PLANT_DIR/.tool_plant_${n}_nobg.png"
  echo "=== rembg + trim tool_plant_$n ==="
  python3 "$REMBG" "$src" -o "$tmp" -m birefnet-general
  python3 "$CROP" "$tmp" -o "$PLANT_DIR/tool_plant_${n}.png" --padding 4
  rm -f "$tmp"
}

usage() {
  echo "Usage: $0 [all|4only|gen-missing]"
  echo "  all        — 生成 1–3,5–7；L4 用 TOOL_PLANT_L4_RAW 或 tool_plant_4_nursery_nb2.png（或回退 tool_plant_7_nb2）抠图"
  echo "  4only      — 仅 L4：从 TOOL_PLANT_L4_RAW / tool_plant_4_nursery_nb2 / tool_plant_7_nb2 抠图入库"
  echo "  gen-missing — 仅对缺失的 RAW tool_plant_*_nb2.png 调用生成（不覆盖已有 RAW）"
}

case "${1:-}" in
  4only)
    src="$RAW_L4"
    [[ -f "$src" ]] && [[ -s "$src" ]] || src="$RAW_L4_FALLBACK"
    [[ -f "$src" ]] || { echo "Missing L4 raw (set TOOL_PLANT_L4_RAW or add $RAW_L4 or $RAW_L4_FALLBACK)"; exit 1; }
    finish_one 4 "$src"
    ;;
  gen-missing)
    for n in 1 2 3 5 6 7; do
      f="$RAW/tool_plant_${n}_nb2.png"
      if [[ ! -f "$f" ]]; then gen_one "$n"; sleep 4; else echo "skip gen $n (exists)"; fi
    done
    ;;
  all|"")
    l4src="$RAW_L4"
    [[ -f "$l4src" ]] && [[ -s "$l4src" ]] || l4src="$RAW_L4_FALLBACK"
    [[ -f "$l4src" ]] || { echo "Missing L4 nursery raw. Save 育苗仓 NB2 as $RAW/tool_plant_4_nursery_nb2.png or $RAW_L4_FALLBACK"; exit 1; }
    finish_one 4 "$l4src"
    for n in 1 2 3 5 6 7; do
      gen_one "$n"
      sleep 5
    done
    for n in 1 2 3 5 6 7; do
      finish_one "$n" "$RAW/tool_plant_${n}_nb2.png"
    done
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage
    exit 1
    ;;
esac

echo "=== compress subpkg_items PNGs ==="
cd "$ROOT" && python3 scripts/compress_subpkg_items_pngs.py
echo "Done."
