#!/usr/bin/env python3
"""生成分包内可解码的 WAV 占位音效与短 BGM（不依赖 Git LFS / ffmpeg）。

正式资源可换为 Suno/Udio 等导出的 MP3 后，同步改 AudioConfig 中的 src。
"""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "minigame" / "subpkg_audio"
RATE = 22050


def write_wav(path: Path, samples: list[int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        for s in samples:
            w.writeframes(struct.pack("<h", max(-32768, min(32767, int(s)))))


def sine_burst(freq: float, duration: float, amp: float = 0.25) -> list[float]:
    n = max(1, int(RATE * duration))
    out: list[float] = []
    for i in range(n):
        t = i / RATE
        a_in = min(1.0, i / max(1, n * 0.08))
        a_out = min(1.0, (n - i) / max(1, n * 0.2))
        env = a_in * a_out
        out.append(32767 * amp * env * math.sin(2 * math.pi * freq * t))
    return out


def silence(duration: float) -> list[float]:
    return [0.0] * int(RATE * duration)


def freq_sweep(f0: float, f1: float, duration: float, amp: float = 0.2) -> list[float]:
    n = max(1, int(RATE * duration))
    out: list[float] = []
    for i in range(n):
        t = i / RATE
        u = i / max(1, n - 1)
        f = f0 + (f1 - f0) * u
        env = min(1.0, i / max(1, n * 0.1)) * min(1.0, (n - i) / max(1, n * 0.15))
        out.append(32767 * amp * env * math.sin(2 * math.pi * f * t))
    return out


def soft_bgm_loopish(seconds: float, freqs: list[float], amp: float = 0.06) -> list[float]:
    """几秒柔和和弦感占位，非无缝循环，仅供开发机有声。"""
    n = int(RATE * seconds)
    out: list[float] = []
    for i in range(n):
        t = i / RATE
        v = 0.0
        for k, f in enumerate(freqs):
            v += math.sin(2 * math.pi * f * t + k * 0.7) * (0.4 + 0.15 * k)
        env = min(1.0, i / (RATE * 0.4)) * min(1.0, (n - i) / (RATE * 0.6))
        out.append(32767 * amp * env * v / max(1, len(freqs)))
    return out


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)

    # button_click：game_assets/huahua/bgm/按钮通用.mp3 → subpkg_audio/button_click.mp3（纯音频）

    # merge_success：game_assets/huahua/bgm/合成3.mp3 首 1s → subpkg_audio/merge_success.mp3（ffmpeg -t 1 -vn -map 0:a:0）
    # tap_building：正式为 game_assets/huahua/bgm/合成2.mp3 → subpkg_audio/tap_building.mp3

    arrive = sine_burst(784, 0.06, 0.22) + sine_burst(988, 0.1, 0.18) + silence(0.04)
    write_wav(ROOT / "customer_arrive.wav", [int(x) for x in arrive])

    # customer_deliver：正式为 game_assets/huahua/bgm/完成订单.mp3 → subpkg_audio/customer_deliver.mp3

    chest = sine_burst(330, 0.05, 0.25) + sine_burst(440, 0.12, 0.3) + silence(0.03)
    write_wav(ROOT / "chest_open.wav", [int(x) for x in chest])

    unlock = sine_burst(659, 0.05, 0.2) + freq_sweep(880, 1320, 0.15, 0.15) + silence(0.02)
    write_wav(ROOT / "cell_unlock.wav", [int(x) for x in unlock])

    level = (
        sine_burst(523, 0.08, 0.22)
        + sine_burst(659, 0.08, 0.22)
        + sine_burst(784, 0.1, 0.26)
        + sine_burst(1046, 0.14, 0.24)
    )
    write_wav(ROOT / "level_up.wav", [int(x) for x in level])

    achieve = sine_burst(740, 0.07, 0.2) + sine_burst(932, 0.1, 0.22) + silence(0.04)
    write_wav(ROOT / "achievement.wav", [int(x) for x in achieve])

    checkin = sine_burst(622, 0.06, 0.24) + sine_burst(784, 0.06, 0.24) + sine_burst(988, 0.12, 0.26)
    write_wav(ROOT / "checkin.wav", [int(x) for x in checkin])

    # 奖励飞入与完成订单统一用 customer_deliver.mp3，不再单独生成 reward_fly_whoosh

    # ui_reward_fanfare：正式为 game_assets/huahua/bgm/奖励.mp3 → subpkg_audio/ui_reward_fanfare.mp3

    map_open = freq_sweep(200, 600, 0.45, 0.16) + silence(0.05)
    write_wav(ROOT / "world_map_open.wav", [int(x) for x in map_open])

    # 合成主 BGM：bgm_main.mp3；花店 BGM：subpkg_audio/bgm_shop_felt_petals.mp3（资产库拷贝，非本脚本生成）

    names = [
        "customer_arrive.wav",
        "chest_open.wav",
        "cell_unlock.wav",
        "level_up.wav",
        "achievement.wav",
        "checkin.wav",
        "world_map_open.wav",
    ]
    print("Wrote under", ROOT)
    for n in names:
        print(" ", n)
    print("bgm_main / bgm_story: subpkg_audio/bgm_main.mp3 (not generated here).")
    print("bgm_shop: subpkg_audio/bgm_shop_felt_petals.mp3 — copy from game_assets/huahua/bgm/Felt Petals.mp3")
    print("customer_deliver: subpkg_audio/customer_deliver.mp3 — copy from game_assets/huahua/bgm/完成订单.mp3")
    print("merge_success: subpkg_audio/merge_success.mp3 — trim 1s from game_assets/huahua/bgm/合成3.mp3")
    print("tap_building: subpkg_audio/tap_building.mp3 — copy from game_assets/huahua/bgm/合成2.mp3")
    print("ui_reward_fanfare: subpkg_audio/ui_reward_fanfare.mp3 — copy from game_assets/huahua/bgm/奖励.mp3")
    print("collection_unlock: subpkg_audio/collection_unlock.mp3 — copy from game_assets/huahua/bgm/解锁图鉴.mp3")
    print("purchase_tap: subpkg_audio/purchase_tap.mp3 — ~0.4s + tail afade from game_assets/huahua/bgm/购买.mp3")
    print("button_click: subpkg_audio/button_click.mp3 — from game_assets/huahua/bgm/按钮通用.mp3")
    print("Replace WAV with real assets when ready; update src in src/config/AudioConfig.ts")


if __name__ == "__main__":
    main()
