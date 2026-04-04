#!/usr/bin/env bash
# 缩小 minigame 资源体积（需在仓库根目录执行）
# 依赖：oxipng、pngquant、ffmpeg（brew install oxipng pngquant ffmpeg）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== oxipng 无损（全库 PNG） =="
oxipng -o 5 --strip safe -r minigame || true

echo "== pngquant 有损：房间背景 =="
for f in minigame/subpkg_deco/images/house/bg_room_*.png; do
  [[ -f "$f" ]] || continue
  pngquant --quality=75-88 --speed 3 --strip --ext .png --force "$f"
done

echo "== pngquant 有损：主包 UI + panels 分包 UI 大于 350KB =="
while IFS= read -r f; do
  pngquant --quality=80-92 --speed 3 --strip --ext .png --force "$f" || true
done < <(find minigame/images/ui minigame/subpkg_panels/images/ui -name '*.png' -size +350k 2>/dev/null)

echo "== 室外草地：若仍为伪 PNG 的 JPEG，可改为真 JPG（需 TextureCache house_bg 指向 .jpg）=="
# 手动：ffmpeg -y -i minigame/subpkg_deco/images/house/bg.png -qscale:v 2 minigame/subpkg_deco/images/house/bg.jpg

echo "== BGM 体积：可转 AAC m4a 或低码率 MP3（按需）=="
# afconvert in.mp3 minigame/subpkg_audio/bgm_main.m4a -f m4af -d aac -b 64000
# ffmpeg -y -i in.mp3 -codec:a libmp3lame -b:a 96k minigame/subpkg_audio/bgm_main.mp3

echo "完成。请 du -sh minigame 自检。"
