#!/usr/bin/env python3
"""
清涟荷影套全身 P1+P2：NB2 单张 16:9 双栏生图（白底）→ 左右切半 → rembg → letterbox 197×384。
白底不经品红 post_rembg；默认不做 vintage 横向裁切（避免裁手指）。

原图写入仓库外 game_assets/huahua/assets/raw/。

用法（仓库根）:
  python3 scripts/gen_owner_outfit_qinglian_dual_sheet.py
  python3 scripts/gen_owner_outfit_qinglian_dual_sheet.py --skip-gen
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

from huahua_paths import game_assets_dir, repo_root

ROOT = repo_root()
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import gen_owner_outfit_panels as gop  # noqa: E402

OUTFIT_ID = "outfit_qinglian"
DUAL_NAME = "owner_outfit_qinglian_dual_nb2.png"
PROMPT_FILE = ROOT / "docs/prompt/owner_outfit_qinglian_p1p2_dual_nb2_prompt.txt"


def run_gemini_dual(prompt_file: Path, out_png: Path, gen_script: Path) -> None:
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
        "16:9",
    ]
    env = os.environ.copy()
    env.setdefault("GEMINI_IMAGE_REST_ONLY", "1")
    print(" ".join(cmd), flush=True)
    last_err: Exception | None = None
    for attempt in range(4):
        try:
            subprocess.run(cmd, check=True, env=env, cwd=str(ROOT))
            return
        except subprocess.CalledProcessError as e:
            last_err = e
            if attempt < 3:
                wait = 18 + attempt * 12
                print(f"  gen failed, retry in {wait}s...", flush=True)
                import time

                time.sleep(wait)
    raise last_err  # type: ignore[misc]


def split_dual_sheet(dual_path: Path, left_path: Path, right_path: Path) -> None:
    im = Image.open(dual_path).convert("RGBA")
    w, h = im.size
    mid = w // 2
    left = im.crop((0, 0, mid, h))
    right = im.crop((mid, 0, w, h))
    left_path.parent.mkdir(parents=True, exist_ok=True)
    right_path.parent.mkdir(parents=True, exist_ok=True)
    left.save(left_path, "PNG")
    right.save(right_path, "PNG")
    print(
        f"Split {dual_path} ({w}x{h}) -> {left_path.name}, {right_path.name}",
        flush=True,
    )


def rembg_letterbox_post(
    src_panel: Path,
    dest_game: Path,
    rembg_single: Path,
    rembg_model: str,
    scale_ref: Path | None,
    height_boost: float = 1.0,
    tighten_pad: int = 1,
) -> None:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        tmp_cutout = Path(tf.name)
    try:
        cmd = [
            sys.executable,
            str(rembg_single),
            str(src_panel),
            "-o",
            str(tmp_cutout),
            "-m",
            rembg_model,
        ]
        print(" ".join(cmd), flush=True)
        subprocess.run(cmd, check=True)
        im = Image.open(tmp_cutout).convert("RGBA")
        im = gop.fit_resize_to_canvas(im, gop.FULL_W, gop.FULL_H)
        if tighten_pad > 0:
            im = gop.alpha_trim_then_fit_canvas(
                im, gop.FULL_W, gop.FULL_H, pad=tighten_pad
            )
        if scale_ref is not None:
            im = gop.match_owner_full_canvas_to_reference(
                im, scale_ref, height_boost=height_boost
            )
        dest_game.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest_game, "PNG")
        print(f"Wrote {dest_game} ({gop.FULL_W}x{gop.FULL_H})", flush=True)
    finally:
        tmp_cutout.unlink(missing_ok=True)


def main() -> None:
    ap = argparse.ArgumentParser(description="Qinglian outfit dual-sheet NB2 -> full sprites")
    ap.add_argument("--skip-gen", action="store_true")
    ap.add_argument(
        "--rembg-model",
        default=os.environ.get("REMBG_MODEL", "birefnet-general"),
    )
    ap.add_argument(
        "--match-vintage-scale",
        action="store_true",
        help="按 vintage 闭眼全身纵向占比对齐（宽臂展套装易裁切手指，清涟默认关闭）",
    )
    ap.add_argument("--height-boost", type=float, default=1.0)
    ap.add_argument("--tighten-pad", type=int, default=0, help="alpha 裁边留白；0=不裁边，保留手指")
    args = ap.parse_args()

    raw_dir = Path(os.environ.get("RAW_DIR", str(game_assets_dir() / "raw")))
    raw_dir.mkdir(parents=True, exist_ok=True)
    dual_png = raw_dir / DUAL_NAME
    raw1 = raw_dir / f"owner_{OUTFIT_ID}_p1.png"
    raw2 = raw_dir / f"owner_{OUTFIT_ID}_p2.png"

    if not PROMPT_FILE.is_file():
        print(f"Missing prompt: {PROMPT_FILE}", file=sys.stderr)
        sys.exit(2)

    gen_script = Path(
        os.environ.get(
            "GEMINI_SCRIPT",
            str(Path.home() / ".cursor/skills/gemini-image-gen/scripts/generate_images.py"),
        )
    )
    if not gen_script.is_file():
        print(f"Missing {gen_script}", file=sys.stderr)
        sys.exit(1)

    if not args.skip_gen:
        run_gemini_dual(PROMPT_FILE, dual_png, gen_script)
    elif not dual_png.is_file():
        print(f"--skip-gen but missing {dual_png}", file=sys.stderr)
        sys.exit(1)

    split_dual_sheet(dual_png, raw1, raw2)

    owner_dir = ROOT / "minigame/subpkg_chars/images/owner"
    names = gop.game_output_filenames(OUTFIT_ID)
    rembg_single = Path(
        os.environ.get(
            "REMBG_SINGLE",
            str(Path.home() / ".cursor/skills/remove-background/scripts/rembg_single.py"),
        )
    )
    scale_ref: Path | None = None
    if args.match_vintage_scale:
        ref = Path(
            os.environ.get("OWNER_FULL_SCALE_REF", str(gop.DEFAULT_OWNER_FULL_SCALE_REF))
        )
        scale_ref = ref if ref.is_file() else None

    for src, dest in ((raw1, owner_dir / names[0]), (raw2, owner_dir / names[1])):
        rembg_letterbox_post(
            src,
            dest,
            rembg_single,
            args.rembg_model.strip(),
            scale_ref,
            max(1.0, float(args.height_boost)),
            max(0, int(args.tighten_pad)),
        )
    print("\n完成: 清涟荷影全身睁眼/闭眼已写入 minigame/subpkg_chars/images/owner/", flush=True)


if __name__ == "__main__":
    main()
