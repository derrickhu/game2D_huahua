#!/usr/bin/env bash
# 用 ffmpeg 压缩 minigame/subpkg_audio 下 MP3，与 AudioConfig 中注册的 .mp3 对齐。
# BGM：立体声、默认 64kbps（长循环体积可控）；短音效：单声道、默认 72kbps（体积小、听感仍够）。
# 均去除 ID3 等元数据；必须只映射音轨（ffmpeg -map 0:a:0），否则 Suno 等带封面视频轨的 MP3 会把图嵌进输出、体积暴涨。
# 仓库根执行：bash scripts/compress_subpkg_audio_ffmpeg.sh
# 可选环境变量：BGM_KBPS=80 SFX_KBPS=96
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUDIO="$ROOT/minigame/subpkg_audio"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

BGM_KBPS="${BGM_KBPS:-64}"
SFX_KBPS="${SFX_KBPS:-72}"

if ! command -v ffmpeg &>/dev/null; then
  echo "未找到 ffmpeg。请先: brew install ffmpeg"
  exit 1
fi

reencode_mp3_bgm() {
  local src="$1" bitrate="$2"
  local dir base tmp
  dir="$(dirname "$src")"
  base="$(basename "$src" .mp3)"
  tmp="$dir/${base}.tmp.mp3"
  ffmpeg -y -nostdin -i "$src" -map 0:a:0 -codec:a libmp3lame -ac 2 -b:a "${bitrate}k" -map_metadata -1 "$tmp"
  mv "$tmp" "$src"
}

reencode_mp3_sfx() {
  local src="$1" bitrate="$2"
  local dir base tmp
  dir="$(dirname "$src")"
  base="$(basename "$src" .mp3)"
  tmp="$dir/${base}.tmp.mp3"
  ffmpeg -y -nostdin -i "$src" -map 0:a:0 -codec:a libmp3lame -ac 1 -b:a "${bitrate}k" -map_metadata -1 "$tmp"
  mv "$tmp" "$src"
}

echo "== BGM 立体声 ${BGM_KBPS}k =="
reencode_mp3_bgm "$AUDIO/bgm_main.mp3" "$BGM_KBPS"
reencode_mp3_bgm "$AUDIO/bgm_shop_felt_petals.mp3" "$BGM_KBPS"

echo "== 短音效 单声道 ${SFX_KBPS}k（与 AudioConfig 中 .mp3 一致）=="
reencode_mp3_sfx "$AUDIO/merge_success.mp3" "$SFX_KBPS"
reencode_mp3_sfx "$AUDIO/tap_building.mp3" "$SFX_KBPS"
reencode_mp3_sfx "$AUDIO/customer_deliver.mp3" "$SFX_KBPS"
reencode_mp3_sfx "$AUDIO/button_click.mp3" "$SFX_KBPS"
reencode_mp3_sfx "$AUDIO/purchase_tap.mp3" "$SFX_KBPS"
reencode_mp3_sfx "$AUDIO/ui_reward_fanfare.mp3" "$SFX_KBPS"
reencode_mp3_sfx "$AUDIO/collection_unlock.mp3" "$SFX_KBPS"

ls -la "$AUDIO"/*.mp3
echo "完成。BGM 发糊可提高 BGM_KBPS（如 80）；短音偏薄可提高 SFX_KBPS（如 96）或去掉脚本里 -ac 1 改立体声。"
