#!/usr/bin/env python3
"""
女王套全身 P1+P2：NB2 单张 16:9 双栏生图 → 左右切半 → **rembg 识别抠图**（不用色键）→ letterbox 197×384 → owner_sprite_post_rembg。

默认 **不再** 按 vintage 闭眼全身做二次体量对齐（避免按旧套比例硬拉）；3 头身与纵向占满半栏由提示词约束。rembg 后先 letterbox，再 **按 alpha 裁透明边并二次 letterbox**（`--tighten-pad`，默认 1），抵消双栏半幅里人物偏小的问题。若仍需与旧套一致可加 `--match-vintage-scale`。

默认抠图模型：**birefnet-general**（项目规范默认档）。若边仍不理想可试 `--rembg-model isnet-anime`。渗色清理脚本已收紧，避免误吃紫粉裙装（旧版会把裙边当品红抠穿）。

原图写入仓库外 game_assets/huahua/assets/raw/，见 game-art-asset-flow。

用法（仓库根）:
  python3 scripts/gen_owner_outfit_queen_dual_sheet.py
  python3 scripts/gen_owner_outfit_queen_dual_sheet.py --skip-gen
  python3 scripts/gen_owner_outfit_queen_dual_sheet.py --skip-gen --rembg-model birefnet-general

环境变量: GEMINI_SCRIPT, GEMINI_API_KEY, REMBG_SINGLE, REMBG_MODEL；与 vintage 对齐时可用 OWNER_FULL_SCALE_REF、OWNER_FULL_SCALE_HEIGHT_BOOST
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image

from huahua_paths import game_assets_dir, repo_root

ROOT = repo_root()
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import gen_owner_outfit_panels as gop  # noqa: E402


OUTFIT_ID = "outfit_queen"
DUAL_NAME = "owner_outfit_queen_dual_nb2.png"


def run_gemini_dual(
    prompt_file: Path,
    out_png: Path,
    gen_script: Path,
) -> None:
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
    print(f"Split {dual_path} ({w}x{h}) -> {left_path.name} ({left.size[0]}x{left.size[1]}), {right_path.name} ({right.size[0]}x{right.size[1]})", flush=True)


def rembg_letterbox_post(
    src_panel: Path,
    dest_game: Path,
    rembg_single: Path,
    post_script: Path,
    rembg_model: str,
    scale_ref: Path | None,
    height_boost: float = 1.0,
    tighten_pad: int = 1,
) -> None:
    """半幅品红底 PNG → rembg → letterbox → alpha 裁边再 letterbox → 可选 vintage 对齐 → post_rembg。"""
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
            print(
                f"  scale match ref: {scale_ref.name} (height_boost={height_boost})",
                flush=True,
            )
        dest_game.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest_game, "PNG")
        print(
            f"Wrote {dest_game} ({gop.FULL_W}x{gop.FULL_H}) via rembg -m {rembg_model} + letterbox",
            flush=True,
        )
        subprocess.run([sys.executable, str(post_script), str(dest_game)], check=True)
        print(f"Post-rembg cleanup: {dest_game}", flush=True)
    finally:
        tmp_cutout.unlink(missing_ok=True)


def main() -> None:
    ap = argparse.ArgumentParser(description="Queen outfit dual-sheet NB2 -> full_outfit_queen + eyesclosed")
    ap.add_argument(
        "--skip-gen",
        action="store_true",
        help=f"Skip API; expect raw/{DUAL_NAME} already present",
    )
    ap.add_argument(
        "--rembg-model",
        default=os.environ.get("REMBG_MODEL", "birefnet-general"),
        metavar="NAME",
        help="rembg -m 模型（默认 birefnet-general；插画可试 isnet-anime）",
    )
    ap.add_argument(
        "--match-vintage-scale",
        action="store_true",
        help="按 full_outfit_vintage_eyesclosed 纵向占比二次对齐（默认关闭；女王 3 头身以生图为准）",
    )
    ap.add_argument(
        "--height-boost",
        type=float,
        default=float(os.environ.get("OWNER_FULL_SCALE_HEIGHT_BOOST", "1.0")),
        metavar="F",
        help="与 --match-vintage-scale 联用：参考纵向占比再乘此系数（默认 1.0）",
    )
    ap.add_argument(
        "--tighten-pad",
        type=int,
        default=1,
        metavar="PX",
        help="rembg 后按 alpha 裁透明边再 letterbox，四边留白像素（默认 1；调大更保守、人物略小；0=跳过）",
    )
    args = ap.parse_args()
    rembg_model: str = args.rembg_model.strip()
    if not rembg_model:
        print("错误: --rembg-model 不能为空", file=sys.stderr)
        sys.exit(2)

    raw_dir = Path(os.environ.get("RAW_DIR", str(game_assets_dir() / "raw")))
    raw_dir.mkdir(parents=True, exist_ok=True)
    dual_png = raw_dir / DUAL_NAME
    raw1 = raw_dir / f"owner_{OUTFIT_ID}_p1.png"
    raw2 = raw_dir / f"owner_{OUTFIT_ID}_p2.png"

    prompt_file = ROOT / "docs/prompt/owner_outfit_queen_p1p2_dual_nb2_prompt.txt"
    if not prompt_file.is_file():
        print(f"Missing prompt: {prompt_file}", file=sys.stderr)
        sys.exit(2)

    gen_default = Path.home() / ".cursor/skills/gemini-image-gen/scripts/generate_images.py"
    gen_script = Path(os.environ.get("GEMINI_SCRIPT", str(gen_default)))
    if not gen_script.is_file():
        print(f"Missing {gen_script}", file=sys.stderr)
        sys.exit(1)

    if not args.skip_gen:
        run_gemini_dual(prompt_file, dual_png, gen_script)
    elif not dual_png.is_file():
        print(f"--skip-gen but missing {dual_png}", file=sys.stderr)
        sys.exit(1)

    split_dual_sheet(dual_png, raw1, raw2)

    owner_dir = ROOT / "minigame/subpkg_chars/images/owner"
    owner_dir.mkdir(parents=True, exist_ok=True)
    names = gop.game_output_filenames(OUTFIT_ID)
    rembg_single = Path(
        os.environ.get(
            "REMBG_SINGLE",
            str(Path.home() / ".cursor/skills/remove-background/scripts/rembg_single.py"),
        )
    )
    post_script = ROOT / "scripts/owner_sprite_post_rembg.py"
    if not rembg_single.is_file():
        print(f"Missing rembg_single.py: {rembg_single}", file=sys.stderr)
        sys.exit(1)
    scale_ref: Path | None = None
    if args.match_vintage_scale:
        ref = Path(os.environ.get("OWNER_FULL_SCALE_REF", str(gop.DEFAULT_OWNER_FULL_SCALE_REF)))
        scale_ref = ref if ref.is_file() else None
        if scale_ref is None:
            print(f"[warn] --match-vintage-scale 但未找到参考图，跳过对齐: {ref}", flush=True)
    hb = max(1.0, float(args.height_boost))
    tp = max(0, int(args.tighten_pad))
    rembg_letterbox_post(
        raw1,
        owner_dir / names[0],
        rembg_single,
        post_script,
        rembg_model,
        scale_ref,
        hb,
        tp,
    )
    rembg_letterbox_post(
        raw2,
        owner_dir / names[1],
        rembg_single,
        post_script,
        rembg_model,
        scale_ref,
        hb,
        tp,
    )
    print(
        f"\n完成: 已写入 minigame 两张全身（rembg -m {rembg_model} + letterbox + post_rembg），未使用色键。",
        flush=True,
    )


if __name__ == "__main__":
    main()
