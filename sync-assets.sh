#!/bin/bash
# 同步游戏资产脚本
# 用法: ./sync-assets.sh
# 从原始资源仓库拉取资源，裁剪后同步到 minigame/ 运行时目录

echo "🌸 同步花花妙屋游戏资产..."

SOURCE_DIR="/Users/dklighu/p_proj/game_assets/huahua/assets"
TARGET_DIR="/Users/dklighu/p_proj/game2D_huahua/minigame"

# 检查源目录
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ 源资源目录不存在: $SOURCE_DIR"
    exit 1
fi

# 确保 Git LFS 已拉取真实文件
cd "$(dirname "$SOURCE_DIR")/.." 2>/dev/null
if command -v git-lfs &>/dev/null; then
    git lfs pull 2>/dev/null
fi

# ---- 1. 同步日常花系物品图标（items → images/） ----
echo "📦 同步物品图标..."
mkdir -p "$TARGET_DIR/images"

# nobg 版本优先（去黑底），裁剪到 128x128
for i in 1 2; do
    SRC="$SOURCE_DIR/items/item_flower_daily_${i}_nobg.png"
    if [ -f "$SRC" ]; then
        sips -z 128 128 "$SRC" --out "$TARGET_DIR/images/flower_daily_${i}.png" 2>/dev/null
    fi
done

# 3-6 号直接缩小
for i in 3 4 5 6; do
    SRC="$SOURCE_DIR/items/item_flower_daily_${i}.png"
    if [ -f "$SRC" ]; then
        sips -z 128 128 "$SRC" --out "$TARGET_DIR/images/flower_daily_${i}.png" 2>/dev/null
    fi
done

# ---- 2. 同步花店建筑 ----
echo "🏠 同步花店建筑..."
mkdir -p "$TARGET_DIR/images/house"
if [ -f "$SOURCE_DIR/house/house_nobg.png" ]; then
    sips -z 512 512 "$SOURCE_DIR/house/house_nobg.png" --out "$TARGET_DIR/images/house/shop.png" 2>/dev/null
fi
if [ -f "$SOURCE_DIR/house/bg.png" ]; then
    sips -Z 750 "$SOURCE_DIR/house/bg.png" --out "$TARGET_DIR/images/house/bg.jpg" 2>/dev/null
fi

# ---- 3. 同步花朵装饰图标 ----
echo "🌺 同步花朵图标..."
mkdir -p "$TARGET_DIR/images/flowers"
if [ -d "$SOURCE_DIR/flowers" ]; then
    cp "$SOURCE_DIR/flowers/"*.png "$TARGET_DIR/images/flowers/" 2>/dev/null
fi

# ---- 4. 同步装修家具素材 ----
echo "🪑 同步装修家具..."
mkdir -p "$TARGET_DIR/images/room"
if [ -d "$SOURCE_DIR/room_items" ]; then
    cp "$SOURCE_DIR/room_items/"*.png "$TARGET_DIR/images/room/" 2>/dev/null
fi
if [ -d "$SOURCE_DIR/room2_items" ]; then
    cp "$SOURCE_DIR/room2_items/"*.png "$TARGET_DIR/images/room/" 2>/dev/null
fi

# ---- 5. 同步网格背景 ----
echo "📐 同步网格素材..."
if [ -f "$SOURCE_DIR/grids/grid_6x6_strict.png" ]; then
    cp "$SOURCE_DIR/grids/grid_6x6_strict.png" "$TARGET_DIR/images/" 2>/dev/null
fi

# ---- 统计 ----
TOTAL=$(find "$TARGET_DIR/images" -name "*.png" | wc -l | tr -d ' ')
echo ""
echo "✅ 资产同步完成！共 $TOTAL 张图片"
echo "   物品图标: $(ls "$TARGET_DIR/images/flower_daily_"*.png 2>/dev/null | wc -l | tr -d ' ') 张"
echo "   花店建筑: $(ls "$TARGET_DIR/images/house/"*.png 2>/dev/null | wc -l | tr -d ' ') 张"
echo "   花朵装饰: $(ls "$TARGET_DIR/images/flowers/"*.png 2>/dev/null | wc -l | tr -d ' ') 张"
echo "   装修家具: $(ls "$TARGET_DIR/images/room/"*.png 2>/dev/null | wc -l | tr -d ' ') 张"
