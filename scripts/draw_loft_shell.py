#!/usr/bin/env python3
"""等距双层房壳。

平面 (0,0) 是最里面的墙角。i 朝屏幕右下（后墙延伸方向），j 朝屏幕左下。
二楼是贴后墙的整层高地台（j < LOFT_J），一楼在地台前面，左侧小楼梯接到二楼前沿。
不含屋顶、院墙和摆设。
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw

# 进深沿 j，面宽沿 i。一楼是正方形。二楼贴后墙，进深更短。
# 后墙在二楼墙高上从右墙角再往右延伸，右墙仍立在楼板角上。
W = 14.5
LOFT_J = 8.2
D = LOFT_J + W
WALL_EXT = 3.2
FLOOR_H = 6.6
WALL_TOP = 11.4
WALL_T = 0.32
PLINTH = 0.95
# 前右角只留一小块缺口放外台阶。
NOTCH_I = W - 1.45
NOTCH_J = D - 1.05

STAIR_I1 = 1.35
STAIR_RUN = 1.85
STEPS = 6

# 2:1 等距：墙脚、地坪边相对水平约 ±26.6°。
HW = 52.0
HH = 26.0
ZH = 46.0

INK = (104, 70, 54, 255)
WALL_L = (255, 246, 234, 255)
WALL_R = (244, 226, 206, 255)
WALL_TOP_C = (214, 198, 184, 255)
WALL_SIDE = (236, 218, 198, 255)
WALL_END = (228, 206, 184, 255)
LOFT_FACE = (248, 234, 216, 255)
PODIUM_SIDE = (236, 214, 192, 255)
FLOOR_UP = (224, 166, 122, 255)
FLOOR_DN = (212, 148, 104, 255)
NOSE = (176, 116, 82, 255)
PLINTH_TOP = (168, 114, 88, 255)
PLINTH_A = (146, 94, 74, 255)
PLINTH_B = (124, 78, 62, 255)
TREAD = (206, 150, 108, 255)
RISER = (164, 112, 80, 255)
SIDE = (154, 104, 76, 255)
RAIL = (96, 62, 50, 255)
STEP_TOP = (190, 136, 100, 255)
STEP_FACE = (150, 100, 76, 255)

OUT = 1280
SS = 3


def project(i: float, j: float, z: float) -> tuple[float, float]:
    return ((i - j) * HW, (i + j) * HH - z * ZH)


def quad(i0, j0, i1, j1, z) -> list[tuple[float, float]]:
    return [project(i0, j0, z), project(i1, j0, z), project(i1, j1, z), project(i0, j1, z)]


class Canvas:
    def __init__(self) -> None:
        self.polys: list[tuple[list[tuple[float, float]], tuple, bool]] = []
        self.lines: list[tuple[list[tuple[float, float]], tuple, float]] = []

    def add(self, pts, fill, stroke=True) -> None:
        self.polys.append((pts, fill, stroke))

    def line(self, pts, fill=INK, width=2.4) -> None:
        self.lines.append((pts, fill, width))

    def save(self, path: str, bg=None) -> None:
        pts = [p for poly, _, _ in self.polys for p in poly]
        minx = min(p[0] for p in pts)
        miny = min(p[1] for p in pts)
        maxx = max(p[0] for p in pts)
        maxy = max(p[1] for p in pts)
        margin = 36 * SS
        avail = OUT * SS - margin * 2
        scale = min(avail / (maxx - minx), avail / (maxy - miny))
        ox = (OUT * SS - (maxx - minx) * scale) / 2 - minx * scale
        oy = (OUT * SS - (maxy - miny) * scale) / 2 - miny * scale

        def tx(p):
            return (p[0] * scale + ox, p[1] * scale + oy)

        img = Image.new("RGBA", (OUT * SS, OUT * SS), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        sw = max(2, int(round(1.35 * SS)))
        for poly, fill, stroke in self.polys:
            mapped = [tx(p) for p in poly]
            draw.polygon(mapped, fill=fill)
            if stroke:
                draw.line(mapped + [mapped[0]], fill=INK, width=sw, joint="curve")
        for poly, fill, width in self.lines:
            mapped = [tx(p) for p in poly]
            draw.line(mapped, fill=fill, width=max(2, int(round(width * SS * scale / 8))), joint="curve")
        img = img.resize((OUT, OUT), Image.Resampling.LANCZOS)
        if bg is not None:
            base = Image.new("RGBA", (OUT, OUT), bg)
            base.alpha_composite(img)
            img = base
        os.makedirs(os.path.dirname(path), exist_ok=True)
        img.save(path, "PNG")


def stair_js(k: int) -> tuple[float, float, float, float]:
    """第 k 级，0 是最下面一级。返回 j_front, j_back, z0, z1。"""
    z0 = FLOOR_H * k / STEPS
    z1 = FLOOR_H * (k + 1) / STEPS
    j_front = LOFT_J + STAIR_RUN * (1 - k / STEPS)
    j_back = LOFT_J + STAIR_RUN * (1 - (k + 1) / STEPS)
    return j_front, j_back, z0, z1


def add_rail(c: Canvas) -> None:
    """扶手只沿踏步上方抬起，厚度朝上，不斜切进楼梯侧面。"""
    rise = 0.55
    bar = 0.12
    i0 = STAIR_I1
    i1 = STAIR_I1 + 0.1

    def jz(k: float, extra: float = 0.0) -> tuple[float, float]:
        j = LOFT_J + STAIR_RUN * (1 - k / STEPS)
        z = FLOOR_H * k / STEPS + rise + extra
        return j, z

    low = [jz(k) for k in range(STEPS + 1)]
    high = [jz(k, bar) for k in range(STEPS + 1)]
    band = [project(i0, j, z) for j, z in low] + [project(i0, j, z) for j, z in reversed(high)]
    c.add(band, RAIL, stroke=False)
    c.add(
        [project(i1, j, z) for j, z in high] + [project(i0, j, z) for j, z in reversed(high)],
        RAIL,
        stroke=False,
    )
    c.line(band + [band[0]], INK, 1.8)
    for k in (0, STEPS // 2, STEPS):
        j, _z = jz(k)
        z_base = FLOOR_H * k / STEPS + 0.04
        z_top = FLOOR_H * k / STEPS + rise + bar
        c.add([
            project(i0, j, z_base), project(i1, j, z_base),
            project(i1, j, z_top), project(i0, j, z_top),
        ], RAIL)


def build() -> Canvas:
    c = Canvas()
    end_i = W + WALL_EXT
    c.add([
        project(0, 0, 0), project(0, D, 0),
        project(0, D, WALL_TOP), project(0, 0, WALL_TOP),
    ], WALL_L)
    c.add([
        project(W, 0, 0), project(W, NOTCH_J, 0),
        project(W, NOTCH_J, WALL_TOP), project(W, 0, WALL_TOP),
    ], WALL_SIDE)
    c.add([
        project(W + WALL_T, 0, 0), project(W + WALL_T, NOTCH_J, 0),
        project(W + WALL_T, NOTCH_J, WALL_TOP), project(W + WALL_T, 0, WALL_TOP),
    ], WALL_END)
    # 后墙最后画，一整面拉过右墙角，延伸段盖住角上的接缝。
    c.add([
        project(0, 0, FLOOR_H), project(end_i, 0, FLOOR_H),
        project(end_i, 0, WALL_TOP), project(0, 0, WALL_TOP),
    ], WALL_R)
    c.add([
        project(-WALL_T, -WALL_T, FLOOR_H), project(end_i, -WALL_T, FLOOR_H),
        project(end_i, -WALL_T, WALL_TOP), project(-WALL_T, -WALL_T, WALL_TOP),
    ], WALL_END)
    c.add([
        project(end_i, -WALL_T, FLOOR_H), project(end_i, 0, FLOOR_H),
        project(end_i, 0, WALL_TOP), project(end_i, -WALL_T, WALL_TOP),
    ], WALL_SIDE)

    c.add(quad(-WALL_T, -WALL_T, end_i, 0, WALL_TOP), WALL_TOP_C)
    c.add(quad(W, 0, W + WALL_T, NOTCH_J, WALL_TOP), WALL_TOP_C)
    c.add(quad(-WALL_T, 0, 0, D, WALL_TOP), WALL_TOP_C)

    # 二楼地面，贴后墙，右缘收到右墙。
    c.add(quad(0, 0, W, LOFT_J, FLOOR_H), FLOOR_UP)
    # 二楼前沿的竖面。左侧让给楼梯。
    c.add([
        project(STAIR_I1, LOFT_J, 0), project(W, LOFT_J, 0),
        project(W, LOFT_J, FLOOR_H), project(STAIR_I1, LOFT_J, FLOOR_H),
    ], LOFT_FACE)
    c.add([
        project(STAIR_I1, LOFT_J, FLOOR_H - 0.16), project(W, LOFT_J, FLOOR_H - 0.16),
        project(W, LOFT_J, FLOOR_H), project(STAIR_I1, LOFT_J, FLOOR_H),
    ], NOSE)

    # 一楼拆成两块凸多边形，共享边不描线，避免凹多边形填出一条缝。
    c.add(quad(0, LOFT_J, W, NOTCH_J, 0), FLOOR_DN, stroke=False)
    c.add(quad(0, NOTCH_J, NOTCH_I, D, 0), FLOOR_DN, stroke=False)
    floor_edge = [
        project(0, LOFT_J, 0), project(W, LOFT_J, 0), project(W, NOTCH_J, 0),
        project(NOTCH_I, NOTCH_J, 0), project(NOTCH_I, D, 0), project(0, D, 0),
    ]
    c.line(floor_edge + [floor_edge[0]], INK, 2.2)

    # 楼梯侧面：实心，贴左墙，朝房间中线的这一面可见。
    for k in range(STEPS - 1, -1, -1):
        j_front, j_back, _z0, z1 = stair_js(k)
        c.add([
            project(STAIR_I1, j_front, 0), project(STAIR_I1, j_front, z1),
            project(STAIR_I1, j_back, z1), project(STAIR_I1, j_back, 0),
        ], SIDE, stroke=False)
    side = [project(STAIR_I1, LOFT_J + STAIR_RUN, 0)]
    j_cursor = LOFT_J + STAIR_RUN
    for k in range(STEPS):
        _jf, j_back, _z0, z1 = stair_js(k)
        side.append(project(STAIR_I1, j_cursor, z1))
        side.append(project(STAIR_I1, j_back, z1))
        j_cursor = j_back
    side.append(project(STAIR_I1, LOFT_J, 0))
    c.line(side + [side[0]], INK, 2.6)

    # 踏步从远到近，近处的一级盖住上面一级的底边。
    for k in range(STEPS - 1, -1, -1):
        j_front, j_back, z0, z1 = stair_js(k)
        c.add([
            project(0, j_front, z0), project(STAIR_I1, j_front, z0),
            project(STAIR_I1, j_front, z1), project(0, j_front, z1),
        ], RISER)
        c.add([
            project(0, j_back, z1), project(STAIR_I1, j_back, z1),
            project(STAIR_I1, j_front, z1), project(0, j_front, z1),
        ], TREAD)

    add_rail(c)

    c.add([
        project(-WALL_T, D, 0), project(0, D, 0),
        project(0, D, WALL_TOP), project(-WALL_T, D, WALL_TOP),
    ], WALL_END)

    # 一楼正面地台，收到缺口为止。
    c.add([
        project(0, D, 0), project(NOTCH_I, D, 0),
        project(NOTCH_I, D, -PLINTH), project(0, D, -PLINTH),
    ], PLINTH_A)
    c.add([
        project(NOTCH_I, NOTCH_J, 0), project(NOTCH_I, D, 0),
        project(NOTCH_I, D, -PLINTH), project(NOTCH_I, NOTCH_J, -PLINTH),
    ], PLINTH_B)

    # 缺口里两级小台阶，只占前右角。
    mid = NOTCH_J + (D - NOTCH_J) * 0.5
    treads = [
        (NOTCH_J, mid, 0.0, -PLINTH * 0.5),
        (mid, D, -PLINTH * 0.5, -PLINTH),
    ]
    for j0, j1, z1, z0 in treads:
        c.add([
            project(NOTCH_I, j0, z1), project(W, j0, z1),
            project(W, j1, z1), project(NOTCH_I, j1, z1),
        ], STEP_TOP)
        c.add([
            project(NOTCH_I, j1, z0), project(W, j1, z0),
            project(W, j1, z1), project(NOTCH_I, j1, z1),
        ], STEP_FACE)
        c.add([
            project(NOTCH_I, j0, z0), project(NOTCH_I, j1, z0),
            project(NOTCH_I, j1, z1), project(NOTCH_I, j0, z1),
        ], PLINTH_B)
    return c


def main() -> None:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "game_assets", "huahua", "assets", "preview_house_room"))
    c = build()
    c.save(os.path.join(root, "loft_shell_v1.png"))
    c.save(os.path.join(root, "loft_shell_v1_preview.png"), bg=(246, 228, 210, 255))
    print(root)


if __name__ == "__main__":
    main()
