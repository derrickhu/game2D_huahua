#!/usr/bin/env bash
# 野檐花居 20 件：NB2 原图 → rembg → crop → 256 入库
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
cd "$WS"
GA="${GAME_ASSETS_HUAHUA:-$WS/../game_assets/huahua}"
RAW="$GA/assets/raw/furniture_wildloft"
SPLIT="$GA/assets/split/furniture_wildloft"
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

python3 "$WS/scripts/gen_wildloft_furniture_prompts.py"

# id kind aspect
ITEMS=(
  "wildloft_reed_daybed floor 1:1"
  "wildloft_shell_table floor 1:1"
  "wildloft_tidepool_globe floor 1:1"
  "wildloft_drift_bench floor 1:1"
  "wildloft_pebble_lamp floor 1:1"
  "wildloft_sanddollar_rug floor 1:1"
  "wildloft_press_cabinet floor 1:1"
  "wildloft_fern_chair floor 1:1"
  "wildloft_coral_rack floor 1:1"
  "wildloft_seaglass_lamp floor 1:1"
  "wildloft_window_seat floor 1:1"
  "wildloft_kelp_swag wall 4:3"
  "wildloft_mosaic_panel wall 1:1"
  "wildloft_oyster_stool floor 1:1"
  "wildloft_salt_lamp floor 1:1"
  "wildloft_rose_screen floor 1:1"
  "wildloft_shell_clock wall 1:1"
  "wildloft_hammock_chair floor 1:1"
  "wildloft_eave_box wall 4:3"
  "wildloft_pearl_table floor 1:1"
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
echo "WILDLOFT_DONE ${#OUT_LIST[@]}"
