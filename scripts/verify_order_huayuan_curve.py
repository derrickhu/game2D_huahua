#!/usr/bin/env python3
"""
校验订单花愿曲线：H(L) 与 2×H(L−1) 的比值（须与 src/config/OrderHuayuanConfig.ts 公式一致）。
用法：仓库根目录执行  python3 scripts/verify_order_huayuan_curve.py
"""
from __future__ import annotations

FLOWER_BASE = 12
FLOWER_GROWTH = 1.5
DRINK_BASE = 13
DRINK_GROWTH = 1.47
MULTI_K = 0.16
PARITY = 0.9
CHALLENGE = 1.06


def flower_h(level: int) -> int:
    return max(1, round(FLOWER_BASE * FLOWER_GROWTH ** (level - 1)))


def drink_h(level: int) -> int:
    return max(1, round(DRINK_BASE * DRINK_GROWTH ** (level - 1)))


def single_slot_base(h_l: int, h_lm1: int | None) -> int:
    """模拟 CustomerManager：多槽加成后单槽 sum=h_l，再合成保底。"""
    preliminary = max(1, round(h_l * (1 + MULTI_K * 0)))
    if h_lm1 is None or h_lm1 < 1:
        return preliminary
    floor = round(PARITY * 2 * h_lm1)
    return max(preliminary, floor)


def main() -> None:
    print("花系 H(L)、比值 H(L)/(2*H(L-1))、单槽保底后有效值")
    print("L | H(L) | H/(2*H-1) | base_after_floor")
    print("-" * 50)
    prev = None
    for lv in range(1, 11):
        h = flower_h(lv)
        ratio = h / (2 * prev) if prev else float("nan")
        eff = single_slot_base(h, prev)
        print(f"{lv:2d} | {h:5d} | {ratio:8.3f} | {eff:5d}")
        prev = h

    print("\n饮品 H(L)、比值 H(L)/(2*H(L-1))")
    prev_d = None
    for lv in range(1, 9):
        h = drink_h(lv)
        ratio = h / (2 * prev_d) if prev_d else float("nan")
        eff = single_slot_base(h, prev_d)
        print(f"{lv:2d} | {h:5d} | {ratio:8.3f} | {eff:5d}")
        prev_d = h

    a, b = flower_h(4), flower_h(5)
    duo = max(1, round((a + b) * (1 + MULTI_K * 1)))
    print(f"\n双槽花示例 L4+L5：sum加成后 = {duo}（恒 ≥ {a + b}）")
    print(f"challenge 再×{CHALLENGE} ≈ {round(duo * CHALLENGE)}")


if __name__ == "__main__":
    main()
