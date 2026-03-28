#!/usr/bin/env bash
# 对 minigame 下全部 PNG 做无损重打包（oxipng），不缩分辨率、不转有损格式。
# macOS: brew install oxipng
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)/minigame"
OXIPNG="${OXIPNG:-/opt/homebrew/bin/oxipng}"
if [[ ! -x "$OXIPNG" ]]; then
  echo "未找到 oxipng: $OXIPNG — 请 brew install oxipng，或设置 OXIPNG 环境变量" >&2
  exit 1
fi
before=$(find "$ROOT" -type f -iname '*.png' -exec stat -f%z {} + 2>/dev/null | awk '{s+=$1}END{print s+0}')
find "$ROOT" -type f -iname '*.png' -print0 | while IFS= read -r -d '' f; do
  "$OXIPNG" -o 4 --strip safe --quiet "$f"
done
after=$(find "$ROOT" -type f -iname '*.png' -exec stat -f%z {} + 2>/dev/null | awk '{s+=$1}END{print s+0}')
echo "PNG total bytes: $before -> $after (saved $((before - after)))"
