#!/usr/bin/env python3
"""生成花架 spritesheet 图片 - 使用 Pollinations.ai 免费 API"""
import requests
import urllib.parse
from pathlib import Path

prompt = (
    "A sprite sheet of 6 cute flower shop display shelves, arranged in a 3x2 grid "
    "on a pure white background. Isometric 2.5D perspective, kawaii hand-drawn cartoon style, "
    "soft pink and warm wood tones, gentle brown outlines. "
    "Grid layout (left to right, top to bottom): "
    "1. Simple wooden flower shelf - three-tier natural wood shelf with small potted plants, rustic and practical. "
    "2. Step flower shelf - tiered cascade shelf like little hills, each level holding different flowers. "
    "3. Long flower display table - wall-mounted long wooden planter table with trailing vines. "
    "4. Iron art rotating shelf - elegant French wrought iron spiral shelf with ornate scrollwork, dark iron with gold accents. "
    "5. Glass display cabinet - premium glass-door cabinet with wooden frame, displaying flowers inside, soft interior glow. "
    "6. Cherry blossom shelf (seasonal limited) - wooden shelf decorated with pink cherry blossom branches and falling petals. "
    "Each item centered in its grid cell with equal padding. Consistent cute cartoon style across all items. Soft shadows beneath each piece."
)

encoded = urllib.parse.quote(prompt)
url = f"https://image.pollinations.ai/prompt/{encoded}?width=2048&height=1365&seed=42&model=flux&nologo=true"

print("🎨 正在生成花架 spritesheet...")
print("   使用 Pollinations.ai (免费 API)")
print("   尺寸: 2048x1365 (3x2 网格)")
print()

resp = requests.get(url, timeout=180)
if resp.status_code == 200 and len(resp.content) > 5000:
    out_path = Path(__file__).parent / "spritesheets" / "furniture_shelf.png"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(resp.content)
    print(f"✅ 图片已保存: {out_path}")
    print(f"   大小: {len(resp.content) // 1024} KB")
else:
    print(f"❌ 生成失败: status={resp.status_code}, size={len(resp.content)}")
    if resp.text:
        print(resp.text[:300])
