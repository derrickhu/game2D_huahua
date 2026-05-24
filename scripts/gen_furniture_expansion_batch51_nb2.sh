#!/usr/bin/env bash
# 扩展批次 51：创意/古风 50 件 — NB2 单件出图 → game_assets raw（不入库）
# 断点续跑: ONLY_KEYS="ancient_inkstone_desk" ./scripts/gen_furniture_expansion_batch51_nb2.sh
# 跳过已成功: SKIP_EXISTING=1 ./scripts/gen_furniture_expansion_batch51_nb2.sh
set -euo pipefail
WS="$(cd "$(dirname "$0")/.." && pwd)"
GA="${GAME_ASSETS_HUAHUA:-"$WS/../game_assets/huahua"}"
RAW="$GA/assets/raw/furniture_expansion_batch51"
mkdir -p "$RAW"
GEN="${HOME}/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
MANIFEST="$WS/docs/furniture_expansion_batch51_manifest.json"

export GEMINI_IMAGE_REST_ONLY="${GEMINI_IMAGE_REST_ONLY:-1}"
MODEL="${GEMINI_IMAGE_MODEL:-gemini-3.1-flash-image-preview}"
SLEEP_OK="${SLEEP_OK:-8}"
SLEEP_FAIL="${SLEEP_FAIL:-30}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-8}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "missing manifest: $MANIFEST (run python3 scripts/gen_expansion_batch51_prompts.py first)" >&2
  exit 1
fi

ALL_KEYS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && ALL_KEYS+=("$line")
done < <(python3 -c "import json; d=json.load(open('$MANIFEST',encoding='utf-8')); print('\n'.join(x['id'] for x in d))")

if [[ -n "${ONLY_KEYS:-}" ]]; then
  read -r -a KEYS <<< "${ONLY_KEYS}"
else
  KEYS=("${ALL_KEYS[@]}")
fi

FAILED=()
for k in "${KEYS[@]}"; do
  pf="$WS/docs/prompt/furniture_${k}_nb2_prompt.txt"
  raw_out="$RAW/${k}_nb2.png"
  echo "=== [$k] ==="
  if [[ "${SKIP_EXISTING:-}" == "1" && -s "$raw_out" ]]; then
    echo "  skip existing $raw_out"
    continue
  fi
  [[ -f "$pf" ]] || { echo "missing prompt $pf"; FAILED+=("$k"); continue; }
  ok=0
  for ((attempt=1; attempt<=MAX_ATTEMPTS; attempt++)); do
    echo "  attempt $attempt/$MAX_ATTEMPTS"
    if python3 "$GEN" --prompt-file "$pf" \
      --output "$raw_out" \
      --model "$MODEL" \
      --aspect-ratio 1:1 \
      && [[ -s "$raw_out" ]]; then
      ok=1
      break
    fi
    sleep "$SLEEP_FAIL"
  done
  if [[ "$ok" != "1" ]]; then
    echo "FAILED generate: $k"
    FAILED+=("$k")
    continue
  fi
  echo "  OK -> $raw_out"
  sleep "$SLEEP_OK"
done

echo ""
echo "Done. Raw output dir: $RAW"
if ((${#FAILED[@]})); then
  echo "Failed (${#FAILED[@]}): ${FAILED[*]}"
  exit 1
fi
echo "All ${#KEYS[@]} keys succeeded."
