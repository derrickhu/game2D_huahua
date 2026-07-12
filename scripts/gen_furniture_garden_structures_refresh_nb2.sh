#!/usr/bin/env bash
# 藤蔓凉亭 / 玫瑰花廊 / 樱花花架 — NB2 重绘（工坊线稿、自然接地、等距）→ rembg → crop_trim → 大件最长边 342
# 断点续跑: ONLY_KEYS="shelf_spring" MAX_SIDE=342 ./scripts/gen_furniture_garden_structures_refresh_nb2.sh
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$WS/../game_assets/huahua"}"
RAW="$GA/assets/raw"
mkdir -p "$RAW"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
OUT="$WS/minigame/subpkg_deco/images/furniture"
mkdir -p "$OUT"

export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"
MODEL="${GEMINI_IMAGE_MODEL:-gemini-3.1-flash-image-preview}"

ALL_KEYS=(garden_arbor garden_arch shelf_spring)
if [[ -n "${ONLY_KEYS:-}" ]]; then
  read -r -a KEYS <<< "${ONLY_KEYS}"
else
  KEYS=("${ALL_KEYS[@]}")
fi

for k in "${KEYS[@]}"; do
  pf="$WS/docs/prompt/furniture_${k}_nb2_prompt.txt"
  raw_out="$RAW/furniture_${k}_nb2.png"
  echo "=== $k ==="
  [ -f "$pf" ] || { echo "missing prompt $pf"; exit 1; }
  img_args=()
  if [[ "$k" == "garden_arch" ]]; then
    arch_ref="${GARDEN_ARCH_REF:-$WS/.tmp/garden_arch_prev.png}"
    iso_ref="$WS/docs/prompt/refs/furniture_iso_grid_pm30.png"
    composite="$RAW/furniture_${k}_layout_composite.png"
    [ -f "$arch_ref" ] || arch_ref="/tmp/garden_arch_old.png"
    python3 - <<PY
from pathlib import Path
from PIL import Image

arch = Path("$arch_ref")
iso = Path("$iso_ref")
out = Path("$composite")

def fit_h(im: Image.Image, h: int) -> Image.Image:
    im = im.convert("RGBA")
    s = h / im.height
    nw = max(1, int(round(im.width * s)))
    return im.resize((nw, h), Image.Resampling.LANCZOS)

H = 480
left = fit_h(Image.open(arch), H)
right = fit_h(Image.open(iso), H)
gap = 24
canvas = Image.new("RGBA", (left.width + gap + right.width, H), (255, 255, 255, 255))
canvas.paste(left, (0, 0), left)
canvas.paste(right, (left.width + gap, 0), right)
out.parent.mkdir(parents=True, exist_ok=True)
canvas.save(out)
print("composite ->", out, canvas.size)
PY
    img_args=(--image "$composite")
  fi
  ok=0
  for attempt in 1 2 3 4 5 6 7 8; do
    python3 "$GEN" --prompt-file "$pf" \
      --output "$raw_out" \
      --model "$MODEL" \
      --aspect-ratio 1:1 \
      "${img_args[@]}" && [ -s "$raw_out" ] && ok=1 && break
    sleep 30
  done
  [ "$ok" = "1" ] || { echo "FAILED generate: $k"; exit 1; }
  tmp="$RAW/furniture_${k}_nobg.png"
  python3 "$REMBG" "$raw_out" -o "$tmp" -m birefnet-general
  python3 "$CROP" "$tmp" -o "$OUT/${k}.png" --padding 4
  rm -f "$tmp"
  python3 "$WS/scripts/compress_furniture_deco_pngs.py" --force --max-side "${MAX_SIDE:-342}" "$OUT/${k}.png"
  sleep 8
done
echo "OK: raw under $RAW, game PNG under $OUT/"
