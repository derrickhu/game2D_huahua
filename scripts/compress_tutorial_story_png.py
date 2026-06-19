#!/usr/bin/env python3
"""
全屏新手开场插画 PNG 压缩（750×1344 等竖版场景图）。

使用 pngquant 自适应 256 色 + Floyd–Steinberg 抖动 + oxipng，在体积与渐变.sky 画质间折中。
勿用 PIL FASTOCTREE 256 色量化（全屏渐变易色带/偏色）。

用法（仓库根）:
  python3 scripts/compress_tutorial_story_png.py
  python3 scripts/compress_tutorial_story_png.py path/to/story_1.png
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATHS = [
    ROOT / "minigame/images/tutorial/story_1.png",
    ROOT / "minigame/subpkg_panels/images/tutorial/story_1.png",
]

#  vivid 渐变插画：略放宽质量下限，pngquant 对本图稳定落在 ~320–370KB
PNGQUANT_QUALITY = "65-85"


def compress_one(src: Path) -> None:
    if not src.is_file():
        raise FileNotFoundError(src)
    before = src.stat().st_size
    pngquant = shutil.which("pngquant")
    if not pngquant:
        raise RuntimeError("pngquant not found (brew install pngquant)")

    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        tmp = Path(tf.name)

    try:
        cmd = [
            pngquant,
            f"--quality={PNGQUANT_QUALITY}",
            "--speed",
            "1",
            "--strip",
            "--force",
            "-o",
            str(tmp),
            str(src),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError(f"pngquant failed ({r.returncode}): {r.stderr or r.stdout}")

        oxipng = shutil.which("oxipng")
        if oxipng:
            subprocess.run([oxipng, "-o", "4", "--strip", "all", str(tmp)], check=True)

        shutil.move(str(tmp), str(src))
    finally:
        if tmp.exists():
            tmp.unlink(missing_ok=True)

    after = src.stat().st_size
    pct = (1 - after / before) * 100 if before else 0
    print(f"{src}: {before // 1024}KB -> {after // 1024}KB ({pct:.0f}% saved)")


def main(argv: list[str]) -> int:
    paths = [Path(p) for p in argv[1:]] if len(argv) > 1 else DEFAULT_PATHS
    for p in paths:
        compress_one(p)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
