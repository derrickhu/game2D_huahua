#!/usr/bin/env python3
"""
花店家具素材 Spritesheet 切图工具
用法: python3 split_spritesheet.py [--generate-placeholder]

功能:
1. 将 spritesheet 按网格切割为单独的 PNG
2. 自动放入 minigame/images/furniture/ 目录
3. --generate-placeholder 模式生成带标注的占位图用于测试
"""

import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
IMAGES_DIR = PROJECT_ROOT / "minigame" / "images" / "furniture"
SPRITESHEET_DIR = PROJECT_ROOT / "tools" / "spritesheets"

# ===== 切图配置 =====
# 每张 spritesheet 的配置: (文件名, 列数, 行数, [(输出文件名, 对应ID)] )
SHEET_CONFIGS = [
    {
        "name": "furniture_shelf",
        "cols": 3,
        "rows": 2,
        "items": [
            ("shelf_wood.png",    "shelf_wood",          "简约木花架"),
            ("shelf_step.png",    "shelf_step",          "阶梯花架"),
            ("shelf_long.png",    "shelf_long",          "长条花台"),
            ("shelf_iron.png",    "shelf_iron",          "铁艺旋转架"),
            ("shelf_glass.png",   "shelf_glass",         "玻璃展示柜"),
            ("shelf_spring.png",  "season_spring_shelf", "🌸樱花架(限定)"),
        ]
    },
    {
        "name": "furniture_table",
        "cols": 3,
        "rows": 2,
        "items": [
            ("table_counter.png", "table_counter",       "木质收银台"),
            ("table_drawer.png",  "table_drawer",        "抽屉式柜台"),
            ("table_work.png",    "table_work",          "花艺工作台"),
            ("table_marble.png",  "table_marble",        "大理石桌"),
            ("table_autumn.png",  "season_autumn_table",  "🍂秋叶桌(限定)"),
        ]
    },
    {
        "name": "furniture_light",
        "cols": 3,
        "rows": 2,
        "items": [
            ("light_desk.png",    "light_desk",          "台灯"),
            ("light_floor.png",   "light_floor",         "落地灯"),
            ("light_pendant.png", "light_pendant",       "花式吊灯"),
            ("light_crystal.png", "light_crystal",       "水晶吊灯"),
            ("light_summer.png",  "season_summer_light",  "🌻向日葵灯(限定)"),
        ]
    },
    {
        "name": "furniture_ornament",
        "cols": 3,
        "rows": 3,
        "items": [
            ("orn_pot.png",       "orn_pot",             "小花盆"),
            ("orn_vase.png",      "orn_vase",            "花瓶"),
            ("orn_fountain.png",  "orn_fountain",        "迷你喷泉"),
            ("orn_candle.png",    "orn_candle",          "香薰蜡烛"),
            ("orn_clock.png",     "orn_clock",           "复古挂钟"),
            ("orn_fireplace.png", "orn_fireplace",       "壁炉"),
            ("orn_pumpkin.png",   "season_autumn_orn",    "🎃南瓜灯(限定)"),
            ("orn_christmas.png", "season_winter_orn",    "🎄圣诞壁炉(限定)"),
        ]
    },
    {
        "name": "furniture_wallart",
        "cols": 3,
        "rows": 2,
        "items": [
            ("wallart_plant.png",   "wallart_plant",          "植物壁挂"),
            ("wallart_frame.png",   "wallart_frame",          "装饰画框"),
            ("wallart_wreath.png",  "wallart_wreath",         "花环壁饰"),
            ("wallart_relief.png",  "wallart_relief",         "艺术浮雕"),
            ("wallart_spring.png",  "season_spring_wall",     "🌸春日画(限定)"),
            ("wallart_winter.png",  "season_winter_wallart",  "❄️冬景画(限定)"),
        ]
    },
    {
        "name": "furniture_garden",
        "cols": 3,
        "rows": 2,
        "items": [
            ("garden_flowerbed.png", "garden_flowerbed",       "小花圃"),
            ("garden_arbor.png",     "garden_arbor",           "藤蔓凉亭"),
            ("garden_arch.png",      "garden_arch",            "玫瑰花廊"),
            ("garden_zen.png",       "garden_zen",             "日式枯山水"),
            ("garden_summer.png",    "season_summer_garden",   "🌊夏日喷泉(限定)"),
        ]
    },
]


def generate_placeholder(config: dict, output_path: Path, size: int = 2048):
    """生成带标注的占位 spritesheet"""
    cols, rows = config["cols"], config["rows"]
    
    # 根据网格比例确定图片尺寸
    if cols == rows:
        w, h = size, size
    else:
        w = size
        h = int(size * rows / cols)
    
    cell_w = w // cols
    cell_h = h // rows
    
    img = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # 尝试加载字体
    try:
        font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 28)
        font_small = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 20)
    except:
        font = ImageFont.load_default()
        font_small = font
    
    for idx, item in enumerate(config["items"]):
        filename, item_id, label = item
        col = idx % cols
        row = idx // cols
        
        x0 = col * cell_w
        y0 = row * cell_h
        x1 = x0 + cell_w
        y1 = y0 + cell_h
        
        # 画格子边框
        draw.rectangle([x0, y0, x1, y1], outline=(200, 180, 180), width=2)
        
        # 画内部浅色背景
        margin = 10
        color = (255, 240, 245, 200) if "season" in item_id else (245, 245, 240, 200)
        draw.rectangle([x0+margin, y0+margin, x1-margin, y1-margin], fill=color)
        
        # 画标注文字
        cx = (x0 + x1) // 2
        cy = (y0 + y1) // 2
        
        draw.text((cx, cy - 30), label, fill=(100, 60, 60), font=font, anchor="mm")
        draw.text((cx, cy + 10), filename, fill=(120, 120, 120), font=font_small, anchor="mm")
        draw.text((cx, cy + 40), f"({col},{row})", fill=(160, 160, 160), font=font_small, anchor="mm")
    
    # 空格子标注
    total_cells = cols * rows
    for idx in range(len(config["items"]), total_cells):
        col = idx % cols
        row = idx // cols
        x0 = col * cell_w
        y0 = row * cell_h
        x1 = x0 + cell_w
        y1 = y0 + cell_h
        draw.rectangle([x0, y0, x1, y1], outline=(220, 220, 220), width=2)
        cx = (x0 + x1) // 2
        cy = (y0 + y1) // 2
        draw.text((cx, cy), "空", fill=(200, 200, 200), font=font, anchor="mm")
    
    img.save(output_path)
    print(f"  ✅ 占位图已生成: {output_path} ({w}x{h})")


def split_spritesheet(config: dict, input_path: Path, output_dir: Path):
    """将 spritesheet 按网格切割为单独的 PNG 文件"""
    if not input_path.exists():
        print(f"  ❌ 文件不存在: {input_path}")
        return False
    
    img = Image.open(input_path)
    w, h = img.size
    cols, rows = config["cols"], config["rows"]
    cell_w = w // cols
    cell_h = h // rows
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"  📐 图片尺寸: {w}x{h}, 格子: {cols}x{rows} = {cell_w}x{cell_h} 每格")
    
    for idx, item in enumerate(config["items"]):
        filename, item_id, label = item
        col = idx % cols
        row = idx // cols
        
        x0 = col * cell_w
        y0 = row * cell_h
        x1 = x0 + cell_w
        y1 = y0 + cell_h
        
        cell_img = img.crop((x0, y0, x1, y1))
        out_path = output_dir / filename
        cell_img.save(out_path)
        print(f"  ✂️  [{col},{row}] → {filename} ({cell_w}x{cell_h})")
    
    print(f"  🎉 共切出 {len(config['items'])} 张图片 → {output_dir}")
    return True


def main():
    generate_placeholder_mode = "--generate-placeholder" in sys.argv
    split_mode = "--split" in sys.argv
    
    # 获取要处理的 sheet 名（可选，默认全部）
    target = None
    for arg in sys.argv[1:]:
        if not arg.startswith("--"):
            target = arg
            break
    
    SPRITESHEET_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    
    for config in SHEET_CONFIGS:
        name = config["name"]
        
        if target and target != name:
            continue
        
        print(f"\n{'='*50}")
        print(f"📦 {name} ({config['cols']}x{config['rows']})")
        print(f"{'='*50}")
        
        sheet_path = SPRITESHEET_DIR / f"{name}.png"
        
        if generate_placeholder_mode:
            generate_placeholder(config, sheet_path)
        
        if split_mode or (not generate_placeholder_mode):
            if sheet_path.exists():
                split_spritesheet(config, sheet_path, IMAGES_DIR)
            else:
                print(f"  ⚠️  spritesheet 不存在: {sheet_path}")
                print(f"     请先将生成的图片放到该路径，或使用 --generate-placeholder 生成占位图")
    
    if not generate_placeholder_mode and not split_mode:
        print("\n用法:")
        print("  python3 split_spritesheet.py --generate-placeholder     # 生成所有占位图")
        print("  python3 split_spritesheet.py --generate-placeholder furniture_shelf  # 只生成花架占位图")
        print("  python3 split_spritesheet.py --split                    # 切割所有 spritesheet")
        print("  python3 split_spritesheet.py --split furniture_shelf    # 只切割花架")


if __name__ == "__main__":
    main()
