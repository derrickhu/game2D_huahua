#!/usr/bin/env python3
"""
分部件换装素材处理：
  1. body：抠底图 alpha 裁边 → 等比缩放 → 底部对齐放入标准画布 432×768
  2. part：抠底图 alpha 裁边 → 按 spec 中 targetW（相对画布宽的比例）缩放
  3. 输出合成预览（body + 全部件）到 .tmp/dressup_preview.png，并打印
     DressUpItemConfig.ts 需要的 x/y（部件中心画布坐标，scale 恒为 1）

用法（仓库根）：
  python3 scripts/process_dressup_parts.py            # 处理全部 + 预览
  python3 scripts/process_dressup_parts.py --only hair_bob_brown

入库：final 目录的 PNG 拷到 minigame/subpkg_chars/images/owner/parts/
"""
import argparse
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOBG_DIR = os.path.join(ROOT, '.tmp/dressup_nobg')
FINAL_DIR = os.path.join(ROOT, '.tmp/dressup_final')
PREVIEW = os.path.join(ROOT, '.tmp/dressup_preview.png')

CANVAS_W, CANVAS_H = 432, 768
BODY_BOTTOM_Y = 752   # 身体脚底在画布上的 y
BODY_MAX_H = 736      # 身体最大高度（上下留边）

# 部件规格：targetW = 部件宽 / 画布宽；cx/cy = 部件中心画布坐标（迭代校准）
PART_SPEC = {
    'hair_bob_brown':      {'targetW': 0.87, 'cx': 219, 'cy': 186},
    'hair_twintail_pink':  {'targetW': 0.96, 'cx': 217, 'cy': 196},
    'top_pink_puff':       {'targetW': 0.46, 'cx': 216, 'cy': 430},
    'top_sailor_blue':     {'targetW': 0.46, 'cx': 216, 'cy': 430},
    'bottom_denim_skirt':  {'targetW': 0.44, 'cx': 216, 'cy': 560},
    'bottom_flower_skirt': {'targetW': 0.46, 'cx': 216, 'cy': 590},
    'shoes_white_flats':   {'targetW': 0.34, 'cx': 220, 'cy': 728},
    'shoes_red_boots':     {'targetW': 0.34, 'cx': 220, 'cy': 720},
    # 腮红也拆左右重组（两团贴脸颊外侧，避免挤在嘴部）
    'makeup_blush_pink':   {'targetW': 0.30, 'cx': 228, 'cy': 250, 'earrings': True,
                            'starW': 52, 'gap': 108},
    'acc_pearl_necklace':  {'targetW': 0.19, 'cx': 220, 'cy': 368},
    # 耳环特殊处理：拆左右两颗后按耳位间距重组（见 process_earrings）
    'acc_star_earrings':   {'targetW': 0.56, 'cx': 224, 'cy': 268, 'earrings': True,
                            'starW': 44, 'gap': 168},
}

# 预览叠放层序（与 DRESSUP_SLOT_Z 一致）：默认套 / 备选套
PREVIEW_SETS = {
    'dressup_preview.png': [
        'shoes_white_flats', 'bottom_denim_skirt', 'top_pink_puff',
        'makeup_blush_pink', 'hair_bob_brown', 'acc_pearl_necklace', 'acc_star_earrings',
    ],
    'dressup_preview_alt.png': [
        'shoes_red_boots', 'bottom_flower_skirt', 'top_sailor_blue',
        'makeup_blush_pink', 'hair_twintail_pink', 'acc_pearl_necklace', 'acc_star_earrings',
    ],
}


def save_quantized(img: Image.Image, path: str) -> None:
    """256 色调色板 + 抖动，pastel 插画肉眼无损，体积约降 60%~70%。"""
    q = img.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
    q.save(path, optimize=True, compress_level=9)


def trim(img: Image.Image, pad: int = 2) -> Image.Image:
    bbox = img.split()[3].getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(img.width, r + pad), min(img.height, b + pad)
    return img.crop((l, t, r, b))


def process_body(name: str) -> None:
    src = os.path.join(NOBG_DIR, f'{name}.png')
    img = trim(Image.open(src).convert('RGBA'))
    scale = min(BODY_MAX_H / img.height, (CANVAS_W - 24) / img.width)
    w, h = round(img.width * scale), round(img.height * scale)
    img = img.resize((w, h), Image.LANCZOS)
    canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    canvas.paste(img, ((CANVAS_W - w) // 2, BODY_BOTTOM_Y - h), img)
    out = os.path.join(FINAL_DIR, f'{name}.png')
    save_quantized(canvas, out)
    print(f'body {name}: trim {img.width}x{img.height} -> canvas, feetY={BODY_BOTTOM_Y}')


def process_earrings(name: str, spec: dict, img: Image.Image) -> Image.Image:
    """左右两颗按竖直中线拆开，各自缩放到 starW 后按 gap 重组（3/4 视角左颗略小）。"""
    mid = img.width // 2
    left = trim(img.crop((0, 0, mid, img.height)))
    right = trim(img.crop((mid, 0, img.width, img.height)))
    star_w = spec['starW']
    gap = spec['gap']

    def fit(piece: Image.Image, w: int) -> Image.Image:
        s = w / piece.width
        return piece.resize((w, round(piece.height * s)), Image.LANCZOS)

    left = fit(left, round(star_w * 0.88))   # 远侧耳（viewer-left）略小
    right = fit(right, star_w)
    out_w = gap + star_w
    out_h = max(left.height, right.height)
    combined = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
    combined.alpha_composite(left, (0, 0))
    combined.alpha_composite(right, (out_w - right.width, 0))
    return combined


def process_part(name: str) -> None:
    spec = PART_SPEC[name]
    src = os.path.join(NOBG_DIR, f'part_{name}.png')
    img = trim(Image.open(src).convert('RGBA'))
    if spec.get('earrings'):
        img = process_earrings(name, spec, img)
    else:
        tw = round(CANVAS_W * spec['targetW'])
        scale = tw / img.width
        th = round(img.height * scale)
        img = img.resize((tw, th), Image.LANCZOS)
    out = os.path.join(FINAL_DIR, f'{name}.png')
    save_quantized(img, out)
    print(f"part {name}: {img.width}x{img.height}  ->  x: {spec['cx']}, y: {spec['cy']}, scale: 1")


def build_preview() -> None:
    for fname, order in PREVIEW_SETS.items():
        canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (250, 245, 250, 255))
        body = Image.open(os.path.join(FINAL_DIR, 'body_base.png')).convert('RGBA')
        canvas.alpha_composite(body)
        for name in order:
            p = os.path.join(FINAL_DIR, f'{name}.png')
            if not os.path.exists(p):
                continue
            img = Image.open(p).convert('RGBA')
            spec = PART_SPEC[name]
            x = spec['cx'] - img.width // 2
            y = spec['cy'] - img.height // 2
            canvas.alpha_composite(img, (x, y))
        out = os.path.join(ROOT, '.tmp', fname)
        canvas.save(out)
        print(f'preview -> {out}')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='只处理指定部件（body_base / part 名）')
    args = ap.parse_args()
    os.makedirs(FINAL_DIR, exist_ok=True)

    targets = [args.only] if args.only else ['body_base', 'body_base_eyesclosed', *PART_SPEC.keys()]
    for t in targets:
        if t.startswith('body_base'):
            process_body(t)
        else:
            process_part(t)
    build_preview()


if __name__ == '__main__':
    main()
