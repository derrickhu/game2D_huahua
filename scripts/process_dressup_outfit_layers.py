#!/usr/bin/env python3
"""
处理「整套设计图 -> 原位拆层」产物。

输入约定：
  ../game_assets/huahua/assets/raw/dressup/<outfit_id>/
    <outfit_id>_design.png
    hair_bob_brown.png
    top_pink_puff.png
    ...

输出：
  ../game_assets/huahua/assets/final/dressup/<outfit_id>/layers/*.png  432×768 全画布透明层
  ../game_assets/huahua/assets/final/dressup/<outfit_id>/thumbs/*.png  卡片缩略图
  ../game_assets/huahua/assets/final/dressup/<outfit_id>/preview.png   叠层验收图

可选 --apply：
  拷贝 layers/thumbs 到 minigame/subpkg_chars/images/owner/parts/<outfit_id>/。

核心原则：
  - 不裁掉全画布 layer。部件必须保持设计图中的原位，运行时 (0,0) 叠放。
  - 缩略图才裁 alpha bbox，用于 DressUpPanel 卡片展示。
  - 输出 config snippet：fullCanvas=true, x=0, y=0, scale=1。
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT.parent / "game_assets/huahua/assets"
CANVAS_W, CANVAS_H = 432, 768

LAYER_ORDER = [
    ("shoes_caramel_loafers", "shoes"),
    ("bottom_cream_pleated_skirt", "bottom"),
    ("top_mint_cardigan", "top"),
    ("makeup_peach_blush", "makeup"),
    ("hair_mint_brown_halfup", "hair"),
    ("necklace_gold_flower", "necklace"),
    ("earrings_mint_flower", "earrings"),
    ("shoes_white_flats", "shoes"),
    ("bottom_denim_skirt", "bottom"),
    ("top_pink_puff", "top"),
    ("makeup_blush_pink", "makeup"),
    ("hair_bob_brown", "hair"),
    ("acc_pearl_necklace", "accessory"),
    ("acc_star_earrings", "accessory"),
]


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=True)


def alpha_bbox(img: Image.Image):
    return img.split()[3].getbbox()


def fit_full_canvas(src: Image.Image) -> Image.Image:
    """把任意 9:16 产物 letterbox/resize 到 432×768，不改变相对位置。"""
    src = src.convert("RGBA")
    scale = min(CANVAS_W / src.width, CANVAS_H / src.height)
    w, h = round(src.width * scale), round(src.height * scale)
    resized = src.resize((w, h), Image.LANCZOS)
    out = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    out.alpha_composite(resized, ((CANVAS_W - w) // 2, (CANVAS_H - h) // 2))
    return out


def save_quantized(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    q = img.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
    q.save(path, optimize=True, compress_level=9)


def make_thumb(layer: Image.Image, max_side: int = 256) -> Image.Image:
    bbox = alpha_bbox(layer)
    if not bbox:
        return Image.new("RGBA", (max_side, max_side), (0, 0, 0, 0))
    l, t, r, b = bbox
    pad = 10
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(layer.width, r + pad), min(layer.height, b + pad)
    crop = layer.crop((l, t, r, b))
    scale = min(max_side / crop.width, max_side / crop.height, 1)
    if scale < 1:
        crop = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.LANCZOS)
    return crop


def build_preview(body_path: Path, layer_paths: list[Path], out_path: Path) -> None:
    preview = Image.new("RGBA", (CANVAS_W, CANVAS_H), (250, 245, 250, 255))
    if body_path.exists():
        preview.alpha_composite(Image.open(body_path).convert("RGBA"))
    for p in layer_paths:
        if p.exists():
            preview.alpha_composite(Image.open(p).convert("RGBA"))
    preview.save(out_path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("outfit_id")
    ap.add_argument("--apply", action="store_true", help="拷贝到 minigame 入库目录")
    ap.add_argument("--skip-rembg", action="store_true", help="输入已经是透明 PNG 时跳过 rembg")
    args = ap.parse_args()

    raw_dir = ASSET_ROOT / "raw/dressup" / args.outfit_id
    nobg_dir = ASSET_ROOT / "nobg/dressup" / args.outfit_id
    final_dir = ASSET_ROOT / "final/dressup" / args.outfit_id
    layers_dir = final_dir / "layers"
    thumbs_dir = final_dir / "thumbs"

    if not raw_dir.exists():
        raise SystemExit(f"raw dir not found: {raw_dir}")

    if not args.skip_rembg:
        nobg_dir.mkdir(parents=True, exist_ok=True)
        run([
            "python3", str(Path.home() / ".cursor/skills/remove-background/scripts/rembg_batch.py"),
            str(raw_dir), "-o", str(nobg_dir), "-m", "birefnet-general",
        ])
    else:
        nobg_dir = raw_dir

    layer_paths: list[Path] = []
    for layer_id, _slot in LAYER_ORDER:
        src = nobg_dir / f"{layer_id}.png"
        if not src.exists():
            print(f"skip missing layer: {layer_id}")
            continue
        canvas = fit_full_canvas(Image.open(src))
        layer_out = layers_dir / f"{layer_id}.png"
        thumb_out = thumbs_dir / f"{layer_id}.png"
        save_quantized(canvas, layer_out)
        save_quantized(make_thumb(canvas), thumb_out)
        layer_paths.append(layer_out)
        print(f"layer {layer_id}: {layer_out.relative_to(final_dir)} + {thumb_out.relative_to(final_dir)}")

    body_path = ROOT / "minigame/subpkg_chars/images/owner/parts/body_base.png"
    build_preview(body_path, layer_paths, final_dir / "preview.png")
    print(f"preview: {final_dir / 'preview.png'}")

    if args.apply:
        target = ROOT / "minigame/subpkg_chars/images/owner/parts" / args.outfit_id
        (target / "thumbs").mkdir(parents=True, exist_ok=True)
        for p in layers_dir.glob("*.png"):
            shutil.copy2(p, target / p.name)
        for p in thumbs_dir.glob("*.png"):
            shutil.copy2(p, target / "thumbs" / p.name)
        print(f"applied to {target}")

    print("\nConfig snippet (DressUpItemConfig.ts):")
    for layer_id, slot in LAYER_ORDER:
        print(
            "{ "
            f"id: '{layer_id}', slot: '{slot}', name: 'TODO', "
            f"textureKey: 'owner_part_{args.outfit_id}_{layer_id}', "
            f"previewTextureKey: 'owner_part_{args.outfit_id}_{layer_id}_thumb', "
            "fullCanvas: true, huayuanCost: 0, x: 0, y: 0, scale: 1 "
            "},"
        )

    print("\nTextureCache snippet (CHARS_IMAGE_MAP):")
    for layer_id, _slot in LAYER_ORDER:
        key = f"owner_part_{args.outfit_id}_{layer_id}"
        print(f"  {key}: 'subpkg_chars/images/owner/parts/{args.outfit_id}/{layer_id}.png',")
        print(f"  {key}_thumb: 'subpkg_chars/images/owner/parts/{args.outfit_id}/thumbs/{layer_id}.png',")


if __name__ == "__main__":
    main()
