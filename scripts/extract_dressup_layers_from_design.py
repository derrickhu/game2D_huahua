#!/usr/bin/env python3
"""
从 Gemini 生成的「整套穿好设计图」中按 mask 原位切出换装层。

为什么不用 Gemini 直接拆层：
  自动拆层容易把整个人保留、把鞋子改成商品角度，结果不可控。

本脚本的原则：
  - Gemini 只负责生成整套穿好设计图。
  - 拆层用确定性的区域 + 颜色 mask。
  - 每个 layer 输出为 432×768 全画布透明 PNG，运行时 fullCanvas=true, x=0, y=0。
  - 未来新增装扮时，先生成整套图，再调本脚本里的 MASKS（或后续做 UI mask 编辑器）。

用法：
  python3 scripts/extract_dressup_layers_from_design.py default_v2 \
    --design ../game_assets/huahua/assets/raw/dressup/default_v2/default_v2_design.png \
    --apply
"""
from __future__ import annotations

import argparse
import colorsys
import shutil
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT.parent / "game_assets/huahua/assets"
CANVAS_W, CANVAS_H = 432, 768


def fit_canvas(src: Image.Image) -> Image.Image:
    src = src.convert("RGBA")
    scale = min(CANVAS_W / src.width, CANVAS_H / src.height)
    w, h = round(src.width * scale), round(src.height * scale)
    resized = src.resize((w, h), Image.LANCZOS)
    out = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    out.alpha_composite(resized, ((CANVAS_W - w) // 2, (CANVAS_H - h) // 2))
    return out


def rgba_to_hsv(px):
    r, g, b, _a = px
    return colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)


def in_box(x: int, y: int, box) -> bool:
    l, t, r, b = box
    return l <= x <= r and t <= y <= b


def in_ellipse(x: int, y: int, ellipse) -> bool:
    cx, cy, rx, ry = ellipse
    if rx <= 0 or ry <= 0:
        return False
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def is_magenta(px) -> bool:
    r, g, b, _a = px
    return r > 210 and b > 190 and g < 80


def color_match(kind: str, px) -> bool:
    r, g, b, a = px
    if a == 0 or is_magenta(px):
        return False
    h, s, v = rgba_to_hsv(px)

    if kind == "hair":
        # brown/orange hair + pink flower clip
        brown = 0.03 <= h <= 0.13 and 0.12 <= s <= 0.78 and 0.30 <= v <= 0.98
        pink_flower = (h <= 0.02 or h >= 0.92) and 0.18 <= s <= 0.75 and 0.65 <= v <= 1.0
        return brown or pink_flower
    if kind == "top":
        # pink sleeves/blouse + white apron in torso region
        pink = (h <= 0.04 or h >= 0.92) and 0.10 <= s <= 0.55 and v >= 0.58
        white = s <= 0.22 and v >= 0.72
        dark_trim = 0.02 <= h <= 0.10 and 0.20 <= s <= 0.65 and 0.25 <= v <= 0.65
        return pink or white or dark_trim
    if kind == "bottom":
        return 0.52 <= h <= 0.66 and 0.18 <= s <= 0.62 and 0.25 <= v <= 0.86
    if kind == "shoes":
        white = s <= 0.28 and v >= 0.58
        line = 0.02 <= h <= 0.12 and 0.20 <= s <= 0.75 and 0.22 <= v <= 0.68
        return white or line
    if kind == "makeup":
        return (h <= 0.05 or h >= 0.90) and 0.18 <= s <= 0.58 and 0.65 <= v <= 1.0
    if kind == "necklace":
        pearl = s <= 0.22 and 0.70 <= v <= 1.0
        pink_heart = (h <= 0.05 or h >= 0.90) and 0.22 <= s <= 0.80 and v >= 0.45
        return pearl or pink_heart
    if kind == "earrings":
        yellow = 0.10 <= h <= 0.18 and 0.35 <= s <= 1.0 and v >= 0.50
        return yellow
    if kind == "body":
        skin = 0.03 <= h <= 0.11 and 0.12 <= s <= 0.52 and 0.50 <= v <= 1.0
        eye = 0.03 <= h <= 0.13 and 0.35 <= s <= 0.95 and 0.10 <= v <= 0.75
        mouth = (h <= 0.04 or h >= 0.92) and 0.18 <= s <= 0.70 and 0.25 <= v <= 0.90
        return skin or eye or mouth
    return False


MASKS = {
    "body_skin": {
        "kind": "body",
        "boxes": [
            (105, 120, 325, 300),  # face/ears
            (85, 330, 150, 535),   # left arm/hand
            (285, 330, 345, 535),  # right arm/hand
            (145, 585, 280, 725),  # legs/feet skin
        ],
        "exclude_boxes": [
            (85, 40, 360, 165),    # top hair cap
            (150, 300, 285, 620),  # clothes torso/skirt, keep outer arms
            (130, 685, 305, 750),  # shoes
        ],
        "blur": 0.35,
    },
    # boxes are in 432×768 canvas coordinates
    "hair_bob_brown": {
        "kind": "hair",
        "boxes": [(60, 40, 360, 320)],
        # 只排除五官，保留刘海；避免把整套设计图里的眼睛/嘴切进发型层。
        "exclude_ellipses": [(215, 250, 52, 24)],
        "exclude_boxes": [(120, 168, 310, 245), (170, 270, 270, 342)],
        "blur": 0.45,
    },
    "top_pink_puff": {
        "kind": "top",
        "boxes": [(120, 310, 315, 530)],
        "blur": 0.35,
    },
    "bottom_denim_skirt": {
        "kind": "bottom",
        "boxes": [(100, 470, 340, 640)],
        "blur": 0.35,
    },
    "shoes_white_flats": {
        "kind": "shoes",
        "boxes": [(130, 660, 300, 735)],
        "blur": 0.25,
    },
    "makeup_blush_pink": {
        "kind": "makeup",
        "boxes": [(115, 200, 170, 260), (250, 200, 315, 260)],
        "blur": 0.8,
    },
    "acc_pearl_necklace": {
        "kind": "necklace",
        "boxes": [(160, 280, 270, 350)],
        "blur": 0.25,
    },
    "acc_star_earrings": {
        "kind": "earrings",
        "boxes": [(100, 205, 150, 285), (285, 205, 325, 285)],
        "blur": 0.25,
    },
}

LAYER_ORDER = [
    "shoes_white_flats",
    "bottom_denim_skirt",
    "top_pink_puff",
    "makeup_blush_pink",
    "hair_bob_brown",
    "acc_pearl_necklace",
    "acc_star_earrings",
]


def extract_layer(design: Image.Image, spec: dict) -> Image.Image:
    mask = Image.new("L", (CANVAS_W, CANVAS_H), 0)
    pix = design.load()
    mpix = mask.load()
    kind = spec["kind"]
    boxes = spec["boxes"]
    exclude_boxes = spec.get("exclude_boxes", [])
    exclude_ellipses = spec.get("exclude_ellipses", [])
    for y in range(CANVAS_H):
      for x in range(CANVAS_W):
        if any(in_box(x, y, box) for box in exclude_boxes):
            continue
        if any(in_ellipse(x, y, e) for e in exclude_ellipses):
            continue
        if any(in_box(x, y, box) for box in boxes) and color_match(kind, pix[x, y]):
            mpix[x, y] = 255
    blur = spec.get("blur", 0)
    if blur:
        mask = mask.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    out.alpha_composite(design)
    out.putalpha(mask)
    return out


def alpha_bbox(img: Image.Image):
    return img.split()[3].getbbox()


def thumb(layer: Image.Image, max_side: int = 256) -> Image.Image:
    bbox = alpha_bbox(layer)
    if not bbox:
        return Image.new("RGBA", (max_side, max_side), (0, 0, 0, 0))
    l, t, r, b = bbox
    pad = 10
    crop = layer.crop((max(0, l - pad), max(0, t - pad), min(CANVAS_W, r + pad), min(CANVAS_H, b + pad)))
    scale = min(max_side / crop.width, max_side / crop.height, 1)
    if scale < 1:
        crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.LANCZOS)
    return crop


def save_quantized(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    q = img.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
    q.save(path, optimize=True, compress_level=9)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("outfit_id")
    ap.add_argument("--design", required=True)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    design = fit_canvas(Image.open(args.design))
    final_dir = ASSET_ROOT / "final/dressup" / args.outfit_id
    layers_dir = final_dir / "layers"
    thumbs_dir = final_dir / "thumbs"

    layer_paths: list[Path] = []
    # 可选：从整套图抽取同源 body skin 层，用于验收与必要时替换全局 body_base。
    body_skin = extract_layer(design, MASKS["body_skin"])
    body_out = final_dir / "body_skin_from_design.png"
    save_quantized(body_skin, body_out)

    for layer_id in LAYER_ORDER:
        layer = extract_layer(design, MASKS[layer_id])
        layer_out = layers_dir / f"{layer_id}.png"
        thumb_out = thumbs_dir / f"{layer_id}.png"
        save_quantized(layer, layer_out)
        save_quantized(thumb(layer), thumb_out)
        layer_paths.append(layer_out)
        print(f"{layer_id}: {layer_out}")

    preview = Image.new("RGBA", (CANVAS_W, CANVAS_H), (250, 245, 250, 255))
    preview.alpha_composite(Image.open(body_out).convert("RGBA"))
    for p in layer_paths:
        preview.alpha_composite(Image.open(p).convert("RGBA"))
    preview_path = final_dir / "preview_mask.png"
    preview.save(preview_path)
    print(f"preview: {preview_path}")

    if args.apply:
        target = ROOT / "minigame/subpkg_chars/images/owner/parts" / args.outfit_id
        (target / "thumbs").mkdir(parents=True, exist_ok=True)
        for p in layers_dir.glob("*.png"):
            shutil.copy2(p, target / p.name)
        for p in thumbs_dir.glob("*.png"):
            shutil.copy2(p, target / "thumbs" / p.name)
        print(f"applied to {target}")


if __name__ == "__main__":
    main()
