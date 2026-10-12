#!/usr/bin/env python3
"""
限时活动素材归档 / 复刻（仅标准库）。

清单：docs/events/archive/<seasonId>.json，`files` 为相对 minigame/ 的路径，支持 `dir/**`。
归档位置：$GAME_ASSETS_HUAHUA/archive/events/<seasonId>/minigame/...
（默认 GAME_ASSETS_HUAHUA = 仓库同级 ../game_assets/huahua）

  python3 scripts/event_assets.py status  cool_summer_2026
  python3 scripts/event_assets.py archive cool_summer_2026 [--dry-run]
  python3 scripts/event_assets.py restore cool_summer_2026 [--dry-run]

archive：复制到归档目录 → 校验 sha256 → 删除包内文件，并在归档目录写 manifest.lock.json。
restore：按 manifest.lock.json 拷回 minigame/ 并校验；不删归档副本。
复刻兑换活动：restore 后改当期 seasonId。转盘活动还要把 WHEEL_ASSETS_IN_PACKAGE 改成 true。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MINIGAME = REPO / "minigame"
MANIFEST_DIR = REPO / "docs" / "events" / "archive"


def assets_root() -> Path:
    env = os.environ.get("GAME_ASSETS_HUAHUA")
    return Path(env).expanduser().resolve() if env else (REPO.parent / "game_assets" / "huahua").resolve()


def archive_dir(season_id: str) -> Path:
    return assets_root() / "archive" / "events" / season_id


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_manifest(season_id: str) -> dict:
    p = MANIFEST_DIR / f"{season_id}.json"
    if not p.is_file():
        sys.exit(f"[event_assets] 找不到清单 {p.relative_to(REPO)}")
    data = json.loads(p.read_text(encoding="utf-8"))
    if data.get("seasonId") != season_id:
        sys.exit(f"[event_assets] 清单 seasonId={data.get('seasonId')!r} 与参数 {season_id!r} 不符")
    return data


def expand(base: Path, patterns: list[str]) -> list[str]:
    out: list[str] = []
    for pat in patterns:
        if pat.endswith("/**"):
            d = base / pat[:-3]
            if d.is_dir():
                out += sorted(str(p.relative_to(base)) for p in d.rglob("*") if p.is_file())
        elif (base / pat).is_file():
            out.append(pat)
    return sorted(set(out))


def remove_empty_dirs(root: Path) -> None:
    if not root.is_dir():
        return
    for d in sorted((p for p in root.rglob("*") if p.is_dir()), key=lambda p: len(p.parts), reverse=True):
        (d / ".DS_Store").unlink(missing_ok=True)
        if not any(d.iterdir()):
            d.rmdir()
    (root / ".DS_Store").unlink(missing_ok=True)
    if not any(root.iterdir()):
        root.rmdir()


def cmd_status(season_id: str) -> int:
    data = load_manifest(season_id)
    in_pkg = expand(MINIGAME, data["files"])
    arch = archive_dir(season_id)
    in_arch = expand(arch / "minigame", data["files"]) if arch.is_dir() else []
    print(f"[event_assets] {season_id}（{data.get('name', '')}）")
    print(f"  包内：{len(in_pkg)} 个文件")
    for rel in in_pkg:
        print(f"    - minigame/{rel}")
    print(f"  归档：{len(in_arch)} 个文件 @ {arch}")
    return 0


def cmd_archive(season_id: str, dry_run: bool) -> int:
    data = load_manifest(season_id)
    files = expand(MINIGAME, data["files"])
    if not files:
        print(f"[event_assets] {season_id}：包内没有可归档文件（可能已归档）")
        return 0
    dest_root = archive_dir(season_id) / "minigame"
    lock: dict[str, str] = {}
    for rel in files:
        src = MINIGAME / rel
        dst = dest_root / rel
        print(f"  {'[dry] ' if dry_run else ''}minigame/{rel} -> {dst}")
        if dry_run:
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        digest = sha256(src)
        if sha256(dst) != digest:
            sys.exit(f"[event_assets] 校验失败，未删除源文件：{rel}")
        lock[rel] = digest
    if dry_run:
        return 0

    lock_path = archive_dir(season_id) / "manifest.lock.json"
    old = json.loads(lock_path.read_text(encoding="utf-8")).get("files", {}) if lock_path.is_file() else {}
    old.update(lock)
    lock_path.write_text(
        json.dumps({**data, "files": old}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    for rel in files:
        (MINIGAME / rel).unlink()
    for pat in data["files"]:
        if pat.endswith("/**"):
            remove_empty_dirs(MINIGAME / pat[:-3])
    print(f"[event_assets] 已归档 {len(files)} 个文件 → {archive_dir(season_id)}")
    return 0


def cmd_restore(season_id: str, dry_run: bool) -> int:
    load_manifest(season_id)
    lock_path = archive_dir(season_id) / "manifest.lock.json"
    if not lock_path.is_file():
        sys.exit(f"[event_assets] 没有归档记录：{lock_path}")
    files: dict[str, str] = json.loads(lock_path.read_text(encoding="utf-8"))["files"]
    src_root = archive_dir(season_id) / "minigame"
    for rel, digest in sorted(files.items()):
        src = src_root / rel
        dst = MINIGAME / rel
        if not src.is_file():
            sys.exit(f"[event_assets] 归档缺文件：{src}")
        if sha256(src) != digest:
            sys.exit(f"[event_assets] 归档文件校验不符：{src}")
        print(f"  {'[dry] ' if dry_run else ''}{src} -> minigame/{rel}")
        if dry_run:
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    if not dry_run:
        print(f"[event_assets] 已复刻 {len(files)} 个文件到 minigame/；记得在 TextureCache 里重新登记 key")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="限时活动素材归档 / 复刻")
    ap.add_argument("action", choices=["status", "archive", "restore"])
    ap.add_argument("season_id")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if args.action == "status":
        return cmd_status(args.season_id)
    if args.action == "archive":
        return cmd_archive(args.season_id, args.dry_run)
    return cmd_restore(args.season_id, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
