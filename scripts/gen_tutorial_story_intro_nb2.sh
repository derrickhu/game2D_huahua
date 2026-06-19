#!/usr/bin/env bash
# NB2 新手开场点题：场景插画风人物 + 保留现成场景配色
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ASSETS="${GAME_ASSETS_HUAHUA:-../game_assets/huahua}/assets"
PR="docs/prompt"
REF_SCENE="${TUTORIAL_STORY_INTRO_CURRENT:-minigame/images/tutorial/story_1.png}"
REF_STYLE="${TUTORIAL_STORY_INTRO_STYLE:-../game_assets/huahua/assets/refs/game_circle_topic_huahua_900x506.png}"
REF_COMPOSITE="../game_assets/huahua/assets/refs/tutorial_story_intro_scene_illust_ref.png"
PY="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
M="gemini-3.1-flash-image-preview"
NAME="tutorial_story_intro"
PROMPT="tutorial_story_intro_nb2_prompt.txt"
CRIT="minigame/images/tutorial"
SUB="minigame/subpkg_panels/images/tutorial"

for f in "$PY" "$PR/$PROMPT" "$REF_SCENE"; do
  [[ -f "$f" ]] || { echo "missing $f" >&2; exit 1; }
done

mkdir -p "$ASSETS/refs" "$ASSETS/raw" "$CRIT" "$SUB"
if [[ ! -f "$REF_STYLE" ]]; then
  SRC="/Users/rosa/.cursor/projects/Users-rosa-rosa-games-game2D-huahua/assets/game_circle_topic_huahua_900x506-0ab5da55-43fe-4a48-b301-498159ef8b3f.png"
  [[ -f "$SRC" ]] || { echo "missing style ref $REF_STYLE or $SRC" >&2; exit 1; }
  cp "$SRC" "$REF_STYLE"
fi

echo "== build scene + illustration-style composite reference =="
python3 - "$REF_SCENE" "$REF_STYLE" <<'PY'
import sys
from pathlib import Path
from PIL import Image

scene_path = Path(sys.argv[1])
style_path = Path(sys.argv[2])
out_path = Path("../game_assets/huahua/assets/refs/tutorial_story_intro_scene_illust_ref.png")

scene = Image.open(scene_path).convert("RGBA")
style = Image.open(style_path).convert("RGBA")

target_h = 1376
for img in (scene, style):
    scale = target_h / img.height
    img.resize((int(img.width * scale), target_h), Image.Resampling.LANCZOS)

scene_scale = target_h / scene.height
scene_w = int(scene.width * scene_scale)
scene = scene.resize((scene_w, target_h), Image.Resampling.LANCZOS)

style_scale = target_h / style.height
style_w = int(style.width * style_scale)
style = style.resize((style_w, target_h), Image.Resampling.LANCZOS)

pad, gap = 24, 32
canvas = Image.new("RGBA", (scene_w + gap + style_w + pad * 2, target_h + pad * 2), (255, 255, 255, 255))
canvas.paste(scene, (pad, pad), scene)
canvas.paste(style, (pad + scene_w + gap, pad), style)
canvas.convert("RGB").save(out_path, format="PNG", optimize=True)
print(f"-> {out_path} ({canvas.size})")
PY

raw="$ASSETS/raw/${NAME}_nb2.png"
out="$ASSETS/final/${NAME}_750x1344.png"
mkdir -p "$(dirname "$out")"

echo "== NB2 $NAME (scene illustration character repaint) =="
GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}" python3 "$PY" \
  --prompt-file "$PR/$PROMPT" \
  -o "$raw" \
  --model "$M" \
  --aspect-ratio 9:16 \
  --image-size 2K \
  --image "$REF_COMPOSITE"

echo "== resize to 750x1344 RGB =="
python3 - <<'PY'
from pathlib import Path
from PIL import Image

raw = Path("../game_assets/huahua/assets/raw/tutorial_story_intro_nb2.png")
out = Path("../game_assets/huahua/assets/final/tutorial_story_intro_750x1344.png")
img = Image.open(raw).convert("RGB").resize((750, 1344), Image.Resampling.LANCZOS)
img.save(out, format="PNG", optimize=True, compress_level=9)
print(f"-> {out} ({out.stat().st_size // 1024} KB)")
PY

cp "$out" "$CRIT/story_1.png"
cp "$out" "$SUB/story_1.png"

echo "== compress tutorial story PNG (pngquant, keep mobile gradient quality) =="
python3 scripts/compress_tutorial_story_png.py "$out" "$CRIT/story_1.png" "$SUB/story_1.png"
echo "Done. Raw: $raw"
