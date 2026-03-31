#!/usr/bin/env python3
"""
无损压缩 minigame 下 PNG：Pillow zlib compress_level=9 + optimize，仅当新文件更小才覆盖。

说明：多数由 Figma/导出工具生成的 PNG 已 zlib 较优，Pillow 往往 0 收益。
macOS 上请优先用 **oxipng**（见同目录 optimize_minigame_pngs.sh），无损空间通常更好。

不缩分辨率、不转有损格式、不量化颜色。
"""
from __future__ import annotations

import os
import shutil
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "minigame"


def save_optimized(src: Path) -> tuple[int, int, bool]:
    """(old_bytes, new_bytes, replaced)."""
    old = src.stat().st_size
    try:
        im = Image.open(src)
        im.load()
    except Exception as e:
        print(f"SKIP open {src.relative_to(ROOT)}: {e}", file=sys.stderr)
        return old, old, False

    save_kw: dict = {"format": "PNG", "optimize": True, "compress_level": 9}
    if im.mode == "P":
        t = im.info.get("transparency")
        if t is not None:
            save_kw["transparency"] = t

    fd, tmp = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        im.save(tmp, **save_kw)
        new = os.path.getsize(tmp)
        if new < old:
            shutil.move(tmp, str(src))
            return old, new, True
        os.unlink(tmp)
        return old, old, False
    except Exception as e:
        if os.path.exists(tmp):
            os.unlink(tmp)
        print(f"SKIP save {src.relative_to(ROOT)}: {e}", file=sys.stderr)
        return old, old, False


def main() -> None:
    if not ROOT.is_dir():
        print(f"Not a directory: {ROOT}", file=sys.stderr)
        sys.exit(1)

    pngs = sorted(p for p in ROOT.rglob("*.png") if p.is_file())
    pngs += sorted(p for p in ROOT.rglob("*.PNG") if p.is_file())
    # 去重（大小写）
    seen: set[Path] = set()
    unique: list[Path] = []
    for p in pngs:
        rp = p.resolve()
        if rp in seen:
            continue
        seen.add(rp)
        unique.append(p)

    total_before = sum(p.stat().st_size for p in unique)
    saved = 0
    changed = 0
    for p in unique:
        o, n, rep = save_optimized(p)
        if rep:
            changed += 1
            saved += o - n
    total_after = total_before - saved
    print(f"PNG files: {len(unique)}")
    print(f"Changed: {changed} (smaller only)")
    print(f"Total before: {total_before / 1024 / 1024:.2f} MiB")
    print(f"Total after:  {total_after / 1024 / 1024:.2f} MiB")
    print(f"Saved:        {saved / 1024 / 1024:.2f} MiB")


if __name__ == "__main__":
    main()
