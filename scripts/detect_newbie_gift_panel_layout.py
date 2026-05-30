#!/usr/bin/env python3
"""检测 newbie_gift_qinglian_promo_panel_nb2 母图布局，输出归一化坐标供 NewbieGiftPanelLayout 校准。"""
from __future__ import annotations

import os
import sys

try:
    from PIL import Image
    import numpy as np
    from scipy import ndimage
except ImportError:
    print("需要 Pillow + numpy + scipy", file=sys.stderr)
    sys.exit(1)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PANEL = os.path.join(ROOT, "minigame", "subpkg_panels", "images", "ui", "newbie_gift_qinglian_promo_panel_nb2.png")


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else PANEL
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    brightness = (r.astype(float) + g + b) / 3

    print(f"size {w}x{h}")

    cream = (a > 200) & (brightness > 200) & (brightness < 250) & (r > 190) & (g > 170)
    labeled, n = ndimage.label(cream.astype(np.uint8))
    best = None
    for i in range(1, n + 1):
        ys, xs = np.where(labeled == i)
        if len(ys) < 5000:
            continue
        cy = ys.mean()
        if cy < h * 0.2 or cy > h * 0.85:
            continue
        if best is None or len(ys) > best[0]:
            best = (len(ys), xs.min(), ys.min(), xs.max(), ys.max())

    if best:
        _, x0, y0, x1, y1 = best
        print(f"content: left={x0/w:.4f} right={x1/w:.4f} top={y0/h:.4f} bottom={y1/h:.4f}")

    y_band = int(h * 0.82)
    sub = arr[y_band:h, int(w * 0.08):int(w * 0.92)]
    sr, sg, sb, sa = sub[:, :, 0], sub[:, :, 1], sub[:, :, 2], sub[:, :, 3]
    orange = (sa > 200) & (sr > 210) & (sg > 130) & (sg < 210) & (sb < 110)
    ys, xs = np.where(orange)
    if len(xs):
        xoff = int(w * 0.08)
        print(
            f"cta: nx={(xs.mean()+xoff)/w:.4f} ny={(ys.mean()+y_band)/h:.4f} "
            f"nw={(xs.max()-xs.min()+1)/w:.4f} nh={(ys.max()-ys.min()+1)/h:.4f}"
        )

    red = (a > 200) & (r > 180) & (g < 100) & (b < 100)
    ys, xs = np.where(red)
    top_red = [(x, y) for x, y in zip(xs, ys) if y < h * 0.15 and x > w * 0.75]
    if top_red:
        print(f"close: nx={np.mean([p[0] for p in top_red])/w:.4f} ny={np.mean([p[1] for p in top_red])/h:.4f}")


if __name__ == "__main__":
    main()
