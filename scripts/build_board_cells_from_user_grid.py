#!/usr/bin/env python3
"""
备选：从「蓝盒 + 奶油格」**拼图网格**裁切产出 UI（不经 AI 画整盒）。

主流程请用礼盒透明底原图 + Gemini：`gen_board_cell_from_gift_source_nb2.py`（见 docs/prompt/board_cell_overlays_nb2.md）。

- cell_locked：裁切指定格，缩放到正方形输出
- cell_key：同锁定图 + 从含分享钮的格裁切角标贴到右下角
- cell_peek：叠在物品上的半透明丝带层 — 仅 #FF00FF 底 + 同色系细丝带，偏底部角标感（Gemini 图生图）

用法：
  python3 scripts/build_board_cells_from_user_grid.py
  python3 scripts/build_board_cells_from_user_grid.py --no-peek   # 跳过 API，只更新 locked/key

前置：docs/prompt/refs/board_cell_user_approved_grid.png（可替换为新版网格）
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

_REPO = Path(__file__).resolve().parent.parent
GRID_REF = _REPO / "docs" / "prompt" / "refs" / "board_cell_user_approved_grid.png"
ASSETS = "/Users/huyi/rosa_games/game_assets/huahua/assets"
OUT_DIR = f"{ASSETS}/board_cell_nb2/for_review"

# 网格划分（与当前 270×188 参考图一致：3 列 × 2 行）
GRID_COLS = 3
GRID_ROWS = 2

# 锁定：中上格（蓝盒，无分享钮）
LOCKED_COL, LOCKED_ROW = 1, 0
# 分享角标来源：中下格（图里带青绿圆形分享钮的那格）
SHARE_COL, SHARE_ROW = 1, 1

OUT_SIZE = 512

GEN = os.path.expanduser("~/.cursor/skills/gemini-image-gen/scripts/generate_images.py")
MODEL = "gemini-3.1-flash-image-preview"

# 半锁：透明色键底 + 与锁定格同色的细丝带，强调底部小角标/带尾（无蝴蝶结、无盒子）
PROMPT_PEEK = """
The INPUT IMAGE is our **approved locked cell**: light **baby-blue** isometric gift box, cream rounded tile, small daisy — **cool periwinkle outlines** (this is the color reference).

Create a NEW **1:1 square** overlay for a merge-game **PEEK** state (this layer sits ON TOP of items):
- **Background**: solid flat **#FF00FF** everywhere except the ribbon graphics (chroma-key).
- Draw **ONLY** **2 or 3 extra-thin** satin **ribbon** strokes — **NO gift box**, **NO cream tile**, **NO daisy**, **NO bow**, **NO knot**, **NO loops**.
- Ribbon color **must match the INPUT** box palette: **same periwinkle / ice-blue** + **white highlights** — **absolutely NO pink / peach / coral**.
- Place the ribbon bits mainly along the **BOTTOM** area of the frame (bottom-left / bottom-right corner tabs, short wavy segments) so it reads as small **corner marks** veiling the lower part — **not** a huge diagonal across the whole tile, **not** centered bow.

NO text.
""".strip()


def _crop_cell(im: Image.Image, col: int, row: int) -> Image.Image:
    w, h = im.size
    cw, ch = w // GRID_COLS, h // GRID_ROWS
    x0, y0 = col * cw, row * ch
    return im.crop((x0, y0, x0 + cw, y0 + ch))


def _to_square_rgba(im: Image.Image, size: int = OUT_SIZE) -> Image.Image:
    im = im.convert("RGBA")
    return im.resize((size, size), Image.Resampling.LANCZOS)


def _find_share_patch_bbox(cell_arr: np.ndarray) -> tuple[int, int, int, int]:
    """在单格图内找青绿分享钮区域，返回 (l,t,r,b)。"""
    H, W = cell_arr.shape[:2]
    r, g, b = (
        cell_arr[:, :, 0].astype(np.int16),
        cell_arr[:, :, 1].astype(np.int16),
        cell_arr[:, :, 2].astype(np.int16),
    )
    # 分享钮在格子的右下区域
    mask = np.zeros((H, W), dtype=bool)
    mask[H * 55 // 100 :, W * 55 // 100 :] = True
    m = mask & (g > 185) & (b > 185) & (r < 220) & (g - r > 28) & (b - r > 20)
    ys, xs = np.where(m)
    if len(xs) < 30:
        # 放宽
        m = mask & (g > 170) & (b > 170) & (r < 235) & (g - r > 22)
        ys, xs = np.where(m)
    if len(xs) < 10:
        raise RuntimeError("无法在网格中找到分享按钮像素，请检查 SHARE_COL/SHARE_ROW 或参考图版本。")
    l, t, r, b = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    pad = max(4, min(W, H) // 25)
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(W, r + pad)
    b = min(H, b + pad)
    return l, t, r, b


def _paste_share_on_locked(locked_sq: Image.Image, share_cell: Image.Image) -> Image.Image:
    arr = np.array(share_cell.convert("RGB"))
    l, t, r, b = _find_share_patch_bbox(arr)
    patch = share_cell.crop((l, t, r, b)).convert("RGBA")

    out = locked_sq.copy()
    lw, lh = out.size
    # 角标约为格宽的 18–22%
    target = max(24, int(lw * 0.20))
    pw, ph = patch.size
    scale = target / max(pw, ph)
    nw, nh = max(1, int(pw * scale)), max(1, int(ph * scale))
    patch = patch.resize((nw, nh), Image.Resampling.LANCZOS)

    margin = int(lw * 0.04)
    px = lw - nw - margin
    py = lh - nh - margin
    out.alpha_composite(patch, (px, py))
    return out


def _run_peek_gen(locked_path: str, out_peek: str) -> None:
    if not os.path.isfile(GEN):
        print("跳过 peek：未找到", GEN, file=sys.stderr)
        return
    print("\n=== cell_peek (Gemini) ->", out_peek, flush=True)
    r = subprocess.run(
        [
            sys.executable,
            GEN,
            PROMPT_PEEK,
            "-o",
            out_peek,
            "--image",
            locked_path,
            "--model",
            MODEL,
            "--aspect-ratio",
            "1:1",
        ]
    )
    if r.returncode != 0:
        sys.exit(r.returncode)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-peek", action="store_true", help="不调用 Gemini，只生成 locked/key")
    args = ap.parse_args()

    if not GRID_REF.is_file():
        print("缺少参考网格图:", GRID_REF, file=sys.stderr)
        sys.exit(1)

    os.makedirs(OUT_DIR, exist_ok=True)
    grid = Image.open(GRID_REF).convert("RGB")

    locked_cell = _crop_cell(grid, LOCKED_COL, LOCKED_ROW)
    share_cell = _crop_cell(grid, SHARE_COL, SHARE_ROW)

    locked_sq = _to_square_rgba(locked_cell)
    out_locked = os.path.join(OUT_DIR, "cell_locked_nb2_1x1.png")
    locked_sq.save(out_locked, optimize=True)
    print("->", out_locked)

    key_sq = _paste_share_on_locked(locked_sq, share_cell)
    out_key = os.path.join(OUT_DIR, "cell_key_nb2_1x1.png")
    key_sq.save(out_key, optimize=True)
    print("->", out_key)

    out_peek = os.path.join(OUT_DIR, "cell_peek_nb2_1x1.png")
    if args.no_peek:
        print("跳过 peek（--no-peek）", file=sys.stderr)
        if not os.path.isfile(out_peek):
            print("警告: 没有已有的 cell_peek_nb2_1x1.png", file=sys.stderr)
    else:
        _run_peek_gen(out_locked, out_peek)

    print("\n完成。请运行: python3 scripts/process_board_cell_nb2.py", flush=True)


if __name__ == "__main__":
    main()
