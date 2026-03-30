#!/usr/bin/env python3
"""
将客人 / 店主 PNG 规范到工程既有「压缩」上限（与入库脚本一致），避免超大原图进主包。

- 客人 `minigame/subpkg_chars/images/customer/*.png`：与 `scripts/process_customer_busts_new5_rembg.sh` 内联逻辑一致
  — 先按高度 256 等比缩放，若宽 > 240 再按最大宽 240 约束（CustomerView 里半身像目标高约 160 逻辑像素，256≈1.6×，再缩易糊）。
- 店主 `minigame/subpkg_chars/images/owner/`：`full_*` → 画布 197×384，`chibi_*` → 249×384，仅当任一边 **超过** 对应画布边时，
  按 `gen_owner_outfit_panels.fit_resize_to_canvas` 等比缩入画布（与 `scripts/gen_owner_outfit_panels.py` 一致）。
- 跳过文件名含 `original` 的备份。

之后若本机有 oxipng，会对**有改动的文件**再跑 `-o4 --strip safe`。

用法（仓库根）:
  python3 scripts/normalize_character_pngs.py
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
CUSTOMER_DIR = REPO / "minigame/subpkg_chars/images/customer"
OWNER_DIR = REPO / "minigame/subpkg_chars/images/owner"

FULL_W, FULL_H = 197, 384
CHIBI_W, CHIBI_H = 249, 384

CUSTOMER_H = 256
CUSTOMER_WMAX = 240


def fit_resize_to_canvas(im: Image.Image, tw: int, th: int) -> Image.Image:
    """等比缩放后居中放入 tw×th 透明画布（与 gen_owner_outfit_panels 一致）。"""
    im = im.convert("RGBA")
    sw, sh = im.size
    if sw < 1 or sh < 1:
        return Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    scale = min(tw / sw, th / sh)
    nw = max(1, int(round(sw * scale)))
    nh = max(1, int(round(sh * scale)))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    out.paste(resized, ((tw - nw) // 2, (th - nh) // 2), resized)
    return out


def normalize_customer_bust(im: Image.Image) -> Image.Image | None:
    w, h = im.size
    if h < 1:
        return None
    nw = max(1, int(round(w * CUSTOMER_H / h)))
    nh = CUSTOMER_H
    if nw > CUSTOMER_WMAX:
        nh = max(1, int(round(h * CUSTOMER_WMAX / w)))
        nw = CUSTOMER_WMAX
    if (nw, nh) == (w, h):
        return None
    return im.convert("RGBA").resize((nw, nh), Image.Resampling.LANCZOS)


def downscale_owner_if_oversized(im: Image.Image, tw: int, th: int) -> Image.Image | None:
    sw, sh = im.size
    if sw <= tw and sh <= th:
        return None
    return fit_resize_to_canvas(im, tw, th)


def pick_oxipng() -> str | None:
    env = os.environ.get("OXIPNG")
    if env and os.path.isfile(env) and os.access(env, os.X_OK):
        return env
    for p in ("/opt/homebrew/bin/oxipng", "/usr/local/bin/oxipng"):
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return None


def main() -> None:
    changed: list[Path] = []

    if CUSTOMER_DIR.is_dir():
        for path in sorted(CUSTOMER_DIR.glob("*.png")):
            if "original" in path.name.lower():
                continue
            im = Image.open(path)
            out = normalize_customer_bust(im)
            if out is not None:
                out.save(path, optimize=True, compress_level=9)
                changed.append(path)
                print(f"customer {path.name} -> {out.size[0]}x{out.size[1]}")

    if OWNER_DIR.is_dir():
        for path in sorted(OWNER_DIR.glob("*.png")):
            if "original" in path.name.lower():
                continue
            name = path.name
            if name.startswith("chibi_"):
                tw, th = CHIBI_W, CHIBI_H
            elif name.startswith("full_"):
                tw, th = FULL_W, FULL_H
            else:
                continue
            im = Image.open(path)
            out = downscale_owner_if_oversized(im, tw, th)
            if out is not None:
                out.save(path, optimize=True, compress_level=9)
                changed.append(path)
                print(f"owner {path.name} -> {out.size[0]}x{out.size[1]}")

    ox = pick_oxipng()
    if ox and changed:
        subprocess.run(
            [ox, "-o", "4", "--strip", "safe", "--quiet"] + [str(p) for p in changed],
            check=False,
        )

    print(f"Done. Updated {len(changed)} file(s).")


if __name__ == "__main__":
    main()
