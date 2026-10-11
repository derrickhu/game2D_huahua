#!/usr/bin/env bash
# 40–43 暮岸家具 + 汐岸阁楼专属：NB2 → rembg → crop → 256
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WS"
GA="${GAME_ASSETS_HUAHUA:-$WS/../game_assets/huahua}"
RAW="$GA/assets/raw/furniture_duskshore"
SPLIT="$GA/assets/split/furniture_duskshore"
OUT="$WS/minigame/subpkg_deco/images/furniture"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG="${HOME}/.cursor/skills/remove-background/scripts/rembg_single.py"
CROP="${HOME}/.cursor/skills/game-art-pipeline/scripts/crop_trim.py"
FLOOR_REF="$WS/docs/prompt/refs/furniture_iso_grid_pm30.png"
WALL_REF="$WS/minigame/subpkg_deco/images/furniture/wallart_frame.png"
PY="${REMBG_PYTHON:-}"
if [[ -z "$PY" && -x /tmp/huahua_art_venv/bin/python3 ]]; then
  PY=/tmp/huahua_art_venv/bin/python3
fi
if [[ -z "$PY" ]]; then
  PY=python3
fi

export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"
MODEL="${GEMINI_IMAGE_MODEL:-gemini-3.1-flash-image-preview}"
SLEEP_OK="${SLEEP_OK:-6}"
SLEEP_FAIL="${SLEEP_FAIL:-25}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-3}"

mkdir -p "$RAW" "$SPLIT" "$OUT"
python3 "$WS/scripts/gen_duskshore_furniture_prompts.py"

ITEMS=(
  "duskshore_star_cabinet floor 1:1"
  "duskshore_dusk_lamp floor 1:1"
  "duskshore_bell_swag wall 4:3"
  "duskshore_float_table floor 1:1"
  "duskshore_anemone_seat floor 1:1"
  "duskshore_bottle_charm floor 1:1"
  "duskshore_vine_sofa floor 1:1"
  "duskshore_firefly_lamp floor 1:1"
  "duskshore_plank_shelf wall 4:3"
  "duskshore_tide_bed floor 1:1"
  "duskshore_coral_mirror floor 1:1"
  "duskshore_compass floor 1:1"
  "tideloft_step_cushion floor 1:1"
  "tideloft_nest_lamp floor 1:1"
  "tideloft_rail_seat floor 1:1"
  "tideloft_niche wall 1:1"
  "tideloft_basket_table floor 1:1"
  "tideloft_moss_rug floor 1:1"
  "tideloft_short_daybed floor 1:1"
  "tideloft_fern_panel wall 1:1"
)

if [[ "${SKIP_GEN:-}" != "1" ]]; then
  FAILED=()
  for row in "${ITEMS[@]}"; do
    read -r id kind aspect <<< "$row"
    raw_out="$RAW/${id}_nb2.png"
    pf="$WS/docs/prompt/furniture_${id}_nb2_prompt.txt"
    ref="$FLOOR_REF"
    if [[ "$kind" == "wall" ]]; then ref="$WALL_REF"; fi
    echo "=== GEN $id ($kind $aspect) ==="
    if [[ "${SKIP_EXISTING:-1}" == "1" && -s "$raw_out" ]]; then
      echo "  skip existing"
      continue
    fi
    ok=0
    for ((attempt=1; attempt<=MAX_ATTEMPTS; attempt++)); do
      echo "  attempt $attempt/$MAX_ATTEMPTS"
      if python3 "$GEN" --prompt-file "$pf" --output "$raw_out" --model "$MODEL" \
        --aspect-ratio "$aspect" --image-size 1K --image "$ref" && [[ -s "$raw_out" ]]; then
        ok=1
        break
      fi
      sleep "$SLEEP_FAIL"
    done
    if [[ "$ok" != "1" ]]; then
      echo "FAILED GEN: $id"
      FAILED+=("$id")
      continue
    fi
    echo "  OK -> $raw_out"
    sleep "$SLEEP_OK"
  done
  if ((${#FAILED[@]})); then
    echo "Gen failed: ${FAILED[*]}"
    exit 1
  fi
fi

OUT_LIST=()
for row in "${ITEMS[@]}"; do
  read -r id _kind _aspect <<< "$row"
  src="$RAW/${id}_nb2.png"
  if [[ -s "$OUT/${id}.png" && "${FORCE_PROCESS:-}" != "1" ]]; then
    echo "  skip existing cutout $id"
    OUT_LIST+=("$OUT/${id}.png")
    continue
  fi
  [[ -s "$src" ]] || { echo "MISSING $src"; exit 1; }
  echo "==> rembg $id"
  "$PY" "$REMBG" "$src" -o "$SPLIT/${id}_cut.png" -m birefnet-general
  "$PY" "$CROP" "$SPLIT/${id}_cut.png" -o "$OUT/${id}.png" --padding 4
  OUT_LIST+=("$OUT/${id}.png")
done

"$PY" "$WS/scripts/compress_furniture_deco_pngs.py" --max-side 256 --force "${OUT_LIST[@]}"
echo "DUSKSHORE_DONE ${#OUT_LIST[@]}"
