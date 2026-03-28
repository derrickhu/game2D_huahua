#!/usr/bin/env python3
"""
按「屏上逻辑尺寸 × 约 2～2.5 倍」保守缩小 minigame/images/ui 中明显超采样的 PNG。
全屏/近全屏条带（merge_chain_panel、签到 day7、仓库底图等）不在此表，避免发糊。

用法（仓库根目录）:
  python3 scripts/resize_minigame_ui_pngs.py
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "minigame/images/ui"

# 文件名 -> 最长边上限；或 (max_width, max_height) 元组表示 fit 进框内（等比）
RULES: dict[str, int | tuple[int, int]] = {
    # ~48～78 逻辑像素的小图标 / 锁
    "warehouse_close_btn.png": 256,
    "warehouse_slot_lock.png": 256,
    # 收纳盒格 92 逻辑像素、crop 铺满，原图 1376 严重超采样
    "cell_locked_v2.png": 512,
    # 按钮绘制约 200×50
    "flower_egg_btn_claim.png": 480,
    # 标题条 fallback 宽约 220～440
    "flower_egg_title_banner.png": 480,
    # 升级/教程奖励条宽约 520
    "flower_egg_reward_bg.png": 1080,
    # 装修卡底栏按钮，宽约 (cw-12)、高约 ≤44
    "deco_card_btn_1.png": 640,
    "deco_card_btn_2.png": 640,
    "deco_card_btn_3.png": 640,
    "deco_card_btn_4.png": 640,
    # 稀有角标约 102×28
    "deco_rarity_tag_common.png": 240,
    "deco_rarity_tag_fine.png": 240,
    "deco_rarity_tag_rare.png": 240,
    "deco_rarity_tag_limited.png": 240,
    # 底栏标题叶条宽约 ≤380
    "item_info_title_ribbon.png": 800,
    # 日卡约 197×172，非 day7 宽图
    "checkin_card_future.png": 500,
    "checkin_card_signed.png": 500,
    "checkin_card_today.png": 500,
    # 里程碑礼包图标 48×48
    "checkin_milestone_gift_1.png": 160,
    "checkin_milestone_gift_2.png": 160,
    "checkin_milestone_gift_3.png": 160,
    "checkin_milestone_gift_4.png": 160,
}


def _pick_oxipng() -> str | None:
    env = os.environ.get("OXIPNG")
    if env and os.path.isfile(env) and os.access(env, os.X_OK):
        return env
    for p in ("/opt/homebrew/bin/oxipng", "/usr/local/bin/oxipng"):
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return None


def resize_to_max_side(im: Image.Image, max_side: int) -> Image.Image | None:
    w, h = im.size
    m = max(w, h)
    if m <= max_side:
        return None
    scale = max_side / m
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    return im.convert("RGBA").resize((nw, nh), Image.Resampling.LANCZOS)


def resize_to_fit(im: Image.Image, max_w: int, max_h: int) -> Image.Image | None:
    w, h = im.size
    if w <= max_w and h <= max_h:
        return None
    scale = min(max_w / w, max_h / h)
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    return im.convert("RGBA").resize((nw, nh), Image.Resampling.LANCZOS)


def apply_rule(path: Path, rule: int | tuple[int, int]) -> bool:
    im = Image.open(path)
    if isinstance(rule, int):
        out = resize_to_max_side(im, rule)
    else:
        mw, mh = rule
        out = resize_to_fit(im, mw, mh)
    if out is None:
        return False
    out.save(path, optimize=True, compress_level=9)
    return True


def main() -> None:
    if not ROOT.is_dir():
        print(f"Missing: {ROOT}", file=sys.stderr)
        sys.exit(1)

    changed: list[Path] = []
    for name, rule in sorted(RULES.items()):
        path = ROOT / name
        if not path.is_file():
            print(f"skip (missing): {name}", file=sys.stderr)
            continue
        try:
            if apply_rule(path, rule):
                changed.append(path)
                im2 = Image.open(path)
                print(f"resize {name} -> {im2.size[0]}x{im2.size[1]}")
        except Exception as e:
            print(f"FAIL {path}: {e}", file=sys.stderr)
            sys.exit(1)

    ox = _pick_oxipng()
    if ox and changed:
        subprocess.run(
            [ox, "-o", "4", "--strip", "safe", "--quiet"] + [str(p) for p in changed],
            check=False,
        )

    print(f"Done. Resized {len(changed)} file(s).")


if __name__ == "__main__":
    main()
