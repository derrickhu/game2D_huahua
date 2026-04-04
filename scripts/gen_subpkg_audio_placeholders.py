#!/usr/bin/env python3
"""生成分包内可解码的 WAV 占位音效（不依赖 Git LFS / ffmpeg）。

仓库内 *.mp3 若未执行 git lfs pull，实为 LFS 指针文本，微信 InnerAudioContext 会报 EncodingError。
占位 WAV 用标准库 wave 写入，可直接入库与真机解码。
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


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)

    click = sine_burst(880, 0.05, 0.35) + sine_burst(660, 0.04, 0.2) + silence(0.02)
    write_wav(ROOT / "button_click.wav", [int(x) for x in click])

    ding = sine_burst(523, 0.08, 0.3) + silence(0.03) + sine_burst(659, 0.12, 0.35) + silence(0.05)
    write_wav(ROOT / "merge_success.wav", [int(x) for x in ding])

    print("Wrote:", ROOT / "button_click.wav", ROOT / "merge_success.wav")
    print("Note: 正式工程用 MP3（button_click/merge_success/bgm_main.mp3）；本脚本仅本地无资源时占位。")


if __name__ == "__main__":
    main()
