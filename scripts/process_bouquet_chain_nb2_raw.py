#!/usr/bin/env python3
"""
花束双线 NB2：rembg 抠图 + 裁边 → 游戏内路径。

- tool_arrange_{1..5} → minigame/subpkg_items/images/tools/arrange/
- flower_wrap_{1..4}  → minigame/subpkg_items/images/tools/wrap/

全部 9 张均使用 rembg（birefnet-general）抠图，不再使用品红键。

  python3 scripts/process_bouquet_chain_nb2_raw.py
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

_REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO / "scripts"))
from huahua_paths import game_assets_dir  # noqa: E402
from image_trim import DEFAULT_TRIM_PADDING, trim_rgba_padding  # noqa: E402

_DEFAULT_RAW = game_assets_dir() / "raw"
_TRIM_PAD = max(DEFAULT_TRIM_PADDING, 4)
_REMBG_SCRIPT = Path.home() / ".cursor/skills/remove-background/scripts/rembg_single.py"


def _process_one(src: Path, dst: Path) -> None:
    if not src.is_file():
        print(f"SKIP missing: {src}", file=sys.stderr)
        return

    tmp = Path("/tmp") / f"rembg_{src.name}"
    result = subprocess.run(
        [sys.executable, str(_REMBG_SCRIPT), str(src), "-o", str(tmp), "-m", "birefnet-general"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"ERROR rembg {src.name}: {result.stderr}", file=sys.stderr)
        return

    im = Image.open(tmp)
    out = trim_rgba_padding(im.convert("RGBA"), padding=_TRIM_PAD)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, optimize=True)
    print(f"{src.name} -> {dst} {out.size}")


def main() -> None:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", type=Path, default=_DEFAULT_RAW)
    args = ap.parse_args()
    raw = args.raw.expanduser().resolve()

    arrange_dir = _REPO / "minigame/subpkg_items/images/tools/arrange"
    wrap_dir = _REPO / "minigame/subpkg_items/images/tools/wrap"

    for i in range(1, 6):
        _process_one(raw / f"tool_arrange_{i}_nb2.png", arrange_dir / f"tool_arrange_{i}.png")
    for i in range(1, 5):
        _process_one(raw / f"flower_wrap_{i}_nb2.png", wrap_dir / f"flower_wrap_{i}.png")


if __name__ == "__main__":
    main()
