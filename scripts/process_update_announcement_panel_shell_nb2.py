#!/usr/bin/env python3
"""
更新公告面板壳后处理：白底 NB2 原图 → rembg birefnet-general → 清白/粉晕边 → 入库。

为何不用品红色键：面板外缘易留重品红渗色。
为何白底 + rembg：白底与薄荷绿木条不冲突；birefnet-general 抠主体后，再洪水清残留白底与浅粉晕。

标题牌须在生图阶段为薄荷绿金边留空牌，禁止程序擦字。

用法（仓库根）:
  # 需已生成 *_rembg.png，或本脚本内对 raw 调 rembg（见 --rembg）
  python3 scripts/process_update_announcement_panel_shell_nb2.py [raw.png]
  python3 scripts/process_update_announcement_panel_shell_nb2.py --rembg [raw.png]
"""
from __future__ import annotations

import os
import subprocess
import sys
from collections import deque

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DEFAULT = os.path.join(
    REPO, "../game_assets/huahua/assets/raw/update_announcement_panel_shell_nb2_v4b.png"
)
OUT = os.path.join(
    REPO, "minigame/subpkg_panels/images/ui/update_announcement_panel_shell_nb2.png"
)
REMBG = os.path.expanduser(
    "~/.cursor/skills/remove-background/scripts/rembg_single.py"
)

sys.path.insert(0, os.path.join(REPO, "scripts"))
from process_dressup_panel_shell_nb2 import crop_alpha_bbox  # noqa: E402

MAX_W = 520
PAD = 6


def _cleanup_halo(arr: np.ndarray) -> np.ndarray:
    r = arr[..., 0].astype(np.int16)
    g = arr[..., 1].astype(np.int16)
    b = arr[..., 2].astype(np.int16)
    a = arr[..., 3].astype(np.int16)

    kill = (a > 0) & (
        ((r >= 245) & (g >= 245) & (b >= 245))
        | ((r >= 230) & (b >= 225) & (g >= 215) & (r + b >= 2 * g + 6) & (r >= g))
        | ((r >= 220) & (b >= 220) & (g <= 120))
    )
    arr = arr.copy()
    arr[kill, 3] = 0

    r = arr[..., 0].astype(np.int16)
    g = arr[..., 1].astype(np.int16)
    b = arr[..., 2].astype(np.int16)
    a = arr[..., 3].astype(np.int16)
    h, w = a.shape

    def is_bg(y: int, x: int) -> bool:
        if a[y, x] == 0:
            return True
        rr, gg, bb = int(r[y, x]), int(g[y, x]), int(b[y, x])
        if rr >= 242 and gg >= 242 and bb >= 242:
            return True
        if (
            rr >= 228
            and bb >= 225
            and gg >= 210
            and rr + bb >= 2 * gg + 8
            and min(rr, gg, bb) >= 200
        ):
            return True
        return False

    vis = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg(y, x):
                vis[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not vis[y, x] and is_bg(y, x):
                vis[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not vis[ny, nx] and is_bg(ny, nx):
                vis[ny, nx] = True
                q.append((ny, nx))
    arr[vis, 3] = 0

    a = arr[..., 3]
    trans = a == 0
    adj = np.zeros_like(trans)
    adj[1:, :] |= trans[:-1, :]
    adj[:-1, :] |= trans[1:, :]
    adj[:, 1:] |= trans[:, :-1]
    adj[:, :-1] |= trans[:, 1:]
    soft = adj & (a > 0) & (a < 170)
    arr[soft, 3] = 0

    # Hard-cut ghost fringe; despill pink RGB baked into outer contour
    a = arr[..., 3]
    arr[a < 36, 3] = 0
    opaque = arr[..., 3] >= 36
    trans = ~opaque
    dil = trans.copy()
    for _ in range(2):
        n = np.zeros_like(dil)
        n[1:, :] |= dil[:-1, :]
        n[:-1, :] |= dil[1:, :]
        n[:, 1:] |= dil[:, :-1]
        n[:, :-1] |= dil[:, 1:]
        dil |= n
    edge = opaque & dil
    r = arr[..., 0].astype(np.float32)
    g = arr[..., 1].astype(np.float32)
    b = arr[..., 2].astype(np.float32)
    pink = edge & (
        ((r > g + 8) & (r > 140))
        | ((r > g + 5) & (b > g + 5) & (r + b > 2 * g + 20))
    )
    r[pink] = np.minimum(r[pink], g[pink] + 12)
    b[pink] = np.minimum(b[pink], g[pink] + 4)
    hot = edge & (r > g + 15) & (r > 160)
    r[hot] = g[hot] + 10
    b[hot] = np.minimum(b[hot], g[hot] + 6)
    arr[..., 0] = np.clip(r, 0, 255).astype(np.uint8)
    arr[..., 2] = np.clip(b, 0, 255).astype(np.uint8)
    return arr


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--rembg"]
    do_rembg = "--rembg" in sys.argv[1:]
    src = os.path.abspath(args[0] if args else SRC_DEFAULT)
    if not os.path.isfile(src):
        print(f"找不到原图: {src}", file=sys.stderr)
        return 1

    work = src
    if do_rembg or not src.endswith("_rembg.png"):
        rembg_out = os.path.splitext(src)[0] + "_rembg.png"
        if do_rembg or not os.path.isfile(rembg_out):
            print(f"rembg birefnet-general -> {rembg_out}", flush=True)
            subprocess.check_call(
                ["python3", REMBG, src, "-o", rembg_out, "-m", "birefnet-general"]
            )
        work = rembg_out

    arr = _cleanup_halo(np.array(Image.open(work).convert("RGBA")))
    im = crop_alpha_bbox(Image.fromarray(arr, "RGBA"), padding=PAD)

    if im.width > MAX_W:
        ratio = MAX_W / im.width
        im = im.resize((MAX_W, max(1, round(im.height * ratio))), Image.Resampling.LANCZOS)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT, "PNG", optimize=True)
    print(f"OK -> {OUT} {im.size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
