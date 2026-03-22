# 鲜花线 flower_fresh — NB2 单图 1×10（与茶饮/甜品/绿植同一套经验）

## 脚本

- `huahua/scripts/gen_flower_fresh_nb2.py`
- 模型：`gemini-3.1-flash-image-preview`，`--aspect-ratio 1:1`
- 输出（**仓库外**）：`game_assets/.../flower_fresh_nb2/for_review/1x1/flower_fresh_{1..10}_nb2_1x1.png`

## 与茶饮/甜品对齐的纪律

- 底：纯 `#FF00FF`；**主体禁止用屏品红**
- **硬边**：轮廓外紧邻即品红，禁止半透明白晕、柔化外发光；禁止盘沿灰影糊到背景
- **高饱和、鲜亮**，与冷饮/绿植线一致；**发线级同色相描边**，禁止整圈粗黑边
- **禁止外圈奶白描边**；高光只在形体内部 tight patch
- **无文字**

## 等级与游戏内名称（Lv1–6）

| Lv | 游戏名 | 英文概念 |
|----|--------|----------|
| 1 | 花种子 | seed + sprout |
| 2 | 花苞 | **一根绿茎分叉**，两枚**更小**花苞；茎略长，无盆 |
| 3 | 小雏菊 | daisy |
| 4 | 向日葵 | sunflower |
| 5 | 康乃馨 | 卷边花球 + 绿萼与茎；**层叠阴影与高光做出体积**；**略倾斜/非绝对对称**，忌扁平对称剪贴画 |
| 6 | 玫瑰 | 螺旋花头 + **明显外露花茎**（穿过/下过叶片） |
| 7 | （卡片未列） | 百合星形花 + **明显花茎** |
| 8 | （卡片未列） | hydrangea |
| 9 | （卡片未列） | orchid |
| 10 | （卡片未列） | gold peony prestige |

## 命令

```bash
# 全部 10 张
python3 huahua/scripts/gen_flower_fresh_nb2.py

# 仅部分等级
python3 huahua/scripts/gen_flower_fresh_nb2.py --levels 3,4,5
```

抠图并进游戏：

```bash
python3 huahua/scripts/process_flower_fresh_nb2.py
# 或单级
python3 huahua/scripts/process_flower_fresh_nb2.py --levels 5
```
输出：`minigame/images/flowers/fresh/flower_fresh_{1..10}.png`
