# 花束链路 · 两套美术设计（v3 — 以 bake 线画风为唯一参考）

## 画风参考

**唯一参考**：`minigame/subpkg_items/images/tools/bake/tool_bake_{1,2,3}.png`

从实图提取的画风关键词（英文，直接用于提示词）：

> Cute small mobile game item icon, 3/4 top-down isometric view. Rounded chunky proportions, slightly chibi/compact. Soft smooth gradient shading with small bright highlight spots on surfaces. No hard black outlines — edges defined by color transitions and subtle darker-tone borders only. Warm cozy color palette with realistic material colors. Clean simple white background. No text, no labels, no UI elements. The item should look like a tiny desktop ornament.

## 生成参数

- 模型：`gemini-2.5-flash-image`
- 风格参考图：`--image tool_bake_2.png`（烤箱，当前烘焙线标准风格参考）
- 背景：白色（提示词要求），生成后用 **rembg** 抠图（不再用品红键）
- 输出：`game_assets/.../raw/` → rembg → `minigame/subpkg_items/images/tools/`

## 线 A — tool_arrange（包装工具 5 级）

| 级 | 配置名 | 图标内容 |
|---|--------|---------|
| L1 | 铁丝 | 一小卷花艺铁丝绕在木轴上 |
| L2 | 铁丝剪刀 | 花艺剪刀，银刃+彩柄 |
| L3 | 简易包装台 | 小木台+剪刀+丝带卷 |
| L4 | 包装台 | 木台+挂杆丝带+纸卷+抽屉 |
| L5 | 高级包装台 | 木台+侧架+更多道具+热熔枪 |

## 线 B — flower_wrap（包装中间品 4 级）

L1-L3 纯合成中间品，统一简洁。L4 可产出花束，跳级精致。

| 级 | 配置名 | 图标内容 |
|---|--------|---------|
| L1 | 丝带卷 | 粉紫色缎面丝带卷 |
| L2 | 丝带条 | 几段彩色丝带散落 |
| L3 | 包装纸 | 一卷淡彩花纹包装纸 |
| L4 | 花艺材料篮 | 编织篮+多色纸卷+丝带+小花装饰 |
