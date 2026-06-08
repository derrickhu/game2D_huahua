#!/usr/bin/env python3
"""
校验订单花愿曲线：H(L) 与 2×H(L−1) 的比值（须与 src/config/OrderHuayuanConfig.ts 公式一致）。
用法：仓库根目录执行  python3 scripts/verify_order_huayuan_curve.py
"""
from __future__ import annotations

import math

CURVES = {
    "鲜花 fresh": (12, 1.5, 13),
    "花束 bouquet": (14, 1.51, 10),
    "绿植 green": (12, 1.52, 13),
    "蝴蝶 butterfly": (12, 1.45, 10),
    "冷饮 cold": (14, 1.5, 8),
    "甜品 dessert": (13, 1.49, 10),
}
MULTI_K = 0.20
PARITY = 0.9
CHALLENGE = 1.06
TIER_MULT = {"C": 1, "B": 1.1, "A": 1.75, "S": 3.8}


def js_round(value: float) -> int:
    """匹配 TypeScript Math.round 的正数取整行为。"""
    return math.floor(value + 0.5)


def h(level: int, base: float, growth: float) -> int:
    return max(1, js_round(base * growth ** (level - 1)))


def single_slot_base(h_l: int, h_lm1: int | None) -> int:
    """模拟 CustomerManager：多槽加成后单槽 sum=h_l，再合成保底。"""
    preliminary = max(1, js_round(h_l * (1 + MULTI_K * 0)))
    if h_lm1 is None or h_lm1 < 1:
        return preliminary
    floor = js_round(PARITY * 2 * h_lm1)
    return max(preliminary, floor)


def main() -> None:
    print("订单单品 H(L)、比值 H(L)/(2*H(L-1))、单槽保底后有效值")
    for label, (base, growth, max_level) in CURVES.items():
        print(f"\n{label}")
        print("L | H(L) | H/(2*H-1) | base_after_floor")
        print("-" * 50)
        prev = None
        for lv in range(1, max_level + 1):
            value = h(lv, base, growth)
            ratio = value / (2 * prev) if prev else float("nan")
            eff = single_slot_base(value, prev)
            print(f"{lv:2d} | {value:5d} | {ratio:8.3f} | {eff:5d}")
            prev = value

    flower_base, flower_growth, _ = CURVES["鲜花 fresh"]
    a, b = h(4, flower_base, flower_growth), h(5, flower_base, flower_growth)
    duo = max(1, js_round((a + b) * (1 + MULTI_K * 1)))
    print(f"\n双槽花示例 L4+L5：sum加成后 = {duo}（恒 ≥ {a + b}）")
    print(f"档位倍率：{TIER_MULT}")
    print(f"challenge 再×{CHALLENGE} ≈ {js_round(duo * CHALLENGE)}")


if __name__ == "__main__":
    main()
