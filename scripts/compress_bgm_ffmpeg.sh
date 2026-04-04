#!/usr/bin/env bash
# 兼容旧入口：压缩 subpkg_audio 内全部游戏用 MP3（见 compress_subpkg_audio_ffmpeg.sh）。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$SCRIPT_DIR/compress_subpkg_audio_ffmpeg.sh" "$@"
