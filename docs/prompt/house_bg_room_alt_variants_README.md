# 花店房间壳 · 四款变体（NB2 + 参考图锁定布局）

**糖果 pastel 单套**（非下表四套之一）：见 `house_bg_room_candy_nb2_prompt.txt`，建议输出 `bg_room_candy_nb2.png`；索引见 `docs/furniture-image-prompts.md` 小节 **7a-candy**。

**粉白蓝房壳**：`house_bg_room_pinkblue_nb2_prompt.txt` → `bg_room_pinkblue_nb2.png`（`style_pinkblue_nb2`）。

**三套 NB2 扩展房壳**（花境 / 海岛 / 彩屑）：`house_bg_room_bloom_parade_nb2_prompt.txt`、`house_bg_room_lagoon_punch_nb2_prompt.txt`、`house_bg_room_confetti_cottage_nb2_prompt.txt`；**原始 PNG 输出到** `game_assets/huahua/assets/preview_house_room/`，抠图后再拷贝至 `minigame/.../house/`。迭代地板时 `--image` 用对应成品 `bg_room_*_nb2.png`（提示词为局部改地板）。索引见 **7a-nb2**。

以当前默认房 [`bg_room_default.png`](../../minigame/subpkg_deco/images/house/bg_room_default.png) 为 **唯一布局参考**（`--image`），要求 **1:1 画幅、体量与在画面中的位置一致**，只换配色与材质气质。

| 文件 | 风格取向 | 建议输出文件名 |
|------|----------|----------------|
| `house_bg_room_alt_mint_nb2_prompt.txt` | 薄荷北欧 | `bg_room_alt_mint_nb2.png` |
| `house_bg_room_alt_autumn_nb2_prompt.txt` | 焦糖秋叶 | `bg_room_alt_autumn_nb2.png` |
| `house_bg_room_alt_lilac_nb2_prompt.txt` | 淡紫童话 | `bg_room_alt_lilac_nb2.png` |
| `house_bg_room_alt_lagoon_nb2_prompt.txt` | 热带泻湖 | `bg_room_alt_lagoon_nb2.png` |

原图目录：`/Users/huyi/rosa_games/game_assets/huahua/assets/preview_house_room/`  
仓库对比：`minigame/subpkg_deco/images/house/preview/`

批量命令（NB2 + 参考图）：

```bash
REF="/Users/huyi/rosa_games/huahua/minigame/subpkg_deco/images/house/bg_room_default.png"
OUT="/Users/huyi/rosa_games/game_assets/huahua/assets/preview_house_room"
PR="/Users/huyi/rosa_games/huahua/docs/prompt"
PY="$HOME/.cursor/skills/gemini-image-gen/scripts/generate_images.py"
M="gemini-3.1-flash-image-preview"

PREV="/Users/huyi/rosa_games/huahua/minigame/subpkg_deco/images/house/preview"
mkdir -p "$OUT" "$PREV"

run() {
  local name="$1" file="$2"
  python3 "$PY" --prompt-file "$PR/$file" -o "$OUT/${name}.png" --model "$M" --aspect-ratio 1:1 --image "$REF"
  cp "$OUT/${name}.png" "$PREV/"
  sleep 10
}

run bg_room_alt_mint_nb2    house_bg_room_alt_mint_nb2_prompt.txt
run bg_room_alt_autumn_nb2  house_bg_room_alt_autumn_nb2_prompt.txt
run bg_room_alt_lilac_nb2   house_bg_room_alt_lilac_nb2_prompt.txt
run bg_room_alt_lagoon_nb2  house_bg_room_alt_lagoon_nb2_prompt.txt
```

验收后可抠图再替换 `bg_room_white.png` / `bg_room_vintage.png` / `bg_room_spring.png` 等（需在 `DecorationConfig` 与 `TextureCache` 中保持 key 一致）。
