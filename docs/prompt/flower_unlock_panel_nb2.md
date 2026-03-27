# 鲜花解锁 / 花语彩蛋弹窗 — NB2 原型

## 设计说明

- **形式**：居中圆角大卡片（与现有 `FlowerEasterEggSystem` 一致），**无画架、无画布**；卡片内为顶标、圆角内嵌插画区、分隔线、花语占位、奖励行、底栏主按钮。
- **画风**：治愈系合并手游、矢量感、软渐变、细描边；色系统一奶油/桃橙/咖啡棕系。

## 提示词文件

仅英文正文、无 `#` 行（供 API 原样读取）：

- [flower_unlock_panel_prototype_nb2_prompt.txt](./flower_unlock_panel_prototype_nb2_prompt.txt)

## 输出路径（非运行时，不入 minigame）

`/Users/huyi/rosa_games/game_assets/huahua/assets/ui_prototypes/flower_unlock_panel_prototype_nb2.png`

## NB2 生成命令

模型：`gemini-3.1-flash-image-preview`

```bash
mkdir -p /Users/huyi/rosa_games/game_assets/huahua/assets/ui_prototypes
python3 ~/.cursor/skills/gemini-image-gen/scripts/generate_images.py \
  --prompt-file /Users/huyi/rosa_games/huahua/docs/prompt/flower_unlock_panel_prototype_nb2_prompt.txt \
  --output /Users/huyi/rosa_games/game_assets/huahua/assets/ui_prototypes/flower_unlock_panel_prototype_nb2.png \
  --model gemini-3.1-flash-image-preview \
  --aspect-ratio 9:16
```

## 代码对照

- 逻辑与叠字：`src/systems/FlowerEasterEggSystem.ts` → `_showQuotePanel`
