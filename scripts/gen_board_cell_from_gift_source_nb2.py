#!/usr/bin/env python3
"""
基于仓库内**唯一礼盒原图**（透明底 PNG）用 Gemini 生成棋盘三态，**只写入 for_review**，默认不覆盖 minigame。

原图路径（勿用聊天截图替代；更新时覆盖此文件即可）：
  docs/prompt/refs/board_cell_gift_source.png

产出：
  game_assets/huahua/assets/board_cell_nb2/for_review/cell_{locked,peek,key}_nb2_1x1.png

只重画半锁丝带（锁定/转发不动）：
  python3 scripts/gen_board_cell_from_gift_source_nb2.py --peek-only

确认画面后**再**执行：
  python3 scripts/process_board_cell_nb2.py
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

GEN = os.path.expanduser("~/.cursor/skills/gemini-image-gen/scripts/generate_images.py")
MODEL = "gemini-3.1-flash-image-preview"
ASSETS = "/Users/huyi/rosa_games/game_assets/huahua/assets"
OUT_DIR = f"{ASSETS}/board_cell_nb2/for_review"

_REPO = Path(__file__).resolve().parent.parent
REF_GIFT = _REPO / "docs" / "prompt" / "refs" / "board_cell_gift_source.png"
# 半锁丝带：构图参考（宽丝带 + 斜向大 S 形 + 中部蝴蝶结），生成时改为淡蓝 + #FF00FF 底
REF_PEEK_RIBBON = _REPO / "docs" / "prompt" / "refs" / "cell_peek_ribbon_layout_ref.png"

# 锁定：去丝带，箱体改浅蓝，画风/透视与输入一致
PROMPT_LOCKED = """
The INPUT IMAGE is the **canonical game gift-box reference** (merge / idle game style): rounded cube box + lid, warm cream body in the reference, **coral ribbon + big bow** on top, optional small **daisy** sticker on a front face. Background may be transparent.

Generate ONE new **1:1 square** image:

- **Keep**: the **exact same 3D shape**, perspective, lid proportions, rounded edges, soft cel-shaded lighting, and **cute casual-game** look as the INPUT.
- **Remove completely**: **all ribbon** — vertical band, horizontal band, bow, knot, tails — **zero ribbon**.
- **Recolor** all **box + lid surfaces** to **light baby blue / icy powder blue** with **cool** gentle shadows and soft **periwinkle** line color. The box must **NOT** stay cream and must **NOT** turn pink — only cool light blue tones.
- **Keep** the small **daisy sticker** on the front face (adjust its outline to cool tones if needed).
- If you add empty margin to make a perfect square, use **flat #FF00FF** only; do **not** tint the box pink from the background.

NO new props, NO photoreal overhaul.
""".strip()

# 转发：与锁定成品一致，仅右下角分享角标
PROMPT_KEY = """
The INPUT IMAGE is the **final locked cell art**: plain **light-blue** rounded gift box + lid + small daisy, **no ribbons**.

Output must **match the INPUT** for the box:
- **Do not** recolor the box to pink/cream, **do not** change perspective or lighting, **do not** add ribbons.

**Only addition**: one **small glossy round button** at the **bottom-right** (~12–16% of canvas width), slightly overlapping the box corner:
- Teal / mint cyan (#26C6DA / #4DD0E1), white highlight dot, **white curved share / forward** arrow inside.

If margins exist, keep **#FF00FF** only where the input already had it; do not replace the whole background with unrelated colors.
""".strip()

# 半锁：**仅**一条横向宽丝带 + 正中蝴蝶结；不要自上垂下的弯臂 / 不要 U 形两角
PROMPT_PEEK = """
The INPUT IMAGE is a **layout hint** (may show light-blue ribbon, red boxes, or markup). **Ignore any red rectangles** — they are not part of the game art.

Generate ONE new **1:1 square** image for a merge-game **PEEK overlay**:

**Geometry (strict)**:
- Draw **ONLY ONE** continuous ribbon shape: a **single straight horizontal satin band** running across the **upper third** of the frame (like a belt across the top of a square tile).
- **Absolutely NO** extra ribbon arms curling down from the **top-left** or **top-right corners**, **NO** U-shaped drape, **NO** diagonal swoops from the corners — **delete** those ideas entirely.
- In the **exact horizontal center** of that band, tie a **butterfly bow** (two full loops + knot + short tails). The bow sits **on** the horizontal ribbon as one integrated piece.

**Scale (user asked bigger)**:
- The horizontal ribbon must be **very wide / thick**: ribbon **height (thickness)** about **24–34%** of canvas height — **bold**, not skinny.
- The bow must be **large and prominent**: bow span about **22–30%** of canvas width.
- Horizontal ribbon should stretch roughly **80–95%** of canvas width (nearly full bleed left-right), still with tiny clean margins if needed.

**Look**:
- **Pale light baby blue / powder blue** satin with **white highlights** and **soft periwinkle shadows** (NOT navy, NOT gray).
- **Background**: **flat solid #FF00FF** only outside the ribbon (chroma-key). **Clean edges**, no magenta fringing.
- **Only** horizontal ribbon + bow — **NO gift box**, **NO lid**, **NO icons**, **NO red/yellow markup**.

NO text.
""".strip()


def _prepare_ref_for_api(path: str, out_dir: str, max_side: int = 768) -> str:
    """参考图过大时 Gemini 可能 400；缩到最长边 ≤ max_side 的临时 PNG。"""
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    if max(w, h) <= max_side:
        return path
    scale = max_side / float(max(w, h))
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    os.makedirs(out_dir, exist_ok=True)
    tmp = os.path.join(out_dir, f"_api_ref_{Path(path).stem}.png")
    im.save(tmp)
    print(f"  参考图缩小 {w}x{h} -> {nw}x{nh} 用于 API", flush=True)
    return tmp


def _run(prompt: str, ref: str, out: str, *, out_dir: str) -> None:
    ref_send = _prepare_ref_for_api(ref, out_dir)
    print(f"\n=== -> {out} ===\n  ref: {ref_send}", flush=True)
    r = subprocess.run(
        [
            sys.executable,
            GEN,
            prompt,
            "-o",
            out,
            "--image",
            ref_send,
            "--model",
            MODEL,
            "--aspect-ratio",
            "1:1",
        ]
    )
    if r.returncode != 0:
        sys.exit(r.returncode)


def main() -> None:
    ap = argparse.ArgumentParser(description="从 board_cell_gift_source.png 生成三态到 for_review")
    ap.add_argument(
        "--peek-only",
        action="store_true",
        help="只重生成 cell_peek（以 docs/prompt/refs/cell_peek_ribbon_layout_ref.png 为构图参考）",
    )
    ap.add_argument(
        "--deploy",
        action="store_true",
        help="生成后立刻执行 process_board_cell_nb2.py 覆盖 minigame（默认关闭）",
    )
    args = ap.parse_args()

    if not os.path.isfile(GEN):
        print("缺少", GEN, file=sys.stderr)
        sys.exit(1)

    os.makedirs(OUT_DIR, exist_ok=True)
    ref0 = str(REF_GIFT)
    locked_out = os.path.join(OUT_DIR, "cell_locked_nb2_1x1.png")
    peek_out = os.path.join(OUT_DIR, "cell_peek_nb2_1x1.png")
    key_out = os.path.join(OUT_DIR, "cell_key_nb2_1x1.png")

    peek_ref = str(REF_PEEK_RIBBON) if REF_PEEK_RIBBON.is_file() else locked_out
    if REF_PEEK_RIBBON.is_file():
        print("半锁丝带构图参考:", REF_PEEK_RIBBON, flush=True)
    else:
        print("警告: 未找到 cell_peek_ribbon_layout_ref.png，peek 将退回用锁定图参考", file=sys.stderr)

    if args.peek_only:
        if not REF_PEEK_RIBBON.is_file() and not os.path.isfile(locked_out):
            print("缺少构图参考与锁定图，无法生成 peek。", file=sys.stderr)
            sys.exit(1)
        _run(PROMPT_PEEK, peek_ref, peek_out, out_dir=OUT_DIR)
    else:
        if not REF_GIFT.is_file():
            print("缺少礼盒原图:", REF_GIFT, file=sys.stderr)
            print("请将透明底礼盒 PNG 放到上述路径（不要用聊天缩略图）。", file=sys.stderr)
            sys.exit(1)
        _run(PROMPT_LOCKED, ref0, locked_out, out_dir=OUT_DIR)
        _run(PROMPT_PEEK, peek_ref, peek_out, out_dir=OUT_DIR)
        _run(PROMPT_KEY, locked_out, key_out, out_dir=OUT_DIR)

    print("\n已写入 for_review（尚未进包）。路径:", OUT_DIR, flush=True)
    if args.deploy:
        proc = Path(__file__).resolve().parent / "process_board_cell_nb2.py"
        r = subprocess.run([sys.executable, str(proc)])
        sys.exit(r.returncode)
    else:
        print("确认无误后再执行: python3 scripts/process_board_cell_nb2.py", flush=True)


if __name__ == "__main__":
    main()
