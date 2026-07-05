#!/usr/bin/env python3
"""
花店「装修」主按钮：绿幕原图 → 洪水去绿 → despill → 裁切入库。

默认绿幕抠图（对这版 v1 效果最好）。非绿幕原图可用 --rembg。

用法（仓库根）:
  python3 scripts/process_shop_edit_deco_btn_nb2.py [raw.png]
  python3 scripts/process_shop_edit_deco_btn_nb2.py --rembg [raw.png]
  python3 scripts/process_shop_edit_deco_btn_nb2.py --recolor [raw.png]
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from collections import deque

import numpy as np
from PIL import Image

REMBG_SCRIPT = os.path.expanduser(
    "~/.cursor/skills/remove-background/scripts/rembg_single.py"
)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DEFAULT = os.path.join(REPO, "../game_assets/huahua/assets/raw/shop_edit_deco_btn_nb2.png")
OUT = os.path.join(REPO, "minigame/subpkg_panels/images/ui/shop_edit_deco_btn_nb2.png")
MAX_W = 320
PAD = 2
CORE_ALPHA = 200


def _dilate_bool_4(m: np.ndarray, iterations: int = 1) -> np.ndarray:
    out = m
    for _ in range(max(0, iterations)):
        h, w = out.shape
        up = np.zeros_like(out, dtype=bool)
        up[1:, :] = out[:-1, :]
        down = np.zeros_like(out, dtype=bool)
        down[:-1, :] = out[1:, :]
        left = np.zeros_like(out, dtype=bool)
        left[:, 1:] = out[:, :-1]
        right = np.zeros_like(out, dtype=bool)
        right[:, :-1] = out[:, 1:]
        out = out | up | down | left | right
    return out


def _erode_bool_4(m: np.ndarray, iterations: int = 1) -> np.ndarray:
    out = m
    for _ in range(max(0, iterations)):
        h, w = out.shape
        up = np.zeros_like(out, dtype=bool)
        up[1:, :] = out[:-1, :]
        down = np.zeros_like(out, dtype=bool)
        down[:-1, :] = out[1:, :]
        left = np.zeros_like(out, dtype=bool)
        left[:, 1:] = out[:, :-1]
        right = np.zeros_like(out, dtype=bool)
        right[:, :-1] = out[:, 1:]
        out = out & up & down & left & right
    return out


def is_green_screen(rgb: np.ndarray, *, dist_cutoff: float = 72.0) -> np.ndarray:
    r = rgb[:, :, 0]
    g = rgb[:, :, 1]
    b = rgb[:, :, 2]
    t = np.array([0.0, 255.0, 0.0], dtype=np.float32)
    dist = np.linalg.norm(rgb.astype(np.float32) - t, axis=-1)
    void = dist < dist_cutoff
    void |= (g > 205) & (r < 88) & (b < 88)
    return void


def is_white_void(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.float32)
    g = rgb[:, :, 1].astype(np.float32)
    b = rgb[:, :, 2].astype(np.float32)
    lum = (r + g + b) / 3.0
    return (lum > 246) | ((r > 238) & (g > 238) & (b > 238))


def exterior_void_flood_mask(rgb: np.ndarray, *, dilate_void: int = 1) -> np.ndarray:
    void = is_green_screen(rgb) | is_white_void(rgb)
    if dilate_void > 0:
        void = _dilate_bool_4(void, dilate_void)
    h, w = rgb.shape[:2]
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if void[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if void[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and void[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((nx, ny))
    return visited


def _alpha_boundary(a: np.ndarray) -> np.ndarray:
    """外轮廓：不透明且至少一侧邻接透明。"""
    opaque = a > 0
    up = np.zeros_like(opaque)
    up[1:, :] = opaque[:-1, :]
    down = np.zeros_like(opaque)
    down[:-1, :] = opaque[1:, :]
    left = np.zeros_like(opaque)
    left[:, 1:] = opaque[:, :-1]
    right = np.zeros_like(opaque)
    right[:, :-1] = opaque[:, 1:]
    inner = opaque & up & down & left & right
    return opaque & ~inner


def peel_outer_light_halo(rgba: np.ndarray, *, max_passes: int = 5) -> None:
    """剥掉外圈绿幕抗锯齿留下的浅白/灰晕（保留紫描边与内容）。"""
    for _ in range(max_passes):
        a = rgba[:, :, 3]
        boundary = _alpha_boundary(a)
        if not np.any(boundary):
            break
        r = rgba[:, :, 0].astype(np.float32)
        g = rgba[:, :, 1].astype(np.float32)
        b = rgba[:, :, 2].astype(np.float32)
        lum = (r + g + b) / 3.0
        mx = np.maximum(np.maximum(r, g), b)
        mn = np.minimum(np.minimum(r, g), b)
        sat = mx - mn
        green_spill = (g > mx - 4.0) & (g > r * 0.92) & (g > b * 0.92)
        kill = boundary & (
            green_spill
            | ((lum > 210) & (sat < 34))
            | ((lum > 225) & (sat < 48))
        )
        if not np.any(kill):
            break
        rgba[kill, 3] = 0


def matte_chroma_screen(img: Image.Image) -> Image.Image:
    rgb = np.array(img.convert("RGB"), dtype=np.uint8)
    exterior = exterior_void_flood_mask(rgb, dilate_void=2)
    rgba = np.zeros((rgb.shape[0], rgb.shape[1], 4), dtype=np.uint8)
    rgba[:, :, :3] = rgb
    rgba[:, :, 3] = np.where(exterior, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def matte_rembg(src_path: str) -> Image.Image:
    """BiRefNet 抠图，边缘比绿幕洪水填充干净。"""
    if not os.path.isfile(REMBG_SCRIPT):
        raise FileNotFoundError(f"rembg 脚本不存在: {REMBG_SCRIPT}")
    fd, tmp = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        subprocess.run(
            [
                "python3",
                REMBG_SCRIPT,
                src_path,
                "-o",
                tmp,
                "-m",
                "birefnet-general",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return Image.open(tmp).convert("RGBA")
    finally:
        if os.path.isfile(tmp):
            os.unlink(tmp)


def recolor_pink_volume(rgba: np.ndarray) -> None:
    """胶囊底：去掉白/奶油反光，用纯粉深浅塑造体积；保留描边、白字、锤刷图标。"""
    h, w = rgba.shape[:2]
    r = rgba[:, :, 0].astype(np.float32)
    g = rgba[:, :, 1].astype(np.float32)
    b = rgba[:, :, 2].astype(np.float32)
    a = rgba[:, :, 3]
    lum = (r + g + b) / 3.0
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    xs = np.arange(w, dtype=np.float32)[None, :]
    ys = np.arange(h, dtype=np.float32)[:, None]

    active = a > 128
    dark_outline = active & (lum < 98) & (sat < 100)
    gold_tool = (
        active
        & (r > 170)
        & (g > 110)
        & (b < 140)
        & (r > b * 1.1)
        & (xs < w * 0.42)
    )
    green_leaf = active & (g > 105) & (g > r * 1.05) & (g > b * 1.05)
    purple_tool = (
        active
        & (b > 110)
        & (r > 85)
        & (b > g * 1.05)
        & (xs < w * 0.42)
        & (lum < 215)
    )
    yellow_sparkle = active & (r > 200) & (g > 170) & (b < 120) & (xs < w * 0.42)

    # 仅保留「装修」字芯白（高亮低饱和），勿把字后底或右上高光当文字
    text_zone = (
        (xs > w * 0.48)
        & (xs < w * 0.88)
        & (ys > h * 0.32)
        & (ys < h * 0.68)
    )
    white_text = active & (lum > 232) & (sat < 24) & text_zone

    protected = (
        dark_outline | gold_tool | green_leaf | purple_tool | yellow_sparkle | white_text
    )

    pinkish = (r > g * 0.88) & (r > b * 0.82)
    pill_body = (
        active
        & ~protected
        & (pinkish | (lum > 125) | ((sat < 72) & (lum > 115)))
    )
    # 右上奶油反光强制纳入重着色
    glare = active & ~protected & (lum > 175) & (sat < 58)
    pill_body = pill_body | glare

    if np.any(pill_body):
        py = np.where(pill_body)[0]
        y0p, y1p = int(py.min()), int(py.max())
        yn = (ys - y0p) / max(1.0, float(y1p - y0p))
    else:
        yn = ys / max(1.0, float(h))
    yn2d = np.broadcast_to(yn, (h, w))

    # 平滑纯粉体积：顶浅底深，无硬色带
    t = 0.5 * (1.0 - np.cos(np.pi * np.clip(yn2d, 0.0, 1.0)))
    tr = 244.0 * (1.0 - t) + 190.0 * t
    tg = 114.0 * (1.0 - t) + 24.0 * t
    tb = 182.0 * (1.0 - t) + 93.0 * t
    r[pill_body] = tr[pill_body]
    g[pill_body] = tg[pill_body]
    b[pill_body] = tb[pill_body]

    rgba[:, :, 0] = np.clip(r, 0, 255).astype(np.uint8)
    rgba[:, :, 1] = np.clip(g, 0, 255).astype(np.uint8)
    rgba[:, :, 2] = np.clip(b, 0, 255).astype(np.uint8)


def harden_alpha(rgba: np.ndarray) -> None:
    """去掉 rembg 外圈半透明白晕，保留抗锯齿内缘。"""
    a = rgba[:, :, 3].astype(np.float32)
    fringe = a < 48
    rgba[fringe, 3] = 0
    solid = a >= 210
    rgba[solid, 3] = 255


def cleanup_alpha_fringe(rgba: np.ndarray) -> None:
    """清理半透明白边/灰边（缩放后 LANCZOS 产生的白晕）。"""
    r = rgba[:, :, 0].astype(np.float32)
    g = rgba[:, :, 1].astype(np.float32)
    b = rgba[:, :, 2].astype(np.float32)
    a = rgba[:, :, 3].astype(np.float32)
    lum = (r + g + b) / 3.0
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn

    edge = _alpha_edge_band(a.astype(np.uint8), inner_px=5)
    halo = edge & (a > 0) & (a < 252) & ((lum > 165) | (sat < 28))
    rgba[halo, 3] = 0

    semi = (a > 0) & (a < 200) & (lum > 155) & (sat < 38)
    rgba[semi, 3] = 0

    boundary = _alpha_boundary(a.astype(np.uint8))
    bright_ring = boundary & (a > 0) & (lum > 215) & (sat < 40)
    rgba[bright_ring, 3] = 0

    premul = edge & (a > 0) & (lum > 140) & (sat < 45)
    for c in range(3):
        ch = rgba[:, :, c].astype(np.float32)
        ch[premul] = ch[premul] * (a[premul] / 255.0)
        rgba[:, :, c] = np.clip(ch, 0, 255).astype(np.uint8)


def despill_green_fringe(
    rgba: np.ndarray,
    *,
    strength: float = 0.55,
    threshold: float = 8.0,
    g_cap_slack: float = 6.0,
) -> None:
    d = rgba.astype(np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    active = a > 0
    mx = np.maximum(r, b)
    excess = g - mx
    excess = np.maximum(excess - threshold, 0.0)
    sub = strength * excess
    g2 = np.where(active, np.clip(g - sub, 0, 255), g)
    cap = mx + g_cap_slack
    g2 = np.where(active, np.minimum(g2, cap), g2)
    rgba[:, :, 1] = np.clip(g2, 0, 255).astype(np.uint8)


def _alpha_edge_band(a: np.ndarray, *, inner_px: int = 3) -> np.ndarray:
    opaque = a > 0
    band = opaque.copy()
    cur = opaque
    for _ in range(max(1, inner_px)):
        h, w = cur.shape
        up = np.zeros_like(cur)
        up[1:, :] = cur[:-1, :]
        down = np.zeros_like(cur)
        down[:-1, :] = cur[1:, :]
        left = np.zeros_like(cur)
        left[:, 1:] = cur[:, :-1]
        right = np.zeros_like(cur)
        right[:, :-1] = cur[:, 1:]
        cur = cur & up & down & left & right
    band &= ~cur
    band |= (a > 0) & (a < 250)
    return band


def remove_light_fringe(rgba: np.ndarray) -> None:
    """去掉绿幕抠图后常见的半透明白边/灰边。"""
    r = rgba[:, :, 0].astype(np.float32)
    g = rgba[:, :, 1].astype(np.float32)
    b = rgba[:, :, 2].astype(np.float32)
    a = rgba[:, :, 3]
    lum = (r + g + b) / 3.0
    mx = np.maximum(r, b)
    mn = np.minimum(r, b)
    sat = mx - mn

    halo = (a > 0) & (a < 245) & (lum > 198) & (sat < 32)
    rgba[halo, 3] = 0

    edge = _alpha_edge_band(a, inner_px=4)
    white_edge = edge & (a > 160) & (lum > 228) & (sat < 32)
    rgba[white_edge, 3] = 0

    gray_edge = edge & (a < 230) & (sat < 20) & (lum > 175)
    rgba[gray_edge, 3] = 0


def defringe_green_edge(rgba: np.ndarray) -> None:
    despill_green_fringe(rgba, strength=0.68, threshold=6.0, g_cap_slack=5.0)
    r = rgba[:, :, 0].astype(np.float32)
    g = rgba[:, :, 1].astype(np.float32)
    b = rgba[:, :, 2].astype(np.float32)
    a = rgba[:, :, 3]
    edge = _alpha_edge_band(a, inner_px=4)
    active = a > 0
    mx = np.maximum(r, b)
    g = np.where(edge, np.minimum(g, mx + 3.0), g)
    fringe = active & (a < 200) & (g > mx + 12.0)
    green_halo = active & (a < 128) & (g > 160) & (r < 100) & (b < 100)
    rgba[:, :, 1] = np.clip(g, 0, 255).astype(np.uint8)
    rgba[fringe, 3] = 0
    rgba[green_halo, 3] = 0
    remove_light_fringe(rgba)
    despill_green_fringe(rgba, strength=0.82, threshold=4.0, g_cap_slack=4.0)
    r = rgba[:, :, 0].astype(np.float32)
    g = rgba[:, :, 1].astype(np.float32)
    active = rgba[:, :, 3] > 0
    mx = np.maximum(r, b)
    rgba[:, :, 1] = np.where(active, np.minimum(g, mx + 2.0), g).astype(np.uint8)


def erode_alpha(rgba: np.ndarray, *, px: int = 1, alpha_keep: int = 128) -> None:
    a = rgba[:, :, 3]
    core = a >= alpha_keep
    eroded = _erode_bool_4(core, px)
    rgba[:, :, 3] = np.where(eroded, a, 0).astype(np.uint8)


def crop_alpha_bbox(im: Image.Image, *, alpha_min: int = 128, padding: int = 4) -> Image.Image:
    """按不透明区域裁切，保留完整圆角胶囊。"""
    rgba = np.array(im.convert("RGBA"), dtype=np.uint8)
    a = rgba[:, :, 3]
    ys, xs = np.where(a >= alpha_min)
    if len(xs) == 0:
        ys, xs = np.where(a > 0)
    if len(xs) == 0:
        return im
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    w, h = rgba.shape[1], rgba.shape[0]
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(w, x1 + padding)
    y1 = min(h, y1 + padding)
    return im.crop((x0, y0, x1, y1))


def main() -> int:
    args = [a for a in sys.argv[1:] if a]
    use_rembg = False
    do_recolor = False
    if "--rembg" in args:
        use_rembg = True
        args = [a for a in args if a != "--rembg"]
    if "--no-rembg" in args:
        args = [a for a in args if a != "--no-rembg"]
    if "--recolor" in args:
        do_recolor = True
        args = [a for a in args if a != "--recolor"]
    src = os.path.abspath(args[0] if args else SRC_DEFAULT)
    if not os.path.isfile(src):
        print(f"找不到原图: {src}", file=sys.stderr)
        return 1

    if use_rembg:
        im = matte_rembg(src)
    else:
        im = matte_chroma_screen(Image.open(src))

    arr = np.array(im, dtype=np.uint8)
    if do_recolor:
        recolor_pink_volume(arr)
    if use_rembg:
        cleanup_alpha_fringe(arr)
        remove_light_fringe(arr)
        harden_alpha(arr)
    else:
        defringe_green_edge(arr)
        peel_outer_light_halo(arr)
        cleanup_alpha_fringe(arr)
    im = Image.fromarray(arr, "RGBA")
    im = crop_alpha_bbox(im, alpha_min=128, padding=4)

    if im.width > MAX_W:
        ratio = MAX_W / im.width
        nh = max(1, round(im.height * ratio))
        im = im.resize((MAX_W, nh), Image.Resampling.LANCZOS)

    arr = np.array(im, dtype=np.uint8)
    if do_recolor:
        recolor_pink_volume(arr)
    if not use_rembg:
        defringe_green_edge(arr)
    peel_outer_light_halo(arr)
    cleanup_alpha_fringe(arr)
    remove_light_fringe(arr)
    if use_rembg:
        harden_alpha(arr)
    im = Image.fromarray(arr, "RGBA")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT, "PNG", optimize=True)
    print(f"OK -> {OUT} {im.size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
