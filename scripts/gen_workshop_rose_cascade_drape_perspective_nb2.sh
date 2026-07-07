#!/usr/bin/env bash
# 玫瑰垂幔帘三色：修正墙饰等距透视 → rembg → 合图 sheet（342/格）
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$WS/../game_assets/huahua"}"
RAW="$GA/assets/raw/workshop_rose_cascade_perspective_fix"
mkdir -p "$RAW"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
OUT="$WS/minigame/subpkg_deco/images/furniture"
PERSP_REF="$OUT/deco_lv20_wall_moon_sheer_curtain.png"
DESIGN_REF="${DESIGN_REF:-$WS/.tmp/workshop_rose_cascade_hq/workshop_rose_cascade_drape.png}"
COMPOSITE_REF="$RAW/rose_cascade_perspective_design_composite.png"

export GEMINI_IMAGE_NO_PROXY="${GEMINI_IMAGE_NO_PROXY:-1}"
export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"

python3 - <<PY
from pathlib import Path
from PIL import Image

persp = Path("$PERSP_REF")
design = Path("$DESIGN_REF")
out = Path("$COMPOSITE_REF")
if not persp.is_file():
    raise SystemExit(f"missing perspective ref: {persp}")
if not design.is_file():
    raise SystemExit(f"missing design ref: {design}")

def fit_h(im: Image.Image, h: int) -> Image.Image:
    im = im.convert("RGBA")
    s = h / im.height
    nw = max(1, int(round(im.width * s)))
    return im.resize((nw, h), Image.Resampling.LANCZOS)

H = 480
left = fit_h(Image.open(persp), H)
right = fit_h(Image.open(design), H)
gap = 24
canvas = Image.new("RGBA", (left.width + gap + right.width, H), (255, 255, 255, 255))
canvas.paste(left, (0, 0), left)
canvas.paste(right, (left.width + gap, 0), right)
out.parent.mkdir(parents=True, exist_ok=True)
canvas.save(out)
print("composite ref ->", out, canvas.size)
PY

gen_one() {
  local key="$1" prompt="$2" ref="$3" raw_out="$4"
  echo "=== $key ==="
  local ok=0
  for attempt in 1 2 3 4 5 6 7 8; do
    python3 "$GEN" --prompt-file "$prompt" \
      --output "$raw_out" \
      --model gemini-3.1-flash-image-preview \
      --aspect-ratio 1:1 \
      --image "$ref" && [ -s "$raw_out" ] && ok=1 && break
    sleep 20
  done
  [ "$ok" = "1" ] || { echo "FAILED generate: $key"; exit 1; }
}

RAW_PINK="$RAW/workshop_rose_cascade_drape_nb2.png"
RAW_SKY="$RAW/workshop_rose_cascade_drape_sky_nb2.png"
RAW_HONEY="$RAW/workshop_rose_cascade_drape_honey_nb2.png"

gen_one pink \
  "$WS/docs/prompt/furniture_workshop_rose_cascade_drape_nb2_prompt.txt" \
  "$COMPOSITE_REF" \
  "$RAW_PINK"

NOBG_PINK="$RAW/workshop_rose_cascade_drape_nobg.png"
python3 "$REMBG" "$RAW_PINK" -o "$NOBG_PINK" -m birefnet-general
python3 "$CROP" "$NOBG_PINK" -o "$RAW/workshop_rose_cascade_drape_cell.png" --padding 4

gen_one sky \
  "$WS/docs/prompt/furniture_workshop_rose_cascade_drape_sky_nb2_prompt.txt" \
  "$RAW/workshop_rose_cascade_drape_cell.png" \
  "$RAW_SKY"

gen_one honey \
  "$WS/docs/prompt/furniture_workshop_rose_cascade_drape_honey_nb2_prompt.txt" \
  "$RAW/workshop_rose_cascade_drape_cell.png" \
  "$RAW_HONEY"

for variant in sky honey; do
  src="$RAW/workshop_rose_cascade_drape_${variant}_nb2.png"
  nobg="$RAW/workshop_rose_cascade_drape_${variant}_nobg.png"
  cell="$RAW/workshop_rose_cascade_drape_${variant}_cell.png"
  python3 "$REMBG" "$src" -o "$nobg" -m birefnet-general
  python3 "$CROP" "$nobg" -o "$cell" --padding 4
done

python3 "$WS/scripts/process_furniture_atlas_sheet.py" \
  --compose "$RAW/workshop_rose_cascade_drape_cell.png" \
  --compose "$RAW/workshop_rose_cascade_drape_sky_cell.png" \
  --compose "$RAW/workshop_rose_cascade_drape_honey_cell.png" \
  --columns 1 --rows 3 --max-side 342 \
  -o "$OUT/workshop_rose_cascade_drape_sheet.png"

echo "OK: sheet -> $OUT/workshop_rose_cascade_drape_sheet.png"
