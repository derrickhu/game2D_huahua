#!/usr/bin/env python3
"""
房间编辑工具栏 3×2 合图 — 程序稿（圆形/软胶质感「果冻钮」+ 粗圆角图标，非方形芯片）。
写入仓库外 game_assets/huahua/assets/raw/；确认后再拷入 minigame（见文末 cp 提示）。

用法（仓库根）：  python3 scripts/gen_room_edit_toolbar_icons_sheet.py
"""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw

_REPO = Path(__file__).resolve().parents[1]


def assets_raw_dir() -> Path:
    env = os.environ.get("GAME_ASSETS_HUAHUA", "").strip()
    if env:
        return Path(env).expanduser().resolve() / "assets" / "raw"
    return (_REPO.parent / "game_assets" / "huahua" / "assets" / "raw").resolve()


OUT = assets_raw_dir() / "room_edit_toolbar_icons_3x2_nb2.png"

W = H = 512
M = 8
GAP_X = 6
GAP_Y = 6
COLS, ROWS = 3, 2
BG = (252, 250, 248)

BLOB_PLUS = (240, 188, 110)
BLOB_MINUS = (100, 188, 172)
BLOB_BLUE = (118, 154, 232)
BLOB_REMOVE = (236, 128, 128)
WHITE = (255, 255, 255)
SHADOW = (190, 184, 178)
RIM = (255, 252, 248)
SPEC = (255, 248, 240)


def cell_boxes() -> list[tuple[int, int, int, int]]:
    inner_w = W - 2 * M
    inner_h = H - 2 * M
    cw = (inner_w - (COLS - 1) * GAP_X) // COLS
    ch = (inner_h - (ROWS - 1) * GAP_Y) // ROWS
    boxes: list[tuple[int, int, int, int]] = []
    for r in range(ROWS):
        for c in range(COLS):
            x0 = M + c * (cw + GAP_X)
            y0 = M + r * (ch + GAP_Y)
            boxes.append((x0, y0, x0 + cw, y0 + ch))
    return boxes


def blob_metrics(bx: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    cw = bx[2] - bx[0]
    ch = bx[3] - bx[1]
    cx = (bx[0] + bx[2]) // 2
    cy = (bx[1] + bx[3]) // 2
    r = int(min(cw, ch) * 0.42)
    ry = int(r * 0.92)
    return cx, cy, r, ry


def draw_jelly_blob(
    d: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    rx: int,
    ry: int,
    fill: tuple[int, int, int],
) -> None:
    sx0, sy0 = cx - rx + 4, cy - ry + 5
    sx1, sy1 = cx + rx + 4, cy + ry + 5
    d.ellipse([sx0, sy0, sx1, sy1], fill=SHADOW)
    x0, y0, x1, y1 = cx - rx, cy - ry, cx + rx, cy + ry
    d.ellipse([x0, y0, x1, y1], fill=fill, outline=RIM, width=3)
    hx0 = cx - rx // 2
    hy0 = cy - ry + ry // 6
    hx1 = cx - rx // 5
    hy1 = cy - ry + ry // 2
    d.ellipse([hx0, hy0, hx1, hy1], fill=SPEC)


def draw_puffy_plus(d: ImageDraw.ImageDraw, cx: int, cy: int, span: int, bar: int) -> None:
    half_w, half_t = span, max(6, bar // 2)
    d.rounded_rectangle(
        [cx - half_w, cy - half_t, cx + half_w, cy + half_t],
        radius=half_t,
        fill=WHITE,
    )
    d.rounded_rectangle(
        [cx - half_t, cy - half_w, cx + half_t, cy + half_w],
        radius=half_t,
        fill=WHITE,
    )


def draw_puffy_minus(d: ImageDraw.ImageDraw, cx: int, cy: int, span: int, bar: int) -> None:
    half_w, half_t = span, max(6, bar // 2)
    d.rounded_rectangle(
        [cx - half_w, cy - half_t, cx + half_w, cy + half_t],
        radius=half_t,
        fill=WHITE,
    )


def draw_chunky_double_h_arrow(d: ImageDraw.ImageDraw, cx: int, cy: int, half_len: int) -> None:
    y = cy
    bw = max(10, half_len // 4)
    d.rounded_rectangle(
        [cx - half_len + bw, y - bw // 2, cx + half_len - bw, y + bw // 2],
        radius=bw // 2,
        fill=WHITE,
    )
    ah = max(12, half_len // 3)
    d.polygon(
        [
            (cx - half_len, y),
            (cx - half_len + ah, y - ah),
            (cx - half_len + ah, y + ah),
        ],
        fill=WHITE,
    )
    d.polygon(
        [
            (cx + half_len, y),
            (cx + half_len - ah, y - ah),
            (cx + half_len - ah, y + ah),
        ],
        fill=WHITE,
    )


def draw_chunky_v_arrow(d: ImageDraw.ImageDraw, cx: int, cy: int, half_len: int, up: bool) -> None:
    bw = max(10, half_len // 4)
    ah = max(12, half_len // 3)
    if up:
        tip_y = cy - half_len
        base_y = cy + half_len
        d.rounded_rectangle(
            [cx - bw // 2, tip_y + ah, cx + bw // 2, base_y],
            radius=bw // 2,
            fill=WHITE,
        )
        d.polygon([(cx, tip_y), (cx - ah, tip_y + ah), (cx + ah, tip_y + ah)], fill=WHITE)
    else:
        tip_y = cy + half_len
        base_y = cy - half_len
        d.rounded_rectangle(
            [cx - bw // 2, base_y, cx + bw // 2, tip_y - ah],
            radius=bw // 2,
            fill=WHITE,
        )
        d.polygon([(cx, tip_y), (cx - ah, tip_y - ah), (cx + ah, tip_y - ah)], fill=WHITE)


def draw_chunky_x(d: ImageDraw.ImageDraw, cx: int, cy: int, span: int, thick: int) -> None:
    t = max(8, thick)
    arm = int(span * 0.75)
    from math import cos, sin, pi

    for ang in (pi / 4, -pi / 4):
        dx, dy = cos(ang), sin(ang)
        x0 = int(cx - dx * arm)
        y0 = int(cy - dy * arm)
        x1 = int(cx + dx * arm)
        y1 = int(cy + dy * arm)
        d.line([(x0, y0), (x1, y1)], fill=WHITE, width=t)


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    boxes = cell_boxes()
    fills = [BLOB_PLUS, BLOB_MINUS, BLOB_BLUE, BLOB_BLUE, BLOB_BLUE, BLOB_REMOVE]

    for i, bx in enumerate(boxes):
        cx, cy, rx, ry = blob_metrics(bx)
        draw_jelly_blob(d, cx, cy, rx, ry, fills[i])
        span = max(14, int(min(rx, ry) * 0.38))
        bar = max(12, span // 2)
        if i == 0:
            draw_puffy_plus(d, cx, cy, span, bar)
        elif i == 1:
            draw_puffy_minus(d, cx, cy, span, bar)
        elif i == 2:
            draw_chunky_double_h_arrow(d, cx, cy, int(min(rx, ry) * 0.55))
        elif i == 3:
            draw_chunky_v_arrow(d, cx, cy, int(min(rx, ry) * 0.5), True)
        elif i == 4:
            draw_chunky_v_arrow(d, cx, cy, int(min(rx, ry) * 0.5), False)
        else:
            draw_chunky_x(d, cx, cy, span, bar + 4)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, format="PNG", optimize=True)
    print("Wrote", OUT)
    print("Then: rembg + crop_trim → 合图 PNG，再运行")
    print("  python3 scripts/split_room_edit_toolbar_sheet.py <合图路径>")
    print("生成 6 张到 minigame/subpkg_panels/images/ui/room_edit_toolbar_*.png")


if __name__ == "__main__":
    main()
