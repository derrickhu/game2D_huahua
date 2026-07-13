#!/usr/bin/env bash
# 柔纱短帘 + 玫瑰垂幔：NB2 1K 清晰重绘（锁造型）→ 仅输出预览，不入库 minigame
# ONLY_KEYS="wallart_lace_curtain" ./scripts/preview_wallart_curtains_nb2.sh
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$WS/../game_assets/huahua"}"
RAW="$GA/assets/raw/wallart_curtains_nb2_preview"
PREVIEW="$GA/assets/preview_wallart_curtains_nb2"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
PERSP_REF="$WS/minigame/subpkg_deco/images/furniture/deco_lv20_wall_moon_sheer_curtain.png"
mkdir -p "$RAW" "$PREVIEW" "$WS/.tmp/preview_wallart_curtains_nb2"

export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"
export GEMINI_IMAGE_NO_PROXY="${GEMINI_IMAGE_NO_PROXY:-1}"
MODEL="${GEMINI_WALLART_MODEL:-gemini-3.1-flash-image-preview}"
MAX_SIDE="${MAX_SIDE:-342}"

ALL_KEYS=(wallart_lace_curtain wallart_rose_swag_drape)
if [[ -n "${ONLY_KEYS:-}" ]]; then
  read -r -a KEYS <<< "${ONLY_KEYS}"
else
  KEYS=("${ALL_KEYS[@]}")
fi

design_ref_for() {
  case "$1" in
    wallart_lace_curtain)
      echo "${LACE_DESIGN_REF:-$GA/assets/raw/wallart_regen/wallart_lace_curtain_nobg.png}"
      ;;
    wallart_rose_swag_drape)
      echo "${ROSE_DESIGN_REF:-$GA/assets/raw/wallart_regen/wallart_rose_swag_drape_nobg.png}"
      ;;
    *) echo "" ;;
  esac
}

make_composite() {
  local design="$1" out="$2"
  python3 - <<PY
from pathlib import Path
from PIL import Image

persp = Path("$PERSP_REF")
design = Path("$design")
out = Path("$out")
if not persp.is_file():
    raise SystemExit(f"missing perspective ref: {persp}")
if not design.is_file():
    raise SystemExit(f"missing design ref: {design}")

def fit_h(im: Image.Image, h: int) -> Image.Image:
    im = im.convert("RGBA")
    s = h / im.height
    nw = max(1, int(round(im.width * s)))
    return im.resize((nw, h), Image.Resampling.LANCZOS)

H = 520
left = fit_h(Image.open(persp), H)
right = fit_h(Image.open(design), H)
gap = 24
canvas = Image.new("RGBA", (left.width + gap + right.width, H), (255, 255, 255, 255))
canvas.paste(left, (0, 0), left)
canvas.paste(right, (left.width + gap, 0), right)
out.parent.mkdir(parents=True, exist_ok=True)
canvas.save(out)
print("composite ->", out, canvas.size)
PY
}

gen_one() {
  local key="$1"
  local design_ref composite pf raw_out tmp preview_out
  design_ref="$(design_ref_for "$key")"
  composite="$RAW/${key}_layout_composite.png"
  pf="$WS/docs/prompt/${key}_isometric_nb2_prompt.txt"
  raw_out="$RAW/${key}_isometric_nb2.png"
  preview_out="$PREVIEW/${key}.png"
  echo "=== $key NB2 1K preview (max-side $MAX_SIDE) ==="
  [ -f "$pf" ] || { echo "missing prompt $pf"; exit 1; }
  make_composite "$design_ref" "$composite"
  local ok=0
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    python3 "$GEN" --prompt-file "$pf" \
      --output "$raw_out" \
      --model "$MODEL" \
      --aspect-ratio 3:4 \
      --image-size 1K \
      --image "$composite" && [ -s "$raw_out" ] && ok=1 && break
    sleep 30
  done
  [ "$ok" = "1" ] || { echo "FAILED generate: $key"; exit 1; }
  tmp="$RAW/${key}_nobg.png"
  python3 "$REMBG" "$raw_out" -o "$tmp" -m birefnet-general
  python3 "$CROP" "$tmp" -o "$preview_out" --padding 4
  rm -f "$tmp"
  local ref_angle cur_angle skewed
  ref_angle="$(python3 - <<PY
import re, subprocess, sys
out = subprocess.check_output([
    sys.executable, "$WS/scripts/adjust_wallart_angle.py", "measure", "$PERSP_REF"
], text=True)
m = re.search(r"([0-9]+\.[0-9]+)", out)
print(m.group(1) if m else "")
PY
)"
  if [[ -n "${ref_angle:-}" ]]; then
    cur_angle="$(python3 - <<PY
import re, subprocess, sys
out = subprocess.check_output([
    sys.executable, "$WS/scripts/adjust_wallart_angle.py", "measure", "$preview_out"
], text=True)
m = re.search(r"([0-9]+\.[0-9]+)", out)
print(m.group(1) if m else "")
PY
)"
    echo "  angle: ${cur_angle:-?}° -> target ${ref_angle}°"
    if [[ -n "${cur_angle:-}" ]] && python3 - <<PY
cur=float("$cur_angle"); tgt=float("$ref_angle")
print(1 if abs(cur-tgt) > 0.35 else 0)
PY
    then
      skewed="$RAW/${key}_skewed.png"
      python3 "$WS/scripts/adjust_wallart_angle.py" skew "$preview_out" -o "$skewed" --target "$ref_angle"
      mv "$skewed" "$preview_out"
    fi
  fi
  python3 "$WS/scripts/fit_furniture_max_side.py" --max-side "$MAX_SIDE" "$preview_out"
  cp "$preview_out" "$WS/.tmp/preview_wallart_curtains_nb2/${key}.png"
  python3 "$WS/scripts/adjust_wallart_angle.py" measure "$preview_out"
}

for k in "${KEYS[@]}"; do
  gen_one "$k"
done
echo "PREVIEW ONLY (not in minigame):"
echo "  $PREVIEW/"
echo "  $WS/.tmp/preview_wallart_curtains_nb2/"
