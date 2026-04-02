# 花房主题家具 — NB2 生图与入库

## 流程

1. 提示词正文在 `docs/prompt/furniture_<key>_nb2_prompt.txt`（**仅英文正文**，无 `#` 行，避免打进 API）。
2. 生图到仓库外资源库：

```bash
mkdir -p ../game_assets/huahua/assets/raw
./scripts/gen_furniture_greenhouse_nb2.sh
```

脚本内模型：`gemini-3.1-flash-image-preview`，比例 `1:1`。若代理/区域问题，可设 `GEMINI_IMAGE_REST_ONLY=1`（见 gemini-image-gen skill）。

3. 抠图：脚本已调用 `rembg_single.py -m birefnet-general`（项目强制规范）。
4. 裁透明边：`game-art-pipeline` 的 `crop_trim.py --padding 4`。
5. 成品 PNG 写入 `minigame/subpkg_deco/images/furniture/<key>.png`；`TextureCache` 与 `DecorationConfig` 已登记同名 key。

## 占位与重试

- 若尚未跑完脚本，仓库内可能暂为 **64×64 透明占位 PNG**（避免缺图路径报错）；跑通 `gen_furniture_greenhouse_nb2.sh` 后即被正式图覆盖。
- API 偶发 **500 / 503 / 代理断开** 时：多试几次或隔段时间再跑脚本；单张已成功时可从失败项继续执行（脚本会覆盖同名输出）。

## 本批次键名与游戏内名称

| 纹理 key | 中文名 | 槽位 | 备注 |
|----------|--------|------|------|
| `wallart_greenhouse_chalkboard` | 花房落地小黑板 | 摆件 | NB2：**户外**落地 A 字招牌架（非上墙），黑白板面 + 粉笔「花花」+ 小花/丝带装饰；提示词 `furniture_wallart_greenhouse_chalkboard_nb2_prompt.txt` |
| `orn_greenhouse_cart` | 花店小推车 | 摆件 | 贴图来自 `room/room_26.png` |
| `garden_flower_stall` | 户外小花摊 | 庭院 | 贴图来自 `room/room_27.png` |
| `greenhouse_pot_sprout` | 种子小盆栽 | 摆件 | 贴图来自 `room/room_30.png` |
| `greenhouse_pot_bud` | 花苞小盆栽 | 摆件 | 贴图来自 `room/room_32.png` |
| `greenhouse_pot_daisy` | 雏菊小盆栽 | 摆件 | 贴图来自 `room/room_07.png` |
| `greenhouse_pot_sunflower` | 向日葵小盆栽 | 摆件 | 鲜花线概念 |
| `greenhouse_pot_carnation` | 康乃馨小盆栽 | 摆件 | 鲜花线概念 |
| `greenhouse_pot_rose` | 玫瑰小盆栽 | 摆件 | 鲜花线概念 |
| `greenhouse_pot_lily` | 百合小盆栽 | 摆件 | 鲜花线概念 |
| `greenhouse_pot_hydrangea` | 绣球小盆栽 | 摆件 | 鲜花线概念 |
| `greenhouse_pot_orchid` | 蝴蝶兰小盆栽 | 摆件 | 鲜花线概念 |
| `greenhouse_pot_peony_gold` | 金牡丹小盆栽 | 摆件 | 鲜花线概念 |

## 与昨日家具批次的关系

画风与 `furniture_batch10_meta.txt` 及同目录下 `furniture_light_kettle_pastel_nb2_prompt.txt`、`furniture_orn_awaken_bucket_nb2_prompt.txt` 等一致：同一段 isometric / pastel / brown outline / white background 描述，仅替换主体物。落地小黑板为**户外店前立地 A 字招牌**（非上墙），暖木框 + 黑白板面 + 粉笔「花花」+ 小花/丝带等点缀，线宽可与 `room/room_11.png` 一类木框小物对齐。
