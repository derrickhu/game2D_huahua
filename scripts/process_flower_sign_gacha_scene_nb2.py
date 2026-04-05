#!/usr/bin/env python3
"""
许愿喷泉立绘：NB2 原图（#FF00FF 品红底）→ 四边洪水去底板 + rembg(birefnet-general) 合并 alpha →
轻量品红/白 despill → strip_chroma → crop_trim → minigame/subpkg_panels/...

「图满意只重抠」时：保留 raw，跑本脚本即可。外轮廓以洪水为准，内部细节以 rembg 为准；
后处理已减弱，避免吃掉立体高光边。

用法（仓库根，且 raw 已存在）:
  python3 scripts/process_flower_sign_gacha_scene_nb2.py

依赖：../game_assets/huahua/assets/raw/flower_sign_gacha_scene_nb2.png
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from collections import deque

import numpy as np
from PIL import Image

from huahua_paths import game_assets_dir

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = str(game_assets_dir() / "raw")
RAW_NAME = "flower_sign_gacha_scene_nb2.png"
OUT = os.path.join(REPO, "minigame/subpkg_panels/images/ui/flower_sign_gacha_scene_nb2.png")
REMBG = os.path.expanduser("~/.cursor/skills/remove-background/scripts/rembg_single.py")
TRIM = os.path.expanduser("~/.cursor/skills/game-art-pipeline/scripts/crop_trim.py")
STRIP = os.path.join(REPO, "scripts/strip_chroma_key_magenta_png.py")

sys.path.insert(0, os.path.join(REPO, "scripts"))
import chroma_magenta_nb2  # noqa: E402


def _kill_opaque_white_fringe_next_to_void(rgba: np.ndarray) -> None:
    """紧贴全透明邻像素的近白高亮像素改为透明（压 NB2 贴纸白边）。"""
    a = rgba[:, :, 3].astype(np.int16)
    r, g, b = rgba[:, :, 0], rgba[:, :, 1], rgba[:, :, 2]
    lum = (r.astype(np.float32) + g.astype(np.float32) + b.astype(np.float32)) / 3.0
    mx = np.maximum(np.maximum(r, g), b).astype(np.float32)
    mn = np.minimum(np.minimum(r, g), b).astype(np.float32)
    sat = mx - mn
    h, w = rgba.shape[:2]
    ap = np.pad(a, ((1, 1), (1, 1)), mode="constant", constant_values=0)
    nmin = np.minimum.reduce(
        [
            ap[0:h, 0:w],
            ap[0:h, 1 : w + 1],
            ap[0:h, 2 : w + 2],
            ap[1 : h + 1, 0:w],
            ap[1 : h + 1, 2 : w + 2],
            ap[2 : h + 2, 0:w],
            ap[2 : h + 2, 1 : w + 1],
            ap[2 : h + 2, 2 : w + 2],
        ]
    )
    near_void = nmin < 48
    whiteish = (lum >= 220.0) & (sat <= 62.0) & (a > 80)
    m = near_void & whiteish
    rgba[m, 0:4] = 0


def _manhattan_dist_to_transparent(alpha: np.ndarray, void_thresh: int = 22) -> np.ndarray:
    """各像素到最近「近透明」像素的 4 邻域曼哈顿距离（BFS）。"""
    h, w = alpha.shape
    dist = np.full((h, w), 10**9, dtype=np.int32)
    dq: deque[tuple[int, int]] = deque()
    for y in range(h):
        for x in range(w):
            if alpha[y, x] < void_thresh:
                dist[y, x] = 0
                dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        d0 = dist[y, x]
        step = d0 + 1
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and step < dist[ny, nx]:
                dist[ny, nx] = step
                dq.append((ny, nx))
    return dist


def _kill_pale_near_transparent_by_distance(
    rgba: np.ndarray,
    *,
    max_dist: int = 12,
    lum_min: float = 218.0,
    sat_max: float = 55.0,
    min_alpha: int = 40,
) -> None:
    """
    距透明区 ≤max_dist 的浅白/浅灰/浅薄荷实像素一律清掉（专治厚白圈，不误伤画面内部高亮：
    内部离最外透明壳通常 > max_dist）。
    """
    a = rgba[:, :, 3]
    dist = _manhattan_dist_to_transparent(a)
    r = rgba[:, :, 0].astype(np.float32)
    g = rgba[:, :, 1].astype(np.float32)
    b = rgba[:, :, 2].astype(np.float32)
    lum = (r + g + b) / 3.0
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    m = (dist <= max_dist) & (lum >= lum_min) & (sat <= sat_max) & (a >= min_alpha)
    rgba[m, 0:4] = 0


def _combine_flood_alpha_with_rembg(raw_path: str, rembg_rgba_path: str, out_path: str) -> None:
    """洪水清空与边界相连的品红外景；前景 alpha 用 rembg（保留发丝/半透明翼）。"""
    rgb = Image.open(raw_path).convert("RGB")
    flooded = chroma_magenta_nb2.exterior_magenta_flood_transparent(
        rgb,
        dist_cutoff=60.0,
        dilate_void=2,
    )
    f = np.array(flooded.convert("RGBA"), dtype=np.uint8)
    r = np.array(Image.open(rembg_rgba_path).convert("RGBA"), dtype=np.uint8)
    a_f = f[:, :, 3].astype(np.int32)
    a_r = r[:, :, 3]
    rgb_out = r[:, :, :3]
    a_out = np.where(a_f < 24, 0, a_r).astype(np.uint8)
    out = np.dstack([rgb_out, a_out])
    Image.fromarray(out, "RGBA").save(out_path)


def _gentle_post_matte(path: str) -> None:
    """轻量去渗色/灰边，避免多轮侵蚀破坏立体高光。"""
    im = Image.open(path).convert("RGBA")
    arr = np.array(im, dtype=np.uint8)
    chroma_magenta_nb2.despill_magenta_fringe(arr, tint_thresh=20.0, strength=0.48)
    chroma_magenta_nb2.despill_white_fringe(arr, lum_thresh=238.0, sat_max=36.0, strength=0.42)
    chroma_magenta_nb2.crush_rembg_white_halo(
        arr, lum_min=236.0, sat_max=38.0, alpha_scale=0.55, alpha_cap=28.0
    )
    for _ in range(2):
        _kill_opaque_white_fringe_next_to_void(arr)
    chroma_magenta_nb2.despill_magenta_fringe(arr, tint_thresh=18.0, strength=0.35)
    chroma_magenta_nb2.scrub_dark_semi_transparent(arr)
    Image.fromarray(arr, "RGBA").save(path, optimize=True)


def main() -> int:
    src = os.path.join(RAW_DIR, RAW_NAME)
    if not os.path.isfile(src):
        print(f"MISSING raw: {src}", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory(prefix="flower_sign_nb2_") as tmp:
        nobg = os.path.join(tmp, "nobg.png")
        cleaned = os.path.join(tmp, "cleaned.png")
        trimmed = os.path.join(tmp, "trimmed.png")

        r = subprocess.run(
            [sys.executable, REMBG, src, "-o", nobg, "-m", "birefnet-general"],
            check=False,
        )
        if r.returncode != 0 or not os.path.isfile(nobg):
            print("rembg failed", file=sys.stderr)
            return 1

        combined = os.path.join(tmp, "combined.png")
        _combine_flood_alpha_with_rembg(src, nobg, combined)
        shutil.copy2(combined, cleaned)
        _gentle_post_matte(cleaned)

        subprocess.run(
            [sys.executable, STRIP, cleaned, "-o", cleaned, "--bottom-rows", "40"],
            check=False,
        )

        subprocess.run(
            [sys.executable, TRIM, cleaned, "-o", trimmed, "--padding", "4"],
            check=False,
        )
        if not os.path.isfile(trimmed):
            shutil.copy2(cleaned, OUT)
        else:
            shutil.copy2(trimmed, OUT)

        im = Image.open(OUT).convert("RGBA")
        arr = np.array(im, dtype=np.uint8)
        _kill_pale_near_transparent_by_distance(arr, max_dist=6, lum_min=228.0, sat_max=48.0)
        chroma_magenta_nb2.scrub_dark_semi_transparent(arr)
        Image.fromarray(arr, "RGBA").save(OUT, optimize=True)

        print(f"OK -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
