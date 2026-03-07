#!/bin/bash
# 同步游戏资产脚本

echo "同步 huahua 游戏资产..."

SOURCE_DIR="$HOME/rosa_games/game_assets/huahua/assets"
TARGET_DIR="$HOME/rosa_games/huahua/minigame"

# 同步 items 资源
echo "同步 items 资源..."
mkdir -p "$TARGET_DIR/images"
rsync -av --delete "$SOURCE_DIR/items/" "$TARGET_DIR/images/" 2>/dev/null || cp -r "$SOURCE_DIR/items/"* "$TARGET_DIR/images/" 2>/dev/null

# 同步其他资源目录（未来扩展）
for dir in ui backgrounds share hero equipment; do
    if [ -d "$SOURCE_DIR/$dir" ]; then
        echo "同步 $dir 资源..."
        mkdir -p "$TARGET_DIR/$dir"
        rsync -av --delete "$SOURCE_DIR/$dir/" "$TARGET_DIR/$dir/" 2>/dev/null || cp -r "$SOURCE_DIR/$dir/"* "$TARGET_DIR/$dir/" 2>/dev/null
    fi
done

echo "资产同步完成"
