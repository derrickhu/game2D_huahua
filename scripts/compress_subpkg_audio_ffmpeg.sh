#!/usr/bin/env bash
# 用 ffmpeg 压缩 minigame/subpkg_audio 下 MP3，保持路径与 AudioConfig 一致。
# BGM：64kbps 立体声（约 3 分钟循环常用体积）；短音效：96kbps；均去除 ID3 等元数据。
# 仓库根执行：bash scripts/compress_subpkg_audio_ffmpeg.sh
# 可选环境变量：BGM_KBPS=80 SFX_KBPS=128
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIO="$ROOT/minigame/subpkg_audio"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

BGM_KBPS="${BGM_KBPS:-64}"
SFX_KBPS="${SFX_KBPS:-96}"

if ! command -v ffmpeg &>/dev/null; then
  echo "未找到 ffmpeg。请先: brew install ffmpeg"
  exit 1
fi

reencode_mp3() {
  local src="$1" bitrate="$2"
  local base dir
  dir="$(dirname "$src")"
  base="$(basename "$src" .mp3)"
  local tmp="$dir/${base}.tmp.mp3"
  ffmpeg -y -nostdin -i "$src" -codec:a libmp3lame -b:a "${bitrate}k" -map_metadata -1 "$tmp"
  mv "$tmp" "$src"
}

echo "== BGM ${BGM_KBPS}k =="
reencode_mp3 "$AUDIO/bgm_main.mp3" "$BGM_KBPS"

echo "== 短音效 ${SFX_KBPS}k =="
reencode_mp3 "$AUDIO/button_click.mp3" "$SFX_KBPS"
reencode_mp3 "$AUDIO/merge_success.mp3" "$SFX_KBPS"

ls -la "$AUDIO"/*.mp3
echo "完成。BGM 听感发糊可提高 BGM_KBPS（如 80/96）；要更小可试 BGM_KBPS=48（慎用）。"
