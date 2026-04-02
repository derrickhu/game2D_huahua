"""
本仓库与「同级目录 game_assets/huahua」的路径解析。

约定：资产库与仓库根目录同级，即 <parent>/game_assets/huahua/。
可通过环境变量 GAME_ASSETS_HUAHUA 指向该 huahua 资产根目录（含 raw、assets 子树的上级，即 game_assets/huahua 这一层）。
"""
from __future__ import annotations

import os
from pathlib import Path


def repo_root() -> Path:
    """本仓库根目录（game2D_huahua）。"""
    return Path(__file__).resolve().parent.parent


def game_assets_huahua_root() -> Path:
    """仓库外 huahua 资产根：默认 ../game_assets/huahua（相对 repo）。"""
    env = os.environ.get("GAME_ASSETS_HUAHUA", "").strip()
    if env:
        return Path(env).expanduser().resolve()
    return (repo_root().parent / "game_assets" / "huahua").resolve()


def game_assets_dir() -> Path:
    """…/game_assets/huahua/assets"""
    return game_assets_huahua_root() / "assets"
