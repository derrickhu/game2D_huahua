#!/usr/bin/env bash
# 三件早期花架（shelf_wood / shelf_step / shelf_iron）按近期精致画风重绘
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$WS/../game_assets/huahua"}"
RAW="$GA/assets/raw/shelf_style_refresh"
mkdir -p "$RAW"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
OUT="$WS/minigame/subpkg_deco/images/furniture"
STYLE_REF="$OUT/orn_flora_fiddle_leaf_pot.png"

export GEMINI_IMAGE_NO_PROXY="${GEMINI_IMAGE_NO_PROXY:-1}"
export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"

make_composite() {
  local old="$1" out="$2"
  python3 - <<PY
from pathlib import Path
from PIL import Image

style = Path("$STYLE_REF")
old = Path("$old")
out = Path("$out")
if not style.is_file():
    raise SystemExit(f"missing style ref: {style}")
if not old.is_file():
    raise SystemExit(f"missing layout ref: {old}")

def fit_h(im: Image.Image, h: int) -> Image.Image:
    im = im.convert("RGBA")
    s = h / im.height
    nw = max(1, int(round(im.width * s)))
    return im.resize((nw, h), Image.Resampling.LANCZOS)

H = 480
left = fit_h(Image.open(style), H)
right = fit_h(Image.open(old), H)
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
  local key="$1" old_png="$2"
  local composite="$RAW/${key}_style_layout_composite.png"
  local raw_out="$RAW/furniture_${key}_nb2.png"
  echo "=== $key ==="
  make_composite "$old_png" "$composite"
  local ok=0
  for attempt in 1 2 3 4 5 6 7 8; do
    python3 "$GEN" --prompt-file "$WS/docs/prompt/furniture_${key}_nb2_prompt.txt" \
      --output "$raw_out" \
      --model gemini-3.1-flash-image-preview \
      --aspect-ratio 1:1 \
      --image "$composite" && [ -s "$raw_out" ] && ok=1 && break
    sleep 20
  done
  [ "$ok" = "1" ] || { echo "FAILED generate: $key"; exit 1; }
  local tmp="$RAW/furniture_${key}_nobg.png"
  python3 "$REMBG" "$raw_out" -o "$tmp" -m birefnet-general
  python3 "$CROP" "$tmp" -o "$OUT/${key}.png" --padding 4
  python3 "$WS/scripts/compress_furniture_deco_pngs.py" --force --max-side 171 "$OUT/${key}.png"
}

gen_one shelf_wood "$OUT/shelf_wood.png"
gen_one shelf_step "$OUT/shelf_step.png"
gen_one shelf_iron "$OUT/shelf_iron.png"

echo "OK: shelf_wood / shelf_step / shelf_iron refreshed under $OUT/"
