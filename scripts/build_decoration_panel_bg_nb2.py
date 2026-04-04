#!/usr/bin/env python3
"""
从 NB2 输出生成装修面板资源：

- **底板**（默认）：`deco_nb2_main_panel_blank_9x16.png` → `decoration_panel_bg_nb2.png`（标题 + 纯色身，rembg）。
- （可选/遗留）**凹槽阴影层**：`--asset well-shadow` 或 `both`，见脚本内说明；当前主流程仅底板一张，右侧平面由底图本身完成。

默认流程（底板为**纯白** #FFFFFF 外圈）：
  → **优先** skill **`rembg_single.py -m birefnet-general`**（CPU 固定线程，大图也可在合理时间跑完；
     不靠色键）。可用 **`REMBG_MODEL`** 指定 skill 支持的其它模型（见 rembg_single 的 -m 列表）。
  → 若设 **`REMBG_PREFER_CLI=1`** 或 **`--rembg-cli-first`**：先走 PATH 上的 **`rembg i`**（可配
     **`REMBG_MODEL`**，如 `birefnet-massive` + `-ppm`）；**massive 单图可能极慢，切勿并行多开**。
  → 仍失败时再回退另一条路径 / **`--fallback-model`**（默认 birefnet-general）。
  → crop_trim → `despill_white_fringe` 压白边（去浅白渗边，非主抠图）

`--chroma`：品红软色键（旧 NB2）。`--chroma-white`：白底软色键兜底。

用法（仓库根）：
  python3 scripts/build_decoration_panel_bg_nb2.py
  python3 scripts/build_decoration_panel_bg_nb2.py --asset both
  python3 scripts/build_decoration_panel_bg_nb2.py --asset well-shadow
  python3 scripts/build_decoration_panel_bg_nb2.py --chroma-white
  python3 scripts/build_decoration_panel_bg_nb2.py --src /path/to/raw.png
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
_SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(_SCRIPTS))

import chroma_magenta_nb2  # noqa: E402
from huahua_paths import game_assets_dir  # noqa: E402

REMBG = Path.home() / ".cursor/skills/remove-background/scripts/rembg_single.py"
CROP_TRIM = Path.home() / ".cursor/skills/game-art-pipeline/scripts/crop_trim.py"

# 与 ~/.cursor/skills/remove-background/scripts/rembg_single.py 的 -m choices 一致
SKILL_REMBG_MODELS = frozenset(
    ("birefnet-general", "birefnet-general-lite", "u2net", "isnet-anime")
)


def _run_rembg_cli(
    rembg_exe: str,
    src: Path,
    raw_out: Path,
    *,
    model: str,
    alpha_matting: bool,
    post_process_mask: bool,
) -> bool:
    cmd = [rembg_exe, "i", "-m", model]
    if alpha_matting:
        cmd.append("-a")
    if post_process_mask:
        cmd.append("-ppm")
    cmd.extend([str(src), str(raw_out)])
    r = subprocess.run(cmd, cwd=str(ROOT))
    return r.returncode == 0 and raw_out.is_file()


def _run_rembg_skill(src: Path, raw_out: Path, model: str) -> bool:
    if not REMBG.is_file():
        return False
    r = subprocess.run(
        [
            sys.executable,
            str(REMBG),
            str(src),
            "-o",
            str(raw_out),
            "-m",
            model,
        ],
        cwd=str(ROOT),
    )
    return r.returncode == 0 and raw_out.is_file()


def _run_rembg_crop_despill(
    src: Path,
    out: Path,
    *,
    rembg_model: str | None,
    alpha_matting: bool,
    post_process_mask: bool,
    fallback_model: str,
    cli_first: bool,
) -> None:
    model = (rembg_model or os.environ.get("REMBG_MODEL", "birefnet-general")).strip()
    rembg_bin = os.environ.get("REMBG_BIN", "rembg").strip() or "rembg"
    rembg_exe = shutil.which(rembg_bin)
    prefer_cli = cli_first or os.environ.get("REMBG_PREFER_CLI", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )

    def log_cli() -> None:
        print(
            f"rembg CLI: {rembg_exe} i -m {model}"
            f"{' -a' if alpha_matting else ''}{' -ppm' if post_process_mask else ''}",
            flush=True,
        )

    def log_skill(m: str) -> None:
        print(f"rembg skill: {REMBG.name} -m {m}", flush=True)

    with tempfile.TemporaryDirectory() as td:
        tdir = Path(td)
        raw_rembg = tdir / "rembg.png"
        ok = False

        def try_cli() -> bool:
            if not rembg_exe:
                return False
            log_cli()
            return _run_rembg_cli(
                rembg_exe,
                src,
                raw_rembg,
                model=model,
                alpha_matting=alpha_matting,
                post_process_mask=post_process_mask,
            )

        def try_skill(m: str) -> bool:
            log_skill(m)
            return _run_rembg_skill(src, raw_rembg, m)

        if prefer_cli and rembg_exe:
            ok = try_cli()
            if not ok and model in SKILL_REMBG_MODELS and REMBG.is_file():
                print(
                    "rembg CLI failed; trying skill with same model",
                    file=sys.stderr,
                    flush=True,
                )
                ok = try_skill(model)
        elif model in SKILL_REMBG_MODELS and REMBG.is_file():
            ok = try_skill(model)
            if not ok and rembg_exe:
                print(
                    "rembg skill failed; trying CLI",
                    file=sys.stderr,
                    flush=True,
                )
                ok = try_cli()
        elif rembg_exe:
            ok = try_cli()
        elif REMBG.is_file() and fallback_model in SKILL_REMBG_MODELS:
            print(
                f"model {model!r} needs rembg CLI; rembg not in PATH, using skill -m {fallback_model}",
                file=sys.stderr,
                flush=True,
            )
            ok = try_skill(fallback_model)

        if (
            not ok
            and fallback_model != model
            and fallback_model in SKILL_REMBG_MODELS
            and REMBG.is_file()
        ):
            print(
                f"rembg fallback: skill -m {fallback_model}",
                file=sys.stderr,
                flush=True,
            )
            ok = try_skill(fallback_model)

        if not ok:
            if not REMBG.is_file() and not rembg_exe:
                print("Missing rembg CLI and skill script:", REMBG, file=sys.stderr)
            print("rembg failed", file=sys.stderr)
            sys.exit(1)
        trimmed = tdir / "trim.png"
        if CROP_TRIM.is_file():
            subprocess.run(
                [
                    sys.executable,
                    str(CROP_TRIM),
                    str(raw_rembg),
                    "-o",
                    str(trimmed),
                    "--padding",
                    "4",
                ],
                cwd=str(ROOT),
                check=True,
            )
            im = Image.open(trimmed).convert("RGBA")
        else:
            im = Image.open(raw_rembg).convert("RGBA")
        arr = np.array(im)
        chroma_magenta_nb2.despill_white_fringe(arr, lum_thresh=234.0, strength=0.42)
        # 只压真正接近灰白的晕，避免误伤桃粉圆角边（否则顶栏抠边发糊、发脏）
        chroma_magenta_nb2.crush_rembg_white_halo(
            arr, lum_min=248.0, sat_max=22.0, alpha_scale=0.5, alpha_cap=28.0
        )
        chroma_magenta_nb2.despill_white_fringe(arr, lum_thresh=248.0, sat_max=32.0, strength=0.28)
        chroma_magenta_nb2.scrub_dark_semi_transparent(arr)
        Image.fromarray(arr, "RGBA").save(out, "PNG")


WELL_SHADOW_DEFAULT_OUT = ROOT / "minigame/subpkg_panels/images/ui/decoration_panel_well_shadow_nb2.png"


def _run_well_shadow_chroma_trim(src: Path, out: Path) -> None:
    """
    家具凹槽阴影层：整图白底 + 局部浅阴影，用距离软键去白（不用 rembg，避免吃掉淡阴影）。
    """
    im = Image.open(src).convert("RGBA")
    keyed = chroma_magenta_nb2.chroma_white_distance_soft(im, d_full=12.0, d_blend=72.0)
    arr = np.array(keyed.convert("RGBA"))
    chroma_magenta_nb2.despill_white_fringe(arr, lum_thresh=250.0, sat_max=28.0, strength=0.2)
    chroma_magenta_nb2.scrub_dark_semi_transparent(arr)
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        tdir = Path(td)
        raw = tdir / "keyed.png"
        Image.fromarray(arr, "RGBA").save(raw, "PNG")
        if CROP_TRIM.is_file():
            trimmed = tdir / "trim.png"
            subprocess.run(
                [
                    sys.executable,
                    str(CROP_TRIM),
                    str(raw),
                    "-o",
                    str(trimmed),
                    "--padding",
                    "4",
                ],
                cwd=str(ROOT),
                check=True,
            )
            shutil.copyfile(trimmed, out)
        else:
            shutil.copyfile(raw, out)


def main() -> None:
    ap = argparse.ArgumentParser(description="Build decoration panel base PNG (+ optional well shadow) from NB2 raw.")
    ap.add_argument(
        "--src",
        type=str,
        default=None,
        help="源 PNG（默认 game_assets/.../deco_nb2_main_panel_blank_9x16.png）",
    )
    ap.add_argument(
        "-o",
        "--output",
        type=str,
        default=str(ROOT / "minigame/subpkg_panels/images/ui/decoration_panel_bg_nb2.png"),
    )
    ap.add_argument(
        "--chroma",
        action="store_true",
        help="不用 rembg，品红软色键 + 品红 despill（旧 NB2）",
    )
    ap.add_argument(
        "--chroma-white",
        action="store_true",
        help="不用 rembg，白底软色键 + 白边 despill",
    )
    ap.add_argument("--flood", action="store_true", help="洪水填充去底板（实验）")
    ap.add_argument("--d-full", type=float, default=38.0)
    ap.add_argument("--d-blend", type=float, default=105.0)
    ap.add_argument(
        "--rembg-model",
        type=str,
        default=None,
        help="覆盖 REMBG_MODEL；默认 birefnet-general（skill 优先）",
    )
    ap.add_argument(
        "--rembg-cli-first",
        action="store_true",
        help="先 rembg i（可 -ppm），再 skill；等同 REMBG_PREFER_CLI=1",
    )
    ap.add_argument(
        "--alpha-matting",
        action="store_true",
        help="传给 rembg i：-a（更慢，难边可试）",
    )
    ap.add_argument(
        "--no-ppm",
        action="store_true",
        help="关闭 rembg i 的 -ppm（默认开启）",
    )
    ap.add_argument(
        "--fallback-model",
        type=str,
        default="birefnet-general",
        help="CLI 失败时 rembg_single.py 使用的模型",
    )
    ap.add_argument(
        "--asset",
        type=str,
        choices=("base", "well-shadow", "both"),
        default="base",
        help="base=底板 well-shadow=凹槽阴影层 both=底板+阴影（阴影源缺则跳过）",
    )
    ap.add_argument(
        "--well-shadow-src",
        type=str,
        default=None,
        help="阴影层源图（默认 game_assets/.../deco_nb2_furniture_well_shadow_9x16.png）",
    )
    ap.add_argument(
        "--well-shadow-out",
        type=str,
        default=str(WELL_SHADOW_DEFAULT_OUT),
        help="阴影层输出 PNG 路径",
    )
    args = ap.parse_args()

    assets_root = game_assets_dir() / "deco_panel_ui_nb2/for_review"
    default_base_src = assets_root / "deco_nb2_main_panel_blank_9x16.png"
    default_shadow_src = assets_root / "deco_nb2_furniture_well_shadow_9x16.png"

    def do_base() -> None:
        src = Path(args.src or default_base_src)
        if not src.is_file():
            print("Missing:", src, file=sys.stderr)
            sys.exit(1)
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        _build_base_inner(src, out, args)

    def do_shadow() -> None:
        s = Path(args.well_shadow_src or default_shadow_src)
        if not s.is_file():
            print("Skip well-shadow (missing source):", s, file=sys.stderr)
            return
        o = Path(args.well_shadow_out)
        _run_well_shadow_chroma_trim(s, o)
        im = Image.open(o)
        print(f"saved {o} size={im.size} bbox={im.getbbox()}", flush=True)

    if args.asset == "base":
        do_base()
        return
    if args.asset == "well-shadow":
        do_shadow()
        return
    # both
    do_base()
    do_shadow()
    return


def _build_base_inner(src: Path, out: Path, args: argparse.Namespace) -> None:
    if args.flood:
        im = Image.open(src)
        out_im = chroma_magenta_nb2.decoration_panel_bg_pipeline(im)
        out_im.save(out, "PNG")
    elif args.chroma:
        im = Image.open(src)
        out_im = chroma_magenta_nb2.chroma_magenta_distance_soft(
            im, d_full=args.d_full, d_blend=args.d_blend
        )
        arr = np.array(out_im)
        chroma_magenta_nb2.despill_magenta_fringe(arr, tint_thresh=18.0, strength=0.65)
        Image.fromarray(arr, "RGBA").save(out, "PNG")
    elif args.chroma_white:
        im = Image.open(src)
        out_im = chroma_magenta_nb2.chroma_white_distance_soft(
            im, d_full=24.0, d_blend=88.0
        )
        arr = np.array(out_im)
        chroma_magenta_nb2.despill_white_fringe(arr, lum_thresh=232.0, strength=0.6)
        Image.fromarray(arr, "RGBA").save(out, "PNG")
    else:
        _run_rembg_crop_despill(
            src,
            out,
            rembg_model=args.rembg_model,
            alpha_matting=args.alpha_matting,
            post_process_mask=not args.no_ppm,
            fallback_model=args.fallback_model.strip() or "birefnet-general",
            cli_first=args.rembg_cli_first,
        )

    im = Image.open(out)
    bbox = im.getbbox()
    print(f"saved {out} size={im.size} bbox={bbox}", flush=True)


if __name__ == "__main__":
    main()
