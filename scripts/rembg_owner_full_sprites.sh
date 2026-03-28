#!/usr/bin/env bash
# 店主全身 + 半身 rembg 入库：统一 birefnet-general（规范见 docs/owner_sprite_art_spec.md §1.1）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="$ROOT/minigame/images/owner"
SCRIPT="${REMBG_BATCH:-$HOME/.cursor/skills/remove-background/scripts/rembg_batch.py}"
if [[ ! -f "$SCRIPT" ]]; then
  echo "未找到 rembg_batch.py: $SCRIPT（可设环境变量 REMBG_BATCH）" >&2
  exit 1
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/in" "$TMP/out"
count=0
process_one() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local b
  b=$(basename "$f")
  [[ "$b" == *_original.png ]] && return 0
  cp "$f" "$TMP/in/"
  count=$((count + 1))
}

shopt -s nullglob
for f in "$OWNER"/full_*.png; do process_one "$f"; done
for f in "$OWNER"/chibi_*.png; do process_one "$f"; done
shopt -u nullglob

if [[ "$count" -eq 0 ]]; then
  echo "未找到可处理的 full_*.png / chibi_*.png（已排除 *_original.png）" >&2
  exit 1
fi
python3 "$SCRIPT" "$TMP/in" -o "$TMP/out" -m birefnet-general
POST="$ROOT/scripts/owner_sprite_post_rembg.py"
for f in "$TMP/out"/*.png; do
  python3 "$POST" "$f"
  mv "$f" "$OWNER/$(basename "$f")"
done
echo "完成: $count 张（birefnet-general + 品红渗色清理）已写回 $OWNER"
