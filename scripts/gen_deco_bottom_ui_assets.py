#!/usr/bin/env python3
"""
逐组件 NB2 生成装修底栏 UI 素材 → 落盘 game_assets，并按组件做抠底（默认 rembg；
白色对号图标走品红底色键）。

用法（仓库根）:
  python3 scripts/gen_deco_bottom_ui_assets.py
  python3 scripts/gen_deco_bottom_ui_assets.py --only deco_bottom_ui_panel_shell

依赖：gemini-image-gen skill、remove-background skill、本机 rembg。
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "prompt"
GAME_ASSETS = ROOT.parent / "game_assets" / "huahua" / "assets"
OUT = GAME_ASSETS / "deco_room_bottom_ui"
GEN = Path.home() / ".cursor/skills/gemini-image-gen/scripts/generate_images.py"
REMBG = Path.home() / ".cursor/skills/remove-background/scripts/rembg_single.py"
CROP = Path.home() / ".cursor/skills/game-art-pipeline/scripts/crop_trim.py"

COMPONENTS: list[tuple[str, str]] = [
    ("deco_bottom_ui_panel_shell_nb2_prompt.txt", "deco_bottom_ui_panel_shell.png"),
    ("deco_bottom_ui_inner_mint_plate_nb2_prompt.txt", "deco_bottom_ui_inner_mint_plate.png"),
    ("deco_bottom_ui_finish_button_nb2_prompt.txt", "deco_bottom_ui_finish_button.png"),
    ("deco_bottom_ui_tab_pill_inactive_nb2_prompt.txt", "deco_bottom_ui_tab_pill_inactive.png"),
    ("deco_bottom_ui_tab_pill_active_nb2_prompt.txt", "deco_bottom_ui_tab_pill_active.png"),
    ("deco_bottom_ui_item_slot_frame_nb2_prompt.txt", "deco_bottom_ui_item_slot_frame.png"),
    ("deco_bottom_ui_badge_placed_nb2_prompt.txt", "deco_bottom_ui_badge_placed.png"),
    ("deco_bottom_ui_icon_check_white_nb2_prompt.txt", "deco_bottom_ui_icon_check_white.png"),
    ("deco_bottom_ui_icon_coin_bag_nb2_prompt.txt", "deco_bottom_ui_icon_coin_bag.png"),
    ("deco_bottom_ui_icon_tab_greenhouse_nb2_prompt.txt", "deco_bottom_ui_icon_tab_greenhouse.png"),
    ("deco_bottom_ui_icon_tab_furniture_nb2_prompt.txt", "deco_bottom_ui_icon_tab_furniture.png"),
    ("deco_bottom_ui_icon_tab_appliance_nb2_prompt.txt", "deco_bottom_ui_icon_tab_appliance.png"),
    ("deco_bottom_ui_icon_tab_ornament_nb2_prompt.txt", "deco_bottom_ui_icon_tab_ornament.png"),
    ("deco_bottom_ui_icon_tab_wallart_nb2_prompt.txt", "deco_bottom_ui_icon_tab_wallart.png"),
    ("deco_bottom_ui_icon_tab_garden_nb2_prompt.txt", "deco_bottom_ui_icon_tab_garden.png"),
]


def chroma_magenta_to_transparent(src: Path, dst: Path) -> None:
    from PIL import Image
    import numpy as np

    im = Image.open(src).convert("RGBA")
    a = np.array(im, dtype=np.float32)
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    d = np.sqrt((r - 255.0) ** 2 + g**2 + (b - 255.0) ** 2)
    t = (d - 70.0) / 48.0
    t = np.clip(t, 0.0, 1.0)
    new_a = (al * t).astype(np.uint8)
    out = np.stack([r.astype(np.uint8), g.astype(np.uint8), b.astype(np.uint8), new_a], axis=-1)
    Image.fromarray(out, "RGBA").save(dst, "PNG", optimize=True, compress_level=9)


def run(cmd: list[str], env: dict[str, str] | None = None) -> None:
    print(" ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, env=env)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", type=str, default="", help="仅处理输出文件名前缀，如 deco_bottom_ui_panel_shell")
    ap.add_argument("--skip-generate", action="store_true", help="跳过 NB2，仅对已存在的 raw 做抠底")
    args = ap.parse_args()

    if not GEN.is_file() or not REMBG.is_file():
        print("缺少 skill 脚本", GEN, REMBG, file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    raw_dir = OUT / "raw_nb2"
    raw_dir.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    for k in (
        "HTTPS_PROXY",
        "https_proxy",
        "HTTP_PROXY",
        "http_proxy",
        "ALL_PROXY",
        "all_proxy",
    ):
        env.pop(k, None)
    env["GEMINI_IMAGE_REST_ONLY"] = "1"
    # 未开 Clash 等本地代理时，避免脚本默认走 127.0.0.1:7890 导致失败；需代理时可 export GEMINI_IMAGE_NO_PROXY=0
    if os.environ.get("GEMINI_IMAGE_NO_PROXY", "").strip().lower() not in ("0", "false", "no"):
        env["GEMINI_IMAGE_NO_PROXY"] = "1"

    inv_lines = [
        "# deco_room_bottom_ui 组件清单（NB2 单独生成 + 抠底）",
        f"# 输出目录: {OUT}",
        "",
    ]

    for prompt_file, out_name in COMPONENTS:
        base = out_name.replace(".png", "")
        if args.only and base != args.only and not out_name.startswith(args.only):
            continue
        prompt_path = DOCS / prompt_file
        if not prompt_path.is_file():
            print("skip missing prompt", prompt_path, file=sys.stderr)
            continue
        raw_path = raw_dir / out_name
        final_path = OUT / out_name

        if not args.skip_generate:
            run(
                [
                    sys.executable,
                    str(GEN),
                    "--prompt-file",
                    str(prompt_path),
                    "--output",
                    str(raw_path),
                    "--model",
                    "gemini-3.1-flash-image-preview",
                    "--aspect-ratio",
                    "1:1",
                ],
                env=env,
            )

        if not raw_path.is_file():
            print("missing raw", raw_path, file=sys.stderr)
            return 1

        if out_name == "deco_bottom_ui_icon_check_white.png":
            fd, tmp = tempfile.mkstemp(suffix=".png")
            os.close(fd)
            try:
                chroma_magenta_to_transparent(raw_path, Path(tmp))
                if CROP.is_file():
                    run([sys.executable, str(CROP), tmp, "-o", str(final_path), "--padding", "2"])
                else:
                    import shutil
                    shutil.copy(tmp, final_path)
            finally:
                os.unlink(tmp)
        else:
            fd, tmp_nobg = tempfile.mkstemp(suffix=".png")
            os.close(fd)
            try:
                run(
                    [
                        sys.executable,
                        str(REMBG),
                        str(raw_path),
                        "-o",
                        tmp_nobg,
                        "-m",
                        "birefnet-general",
                    ],
                    env=env,
                )
                if CROP.is_file():
                    run(
                        [
                            sys.executable,
                            str(CROP),
                            tmp_nobg,
                            "-o",
                            str(final_path),
                            "--padding",
                            "4",
                        ]
                    )
                else:
                    import shutil
                    shutil.copy(tmp_nobg, final_path)
            finally:
                os.unlink(tmp_nobg)

        inv_lines.append(f"{out_name}  <-  {prompt_file}")
        print("OK", final_path, flush=True)

    inv_path = OUT / "inventory.txt"
    inv_path.write_text("\n".join(inv_lines) + "\n", encoding="utf-8")
    print("Wrote", inv_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
