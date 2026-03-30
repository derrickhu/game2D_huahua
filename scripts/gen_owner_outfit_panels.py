#!/usr/bin/env python3
"""
分三张竖图生成同一套店主形象（避免横排三等分 AI 对不齐），再 **等比缩放 + 居中 letterbox** 放入目标画布 + 品红去底。

注意：入库尺寸 **249×384（半身）**、**197×384（全身）** 的宽高比 **宽于** API 的 **9:16**；若直接 `resize(tw,th)` 非等比拉伸，半身会像被横向压扁。现改为 `fit_resize_to_canvas` 保持原图比例，不足区域透明。

参考图策略：P2 仍附 P1 全身以保持闭眼姿态一致；P3（半身）对 **非 outfit_default** 套附 `minigame/subpkg_chars/images/owner/chibi_default.png`（已通过验收的默认半身）以对齐胸像比例与画风，避免 P1 SD 全身把模型带偏。

用法:
  python3 scripts/gen_owner_outfit_panels.py <outfit_id> <p1.txt> <p2.txt> [p3.txt] [--preview-root DIR] [--only-panel N] [--full-only]

  --full-only  只生成全身睁眼/闭眼（P1+P2），跳过半身 P3，不写 chibi PNG；可不传 p3 路径。

默认写入仓库内 minigame/subpkg_chars/images/owner/。
若指定 --preview-root，则写入 DIR/<outfit_id>/（含 raw/ 与最终 full/chibi），不修改 minigame。

环境变量:
  GEMINI_SCRIPT  默认 ~/.cursor/skills/gemini-image-gen/scripts/generate_images.py
  RAW_DIR        默认 game_assets/huahua/assets/raw（仓库外）
"""
from __future__ import annotations

import argparse
import math
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

FULL_W, FULL_H = 197, 384
CHIBI_W, CHIBI_H = 249, 384


def fit_resize_to_canvas(im: Image.Image, tw: int, th: int) -> Image.Image:
    """等比缩放后居中放入 tw×th 透明画布，避免 9:16 原图被非等比拉扁。"""
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


def game_output_filenames(outfit_id: str) -> tuple[str, str, str]:
    """与 TextureCache 一致：默认套文件名不带 outfit_ 前缀。"""
    if outfit_id == "outfit_default":
        return ("full_default.png", "full_default_eyesclosed.png", "chibi_default.png")
    return (
        f"full_{outfit_id}.png",
        f"full_{outfit_id}_eyesclosed.png",
        f"chibi_{outfit_id}.png",
    )


def chroma_ff00ff_to_alpha(
    im: Image.Image,
    hard_dist: float = 52.0,
    soft_band: float = 36.0,
) -> Image.Image:
    im = im.convert("RGBA")
    out: list[tuple[int, int, int, int]] = []
    for r, g, b, a in im.getdata():
        d = math.sqrt((r - 255) ** 2 + (g - 0) ** 2 + (b - 255) ** 2)
        if d <= hard_dist:
            out.append((0, 0, 0, 0))
        elif d <= hard_dist + soft_band:
            na = int(255 * (d - hard_dist) / soft_band)
            out.append((r, g, b, max(0, min(255, na))))
        else:
            out.append((r, g, b, a))
    out_im = Image.new("RGBA", im.size)
    out_im.putdata(out)
    return out_im


def shrink_for_api_ref(src: Path, max_side: int = 1024) -> Path:
    """大图作参考时 API 易 400，缩略后仅用于 --image。"""
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    m = max(w, h)
    if m <= max_side:
        return src
    scale = max_side / m
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    out = src.parent / f"{src.stem}_ref{src.suffix}"
    im.save(out, "PNG")
    print(f"[ref] scaled {w}x{h} -> {nw}x{nh} -> {out}", flush=True)
    return out


def run_gemini(prompt_file: Path, out_png: Path, ref: Path | None, gen_script: Path) -> None:
    cmd = [
        sys.executable,
        str(gen_script),
        "--prompt-file",
        str(prompt_file),
        "--output",
        str(out_png),
        "--model",
        "gemini-3.1-flash-image-preview",
        "--aspect-ratio",
        "9:16",
    ]
    if ref is not None:
        cmd.extend(["--image", str(ref)])
    env = os.environ.copy()
    env.setdefault("GEMINI_IMAGE_REST_ONLY", "1")
    print(" ".join(cmd), flush=True)
    last_err: Exception | None = None
    for attempt in range(4):
        try:
            subprocess.run(cmd, check=True, env=env)
            return
        except subprocess.CalledProcessError as e:
            last_err = e
            if attempt < 3:
                wait = 18 + attempt * 12
                print(f"  gen failed, retry in {wait}s...", flush=True)
                time.sleep(wait)
    raise last_err  # type: ignore[misc]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate owner outfit 3-panel sprites")
    parser.add_argument("outfit_id")
    parser.add_argument("p1", type=Path, help="prompt file panel 1")
    parser.add_argument("p2", type=Path, help="prompt file panel 2")
    parser.add_argument(
        "p3",
        type=Path,
        nargs="?",
        default=None,
        help="prompt file panel 3（半身）；配合 --full-only 可省略",
    )
    parser.add_argument(
        "--full-only",
        action="store_true",
        help="只生成 P1+P2 全身图并入库，跳过 P3，不覆盖 chibi",
    )
    parser.add_argument(
        "--preview-root",
        type=Path,
        default=None,
        help="Write to ROOT/<outfit_id>/ (+ raw/) only; do not write minigame/subpkg_chars/images/owner",
    )
    parser.add_argument(
        "--only-panel",
        type=int,
        choices=(1, 2, 3),
        default=None,
        metavar="N",
        help="Only regenerate panel N (1=full open, 2=eyes closed, 3=bust). Other raw PNGs must already exist under RAW_DIR.",
    )
    args = parser.parse_args()

    outfit_id = args.outfit_id
    p1 = args.p1.resolve()
    p2 = args.p2.resolve()
    p3 = args.p3.resolve() if args.p3 is not None else None
    if not args.full_only and p3 is None:
        print("错误: 未提供 p3 提示词文件。若只需全身像请加 --full-only。", file=sys.stderr)
        sys.exit(2)

    root = Path(__file__).resolve().parents[1]
    default_raw = Path("/Users/huyi/rosa_games/game_assets/huahua/assets/raw")
    raw_dir = Path(os.environ.get("RAW_DIR", str(default_raw)))
    raw_dir.mkdir(parents=True, exist_ok=True)

    gen_default = Path.home() / ".cursor/skills/gemini-image-gen/scripts/generate_images.py"
    gen_script = Path(os.environ.get("GEMINI_SCRIPT", str(gen_default)))

    if args.preview_root is not None:
        final_dest = args.preview_root.resolve() / outfit_id
        final_dest.mkdir(parents=True, exist_ok=True)
        raw_copy_dir = final_dest / "raw"
        raw_copy_dir.mkdir(parents=True, exist_ok=True)
    else:
        final_dest = root / "minigame/subpkg_chars/images/owner"
        final_dest.mkdir(parents=True, exist_ok=True)
        raw_copy_dir = None

    raw1 = raw_dir / f"owner_{outfit_id}_p1.png"
    raw2 = raw_dir / f"owner_{outfit_id}_p2.png"
    raw3 = raw_dir / f"owner_{outfit_id}_p3.png"

    op = args.only_panel
    if args.full_only and op == 3:
        print("错误: --full-only 与 --only-panel 3 互斥", file=sys.stderr)
        sys.exit(2)

    if op is None or op == 1:
        run_gemini(p1, raw1, None, gen_script)
    elif not raw1.is_file():
        print(f"Missing {raw1}; run without --only-panel or regenerate panel 1 first.", file=sys.stderr)
        sys.exit(1)

    ref_for_p2 = shrink_for_api_ref(raw1)
    if outfit_id == "outfit_default":
        ref_for_p3 = ref_for_p2
    else:
        canon_bust = root / "minigame/subpkg_chars/images/owner/chibi_default.png"
        if canon_bust.is_file():
            ref_for_p3 = shrink_for_api_ref(canon_bust)
        else:
            print(
                "[warn] minigame/subpkg_chars/images/owner/chibi_default.png missing; P3 falls back to P1 full-body ref",
                flush=True,
            )
            ref_for_p3 = ref_for_p2

    if op is None or op == 2:
        run_gemini(p2, raw2, ref_for_p2, gen_script)
    elif op == 3 and not raw2.is_file():
        print(f"Note: {raw2} missing (panel 2 not required for --only-panel 3).", flush=True)

    if not args.full_only and (op is None or op == 3):
        if p3 is None:
            print("内部错误: 需要 p3", file=sys.stderr)
            sys.exit(2)
        run_gemini(p3, raw3, ref_for_p3, gen_script)

    if raw_copy_dir is not None:
        to_copy = [raw1]
        if op is None or op == 2:
            to_copy.append(raw2)
        if not args.full_only and (op is None or op == 3):
            to_copy.append(raw3)
        for rp in to_copy:
            if rp.is_file():
                shutil.copy2(rp, raw_copy_dir / rp.name)
        for extra in {ref_for_p2.resolve(), ref_for_p3.resolve()}:
            if extra != raw1.resolve() and extra.is_file():
                shutil.copy2(extra, raw_copy_dir / extra.name)

    names = game_output_filenames(outfit_id)
    all_targets = [
        (raw1, final_dest / names[0], FULL_W, FULL_H),
        (raw2, final_dest / names[1], FULL_W, FULL_H),
        (raw3, final_dest / names[2], CHIBI_W, CHIBI_H),
    ]
    if args.full_only:
        if op == 1:
            targets = [all_targets[0]]
        elif op == 2:
            targets = [all_targets[1]]
        else:
            targets = [all_targets[0], all_targets[1]]
    elif op == 1:
        targets = [all_targets[0]]
    elif op == 2:
        targets = [all_targets[1]]
    elif op == 3:
        targets = [all_targets[2]]
    else:
        targets = all_targets

    for src, dest, tw, th in targets:
        im = Image.open(src).convert("RGBA")
        im = fit_resize_to_canvas(im, tw, th)
        im = chroma_ff00ff_to_alpha(im)
        im.save(dest, "PNG")
        print(f"Wrote {dest} ({tw}x{th})", flush=True)

    if args.preview_root is not None:
        note = args.preview_root.resolve() / "README.txt"
        if not note.exists():
            note.write_text(
                "店主形象规范试做输出。美术说明见仓库 docs/owner_sprite_art_spec.md\n"
                "验收后再拷贝到 minigame/subpkg_chars/images/owner/ 并确保 TextureCache 已注册。\n",
                encoding="utf-8",
            )
        print(f"[preview] bundle under {final_dest}", flush=True)


if __name__ == "__main__":
    main()
