"""Shared #FF00FF chroma-key + spill cleanup for NB2 game assets (numpy + PIL)."""
from __future__ import annotations

from collections import deque

import numpy as np
from PIL import Image


def chroma_clean_image(img: Image.Image) -> Image.Image:
    """Return RGBA image with magenta keyed to transparent."""
    d = np.array(img.convert("RGBA"), dtype=np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]

    magenta_like = ((r + b) / 2.0 - g) > 38.0
    hard_key = (r > 185) & (g < 118) & (b > 185) & ((r + b) > (g * 2.0 + 80))
    legacy = (r > 205) & (g < 102) & (b > 205)
    kill = (a > 0) & (magenta_like | hard_key | legacy)
    d[kill, 3] = 0.0

    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    tint = (r + b) / 2.0 - g
    edge_factor = np.clip(1.0 - np.maximum(tint - 28.0, 0.0) / 95.0, 0.0, 1.0)
    d[:, :, 3] = np.clip(a * edge_factor, 0.0, 255.0)

    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    active = a > 8
    excess = np.minimum(r, b) - g
    excess = np.maximum(excess - 12.0, 0.0)
    sub = 0.65 * excess
    d[:, :, 0] = np.where(active, np.clip(r - sub, 0, 255), r)
    d[:, :, 2] = np.where(active, np.clip(b - sub, 0, 255), b)

    a = d[:, :, 3]
    h, w = a.shape
    ap = np.pad(a, 1, mode="constant", constant_values=0.0)
    local_min = np.full((h, w), 255.0, dtype=np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            sl = ap[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w]
            local_min = np.minimum(local_min, sl)
    fringe = (a > 12) & (local_min < 8) & (((d[:, :, 0] + d[:, :, 2]) / 2.0 - d[:, :, 1]) > 18)
    d[fringe, 3] = 0.0

    return Image.fromarray(np.clip(d, 0, 255).astype(np.uint8))


def chroma_clean_path(path: str) -> Image.Image:
    return chroma_clean_image(Image.open(path))


def chroma_magenta_distance_soft(
    img: Image.Image,
    d_full: float = 42.0,
    d_blend: float = 118.0,
) -> Image.Image:
    """
    刻意铺 #FF00FF 品红底的 NB2 UI：按 RGB 到 (255,0,255) 的距离做软 alpha，
    避免 rembg 把「品红↔桃色头图」过渡带整块吃没。

    d < d_full → 全透；d > d_blend → 保留原 alpha；中间线性过渡。
    """
    rgba = np.array(img.convert("RGBA"), dtype=np.uint8)
    rgb = rgba[..., :3].astype(np.float32)
    t = np.array([255.0, 0.0, 255.0], dtype=np.float32)
    d = np.linalg.norm(rgb - t, axis=-1)
    a = rgba[..., 3].astype(np.float32)
    k = (d - d_full) / max(1e-6, (d_blend - d_full))
    k = np.clip(k, 0.0, 1.0)
    rgba[..., 3] = np.clip(a * k, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def _dilate_bool_4(m: np.ndarray, iterations: int = 1) -> np.ndarray:
    """m (H,W) bool — 4 邻域膨胀。"""
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


def exterior_magenta_flood_transparent(
    img: Image.Image,
    *,
    dist_cutoff: float = 62.0,
    dilate_void: int = 2,
) -> Image.Image:
    """
    从画布四边「只穿过品红类像素」做 flood：整块外部底板变透明，不留粉边硬切。
    面板主体若在内部且不连到边界的品红通道，则保持不透明（适合全幅贴边的底栏）。
    """
    rgb = np.array(img.convert("RGB"), dtype=np.float32)
    h, w = rgb.shape[:2]
    t = np.array([255.0, 0.0, 255.0], dtype=np.float32)
    dist = np.linalg.norm(rgb - t, axis=-1)
    void = dist < dist_cutoff
    if dilate_void > 0:
        void = _dilate_bool_4(void, dilate_void)
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
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = rgb.astype(np.uint8)
    rgba[:, :, 3] = 255
    rgba[visited, 3] = 0
    return Image.fromarray(rgba, "RGBA")


def chroma_white_distance_soft(
    img: Image.Image,
    d_full: float = 28.0,
    d_blend: float = 92.0,
) -> Image.Image:
    """纯白 #FFFFFF 底板：按到白色的距离做软 alpha（rembg 失败时的兜底）。"""
    rgba = np.array(img.convert("RGBA"), dtype=np.uint8)
    rgb = rgba[..., :3].astype(np.float32)
    t = np.array([255.0, 255.0, 255.0], dtype=np.float32)
    dist = np.linalg.norm(rgb - t, axis=-1)
    a = rgba[..., 3].astype(np.float32)
    k = (dist - d_full) / max(1e-6, (d_blend - d_full))
    k = np.clip(k, 0.0, 1.0)
    rgba[..., 3] = np.clip(a * k, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def despill_white_fringe(
    rgba_arr: np.ndarray,
    *,
    lum_thresh: float = 236.0,
    sat_max: float = 38.0,
    strength: float = 0.55,
) -> None:
    """削弱 rembg 后在边沿残留的灰白半透明晕（往暖米色靠）。"""
    d = rgba_arr.astype(np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    lum = (r + g + b) / 3.0
    edge = (a > 4) & (a < 253) & (lum > lum_thresh) & (sat < sat_max)
    tr, tg, tb = 252.0, 244.0, 236.0
    t2 = np.clip((lum - lum_thresh) / 25.0, 0.0, 1.0) * strength
    d[:, :, 0] = np.where(edge, r * (1 - t2) + tr * t2, r)
    d[:, :, 1] = np.where(edge, g * (1 - t2) + tg * t2, g)
    d[:, :, 2] = np.where(edge, b * (1 - t2) + tb * t2, b)
    rgba_arr[:, :, :3] = np.clip(d[:, :, :3], 0, 255).astype(np.uint8)


def scrub_dark_semi_transparent(rgba_arr: np.ndarray) -> None:
    """
    rembg / 压缩后偶发：角部 RGB 近黑但 alpha 仍中等，叠在场景上会呈黑三角。
    将「很暗 + 偏低 alpha」的像素直接清为全透明。
    """
    d = rgba_arr.astype(np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    lum = (r + g + b) / 3.0
    bad = (lum < 20.0) & (a > 2.0) & (a < 72.0)
    rgba_arr[bad, 3] = 0
    a2 = rgba_arr[:, :, 3].astype(np.float32)
    rgba_arr[a2 < 4.0, 3] = 0


def crush_rembg_white_halo(
    rgba_arr: np.ndarray,
    *,
    lum_min: float = 233.0,
    sat_max: float = 46.0,
    alpha_scale: float = 0.45,
    alpha_cap: float = 24.0,
) -> None:
    """
    rembg 在饱和色（桃头图）与 #FFFFFF 底板交界处常留灰白半透明渣；
    压低这类像素的 alpha，减轻顶栏/圆角外沿毛边（不改变面板内部实色）。

    装修大面板（桃色头 + 白底）若参数过宽，会把圆角附近的淡桃边一起压碎，抠边发脏；
    可在 build_decoration_panel_bg_nb2 里传入更严的 sat_max / 更高的 lum_min。
    """
    d = rgba_arr.astype(np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    lum = (r + g + b) / 3.0
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    fringe = (a > 5) & (a < 252) & (lum > lum_min) & (sat < sat_max)
    new_a = np.where(fringe, np.minimum(a * alpha_scale, alpha_cap), a)
    rgba_arr[:, :, 3] = np.clip(new_a, 0, 255).astype(np.uint8)


def despill_magenta_fringe(
    rgba_arr: np.ndarray,
    *,
    tint_thresh: float = 22.0,
    strength: float = 0.55,
) -> None:
    """就地削弱半透明边沿上的品红渗色（(R+B)/2 - G）。"""
    d = rgba_arr.astype(np.float32)
    r, g, b, a = d[:, :, 0], d[:, :, 1], d[:, :, 2], d[:, :, 3]
    tint = (r + b) / 2.0 - g
    edge = (a > 4) & (a < 253) & (tint > tint_thresh)
    # 往暖米色拉
    tr, tg, tb = 252.0, 244.0, 236.0
    t2 = np.clip((tint - tint_thresh) / 50.0, 0.0, 1.0) * strength
    d[:, :, 0] = np.where(edge, r * (1 - t2) + tr * t2, r)
    d[:, :, 1] = np.where(edge, g * (1 - t2) + tg * t2, g)
    d[:, :, 2] = np.where(edge, b * (1 - t2) + tb * t2, b)
    rgba_arr[:, :, :3] = np.clip(d[:, :, :3], 0, 255).astype(np.uint8)


def decoration_panel_bg_pipeline(img: Image.Image) -> Image.Image:
    """
    装修大面板底图推荐流程：洪水去底板 + 轻 despill（不依赖 rembg，避免吃头条）。
    """
    out = exterior_magenta_flood_transparent(img, dist_cutoff=62.0, dilate_void=2)
    arr = np.array(out)
    despill_magenta_fringe(arr, tint_thresh=20.0, strength=0.6)
    return Image.fromarray(arr, "RGBA")
