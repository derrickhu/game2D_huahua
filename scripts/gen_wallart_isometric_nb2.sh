#!/usr/bin/env bash
# 墙饰挂画四件：NB2 等距墙面透视 → rembg birefnet-general → crop_trim → minigame/subpkg_deco/images/furniture/
# 提示词：docs/prompt/<key>_isometric_nb2_prompt.txt
# 原图：../game_assets/huahua/assets/raw/<key>_isometric_nb2.png
#
# 断点续跑: ONLY_KEYS="wallart_spring" ./scripts/gen_wallart_isometric_nb2.sh
# 注：wallart_winter 已改为游戏内「复古落地钟」，见 gen_furniture_mixed_refresh_nb2.sh
# 模型拥堵时可: GEMINI_WALLART_MODEL=gemini-2.5-flash-image ONLY_KEYS=... ./scripts/...
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
MODEL="${GEMINI_WALLART_MODEL:-gemini-3.1-flash-image-preview}"

ratio_for() {
  case "$1" in
    deco_late_lv7_wall_01) echo 4:3 ;;
    *) echo 3:4 ;;
  esac
}

ALL_KEYS=(wallart_frame deco_late_lv7_wall_01 wallart_spring)
if [[ -n "${ONLY_KEYS:-}" ]]; then
  read -r -a KEYS <<< "${ONLY_KEYS}"
else
  KEYS=("${ALL_KEYS[@]}")
fi

for k in "${KEYS[@]}"; do
  ar="$(ratio_for "$k")"
  pf="$WS/docs/prompt/${k}_isometric_nb2_prompt.txt"
  raw_out="$RAW/${k}_isometric_nb2.png"
  echo "=== $k (aspect $ar) ==="
  [ -f "$pf" ] || { echo "missing prompt $pf"; exit 1; }
  ok=0
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    python3 "$GEN" --prompt-file "$pf" \
      --output "$raw_out" \
      --model "$MODEL" \
      --aspect-ratio "$ar" && [ -s "$raw_out" ] && ok=1 && break
    sleep 35
  done
  [ "$ok" = "1" ] || { echo "FAILED generate: $k"; exit 1; }
  tmp="$RAW/${k}_nobg.png"
  python3 "$REMBG" "$raw_out" -o "$tmp" -m birefnet-general
  python3 "$CROP" "$tmp" -o "$OUT/${k}.png" --padding 4
  rm -f "$tmp"
  python3 "$WS/scripts/compress_furniture_deco_pngs.py" --force --max-side 171 "$OUT/${k}.png"
  sleep 8
done
echo "OK: raw under $RAW, game PNG under $OUT/ (max side 171 per furniture-deco-art-spec)"
