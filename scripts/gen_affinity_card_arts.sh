#!/usr/bin/env bash
# 批量生成「友谊卡 / 图鉴」系统的 NB2 美术资源
#
# 输入：docs/prompt/affinity_cards/*.txt
# 输出：../game_assets/huahua/assets/raw/affinity_cards/<key>.png
#
# 用法：
#   ./scripts/gen_affinity_card_arts.sh             # 全跑
#   ./scripts/gen_affinity_card_arts.sh student     # 仅小诗 12 张
#   ./scripts/gen_affinity_card_arts.sh shared      # 仅卡背/图标/按钮/面板壳 4 张
#   ./scripts/gen_affinity_card_arts.sh card_student_01  # 单张
#
# 依赖：~/.cursor/skills/gemini-image-gen/scripts/generate_images.py
#
# 备注：
#  - 小诗卡面统一参考 minigame/subpkg_chars/images/customer/student.png（保形象一致）
#  - 共用资源（card_back / icon_affinity_shard / btn_codex / codex_panel_frame）不传参考
#  - 串行执行 + 每张间 sleep 6 秒，避免触发 rate limit
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_GEN="$HOME/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
PROMPT_DIR="$REPO_ROOT/docs/prompt/affinity_cards"
OUT_DIR="$REPO_ROOT/../game_assets/huahua/assets/raw/affinity_cards"
STUDENT_REF="$REPO_ROOT/minigame/subpkg_chars/images/customer/student.png"

mkdir -p "$OUT_DIR"

filter="${1:-all}"

run_one() {
  local key="$1"
  local prompt_file="$PROMPT_DIR/${key}_nb2_prompt.txt"
  local out_file="$OUT_DIR/${key}.png"
  local extra=()
  case "$key" in
    card_student_*)
      extra+=( --image "$STUDENT_REF" )
      ;;
  esac

  if [[ ! -f "$prompt_file" ]]; then
    echo "[skip] missing prompt: $prompt_file"
    return 0
  fi
  echo
  echo "================================================================"
  echo "[gen] $key"
  echo "  prompt:  $prompt_file"
  echo "  output:  $out_file"
  [[ ${#extra[@]} -gt 0 ]] && echo "  refImg:  ${extra[1]}"
  echo "================================================================"

  python3 "$SKILL_GEN" \
    --prompt-file "$prompt_file" \
    --output "$out_file" \
    --model gemini-3.1-flash-image-preview \
    --aspect-ratio 1:1 \
    ${extra[@]+"${extra[@]}"}
  sleep 6
}

STUDENT_KEYS=(
  card_student_01 card_student_02 card_student_03 card_student_04
  card_student_05 card_student_06 card_student_07 card_student_08
  card_student_09 card_student_10 card_student_11 card_student_12
)
SHARED_KEYS=(
  card_back_default
  icon_affinity_shard
  btn_codex
  codex_panel_frame
)

case "$filter" in
  all)
    for k in "${STUDENT_KEYS[@]}" "${SHARED_KEYS[@]}"; do run_one "$k"; done
    ;;
  student)
    for k in "${STUDENT_KEYS[@]}"; do run_one "$k"; done
    ;;
  shared)
    for k in "${SHARED_KEYS[@]}"; do run_one "$k"; done
    ;;
  *)
    run_one "$filter"
    ;;
esac

echo
echo "[done] outputs in: $OUT_DIR"
